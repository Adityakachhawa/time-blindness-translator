import { ActiveMission } from './types';
import { setActiveMission, clearActiveMission } from './storage';
import { saveCompletedTask, incrementLifetimeStats, incrementDailyCount } from '../storage';
import { getRandomTagline } from '../calculations';

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
  return updated;
}

export function completeMission(mission: ActiveMission, tagline?: string): void {
  const now = Date.now();
  
  // Calculate total duration discounting paused time
  const elapsedSinceStart = now - mission.startedAt;
  const totalPaused = (mission.totalPausedMs || 0) + (mission.status === 'paused' && mission.pausedAt ? (now - mission.pausedAt) : 0);
  const actualSeconds = Math.floor((elapsedSinceStart - totalPaused) / 1000);
  
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
    predictedSeconds: mission.originalEstimateMs ? Math.floor(mission.originalEstimateMs / 1000) : (mission.optimisticMin * 60),
    actualSeconds,
    transitionMinutes: mission.transitionMinutes,
  });
  
  incrementLifetimeStats(mission.allocatedMin - mission.optimisticMin, 0); // extensions are not strictly tracked yet in ActiveMission, we pass 0 for now.
  incrementDailyCount(new Date(now));
  
  try {
    fetch('/api/mission-count', { method: 'POST' }).catch(() => {});
  } catch {}
  
  clearActiveMission();
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
  // For Phase 2, we just return the active mission so the UI can snap to the correct state.
  
  // In the future (Phase 3+), we will check notification delivery state here
  // and process expiry exactly once without corrupting the mission state.
  
  return mission;
}
