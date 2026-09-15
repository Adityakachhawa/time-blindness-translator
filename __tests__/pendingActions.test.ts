import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enqueueInvalidation, flushPendingActions, __resetDBPromiseForTest } from '../lib/notifications/pendingActions';

// Setup IndexedDB mock for Node
import 'fake-indexeddb/auto';

// Mock fetch
global.fetch = vi.fn();

import { IDBFactory } from 'fake-indexeddb';

describe('Pending Actions IDB Queue', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
    
    // Completely wipe the fake IndexedDB globally
    globalThis.indexedDB = new IDBFactory();
    
    // Reset the cached promise in the module so it requests a fresh DB
    __resetDBPromiseForTest();
  });

  it('C. queued invalidation: enqueues and flushes when online', async () => {
    (global.fetch as any).mockResolvedValueOnce(new Response(null, { status: 200 }));
    
    await enqueueInvalidation('mission-1', 1, 1000);
    await flushPendingActions();
    
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/notifications/invalidate', expect.objectContaining({
      body: JSON.stringify({ missionId: 'mission-1', notificationVersion: 1, completedAt: 1000 })
    }));
  });

  it('D. retry after network restoration: fails when offline, succeeds when online', async () => {
    // 1. Offline attempt
    vi.stubGlobal('navigator', { onLine: false });
    await enqueueInvalidation('mission-2', 2, 2000);
    await flushPendingActions();
    
    expect(global.fetch).not.toHaveBeenCalled(); // Fast-fails because offline
    
    // 2. Online restoration
    vi.stubGlobal('navigator', { onLine: true });
    (global.fetch as any).mockResolvedValueOnce(new Response(null, { status: 200 }));
    await flushPendingActions();
    
    expect(global.fetch).toHaveBeenCalledTimes(1); // successfully flushed
  });

  it('F. concurrent flush callers: single-flight guard prevents multiple parallel flushes', async () => {
    (global.fetch as any).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(new Response(null, { status: 200 })), 50)));
    
    await enqueueInvalidation('mission-3', 1, 1000);
    
    // Call flush 3 times concurrently
    const p1 = flushPendingActions();
    const p2 = flushPendingActions();
    const p3 = flushPendingActions();
    
    // All promises should be the exact same reference
    expect(p1).toBe(p2);
    expect(p2).toBe(p3);
    
    await Promise.all([p1, p2, p3]);
    
    // Fetch should only be called once because the items are dequeued in a single flight
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
