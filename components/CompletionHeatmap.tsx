'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getDailyCounts } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Full year view — 365 trailing days. */
const DAYS_DESKTOP = 365;

/** Mobile fallback — trailing 12 weeks (84 days). */
const DAYS_MOBILE = 84;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// ---------------------------------------------------------------------------
// Colour scale — sage palette, lightest (no data) → darkest (most active).
// "No data" is a neutral warm-cream — never a warning or failure colour.
// ---------------------------------------------------------------------------

function cellColor(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) return 'var(--color-cream-200)';
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 'var(--color-sage-300)';
  if (ratio <= 0.50) return 'var(--color-sage-400)';
  if (ratio <= 0.75) return 'var(--color-sage-500)';
  return 'var(--color-sage-700)';
}

// ---------------------------------------------------------------------------
// Date helpers (pure — no window/DOM)
// ---------------------------------------------------------------------------

/** YYYY-MM-DD from a local calendar date. Mirrors toISODate in storage.ts. */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "Sep 10" display label from a YYYY-MM-DD string. */
function formatDateLabel(iso: string): string {
  const parts = iso.split('-').map(Number);
  const date  = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Builds the ordered list of ISO date strings for the grid, oldest → newest.
 * Starts on the Sunday on or before `days` ago so every week-row aligns cleanly.
 */
function buildDateGrid(days: number): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startRaw = new Date(today);
  startRaw.setDate(startRaw.getDate() - (days - 1));
  const start = new Date(startRaw);
  start.setDate(start.getDate() - startRaw.getDay()); // rewind to Sunday

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Splits a flat date array into 7-day columns (weeks). */
function toWeekColumns(dates: string[]): string[][] {
  const cols: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    cols.push(dates.slice(i, i + 7));
  }
  return cols;
}

// ---------------------------------------------------------------------------
// Month labels
// ---------------------------------------------------------------------------

interface MonthLabel { label: string; colIndex: number; }

function buildMonthLabels(cols: string[][]): MonthLabel[] {
  const labels: MonthLabel[] = [];
  let lastMonth = -1;
  cols.forEach((col, ci) => {
    if (!col[0]) return;
    const m = Number(col[0].split('-')[1]);
    if (m !== lastMonth) {
      lastMonth = m;
      const parts = col[0].split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, 1);
      labels.push({
        label:    d.toLocaleDateString('en-US', { month: 'short' }),
        colIndex: ci,
      });
    }
  });
  return labels;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipState { text: string; x: number; y: number; visible: boolean; }

function Tooltip({ text, x, y, visible }: TooltipState) {
  if (!visible) return null;
  return (
    <div
      role="tooltip"
      style={{
        position:       'fixed',
        left:           x,
        top:            y - 38,
        transform:      'translateX(-50%)',
        background:     'var(--color-ink-800)',
        color:          '#f5f5f4',
        fontSize:       11,
        fontWeight:     600,
        padding:        '4px 9px',
        borderRadius:   6,
        whiteSpace:     'nowrap',
        pointerEvents:  'none',
        zIndex:         9999,
        boxShadow:      '0 2px 8px rgba(0,0,0,0.28)',
      }}
    >
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single heatmap cell
// ---------------------------------------------------------------------------

interface CellProps {
  isoDate:  string;
  count:    number;
  maxCount: number;
  cellSize: number;
  onHover:  (text: string, x: number, y: number) => void;
  onLeave:  () => void;
}

function HeatCell({ isoDate, count, maxCount, cellSize, onHover, onLeave }: CellProps) {
  const bg = cellColor(count, maxCount);

  // Shame-free copy: zero-count days say "no missions logged", never "nothing done"
  const tooltipText =
    count > 0
      ? `${count} ${count === 1 ? 'mission' : 'missions'} on ${formatDateLabel(isoDate)}`
      : `No missions logged on ${formatDateLabel(isoDate)}`;

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onHover(tooltipText, rect.left + rect.width / 2, rect.top);
  };

  return (
    <div
      aria-label={tooltipText}
      role="img"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={onLeave}
      style={{
        width:        cellSize,
        height:       cellSize,
        borderRadius: Math.max(2, Math.round(cellSize * 0.22)),
        background:   bg,
        flexShrink:   0,
        transition:   'background 180ms ease, transform 80ms ease',
        cursor:       'default',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CompletionHeatmapProps {
  /**
   * Force compact (12-week) mode. When omitted the component auto-detects
   * via the container width, switching at 640 px.
   */
  compact?: boolean;
}

export default function CompletionHeatmap({ compact: compactProp }: CompletionHeatmapProps) {
  // ── SSR-safe state: start from identical static values on server + client,
  //    then hydrate with real localStorage data inside useEffect after mount.
  const [counts,  setCounts]  = useState<Record<string, number>>({});
  const [days,    setDays]    = useState(DAYS_DESKTOP);
  const [mounted, setMounted] = useState(false);

  const [tooltip, setTooltip] = useState<TooltipState>({ text: '', x: 0, y: 0, visible: false });

  const containerRef = useRef<HTMLDivElement>(null);

  // Used to force a grid rebuild when the week-count changes inside the observer
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  // Detect prefers-reduced-motion once on mount — SSR defaults to true (conservative)
  const prefersReducedMotionRef = useRef(true);

  useEffect(() => {
    prefersReducedMotionRef.current =
      typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : true;

    let resolvedDays: number;
    if (compactProp !== undefined) {
      resolvedDays = compactProp ? DAYS_MOBILE : DAYS_DESKTOP;
    } else {
      resolvedDays =
        containerRef.current && containerRef.current.offsetWidth < 640
          ? DAYS_MOBILE
          : DAYS_DESKTOP;
    }

    setDays(resolvedDays);
    setCounts(getDailyCounts(resolvedDays));
    setMounted(true);

    // ResponsiveObserver — only installed when compactProp is not forced
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined' || compactProp !== undefined) return;

    let currentDays = resolvedDays;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const next =
          entry.contentRect.width < 640 ? DAYS_MOBILE : DAYS_DESKTOP;
        if (next !== currentDays) {
          currentDays = next;
          setDays(next);
          setCounts(getDailyCounts(next));
          forceUpdate();
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compactProp]);

  // ── Grid geometry ─────────────────────────────────────────────────────────
  const dates    = buildDateGrid(days);
  const cols     = toWeekColumns(dates);
  const months   = buildMonthLabels(cols);
  const isSmall  = days === DAYS_MOBILE;
  const cellSize = isSmall ? 10 : 12;
  const gap      = 3;
  const maxCount = Math.max(0, ...Object.values(counts));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleHover = (text: string, x: number, y: number) =>
    setTooltip({ text, x, y, visible: true });

  const handleLeave = () =>
    setTooltip(prev => ({ ...prev, visible: false }));

  // ── Pre-mount skeleton — identical size so the drawer doesn't shift ───────
  if (!mounted) {
    return (
      <div
        ref={containerRef}
        style={{
          height:  7 * (cellSize + gap) + 40,
          opacity: 0.25,
          background: 'var(--color-cream-200)',
          borderRadius: 8,
        }}
        aria-hidden
      />
    );
  }

  const showAnimation = !prefersReducedMotionRef.current;

  return (
    <motion.div
      ref={containerRef}
      initial={showAnimation ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      aria-label="Completion heatmap — daily mission activity"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Fixed-position tooltip — escapes the drawer's overflow:hidden */}
      <Tooltip {...tooltip} />

      {/* Month labels ─────────────────────────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          display:     'flex',
          marginLeft:  28,  // align with grid past the day-label column
          marginBottom: 3,
        }}
      >
        {months.map((ml, i) => {
          const nextCol = months[i + 1]?.colIndex ?? cols.length;
          const width   = (cellSize + gap) * Math.max(1, nextCol - ml.colIndex);
          return (
            <div
              key={`month-${i}`}
              style={{
                width,
                fontSize:    10,
                color:       'var(--color-ink-300)',
                fontWeight:  600,
                letterSpacing: '0.04em',
                whiteSpace:  'nowrap',
                overflow:    'hidden',
                flexShrink:  0,
              }}
            >
              {ml.label}
            </div>
          );
        })}
      </div>

      {/* Grid ───────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>

        {/* Day-of-week labels — only Mon / Wed / Fri visible to reduce clutter */}
        <div
          aria-hidden
          style={{
            display:        'flex',
            flexDirection:  'column',
            gap,
            marginRight:    4,
            width:          24,
            flexShrink:     0,
          }}
        >
          {DAY_LABELS.map((label, i) => (
            <div
              key={label}
              style={{
                height:        cellSize,
                fontSize:      9,
                lineHeight:    `${cellSize}px`,
                color:         'var(--color-ink-300)',
                fontWeight:    600,
                letterSpacing: '0.04em',
                // Show Mon (1), Wed (3), Fri (5); hide Sun/Tue/Thu/Sat
                visibility:    i === 1 || i === 3 || i === 5 ? 'visible' : 'hidden',
                userSelect:    'none',
                textAlign:     'right',
              }}
            >
              {label.slice(0, 3)}
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div
          style={{
            display:          'flex',
            gap,
            overflowX:        'auto',
            scrollbarWidth:   'none',  // Firefox
            msOverflowStyle:  'none',  // IE/Edge
            flex:             1,
          }}
        >
          {cols.map((col, ci) => (
            <div
              key={`col-${ci}`}
              style={{ display: 'flex', flexDirection: 'column', gap, flexShrink: 0 }}
            >
              {col.map(isoDate => (
                <HeatCell
                  key={isoDate}
                  isoDate={isoDate}
                  count={counts[isoDate] ?? 0}
                  maxCount={maxCount}
                  cellSize={cellSize}
                  onHover={handleHover}
                  onLeave={handleLeave}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend ──────────────────────────────────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'flex-end',
          gap:            3,
          marginTop:      7,
          userSelect:     'none',
        }}
      >
        <span style={{ fontSize: 9, color: 'var(--color-ink-300)', fontWeight: 600, marginRight: 1 }}>
          Less
        </span>
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => {
          // For the first swatch always show the empty state colour
          const fakeCount = i === 0 ? 0 : v * Math.max(1, maxCount);
          return (
            <div
              key={i}
              style={{
                width:        cellSize,
                height:       cellSize,
                borderRadius: Math.max(2, Math.round(cellSize * 0.22)),
                background:   cellColor(fakeCount, Math.max(1, maxCount)),
              }}
            />
          );
        })}
        <span style={{ fontSize: 9, color: 'var(--color-ink-300)', fontWeight: 600, marginLeft: 1 }}>
          More
        </span>
      </div>
    </motion.div>
  );
}
