'use client';

import { useEffect } from 'react';

/** Registers capabilities only. Never requests notification permission on load. */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    )
      return;
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // Installation is optional; normal navigation remains available on failure.
      });
  }, []);
  return null;
}
