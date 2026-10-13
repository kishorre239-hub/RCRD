import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

export async function PUT(
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
    const userId = user.id || user._id?.toString();

    const videosCol = await getCollection<Video>('videos');
    let filter: any = {};
    try {
      filter = { _id: new ObjectId(id) };
    } catch {
      filter = { id };
    }

    const video = await videosCol.findOne(filter);
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.ownerId !== userId && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isPublic = !video.isPublic;
    const shareToken = isPublic ? (video.shareToken || crypto.randomUUID()) : video.shareToken;

    await videosCol.updateOne(filter, {
      $set: {
        isPublic,
        shareToken,
        updatedAt: Date.now(),
      },
    });

    return NextResponse.json({
      isPublic,
      shareToken,
      shareUrl: shareToken ? `/video/share/${shareToken}` : null,
    });
  } catch (error: any) {
    console.error('Error toggling share:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
