/**
 * __tests__/swDelivery.test.ts
 *
 * Tests for swDeliveryStore (IDB) and the notification click routing logic.
 *
 * Uses fake-indexeddb for IDB tests.
 * Service worker notificationclick logic is tested via a JS-level simulation
 * since the actual SW runs in a separate context.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── fake-indexeddb: must be imported before the module under test ─────────────
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import {
  claimNotification,
  releaseNotificationClaim,
  pruneOldDeliveries,
  __resetSWDeliveryDBForTest,
} from '../lib/notifications/swDeliveryStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MISSION_ID = 'mission-abc-123';
const VERSION = 1;

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Fresh IDB instance per test — prevents state bleed between tests
  globalThis.indexedDB = new IDBFactory();
  __resetSWDeliveryDBForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// SW Delivery Store — IDB correctness
// =============================================================================

describe('swDeliveryStore — Atomic claimNotification', () => {

  it('returns { status: "claimed" } when no record exists', async () => {
    const result = await claimNotification(MISSION_ID, VERSION, 'push');
    expect(result.status).toBe('claimed');
  });

  it('returns { status: "already-claimed" } if claimed twice (idempotency)', async () => {
    await claimNotification(MISSION_ID, VERSION, 'push');
    const result2 = await claimNotification(MISSION_ID, VERSION, 'push');
    expect(result2.status).toBe('already-claimed');
  });

  it('[CONCURRENCY] simultaneous claims race → exactly one winner, one loser', async () => {
    // Both page and SW attempt to claim the exact same event at the exact same time
    const [result1, result2] = await Promise.all([
      claimNotification(MISSION_ID, VERSION, 'page'),
      claimNotification(MISSION_ID, VERSION, 'push'),
    ]);

    const statuses = [result1.status, result2.status];
    expect(statuses).toContain('claimed');
    expect(statuses).toContain('already-claimed');
  });

  it('stale notificationVersion — claim for v1 does not satisfy v2 check', async () => {
    await claimNotification(MISSION_ID, 1, 'push');
    // Mission was extended to v2 — v1 record must NOT count as claimed for v2
    const result = await claimNotification(MISSION_ID, 2, 'push');
    expect(result.status).toBe('claimed'); // v2 is a fresh canonical event
  });

  it('records for different missionIds are independent', async () => {
    await claimNotification('mission-1', 1, 'push');
    expect((await claimNotification('mission-1', 1, 'push')).status).toBe('already-claimed');
    expect((await claimNotification('mission-2', 1, 'push')).status).toBe('claimed');
  });

  it('records for different versions of the same missionId are independent', async () => {
    await claimNotification(MISSION_ID, 1, 'push');
    expect((await claimNotification(MISSION_ID, 1, 'push')).status).toBe('already-claimed');
    expect((await claimNotification(MISSION_ID, 2, 'push')).status).toBe('claimed');
  });

  it('releaseNotificationClaim allows a retry to claim the event', async () => {
    // Initial claim wins
    const claim1 = await claimNotification(MISSION_ID, VERSION, 'push');
    expect(claim1.status).toBe('claimed');

    // Show notification fails → release claim
    await releaseNotificationClaim(MISSION_ID, VERSION);

    // Another context attempts catch-up
    const claim2 = await claimNotification(MISSION_ID, VERSION, 'page');
    expect(claim2.status).toBe('claimed'); // Successfully claimed after release
  });

  it('releaseNotificationClaim is idempotent / does not throw if record is missing', async () => {
    await releaseNotificationClaim('non-existent', 99);
    // Should resolve without error
    expect(true).toBe(true);
  });
});

// =============================================================================
// pruneOldDeliveries
// =============================================================================

describe('swDeliveryStore — pruneOldDeliveries', () => {

  it('removes records older than the threshold', async () => {
    const baseTime = 1_000_000;
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(baseTime);

    await claimNotification(MISSION_ID, VERSION, 'push');

    // Advance mocked "now" by 8 days — record is now older than the 7-day threshold
    dateSpy.mockReturnValue(baseTime + 8 * 24 * 60 * 60 * 1000);
    await pruneOldDeliveries(7 * 24 * 60 * 60 * 1000);

    // It should be removed, so a new claim should succeed
    expect((await claimNotification(MISSION_ID, VERSION, 'push')).status).toBe('claimed');
    dateSpy.mockRestore();
  });

  it('keeps records younger than the threshold', async () => {
    const baseTime = 1_000_000;
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(baseTime);

    await claimNotification(MISSION_ID, VERSION, 'push');

    // Advance mocked "now" by only 3 days — record is within the 7-day threshold
    dateSpy.mockReturnValue(baseTime + 3 * 24 * 60 * 60 * 1000);
    await pruneOldDeliveries(7 * 24 * 60 * 60 * 1000);

    // Still exists, claim should return already-claimed
    expect((await claimNotification(MISSION_ID, VERSION, 'push')).status).toBe('already-claimed');
    dateSpy.mockRestore();
  });

});

// =============================================================================
// SW notificationclick routing logic (JS-level simulation)
//
// The actual SW runs in a separate JS context and cannot be unit-tested
// directly. We extract the routing decision logic here to verify it produces
// the correct target URL under all client configurations.
// Tests E, F, G.
// =============================================================================

describe('notificationclick routing — target URL derivation', () => {

  /**
   * Pure extraction of the URL-selection logic from worker/index.ts.
   * Kept here for deterministic unit testing without a SW environment.
   */
  function deriveTargetUrl(
    dataUrl: string | undefined | null,
    origin = 'https://time-blindness-translator.vercel.app',
  ): string {
    let urlPath = '/time-translator';
    if (dataUrl && dataUrl !== '/' && dataUrl !== 'undefined' && dataUrl !== 'null') {
      urlPath = dataUrl;
    }
    return new URL(urlPath, origin).href;
  }

  it('[TEST E] data.url = /time-translator → navigates to /time-translator', () => {
    const result = deriveTargetUrl('/time-translator');
    expect(result).toBe('https://time-blindness-translator.vercel.app/time-translator');
  });

  it('[TEST F] no client / data.url absent → opens /time-translator', () => {
    const result = deriveTargetUrl(undefined);
    expect(result).toBe('https://time-blindness-translator.vercel.app/time-translator');
  });

  it('[TEST G] data.url = / (legacy/default) → overridden to /time-translator', () => {
    // Old notifications had data.url = '/' — must be treated as absent
    const result = deriveTargetUrl('/');
    expect(result).toBe('https://time-blindness-translator.vercel.app/time-translator');
  });

  it('data.url = null → falls back to /time-translator', () => {
    const result = deriveTargetUrl(null);
    expect(result).toBe('https://time-blindness-translator.vercel.app/time-translator');
  });

  it('data.url = "undefined" (string) → falls back to /time-translator', () => {
    const result = deriveTargetUrl('undefined');
    expect(result).toBe('https://time-blindness-translator.vercel.app/time-translator');
  });

  it('HyperDopa homepage at / is NOT affected — this route is only opened by explicit navigation', () => {
    // Mission notifications never set data.url to '/'. This test documents that
    // the homepage remains reachable via normal navigation; it is simply not the
    // target of a notification click.
    const missionResult = deriveTargetUrl('/time-translator');
    expect(missionResult).not.toContain('https://time-blindness-translator.vercel.app/\x00');
    expect(missionResult).toBe('https://time-blindness-translator.vercel.app/time-translator');
  });

});

// =============================================================================
// Notification click client-matching logic (JS-level simulation)
// Tests correspond to Tests E (existing client at /time-translator),
// F (no client), G (existing client at /).
// =============================================================================

describe('notificationclick client-matching logic', () => {

  const SCOPE = 'https://time-blindness-translator.vercel.app/';
  const TARGET = 'https://time-blindness-translator.vercel.app/time-translator';

  /**
   * Simulates the client-matching and action decision from worker/index.ts.
   * Returns what action would be taken: 'navigate', 'focus', or 'openWindow'.
   */
  function simulateClickHandler(
    clients: Array<{ url: string; focused?: boolean }>,
    targetUrl = TARGET,
    scope = SCOPE,
  ): { action: 'navigate' | 'focus' | 'openWindow'; clientUrl?: string } {
    let matchingClient: { url: string; focused?: boolean } | null = null;
    for (const client of clients) {
      if (client.url.startsWith(scope)) {
        matchingClient = client;
        break;
      }
    }

    if (matchingClient) {
      if (matchingClient.url !== targetUrl) {
        return { action: 'navigate', clientUrl: matchingClient.url };
      }
      return { action: 'focus', clientUrl: matchingClient.url };
    }

    return { action: 'openWindow' };
  }

  it('[TEST E] existing client already at /time-translator → focus (no navigate needed)', () => {
    const result = simulateClickHandler([{ url: TARGET }]);
    expect(result.action).toBe('focus');
    expect(result.clientUrl).toBe(TARGET);
  });

  it('[TEST F] no TBT client exists → openWindow', () => {
    const result = simulateClickHandler([]);
    expect(result.action).toBe('openWindow');
  });

  it('[TEST G] existing client at / (HyperDopa homepage) → navigate to /time-translator', () => {
    const homepageUrl = 'https://time-blindness-translator.vercel.app/';
    const result = simulateClickHandler([{ url: homepageUrl }]);
    expect(result.action).toBe('navigate');
    expect(result.clientUrl).toBe(homepageUrl);
  });

  it('existing client at a different TBT sub-path → navigate to /time-translator', () => {
    const otherUrl = 'https://time-blindness-translator.vercel.app/privacy';
    const result = simulateClickHandler([{ url: otherUrl }]);
    expect(result.action).toBe('navigate');
  });

  it('multiple clients — picks the first one under scope', () => {
    const result = simulateClickHandler([
      { url: 'https://time-blindness-translator.vercel.app/privacy' },
      { url: TARGET },
    ]);
    // First matching client is /privacy — navigate
    expect(result.action).toBe('navigate');
    expect(result.clientUrl).toContain('privacy');
  });

});
