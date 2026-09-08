/**
 * lib/storage.ts
 * All localStorage access for the Time-Blindness Translator.
 * Every function is SSR-safe (guarded by typeof window check).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskRecord {
  id:             string;
  taskName:       string;
  optimisticMin:  number;   // user's original estimate before ADHD tax
  taxMultiplier:  number;   // ADHD tax multiplier applied
  allocatedMin:   number;   // actual minutes after tax (renamed from actualMinutes)
  actualMinutes:  number;   // kept for backwards compat with existing records
  completedAt:    number;   // ms since epoch
  tagline?:       string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEY_HISTORY = 'tbt_task_history';
const KEY_MUTED   = 'tbt_muted';
const KEY_THEME   = 'tbt_theme';

const MAX_HISTORY = 50;

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable in private mode or with full quota
  }
}

// ---------------------------------------------------------------------------
// Task history
// ---------------------------------------------------------------------------

/** Returns the full task history array, newest first. */
export function getTaskHistory(): TaskRecord[] {
  return safeRead<TaskRecord[]>(KEY_HISTORY, []);
}

/** Prepends a completed task to the history and trims to MAX_HISTORY. */
export function saveCompletedTask(record: Omit<TaskRecord, 'id'>): void {
  const history = getTaskHistory();
  history.unshift({ ...record, id: `${Date.now()}-${Math.random()}` });
  safeWrite(KEY_HISTORY, history.slice(0, MAX_HISTORY));
}

/**
 * Returns the number of tasks completed today (local calendar day).
 * Used for the streak badge on the Setup screen.
 */
export function getTodayCount(): number {
  const today   = new Date().toDateString();
  const history = getTaskHistory();
  return history.filter(r => new Date(r.completedAt).toDateString() === today).length;
}

// ---------------------------------------------------------------------------
// Mute preference
// ---------------------------------------------------------------------------

export function getMutePreference(): boolean {
  return safeRead<boolean>(KEY_MUTED, false);
}

export function setMutePreference(muted: boolean): void {
  safeWrite(KEY_MUTED, muted);
}

// ---------------------------------------------------------------------------
// Theme preference
// ---------------------------------------------------------------------------

export function getThemePreference(): ThemePreference {
  return safeRead<ThemePreference>(KEY_THEME, 'system');
}

export function setThemePreference(pref: ThemePreference): void {
  safeWrite(KEY_THEME, pref);
}

// ---------------------------------------------------------------------------
// Relative time formatter (no library dependency)
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable relative time string.
 * e.g. "just now", "5 min ago", "2 hours ago", "yesterday"
 */
export function relativeTime(ms: number): string {
  const diffMs  = Date.now() - ms;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);

  if (diffSec < 60)  return 'just now';
  if (diffMin < 60)  return `${diffMin} min ago`;
  if (diffHr  < 24)  return `${diffHr} hr ago`;
  if (diffDay === 1) return 'yesterday';
  return `${diffDay} days ago`;
}
