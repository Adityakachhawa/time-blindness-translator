'use client';

import { useEffect, useRef } from 'react';
import { useTimer } from '@/context/TimerContext';
import { computeBlockColor } from '@/lib/calculations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** Draws a circular progress ring to a 32x32 canvas and returns a data URL. */
function drawFavicon(fillRatio: number): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = 16;
  const cy = 16;
  const radius = 13;
  const lineWidth = 6;

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Progress ring
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + 2 * Math.PI * fillRatio;
  
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.strokeStyle = computeBlockColor(fillRatio);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

/** Finds the existing favicon link element or creates one if missing. */
function getFaviconLink(): HTMLLinkElement | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  let link = document.querySelector('link[rel~="icon"]') as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTabProgressIndicator() {
  const { state } = useTimer();
  
  // Refs to hold original values to restore when unmounting or leaving 'active'
  const originalTitleRef = useRef<string | null>(null);
  const originalFaviconRef = useRef<string | null>(null);
  
  // Throttle refs
  const lastDrawnRatioRef = useRef<number>(-1);
  const lastDrawnTimeRef = useRef<number>(0);

  // Capture original title/favicon exactly once on mount
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title;
    }
    if (originalFaviconRef.current === null) {
      const link = getFaviconLink();
      if (link) originalFaviconRef.current = link.href;
    }
  }, []);

  // Main logic
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const restoreDefaults = () => {
      if (originalTitleRef.current) document.title = originalTitleRef.current;
      if (originalFaviconRef.current) {
        const link = getFaviconLink();
        if (link) link.href = originalFaviconRef.current;
      }
      // Reset throttles so if we restart, it redraws immediately
      lastDrawnRatioRef.current = -1;
      lastDrawnTimeRef.current = 0;
    };

    if (state.status === 'success' || state.status === 'expired') {
      // Briefly show celebratory/done title, then restore
      document.title = '✅ Done!';
      if (originalFaviconRef.current) {
        const link = getFaviconLink();
        if (link) link.href = originalFaviconRef.current;
      }
      
      const t = setTimeout(restoreDefaults, 3000);
      return () => clearTimeout(t);
    }

    if (state.status !== 'active' || !state.endTime) {
      restoreDefaults();
      return;
    }

    // Active state: update title every 1s, favicon every 5s or 1% change
    const updateTick = () => {
      const msRemaining = Math.max(0, state.endTime! - Date.now());
      const totalMs = state.actualMinutes * 60_000;
      const fillRatio = Math.min(1, Math.max(0, msRemaining / totalMs));
      
      // Update title (cheap)
      const timeStr = formatTime(msRemaining);
      const taskStr = state.taskName || 'Mission';
      document.title = `⏳ ${timeStr} — ${taskStr}`;

      // Update favicon (expensive, so throttle)
      const now = Date.now();
      const ratioDelta = Math.abs(fillRatio - lastDrawnRatioRef.current);
      const timeDelta = now - lastDrawnTimeRef.current;
      
      // Throttle: update if changed by > 1% OR if 5 seconds have passed
      if (ratioDelta >= 0.01 || timeDelta >= 5000) {
        const link = getFaviconLink();
        if (link) link.href = drawFavicon(fillRatio);
        lastDrawnRatioRef.current = fillRatio;
        lastDrawnTimeRef.current = now;
      }
    };

    updateTick(); // Run immediately
    const intervalId = setInterval(updateTick, 1000);

    return () => {
      clearInterval(intervalId);
      restoreDefaults();
    };
  }, [state.status, state.endTime, state.actualMinutes, state.taskName]);
}
