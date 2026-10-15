import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Video } from '@/lib/server/types';
import { ObjectId, Filter } from 'mongodb';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id, commentId } = await params;
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { text } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const videosCol = await getCollection<Video>('videos');
    let filter: Filter<Video> = {};
    try {
      filter = { _id: new ObjectId(id) as unknown as string };
    } catch {
      filter = { id };
    }

    await videosCol.updateOne(
      { ...filter, 'comments.id': commentId } as Filter<Video>,
      {
        $set: {
          'comments.$.text': text.trim(),
          updatedAt: Date.now(),
        },
      }
    );

    return NextResponse.json({ success: true, text });
  } catch (error: unknown) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id, commentId } = await params;
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const videosCol = await getCollection<Video>('videos');
    let filter: Filter<Video> = {};
    try {
      filter = { _id: new ObjectId(id) as unknown as string };
    } catch {
      filter = { id };
    }

    await videosCol.updateOne(filter, {
      $pull: { comments: { id: commentId } as unknown as never },
      $set: { updatedAt: Date.now() },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
