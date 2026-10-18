import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface ParticipantCamera {
  active: boolean;
  name: string;
  role?: 'Host' | 'Student';
  streamFrame?: string;
  updatedAt: number;
}

export interface HandRaiseEvent {
  participantId: string;
  name: string;
  isHandRaised: boolean;
  timestamp: number;
}

export interface WebRTCSignal {
  id: string;
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'candidate';
  payload: unknown;
  timestamp: number;
}

interface MeetingState {
  status?: 'scheduled' | 'live' | 'ended';
  hostCamera: {
    active: boolean;
    streamFrame?: string;
    updatedAt: number;
  };
  participantCameras: Record<string, ParticipantCamera>;
  handRaises: Array<HandRaiseEvent>;
  screenShare: {
    active: boolean;
    presenterName?: string;
    streamFrame?: string;
    updatedAt: number;
  };
  whiteboard: {
    active: boolean;
    canvasData?: string;
    currentSlide?: number;
    totalSlides?: number;
    slides?: Array<{ id: number; canvasData: string; notesText?: string }>;
    notepadText?: string;
    mode?: 'sketch' | 'notepad';
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
  signals: Array<WebRTCSignal>;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATES_FILE = path.join(DATA_DIR, 'meeting-room-states.json');

const globalStore = globalThis as unknown as { __roomStates?: Record<string, MeetingState> };
if (!globalStore.__roomStates) {
  globalStore.__roomStates = {};
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(STATES_FILE)) {
      const data = fs.readFileSync(STATES_FILE, 'utf-8');
      globalStore.__roomStates = JSON.parse(data);
    }
  } catch (err) {
    console.warn('Failed loading room states:', err);
  }
}

function persistRoomStates() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATES_FILE, JSON.stringify(globalStore.__roomStates, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed persisting room states:', err);
  }
}

function getOrCreateRoomState(rawId: string): MeetingState {
  const roomId = decodeURIComponent(rawId).trim();
  const rooms = globalStore.__roomStates!;
  if (!rooms[roomId]) {
    rooms[roomId] = {
      status: 'live',
      hostCamera: { active: false, updatedAt: Date.now() },
      participantCameras: {},
      handRaises: [],
      screenShare: { active: false, updatedAt: Date.now() },
      whiteboard: {
        active: false,
        currentSlide: 1,
        totalSlides: 1,
        slides: [{ id: 1, canvasData: '', notesText: '' }],
        notepadText: '',
        mode: 'sketch',
        updatedAt: Date.now(),
      },
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
      signals: [],
    };
    persistRoomStates();
  }
  if (!rooms[roomId].signals) rooms[roomId].signals = [];
  if (!rooms[roomId].reactions) rooms[roomId].reactions = [];
  return rooms[roomId];
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
    const now = Date.now();

    // Prune stale participant cameras older than 15 seconds
    if (state.participantCameras) {
      for (const [pid, pc] of Object.entries(state.participantCameras)) {
        if (now - pc.updatedAt > 15000) {
          delete state.participantCameras[pid];
        }
      }
    }

    // Prune reactions older than 8 seconds
    state.reactions = (state.reactions || []).filter(r => now - r.timestamp < 8000);

    // Prune signals older than 25 seconds
    state.signals = (state.signals || []).filter(s => now - s.timestamp < 25000);

    // Read requesting participantId to filter relevant WebRTC signals
    const url = new URL(req.url);
    const requestingPid = url.searchParams.get('participantId');
    const signalsForMe = (state.signals || []).filter(s =>
      !requestingPid || s.to === requestingPid || s.to === 'all' || (requestingPid === 'host' && s.to === 'host')
    );

    return NextResponse.json({
      success: true,
      status: state.status,
      hostCamera: state.hostCamera,
      participantCameras: state.participantCameras || {},
      handRaises: state.handRaises || [],
      screenShare: state.screenShare,
      whiteboard: state.whiteboard,
      chat: state.chat,
      notes: state.notes,
      reactions: state.reactions,
      signals: signalsForMe,
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

    // Meeting lifecycle status update (e.g. 'live' | 'ended')
    if (body.status !== undefined) {
      state.status = body.status;
    }

    // 0. Host Camera frame update
    if (body.hostCamera !== undefined) {
      const active = Boolean(body.hostCamera.active);
      state.hostCamera = {
        active,
        streamFrame: active ? (body.hostCamera.streamFrame !== undefined ? body.hostCamera.streamFrame : state.hostCamera.streamFrame) : undefined,
        updatedAt: now,
      };
      if (!active) {
        state.hostCamera.streamFrame = undefined;
      }
    }

    // 0b. Any participant / student camera frame update
    if (body.participantCamera && body.participantCamera.participantId) {
      const pc = body.participantCamera;
      const active = Boolean(pc.active);
      if (!state.participantCameras) state.participantCameras = {};
      state.participantCameras[pc.participantId] = {
        active,
        name: pc.name || 'Participant',
        role: pc.role || 'Student',
        streamFrame: active ? pc.streamFrame : undefined,
        updatedAt: now,
      };
      if (pc.role === 'Host' || pc.participantId === 'host') {
        state.hostCamera = {
          active,
          streamFrame: active ? pc.streamFrame : undefined,
          updatedAt: now,
        };
      }
    }

    // 0d. WebRTC signaling for 2-way real-time voice audio
    if (body.signal && body.signal.from && body.signal.to) {
      if (!state.signals) state.signals = [];
      state.signals.push({
        id: body.signal.id || `sig_${now}_${Math.random().toString(36).substring(2, 7)}`,
        from: body.signal.from,
        to: body.signal.to,
        type: body.signal.type,
        payload: body.signal.payload,
        timestamp: now,
      });
      if (state.signals.length > 60) {
        state.signals = state.signals.slice(-60);
      }
    }

    // 0c. Hand raise toggle
    if (body.handRaise && body.handRaise.participantId) {
      const hr = body.handRaise;
      if (!state.handRaises) state.handRaises = [];
      const idx = state.handRaises.findIndex(h => h.participantId === hr.participantId);
      if (idx >= 0) {
        state.handRaises[idx] = {
          participantId: hr.participantId,
          name: hr.name,
          isHandRaised: Boolean(hr.isHandRaised),
          timestamp: now,
        };
      } else {
        state.handRaises.push({
          participantId: hr.participantId,
          name: hr.name,
          isHandRaised: Boolean(hr.isHandRaised),
          timestamp: now,
        });
      }
    }

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

    // 2. Whiteboard update (supporting slides & notepad text)
    if (body.whiteboard !== undefined) {
      state.whiteboard = {
        active: Boolean(body.whiteboard.active),
        canvasData: body.whiteboard.canvasData !== undefined ? body.whiteboard.canvasData : state.whiteboard.canvasData,
        currentSlide: body.whiteboard.currentSlide !== undefined ? body.whiteboard.currentSlide : state.whiteboard.currentSlide,
        totalSlides: body.whiteboard.totalSlides !== undefined ? body.whiteboard.totalSlides : state.whiteboard.totalSlides,
        slides: body.whiteboard.slides !== undefined ? body.whiteboard.slides : state.whiteboard.slides,
        notepadText: body.whiteboard.notepadText !== undefined ? body.whiteboard.notepadText : state.whiteboard.notepadText,
        mode: body.whiteboard.mode !== undefined ? body.whiteboard.mode : state.whiteboard.mode,
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

    // Persist all state updates to disk
    persistRoomStates();

    return NextResponse.json({
      success: true,
      status: state.status,
      hostCamera: state.hostCamera,
      participantCameras: state.participantCameras || {},
      handRaises: state.handRaises || [],
      screenShare: state.screenShare,
      whiteboard: state.whiteboard,
      chat: state.chat,
      notes: state.notes,
      reactions: state.reactions,
      signals: (state.signals || []).filter(s =>
        !body.participantId || s.to === body.participantId || s.to === 'all' || (body.participantId === 'host' && s.to === 'host')
      ),
      serverTime: now,
    });
  } catch (error) {
    console.error('Error updating room state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
