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
  type: string;
  payload: unknown;
  timestamp: number;
}

interface MeetingState {
  status?: 'scheduled' | 'live' | 'ended';
  duration?: number;
  startedAt?: string;
  meetingExtended?: {
    newDuration: number;
    extendedBy: number;
    timestamp: number;
  };
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
  participantMuteAction?: {
    targetParticipantId?: string;
    targetName?: string;
    isMuted: boolean;
    timestamp: number;
  };
  muteAll?: {
    timestamp: number;
  };
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATES_FILE = path.join(DATA_DIR, 'meeting-room-states.json');

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
};

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

let persistTimer: NodeJS.Timeout | null = null;
let isPersisting = false;

function sanitizeStateForDisk(rawStates: Record<string, MeetingState>) {
  const sanitized: Record<string, unknown> = {};
  for (const [roomId, room] of Object.entries(rawStates)) {
    if (!room) continue;
    sanitized[roomId] = {
      ...room,
      // Strip ephemeral base64 stream frames so disk writes are micro-sized (<10KB) and instant
      hostCamera: {
        active: Boolean(room.hostCamera?.active),
        updatedAt: room.hostCamera?.updatedAt || Date.now(),
      },
      screenShare: {
        active: Boolean(room.screenShare?.active),
        presenterName: room.screenShare?.presenterName,
        updatedAt: room.screenShare?.updatedAt || Date.now(),
      },
      participantCameras: Object.fromEntries(
        Object.entries(room.participantCameras || {}).map(([pid, pc]) => [
          pid,
          {
            active: Boolean(pc.active),
            name: pc.name,
            role: pc.role,
            updatedAt: pc.updatedAt,
          },
        ])
      ),
      signals: (room.signals || []).slice(-20),
    };
  }
  return sanitized;
}

function schedulePersistRoomStates() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    if (isPersisting) return;
    isPersisting = true;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
      }
      const dataToSave = sanitizeStateForDisk(globalStore.__roomStates || {});
      await fs.promises.writeFile(STATES_FILE, JSON.stringify(dataToSave), 'utf-8');
    } catch (err) {
      console.warn('Failed non-blocking persistence:', err);
    } finally {
      isPersisting = false;
    }
  }, 4000);
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
    schedulePersistRoomStates();
  }
  if (!rooms[roomId].signals) rooms[roomId].signals = [];
  if (!rooms[roomId].reactions) rooms[roomId].reactions = [];
  return rooms[roomId];
}

export function deleteRoomState(rawId: string) {
  const roomId = decodeURIComponent(rawId).trim();
  const rooms = globalStore.__roomStates;
  if (rooms && rooms[roomId]) {
    delete rooms[roomId];
    schedulePersistRoomStates();
  }
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

    // Prune signals older than 60 seconds (ensures reliability under high candidate volume)
    state.signals = (state.signals || []).filter(s => now - s.timestamp < 60000);

    // Read query params for delta synchronization & signal routing
    const url = new URL(req.url);
    const requestingPid = url.searchParams.get('participantId');
    const sinceScreenStr = url.searchParams.get('sinceScreen');
    const sinceWbStr = url.searchParams.get('sinceWb');

    const sinceScreen = sinceScreenStr ? Number(sinceScreenStr) : 0;
    const sinceWb = sinceWbStr ? Number(sinceWbStr) : 0;

    const signalsForMe = (state.signals || []).filter(s =>
      !requestingPid || s.to === requestingPid || s.to === 'all' || (requestingPid === 'host' && s.to === 'host')
    );

    const skipScreenFrame = url.searchParams.get('skipScreenFrame') === '1';

    // Delta payload optimization: if client already has the latest frame or slide data, or WebRTC is active, strip base64 to save 95%+ bandwidth
    let screenShareToSend = state.screenShare;
    if (state.screenShare && (skipScreenFrame || (sinceScreen > 0 && state.screenShare.updatedAt <= sinceScreen))) {
      screenShareToSend = {
        active: state.screenShare.active,
        presenterName: state.screenShare.presenterName,
        updatedAt: state.screenShare.updatedAt,
      };
    }

    let whiteboardToSend = state.whiteboard;
    if (state.whiteboard) {
      const skipHeavyWb = (sinceWb > 0 && state.whiteboard.updatedAt <= sinceWb) || (state.screenShare?.active && !state.whiteboard.active);
      if (skipHeavyWb) {
        whiteboardToSend = {
          active: state.whiteboard.active,
          currentSlide: state.whiteboard.currentSlide,
          totalSlides: state.whiteboard.totalSlides,
          mode: state.whiteboard.mode,
          notepadText: state.whiteboard.notepadText,
          updatedAt: state.whiteboard.updatedAt,
        };
      }
    }

    return NextResponse.json({
      success: true,
      status: state.status,
      duration: state.duration,
      startedAt: state.startedAt,
      meetingExtended: state.meetingExtended,
      hostCamera: state.hostCamera,
      participantCameras: state.participantCameras || {},
      handRaises: state.handRaises || [],
      screenShare: screenShareToSend,
      whiteboard: whiteboardToSend,
      chat: state.chat,
      notes: state.notes,
      reactions: state.reactions,
      participantMuteAction: state.participantMuteAction,
      muteAll: state.muteAll,
      signals: signalsForMe,
      serverTime: now,
    }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching room state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: NO_CACHE_HEADERS });
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

    // Meeting duration update / extension
    if (body.duration !== undefined) {
      state.duration = Number(body.duration);
    }
    if (body.startedAt !== undefined) {
      state.startedAt = body.startedAt;
    }
    if (body.extendedBy !== undefined || body.extendMinutes !== undefined) {
      const extMins = Number(body.extendedBy || body.extendMinutes);
      state.meetingExtended = {
        newDuration: state.duration || 60,
        extendedBy: extMins,
        timestamp: now,
      };
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

    // 0d. WebRTC signaling for 2-way real-time voice audio & 60fps screen share (single or batched)
    if (body.signals && Array.isArray(body.signals)) {
      if (!state.signals) state.signals = [];
      for (const sig of body.signals) {
        if (sig && sig.from && sig.to) {
          state.signals.push({
            id: sig.id || `sig_${now}_${Math.random().toString(36).substring(2, 7)}`,
            from: sig.from,
            to: sig.to,
            type: sig.type,
            payload: sig.payload,
            timestamp: now,
          });
        }
      }
      if (state.signals.length > 1000) {
        state.signals = state.signals.slice(-1000);
      }
    } else if (body.signal && body.signal.from && body.signal.to) {
      if (!state.signals) state.signals = [];
      state.signals.push({
        id: body.signal.id || `sig_${now}_${Math.random().toString(36).substring(2, 7)}`,
        from: body.signal.from,
        to: body.signal.to,
        type: body.signal.type,
        payload: body.signal.payload,
        timestamp: now,
      });
      if (state.signals.length > 1000) {
        state.signals = state.signals.slice(-1000);
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
      const isScreenActive = Boolean(body.screenShare.active);
      state.screenShare = {
        active: isScreenActive,
        presenterName: body.screenShare.presenterName || state.screenShare.presenterName,
        streamFrame: body.screenShare.streamFrame !== undefined ? body.screenShare.streamFrame : state.screenShare.streamFrame,
        updatedAt: now,
      };
      if (isScreenActive) {
        // When screen share begins, automatically deactivate whiteboard so students immediately switch to screen share
        if (state.whiteboard) {
          state.whiteboard.active = false;
          state.whiteboard.updatedAt = now;
        }
      } else {
        state.screenShare.streamFrame = undefined;
      }
    }

    // 2. Whiteboard update (supporting slides & notepad text)
    if (body.whiteboard !== undefined) {
      const isWbActive = Boolean(body.whiteboard.active);
      state.whiteboard = {
        active: isWbActive,
        canvasData: body.whiteboard.canvasData !== undefined ? body.whiteboard.canvasData : state.whiteboard.canvasData,
        currentSlide: body.whiteboard.currentSlide !== undefined ? body.whiteboard.currentSlide : state.whiteboard.currentSlide,
        totalSlides: body.whiteboard.totalSlides !== undefined ? body.whiteboard.totalSlides : state.whiteboard.totalSlides,
        slides: body.whiteboard.slides !== undefined ? body.whiteboard.slides : state.whiteboard.slides,
        notepadText: body.whiteboard.notepadText !== undefined ? body.whiteboard.notepadText : state.whiteboard.notepadText,
        mode: body.whiteboard.mode !== undefined ? body.whiteboard.mode : state.whiteboard.mode,
        updatedAt: now,
      };
      if (isWbActive) {
        // When whiteboard is activated, deactivate screen share
        if (state.screenShare) {
          state.screenShare.active = false;
          state.screenShare.streamFrame = undefined;
          state.screenShare.updatedAt = now;
        }
      } else {
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

    // 6. Remote Mute Action / Mute All
    if (body.participantMuteAction) {
      state.participantMuteAction = {
        targetParticipantId: body.participantMuteAction.targetParticipantId,
        targetName: body.participantMuteAction.targetName,
        isMuted: Boolean(body.participantMuteAction.isMuted),
        timestamp: body.participantMuteAction.timestamp || now,
      };
    }
    if (body.muteAll) {
      state.muteAll = {
        timestamp: body.muteAll.timestamp || now,
      };
    }

    // Debounced, non-blocking asynchronous state persistence
    schedulePersistRoomStates();

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
      participantMuteAction: state.participantMuteAction,
      muteAll: state.muteAll,
      signals: (state.signals || []).filter(s =>
        !body.participantId || s.to === body.participantId || s.to === 'all' || (body.participantId === 'host' && s.to === 'host')
      ),
      serverTime: now,
    }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error updating room state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
