/**
 * __tests__/rmd.sequencer.test.ts
 *
 * Pure unit tests for the Reset My Day sequencing algorithm.
 * Tests 1–12 as specified in the implementation spec.
 */

import { describe, it, expect } from 'vitest';
import { buildRecoveryPlan, type RmdTask } from '../app/reset-my-day/lib/sequencer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(
  overrides: Partial<RmdTask> & { id: string; name: string }
): RmdTask {
  return {
    priority: 'important',
    estimatedMinutes: 30,
    hasHistory: false,
    userOrder: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RMD Sequencer — buildRecoveryPlan', () => {
  // 1. Zero tasks
  it('1. zero tasks → all buckets empty, committedMinutes = 0', () => {
    const plan = buildRecoveryPlan([], 120);
    expect(plan.doNow).toHaveLength(0);
    expect(plan.then).toHaveLength(0);
    expect(plan.optional).toHaveLength(0);
    expect(plan.skip).toHaveLength(0);
    expect(plan.committedMinutes).toBe(0);
  });

  // 2. One important task fits
  it('2. one important task fits → DO_NOW, correct bucket', () => {
    const tasks = [makeTask({ id: 'a', name: 'Email', estimatedMinutes: 20 })];
    const plan = buildRecoveryPlan(tasks, 60);
    expect(plan.doNow).toHaveLength(1);
    expect(plan.doNow[0].name).toBe('Email');
    expect(plan.doNow[0].bucket).toBe('DO_NOW');
    expect(plan.then).toHaveLength(0);
    expect(plan.skip).toHaveLength(0);
    expect(plan.committedMinutes).toBe(20);
  });

  // 3. Multiple important tasks fit
  it('3. multiple important tasks fit → first in DO_NOW, rest in THEN', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'Task A', estimatedMinutes: 20, userOrder: 0 }),
      makeTask({ id: 'b', name: 'Task B', estimatedMinutes: 25, userOrder: 1 }),
      makeTask({ id: 'c', name: 'Task C', estimatedMinutes: 30, userOrder: 2 }),
    ];
    const plan = buildRecoveryPlan(tasks, 120);
    expect(plan.doNow).toHaveLength(1);
    expect(plan.doNow[0].name).toBe('Task A');
    expect(plan.then).toHaveLength(2);
    expect(plan.then[0].name).toBe('Task B');
    expect(plan.then[1].name).toBe('Task C');
    expect(plan.skip).toHaveLength(0);
    expect(plan.committedMinutes).toBe(75);
  });

  // 4. Task exceeds available time → SKIP
  it('4. task exceeds available time → SKIP', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'Big Task', estimatedMinutes: 90 }),
    ];
    const plan = buildRecoveryPlan(tasks, 60);
    expect(plan.doNow).toHaveLength(0);
    expect(plan.skip).toHaveLength(1);
    expect(plan.skip[0].name).toBe('Big Task');
    expect(plan.committedMinutes).toBe(0);
  });

  // 5. Optional task fits after important tasks
  it('5. optional task fits after important tasks → OPTIONAL', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'Important', priority: 'important', estimatedMinutes: 30, userOrder: 0 }),
      makeTask({ id: 'b', name: 'Optional', priority: 'optional', estimatedMinutes: 20, userOrder: 0 }),
    ];
    const plan = buildRecoveryPlan(tasks, 60);
    expect(plan.doNow[0].name).toBe('Important');
    expect(plan.optional).toHaveLength(1);
    expect(plan.optional[0].name).toBe('Optional');
    expect(plan.optional[0].bucket).toBe('OPTIONAL');
    expect(plan.skip).toHaveLength(0);
  });

  // 6. Optional task does not fit → SKIP
  it('6. optional task does not fit → SKIP', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'Important', priority: 'important', estimatedMinutes: 50, userOrder: 0 }),
      makeTask({ id: 'b', name: 'Optional', priority: 'optional', estimatedMinutes: 30, userOrder: 0 }),
    ];
    const plan = buildRecoveryPlan(tasks, 60);
    expect(plan.optional).toHaveLength(0);
    expect(plan.skip).toHaveLength(1);
    expect(plan.skip[0].name).toBe('Optional');
  });

  // 7. Exact budget boundary — task fits exactly
  it('7. exact budget boundary → task fits (≤ is sufficient)', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'Exact', estimatedMinutes: 60 }),
    ];
    const plan = buildRecoveryPlan(tasks, 60);
    expect(plan.doNow).toHaveLength(1);
    expect(plan.skip).toHaveLength(0);
    expect(plan.committedMinutes).toBe(60);
  });

  // 8. User ordering preserved within priority groups
  it('8. user ordering preserved within priority groups', () => {
    const tasks = [
      makeTask({ id: 'c', name: 'Third', priority: 'important', estimatedMinutes: 15, userOrder: 2 }),
      makeTask({ id: 'a', name: 'First', priority: 'important', estimatedMinutes: 15, userOrder: 0 }),
      makeTask({ id: 'b', name: 'Second', priority: 'important', estimatedMinutes: 15, userOrder: 1 }),
    ];
    const plan = buildRecoveryPlan(tasks, 120);
    expect(plan.doNow[0].name).toBe('First');
    expect(plan.then[0].name).toBe('Second');
    expect(plan.then[1].name).toBe('Third');
  });

  // 9. History estimate used (hasHistory=true)
  it('9. history estimate used when hasHistory=true', () => {
    const tasks = [
      makeTask({
        id: 'a',
        name: 'Study',
        estimatedMinutes: 40,
        hasHistory: true,
        historicalRange: 'Usually 35–45 min',
        userOrder: 0,
      }),
    ];
    const plan = buildRecoveryPlan(tasks, 60);
    expect(plan.doNow[0].estimatedMinutes).toBe(40);
    expect(plan.doNow[0].hasHistory).toBe(true);
    expect(plan.doNow[0].historicalRange).toBe('Usually 35–45 min');
  });

  // 10. No-history estimate fallback
  it('10. no-history estimate fallback — uses user estimate', () => {
    const tasks = [
      makeTask({
        id: 'a',
        name: 'New Task',
        estimatedMinutes: 25,
        hasHistory: false,
        userOrder: 0,
      }),
    ];
    const plan = buildRecoveryPlan(tasks, 60);
    expect(plan.doNow[0].estimatedMinutes).toBe(25);
    expect(plan.doNow[0].hasHistory).toBe(false);
  });

  // 11. Zero budget → everything goes to SKIP
  it('11. zero budget → all tasks in SKIP', () => {
    const tasks = [
      makeTask({ id: 'a', name: 'Task A', estimatedMinutes: 30 }),
      makeTask({ id: 'b', name: 'Task B', estimatedMinutes: 20 }),
    ];
    const plan = buildRecoveryPlan(tasks, 0);
    expect(plan.doNow).toHaveLength(0);
    expect(plan.then).toHaveLength(0);
    expect(plan.skip).toHaveLength(2);
    expect(plan.committedMinutes).toBe(0);
  });

  // 12. Important-before-optional regardless of userOrder
  it('12. important tasks processed before optional regardless of userOrder values', () => {
    const tasks = [
      makeTask({ id: 'opt', name: 'Optional A', priority: 'optional', estimatedMinutes: 20, userOrder: 0 }),
      makeTask({ id: 'imp', name: 'Important A', priority: 'important', estimatedMinutes: 20, userOrder: 1 }),
    ];
    const plan = buildRecoveryPlan(tasks, 30);
    // Important A should be in DO_NOW even though it has higher userOrder
    expect(plan.doNow[0].name).toBe('Important A');
    // Optional A doesn't fit in remaining 10 min
    expect(plan.skip[0].name).toBe('Optional A');
  });
});

// ---------------------------------------------------------------------------
// Start Me integration (helper level)
// ---------------------------------------------------------------------------

import { generateTinyStep } from '../lib/startMe';

describe('RMD — Start Me integration (helper level)', () => {
  it('generates a study step for study tasks', () => {
    expect(generateTinyStep('study DBMS')).toBe('Open the book or document to the correct page.');
  });

  it('generates a cleaning step for cleaning tasks', () => {
    expect(generateTinyStep('clean the kitchen')).toBe('Pick up 5 things from the floor.');
  });

  it('generates a fallback for unknown tasks', () => {
    expect(generateTinyStep('prepare presentation')).toBe('Gather what you need and put it in front of you.');
  });
});
