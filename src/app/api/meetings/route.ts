import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import {
  getAllBackupMeetings,
  getBackupMeeting,
  saveBackupMeeting,
  deleteBackupMeeting,
  StoredMeeting,
  isDummyMeeting,
} from '@/lib/server/localBackup';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      if (isDummyMeeting({ id })) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
      }

      // Find single meeting
      try {
        const meetingsCol = await getCollection<StoredMeeting>('meetings');
        const dbMeeting = await meetingsCol.findOne({ id });
        if (dbMeeting && !isDummyMeeting(dbMeeting)) {
          saveBackupMeeting(dbMeeting);
          return NextResponse.json({ success: true, meeting: dbMeeting });
        }
      } catch (dbErr) {
        console.warn('MongoDB get meeting note:', (dbErr as Error)?.message);
      }

      const backup = getBackupMeeting(id);
      if (backup && !isDummyMeeting(backup)) {
        return NextResponse.json({ success: true, meeting: backup });
      }
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Proactively purge legacy dummy sample fixture meetings only
    const dummyIds = ['GEO-CLASS-101', 'RCRD-MEET-202', 'REV-QA-303'];
    dummyIds.forEach(dId => deleteBackupMeeting(dId));

    try {
      const meetingsCol = await getCollection<StoredMeeting>('meetings');
      await meetingsCol.deleteMany({
        id: { $in: dummyIds },
      });
    } catch {
      // ignore
    }

    // Return all valid meetings
    let meetings: StoredMeeting[] = [];
    try {
      const meetingsCol = await getCollection<StoredMeeting>('meetings');
      meetings = await meetingsCol.find({}).sort({ scheduledAt: -1 }).toArray();
      // Sync to backup
      meetings.filter(m => !isDummyMeeting(m)).forEach(m => saveBackupMeeting(m));
    } catch (dbErr) {
      console.warn('MongoDB fetch meetings note:', (dbErr as Error)?.message);
      meetings = getAllBackupMeetings();
    }

    if (meetings.length === 0) {
      meetings = getAllBackupMeetings();
    }

    const cleanMeetings = meetings.filter(m => !isDummyMeeting(m));

    return NextResponse.json({ success: true, meetings: cleanMeetings });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, title, courseId, password, scheduledAt, duration, status, hostName } = body;

    if (!id || !title) {
      return NextResponse.json({ error: 'id and title are required' }, { status: 400 });
    }

    if (isDummyMeeting({ id, title })) {
      return NextResponse.json({ error: 'Cannot create dummy meeting' }, { status: 400 });
    }

    const meetingData: StoredMeeting = {
      id,
      title,
      courseId: courseId || null,
      password: (password || '').trim(),
      scheduledAt: scheduledAt || new Date().toISOString(),
      duration: Number(duration) || 60,
      status: (status as 'scheduled' | 'live' | 'ended') || 'scheduled',
      hostName: (hostName || body.hostName || body.createdByName || '').trim() || undefined,
      updatedAt: Date.now(),
    };

    // Save to local backup
    saveBackupMeeting(meetingData);

    // Save to MongoDB
    try {
      const meetingsCol = await getCollection<StoredMeeting>('meetings');
      await meetingsCol.updateOne(
        { id },
        { $set: meetingData },
        { upsert: true }
      );
    } catch (dbErr) {
      console.warn('MongoDB save meeting note:', (dbErr as Error)?.message);
    }

    return NextResponse.json({ success: true, meeting: meetingData });
  } catch (error) {
    console.error('Error saving meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Update in localBackup if exists
    const existing = getBackupMeeting(id);
    if (existing) {
      if (status) existing.status = status;
      existing.updatedAt = Date.now();
      saveBackupMeeting(existing);
    }

    // Update in MongoDB
    try {
      const meetingsCol = await getCollection<StoredMeeting>('meetings');
      await meetingsCol.updateOne(
        { id },
        {
          $set: {
            ...(status ? { status } : {}),
            updatedAt: Date.now(),
          },
        }
      );
    } catch (dbErr) {
      console.warn('MongoDB patch meeting note:', (dbErr as Error)?.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error patching meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    deleteBackupMeeting(id);

    try {
      const meetingsCol = await getCollection<StoredMeeting>('meetings');
      await meetingsCol.deleteOne({ id });
    } catch (dbErr) {
      console.warn('MongoDB delete meeting note:', (dbErr as Error)?.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
