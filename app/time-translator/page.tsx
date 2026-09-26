'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Moon, Sun, Volume2, VolumeX, History, Headphones, Waves, Brain, Coffee, Heart, X } from 'lucide-react';
import { useAmbientAudio, type Track } from '@/hooks/useAmbientAudio';
import { TimerProvider, useTimer } from '@/context/TimerContext';
import { useTabProgressIndicator } from '@/hooks/useTabProgressIndicator';
import SetupScreen from '@/components/SetupScreen';
import ActiveTimerScreen from '@/components/ActiveTimerScreen';
import SuccessScreen from '@/components/SuccessScreen';
import TimesUpScreen from '@/components/TimesUpScreen';
import HistoryDrawer from '@/components/HistoryDrawer';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
      className="rounded-xl p-1.5 sm:p-2 min-w-11 min-h-11 sm:min-w-10 sm:min-h-10 shrink-0 transition-colors flex items-center justify-center outline-none"
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

function SimpleHamburger({ open }: { open: boolean }) {
  return (
    <div className="relative w-5 h-5 flex items-center justify-center">
      <span 
        className="absolute inset-0 flex items-center justify-center transition-all duration-200"
        style={{ 
          opacity: open ? 0 : 1, 
          transform: open ? 'rotate(-90deg) scale(0.5)' : 'rotate(0deg) scale(1)' 
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </span>
      <span 
        className="absolute inset-0 flex items-center justify-center transition-all duration-200"
        style={{ 
          opacity: open ? 1 : 0, 
          transform: open ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0.5)' 
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TBT Mobile Navigation Drawer (Performance Optimized CSS Transitions)
// ---------------------------------------------------------------------------

function TBTMobileDrawer({
  open,
  onClose,
  hasWeeklyReport,
  onOpenHistory,
  currentTrack,
  cycleTrack,
  muted,
  toggleMute,
  themePref,
  resolvedDark,
  toggleTheme,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  hasWeeklyReport: boolean;
  onOpenHistory: () => void;
  currentTrack: Track;
  cycleTrack: () => void;
  muted: boolean;
  toggleMute: () => void;
  themePref: string;
  resolvedDark: boolean;
  toggleTheme: () => void;
  pathname: string;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (open && e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const ambientLabel = {
    'off': 'Off',
    'brown-noise': 'Brown Noise',
    'lofi': 'Lo-fi',
    'cafe': 'Café'
  }[currentTrack];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 md:hidden"
        style={{
          background: 'rgba(0,0,0,0.45)',
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease-out, visibility 200ms ease-out'
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        id="tbt-mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col md:hidden"
        style={{
          width: 'min(340px, 88vw)',
          background: 'var(--card)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid var(--card-border)',
          borderTopLeftRadius: '20px',
          borderBottomLeftRadius: '20px',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: open ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
          visibility: open ? 'visible' : 'hidden',
          transition: 'transform 200ms ease-out, visibility 200ms ease-out',
          willChange: 'transform'
        }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
          <span className="font-bold tracking-widest uppercase text-sm" style={{ color: 'var(--fg)' }}>HYPERDOPA</span>
          <button
            onClick={onClose}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-xl outline-none transition-colors"
            style={{ background: 'var(--bg)', border: '1px solid var(--card-border)' }}
            aria-label="Close menu"
          >
            <X className="w-4 h-4" style={{ color: 'var(--fg)' }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* PRODUCT */}
          <div>
            <h3 className="px-2 text-[11px] font-bold tracking-widest uppercase opacity-50 mb-2" style={{ color: 'var(--fg)' }}>Product</h3>
            <div className="flex flex-col gap-1">
              {[
                { href: '/time-translator', label: 'Time Translator' },
                { href: '/reset-my-day', label: 'Reset My Day' }
              ].map(link => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className="flex items-center justify-between px-4 py-3 rounded-2xl font-semibold text-sm transition-colors min-h-11 outline-none"
                    style={{
                      background: isActive ? 'var(--color-coral-500)14' : 'transparent',
                      color: isActive ? 'var(--color-coral-500)' : 'var(--fg)'
                    }}
                  >
                    {link.label}
                    {isActive && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-coral-500)' }} />}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* TOOLS */}
          <div>
            <h3 className="px-2 text-[11px] font-bold tracking-widest uppercase opacity-50 mb-2" style={{ color: 'var(--fg)' }}>Tools</h3>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => { onOpenHistory(); onClose(); }}
                className="flex items-center justify-between px-4 py-3 rounded-2xl font-semibold text-sm min-h-11 outline-none w-full text-left"
                style={{ color: 'var(--fg)' }}
              >
                <span>Task History</span>
                {hasWeeklyReport && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--color-coral-500)' }} />}
              </button>

              <button
                onClick={cycleTrack}
                className="flex items-center justify-between px-4 py-3 rounded-2xl font-semibold text-sm min-h-11 outline-none w-full text-left"
                style={{ color: 'var(--fg)' }}
              >
                <span>Ambient Sound</span>
                <span className="opacity-60 text-xs">{ambientLabel}</span>
              </button>

              <button
                onClick={toggleMute}
                className="flex items-center justify-between px-4 py-3 rounded-2xl font-semibold text-sm min-h-11 outline-none w-full text-left"
                style={{ color: 'var(--fg)' }}
              >
                <span>Completion Sound</span>
                <span className="opacity-60 text-xs">{muted ? 'Muted' : 'Sound on'}</span>
              </button>

              <button
                onClick={toggleTheme}
                className="flex items-center justify-between px-4 py-3 rounded-2xl font-semibold text-sm min-h-11 outline-none w-full text-left"
                style={{ color: 'var(--fg)' }}
              >
                <span>Appearance</span>
                <span className="opacity-60 text-xs">{resolvedDark ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--card-border)' }}>
            <div className="flex flex-col gap-1">
              {[
                { href: '/', label: 'Home' },
                { href: '/#how-it-works', label: 'How It Works' },
                { href: '/privacy', label: 'Privacy' }
              ].map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="flex items-center px-4 py-3 rounded-2xl font-medium text-sm opacity-80 min-h-11 transition-opacity hover:opacity-100 outline-none"
                  style={{ color: 'var(--fg)' }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 opacity-60 text-xs font-medium border-t" style={{ color: 'var(--fg)', borderColor: 'var(--card-border)' }}>
          <span className="mr-1">⌛</span> Estimate less. Learn time.
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

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
  
  // ── Router ─────────────────────────────────────────────────────────────
  const pathname = usePathname();

  // ── Mobile Nav State ───────────────────────────────────────────────────
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const closeNavDrawer = useCallback(() => setNavDrawerOpen(false), []);

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
        className="sticky top-0 z-20 border-b w-full"
        style={{
          background:       headerBg,
          backdropFilter:   'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderColor:      borderClr,
        }}
      >
        <div className="max-w-5xl mx-auto px-1.5 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-1.5 sm:gap-4 w-full">
          {/* Brand Lockup */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink min-w-0">
            <motion.div 
              whileHover={{ rotate: 15 }} 
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-xl sm:text-2xl select-none cursor-default origin-bottom shrink-0" 
              aria-hidden
            >
              ⏳
            </motion.div>
            <div className="flex flex-col justify-center min-w-0 shrink">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <h1 className="font-bold leading-none text-[11px] sm:text-[13px] tracking-wider sm:tracking-widest uppercase truncate shrink" style={{ color: 'var(--fg)' }}>
                  Time-Blindness Translator
                </h1>
                {/* Context-Aware Branding */}
                {state.status === 'setup' && <span className="hidden sm:inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold bg-coral-500 text-white">Translate Your Day</span>}
                {state.status === 'active' && <span className="hidden sm:inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold bg-amber-500 text-white">Mission In Progress</span>}
                {state.status === 'success' && <span className="hidden sm:inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold bg-emerald-500 text-white">Reality Captured</span>}
              </div>
              <p className="text-[11px] mt-1 hidden sm:block font-medium opacity-80 truncate" style={{ color: subtitleClr }}>
                Translate what you think time is into what it actually is.
              </p>
            </div>
          </div>

          {/* Utility Rail (Desktop Only) */}
          <div 
            className="hidden md:flex items-center gap-0.5 shrink-0 p-1 rounded-2xl shadow-sm" 
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
          
          {/* Mobile Nav Hamburger (Mobile Only) */}
          <div className="md:hidden shrink-0 flex items-center">
            <button
              onClick={() => setNavDrawerOpen(o => !o)}
              className="min-w-11 min-h-11 flex items-center justify-center outline-none"
              aria-label={navDrawerOpen ? "Close menu" : "Open menu"}
              aria-expanded={navDrawerOpen}
              aria-controls="tbt-mobile-drawer"
              style={{ color: navDrawerOpen ? 'var(--color-coral-500)' : 'var(--fg)', opacity: 0.8 }}
            >
              <SimpleHamburger open={navDrawerOpen} />
            </button>
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
        className="relative z-10 w-full border-t py-8 flex flex-col items-center justify-center gap-5 text-center mt-auto pb-[calc(2rem+env(safe-area-inset-bottom))]"
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

      {/* ── Mobile Nav Drawer ────────────────────────────────────────── */}
      <TBTMobileDrawer 
        open={navDrawerOpen} 
        onClose={closeNavDrawer} 
        hasWeeklyReport={hasWeeklyReport}
        onOpenHistory={() => setHistoryOpen(true)}
        currentTrack={currentTrack}
        cycleTrack={cycleTrack}
        muted={muted}
        toggleMute={toggleMute}
        themePref={themePref}
        resolvedDark={resolvedDark}
        toggleTheme={toggleTheme}
        pathname={pathname}
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
