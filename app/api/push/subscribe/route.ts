import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis client using environment variables
const redis = Redis.fromEnv();

export async function POST(request: Request) {
  try {
    const { deviceId, subscription } = await request.json();

    if (!deviceId || !subscription) {
      return NextResponse.json(
        { error: 'Missing deviceId or subscription' },
        { status: 400 }
      );
    }

    const subscriptionData = {
      deviceId,
      pushSubscription: subscription,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Store in Upstash Redis. Key format: push:subscription:{deviceId}
    await redis.set(`push:subscription:${deviceId}`, subscriptionData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}
