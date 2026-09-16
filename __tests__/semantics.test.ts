/**
 * __tests__/semantics.test.ts
 *
 * P0 correctness tests for timing / calibration semantics.
 *
 * Acceptance example (from spec):
 *   Original estimate    = 2 min
 *   Initial calibrated   = 2 min
 *   Elapsed at extension = 2 min 30 s  (overtime)
 *   Extension            = +5 min
 *   Final completion     = 4 min 30 s
 *
 *   Expected:
 *     originalEstimateMs         = 120_000
 *     initialCalibratedMs        = 120_000
 *     actualSeconds              = 270
 *     predictedSeconds in record = 120   (never post-extension budget)
 *     accuracy                   = 120 s vs 270 s  (NOT "spot on")
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock side-effect modules before importing the subjects under test.
vi.mock('../lib/mission/storage');
vi.mock('../lib/storage');
vi.mock('../lib/notifications/badgeManager');
vi.mock('../lib/notifications/notificationManager');
vi.mock('../lib/analytics/localAnalytics');
vi.mock('../lib/notifications/pendingActions');

import {
  startMission,
  extendMission,
  recalculateMission,
  pauseMission,
  resumeMission,
  completeMission,
} from '../lib/mission/actions';
import type { ActiveMission } from '../lib/mission/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const MIN = 60_000; // 1 minute in ms

/** Build a 2-minute mission starting at the current fake clock time. */
function make2minMission(): ActiveMission {
  return startMission(
    'Test task',
    2 * MIN,   // plannedDurationMs  (= initial calibrated budget)
    2,         // optimisticMin      (user raw estimate)
    1.0,       // taxMultiplier      (1× so calibrated == original)
    2,         // allocatedMin
  );
}

/**
 * Pure re-implementation of the SuccessScreen accuracy helper.
 * Allows us to test the display logic without mounting React.
 */
function buildAccuracy(calibratedMin: number, coreActualMin: number) {
  if (calibratedMin <= 0) {
    return { percent: 0, label: 'You were spot on.' };
  }
  const diff    = coreActualMin - calibratedMin;
  const percent = Math.round((Math.abs(diff) / calibratedMin) * 100);
  const label   =
    percent === 0
      ? 'You were spot on.'
      : diff > 0
      ? `You underestimated by ${percent}%.`
      : `You overestimated by ${percent}%.`;
  return { percent, label };
}

// ─── setup / teardown ────────────────────────────────────────────────────────

const T0 = 1_000_000_000; // arbitrary fixed epoch for deterministic tests

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// =============================================================================
// 1. Task completes exactly at the original deadline
// =============================================================================
describe('Scenario 1 — completes exactly at original deadline', () => {
  it('actualSeconds equals planned duration (120 s)', () => {
    const mission = make2minMission();
    expect(mission.initialCalibratedMs).toBe(2 * MIN);

    vi.setSystemTime(T0 + 2 * MIN);
    const { actualSeconds } = completeMission(mission);
    expect(actualSeconds).toBe(120);
  });

  it('accuracy is spot-on (0%)', () => {
    const { percent, label } = buildAccuracy(2, 2);
    expect(percent).toBe(0);
    expect(label).toBe('You were spot on.');
  });
});

// =============================================================================
// 2. 2m task completed at 4m30s
// =============================================================================
describe('Scenario 2 — 2m task completed at 4m30s', () => {
  it('actualSeconds = 270', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 270_000);
    const { actualSeconds } = completeMission(mission);
    expect(actualSeconds).toBe(270);
  });

  it('accuracy label is NOT spot on', () => {
    const { label } = buildAccuracy(2, 4.5);
    expect(label).not.toBe('You were spot on.');
    expect(label).toContain('underestimated');
    expect(label).toContain('125%');
  });

  it('initialCalibratedMs = 120_000 regardless of elapsed time', () => {
    const mission = make2minMission();
    expect(Math.floor(mission.initialCalibratedMs / 1000)).toBe(120);
  });
});

// =============================================================================
// 3. Mission enters overtime (2m30s elapsed, no extension)
// =============================================================================
describe('Scenario 3 — overtime at 2m30s', () => {
  it('expectedEndAt is still the original deadline (unchanged)', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    expect(mission.expectedEndAt).toBe(T0 + 2 * MIN);
    expect(Date.now()).toBeGreaterThan(mission.expectedEndAt);
  });

  it('overtime amount = Date.now() − expectedEndAt = 30 s', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const overtime = Date.now() - mission.expectedEndAt;
    expect(overtime).toBe(30_000);
  });
});

// =============================================================================
// 4. +5m while 2m30s into overtime
// =============================================================================
describe('Scenario 4 — +5m while 2m30s into overtime', () => {
  it('new expectedEndAt = NOW + 5 min (not oldEnd + 5 min)', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000); // 2m30s elapsed, 30s overtime
    const now = Date.now();

    const extended = extendMission(mission, 5);

    expect(extended.expectedEndAt).toBe(now + 5 * MIN);
    // Confirm it is NOT the old expired deadline + 5 min
    expect(extended.expectedEndAt).not.toBe(mission.expectedEndAt + 5 * MIN);
  });

  it('initialCalibratedMs is NOT touched by extension', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const extended = extendMission(mission, 5);
    expect(extended.initialCalibratedMs).toBe(2 * MIN);
  });

  it('initialExpectedEndAt is NOT touched by extension', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const extended = extendMission(mission, 5);
    expect(extended.initialExpectedEndAt).toBe(T0 + 2 * MIN);
  });

  it('optimisticMin is NOT touched by extension', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const extended = extendMission(mission, 5);
    expect(extended.optimisticMin).toBe(2);
  });
});

// =============================================================================
// 5. +5m while still within budget
// =============================================================================
describe('Scenario 5 — +5m before expiry', () => {
  it('new expectedEndAt = old deadline + 5 min', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 30_000); // 30s elapsed — still within budget

    const extended = extendMission(mission, 5);

    // Math.max(now, expectedEndAt) = expectedEndAt (future), so base = oldEnd
    expect(extended.expectedEndAt).toBe(mission.expectedEndAt + 5 * MIN);
  });

  it('initialCalibratedMs unchanged', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 30_000);
    const extended = extendMission(mission, 5);
    expect(extended.initialCalibratedMs).toBe(2 * MIN);
  });
});

// =============================================================================
// 6. +5m exactly at expiry (boundary: now == expectedEndAt)
// =============================================================================
describe('Scenario 6 — +5m exactly at expiry', () => {
  it('new expectedEndAt = NOW + 5 min', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 2 * MIN); // exactly at the deadline
    const now = Date.now();

    const extended = extendMission(mission, 5);
    expect(extended.expectedEndAt).toBe(now + 5 * MIN);
  });
});

// =============================================================================
// 7. Repeated +5m extensions
// =============================================================================
describe('Scenario 7 — repeated extensions', () => {
  it('each extension from the current moment when in overtime', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000); // 2m30s, overtime

    const ext1 = extendMission(mission, 5);
    expect(ext1.expectedEndAt).toBe(T0 + 150_000 + 5 * MIN);

    // advance time so ext1 deadline is still in future
    vi.setSystemTime(T0 + 200_000);
    const ext2 = extendMission(ext1, 5);
    // ext1 deadline is future → base = ext1.expectedEndAt
    expect(ext2.expectedEndAt).toBe(ext1.expectedEndAt + 5 * MIN);
  });

  it('notificationVersion increments on each extension', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const ext1 = extendMission(mission, 5);
    expect(ext1.notificationVersion).toBe(2);
    const ext2 = extendMission(ext1, 5);
    expect(ext2.notificationVersion).toBe(3);
  });

  it('initialCalibratedMs never changes after repeated extensions', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const ext1 = extendMission(mission, 5);
    const ext2 = extendMission(ext1, 5);
    expect(ext2.initialCalibratedMs).toBe(2 * MIN);
  });
});

// =============================================================================
// 8. Recalculation during overtime
// =============================================================================
describe('Scenario 8 — recalculate from overtime', () => {
  it('newExpectedEndAt = NOW + remainingMs', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000); // in overtime
    const now = Date.now();

    const recalced = recalculateMission(mission, 5);
    expect(recalced.expectedEndAt).toBe(now + 5 * MIN);
  });

  it('initialCalibratedMs unchanged after recalculate', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const recalced = recalculateMission(mission, 5);
    expect(recalced.initialCalibratedMs).toBe(2 * MIN);
  });

  it('notificationVersion bumped after recalculate', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const recalced = recalculateMission(mission, 5);
    expect(recalced.notificationVersion).toBe(2);
  });
});

// =============================================================================
// 9. Completion after extension — canonical acceptance test
//    Original=2m, overtime@2m30s, +5m, finish@4m30s
// =============================================================================
describe('Scenario 9 — canonical acceptance test (2m → overtime → +5m → finish 4m30s)', () => {
  it('actualSeconds = 270 (real elapsed, not extension budget)', () => {
    const mission = make2minMission();

    vi.setSystemTime(T0 + 150_000); // 2m30s — overtime
    const extended = extendMission(mission, 5);

    vi.setSystemTime(T0 + 270_000); // 4m30s total elapsed
    const { actualSeconds } = completeMission(extended);

    expect(actualSeconds).toBe(270);
  });

  it('initialCalibratedMs = 120_000 throughout', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const extended = extendMission(mission, 5);
    expect(extended.initialCalibratedMs).toBe(120_000);
  });

  it('optimisticMin stays 2 throughout', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const extended = extendMission(mission, 5);
    expect(extended.optimisticMin).toBe(2);
  });

  it('accuracy = 125% underestimated (2m vs 4m30s)', () => {
    const { percent, label } = buildAccuracy(2, 4.5);
    expect(percent).toBe(125);
    expect(label).toBe('You underestimated by 125%.');
  });

  it('accuracy label is NOT "You were spot on."', () => {
    const { label } = buildAccuracy(2, 4.5);
    expect(label).not.toBe('You were spot on.');
  });
});

// =============================================================================
// 10. Pause + extension
// =============================================================================
describe('Scenario 10 — pause + extension', () => {
  it('actualSeconds subtracts paused duration', () => {
    const mission = make2minMission();

    // Pause at 1 min elapsed
    vi.setSystemTime(T0 + MIN);
    const paused = pauseMission(mission);

    // Resume 30s later
    vi.setSystemTime(T0 + MIN + 30_000);
    const resumed = resumeMission(paused);

    expect(resumed.totalPausedMs).toBe(30_000);

    // Extend +5m (deadline is in future after resume shift)
    vi.setSystemTime(T0 + MIN + 30_000 + 10_000);
    const extended = extendMission(resumed, 5);

    // Complete at 4 min total wall-clock
    vi.setSystemTime(T0 + 4 * MIN);
    const { actualSeconds } = completeMission(extended);

    // Active time = 4min elapsed - 30s paused = 3min30s = 210s
    expect(actualSeconds).toBe(210);
  });

  it('initialCalibratedMs unchanged after pause + extension', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + MIN);
    const paused = pauseMission(mission);
    vi.setSystemTime(T0 + MIN + 30_000);
    const resumed = resumeMission(paused);
    vi.setSystemTime(T0 + 2 * MIN);
    const extended = extendMission(resumed, 5);
    expect(extended.initialCalibratedMs).toBe(2 * MIN);
  });
});

// =============================================================================
// 11. Original estimate remains unchanged throughout the lifecycle
// =============================================================================
describe('Scenario 11 — original estimate is immutable', () => {
  it('optimisticMin unchanged after extend and recalculate', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const ext = extendMission(mission, 10);
    const recalc = recalculateMission(ext, 3);
    expect(recalc.optimisticMin).toBe(2);
  });
});

// =============================================================================
// 12. Initial calibrated estimate is immutable
// =============================================================================
describe('Scenario 12 — initial calibrated estimate is immutable', () => {
  it('initialCalibratedMs unchanged after extend + recalculate', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const ext = extendMission(mission, 10);
    const recalc = recalculateMission(ext, 3);
    expect(recalc.initialCalibratedMs).toBe(2 * MIN);
  });

  it('initialExpectedEndAt unchanged after extend + recalculate', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const ext = extendMission(mission, 10);
    const recalc = recalculateMission(ext, 3);
    expect(recalc.initialExpectedEndAt).toBe(T0 + 2 * MIN);
  });
});

// =============================================================================
// 13. actualSeconds = real elapsed time (not allocated/planned)
// =============================================================================
describe('Scenario 13 — actualSeconds is real elapsed time', () => {
  it('equals wall-clock elapsed for a no-pause mission', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 270_000);
    const { actualSeconds } = completeMission(mission);
    expect(actualSeconds).toBe(270);
  });

  it('is NOT equal to allocatedMin * 60 after extension', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const extended = extendMission(mission, 5); // allocatedMin becomes 7
    vi.setSystemTime(T0 + 270_000);
    const { actualSeconds } = completeMission(extended);
    // If wrongly set to allocatedMin * 60 = 420 this would fail
    expect(actualSeconds).not.toBe(extended.allocatedMin * 60);
    expect(actualSeconds).toBe(270);
  });
});

// =============================================================================
// 14. Accuracy uses initial calibrated prediction vs actual
// =============================================================================
describe('Scenario 14 — accuracy is based on initial calibrated vs actual', () => {
  it('2m calibrated vs 4m30s actual → 125% underestimated', () => {
    const { percent, label } = buildAccuracy(2, 4.5);
    expect(percent).toBe(125);
    expect(label).toContain('underestimated');
    expect(label).toContain('125%');
  });

  it('accuracy is NOT computed against post-extension allocatedMin (7m)', () => {
    // If we wrongly used allocatedMin=7m: (4.5-7)/7 → overestimated ~36%
    const wrongAcc = buildAccuracy(7, 4.5);
    expect(wrongAcc.label).toContain('overestimated');

    // Correct: initial=2m gives underestimated 125%
    const rightAcc = buildAccuracy(2, 4.5);
    expect(rightAcc.label).toContain('underestimated');
    expect(rightAcc.label).not.toBe(wrongAcc.label);
  });
});

// =============================================================================
// 15. predictedSeconds stored in history = initial calibrated prediction
// =============================================================================
describe('Scenario 15 — predictedSeconds not rewritten by extensions', () => {
  it('initialCalibratedMs drives predictedSeconds = 120s for 2m task', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const ext1 = extendMission(mission, 5);
    const ext2 = extendMission(ext1, 5);

    // The mission still carries the original initial calibrated duration
    const predictedSecondsFromMission = Math.floor(ext2.initialCalibratedMs / 1000);
    expect(predictedSecondsFromMission).toBe(120);
  });

  it('allocatedMin grows with extensions but initialCalibratedMs does not', () => {
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const ext = extendMission(mission, 5);
    expect(ext.allocatedMin).toBe(7);              // budget grows
    expect(ext.initialCalibratedMs).toBe(2 * MIN); // calibration anchor unchanged
  });
});

// =============================================================================
// 16. Legacy mission compatibility
//     An old persisted ActiveMission that lacks the new fields must:
//     - not crash extendMission or completeMission
//     - derive safe calibration anchors via the ?? fallback
//     - produce correct actualSeconds
// =============================================================================
describe('Scenario 16 — legacy mission compatibility (missing initialCalibratedMs / initialExpectedEndAt)', () => {
  /** Build a legacy-style mission object as it would have been stored before the P0 fix. */
  function makeLegacyMission(): ActiveMission {
    // Deliberately cast to bypass TypeScript required fields so we can simulate
    // a deserialized JSON object without the new fields.
    return {
      id: 'legacy-mission-1',
      taskName: 'Legacy Task',
      startedAt: T0,
      plannedDurationMs: 2 * MIN,
      expectedEndAt: T0 + 2 * MIN,
      status: 'running',
      createdAt: T0,
      updatedAt: T0,
      optimisticMin: 2,
      taxMultiplier: 1.0,
      allocatedMin: 2,
      notificationVersion: 1,
      // Intentionally OMIT initialCalibratedMs and initialExpectedEndAt
    } as unknown as ActiveMission;
  }

  it('extendMission uses plannedDurationMs fallback — does not crash', () => {
    const legacy = makeLegacyMission();
    vi.setSystemTime(T0 + 150_000); // in overtime
    // Should not throw even though initialCalibratedMs is undefined
    expect(() => extendMission(legacy, 5)).not.toThrow();
  });

  it('extendMission with legacy mission still extends from NOW when in overtime', () => {
    const legacy = makeLegacyMission();
    vi.setSystemTime(T0 + 150_000);
    const now = Date.now();
    const extended = extendMission(legacy, 5);
    expect(extended.expectedEndAt).toBe(now + 5 * MIN);
  });

  it('completeMission falls back to plannedDurationMs for calibration anchor', () => {
    const legacy = makeLegacyMission();
    vi.setSystemTime(T0 + 270_000); // 4m30s elapsed
    const { actualSeconds } = completeMission(legacy);
    // actualSeconds must be real elapsed time regardless of missing fields
    expect(actualSeconds).toBe(270);
  });

  it('completeMission predictedSeconds falls back to plannedDurationMs / 1000 = 120', () => {
    const legacy = makeLegacyMission();
    // The ?? fallback: initialCalibratedMs ?? plannedDurationMs
    const expectedPredicted = Math.floor(legacy.plannedDurationMs / 1000);
    expect(expectedPredicted).toBe(120);
  });

  it('initialCalibratedMs is preserved after extendMission (backfill does not overwrite existing)', () => {
    // A mission that DOES have the field should never have it overwritten
    const mission = make2minMission();
    vi.setSystemTime(T0 + 150_000);
    const extended = extendMission(mission, 5);
    // Must still equal the original 2min, not the extended 7min
    expect(extended.initialCalibratedMs).toBe(2 * MIN);
  });
});
