import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Video } from '@/lib/server/types';
import { ObjectId } from 'mongodb';
import { getBackupVideoMeta, saveBackupVideoMeta } from '@/lib/server/localBackup';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const backupMeta = getBackupVideoMeta(id);

    try {
      const videosCol = await getCollection<Video>('videos');
      let filter: any = {};
      try {
        filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
      } catch {
        filter = { $or: [{ id }, { driveFileId: id }] };
      }
      const video = await videosCol.findOne(filter);
      let editorData = video?.editorData || backupMeta?.editorData || null;

      if (!editorData && id && !id.startsWith('local:')) {
        const { getFileMetadata } = await import('@/lib/server/drive');
        const driveMeta = await getFileMetadata(id);
        if (driveMeta?.editorData) editorData = driveMeta.editorData;
      }

      return NextResponse.json({ success: true, editorData });
    } catch {
      let editorData = backupMeta?.editorData || null;
      if (!editorData && id && !id.startsWith('local:')) {
        try {
          const { getFileMetadata } = await import('@/lib/server/drive');
          const driveMeta = await getFileMetadata(id);
          if (driveMeta?.editorData) editorData = driveMeta.editorData;
        } catch {}
      }
      return NextResponse.json({ success: true, editorData });
    }
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error)?.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await authenticateRequest(req); // validate if present, but don't hard block editor saves
    const body = await req.json();

    // 1. Immediately save to local backup
    saveBackupVideoMeta(id, { editorData: body });

    // 2. Persist to MongoDB
    try {
      const videosCol = await getCollection<Video>('videos');
      let filter: any = {};
      try {
        filter = { $or: [{ _id: new ObjectId(id) }, { id }, { driveFileId: id }] };
      } catch {
        filter = { $or: [{ id }, { driveFileId: id }] };
      }

      await videosCol.updateOne(filter, {
        $set: { editorData: body, updatedAt: Date.now() },
      }, { upsert: false });
    } catch (dbErr) {
      console.warn('MongoDB editor-data save warning:', (dbErr as Error)?.message);
    }

    // 3. Persist to Google Drive file description & properties
    if (id && !id.startsWith('local:')) {
      try {
        const { updateDriveFileEditorData } = await import('@/lib/server/drive');
        await updateDriveFileEditorData(id, body);
      } catch (driveErr) {
        console.warn('Google Drive editor-data save note:', driveErr);
      }
    }

    return NextResponse.json({ success: true, editorData: body });
  } catch (error: unknown) {
    console.error('Error saving editor data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const PUT = POST;
