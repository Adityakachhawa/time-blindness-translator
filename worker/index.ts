/// <reference lib="webworker" />
// Ensure the file is treated as a module
export {};

declare let self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event: any) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    // Default fallback text
    let title = 'Time check';
    let body = 'Your mission budget is up. Open the app to review it.';
    let url = '/';

    if (data.missionId) {
      url = `/mission/${data.missionId}`;
    }

    if (data.title) title = data.title;
    if (data.body) body = data.body;

    const options = {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url, missionId: data.missionId },
      vibrate: [200, 100, 200]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error processing push event:', err);
  }
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || (event.notification.data?.missionId ? `/mission/${event.notification.data.missionId}` : '/');

  // Focus the window or open a new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients: any) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        
        // If so, navigate and focus it.
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICKED', payload: { action: event.action, tag: event.notification.tag, missionId: event.notification.data?.missionId } });
          
          if ('navigate' in client && client.url !== new URL(urlToOpen, self.location.origin).href) {
            return client.navigate(urlToOpen).then((c: any) => c ? c.focus() : client.focus());
          }
          return client.focus();
        }
      }
      // If not, open a new one.
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen).then((newClient: any) => {
          if (newClient) {
            // Need a slight delay to allow the new window to spin up its listener
            setTimeout(() => {
              newClient.postMessage({ type: 'NOTIFICATION_CLICKED', payload: { action: event.action, tag: event.notification.tag, missionId: event.notification.data?.missionId } });
            }, 1000);
          }
          return newClient;
        });
      }
    })
  );
});
