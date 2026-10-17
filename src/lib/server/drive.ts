import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
// The user's Google Drive root folder: GEONIXA LOOM
export const DEFAULT_ROOT_FOLDER_ID = '1XuI65NmTH9w_8FYM1LJZYLPCYvWg27N7';
export const DEFAULT_MEETING_FOLDER_ID = DEFAULT_ROOT_FOLDER_ID;

export function extractDriveFolderId(input?: string | null): string {
  if (!input) return DEFAULT_ROOT_FOLDER_ID;
  const trimmed = input.trim();
  if (trimmed === 'root' || trimmed === 'all' || trimmed === 'folder-all' || trimmed === 'workspace') {
    return DEFAULT_ROOT_FOLDER_ID;
  }
  let id = trimmed;
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) {
    id = match[1];
  } else {
    const idMatch = trimmed.match(/^([a-zA-Z0-9_-]{20,})$/);
    if (idMatch) id = idMatch[1];
  }
  if (!id || id === '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4' || id.includes('1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4') || id === 'root' || id === 'all') {
    return DEFAULT_ROOT_FOLDER_ID;
  }
  return id;
}

export function getRootFolderId(): string {
  const raw = process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.DRIVE_DEFAULT_FOLDER_ID || DEFAULT_ROOT_FOLDER_ID;
  return extractDriveFolderId(raw);
}

// Embedded fallback credentials for seamless Vercel serverless deployment
const DEFAULT_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "geonixa-loom",
  private_key_id: "1acdad37ffd06023837c951b0eb8b8d0fe19d841",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC28GBEyEIweMYr\nVAuLeWVfTYGkNUhPcr+bp7QznEjokNeB0AkdNIvP5RIqFZAzQ2infoulks4DTlSw\n0B31E4x3KcPlHU0DdWllhw+IWHrfPb3+vqPMJucwy71jlfN+F19oqse7FmJD8DXZ\nrEWz/cbm6QJwNa0wLGZKl4v+dDjoqCrXubJgVSqt6IgyxCnVJat9zjHfW9E0/nE1\nTsV849ACN2BQAkNnyByacbeMM2lSZFh6m0yzVToW3p3gt0kg6Qgr+L9PVx/zMfe5\nG7+2ocO/0+ONV6nAIpkrKqWVVZBsI+vyXKx9PJ2dDul6KM33WW9daejYV9WvH16G\nE1iF8XrBAgMBAAECggEAG9Jc4bkPD+4ePVKv2stglmjkMYQE9kg+Sb7skfjPwcbd\nb5mi+TUXmkt9Qrc60gELdoWxWUIFYM1V5foQxEfv0eOhLkQRhVgi6lTrENJcBX2P\nWqHFqXO1L1+c8vtIJ8IIOZPXgmV6Flj+55bilugeitmfDE+tgikOeYOov88PJJrE\n7iz1FiIxhKvjUAwjoe/9y7/P/y+yObKG6UTEGm5G+NcX+gzQhmmaa/K/5xKzjrgs\nkxbtYqmNTaPmYsvOjRd+kHefnpxO25SFkP+2hXOl3MHHmjK0xpWtaqsKwq6DDD04\nic7lpwY8kajCeLGO9A+Dby2wnA8dIbMDw8M2H8EX7QKBgQDYdqVfzrC3+ZqM9Lvl\nHoTKNCwBzL8oW+9WxEuc6Ay8qghIGy5+qeMHJUTpt/PJW0ZweKfcyyFeEPslb+S/\nraa/OHe7Zs8AE0CmL+KKM6M3EFQ37kn4zX6tI5oAZpatJYEir2PBRP9BKFOB3gKb\n18HX7mg2fVG1ft/y1mC/h0YICwKBgQDYWjLhc24OgvQphyUsB0M27WJKZk0AI+km\nuVlSQ0FtAcdbx34YVv+YQYtT6Hj9CTtBpAJFTnscIJHei6HhjTMJfDGEydceaeLA\nYMnaLCZaVUBs377W9Ct13uuBxTnFSFL9RcLDdjG18cHMAALCiGzkCJKXAftidb83\nUiDxOQur4wKBgQCTYFQ/4q2W1K5RAd9bo2etc8/yecA8bjuJy6PfdG4XlXyF+1uw\niWI03z8IEWI92ZMfyEYhoXtaXB1h48jOaCB7WKrMQLb2yiTeAQQwK/AX8Volqmta\npi51GyQi2bYEtOAzCU7Vq3BOoHIanVkRWdh0d7EkSDZ1Z6h54VOFk0gu+QKBgDHl\n47RBlhF8vGlThQw5hJQHfdLg80NkBOLsfqBNaKqGbX9KbFeawQpRm5u3kyfw2BzU\ngb2QUy5yiJIGLEjD8xBt91HD53xZOXXbHNLXueS9osU5eV9EIz3lMvXUEfXhL1rA\nmyHPgbmPz32IRxqsskiJfZ2cVGkp9PcCVxyrZni3AoGBAKRhooOkAPVFoaX/BXnN\nQvpLqm7kIF0xwMoutTteEJ/V1B0TRjL8fe76X8oqdL018nUGaqNGH6GskjHNOSX8\ngnsgxJNQYJNv+9cOBBlvfMkoQGoINoqkDrHHCD6O1mkJkjNXWrMW1RR2CzkbbEwp\nncWj8LeA6i8nscg5Dnts9+Rs\n-----END PRIVATE KEY-----\n",
  client_email: "loom-uploader@geonixa-loom.iam.gserviceaccount.com",
  client_id: "103877261286633100088",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/loom-uploader%40geonixa-loom.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

function getServiceAccountCredentials(): Record<string, unknown> | null {
  // 1. Check environment variable first (Vercel production standard)
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

  // 2. Look for service account json files on disk (local development)
  const possiblePaths = [
    path.resolve(process.cwd(), 'geonixa-loom-1acdad37ffd0.json'),
    path.resolve(process.cwd(), '../../geonixa-loom-1acdad37ffd0.json'),
    path.resolve(process.cwd(), '../geonixa-loom-1acdad37ffd0.json'),
    'd:/PROJECTS/Geonixa LOOM/geonixa-loom-1acdad37ffd0.json',
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ p, 'utf-8');
        return JSON.parse(content);
      }
    } catch {
      // continue
    }
  }

  // 3. Fallback to embedded default service account credentials
  if (DEFAULT_SERVICE_ACCOUNT && DEFAULT_SERVICE_ACCOUNT.client_email) {
    return DEFAULT_SERVICE_ACCOUNT as unknown as Record<string, unknown>;
  }

  return null;
}

export interface OAuthTokensData {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string | null;
  expiry_date?: number | null;
  id_token?: string | null;
}

let cachedOAuthTokens: OAuthTokensData | null = null;
let cachedDocCredentials: { clientId?: string; clientSecret?: string } | null = null;

export async function saveOAuthTokens(tokens: OAuthTokensData) {
  cachedOAuthTokens = tokens;

  try {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'google_tokens.json'), JSON.stringify(tokens, null, 2));
  } catch (err) {
    console.warn('Local token save error:', err);
  }

  try {
    const { getCollection } = await import('@/lib/server/db');
    const tokensCol = await getCollection('system_settings');
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || cachedDocCredentials?.clientId;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || cachedDocCredentials?.clientSecret;
    await tokensCol.updateOne(
      { key: 'google_oauth_tokens' },
      { $set: { key: 'google_oauth_tokens', clientId, clientSecret, tokens, updatedAt: Date.now() } },
      { upsert: true }
    );
  } catch (err) {
    console.warn('DB token save error:', err);
  }
}

export async function getOAuthTokens(): Promise<OAuthTokensData | null> {
  if (cachedOAuthTokens) return cachedOAuthTokens;

  try {
    const fs = await import('fs');
    const path = await import('path');
    const tokenPath = path.join(process.cwd(), '.data', 'google_tokens.json');
    if (fs.existsSync(tokenPath)) {
      const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      cachedOAuthTokens = data;
      return data;
    }
  } catch {}

  try {
    const { getCollection } = await import('@/lib/server/db');
    const tokensCol = await getCollection('system_settings');
    const doc = await tokensCol.findOne({ key: 'google_oauth_tokens' }) as {
      clientId?: string;
      clientSecret?: string;
      tokens?: OAuthTokensData;
    } | null;
    if (doc) {
      if (doc.clientId) {
        cachedDocCredentials = {
          clientId: doc.clientId,
          clientSecret: doc.clientSecret,
        };
      }
      if (doc.tokens) {
        cachedOAuthTokens = doc.tokens;
        return cachedOAuthTokens;
      }
    }
  } catch {}

  return null;
}

export async function getOAuth2Client(): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
  const tokens = await getOAuthTokens();
  if (!tokens) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || cachedDocCredentials?.clientId;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || cachedDocCredentials?.clientSecret;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials(tokens);

  // Proactively refresh if token is expired or about to expire
  try {
    if (tokens.expiry_date && Date.now() >= tokens.expiry_date - 60000 && tokens.refresh_token) {
      const tokenRes = await oauth2Client.getAccessToken();
      if (tokenRes.token) {
        tokens.access_token = tokenRes.token;
        tokens.expiry_date = Date.now() + 3500 * 1000;
        saveOAuthTokens(tokens).catch(() => {});
      }
    }
  } catch (refreshErr) {
    console.warn('Proactive token refresh warning:', refreshErr);
  }

  // Auto-save refreshed tokens whenever googleapis refreshes in background
  oauth2Client.on('tokens', (newTokens: OAuthTokensData) => {
    saveOAuthTokens({ ...tokens, ...newTokens });
  });

  return oauth2Client;
}

export async function getDriveClient(): Promise<drive_v3.Drive | null> {
  // 1. If OAuth tokens exist in memory, file, or DB, use OAuth client
  const oauth2Client = await getOAuth2Client();
  if (oauth2Client) {
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  // 2. Otherwise use Service Account
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    console.warn('Google Drive Service Account credentials not found.');
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

export async function getMeetingFolderId(): Promise<string> {
  const drive = await getDriveClient();
  const rootId = getRootFolderId();
  if (!drive) return rootId;
  try {
    const res = await drive.files.list({
      q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const match = (res.data.files || []).find(
      f => f.name?.toLowerCase().trim() === 'meeting' || f.name?.toLowerCase().trim() === 'meetings'
    );
    if (match && match.id) {
      return match.id;
    }
    const createdId = await createDriveFolder('MEETING', rootId);
    return createdId || rootId;
  } catch {
    return rootId;
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
  folderName?: string;
  size?: number;
  isMeeting?: boolean;
  origin?: string;
}): Promise<{ uploadUrl: string } | null> {
  let token: string | null | undefined = null;

  try {
    const oauthClient = await getOAuth2Client();
    if (oauthClient) {
      const tokenRes = await oauthClient.getAccessToken();
      token = tokenRes.token;
    }
  } catch (oauthErr) {
    console.warn('OAuth token fetch warning:', oauthErr);
  }

  if (!token) {
    const credentials = getServiceAccountCredentials();
    if (!credentials) return null;

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    token = tokenResponse.token;
  }

  if (!token) {
    throw new Error('Failed to acquire Google Drive access token');
  }

  const rawTitle = (params.title || `Recording-${Date.now()}`).trim();
  const hasVideoExt = /\.(webm|mp4|mov|mkv)$/i.test(rawTitle);
  const targetExt = params.mimeType?.includes('mp4') ? '.mp4' : '.webm';
  const finalFileName = hasVideoExt ? rawTitle : `${rawTitle}${targetExt}`;

  let cleanMime = (params.mimeType || 'video/webm').split(';')[0].trim();
  if (!cleanMime || !cleanMime.startsWith('video/')) {
    cleanMime = 'video/webm';
  }

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: finalFileName,
    mimeType: cleanMime,
  };

  let targetFolder: string | undefined = undefined;
  if (params.folderId && params.folderId !== 'root' && params.folderId !== 'all') {
    if (params.folderId === '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4' || params.folderId === 'MEETING' || params.folderId === '16MjAhpJTW8PCHm1_L-yHQzyQqHpy4SHg' || params.folderId === '1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW') {
      targetFolder = await getMeetingFolderId();
    } else if (params.folderId === 'screen-shares' || params.folderId === 'team-updates') {
      targetFolder = getRootFolderId();
    } else if (params.folderName && params.folderName.trim()) {
      targetFolder = await getOrCreateNamedDriveFolder(params.folderName.trim());
    } else if (params.folderId.startsWith('folder-')) {
      const cleanName = params.folderId.replace(/^folder-/, '');
      targetFolder = await getOrCreateNamedDriveFolder(cleanName);
    } else {
      targetFolder = extractDriveFolderId(params.folderId);
    }
  } else {
    targetFolder = getRootFolderId();
  }

  if (targetFolder) {
    metadata.parents = [targetFolder];
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': cleanMime,
  };

  if (params.origin) {
    headers['Origin'] = params.origin;
  }

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
  const drive = await getDriveClient();
  if (!drive) return null;

  try {
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink, createdTime, thumbnailLink, videoMediaMetadata, description, properties, parents',
      supportsAllDrives: true,
    });
    const data = res.data;
    const duration = data.videoMediaMetadata?.durationMillis
      ? Math.round(Number(data.videoMediaMetadata.durationMillis) / 1000)
      : 0;
    const thumbnailUrl = formatDriveThumbnailUrl(data.thumbnailLink);

    let editorData = null;
    if (data.description) {
      try {
        const parsed = JSON.parse(data.description);
        if (parsed && (parsed.completedCuts || parsed.cuts || parsed.textOverlays || parsed.audio || parsed.savedAt)) {
          editorData = parsed;
        }
      } catch {}
    }

    return {
      ...data,
      title: cleanVideoTitle(data.name || '', data.createdTime || undefined),
      duration,
      thumbnailUrl,
      thumbnailLink: thumbnailUrl,
      editorData,
      courseId: (data.parents && data.parents[0]) || '',
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
  const drive = await getDriveClient();
  if (!drive) return null;

  try {
    const metaRes = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, videoMediaMetadata',
      supportsAllDrives: true,
    });

    const headers: Record<string, string> = {
      'Accept-Encoding': 'identity',
    };
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
  const drive = await getDriveClient();
  if (!drive) return false;

  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    // Invalidate driveCache
    driveCache.timestamp = 0;
    driveCache.videos = driveCache.videos.filter(v => v.id !== fileId && v.driveFileId !== fileId);
    driveCache.folders = driveCache.folders.filter(f => f.id !== fileId);
    return true;
  } catch (error: unknown) {
    console.error(`Failed to delete Google Drive file ${fileId}:`, (error as Error)?.message);
    return false;
  }
}

/**
 * Rename a file or folder in Google Drive
 */
export async function renameDriveFile(fileId: string, newTitle: string): Promise<boolean> {
  const drive = await getDriveClient();
  if (!drive || !fileId || fileId.startsWith('local:')) return false;

  try {
    let finalName = newTitle.trim();
    let isFolder = false;
    try {
      const existing = await drive.files.get({
        fileId,
        fields: 'name, mimeType',
        supportsAllDrives: true,
      });
      isFolder = existing.data.mimeType === 'application/vnd.google-apps.folder';
      if (!isFolder) {
        const oldName = existing.data.name || '';
        const extMatch = oldName.match(/\.(mp4|webm|mov|mkv|avi|png|jpg|jpeg)$/i);
        if (extMatch && !finalName.toLowerCase().endsWith(extMatch[0].toLowerCase())) {
          finalName = `${finalName}${extMatch[0]}`;
        }
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
    const cachedFolder = driveCache.folders.find(f => f.id === fileId);
    if (cachedFolder) {
      cachedFolder.name = newTitle.trim();
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
  const drive = await getDriveClient();
  if (!drive) return null;

  try {
    const rootId = extractDriveFolderId(parentId || getRootFolderId());
    const folderName = name.trim();
    if (!folderName) return null;

    // Check if an active folder with this exact name already exists under rootId (case-insensitive)
    try {
      const existing = await drive.files.list({
        q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const match = (existing.data.files || []).find(
        f => f.name?.toLowerCase().trim() === folderName.toLowerCase()
      );
      if (match && match.id) {
        driveCache.timestamp = 0;
        return match.id;
      }
    } catch (checkErr) {
      console.warn('Folder duplicate check warning:', checkErr);
    }

    const metadata: { name: string; mimeType: string; parents?: string[] } = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootId],
    };

    const res = await drive.files.create({
      requestBody: metadata,
      fields: 'id, name, parents',
      supportsAllDrives: true,
    });
    driveCache.timestamp = 0;
    if (res.data.id) {
      driveCache.folders.push({ id: res.data.id, name: folderName });
    }
    return res.data.id || null;
  } catch (error: unknown) {
    console.error('Failed to create Drive folder:', (error as Error)?.message);
    return null;
  }
}

/**
 * List all folders in Google Drive (including Root and all dynamic subfolders)
 */
export async function listDriveFolders(): Promise<Array<{ id: string; name: string }>> {
  const drive = await getDriveClient();
  const rootId = getRootFolderId();

  if (!drive) return [];

  try {
    // Strictly fetch ONLY active subfolders whose parent is GEONIXA LOOM (rootId)
    const q = `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await drive.files.list({
      q,
      fields: 'files(id, name, createdTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 100,
    });

    const items = res.data.files || [];
    const folders: Array<{ id: string; name: string }> = [];
    const seenNames = new Set<string>();

    for (const f of items) {
      if (!f.id || !f.name) continue;
      // Do not list root folder as its own subfolder
      if (f.id === rootId) continue;
      const lowerName = f.name.toLowerCase().trim();
      if (!folders.some(existing => existing.id === f.id) && !seenNames.has(lowerName)) {
        seenNames.add(lowerName);
        folders.push({ id: f.id, name: f.name.trim() });
      }
    }

    return folders;
  } catch (err) {
    console.warn('Google Drive folder listing warning:', err);
    return [];
  }
}

/**
 * Persist video editor cuts, overlays, audio tracks directly onto the Google Drive file
 */
export async function updateDriveFileEditorData(fileId: string, editorData: unknown): Promise<boolean> {
  const drive = await getDriveClient();
  if (!drive || !fileId || fileId.startsWith('local:')) return false;

  try {
    const jsonStr = typeof editorData === 'string' ? editorData : JSON.stringify(editorData);
    await drive.files.update({
      fileId,
      requestBody: {
        description: jsonStr,
        properties: {
          hasEditorData: 'true',
          editorUpdatedAt: Date.now().toString(),
        },
      },
      supportsAllDrives: true,
    });

    // Invalidate driveCache
    driveCache.timestamp = 0;
    const cached = driveCache.videos.find(v => v.id === fileId || v.driveFileId === fileId);
    if (cached) {
      (cached as unknown as Record<string, unknown>).editorData = typeof editorData === 'string' ? JSON.parse(editorData) : editorData;
    }
    return true;
  } catch (error: unknown) {
    console.error(`Failed to update editor data for Drive file ${fileId}:`, (error as Error)?.message);
    return false;
  }
}

/**
 * Direct buffer upload to Google Drive for server-side multipart uploads
 */
export async function uploadBufferToDrive(params: {
  buffer: Buffer;
  name: string;
  mimeType: string;
  folderId?: string;
  folderName?: string;
  isMeeting?: boolean;
}): Promise<{ id: string; webViewLink?: string; thumbnailLink?: string } | null> {
  const drive = await getDriveClient();
  if (!drive) return null;

  try {
    let targetFolder: string | undefined = undefined;
    if (params.folderId && params.folderId !== 'root' && params.folderId !== 'all') {
      if (params.folderId === '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4' || params.folderId === 'MEETING' || params.folderId === '16MjAhpJTW8PCHm1_L-yHQzyQqHpy4SHg' || params.folderId === '1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW') {
        targetFolder = await getMeetingFolderId();
      } else if (params.folderId === 'screen-shares' || params.folderId === 'team-updates') {
        targetFolder = getRootFolderId();
      } else if (params.folderName && params.folderName.trim()) {
        targetFolder = await getOrCreateNamedDriveFolder(params.folderName.trim());
      } else if (params.folderId.startsWith('folder-')) {
        const cleanName = params.folderId.replace(/^folder-/, '');
        targetFolder = await getOrCreateNamedDriveFolder(cleanName);
      } else {
        targetFolder = extractDriveFolderId(params.folderId);
      }
    } else {
      targetFolder = getRootFolderId();
    }

    const rawName = (params.name || `Recording-${Date.now()}`).trim();
    const hasVideoExt = /\.(webm|mp4|mov|mkv)$/i.test(rawName);
    const targetExt = params.mimeType?.includes('mp4') ? '.mp4' : '.webm';
    const finalFileName = hasVideoExt ? rawName : `${rawName}${targetExt}`;

    let cleanMime = (params.mimeType || 'video/webm').split(';')[0].trim();
    if (!cleanMime || !cleanMime.startsWith('video/')) {
      cleanMime = 'video/webm';
    }

    const metadata: { name: string; mimeType: string; parents?: string[] } = {
      name: finalFileName,
      mimeType: cleanMime,
    };
    if (targetFolder) {
      metadata.parents = [targetFolder];
    }

    const { Readable } = await import('stream');
    const stream = Readable.from(params.buffer);

    const res = await drive.files.create({
      requestBody: metadata,
      media: {
        mimeType: cleanMime,
        body: stream,
      },
      fields: 'id, name, webViewLink, thumbnailLink',
      supportsAllDrives: true,
    });

    driveCache.timestamp = 0;

    return {
      id: res.data.id || '',
      webViewLink: res.data.webViewLink || undefined,
      thumbnailLink: res.data.thumbnailLink || undefined,
    };
  } catch (err: unknown) {
    console.error('Failed to upload buffer to Google Drive:', (err as Error)?.message);
    return null;
  }
}

/**
 * Find or create a folder with a given name inside root Drive folder
 */
export async function getOrCreateNamedDriveFolder(folderName: string): Promise<string> {
  const drive = await getDriveClient();
  const rootId = getRootFolderId();
  if (!drive) return rootId || '';

  const cleanName = folderName.trim();
  if (!cleanName || cleanName.toLowerCase() === 'personal library' || cleanName.toLowerCase() === 'root') {
    return rootId;
  }

  try {
    const listRes = await drive.files.list({
      q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 100,
    });

    const match = (listRes.data.files || []).find(
      f => f.name?.toLowerCase().trim() === cleanName.toLowerCase()
    );
    if (match && match.id) {
      return match.id;
    }

    const createdId = await createDriveFolder(cleanName, rootId);
    return createdId || rootId;
  } catch (err) {
    console.warn(`Could not get/create Drive folder "${folderName}":`, err);
    return rootId;
  }
}

/**
 * Move a file in Google Drive to a destination folder (or root folder)
 */
export async function moveDriveFile(fileId: string, targetFolderId?: string, targetFolderName?: string): Promise<boolean> {
  const drive = await getDriveClient();
  if (!drive || !fileId || fileId.startsWith('local:')) return false;

  try {
    const file = await drive.files.get({
      fileId,
      fields: 'id, parents',
      supportsAllDrives: true,
    });

    const rootId = getRootFolderId();
    
    let destinationFolderId = targetFolderId;
    if (!destinationFolderId || destinationFolderId === 'root' || destinationFolderId === 'workspace' || destinationFolderId === 'folder-all' || destinationFolderId === 'all') {
      destinationFolderId = rootId;
    } else if (destinationFolderId === 'screen-shares' || destinationFolderId === 'team-updates') {
      destinationFolderId = rootId;
    } else if (destinationFolderId === 'MEETING' || destinationFolderId === '1xdlBONuoQe9UJscCe-QA5msK4BkEq7J4' || destinationFolderId === '16MjAhpJTW8PCHm1_L-yHQzyQqHpy4SHg' || destinationFolderId === '1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW') {
      destinationFolderId = await getMeetingFolderId();
    } else if (targetFolderName && targetFolderName.trim()) {
      destinationFolderId = await getOrCreateNamedDriveFolder(targetFolderName.trim());
    } else if (destinationFolderId.startsWith('folder-')) {
      const name = destinationFolderId.replace(/^folder-/, '');
      destinationFolderId = await getOrCreateNamedDriveFolder(name);
    } else {
      // Verify if destinationFolderId is already a valid Drive folder
      try {
        const folderCheck = await drive.files.get({
          fileId: destinationFolderId,
          fields: 'id, mimeType',
          supportsAllDrives: true,
        });
        if (folderCheck.data.mimeType !== 'application/vnd.google-apps.folder') {
          destinationFolderId = rootId;
        }
      } catch {
        destinationFolderId = await getOrCreateNamedDriveFolder(destinationFolderId);
      }
    }

    if (!destinationFolderId) {
      destinationFolderId = rootId;
    }

    const prevParentsList = file.data.parents || [];
    
    // If the file is already in this folder, nothing to move
    if (prevParentsList.includes(destinationFolderId)) {
      return true;
    }

    const parentsToRemove = prevParentsList.filter(p => p !== destinationFolderId).join(',');

    const updateParams: drive_v3.Params$Resource$Files$Update = {
      fileId,
      fields: 'id, parents',
      supportsAllDrives: true,
    };

    if (parentsToRemove) {
      updateParams.removeParents = parentsToRemove;
    }
    if (destinationFolderId) {
      updateParams.addParents = destinationFolderId;
    }

    await drive.files.update(updateParams);

    // Invalidate driveCache
    driveCache.timestamp = 0;
    const cached = driveCache.videos.find(v => v.id === fileId || v.driveFileId === fileId);
    if (cached) {
      cached.courseId = destinationFolderId || targetFolderId || '';
    }

    return true;
  } catch (error: unknown) {
    console.error(`Failed to move Google Drive file ${fileId}:`, (error as Error)?.message);
    return false;
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
  const drive = await getDriveClient();
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
  editorData?: unknown;
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
  const drive = await getDriveClient();
  const rootId = getRootFolderId();
  if (!drive) {
    return { videos: driveCache.videos, folders: driveCache.folders, connected: false };
  }

  const now = Date.now();
  if (!forceRefresh && now - driveCache.timestamp < 3000) {
    return { videos: driveCache.videos, folders: driveCache.folders, connected: true };
  }

  try {
    // 1. Fetch all child folders inside GEONIXA LOOM
    const folderRes = await drive.files.list({
      q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const subfolders = folderRes.data.files || [];
    const folders: DriveFolderItem[] = subfolders.map(f => ({
      id: f.id || '',
      name: f.name || 'Untitled Folder',
    }));

    // 2. Fetch all videos in GEONIXA LOOM or any of its subfolders
    const parentFolderIds = [rootId, ...subfolders.map(f => f.id).filter(Boolean)];
    const parentConditions = parentFolderIds.map(id => `'${id}' in parents`).join(' or ');
    const videoQ = `(${parentConditions}) and trashed = false and (mimeType contains 'video/' or name contains '.mp4' or name contains '.webm' or name contains '.mov' or mimeType = 'application/vnd.google-apps.vid' or name contains 'Recording' or name contains 'Screen' or name contains 'Meeting' or mimeType = 'application/octet-stream')`;

    const res = await drive.files.list({
      q: videoQ,
      fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, parents, thumbnailLink, videoMediaMetadata, description)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = res.data.files || [];
    const videos: DriveVideoItem[] = [];

    for (const f of files) {
      // Skip subfolders
      if (f.mimeType === 'application/vnd.google-apps.folder') continue;

      const isVideoMime = Boolean((f.mimeType && f.mimeType.startsWith('video/')) || f.mimeType === 'application/vnd.google-apps.vid');
      const hasVideoExt = Boolean(f.name && /\.(mp4|webm|mov|mkv)$/i.test(f.name));
      const isLikelyRecording = Boolean(
        (f.name && (f.name.toLowerCase().includes('recording') || f.name.toLowerCase().includes('meeting') || f.name.toLowerCase().includes('screen'))) ||
        (f.size && Number(f.size) > 50000)
      );

      if (isVideoMime || hasVideoExt || isLikelyRecording) {
        // Auto-heal file in Google Drive if it lacks extension
        let currentName = f.name || 'Recording';
        if (f.id && !hasVideoExt && isLikelyRecording) {
          const autoFixedName = `${currentName}.webm`;
          drive.files.update({
            fileId: f.id,
            requestBody: { name: autoFixedName },
            supportsAllDrives: true,
          }).catch(err => console.warn('Auto-heal drive filename note:', err?.message));
          currentName = autoFixedName;
          f.name = autoFixedName;
        }

        const duration = f.videoMediaMetadata?.durationMillis
          ? Math.round(Number(f.videoMediaMetadata.durationMillis) / 1000)
          : 0;
        const thumbnailUrl = formatDriveThumbnailUrl(f.thumbnailLink);

        let editorData = null;
        if (f.description) {
          try {
            const parsed = JSON.parse(f.description);
            if (parsed && (parsed.completedCuts || parsed.cuts || parsed.textOverlays || parsed.audio || parsed.savedAt)) {
              editorData = parsed;
            }
          } catch {}
        }

        const effectiveMime = (f.mimeType && f.mimeType.startsWith('video/')) ? f.mimeType : 'video/webm';

        const parentId = (f.parents && f.parents[0]) || '';
        const courseId = (parentId === rootId) ? '' : parentId;

        videos.push({
          id: f.id || '',
          driveFileId: f.id || '',
          title: cleanVideoTitle(currentName, f.createdTime || undefined),
          rawName: currentName,
          ownerName: 'Google Drive User',
          ownerEmail: 'admin@rcrd.com',
          mimeType: effectiveMime,
          size: f.size ? Number(f.size) : 0,
          duration,
          thumbnailUrl,
          thumbnailLink: thumbnailUrl,
          status: 'READY',
          isPublic: true,
          views: 0,
          comments: [],
          courseId,
          createdAt: f.createdTime ? new Date(f.createdTime).getTime() : Date.now(),
          updatedAt: f.createdTime ? new Date(f.createdTime).getTime() : Date.now(),
          webViewLink: f.webViewLink,
          webContentLink: f.webContentLink,
          editorData,
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


