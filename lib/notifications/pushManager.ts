/**
 * Helper to manage client-side Web Push subscriptions.
 */

const getDeviceId = (): string => {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('deviceId', id);
  }
  return id;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapid');
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey;
  } catch (e) {
    console.error('Failed to get VAPID public key', e);
    return null;
  }
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return await Notification.requestPermission();
}

export async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // If already subscribed, just update the backend to ensure it's recorded
    if (!subscription) {
      const publicKey = await getVapidPublicKey();
      if (!publicKey) return false;

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const deviceId = getDeviceId();
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, subscription }),
    });

    return res.ok;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }

    const deviceId = getDeviceId();
    const res = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });

    return res.ok;
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return false;
  }
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function scheduleMissionNotification(missionId: string, expectedEndAt: number): Promise<string | null> {
  try {
    const deviceId = getDeviceId();
    const res = await fetch('/api/notifications/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, missionId, expectedEndAt }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.messageId || null;
  } catch (error) {
    console.error('Error scheduling mission notification:', error);
    return null;
  }
}

export async function cancelMissionNotification(messageId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/notifications/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });

    return res.ok;
  } catch (error) {
    console.error('Error cancelling mission notification:', error);
    return false;
  }
}
