import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendCatchUpNotification, sendAwarenessNotification, KEY_NOTIFICATION_EVENTS } from '../lib/notifications/notificationManager';
import { ActiveMission } from '../lib/mission/types';

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

  it('TEST 1: Mission expires while foreground', () => {
    vi.stubGlobal('document', { visibilityState: 'visible' });
    
    sendAwarenessNotification(mockMission, `mission:${mockMission.id}:v1:time-up`, 'Title', 'Body');
    sendCatchUpNotification(mockMission);

    expect(mockShowNotification).not.toHaveBeenCalled();
    expect(window.localStorage.setItem).toHaveBeenCalled(); // marked as acknowledged
  });

  it('TEST 2: Mission expires while backgrounded (no QStash scheduled)', async () => {
    sendCatchUpNotification(mockMission);
    
    // allow microtasks to flush
    await new Promise(r => setTimeout(r, 0));
    
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('Time is up'), 
      expect.objectContaining({ tag: 'mission:test-mission-123:v1:time-up' })
    );
  });

  it('TEST 3 & 4: Background expiration happens, QStash scheduled, then user opens app', async () => {
    // QStash is handling it
    mockMission.notificationMessageId = 'msg_123';
    
    // Background awareness interval tries to fire
    sendAwarenessNotification(mockMission, `mission:${mockMission.id}:v1:time-up`, 'Title', 'Body');
    
    // User opens app (visibility becomes visible, reconcile fires catch up)
    vi.stubGlobal('document', { visibilityState: 'visible' });
    sendCatchUpNotification(mockMission);
    
    await new Promise(r => setTimeout(r, 0));
    
    // The main thread should NEVER show an OS notification because QStash handles it
    // and visibility is visible when they return.
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('TEST 6: visibilitychange + focus + pageshow all happen after the same expiration', async () => {
    // Simulate multiple calls due to lifecycle events
    sendCatchUpNotification(mockMission);
    
    // Once it's in localStorage, subsequent calls should be ignored.
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify([`mission:${mockMission.id}:v1:time-up`]));
    
    sendCatchUpNotification(mockMission);
    sendCatchUpNotification(mockMission);
    sendAwarenessNotification(mockMission, `mission:${mockMission.id}:v1:time-up`, 'Title', 'Body');
    
    await new Promise(r => setTimeout(r, 0));
    
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
  });

  it('TEST 7: same mission + same notificationVersion processed repeatedly', async () => {
    sendAwarenessNotification(mockMission, `mission:${mockMission.id}:v1:time-up`, 'Title', 'Body');
    
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify([`mission:${mockMission.id}:v1:time-up`]));
    
    sendAwarenessNotification(mockMission, `mission:${mockMission.id}:v1:time-up`, 'Title', 'Body');
    sendCatchUpNotification(mockMission);
    
    await new Promise(r => setTimeout(r, 0));
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
  });

  it('TEST 9: mission timing extended/recalculated', async () => {
    // old version
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify([`mission:${mockMission.id}:v1:time-up`]));
    
    // mission gets extended to v2
    mockMission.notificationVersion = 2;
    sendCatchUpNotification(mockMission);
    
    await new Promise(r => setTimeout(r, 0));
    
    // Should fire because v2 is a new canonical event
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tag: 'mission:test-mission-123:v2:time-up' })
    );
  });
});
