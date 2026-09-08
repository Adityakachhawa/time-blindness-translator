'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, RotateCcw, Smartphone } from 'lucide-react';
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
        width: '100%',
        maxWidth: 640,
        minHeight: 320,
        margin: '0 auto',
        background: 'linear-gradient(140deg, #fdf9f3 0%, #fdf6ec 50%, #f3dfc0 100%)',
        border: '3px solid #f2815a',
        borderRadius: 24,
        padding: 'clamp(20px, 5vw, 40px) clamp(16px, 5vw, 44px)',
        fontFamily: 'Georgia, "Times New Roman", serif',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
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
          fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 'bold', color: '#1e293b',
          margin: '0 0 4px', lineHeight: 1.2, wordBreak: 'break-word' as const,
        }}>
          "{taskName}"
        </p>
      </div>

      {/* Anchor stats */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 'clamp(16px, 4vw, 32px)',
        background: 'rgba(125,175,156,0.12)',
        borderRadius: 14, padding: 'clamp(12px, 3vw, 16px) clamp(16px, 4vw, 24px)',
        marginBottom: 20, border: '1px solid rgba(125,175,156,0.3)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 'bold', color: '#1e293b' }}>{episodes}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#78716c', textTransform: 'uppercase', letterSpacing: 1 }}>
            📺 episodes
          </p>
        </div>
        <div style={{ width: 1, background: 'rgba(0,0,0,0.1)' }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 'bold', color: '#1e293b' }}>{songs}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#78716c', textTransform: 'uppercase', letterSpacing: 1 }}>
            🎵 songs
          </p>
        </div>
      </div>

      {/* Tagline */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <p style={{
          fontSize: 'clamp(14px, 3vw, 17px)', fontStyle: 'italic', color: '#475569',
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
  const [waShareUrl,  setWaShareUrl]  = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);

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

  // Build share URLs on mount (client-only — window.location)
  useEffect(() => {
    const text =
      `I just completed "${state.taskName}" in ${episodesStr} episodes of The Office! ✅\n\n` +
      `Time-Blindness Translator keeps my ADHD brain honest 🧠⏳\n\n` +
      `@Aditya_X_Writes`;
    setShareUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
    setWaShareUrl(`https://wa.me/?text=${encodeURIComponent(text)}`);
    setCanNativeShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, [state.taskName, episodesStr]);

  // Native share handler
  const handleNativeShare = useCallback(async () => {
    const text =
      `I just completed "${state.taskName}" in ${episodesStr} episodes of The Office! ✅\n\n` +
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
        className="w-full max-w-md mx-auto"
      >
        <AdultingCertificate
          certRef={certRef}
          taskName={state.taskName}
          episodes={episodesStr}
          songs={songsStr}
          tagline={tagline}
          dateStr={dateStr}
        />
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
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 fill-current"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
          Share on X
        </motion.a>

        {/* Share to WhatsApp */}
        <motion.a
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          href={waShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          id="share-wa-btn"
          className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-lg font-bold"
          style={{
            background: '#25D366',
            color: 'white',
            boxShadow: '0 4px 16px rgba(37,211,102,0.35)',
            minHeight: 64,
            textDecoration: 'none',
          }}
          aria-label="Share your achievement on WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
          Share on WhatsApp
        </motion.a>

        {/* Native Share (mobile only) */}
        {canNativeShare && (
          <motion.button
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleNativeShare}
            id="share-native-btn"
            className="w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-lg font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--color-lavender-500) 0%, var(--color-lavender-600) 100%)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(167,139,202,0.35)',
              minHeight: 64,
            }}
            aria-label="Share via your device's share menu"
          >
            <Smartphone className="w-5 h-5 shrink-0" />
            Share via… 📲
          </motion.button>
        )}

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
