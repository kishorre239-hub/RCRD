import fs from 'fs';
import path from 'path';
import { VideoComment } from './types';

interface StoredVideoMeta {
  views?: number;
  title?: string;
  courseId?: string;
  driveFileId?: string;
  size?: number;
  status?: string;
  comments?: VideoComment[];
  editorData?: any;
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
