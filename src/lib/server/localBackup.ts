import fs from 'fs';
import path from 'path';
import { VideoComment, VideoEditorData } from './types';

export interface StoredVideoMeta {
  views?: number;
  title?: string;
  courseId?: string;
  driveFileId?: string;
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  mentorEmail?: string;
  hostEmail?: string;
  isPublic?: boolean;
  isCompanyShared?: boolean;
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
  startedAt?: string;
  duration: number;
  status: 'scheduled' | 'live' | 'ended';
  hostName?: string;
  hostEmail?: string;
  hostId?: string;
  mentorEmail?: string;
  ownerId?: string;
  createdBy?: string;
  batchId?: string | null;
  batchName?: string | null;
  allowedEmails?: string[];
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

export function isDummyMeeting(m: { id?: string; title?: string } | null | undefined): boolean {
  if (!m) return false;
  const id = (m.id || '').toUpperCase().trim();
  const title = (m.title || '').toLowerCase().trim();
  if (
    id === 'GEO-CLASS-101' ||
    id === 'RCRD-MEET-202' ||
    id === 'REV-QA-303'
  ) {
    return true;
  }
  if (
    title === 'interactive screen & recording workshop' ||
    title === 'weekly code review & mentorship'
  ) {
    return true;
  }
  return false;
}

export function isMeetingDurationExpired(
  m: { scheduledAt?: string; startedAt?: string; duration?: number; status?: string } | null | undefined,
  now = Date.now()
): boolean {
  if (!m || m.status === 'ended') return false;
  const startStr = m.startedAt || m.scheduledAt;
  if (!startStr) return false;
  const startT = new Date(startStr).getTime();
  if (isNaN(startT)) return false;
  const durationMins = Number(m.duration) || 60;
  const endT = startT + durationMins * 60000;
  return now >= endT;
}

const MEETINGS_FILE = path.join(DATA_DIR, 'meetings-store.json');
let meetingsStore: Record<string, StoredMeeting> = {};
const participantsMemory: Record<string, Record<string, StoredParticipant>> = {};

function initMeetingsStore() {
  try {
    if (fs.existsSync(MEETINGS_FILE)) {
      const content = fs.readFileSync(MEETINGS_FILE, 'utf-8');
      meetingsStore = JSON.parse(content);
      // Clean any dummy meetings that may exist in store
      let hasDummy = false;
      for (const key of Object.keys(meetingsStore)) {
        if (isDummyMeeting(meetingsStore[key])) {
          delete meetingsStore[key];
          hasDummy = true;
        }
      }
      if (hasDummy) {
        persistMeetingsStore();
      }
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
  const now = Date.now();
  let changed = false;
  for (const m of Object.values(meetingsStore)) {
    if (m.status !== 'ended' && isMeetingDurationExpired(m, now)) {
      m.status = 'ended';
      m.updatedAt = now;
      changed = true;
    }
  }
  if (changed) {
    persistMeetingsStore();
  }
  return Object.values(meetingsStore).filter(m => !isDummyMeeting(m));
}

export function getBackupMeeting(id: string): StoredMeeting | null {
  const m = meetingsStore[id] || null;
  if (!m || isDummyMeeting(m)) return null;
  if (m.status !== 'ended' && isMeetingDurationExpired(m)) {
    m.status = 'ended';
    m.updatedAt = Date.now();
    persistMeetingsStore();
  }
  return m;
}

export function saveBackupMeeting(meeting: StoredMeeting): StoredMeeting {
  if (isDummyMeeting(meeting)) {
    return meeting;
  }
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

function cleanParticipantName(name: string): string {
  return (name || '')
    .replace(/\s*\((Student|Host|You)\)/gi, '')
    .trim()
    .toLowerCase();
}

export function getMeetingParticipants(meetingId: string): StoredParticipant[] {
  const room = participantsMemory[meetingId];
  if (!room) return [];
  const cutoff = Date.now() - 15000; // prune participants inactive > 15s
  const activeMap = new Map<string, StoredParticipant>();

  for (const [id, p] of Object.entries(room)) {
    if (p.lastPing >= cutoff) {
      // Normalize name to deduplicate multiple tabs / reconnection instances
      const key = cleanParticipantName(p.name);
      if (!activeMap.has(key) || (activeMap.get(key)!.lastPing < p.lastPing)) {
        activeMap.set(key, p);
      }
    } else {
      delete room[id];
    }
  }
  return Array.from(activeMap.values());
}

export function updateMeetingParticipant(
  meetingId: string,
  participant: Partial<StoredParticipant> & { id: string; name: string }
): StoredParticipant[] {
  if (!participantsMemory[meetingId]) {
    participantsMemory[meetingId] = {};
  }
  const room = participantsMemory[meetingId];

  // DEDUPLICATION: remove any older session for the exact same student/host name
  const cleanName = cleanParticipantName(participant.name);
  for (const [existingId, p] of Object.entries(room)) {
    if (existingId !== participant.id && cleanParticipantName(p.name) === cleanName) {
      delete room[existingId];
    }
  }

  const existing = room[participant.id];
  const role = participant.role || existing?.role || (participant.id === 'host' ? 'Host' : 'Student');
  const avatar = participant.avatar || existing?.avatar || participant.name.substring(0, 2).toUpperCase();

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
  if (participantsMemory[meetingId]) {
    delete participantsMemory[meetingId][participantId];
    // Also remove any entries matching the participant ID
    for (const [id, p] of Object.entries(participantsMemory[meetingId])) {
      if (id === participantId || p.id === participantId) {
        delete participantsMemory[meetingId][id];
      }
    }
  }
  return getMeetingParticipants(meetingId);
}

export interface StoredBatch {
  id: string;
  name: string;
  topic?: string;
  description?: string;
  studentEmails: string[];
  mentorEmail?: string;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

const BATCHES_FILE = path.join(DATA_DIR, 'batches-store.json');
let batchesStore: Record<string, StoredBatch> = {};

function initBatchesStore() {
  try {
    if (fs.existsSync(BATCHES_FILE)) {
      const content = fs.readFileSync(BATCHES_FILE, 'utf-8');
      batchesStore = JSON.parse(content);
    }
  } catch (err) {
    console.warn('Failed to load local batches backup store:', (err as Error)?.message);
  }
}

function persistBatchesStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(BATCHES_FILE, JSON.stringify(batchesStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to persist local batches backup store:', (err as Error)?.message);
  }
}

initBatchesStore();

export function getAllBackupBatches(): StoredBatch[] {
  return Object.values(batchesStore).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function getBackupBatch(id: string): StoredBatch | null {
  return batchesStore[id] || null;
}

export function saveBackupBatch(batch: StoredBatch): StoredBatch {
  batchesStore[batch.id] = {
    ...batchesStore[batch.id],
    ...batch,
    updatedAt: Date.now(),
  };
  persistBatchesStore();
  return batchesStore[batch.id];
}

export function deleteBackupBatch(id: string): boolean {
  if (batchesStore[id]) {
    delete batchesStore[id];
    persistBatchesStore();
    return true;
  }
  return false;
}


