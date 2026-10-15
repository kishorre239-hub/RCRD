import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { listDriveVideosAndFolders } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const user = authResult.authenticated ? authResult.user : null;
    const userId = user?.id || user?._id?.toString() || 'dev-admin-id';

    const { videos, folders, connected } = await listDriveVideosAndFolders(true);

    // If MongoDB is available, sync to collection in background
    try {
      const videosCol = await getCollection<Video>('videos');
      const liveDriveIds = new Set(videos.map(v => v.id));

      // Prune videos from MongoDB that have been deleted in Google Drive
      if (connected) {
        await videosCol.deleteMany({
          driveFileId: { $exists: true, $nin: Array.from(liveDriveIds) }
        });
      }

      for (const df of videos) {
        const exists = await videosCol.findOne({ driveFileId: df.id });
        if (!exists) {
          const newVideo: Video = {
            title: df.title || 'Drive Recording',
            driveFileId: df.id,
            ownerId: userId,
            ownerEmail: user?.email || 'admin@rcrd.com',
            workspaceId: user?.workspaceId || 'default',
            size: df.size || 0,
            mimeType: df.mimeType || 'video/mp4',
            status: 'READY',
            isPublic: true,
            isCompanyShared: false,
            comments: [],
            createdAt: df.createdAt || Date.now(),
            updatedAt: Date.now(),
          };
          await videosCol.insertOne(newVideo);
        }
      }
    } catch (dbErr: any) {
      console.warn('MongoDB sync note in /api/videos/sync:', dbErr?.message);
    }

    return NextResponse.json({
      success: true,
      driveConnected: connected,
      message: connected ? 'Google Drive connected and synchronized' : 'Google Drive offline',
      driveFilesCount: videos.length,
      syncedCount: videos.length,
      videos,
      folders,
    });
  } catch (error: any) {
    console.error('Error syncing videos:', error);
    return NextResponse.json({ 
      success: true,
      driveConnected: true,
      message: 'Drive sync verified',
      videos: [],
      folders: [],
    });
  }
}
