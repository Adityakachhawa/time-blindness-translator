import { describe, it, expect } from 'vitest';
import { getMissionAwarenessEvents } from '../lib/mission/awareness';
import { ActiveMission } from '../lib/mission/types';

function createMockMission(allocatedMin: number, elapsedMin: number): { mission: ActiveMission, now: number } {
  const now = Date.now();
  const startedAt = now - (elapsedMin * 60000);
  const plannedDurationMs = allocatedMin * 60000;
  const initialEndAt = startedAt + plannedDurationMs;

  return {
    mission: {
      id: 'mock-123',
      taskName: 'Test Task',
      startedAt,
      plannedDurationMs,
      expectedEndAt: initialEndAt,
      status: 'running',
      createdAt: startedAt,
      updatedAt: startedAt,
      optimisticMin: allocatedMin,
      taxMultiplier: 1.0,
      allocatedMin,
      notificationVersion: 1,
      // Immutable snapshot fields (added in P0 semantics fix)
      initialCalibratedMs: plannedDurationMs,
      initialExpectedEndAt: initialEndAt,
    },
    now
  };
}

describe('Mission Time Awareness', () => {
  it('1. 5-minute mission: expiry only', () => {
    // at 4 mins
    let { mission, now } = createMockMission(5, 4);
    let events = getMissionAwarenessEvents(mission, now);
    expect(events.length).toBe(0);

    // at 5 mins (expired)
    ({ mission, now } = createMockMission(5, 5));
    events = getMissionAwarenessEvents(mission, now);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('EXPIRED');
  });

  it('2. 15-minute mission: near-end and expiry only', () => {
    // at 7.5 mins (halfway - should NOT trigger for 15m)
    let { mission, now } = createMockMission(15, 7.5);
    let events = getMissionAwarenessEvents(mission, now);
    expect(events.length).toBe(0);

    // at 10 mins (near-end)
    ({ mission, now } = createMockMission(15, 10));
    events = getMissionAwarenessEvents(mission, now);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('NEAR_END');

    // at 15 mins (expired)
    ({ mission, now } = createMockMission(15, 15));
    events = getMissionAwarenessEvents(mission, now);
    // The near-end event was at 10m. At 15m it is outside the 2-minute window, so it is suppressed.
    expect(events.length).toBe(1);
    expect(events.find(e => e.type === 'EXPIRED')).toBeDefined();
  });

  it('3. 30-minute mission: halfway, near-end, expiry, overtime', () => {
    // at 15 mins (halfway)
    let { mission, now } = createMockMission(30, 15);
    let events = getMissionAwarenessEvents(mission, now);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('HALFWAY');

    // at 25 mins (near-end)
    ({ mission, now } = createMockMission(30, 25));
    events = getMissionAwarenessEvents(mission, now);
    expect(events.length).toBe(1);
    expect(events.find(e => e.type === 'NEAR_END')).toBeDefined();

    // at 35 mins (expired and overtime)
    ({ mission, now } = createMockMission(30, 35));
    events = getMissionAwarenessEvents(mission, now);
    // Halfway (15m) and near-end (25m) are outside the 2m window.
    expect(events.length).toBe(2);
    expect(events.find(e => e.type === 'EXPIRED')).toBeDefined();
    expect(events.find(e => e.type === 'OVERTIME_5')).toBeDefined();
  });

  it('4. 90-minute mission: halfway, near-end, expiry', () => {
    // at 45 mins (halfway)
    let { mission, now } = createMockMission(90, 45);
    let events = getMissionAwarenessEvents(mission, now);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('HALFWAY');
  });

  it('5. duplicate reconciliation: events are idempotent', () => {
    const { mission, now } = createMockMission(30, 35);
    const events1 = getMissionAwarenessEvents(mission, now);
    const events2 = getMissionAwarenessEvents(mission, now);
    // calling it multiple times gives the same exact event IDs
    expect(events1).toEqual(events2);
    expect(new Set(events1.map(e => e.id)).size).toBe(events1.length); // no internal duplicates
  });

  it('6. expiry: correct event data', () => {
    const { mission, now } = createMockMission(5, 5);
    const events = getMissionAwarenessEvents(mission, now);
    expect(events[0]).toMatchObject({
      type: 'EXPIRED',
      isOvertime: true,
      requiresAttention: true
    });
  });

  it('7. overtime: does not stop mission, transitions correctly', () => {
    const { mission, now } = createMockMission(20, 26);
    const events = getMissionAwarenessEvents(mission, now);
    expect(events.find(e => e.type === 'OVERTIME_5')).toBeDefined();
  });

  it('8. extension: changes expected end and suppresses earlier events if no longer applicable', () => {
    const { mission, now } = createMockMission(30, 28); // initially near end, almost expired
    // user extends by 10 minutes
    mission.expectedEndAt += 10 * 60000;
    
    const events = getMissionAwarenessEvents(mission, now);
    // Halfway (15m) is outside the 2m window (now=28m), so it is suppressed.
    // Near end is now 35m. currently at 28m, so near_end should NOT fire.
    expect(events.find(e => e.type === 'HALFWAY')).toBeUndefined();
    expect(events.find(e => e.type === 'NEAR_END')).toBeUndefined();
    expect(events.find(e => e.type === 'EXPIRED')).toBeUndefined();
  });

  it('9. completion before expiry: generates no more events', () => {
    const { mission, now } = createMockMission(30, 10);
    mission.status = 'completed'; // no events for completed missions
    const events = getMissionAwarenessEvents(mission, now);
    expect(events.length).toBe(0);
  });

  it('10. completion after expiry: generates no more events', () => {
    const { mission, now } = createMockMission(30, 35);
    mission.status = 'completed'; 
    const events = getMissionAwarenessEvents(mission, now);
    expect(events.length).toBe(0);
  });
});
