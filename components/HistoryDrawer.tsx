'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, Clock, Heart } from 'lucide-react';
import { getTaskHistory, getTodayCount, relativeTime, type TaskRecord } from '@/lib/storage';
import CompletionHeatmap from '@/components/CompletionHeatmap';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HistoryDrawerProps {
  open:    boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
      <span className="text-5xl">🌱</span>
      <p className="font-semibold text-lg" style={{ color: '#334155' }}>
        No completed tasks yet
      </p>
      <p className="text-sm" style={{ color: '#64748b' }}>
        Finish your first mission and it'll show up here. You've got this.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single task row
// ---------------------------------------------------------------------------

function TaskRow({ record, index }: { record: TaskRecord; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="flex items-start gap-3 py-3 border-b"
      style={{ borderColor: 'rgba(0,0,0,0.06)' }}
    >
      <CheckCircle2
        className="w-5 h-5 mt-0.5 shrink-0"
        style={{ color: 'var(--color-sage-500)' }}
        strokeWidth={2}
      />
      <div className="flex-1 min-w-0">
        <p
          className="font-semibold text-sm leading-snug truncate"
          style={{ color: '#1e293b' }}
        >
          {record.taskName}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
          {record.actualMinutes} min · {relativeTime(record.completedAt)}
        </p>
        {record.tagline && (
          <p
            className="text-xs italic mt-1 opacity-75"
            style={{ color: '#475569' }}
          >
            "{record.tagline}"
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main drawer component
// ---------------------------------------------------------------------------

export default function HistoryDrawer({ open, onClose }: HistoryDrawerProps) {
  const [history,    setHistory]    = useState<TaskRecord[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Refresh data whenever drawer opens
  useEffect(() => {
    if (open) {
      setHistory(getTaskHistory());
      setTodayCount(getTodayCount());
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)' }}
            onClick={onClose}
            aria-hidden
          />

          {/* Drawer panel — slides in from the right */}
          <motion.div
            key="drawer"
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 h-full z-40 flex flex-col"
            style={{
              width: 'min(360px, 92vw)',
              background: 'linear-gradient(160deg, #fdf9f3 0%, #fdf6ec 100%)',
              boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
            }}
            role="dialog"
            aria-label="Task history"
            aria-modal="true"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" style={{ color: 'var(--color-coral-500)' }} strokeWidth={2} />
                <h2 className="font-bold text-base" style={{ color: '#1e293b' }}>
                  Mission History
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-1.5 transition-colors"
                style={{ color: '#64748b' }}
                aria-label="Close history drawer"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {/* Streak / today summary */}
            {todayCount > 0 && (
              <div
                className="mx-4 mt-4 rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(242,129,90,0.12), rgba(245,166,35,0.08))',
                  border: '1.5px solid rgba(242,129,90,0.3)',
                }}
              >
                <span className="text-2xl">🔥</span>
                <div>
                  <p className="font-bold text-sm" style={{ color: '#1e293b' }}>
                    {todayCount} {todayCount === 1 ? 'task' : 'tasks'} crushed today
                  </p>
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    Your brain showed up. That counts.
                  </p>
                </div>
              </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-3">

              {/* ── Completion heatmap ─────────────────────────────────── */}
              <div style={{ marginBottom: 20 }}>
                <p
                  className="text-xs uppercase tracking-widest font-semibold mb-3"
                  style={{ color: '#94a3b8' }}
                >
                  Activity
                </p>
                <CompletionHeatmap />
              </div>

              {/* ── Recent task list ───────────────────────────────────── */}
              {history.length === 0 ? (
                <EmptyState />
              ) : (
                <div>
                  <p
                    className="text-xs uppercase tracking-widest font-semibold mb-3"
                    style={{ color: '#94a3b8' }}
                  >
                    Recent completions
                  </p>
                  {history.map((record, i) => (
                    <TaskRow key={record.id} record={record} index={i} />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 border-t text-center"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <p className="text-xs" style={{ color: '#94a3b8' }}>
                Stored locally · never leaves your device · <Heart className="inline w-3 h-3 mb-0.5 mx-0.5 fill-current" style={{ color: 'var(--color-coral-500)' }} />
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
