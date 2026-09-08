'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, RotateCcw } from 'lucide-react';
import { toPng } from 'html-to-image';
import confetti from 'canvas-confetti';
import { useTimer } from '@/context/TimerContext';
import { getAnchors } from '@/lib/calculations';
import { saveCompletedTask, getMutePreference } from '@/lib/storage';
import { playGentleBell } from '@/lib/audio';

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
}

function AdultingCertificate({
  taskName, episodes, songs, tagline, dateStr, certRef,
}: CertificateProps) {
  return (
    <div
      ref={certRef}
      style={{
        // Fully self-contained inline styles so html-to-image captures correctly
        width: 640,
        minHeight: 380,
        background: 'linear-gradient(140deg, #fdf9f3 0%, #fdf6ec 50%, #f3dfc0 100%)',
        border: '3px solid #f2815a',
        borderRadius: 24,
        padding: '40px 44px',
        fontFamily: 'Georgia, "Times New Roman", serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative corner flourishes */}
      <div style={{ position: 'absolute', top: 12, left: 14, fontSize: 28, opacity: 0.25 }}>✦</div>
      <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 28, opacity: 0.25 }}>✦</div>
      <div style={{ position: 'absolute', bottom: 12, left: 14, fontSize: 28, opacity: 0.25 }}>✦</div>
      <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 28, opacity: 0.25 }}>✦</div>

      {/* Inner border line */}
      <div style={{
        position: 'absolute', inset: 10,
        border: '1px solid rgba(242,129,90,0.35)',
        borderRadius: 18,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <p style={{
          fontSize: 11, letterSpacing: 4, textTransform: 'uppercase',
          color: '#78716c', fontFamily: 'Georgia, serif', margin: 0,
        }}>
          Official Certificate of Achievement
        </p>
        <div style={{ margin: '10px auto', width: 60, height: 2, background: '#f2815a', borderRadius: 99 }} />
        <p style={{
          fontSize: 13, color: '#a8a29e', margin: 0, fontStyle: 'italic',
        }}>
          Awarded to a genuinely remarkable human being
        </p>
      </div>

      {/* Task name */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: '#78716c', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 2 }}>
          For the heroic completion of
        </p>
        <p style={{
          fontSize: 32, fontWeight: 'bold', color: '#1c1917',
          margin: '0 0 4px', lineHeight: 1.2,
        }}>
          "{taskName}"
        </p>
      </div>

      {/* Anchor stats */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 32,
        background: 'rgba(125,175,156,0.12)',
        borderRadius: 14, padding: '16px 24px',
        marginBottom: 20, border: '1px solid rgba(125,175,156,0.3)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 'bold', color: '#1c1917' }}>{episodes}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#78716c', textTransform: 'uppercase', letterSpacing: 1 }}>
            📺 episodes
          </p>
        </div>
        <div style={{ width: 1, background: 'rgba(0,0,0,0.1)' }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 'bold', color: '#1c1917' }}>{songs}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#78716c', textTransform: 'uppercase', letterSpacing: 1 }}>
            🎵 songs
          </p>
        </div>
      </div>

      {/* Tagline */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <p style={{
          fontSize: 17, fontStyle: 'italic', color: '#44403c',
          lineHeight: 1.5, margin: 0,
        }}>
          "{tagline}"
        </p>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <p style={{ fontSize: 11, color: '#a8a29e', margin: 0 }}>
          Time-Blindness Translator
        </p>
        <p style={{ fontSize: 11, color: '#a8a29e', margin: 0 }}>
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
  const certRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [shareUrl,    setShareUrl]    = useState('');

  const anchors     = getAnchors(state.actualMinutes);
  const episodesStr = anchors.popCulture.value.toFixed(1);
  const songsStr    = anchors.music.value.toFixed(1);
  const tagline     = state.tagline ?? 'Executive function? Briefly detected.';
  const dateStr     = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  // Save history, play sound, and fire confetti on mount
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    saveCompletedTask({
      taskName: state.taskName,
      actualMinutes: state.actualMinutes,
      completedAt: Date.now(),
      tagline: state.tagline || undefined,
    });
    
    playGentleBell(getMutePreference());
    fireCelebrationConfetti();
  }, [state]);

  // Build share URL on mount (client-only — window.location)
  useEffect(() => {
    const text =
      `I just completed "${state.taskName}" in ${episodesStr} episodes of The Office! ✅\n\n` +
      `Time-Blindness Translator keeps my ADHD brain honest 🧠⏳\n\n` +
      `@Aditya_X_Writes`;
    setShareUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
  }, [state.taskName, episodesStr]);

  // Download certificate as PNG
  const handleDownload = useCallback(async () => {
    if (!certRef.current || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(certRef.current, {
        cacheBust:      true,
        pixelRatio:     2,
        backgroundColor: '#fdf9f3',
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
  }, [downloading]);

  // Reset to setup by reloading the page (preserves the stateless SPA contract)
  const handleReset = () => window.location.reload();

  return (
    <div className="flex flex-col items-center gap-7 w-full pb-4">

      {/* ── Trophy header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        className="text-center"
      >
        <span className="text-7xl block mb-3">🏆</span>
        <h2
          className="text-3xl font-black leading-tight"
          style={{ color: 'var(--color-ink-900)' }}
        >
          You actually did it.
        </h2>
        <p className="mt-2 text-base" style={{ color: 'var(--color-ink-500)' }}>
          <strong style={{ color: 'var(--color-coral-500)' }}>
            {state.taskName}
          </strong>{' '}
          — officially complete. No cap.
        </p>
      </motion.div>

      {/* ── Quick-stat badges ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-3 justify-center flex-wrap"
      >
        {[
          { emoji: '📺', val: episodesStr, unit: 'episodes' },
          { emoji: '🎵', val: songsStr,    unit: 'songs' },
          { emoji: '⏱️', val: `${state.actualMinutes}`, unit: 'minutes' },
        ].map(b => (
          <div
            key={b.unit}
            className="flex flex-col items-center rounded-2xl px-5 py-3 glass-card"
            style={{ border: '1.5px solid var(--color-cream-300)', minWidth: 88 }}
          >
            <span className="text-2xl">{b.emoji}</span>
            <span
              className="text-2xl font-black tabular-nums"
              style={{ color: 'var(--color-ink-900)' }}
            >
              {b.val}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-ink-400)' }}>
              {b.unit}
            </span>
          </div>
        ))}
      </motion.div>

      {/* ── Adulting Certificate (the capturable node) ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full overflow-x-auto"
      >
        {/* Scroll wrapper for small screens */}
        <div style={{ minWidth: 320 }}>
          <AdultingCertificate
            certRef={certRef}
            taskName={state.taskName}
            episodes={episodesStr}
            songs={songsStr}
            tagline={tagline}
            dateStr={dateStr}
          />
        </div>
      </motion.div>

      {/* ── Action buttons ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="flex flex-col gap-3 w-full"
      >
        {/* Download */}
        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleDownload}
          disabled={downloading}
          id="download-cert-btn"
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-lg font-bold text-white"
          style={{
            background:
              'linear-gradient(135deg, var(--color-coral-500) 0%, var(--color-coral-600) 100%)',
            boxShadow: '0 6px 22px rgba(242,129,90,0.42)',
            opacity: downloading ? 0.75 : 1,
            minHeight: 64,
          }}
          aria-label="Download your adulting certificate as a PNG"
        >
          <Download className="w-5 h-5 shrink-0" />
          {downloading ? 'Generating…' : 'Download Certificate 🎓'}
        </motion.button>

        {/* Share to X */}
        <motion.a
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          id="share-x-btn"
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-lg font-bold"
          style={{
            background: '#000000',
            color: 'white',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            minHeight: 64,
            textDecoration: 'none',
          }}
          aria-label="Share your achievement on X (Twitter)"
        >
          <Share2 className="w-5 h-5 shrink-0" />
          Share on X (Twitter) 🐦
        </motion.a>

        {/* Start again */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleReset}
          id="new-mission-btn"
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-base font-semibold"
          style={{
            background: 'transparent',
            border: '2px solid var(--color-cream-300)',
            color: 'var(--color-ink-500)',
            minHeight: 52,
          }}
          aria-label="Start a new mission"
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          Start a New Mission
        </motion.button>
      </motion.div>
    </div>
  );
}
