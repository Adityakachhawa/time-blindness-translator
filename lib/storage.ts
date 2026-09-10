/**
 * lib/storage.ts
 * All localStorage access for the Time-Blindness Translator.
 * Every function is SSR-safe (guarded by typeof window check).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { LifetimeStats } from '../types/timer';
import { TROPHIES, type UnlockedTrophy } from './trophies';

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

const KEY_HISTORY       = 'tbt_task_history';
const KEY_MUTED         = 'tbt_muted';
const KEY_THEME         = 'tbt_theme';
const KEY_LIFETIME      = 'tbt_lifetime_stats';
const KEY_DAILY_COUNTS  = 'tbt_daily_counts';
export const KEY_UNLOCKED_TROPHIES = 'tbt_unlocked_trophies';
const KEY_HAS_SEEN_QUIZ = 'tbt_has_seen_quiz';
const KEY_HAS_SYNCED_HISTORY = 'tbt_has_synced_history';

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
// Lifetime stats
// ---------------------------------------------------------------------------

const DEFAULT_LIFETIME_STATS: LifetimeStats = {
  totalTasks: 0,
  totalMinutesSaved: 0,
  totalExtensions: 0,
};

/** Returns the lifetime stats object from localStorage. */
export function getLifetimeStats(): LifetimeStats {
  const stats = safeRead<LifetimeStats>(KEY_LIFETIME, DEFAULT_LIFETIME_STATS);
  return {
    totalTasks: typeof stats?.totalTasks === 'number' && !isNaN(stats.totalTasks) ? stats.totalTasks : 0,
    totalMinutesSaved: typeof stats?.totalMinutesSaved === 'number' && !isNaN(stats.totalMinutesSaved) ? stats.totalMinutesSaved : 0,
    totalExtensions: typeof stats?.totalExtensions === 'number' && !isNaN(stats.totalExtensions) ? stats.totalExtensions : 0,
  };
}

/**
 * Increments lifetime stats on completion of a mission.
 * minutesSaved must be (allocatedMin - optimisticMin) — the tax buffer applied.
 */
export function incrementLifetimeStats(minutesSaved: number, extensionsUsed: number): void {
  const current = getLifetimeStats();
  const updated: LifetimeStats = {
    totalTasks: current.totalTasks + 1,
    totalMinutesSaved: current.totalMinutesSaved + Math.max(0, minutesSaved),
    totalExtensions: current.totalExtensions + Math.max(0, extensionsUsed),
  };
  safeWrite(KEY_LIFETIME, updated);
}

// ---------------------------------------------------------------------------
// Daily completion counts (heatmap data)
// ---------------------------------------------------------------------------

/** ISO date string in YYYY-MM-DD format derived from a local calendar date. */
function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Increments the completion count for the given calendar day.
 * Un-trimmed (no MAX cap) — all days are retained to support the heatmap.
 * Should be called whenever a mission completes, alongside incrementLifetimeStats.
 */
export function incrementDailyCount(date: Date): void {
  const counts = safeRead<Record<string, number>>(KEY_DAILY_COUNTS, {});
  const key = toISODate(date);
  counts[key] = (typeof counts[key] === 'number' ? counts[key] : 0) + 1;
  safeWrite(KEY_DAILY_COUNTS, counts);
}

/**
 * Returns a { "YYYY-MM-DD": count } map for the trailing `days` calendar days
 * (including today). Days with no completions are absent from the returned object.
 *
 * @param days  Number of trailing days to include (e.g. 365 or 84 for 12 weeks).
 */
export function getDailyCounts(days: number): Record<string, number> {
  const all = safeRead<Record<string, number>>(KEY_DAILY_COUNTS, {});
  const result: Record<string, number> = {};
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toISODate(d);
    if (typeof all[key] === 'number' && all[key] > 0) {
      result[key] = all[key];
    }
  }
  return result;
}

/**
 * Returns the current streak of consecutive days with at least 1 task completed.
 * It walks backwards from today. If today has 0, but yesterday has >=1, the streak 
 * is still active and counted from yesterday backwards.
 */
export function getCurrentStreak(): number {
  const all = safeRead<Record<string, number>>(KEY_DAILY_COUNTS, {});
  let streak = 0;
  
  // Normalize to 12:00 PM local time to avoid any DST skip bugs when subtracting days
  const now = new Date();
  const noonToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  
  // Check today first
  const todayKey = toISODate(noonToday);
  if (typeof all[todayKey] === 'number' && all[todayKey] > 0) {
    streak++;
  }
  
  // Walk backwards from yesterday
  // We use an arbitrary deep limit (e.g., 3650 days = 10 years) just to prevent infinite loops,
  // though the break condition will catch the first gap anyway.
  for (let i = 1; i < 3650; i++) {
    const d = new Date(noonToday);
    d.setDate(d.getDate() - i);
    const key = toISODate(d);
    
    if (typeof all[key] === 'number' && all[key] > 0) {
      streak++;
    } else {
      break; // first gap stops the streak
    }
  }
  
  return streak;
}

// ---------------------------------------------------------------------------
// Trophies / Milestones
// ---------------------------------------------------------------------------

export function getUnlockedTrophies(): UnlockedTrophy[] {
  return safeRead<UnlockedTrophy[]>(KEY_UNLOCKED_TROPHIES, []);
}

export function unlockTrophy(id: string): void {
  const list = getUnlockedTrophies();
  if (!list.some(t => t.id === id)) {
    list.push({ id, earnedAt: Date.now() });
    safeWrite(KEY_UNLOCKED_TROPHIES, list);
  }
}

// ---------------------------------------------------------------------------
// Onboarding Quiz
// ---------------------------------------------------------------------------

export function getHasSeenQuiz(): boolean {
  return safeRead<boolean>(KEY_HAS_SEEN_QUIZ, false);
}

export function markQuizSeen(): void {
  safeWrite(KEY_HAS_SEEN_QUIZ, true);
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
// Retroactive Sync Utility
// ---------------------------------------------------------------------------

export function syncHistoricalData(): void {
  if (typeof window === 'undefined') return;
  const hasSynced = safeRead<boolean>(KEY_HAS_SYNCED_HISTORY, false);
  if (hasSynced) return;

  const history = getTaskHistory();
  if (history.length > 0) {
    // Clear existing to avoid double-counting any tasks that were recently logged
    safeWrite(KEY_DAILY_COUNTS, {});

    // 1. Rebuild Heatmap counts
    history.forEach((r) => {
      incrementDailyCount(new Date(r.completedAt));
    });

    // 2. Retroactively Unlock Trophies
    const totalTasks = history.length;
    const currentStreak = getCurrentStreak();

    TROPHIES.forEach((m) => {
      let achieved = false;
      if (m.type === 'lifetime-tasks' && totalTasks >= m.threshold) {
        achieved = true;
      } else if (m.type === 'streak' && currentStreak >= m.threshold) {
        achieved = true;
      }

      if (achieved) {
        unlockTrophy(m.id);
      }
    });
  }

  // Mark as synced so it never runs again
  safeWrite(KEY_HAS_SYNCED_HISTORY, true);
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
