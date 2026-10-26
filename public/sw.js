/* No fetch handler or offline cache: authenticated/medical responses stay on network. */
self.addEventListener('push', (event) => {
  // Generic content only: never display clinical payloads on a lock screen.
  event.waitUntil(
    self.registration.showNotification('FHF Salud', {
      body: 'Tienes un aviso pendiente. Abre la aplicación para consultarlo.',
      icon: '/favicon/android-chrome-192x192.png',
      badge: '/favicon/android-chrome-192x192.png',
      data: { url: '/citas' },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const target = new URL('/citas', self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (client.url === target && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
