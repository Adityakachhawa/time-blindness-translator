'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Download, GraduationCap, Moon, Music, RotateCcw, Smartphone, Sparkles, Timer, Trophy, Tv2, Brain, Zap, CheckCircle2, ChevronDown, Link2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import confetti from 'canvas-confetti';
import { useTimer } from '@/context/TimerContext';
import { getAnchors } from '@/lib/calculations';
import { 
  getMutePreference, 
  getLifetimeStats, 
  getCurrentStreak, 
  getUnlockedTrophies, 
  unlockTrophy,
  getTaskHistory,
  getRecentUniqueTasks,
  type RecentTask,
} from '@/lib/storage';
import { calculatePersonalFactor } from '@/lib/calibration';
import { MILESTONES, type Milestone } from '@/lib/milestones';
import { playGentleBell } from '@/lib/audio';
import TrophySnackbar from '@/components/TrophySnackbar';
import type { CertTheme } from '@/types/timer';

// ---------------------------------------------------------------------------
// Calibration snapshot
// ---------------------------------------------------------------------------

interface CalibrationSnapshot {
  headline: string;
  hasFactor: boolean;
  factor: number | null;
  sampleCount: number;
  tier: 'exact' | 'category' | 'global' | null;
  exactMatchCount: number;
  exactMatchNeeded: number;
}

function buildCalibrationSnapshot(
  taskName: string,
  category: any,
  prevFactor: number | null | undefined,
): CalibrationSnapshot {
  const history = getTaskHistory();
  const exactMatchCount = history.filter(
    r => r.taskName.toLowerCase().trim() === taskName.toLowerCase().trim()
  ).length;
  const exactMatchNeeded = Math.max(0, 2 - exactMatchCount);
  const result = calculatePersonalFactor(taskName, category);
  if (!result) {
    return { headline: 'Building Your Time Model', hasFactor: false, factor: null, sampleCount: exactMatchCount, tier: null, exactMatchCount, exactMatchNeeded };
  }
  const isNewlyUnlocked = prevFactor === null || prevFactor === undefined;
  return {
    headline: isNewlyUnlocked ? 'Calibration Unlocked' : 'Your Time Model',
    hasFactor: true, factor: result.factor, sampleCount: result.sampleCount, tier: result.tier,
    exactMatchCount, exactMatchNeeded,
  };
}

// ---------------------------------------------------------------------------
// Accuracy badge
// ---------------------------------------------------------------------------

interface AccuracyInfo { percent: number; label: string; subLabel: string; color: string; }

function buildAccuracy(calibratedMin: number, coreActualMin: number): AccuracyInfo {
  if (calibratedMin <= 0) return { percent: 0, label: 'You were spot on.', subLabel: '', color: 'var(--color-sage-500)' };
  const diff = coreActualMin - calibratedMin;
  const percent = Math.round(Math.abs(diff) / calibratedMin * 100);
  const label = percent === 0 ? 'You were spot on.'
    : diff > 0 ? `You underestimated by ${percent}%.`
    : `You overestimated by ${percent}%.`;
  const subLabel = percent === 0 ? '' : 'Useful data — your next estimate can learn from this.';
  const color = percent < 10 ? 'var(--color-sage-500)' : percent < 25 ? 'var(--color-amber-400)' : percent < 50 ? '#fb923c' : 'var(--color-lavender-500)';
  return { percent, label, subLabel, color };
}

// ---------------------------------------------------------------------------
// Static chain task fallbacks
// ---------------------------------------------------------------------------

const STATIC_TEMPLATES: RecentTask[] = [
  { taskName: 'Clear inbox', initialEstimate: 20 },
  { taskName: 'Wash dishes', initialEstimate: 10 },
  { taskName: 'Quick tidy', initialEstimate: 15 },
];

// ---------------------------------------------------------------------------
// Confetti burst — warm palette, no default green/red
// ---------------------------------------------------------------------------

function fireCelebrationConfetti() {
  const warmColors = ['#f2815a', '#7daf9c', '#a78bca', '#f5a623', '#fdf6ec', '#f9c45a'];
  const end = Date.now() + 3500;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin:     { x: 0, y: 0.65 },
      colors:     warmColors,
      scalar:     1.1,
      gravity:    0.9,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin:     { x: 1, y: 0.65 },
      colors:     warmColors,
      scalar:     1.1,
      gravity:    0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

function fireMilestoneConfetti() {
  const milestoneColors = ['#ffd700', '#ff8c00', '#ff0080', '#00ff00', '#00bfff', '#9400d3'];
  const end = Date.now() + 6000; // 6 seconds for milestones

  (function frame() {
    confetti({
      particleCount: 8, // Denser
      angle: 60,
      spread: 80,
      origin: { x: 0, y: 0.8 },
      colors: milestoneColors,
      scalar: 1.2,
      gravity: 0.8,
    });
    confetti({
      particleCount: 8,
      angle: 120,
      spread: 80,
      origin: { x: 1, y: 0.8 },
      colors: milestoneColors,
      scalar: 1.2,
      gravity: 0.8,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// ---------------------------------------------------------------------------
// Certificate Themes & Styles
// ---------------------------------------------------------------------------

const CERT_EXPORT_BG: Record<CertTheme, string> = {
  classic: '#fdf9f3',
  dark:    '#1e293b',
  chaos:   '#fecfef',
};

interface CertThemeStyle {
  containerBg:     string;
  containerBorder: string;
  innerBorder:     string;
  flourishColor:   string;
  flourishOpacity: number;
  headerSub:       string;
  divider:         string;
  awardText:       string;
  taskIntro:       string;
  taskTitle:       string;
  statsBg:         string;
  statsBorder:     string;
  statsVal:        string;
  statsLabel:      string;
  statsDivider:    string;
  tagline:         string;
  footer:          string;
}

const THEME_STYLES: Record<CertTheme, CertThemeStyle> = {
  classic: {
    containerBg:     'linear-gradient(140deg, #fdf9f3 0%, #fdf6ec 50%, #f3dfc0 100%)',
    containerBorder: '3px solid #f2815a',
    innerBorder:     '1px solid rgba(242,129,90,0.35)',
    flourishColor:   '#78716c',
    flourishOpacity: 0.25,
    headerSub:       '#78716c',
    divider:         '#f2815a',
    awardText:       '#a8a29e',
    taskIntro:       '#78716c',
    taskTitle:       '#1e293b',
    statsBg:         'rgba(125,175,156,0.12)',
    statsBorder:     '1px solid rgba(125,175,156,0.3)',
    statsVal:        '#1e293b',
    statsLabel:      '#78716c',
    statsDivider:    'rgba(0,0,0,0.1)',
    tagline:         '#475569',
    footer:          '#a8a29e',
  },
  dark: {
    containerBg:     'linear-gradient(140deg, #1e293b 0%, #0f172a 100%)',
    containerBorder: '3px solid #818cf8',
    innerBorder:     '1px solid rgba(129, 140, 248, 0.35)',
    flourishColor:   '#818cf8',
    flourishOpacity: 0.35,
    headerSub:       '#94a3b8',
    divider:         '#818cf8',
    awardText:       '#64748b',
    taskIntro:       '#94a3b8',
    taskTitle:       '#f8fafc',
    statsBg:         'rgba(129, 140, 248, 0.12)',
    statsBorder:     '1px solid rgba(129, 140, 248, 0.3)',
    statsVal:        '#f8fafc',
    statsLabel:      '#94a3b8',
    statsDivider:    'rgba(255,255,255,0.12)',
    tagline:         '#cbd5e1',
    footer:          '#64748b',
  },
  chaos: {
    containerBg:     'linear-gradient(135deg, #ff9a9e 0%, #fecfef 40%, #a1c4fd 70%, #c2e9fb 100%)',
    containerBorder: '3px solid #ec4899',
    innerBorder:     '1px solid rgba(236, 72, 153, 0.35)',
    flourishColor:   '#be185d',
    flourishOpacity: 0.4,
    headerSub:       '#831843',
    divider:         '#ec4899',
    awardText:       '#9d174d',
    taskIntro:       '#831843',
    taskTitle:       '#1e1b4b',
    statsBg:         'rgba(255, 255, 255, 0.55)',
    statsBorder:     '1px solid rgba(236, 72, 153, 0.35)',
    statsVal:        '#1e1b4b',
    statsLabel:      '#831843',
    statsDivider:    'rgba(236, 72, 153, 0.2)',
    tagline:         '#312e81',
    footer:          '#831843',
  },
};

// ---------------------------------------------------------------------------
// Certificate component (captured by html-to-image)
// ---------------------------------------------------------------------------

interface CertificateProps {
  taskName:  string;
  episodes:  string;
  songs:     string;
  tagline:   string;
  dateStr:   string;
  certRef:   React.RefObject<HTMLDivElement | null>;
  theme:     CertTheme;
  milestone: Milestone | null;
}

function AdultingCertificate({
  taskName, episodes, songs, tagline, dateStr, certRef, theme, milestone,
}: CertificateProps) {
  const s = THEME_STYLES[theme] ?? THEME_STYLES.classic;

  return (
    <div
      ref={certRef}
      style={{
        // Fully self-contained inline styles so html-to-image captures correctly
        width: '100%',
        maxWidth: 640,
        minHeight: 320,
        margin: '0 auto',
        background: s.containerBg,
        border: s.containerBorder,
        borderRadius: 24,
        padding: 'clamp(20px, 5vw, 40px) clamp(16px, 5vw, 44px)',
        fontFamily: 'Georgia, "Times New Roman", serif',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: 'all 250ms ease',
      }}
    >
      {/* Decorative corner flourishes */}
      <div style={{ position: 'absolute', top: 12, left: 14, fontSize: 28, color: s.flourishColor, opacity: s.flourishOpacity }}>✦</div>
      <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 28, color: s.flourishColor, opacity: s.flourishOpacity }}>✦</div>
      <div style={{ position: 'absolute', bottom: 12, left: 14, fontSize: 28, color: s.flourishColor, opacity: s.flourishOpacity }}>✦</div>
      <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 28, color: s.flourishColor, opacity: s.flourishOpacity }}>✦</div>

      {/* Inner border line */}
      <div style={{
        position: 'absolute', inset: 10,
        border: s.innerBorder,
        borderRadius: 18,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <p style={{
          fontSize: 11, letterSpacing: 4, textTransform: 'uppercase',
          color: s.headerSub, fontFamily: 'Georgia, serif', margin: 0,
        }}>
          Official Certificate of Achievement
        </p>
        <div style={{ margin: '10px auto', width: 60, height: 2, background: s.divider, borderRadius: 99 }} />
        <p style={{
          fontSize: 13, color: s.awardText, margin: 0, fontStyle: 'italic',
        }}>
          Awarded to a genuinely remarkable human being
        </p>
      </div>

      {/* Task name */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: s.taskIntro, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 2 }}>
          For the heroic completion of
        </p>
        <p style={{
          fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 'bold', color: s.taskTitle,
          margin: '0 0 4px', lineHeight: 1.2, wordBreak: 'break-word' as const,
        }}>
          "{taskName}"
        </p>
      </div>

      {/* Anchor stats */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 'clamp(16px, 4vw, 32px)',
        background: s.statsBg,
        borderRadius: 14, padding: 'clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px)',
        marginBottom: 20, border: s.statsBorder,
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 'bold', color: s.statsVal }}>{episodes}</p>
           <p style={{ margin: 0, fontSize: 11, color: s.statsLabel, textTransform: 'uppercase', letterSpacing: 1 }}>
              <Tv2 style={{ display: 'inline', width: 10, height: 10, marginRight: 4 }} /> episodes
            </p>
        </div>
        <div style={{ width: 1, background: s.statsDivider }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 'bold', color: s.statsVal }}>{songs}</p>
           <p style={{ margin: 0, fontSize: 11, color: s.statsLabel, textTransform: 'uppercase', letterSpacing: 1 }}>
              <Music style={{ display: 'inline', width: 10, height: 10, marginRight: 4 }} /> songs
            </p>
        </div>
      </div>

      {/* Tagline or Milestone Badge */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        {milestone ? (
          <div style={{ 
            display: 'inline-block', 
            background: 'linear-gradient(135deg, #f5a623 0%, #f2815a 100%)', 
            color: 'white', 
            padding: '8px 20px', 
            borderRadius: 99, 
            boxShadow: '0 4px 12px rgba(242,129,90,0.3)' 
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>🌟 {milestone.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 14, fontStyle: 'italic', opacity: 0.95 }}>{milestone.tagline}</p>
          </div>
        ) : (
          <p style={{
            fontSize: 'clamp(14px, 3vw, 17px)', fontStyle: 'italic', color: s.tagline,
            lineHeight: 1.5, margin: 0,
          }}>
            "{tagline}"
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <p style={{ fontSize: 11, color: s.footer, margin: 0 }}>
          Time-Blindness Translator
        </p>
        <p style={{ fontSize: 11, color: s.footer, margin: 0 }}>
          {dateStr}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function SuccessScreen() {
  const { state, dispatch } = useTimer();
  const prefersReducedMotion = useReducedMotion();
  const certRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [certTheme,   setCertTheme]   = useState<CertTheme>('classic');
  const [shareUrl,    setShareUrl]    = useState('');
  const [waShareUrl,  setWaShareUrl]  = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [milestone,   setMilestone]   = useState<Milestone | null>(null);
  const [unlockedTrophyId, setUnlockedTrophyId] = useState<string | null>(null);

  // Chain task
  const [chainDismissed, setChainDismissed] = useState(false);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [selectedChainTask, setSelectedChainTask] = useState('');
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);

  // Calibration snapshot
  const [calibration, setCalibration] = useState<CalibrationSnapshot | null>(null);

  const anchors     = getAnchors(state.actualMinutes);
  const episodesStr = anchors.popCulture.value.toFixed(1);
  const songsStr    = anchors.music.value.toFixed(1);
  const tagline     = state.tagline ?? 'Executive function? Briefly detected.';
  const dateStr     = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

function formatPreciseDuration(totalSeconds: number | undefined, fallbackMinutes: number): string {
  if (totalSeconds === undefined) return `${fallbackMinutes}m`;
  
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) {
    if (s === 0) return `${m}m`;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }
  return `${s}s`;
}

  // ---------------------------------------------------------------------------
  // Three-value Reality Check
  // ---------------------------------------------------------------------------
  // originalMin  — the user's raw estimate before any ADHD tax (immutable)
  // calibratedMin — the initial ADHD-taxed prediction, snapshotted at mission
  //                  start and NEVER overwritten by extensions or recalculations
  // actualMin    — real elapsed time derived from completion timestamps
  // ---------------------------------------------------------------------------
  const originalMin   = state.optimisticMin ?? state.initialEstimate;
  const calibratedMin = state.initialCalibratedMin ?? state.actualMinutes;
  
  // For accuracy calculations, we use unrounded minutes to preserve precise seconds.
  const actualUnroundedMin = state.actualSeconds
    ? (state.actualSeconds / 60)
    : (state.initialCalibratedMin ?? state.actualMinutes);
    
  const transitionMin = state.transitionMinutes || 0;
  const coreActualUnroundedMin = Math.max(0, actualUnroundedMin - transitionMin);
  const accuracy      = buildAccuracy(calibratedMin, coreActualUnroundedMin);
  
  // For display
  const actualDisplayStr = formatPreciseDuration(state.actualSeconds, state.initialCalibratedMin ?? state.actualMinutes);

  // Reduced-motion card animation helper
  const rm = prefersReducedMotion;
  const cardAnim = (delay: number) => rm
    ? { initial: { opacity: 0 as const }, animate: { opacity: 1 as const }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0 as const, y: 18 }, animate: { opacity: 1 as const, y: 0 }, transition: { delay, duration: 0.32, ease: 'easeOut' as const } };

  // One-shot mount effect — completeMission() already saved the record via actions.ts
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    // Milestone evaluation
    const currentStats    = getLifetimeStats();
    const currentStreak   = getCurrentStreak();
    const unlockedTrophies = getUnlockedTrophies();

    let hitMilestone: Milestone | null = null;
    for (const m of MILESTONES) {
      if (unlockedTrophies.some(t => t.id === m.id)) continue;
      let achieved = false;
      if (m.type === 'lifetime-tasks' && currentStats.totalTasks >= m.threshold) achieved = true;
      else if (m.type === 'streak' && currentStreak >= m.threshold) achieved = true;
      if (achieved) { hitMilestone = m; unlockTrophy(m.id); setUnlockedTrophyId(m.id); break; }
    }

    if (hitMilestone) { setMilestone(hitMilestone); playGentleBell(getMutePreference()); fireMilestoneConfetti(); }
    else { playGentleBell(getMutePreference()); fireCelebrationConfetti(); }

    // Calibration snapshot (reads freshly-saved history)
    setCalibration(buildCalibrationSnapshot(state.taskName, state.category, state.personalFactor));

    // Chain task suggestions (exclude just-completed task)
    const recent = getRecentUniqueTasks(4)
      .filter(t => t.taskName.toLowerCase().trim() !== state.taskName.toLowerCase().trim())
      .slice(0, 3);
    const opts = recent.length > 0 ? recent : STATIC_TEMPLATES;
    setRecentTasks(opts);
    if (opts.length > 0) setSelectedChainTask(opts[0].taskName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build share URLs on mount (client-only — window.location)
  useEffect(() => {
    const text = state.wasAnnounced
      ? `Said I'd do it in ${state.actualMinutes}. Witness me. ✅ Delivered.\n\n"${state.taskName}" complete.`
      : `I just completed "${state.taskName}" in ${episodesStr} episodes of The Office! ✅\n\n` +
        `Time-Blindness Translator keeps my ADHD brain honest 🧠⏳\n\n` +
        `@Aditya_X_Writes`;
    setShareUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
    setWaShareUrl(`https://wa.me/?text=${encodeURIComponent(text)}`);
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, [state.taskName, episodesStr]);

  // Native share handler
  const handleNativeShare = useCallback(async () => {
    const text = state.wasAnnounced
      ? `Said I'd do it in ${state.actualMinutes}. Witness me. ✅ Delivered.\n\n"${state.taskName}" complete.`
      : `I just completed "${state.taskName}" in ${episodesStr} episodes of The Office! ✅\n\n` +
        `Time-Blindness Translator keeps my ADHD brain honest 🧠⏳`;
    try {
      await navigator.share({ title: 'My Mission', text });
    } catch {
      // User cancelled or share failed — silently ignore
    }
  }, [state.taskName, episodesStr]);

  // Download certificate as PNG
  const handleDownload = useCallback(async () => {
    if (!certRef.current || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(certRef.current, {
        cacheBust:      true,
        pixelRatio:     2,
        backgroundColor: CERT_EXPORT_BG[certTheme],
        // Skip the CSSOM font-face walk entirely — it throws a SecurityError
        // when dev-mode or browser-extension stylesheets are cross-origin.
        fontEmbedCSS:   '',
        // Prevent layout shifts during the off-screen capture clone
        style: { transform: 'scale(1)' },
      });
      const link    = document.createElement('a');
      link.download = `adulting-certificate-${Date.now()}.png`;
      link.href     = dataUrl;
      link.click();
    } catch (err) {
      console.error('Certificate export failed:', err);
      // Surface a human-readable message rather than a hard crash / silent void
      alert(
        "Couldn't export the certificate right now — try right-clicking the card and selecting 'Save image as' instead.",
      );
    } finally {
      setDownloading(false);
    }
  }, [downloading, certTheme]);

  // Chain task: dispatch CHAIN_MISSION (no page reload)
  const handleChainTask = useCallback((taskName: string) => {
    dispatch({ type: 'CHAIN_MISSION', payload: { taskName } });
  }, [dispatch]);

  const handleNewMission = useCallback(() => {
    dispatch({ type: 'CHAIN_MISSION' });
  }, [dispatch]);

  // Calibration display helpers
  const tierLabel =
    calibration?.tier === 'exact'    ? 'exact task match'
    : calibration?.tier === 'category' ? 'category match'
    : calibration?.tier === 'global'   ? 'global pattern'
    : null;
  const nextEstimate = calibration?.hasFactor && calibration.factor
    ? Math.round(originalMin * calibration.factor)
    : null;

  return (
    <div className="flex flex-col items-center gap-6 w-full pb-[calc(1rem+env(safe-area-inset-bottom))]">

      {/* 1. Celebration */}
      <motion.div
        initial={rm ? { opacity: 0 } : { opacity: 0, scale: 0.7, rotate: -8 }}
        animate={rm ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
        transition={rm ? { duration: 0.15 } : { type: 'spring', stiffness: 200, damping: 14 }}
        className="text-center"
      >
        <Trophy className="w-16 h-16 block mb-3 mx-auto" style={{ color: 'var(--color-amber-400)', filter: 'drop-shadow(0 4px 12px rgba(245,166,35,0.4))' }} />
        <h2 className="text-3xl font-black leading-tight text-white">You actually did it.</h2>
        <p className="mt-2 text-base text-gray-200">
          <strong style={{ color: 'var(--color-coral-500)' }}>{state.taskName}</strong>{' '}— officially complete. No cap.
        </p>
      </motion.div>

      {/* 2. Reality Check — Original / Calibrated / Reality */}
      <motion.div
        {...cardAnim(0.1)}
        className="w-full max-w-md mx-auto rounded-3xl p-5 text-center"
        style={{ background: 'linear-gradient(135deg, var(--color-ink-900) 0%, var(--color-ink-800) 100%)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', color: 'white' }}
      >
        <p className="text-xs uppercase tracking-widest font-bold mb-4" style={{ color: 'var(--color-coral-400)' }}>Reality Check</p>
        <div className="flex justify-center items-stretch mb-4 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex-1 flex flex-col items-center justify-center py-4 px-2" style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-3xl font-black tabular-nums">{originalMin}<span className="text-sm text-gray-400 ml-1">m</span></p>
            <p className="text-[10px] uppercase tracking-widest mt-1 opacity-80">Original</p>
            <p className="text-[10px] mt-0.5 opacity-60">your estimate</p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center py-4 px-2" style={{ background: 'rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-3xl font-black tabular-nums" style={{ color: 'var(--color-amber-400)' }}>{calibratedMin}<span className="text-sm opacity-60 ml-1">m</span></p>
            <p className="text-[10px] uppercase tracking-widest mt-1 opacity-80">Calibrated</p>
            <p className="text-[10px] mt-0.5 opacity-60">after ADHD tax</p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center py-4 px-2">
            <p className="text-3xl font-black tabular-nums text-white">{actualDisplayStr}</p>
            <p className="text-[10px] uppercase tracking-widest mt-1 opacity-80">Reality</p>
            <p className="text-[10px] mt-0.5 opacity-60">what happened</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)', border: `1.5px solid ${accuracy.color}30` }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: accuracy.color }} />
            <p className="text-sm font-semibold" style={{ color: accuracy.color }}>{accuracy.label}</p>
          </div>
          {accuracy.subLabel && <p className="text-xs opacity-60">{accuracy.subLabel}</p>}
          {transitionMin > 0 && <p className="text-xs opacity-40">Includes {transitionMin} min prep buffer</p>}
        </div>
      </motion.div>

      {/* 3. Calibration insight */}
      {calibration && (
        <motion.div
          {...cardAnim(0.22)}
          className="w-full max-w-md mx-auto rounded-3xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(129,140,248,0.12) 0%, rgba(167,139,202,0.10) 100%)', border: '1.5px solid rgba(129,140,248,0.25)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 shrink-0" style={{ color: 'var(--color-lavender-500)' }} strokeWidth={2} />
            <p className="font-bold text-sm" style={{ color: 'var(--fg)' }}>🧠 {calibration.headline}</p>
          </div>
          {calibration.hasFactor && calibration.factor ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-70">Personal factor</span>
                <span className="font-bold tabular-nums" style={{ color: 'var(--color-lavender-500)' }}>{calibration.factor.toFixed(2)}×</span>
              </div>
              {tierLabel && (
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-70">Based on</span>
                  <span className="font-semibold text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(129,140,248,0.2)', color: 'var(--color-lavender-500)' }}>
                    {calibration.sampleCount} sessions · {tierLabel}
                  </span>
                </div>
              )}
              {nextEstimate && (
                <div className="mt-1 rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="opacity-60">Next time you say </span>
                  <span className="font-semibold">{originalMin} min</span>
                  <span className="opacity-60"> → estimated </span>
                  <span className="font-bold" style={{ color: 'var(--color-lavender-500)' }}>{nextEstimate} min</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (calibration.exactMatchCount / 2) * 100)}%`, background: 'linear-gradient(90deg, var(--color-lavender-500), var(--color-coral-500))', transition: 'width 0.6s ease' }} />
              </div>
              <p className="text-xs opacity-60">
                {calibration.exactMatchCount === 0
                  ? `Complete "${state.taskName}" 2 more times to unlock exact-match calibration.`
                  : calibration.exactMatchNeeded === 1
                  ? `1 more session with "${state.taskName}" unlocks exact calibration.`
                  : `${calibration.exactMatchCount} of 2 sessions recorded.`}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* 4. Keep the Momentum (chain task) */}
      {!chainDismissed && (
        <motion.div
          {...cardAnim(0.34)}
          className="w-full max-w-md mx-auto rounded-3xl p-5"
          style={{ background: 'linear-gradient(135deg, rgba(125,175,156,0.14) 0%, rgba(125,175,156,0.08) 100%)', border: '1.5px solid rgba(125,175,156,0.3)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-5 h-5 shrink-0" style={{ color: 'var(--color-sage-500)' }} strokeWidth={2} />
            <p className="font-bold text-sm" style={{ color: 'var(--fg)' }}>Keep the Momentum</p>
            <button className="ml-auto text-xs opacity-40 hover:opacity-70 transition-opacity" style={{ color: 'var(--fg)' }} onClick={() => setChainDismissed(true)} aria-label="Dismiss">✕</button>
          </div>
          <p className="text-xs opacity-60 mb-3">You're in the zone — what's next?</p>
          <div className="flex flex-col gap-2.5">
            {recentTasks.map((t) => (
              <motion.button
                key={t.taskName}
                whileHover={rm ? {} : { scale: 1.02, y: -1 }}
                whileTap={rm ? {} : { scale: 0.97 }}
                onClick={() => handleChainTask(t.taskName)}
                className="w-full flex items-center justify-between gap-2 rounded-xl px-4 py-3.5 text-left text-sm font-bold shadow-sm"
                style={{
                  background: 'var(--card)',
                  border: '1.5px solid var(--card-border)',
                  color: 'var(--fg)',
                }}
                aria-label={`Start next task: ${t.taskName}`}
              >
                <span className="truncate">{t.taskName}</span>
                <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--color-sage-500)' }}>
                  <span className="text-[10px] uppercase tracking-wider font-black opacity-80">Start</span>
                  <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}



      {/* 6. Adulting Certificate */}
      <motion.div {...cardAnim(0.5)} className="w-full max-w-md mx-auto">
        <AdultingCertificate certRef={certRef} taskName={state.taskName} episodes={episodesStr} songs={songsStr} tagline={tagline} dateStr={dateStr} theme={certTheme} milestone={milestone} />
      </motion.div>

      {/* 7. Actions */}
      <motion.div {...cardAnim(0.58)} className="flex flex-col gap-3 w-full">
        <div role="radiogroup" aria-label="Certificate Theme" className="grid grid-cols-3 w-full gap-1 p-1.5 rounded-2xl" style={{ background: 'var(--card)', border: '1.5px solid var(--card-border)', backdropFilter: 'blur(8px)' }}>
          {([{ id: 'classic', label: 'Classic', Icon: GraduationCap }, { id: 'dark', label: 'Night', Icon: Moon }, { id: 'chaos', label: 'Chaos', Icon: Sparkles }] as const).map(t => {
            const active = certTheme === t.id;
            return (
              <motion.button key={t.id} whileHover={rm ? {} : { scale: 1.02 }} whileTap={rm ? {} : { scale: 0.96 }} type="button" role="radio" aria-checked={active} onClick={() => setCertTheme(t.id)}
                className="min-w-0 py-2.5 px-1 sm:px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer select-none"
                style={{ background: active ? 'linear-gradient(135deg, var(--color-coral-500) 0%, var(--color-coral-600) 100%)' : 'transparent', color: active ? '#ffffff' : 'var(--fg)', boxShadow: active ? '0 2px 10px rgba(242,129,90,0.35)' : 'none' }}
              >
                <t.Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate">{t.label}</span>
              </motion.button>
            );
          })}
        </div>
        <motion.button whileHover={rm ? {} : { scale: 1.03, y: -2 }} whileTap={rm ? {} : { scale: 0.97 }} onClick={handleDownload} disabled={downloading} id="download-cert-btn"
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-lg font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--color-coral-500) 0%, var(--color-coral-600) 100%)', boxShadow: '0 6px 22px rgba(242,129,90,0.42)', opacity: downloading ? 0.75 : 1, minHeight: 64 }}
          aria-label="Download your adulting certificate as a PNG"
        >
          <Download className="w-5 h-5 shrink-0" />
          {downloading ? 'Generating…' : 'Download Certificate'}
        </motion.button>
        <div className="flex flex-row justify-center gap-4 mt-2">
          <motion.a whileHover={rm ? {} : { scale: 1.1 }} whileTap={rm ? {} : { scale: 0.9 }} href={shareUrl} target="_blank" rel="noopener noreferrer" id="share-x-btn"
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#000000', color: 'white', textDecoration: 'none' }} aria-label="Share on X">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
          </motion.a>
          <motion.a whileHover={rm ? {} : { scale: 1.1 }} whileTap={rm ? {} : { scale: 0.9 }} href={waShareUrl} target="_blank" rel="noopener noreferrer" id="share-wa-btn"
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg" style={{ background: '#25D366', color: 'white', textDecoration: 'none' }} aria-label="Share on WhatsApp">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
          </motion.a>
          {canNativeShare && (
            <motion.button whileHover={rm ? {} : { scale: 1.1 }} whileTap={rm ? {} : { scale: 0.9 }} onClick={handleNativeShare} id="share-native-btn"
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, var(--color-lavender-500) 0%, var(--color-lavender-600) 100%)', color: 'white' }}
              aria-label="Share via device share menu"><Smartphone className="w-5 h-5" /></motion.button>
          )}
        </div>
        <motion.button whileHover={rm ? {} : { scale: 1.01 }} whileTap={rm ? {} : { scale: 0.98 }} onClick={handleNewMission} id="new-mission-btn"
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-base font-semibold"
          style={{ background: 'transparent', border: '2px solid var(--color-cream-300)', color: 'var(--color-ink-500)', minHeight: 52 }}
          aria-label="Start a new mission"
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          Start a New Mission
        </motion.button>
      </motion.div>

      <TrophySnackbar trophyId={unlockedTrophyId} />
    </div>
  );
}
