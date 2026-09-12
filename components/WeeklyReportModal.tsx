'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Target, Clock, Activity, Award } from 'lucide-react';
import { useEffect, useState } from 'react';
import { generateWeeklyReport, type WeeklyReportData } from '@/lib/analytics';

export default function WeeklyReportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<WeeklyReportData | null>(null);

  useEffect(() => {
    if (isOpen) {
      setData(generateWeeklyReport());
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--card-border)',
            }}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black" style={{ color: 'var(--fg)' }}>Your Week in Time</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-black/5 transition-colors"
                >
                  <X className="w-5 h-5" style={{ color: 'var(--muted)' }} />
                </button>
              </div>

              {/* Top Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl p-4" style={{ background: 'var(--color-cream-300)' }}>
                  <Clock className="w-6 h-6 mb-2" style={{ color: 'var(--color-coral-500)' }} />
                  <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Time Tracked</p>
                  <p className="text-2xl font-black" style={{ color: 'var(--fg)' }}>{data.totalTimeTrackedFormatted}</p>
                </div>
                <div className="rounded-2xl p-4" style={{ background: 'var(--color-cream-300)' }}>
                  <Activity className="w-6 h-6 mb-2" style={{ color: 'var(--color-coral-500)' }} />
                  <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Missions</p>
                  <p className="text-2xl font-black" style={{ color: 'var(--fg)' }}>{data.totalMissions}</p>
                </div>
              </div>

              {/* Calibration */}
              <div className="rounded-2xl p-5 mb-6" style={{ background: 'linear-gradient(135deg, rgba(125,175,156,0.15), rgba(125,175,156,0.05))', border: '1.5px solid rgba(125,175,156,0.3)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-6 h-6" style={{ color: 'var(--color-sage-600)' }} />
                  <h3 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Time Calibration</h3>
                </div>
                
                {data.calibrationImprovement !== null ? (
                  <p className="text-base mb-3" style={{ color: 'var(--fg)' }}>
                    {data.calibrationImprovement > 0 ? (
                      <>
                        <span className="font-bold text-green-600 flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          Improved {data.calibrationImprovement}%
                        </span>
                        {' '}this week! Your predictions are getting more accurate.
                      </>
                    ) : data.calibrationImprovement < 0 ? (
                      <>
                        <span className="font-bold text-amber-600 flex items-center gap-1">
                          <TrendingDown className="w-4 h-4" />
                          Dipped {Math.abs(data.calibrationImprovement)}%
                        </span>
                        {' '}this week. The ADHD tax was heavy!
                      </>
                    ) : (
                      "Your accuracy held steady compared to last week."
                    )}
                  </p>
                ) : (
                  <p className="text-base mb-3" style={{ color: 'var(--fg)' }}>
                    {data.averageUnderestimationPercent > 0
                      ? `You underestimated tasks by ${data.averageUnderestimationPercent}% on average.`
                      : `You overestimated tasks by ${Math.abs(data.averageUnderestimationPercent)}% on average.`}
                  </p>
                )}
              </div>

              {/* Highlights */}
              {(data.mostAccurateTask || data.mostUnderestimatedTask) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Task Highlights</h3>
                  
                  {data.mostAccurateTask && (
                    <div className="flex items-center justify-between p-3 rounded-xl" style={{ border: '1px solid var(--card-border)' }}>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-sage-500)' }}>Most Accurate</p>
                        <p className="font-bold" style={{ color: 'var(--fg)' }}>{data.mostAccurateTask.name}</p>
                      </div>
                      <div className="text-right">
                        <Award className="w-5 h-5 mx-auto" style={{ color: 'var(--color-sage-500)' }} />
                        <span className="text-xs font-medium opacity-70">Within {data.mostAccurateTask.variance}%</span>
                      </div>
                    </div>
                  )}

                  {data.mostUnderestimatedTask && (
                    <div className="flex items-center justify-between p-3 rounded-xl" style={{ border: '1px solid var(--card-border)' }}>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-coral-500)' }}>Needs More Tax</p>
                        <p className="font-bold" style={{ color: 'var(--fg)' }}>{data.mostUnderestimatedTask.name}</p>
                      </div>
                      <div className="text-right">
                        <TrendingDown className="w-5 h-5 mx-auto" style={{ color: 'var(--color-coral-500)' }} />
                        <span className="text-xs font-medium opacity-70">Under by {data.mostUnderestimatedTask.underestimation}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full mt-6 py-4 rounded-xl font-bold text-white transition-transform hover:scale-[1.02] active:scale-95"
                style={{ background: 'var(--color-coral-500)' }}
              >
                Close Report
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
