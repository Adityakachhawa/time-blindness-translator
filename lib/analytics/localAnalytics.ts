import { getTaskHistory } from '../storage';

const KEY_EVENTS = 'tbt_local_analytics_events';
const KEY_ACTIVE_DAYS = 'tbt_local_active_days';
const MAX_EVENTS = 1000;

export interface AnalyticsEvent {
  eventName: string;
  timestamp: number;
  payload?: any;
}

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
    // ignore
  }
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function trackActiveDay() {
  const activeDays = safeRead<string[]>(KEY_ACTIVE_DAYS, []);
  const today = toISODate(new Date());
  
  if (!activeDays.includes(today)) {
    activeDays.push(today);
    // Sort to keep the first day at index 0
    activeDays.sort();
    safeWrite(KEY_ACTIVE_DAYS, activeDays);
  }
}

export function trackEvent(eventName: string, payload?: any) {
  // Always track the day whenever any analytics event fires
  trackActiveDay();

  const events = safeRead<AnalyticsEvent[]>(KEY_EVENTS, []);
  events.push({
    eventName,
    timestamp: Date.now(),
    payload,
  });

  // Trim to max length to avoid quota issues
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }

  safeWrite(KEY_EVENTS, events);
}

export interface RetentionMetrics {
  firstActiveDate: string | null;
  day1Retention: boolean;
  day7Retention: boolean;
  day30Retention: boolean;
}

export function getRetentionMetrics(): RetentionMetrics {
  const activeDays = safeRead<string[]>(KEY_ACTIVE_DAYS, []);
  
  if (activeDays.length === 0) {
    return {
      firstActiveDate: null,
      day1Retention: false,
      day7Retention: false,
      day30Retention: false,
    };
  }

  const firstDateStr = activeDays[0];
  const firstDate = new Date(firstDateStr + 'T12:00:00Z'); // normalized noon UTC to prevent TZ shift
  
  const checkRetention = (days: number): boolean => {
    const targetDate = new Date(firstDate.getTime() + days * 24 * 60 * 60 * 1000);
    return activeDays.includes(toISODate(targetDate));
  };

  return {
    firstActiveDate: firstDateStr,
    day1Retention: checkRetention(1),
    day7Retention: checkRetention(7),
    day30Retention: checkRetention(30),
  };
}

export interface AccuracyImprovement {
  first5ErrorMs: number | null;
  recent5ErrorMs: number | null;
  improvementMs: number | null;
  improvementPercent: number | null;
}

export function getAccuracyImprovement(): AccuracyImprovement {
  // History is sorted newest first
  const history = getTaskHistory();
  
  // Filter only tasks that have valid absolute error data
  const validHistory = history.filter(t => typeof t.predictionErrorAbsoluteMs === 'number');

  if (validHistory.length < 10) {
    return {
      first5ErrorMs: null,
      recent5ErrorMs: null,
      improvementMs: null,
      improvementPercent: null,
    };
  }

  // history is newest first, so oldest are at the end
  const oldest5 = validHistory.slice(-5);
  const newest5 = validHistory.slice(0, 5);

  const avgError = (tasks: typeof history) => {
    const sum = tasks.reduce((acc, t) => acc + (t.predictionErrorAbsoluteMs || 0), 0);
    return sum / tasks.length;
  };

  const first5ErrorMs = avgError(oldest5);
  const recent5ErrorMs = avgError(newest5);
  const improvementMs = first5ErrorMs - recent5ErrorMs;
  
  let improvementPercent = 0;
  if (first5ErrorMs > 0) {
    improvementPercent = (improvementMs / first5ErrorMs) * 100;
  }

  return {
    first5ErrorMs,
    recent5ErrorMs,
    improvementMs,
    improvementPercent,
  };
}
