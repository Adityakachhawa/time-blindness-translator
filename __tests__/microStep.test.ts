import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculatePersonalFactor, getTaskHistoricalRange } from '../lib/calibration';
import * as storage from '../lib/storage';
import { startMission, completeMission, extendMission, recalculateMission } from '../lib/mission/actions';

// Mock window for storage.ts
const mockStore: Record<string, string> = {};
(global as any).window = {
  localStorage: {
    getItem: vi.fn((key: string) => mockStore[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockStore[key] = value; }),
    clear: vi.fn(() => {
      for (const key in mockStore) delete mockStore[key];
    }),
  }
};

describe('Micro-Step Data Semantics & Regression Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Case A & D: Normal mission (undefined/legacy) contributes to calibration', () => {
    window.localStorage.setItem('tbt_task_history', JSON.stringify([
      {
        id: '1',
        taskName: 'Clean the kitchen',
        category: 'cleaning',
        optimisticMin: 30,
        taxMultiplier: 1.5,
        allocatedMin: 45,
        actualMinutes: 45,
        completedAt: Date.now(),
        predictedSeconds: 1800,
        actualSeconds: 2700,
        // missing isMicroStep (legacy)
      },
      {
        id: '2',
        taskName: 'Clean the kitchen',
        category: 'cleaning',
        optimisticMin: 30,
        taxMultiplier: 1.5,
        allocatedMin: 45,
        actualMinutes: 45,
        completedAt: Date.now(),
        predictedSeconds: 1800,
        actualSeconds: 2700,
        isMicroStep: undefined, // explicit undefined
      }
    ]));

    const result = calculatePersonalFactor('Clean the kitchen', 'cleaning');
    expect(result?.factor).toBe(1.5);
    expect(result?.sampleCount).toBe(2);
  });

  it('Case B: Explicit false contributes to calibration', () => {
    window.localStorage.setItem('tbt_task_history', JSON.stringify([
      {
        id: '1',
        taskName: 'Clean the kitchen',
        category: 'cleaning',
        optimisticMin: 30,
        taxMultiplier: 1.5,
        allocatedMin: 45,
        actualMinutes: 45,
        completedAt: Date.now(),
        predictedSeconds: 1800,
        actualSeconds: 2700,
        isMicroStep: false,
      },
      {
        id: '2',
        taskName: 'Clean the kitchen',
        category: 'cleaning',
        optimisticMin: 30,
        taxMultiplier: 1.5,
        allocatedMin: 45,
        actualMinutes: 45,
        completedAt: Date.now(),
        predictedSeconds: 1800,
        actualSeconds: 2700,
        isMicroStep: false,
      }
    ]));

    const result = calculatePersonalFactor('Clean the kitchen', 'cleaning');
    expect(result?.factor).toBe(1.5);
    expect(result?.sampleCount).toBe(2);
  });

  it('Case C: Micro-step (true) is excluded from all calibration levels', () => {
    window.localStorage.setItem('tbt_task_history', JSON.stringify([
      {
        id: '1',
        taskName: 'Clean the kitchen',
        category: 'cleaning',
        optimisticMin: 30,
        taxMultiplier: 1.5,
        allocatedMin: 45,
        actualMinutes: 45,
        completedAt: Date.now(),
        predictedSeconds: 1800,
        actualSeconds: 2700,
        isMicroStep: false,
      },
      {
        id: '2',
        taskName: 'Clean the kitchen',
        category: 'cleaning',
        optimisticMin: 30,
        taxMultiplier: 1.5,
        allocatedMin: 45,
        actualMinutes: 45,
        completedAt: Date.now(),
        predictedSeconds: 1800,
        actualSeconds: 2700,
        isMicroStep: false,
      },
      {
        id: '3',
        taskName: 'Clean the kitchen', // Same name, but flagged as micro step!
        category: 'cleaning',
        optimisticMin: 2,
        taxMultiplier: 1.0,
        allocatedMin: 2,
        actualMinutes: 2,
        completedAt: Date.now(),
        predictedSeconds: 120,
        actualSeconds: 120,
        isMicroStep: true,
      }
    ]));

    // calculatePersonalFactor exact match
    const result = calculatePersonalFactor('Clean the kitchen', 'cleaning');
    expect(result?.factor).toBe(1.5); // ignores the 1.0
    expect(result?.sampleCount).toBe(2); // ignores the 3rd task

    // getTaskHistoricalRange
    const range = getTaskHistoricalRange('Clean the kitchen');
    expect(range?.median).toBe(45); // ignores the 2min micro-step entirely
  });

  it('Case E: Micro-step still appears in history and counts toward streaks', () => {
    // Clear localStorage to be safe
    window.localStorage.clear();
    
    // In production, completeMission() calls both saveCompletedTask and incrementDailyCount.
    // We simulate that here to verify the storage layer.
    const now = new Date();
    
    storage.saveCompletedTask({
      taskName: 'Wash one dish.',
      category: 'cleaning',
      completedAt: now.getTime(),
      isMicroStep: true,
      allocatedMin: 2,
      optimisticMin: 2,
      taxMultiplier: 1.0,
      actualMinutes: 2,
      predictedSeconds: 120,
      actualSeconds: 120
    });
    
    storage.incrementDailyCount(now);

    // It is in history
    expect(storage.getTaskHistory()).toHaveLength(1);

    // It counts toward today's tasks
    expect(storage.getTodayCount()).toBe(1);

    // It counts in Weekly Stats total missions
    const counts = storage.getDailyCounts(7);
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    expect(total).toBe(1); 
  });

  it('Case F: Timer calculations show same numerical behavior whether isMicroStep is true or absent', () => {
    const plannedDurationMs = 2 * 60_000;
    
    // Normal 2 min task
    const normalMission = startMission('task A', plannedDurationMs, 2, 1.0, 2, 0, 'other', false);
    
    // Micro step 2 min task
    const microMission = startMission('task B', plannedDurationMs, 2, 1.0, 2, 0, 'other', true);

    expect(normalMission.initialExpectedEndAt).toBeCloseTo(microMission.initialExpectedEndAt, -2);
    expect(normalMission.plannedDurationMs).toBe(microMission.plannedDurationMs);
    expect(normalMission.isMicroStep).toBe(false);
    expect(microMission.isMicroStep).toBe(true);

    // Extend both by 10 min
    const extNormal = extendMission(normalMission, 10);
    const extMicro = extendMission(microMission, 10);

    expect(extNormal.allocatedMin).toBe(12);
    expect(extMicro.allocatedMin).toBe(12);
    expect(extNormal.expectedEndAt).toBeCloseTo(extMicro.expectedEndAt, -2);

    // Complete both (freeze time so actualSeconds is identical)
    const fixedNow = normalMission.startedAt + 120_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
    const compNormal = completeMission(extNormal);
    
    // reset mock, set same relative time for microMission
    const fixedNowMicro = microMission.startedAt + 120_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixedNowMicro);
    const compMicro = completeMission(extMicro);

    expect(compNormal.actualSeconds).toBe(compMicro.actualSeconds);
  });
});
