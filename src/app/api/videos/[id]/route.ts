import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { deleteDriveFile, getFileMetadata, cleanVideoTitle, renameDriveFile, moveDriveFile } from '@/lib/server/drive';
import { Video, VideoComment } from '@/lib/server/types';
import { ObjectId, Filter } from 'mongodb';
import { getBackupComments, getBackupVideoMeta, saveBackupVideoMeta } from '@/lib/server/localBackup';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    const backupComments = getBackupComments(id);
    const backupMeta = getBackupVideoMeta(id);

    let video: Video | null = null;
    try {
      const videosCol = await getCollection<Video>('videos');
      let filter: Filter<Video> = {};
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

      // Merge MongoDB comments with local backup comments
      const commentMap = new Map<string, VideoComment>();
      if (backupComments && Array.isArray(backupComments)) {
        for (const c of backupComments) {
          if (c && c.id) commentMap.set(c.id, c);
        }
      }
      if (video.comments && Array.isArray(video.comments)) {
        for (const c of video.comments) {
          if (c && c.id) commentMap.set(c.id, c);
        }
      }

      const mergedComments = Array.from(commentMap.values());
      const rawTitle = backupMeta?.title || video.title;

      // Prefer newest editorData
      let resolvedEditorData = video.editorData || backupMeta?.editorData || null;
      if (backupMeta?.editorData && video.editorData) {
        const bData = backupMeta.editorData as Record<string, unknown>;
        const backupTime = bData?.savedAt ? new Date(String(bData.savedAt)).getTime() : (backupMeta.updatedAt || 0);
        const dbData = video.editorData as Record<string, unknown> | null | undefined;
        const dbTime = dbData?.savedAt ? new Date(String(dbData.savedAt)).getTime() : (video.updatedAt || 0);
        if (backupTime > dbTime) {
          resolvedEditorData = backupMeta.editorData;
        }
      }
      if (!resolvedEditorData && driveFileId && !driveFileId.startsWith('local:')) {
        const driveMeta = await getFileMetadata(driveFileId);
        if (driveMeta?.editorData) resolvedEditorData = driveMeta.editorData;
      }

      const normalized = {
        ...video,
        id: vidId,
        title: cleanVideoTitle(rawTitle, video.createdAt),
        views: Math.max(video.views || 0, backupMeta?.views || 0),
        comments: mergedComments,
        editorData: resolvedEditorData,
        duration,
        thumbnailUrl: `/api/videos/${vidId}/thumbnail`,
        thumbnailLink: `/api/videos/${vidId}/thumbnail`,
      };
      return NextResponse.json(normalized);
    }

    // Fallback: Check Google Drive directly for the file
    const driveMeta = await getFileMetadata(id);
    if (driveMeta) {
      const chosenTitle = backupMeta?.title || driveMeta.title || cleanVideoTitle(driveMeta.name || '', driveMeta.createdTime || undefined);
      const driveVideo = {
        id: driveMeta.id,
        driveFileId: driveMeta.id,
        title: chosenTitle,
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
        views: backupMeta?.views || 0,
        comments: backupComments || [],
        editorData: backupMeta?.editorData || null,
        createdAt: driveMeta.createdTime ? new Date(driveMeta.createdTime).getTime() : Date.now(),
        updatedAt: driveMeta.createdTime ? new Date(driveMeta.createdTime).getTime() : Date.now(),
        webViewLink: driveMeta.webViewLink,
        webContentLink: driveMeta.webContentLink,
      };
      return NextResponse.json(driveVideo);
    }

    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  } catch (error: unknown) {
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

    const updateFields: Record<string, unknown> = { updatedAt: Date.now() };
    const newTitle = typeof body.title === 'string' ? body.title.trim() : undefined;
    if (newTitle !== undefined) {
      updateFields.title = newTitle;
    }
    if (body.courseId !== undefined) {
      updateFields.courseId = body.courseId;
    }
    if (body.editorData !== undefined) {
      let parsedEditorData = body.editorData;
      if (typeof parsedEditorData === 'string') {
        try {
          parsedEditorData = JSON.parse(parsedEditorData);
        } catch {}
      }
      updateFields.editorData = parsedEditorData;
    }

    // Always persist to local backup store immediately (guarantees zero data loss!)
    saveBackupVideoMeta(id, updateFields);

    let video: Video | null = null;
    let targetDriveFileId = id;

    try {
      const videosCol = await getCollection<Video>('videos');
      let filter: Filter<Video> = {};
      try {
        filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
      } catch {
        filter = { $or: [{ id }, { driveFileId: id }] };
      }

      video = await videosCol.findOne(filter);
      targetDriveFileId = video?.driveFileId || id;

      if (video?.id && video.id !== id) {
        saveBackupVideoMeta(video.id, updateFields);
      }
      if (video?.driveFileId && video.driveFileId !== id) {
        saveBackupVideoMeta(video.driveFileId, updateFields);
      }

      // If title changed, rename Google Drive file
      if (newTitle && targetDriveFileId && !targetDriveFileId.startsWith('local:')) {
        try {
          await renameDriveFile(targetDriveFileId, newTitle);
        } catch (driveErr) {
          console.warn('Could not rename Drive file:', driveErr);
        }
      }

      // If folder changed (video moved), move file in Google Drive
      if (body.courseId !== undefined && targetDriveFileId && !targetDriveFileId.startsWith('local:')) {
        try {
          await moveDriveFile(targetDriveFileId, body.courseId, body.folderName);
        } catch (driveErr) {
          console.warn('Could not move Drive file:', driveErr);
        }
      }

      // If editorData changed, persist directly to Google Drive file
      if (body.editorData !== undefined && targetDriveFileId && !targetDriveFileId.startsWith('local:')) {
        try {
          const { updateDriveFileEditorData } = await import('@/lib/server/drive');
          await updateDriveFileEditorData(targetDriveFileId, body.editorData);
        } catch (driveErr) {
          console.warn('Could not update Drive file editor data:', driveErr);
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
        const vidFilter = video._id ? { _id: video._id } : filter;
        await videosCol.updateOne(vidFilter, { $set: updateFields });
        video = await videosCol.findOne(vidFilter);
      }
    } catch (dbErr) {
      console.warn('MongoDB update warning, continuing with local backup:', (dbErr as Error)?.message);
    }

    return NextResponse.json({
      ...(video || {}),
      id: video?.id || video?._id?.toString() || id,
      title: updateFields.title || video?.title || newTitle || 'Video',
      editorData: updateFields.editorData !== undefined ? updateFields.editorData : (video?.editorData || null),
      success: true,
    });
  } catch (error: unknown) {
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
    let filter: Filter<Video> = {};
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
      } catch (e: unknown) {
        console.warn('Drive file deletion note:', (e as Error)?.message);
      }
    }

    await videosCol.deleteOne(filter);
    return NextResponse.json({ success: true, message: 'Video deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
