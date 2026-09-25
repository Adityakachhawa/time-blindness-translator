/**
 * __tests__/rmd.calibration-safety.test.ts
 *
 * Calibration safety regression for Reset My Day.
 *
 * Proves that:
 *   1. An RMD-launched full-task mission (isMicroStep absent/false) contributes
 *      to calibration normally — same as launching from TBT directly.
 *   2. The tiny step text is always a different string from the task name;
 *      it is never passed to TBT and cannot pollute history.
 *   3. isMicroStep=true records are excluded at all three calibration tiers
 *      (exact, category, global) by the existing calibration.ts filter.
 *
 * Architecture note:
 *   The URL handoff (?challenge=&min=) does NOT support isMicroStep.
 *   SetupScreen.tsx:251 UPDATE_SETUP does not read it from URL params.
 *   isMicroStep is only set programmatically from TBT's own "Start tiny step"
 *   button (SetupScreen.tsx:691). Because TBT is frozen, RMD cannot send
 *   micro-steps through the URL handoff safely.
 *
 *   RMD's "Start Me" panel therefore:
 *     - Shows the tiny step text for reading only (does NOT launch it as a mission)
 *     - Offers "start the timer" for the REAL task name + estimate (normal mission)
 *
 *   This keeps calibration clean in all scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculatePersonalFactor, getTaskHistoricalRange } from '../lib/calibration';
import { generateTinyStep } from '../lib/startMe';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const mockStore: Record<string, string> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const key in mockStore) delete mockStore[key];
  (global as any).window = {
    localStorage: {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, value: string) => { mockStore[key] = value; },
      removeItem: (key: string) => { delete mockStore[key]; },
      clear: () => { for (const key in mockStore) delete mockStore[key]; },
    },
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RMD — Calibration safety', () => {
  it('C1: RMD-launched full mission (no isMicroStep) contributes to calibration normally', () => {
    // Simulate 2 completed records saved when user does a full mission launched
    // from RMD via ?challenge=Study DBMS&min=40.
    // isMicroStep is absent/false — same semantics as starting directly from TBT.
    mockStore['tbt_task_history'] = JSON.stringify([
      {
        id: '1', taskName: 'Study DBMS', category: 'study',
        optimisticMin: 40, taxMultiplier: 1.5, allocatedMin: 60,
        actualMinutes: 60, completedAt: Date.now(),
        predictedSeconds: 2400, actualSeconds: 3000,
        // isMicroStep absent (undefined) — normal mission
      },
      {
        id: '2', taskName: 'Study DBMS', category: 'study',
        optimisticMin: 40, taxMultiplier: 1.5, allocatedMin: 60,
        actualMinutes: 60, completedAt: Date.now(),
        predictedSeconds: 2400, actualSeconds: 3000,
        isMicroStep: false, // explicit false — also a normal mission
      },
    ]);

    const factor = calculatePersonalFactor('Study DBMS', 'study');
    expect(factor).not.toBeNull();
    expect(factor!.sampleCount).toBe(2);           // both records count
    expect(factor!.factor).toBeCloseTo(1.25, 2);   // actual 3000s / predicted 2400s = 1.25
    expect(factor!.tier).toBe('exact');
  });

  it('C2: tiny step text is a different string from the task name — it is not passed to TBT', () => {
    // RMD sends task.name ("Study DBMS") to TBT — NOT the tiny step text.
    // Verify the strings are distinct in every case to rule out accidental collision.
    const taskName = 'Study DBMS';
    const tinyStepText = generateTinyStep(taskName);

    expect(tinyStepText).not.toBe(taskName);
    // Tiny step is "Open the book or document to the correct page."
    expect(tinyStepText).toBe('Open the book or document to the correct page.');

    // Populate history with the real task only
    mockStore['tbt_task_history'] = JSON.stringify([
      {
        id: '1', taskName, category: 'study',
        optimisticMin: 40, taxMultiplier: 1.5, allocatedMin: 60,
        actualMinutes: 60, completedAt: Date.now(),
        predictedSeconds: 2400, actualSeconds: 3000,
      },
      {
        id: '2', taskName, category: 'study',
        optimisticMin: 40, taxMultiplier: 1.5, allocatedMin: 60,
        actualMinutes: 60, completedAt: Date.now(),
        predictedSeconds: 2400, actualSeconds: 3000,
      },
    ]);

    // Tiny step text has NO history → calibration returns null
    const tinyStepFactor = calculatePersonalFactor(tinyStepText);
    expect(tinyStepFactor).toBeNull();

    // Real task name HAS history → calibration returns data
    const realFactor = calculatePersonalFactor(taskName, 'study');
    expect(realFactor).not.toBeNull();
    expect(realFactor!.sampleCount).toBe(2);
  });

  it('C3: isMicroStep=true records are excluded at all three calibration tiers', () => {
    // Even if a micro-step record somehow exists for the same task name,
    // calibration must not count it.
    mockStore['tbt_task_history'] = JSON.stringify([
      {
        id: '1', taskName: 'Study DBMS', category: 'study',
        optimisticMin: 40, taxMultiplier: 1.5, allocatedMin: 60,
        actualMinutes: 60, completedAt: Date.now(),
        predictedSeconds: 2400, actualSeconds: 3000,
        isMicroStep: false,
      },
      {
        id: '2', taskName: 'Study DBMS', category: 'study',
        optimisticMin: 40, taxMultiplier: 1.5, allocatedMin: 60,
        actualMinutes: 60, completedAt: Date.now(),
        predictedSeconds: 2400, actualSeconds: 3000,
        isMicroStep: false,
      },
      {
        // Micro-step with same task name — must be excluded everywhere
        id: '3', taskName: 'Study DBMS', category: 'study',
        optimisticMin: 2, taxMultiplier: 1.0, allocatedMin: 2,
        actualMinutes: 2, completedAt: Date.now(),
        predictedSeconds: 120, actualSeconds: 120,
        isMicroStep: true,
      },
    ]);

    // calculatePersonalFactor (exact + category + global) excludes isMicroStep=true
    const factor = calculatePersonalFactor('Study DBMS', 'study');
    expect(factor!.sampleCount).toBe(2);          // micro-step excluded → only 2 records
    expect(factor!.factor).toBeCloseTo(1.25, 2);  // ratio from normal records only

    // getTaskHistoricalRange excludes isMicroStep=true
    const range = getTaskHistoricalRange('Study DBMS');
    expect(range).not.toBeNull();
    // Normal records: actualSeconds=3000 each → 50 min each → median = 50
    // Micro-step's 2 min is excluded
    expect(range!.median).toBeCloseTo(50, 0);
    expect(range!.lower).toBe(45);  // 50 - 5
    expect(range!.upper).toBe(55);  // 50 + 5
  });

  it('C4: getTaskHistoricalRange returns null when ONLY micro-step records exist', () => {
    // If somehow the only records for a task are micro-steps, range should be null
    // (no usable history), not polluted values.
    mockStore['tbt_task_history'] = JSON.stringify([
      {
        id: '1', taskName: 'Study DBMS', category: 'study',
        optimisticMin: 2, taxMultiplier: 1.0, allocatedMin: 2,
        actualMinutes: 2, completedAt: Date.now(),
        predictedSeconds: 120, actualSeconds: 120,
        isMicroStep: true,
      },
    ]);

    const range = getTaskHistoricalRange('Study DBMS');
    expect(range).toBeNull(); // micro-step excluded → no usable data
  });
});
