import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Video, VideoComment } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const body = await req.json();
    const { text, timestamp } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    const videosCol = await getCollection<Video>('videos');
    let filter: any = {};
    try {
      filter = { _id: new ObjectId(id) };
    } catch {
      filter = { id };
    }

    const newComment: VideoComment = {
      id: new ObjectId().toString(),
      text: text.trim(),
      author: user.name || 'Anonymous',
      authorEmail: user.email,
      timestamp: timestamp ? Number(timestamp) : 0,
      createdAt: Date.now(),
    };

    await videosCol.updateOne(filter, {
      $push: { comments: newComment },
      $set: { updatedAt: Date.now() },
    });

    return NextResponse.json(newComment);
  } catch (error: any) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
