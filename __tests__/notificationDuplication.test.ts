import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendCatchUpNotificationAsync, sendAwarenessNotification, KEY_NOTIFICATION_EVENTS } from '../lib/notifications/notificationManager';
import { ActiveMission } from '../lib/mission/types';
import * as swDeliveryStore from '../lib/notifications/swDeliveryStore';

vi.mock('../lib/notifications/swDeliveryStore', () => ({
  claimNotification: vi.fn(),
  releaseNotificationClaim: vi.fn(),
}));

/**
 * These tests exercise sendCatchUpNotification() and sendAwarenessNotification()
 * in isolation — the notificationManager layer only.
 *
 * The higher-level reconcileMission() + SW delivery record gate is tested in
 * __tests__/actions.test.ts (Tests A & B).
 *
 * Semantic note:
 *   The notificationMessageId guard inside sendCatchUpNotification is a
 *   SECONDARY defence-in-depth guard, NOT the primary delivery gate.
 *   Primary gate: isSWDeliveryRecorded() in reconcileMission (actions.test.ts).
 */
describe('Notification Deduplication Architecture', () => {
  let mockMission: ActiveMission;
  const mockShowNotification = vi.fn();
  
  beforeEach(() => {
    mockMission = {
      id: 'test-mission-123',
      taskName: 'Focus Task',
      allocatedMin: 25,
      startedAt: Date.now() - 30 * 60000,
      expectedEndAt: Date.now() - 5 * 60000,
      status: 'running',
      notificationVersion: 1,
    } as ActiveMission;

    const mockStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    };
    
    vi.stubGlobal('window', {
      localStorage: mockStorage,
      Notification: {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted')
      }
    });
    
    // Also stub global Notification for direct usage
    vi.stubGlobal('Notification', window.Notification);
    
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          showNotification: mockShowNotification,
        })
      }
    });

    vi.stubGlobal('document', {
      visibilityState: 'hidden'
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── Original tests ─────────────────────────────────────────────────────────

  it('TEST 1 / TEST 7 (foreground expiration): mission expires while app is visible — no OS notification', async () => {
    vi.stubGlobal('document', { visibilityState: 'visible' });
    
    sendAwarenessNotification(mockMission, `mission:${mockMission.id}:v1:time-up`, 'Title', 'Body');
    await sendCatchUpNotificationAsync(mockMission);

    // Foreground: both paths skip OS notification and mark acknowledged
    expect(mockShowNotification).not.toHaveBeenCalled();
    expect(window.localStorage.setItem).toHaveBeenCalled(); // marked as acknowledged
  });

  it('TEST 2: mission expires while backgrounded (no QStash scheduled) — fires once', async () => {
    await sendCatchUpNotificationAsync(mockMission);
    
    // allow microtasks to flush
    await new Promise(r => setTimeout(r, 0));
    
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('Time is up'), 
      expect.objectContaining({ tag: 'mission:test-mission-123:v1:time-up' })
    );
  });

  it('TEST 3: notificationMessageId no longer suppresses sendCatchUpNotification', async () => {
    // notificationMessageId = QStash was scheduled. We removed the secondary guard
    // so that if IDB fails or QStash fails, catch-up still fires (SCHEDULED != DELIVERED).
    mockMission.notificationMessageId = 'msg_123';
    
    // Background awareness interval tries to fire (will be suppressed by notificationMessageId
    // since awareness doesn't need to fire if a push is scheduled)
    sendAwarenessNotification(mockMission, `mission:${mockMission.id}:v1:time-up`, 'Title', 'Body');
    
    // User is in background (visibility hidden) and reconcile triggers catch-up
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    await sendCatchUpNotificationAsync(mockMission);
    
    await new Promise(r => setTimeout(r, 0));
    
    // Catch-up should fire because notificationMessageId does not suppress it
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
    // Note: swDeliveryStore mock calls are no longer asserted here since claim logic moved to reconcileMission
  });

  it('TEST 5 / TEST 6: visibilitychange + focus + pageshow all fire after same expiration — max 1 notification', async () => {
    // First reconcile call (e.g., visibilitychange)
    await sendCatchUpNotificationAsync(mockMission);
    
    // Simulate the event being recorded in localStorage
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify([`mission:${mockMission.id}:v1:time-up`]));
    
    // Subsequent reconcile calls (focus, pageshow) — all should be no-ops
    await sendCatchUpNotificationAsync(mockMission);
    await sendCatchUpNotificationAsync(mockMission);
    sendAwarenessNotification(mockMission, `mission:${mockMission.id}:v1:time-up`, 'Title', 'Body');
    
    await new Promise(r => setTimeout(r, 0));
    
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
  });

  it('TEST 6 / repeated processing: same missionId + notificationVersion processed repeatedly — 1 notification max', async () => {
    sendAwarenessNotification(mockMission, `mission:${mockMission.id}:v1:time-up`, 'Title', 'Body');
    
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify([`mission:${mockMission.id}:v1:time-up`]));
    
    sendAwarenessNotification(mockMission, `mission:${mockMission.id}:v1:time-up`, 'Title', 'Body');
    await sendCatchUpNotificationAsync(mockMission);
    
    await new Promise(r => setTimeout(r, 0));
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
  });

  it('TEST 8: completed mission status — sendCatchUpNotification does not fire for running missions that are completed', async () => {
    // A completed mission would have been cleared from localStorage (clearActiveMission).
    // At the notificationManager level: if the event was already acknowledged, it skips.
    vi.mocked(window.localStorage.getItem).mockReturnValue(
      JSON.stringify([`mission:${mockMission.id}:v1:time-up`])
    );
    
    await sendCatchUpNotificationAsync(mockMission);
    
    await new Promise(r => setTimeout(r, 0));
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('TEST 9 (stale version): v1 acknowledged, v2 is a new canonical event and fires', async () => {
    // old version acknowledged in localStorage
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify([`mission:${mockMission.id}:v1:time-up`]));
    
    // mission gets extended to v2 (new notificationVersion = new canonical event)
    mockMission.notificationVersion = 2;
    await sendCatchUpNotificationAsync(mockMission);
    
    await new Promise(r => setTimeout(r, 0));
    
    // Should fire because v2 is a new canonical event ID
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tag: 'mission:test-mission-123:v2:time-up' })
    );
  });
});
