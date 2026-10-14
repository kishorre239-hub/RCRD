import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';

let driveClient: drive_v3.Drive | null = null;

function getServiceAccountCredentials(): Record<string, unknown> | null {
  // Check environment variable first
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      return parsed;
    } catch {
      // try base64 decode
      try {
        const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8');
        return JSON.parse(decoded);
      } catch (e) {
        console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY env var', e);
      }
    }
  }

  // Look for service account json files on disk
  const possiblePaths = [
    path.resolve(process.cwd(), 'geonixa-loom-1acdad37ffd0.json'),
    path.resolve(process.cwd(), '../../geonixa-loom-1acdad37ffd0.json'),
    path.resolve(process.cwd(), '../geonixa-loom-1acdad37ffd0.json'),
    'd:/PROJECTS/Geonixa LOOM/geonixa-loom-1acdad37ffd0.json',
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      try {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ p, 'utf-8');
        return JSON.parse(content);
      } catch {
        // continue
      }
    }
  }

  return null;
}

export function getDriveClient(): drive_v3.Drive | null {
  if (driveClient) return driveClient;

  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    console.warn('Google Drive Service Account credentials not found.');
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

export async function getMeetingFolderId(): Promise<string> {
  const drive = getDriveClient();
  if (!drive) return '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4';
  try {
    const res = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and name = 'MEETING' and trashed = false",
      fields: 'files(id, name)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (res.data.files && res.data.files.length > 0 && res.data.files[0].id) {
      return res.data.files[0].id;
    }
    const createdId = await createDriveFolder('MEETING');
    return createdId || '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4';
  } catch {
    return '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4';
  }
}

/**
 * Creates a resumable upload session on Google Drive.
 * This returns the direct upload URL that the browser can stream video chunks directly to,
 * bypassing Vercel body size limits!
 */
export async function createResumableUploadSession(params: {
  title: string;
  mimeType?: string;
  folderId?: string;
  size?: number;
  isMeeting?: boolean;
}): Promise<{ uploadUrl: string } | null> {
  const credentials = getServiceAccountCredentials();
  if (!credentials) return null;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  if (!token) {
    throw new Error('Failed to acquire Google Drive access token');
  }

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: params.title || `Recording-${Date.now()}.webm`,
    mimeType: params.mimeType || 'video/webm',
  };

  let targetFolder = params.folderId || process.env.DRIVE_DEFAULT_FOLDER_ID;
  if (params.isMeeting || targetFolder === 'MEETING') {
    targetFolder = await getMeetingFolderId();
  }

  if (targetFolder) {
    metadata.parents = [targetFolder];
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': params.mimeType || 'video/webm',
  };

  if (params.size) {
    headers['X-Upload-Content-Length'] = params.size.toString();
  }

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(metadata),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Drive session creation error:', errorText);
    throw new Error(`Google Drive API error: ${response.status} ${errorText}`);
  }

  const uploadUrl = response.headers.get('location');
  if (!uploadUrl) {
    throw new Error('Google Drive did not return a resumable upload location header');
  }

  return { uploadUrl };
}

/**
 * Clean up ugly filenames (like UUIDs, timestamps, internal names) into professional titles
 */
export function cleanVideoTitle(rawName: string, createdTime?: string | number): string {
  if (!rawName || typeof rawName !== 'string') {
    const d = createdTime ? new Date(createdTime) : new Date();
    return `Screen Recording · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  // Remove file extension
  let title = rawName.replace(/\.(mp4|webm|mov|mkv|avi|png|jpg|jpeg)$/i, '').trim();

  // Strip trailing dots and punctuation
  title = title.replace(/[.\-_]+$/, '').trim();

  // Strip common suffixes
  title = title.replace(/[_-]compressed$/i, '').replace(/[_-]raw$/i, '').trim();
  title = title.replace(/[.\-_]+$/, '').trim();

  // If title is a single number like "1", "2"
  if (/^\d+$/.test(title)) {
    return `Session ${title} · Recording`;
  }

  // If title is a UUID, hash, or random hex string (e.g., 18b445ed-011f-402d-9478-b4b9ed448d59)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(title);
  const isHexHash = /^[0-9a-f]{20,}$/i.test(title);
  const isGeneric = /^recording[_-]?\d*$/i.test(title) || /^screen[_-]?recording[_-]?\d*$/i.test(title);

  if (isUuid || isHexHash || isGeneric || !title) {
    const d = createdTime ? new Date(createdTime) : new Date();
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `Screen Recording · ${datePart} (${timePart})`;
  }

  // Replace underscores and multiple hyphens with clean spaces
  title = title.replace(/[_-]+/g, ' ').trim();

  return title;
}

/**
 * Format Google Drive thumbnail to high resolution
 */
export function formatDriveThumbnailUrl(link?: string | null): string {
  if (!link) return '';
  if (/=s\d+/.test(link)) {
    return link.replace(/=s\d+/, '=s640');
  }
  return link.includes('?') ? `${link}&sz=w640-h360` : `${link}=s640`;
}

/**
 * Get file details by fileId from Google Drive
 */
export async function getFileMetadata(fileId: string) {
  const drive = getDriveClient();
  if (!drive) return null;

  try {
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime, thumbnailLink, videoMediaMetadata',
      supportsAllDrives: true,
    });
    const data = res.data;
    const duration = data.videoMediaMetadata?.durationMillis
      ? Math.round(Number(data.videoMediaMetadata.durationMillis) / 1000)
      : 0;
    const thumbnailUrl = formatDriveThumbnailUrl(data.thumbnailLink);

    return {
      ...data,
      title: cleanVideoTitle(data.name || '', data.createdTime || undefined),
      duration,
      thumbnailUrl,
      thumbnailLink: thumbnailUrl,
    };
  } catch (error: unknown) {
    console.error(`Failed to get Google Drive file ${fileId}:`, (error as Error)?.message);
    return null;
  }
}

/**
 * Stream a video file directly from Google Drive with byte-range support
 */
export async function getDriveFileStream(fileId: string, rangeHeader?: string | null) {
  const drive = getDriveClient();
  if (!drive) return null;

  try {
    const metaRes = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, videoMediaMetadata',
      supportsAllDrives: true,
    });

    const headers: Record<string, string> = {};
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const streamRes = await drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      {
        responseType: 'stream',
        headers,
      }
    );

    return {
      stream: streamRes.data,
      metadata: metaRes.data,
      headers: streamRes.headers,
      status: streamRes.status || 200,
    };
  } catch (error: unknown) {
    console.error(`Failed to stream Drive file ${fileId}:`, (error as Error)?.message);
    return null;
  }
}

/**
 * Delete a file from Google Drive
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  const drive = getDriveClient();
  if (!drive) return false;

  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    return true;
  } catch (error: unknown) {
    console.error(`Failed to delete Google Drive file ${fileId}:`, (error as Error)?.message);
    return false;
  }
}

/**
 * Rename a file in Google Drive
 */
export async function renameDriveFile(fileId: string, newTitle: string): Promise<boolean> {
  const drive = getDriveClient();
  if (!drive || !fileId || fileId.startsWith('local:')) return false;

  try {
    let finalName = newTitle.trim();
    try {
      const existing = await drive.files.get({
        fileId,
        fields: 'name',
        supportsAllDrives: true,
      });
      const oldName = existing.data.name || '';
      const extMatch = oldName.match(/\.(mp4|webm|mov|mkv|avi|png|jpg|jpeg)$/i);
      if (extMatch && !finalName.toLowerCase().endsWith(extMatch[0].toLowerCase())) {
        finalName = `${finalName}${extMatch[0]}`;
      }
    } catch {
      // ignore get error and proceed with finalName
    }

    await drive.files.update({
      fileId,
      requestBody: {
        name: finalName,
      },
      supportsAllDrives: true,
    });

    // Invalidate in-memory cache to force fresh pull
    driveCache.timestamp = 0;
    const cached = driveCache.videos.find(v => v.id === fileId || v.driveFileId === fileId);
    if (cached) {
      cached.title = newTitle.trim();
      cached.rawName = finalName;
    }

    return true;
  } catch (error: unknown) {
    console.error(`Failed to rename Google Drive file ${fileId}:`, (error as Error)?.message);
    return false;
  }
}

/**
 * Create a folder in Google Drive
 */
export async function createDriveFolder(name: string, parentId?: string): Promise<string | null> {
  const drive = getDriveClient();
  if (!drive) return null;

  try {
    const metadata: { name: string; mimeType: string; parents?: string[] } = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      metadata.parents = [parentId];
    }

    const res = await drive.files.create({
      requestBody: metadata,
      fields: 'id',
      supportsAllDrives: true,
    });
    return res.data.id || null;
  } catch (error: unknown) {
    console.error('Failed to create Drive folder:', (error as Error)?.message);
    return null;
  }
}

/**
 * Get Google Drive storage quota
 */
export async function getDriveStorageStatus(): Promise<{
  connected: boolean;
  message?: string;
  storageQuota?: drive_v3.Schema$About['storageQuota'];
  user?: drive_v3.Schema$User;
  error?: string;
}> {
  const drive = getDriveClient();
  if (!drive) return { connected: false, message: 'Google Drive credentials unavailable' };

  try {
    const res = await drive.about.get({
      fields: 'storageQuota, user',
    });
    return {
      connected: true,
      storageQuota: res.data.storageQuota,
      user: res.data.user,
    };
  } catch (error: unknown) {
    return {
      connected: false,
      error: (error as Error)?.message,
    };
  }
}

export interface DriveVideoItem {
  id: string;
  driveFileId: string;
  title: string;
  rawName?: string | null;
  ownerName: string;
  ownerEmail: string;
  mimeType: string;
  size: number;
  duration: number;
  thumbnailUrl: string;
  thumbnailLink: string;
  status: string;
  isPublic: boolean;
  views: number;
  comments: unknown[];
  courseId: string;
  createdAt: number;
  updatedAt: number;
  webViewLink?: string | null;
  webContentLink?: string | null;
}

export interface DriveFolderItem {
  id: string | null | undefined;
  name: string;
}

/**
 * Fast cached listing of videos and folders directly from Google Drive
 */
let driveCache: { timestamp: number; videos: DriveVideoItem[]; folders: DriveFolderItem[] } = {
  timestamp: 0,
  videos: [],
  folders: [],
};

export async function listDriveVideosAndFolders(forceRefresh = false): Promise<{
  videos: DriveVideoItem[];
  folders: DriveFolderItem[];
  connected: boolean;
}> {
  const drive = getDriveClient();
  if (!drive) {
    return { videos: driveCache.videos, folders: driveCache.folders, connected: false };
  }

  const now = Date.now();
  if (!forceRefresh && now - driveCache.timestamp < 15000 && driveCache.videos.length > 0) {
    return { videos: driveCache.videos, folders: driveCache.folders, connected: true };
  }

  try {
    const res = await drive.files.list({
      q: "trashed = false",
      fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, parents, thumbnailLink, videoMediaMetadata)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = res.data.files || [];
    const videos: DriveVideoItem[] = [];
    const folders: DriveFolderItem[] = [];

    for (const f of files) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        folders.push({
          id: f.id,
          name: f.name || 'Untitled Folder',
        });
      } else if (
        (f.mimeType && f.mimeType.startsWith('video/')) ||
        (f.name && (f.name.endsWith('.mp4') || f.name.endsWith('.webm') || f.name.endsWith('.mov'))) ||
        f.mimeType === 'application/vnd.google-apps.vid'
      ) {
        const duration = f.videoMediaMetadata?.durationMillis
          ? Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000)
          : 0;
        const thumbnailUrl = formatDriveThumbnailUrl(f.thumbnailLink);

        videos.push({
          id: f.id || '',
          driveFileId: f.id || '',
          title: cleanVideoTitle(f.name || '', f.createdTime || undefined),
          rawName: f.name,
          ownerName: 'Google Drive User',
          ownerEmail: 'admin@rcrd.com',
          mimeType: f.mimeType || 'video/mp4',
          size: f.size ? Number(f.size) : 0,
          duration,
          thumbnailUrl,
          thumbnailLink: thumbnailUrl,
          status: 'READY',
          isPublic: true,
          views: 0,
          comments: [],
          courseId: (f.parents && f.parents[0]) || '',
          createdAt: f.createdTime ? new Date(f.createdTime).getTime() : Date.now(),
          updatedAt: f.createdTime ? new Date(f.createdTime).getTime() : Date.now(),
          webViewLink: f.webViewLink,
          webContentLink: f.webContentLink,
        });
      }
    }

    driveCache = {
      timestamp: now,
      videos,
      folders,
    };

    return { videos, folders, connected: true };
  } catch (err: unknown) {
    console.warn('Google Drive list error:', (err as Error)?.message);
    return { videos: driveCache.videos, folders: driveCache.folders, connected: true };
  }
}


