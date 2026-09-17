import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { Ratelimit } from '@upstash/ratelimit';

// Helper to check if KV is configured
const isKvConfigured = () => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
};

let ratelimit: Ratelimit | null = null;

function getRatelimit() {
  if (!ratelimit && isKvConfigured()) {
    ratelimit = new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(5, '10 s'),
    });
  }
  return ratelimit;
}

function getTodayKey() {
  const date = new Date().toISOString().split('T')[0];
  return `count:${date}`;
}

export async function POST(request: Request) {
  if (!isKvConfigured()) {
    // Graceful fallback: act like it succeeded, so client behavior is preserved
    return NextResponse.json({ success: true, warning: 'KV not configured' });
  }

  try {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const limiter = getRatelimit();
    
    if (limiter) {
      const { success } = await limiter.limit(`ratelimit_${ip}`);
      if (!success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
    }

    const key = getTodayKey();
    await kv.incr(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error incrementing counter:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  if (!isKvConfigured()) {
    // Graceful fallback: return 0, which client interprets as hidden
    return NextResponse.json({ count: 0, warning: 'KV not configured' });
  }

  try {
    const key = getTodayKey();
    const count = (await kv.get<number>(key)) || 0;
    
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching counter:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
