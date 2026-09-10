'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun, Volume2, VolumeX, History, Headphones, Waves, Brain, Coffee, Heart } from 'lucide-react';
import { useAmbientAudio, type Track } from '@/hooks/useAmbientAudio';
import { TimerProvider, useTimer } from '@/context/TimerContext';
import { useTabProgressIndicator } from '@/hooks/useTabProgressIndicator';
import SetupScreen from '@/components/SetupScreen';
import ActiveTimerScreen from '@/components/ActiveTimerScreen';
import SuccessScreen from '@/components/SuccessScreen';
import TimesUpScreen from '@/components/TimesUpScreen';
import HistoryDrawer from '@/components/HistoryDrawer';
import {
  getThemePreference,
  setThemePreference,
  getMutePreference,
  setMutePreference,
  syncHistoricalData,
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
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      aria-label={label}
      className="rounded-xl p-2 transition-colors"
      style={{ color: '#64748b' }}
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

  // ── Theme state ────────────────────────────────────────────────────────
  const [themePref,    setThemePref]    = useState<ThemePreference>('system');
  const [resolvedDark, setResolvedDark] = useState(false);

  // ── Mute state ─────────────────────────────────────────────────────────
  const [muted, setMuted] = useState(false);

  // ── History drawer ─────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Ambient audio ──────────────────────────────────────────────────────
  const { currentTrack, cycleTrack, setTrack } = useAmbientAudio();

  // ── Tab progress ───────────────────────────────────────────────────────
  useTabProgressIndicator();

  // Hydrate prefs from localStorage after mount (SSR-safe)
  // ── Sync Historical Data & Theme ───────────────────────────────────────────
  useEffect(() => {
    syncHistoricalData();
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
    return () => mq.removeEventListener('change', handleOsThemeChange);
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
      case 'expired': return <TimesUpScreen />;
    }
  }

  const bg         = resolvedDark ? BG_DARK       : BG_LIGHT;
  const headerBg   = resolvedDark ? HEADER_BG_DARK  : HEADER_BG_LIGHT;
  const borderClr  = resolvedDark ? BORDER_DARK     : BORDER_LIGHT;
  const subtitleClr = resolvedDark ? '#a8a29e'       : '#78716c';

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: bg }}>

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
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {/* Brand */}
          <span className="text-2xl select-none" aria-hidden>⏳</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-none text-sm" style={{ color: 'var(--fg)' }}>
              Time-Blindness Translator
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
              for brains that think "15 minutes" is a social construct
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* History */}
            <HeaderIconBtn
              onClick={() => setHistoryOpen(true)}
              label="View task history"
            >
              <History className="w-5 h-5" strokeWidth={2} />
            </HeaderIconBtn>

            {/* Ambient audio cycle */}
            <HeaderIconBtn
              onClick={cycleTrack}
              label={TRACK_LABELS[currentTrack]}
            >
              {TRACK_ICONS[currentTrack]}
            </HeaderIconBtn>

            {/* Mute toggle */}
            <HeaderIconBtn
              onClick={toggleMute}
              label={muted ? 'Unmute completion sound' : 'Mute completion sound'}
            >
              {muted
                ? <VolumeX className="w-5 h-5" strokeWidth={2} />
                : <Volume2 className="w-5 h-5" strokeWidth={2} />
              }
            </HeaderIconBtn>

            {/* Dark mode toggle */}
            <HeaderIconBtn
              onClick={toggleTheme}
              label={resolvedDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedDark
                ? <Sun  className="w-5 h-5" strokeWidth={2} />
                : <Moon className="w-5 h-5" strokeWidth={2} />
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
        className="w-full border-t py-3 text-center"
        style={{
          background:  headerBg,
          borderColor: borderClr,
        }}
      >
        {/* AdSense slot — activate by swapping YOUR_ADSENSE_ID */}
        {/* <ins className="adsbygoogle" data-ad-client="ca-pub-YOUR_ADSENSE_ID" data-ad-slot="XXXXXXXX" data-ad-format="auto" /> */}
        <p className="text-xs" style={{ color: subtitleClr }}>
          Free forever · No accounts · Nothing stored remotely · Made with <Heart className="inline w-3 h-3 mb-0.5 mx-0.5 fill-current" style={{ color: 'var(--color-coral-500)' }} />
        </p>
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
      <AppContent />
    </TimerProvider>
  );
}
