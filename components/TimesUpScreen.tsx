'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, RefreshCw } from 'lucide-react';
import { useTimer } from '@/context/TimerContext';
import { getMutePreference } from '@/lib/storage';
import { playGentleBell } from '@/lib/audio';

// ---------------------------------------------------------------------------
// Shame-free empathy messages — rotate randomly on mount
// ---------------------------------------------------------------------------

const EMPATHY_MESSAGES = [
  {
    headline: "Time's up. And that's okay.",
    body:     "Did you fall down a Wikipedia rabbit hole? Forget what you were doing? Time-blindness is a real, documented thing — not a character flaw.",
  },
  {
    headline: "The timer hit zero. You didn't.",
    body:     "Transition paralysis, decision fatigue, hyperfocus on the wrong thing — these are features of your brain, not bugs. You're still here.",
  },
  {
    headline: "Surprise! Time passed.",
    body:     "It does that. Your ADHD brain wasn't built for linear time tracking. That's literally what this tool is for.",
  },
  {
    headline: "No alarm. No shame.",
    body:     "Neurotypical productivity timers weren't designed for brains like ours. Add ten minutes and keep going — no judgement here.",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimesUpScreen() {
  const { dispatch } = useTimer();

  // Play sound on mount
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    playGentleBell(getMutePreference());
  }, []);

  // Pick one message deterministically on this render (stable across hydration)
  const msg = EMPATHY_MESSAGES[
    Math.floor(
      (typeof window !== 'undefined' ? performance.now() : 0) % EMPATHY_MESSAGES.length
    )
  ] ?? EMPATHY_MESSAGES[0];

  return (
    <div className="flex flex-col items-center gap-8 w-full pb-4">

      {/* ── Hourglass illustration ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 15 }}
        className="text-center"
      >
        <motion.span
          animate={{ rotate: [0, 10, -10, 10, 0] }}
          transition={{ duration: 2.5, delay: 0.6, repeat: Infinity, repeatDelay: 4 }}
          className="block text-7xl mb-4 select-none"
          aria-hidden
        >
          ⌛
        </motion.span>
      </motion.div>

      {/* ── Pulsing empathy message ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="w-full"
      >
        <motion.div
          animate={{ scale: [1, 1.015, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="rounded-3xl px-6 py-7 text-center"
          style={{
            background:
              'linear-gradient(140deg, rgba(255,255,255,0.72), rgba(253,246,236,0.85))',
            border: '1.5px solid var(--color-cream-300)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <h2
            className="text-2xl font-black leading-tight mb-3"
            style={{ color: 'var(--color-ink-900)' }}
          >
            {msg.headline}
          </h2>
          <p
            className="text-base leading-relaxed"
            style={{ color: '#334155' }}
          >
            {msg.body}
          </p>
        </motion.div>
      </motion.div>

      {/* ── Fun micro-stat ─────────────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="text-sm text-center px-4"
        style={{ color: '#475569' }}
      >
        Fun fact: the average person with ADHD underestimates task time by{' '}
        <strong style={{ color: 'var(--color-amber-600)' }}>40–100%</strong>.
        {' '}You're in good company.
      </motion.p>

      {/* ── Add 10 minutes CTA — the primary action ────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full flex flex-col gap-3"
      >
        <motion.button
          whileHover={{ scale: 1.04, y: -3 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => dispatch({ type: 'ADD_TEN_MINUTES' })}
          id="add-ten-minutes-btn"
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-xl font-bold text-white"
          style={{
            background:
              'linear-gradient(135deg, var(--color-amber-500) 0%, var(--color-amber-600) 100%)',
            boxShadow: '0 6px 24px rgba(245,166,35,0.45), 0 2px 6px rgba(0,0,0,0.08)',
            minHeight: 72,
          }}
          aria-label="Add 10 more minutes with no shame"
        >
          <PlusCircle className="w-7 h-7 shrink-0" strokeWidth={2.5} />
          Add 10 more minutes (No shame) ⏳
        </motion.button>

        <p
          className="text-xs text-center"
          style={{ color: 'var(--color-ink-400)' }}
        >
          Picks up exactly where you left off. No resets, no guilt.
        </p>

        {/* Secondary: start over */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => window.location.reload()}
          id="restart-btn"
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-base font-medium"
          style={{
            background: 'transparent',
            border: '2px solid var(--color-cream-300)',
            color: 'var(--color-ink-500)',
            minHeight: 52,
          }}
          aria-label="Abandon this task and start fresh"
        >
          <RefreshCw className="w-4 h-4 shrink-0" />
          Actually, let's start fresh
        </motion.button>
      </motion.div>

      {/* ── Warm reassurance footer ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="rounded-2xl px-5 py-4 text-center w-full"
        style={{
          background:
            'linear-gradient(135deg, rgba(167,139,202,0.12), rgba(167,139,202,0.06))',
          border: '1px solid var(--color-lavender-400)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--color-lavender-700)' }}>
          💜 There are no failure screens here. Only detours.
        </p>
      </motion.div>
    </div>
  );
}
