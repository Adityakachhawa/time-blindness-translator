import { ActiveMission } from './types';
import { setActiveMission, clearActiveMission, getActiveMission } from './storage';
import { saveCompletedTask, incrementLifetimeStats, incrementDailyCount } from '../storage';
import { getRandomTagline } from '../calculations';
import { sendCatchUpNotificationAsync } from '../notifications/notificationManager';
import { claimNotification, releaseNotificationClaim } from '../notifications/swDeliveryStore';
import { setAppBadge, clearAppBadge } from '../notifications/badgeManager';
import { trackEvent } from '../analytics/localAnalytics';
import { enqueueInvalidation, flushPendingActions } from '../notifications/pendingActions';

export function startMission(
  taskName: string,
  plannedDurationMs: number,
  optimisticMin: number,
  taxMultiplier: number,
  allocatedMin: number,
  transitionMinutes?: number,
  category?: any,
  isMicroStep?: boolean
): ActiveMission {
  const now = Date.now();
  const initialEndAt = now + plannedDurationMs;
  const mission: ActiveMission = {
    id: `${now}-${Math.random().toString(36).substring(2, 9)}`,
    taskName,
    category,
    startedAt: now,
    plannedDurationMs,
    expectedEndAt: initialEndAt,
    status: 'running',
    createdAt: now,
    updatedAt: now,

    // Immutable snapshots — set once, never overwritten.
    initialCalibratedMs: plannedDurationMs,
    initialExpectedEndAt: initialEndAt,

    optimisticMin,
    taxMultiplier,
    allocatedMin,
    transitionMinutes,
    isMicroStep,

    // Version 1 = the initial schedule. Incremented on every timing change.
    notificationVersion: 1,
  };
  
  setActiveMission(mission);
  trackEvent('mission_started', { 
    taskName, 
    plannedDurationMs, 
    optimisticMin, 
    allocatedMin 
  });
  return mission;
}

export function pauseMission(mission: ActiveMission): ActiveMission {
  if (mission.status !== 'running') return mission;
  
  const now = Date.now();
  const updated: ActiveMission = {
    ...mission,
    status: 'paused',
    pausedAt: now,
    updatedAt: now,
    // Don't bump version on pause — the expectedEndAt hasn't changed yet;
    // the already-scheduled webhook is still targeting the correct time.
  };
  
  setActiveMission(updated);
  clearAppBadge();
  return updated;
}

export function resumeMission(mission: ActiveMission): ActiveMission {
  if (mission.status !== 'paused' || !mission.pausedAt) return mission;
  
  const now = Date.now();
  const pausedDurationMs = now - mission.pausedAt;
  
  const updated: ActiveMission = {
    ...mission,
    status: 'running',
    expectedEndAt: mission.expectedEndAt + pausedDurationMs,
    totalPausedMs: (mission.totalPausedMs || 0) + pausedDurationMs,
    pausedAt: undefined,
    updatedAt: now,
    // Resume shifts expectedEndAt → the old webhook fires at the wrong time.
    // Bump version so the old webhook is rejected, and the caller re-schedules.
    notificationVersion: mission.notificationVersion + 1,
  };
  
  setActiveMission(updated);
  return updated;
}

export function extendMission(mission: ActiveMission, extraMinutes: number): ActiveMission {
  const now = Date.now();
  const extraMs = extraMinutes * 60_000;

  // If the mission is already in overtime (expectedEndAt is in the past), measure
  // from NOW so that "+5m" always means 5 additional minutes from the current moment,
  // not 5 minutes from a deadline that has already expired.
  const baseEndAt = Math.max(now, mission.expectedEndAt);

  const updated: ActiveMission = {
    ...mission,
    expectedEndAt: baseEndAt + extraMs,
    allocatedMin: mission.allocatedMin + extraMinutes, // reflect in history/stats
    updatedAt: now,
    // if it was expired/overtime and they added time, ensure it goes back to running
    status: mission.status === 'completed' || mission.status === 'cancelled' ? mission.status : 'running',
    // Bump version so the previously-scheduled QStash webhook (which targets
    // the old expectedEndAt) is rejected at delivery time.
    notificationVersion: mission.notificationVersion + 1,
  };

  setActiveMission(updated);
  clearAppBadge();
  return updated;
}

export function recalculateMission(mission: ActiveMission, remainingMinutes: number): ActiveMission {
  const now = Date.now();
  const remainingMs = remainingMinutes * 60_000;
  
  const newExpectedEndAt = now + remainingMs;
  
  const updated: ActiveMission = {
    ...mission,
    expectedEndAt: newExpectedEndAt,
    allocatedMin: Math.round((newExpectedEndAt - mission.startedAt) / 60_000),
    updatedAt: now,
    status: mission.status === 'completed' || mission.status === 'cancelled' ? mission.status : 'running',
    notificationVersion: mission.notificationVersion + 1,
  };
  
  setActiveMission(updated);
  clearAppBadge();
  return updated;
}


/**
 * Completes the mission, saves the task record, and returns both the
 * record ID and the real elapsed seconds so the caller can surface them.
 */
export function completeMission(
  mission: ActiveMission,
  tagline?: string,
): { completedRecordId: string; actualSeconds: number } {
  const now = Date.now();

  // ── Real elapsed time (discounts paused intervals) ──────────────────────
  const elapsedSinceStart = now - mission.startedAt;
  const totalPaused =
    (mission.totalPausedMs || 0) +
    (mission.status === 'paused' && mission.pausedAt ? now - mission.pausedAt : 0);
  const actualDurationMs = elapsedSinceStart - totalPaused;
  const actualSeconds = Math.floor(actualDurationMs / 1000);

  // ── Immutable calibration anchor ─────────────────────────────────────────
  // Always use the INITIAL calibrated estimate (set at startMission, never
  // overwritten by extensions). This ensures predictedSeconds in history
  // always represents the original prediction, not a post-extension budget.
  const originalEstimateMs = mission.optimisticMin * 60_000;
  const initialCalibratedMs = mission.initialCalibratedMs ?? mission.plannedDurationMs;

  const predictionErrorSignedMs = actualDurationMs - initialCalibratedMs;
  const predictionErrorAbsoluteMs = Math.abs(predictionErrorSignedMs);

  // ── Persist history record ────────────────────────────────────────────────
  const completedRecordId = saveCompletedTask({
    taskName: mission.taskName,
    category: mission.category,
    optimisticMin: mission.optimisticMin,
    taxMultiplier: mission.taxMultiplier,
    allocatedMin: mission.allocatedMin,
    actualMinutes: mission.allocatedMin, // backwards compat field
    completedAt: now,
    tagline,
    // predictedSeconds = INITIAL calibrated prediction — never the extension budget.
    predictedSeconds: Math.floor(initialCalibratedMs / 1000),
    actualSeconds,
    transitionMinutes: mission.transitionMinutes,
    originalEstimateMs,
    predictionErrorSignedMs,
    predictionErrorAbsoluteMs,
    isMicroStep: mission.isMicroStep,
  });

  trackEvent('mission_completed', {
    taskName: mission.taskName,
    actualDurationMs,
    predictionErrorSignedMs,
    predictionErrorAbsoluteMs,
  });

  incrementLifetimeStats(mission.allocatedMin - mission.optimisticMin, 0);
  incrementDailyCount(new Date(now));

  // Invalidate the Redis mission metadata so any in-flight QStash webhook
  // (scenarios E, F, G) is rejected at delivery time regardless of whether
  // QStash cancellation succeeded. We enqueue this durably to IndexedDB so
  // it safely retries if the user completes the mission offline.
  enqueueInvalidation(mission.id, mission.notificationVersion, now);
  flushPendingActions();

  try {
    fetch('/api/mission-count', { method: 'POST' }).catch(() => {});
  } catch {}

  clearActiveMission();
  clearAppBadge();

  return { completedRecordId, actualSeconds };
}


/**
 * Idempotent lifecycle reconciliation function.
 * Called on startup, visibilitychange, focus, and pageshow.
 *
 * LEGACY MIGRATION (P0 semantics fix, added 2026-09):
 * Missions created before this fix lack `initialCalibratedMs` and
 * `initialExpectedEndAt`.  We derive safe values once and persist them so
 * every downstream consumer (extendMission, completeMission) has the
 * correct immutable anchors without needing `?? fallback` on every call.
 *
 * Derivation rationale:
 *   initialCalibratedMs   ← plannedDurationMs  (set at startMission, never
 *                            mutated by extensions, identical to the original
 *                            calibrated budget for missions without extensions)
 *   initialExpectedEndAt  ← startedAt + plannedDurationMs  (the original
 *                            deadline as it was at mission start)
 */
/**
 * Idempotent lifecycle reconciliation function.
 * Called on startup, visibilitychange, focus, and pageshow.
 *
 * Async because it reads the SW delivery record from IndexedDB to determine
 * whether a background push already showed the OS notification, enforcing the
 * invariant:  SCHEDULED (notificationMessageId) ≠ DELIVERED (IDB record).
 *
 * Catch-up decision matrix (Atomic Claim):
 *   claim 'already-claimed'  → SW won, acknowledge silently, no OS notification
 *   claim 'claimed'          → page won, sendCatchUpNotificationAsync
 *   claim 'error'            → coordination failed, suppress OS notification
 *
 * LEGACY MIGRATION (P0 semantics fix, added 2026-09):
 * Missions created before this fix lack `initialCalibratedMs` and
 * `initialExpectedEndAt`.  We derive safe values once and persist them so
 * every downstream consumer (extendMission, completeMission) has the
 * correct immutable anchors without needing `?? fallback` on every call.
 */
export async function reconcileMission(): Promise<ActiveMission | null> {
  let mission = getActiveMission();
  if (!mission) return null;

  // ── One-time forward migration for legacy persisted missions ──────────────
  const needsMigration =
    (mission.initialCalibratedMs === undefined || mission.initialCalibratedMs === null) ||
    (mission.initialExpectedEndAt === undefined || mission.initialExpectedEndAt === null);

  if (needsMigration) {
    mission = {
      ...mission,
      // Best safe approximation: plannedDurationMs equals the original
      // calibrated budget for missions that were never extended while stored.
      // (If they were extended, allocatedMin > plannedDurationMs/60 but
      //  plannedDurationMs itself was never overwritten, so it's still correct.)
      initialCalibratedMs:
        mission.plannedDurationMs,
      initialExpectedEndAt:
        mission.startedAt + mission.plannedDurationMs,
    };
    // Persist enriched object immediately so this branch runs only once.
    setActiveMission(mission);
  }

  const now = Date.now();
  // If the mission has passed its expectedEndAt and we haven't yet acknowledged
  // the expiration event for this session, decide whether to send a catch-up
  // OS notification.
  //
  // The catchUpNotifiedAt sentinel persists in localStorage, so repeated
  // reconcile calls (visibilitychange, focus, pageshow) are all no-ops after
  // the first pass.
  if (mission.status === 'running' && now >= mission.expectedEndAt) {
    if (!mission.catchUpNotifiedAt) {
      // ── SW delivery gate / Atomic Claim ──────────────────────────────────
      // Attempt to claim atomic ownership of this canonical time-up event.
      const claim = await claimNotification(
        mission.id,
        mission.notificationVersion,
        'page'
      );

      if (claim.status === 'error') {
        // Coordination unavailable (IDB failed). We MUST suppress the OS
        // notification to avoid duplicates.
        // We do NOT set catchUpNotifiedAt because we have not successfully
        // handled it. The in-app Reality Check will still show since we return
        // the mission, but we let a future lifecycle pass retry the claim.
        return mission;
      }

      if (claim.status === 'already-claimed') {
        // The Service Worker already won the race and showed the OS notification
        // (or is currently doing so). No additional OS notification is needed.
        // Acknowledge locally so we don't keep trying.
        setAppBadge(1);
        setActiveMission({ ...mission, catchUpNotifiedAt: now });
        return mission;
      }

      // claim.status === 'claimed'
      // We won the claim! We are responsible for the catch-up notification.
      try {
        await sendCatchUpNotificationAsync(mission);
        
        // Only mark as successfully handled if the notification didn't throw
        setAppBadge(1);
        setActiveMission({ ...mission, catchUpNotifiedAt: now });
      } catch (err) {
        // If we claimed the event but failed to show it, release the claim
        // so that a subsequent catch-up attempt is allowed.
        await releaseNotificationClaim(mission.id, mission.notificationVersion);
      }
    }
  }

  return mission;
}
