import fs from 'fs';
import path from 'path';
import { VideoComment, VideoEditorData } from './types';

export interface StoredVideoMeta {
  views?: number;
  title?: string;
  courseId?: string;
  driveFileId?: string;
  size?: number;
  status?: string;
  comments?: VideoComment[];
  editorData?: VideoEditorData | Record<string, unknown>;
  updatedAt?: number;
  [key: string]: unknown;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'video-store.json');

let memoryStore: Record<string, StoredVideoMeta> = {};

function initStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      memoryStore = JSON.parse(content);
    }
  } catch (err) {
    console.warn('Failed to load local video backup store:', (err as Error)?.message);
  }
}

function persistStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to persist local video backup store:', (err as Error)?.message);
  }
}

// Initialize on module load
initStore();

export function getBackupComments(videoId: string): VideoComment[] {
  if (!memoryStore[videoId]) return [];
  return memoryStore[videoId].comments || [];
}

export function saveBackupComment(videoId: string, comment: VideoComment): VideoComment[] {
  if (!memoryStore[videoId]) {
    memoryStore[videoId] = { comments: [] };
  }
  if (!Array.isArray(memoryStore[videoId].comments)) {
    memoryStore[videoId].comments = [];
  }
  // Avoid duplicate by id
  const existingIndex = memoryStore[videoId].comments!.findIndex(c => c.id === comment.id);
  if (existingIndex >= 0) {
    memoryStore[videoId].comments![existingIndex] = comment;
  } else {
    memoryStore[videoId].comments!.push(comment);
  }
  memoryStore[videoId].updatedAt = Date.now();
  persistStore();
  return memoryStore[videoId].comments!;
}

export function getBackupVideoMeta(videoId: string): StoredVideoMeta | null {
  return memoryStore[videoId] || null;
}

export function saveBackupVideoMeta(videoId: string, updates: Partial<StoredVideoMeta>): StoredVideoMeta {
  if (!memoryStore[videoId]) {
    memoryStore[videoId] = {};
  }
  memoryStore[videoId] = {
    ...memoryStore[videoId],
    ...updates,
    updatedAt: Date.now(),
  };
  persistStore();
  return memoryStore[videoId];
}

export function deleteBackupVideoMeta(videoId: string): void {
  if (memoryStore[videoId]) {
    delete memoryStore[videoId];
    persistStore();
  }
}

export interface StoredMeeting {
  id: string;
  title: string;
  courseId: string | null;
  password: string;
  scheduledAt: string;
  duration: number;
  status: 'scheduled' | 'live' | 'ended';
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface StoredParticipant {
  id: string;
  name: string;
  role: 'Host' | 'Student';
  avatar: string;
  isMuted?: boolean;
  isVideoOn?: boolean;
  isHandRaised?: boolean;
  canScreenShare?: boolean;
  canChat?: boolean;
  lastPing: number;
}

const MEETINGS_FILE = path.join(DATA_DIR, 'meetings-store.json');
let meetingsStore: Record<string, StoredMeeting> = {};
const participantsMemory: Record<string, Record<string, StoredParticipant>> = {};

function initMeetingsStore() {
  try {
    if (fs.existsSync(MEETINGS_FILE)) {
      const content = fs.readFileSync(MEETINGS_FILE, 'utf-8');
      meetingsStore = JSON.parse(content);
    }
  } catch (err) {
    console.warn('Failed to load local meetings backup store:', (err as Error)?.message);
  }
}

function persistMeetingsStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(MEETINGS_FILE, JSON.stringify(meetingsStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to persist local meetings backup store:', (err as Error)?.message);
  }
}

initMeetingsStore();

export function getAllBackupMeetings(): StoredMeeting[] {
  return Object.values(meetingsStore);
}

export function getBackupMeeting(id: string): StoredMeeting | null {
  return meetingsStore[id] || null;
}

export function saveBackupMeeting(meeting: StoredMeeting): StoredMeeting {
  meetingsStore[meeting.id] = {
    ...meetingsStore[meeting.id],
    ...meeting,
    updatedAt: Date.now(),
  };
  persistMeetingsStore();
  return meetingsStore[meeting.id];
}

export function deleteBackupMeeting(id: string): boolean {
  if (meetingsStore[id]) {
    delete meetingsStore[id];
    persistMeetingsStore();
    return true;
  }
  return false;
}

export function getMeetingParticipants(meetingId: string): StoredParticipant[] {
  const room = participantsMemory[meetingId];
  if (!room) return [];
  const cutoff = Date.now() - 35000; // prune participants inactive > 35s
  const active: StoredParticipant[] = [];
  for (const [id, p] of Object.entries(room)) {
    if (p.lastPing >= cutoff) {
      active.push(p);
    } else {
      delete room[id];
    }
  }
  return active;
}

export function updateMeetingParticipant(
  meetingId: string,
  participant: Partial<StoredParticipant> & { id: string; name: string }
): StoredParticipant[] {
  if (!participantsMemory[meetingId]) {
    participantsMemory[meetingId] = {};
  }
  const room = participantsMemory[meetingId];
  const existing = room[participant.id];
  const role = participant.role || existing?.role || (participant.id === 'host' ? 'Host' : 'Student');
  const avatar = participant.avatar || existing?.avatar || participant.name.charAt(0).toUpperCase();

  room[participant.id] = {
    ...existing,
    ...participant,
    id: participant.id,
    name: participant.name,
    role,
    avatar,
    lastPing: Date.now(),
  };

  return getMeetingParticipants(meetingId);
}

export function removeMeetingParticipant(meetingId: string, participantId: string): StoredParticipant[] {
  if (participantsMemory[meetingId] && participantsMemory[meetingId][participantId]) {
    delete participantsMemory[meetingId][participantId];
  }
  return getMeetingParticipants(meetingId);
}

