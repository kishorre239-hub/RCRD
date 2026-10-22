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
        // Resilient fallback: allow joining room session dynamically
        resolvedMeeting = {
          id,
          title: 'Live Classroom',
          courseId: null,
          password: '',
          scheduledAt: new Date().toISOString(),
          duration: 60,
          status: 'live',
          updatedAt: Date.now(),
        };
        saveBackupMeeting(resolvedMeeting);
        try {
          const meetingsCol = await getCollection<StoredMeeting>('meetings');
          await meetingsCol.updateOne({ id }, { $set: resolvedMeeting }, { upsert: true });
        } catch {}
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
      },
    });
  } catch (error) {
    console.error('Error joining meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
