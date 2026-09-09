'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useSpring, useMotionValue, AnimatePresence } from 'framer-motion';
import { useTimer } from '@/context/TimerContext';
import { CheckCircle, Undo2 } from 'lucide-react';

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
const SAGE = '7daf9c'; // sage-500   — calm, "you have time"
const AMBER = 'f5a623'; // amber-500  — gentle urgency
const CORAL = 'f2815a'; // coral-500  — warm nudge, never alarming

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

  // "Oops" grace period — 3-second undo window before completing
  const [isCompleting, setIsCompleting] = useState(false);
  const completingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Witness Me" mission-start announcement toast (one-time dismissible)
  const [showWitnessToast, setShowWitnessToast] = useState(true);

  // Halfway nudge state
  const [hasShownNudge, setHasShownNudge] = useState(false);
  const [showNudgeToast, setShowNudgeToast] = useState(false);

  // Auto-dismiss the start toast after 10s if untouched
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWitnessToast(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  const handleStartShare = useCallback(async () => {
    setShowWitnessToast(false);

    const shareText = `Just set a ${state.actualMinutes}-min timer for '${state.taskName}' using the ADHD Tax method on Time-Blindness Translator. Witness me. 👀 @Aditya_X_Writes`;
    const shareUrl = 'https://time-blindness-translator.vercel.app';
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    const isMobile =
      typeof navigator !== 'undefined' &&
      /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    if (isMobile && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Time-Blindness Translator',
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err: unknown) {
        // If user cancelled the share sheet, exit gracefully
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // If mobile share failed for other reasons, fall through to desktop fallback
      }
    }

    // Desktop (PC / Mac) fallback OR mobile share failure fallback:
    // 1. Copy to clipboard for easy pasting anywhere
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      } catch {
        // Silently ignore clipboard write rejections (e.g. lack of focus/permissions)
      }
    }

    // 2. Open Twitter intent in a new tab (never navigate current tab)
    if (typeof window !== 'undefined') {
      window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
    }
  }, [state.actualMinutes, state.taskName]);

  useEffect(() => {
    if (!isCompleting) return;
    completingTimer.current = setTimeout(() => {
      dispatch({ type: 'COMPLETE_MISSION' });
    }, 3000);
    return () => {
      if (completingTimer.current) clearTimeout(completingTimer.current);
    };
  }, [isCompleting, dispatch]);

  const handleCompleteTap = useCallback(() => {
    if (isCompleting) {
      // Undo — cancel the pending completion
      if (completingTimer.current) clearTimeout(completingTimer.current);
      setIsCompleting(false);
    } else {
      setIsCompleting(true);
    }
  }, [isCompleting]);

  const handleNudgeStillOnIt = useCallback(() => {
    setShowNudgeToast(false);
    setHasShownNudge(true);
  }, []);

  const handleNudgeAddFive = useCallback(() => {
    dispatch({ type: 'ADD_MINUTES', payload: { minutes: 5 } });
    setShowNudgeToast(false);
    setHasShownNudge(true);
  }, [dispatch]);

  // A MotionValue fed into a spring for silky-smooth scaleY transitions
  const fillMV = useMotionValue(
    Math.min(1, msLeft / (state.actualMinutes * 60_000)),
  );
  const scaleSpring = useSpring(fillMV, { stiffness: 28, damping: 16 });

  useEffect(() => {
    if (!state.endTime) return;
    const endTime = state.endTime as number;
    const totalMs = state.actualMinutes * 60_000;

    const id = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setMsLeft(remaining);
      fillMV.set(Math.min(1, remaining / totalMs));

      // Halfway check: elapsed time has crossed 50% of the total actualMinutes
      const elapsed = totalMs - remaining;
      if (elapsed >= totalMs * 0.5 && !hasShownNudge) {
        setShowNudgeToast(true);
      }
    }, 100);

    return () => clearInterval(id);
  }, [state.endTime, state.actualMinutes, fillMV, hasShownNudge]);

  // Derived display values
  const totalMs = state.actualMinutes * 60_000;
  const fillRatio = Math.min(1, Math.max(0, msLeft / totalMs));
  const pctLeft = Math.round(fillRatio * 100);
  const isLow = fillRatio < 0.22;
  const timeLabel = formatTime(msLeft);
  const blockBg = useMemo(() => computeBlockColor(fillRatio), [fillRatio]);

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
              scaleY: scaleSpring,
              originY: 0,
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
          style={{ color: 'var(--fg)' }}
          aria-live="off"
        >
          {timeLabel}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
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

      {/* ── I Did It! CTA (with 3-second undo grace period) ────────────────── */}
      <motion.button
        whileHover={{ scale: 1.03, y: -3 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleCompleteTap}
        id="complete-mission-btn"
        className="w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-xl font-bold text-white"
        style={{
          background: isCompleting
            ? 'linear-gradient(135deg, #f5a623 0%, #d8880a 100%)'
            : 'linear-gradient(135deg, var(--color-sage-500) 0%, var(--color-sage-600) 100%)',
          boxShadow: isCompleting
            ? '0 6px 24px rgba(245,166,35,0.45), 0 2px 6px rgba(0,0,0,0.08)'
            : '0 6px 24px rgba(125,175,156,0.45), 0 2px 6px rgba(0,0,0,0.08)',
          minHeight: 72,
          transition: 'background 300ms ease, box-shadow 300ms ease',
        }}
        aria-label={isCompleting ? 'Undo — cancel completion' : 'I completed the task'}
      >
        {isCompleting ? (
          <>
            <Undo2 className="w-7 h-7 shrink-0" strokeWidth={2.5} />
            Completing… Tap to Undo ↩️
          </>
        ) : (
          <>
            <CheckCircle className="w-7 h-7 shrink-0" strokeWidth={2.5} />
            I Did It! ✅
          </>
        )}
      </motion.button>

      <p className="text-xs text-center pb-4" style={{ color: 'var(--color-ink-300)' }}>
        {isCompleting
          ? 'Changed your mind? Tap the button above to cancel.'
          : 'Tap any time you finish — even before the timer ends.'}
      </p>

      {/* ── Halfway Nudge Toast / Notification ───────────────────────── */}
      <AnimatePresence>
        {showNudgeToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26 }}
            className="fixed bottom-6 inset-x-4 max-w-md mx-auto z-50 p-4 rounded-2xl shadow-2xl border flex flex-col gap-3"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--color-amber-400)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">👀</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-snug" style={{ color: 'var(--fg)' }}>
                  Heads up — you're halfway through. How's it going? 👀
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Take a quick breath. You're doing awesome.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleNudgeStillOnIt}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-sm hover:brightness-105"
                style={{
                  background: 'var(--color-sage-500)',
                  color: '#ffffff',
                }}
              >
                ✅ Still on it!
              </button>
              <button
                type="button"
                onClick={handleNudgeAddFive}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-sm hover:brightness-105"
                style={{
                  background: 'var(--color-amber-500)',
                  color: '#1c1917',
                }}
              >
                ➕ Need +5 min
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── "Witness Me" Mission-Start Announcement Toast ──────────────── */}
      <AnimatePresence>
        {showWitnessToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26 }}
            className="fixed bottom-6 inset-x-4 max-w-md mx-auto z-50 p-4 rounded-2xl shadow-2xl border flex flex-col gap-3"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--color-coral-400)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            role="alert"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">📣</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-snug" style={{ color: 'var(--fg)' }}>
                  Announce your mission?
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Share for accountability with friends or followers.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleStartShare}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-sm hover:brightness-105"
                style={{
                  background: 'linear-gradient(135deg, var(--color-coral-500) 0%, var(--color-coral-600) 100%)',
                  color: '#ffffff',
                }}
              >
                📢 Witness me!
              </button>
              <button
                type="button"
                onClick={() => setShowWitnessToast(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer border hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: 'var(--card-border)',
                  color: 'var(--muted)',
                }}
              >
                nah, just doing it
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
