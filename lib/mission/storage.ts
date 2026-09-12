import { ActiveMission } from './types';

const KEY_ACTIVE_MISSION = 'tbt_active_mission';

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

export function getActiveMission(): ActiveMission | null {
  return safeRead<ActiveMission | null>(KEY_ACTIVE_MISSION, null);
}

export function setActiveMission(mission: ActiveMission): void {
  safeWrite(KEY_ACTIVE_MISSION, mission);
}

export function clearActiveMission(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY_ACTIVE_MISSION);
  } catch {
    // ignore
  }
}
