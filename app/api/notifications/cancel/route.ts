import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

export async function POST(request: Request) {
  try {
    const { messageId } = await request.json();

    if (!messageId) {
      return NextResponse.json(
        { error: 'Missing messageId' },
        { status: 400 }
      );
    }

    await qstash.messages.delete(messageId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling scheduled notification:', error);
    // Cancellation should be idempotent, returning 200 even if already cancelled
    return NextResponse.json({ success: true });
  }
}
