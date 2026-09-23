/**
 * swDeliveryStore.ts
 *
 * A minimal IndexedDB store that records when the service worker actually
 * handles a time-up push event and calls showNotification().
 *
 * Written by: service worker (worker/index.ts) after showNotification succeeds.
 * Read by:    reconcileMission() (lib/mission/actions.ts) on page startup /
 *             visibility change to decide whether a catch-up notification is
 *             needed.
 *
 * IMPORTANT: this module must work in BOTH contexts:
 *   - Service worker (no window, no document; has ServiceWorkerGlobalScope)
 *   - Page (has window, document)
 *
 * Therefore: do NOT reference window, document, or any page-only globals.
 * Use only IndexedDB, which is available in both contexts.
 *
 * Semantic invariant:
 *   notificationMessageId ≠ delivery
 *   A record in this store means the OS notification was actually displayed.
 */

// ── Constants (MUST be identical in SW and page bundle) ───────────────────────
const DB_NAME = 'TBT_SWDeliveryDB';
const STORE_NAME = 'deliveries';
const DB_VERSION = 1;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SWDeliveryRecord {
  /** Canonical event ID: "mission:{missionId}:v{notificationVersion}:time-up" */
  eventId: string;
  missionId: string;
  notificationVersion: number;
  /** Epoch ms when the SW called showNotification() for this event. */
  handledAt: number;
  source: 'push' | 'page';
}

// ── DB singleton ──────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

/** Only for tests — resets the cached DB promise so a fresh DB is opened. */
export function __resetSWDeliveryDBForTest(): void {
  dbPromise = null;
}

function getDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }

  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          // keyPath = eventId → natural idempotency key per logical event
          db.createObjectStore(STORE_NAME, { keyPath: 'eventId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type ClaimResult = { status: 'claimed' | 'already-claimed' | 'error' };

/**
 * Attempts to atomically claim ownership of this canonical time-up event.
 * Uses IDB add() which strictly enforces uniqueness via ConstraintError.
 *
 * Returns:
 *   - 'claimed': successfully won the race, caller MUST show notification.
 *   - 'already-claimed': lost the race, another context handled it.
 *   - 'error': IDB unavailable. Coordination is impossible, so caller MUST NOT show OS notification.
 */
export async function claimNotification(
  missionId: string,
  notificationVersion: number,
  source: 'push' | 'page'
): Promise<ClaimResult> {
  try {
    const db = await getDB();
    const eventId = `mission:${missionId}:v${notificationVersion}:time-up`;
    const record: SWDeliveryRecord = {
      eventId,
      missionId,
      notificationVersion,
      handledAt: Date.now(),
      source,
    };

    return new Promise<ClaimResult>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const req = store.add(record);
      
      req.onsuccess = () => resolve({ status: 'claimed' });
      req.onerror = (e) => {
        e.preventDefault(); // Prevent transaction abort from surfacing as unhandled exception
        if (req.error?.name === 'ConstraintError') {
          resolve({ status: 'already-claimed' });
        } else {
          resolve({ status: 'error' });
        }
      };
    });
  } catch (err) {
    console.warn('[swDeliveryStore] claimNotification failed:', err);
    return { status: 'error' };
  }
}

/**
 * Releases a previously held claim so that another path may retry it.
 * Used when showNotification fails.
 */
export async function releaseNotificationClaim(
  missionId: string,
  notificationVersion: number
): Promise<void> {
  try {
    const db = await getDB();
    const eventId = `mission:${missionId}:v${notificationVersion}:time-up`;
    return new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(eventId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // Ignore deletion errors
    });
  } catch (err) {
    console.warn('[swDeliveryStore] releaseNotificationClaim failed:', err);
  }
}

/**
 * Removes records older than `olderThanMs` milliseconds.
 * Safe to call opportunistically; errors are swallowed.
 */
export async function pruneOldDeliveries(
  olderThanMs = DEFAULT_MAX_AGE_MS,
): Promise<void> {
  try {
    const db = await getDB();
    const cutoff = Date.now() - olderThanMs;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();

      req.onsuccess = () => {
        const cursor = (req as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          const record = cursor.value as SWDeliveryRecord;
          if (record.handledAt < cutoff) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[swDeliveryStore] pruneOldDeliveries failed:', err);
  }
}
