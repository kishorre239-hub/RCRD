import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { getBackupMeeting, saveBackupMeeting, StoredMeeting, isDummyMeeting, isMeetingDurationExpired } from '@/lib/server/localBackup';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { password } = body;

    if (!id || isDummyMeeting({ id })) {
      return NextResponse.json({ error: 'Meeting ID not found.' }, { status: 404 });
    }

    let meeting: StoredMeeting | null = null;

    try {
      const meetingsCol = await getCollection<StoredMeeting>('meetings');
      meeting = await meetingsCol.findOne({ id });
      if (meeting) {
        saveBackupMeeting(meeting);
      }
    } catch (dbErr) {
      console.warn('MongoDB join meeting note:', (dbErr as Error)?.message);
    }

    let resolvedMeeting: StoredMeeting;
    if (meeting) {
      resolvedMeeting = meeting;
    } else {
      const backup = getBackupMeeting(id);
      if (backup) {
        resolvedMeeting = backup;
      } else {
        return NextResponse.json(
          { error: 'This meeting was not found or has been deleted.' },
          { status: 404 }
        );
      }
    }

    // Check if meeting has ended or duration has expired
    if (resolvedMeeting.status === 'ended' || isMeetingDurationExpired(resolvedMeeting)) {
      resolvedMeeting.status = 'ended';
      resolvedMeeting.updatedAt = Date.now();
      saveBackupMeeting(resolvedMeeting);
      try {
        const meetingsCol = await getCollection<StoredMeeting>('meetings');
        await meetingsCol.updateOne({ id }, { $set: { status: 'ended', updatedAt: Date.now() } });
      } catch {}

      return NextResponse.json({
        error: 'This meeting has ended and the link has expired.',
        expired: true,
        status: 'ended',
      }, { status: 410 });
    }

    // Check batch restriction
    const isMentor = Boolean(body.isMentor || body.role === 'mentor' || body.role === 'host');
    const studentEmail = (body.email || body.studentEmail || '').toLowerCase().trim();

    if (resolvedMeeting.allowedEmails && resolvedMeeting.allowedEmails.length > 0 && !isMentor) {
      if (!studentEmail) {
        return NextResponse.json({
          error: `Student email is required for this batch-restricted classroom (${resolvedMeeting.batchName || 'Assigned Batch'}).`,
          batchRestricted: true,
          batchName: resolvedMeeting.batchName || 'Assigned Batch',
        }, { status: 403 });
      }

      const isAllowed = resolvedMeeting.allowedEmails.some((e: string) => (e || '').toLowerCase().trim() === studentEmail);
      if (!isAllowed) {
        return NextResponse.json({
          error: `Access Denied: You are not enrolled in the batch '${resolvedMeeting.batchName || 'Batch'}'. Only enrolled students can join this meeting.`,
          batchRestricted: true,
          batchName: resolvedMeeting.batchName || 'Assigned Batch',
          deniedEmail: studentEmail,
        }, { status: 403 });
      }
    }

    // Check password (case-insensitive)
    const expectedPassword = (resolvedMeeting.password || '').trim().toUpperCase();
    const enteredPassword = (password || '').trim().toUpperCase();

    if (expectedPassword && expectedPassword !== enteredPassword) {
      return NextResponse.json({ error: 'Invalid meeting password.' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      meeting: {
        id: resolvedMeeting.id,
        title: resolvedMeeting.title,
        courseId: resolvedMeeting.courseId,
        scheduledAt: resolvedMeeting.scheduledAt,
        duration: resolvedMeeting.duration,
        status: resolvedMeeting.status,
        batchId: resolvedMeeting.batchId,
        batchName: resolvedMeeting.batchName,
        allowedEmails: resolvedMeeting.allowedEmails,
      },
    });
  } catch (error) {
    console.error('Error joining meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
