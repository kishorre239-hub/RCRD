import { NextResponse } from 'next/server';
import {
  getMeetingParticipants,
  updateMeetingParticipant,
  removeMeetingParticipant,
} from '@/lib/server/localBackup';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Meeting ID required' }, { status: 400 });
    }

    const participants = getMeetingParticipants(id);
    return NextResponse.json({ success: true, participants });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { participantId, name, role, avatar, isMuted, isVideoOn, isHandRaised, canScreenShare, canChat } = body;

    if (!id || !participantId || !name) {
      return NextResponse.json({ error: 'id, participantId and name are required' }, { status: 400 });
    }

    const updatedList = updateMeetingParticipant(id, {
      id: participantId,
      name,
      role: role || (participantId === 'host' ? 'Host' : 'Student'),
      avatar: avatar || name.charAt(0).toUpperCase(),
      isMuted: isMuted ?? true,
      isVideoOn: isVideoOn ?? false,
      isHandRaised: isHandRaised ?? false,
      canScreenShare: canScreenShare ?? true,
      canChat: canChat ?? true,
    });

    return NextResponse.json({ success: true, participants: updatedList });
  } catch (error) {
    console.error('Error updating participant:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get('participantId');

    if (!id || !participantId) {
      return NextResponse.json({ error: 'id and participantId required' }, { status: 400 });
    }

    const updatedList = removeMeetingParticipant(id, participantId);
    return NextResponse.json({ success: true, participants: updatedList });
  } catch (error) {
    console.error('Error removing participant:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
