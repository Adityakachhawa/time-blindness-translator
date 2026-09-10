export type MilestoneType = 'streak' | 'lifetime-tasks';

export interface Milestone {
  id: string;
  type: MilestoneType;
  threshold: number;
  label: string;
  tagline: string;
}

export const MILESTONES: Milestone[] = [
  // Lifetime Tasks
  {
    id: 'first-task',
    type: 'lifetime-tasks',
    threshold: 1,
    label: 'First Step',
    tagline: 'The longest journey begins with a single, heavily procrastinated step.',
  },
  {
    id: '10-tasks',
    type: 'lifetime-tasks',
    threshold: 10,
    label: '10 Missions',
    tagline: 'Ten times you fought the friction. Ten times you won.',
  },
  {
    id: '50-tasks',
    type: 'lifetime-tasks',
    threshold: 50,
    label: '50 Missions',
    tagline: 'Fifty completions. That’s not a fluke, that’s a habit.',
  },
  {
    id: '100-tasks',
    type: 'lifetime-tasks',
    threshold: 100,
    label: '100 Missions',
    tagline: 'One hundred victories. Your executive function is taking notes.',
  },

  // Streaks
  {
    id: '3-day-streak',
    type: 'streak',
    threshold: 3,
    label: '3-Day Streak',
    tagline: 'Three days in a row! We have officially formed a pattern.',
  },
  {
    id: '7-day-streak',
    type: 'streak',
    threshold: 7,
    label: '7-Day Streak',
    tagline: 'A whole week of showing up. Give your brain a high five.',
  },
  {
    id: '30-day-streak',
    type: 'streak',
    threshold: 30,
    label: '30-Day Streak',
    tagline: 'Thirty unbroken days. The legends were true.',
  },
];
