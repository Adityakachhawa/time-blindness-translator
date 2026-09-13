import { NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const redis = Redis.fromEnv();

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

async function handler(request: Request) {
  try {
    // Next.js clone request if it's already read by verifySignatureAppRouter
    // verifySignatureAppRouter does read the body, but it patches request.json() to work in older versions.
    // However, cloning is safest or we can just use request.json() and it should work with the wrapper.
    const body = await request.json();
    const { deviceId, missionId } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 });
    }

    const subData: any = await redis.get(`push:subscription:${deviceId}`);
    
    if (!subData || !subData.pushSubscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    try {
      await webpush.sendNotification(
        subData.pushSubscription,
        JSON.stringify({
          missionId,
          event: 'expired'
        })
      );
    } catch (pushError: any) {
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        // Subscription is no longer valid
        await redis.del(`push:subscription:${deviceId}`);
        console.log(`Deleted stale subscription for device ${deviceId}`);
      } else {
        throw pushError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error delivering notification:', error);
    return NextResponse.json({ error: 'Delivery failed' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
