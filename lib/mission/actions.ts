import { ActiveMission } from './types';
import { setActiveMission, clearActiveMission, getActiveMission } from './storage';
import { saveCompletedTask, incrementLifetimeStats, incrementDailyCount } from '../storage';
import { getRandomTagline } from '../calculations';
import { sendCatchUpNotification } from '../notifications/notificationManager';
import { setAppBadge, clearAppBadge } from '../notifications/badgeManager';
import { trackEvent } from '../analytics/localAnalytics';

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
    status: mission.status === 'completed' || mission.status === 'cancelled' ? mission.status : 'running'
  };
  
  setActiveMission(updated);
  clearAppBadge();
  return updated;
}

export function completeMission(mission: ActiveMission, tagline?: string): void {
  const now = Date.now();
  
  // Calculate total duration discounting paused time
  const elapsedSinceStart = now - mission.startedAt;
  const totalPaused = (mission.totalPausedMs || 0) + (mission.status === 'paused' && mission.pausedAt ? (now - mission.pausedAt) : 0);
  const actualDurationMs = elapsedSinceStart - totalPaused;
  const actualSeconds = Math.floor(actualDurationMs / 1000);
  
  // Calculate errors
  const originalEstimateMs = mission.optimisticMin * 60_000;
  // If originalEstimateMs was passed, we'd use it, but ActiveMission currently infers it from optimisticMin
  const calibratedEstimateMs = mission.plannedDurationMs;
  
  const predictionErrorSignedMs = actualDurationMs - calibratedEstimateMs;
  const predictionErrorAbsoluteMs = Math.abs(predictionErrorSignedMs);
  
  // Record history
  saveCompletedTask({
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
  
  incrementLifetimeStats(mission.allocatedMin - mission.optimisticMin, 0); // extensions are not strictly tracked yet in ActiveMission, we pass 0 for now.
  incrementDailyCount(new Date(now));
  
  try {
    fetch('/api/mission-count', { method: 'POST' }).catch(() => {});
  } catch {}
  
  clearActiveMission();
  clearAppBadge();
}

/**
 * Idempotent lifecycle reconciliation function.
 * Called on startup, visibilitychange, focus, and pageshow.
 */
export function reconcileMission(): ActiveMission | null {
  const mission = getActiveMission();
  if (!mission) return null;

  const now = Date.now();
  // If the mission is running and has passed expectedEndAt, we could mark
  // a local flag to ensure we only process the expiry once (e.g. notifications).
  if (mission.status === 'running' && now >= mission.expectedEndAt) {
    sendCatchUpNotification(mission);
    setAppBadge(1);
  }
  
  return mission;
}
