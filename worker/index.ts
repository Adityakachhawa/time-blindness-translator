/// <reference lib="webworker" />
// Ensure the file is treated as a module
export {};

declare let self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event: any) => {
  const promiseChain = (async () => {
    let title = 'Time Check';
    let body = 'Your mission budget is up — open the app to review it';
    let url = '/';
    let missionId = 'timer-alarm';
    let version = 1;

    if (event.data) {
      try {
        const data = event.data.json();
        if (data.missionId) {
          missionId = data.missionId;
        }
        if (data.notificationVersion) {
          version = data.notificationVersion;
        }
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
      // The app is visible. Show a silent notification and close it immediately
      // to satisfy the Web Push "user-visible notification" requirement 
      // without annoying the user with a duplicate alert, preventing Chrome's 
      // fallback "Tap to copy the URL" notification.
      await self.registration.showNotification('', { tag, silent: true });
      const notifications = await self.registration.getNotifications({ tag });
      for (const n of notifications) {
        n.close();
      }
      return;
    }

    const options = {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: { url: '/', missionId },
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500],
      tag,
      renotify: true
    };

    return self.registration.showNotification(title, options);
  })();

  event.waitUntil(promiseChain);
});


self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  // Next.js handles routing state internally; we always navigate to the root
  // origin, which will reconcile state based on localStorage.
  let urlPath = '/';
  const data = event.notification.data;
  
  if (data && data.url && data.url !== 'undefined' && data.url !== 'null') {
    urlPath = data.url;
  }

  // Ensure absolute URL
  const targetUrl = new URL(urlPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients: any) => {
      // Find an existing client for the app
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          matchingClient = client;
          break; // Use the first matching window/tab
        }
      }
      
      const payload = { 
        action: event.action, 
        tag: event.notification.tag, 
        missionId: data?.missionId !== 'undefined' ? data?.missionId : undefined 
      };

      if (matchingClient) {
        // If app is already open, post message, navigate if needed, and focus
        matchingClient.postMessage({ type: 'NOTIFICATION_CLICKED', payload });
        
        if ('navigate' in matchingClient && matchingClient.url !== targetUrl) {
          return (matchingClient as any).navigate(targetUrl)
            .then((c: any) => c ? c.focus() : matchingClient.focus())
            .catch(() => matchingClient.focus()); // navigate() throws on some Android WebViews
        }
        return matchingClient.focus();
      } else {
        // If not open, launch it
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
            .then((newClient: any) => {
              if (newClient) {
                // Need a slight delay to allow the new window to spin up its listener
                setTimeout(() => {
                  newClient.postMessage({ type: 'NOTIFICATION_CLICKED', payload });
                }, 1000);
              }
              return newClient;
            })
            .catch((err: any) => {
               console.error('Failed to open window', err);
            });
        }
      }
    })
  );
});
