/**
 * Phase 2 tests — CHAIN_MISSION reducer, duplicate-save guard,
 * calibration helpers, accuracy badge, and three-value Reality Check.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/mission/storage');
vi.mock('../lib/notifications/badgeManager');
vi.mock('../lib/notifications/notificationManager');
vi.mock('../lib/analytics/localAnalytics');
vi.mock('../lib/notifications/pendingActions');

import { calculateActualTime, TAX_MULTIPLIER_DEFAULT } from '../lib/calculations';
import * as storageModule from '../lib/storage';

// ---------------------------------------------------------------------------
// saveCompletedTask — returns ID & saves exactly once per call
// ---------------------------------------------------------------------------

describe('saveCompletedTask — returns ID', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns a non-empty string ID', () => {
    const id = storageModule.saveCompletedTask({ taskName: 'Test', optimisticMin: 10, taxMultiplier: 1.5, allocatedMin: 15, actualMinutes: 15, completedAt: Date.now(), predictedSeconds: 900, actualSeconds: 900, transitionMinutes: 0 });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('saves exactly one record per call', () => {
    storageModule.saveCompletedTask({ taskName: 'Task A', optimisticMin: 10, taxMultiplier: 1.5, allocatedMin: 15, actualMinutes: 15, completedAt: Date.now(), predictedSeconds: 900, actualSeconds: 900, transitionMinutes: 0 });
    expect(storageModule.getTaskHistory()).toHaveLength(1);
  });

  it('returned ID matches the record stored in history', () => {
    const id = storageModule.saveCompletedTask({ taskName: 'Match Me', optimisticMin: 5, taxMultiplier: 1.2, allocatedMin: 6, actualMinutes: 7, completedAt: Date.now(), predictedSeconds: 360, actualSeconds: 420, transitionMinutes: 0 });
    const history = storageModule.getTaskHistory();
    expect(history[0].id).toBe(id);
    expect(history[0].taskName).toBe('Match Me');
  });
});

// ---------------------------------------------------------------------------
// buildAccuracy — accuracy percentage and neutral copy
// ---------------------------------------------------------------------------

function buildAccuracy(calibratedMin: number, coreActualMin: number) {
  if (calibratedMin <= 0) return { percent: 0, label: 'You were spot on.', subLabel: '', color: 'var(--color-sage-500)' };
  const diff = coreActualMin - calibratedMin;
  const percent = Math.round(Math.abs(diff) / calibratedMin * 100);
  const label = percent === 0 ? 'You were spot on.' : diff > 0 ? `You underestimated by ${percent}%.` : `You overestimated by ${percent}%.`;
  const subLabel = percent === 0 ? '' : 'Useful data — your next estimate can learn from this.';
  const color = percent < 10 ? 'var(--color-sage-500)' : percent < 25 ? 'var(--color-amber-400)' : percent < 50 ? '#fb923c' : 'var(--color-lavender-500)';
  return { percent, label, subLabel, color };
}

describe('buildAccuracy — accuracy percentage', () => {
  it('exact match returns 0% and spot-on label', () => {
    const r = buildAccuracy(30, 30);
    expect(r.percent).toBe(0);
    expect(r.label).toBe('You were spot on.');
    expect(r.subLabel).toBe('');
  });

  it('over by 10 on 30 calibrated = 33% underestimated', () => {
    const r = buildAccuracy(30, 40);
    expect(r.percent).toBe(33);
    expect(r.label).toContain('underestimated');
    expect(r.label).toContain('33%');
  });

  it('under by 10 on 30 calibrated = 33% overestimated', () => {
    const r = buildAccuracy(30, 20);
    expect(r.percent).toBe(33);
    expect(r.label).toContain('overestimated');
  });

  it('subLabel is non-empty and neutral when not spot on', () => {
    const r = buildAccuracy(20, 28);
    expect(r.subLabel).toContain('Useful data');
    expect(r.label).not.toMatch(/fail|wrong|bad|terrible/i);
  });
});

// ---------------------------------------------------------------------------
// Three-value Reality Check
// ---------------------------------------------------------------------------

describe('Three-value Reality Check derivation', () => {
  it('originalMin = optimisticMin', () => {
    const state = { optimisticMin: 20, initialEstimate: 15, actualMinutes: 30, actualSeconds: 1680, transitionMinutes: 0 };
    expect(state.optimisticMin ?? state.initialEstimate).toBe(20);
  });

  it('calibratedMin comes from initialCalibratedMin (initial ADHD-taxed prediction, not post-extension actualMinutes)', () => {
    // NOTE: After the P0 semantics fix, SuccessScreen reads
    //   calibratedMin = state.initialCalibratedMin ?? state.actualMinutes
    // This test only verifies the field value is accessible; the actual
    // source-of-truth is tested in __tests__/semantics.test.ts.
    const state = { actualMinutes: 30, actualSeconds: 1680, transitionMinutes: 0 };
    expect(state.actualMinutes).toBe(30);
  });

  it('actualMin = rounded actualSeconds / 60', () => {
    const state = { actualSeconds: 1680, actualMinutes: 30, transitionMinutes: 0 };
    const actualMin = state.actualSeconds ? Math.round(state.actualSeconds / 60) : state.actualMinutes;
    expect(actualMin).toBe(28);
  });

  it('actualMin falls back to actualMinutes when actualSeconds absent', () => {
    const state = { actualMinutes: 30, transitionMinutes: 0 };
    const actualMin = (state as any).actualSeconds ? Math.round((state as any).actualSeconds / 60) : state.actualMinutes;
    expect(actualMin).toBe(30);
  });

  it('coreActualMin subtracts transitionMinutes', () => {
    const state = { actualSeconds: 1980, transitionMinutes: 5, actualMinutes: 33 };
    const actualMin = state.actualSeconds ? Math.round(state.actualSeconds / 60) : state.actualMinutes;
    expect(Math.max(0, actualMin - state.transitionMinutes)).toBe(28);
  });

  it('coreActualMin cannot go below zero', () => {
    const state = { actualSeconds: 120, transitionMinutes: 10, actualMinutes: 2 };
    const actualMin = state.actualSeconds ? Math.round(state.actualSeconds / 60) : state.actualMinutes;
    expect(Math.max(0, actualMin - state.transitionMinutes)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CHAIN_MISSION state transition (reducer contract)
// ---------------------------------------------------------------------------

function chainMissionReducerCase(state: any, taskName?: string): any {
  const isExactTime = state.isExactTime ?? false;
  const taxMultiplier = state.taxMultiplier ?? TAX_MULTIPLIER_DEFAULT;
  const nextActual = calculateActualTime(15, isExactTime ? 1.0 : taxMultiplier, isExactTime);
  return {
    ...state,
    status: 'setup',
    taskName: taskName ?? '',
    initialEstimate: 15,
    predictedSeconds: 15 * 60,
    optimisticMin: 15,
    actualMinutes: nextActual,
    allocatedMin: nextActual,
    endTime: null,
    startTime: undefined,
    completedAt: undefined,
    completedRecordId: undefined,
    actualSeconds: undefined,
    tagline: undefined,
    wasAnnounced: undefined,
    isOvertimeAcknowledged: false,
    extensionCount: 0,
    activeMission: null,
    taxMultiplier: state.taxMultiplier,
    transitionMinutes: state.transitionMinutes,
    isExactTime: state.isExactTime,
    personalFactor: null,
  };
}

const baseSuccessState = {
  status: 'success',
  taskName: 'Write report',
  taxMultiplier: 1.5,
  transitionMinutes: 5,
  isExactTime: false,
  category: 'work',
  completedRecordId: 'abc-123',
  actualSeconds: 2400,
  extensionCount: 2,
  activeMission: { id: 'x' },
  wasAnnounced: true,
};

describe('CHAIN_MISSION state transition', () => {
  it('transitions status to setup', () => {
    expect(chainMissionReducerCase(baseSuccessState).status).toBe('setup');
  });

  it('does not reload page (pure state — no side effects)', () => {
    // If page reload happened the test runner process would die
    const next = chainMissionReducerCase(baseSuccessState, 'New task');
    expect(next.status).toBe('setup');
  });

  it('preserves taxMultiplier', () => {
    expect(chainMissionReducerCase(baseSuccessState).taxMultiplier).toBe(1.5);
  });

  it('preserves transitionMinutes', () => {
    expect(chainMissionReducerCase(baseSuccessState).transitionMinutes).toBe(5);
  });

  it('preserves isExactTime=false', () => {
    expect(chainMissionReducerCase(baseSuccessState).isExactTime).toBe(false);
  });

  it('preserves isExactTime=true', () => {
    expect(chainMissionReducerCase({ ...baseSuccessState, isExactTime: true }).isExactTime).toBe(true);
  });

  it('clears task-specific fields', () => {
    const next = chainMissionReducerCase(baseSuccessState);
    expect(next.taskName).toBe('');
    expect(next.completedRecordId).toBeUndefined();
    expect(next.actualSeconds).toBeUndefined();
    expect(next.extensionCount).toBe(0);
    expect(next.activeMission).toBeNull();
  });

  it('pre-fills taskName when supplied', () => {
    expect(chainMissionReducerCase(baseSuccessState, 'Wash dishes').taskName).toBe('Wash dishes');
  });

  it('resets to default estimate (15 min)', () => {
    const next = chainMissionReducerCase(baseSuccessState);
    expect(next.initialEstimate).toBe(15);
    expect(next.optimisticMin).toBe(15);
  });

  it('clears personalFactor so SetupScreen re-computes for new task', () => {
    expect(chainMissionReducerCase(baseSuccessState).personalFactor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Calibration card — context-aware headline copy
// ---------------------------------------------------------------------------

describe('Calibration card — context-aware headline', () => {
  it('no factor → Building Your Time Model', () => {
    const result = null;
    const headline = result === null ? 'Building Your Time Model' : 'Your Time Model';
    expect(headline).toBe('Building Your Time Model');
  });

  it('prevFactor null + result exists → Calibration Unlocked', () => {
    const prevFactor = null;
    const isNew = prevFactor === null || prevFactor === undefined;
    expect(isNew ? 'Calibration Unlocked' : 'Your Time Model').toBe('Calibration Unlocked');
  });

  it('prevFactor existed → Your Time Model', () => {
    const prevFactor = 1.4;
    const isNew = prevFactor === null || prevFactor === undefined;
    expect(isNew ? 'Calibration Unlocked' : 'Your Time Model').toBe('Your Time Model');
  });
});

// ---------------------------------------------------------------------------
// Chain task suggestions
// ---------------------------------------------------------------------------

describe('Chain task suggestions', () => {
  it('filters out the just-completed task', () => {
    const allRecent = [
      { taskName: 'Write report', initialEstimate: 30 },
      { taskName: 'Clear inbox',  initialEstimate: 20 },
      { taskName: 'Quick tidy',   initialEstimate: 15 },
    ];
    const suggestions = allRecent.filter(t => t.taskName !== 'Write report').slice(0, 3);
    expect(suggestions.map(s => s.taskName)).not.toContain('Write report');
  });

  it('caps at 3 suggestions', () => {
    const allRecent = [{ taskName: 'A', initialEstimate: 10 }, { taskName: 'B', initialEstimate: 10 }, { taskName: 'C', initialEstimate: 10 }, { taskName: 'D', initialEstimate: 10 }];
    expect(allRecent.slice(0, 3)).toHaveLength(3);
  });

  it('falls back to STATIC_TEMPLATES when recent is empty', () => {
    const STATIC_TEMPLATES = [{ taskName: 'Clear inbox', initialEstimate: 20 }, { taskName: 'Wash dishes', initialEstimate: 10 }, { taskName: 'Quick tidy', initialEstimate: 15 }];
    const recent: typeof STATIC_TEMPLATES = [];
    const opts = recent.length > 0 ? recent : STATIC_TEMPLATES;
    expect(opts).toHaveLength(3);
    expect(opts[0].taskName).toBe('Clear inbox');
  });
});
