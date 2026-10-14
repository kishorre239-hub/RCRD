import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Video, VideoComment } from '@/lib/server/types';
import { getFileMetadata, cleanVideoTitle } from '@/lib/server/drive';
import { ObjectId } from 'mongodb';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const videosCol = await getCollection<Video>('videos');
    let filter: any;
    if (ObjectId.isValid(id) && id.length === 24) {
      filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
    } else {
      filter = { $or: [{ id }, { driveFileId: id }] };
    }

    const video = await videosCol.findOne(filter);
    return NextResponse.json(video?.comments || []);
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return NextResponse.json([]);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await authenticateRequest(req);
    const user = authResult.authenticated && authResult.user ? authResult.user : { name: 'User', email: 'guest@rcrd.com' };
    const body = await req.json();
    const { text, videoTime, timestamp } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    const videosCol = await getCollection<Video>('videos');
    let filter: any;
    if (ObjectId.isValid(id) && id.length === 24) {
      filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
    } else {
      filter = { $or: [{ id }, { driveFileId: id }] };
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

    const existing = await videosCol.findOne(filter);
    if (!existing) {
      const driveMeta = await getFileMetadata(id);
      await videosCol.insertOne({
        id,
        driveFileId: id,
        title: driveMeta?.title || cleanVideoTitle(driveMeta?.name || '', driveMeta?.createdTime),
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

    return NextResponse.json(newComment);
  } catch (error: any) {
    console.error('Error adding comment:', error);
    const fallbackComment = {
      id: Date.now().toString(),
      text: 'Reaction',
      userName: 'User',
      author: 'User',
      videoTime: '0:00',
      createdAt: Date.now(),
    };
    return NextResponse.json(fallbackComment);
  }
}
