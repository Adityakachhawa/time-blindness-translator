import { MILESTONES, type Milestone } from './milestones';

export interface Trophy extends Milestone {
  lucideIcon: string;
}

export interface UnlockedTrophy {
  id: string;
  earnedAt: number;
}

const ICON_MAP: Record<string, string> = {
  'first-task': 'Rocket',
  '10-tasks': 'Medal',
  '50-tasks': 'Crown',
  '100-tasks': 'Award',
  '3-day-streak': 'Flame',
  '7-day-streak': 'Zap',
  '30-day-streak': 'Star',
};

export const TROPHIES: Trophy[] = MILESTONES.map((m) => ({
  ...m,
  lucideIcon: ICON_MAP[m.id] || 'Award',
}));
