import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { createResumableUploadSession } from '@/lib/server/drive';
import { Video } from '@/lib/server/types';

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const body = await req.json().catch(() => ({}));
    const title = body.title || `Recording ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const mimeType = body.mimeType || 'video/webm';
    const size = body.size ? Number(body.size) : 0;
    const courseId = body.courseId || null;
    const folderName = body.folderName || null;

    // Check storage limits against user's plan (100 MB for Free Trial, etc.)
    const { getPlan, formatBytes } = await import('@/lib/plans');
    const userPlan = getPlan(user.plan || 'free');

    const videosCol = await getCollection<Video>('videos');
    const existingVideos = await videosCol.find({
      $or: [
        { workspaceId: user.workspaceId || 'default' },
        { ownerId: user.id || user._id?.toString() }
      ]
    }).project({ size: 1 }).toArray();

    const usedBytes = existingVideos.reduce((acc: number, v: { size?: number }) => acc + (v.size || 0), 0);
    if (userPlan.storageLimitBytes > 0 && usedBytes + size > userPlan.storageLimitBytes) {
      return NextResponse.json({
        error: `Storage limit exceeded for ${userPlan.name}. You have used ${formatBytes(usedBytes)} of your ${userPlan.storageLimitMb} MB quota. Please upgrade your plan to continue recording.`,
        code: 'STORAGE_LIMIT_EXCEEDED',
        usedBytes,
        limitBytes: userPlan.storageLimitBytes,
        plan: userPlan.name,
      }, { status: 403 });
    }

    const now = Date.now();

    const isMeeting = Boolean(body.isMeeting || body.source === 'meeting' || courseId === 'MEETING' || courseId === '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4' || (title && title.toLowerCase().includes('meeting')));
    // Only default to MEETING folder if the user did NOT choose a specific folder
    const finalCourseId = courseId || (isMeeting ? '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4' : null);

    const videoDoc: Video = {
      title,
      courseId: finalCourseId,
      ownerId: user.id || user._id?.toString(),
      workspaceId: user.workspaceId || 'default',
      mimeType,
      size,
      status: 'UPLOADING',
      isPublic: false,
      isCompanyShared: false,
      comments: [],
      createdAt: now,
      updatedAt: now,
    };

    const insertRes = await videosCol.insertOne(videoDoc);
    const videoId = insertRes.insertedId.toString();

    let sessionResult = null;
    try {
      sessionResult = await createResumableUploadSession({
        title,
        mimeType,
        size,
        folderId: finalCourseId || undefined,
        folderName: folderName || undefined,
        isMeeting,
      });
    } catch (e: any) {
      console.warn('Google Drive session creation warning:', e.message);
    }

    const uploadUrl = sessionResult?.uploadUrl || `/api/videos/${videoId}/direct-chunk`;

    return NextResponse.json({
      videoId,
      uploadUrl,
      status: 'UPLOADING',
    });
  } catch (error: any) {
    console.error('Error creating video upload session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
