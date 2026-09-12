import { getTaskHistory } from './storage';

export interface WeeklyReportData {
  totalMissions: number;
  totalTimeTrackedFormatted: string;
  averageUnderestimationPercent: number;
  mostAccurateTask: { name: string; variance: number } | null;
  mostUnderestimatedTask: { name: string; underestimation: number } | null;
  calibrationImprovement: number | null;
}

export function generateWeeklyReport(): WeeklyReportData {
  const history = getTaskHistory();
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - ONE_WEEK;
  const twoWeeksAgo = now - 2 * ONE_WEEK;

  const currentWeekTasks = history.filter(t => t.completedAt >= oneWeekAgo);
  const prevWeekTasks = history.filter(t => t.completedAt >= twoWeeksAgo && t.completedAt < oneWeekAgo);

  const totalMissions = currentWeekTasks.length;
  
  let totalMinutes = 0;
  let totalUnderestimationSum = 0;
  let totalVarianceSum = 0;

  // Track per-task stats for finding most accurate/underestimated
  const taskStats: Record<string, { totalPredicted: number, totalActual: number, count: number }> = {};

  currentWeekTasks.forEach(t => {
    const predictedMin = t.predictedSeconds ? Math.round(t.predictedSeconds / 60) : t.optimisticMin;
    const actualMin = t.actualSeconds ? Math.round(t.actualSeconds / 60) : t.actualMinutes;
    const transitionMin = t.transitionMinutes || 0;
    const coreActualMin = Math.max(0, actualMin - transitionMin);

    totalMinutes += actualMin;

    if (predictedMin > 0) {
      const underestimation = (coreActualMin - predictedMin) / predictedMin;
      const variance = Math.abs(coreActualMin - predictedMin) / predictedMin;
      totalUnderestimationSum += underestimation;
      totalVarianceSum += variance;
    }

    const name = t.taskName.trim();
    if (!taskStats[name]) {
      taskStats[name] = { totalPredicted: 0, totalActual: 0, count: 0 };
    }
    taskStats[name].totalPredicted += predictedMin;
    taskStats[name].totalActual += coreActualMin;
    taskStats[name].count += 1;
  });

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const totalTimeTrackedFormatted = h > 0 ? `${h}h ${m}m` : `${m}m`;

  let averageUnderestimationPercent = 0;
  let currentAvgVariance = 0;
  if (totalMissions > 0) {
    averageUnderestimationPercent = (totalUnderestimationSum / totalMissions) * 100;
    currentAvgVariance = totalVarianceSum / totalMissions;
  }

  // Calculate prev week variance for improvement
  let prevAvgVariance = 0;
  let calibrationImprovement: number | null = null;
  if (prevWeekTasks.length > 0) {
    let prevVarSum = 0;
    prevWeekTasks.forEach(t => {
      const predictedMin = t.predictedSeconds ? Math.round(t.predictedSeconds / 60) : t.optimisticMin;
      const actualMin = t.actualSeconds ? Math.round(t.actualSeconds / 60) : t.actualMinutes;
      const transitionMin = t.transitionMinutes || 0;
      const coreActualMin = Math.max(0, actualMin - transitionMin);
      if (predictedMin > 0) {
        prevVarSum += Math.abs(coreActualMin - predictedMin) / predictedMin;
      }
    });
    prevAvgVariance = prevVarSum / prevWeekTasks.length;
    // Improvement is reduction in variance (e.g. from 50% variance to 20% variance is +30% improvement)
    const diff = prevAvgVariance - currentAvgVariance;
    calibrationImprovement = Math.round(diff * 100);
  }

  let mostAccurateTask = null;
  let mostUnderestimatedTask = null;
  let bestVariance = Infinity;
  let maxUnderestimation = -Infinity;

  for (const [name, stats] of Object.entries(taskStats)) {
    if (stats.totalPredicted > 0) {
      const variance = Math.abs(stats.totalActual - stats.totalPredicted) / stats.totalPredicted;
      const underestimation = (stats.totalActual - stats.totalPredicted) / stats.totalPredicted;

      if (variance < bestVariance) {
        bestVariance = variance;
        mostAccurateTask = { name, variance: Math.round(variance * 100) };
      }
      
      if (underestimation > maxUnderestimation) {
        maxUnderestimation = underestimation;
        mostUnderestimatedTask = { name, underestimation: Math.round(underestimation * 100) };
      }
    }
  }

  // If the most underestimated task was actually overestimated, clear it out.
  if (mostUnderestimatedTask && mostUnderestimatedTask.underestimation <= 0) {
    mostUnderestimatedTask = null;
  }

  return {
    totalMissions,
    totalTimeTrackedFormatted,
    averageUnderestimationPercent: Math.round(averageUnderestimationPercent),
    mostAccurateTask,
    mostUnderestimatedTask,
    calibrationImprovement
  };
}
