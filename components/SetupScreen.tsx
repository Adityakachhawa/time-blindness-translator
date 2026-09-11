'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import {
  Bath, Brush, Calculator, ChefHat, Clapperboard, CloudLightning, CloudRain, CloudSun,
  Coffee, Dices, Droplets, Dumbbell, Film, GraduationCap, LucideIcon,
  Mail, MessageSquare, Minus, Moon, Music, Pill, Plus, Rocket,
  Sparkles, Star, Sun, Timer, Trophy, Tv2, UtensilsCrossed,
} from 'lucide-react';
import { useTimer } from '@/context/TimerContext';
import {
  getAnchors,
  TAX_MULTIPLIER_MIN,
  TAX_MULTIPLIER_MAX,
  TAX_LABELS,
} from '@/lib/calculations';
import { unlockAudio } from '@/lib/audio';
import { getTodayCount, getHasSeenQuiz, markQuizSeen, setMutePreference, getRecentUniqueTasks, type RecentTask } from '@/lib/storage';
import { calculatePersonalFactor, formatConfidenceRange } from '@/lib/calibration';
import { getTinyTemplates } from '@/lib/templates';
import type { Track } from '@/hooks/useAmbientAudio';
import OnboardingQuiz, { type QuizResult } from '@/components/OnboardingQuiz';

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

// Icon resolver — maps Lucide icon name strings (from calculations.ts) to components
const LUCIDE_ICONS: Record<string, LucideIcon> = {
  Bath, Brush, Calculator, ChefHat, Clapperboard, CloudLightning, CloudRain, CloudSun,
  Coffee, Droplets, Dumbbell, Film, GraduationCap, Mail, MessageSquare,
  Moon, Music, Pill, Rocket, Sparkles, Star, Sun, Timer, Trophy, Tv2, UtensilsCrossed,
};

function LucideIconComponent({ name, className, strokeWidth }: { name: string; className?: string; strokeWidth?: number }) {
  const Icon = LUCIDE_ICONS[name];
  if (!Icon) return null;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

// ---------------------------------------------------------------------------
// Quick-Start Templates
// ---------------------------------------------------------------------------

const TEMPLATES = [
  { icon: 'Mail',            label: 'Clear inbox',  minutes: 20 },
  { icon: 'UtensilsCrossed', label: 'Wash dishes',  minutes: 10 },
  { icon: 'Bath',            label: 'Get ready',    minutes: 30 },
  { icon: 'Pill',            label: 'Take meds',    minutes: 5  },
  { icon: 'MessageSquare',   label: 'Reply texts',  minutes: 5  },
  { icon: 'Brush',           label: 'Quick tidy',   minutes: 15 },
] as const;

// ---------------------------------------------------------------------------
// Feature 5: Surprise Me — tax presets
// ---------------------------------------------------------------------------

const TAX_PRESETS = [
  { value: 1.2, label: 'Good day'    },
  { value: 1.5, label: 'Average day' },
  { value: 2.0, label: 'Rough day'  },
];

// ---------------------------------------------------------------------------
// Anchor card config
// ---------------------------------------------------------------------------

interface AnchorCardConfig {
  id:       string;
  icon:     string;
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
      icon:     anchors.popCulture.icon,
      label:    'The Office / Anime',
      value:    ep >= 1 ? ep.toFixed(1) : `${Math.round(ep * 100)}%`,
      unit:     ep >= 1 ? 'episodes' : 'of one episode',
      detail:   'of your favourite show',
      gradient: 'linear-gradient(135deg, #f5a08a22, #f2815a11)',
      border:   'var(--color-coral-400)',
    },
    {
      id:       'music',
      icon:     anchors.music.icon,
      label:    'Pop Songs',
      value:    sg.toFixed(1),
      unit:     'songs',
      detail:   'back-to-back on shuffle',
      gradient: 'linear-gradient(135deg, #cdbde822, #a78bca11)',
      border:   'var(--color-lavender-400)',
    },
    {
      id:       'real-world',
      icon:     anchors.realWorld.icon,
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

export default function SetupScreen({ setTrack }: { setTrack?: (t: Track) => void }) {
  const { state, dispatch } = useTimer();
  const prefersReducedMotion = useReducedMotion();
  const [hasSeenQuiz, setHasSeenQuiz] = useState<boolean | null>(null);
  const [challengeData, setChallengeData] = useState<{taskName: string, min: number} | null>(null);

  useEffect(() => {
    let bypassQuiz = false;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const challenge = params.get('challenge');
      const minStr = params.get('min');
      if (challenge && minStr) {
        const min = parseInt(minStr, 10);
        if (!isNaN(min)) {
          setChallengeData({ taskName: challenge, min });
          const factor = calculatePersonalFactor(challenge);
          dispatch({ type: 'UPDATE_SETUP', payload: { taskName: challenge, initialEstimate: min, personalFactor: factor, isManualOverride: false } });
          bypassQuiz = true;
          // Clean up the URL so it doesn't persist
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
    
    if (bypassQuiz) {
      setHasSeenQuiz(true);
    } else {
      setHasSeenQuiz(getHasSeenQuiz());
    }
  }, [dispatch]);

  function handleQuizComplete(res: QuizResult) {
    const factor = calculatePersonalFactor(res.taskName);
    dispatch({ 
      type: 'UPDATE_SETUP', 
      payload: { taskName: res.taskName, initialEstimate: res.initialEstimate, personalFactor: factor, isManualOverride: false } 
    });
    
    if (setTrack) setTrack(res.track);
    setMutePreference(res.muted);
    // Force mute preference to sync globally if other components rely on localStorage
    window.dispatchEvent(new Event('storage'));

    markQuizSeen();
    setHasSeenQuiz(true);
  }

  function handleQuizSkip() {
    markQuizSeen();
    setHasSeenQuiz(true);
  }

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

  // Feature 6: Make it tiny
  const [showTinyMode, setShowTinyMode] = useState(false);

  // Feature 2: today's streak count
  const [todayCount, setTodayCount] = useState(0);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  useEffect(() => { 
    setTodayCount(getTodayCount()); 
    setRecentTasks(getRecentUniqueTasks(4));
  }, []);

  // Feature 5: Surprise Me
  function handleSurpriseMe() {
    const preset = TAX_PRESETS[Math.floor(Math.random() * TAX_PRESETS.length)];
    dispatch({ type: 'UPDATE_SETUP', payload: { taxMultiplier: preset.value } });
  }

  // Hydration safety: do not render until we know whether they've seen the quiz
  if (hasSeenQuiz === null) return null;

  return (
    <AnimatePresence mode="wait">
      {!hasSeenQuiz ? (
        <motion.div
          key="quiz"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <OnboardingQuiz onComplete={handleQuizComplete} onSkip={handleQuizSkip} />
        </motion.div>
      ) : (
        <motion.div
          key="setup"
          variants={containerVariants}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
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
          <Trophy className="w-5 h-5 shrink-0" style={{ color: 'var(--color-amber-400)' }} />
          <p className="font-bold text-sm" style={{ color: 'var(--fg)' }}>
            {todayCount} {todayCount === 1 ? 'task' : 'tasks'} crushed today — keep going!
          </p>
        </motion.div>
      )}

      {/* ── Challenge Banner ───────────────────────────────────────────── */}
      {challengeData && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-2 rounded-2xl py-2.5 px-4"
          style={{
            background: 'linear-gradient(135deg, rgba(125,175,156,0.15), rgba(125,175,156,0.10))',
            border: '1.5px solid rgba(125,175,156,0.4)',
          }}
        >
          <Sparkles className="w-5 h-5 shrink-0" style={{ color: 'var(--color-sage-500)' }} />
          <p className="font-bold text-sm" style={{ color: 'var(--fg)' }}>
            Someone challenged you to do this in {challengeData.min} min. Up for it?
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
              onClick={() => {
                const factor = calculatePersonalFactor(t.label);
                dispatch({
                  type: 'UPDATE_SETUP',
                  payload: { taskName: t.label, initialEstimate: t.minutes, personalFactor: factor, isManualOverride: false },
                });
              }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium shrink-0 whitespace-nowrap"
              style={{
                background: 'var(--card)',
                border: '1.5px solid var(--card-border)',
                color: 'var(--fg)',
              }}
              aria-label={`Quick start: ${t.label}, ${t.minutes} minutes`}
            >
              <LucideIconComponent name={t.icon} className="w-4 h-4 shrink-0" strokeWidth={2} />
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
          onChange={e => {
            const nextName = e.target.value;
            const factor = calculatePersonalFactor(nextName);
            dispatch({
              type: 'UPDATE_SETUP',
              payload: { taskName: nextName, personalFactor: factor, isManualOverride: false },
            });
          }}
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
        {canStart && (
          <div className="flex justify-end px-1 mt-1">
            <button
              onClick={() => setShowTinyMode(!showTinyMode)}
              className="text-xs font-semibold uppercase tracking-wide opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1"
              style={{ color: 'var(--color-coral-500)' }}
            >
              <Sparkles className="w-3 h-3" />
              {showTinyMode ? 'Cancel tiny mode' : 'Feeling stuck?'}
            </button>
          </div>
        )}
      </motion.div>

      {/* ── Feature 6: Make it tiny ──────────────────────────────────────── */}
      {showTinyMode ? (
        <motion.div variants={itemVariants} className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-center" style={{ color: 'var(--muted)' }}>
            Make it tiny (1-tap start)
          </p>
          <div className="flex gap-3">
            {[
              { min: 5, template: getTinyTemplates(state.taskName).min5 },
              { min: 15, template: getTinyTemplates(state.taskName).min15 }
            ].map((tiny) => (
              <motion.button
                key={tiny.min}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  dispatch({
                    type: 'UPDATE_SETUP',
                    payload: { 
                      taskName: `${state.taskName.trim()} (${tiny.min}-Min Starter)`, 
                      initialEstimate: tiny.min, 
                      taxMultiplier: 1.0, 
                      isManualOverride: true, 
                      transitionMinutes: 0 
                    },
                  });
                  // Immediately start the mission
                  setTimeout(() => dispatch({ type: 'START_MISSION' }), 50);
                }}
                className="flex-1 flex flex-col gap-2 rounded-2xl p-4 text-left transition-colors border"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--color-coral-400)',
                  boxShadow: '0 4px 12px rgba(242,129,90,0.1)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4" style={{ color: 'var(--color-coral-500)' }} />
                  <span className="font-black text-lg" style={{ color: 'var(--fg)' }}>{tiny.min} min</span>
                </div>
                <p className="text-sm leading-snug" style={{ color: 'var(--muted)' }}>{tiny.template}</p>
              </motion.button>
            ))}
          </div>
        </motion.div>
      ) : (
        <>
          {/* ── Minute stepper ─────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2">
        <label
          htmlFor="estimate-input"
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--muted)' }}
        >
          How long do you think it will take?
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

      {/* ── Transition Time Budgeting ─────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2 mt-1">
        <label
          className="text-xs font-semibold uppercase tracking-wide px-1"
          style={{ color: 'var(--muted)' }}
        >
          Include setup / transition time?
        </label>
        <div className="flex items-center gap-2">
          {[0, 5, 10].map((mins) => {
            const isSelected = (state.transitionMinutes || 0) === mins;
            return (
              <button
                key={mins}
                onClick={() => dispatch({ type: 'UPDATE_SETUP', payload: { transitionMinutes: mins } })}
                className="flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-colors border"
                style={{
                  backgroundColor: isSelected ? 'var(--color-ink-900)' : 'var(--card)',
                  color: isSelected ? '#ffffff' : 'var(--fg)',
                  borderColor: isSelected ? 'var(--color-ink-900)' : 'var(--card-border)',
                }}
              >
                {mins === 0 ? 'No' : `+${mins} min`}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Smart Predictions or ADHD Tax Slider ───────────────────────── */}
      {state.personalFactor !== null && state.personalFactor !== undefined && !state.isManualOverride ? (
        <motion.div variants={itemVariants} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label
              className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2"
              style={{ color: 'var(--color-coral-500)' }}
            >
              <Sparkles className="w-4 h-4" />
              Based on your history
            </label>
            <button
              onClick={() => dispatch({ type: 'UPDATE_SETUP', payload: { isManualOverride: true } })}
              className="text-xs font-medium underline opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--muted)' }}
            >
              Override manually
            </button>
          </div>
          <div
            className="w-full rounded-2xl px-5 py-5 flex items-center justify-center"
            style={{
              background: 'var(--card)',
              border: '2px solid var(--color-coral-400)',
              boxShadow: '0 4px 20px rgba(242,129,90,0.1)',
              backdropFilter: 'blur(8px)',
            }}
          >
             <span className="text-2xl font-black" style={{ color: 'var(--fg)' }}>
                {formatConfidenceRange(state.actualMinutes)}
             </span>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label
                htmlFor="tax-slider"
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: 'var(--muted)' }}
              >
                {state.personalFactor ? 'Manual Override' : 'Starter estimate'}
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
              <LucideIconComponent
                name={taxLabel.icon}
                className="w-6 h-6 shrink-0"
                strokeWidth={1.75}
              />
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
                  payload: { taxMultiplier: parseFloat(e.target.value), isManualOverride: true },
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
      )}

      {/* ── Reality Check pill ─────────────────────────────────────────── */}
      {(!state.personalFactor || state.isManualOverride) && (
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-center gap-3 rounded-2xl py-3 px-5"
          style={{
            background:
              'linear-gradient(135deg, var(--color-amber-300)44, var(--color-amber-400)22)',
            border: '1.5px solid var(--color-amber-400)',
          }}
        >
          <Calculator className="w-5 h-5 shrink-0" style={{ color: 'var(--color-amber-500)' }} strokeWidth={1.75} />
          <p style={{ color: 'var(--fg)' }}>
            <span className="font-medium">Starter estimate: </span>
            <span className="font-black text-xl">
              {formatConfidenceRange(state.actualMinutes)}
            </span>
          </p>
        </motion.div>
      )}
      </>
      )}

      {/* ── Anchor Cards ───────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col gap-3">
        <p
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'var(--muted)' }}
        >
          That's the same as…
        </p>

        <div className="grid grid-cols-1 gap-3">
          {cards.map(card => {
            // Subtle idle animations based on card type
            let idleAnimate = {};
            let idleTransition = {};
            
            if (!prefersReducedMotion) {
              if (card.id === 'pop-culture') {
                // TV/Monitor: rare CRT flicker
                idleAnimate = { opacity: [1, 1, 1, 1, 1, 0.7, 1, 1, 1, 1] };
                idleTransition = { duration: 6, repeat: Infinity, ease: 'linear' };
              } else if (card.id === 'music') {
                // Music note: subtle bob
                idleAnimate = { y: [0, -2, 0] };
                idleTransition = { duration: 2.5, repeat: Infinity, ease: 'easeInOut' };
              } else if (card.id === 'real-world') {
                // Real-world: subtle pulse/rotate combo
                idleAnimate = { rotate: [0, -2, 2, 0] };
                idleTransition = { duration: 4, repeat: Infinity, ease: 'easeInOut' };
              }
            }

            return (
              <motion.div
                key={card.id}
                whileHover={!prefersReducedMotion ? { y: -3, scale: 1.02 } : {}}
                whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
                // We omit a custom `transition` object so the hover/tap physics naturally 
                // match the default spring physics used by the MinuteStepper buttons.
                className="flex items-center gap-4 rounded-2xl px-5 py-4 min-h-26"
                style={{
                  background: card.gradient,
                  border: `1.5px solid ${card.border}`,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <motion.span 
                  className="text-2xl inline-block"
                  animate={idleAnimate}
                  transition={idleTransition}
                >
                  <LucideIconComponent name={card.icon} className="w-7 h-7 shrink-0" strokeWidth={1.75} />
                </motion.span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                    style={{ color: 'var(--muted)' }}
                  >
                    {card.label}
                  </p>
                  {card.value ? (
                    <p
                      className="font-black text-xl leading-tight"
                      style={{ color: 'var(--fg)' }}
                    >
                      {card.value}{' '}
                      <span className="text-base font-semibold" style={{ color: 'var(--fg)' }}>
                        {card.unit}
                      </span>
                    </p>
                  ) : null}
                  <p
                    className={card.value ? "text-sm mt-0.5" : "text-base font-semibold mt-0.5"}
                    style={{ color: card.value ? 'var(--muted)' : 'var(--fg)' }}
                  >
                    {card.detail}
                  </p>
                </div>
              </motion.div>
            );
          })}
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
          Start the Mission
        </motion.button>

        {!canStart && (
          <p
            className="text-center text-sm mt-3"
            style={{ color: 'var(--muted)' }}
          >
            ↑ Give your task a name first
          </p>
        )}

        <button
          onClick={() => setHasSeenQuiz(false)}
          className="w-full mt-6 text-sm font-semibold flex items-center justify-center gap-2 transition-colors hover:text-slate-600"
          style={{ color: 'var(--muted)' }}
        >
          🎯 Need help starting?
        </button>
      </motion.div>

      {/* ── Recent Missions ─────────────────────────────────────────────── */}
      {recentTasks.length > 0 && (
        <motion.div variants={itemVariants} className="mt-2 flex flex-col gap-3 border-t pt-6" style={{ borderColor: 'var(--card-border)' }}>
          <p
            className="text-xs uppercase tracking-widest font-semibold text-center"
            style={{ color: 'var(--muted)' }}
          >
            Recent Missions
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {recentTasks.map((t, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={() =>
                  dispatch({
                    type: 'UPDATE_SETUP',
                    payload: { 
                      taskName: t.taskName, 
                      initialEstimate: t.initialEstimate,
                      transitionMinutes: t.transitionMinutes || 0
                    },
                  })
                }
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors"
                style={{
                  background: 'var(--card)',
                  border: '1.5px solid var(--card-border)',
                  color: 'var(--fg)',
                }}
                aria-label={`Start again: ${t.taskName}, ${t.initialEstimate} minutes`}
              >
                <span>{t.taskName}</span>
                <span className="text-xs font-medium opacity-60">
                  {t.initialEstimate}m
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
      )}
    </AnimatePresence>
  );
}
