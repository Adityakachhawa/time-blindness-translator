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
import * as localAnalytics from '../lib/analytics/localAnalytics';
import * as pendingActions from '../lib/notifications/pendingActions';
import { ActiveMission } from '../lib/mission/types';

// Mock dependencies
vi.mock('../lib/mission/storage');
vi.mock('../lib/storage');
vi.mock('../lib/notifications/badgeManager');
vi.mock('../lib/notifications/notificationManager');
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

  describe('reconcileMission (Duplicate Prevention)', () => {
    it('sends catch-up notification when expectedEndAt is passed and sentinel is missing', () => {
      vi.setSystemTime(now + 120000); // 2 minutes later, mission is expired
      const result = reconcileMission();
      
      expect(notificationManager.sendCatchUpNotification).toHaveBeenCalledWith(mockMission);
      expect(badgeManager.setAppBadge).toHaveBeenCalledWith(1);
      expect(storage.setActiveMission).toHaveBeenCalledWith(
        expect.objectContaining({ catchUpNotifiedAt: now + 120000 })
      );
    });

    it('does NOT send catch-up notification if sentinel is present (duplicate prevention)', () => {
      vi.setSystemTime(now + 120000);
      mockMission.catchUpNotifiedAt = now + 60000; // already notified
      
      const result = reconcileMission();
      
      expect(notificationManager.sendCatchUpNotification).not.toHaveBeenCalled();
      expect(badgeManager.setAppBadge).not.toHaveBeenCalled();
      expect(storage.setActiveMission).not.toHaveBeenCalled();
    });
  });
});
