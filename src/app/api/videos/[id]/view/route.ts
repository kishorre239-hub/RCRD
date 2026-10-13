import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const videosCol = await getCollection<Video>('videos');
    let filter: any = {};
    try {
      filter = { _id: new ObjectId(id) };
    } catch {
      filter = { id };
    }

    await videosCol.updateOne(filter, {
      $inc: { views: 1 } as any,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error incrementing view count:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
