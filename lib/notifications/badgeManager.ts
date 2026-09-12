/**
 * Sets a badge on the app icon, if supported by the browser/OS.
 */
export async function setAppBadge(count = 1): Promise<void> {
  if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
    try {
      await (navigator as any).setAppBadge(count);
    } catch (error) {
      console.warn('Failed to set app badge:', error);
    }
  }
}

/**
 * Clears the app badge, if supported by the browser/OS.
 */
export async function clearAppBadge(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
    try {
      await (navigator as any).clearAppBadge();
    } catch (error) {
      console.warn('Failed to clear app badge:', error);
    }
  }
}
