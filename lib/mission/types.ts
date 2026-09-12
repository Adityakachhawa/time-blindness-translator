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
}
