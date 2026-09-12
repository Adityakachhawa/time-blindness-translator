import { useEffect, useRef } from 'react';

export function useWakeLock(isActive: boolean) {
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function requestWakeLock() {
      if (!isActive) {
        releaseWakeLock();
        return;
      }
      
      // We can only request wake lock if the document is visible
      if (document.visibilityState !== 'visible') return;

      try {
        const nav = navigator as any;
        if ('wakeLock' in nav && !wakeLockRef.current) {
          wakeLockRef.current = await nav.wakeLock.request('screen');
          
          wakeLockRef.current.addEventListener('release', () => {
            // Wake Lock was released gracefully by the OS (e.g. low battery, screen sleep)
            wakeLockRef.current = null;
          });
        }
      } catch (err) {
        // Handle unsupported browsers, battery-saver rejections, or permission denials
        console.warn('Wake Lock request failed:', err);
      }
    }

    async function releaseWakeLock() {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch (err) {
          console.warn('Wake Lock release failed:', err);
        }
        wakeLockRef.current = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && isActive) {
        requestWakeLock();
      } else {
        releaseWakeLock();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial evaluation when isActive changes
    requestWakeLock();

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isActive]);
}
