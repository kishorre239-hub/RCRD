import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { listDriveVideosAndFolders, cleanVideoTitle } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';
import { getBackupVideoMeta } from '@/lib/server/localBackup';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const user = authResult.authenticated ? authResult.user : null;
    const userId = user?.id || user?._id?.toString() || 'dev-admin-id';
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');

    let dbVideos: Video[] = [];
    try {
      const videosCol = await getCollection<Video>('videos');
      const query: Record<string, unknown> = {};
      if (courseId) {
        query.courseId = courseId;
      } else if (userId && user?.email) {
        query.$or = [{ ownerId: userId }, { ownerEmail: user.email }, { isPublic: true }];
      }
      dbVideos = await videosCol.find(query).sort({ createdAt: -1 }).toArray();
    } catch (dbErr: unknown) {
      console.warn('MongoDB query in /api/videos failed:', (dbErr as Error)?.message);
    }

    // Always fetch live Google Drive videos with high-res thumbnails and metadata
    const { videos: driveVideos } = await listDriveVideosAndFolders();

    // Merge database videos and Google Drive videos, avoiding duplicates by driveFileId / id
    const videoMap = new Map<string, Record<string, any>>();

    // 1. First add Google Drive videos
    for (const dv of driveVideos) {
      const backupMeta = getBackupVideoMeta(dv.id);
      const effectiveCourseId = (backupMeta?.courseId !== undefined) ? backupMeta.courseId : (dv.courseId || '');
      if (courseId && effectiveCourseId !== courseId) continue;
      videoMap.set(dv.id, {
        ...dv,
        courseId: effectiveCourseId,
        title: backupMeta?.title || cleanVideoTitle(dv.title || dv.rawName || '', dv.createdAt),
        thumbnailUrl: `/api/videos/${dv.id}/thumbnail`,
        thumbnailLink: `/api/videos/${dv.id}/thumbnail`,
        directThumbnailUrl: dv.thumbnailUrl,
      });
    }

    // 2. Merge DB videos, enriching with Drive thumbnails and durations
    for (const v of dbVideos) {
      const key = v.driveFileId || v.id || v._id?.toString() || '';
      // Skip orphaned temporary local files that were never uploaded
      if (key.startsWith('local:') && !v.webViewLink) continue;

      const existing = videoMap.get(key) || {};
      const backupMeta = getBackupVideoMeta(key);
      const effectiveCourseId = (backupMeta?.courseId !== undefined) 
        ? backupMeta.courseId 
        : (v.courseId || existing.courseId || '');
      const createdAt = v.createdAt || existing.createdAt || Date.now();
      const rawTitle = backupMeta?.title || v.title || existing.title || (v as any).name || 'Recording';
      const cleanTitle = cleanVideoTitle(rawTitle, createdAt);
      const id = v.id || v.driveFileId || v._id?.toString() || key;

      videoMap.set(key, {
        ...existing,
        ...v,
        id,
        title: cleanTitle,
        courseId: effectiveCourseId,
        views: v.views !== undefined ? v.views : (existing.views || 0),
        comments: Array.isArray(v.comments) ? v.comments : (existing.comments || []),
        thumbnailUrl: `/api/videos/${id}/thumbnail`,
        thumbnailLink: `/api/videos/${id}/thumbnail`,
        directThumbnailUrl: (v as any).thumbnailUrl || v.thumbnailLink || existing.directThumbnailUrl || '',
        duration: (v.duration && v.duration > 0) ? v.duration : (existing.duration || 0),
        status: v.status || existing.status || 'READY',
      });
    }

    const allVideos = Array.from(videoMap.values())
      .filter(v => {
        if (!v.id || v.id.startsWith('local:')) return false;
        if (v.mimeType && v.mimeType.startsWith('image/')) return false;
        if (typeof v.title === 'string' && /\.(png|jpg|jpeg|gif|webp)$/i.test(v.title)) return false;
        return true;
      })
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    return NextResponse.json(allVideos);
  } catch (error: unknown) {
    console.error('Error fetching videos:', (error as Error)?.message);
    return NextResponse.json([]);
  }
}
