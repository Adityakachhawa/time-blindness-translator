'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeBudget = {
  minutes: number;
};

interface TimeBudgetStepProps {
  onConfirm: (budget: TimeBudget) => void;
}

// ---------------------------------------------------------------------------
// Quick-pick options
// ---------------------------------------------------------------------------

const QUICK_PICKS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimeBudgetStep({ onConfirm }: TimeBudgetStepProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customHours, setCustomHours] = useState(1);
  const [customMinutes, setCustomMinutes] = useState(0);

  const customTotal = customHours * 60 + customMinutes;

  function handleQuickPick(minutes: number) {
    setSelected(minutes);
    setShowCustom(false);
  }

  function handleCustomToggle() {
    setShowCustom((prev) => !prev);
    setSelected(null);
  }

  function handleConfirm() {
    const minutes = showCustom ? customTotal : selected;
    if (minutes && minutes > 0) {
      onConfirm({ minutes });
    }
  }

  const canConfirm = showCustom ? customTotal > 0 : selected !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Step header */}
      <div className="mb-8">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
          style={{
            background: 'var(--color-sage-500)',
            color: 'white',
          }}
        >
          <Clock className="w-3.5 h-3.5" />
          Step 1 of 2
        </div>
        <h2
          className="text-2xl md:text-3xl font-bold mb-2"
          style={{ color: 'var(--fg)' }}
        >
          How much usable time do you have?
        </h2>
        <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
          Be honest — not what you wish, what's actually left.
        </p>
      </div>

      {/* Quick-pick buttons */}
      <div
        className="grid gap-3 mb-3"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
        role="group"
        aria-label="Time budget quick pick"
      >
        {QUICK_PICKS.map((pick) => {
          const isSelected = selected === pick.minutes && !showCustom;
          return (
            <button
              key={pick.minutes}
              id={`budget-${pick.minutes}`}
              onClick={() => handleQuickPick(pick.minutes)}
              aria-pressed={isSelected}
              className="flex flex-col items-center justify-center rounded-2xl font-bold transition-all outline-none"
              style={{
                minHeight: 72,
                padding: '12px 8px',
                background: isSelected
                  ? 'var(--color-sage-500)'
                  : 'var(--card)',
                border: isSelected
                  ? '2px solid var(--color-sage-500)'
                  : '2px solid var(--card-border)',
                color: isSelected ? 'white' : 'var(--fg)',
                transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                boxShadow: isSelected
                  ? '0 4px 16px rgba(125,175,156,0.35)'
                  : undefined,
              }}
            >
              <span className="text-lg">{pick.label}</span>
            </button>
          );
        })}
      </div>

      {/* Custom toggle */}
      <button
        id="budget-custom-toggle"
        onClick={handleCustomToggle}
        aria-expanded={showCustom}
        className="w-full flex items-center justify-between rounded-2xl font-semibold text-sm transition-all outline-none"
        style={{
          minHeight: 52,
          padding: '12px 20px',
          background: showCustom ? 'var(--card)' : 'var(--card)',
          border: showCustom
            ? '2px solid var(--color-coral-500)'
            : '2px solid var(--card-border)',
          color: showCustom ? 'var(--color-coral-500)' : 'var(--muted)',
        }}
      >
        <span>Custom amount</span>
        {showCustom ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Custom input */}
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className="glass-card rounded-2xl p-6 mt-3 flex items-center gap-4 flex-wrap"
              style={{ border: '2px solid var(--color-coral-500)' }}
            >
              {/* Hours */}
              <div className="flex flex-col items-center gap-1">
                <label
                  htmlFor="custom-hours"
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'var(--muted)' }}
                >
                  Hours
                </label>
                <div className="flex items-center gap-2">
                  <button
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold outline-none"
                    style={{
                      background: 'var(--card)',
                      border: '2px solid var(--card-border)',
                    }}
                    onClick={() => setCustomHours((h) => Math.max(0, h - 1))}
                    aria-label="Decrease hours"
                  >
                    −
                  </button>
                  <input
                    id="custom-hours"
                    type="number"
                    min={0}
                    max={12}
                    value={customHours}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) setCustomHours(Math.max(0, Math.min(12, v)));
                    }}
                    className="text-center font-black tabular-nums"
                    style={{
                      width: 56,
                      fontSize: '1.75rem',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--fg)',
                    }}
                    aria-label="Hours"
                  />
                  <button
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold outline-none"
                    style={{
                      background: 'var(--card)',
                      border: '2px solid var(--card-border)',
                    }}
                    onClick={() => setCustomHours((h) => Math.min(12, h + 1))}
                    aria-label="Increase hours"
                  >
                    +
                  </button>
                </div>
              </div>

              <span
                className="text-2xl font-black mt-4"
                style={{ color: 'var(--muted)' }}
              >
                :
              </span>

              {/* Minutes */}
              <div className="flex flex-col items-center gap-1">
                <label
                  htmlFor="custom-minutes"
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'var(--muted)' }}
                >
                  Minutes
                </label>
                <div className="flex items-center gap-2">
                  <button
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold outline-none"
                    style={{
                      background: 'var(--card)',
                      border: '2px solid var(--card-border)',
                    }}
                    onClick={() =>
                      setCustomMinutes((m) => Math.max(0, m - 15))
                    }
                    aria-label="Decrease minutes"
                  >
                    −
                  </button>
                  <input
                    id="custom-minutes"
                    type="number"
                    min={0}
                    max={59}
                    step={15}
                    value={customMinutes}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v))
                        setCustomMinutes(Math.max(0, Math.min(59, v)));
                    }}
                    className="text-center font-black tabular-nums"
                    style={{
                      width: 56,
                      fontSize: '1.75rem',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--fg)',
                    }}
                    aria-label="Minutes"
                  />
                  <button
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold outline-none"
                    style={{
                      background: 'var(--card)',
                      border: '2px solid var(--card-border)',
                    }}
                    onClick={() =>
                      setCustomMinutes((m) => Math.min(59, m + 15))
                    }
                    aria-label="Increase minutes"
                  >
                    +
                  </button>
                </div>
              </div>

              {customTotal > 0 && (
                <div
                  className="ml-auto text-sm font-bold"
                  style={{ color: 'var(--color-coral-500)' }}
                  aria-live="polite"
                >
                  = {customTotal} min
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm */}
      <div className="mt-6">
        <button
          id="budget-confirm"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full rounded-2xl font-bold text-base transition-all outline-none"
          style={{
            minHeight: 56,
            background: canConfirm ? 'var(--color-coral-500)' : 'var(--card)',
            color: canConfirm ? 'white' : 'var(--muted)',
            border: canConfirm
              ? '2px solid transparent'
              : '2px solid var(--card-border)',
            opacity: canConfirm ? 1 : 0.6,
            cursor: canConfirm ? 'pointer' : 'not-allowed',
          }}
          aria-disabled={!canConfirm}
        >
          Set my budget →
        </button>
      </div>
    </motion.div>
  );
}
