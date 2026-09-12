'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useState, useMemo } from 'react';
import { getTaskHistoricalRange } from '@/lib/calibration';

export default function FitCheckModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [taskName, setTaskName] = useState('');
  const [timeAvailableStr, setTimeAvailableStr] = useState('');

  const historicalRange = useMemo(() => {
    return getTaskHistoricalRange(taskName);
  }, [taskName]);

  const output = useMemo(() => {
    const timeAvailable = parseInt(timeAvailableStr, 10);
    if (!historicalRange || isNaN(timeAvailable) || timeAvailable <= 0) {
      return null;
    }

    if (historicalRange.upper <= timeAvailable) {
      return {
        type: 'success',
        message: `Probably. Your typical duration: ${historicalRange.lower}–${historicalRange.upper} min. Available: ${timeAvailable} min.`,
      };
    } else {
      return {
        type: 'warning',
        message: `Probably not. You have ${timeAvailable} min, but your recent range is ${historicalRange.lower}–${historicalRange.upper} min.`,
      };
    }
  }, [historicalRange, timeAvailableStr]);

  // Reset state when opening/closing
  const handleClose = () => {
    setTaskName('');
    setTimeAvailableStr('');
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
                <h2 className="text-2xl font-black" style={{ color: 'var(--fg)' }}>Can I fit this in?</h2>
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
                    placeholder="e.g. Fold laundry..."
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="w-full rounded-2xl px-5 py-4 text-lg font-medium placeholder-shown:italic"
                    style={{
                      background: 'var(--color-cream-300)',
                      border: '2px solid transparent',
                      color: 'var(--fg)',
                      outline: 'none',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--color-coral-400)')}
                    onBlur={e => (e.target.style.borderColor = 'transparent')}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>
                    How much time do you have? (min)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 45"
                    value={timeAvailableStr}
                    onChange={(e) => setTimeAvailableStr(e.target.value)}
                    min={1}
                    className="w-full rounded-2xl px-5 py-4 text-lg font-medium"
                    style={{
                      background: 'var(--color-cream-300)',
                      border: '2px solid transparent',
                      color: 'var(--fg)',
                      outline: 'none',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--color-coral-400)')}
                    onBlur={e => (e.target.style.borderColor = 'transparent')}
                  />
                </div>
              </div>

              <div className="mt-6 min-h-24">
                <AnimatePresence mode="wait">
                  {output ? (
                    <motion.div
                      key="output-result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 rounded-2xl flex items-start gap-3"
                      style={{
                        background: output.type === 'success' 
                          ? 'rgba(125,175,156,0.15)' 
                          : 'rgba(245,166,35,0.15)',
                        border: '1.5px solid',
                        borderColor: output.type === 'success'
                          ? 'rgba(125,175,156,0.4)'
                          : 'rgba(245,166,35,0.4)',
                      }}
                    >
                      {output.type === 'success' ? (
                        <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" style={{ color: 'var(--color-sage-600)' }} />
                      ) : (
                        <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" style={{ color: 'var(--color-amber-600)' }} />
                      )}
                      <p className="font-semibold text-base" style={{ color: 'var(--fg)' }}>
                        {output.message}
                      </p>
                    </motion.div>
                  ) : taskName && !historicalRange && parseInt(timeAvailableStr, 10) > 0 ? (
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
                      <Clock className="w-6 h-6 shrink-0 mt-0.5" style={{ color: 'var(--muted)' }} />
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
