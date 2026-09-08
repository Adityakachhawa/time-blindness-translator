'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, Minus, Plus, Rocket } from 'lucide-react';
import { useTimer } from '@/context/TimerContext';
import {
  getAnchors,
  TAX_MULTIPLIER_MIN,
  TAX_MULTIPLIER_MAX,
  TAX_LABELS,
} from '@/lib/calculations';
import { unlockAudio } from '@/lib/audio';
import { getTodayCount } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Stagger animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ---------------------------------------------------------------------------
// Feature 3: Quick-Start Templates
// ---------------------------------------------------------------------------

const TEMPLATES = [
  { emoji: '📧', label: 'Clear inbox',  minutes: 20 },
  { emoji: '🍽️', label: 'Wash dishes',  minutes: 10 },
  { emoji: '🛁', label: 'Get ready',    minutes: 30 },
  { emoji: '💊', label: 'Take meds',    minutes: 5  },
  { emoji: '📝', label: 'Reply texts',  minutes: 5  },
  { emoji: '🧹', label: 'Quick tidy',   minutes: 15 },
] as const;

// ---------------------------------------------------------------------------
// Feature 5: Surprise Me — tax presets
// ---------------------------------------------------------------------------

const TAX_PRESETS = [
  { value: 1.2, label: '🌤️ Good day'    },
  { value: 1.5, label: '🌥️ Average day' },
  { value: 2.0, label: '🌩️ Rough day'  },
];

// ---------------------------------------------------------------------------
// Anchor card config
// ---------------------------------------------------------------------------

interface AnchorCardConfig {
  id:       string;
  emoji:    string;
  label:    string;
  value:    string;
  unit:     string;
  detail:   string;
  gradient: string;
  border:   string;
}

function buildCardConfigs(actualMinutes: number): AnchorCardConfig[] {
  const anchors = getAnchors(actualMinutes);
  const ep = anchors.popCulture.value;
  const sg = anchors.music.value;

  return [
    {
      id:       'pop-culture',
      emoji:    '📺',
      label:    'The Office / Anime',
      value:    ep >= 1 ? ep.toFixed(1) : `${Math.round(ep * 100)}%`,
      unit:     ep >= 1 ? 'episodes' : 'of one episode',
      detail:   'of your favourite show',
      gradient: 'linear-gradient(135deg, #f5a08a22, #f2815a11)',
      border:   'var(--color-coral-400)',
    },
    {
      id:       'music',
      emoji:    '🎵',
      label:    'Pop Songs',
      value:    sg.toFixed(1),
      unit:     'songs',
      detail:   'back-to-back on shuffle',
      gradient: 'linear-gradient(135deg, #cdbde822, #a78bca11)',
      border:   'var(--color-lavender-400)',
    },
    {
      id:       'real-world',
      emoji:    anchors.realWorld.emoji,
      label:    'Real World',
      value:    '',
      unit:     '',
      detail:   anchors.realWorld.sentence,
      gradient: 'linear-gradient(135deg, #b0d0c422, #7daf9c11)',
      border:   'var(--color-sage-400)',
    },
  ];
}

// ---------------------------------------------------------------------------
// Sub-component: large +/- stepper for the minute input
// ---------------------------------------------------------------------------

function MinuteStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(1, Math.min(300, v));

  const btnStyle = {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'var(--card)',
    border: '2px solid var(--card-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    color: 'var(--fg)',
  } as const;

  return (
    <div className="flex items-center gap-4 justify-center w-full">
      <motion.button
        whileTap={{ scale: 0.9 }}
        style={btnStyle}
        onClick={() => onChange(clamp(value - 5))}
        aria-label="Decrease estimate by 5 minutes"
        id="estimate-minus"
      >
        <Minus className="w-5 h-5" strokeWidth={2.5} />
      </motion.button>

      {/* Editable number */}
      <div className="flex items-baseline gap-2">
        <input
          type="number"
          id="estimate-input"
          value={value}
          min={1}
          max={300}
          onChange={e => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) onChange(clamp(n));
          }}
          className="text-center font-black tabular-nums"
          style={{
            fontSize: '3.5rem',
            lineHeight: 1,
            width: 110,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--fg)',
          }}
          aria-label="Estimated minutes"
        />
        <span
          className="text-xl font-semibold"
          style={{ color: 'var(--muted)' }}
        >
          min
        </span>
      </div>

      <motion.button
        whileTap={{ scale: 0.9 }}
        style={btnStyle}
        onClick={() => onChange(clamp(value + 5))}
        aria-label="Increase estimate by 5 minutes"
        id="estimate-plus"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SetupScreen() {
  const { state, dispatch } = useTimer();

  const sliderPct =
    ((state.taxMultiplier - TAX_MULTIPLIER_MIN) /
      (TAX_MULTIPLIER_MAX - TAX_MULTIPLIER_MIN)) *
    100;

  const taxLabel = useMemo(
    () =>
      TAX_LABELS.reduce((prev, curr) =>
        Math.abs(curr.value - state.taxMultiplier) <
        Math.abs(prev.value - state.taxMultiplier)
          ? curr
          : prev,
      ),
    [state.taxMultiplier],
  );

  const cards = useMemo(
    () => buildCardConfigs(state.actualMinutes),
    [state.actualMinutes],
  );

  const canStart = state.taskName.trim().length > 0;

  // Feature 2: today's streak count
  const [todayCount, setTodayCount] = useState(0);
  useEffect(() => { setTodayCount(getTodayCount()); }, []);

  // Feature 5: Surprise Me
  function handleSurpriseMe() {
    const preset = TAX_PRESETS[Math.floor(Math.random() * TAX_PRESETS.length)];
    dispatch({ type: 'UPDATE_SETUP', payload: { taxMultiplier: preset.value } });
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-7 w-full pb-4"
    >
      {/* ── Feature 2: Streak badge ─────────────────────────────────────── */}
      {todayCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-2 rounded-2xl py-2.5 px-4"
          style={{
            background: 'linear-gradient(135deg, rgba(245,166,35,0.15), rgba(242,129,90,0.10))',
            border: '1.5px solid rgba(245,166,35,0.4)',
          }}
        >
          <span className="text-xl">🔥</span>
          <p className="font-bold text-sm" style={{ color: 'var(--fg)' }}>
            {todayCount} {todayCount === 1 ? 'task' : 'tasks'} crushed today — keep going!
          </p>
        </motion.div>
      )}

      {/* ── Hero intro ─────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="text-center">
        <h2
          className="text-3xl font-black leading-tight"
          style={{ color: 'var(--fg)' }}
        >
          Let's be{' '}
          <span style={{ color: 'var(--color-coral-500)' }}>honest</span>{' '}
          about time
        </h2>
        <p className="mt-2 text-base" style={{ color: 'var(--muted)' }}>
          Enter your estimate — we'll apply the ADHD tax automatically.
        </p>
      </motion.div>

      {/* ── Feature 3: Quick-Start Templates ───────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2">
        <p
          className="text-xs uppercase tracking-widest font-semibold"
          style={{ color: '#94a3b8' }}
        >
          Quick start →
        </p>
        <div className="flex flex-wrap gap-2 pb-1 -mx-1 px-1">
          {TEMPLATES.map(t => (
            <motion.button
              key={t.label}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() =>
                dispatch({
                  type: 'UPDATE_SETUP',
                  payload: { taskName: t.label, initialEstimate: t.minutes },
                })
              }
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium shrink-0 whitespace-nowrap"
              style={{
                background: 'var(--card)',
                border: '1.5px solid var(--card-border)',
                color: 'var(--fg)',
              }}
              aria-label={`Quick start: ${t.label}, ${t.minutes} minutes`}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Task name ──────────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2">
        <label
          htmlFor="task-name"
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--muted)' }}
        >
          What are you doing?
        </label>
        <input
          id="task-name"
          type="text"
          placeholder="e.g. Fold laundry, write that email…"
          value={state.taskName}
          onChange={e =>
            dispatch({
              type: 'UPDATE_SETUP',
              payload: { taskName: e.target.value },
            })
          }
          className="w-full rounded-2xl px-5 py-4 text-lg font-medium placeholder-shown:italic"
          style={{
            background: 'var(--card)',
            border: '2px solid var(--card-border)',
            color: 'var(--fg)',
            outline: 'none',
            backdropFilter: 'blur(8px)',
            transition: 'border-color 200ms',
          }}
          onFocus={e =>
            (e.target.style.borderColor = 'var(--color-coral-400)')
          }
          onBlur={e =>
            (e.target.style.borderColor = 'var(--color-cream-300)')
          }
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
        />
      </motion.div>

      {/* ── Minute stepper ─────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2">
        <label
          htmlFor="estimate-input"
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--muted)' }}
        >
          Your optimistic estimate
        </label>
        <div
          className="w-full rounded-2xl py-5 px-4"
          style={{
            background: 'var(--card)',
            border: '2px solid var(--card-border)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <MinuteStepper
            value={state.initialEstimate}
            onChange={v =>
              dispatch({
                type: 'UPDATE_SETUP',
                payload: { initialEstimate: v },
              })
            }
          />
        </div>
      </motion.div>

      {/* ── ADHD Tax Slider ────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label
              htmlFor="tax-slider"
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: 'var(--muted)' }}
            >
              ADHD Tax
            </label>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSurpriseMe}
              className="p-1 rounded-lg transition-colors flex items-center justify-center shadow-sm border"
              style={{ color: 'var(--color-coral-500)', borderColor: 'var(--card-border)', background: 'var(--card)' }}
              aria-label="Surprise me with a random tax multiplier"
            >
              <Dices className="w-4 h-4" strokeWidth={2.5} />
            </motion.button>
          </div>
          <span
            className="text-base font-black tabular-nums"
            style={{ color: 'var(--color-coral-500)' }}
          >
            {state.taxMultiplier.toFixed(1)}×
          </span>
        </div>

        <div
          className="w-full rounded-2xl px-5 py-5 flex flex-col gap-3"
          style={{
            background: 'var(--card)',
            border: '2px solid var(--card-border)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Mood badge */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">{taxLabel.emoji}</span>
            <div>
              <p
                className="font-semibold text-sm"
                style={{ color: 'var(--fg)' }}
              >
                {taxLabel.description}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Today feels like a{' '}
                <strong>{state.taxMultiplier.toFixed(1)}×</strong> day
              </p>
            </div>
          </div>

          {/* Slider with gradient fill */}
          <input
            id="tax-slider"
            type="range"
            min={TAX_MULTIPLIER_MIN}
            max={TAX_MULTIPLIER_MAX}
            step={0.1}
            value={state.taxMultiplier}
            onChange={e =>
              dispatch({
                type: 'UPDATE_SETUP',
                payload: { taxMultiplier: parseFloat(e.target.value) },
              })
            }
            style={{
              background: `linear-gradient(to right, var(--color-coral-500) ${sliderPct}%, var(--color-cream-300) ${sliderPct}%)`,
            }}
            aria-label="ADHD tax multiplier"
            aria-valuenow={state.taxMultiplier}
            aria-valuemin={TAX_MULTIPLIER_MIN}
            aria-valuemax={TAX_MULTIPLIER_MAX}
          />

          {/* Tick labels */}
          <div className="flex justify-between px-1">
            {TAX_LABELS.map(tl => (
              <span
                key={tl.value}
                className="text-xs font-mono"
                style={{
                  color:
                    Math.abs(tl.value - state.taxMultiplier) < 0.06
                      ? 'var(--color-coral-500)'
                      : 'var(--color-ink-300)',
                  fontWeight:
                    Math.abs(tl.value - state.taxMultiplier) < 0.06
                      ? 700
                      : 400,
                }}
              >
                {tl.label}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Reality Check pill ─────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-center gap-3 rounded-2xl py-3 px-5"
        style={{
          background:
            'linear-gradient(135deg, var(--color-amber-300)44, var(--color-amber-400)22)',
          border: '1.5px solid var(--color-amber-400)',
        }}
      >
        <span className="text-2xl">🧮</span>
        <p style={{ color: 'var(--fg)' }}>
          <span className="font-medium">Reality check: </span>
          <span className="font-black text-xl">
            {state.actualMinutes} minutes
          </span>{' '}
          <span className="text-sm">
            ({state.initialEstimate} × {state.taxMultiplier.toFixed(1)}×,
            rounded to 5)
          </span>
        </p>
      </motion.div>

      {/* ── Anchor Cards ───────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        <p
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--muted)' }}
        >
          That's the same as…
        </p>

        <div className="grid grid-cols-1 gap-3">
          {cards.map(card => (
            <motion.div
              key={card.id}
              whileHover={{ y: -3, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="flex items-center gap-4 rounded-2xl px-5 py-4 min-h-26"
              style={{
                background: card.gradient,
                border: `1.5px solid ${card.border}`,
                backdropFilter: 'blur(8px)',
              }}
            >
              <span className="text-3xl shrink-0">{card.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5 text-slate-500 dark:text-slate-300">
                  {card.label}
                </p>
                {card.value ? (
                  <p className="font-black text-xl leading-tight text-slate-800 dark:text-white">
                    {card.value}{' '}
                    <span className="text-base font-semibold text-slate-800 dark:text-white">{card.unit}</span>
                  </p>
                ) : null}
                <p className="text-sm mt-0.5 text-slate-500 dark:text-slate-300">
                  {card.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Start Mission CTA ──────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="pt-2">
        <motion.button
          whileHover={canStart ? { scale: 1.03, y: -3 } : {}}
          whileTap={canStart ? { scale: 0.97 } : {}}
          onClick={() => {
            if (canStart) {
              unlockAudio(); // pre-unlock AudioContext during this user gesture
              dispatch({ type: 'START_MISSION' });
            }
          }}
          disabled={!canStart}
          id="start-mission-btn"
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-xl font-bold text-white"
          style={{
            background: canStart
              ? 'linear-gradient(135deg, var(--color-coral-500) 0%, var(--color-coral-600) 100%)'
              : 'var(--color-cream-300)',
            boxShadow: canStart
              ? '0 6px 24px rgba(242,129,90,0.45), 0 2px 6px rgba(0,0,0,0.08)'
              : 'none',
            color: canStart ? 'white' : '#64748b',
            cursor: canStart ? 'pointer' : 'not-allowed',
            minHeight: 72,
            transition: 'all 250ms ease',
          }}
          aria-label="Start the timer mission"
          aria-disabled={!canStart}
        >
          <Rocket className="w-6 h-6 shrink-0" />
          Start the Mission 🚀
        </motion.button>

        {!canStart && (
          <p className="text-center text-sm mt-3 text-slate-500 dark:text-slate-400">
            ↑ Give your task a name first
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
