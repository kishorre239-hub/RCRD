import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { listDriveVideosAndFolders, cleanVideoTitle } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';
import { getBackupVideoMeta } from '@/lib/server/localBackup';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const user = authResult.authenticated && authResult.user ? authResult.user : null;

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    const queryEmail = (searchParams.get('email') || searchParams.get('userEmail') || '').toLowerCase().trim();
    const queryUserId = searchParams.get('userId') || '';
    const queryRole = (searchParams.get('role') || '').toUpperCase().replace(/^ROLE_/, '');

    const effectiveEmail = (user?.email || queryEmail || '').toLowerCase().trim();
    const effectiveUserId = user?.id || user?._id?.toString() || queryUserId || '';
    const effectiveRole = (user?.role || queryRole || '').toUpperCase().replace(/^ROLE_/, '');
    const isAdmin = effectiveRole === 'ADMIN' || effectiveEmail === 'harikishorereddy9908@gmail.com' || effectiveEmail.includes('admin@');

    const isMeetingFilter = courseId === 'MEETING' || courseId === '1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW' || courseId === '16MjAhpJTW8PCHm1_L-yHQzyQqHpy4SHg' || courseId === '1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S';

    let dbVideos: Video[] = [];
    try {
      const videosCol = await getCollection<Video>('videos');
      const query: Record<string, unknown> = {};
      if (courseId) {
        if (isMeetingFilter) {
          query.courseId = { $in: ['MEETING', '1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW', '16MjAhpJTW8PCHm1_L-yHQzyQqHpy4SHg', '1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S'] };
        } else {
          query.courseId = courseId;
        }
      }

      if (!isAdmin && effectiveEmail) {
        const userFilters: Record<string, unknown>[] = [
          { ownerEmail: effectiveEmail },
          { mentorEmail: effectiveEmail },
          { hostEmail: effectiveEmail },
          { isCompanyShared: true },
          { isPublic: true },
        ];
        if (effectiveUserId) {
          userFilters.push({ ownerId: effectiveUserId });
        }
        query.$or = userFilters;
      }
      dbVideos = await videosCol.find(query).sort({ createdAt: -1 }).toArray();
    } catch (dbErr: unknown) {
      console.warn('MongoDB query in /api/videos failed:', (dbErr as Error)?.message);
    }

    // Always fetch live Google Drive videos with high-res thumbnails and metadata
    const { videos: driveVideos, connected: driveConnected } = await listDriveVideosAndFolders();
    const driveIdSet = new Set(driveVideos.map(dv => dv.id));

    // Fast lookup maps for database videos
    const dbVideoByDriveId = new Map<string, Video>();
    const dbVideoById = new Map<string, Video>();
    for (const v of dbVideos) {
      if (v.driveFileId) dbVideoByDriveId.set(v.driveFileId, v);
      const vId = v.id || v._id?.toString();
      if (vId) dbVideoById.set(vId, v);
    }

interface VideoMapItem {
  id: string;
  driveFileId?: string;
  title: string;
  rawName?: string | null;
  ownerName?: string;
  ownerEmail?: string;
  mimeType?: string;
  size?: number;
  duration?: number;
  thumbnailUrl?: string;
  thumbnailLink?: string;
  directThumbnailUrl?: string;
  status?: string;
  isPublic?: boolean;
  views?: number;
  comments?: unknown[];
  courseId?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
  webViewLink?: string | null;
  webContentLink?: string | null;
  editorData?: unknown;
  [key: string]: unknown;
}

    // Merge database videos and Google Drive videos, avoiding duplicates by driveFileId / id
    const videoMap = new Map<string, VideoMapItem>();

    // Helper to test if a video matches the requested courseId
    const matchesCourse = (videoCourseId?: string) => {
      if (!courseId) return true;
      if (isMeetingFilter) {
        return videoCourseId === 'MEETING' || videoCourseId === '1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW' || videoCourseId === '16MjAhpJTW8PCHm1_L-yHQzyQqHpy4SHg' || videoCourseId === '1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S';
      }
      return videoCourseId === courseId;
    };

    // 1. First add live Google Drive videos with mentor isolation
    for (const dv of driveVideos) {
      const backupMeta = getBackupVideoMeta(dv.id);
      const effectiveCourseId = (backupMeta?.courseId !== undefined) ? backupMeta.courseId : (dv.courseId || '');
      if (!matchesCourse(effectiveCourseId)) continue;

      const matchedDb = dbVideoByDriveId.get(dv.id) || dbVideoById.get(dv.id);
      const vOwnerId = matchedDb?.ownerId || backupMeta?.ownerId;
      const vOwnerEmail = (matchedDb?.ownerEmail || matchedDb?.mentorEmail || matchedDb?.hostEmail || backupMeta?.ownerEmail || backupMeta?.mentorEmail || '').toLowerCase().trim();
      const isPublic = Boolean(matchedDb?.isPublic || backupMeta?.isPublic);
      const isCompanyShared = Boolean(matchedDb?.isCompanyShared || backupMeta?.isCompanyShared);

      if (!isAdmin && effectiveEmail) {
        const isOwner = (vOwnerEmail && vOwnerEmail === effectiveEmail) ||
                        (effectiveUserId && vOwnerId && vOwnerId === effectiveUserId);
        // Strictly isolate: do not include another mentor's video
        if (!isOwner && !isCompanyShared && !isPublic) {
          continue;
        }
      }

      videoMap.set(dv.id, {
        ...dv,
        courseId: effectiveCourseId,
        ownerId: vOwnerId,
        ownerEmail: vOwnerEmail,
        ownerName: matchedDb?.ownerName || backupMeta?.ownerName,
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
          if (!matchesCourse(v.courseId)) continue;
          if (!isAdmin && effectiveEmail) {
            const vEmail = (v.ownerEmail || v.mentorEmail || v.hostEmail || '').toLowerCase().trim();
            const isOwner = (vEmail && vEmail === effectiveEmail) || (effectiveUserId && v.ownerId === effectiveUserId);
            if (!isOwner && !v.isCompanyShared && !v.isPublic) {
              continue;
            }
          }
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
              views: Math.max(Number(v.views || 0), Number(existing.views || 0)),
              comments: Array.isArray(v.comments) && v.comments.length > 0 ? v.comments : existing.comments,
              editorData: v.editorData || existing.editorData,
            });
          }
        }
      }
    }

    const allVideos = Array.from(videoMap.values())
      .filter((v: VideoMapItem) => {
        if (!v.id || (typeof v.id === 'string' && v.id.startsWith('local:'))) return false;
        if (typeof v.mimeType === 'string' && v.mimeType.startsWith('image/')) return false;
        if (typeof v.title === 'string' && /\.(png|jpg|jpeg|gif|webp)$/i.test(v.title)) return false;
        if (!matchesCourse(v.courseId)) return false;
        return true;
      })
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    return NextResponse.json(allVideos);
  } catch (error: unknown) {
    console.error('Error fetching videos:', (error as Error)?.message);
    return NextResponse.json([]);
  }
}
