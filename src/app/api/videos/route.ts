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
    const { videos: driveVideos, connected: driveConnected } = await listDriveVideosAndFolders();
    const driveIdSet = new Set(driveVideos.map(dv => dv.id));

    // Merge database videos and Google Drive videos, avoiding duplicates by driveFileId / id
    const videoMap = new Map<string, Record<string, any>>();

    // 1. First add live Google Drive videos (Google Drive is the single source of truth)
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

    // 2. Synchronize DB videos:
    // If Drive is connected, any DB video associated with a Google Drive file that is NOT in Google Drive was deleted by the user!
    // We prune it from MongoDB so deleted videos do NOT appear on the website!
    if (dbVideos.length > 0) {
      for (const v of dbVideos) {
        const driveId = v.driveFileId;
        const vidId = v.id || v._id?.toString() || '';

        // If video was meant for Google Drive but does not exist in Google Drive anymore
        if (driveConnected && driveId && !driveIdSet.has(driveId)) {
          // Video was deleted in Google Drive: prune it from MongoDB!
          try {
            const videosCol = await getCollection<Video>('videos');
            videosCol.deleteOne({ _id: v._id }).catch(() => {});
          } catch {}
          continue; // DO NOT add to videoMap!
        }

        // If the video is a local upload or completed recording
        if (!driveId) {
          const createdAt = v.createdAt || Date.now();
          videoMap.set(vidId, {
            ...v,
            id: vidId,
            title: cleanVideoTitle(v.title || 'Screen Recording', createdAt),
            courseId: v.courseId || '',
            views: v.views || 0,
            comments: Array.isArray(v.comments) ? v.comments : [],
            thumbnailUrl: `/api/videos/${vidId}/thumbnail`,
            thumbnailLink: `/api/videos/${vidId}/thumbnail`,
            directThumbnailUrl: '',
            duration: v.duration || 0,
            status: v.status || 'READY',
            editorData: v.editorData || null,
          });
        } else if (driveId && driveIdSet.has(driveId)) {
          // Enrich already added Drive video with DB views, comments, etc.
          const existing = videoMap.get(driveId);
          if (existing) {
            videoMap.set(driveId, {
              ...existing,
              ...v,
              id: driveId,
              title: v.title || existing.title,
              views: Math.max(v.views || 0, existing.views || 0),
              comments: Array.isArray(v.comments) && v.comments.length > 0 ? v.comments : existing.comments,
              editorData: v.editorData || existing.editorData,
            });
          }
        }
      }
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
