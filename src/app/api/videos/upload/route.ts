import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { Video } from '@/lib/server/types';
import { uploadBufferToDrive } from '@/lib/server/drive';
import { saveBackupVideoMeta } from '@/lib/server/localBackup';

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
    const folderName = (formData.get('folderName') as string) || undefined;
    const fileSize = file ? file.size : 0;

    // Check storage limits against user's plan (100 MB for Free Trial, etc.)
    const { getPlan, formatBytes } = await import('@/lib/plans');
    const userPlan = getPlan(user.plan || 'free');

    try {
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
    } catch {}

    const isMeeting = Boolean(formData.get('isMeeting') === 'true' || courseId === 'MEETING' || courseId === '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4' || (title && title.toLowerCase().includes('meeting')));
    const finalCourseId = courseId || (isMeeting ? '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4' : null);

    const now = Date.now();
    let driveFileId = '';
    let webViewLink = '';
    let thumbnailLink = '';

    // Direct Google Drive Upload (Google Drive is the primary persistent storage)
    if (file) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const driveUpload = await uploadBufferToDrive({
          buffer,
          name: `${title}.webm`,
          mimeType: file.type || 'video/webm',
          folderId: finalCourseId || undefined,
          folderName,
          isMeeting,
        });
        if (driveUpload?.id) {
          driveFileId = driveUpload.id;
          webViewLink = driveUpload.webViewLink || '';
          thumbnailLink = driveUpload.thumbnailLink || '';
        }
      } catch (driveErr) {
        console.error('Google Drive direct buffer upload warning:', driveErr);
      }
    }

    const videoDoc: Video = {
      title,
      driveFileId: driveFileId || undefined,
      courseId: finalCourseId || undefined,
      ownerId: user.id || user._id?.toString(),
      workspaceId: user.workspaceId || 'default',
      size: file ? file.size : 0,
      mimeType: file ? file.type : 'video/webm',
      status: 'READY',
      isPublic: false,
      isCompanyShared: false,
      comments: [],
      webViewLink: webViewLink || undefined,
      thumbnailLink: thumbnailLink || undefined,
      createdAt: now,
      updatedAt: now,
    };

    let videoId = driveFileId || `vid-${Date.now()}`;
    try {
      const videosCol = await getCollection<Video>('videos');
      const res = await videosCol.insertOne(videoDoc);
      videoId = res.insertedId.toString();
    } catch (dbErr) {
      console.warn('MongoDB insert note in /api/videos/upload:', dbErr);
    }

    // Persist to local backup
    saveBackupVideoMeta(driveFileId || videoId, {
      title,
      courseId: finalCourseId || undefined,
      driveFileId: driveFileId || undefined,
      size: file ? file.size : 0,
      status: 'READY',
    });

    return NextResponse.json({
      videoId: driveFileId || videoId,
      id: driveFileId || videoId,
      driveFileId,
      status: 'READY',
      title,
    });
  } catch (error: any) {
    console.error('Error in video upload route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
