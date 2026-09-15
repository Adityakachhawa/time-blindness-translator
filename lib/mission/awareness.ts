import { ActiveMission } from './types';

export type AwarenessEventType = 'HALFWAY' | 'NEAR_END' | 'EXPIRED' | 'OVERTIME_5';

export interface MissionEvent {
  id: string;
  type: AwarenessEventType;
  title: string;
  message: string;
  isOvertime: boolean;
  requiresAttention: boolean;
}

export function getMissionAwarenessEvents(mission: ActiveMission, now: number): MissionEvent[] {
  const events: MissionEvent[] = [];
  
  // We only generate events for active missions (running or paused)
  if (mission.status !== 'running' && mission.status !== 'paused') {
    return events;
  }

  // Use allocatedMin as the base duration for policies
  const totalMin = mission.allocatedMin;
  
  // Total expected duration in ms (this changes if extended/recalculated)
  // We use the original expected duration (expectedEndAt - startedAt) 
  // Wait, if it was extended, expectedEndAt is pushed out.
  // The elapsed time should be calculated against the CURRENT expectedEndAt.
  // For halfway, it's half of the total planned duration.
  // We can just use the time remaining to determine near-end and expired.
  
  const expectedEndAt = mission.expectedEndAt;
  const startedAt = mission.startedAt;
  const totalDurationMs = expectedEndAt - startedAt;
  
  // Policy configuration based on initial allocatedMin
  const includeHalfway = totalMin > 15;
  const includeNearEnd = totalMin > 5;
  const includeOvertime = totalMin > 15;
  
  // Calculate thresholds based on the expectedEndAt
  const halfwayMs = startedAt + (totalDurationMs / 2);
  const nearEndMs = expectedEndAt - (5 * 60000);
  const expiredMs = expectedEndAt;
  const overtime5Ms = expectedEndAt + (5 * 60000);
  
  // To avoid re-triggering halfway/near-end after an extension, we should base the event ID on the current expectedEndAt
  // Or simply use the mission.id. But if they extend, does halfway fire again? No, usually not.
  // The simplest is to just use mission.id. If they recalculate, they might want new events.
  // The user requested: "The mission should remain the same mission" and "use the existing notification scheduling/versioning system".
  // So incorporating notificationVersion into the event ID prevents re-triggering old events but allows new ones if version changes, OR we keep it simple: just `mission:${mission.id}:halfway`. Wait, if they extend, they shouldn't get another halfway.
  
  if (includeHalfway && now >= halfwayMs) {
    events.push({
      id: `mission:${mission.id}:halfway`,
      type: 'HALFWAY',
      title: 'Time Check',
      message: 'Half-way check',
      isOvertime: false,
      requiresAttention: true,
    });
  }
  
  if (includeNearEnd && now >= nearEndMs) {
    events.push({
      id: `mission:${mission.id}:near_end`,
      type: 'NEAR_END',
      title: 'Time Check',
      message: '5 minutes left',
      isOvertime: false,
      requiresAttention: true,
    });
  }
  
  if (now >= expiredMs) {
    events.push({
      id: `mission:${mission.id}:expired`,
      type: 'EXPIRED',
      title: 'Time Check',
      message: 'Reality check',
      isOvertime: true,
      requiresAttention: true,
    });
  }
  
  if (includeOvertime && now >= overtime5Ms) {
    events.push({
      id: `mission:${mission.id}:overtime_5`,
      type: 'OVERTIME_5',
      title: 'Time Check',
      message: "You're still going",
      isOvertime: true,
      requiresAttention: true,
    });
  }

  return events;
}
