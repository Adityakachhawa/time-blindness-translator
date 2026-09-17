'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Moon, Sun, Volume2, VolumeX, History, Headphones, Waves, Brain, Coffee, Heart } from 'lucide-react';
import { useAmbientAudio, type Track } from '@/hooks/useAmbientAudio';
import { TimerProvider, useTimer } from '@/context/TimerContext';
import { useTabProgressIndicator } from '@/hooks/useTabProgressIndicator';
import SetupScreen from '@/components/SetupScreen';
import ActiveTimerScreen from '@/components/ActiveTimerScreen';
import SuccessScreen from '@/components/SuccessScreen';
import TimesUpScreen from '@/components/TimesUpScreen';
import HistoryDrawer from '@/components/HistoryDrawer';
import ActiveMissionBanner from '@/components/ActiveMissionBanner';
import {
  getThemePreference,
  setThemePreference,
  getMutePreference,
  setMutePreference,
  syncHistoricalData,
  getWeeklyStats,
  getReportLastViewed,
  type ThemePreference,
} from '@/lib/storage';

// ---------------------------------------------------------------------------
// Theme helpers
// ---------------------------------------------------------------------------

function applyThemeToDom(pref: ThemePreference) {
  const el = document.documentElement;
  el.dataset.theme = resolveTheme(pref);
}

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ---------------------------------------------------------------------------
// Background gradients (theme-aware)
// ---------------------------------------------------------------------------

const BG_LIGHT =
  'linear-gradient(160deg, var(--color-cream-50) 0%, var(--color-cream-200) 60%, #eddfc8 100%)';
const BG_DARK =
  'linear-gradient(160deg, #1a1614 0%, #201c1a 60%, #261f1a 100%)';

const HEADER_BG_LIGHT = 'rgba(253, 246, 236, 0.88)';
const HEADER_BG_DARK  = 'rgba(26, 22, 20, 0.88)';
const BORDER_LIGHT    = 'rgba(229, 210, 186, 0.8)';
const BORDER_DARK     = 'rgba(255, 255, 255, 0.08)';

// ---------------------------------------------------------------------------
// Icon button — reusable header control
// ---------------------------------------------------------------------------

function HeaderIconBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, backgroundColor: 'rgba(150,150,150,0.1)' }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-label={label}
      className="rounded-xl p-2 transition-colors flex items-center justify-center outline-none"
      style={{ color: 'var(--fg)', opacity: 0.7 }}
    >
      {children}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// App content (consumes TimerContext)
// ---------------------------------------------------------------------------

// Map ambient track → icon + colour
const TRACK_ICONS: Record<Track, React.ReactNode> = {
  'off':         <Headphones className="w-5 h-5 opacity-50" strokeWidth={2} />,
  'brown-noise': <Waves      className="w-5 h-5 text-amber-600 dark:text-amber-400" strokeWidth={2} />,
  'lofi':        <Brain      className="w-5 h-5 text-purple-600 dark:text-purple-400" strokeWidth={2} />,
  'cafe':        <Coffee     className="w-5 h-5 text-amber-800 dark:text-amber-600" strokeWidth={2} />,
};

const TRACK_LABELS: Record<Track, string> = {
  'off':         'Ambient audio: off',
  'brown-noise': 'Now playing: Brown Noise',
  'lofi':        'Now playing: Lo-fi',
  'cafe':        'Now playing: Café Ambience',
};

function AppContent() {
  const { state } = useTimer();

  // ── Mission Counter ────────────────────────────────────────────────────
  const [dailyCount, setDailyCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch('/api/mission-count');
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.count === 'number' && data.count > 0) {
          setDailyCount(data.count);
        }
      } catch {
        // Silently ignore
      }
    }
    fetchCount();
  }, []);

  // ── Theme state ────────────────────────────────────────────────────────
  const [themePref,    setThemePref]    = useState<ThemePreference>('system');
  const [resolvedDark, setResolvedDark] = useState(false);

  // ── Mute state ─────────────────────────────────────────────────────────
  const [muted, setMuted] = useState(false);

  // ── History drawer ─────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hasWeeklyReport, setHasWeeklyReport] = useState(false);

  // ── Ambient audio ──────────────────────────────────────────────────────
  const { currentTrack, cycleTrack, setTrack } = useAmbientAudio();

  // ── Tab progress ───────────────────────────────────────────────────────
  useTabProgressIndicator();

  // Hydrate prefs from localStorage after mount (SSR-safe)
  // ── Sync Historical Data & Theme ───────────────────────────────────────────
  useEffect(() => {
    syncHistoricalData();
    
    const checkReportBadge = () => {
      const stats = getWeeklyStats();
      const lastViewed = getReportLastViewed();
      const isRecent = Date.now() - lastViewed < 24 * 60 * 60 * 1000;
      setHasWeeklyReport(stats.totalMissions > 0 && !isRecent);
    };
    checkReportBadge();

    window.addEventListener('tbt_report_viewed', checkReportBadge);

    setMuted(getMutePreference());
    const storedTheme = getThemePreference();
    applyThemeToDom(storedTheme);
    setThemePref(storedTheme);
    setResolvedDark(resolveTheme(storedTheme) === 'dark');

    const handleThemeChange = () => {
      const current = getThemePreference();
      if (current === 'system') {
        applyThemeToDom('system');
        setResolvedDark(resolveTheme('system') === 'dark');
      }
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleOsThemeChange = () => {
      if (getThemePreference() === 'system') {
        const resolved = mq.matches ? 'dark' : 'light';
        document.documentElement.dataset.theme = resolved;
        setResolvedDark(resolved === 'dark');
      }
    };
    mq.addEventListener('change', handleOsThemeChange);
    return () => {
      mq.removeEventListener('change', handleOsThemeChange);
      window.removeEventListener('tbt_report_viewed', checkReportBadge);
    };
  }, []);

  // ── Toggle handlers ────────────────────────────────────────────────────

  const toggleTheme = useCallback(() => {
    setThemePref(prev => {
      const next: ThemePreference =
        prev === 'dark' ? 'light' : 'dark';
      setThemePreference(next);
      applyThemeToDom(next);
      setResolvedDark(next === 'dark');
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      setMutePreference(next);
      return next;
    });
  }, []);

  // Screen router
  function renderScreen() {
    switch (state.status) {
      case 'setup':   return <SetupScreen setTrack={setTrack} />;
      case 'active':  return <ActiveTimerScreen />;
      case 'success': return <SuccessScreen />;
      case 'expired': return <ActiveTimerScreen />;
    }
  }

  const bg         = resolvedDark ? BG_DARK       : BG_LIGHT;
  const headerBg   = resolvedDark ? HEADER_BG_DARK  : HEADER_BG_LIGHT;
  const borderClr  = resolvedDark ? BORDER_DARK     : BORDER_LIGHT;
  const subtitleClr = resolvedDark ? '#a8a29e'       : '#78716c';

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: bg }}>
      <ActiveMissionBanner />

      {/* ── Sticky header ───────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          background:       headerBg,
          backdropFilter:   'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderColor:      borderClr,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Brand Lockup */}
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <motion.div 
              whileHover={{ rotate: 15 }} 
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-2xl select-none cursor-default origin-bottom" 
              aria-hidden
            >
              ⏳
            </motion.div>
            <div className="flex flex-col justify-center min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold leading-none text-[13px] tracking-widest uppercase truncate" style={{ color: 'var(--fg)' }}>
                  Time-Blindness Translator
                </h1>
                {/* Context-Aware Branding */}
                {state.status === 'setup' && <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold bg-coral-500 text-white">Translate Your Day</span>}
                {state.status === 'active' && <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold bg-amber-500 text-white">Mission In Progress</span>}
                {state.status === 'success' && <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold bg-emerald-500 text-white">Reality Captured</span>}
              </div>
              <p className="text-[11px] mt-1 hidden sm:block font-medium opacity-80 truncate" style={{ color: subtitleClr }}>
                Translate what you think time is into what it actually is.
              </p>
            </div>
          </div>

          {/* Utility Rail */}
          <div 
            className="flex items-center gap-0.5 shrink-0 p-1 rounded-2xl shadow-sm" 
            style={{ background: resolvedDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${borderClr}` }}
          >
            {/* History */}
            <HeaderIconBtn
              onClick={() => setHistoryOpen(true)}
              label="View task history"
            >
              <div className="relative">
                <History className="w-4 h-4" strokeWidth={2.5} />
                {hasWeeklyReport && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2" 
                       style={{ background: 'var(--color-coral-500)', borderColor: headerBg }} 
                  />
                )}
              </div>
            </HeaderIconBtn>

            {/* Ambient audio cycle */}
            <HeaderIconBtn
              onClick={cycleTrack}
              label={TRACK_LABELS[currentTrack]}
            >
              <div className="scale-90">{TRACK_ICONS[currentTrack]}</div>
            </HeaderIconBtn>

            {/* Mute toggle */}
            <HeaderIconBtn
              onClick={toggleMute}
              label={muted ? 'Unmute completion sound' : 'Mute completion sound'}
            >
              {muted
                ? <VolumeX className="w-4 h-4" strokeWidth={2.5} />
                : <Volume2 className="w-4 h-4" strokeWidth={2.5} />
              }
            </HeaderIconBtn>

            {/* Dark mode toggle */}
            <HeaderIconBtn
              onClick={toggleTheme}
              label={resolvedDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedDark
                ? <Sun  className="w-4 h-4" strokeWidth={2.5} />
                : <Moon className="w-4 h-4" strokeWidth={2.5} />
              }
            </HeaderIconBtn>
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main
        id="main-content"
        className="flex-1 w-full max-w-lg mx-auto px-4 pt-8 pb-24"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={state.status}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="w-full"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer
        className="w-full border-t py-8 flex flex-col items-center justify-center gap-5 text-center mt-auto pb-[calc(2rem+env(safe-area-inset-bottom))]"
        style={{
          background:  headerBg,
          borderColor: borderClr,
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-semibold tracking-wide flex items-center" style={{ color: 'var(--fg)' }}>
            <span className="opacity-75 mr-2 select-none text-base">⌛</span>Estimate less. Learn your time.
          </p>
          <div className="flex items-center gap-2 text-[11px] opacity-60 font-medium" style={{ color: 'var(--fg)' }}>
            <span>Local-first</span>
            <span className="opacity-40">·</span>
            <span>No account</span>
            <span className="opacity-40">·</span>
            <span>Your data stays on this device</span>
          </div>
        </div>
        
        {dailyCount !== null && (
          <motion.p 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="text-[10px] font-bold tracking-widest opacity-40 uppercase" 
            style={{ color: 'var(--fg)' }}
          >
            {dailyCount.toLocaleString()} missions translated today
          </motion.p>
        )}
      </footer>

      {/* ── History drawer ───────────────────────────────────────────── */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------

export default function Home() {
  return (
    <TimerProvider>
      <MotionConfig reducedMotion="user">
        <AppContent />
      </MotionConfig>
    </TimerProvider>
  );
}
