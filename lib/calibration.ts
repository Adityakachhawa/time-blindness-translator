import { getTaskHistory } from './storage';

export function calculatePersonalFactor(taskName: string): number | null {
  if (!taskName.trim()) return null;
  
  const history = getTaskHistory();
  const searchName = taskName.toLowerCase().trim();
  
  const relevantSessions = history.filter(
    (record) => record.taskName.toLowerCase().trim() === searchName
  );

  if (relevantSessions.length < 2) return null;

  const ratios: number[] = [];
  for (const session of relevantSessions) {
    // Determine predicted time
    const predicted = session.predictedSeconds 
      ? session.predictedSeconds 
      : (session.optimisticMin ? session.optimisticMin * 60 : 0);
      
    // Determine actual time
    const actualTotal = session.actualSeconds 
      ? session.actualSeconds 
      : (session.actualMinutes ? session.actualMinutes * 60 : 0);

    // Subtract transition time to get core task time
    const transition = session.transitionMinutes ? session.transitionMinutes * 60 : 0;
    const actual = Math.max(0, actualTotal - transition);

    if (predicted > 0 && actual > 0) {
      ratios.push(actual / predicted);
    }
  }

  if (ratios.length < 2) return null;

  // Calculate median
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  let median = ratios.length % 2 !== 0 
    ? ratios[mid] 
    : (ratios[mid - 1] + ratios[mid]) / 2;

  // Clamp factor to reasonable bounds (e.g., 1.0 to 5.0)
  median = Math.max(1.0, Math.min(median, 5.0));
  
  return median;
}

export function formatConfidenceRange(minutes: number): string {
  // Round to nearest 5 for clean UI
  const rounded = Math.round(minutes / 5) * 5;
  const lower = Math.max(5, rounded - 5);
  const upper = rounded + 5;
  return `Likely: ${lower}–${upper} min`;
}
