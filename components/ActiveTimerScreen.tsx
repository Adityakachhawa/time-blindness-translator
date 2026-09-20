'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useSpring, useMotionValue, AnimatePresence, useReducedMotion } from 'framer-motion';
import { toPng, toBlob } from 'html-to-image';
import { useTimer } from '@/context/TimerContext';
import { useWakeLock } from '@/hooks/useWakeLock';
import { clearAppBadge } from '@/lib/notifications/badgeManager';
import { computeBlockColor } from '@/lib/calculations';
import { getMissionAwarenessEvents, MissionEvent } from '@/lib/mission/awareness';
import { Brain, CheckCircle, Megaphone, PlusCircle, ScanEye, Undo2, Zap, ChevronDown, Timer, AlertCircle } from 'lucide-react';

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

// ---------------------------------------------------------------------------
// Mission Launched Card (Off-Screen)
// ---------------------------------------------------------------------------

function MissionLaunchedCard({ taskName, allocatedMin, taxMultiplier, isExactTime, cardRef }: { taskName: string, allocatedMin: number, taxMultiplier: number, isExactTime?: boolean, cardRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={cardRef}
      style={{
        width: '100%',
        maxWidth: 600,
        background: 'linear-gradient(140deg, #1e293b 0%, #0f172a 100%)',
        border: '3px solid #f2815a',
        borderRadius: 24,
        padding: 40,
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ fontSize: 16, letterSpacing: 2, textTransform: 'uppercase', color: '#f2815a', margin: '0 0 16px', fontWeight: 700 }}>
        Mission Launched 🚀
      </p>
      <p style={{ fontSize: 36, fontWeight: 900, color: '#f8fafc', margin: '0 0 24px', lineHeight: 1.2, wordBreak: 'break-word' }}>
        {taskName}
      </p>
      <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#f8fafc' }}>{allocatedMin}<span style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginLeft: 6 }}>min</span></p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Allocated Time</p>
        </div>
        {isExactTime ? (
          <div style={{ background: 'rgba(99,102,241,0.15)', padding: 16, borderRadius: 16, flex: 1, border: '1px solid rgba(99,102,241,0.35)' }}>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#818cf8' }}>Exact Time ⚡</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>No ADHD Tax</p>
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 16, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#f8fafc' }}>{taxMultiplier.toFixed(1)}×</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>ADHD Tax Applied</p>
          </div>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 14, color: '#64748b', textAlign: 'right', fontWeight: 500 }}>
        Time-Blindness Translator
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActiveTimerScreen() {
  const { state, dispatch } = useTimer();
  const prefersReducedMotion = useReducedMotion();

  // Reactive ms-remaining — updated every 100 ms for smooth visual + digit display
  const [msLeft, setMsLeft] = useState<number>(() =>
    state.endTime ? Math.max(0, state.endTime - Date.now()) : 0,
  );

  // "Oops" grace period — 3-second undo window before completing
  const [isCompleting, setIsCompleting] = useState(false);
  const completingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Witness Me" mission-start announcement toast (one-time dismissible)
  const [showWitnessToast, setShowWitnessToast] = useState(() => {
    return state.actualMinutes >= 15 || state.taxMultiplier >= 1.5;
  });

  const [currentEvent, setCurrentEvent] = useState<MissionEvent | null>(null);
  const [showRecalculate, setShowRecalculate] = useState(false);

  // Card reference for html-to-image capture
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss the start toast after 10s if untouched
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWitnessToast(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  const handleStartShare = useCallback(async () => {
    setShowWitnessToast(false);
    dispatch({ type: 'ANNOUNCE_MISSION' });

    const shareText = state.isExactTime 
      ? `Just set an exact ${state.actualMinutes}-min timer for '${state.taskName}' with no ADHD tax on Time-Blindness Translator. Witness me. 👀 @Aditya_X_Writes`
      : `Just set a ${state.actualMinutes}-min timer for '${state.taskName}' using the ADHD Tax method on Time-Blindness Translator. Witness me. 👀 @Aditya_X_Writes`;
    const shareUrl = `https://time-blindness-translator.vercel.app/?challenge=${encodeURIComponent(state.taskName)}&min=${state.actualMinutes}`;
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    const isMobile = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
    const canNativeShare = isMobile && typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    if (canNativeShare) {
      try {
        if (!cardRef.current) throw new Error('No card ref');
        const blob = await toBlob(cardRef.current, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: '#0f172a',
          fontEmbedCSS: '',
        });
        
        let sharePayload: ShareData = {
          title: 'Time-Blindness Translator',
          text: shareText,
          url: shareUrl,
        };

        if (blob) {
          const file = new File([blob], 'mission-launched.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
             sharePayload.files = [file];
          }
        }
        
        await navigator.share(sharePayload);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        window.open(intentUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // Desktop (PC / Mac) fallback OR mobile without share support:
    // Open Twitter intent immediately and synchronously to avoid popup blockers.
    if (typeof window !== 'undefined') {
      window.open(intentUrl, '_blank', 'noopener,noreferrer');
    }

    // Fire-and-forget clipboard copy after window.open
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`).catch(() => {});
    }

    // Generate and download image asynchronously
    if (cardRef.current) {
      toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0f172a',
        fontEmbedCSS: '',
      }).then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `mission-launched-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }).catch(err => {
        console.error('Off-screen image capture failed:', err);
      });
    }
  }, [state.actualMinutes, state.taskName, dispatch]);

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

  const handleRecalculate = useCallback((remainingMinutes: number) => {
    dispatch({ type: 'RECALCULATE_MISSION', payload: { remainingMinutes } });
    setShowRecalculate(false);
  }, [dispatch]);

  // A MotionValue fed into a spring for silky-smooth scaleY transitions
  const fillMV = useMotionValue(
    Math.min(1, msLeft / (state.actualMinutes * 60_000)),
  );
  const scaleSpring = useSpring(fillMV, { stiffness: 28, damping: 16 });

  useEffect(() => {
    if (!state.endTime || state.status !== 'active') return;
    const endTime = state.endTime as number;
    const totalMs = state.actualMinutes * 60_000;

    const id = setInterval(() => {
      const diff = state.activeMission?.status === 'paused' && state.activeMission.pausedAt
         ? endTime - state.activeMission.pausedAt
         : endTime - Date.now();
      
      setMsLeft(diff);
      fillMV.set(Math.max(0, Math.min(1, Math.max(0, diff) / totalMs)));

      if (state.activeMission) {
        const events = getMissionAwarenessEvents(state.activeMission, Date.now());
        setCurrentEvent(events.length > 0 ? events[events.length - 1] : null);
      }
    }, 100);

    return () => clearInterval(id);
  }, [state.endTime, state.actualMinutes, state.status, state.isOvertimeAcknowledged, state.activeMission?.status, state.activeMission?.pausedAt, fillMV, dispatch]);

  const totalMs = state.actualMinutes * 60_000;
  const clampedMsLeft = Math.max(0, msLeft);
  const fillRatio = Math.min(1, Math.max(0, clampedMsLeft / totalMs));
  const pctLeft = Math.round(fillRatio * 100);
  const isOvertime = msLeft <= 0;
  const overtimeMs = Math.abs(msLeft);
  
  // We determine if we are low on time (but not in overtime yet)
  const isLow = fillRatio < 0.22 && !isOvertime && msLeft > 0;
  
  const timeLabel = isOvertime ? formatTime(overtimeMs) : formatTime(msLeft);
  
  // Turn red during overtime
  const blockBg = useMemo(() => isOvertime ? 'rgba(239, 68, 68, 0.2)' : computeBlockColor(fillRatio), [fillRatio, isOvertime]);
  
  const isPaused = state.activeMission?.status === 'paused';
  const isActive = state.status === 'active' && !isPaused;

  useWakeLock(isActive);

  return (
    <div className="flex flex-col items-center justify-between w-full min-h-[85vh] relative pb-[env(safe-area-inset-bottom)]">
      {/* ── Immersive Full-Screen Background ───────────────────────────────── */}
      <div className="fixed inset-0 z-0 bg-slate-900 pointer-events-none" />
      <motion.div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          scaleY: scaleSpring,
          originY: 1,
          backgroundColor: blockBg,
        }}
      />

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center w-full flex-1">
        
        {/* Minimize Button */}
        <div className="w-full flex justify-start p-2">
          <button 
            onClick={() => dispatch({ type: 'MINIMIZE_MISSION' })}
            className="p-3 rounded-full hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,255,255,0.7)' }}
            aria-label="Minimize mission"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </div>

        {/* ── Task banner ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full text-center mt-4"
        >
          <p
            className="text-xs uppercase tracking-widest font-semibold mb-1"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            Currently tackling
          </p>
          <h2
            className="text-2xl font-bold leading-snug text-white"
          >
            {state.taskName || 'Your mission'}
          </h2>
          <p className="text-sm mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {state.actualMinutes} min allocated
          </p>
        </motion.div>

        {/* ── Central Timer Display ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12, duration: 0.4 }}
          className="flex flex-col items-center justify-center flex-1 my-12"
        >
          {/* Accessibility announcement for overtime */}
          <div role="status" aria-live="polite" className="sr-only">
            {isOvertime ? 'Timer is over budget' : ''}
          </div>

          {isOvertime ? (
            <motion.div
              key="overtime-pulse"
              initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { scale: [0.95, 1.05, 1], opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center gap-3"
            >
              <div className="px-5 py-2.5 rounded-full border-[1.5px] border-dashed border-red-400 text-red-400 font-bold tracking-widest uppercase text-xs">
                OVER BUDGET
              </div>
              <p
                className="text-7xl font-black tabular-nums tracking-tighter text-red-500"
                style={{
                  textShadow: '0 4px 32px rgba(239, 68, 68, 0.3)',
                }}
              >
                +{timeLabel}
              </p>
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowRecalculate(true)}
                  className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white font-bold text-sm transition-colors border border-slate-600"
                >
                  Recalculate
                </button>
                <button
                  onClick={() => dispatch({ type: 'ADD_TEN_MINUTES' })}
                  className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white font-bold text-sm transition-colors border border-slate-600"
                >
                  +10m
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2 bg-black/10 px-3 py-1 rounded-full">
                <Timer className="w-3.5 h-3.5 text-white/80" />
                <span className="text-[10px] tracking-widest uppercase text-white/90 font-bold">
                  On Time
                </span>
              </div>
              <p
                className="text-7xl font-black tabular-nums tracking-tighter text-white"
                style={{
                  textShadow: '0 4px 32px rgba(0,0,0,0.15)',
                }}
              >
                {timeLabel}
              </p>
              <p 
                className="text-lg mt-3 font-semibold" 
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {pctLeft}% remaining
              </p>
            </div>
          )}
        </motion.div>

        {/* ── Motivational micro-copy ───────────────────────────────────────── */}
        <div className="w-full mb-6 mt-auto">
          {isLow ? (
            <motion.p
              animate={{ opacity: [0.65, 1, 0.65] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="text-base font-semibold text-center px-4 text-white"
            >
              Almost there — you're doing great! <Zap className="inline w-4 h-4 mb-0.5 ml-0.5" strokeWidth={2.5} />
            </motion.p>
          ) : currentEvent ? (
            <motion.p
              key={currentEvent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-base font-semibold text-center px-4 text-amber-300"
            >
              {currentEvent.title} <AlertCircle className="inline w-4 h-4 mb-0.5 ml-0.5" strokeWidth={2} />
            </motion.p>
          ) : (
            <p
              className="text-sm text-center px-4"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              Stay with it. Your brain is doing the thing. <Brain className="inline w-4 h-4 mb-0.5 ml-0.5" strokeWidth={1.75} />
            </p>
          )}
        </div>

        {/* ── Action Buttons ─────────────────────────────────────────────────── */}
        <div className="w-full flex gap-3 z-10">
          <motion.button
            whileHover={{ scale: 1.03, y: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => dispatch({ type: isPaused ? 'RESUME_MISSION' : 'PAUSE_MISSION' })}
            className="flex items-center justify-center rounded-2xl text-lg font-bold text-white shadow-2xl relative"
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(12px)',
              border: '1.5px solid rgba(255,255,255,0.3)',
              minHeight: 72,
              transition: 'all 300ms ease',
            }}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03, y: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleCompleteTap}
            id="complete-mission-btn"
            className="flex items-center justify-center gap-3 rounded-2xl text-xl font-bold text-white shadow-2xl relative overflow-hidden"
            style={{
              flex: 2,
              background: isCompleting
                ? 'linear-gradient(135deg, #f5a623 0%, #d8880a 100%)'
                : 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(12px)',
              border: isCompleting ? 'none' : '1.5px solid rgba(255,255,255,0.4)',
              minHeight: 72,
              transition: 'all 300ms ease',
            }}
            aria-label={isCompleting ? 'Undo — cancel completion' : 'I completed the task'}
          >
            {isCompleting && (
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 3, ease: 'linear' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.15)',
                  transformOrigin: 'left',
                }}
              />
            )}
            <div className="relative z-10 flex items-center justify-center gap-3 pointer-events-none">
              {isCompleting ? (
                <>
                  <Undo2 className="w-7 h-7 shrink-0" strokeWidth={2.5} />
                  Undo
                </>
              ) : (
                <>
                  <CheckCircle className="w-7 h-7 shrink-0" strokeWidth={2.5} />
                  I Did It!
                </>
              )}
            </div>
          </motion.button>
        </div>

        <p className="text-xs text-center pt-3 pb-2" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {isCompleting
            ? 'Changed your mind? Tap the button above to cancel.'
            : 'Tap any time you finish — even before the timer ends.'}
        </p>
      </div>

      {/* ── Recalculate Flow ───────────────────────── */}
      <AnimatePresence>
        {showRecalculate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-white rounded-[32px] p-8 text-center shadow-2xl flex flex-col gap-6"
              style={{ border: '4px solid var(--color-amber-400)' }}
            >
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-tight">
                  How much longer?
                </h3>
                <p className="text-slate-500 font-medium mt-2 text-sm">
                  Let's recalibrate. How much time is realistically left for this task?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => handleRecalculate(5)}
                  className="w-full py-4 rounded-2xl font-bold text-sm transition-transform active:scale-95 bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  A little (5m)
                </button>
                <button
                  onClick={() => handleRecalculate(15)}
                  className="w-full py-4 rounded-2xl font-bold text-sm transition-transform active:scale-95 bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  About half (15m)
                </button>
                <button
                  onClick={() => handleRecalculate(30)}
                  className="w-full py-4 rounded-2xl font-bold text-sm transition-transform active:scale-95 bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  A lot (30m)
                </button>
                <button
                  onClick={() => {
                    // Not sure - let's add 20m as a generous buffer
                    handleRecalculate(20);
                  }}
                  className="w-full py-4 rounded-2xl font-bold text-sm transition-transform active:scale-95 bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Not sure (20m)
                </button>
              </div>
              
              <button
                onClick={() => setShowRecalculate(false)}
                className="mt-2 text-sm font-semibold text-slate-400 hover:text-slate-600 underline"
              >
                Cancel
              </button>
            </motion.div>
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
            className="fixed inset-x-4 max-w-md mx-auto z-50 p-4 rounded-2xl shadow-2xl border flex flex-col gap-3 bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
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
              <Megaphone className="w-6 h-6 shrink-0" style={{ color: 'var(--color-coral-500)' }} strokeWidth={1.75} />
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
                <Megaphone className="w-4 h-4 shrink-0" strokeWidth={2} /> Witness me!
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

      {/* Off-screen render of Mission Launched card for html-to-image capture */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }} aria-hidden="true">
        <MissionLaunchedCard 
          cardRef={cardRef} 
          taskName={state.taskName} 
          allocatedMin={state.actualMinutes} 
          taxMultiplier={state.taxMultiplier}
          isExactTime={state.isExactTime}
        />
      </div>
    </div>
  );
}
