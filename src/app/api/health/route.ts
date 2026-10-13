import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';

export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json({
      status: 'UP',
      database: 'CONNECTED',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'DOWN',
        database: 'DISCONNECTED',
        error: error?.message,
        timestamp: Date.now(),
      },
      { status: 503 }
    );
  }
}
