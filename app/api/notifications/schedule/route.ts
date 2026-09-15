import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { Redis } from '@upstash/redis';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });
const redis = Redis.fromEnv();

export async function POST(request: Request) {
  try {
    const { deviceId, missionId, expectedEndAt, notificationVersion } = await request.json();

    if (!deviceId || !missionId || !expectedEndAt || notificationVersion === undefined) {
      return NextResponse.json(
        { error: 'Missing deviceId, missionId, expectedEndAt, or notificationVersion' },
        { status: 400 }
      );
    }

    // Verify subscription exists
    const subData = await redis.get(`push:subscription:${deviceId}`);
    if (!subData) {
      return NextResponse.json(
        { error: 'No push subscription found for device' },
        { status: 404 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    // Ensure URL has protocol
    const destinationUrl = appUrl.startsWith('http') ? `${appUrl}/api/notifications/deliver` : `https://${appUrl}/api/notifications/deliver`;

    const res = await qstash.publishJSON({
      url: destinationUrl,
      body: { deviceId, missionId, event: 'expired', scheduledEndAt: expectedEndAt, notificationVersion },
      notBefore: Math.floor(expectedEndAt / 1000), // convert ms to s for notBefore
    });

    // Persist the authoritative expectedEndAt and notificationVersion so the deliver route can detect stale
    // (orphaned) webhooks that were superseded by a mission extension.
    // TTL = time until expected end + 10 min grace, minimum 60 s.
    const ttlSeconds = Math.max(60, Math.ceil((expectedEndAt - Date.now()) / 1000) + 600);
    await redis.set(`push:mission:${missionId}`, { expectedEndAt, notificationVersion }, { ex: ttlSeconds });

    return NextResponse.json({ success: true, messageId: res.messageId });
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return NextResponse.json(
      { error: 'Failed to schedule notification' },
      { status: 500 }
    );
  }
}
