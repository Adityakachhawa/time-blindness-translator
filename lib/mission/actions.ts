import { ActiveMission } from './types';
import { setActiveMission, clearActiveMission, getActiveMission } from './storage';
import { saveCompletedTask, incrementLifetimeStats, incrementDailyCount } from '../storage';
import { getRandomTagline } from '../calculations';
import { sendCatchUpNotification } from '../notifications/notificationManager';
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
  category?: any
): ActiveMission {
  const now = Date.now();
  const mission: ActiveMission = {
    id: `${now}-${Math.random().toString(36).substring(2, 9)}`,
    taskName,
    category,
    startedAt: now,
    plannedDurationMs,
    expectedEndAt: now + plannedDurationMs,
    status: 'running',
    createdAt: now,
    updatedAt: now,
    
    optimisticMin,
    taxMultiplier,
    allocatedMin,
    transitionMinutes,

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
  
  const updated: ActiveMission = {
    ...mission,
    expectedEndAt: mission.expectedEndAt + extraMs,
    allocatedMin: mission.allocatedMin + extraMinutes, // reflect in history
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


export function completeMission(mission: ActiveMission, tagline?: string): string {
  const now = Date.now();
  
  // Calculate total duration discounting paused time
  const elapsedSinceStart = now - mission.startedAt;
  const totalPaused = (mission.totalPausedMs || 0) + (mission.status === 'paused' && mission.pausedAt ? (now - mission.pausedAt) : 0);
  const actualDurationMs = elapsedSinceStart - totalPaused;
  const actualSeconds = Math.floor(actualDurationMs / 1000);
  
  // Calculate errors
  const originalEstimateMs = mission.optimisticMin * 60_000;
  const calibratedEstimateMs = mission.plannedDurationMs;
  
  const predictionErrorSignedMs = actualDurationMs - calibratedEstimateMs;
  const predictionErrorAbsoluteMs = Math.abs(predictionErrorSignedMs);
  
  // Record history — capture returned ID so caller can pass it into React state
  const completedRecordId = saveCompletedTask({
    taskName: mission.taskName,
    category: mission.category,
    optimisticMin: mission.optimisticMin,
    taxMultiplier: mission.taxMultiplier,
    allocatedMin: mission.allocatedMin,
    actualMinutes: mission.allocatedMin, // Backwards compat
    completedAt: now,
    tagline,
    predictedSeconds: Math.floor(calibratedEstimateMs / 1000),
    actualSeconds,
    transitionMinutes: mission.transitionMinutes,
    originalEstimateMs,
    predictionErrorSignedMs,
    predictionErrorAbsoluteMs,
  });
  
  trackEvent('mission_completed', { 
    taskName: mission.taskName, 
    actualDurationMs,
    predictionErrorSignedMs,
    predictionErrorAbsoluteMs
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

  return completedRecordId;
}


/**
 * Idempotent lifecycle reconciliation function.
 * Called on startup, visibilitychange, focus, and pageshow.
 */
export function reconcileMission(): ActiveMission | null {
  const mission = getActiveMission();
  if (!mission) return null;

  const now = Date.now();
  // If the mission has passed its expectedEndAt and we haven't yet sent a
  // local catch-up notification for this session, do so exactly once.
  // The catchUpNotifiedAt sentinel persists in localStorage, so repeated
  // reconcile calls (visibilitychange, focus, pageshow) are all no-ops.
  if (mission.status === 'running' && now >= mission.expectedEndAt) {
    if (!mission.catchUpNotifiedAt) {
      sendCatchUpNotification(mission);
      setAppBadge(1);
      // Write the sentinel back before returning so the next reconcile skips.
      setActiveMission({ ...mission, catchUpNotifiedAt: now });
    }
  }
  
  return mission;
}
