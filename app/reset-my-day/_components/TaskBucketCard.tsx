'use client';

import { motion } from 'framer-motion';
import { History, Clock } from 'lucide-react';
import type { SequencedTask, BucketKey } from '../lib/sequencer';
import StartMeInline from './StartMeInline';

// ---------------------------------------------------------------------------
// Bucket metadata
// ---------------------------------------------------------------------------

const BUCKET_META: Record<
  BucketKey,
  {
    label: string;
    description: string;
    color: string;
    badgeBg: string;
    badgeColor: string;
    showStartMe: boolean;
  }
> = {
  DO_NOW: {
    label: 'Do Now',
    description: 'Start here.',
    color: 'var(--color-coral-500)',
    badgeBg: 'var(--color-coral-500)',
    badgeColor: 'white',
    showStartMe: true,
  },
  THEN: {
    label: 'Then',
    description: 'Next in line.',
    color: 'var(--color-amber-500)',
    badgeBg: 'var(--color-amber-500)' + '22',
    badgeColor: 'var(--color-amber-600)',
    showStartMe: true,
  },
  OPTIONAL: {
    label: 'Optional',
    description: 'If time allows.',
    color: 'var(--color-lavender-500)',
    badgeBg: 'var(--color-lavender-500)' + '22',
    badgeColor: 'var(--color-lavender-600)',
    showStartMe: false,
  },
  SKIP: {
    label: 'Skip for Today',
    description: "Doesn't realistically fit.",
    color: 'var(--color-ink-500)',
    badgeBg: 'var(--card)',
    badgeColor: 'var(--muted)',
    showStartMe: false,
  },
};

// ---------------------------------------------------------------------------
// Sub-component: task item inside the card
// ---------------------------------------------------------------------------

function TaskItem({
  task,
  showStartMe,
}: {
  task: SequencedTask;
  showStartMe: boolean;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--card-border)',
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="font-bold text-sm leading-snug"
            style={{ color: 'var(--fg)' }}
          >
            {task.name}
          </p>
          {/* Duration / history */}
          <div
            className="flex items-center gap-1.5 mt-1"
            style={{ color: 'var(--muted)' }}
          >
            {task.hasHistory ? (
              <>
                <History className="w-3 h-3 shrink-0" />
                <span className="text-xs font-semibold">
                  {task.historicalRange}
                </span>
                <span className="text-xs opacity-60">· based on your history</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 shrink-0" />
                <span className="text-xs font-semibold">
                  ~{task.estimatedMinutes} min
                </span>
                <span className="text-xs opacity-60">· your estimate</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Start Me — only for DO_NOW / THEN */}
      {showStartMe && <StartMeInline task={task} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component: TaskBucketCard
// ---------------------------------------------------------------------------

interface TaskBucketCardProps {
  bucket: BucketKey;
  tasks: SequencedTask[];
  /** Stagger delay index for entrance animation */
  animDelay?: number;
}

export default function TaskBucketCard({
  bucket,
  tasks,
  animDelay = 0,
}: TaskBucketCardProps) {
  const meta = BUCKET_META[bucket];

  if (tasks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: animDelay }}
      className="glass-card rounded-3xl p-5"
      style={{
        borderLeft: `4px solid ${meta.color}`,
        border: `1px solid var(--card-border)`,
        borderLeftWidth: 4,
        borderLeftColor: meta.color,
      }}
    >
      {/* Bucket header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest"
          style={{ background: meta.badgeBg, color: meta.badgeColor }}
        >
          {meta.label}
        </div>
        <span
          className="text-xs font-semibold"
          style={{ color: 'var(--muted)' }}
        >
          {meta.description}
        </span>
      </div>

      {/* Tasks */}
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            showStartMe={meta.showStartMe}
          />
        ))}
      </div>
    </motion.div>
  );
}
