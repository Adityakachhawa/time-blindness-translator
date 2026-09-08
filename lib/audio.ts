/**
 * lib/audio.ts
 * Web Audio API — generates a gentle, non-alarming bell chord.
 * No external files, no network requests, zero bundle overhead.
 */

// Module-level singleton so the same context is reused across renders.
// This also allows the context to be pre-unlocked during a user gesture
// (e.g. "Start Mission" click) so the expiry sound can play automatically.
let _ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_ctx && _ctx.state !== 'closed') return _ctx;
  try {
    _ctx = new (
      window.AudioContext ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitAudioContext
    )();
    return _ctx;
  } catch {
    return null;
  }
}

/**
 * Call this inside a click handler (user gesture) to pre-unlock the
 * AudioContext so the expiry sound can play without a second gesture.
 */
export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx?.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Plays a soft C5–E5–G5 major-chord chime — warm, pleasant, non-alarming.
 *
 * @param muted  Pass `true` to skip playback (respects the user mute pref).
 */
export async function playGentleBell(muted = false): Promise<void> {
  if (muted) return;

  const ctx = getContext();
  if (!ctx) return;

  // Ensure the context is running (it may be suspended after a page load)
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }

  /**
   * Three sine oscillators tuned to a C major triad (C5 / E5 / G5).
   * Staggered 60 ms apart to simulate a gentle strummed chime.
   * Each note: quick 40 ms linear attack → slow 2.8 s exponential decay.
   */
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gainNode   = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type            = 'sine';
    oscillator.frequency.value = frequency;

    const startTime = ctx.currentTime + index * 0.06;
    const stopTime  = startTime + 2.8;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.11, startTime + 0.04);   // gentle attack
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);    // long soft decay

    oscillator.start(startTime);
    oscillator.stop(stopTime);
  });
}
