'use client';

import { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ChevronUp, ChevronDown, ListChecks, Clock, History } from 'lucide-react';
import { getRecentUniqueTasks } from '@/lib/storage';
import { getTaskHistoricalRange } from '@/lib/calibration';
import { clampTimerMinutes } from '@/lib/duration';
import type { RmdTask, TaskPriority } from '../lib/sequencer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskCaptureStepProps {
  budgetMinutes: number;
  onConfirm: (tasks: RmdTask[]) => void;
  onBack: () => void;
}

interface DraftTask {
  id: string;
  name: string;
  priority: TaskPriority;
  /** User rough estimate (minutes) — used only when no history. */
  estimate: number;
  /** Whether we found history for this task */
  hasHistory: boolean;
  historicalRange?: string;
  historicalMedian?: number;
  overrideHistory?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRange(lower: number, upper: number): string {
  return `Usually ${lower}–${upper} min`;
}

function newDraft(name = ''): DraftTask {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    priority: 'important',
    estimate: 30,
    hasHistory: false,
    overrideHistory: false,
  };
}

// ---------------------------------------------------------------------------
// Sub-component: individual task row
// ---------------------------------------------------------------------------

interface TaskRowProps {
  draft: DraftTask;
  index: number;
  total: number;
  onChange: (updated: DraftTask) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function TaskRow({ draft, index, total, onChange, onRemove, onMoveUp, onMoveDown }: TaskRowProps) {
  const nameId = useId();
  const estimateId = useId();

  function handleNameBlur(name: string) {
    if (!name.trim()) return;
    // Look up history
    const range = getTaskHistoricalRange(name.trim());
    if (range) {
      onChange({
        ...draft,
        name: name.trim(),
        hasHistory: true,
        historicalRange: formatRange(range.lower, range.upper),
        historicalMedian: range.median,
        overrideHistory: false,
      });
    } else {
      onChange({ ...draft, name: name.trim(), hasHistory: false, historicalRange: undefined, historicalMedian: undefined, overrideHistory: false });
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22 }}
      className="glass-card rounded-2xl p-4"
      style={{ border: '1px solid var(--card-border)' }}
    >
      {/* Row header */}
      <div className="flex items-start gap-3">
        {/* Order controls */}
        <div className="flex flex-col gap-0.5 mt-0.5 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Move task up"
            className="w-7 h-7 rounded-lg flex items-center justify-center outline-none transition-opacity"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--card-border)',
              opacity: index === 0 ? 0.3 : 1,
            }}
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Move task down"
            className="w-7 h-7 rounded-lg flex items-center justify-center outline-none transition-opacity"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--card-border)',
              opacity: index === total - 1 ? 0.3 : 1,
            }}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Task name */}
        <div className="flex-1 min-w-0">
          <label
            htmlFor={nameId}
            className="block text-xs font-bold uppercase tracking-wider mb-1"
            style={{ color: 'var(--muted)' }}
          >
            Task {index + 1}
          </label>
          <input
            id={nameId}
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            onBlur={(e) => handleNameBlur(e.target.value)}
            placeholder="What needs to happen?"
            className="w-full rounded-xl px-3 py-2 text-sm font-semibold outline-none"
            style={{
              background: 'transparent',
              border: '1.5px solid var(--card-border)',
              color: 'var(--fg)',
              minHeight: 40,
            }}
            aria-label={`Task name ${index + 1}`}
          />
        </div>

        {/* Remove button */}
        <button
          onClick={onRemove}
          aria-label="Remove task"
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center outline-none transition-colors"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--card-border)',
            color: 'var(--color-coral-500)',
            marginTop: 20,
          }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Priority + Estimate */}
      <div className="flex flex-wrap gap-3 mt-3">
        {/* Priority */}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: '1.5px solid var(--card-border)' }}
          role="group"
          aria-label="Task priority"
        >
          {(['important', 'optional'] as TaskPriority[]).map((p) => {
            const active = draft.priority === p;
            return (
              <button
                key={p}
                onClick={() => onChange({ ...draft, priority: p })}
                aria-pressed={active}
                className="px-3 py-1.5 text-xs font-bold capitalize transition-all outline-none"
                style={{
                  background: active
                    ? p === 'important'
                      ? 'var(--color-coral-500)'
                      : 'var(--color-lavender-500)'
                    : 'transparent',
                  color: active ? 'white' : 'var(--muted)',
                  minHeight: 36,
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Duration — show history range or manual estimate */}
        <div className="flex items-center gap-2">
          {draft.hasHistory && !draft.overrideHistory ? (
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{
                  background: 'var(--color-sage-500)' + '22',
                  border: '1.5px solid var(--color-sage-500)',
                  color: 'var(--color-sage-600)',
                }}
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                <span>{draft.historicalRange}</span>
              </div>
              <button
                onClick={() => onChange({ ...draft, overrideHistory: true, estimate: draft.historicalMedian || 30 })}
                className="text-xs font-semibold underline transition-opacity hover:opacity-80 outline-none"
                style={{ color: 'var(--muted)' }}
              >
                Use a different estimate
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label
                htmlFor={estimateId}
                className="text-xs font-bold"
                style={{ color: 'var(--muted)' }}
              >
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                {draft.overrideHistory ? 'Your estimate' : '~'}
              </label>
              <input
                id={estimateId}
                type="number"
                min={1}
                max={300}
                step={1}
                value={draft.estimate}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) onChange({ ...draft, estimate: v });
                }}
                className="rounded-xl px-2 py-1.5 text-sm font-bold text-center outline-none"
                style={{
                  background: 'var(--card)',
                  border: '1.5px solid var(--card-border)',
                  color: 'var(--fg)',
                  width: 64,
                  minHeight: 36,
                }}
                aria-label={`Estimate minutes for task ${index + 1}`}
              />
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                min
              </span>
              {draft.overrideHistory && (
                <span className="text-xs opacity-60 ml-2" style={{ color: 'var(--muted)' }}>
                  (History: {draft.historicalRange})
                </span>
              )}
            </div>
          )}
        </div>
        {/* Validation Error */}
        {draft.estimate > 300 && (
          <div className="w-full mt-2 text-xs font-semibold" style={{ color: 'var(--color-coral-500)' }}>
            That task is longer than one timer can hold. Split it into smaller tasks.
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TaskCaptureStep({
  budgetMinutes,
  onConfirm,
  onBack,
}: TaskCaptureStepProps) {
  const [drafts, setDrafts] = useState<DraftTask[]>([newDraft()]);
  const [recentSuggestions, setRecentSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const recent = getRecentUniqueTasks(5);
    setRecentSuggestions(recent.map((r) => r.taskName));
  }, []);

  function addTask(name = '') {
    setDrafts((prev) => [...prev, newDraft(name)]);
  }

  function removeTask(id: string) {
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      return next.length === 0 ? [newDraft()] : next;
    });
  }

  function updateTask(id: string, updated: DraftTask) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }

  function moveTask(id: string, direction: 'up' | 'down') {
    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function handleConfirm() {
    const valid = drafts.filter((d) => d.name.trim().length > 0);
    if (valid.length === 0) return;
    if (valid.some(d => d.estimate > 300)) return;

    const rmdTasks: RmdTask[] = valid.map((d, i) => {
      const estimatedMinutes = d.hasHistory
        ? Math.round(d.historicalMedian ?? d.estimate)
        : d.estimate;
      return {
        id: d.id,
        name: d.name,
        priority: d.priority,
        estimatedMinutes,
        hasHistory: d.hasHistory,
        historicalRange: d.historicalRange,
        userOrder: i,
      };
    });

    onConfirm(rmdTasks);
  }

  const validCount = drafts.filter((d) => d.name.trim().length > 0).length;
  const hasError = drafts.some((d) => d.estimate > 300);
  const isSubmitDisabled = validCount === 0 || hasError;

  const budgetLabel =
    budgetMinutes >= 60
      ? `${Math.floor(budgetMinutes / 60)}h ${budgetMinutes % 60 > 0 ? `${budgetMinutes % 60}m` : ''}`.trim()
      : `${budgetMinutes}m`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Step header */}
      <div className="mb-6">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
          style={{
            background: 'var(--color-coral-500)',
            color: 'white',
          }}
        >
          <ListChecks className="w-3.5 h-3.5" />
          Step 2 of 2
        </div>
        <h2
          className="text-2xl md:text-3xl font-bold mb-2"
          style={{ color: 'var(--fg)' }}
        >
          What still needs to happen?
        </h2>
        <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
          Budget: <strong style={{ color: 'var(--fg)' }}>{budgetLabel}</strong>. Add tasks, mark what's important, and set an order.
        </p>
      </div>

      {/* Recent suggestions */}
      {recentSuggestions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
            Recent tasks
          </p>
          <div className="flex flex-wrap gap-2">
            {recentSuggestions.map((name) => (
              <button
                key={name}
                onClick={() => addTask(name)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold outline-none transition-colors"
                style={{
                  background: 'var(--card)',
                  border: '1.5px solid var(--card-border)',
                  color: 'var(--muted)',
                  minHeight: 36,
                }}
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {drafts.map((draft, i) => (
            <TaskRow
              key={draft.id}
              draft={draft}
              index={i}
              total={drafts.length}
              onChange={(u) => updateTask(draft.id, u)}
              onRemove={() => removeTask(draft.id)}
              onMoveUp={() => moveTask(draft.id, 'up')}
              onMoveDown={() => moveTask(draft.id, 'down')}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Add task button */}
      <button
        id="add-task-btn"
        onClick={() => addTask()}
        className="w-full mt-3 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm outline-none transition-all"
        style={{
          minHeight: 48,
          background: 'var(--card)',
          border: '2px dashed var(--card-border)',
          color: 'var(--muted)',
        }}
      >
        <Plus className="w-4 h-4" />
        Add another task
      </button>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 rounded-2xl font-bold text-sm outline-none"
          style={{
            minHeight: 52,
            background: 'var(--card)',
            border: '2px solid var(--card-border)',
            color: 'var(--muted)',
          }}
        >
          ← Back
        </button>
        <button
          id="build-plan-btn"
          onClick={handleConfirm}
          disabled={isSubmitDisabled}
          className="flex-1 rounded-2xl font-bold text-base outline-none transition-all"
          style={{
            minHeight: 52,
            background: !isSubmitDisabled ? 'var(--color-coral-500)' : 'var(--card)',
            color: !isSubmitDisabled ? 'white' : 'var(--muted)',
            border: !isSubmitDisabled ? '2px solid transparent' : '2px solid var(--card-border)',
            cursor: !isSubmitDisabled ? 'pointer' : 'not-allowed',
            opacity: !isSubmitDisabled ? 1 : 0.6,
          }}
          aria-disabled={isSubmitDisabled}
        >
          Build my plan →
        </button>
      </div>
    </motion.div>
  );
}
