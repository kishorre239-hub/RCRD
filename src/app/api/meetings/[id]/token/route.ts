import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { getCollection } from '@/lib/server/db';
import { getBackupMeeting } from '@/lib/server/localBackup';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = decodeURIComponent(rawId).trim();
    if (!id) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { participantId, name, role, password } = body;

    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
    const serverUrl = (process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL)?.trim();

    // If LiveKit credentials are not configured, signal client to use resilient native WebRTC
    if (!apiKey || !apiSecret || !serverUrl) {
      return NextResponse.json({
        success: true,
        enabled: false,
        message: 'LiveKit SFU credentials not configured in environment. Using standard WebRTC mode.',
      });
    }

    // Verify meeting exists & validate access
    let meeting: { id: string; password?: string; status?: string; hostName?: string } | null = null;
    try {
      const meetingsCol = await getCollection('meetings');
      meeting = await meetingsCol.findOne<{ id: string; password?: string; status?: string; hostName?: string }>({ id });
    } catch {
      // Fallback to local meeting backup
      meeting = getBackupMeeting(id) || null;
    }

    if (meeting?.status === 'ended') {
      return NextResponse.json({ error: 'Meeting has already ended', ended: true }, { status: 403 });
    }

    // Validate password if meeting has password set and user is a student
    const isMentor = role === 'host' || role === 'mentor';
    const storedAllowedEmails = (meeting as { allowedEmails?: string[] })?.allowedEmails;
    const studentEmail = (body.email || body.studentEmail || '').toLowerCase().trim();
    if (!isMentor && storedAllowedEmails && storedAllowedEmails.length > 0 && studentEmail) {
      const isAllowed = storedAllowedEmails.some((e: string) => (e || '').toLowerCase().trim() === studentEmail);
      if (!isAllowed) {
        return NextResponse.json({ error: 'Access Denied: You are not enrolled in the assigned batch for this meeting.', batchRestricted: true }, { status: 403 });
      }
    }

    if (!isMentor && meeting?.password && password && meeting.password !== password) {
      return NextResponse.json({ error: 'Invalid meeting password' }, { status: 401 });
    }

    const safeParticipantId = participantId || (isMentor ? 'host' : `student_${Date.now()}`);
    const safeName = name || (isMentor ? (meeting?.hostName || 'Host') : 'Student');

    // Mint short-lived, least-privilege LiveKit Access Token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: safeParticipantId,
      name: safeName,
      ttl: '4h', // 4-hour class session expiry
    });

    at.addGrant({
      room: id,
      roomJoin: true,
      canPublish: true,     // Allows host (screen & audio) and students (audio when unmuted)
      canSubscribe: true,   // All students subscribe to teacher's single stream via SFU
      canPublishData: true, // DataChannel for low-latency chat, whiteboard, and reactions
      canUpdateOwnMetadata: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      success: true,
      enabled: true,
      serverUrl,
      token,
      isMentor,
      identity: safeParticipantId,
    });
  } catch (error) {
    console.error('Error minting SFU LiveKit token:', error);
    return NextResponse.json({ error: 'Internal Server Error generating meeting token' }, { status: 500 });
  }
}
