'use client';

import { motion } from 'framer-motion';
import { RotateCcw, CheckCircle } from 'lucide-react';
import type { RecoveryPlan } from '../lib/sequencer';
import TaskBucketCard from './TaskBucketCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecoveryPlanViewProps {
  plan: RecoveryPlan;
  onReset: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecoveryPlanView({ plan, onReset }: RecoveryPlanViewProps) {
  const { doNow, then, optional, skip, committedMinutes, budgetMinutes } = plan;

  const remainingMinutes = budgetMinutes - committedMinutes;
  const hasAnyWork = doNow.length > 0 || then.length > 0;

  const budgetLabel = (m: number) => {
    if (m <= 0) return '0 min';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
          <div>
            <h2
              className="text-2xl md:text-3xl font-bold"
              style={{ color: 'var(--fg)' }}
            >
              Your recovery plan
            </h2>
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--muted)' }}>
              Based on {budgetLabel(budgetMinutes)} available.
            </p>
          </div>
          <button
            id="rmd-reset-plan"
            onClick={onReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold outline-none transition-colors"
            style={{
              background: 'var(--card)',
              border: '1.5px solid var(--card-border)',
              color: 'var(--muted)',
              minHeight: 40,
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Start over
          </button>
        </div>

        {/* Budget summary bar */}
        {hasAnyWork && (
          <div
            className="glass-card rounded-2xl px-4 py-3 flex items-center gap-4 flex-wrap"
          >
            <div className="flex items-center gap-2">
              <CheckCircle
                className="w-4 h-4"
                style={{ color: 'var(--color-sage-500)' }}
              />
              <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                {budgetLabel(committedMinutes)} committed
              </span>
            </div>
            {remainingMinutes > 0 && (
              <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                {budgetLabel(remainingMinutes)} breathing room
              </span>
            )}
          </div>
        )}
      </div>

      {/* No-task edge case */}
      {!hasAnyWork && skip.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-6 mb-4 text-center"
        >
          <p
            className="text-base font-semibold mb-1"
            style={{ color: 'var(--fg)' }}
          >
            None of these tasks fit in {budgetLabel(budgetMinutes)}.
          </p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Either your budget is very small, or the tasks need breaking down.
          </p>
        </motion.div>
      )}

      {/* Buckets */}
      <div className="flex flex-col gap-4">
        <TaskBucketCard bucket="DO_NOW" tasks={doNow} animDelay={0.05} />
        <TaskBucketCard bucket="THEN" tasks={then} animDelay={0.1} />
        <TaskBucketCard bucket="OPTIONAL" tasks={optional} animDelay={0.15} />
        <TaskBucketCard bucket="SKIP" tasks={skip} animDelay={0.2} />
      </div>

      {/* Footer nudge */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs text-center mt-6 font-medium"
        style={{ color: 'var(--muted)' }}
      >
        Tap "Stuck? Start Me" on any task to get an immediate first step.
      </motion.p>
    </motion.div>
  );
}
