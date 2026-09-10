'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, Share, Brain, Clock, Medal } from 'lucide-react';
import { toPng } from 'html-to-image';
import { getWeeklyStats, type WeeklyStats } from '@/lib/storage';

export default function WeeklyReport() {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStats(getWeeklyStats());
  }, []);

  const getExportOptions = () => ({
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: 'transparent',
    style: { transform: 'scale(1)', transformOrigin: 'top left' },
    fontEmbedCSS: '',
  });

  const handleShare = async () => {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);

    try {
      const dataUrl = await toPng(reportRef.current, getExportOptions());
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'brain-budget-report.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Brain Budget',
          text: 'Here is my focus recap for the week!',
        });
      } else {
        handleFallbackDownload(dataUrl);
      }
    } catch (err) {
      console.error('Failed to export image', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);

    try {
      const dataUrl = await toPng(reportRef.current, getExportOptions());
      handleFallbackDownload(dataUrl);
    } catch (err) {
      console.error('Failed to download image', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFallbackDownload = (dataUrl: string) => {
    const link = document.createElement('a');
    link.download = 'brain-budget-report.png';
    link.href = dataUrl;
    link.click();
  };

  if (!stats) return null;

  // Quiet week fallback
  if (stats.totalMissions === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 mt-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700/50">
        <Brain className="w-12 h-12 mb-4 text-slate-400" />
        <h3 className="text-xl font-bold mb-2 text-slate-700 dark:text-slate-300">Rest is productive, too.</h3>
        <p className="text-slate-500 max-w-62.5 mx-auto text-sm leading-relaxed mt-2">
          No missions logged this week — your data picks back up whenever you're ready.
        </p>
      </div>
    );
  }

  // Active Week styling (Earth tones, exactly matching the app vibe)
  const s = {
    containerBg:     'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
    containerBorder: '3px solid #d6d3d1',
    innerBorder:     '1px solid rgba(120, 113, 108, 0.2)',
    headerSub:       '#78716c',
    divider:         '#d6d3d1',
    statsBg:         'rgba(255, 255, 255, 0.7)',
    statsBorder:     '1px solid rgba(120, 113, 108, 0.2)',
    statsVal:        '#292524',
    statsLabel:      '#57534e',
    footer:          '#78716c',
  };

  return (
    <div className="w-full flex flex-col items-center gap-6 pb-8">
      <div className="w-full relative px-2 max-w-110 mx-auto">
        {/* The exportable container */}
        <div
          ref={reportRef}
          style={{
            width: '100%',
            aspectRatio: '1080/1350', // Portrait format for social stories
            margin: '0 auto',
            background: s.containerBg,
            border: s.containerBorder,
            borderRadius: 32,
            padding: '48px 32px',
            fontFamily: 'Georgia, "Times New Roman", serif',
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Inner border line */}
          <div style={{
            position: 'absolute', inset: 12,
            border: s.innerBorder,
            borderRadius: 22,
            pointerEvents: 'none',
          }} />

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40, marginTop: 8 }}>
             <p style={{
              fontSize: 13, letterSpacing: 4, textTransform: 'uppercase',
              color: s.headerSub, margin: 0,
            }}>
              Weekly Brain Budget
            </p>
            <div style={{ margin: '16px auto', width: 64, height: 2, background: s.divider, borderRadius: 99 }} />
            <h2 style={{ fontSize: 36, fontWeight: 'bold', color: s.statsVal, margin: '0 0 8px' }}>
              7-Day Recap
            </h2>
          </div>

          {/* Stats grid */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            <div style={{
              background: s.statsBg, border: s.statsBorder, borderRadius: 20, padding: '24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: s.statsLabel, textTransform: 'uppercase', letterSpacing: 1 }}>Missions</p>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 'bold', color: s.statsVal }}>{stats.totalMissions}</p>
              </div>
              <Medal color={s.statsVal} size={36} opacity={0.8} />
            </div>

            <div style={{
              background: s.statsBg, border: s.statsBorder, borderRadius: 20, padding: '24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 13, color: s.statsLabel, textTransform: 'uppercase', letterSpacing: 1 }}>Minutes Reclaimed</p>
                <p style={{ margin: 0, fontSize: 32, fontWeight: 'bold', color: s.statsVal }}>{stats.minutesReclaimed}</p>
              </div>
              <Clock color={s.statsVal} size={36} opacity={0.8} />
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{
                flex: 1, background: s.statsBg, border: s.statsBorder, borderRadius: 20, padding: '20px 16px', textAlign: 'center'
              }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: s.statsLabel, textTransform: 'uppercase', letterSpacing: 1 }}>Streak</p>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 'bold', color: s.statsVal }}>{stats.streak} <span style={{ fontSize: 16 }}>days</span></p>
              </div>
              
              {stats.mostUsedTask ? (
                <div style={{
                  flex: 1, background: s.statsBg, border: s.statsBorder, borderRadius: 20, padding: '20px 16px', textAlign: 'center',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center'
                }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: s.statsLabel, textTransform: 'uppercase', letterSpacing: 1 }}>Top Mission</p>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 'bold', color: s.statsVal, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {stats.mostUsedTask}
                  </p>
                </div>
              ) : (
                <div style={{ flex: 1, background: s.statsBg, border: s.statsBorder, borderRadius: 20 }} />
              )}
            </div>
          </div>

          {/* Footer tagline */}
          {stats.tagline && (
            <div style={{ marginTop: 'auto', paddingTop: 32, textAlign: 'center' }}>
              <p style={{ fontSize: 16, color: s.footer, fontStyle: 'italic', margin: 0, padding: '0 16px' }}>
                "{stats.tagline}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex w-full max-w-sm gap-3 px-4 mt-2">
        {typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' ? (
          <button
            onClick={handleShare}
            disabled={isExporting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-transform active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--color-coral-500)', color: 'white' }}
          >
            <Share className="w-5 h-5" />
            Share
          </button>
        ) : null}
        <button
          onClick={handleDownload}
          disabled={isExporting}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-transform active:scale-95 disabled:opacity-50"
          style={{ background: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--card-border)' }}
        >
          <Download className="w-5 h-5" />
          Save Image
        </button>
      </div>
    </div>
  );
}
