import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { deleteDriveFile, getFileMetadata, cleanVideoTitle, renameDriveFile } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    let video: Video | null = null;
    try {
      const videosCol = await getCollection<Video>('videos');
      let filter: any = {};
      try {
        filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
      } catch {
        filter = { $or: [{ id }, { driveFileId: id }] };
      }
      video = await videosCol.findOne(filter);
    } catch {
      // Continue to check Google Drive if DB is unavailable
    }

    if (video) {
      const vidId = video.id || video._id?.toString() || id;
      const driveFileId = video.driveFileId || id;
      let duration = video.duration || 0;
      if (!duration && driveFileId && !driveFileId.startsWith('local:')) {
        const driveMeta = await getFileMetadata(driveFileId);
        if (driveMeta?.duration) duration = driveMeta.duration;
      }
      const normalized = {
        ...video,
        id: vidId,
        title: cleanVideoTitle(video.title, video.createdAt),
        views: video.views || 0,
        comments: video.comments || [],
        duration,
        thumbnailUrl: `/api/videos/${vidId}/thumbnail`,
        thumbnailLink: `/api/videos/${vidId}/thumbnail`,
      };
      return NextResponse.json(normalized);
    }

    // Fallback: Check Google Drive directly for the file
    const driveMeta = await getFileMetadata(id);
    if (driveMeta) {
      const driveVideo = {
        id: driveMeta.id,
        driveFileId: driveMeta.id,
        title: driveMeta.title || cleanVideoTitle(driveMeta.name || '', driveMeta.createdTime),
        rawName: driveMeta.name,
        ownerName: 'Google Drive User',
        ownerEmail: 'admin@rcrd.com',
        mimeType: driveMeta.mimeType || 'video/mp4',
        size: driveMeta.size ? Number(driveMeta.size) : 0,
        duration: driveMeta.duration || 0,
        thumbnailUrl: driveMeta.thumbnailUrl || '',
        thumbnailLink: driveMeta.thumbnailUrl || '',
        status: 'READY',
        isPublic: true,
        views: 0,
        comments: [],
        createdAt: driveMeta.createdTime ? new Date(driveMeta.createdTime).getTime() : Date.now(),
        updatedAt: driveMeta.createdTime ? new Date(driveMeta.createdTime).getTime() : Date.now(),
        webViewLink: driveMeta.webViewLink,
        webContentLink: driveMeta.webContentLink,
      };
      return NextResponse.json(driveVideo);
    }

    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  } catch (error: any) {
    console.error('Error fetching video details:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await authenticateRequest(req);
    const user = authResult.authenticated ? authResult.user : null;
    const userId = user?.id || user?._id?.toString() || 'dev-admin-id';
    const body = await req.json();

    const videosCol = await getCollection<Video>('videos');
    let filter: any = {};
    try {
      filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
    } catch {
      filter = { $or: [{ id }, { driveFileId: id }] };
    }

    let video = await videosCol.findOne(filter);

    const updateFields: any = { updatedAt: Date.now() };
    const newTitle = typeof body.title === 'string' ? body.title.trim() : undefined;
    if (newTitle !== undefined) updateFields.title = newTitle;
    if (body.courseId !== undefined) updateFields.courseId = body.courseId;
    if (body.editorData !== undefined) updateFields.editorData = body.editorData;

    // Determine the target Google Drive file ID to update
    const targetDriveFileId = video?.driveFileId || id;

    // If title changed and Google Drive file exists, update Drive file name too
    if (newTitle && targetDriveFileId && !targetDriveFileId.startsWith('local:')) {
      try {
        await renameDriveFile(targetDriveFileId, newTitle);
      } catch (driveErr) {
        console.warn('Could not rename Drive file:', driveErr);
      }
    }

    if (!video) {
      // Upsert new entry for Google Drive video
      const driveMeta = await getFileMetadata(id);
      await videosCol.insertOne({
        id,
        driveFileId: id,
        title: newTitle || driveMeta?.title || 'Drive Recording',
        ownerId: userId,
        ownerEmail: user?.email || 'admin@rcrd.com',
        workspaceId: user?.workspaceId || 'default',
        size: driveMeta?.size ? Number(driveMeta.size) : 0,
        duration: driveMeta?.duration || 0,
        thumbnailLink: driveMeta?.thumbnailUrl || '',
        mimeType: driveMeta?.mimeType || 'video/mp4',
        status: 'READY',
        isPublic: true,
        isCompanyShared: false,
        views: 0,
        comments: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...updateFields,
      });
      video = await videosCol.findOne({ driveFileId: id });
    } else {
      await videosCol.updateOne(filter, { $set: updateFields });
      video = await videosCol.findOne(filter);
    }

    return NextResponse.json({
      ...video,
      id: video?.id || video?._id?.toString() || id,
      title: updateFields.title || video?.title || newTitle,
    });
  } catch (error: any) {
    console.error('Error updating video:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const PATCH = PUT;

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await authenticateRequest(req);

    const videosCol = await getCollection<Video>('videos');
    let filter: any = {};
    try {
      filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
    } catch {
      filter = { $or: [{ id }, { driveFileId: id }] };
    }

    const video = await videosCol.findOne(filter);
    const driveFileId = video?.driveFileId || id;

    if (driveFileId && !driveFileId.startsWith('local:')) {
      try {
        await deleteDriveFile(driveFileId);
      } catch (e: any) {
        console.warn('Drive file deletion note:', e?.message);
      }
    }

    await videosCol.deleteOne(filter);
    return NextResponse.json({ success: true, message: 'Video deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
