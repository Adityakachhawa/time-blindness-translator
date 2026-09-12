'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarClock, Clock, CheckCircle2, Info } from 'lucide-react';
import { useState, useMemo } from 'react';
import { getTaskHistoricalRange } from '@/lib/calibration';

export default function DeadlineModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [taskName, setTaskName] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');

  const historicalRange = useMemo(() => {
    return getTaskHistoricalRange(taskName);
  }, [taskName]);

  const output = useMemo(() => {
    if (!historicalRange || !deadlineTime) {
      return null;
    }

    // deadlineTime is "HH:MM" in 24hr format
    const now = new Date();
    const [hours, minutes] = deadlineTime.split(':').map(Number);
    const deadlineDate = new Date(now);
    deadlineDate.setHours(hours, minutes, 0, 0);

    // If deadline is earlier today than now, assume it's for tomorrow
    if (deadlineDate < now) {
      deadlineDate.setDate(deadlineDate.getDate() + 1);
    }

    const recommendedStart = new Date(deadlineDate.getTime() - historicalRange.lower * 60000);
    const saferStart = new Date(deadlineDate.getTime() - historicalRange.upper * 60000);

    const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const formatDuration = (mins: number) => {
      if (mins < 60) return `${mins}m`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    const rangeStr = `${formatDuration(historicalRange.lower)}–${formatDuration(historicalRange.upper)}`;

    return {
      rangeStr,
      recommendedStart: formatTime(recommendedStart),
      saferStart: formatTime(saferStart),
      isTight: saferStart < now,
    };
  }, [historicalRange, deadlineTime]);

  const handleClose = () => {
    setTaskName('');
    setDeadlineTime('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
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
                <h2 className="text-2xl font-black" style={{ color: 'var(--fg)' }}>When should I start?</h2>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full hover:bg-black/5 transition-colors"
                >
                  <X className="w-5 h-5" style={{ color: 'var(--muted)' }} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>
                    What do you want to do?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Write report..."
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="w-full rounded-2xl px-5 py-4 text-lg font-medium placeholder-shown:italic"
                    style={{
                      background: 'var(--color-cream-300)',
                      border: '2px solid transparent',
                      color: 'var(--fg)',
                      outline: 'none',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--color-sage-400)')}
                    onBlur={e => (e.target.style.borderColor = 'transparent')}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>
                    I need to finish this by:
                  </label>
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="w-full rounded-2xl px-5 py-4 text-lg font-medium"
                    style={{
                      background: 'var(--color-cream-300)',
                      border: '2px solid transparent',
                      color: 'var(--fg)',
                      outline: 'none',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--color-sage-400)')}
                    onBlur={e => (e.target.style.borderColor = 'transparent')}
                  />
                </div>
              </div>

              <div className="mt-6 min-h-35">
                <AnimatePresence mode="wait">
                  {output ? (
                    <motion.div
                      key="output-result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-5 rounded-2xl flex flex-col gap-3"
                      style={{
                        background: 'rgba(125,175,156,0.1)',
                        border: '1.5px solid rgba(125,175,156,0.3)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-sage-600)' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
                          Based on your history, this task usually takes <strong>{output.rangeStr}</strong>.
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                          <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-sage-500)' }}>Safer start</span>
                          <span className="font-bold text-lg" style={{ color: 'var(--fg)' }}>{output.saferStart}</span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2">
                          <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Recommended start</span>
                          <span className="font-semibold" style={{ color: 'var(--muted)' }}>{output.recommendedStart}</span>
                        </div>
                      </div>
                    </motion.div>
                  ) : taskName && !historicalRange && deadlineTime ? (
                     <motion.div
                      key="output-no-history"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 rounded-2xl flex items-start gap-3"
                      style={{
                        background: 'rgba(0,0,0,0.03)',
                        border: '1.5px dashed var(--card-border)',
                      }}
                    >
                      <CalendarClock className="w-6 h-6 shrink-0 mt-0.5" style={{ color: 'var(--muted)' }} />
                      <p className="font-semibold text-base" style={{ color: 'var(--muted)' }}>
                        No history for this task yet. Try it out and we'll learn your pace!
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
