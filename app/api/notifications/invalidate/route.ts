import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function POST(request: Request) {
  try {
    const { missionId, notificationVersion, completedAt } = await request.json();

    if (!missionId) {
      return NextResponse.json(
        { error: 'Missing missionId' },
        { status: 400 }
      );
    }

    // By setting the version to a sentinel value (-1), any in-flight
    // webhooks (which will have version >= 1) will be rejected by the
    // version-mismatch guard in deliver/route.ts.
    // We set a short TTL (10 minutes) so the key cleans itself up
    // once we're confident all possible delayed webhooks have passed.
    await redis.set(`push:mission:${missionId}`, { 
      expectedEndAt: 0, 
      notificationVersion: -1,
      invalidatedAt: completedAt || Date.now(),
      invalidatedVersion: notificationVersion
    }, { ex: 600 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error invalidating mission notification:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate notification metadata' },
      { status: 500 }
    );
  }
}
