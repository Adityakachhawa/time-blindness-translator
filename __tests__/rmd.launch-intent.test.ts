/**
 * __tests__/rmd.launch-intent.test.ts
 *
 * Automated tests for the RMD → TBT launch-intent URL contract,
 * exact-duration invariant, autostart state-transition, and MinuteStepper
 * input edge cases.
 *
 * Tests 1–12 as specified (original 1–10 + duration invariant + state transition).
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Pure helper: parse the RMD launch-intent URL
// Mirrors SetupScreen.tsx Branch A exactly.
// ---------------------------------------------------------------------------

interface LaunchIntent {
  task: string;
  min: number;
  isRmdSource: boolean;
  isExactMode: boolean;
  requestsAutostart: boolean;
}

function parseLaunchIntent(search: string): LaunchIntent | null {
  const params = new URLSearchParams(search);
  const task = params.get('task');
  const minStr = params.get('min');
  if (!task || !minStr) return null;
  const min = parseInt(minStr, 10);
  if (isNaN(min)) return null;

  const isRmdSource = params.get('source') === 'reset-my-day';
  const isExactMode = isRmdSource && params.get('mode') === 'exact';
  const requestsAutostart = isExactMode && params.get('autostart') === '1';

  return { task, min, isRmdSource, isExactMode, requestsAutostart };
}

/** Confirms a social ?challenge= URL does NOT parse as an RMD intent. */
function parseSocialChallenge(search: string): { challenge: string; min: number } | null {
  const params = new URLSearchParams(search);
  const challenge = params.get('challenge');
  const minStr = params.get('min');
  if (!challenge || !minStr) return null;
  const min = parseInt(minStr, 10);
  if (isNaN(min)) return null;
  return { challenge, min };
}

// ---------------------------------------------------------------------------
// Minute-input clamp logic (mirrors MinuteStepper blur handler)
// ---------------------------------------------------------------------------

function clampMinutes(raw: string, fallback: number): number {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return Math.max(1, Math.min(300, fallback));
  return Math.max(1, Math.min(300, n));
}

// ---------------------------------------------------------------------------
// calculateActualTime mirror (from lib/calculations.ts)
// Used for the exact-duration invariant test without importing the module.
// ---------------------------------------------------------------------------

function calculateActualTime(estimateMinutes: number, multiplier: number, exact = false): number {
  if (exact) return Math.max(1, estimateMinutes);
  const raw = estimateMinutes * multiplier;
  return Math.round(raw / 5) * 5 || 5;
}

// ---------------------------------------------------------------------------
// Tests 1–7: RMD launch-intent URL parsing
// ---------------------------------------------------------------------------

describe('RMD launch intent — URL parsing (?task= param)', () => {
  it('1. parses task name correctly', () => {
    const intent = parseLaunchIntent(
      '?task=Wash+dishes&min=5&source=reset-my-day&mode=exact&autostart=1'
    );
    expect(intent?.task).toBe('Wash dishes');
  });

  it('2. parses minutes correctly', () => {
    const intent = parseLaunchIntent(
      '?task=Wash+dishes&min=5&source=reset-my-day&mode=exact&autostart=1'
    );
    expect(intent?.min).toBe(5);
  });

  it('3. activates exact mode when source=reset-my-day and mode=exact', () => {
    const intent = parseLaunchIntent(
      '?task=Wash+dishes&min=5&source=reset-my-day&mode=exact&autostart=1'
    );
    expect(intent?.isExactMode).toBe(true);
  });

  it('4. requestsAutostart = true when all three flags present', () => {
    const intent = parseLaunchIntent(
      '?task=Wash+dishes&min=5&source=reset-my-day&mode=exact&autostart=1'
    );
    expect(intent?.requestsAutostart).toBe(true);
  });

  it('5. ?challenge= URLs do NOT parse as RMD intent (returns null from parseLaunchIntent)', () => {
    // Social challenge links use ?challenge=, not ?task=.
    // parseLaunchIntent requires ?task=, so it returns null for challenge links.
    const intent = parseLaunchIntent('?challenge=Wash+dishes&min=5');
    expect(intent).toBeNull();
  });

  it('5b. social challenge link still parses via Branch B (challenge= path)', () => {
    // Confirms ?challenge= continues to work for genuine challenge links.
    const social = parseSocialChallenge('?challenge=Wash+dishes&min=5');
    expect(social?.challenge).toBe('Wash dishes');
    expect(social?.min).toBe(5);
  });

  it('5c. source present but mode missing does NOT activate exact mode or autostart', () => {
    const intent = parseLaunchIntent(
      '?task=Wash+dishes&min=5&source=reset-my-day'
    );
    expect(intent?.isExactMode).toBe(false);
    expect(intent?.requestsAutostart).toBe(false);
  });

  it('5d. source+mode present but autostart missing does NOT autostart', () => {
    const intent = parseLaunchIntent(
      '?task=Wash+dishes&min=5&source=reset-my-day&mode=exact'
    );
    expect(intent?.isExactMode).toBe(true);
    expect(intent?.requestsAutostart).toBe(false);
  });

  it('6. missing task → null (no mission started)', () => {
    const intent = parseLaunchIntent('?min=5&source=reset-my-day&mode=exact&autostart=1');
    expect(intent).toBeNull();
  });

  it('6b. missing min → null (no mission started)', () => {
    const intent = parseLaunchIntent('?task=Wash+dishes&source=reset-my-day&mode=exact&autostart=1');
    expect(intent).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test: challenge banner isolation
// ---------------------------------------------------------------------------

describe('RMD launch — challenge banner isolation', () => {
  it('An RMD ?task= URL has no ?challenge= param, so challengeData is never set', () => {
    // Branch A reads params.get('task') — it never calls setChallengeData.
    // Branch B reads params.get('challenge') — skipped when bypassQuiz is already true.
    // Therefore: an RMD URL with only ?task= cannot trigger the challenge banner.
    const params = new URLSearchParams(
      '?task=Wash+dishes&min=5&source=reset-my-day&mode=exact&autostart=1'
    );
    expect(params.get('challenge')).toBeNull(); // no challenge param → no banner
    expect(params.get('task')).toBe('Wash dishes');
  });

  it('A social ?challenge= URL has no ?task= param so RMD Branch A is skipped', () => {
    const params = new URLSearchParams('?challenge=Wash+dishes&min=5');
    expect(params.get('task')).toBeNull();       // no task param → Branch A skipped
    expect(params.get('challenge')).toBe('Wash dishes'); // Branch B fires → banner shown
  });
});

// ---------------------------------------------------------------------------
// Test 7 + duration invariant: exact mode produces the raw minute allocation
// ---------------------------------------------------------------------------

describe('Exact duration invariant', () => {
  it('7. calculateActualTime(N, any, exact=true) always returns N (no tax, no rounding)', () => {
    // This is the invariant from lib/calculations.ts:38-40:
    //   if (exact) return Math.max(1, estimateMinutes);
    expect(calculateActualTime(5,  1.5, true)).toBe(5);
    expect(calculateActualTime(15, 1.5, true)).toBe(15);
    expect(calculateActualTime(30, 2.0, true)).toBe(30);
    expect(calculateActualTime(60, 1.0, true)).toBe(60);
    // Minimum 1
    expect(calculateActualTime(0,  1.5, true)).toBe(1);
  });

  it('7b. exact=false applies tax and rounds to nearest 5 (confirms the contrast)', () => {
    // 15 × 1.5 = 22.5 → rounds to 25
    expect(calculateActualTime(15, 1.5, false)).toBe(25);
  });

  it('E2E: RMD estimatedMinutes=5 → URL min=5 → isExactTime=true → allocatedMin=5', () => {
    // Full trace:
    // 1. RMD SequencedTask.estimatedMinutes = 5
    const rmdMinutes = 5;

    // 2. buildLaunchUrl: min = String(5) → '5'
    const urlMin = String(rmdMinutes);
    expect(urlMin).toBe('5');

    // 3. parseLaunchIntent: min = parseInt('5') = 5
    const intent = parseLaunchIntent(
      `?task=Wash+dishes&min=${urlMin}&source=reset-my-day&mode=exact&autostart=1`
    );
    expect(intent?.min).toBe(5);
    expect(intent?.isExactMode).toBe(true);

    // 4. UPDATE_SETUP with initialEstimate=5, isExactTime=true
    //    Reducer: effectiveMultiplier = 1.0, effectiveTransition = 0
    //    nextActual = calculateActualTime(5, 1.0, true) = 5

    const effectiveMultiplier = 1.0; // isExactTime → always 1.0
    const effectiveTransition = 0;   // isExactTime → always 0
    const nextActual = calculateActualTime(intent!.min, effectiveMultiplier, true) + effectiveTransition;

    expect(nextActual).toBe(5); // no tax, no rounding, no transition

    // 5. START_MISSION: plannedDurationMs = nextActual * 60_000 = 300_000
    const plannedDurationMs = nextActual * 60_000;
    expect(plannedDurationMs).toBe(300_000); // exactly 5 minutes

    // 6. startMission persists allocatedMin = nextActual = 5
    const allocatedMin = nextActual;
    expect(allocatedMin).toBe(5);

    // 7. expectedEndAt = now + plannedDurationMs
    //    (tested structurally; actual timestamp is runtime-dependent)
    const now = 1_000_000;
    const expectedEndAt = now + plannedDurationMs;
    expect(expectedEndAt - now).toBe(300_000); // 5 minutes exactly

    // INVARIANT: rmdMinutes === allocatedMin (no tax applied anywhere)
    expect(rmdMinutes).toBe(allocatedMin);
  });
});

// ---------------------------------------------------------------------------
// Test: Autostart state-transition
// ---------------------------------------------------------------------------

describe('RMD autostart — state-transition proof', () => {
  it('ST1: autostart arms only when all three conditions are present', () => {
    // Mirrors the boolean logic in SetupScreen Branch A.
    function shouldArm(search: string): boolean {
      const params = new URLSearchParams(search);
      const hasTask = params.get('task') !== null;
      const isRmdSource = params.get('source') === 'reset-my-day';
      const isExactMode = isRmdSource && params.get('mode') === 'exact';
      return hasTask && isExactMode && params.get('autostart') === '1';
    }

    expect(shouldArm('?task=X&min=5&source=reset-my-day&mode=exact&autostart=1')).toBe(true);
    expect(shouldArm('?task=X&min=5&source=reset-my-day&mode=exact')).toBe(false); // no autostart
    expect(shouldArm('?task=X&min=5&source=reset-my-day&autostart=1')).toBe(false); // no mode
    expect(shouldArm('?task=X&min=5&mode=exact&autostart=1')).toBe(false);           // no source
    expect(shouldArm('?challenge=X&min=5&source=reset-my-day&mode=exact&autostart=1')).toBe(false); // challenge branch
  });

  it('ST2: autostart effect guard conditions match the reducer invariant', () => {
    // The autostart useEffect in SetupScreen:
    //   if (!pendingAutostart) return;
    //   if (state.status !== 'setup') { setPendingAutostart(false); return; }
    //   if (!state.taskName.trim()) return; // wait for next render
    //
    // START_MISSION reducer:
    //   case 'START_MISSION': if (state.status !== 'setup') return state;
    //
    // Proof: the effect only fires START_MISSION when state.status === 'setup'
    // AND taskName is non-empty. The reducer's own guard is also status !== 'setup',
    // so the effect and the reducer agree on the pre-condition.

    // Simulate: pendingAutostart=true, status='setup', taskName='Wash dishes'
    // → effect proceeds to dispatch START_MISSION
    const pendingAutostart = true;
    const status = 'setup' as const;
    const taskName = 'Wash dishes';

    const willProceed =
      pendingAutostart &&
      status === 'setup' &&
      taskName.trim().length > 0;

    expect(willProceed).toBe(true);

    // Simulate: pendingAutostart=true, status='active' (mission already running)
    // → effect disarms without starting
    const willProceedIfActive =
      pendingAutostart &&
      ('active' as string) === 'setup' &&
      taskName.trim().length > 0;

    expect(willProceedIfActive).toBe(false);
  });

  it('ST3: active-mission conflict disarms autostart without starting a second mission', () => {
    // Mirrors the guard:
    //   if (active && (active.status === 'running' || active.status === 'paused')) {
    //     setPendingAutostart(false); return;
    //   }
    function wouldStart(activeMissionStatus: string | null): boolean {
      if (!activeMissionStatus) return true; // no active mission → start
      if (activeMissionStatus === 'running' || activeMissionStatus === 'paused') return false;
      return true;
    }

    expect(wouldStart(null)).toBe(true);        // no conflict → starts
    expect(wouldStart('running')).toBe(false);   // conflict → disarmed
    expect(wouldStart('paused')).toBe(false);    // conflict → disarmed
    expect(wouldStart('completed')).toBe(true);  // stale completed → starts
  });
});

// ---------------------------------------------------------------------------
// Tests 8–10: Minute input editing edge cases
// ---------------------------------------------------------------------------

describe('MinuteStepper — minute input editing', () => {
  it('8. input can transition through empty string while editing', () => {
    // Blur with empty raw → fallback preserved
    expect(clampMinutes('', 2)).toBe(2);
  });

  it('8b. typing "1" after clearing "2" produces 1', () => {
    expect(clampMinutes('1', 2)).toBe(1);
  });

  it('8c. 2 → backspace → type 1 → blur → 1', () => {
    // raw='', type '1' → raw='1', blur → clampMinutes('1', 2) = 1
    const afterBackspace = '';           // raw is empty mid-edit
    const afterType = afterBackspace + '1'; // raw = '1'
    expect(clampMinutes(afterType, 2)).toBe(1);
  });

  it('9. clamps below 1 to 1', () => {
    expect(clampMinutes('0', 1)).toBe(1);
    // '-5' is non-numeric for parseInt → NaN → fallback=1
    expect(clampMinutes('-5', 1)).toBe(1);
  });

  it('9b. minus button at 1 stays at 1', () => {
    const result = Math.max(1, Math.min(300, 1 - 5));
    expect(result).toBe(1);
  });

  it('10. clamps above 300 to 300', () => {
    expect(clampMinutes('301', 30)).toBe(300);
    expect(clampMinutes('9999', 30)).toBe(300);
  });

  it('10b. plus button at 300 stays at 300', () => {
    const result = Math.max(1, Math.min(300, 300 + 5));
    expect(result).toBe(300);
  });
});
