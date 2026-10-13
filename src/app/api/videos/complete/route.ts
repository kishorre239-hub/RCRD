import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { getFileMetadata } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { videoId, driveFileId, title, duration, size } = body;

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    const videosCol = await getCollection<Video>('videos');
    let filter: any = {};
    try {
      filter = { _id: new ObjectId(videoId) };
    } catch {
      filter = { id: videoId };
    }

    const existingVideo = await videosCol.findOne(filter);
    if (!existingVideo) {
      return NextResponse.json({ error: 'Video record not found' }, { status: 404 });
    }

    let webViewLink = existingVideo.webViewLink;
    let thumbnailLink = existingVideo.thumbnailLink;

    if (driveFileId) {
      const driveMeta = await getFileMetadata(driveFileId);
      if (driveMeta) {
        webViewLink = driveMeta.webViewLink || webViewLink;
        thumbnailLink = driveMeta.thumbnailLink || thumbnailLink;
      }
    }

    const updateFields: Partial<Video> = {
      status: 'READY',
      updatedAt: Date.now(),
    };

    if (driveFileId) updateFields.driveFileId = driveFileId;
    if (title) updateFields.title = title;
    if (duration) updateFields.duration = Number(duration);
    if (size) updateFields.size = Number(size);
    if (webViewLink) updateFields.webViewLink = webViewLink;
    if (thumbnailLink) updateFields.thumbnailLink = thumbnailLink;

    await videosCol.updateOne(filter, { $set: updateFields });

    const updated = await videosCol.findOne(filter);
    const result = {
      ...updated,
      id: updated?.id || updated?._id?.toString(),
    };

    return NextResponse.json({
      success: true,
      video: result,
      videoId: result.id,
    });
  } catch (error: any) {
    console.error('Error completing video upload:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
