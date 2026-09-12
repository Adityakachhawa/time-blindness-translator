import { ActiveMission } from '../mission/types';

export const KEY_NOTIFICATION_EVENTS = 'tbt_notification_events';

function getAcknowledgedEvents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY_NOTIFICATION_EVENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markEventAcknowledged(eventId: string) {
  if (typeof window === 'undefined') return;
  try {
    const events = getAcknowledgedEvents();
    if (!events.includes(eventId)) {
      events.push(eventId);
      // Keep list small
      if (events.length > 50) events.shift();
      window.localStorage.setItem(KEY_NOTIFICATION_EVENTS, JSON.stringify(events));
    }
  } catch {
    // ignore
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  
  // Note: This should ideally be called directly from a user gesture
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function hasNotificationPermission(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

/**
 * Fires a catch-up notification if the time is up, preventing duplicate alerts
 * by using a stable event ID based on the mission ID.
 */
export function sendCatchUpNotification(mission: ActiveMission): void {
  // We only support notifications in supported browsers with permission
  if (!hasNotificationPermission()) return;
  
  const eventId = `mission:${mission.id}:time-up`;
  const events = getAcknowledgedEvents();
  
  if (events.includes(eventId)) {
    // Already notified for this mission
    return;
  }
  
  // Check if Service Worker is ready to show the notification
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification('Time is up! 🚀', {
        body: `Your mission "${mission.taskName}" allocated time has completed.`,
        icon: '/icon-192x192.png',
        tag: 'mission-time-up', // Prevents multiple notifications piling up
        vibrate: [200, 100, 200, 100, 200],
        data: {
          url: '/'
        }
      });
      // Mark as acknowledged so we don't spam them on next reconcile
      markEventAcknowledged(eventId);
    }).catch((err) => {
      console.warn('Failed to show notification via service worker', err);
      // Fallback to standard web notification
      showFallbackNotification(mission, eventId);
    });
  } else {
    showFallbackNotification(mission, eventId);
  }
}

function showFallbackNotification(mission: ActiveMission, eventId: string) {
  try {
    const notification = new Notification('Time is up! 🚀', {
      body: `Your mission "${mission.taskName}" allocated time has completed.`,
      icon: '/icon-192x192.png',
      tag: 'mission-time-up',
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    markEventAcknowledged(eventId);
  } catch (err) {
    console.warn('Failed to show fallback notification', err);
  }
}
