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

    const PRIMARY_OWNER_EMAIL = "harikishorereddy9908@gmail.com";
    const userEmail = (user.email || '').toLowerCase().trim();
    const isAdmin = userEmail === PRIMARY_OWNER_EMAIL || (user.role || '').toLowerCase() === 'admin';

    // Verify user plan and admin trial authorization in DB
    let effectivePlanId = user.plan || 'none';
    let isTrialGranted = isAdmin;
    try {
      const usersCol = await getCollection<User>('users');
      let dbUser: User | null = null;
      if (user.id || user._id) {
        const { ObjectId } = await import('mongodb');
        try {
          dbUser = await usersCol.findOne({ _id: typeof user._id === 'string' ? new ObjectId(user._id) : user._id });
        } catch {}
      }
      if (!dbUser && userEmail) {
        dbUser = await usersCol.findOne({ email: userEmail });
      }
      if (dbUser) {
        if (dbUser.plan) effectivePlanId = dbUser.plan;
        if (dbUser.trialGranted === true) isTrialGranted = true;
      }
    } catch {}

    const isPaid = ['pro', 'team', 'business', 'business_ai', 'yearly', 'enterprise'].includes(effectivePlanId);

    // Free trials are strictly restricted: Admin only access for free trial grant
    if (!isAdmin && !isPaid && !isTrialGranted) {
      return NextResponse.json({
        error: 'Free trials require administrator approval. Please subscribe to a SaaS rental plan or contact an administrator for trial access.',
        code: 'RENTAL_REQUIRED',
      }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const title = body.title || `Recording ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const mimeType = body.mimeType || 'video/webm';
    const size = body.size ? Number(body.size) : 0;
    const courseId = body.courseId || null;
    const folderName = body.folderName || null;

    const now = Date.now();

    const isMeeting = Boolean(body.isMeeting || body.source === 'meeting' || courseId === 'MEETING');
    const finalCourseId = courseId || null;

    const effectiveOwnerEmail = (body.ownerEmail || user.email || '').toLowerCase().trim();
    const effectiveOwnerId = body.ownerId || user.id || user._id?.toString() || 'default-admin';
    const effectiveOwnerName = body.ownerName || user.name || '';

    const videoDoc: Video = {
      title,
      courseId: finalCourseId,
      ownerId: effectiveOwnerId,
      ownerEmail: effectiveOwnerEmail,
      ownerName: effectiveOwnerName,
      mentorEmail: effectiveOwnerEmail,
      hostEmail: effectiveOwnerEmail,
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
