export interface InvalidateAction {
  id: string; // crypto.randomUUID()
  type: 'INVALIDATE_NOTIFICATION';
  missionId: string;
  notificationVersion: number;
  completedAt: number;
  createdAt: number;
}

const DB_NAME = 'TBT_PendingActionsDB';
const STORE_NAME = 'actions';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

// Only for testing
export function __resetDBPromiseForTest() {
  dbPromise = null;
  flushPromise = null;
}

function getDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export async function enqueueInvalidation(missionId: string, notificationVersion: number, completedAt: number): Promise<void> {
  try {
    const db = await getDB();
    const action: InvalidateAction = {
      id: crypto.randomUUID(),
      type: 'INVALIDATE_NOTIFICATION',
      missionId,
      notificationVersion,
      completedAt,
      createdAt: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(action);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to enqueue invalidation action:', err);
  }
}

async function getAllActions(): Promise<InvalidateAction[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

async function removeAction(id: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error(`Failed to remove action ${id}:`, err);
  }
}

let flushPromise: Promise<void> | null = null;

export function flushPendingActions(): Promise<void> {
  // Single-flight concurrency guard. Multiple concurrent callers share the same promise.
  if (flushPromise) return flushPromise;
  
  flushPromise = (async () => {
    // In test environments without a window, navigator might be mocked
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isOffline) {
      return; // wait until online
    }
    
    const actions = await getAllActions();
    
    for (const action of actions) {
      if (action.type === 'INVALIDATE_NOTIFICATION') {
        try {
          // Include version and completedAt so server can be idempotent and version-aware if needed
          const res = await fetch('/api/notifications/invalidate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              missionId: action.missionId,
              notificationVersion: action.notificationVersion,
              completedAt: action.completedAt
            }),
          });
          
          if (res.ok) {
            await removeAction(action.id);
          } else if (res.status >= 400 && res.status < 500) {
            // Client errors (4xx) usually mean the request is bad, drop it to avoid infinite loop
            await removeAction(action.id);
          }
        } catch (fetchErr) {
          console.error('Failed to flush action, will retry later:', fetchErr);
          // Network failure, stop flushing other items to preserve order/avoid spam
          break;
        }
      }
    }
  })().finally(() => {
    flushPromise = null;
  });
  
  return flushPromise;
}
