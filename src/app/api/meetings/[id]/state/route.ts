import { NextResponse } from 'next/server';

interface MeetingState {
  screenShare: {
    active: boolean;
    presenterName?: string;
    streamFrame?: string; // compressed base64 frame preview
    updatedAt: number;
  };
  whiteboard: {
    active: boolean;
    canvasData?: string;
    updatedAt: number;
  };
  chat: Array<{
    id: string;
    sender: string;
    role: 'Host' | 'Student';
    text: string;
    time: string;
  }>;
  notes: Array<{
    id: string;
    content: string;
    author: string;
    timestamp: string;
    type: 'host' | 'participant' | 'group';
    participantId?: string;
    participantName?: string;
    attachment?: {
      name: string;
      size: number;
      type: string;
      dataUrl: string;
    };
  }>;
  reactions: Array<{
    id: string;
    emoji: string;
    sender: string;
    timestamp: number;
  }>;
}

const roomStates: Record<string, MeetingState> = {};

function getOrCreateRoomState(roomId: string): MeetingState {
  if (!roomStates[roomId]) {
    roomStates[roomId] = {
      screenShare: { active: false, updatedAt: Date.now() },
      whiteboard: { active: false, updatedAt: Date.now() },
      chat: [
        {
          id: 'welcome_1',
          sender: 'Class Assistant',
          role: 'Host',
          text: "Welcome to today's live session! Use this chat to ask questions or discuss.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      notes: [],
      reactions: [],
    };
  }
  return roomStates[roomId];
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Meeting ID required' }, { status: 400 });
    }

    const state = getOrCreateRoomState(id);

    // Prune reactions older than 5 seconds
    const now = Date.now();
    state.reactions = state.reactions.filter(r => now - r.timestamp < 5000);

    return NextResponse.json({
      success: true,
      screenShare: state.screenShare,
      whiteboard: state.whiteboard,
      chat: state.chat,
      notes: state.notes,
      reactions: state.reactions,
      serverTime: now,
    });
  } catch (error) {
    console.error('Error fetching room state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Meeting ID required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const state = getOrCreateRoomState(id);
    const now = Date.now();

    // 1. Screen share update
    if (body.screenShare !== undefined) {
      state.screenShare = {
        active: Boolean(body.screenShare.active),
        presenterName: body.screenShare.presenterName || state.screenShare.presenterName,
        streamFrame: body.screenShare.streamFrame !== undefined ? body.screenShare.streamFrame : state.screenShare.streamFrame,
        updatedAt: now,
      };
      if (!body.screenShare.active) {
        state.screenShare.streamFrame = undefined;
      }
    }

    // 2. Whiteboard update
    if (body.whiteboard !== undefined) {
      state.whiteboard = {
        active: Boolean(body.whiteboard.active),
        canvasData: body.whiteboard.canvasData !== undefined ? body.whiteboard.canvasData : state.whiteboard.canvasData,
        updatedAt: now,
      };
      if (!body.whiteboard.active) {
        state.whiteboard.canvasData = undefined;
      }
    }

    // 3. New chat message
    if (body.chatMessage) {
      const msg = body.chatMessage;
      const exists = state.chat.some(c => c.id === msg.id);
      if (!exists && msg.text) {
        state.chat.push({
          id: msg.id || `c_${now}`,
          sender: msg.sender || 'Participant',
          role: msg.role || 'Student',
          text: msg.text,
          time: msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        if (state.chat.length > 200) {
          state.chat = state.chat.slice(-200);
        }
      }
    }

    // 4. Notes update (add or replace)
    if (body.note) {
      const newNote = body.note;
      const idx = state.notes.findIndex(n => n.id === newNote.id);
      if (idx >= 0) {
        state.notes[idx] = newNote;
      } else {
        state.notes.unshift(newNote);
      }
      if (state.notes.length > 100) {
        state.notes = state.notes.slice(0, 100);
      }
    } else if (Array.isArray(body.notes)) {
      state.notes = body.notes;
    }

    // 5. Reaction trigger
    if (body.reaction) {
      state.reactions.push({
        id: body.reaction.id || `r_${now}_${Math.random()}`,
        emoji: body.reaction.emoji || '👏',
        sender: body.reaction.sender || 'Participant',
        timestamp: now,
      });
    }

    return NextResponse.json({
      success: true,
      screenShare: state.screenShare,
      whiteboard: state.whiteboard,
      chat: state.chat,
      notes: state.notes,
      reactions: state.reactions,
      serverTime: now,
    });
  } catch (error) {
    console.error('Error updating room state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
