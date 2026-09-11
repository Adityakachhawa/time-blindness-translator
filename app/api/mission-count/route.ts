import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { Ratelimit } from '@upstash/ratelimit';

// Create a new ratelimiter, that allows 5 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(5, '10 s'),
});

function getTodayKey() {
  const date = new Date().toISOString().split('T')[0];
  return `count:${date}`;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const { success } = await ratelimit.limit(`ratelimit_${ip}`);
    
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
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
  try {
    const key = getTodayKey();
    const count = (await kv.get<number>(key)) || 0;
    
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching counter:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
