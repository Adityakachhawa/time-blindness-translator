// Ensure the file is treated as a module
export {};

declare let self: ServiceWorkerGlobalScope;

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Focus the window or open a new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        
        // If so, just focus it.
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new one.
      const urlToOpen = event.notification.data?.url || '/';
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
