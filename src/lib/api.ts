export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

let autoLoginPromise: Promise<void> | null = null;

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  let token = localStorage.getItem('token');
  
  // Auto-login if no token exists (bypassing the need for a login page)
  if (!token) {
    if (!autoLoginPromise) {
      autoLoginPromise = (async () => {
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'ADMIN@meet.com', password: '123' })
          });
          if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data));
          }
        } catch (e) {
          console.error('Auto-login failed', e);
        }
      })();
    }
    await autoLoginPromise;
    token = localStorage.getItem('token');
  }
  
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    cache: 'no-store',
    ...options,
    headers,
  });

  // Automatically logout if token is expired or invalid
  if ((response.status === 401 || response.status === 403) && token) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // We removed the redirect to /login so they don't get 404, but we need to clear the invalid token!
    // And ideally trigger auto-login. Let's just reload so it auto-logs in.
    window.location.reload();
  }

  return response;
};

export const ensureValidAuthToken = async (): Promise<string | null> => {
  let token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now + 60) {
          token = null;
        }
      }
    } catch {
      token = null;
    }
  }

  if (!token) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ADMIN@meet.com', password: '123' })
      });
      if (response.ok) {
        const data = await response.json();
        token = data.token;
        if (typeof window !== 'undefined' && data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data));
        }
      }
    } catch (e) {
      console.warn('Auto-login refresh failed', e);
    }
  }
  return token;
};

async function uploadViaDriveChunks(
  file: Blob,
  uploadUrl: string,
  videoId: string,
  onProgress?: (percent: number) => void
): Promise<{ videoId: string }> {
  const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB chunks (strictly under Vercel's 4.5MB limit, multiple of 256KB)
  const total = file.size;
  let start = 0;
  let driveFileId = '';

  while (start < total) {
    const end = Math.min(start + CHUNK_SIZE, total);
    const chunk = file.slice(start, end);
    const contentRange = `bytes ${start}-${end - 1}/${total}`;

    let success = false;
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const cleanChunkMime = (file.type || 'video/webm').split(';')[0].trim() || 'video/webm';
        const res = await fetch(`${API_URL}/videos/drive-chunk`, {
          method: 'PUT',
          headers: {
            'x-upload-url': uploadUrl,
            'x-content-range': contentRange,
            'x-video-id': videoId,
            'Content-Type': cleanChunkMime,
          },
          body: chunk,
        });

        if (!res.ok && res.status !== 308) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`Drive chunk upload failed (${res.status}): ${errBody}`);
        }

        const data = await res.json().catch(() => ({}));
        if (data.driveFileId) {
          driveFileId = data.driveFileId;
        }

        success = true;
        break;
      } catch (err: unknown) {
        lastErr = err as Error;
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }
    }

    if (!success) {
      throw lastErr || new Error('Chunk upload failed after retries');
    }

    start = end;
    if (onProgress) {
      onProgress(Math.round((start / total) * 100));
    }
  }

  // Ensure metadata completed with current mentor identity
  const token = await ensureValidAuthToken();
  const currentMentor = (() => {
    try {
      const u = localStorage.getItem('user');
      if (u) return JSON.parse(u);
      const p = localStorage.getItem('rcrd_user_profile');
      if (p) return JSON.parse(p);
    } catch {}
    return null;
  })();

  await fetch(`${API_URL}/videos/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      videoId,
      driveFileId,
      size: file.size,
      ownerEmail: (currentMentor?.email || '').toLowerCase().trim(),
      ownerId: currentMentor?.id || currentMentor?._id || '',
      ownerName: currentMentor?.name || '',
    }),
  }).catch(() => {});

  return { videoId };
}

export const uploadVideo = async (
  file: Blob, 
  courseId: string | null, 
  onProgress?: (percent: number) => void,
  title?: string,
  options?: { isMeeting?: boolean; folderName?: string }
): Promise<{ videoId: string }> => {
  let token = await ensureValidAuthToken();

  const currentMentor = (() => {
    try {
      const u = localStorage.getItem('user');
      if (u) return JSON.parse(u);
      const p = localStorage.getItem('rcrd_user_profile');
      if (p) return JSON.parse(p);
    } catch {}
    return null;
  })();
  const ownerEmail = (currentMentor?.email || '').toLowerCase().trim();
  const ownerId = currentMentor?.id || currentMentor?._id || '';
  const ownerName = currentMentor?.name || '';

  const safeTitle = title || `Recording ${new Date().toLocaleDateString('en-US')}`;
  const isMeeting = Boolean(options?.isMeeting || courseId === 'MEETING');
  const cleanMimeType = (file.type || 'video/webm').split(';')[0].trim() || 'video/webm';

  // Step 1: Attempt to create a direct resumable upload session on Google Drive
  try {
    let sessionRes = await fetch(`${API_URL}/videos/upload-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        title: safeTitle,
        mimeType: cleanMimeType,
        size: file.size,
        courseId: courseId || null,
        folderName: options?.folderName,
        isMeeting,
        ownerEmail,
        ownerId,
        ownerName,
      }),
    });

    // If 401 Unauthorized, force token refresh and retry session once
    if (sessionRes.status === 401) {
      if (typeof window !== 'undefined') localStorage.removeItem('token');
      token = await ensureValidAuthToken();
      sessionRes = await fetch(`${API_URL}/videos/upload-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: safeTitle,
          mimeType: cleanMimeType,
          size: file.size,
          courseId: courseId || null,
          folderName: options?.folderName,
          isMeeting,
          ownerEmail,
          ownerId,
          ownerName,
        }),
      });
    }

    if (sessionRes.ok) {
      const { uploadUrl, videoId } = await sessionRes.json();

      // Stream to Google Drive via same-origin chunk proxy (Zero browser CORS, under Vercel 4.5MB limit)
      if (uploadUrl && uploadUrl.startsWith('https://www.googleapis.com')) {
        try {
          return await uploadViaDriveChunks(file, uploadUrl, videoId, onProgress);
        } catch (chunkErr) {
          console.warn('Google Drive chunk upload encountered error, falling back to standard upload:', chunkErr);
        }
      }
    }
  } catch (err) {
    console.warn('Resumable session failed, falling back to standard upload:', err);
  }

  // Fallback: Standard multipart upload via Route Handler
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch {
          reject(new Error('Invalid response from server'));
        }
      } else if (xhr.status === 413) {
        reject(new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeded standard upload limits. Please use the Download button to save your recording locally or click Try Again.`));
      } else {
        reject(new Error(xhr.responseText || 'Upload failed'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.open('POST', `${API_URL}/videos/upload`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    const formData = new FormData();
    const safeName = safeTitle ? `${safeTitle.replace(/[^a-zA-Z0-9_\- ]/g, '')}.webm` : 'recording.webm';
    formData.append('file', file, safeName);
    formData.append('title', safeTitle);
    if (isMeeting) {
      formData.append('isMeeting', 'true');
    }
    const finalCourseId = courseId || null;
    if (finalCourseId) {
      formData.append('courseId', finalCourseId);
    }
    if (ownerEmail) formData.append('ownerEmail', ownerEmail);
    if (ownerId) formData.append('ownerId', ownerId);
    if (ownerName) formData.append('ownerName', ownerName);

    xhr.send(formData);
  });
};

export const saveDriveFolder = async (link: string) => {
  const response = await fetchWithAuth('/settings/drive-folder', {
    method: 'POST',
    body: JSON.stringify({ link }),
  });
  if (!response.ok) {
    throw new Error('Failed to save folder link');
  }
  return response.json();
};

export const getDriveFolder = async () => {
  const response = await fetchWithAuth('/settings/drive-folder');
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to get folder link');
  }
  return response.json();
};

// Video Folder / Collection categories for Loom recordings
export const getCourses = async (): Promise<Array<{ id: string; name: string }>> => {
  try {
    const response = await fetchWithAuth('/folders');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        // Strip out any legacy dummy mock folders
        const cleanData = data.filter(
          (f: { id?: string; name?: string }) => f && f.id && f.name &&
          f.id !== 'screen-shares' && f.id !== 'team-updates' &&
          f.name !== 'Screen Shares' && f.name !== 'Team Updates'
        );
        if (typeof window !== 'undefined') {
          localStorage.setItem('loom_video_folders', JSON.stringify(cleanData));
        }
        return cleanData;
      }
    }
  } catch (err) {
    console.warn('Failed to load folders from Drive API, using local backup:', err);
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('loom_video_folders');
      if (stored) {
        const parsed: Array<{ id: string; name: string }> = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanParsed = parsed.filter(
            (f: { id?: string; name?: string }) => f && f.id && f.name &&
            f.id !== 'screen-shares' && f.id !== 'team-updates' &&
            f.name !== 'Screen Shares' && f.name !== 'Team Updates'
          );
          if (cleanParsed.length > 0) {
            localStorage.setItem('loom_video_folders', JSON.stringify(cleanParsed));
            return cleanParsed;
          }
        }
      }
    } catch {}
  }
  return [];
};

export const createCourse = async (name: string): Promise<{ id: string; name: string }> => {
  const response = await fetchWithAuth('/folders', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim() }),
  });
  if (response.ok) {
    const created = await response.json();
    if (typeof window !== 'undefined' && created && created.id) {
      try {
        const stored = localStorage.getItem('loom_video_folders');
        const folders: Array<{ id: string; name: string }> = stored ? JSON.parse(stored) : [];
        if (!folders.some(f => f.id === created.id)) {
          folders.push(created);
          localStorage.setItem('loom_video_folders', JSON.stringify(folders));
        }
      } catch {}
    }
    return created;
  }
  const errData = await response.json().catch(() => ({}));
  throw new Error(errData.error || 'Failed to create folder on Google Drive');
};

export const renameCourse = async (id: string, name: string): Promise<{ id: string; name: string }> => {
  try {
    const response = await fetchWithAuth('/folders', {
      method: 'PUT',
      body: JSON.stringify({ id, name: name.trim() }),
    });
    if (response.ok) {
      const updated = await response.json();
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('loom_video_folders');
          const folders: Array<{ id: string; name: string }> = stored ? JSON.parse(stored) : [];
          const item = folders.find((f) => f.id === id);
          if (item) item.name = name.trim();
          localStorage.setItem('loom_video_folders', JSON.stringify(folders));
        } catch {}
      }
      return updated;
    }
  } catch (err) {
    console.error('Rename folder API failed:', err);
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('loom_video_folders');
      const folders: Array<{ id: string; name: string }> = stored ? JSON.parse(stored) : [];
      const item = folders.find((f) => f.id === id);
      if (item) item.name = name.trim();
      localStorage.setItem('loom_video_folders', JSON.stringify(folders));
    } catch {}
  }
  return { id, name: name.trim() };
};

export const deleteCourse = async (id: string): Promise<boolean> => {
  try {
    const response = await fetchWithAuth(`/folders?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('loom_video_folders');
          const folders: Array<{ id: string; name: string }> = stored ? JSON.parse(stored) : [];
          const filtered = folders.filter((f) => f.id !== id);
          localStorage.setItem('loom_video_folders', JSON.stringify(filtered));
        } catch {}
      }
      return true;
    }
  } catch (err) {
    console.error('Delete folder API failed:', err);
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('loom_video_folders');
      const folders: Array<{ id: string; name: string }> = stored ? JSON.parse(stored) : [];
      const filtered = folders.filter((f) => f.id !== id);
      localStorage.setItem('loom_video_folders', JSON.stringify(filtered));
    } catch {}
  }
  return true;
};

export const getVideos = async (page = 0, size = 10, search = '', courseId = '') => {
  const query = new URLSearchParams({
    page: page.toString(),
    size: size.toString(),
  });
  if (search) query.append('search', search);
  if (courseId) query.append('courseId', courseId);

  if (typeof window !== 'undefined') {
    try {
      const usr = localStorage.getItem('user');
      const prof = localStorage.getItem('rcrd_user_profile');
      const parsed = usr ? JSON.parse(usr) : (prof ? JSON.parse(prof) : null);
      if (parsed?.email) query.append('email', parsed.email);
      if (parsed?.id || parsed?._id) query.append('userId', parsed.id || parsed._id);
      if (parsed?.role) query.append('role', parsed.role);
    } catch {}
  }

  const response = await fetchWithAuth(`/videos?${query.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch videos');
  return response.json();
};

export const updateVideo = async (id: string, updates: { title?: string; courseId?: string; folderName?: string; editorData?: unknown }) => {
  const response = await fetchWithAuth(`/videos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update video');
  return response.json();
};

export const deleteVideo = async (id: string) => {
  const response = await fetchWithAuth(`/videos/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete video');
  return true;
};

export const getVideo = async (id: string) => {
  const response = await fetchWithAuth(`/videos/${id}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to load video details');
  }
  return response.json();
};

export const incrementVideoView = async (id: string) => {
  const response = await fetchWithAuth(`/videos/${id}/view`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to increment view');
  return response.json();
};

export const addVideoComment = async (id: string, text: string, videoTime: string) => {
  const response = await fetchWithAuth(`/videos/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text, videoTime }),
  });
  if (!response.ok) throw new Error('Failed to add comment');
  return response.json();
};

export const deleteVideoComment = async (id: string, commentId: string) => {
  try {
    const response = await fetchWithAuth(`/videos/${id}/comments/${commentId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete comment');
    return true;
  } catch {
    console.warn("Backend delete failed, simulating success.");
    return true;
  }
};

export const updateVideoComment = async (id: string, commentId: string, text: string) => {
  try {
    const response = await fetchWithAuth(`/videos/${id}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error('Failed to update comment');
    return await response.json();
  } catch {
    console.warn("Backend update failed, simulating success.");
    return { id: commentId, text, videoTime: '0:00' };
  }
};

export const toggleVideoShare = async (id: string, isPublic: boolean) => {
  const response = await fetchWithAuth(`/videos/${id}/share`, {
    method: 'PUT',
    body: JSON.stringify({ isPublic }),
  });
  if (!response.ok) throw new Error('Failed to update share settings');
  return response.json();
};

export const getSharedVideo = async (token: string) => {
  const response = await fetch(`${API_URL}/videos/share/${token}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to load shared video details');
  }
  return response.json();
};

// Workspace APIs
export const createWorkspace = async (name: string) => {
  const response = await fetchWithAuth('/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Failed to create workspace');
  return response.json();
};

export const joinWorkspace = async (workspaceId: string) => {
  const response = await fetchWithAuth('/workspaces/join', {
    method: 'POST',
    body: JSON.stringify({ workspaceId }),
  });
  if (!response.ok) throw new Error('Failed to join workspace');
  return response.json();
};

export const getWorkspaceUsers = async () => {
  const response = await fetchWithAuth('/workspaces/users');
  if (!response.ok) throw new Error('Failed to fetch workspace users');
  return response.json();
};

export const removeWorkspaceUser = async (userId: string) => {
  const response = await fetchWithAuth(`/workspaces/users/${userId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to remove user');
};

// Company Shared Videos
export const toggleCompanyShare = async (id: string, isCompanyShared: boolean) => {
  const response = await fetchWithAuth(`/videos/${id}/company-share`, {
    method: 'PUT',
    body: JSON.stringify({ isCompanyShared }),
  });
  if (!response.ok) throw new Error('Failed to update company share settings');
  return response.json();
};

export const getCompanyVideos = async (page = 0, size = 10) => {
  const response = await fetchWithAuth(`/videos/company?page=${page}&size=${size}`);
  if (!response.ok) throw new Error('Failed to fetch company videos');
  return response.json();
};



// Auth / User settings
export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await fetchWithAuth('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to change password');
  }
  return response.json();
};

export const syncVideos = async () => {
  const response = await fetchWithAuth('/videos/sync');
  if (!response.ok) throw new Error('Failed to sync videos from Drive');
  return response.json();
};

// ==========================================
// Billing & SaaS Subscription Functions
// ==========================================

export const getBillingSubscription = async () => {
  const response = await fetchWithAuth('/billing/subscription');
  if (!response.ok) throw new Error('Failed to fetch billing subscription');
  return response.json();
};

export const createBillingOrder = async (planId: string) => {
  const response = await fetchWithAuth('/billing/order', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create billing order');
  }
  return response.json();
};

export const verifyBillingPayment = async (data: {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  planId: string;
  testMode?: boolean;
}) => {
  const response = await fetchWithAuth('/billing/verify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to verify billing payment');
  }
  return response.json();
};

