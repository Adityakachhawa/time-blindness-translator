/// <reference lib="webworker" />
// Ensure the file is treated as a module
export {};

declare let self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event: any) => {
  const promiseChain = (async () => {
    let title = 'Time check';
    let body = 'Your mission budget is up. Open the app to review it.';
    let url = '/';
    let missionId = 'timer-alarm';

    if (event.data) {
      try {
        const data = event.data.json();
        if (data.missionId) {
          missionId = data.missionId;
        }
        if (data.title) title = data.title;
        if (data.body) body = data.body;
      } catch (err) {
        const text = event.data.text();
        if (text) body = text;
      }
    }

    const options = {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: '/', missionId },
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500],
      tag: missionId,
      renotify: true
    };

    return self.registration.showNotification(title, options);
  })();

  event.waitUntil(promiseChain);
});


self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  // Safely resolve URL, handling cases where data might be missing or explicitly "undefined" (stringified)
  let urlPath = '/';
  const data = event.notification.data;
  
  if (data) {
    if (data.url && data.url !== 'undefined' && data.url !== 'null') {
      urlPath = data.url;
    } else if (data.missionId && data.missionId !== 'undefined' && data.missionId !== 'null') {
      urlPath = `/mission/${data.missionId}`;
    }
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
          return matchingClient.navigate(targetUrl).then((c: any) => c ? c.focus() : matchingClient.focus());
        }
        return matchingClient.focus();
      } else {
        // If not open, launch it
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl).then((newClient: any) => {
            if (newClient) {
              // Need a slight delay to allow the new window to spin up its listener
              setTimeout(() => {
                newClient.postMessage({ type: 'NOTIFICATION_CLICKED', payload });
              }, 1000);
            }
            return newClient;
          });
        }
      }
    })
  );
});
