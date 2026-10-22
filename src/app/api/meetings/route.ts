import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/server/db';
import { authenticateRequest } from '@/lib/server/auth';
import {
  getAllBackupMeetings,
  getBackupMeeting,
  saveBackupMeeting,
  deleteBackupMeeting,
  StoredMeeting,
  isDummyMeeting,
  isMeetingDurationExpired,
} from '@/lib/server/localBackup';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const authUser = authResult.authenticated && authResult.user ? authResult.user : null;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const now = Date.now();

    const queryEmail = (searchParams.get('email') || searchParams.get('userEmail') || '').toLowerCase().trim();
    const queryUserId = searchParams.get('userId') || '';
    const queryRole = (searchParams.get('role') || '').toUpperCase().replace(/^ROLE_/, '');

    const effectiveEmail = (authUser?.email || queryEmail || '').toLowerCase().trim();
    const effectiveUserId = authUser?.id || authUser?._id?.toString() || queryUserId || '';
    const effectiveRole = (authUser?.role || queryRole || '').toUpperCase().replace(/^ROLE_/, '');
    const isAdmin = effectiveRole === 'ADMIN' || effectiveEmail === 'harikishorereddy9908@gmail.com' || effectiveEmail.includes('admin@');

    if (id) {
      if (isDummyMeeting({ id })) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
      }

      // Find single meeting
      try {
        const meetingsCol = await getCollection<StoredMeeting>('meetings');
        const dbMeeting = await meetingsCol.findOne({ id });
        if (dbMeeting && !isDummyMeeting(dbMeeting)) {
          if (dbMeeting.status !== 'ended' && isMeetingDurationExpired(dbMeeting, now)) {
            dbMeeting.status = 'ended';
            dbMeeting.updatedAt = now;
            await meetingsCol.updateOne({ id }, { $set: { status: 'ended', updatedAt: now } }).catch(() => {});
          }
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

    // Build filter based on role & mentor isolation
    const filter: Record<string, unknown> = {};
    if (!isAdmin && effectiveEmail) {
      // Mentor portal: Strictly isolate data to this mentor's meetings only
      filter.$or = [
        { hostEmail: effectiveEmail },
        { mentorEmail: effectiveEmail },
        { createdBy: effectiveEmail },
        ...(effectiveUserId ? [{ hostId: effectiveUserId }, { ownerId: effectiveUserId }] : []),
      ];
    }

    // Return all valid meetings
    let meetings: StoredMeeting[] = [];
    try {
      const meetingsCol = await getCollection<StoredMeeting>('meetings');
      meetings = await meetingsCol.find(filter).sort({ scheduledAt: -1 }).toArray();

      // Check for expired meetings whose duration is completed and auto-end them in DB
      const expiredMeetingIds: string[] = [];
      for (const m of meetings) {
        if (m.status !== 'ended' && isMeetingDurationExpired(m, now)) {
          m.status = 'ended';
          m.updatedAt = now;
          expiredMeetingIds.push(m.id);
        }
      }
      if (expiredMeetingIds.length > 0) {
        await meetingsCol.updateMany(
          { id: { $in: expiredMeetingIds } },
          { $set: { status: 'ended', updatedAt: now } }
        ).catch(() => {});
      }

      // Sync to backup
      meetings.filter(m => !isDummyMeeting(m)).forEach(m => saveBackupMeeting(m));
    } catch (dbErr) {
      console.warn('MongoDB fetch meetings note:', (dbErr as Error)?.message);
      meetings = getAllBackupMeetings();
    }

    if (meetings.length === 0) {
      meetings = getAllBackupMeetings();
    }

    let cleanMeetings = meetings.filter(m => !isDummyMeeting(m));
    if (!isAdmin && effectiveEmail) {
      cleanMeetings = cleanMeetings.filter(m => {
        const mEmail = (m.hostEmail || m.mentorEmail || m.createdBy || '').toLowerCase().trim();
        const mId = m.hostId || m.ownerId || '';
        return (mEmail && mEmail === effectiveEmail) || (mId && effectiveUserId && mId === effectiveUserId);
      });
    }

    return NextResponse.json({ success: true, meetings: cleanMeetings });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    const authUser = authResult.authenticated && authResult.user ? authResult.user : null;

    const body = await req.json();
    const { id, title, courseId, password, scheduledAt, duration, status, hostName, startedAt } = body;

    if (!id || !title) {
      return NextResponse.json({ error: 'id and title are required' }, { status: 400 });
    }

    if (isDummyMeeting({ id, title })) {
      return NextResponse.json({ error: 'Cannot create dummy meeting' }, { status: 400 });
    }

    const hostEmail = (body.hostEmail || body.mentorEmail || authUser?.email || '').toLowerCase().trim() || undefined;
    const hostId = body.hostId || body.ownerId || authUser?.id || authUser?._id?.toString() || undefined;

    const durationNum = Number(duration) || 60;
    const initialStatus = (status as 'scheduled' | 'live' | 'ended') || 'scheduled';
    const meetingData: StoredMeeting = {
      id,
      title,
      courseId: courseId || null,
      password: (password || '').trim(),
      scheduledAt: scheduledAt || new Date().toISOString(),
      startedAt: startedAt || (initialStatus === 'live' ? new Date().toISOString() : undefined),
      duration: durationNum,
      status: initialStatus,
      hostName: (hostName || body.hostName || body.createdByName || authUser?.name || '').trim() || undefined,
      hostEmail,
      hostId,
      mentorEmail: hostEmail,
      ownerId: hostId,
      createdBy: hostEmail,
      notes: body.notes || [],
      updatedAt: Date.now(),
    };

    // Auto-check if meeting already exceeded duration
    if (meetingData.status !== 'ended' && isMeetingDurationExpired(meetingData)) {
      meetingData.status = 'ended';
    }

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
    const { id, status, notes, duration, startedAt } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Update in localBackup if exists
    const existing = getBackupMeeting(id);
    if (existing) {
      if (status) existing.status = status;
      if (notes !== undefined) existing.notes = notes;
      if (duration !== undefined) existing.duration = Number(duration);
      if (startedAt !== undefined) existing.startedAt = startedAt;
      existing.updatedAt = Date.now();
      saveBackupMeeting(existing);
    }

    // Update in MongoDB
    try {
      const updateFields: Record<string, unknown> = { updatedAt: Date.now() };
      if (status) updateFields.status = status;
      if (notes !== undefined) updateFields.notes = notes;
      if (duration !== undefined) updateFields.duration = Number(duration);
      if (startedAt !== undefined) updateFields.startedAt = startedAt;

      const meetingsCol = await getCollection<StoredMeeting>('meetings');
      await meetingsCol.updateOne(
        { id },
        { $set: updateFields }
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
