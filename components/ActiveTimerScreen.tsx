'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import { useTimer } from '@/context/TimerContext';
import { CheckCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format milliseconds to M:SS display string */
function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** Linear interpolate between two RGB hex colour strings (no `#` prefix) */
function lerpHex(a: string, b: string, t: number): string {
  const toRgb = (h: string) => [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ] as const;
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

// Warm palette anchors — no aggressive red at any point
const SAGE   = '7daf9c'; // sage-500   — calm, "you have time"
const AMBER  = 'f5a623'; // amber-500  — gentle urgency
const CORAL  = 'f2815a'; // coral-500  — warm nudge, never alarming

/**
 * Interpolates a warm block colour from sage → amber → coral
 * based on the fill ratio (1 = full / just started, 0 = empty / time up).
 */
function computeBlockColor(fill: number): string {
  const clamped = Math.max(0, Math.min(1, fill));
  if (clamped >= 0.5) {
    // sage → amber as fill goes from 1.0 → 0.5
    return lerpHex(SAGE, AMBER, (1 - clamped) * 2);
  }
  // amber → coral as fill goes from 0.5 → 0
  return lerpHex(AMBER, CORAL, (0.5 - clamped) * 2);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActiveTimerScreen() {
  const { state, dispatch } = useTimer();

  // Reactive ms-remaining — updated every 100 ms for smooth visual + digit display
  const [msLeft, setMsLeft] = useState<number>(() =>
    state.endTime ? Math.max(0, state.endTime - Date.now()) : 0,
  );

  // A MotionValue fed into a spring for silky-smooth scaleY transitions
  const fillMV = useMotionValue(
    Math.min(1, msLeft / (state.actualMinutes * 60_000)),
  );
  const scaleSpring = useSpring(fillMV, { stiffness: 28, damping: 16 });

  useEffect(() => {
    if (!state.endTime) return;
    const endTime  = state.endTime as number;
    const totalMs  = state.actualMinutes * 60_000;

    const id = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setMsLeft(remaining);
      fillMV.set(Math.min(1, remaining / totalMs));
    }, 100);

    return () => clearInterval(id);
  }, [state.endTime, state.actualMinutes, fillMV]);

  // Derived display values
  const totalMs   = state.actualMinutes * 60_000;
  const fillRatio = Math.min(1, Math.max(0, msLeft / totalMs));
  const pctLeft   = Math.round(fillRatio * 100);
  const isLow     = fillRatio < 0.22;
  const timeLabel = formatTime(msLeft);
  const blockBg   = useMemo(() => computeBlockColor(fillRatio), [fillRatio]);

  return (
    <div className="flex flex-col items-center gap-8 w-full">

      {/* ── Task banner ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full text-center"
      >
        <p
          className="text-xs uppercase tracking-widest font-semibold mb-1"
          style={{ color: 'var(--color-ink-400)' }}
        >
          Currently tackling
        </p>
        <h2
          className="text-2xl font-bold leading-snug"
          style={{ color: 'var(--color-ink-900)' }}
        >
          {state.taskName || 'Your mission'}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-ink-500)' }}>
          {state.actualMinutes} min allocated · ADHD tax included ✓
        </p>
      </motion.div>

      {/* ── Melting-block visual ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="flex flex-col items-center"
      >
        {/* Vessel (outer container) */}
        <div
          className="relative w-44 rounded-3xl overflow-hidden"
          style={{
            height: 340,
            background: 'var(--color-cream-200)',
            boxShadow:
              'inset 0 2px 14px rgba(0,0,0,0.09), 0 6px 28px rgba(0,0,0,0.07)',
          }}
          role="progressbar"
          aria-valuenow={pctLeft}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pctLeft}% time remaining for ${state.taskName}`}
        >
          {/* Coloured fill — scaleY shrinks from the top, like a melting ice block */}
          <motion.div
            className="absolute inset-x-0 top-0 rounded-3xl"
            style={{
              height: '100%',
              scaleY:          scaleSpring,
              originY:         0,
              backgroundColor: blockBg,
              // Soft glow intensifies when running low
              boxShadow: isLow
                ? `0 0 32px ${blockBg}99, 0 0 8px ${blockBg}66`
                : `0 0 14px ${blockBg}55`,
            }}
          />

          {/* Percentage label centred inside the block */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
            <span
              className="text-5xl font-black tabular-nums select-none leading-none"
              style={{
                color: fillRatio > 0.25
                  ? 'rgba(255,255,255,0.92)'
                  : 'var(--color-ink-800)',
                textShadow:
                  fillRatio > 0.25 ? '0 1px 6px rgba(0,0,0,0.22)' : 'none',
              }}
            >
              {pctLeft}
            </span>
            <span
              className="text-lg font-semibold mt-1 select-none"
              style={{
                color: fillRatio > 0.25
                  ? 'rgba(255,255,255,0.7)'
                  : 'var(--color-ink-500)',
              }}
            >
              %
            </span>
          </div>
        </div>

        {/* Small faded numerical countdown — reference only */}
        <p
          className="mt-5 text-3xl font-mono font-light tabular-nums select-none"
          style={{ color: '#334155' }}
          aria-live="off"
        >
          {timeLabel}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
          left on the clock
        </p>
      </motion.div>

      {/* Motivational micro-copy — pulses gently when low */}
      {isLow ? (
        <motion.p
          animate={{ opacity: [0.65, 1, 0.65] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="text-base font-semibold text-center px-4"
          style={{ color: 'var(--color-coral-600)' }}
        >
          Almost there — you're doing great! 💪
        </motion.p>
      ) : (
        <p
          className="text-sm text-center px-4"
          style={{ color: 'var(--color-ink-500)' }}
        >
          Stay with it. Your brain is doing the thing. 🧠
        </p>
      )}

      {/* ── I Did It! CTA ─────────────────────────────────────────────────── */}
      <motion.button
        whileHover={{ scale: 1.03, y: -3 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => dispatch({ type: 'COMPLETE_MISSION' })}
        id="complete-mission-btn"
        className="w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-xl font-bold text-white"
        style={{
          background:
            'linear-gradient(135deg, var(--color-sage-500) 0%, var(--color-sage-600) 100%)',
          boxShadow: '0 6px 24px rgba(125,175,156,0.45), 0 2px 6px rgba(0,0,0,0.08)',
          minHeight: 72,
        }}
        aria-label="I completed the task"
      >
        <CheckCircle className="w-7 h-7 shrink-0" strokeWidth={2.5} />
        I Did It! ✅
      </motion.button>

      <p className="text-xs text-center pb-4" style={{ color: 'var(--color-ink-300)' }}>
        Tap any time you finish — even before the timer ends.
      </p>
    </div>
  );
}
