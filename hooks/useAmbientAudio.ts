'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Track = 'off' | 'brown-noise' | 'lofi' | 'cafe';

const TRACK_ORDER: Track[] = ['off', 'brown-noise', 'lofi', 'cafe'];

// Map track names to their actual file paths in /public/audio/
const TRACK_FILES: Record<Exclude<Track, 'off'>, string> = {
  'brown-noise': '/audio/brown-noise.mp3',
  'lofi':        '/audio/lofi.mp3',
  'cafe':        '/audio/cafe.mp3',
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAmbientAudio() {
  const [currentTrack, setCurrentTrack] = useState<Track>('off');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Manage playback whenever the selected track changes
  useEffect(() => {
    // Pause & discard any existing audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (currentTrack === 'off') return;

    const audio = new Audio(TRACK_FILES[currentTrack]);
    audio.loop   = true;
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Autoplay may be blocked until a user gesture — silently ignore.
      // The next tap on the cycle button will retry.
    });
    audioRef.current = audio;

    // Cleanup on unmount or track change
    return () => {
      audio.pause();
    };
  }, [currentTrack]);

  // Cycle: off → brown-noise → lofi → cafe → off
  const cycleTrack = useCallback(() => {
    setCurrentTrack(prev => {
      const idx = TRACK_ORDER.indexOf(prev);
      return TRACK_ORDER[(idx + 1) % TRACK_ORDER.length];
    });
  }, []);

  return { currentTrack, cycleTrack, setTrack: setCurrentTrack } as const;
}
