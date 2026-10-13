import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

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

    const user = authResult.user;
    const body = await req.json();
    const { text } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const videosCol = await getCollection<Video>('videos');
    let filter: any = {};
    try {
      filter = { _id: new ObjectId(id) };
    } catch {
      filter = { id };
    }

    await videosCol.updateOne(
      { ...filter, 'comments.id': commentId },
      {
        $set: {
          'comments.$.text': text.trim(),
          updatedAt: Date.now(),
        },
      }
    );

    return NextResponse.json({ success: true, text });
  } catch (error: any) {
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
    let filter: any = {};
    try {
      filter = { _id: new ObjectId(id) };
    } catch {
      filter = { id };
    }

    await videosCol.updateOne(filter, {
      $pull: { comments: { id: commentId } } as any,
      $set: { updatedAt: Date.now() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
