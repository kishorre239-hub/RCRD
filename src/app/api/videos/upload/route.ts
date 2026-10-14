import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Video } from '@/lib/server/types';

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;
    const formData = await req.formData();
    const file = formData.get('file') as Blob | null;
    const title = (formData.get('title') as string) || `Recording ${new Date().toLocaleDateString('en-US')}`;
    const courseId = (formData.get('courseId') as string) || null;
    const fileSize = file ? file.size : 0;

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
    if (userPlan.storageLimitBytes > 0 && usedBytes + fileSize > userPlan.storageLimitBytes) {
      return NextResponse.json({
        error: `Storage limit exceeded for ${userPlan.name}. You have used ${formatBytes(usedBytes)} of your ${userPlan.storageLimitMb} MB quota. Please upgrade your plan to continue recording.`,
        code: 'STORAGE_LIMIT_EXCEEDED',
        usedBytes,
        limitBytes: userPlan.storageLimitBytes,
        plan: userPlan.name,
      }, { status: 403 });
    }

    const isMeeting = Boolean(formData.get('isMeeting') === 'true' || courseId === 'MEETING' || courseId === '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4' || (title && title.toLowerCase().includes('meeting')));
    const finalCourseId = courseId || (isMeeting ? '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4' : null);

    const now = Date.now();

    const videoDoc: Video = {
      title,
      courseId: finalCourseId || undefined,
      ownerId: user.id || user._id?.toString(),
      workspaceId: user.workspaceId || 'default',
      size: file ? file.size : 0,
      mimeType: file ? file.type : 'video/webm',
      status: 'READY',
      isPublic: false,
      isCompanyShared: false,
      comments: [],
      createdAt: now,
      updatedAt: now,
    };

    const res = await videosCol.insertOne(videoDoc);
    const videoId = res.insertedId.toString();

    return NextResponse.json({
      videoId,
      id: videoId,
      status: 'READY',
      title,
    });
  } catch (error: any) {
    console.error('Error in video upload route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
