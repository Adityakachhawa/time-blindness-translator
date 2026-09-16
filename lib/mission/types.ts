import { TaskCategory } from '@/types/timer';

export type MissionStatus =
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface ActiveMission {
  id: string;
  taskName: string;
  category?: TaskCategory;
  startedAt: number;
  plannedDurationMs: number;
  expectedEndAt: number;
  status: MissionStatus;

  /**
   * Immutable snapshot of the initial calibrated duration (ms) set at startMission.
   * Equals plannedDurationMs at creation and is NEVER overwritten by extensions,
   * recalculations, or pauses. Used as the calibration denominator in SuccessScreen.
   */
  initialCalibratedMs: number;

  /**
   * Immutable snapshot of the original expected end timestamp (ms) set at startMission.
   * Equals startedAt + plannedDurationMs at creation and is NEVER overwritten.
   * Used for overtime detection against the original deadline.
   */
  initialExpectedEndAt: number;

  pausedAt?: number;
  totalPausedMs?: number;

  actualCompletedAt?: number;
  calibratedDurationMs?: number;
  originalEstimateMs?: number;
  
  reminderPolicy?: 'important' | 'minimal' | 'off';
  createdAt: number;
  updatedAt: number;
  
  // Attributes needed to map back to the legacy TaskRecord history
  optimisticMin: number;
  taxMultiplier: number;
  allocatedMin: number;
  transitionMinutes?: number;

  notificationMessageId?: string;

  /**
   * Monotonically increasing counter incremented every time mission timing
   * changes (extension, resume-after-pause). Carried in the QStash body so
   * the deliver route can reject any payload whose version no longer matches
   * the stored metadata — handles out-of-order delivery and duplicates
   * independently of timestamp drift.
   */
  notificationVersion: number;

  /**
   * Timestamp (ms) when a local catch-up notification was dispatched for this
   * mission after it expired while the app was backgrounded. Acts as a one-shot
   * sentinel so reconcileMission never fires sendCatchUpNotification twice.
   */
  catchUpNotifiedAt?: number;
}
