import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { getBackupMeeting, saveBackupMeeting, StoredMeeting } from '@/lib/server/localBackup';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { password } = body;

    if (!id) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
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

    if (!meeting) {
      meeting = getBackupMeeting(id);
    }

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting ID not found.' }, { status: 404 });
    }

    // Check password (case-insensitive)
    const expectedPassword = (meeting.password || '').trim().toUpperCase();
    const enteredPassword = (password || '').trim().toUpperCase();

    if (expectedPassword && expectedPassword !== enteredPassword) {
      return NextResponse.json({ error: 'Invalid meeting password.' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        courseId: meeting.courseId,
        scheduledAt: meeting.scheduledAt,
        duration: meeting.duration,
        status: meeting.status,
      },
    });
  } catch (error) {
    console.error('Error joining meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
