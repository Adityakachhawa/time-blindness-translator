import { getTaskHistory } from './storage';
import type { TaskCategory } from '../types/timer';

export interface CalibrationResult {
  factor: number;
  sampleCount: number;
  tier: 'exact' | 'category' | 'global';
}

function calculateMedianRatio(sessions: any[]): number | null {
  const ratios: number[] = [];
  for (const session of sessions) {
    const predicted = session.predictedSeconds 
      ? session.predictedSeconds 
      : (session.optimisticMin ? session.optimisticMin * 60 : 0);
      
    const actualTotal = session.actualSeconds 
      ? session.actualSeconds 
      : (session.actualMinutes ? session.actualMinutes * 60 : 0);

    const transition = session.transitionMinutes ? session.transitionMinutes * 60 : 0;
    const actual = Math.max(0, actualTotal - transition);

    if (predicted > 0 && actual > 0) {
      ratios.push(actual / predicted);
    }
  }

  if (ratios.length === 0) return null;

  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  let median = ratios.length % 2 !== 0 
    ? ratios[mid] 
    : (ratios[mid - 1] + ratios[mid]) / 2;

  return Math.max(1.0, Math.min(median, 5.0));
}

export function calculatePersonalFactor(taskName: string, category: TaskCategory = 'other'): CalibrationResult | null {
  if (!taskName.trim()) return null;
  
  const history = getTaskHistory();
  const searchName = taskName.toLowerCase().trim();
  
  // Priority 1: Exact match
  const exactSessions = history.filter(
    (record) => record.taskName.toLowerCase().trim() === searchName
  );

  if (exactSessions.length >= 2) {
    const factor = calculateMedianRatio(exactSessions);
    if (factor !== null) {
      return { factor, sampleCount: exactSessions.length, tier: 'exact' };
    }
  }

  // Priority 2: Category match
  if (category && category !== 'other') {
    const categorySessions = history.filter(
      (record) => record.category === category
    );

    if (categorySessions.length >= 3) {
      const factor = calculateMedianRatio(categorySessions);
      if (factor !== null) {
        return { factor, sampleCount: categorySessions.length, tier: 'category' };
      }
    }
  }
  
  // Priority 3: Global fallback
  if (history.length >= 5) {
    const factor = calculateMedianRatio(history);
    if (factor !== null) {
      return { factor, sampleCount: history.length, tier: 'global' };
    }
  }

  return null;
}

export function formatConfidenceRange(minutes: number): string {
  // Round to nearest 5 for clean UI
  const rounded = Math.round(minutes / 5) * 5;
  const lower = Math.max(5, rounded - 5);
  const upper = rounded + 5;
  return `${lower}–${upper} min`;
}

export interface TaskRange {
  lower: number;
  upper: number;
  median: number;
}

export function getTaskHistoricalRange(taskName: string): TaskRange | null {
  if (!taskName.trim()) return null;
  const history = getTaskHistory();
  const searchName = taskName.toLowerCase().trim();
  
  const relevantSessions = history.filter(
    (record) => record.taskName.toLowerCase().trim() === searchName
  );

  if (relevantSessions.length === 0) return null;

  const actualTimes = relevantSessions.map(session => {
     const actualTotalSeconds = session.actualSeconds 
      ? session.actualSeconds 
      : (session.actualMinutes ? session.actualMinutes * 60 : 0);
     return actualTotalSeconds / 60;
  }).filter(t => t > 0);

  if (actualTimes.length === 0) return null;

  actualTimes.sort((a, b) => a - b);
  const mid = Math.floor(actualTimes.length / 2);
  const median = actualTimes.length % 2 !== 0 
    ? actualTimes[mid] 
    : (actualTimes[mid - 1] + actualTimes[mid]) / 2;

  // Create a 10-minute spread around the median (rounded to nearest 5)
  const rounded = Math.round(median / 5) * 5;
  const lower = Math.max(1, rounded - 5); // Don't go below 1 min
  const upper = rounded + 5;

  return { lower, upper, median };
}

