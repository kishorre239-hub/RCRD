import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { getFileMetadata } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';
import { saveBackupVideoMeta } from '@/lib/server/localBackup';

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const user = (authResult.authenticated && authResult.user ? authResult.user : null) || {
      _id: 'default-admin',
      id: 'default-admin',
      name: 'System User',
      email: 'admin@meet.com',
      role: 'ADMIN',
      status: 'Active',
    };

    const body = await req.json();
    const { videoId, driveFileId, title, duration, size } = body;

    if (!videoId && !driveFileId) {
      return NextResponse.json({ error: 'videoId or driveFileId is required' }, { status: 400 });
    }

    const finalId = driveFileId || videoId;
    let webViewLink = '';
    let thumbnailLink = '';

    if (driveFileId) {
      try {
        const driveMeta = await getFileMetadata(driveFileId);
        if (driveMeta) {
          webViewLink = driveMeta.webViewLink || '';
          thumbnailLink = driveMeta.thumbnailLink || '';
        }
      } catch {}
    }

    const updateFields: Record<string, unknown> = {
      status: 'READY',
      updatedAt: Date.now(),
    };

    if (driveFileId) updateFields.driveFileId = driveFileId;
    if (title) updateFields.title = title;
    if (duration) updateFields.duration = Number(duration);
    if (size) updateFields.size = Number(size);
    if (webViewLink) updateFields.webViewLink = webViewLink;
    if (thumbnailLink) updateFields.thumbnailLink = thumbnailLink;

    // Immediately persist to local backup
    saveBackupVideoMeta(finalId, updateFields);
    if (videoId && videoId !== finalId) {
      saveBackupVideoMeta(videoId, updateFields);
    }

    let result: Record<string, unknown> = { id: finalId, ...updateFields };

    try {
      const videosCol = await getCollection<Video>('videos');
      let filter: Record<string, unknown> = {};
      try {
        filter = { $or: [{ _id: new ObjectId(videoId) }, { id: videoId }, { driveFileId: finalId }] };
      } catch {
        filter = { $or: [{ id: videoId }, { driveFileId: finalId }] };
      }

      await videosCol.updateOne(filter as any, { $set: updateFields }, { upsert: false });
      const updated = await videosCol.findOne(filter as any);
      if (updated) {
        result = {
          ...updated,
          id: updated.id || updated._id?.toString() || finalId,
        };
      }
    } catch (dbErr) {
      console.warn('MongoDB note in /api/videos/complete:', dbErr);
    }

    return NextResponse.json({
      success: true,
      video: result,
      videoId: finalId,
      id: finalId,
      driveFileId: driveFileId || finalId,
    });
  } catch (error: unknown) {
    console.error('Error completing video upload:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
