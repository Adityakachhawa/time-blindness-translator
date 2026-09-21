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
  
  // Policy configuration based on current allocatedMin
  const includeHalfway = totalMin > 15;
  const includeNearEnd = totalMin > 5;
  const includeOvertime = totalMin > 15;
  
  // Calculate thresholds based on the CURRENT expectedEndAt
  const halfwayMs = startedAt + (totalDurationMs / 2);
  const nearEndMs = expectedEndAt - (5 * 60000);
  const expiredMs = expectedEndAt;
  const overtime5Ms = expectedEndAt + (5 * 60000);
  
  // Version the event IDs so new timing changes produce new events.
  const v = mission.notificationVersion || 1;
  const makeId = (type: string) => `mission:${mission.id}:v${v}:${type}`;
  
  // To prevent "retroactive spam" (e.g., triggering a halfway event immediately 
  // after an extension because the new halfway point is already in the past), 
  // we require `now` to be within a valid window of the milestone. 
  // `expired` is handled separately by the catch-up system if missed, 
  // but for awareness we use a 2-minute window.
  const isWithinWindow = (milestone: number) => now >= milestone && now < milestone + 120_000;
  const isPast = (milestone: number) => now >= milestone;
  if (includeHalfway && isWithinWindow(halfwayMs)) {
    events.push({
      id: makeId('halfway'),
      type: 'HALFWAY',
      title: 'Time Check',
      message: 'Half-way check',
      isOvertime: false,
      requiresAttention: true,
    });
  }
  
  if (includeNearEnd && isWithinWindow(nearEndMs)) {
    events.push({
      id: makeId('near_end'),
      type: 'NEAR_END',
      title: 'Time Check',
      message: '5 minutes left',
      isOvertime: false,
      requiresAttention: true,
    });
  }
  
  if (isPast(expiredMs)) {
    events.push({
      id: makeId('time-up'),
      type: 'EXPIRED',
      title: 'Time Check',
      message: 'Reality check',
      isOvertime: true,
      requiresAttention: true,
    });
  }
  
  if (includeOvertime && isPast(overtime5Ms)) {
    events.push({
      id: makeId('overtime_5'),
      type: 'OVERTIME_5',
      title: 'Time Check',
      message: "You're still going",
      isOvertime: true,
      requiresAttention: true,
    });
  }

  return events;
}
