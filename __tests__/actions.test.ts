import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  startMission, 
  extendMission, 
  resumeMission, 
  completeMission, 
  pauseMission,
  reconcileMission
} from '../lib/mission/actions';
import * as storage from '../lib/mission/storage';
import * as badgeManager from '../lib/notifications/badgeManager';
import * as notificationManager from '../lib/notifications/notificationManager';
import * as swDeliveryStore from '../lib/notifications/swDeliveryStore';
import * as localAnalytics from '../lib/analytics/localAnalytics';
import * as pendingActions from '../lib/notifications/pendingActions';
import { ActiveMission } from '../lib/mission/types';

// Mock dependencies
vi.mock('../lib/mission/storage');
vi.mock('../lib/storage');
vi.mock('../lib/notifications/badgeManager');
vi.mock('../lib/notifications/notificationManager');
vi.mock('../lib/notifications/swDeliveryStore', () => ({
  claimNotification: vi.fn(),
  releaseNotificationClaim: vi.fn(),
}));
vi.mock('../lib/analytics/localAnalytics');
vi.mock('../lib/notifications/pendingActions');

// Mock fetch for the API calls
global.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));

describe('Mission Actions & Notification Correctness', () => {
  let mockMission: ActiveMission;
  const now = 1000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    
    mockMission = {
      id: 'test-mission-1',
      taskName: 'Test Task',
      startedAt: now,
      plannedDurationMs: 60000,
      expectedEndAt: now + 60000,
      status: 'running',
      createdAt: now,
      updatedAt: now,
      optimisticMin: 1,
      taxMultiplier: 1.0,
      allocatedMin: 1,
      notificationVersion: 1,
      // Immutable snapshot fields (added in P0 semantics fix)
      initialCalibratedMs: 60000,
      initialExpectedEndAt: now + 60000,
    };
    
    (storage.getActiveMission as any).mockReturnValue(mockMission);
    // Default: assume claimNotification fails (fail-open) so catch-up tests still run
    // or assume claim succeeds. We'll set the default to 'claimed' for page wins.
    (swDeliveryStore.claimNotification as any).mockResolvedValue({ status: 'claimed' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('startMission', () => {
    it('initializes with notificationVersion 1', () => {
      const mission = startMission('New Task', 60000, 1, 1.0, 1);
      expect(mission.notificationVersion).toBe(1);
    });
  });

  describe('extendMission', () => {
    it('bumps notificationVersion', () => {
      const updated = extendMission(mockMission, 5);
      expect(updated.notificationVersion).toBe(2);
      expect(updated.expectedEndAt).toBe(mockMission.expectedEndAt + 5 * 60000);
    });
  });

  describe('pauseMission / resumeMission', () => {
    it('does not bump version on pause, but bumps on resume', () => {
      const paused = pauseMission(mockMission);
      expect(paused.notificationVersion).toBe(1);
      expect(paused.status).toBe('paused');

      const resumed = resumeMission(paused);
      expect(resumed.notificationVersion).toBe(2);
      expect(resumed.status).toBe('running');
    });
  });

  describe('completeMission (Offline Invalidation Queue)', () => {
    it('enqueues the invalidation to IDB and attempts flush', () => {
      completeMission(mockMission);
      expect(pendingActions.enqueueInvalidation).toHaveBeenCalledWith(
        mockMission.id, 
        mockMission.notificationVersion,
        now
      );
      expect(pendingActions.flushPendingActions).toHaveBeenCalled();
    });
  });

  describe('reconcileMission (async — SW delivery gate)', () => {
    it('sends catch-up notification when expectedEndAt is passed and claim succeeds', async () => {
      vi.setSystemTime(now + 120000); // 2 minutes later, mission is expired
      // claimNotification returns 'claimed' → page wins
      (swDeliveryStore.claimNotification as any).mockResolvedValue({ status: 'claimed' });

      await reconcileMission();
      
      expect(swDeliveryStore.claimNotification).toHaveBeenCalledWith(
        mockMission.id,
        mockMission.notificationVersion,
        'page'
      );
      expect(notificationManager.sendCatchUpNotificationAsync).toHaveBeenCalledWith(mockMission);
      expect(badgeManager.setAppBadge).toHaveBeenCalledWith(1);
      expect(storage.setActiveMission).toHaveBeenCalledWith(
        expect.objectContaining({ catchUpNotifiedAt: now + 120000 })
      );
    });

    it('does NOT send catch-up notification when claim is already-claimed', async () => {
      vi.setSystemTime(now + 120000);
      // claimNotification returns 'already-claimed' → SW won
      (swDeliveryStore.claimNotification as any).mockResolvedValue({ status: 'already-claimed' });

      await reconcileMission();

      expect(swDeliveryStore.claimNotification).toHaveBeenCalledWith(
        mockMission.id,
        mockMission.notificationVersion,
        'page'
      );
      // Badge and sentinel are STILL set (expiration was acknowledged)
      expect(badgeManager.setAppBadge).toHaveBeenCalledWith(1);
      expect(storage.setActiveMission).toHaveBeenCalledWith(
        expect.objectContaining({ catchUpNotifiedAt: now + 120000 })
      );
      // But NO OS notification
      expect(notificationManager.sendCatchUpNotificationAsync).not.toHaveBeenCalled();
    });

    it('[TEST A] notificationMessageId set but claim succeeds → catch-up is allowed', async () => {
      vi.setSystemTime(now + 120000);
      // QStash was scheduled but push was never delivered
      mockMission.notificationMessageId = 'qstash-msg-123';
      (storage.getActiveMission as any).mockReturnValue(mockMission);
      (swDeliveryStore.claimNotification as any).mockResolvedValue({ status: 'claimed' });

      await reconcileMission();

      // SCHEDULED != DELIVERED: notificationMessageId alone does not suppress catch-up
      expect(notificationManager.sendCatchUpNotificationAsync).toHaveBeenCalledWith(mockMission);
    });

    it('[TEST B] notificationMessageId set AND claim is already-claimed → zero additional notifications', async () => {
      vi.setSystemTime(now + 120000);
      mockMission.notificationMessageId = 'qstash-msg-123';
      (storage.getActiveMission as any).mockReturnValue(mockMission);
      (swDeliveryStore.claimNotification as any).mockResolvedValue({ status: 'already-claimed' });

      await reconcileMission();

      expect(notificationManager.sendCatchUpNotificationAsync).not.toHaveBeenCalled();
    });

    it('does NOT send catch-up if sentinel is already present (idempotent)', async () => {
      vi.setSystemTime(now + 120000);
      mockMission.catchUpNotifiedAt = now + 60000; // already acknowledged
      (storage.getActiveMission as any).mockReturnValue(mockMission);

      await reconcileMission();
      
      // Neither IDB check nor notification fired
      expect(swDeliveryStore.claimNotification).not.toHaveBeenCalled();
      expect(notificationManager.sendCatchUpNotificationAsync).not.toHaveBeenCalled();
      expect(badgeManager.setAppBadge).not.toHaveBeenCalled();
    });

    it('when IDB read fails (claim returns error), suppresses OS notification but keeps Reality Check state', async () => {
      vi.setSystemTime(now + 120000);
      // Simulate IDB failure
      (swDeliveryStore.claimNotification as any).mockResolvedValue({ status: 'error' });

      const result = await reconcileMission();

      // In-app state is returned so Reality Check triggers
      expect(result?.status).toBe('running');
      // But no OS notification fires (avoids duplication race)
      expect(notificationManager.sendCatchUpNotificationAsync).not.toHaveBeenCalled();
      // And sentinel is NOT set, so we can retry on next reconcile
      expect(storage.setActiveMission).not.toHaveBeenCalled();
    });
  });
});
