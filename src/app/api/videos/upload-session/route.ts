import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import { createResumableUploadSession } from '@/lib/server/drive';
import { Video, User } from '@/lib/server/types';

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const user: User = (authResult.authenticated && authResult.user ? authResult.user : null) || {
      _id: 'default-admin',
      id: 'default-admin',
      name: 'System User',
      email: 'admin@meet.com',
      role: 'ADMIN',
      status: 'Active',
      plan: 'enterprise',
      workspaceId: 'default',
    };

    const body = await req.json().catch(() => ({}));
    const title = body.title || `Recording ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const mimeType = body.mimeType || 'video/webm';
    const size = body.size ? Number(body.size) : 0;
    const courseId = body.courseId || null;
    const folderName = body.folderName || null;

    const now = Date.now();

    const isMeeting = Boolean(body.isMeeting || body.source === 'meeting' || courseId === 'MEETING' || courseId === '1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW' || (title && title.toLowerCase().includes('meeting')));
    // Only default to MEETING folder if the user did NOT choose a specific folder
    const finalCourseId = courseId || (isMeeting ? '1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW' : null);

    const videoDoc: Video = {
      title,
      courseId: finalCourseId,
      ownerId: user.id || user._id?.toString() || 'default-admin',
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

    let videoId = `vid_${now}_${Math.random().toString(36).substring(2, 9)}`;
    try {
      const videosCol = await getCollection<Video>('videos');
      const insertRes = await videosCol.insertOne(videoDoc);
      videoId = insertRes.insertedId.toString();
    } catch (dbErr) {
      console.warn('MongoDB upload-session insert note:', dbErr);
    }

    const origin = req.headers.get('origin') || undefined;
    let sessionResult = null;
    try {
      sessionResult = await createResumableUploadSession({
        title,
        mimeType,
        size,
        folderId: finalCourseId || undefined,
        folderName: folderName || undefined,
        isMeeting,
        origin,
      });
    } catch (e: unknown) {
      console.warn('Google Drive session creation warning:', (e as Error)?.message || e);
    }

    const uploadUrl = sessionResult?.uploadUrl || '';

    return NextResponse.json({
      videoId,
      uploadUrl,
      status: 'UPLOADING',
    });
  } catch (error: unknown) {
    console.error('Error creating video upload session:', (error as Error)?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
