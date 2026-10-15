import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Video, VideoComment } from '@/lib/server/types';
import { getFileMetadata, cleanVideoTitle } from '@/lib/server/drive';
import { ObjectId, Filter } from 'mongodb';
import { getBackupComments, saveBackupComment } from '@/lib/server/localBackup';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const backupComments = getBackupComments(id);
    let dbComments: VideoComment[] = [];

    try {
      const videosCol = await getCollection<Video>('videos');
      let filter: Filter<Video>;
      if (ObjectId.isValid(id) && id.length === 24) {
        filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
      } else {
        filter = { $or: [{ id }, { driveFileId: id }] };
      }

      const video = await videosCol.findOne(filter);
      if (video?.comments && Array.isArray(video.comments)) {
        dbComments = video.comments;
      }
    } catch (dbErr) {
      console.warn('DB comments query note:', dbErr);
    }

    // Merge comments uniquely by ID
    const commentMap = new Map<string, VideoComment>();
    for (const c of backupComments) {
      if (c && c.id) commentMap.set(c.id, c);
    }
    for (const c of dbComments) {
      if (c && c.id) commentMap.set(c.id, c);
    }

    return NextResponse.json(Array.from(commentMap.values()));
  } catch (error: unknown) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(getBackupComments(id));
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authResult = await authenticateRequest(req);
    const user = authResult.authenticated && authResult.user ? authResult.user : { name: 'User', email: 'guest@rcrd.com' };
    const body = await req.json();
    const { text, videoTime, timestamp } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    const newComment: VideoComment = {
      id: new ObjectId().toString(),
      text: text.trim(),
      author: user.name || 'User',
      userName: user.name || 'User',
      authorEmail: user.email || '',
      videoTime: videoTime || '0:00',
      timestamp: typeof timestamp === 'number' ? timestamp : 0,
      createdAt: Date.now(),
    };

    // Always immediately save to persistent local store so it is NEVER lost on refresh
    saveBackupComment(id, newComment);

    // Also persist to MongoDB
    try {
      const videosCol = await getCollection<Video>('videos');
      let filter: Filter<Video>;
      if (ObjectId.isValid(id) && id.length === 24) {
        filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
      } else {
        filter = { $or: [{ id }, { driveFileId: id }] };
      }

      const existing = await videosCol.findOne(filter);
      if (!existing) {
        const driveMeta = await getFileMetadata(id);
        await videosCol.insertOne({
          id,
          driveFileId: id,
          title: driveMeta?.title || cleanVideoTitle(driveMeta?.name || '', driveMeta?.createdTime || undefined),
          ownerId: 'google-drive-user',
          ownerName: 'Google Drive User',
          ownerEmail: 'admin@rcrd.com',
          views: 0,
          comments: [newComment],
          createdAt: driveMeta?.createdTime ? new Date(driveMeta.createdTime).getTime() : Date.now(),
          updatedAt: Date.now(),
          status: 'READY',
          isPublic: true,
        });
      } else {
        await videosCol.updateOne(filter, {
          $push: { comments: newComment },
          $set: { updatedAt: Date.now() },
        });
      }
    } catch (dbErr) {
      console.warn('DB comment push note (saved to persistent local store):', dbErr);
    }

    return NextResponse.json(newComment);
  } catch (error: unknown) {
    console.error('Error adding comment:', error);
    const fallbackComment: VideoComment = {
      id: Date.now().toString(),
      text: 'Reaction',
      userName: 'User',
      author: 'User',
      videoTime: '0:00',
      createdAt: Date.now(),
    };
    saveBackupComment(id, fallbackComment);
    return NextResponse.json(fallbackComment);
  }
}
