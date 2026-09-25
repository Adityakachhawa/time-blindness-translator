import type { RecoveryPlan } from './sequencer';

export const KEY_RMD_SESSION = 'rmd_active_session_v1';

export interface RmdRecoverySession {
  plan: RecoveryPlan;
  createdAt: number;
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

export function getRmdSession(): RmdRecoverySession | null {
  return safeRead<RmdRecoverySession | null>(KEY_RMD_SESSION, null);
}

export function saveRmdSession(session: RmdRecoverySession): void {
  safeWrite(KEY_RMD_SESSION, session);
}

export function clearRmdSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY_RMD_SESSION);
  } catch {
    // ignore
  }
}
