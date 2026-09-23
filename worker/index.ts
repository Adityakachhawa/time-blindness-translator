/// <reference lib="webworker" />
// Ensure the file is treated as a module
export {};

import { claimNotification, releaseNotificationClaim } from '../lib/notifications/swDeliveryStore';

declare let self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event: any) => {
  const promiseChain = (async () => {
    let title = 'Time Check';
    let body = 'Your mission budget is up — open the app to review it';
    let missionId = 'timer-alarm';
    let version = 1;

    if (event.data) {
      try {
        const data = event.data.json();
        if (data.missionId) missionId = data.missionId;
        if (data.notificationVersion) version = data.notificationVersion;
        if (data.title) title = data.title;
        if (data.body) body = data.body;
      } catch (err) {
        const text = event.data.text();
        if (text) body = text;
      }
    }

    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    let isFocused = false;
    for (let i = 0; i < windowClients.length; i++) {
      if (windowClients[i].focused) {
        isFocused = true;
        break;
      }
    }

    const tag = `mission:${missionId}:v${version}:time-up`;

    if (isFocused) {
      // The app is in the foreground. Show a silent notification and immediately
      // close it to satisfy the Web Push "user-visible notification" requirement
      // without annoying the user with a duplicate OS alert, and to prevent
      // Chrome's fallback "Tap to copy the URL" notification.
      //
      // IMPORTANT: do NOT claim the notification event here. We have not produced
      // a visible OS notification, so the event should remain available for
      // the page's in-app Reality Check handling.
      await self.registration.showNotification('', { tag, silent: true });
      const notifications = await self.registration.getNotifications({ tag });
      for (const n of notifications) n.close();
      return;
    }

    // ── Background: show the OS notification ──────────────────────────────────
    
    // Attempt to claim atomic ownership of this event.
    const claim = await claimNotification(missionId, version, 'push');
    
    if (claim.status !== 'claimed') {
      // 'already-claimed': Lost race to page catch-up or duplicate push.
      // 'error': IDB failed. We MUST suppress the OS notification to avoid duplicates.
      return;
    }

    const options = {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      // Explicitly set to /time-translator so the click handler navigates the
      // user to the correct route rather than the HyperDopa homepage at /.
      data: { url: '/time-translator', missionId },
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500],
      tag,
      renotify: true,
    };

    try {
      await self.registration.showNotification(title, options);
    } catch (err) {
      console.warn('showNotification failed', err);
      // If we claimed the event but failed to show it, release the claim so
      // that a subsequent catch-up attempt is allowed.
      await releaseNotificationClaim(missionId, version);
    }
  })();

  event.waitUntil(promiseChain);
});


self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  // Default to /time-translator. This is the correct TBT route for mission
  // review. Only override if data.url is an explicit non-root, non-empty value.
  // This preserves the HyperDopa homepage at / (never navigated to by mission
  // notifications) while ensuring TBT clients open at the right screen.
  const data = event.notification.data;
  let urlPath = '/time-translator';
  if (
    data &&
    data.url &&
    data.url !== '/' &&
    data.url !== 'undefined' &&
    data.url !== 'null'
  ) {
    urlPath = data.url;
  }

  const targetUrl = new URL(urlPath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients: any) => {
        // Find the first TBT client (any URL under this SW's scope)
        let matchingClient: any = null;
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (
            client.url.startsWith(self.registration.scope) &&
            'focus' in client
          ) {
            matchingClient = client;
            break;
          }
        }

        const payload = {
          action: event.action,
          tag: event.notification.tag,
          missionId:
            data?.missionId !== 'undefined' ? data?.missionId : undefined,
        };

        if (matchingClient) {
          // App is already open. Post the click event for analytics, then
          // navigate to /time-translator if not already there, and focus.
          matchingClient.postMessage({ type: 'NOTIFICATION_CLICKED', payload });

          if (
            'navigate' in matchingClient &&
            matchingClient.url !== targetUrl
          ) {
            return (matchingClient as any)
              .navigate(targetUrl)
              .then((c: any) => (c || matchingClient).focus())
              .catch(() => matchingClient.focus()); // Android WebView fallback
          }
          return matchingClient.focus();
        }

        // No existing TBT client — open a new window at /time-translator.
        if (self.clients.openWindow) {
          return self.clients
            .openWindow(targetUrl)
            .then((newClient: any) => {
              if (newClient) {
                // Delay postMessage so the new page can mount its SW listener.
                setTimeout(() => {
                  newClient.postMessage({
                    type: 'NOTIFICATION_CLICKED',
                    payload,
                  });
                }, 1000);
              }
              return newClient;
            })
            .catch((err: any) => {
              console.error('Failed to open window', err);
            });
        }
      }),
  );
});
