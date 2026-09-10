// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default ADHD tax multiplier applied to the user's raw time estimate. */
export const TAX_MULTIPLIER_DEFAULT = 1.5;

/** Minimum allowed multiplier (mild / hyperfocus day). */
export const TAX_MULTIPLIER_MIN = 1.0;

/** Maximum allowed multiplier (severe executive-dysfunction day). */
export const TAX_MULTIPLIER_MAX = 2.5;

// Anchor divisors defined by the PRD
const OFFICE_EPISODE_MINUTES = 22; // average The Office episode
const AVG_SONG_MINUTES = 3.5;      // average pop song

// ---------------------------------------------------------------------------
// Core math
// ---------------------------------------------------------------------------

/**
 * Applies the ADHD tax to a raw estimate and rounds to the nearest 5 minutes.
 *
 * @param estimateMinutes  Raw user estimate in minutes.
 * @param multiplier       ADHD tax multiplier (1.0 – 2.5).
 * @returns                Buffered duration, rounded to the nearest 5 min.
 */
export function calculateActualTime(
  estimateMinutes: number,
  multiplier: number,
): number {
  const raw = estimateMinutes * multiplier;
  return Math.round(raw / 5) * 5 || 5; // never return 0
}

// ---------------------------------------------------------------------------
// Anchor translation engine
// ---------------------------------------------------------------------------

export interface PopCultureAnchor {
  type: 'popCulture';
  label: string;
  value: number;
  /** Full, human-readable sentence. */
  sentence: string;
  /** Lucide icon name to render in place of an emoji. */
  icon: string;
}

export interface MusicAnchor {
  type: 'music';
  label: string;
  value: number;
  sentence: string;
  /** Lucide icon name to render in place of an emoji. */
  icon: string;
}

export interface RealWorldAnchor {
  type: 'realWorld';
  label: string;
  sentence: string;
  /** Lucide icon name to render in place of an emoji. */
  icon: string;
}

export type Anchor = PopCultureAnchor | MusicAnchor | RealWorldAnchor;

/**
 * Returns the threshold-based real-world anchor text for a given duration.
 *
 * @param minutes  Actual (buffered) minutes.
 */
function getRealWorldAnchor(minutes: number): { sentence: string; icon: string } {
  if (minutes < 10) {
    return { sentence: 'Boiling water for tea.', icon: 'Coffee' };
  }
  if (minutes < 20) {
    return { sentence: 'Taking a power shower.', icon: 'Droplets' };
  }
  if (minutes < 30) {
    return { sentence: 'Baking a frozen pizza.', icon: 'ChefHat' };
  }
  if (minutes < 45) {
    return { sentence: 'A quick cardio session.', icon: 'Dumbbell' };
  }
  if (minutes < 60) {
    return { sentence: 'Half of a football match.', icon: 'Trophy' };
  }
  if (minutes < 90) {
    return { sentence: 'Watching a standard documentary.', icon: 'Film' };
  }
  if (minutes < 120) {
    return { sentence: 'A full feature-length movie.', icon: 'Clapperboard' };
  }
  return { sentence: 'The whole first season of a short anime.', icon: 'Star' };
}

/**
 * Derives all three anchor objects from the buffered actual time.
 *
 * @param actualMinutes  Output of {@link calculateActualTime}.
 */
export function getAnchors(actualMinutes: number): {
  popCulture: PopCultureAnchor;
  music: MusicAnchor;
  realWorld: RealWorldAnchor;
} {
  const episodes = actualMinutes / OFFICE_EPISODE_MINUTES;
  const songs = actualMinutes / AVG_SONG_MINUTES;

  const episodeLabel = episodes < 1 ? `${Math.round(episodes * 100)}% of an episode` : `${episodes.toFixed(1)} episodes`;

  const { sentence: rwSentence, icon: rwIcon } = getRealWorldAnchor(actualMinutes);

  return {
    popCulture: {
      type: 'popCulture',
      label: 'The Office / Anime',
      value: episodes,
      sentence: `That's **${episodeLabel}** of The Office (or your favourite anime).`,
      icon: 'Tv2',
    },
    music: {
      type: 'music',
      label: 'Pop Songs',
      value: songs,
      sentence: `That's **${songs.toFixed(1)} average pop songs** back-to-back.`,
      icon: 'Music',
    },
    realWorld: {
      type: 'realWorld',
      label: 'Real World',
      sentence: rwSentence,
      icon: rwIcon,
    },
  };
}

// ---------------------------------------------------------------------------
// Taglines (Adulting Certificate)
// ---------------------------------------------------------------------------

const TAGLINES: string[] = [
  'Neurotypical Level: Unlocked.',
  'Executive function? Briefly detected.',
  'The hyperfocus was real today.',
  'ADHD: 0. You: 1. For once.',
  'Did a thing. Didn\'t spiral. Revolutionary.',
  'Brain said no. You said yes. Respect.',
  'No rabbit holes were harmed in the making of this task.',
  'Dopamine earned the healthy way.',
  'Time-blind no more — at least for this one task.',
  'The task is done. Time is a social construct. You win.',
];

/**
 * Returns a random, shame-free, humorous tagline for the Adulting Certificate.
 */
export function getRandomTagline(): string {
  return TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
}

// ---------------------------------------------------------------------------
// Slider labels (UI helper)
// ---------------------------------------------------------------------------

export interface TaxLabel {
  value: number;
  label: string;
  /** Lucide icon name to render in place of an emoji. */
  icon: string;
  description: string;
}

/**
 * Semantic labels for key points on the ADHD Tax slider.
 * Rendered as tick-marks / tooltips in the SetupScreen.
 */
export const TAX_LABELS: TaxLabel[] = [
  { value: 1.0, label: '1.0×', icon: 'Sun',            description: 'Mild / Hyperfocus day' },
  { value: 1.5, label: '1.5×', icon: 'CloudSun',       description: 'Typical ADHD day' },
  { value: 2.0, label: '2.0×', icon: 'CloudLightning', description: 'Rough day' },
  { value: 2.5, label: '2.5×', icon: 'CloudRain',      description: 'Severe exec-dysfunction' },
];

// ---------------------------------------------------------------------------
// Colors and Visuals
// ---------------------------------------------------------------------------

/** Linear interpolate between two RGB hex colour strings (no `#` prefix) */
function lerpHex(a: string, b: string, t: number): string {
  const toRgb = (h: string) => [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ] as const;
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

// Warm palette anchors — no aggressive red at any point
const SAGE = '7daf9c'; // sage-500   — calm, "you have time"
const AMBER = 'f5a623'; // amber-500  — gentle urgency
const CORAL = 'f2815a'; // coral-500  — warm nudge, never alarming

/**
 * Interpolates a warm block colour from sage → amber → coral
 * based on the fill ratio (1 = full / just started, 0 = empty / time up).
 */
export function computeBlockColor(fill: number): string {
  const clamped = Math.max(0, Math.min(1, fill));
  if (clamped >= 0.5) {
    // sage → amber as fill goes from 1.0 → 0.5
    return lerpHex(SAGE, AMBER, (1 - clamped) * 2);
  }
  // amber → coral as fill goes from 0.5 → 0
  return lerpHex(AMBER, CORAL, (0.5 - clamped) * 2);
}
