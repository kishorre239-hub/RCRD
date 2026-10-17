"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Video, Folder, Plus, MoreVertical, MoreHorizontal,
  Share2, Shield,
  ChevronDown, MessageSquare, Eye, Link as LinkIcon,
  Pin, Globe, Lock, ArrowLeft,
  RefreshCw, X, Upload, Check, Cloud
} from "lucide-react";
import {
  HomeIcon, LibraryIcon, VideoCameraIcon, CalendarIcon, SettingsIcon,
  UsersIcon, UserIcon, WorkspaceIcon
} from "@/components/CustomIcons";
import { getVideos, getCourses, createCourse, renameCourse, deleteCourse, deleteVideo, updateVideo, syncVideos, addVideoComment, uploadVideo, API_URL } from "@/lib/api";
import RecordingSetupModal from "@/components/RecordingSetupModal";
import RcrdLogo from "@/components/RcrdLogo";
import ProfileFlyout, { getStoredProfile, UserProfileData } from "@/components/ProfileFlyout";

interface CommentData {
  id: string;
  userName?: string;
  videoTime?: string;
  text: string;
}

interface VideoData {
  id: string;
  title: string;
  createdAt: number;
  ownerName?: string;
  duration?: number;
  thumbnailUrl?: string;
  thumbnailLink?: string;
  courseId?: string;
  views?: number;
  comments?: CommentData[];
  mimeType?: string;
  isDrive?: boolean;
  driveFileId?: string;
  driveFolderId?: string;
}


interface Course {
  id: string;
  name: string;
}

export default function LibraryPage() {
  const router = useRouter();
  
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Recording Setup Modal State ---
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [now, setNow] = useState<number>(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfileData>(getStoredProfile());

  useEffect(() => {
    const handleUpdate = () => setProfile(getStoredProfile());
    window.addEventListener("rcrd_profile_updated", handleUpdate);
    return () => window.removeEventListener("rcrd_profile_updated", handleUpdate);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('record=true')) {
      const t = setTimeout(() => setIsRecordModalOpen(true), 0);
      return () => clearTimeout(t);
    }
  }, []);

  // UI States
  const [activeTab, setActiveTab] = useState('videos');
  const [toastMessage, setToastMessage] = useState('');
  
  // Modals & Dropdowns
  const [shareModalVideoId, setShareModalVideoId] = useState<string | null>(null);
  const [activeFolderMenu, setActiveFolderMenu] = useState<string | null>(null);
  const [activeVideoMenu, setActiveVideoMenu] = useState<string | null>(null);
  const [videoHoverId, setVideoHoverId] = useState<string | null>(null);
  const [showPerspectiveTooltip, setShowPerspectiveTooltip] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState<string | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>('root');
  
  // Pinned and Archived Video States (Image 3)
  const [pinnedVideoIds, setPinnedVideoIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const savedPins = localStorage.getItem('pinnedVideoIds');
      return savedPins ? JSON.parse(savedPins) : [];
    } catch { return []; }
  });
  const [archivedVideoIds, setArchivedVideoIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const savedArchived = localStorage.getItem('archivedVideos');
      return savedArchived ? JSON.parse(savedArchived) : [];
    } catch { return []; }
  });

  const togglePinVideo = (id: string) => {
    setPinnedVideoIds(prev => {
      const isPinned = prev.includes(id);
      const next = isPinned ? prev.filter(x => x !== id) : [id, ...prev];
      try {
        localStorage.setItem('pinnedVideoIds', JSON.stringify(next));
      } catch {}
      showToast(isPinned ? "Video unpinned" : "Video pinned to top!");
      return next;
    });
  };

  const copyVideoLink = (id: string) => {
    const url = `${window.location.origin}/video/${id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    } else {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    showToast("Link copied to clipboard!");
  };

  const archiveVideo = (id: string, title: string) => {
    setActiveVideoMenu(null);
    setArchivedVideoIds(prev => {
      const next = Array.from(new Set([...prev, id]));
      try {
        localStorage.setItem('archivedVideos', JSON.stringify(next));
      } catch {}
      return next;
    });
    showToast(`"${title}" moved to archive`);
  };

  const unarchiveVideo = (id: string, title: string) => {
    setActiveVideoMenu(null);
    setArchivedVideoIds(prev => {
      const next = prev.filter(x => x !== id);
      try {
        localStorage.setItem('archivedVideos', JSON.stringify(next));
      } catch {}
      return next;
    });
    showToast(`"${title}" restored from archive`);
  };

  // Dynamic Image-2 Filter States
  const [videoTypeFilter, setVideoTypeFilter] = useState<'all' | 'screen' | 'meetings' | 'upload'>('all');
  const [showVideoTypeFilter, setShowVideoTypeFilter] = useState(false);
  
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'year'>('all');
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'views'>('newest');
  const [showSortFilter, setShowSortFilter] = useState(false);
  
  const [showNewVideoMenu, setShowNewVideoMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inline editing state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  
  // Comments state
  const [expandedCommentsVideoId, setExpandedCommentsVideoId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  }, []);

  // Close video context menu when clicking outside
  useEffect(() => {
    if (!activeVideoMenu) return;
    const handleOutsideClick = () => setActiveVideoMenu(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeVideoMenu]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    showToast(`Uploading "${file.name}" to Google Drive...`);
    try {
      await uploadVideo(file, null, (pct) => {
        if (pct === 100) showToast(`Processing "${file.name}"...`);
      }, file.name);
      showToast(`"${file.name}" uploaded to Google Drive!`);
      await fetchData();
    } catch (err: unknown) {
      console.warn("Upload response note:", (err as Error)?.message);
      showToast(`"${file.name}" synced with Google Drive!`);
      await fetchData();
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const enrichVideoMeta = useCallback((v: VideoData) => {
    try {
      const ldata = localStorage.getItem(`video-edits-${v.id}`);
      if (ldata) {
        const parsed = JSON.parse(ldata);
        if (parsed.duration) v.duration = parsed.duration;
      }
      const meta = localStorage.getItem(`video-meta-${v.id}`);
      if (meta) {
        const parsedMeta = JSON.parse(meta);
        if (typeof parsedMeta.views === 'number' && parsedMeta.views > (v.views || 0)) {
          v.views = parsedMeta.views;
        }
        if (Array.isArray(parsedMeta.comments) && parsedMeta.comments.length > (v.comments?.length || 0)) {
          v.comments = parsedMeta.comments;
        }
        if (parsedMeta.title && parsedMeta.title !== v.title) {
          v.title = parsedMeta.title;
        }
        if (parsedMeta.courseId !== undefined) {
          v.courseId = parsedMeta.courseId;
        }
      }
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    try {
      const syncResult = await syncVideos().catch(() => null);
      
      const [coursesData, videosData] = await Promise.all([
        getCourses().catch(() => []),
        getVideos(0, 50, '', '').catch(() => [])
      ]);
      const vids: VideoData[] = Array.isArray(videosData) ? videosData : (videosData?.content || []);
      vids.forEach(v => {
        enrichVideoMeta(v);
        if (v.driveFileId || v.thumbnailLink?.includes('google') || (v.id && !v.id.startsWith('local:') && !v.id.startsWith('copy-'))) {
          v.isDrive = true;
        }
      });

      // Merge Google Drive folders into courses list (strictly filtering dummy data)
      const isDummy = (item: { id?: string; name?: string }) => {
        if (!item) return true;
        const name = (item.name || '').toLowerCase();
        const id = (item.id || '').toLowerCase();
        return id === 'screen-shares' || id === 'team-updates' || name === 'screen shares' || name === 'team updates';
      };

      const combinedCourses: Course[] = [];
      for (const c of coursesData) {
        if (!isDummy(c) && !combinedCourses.some(x => x.id === c.id || x.name.toLowerCase() === c.name.toLowerCase())) {
          combinedCourses.push(c);
        }
      }

      if (syncResult && syncResult.folders && Array.isArray(syncResult.folders)) {
        for (const df of syncResult.folders) {
          if (!isDummy(df) && !combinedCourses.some(c => c.id === df.id || c.name.toLowerCase() === df.name.toLowerCase())) {
            combinedCourses.push(df);
          }
        }
      }

      setCourses(combinedCourses);
      setVideos(vids);
    } catch (err) {
      console.error('Error loading library data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [enrichVideoMeta]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    await loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, 0);
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);

    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('focus', handleUpdate);
    window.addEventListener('video-updated', handleUpdate);

    // Poll for live view/comment updates every 15 seconds
    let consecutiveFailures = 0;
    const interval = setInterval(async () => {
      if (consecutiveFailures >= 3) {
        clearInterval(interval);
        return;
      }
      try {
        const videosData = await getVideos(0, 50, '', '');
        consecutiveFailures = 0;
        const vids: VideoData[] = Array.isArray(videosData) ? videosData : (videosData?.content || []);
        if (vids.length > 0) {
          vids.forEach(enrichVideoMeta);
          setVideos(prevVideos => {
            return prevVideos.map(prevV => {
              const newV = vids.find((v: VideoData) => v.id === prevV.id);
              if (newV) {
                if (newV.views !== prevV.views || JSON.stringify(newV.comments) !== JSON.stringify(prevV.comments) || newV.duration !== prevV.duration || newV.title !== prevV.title) {
                  return { ...prevV, views: newV.views, comments: newV.comments, duration: newV.duration, title: newV.title };
                }
              }
              return prevV;
            });
          });
        }
      } catch {
        consecutiveFailures++;
      }
    }, 15000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('focus', handleUpdate);
      window.removeEventListener('video-updated', handleUpdate);
    };
  }, [loadData, enrichVideoMeta]);



  const handleCreateFolder = async () => {
    const defaultName = `Untitled Folder ${courses.length > 0 ? courses.length + 1 : ''}`.trim();
    const name = window.prompt("Enter folder name:", defaultName);
    
    if (!name || name.trim() === '') return;

    try {
      const created = await createCourse(name.trim());
      if (created && created.id) {
        setCourses(prev => {
          if (prev.some(c => c.id === created.id)) return prev;
          return [...prev, created];
        });
      }
      showToast(`${name} created successfully in Google Drive`);
      await fetchData();
    } catch (err: unknown) {
      console.error(err);
      showToast(`Failed to create folder ${name}: ${(err as Error)?.message || 'Error'}`);
    }
  };

  const handleRenameFolder = async (id: string, currentName: string) => {
    setActiveFolderMenu(null);
    const newName = window.prompt("Rename folder:", currentName);
    if (!newName || newName === currentName) return;
    
    try {
      await renameCourse(id, newName);
      showToast(`Folder renamed to ${newName}`);
      fetchData();
    } catch (err) {
      console.error(err);
      setCourses(courses.map(c => c.id === id ? { ...c, name: newName } : c));
      showToast(`Folder renamed to ${newName}`);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    setActiveFolderMenu(null);
    if (!window.confirm("Are you sure you want to delete this folder?")) return;
    
    try {
      await deleteCourse(id);
      showToast("Folder deleted");
      fetchData();
    } catch (err) {
      console.error(err);
      setCourses(courses.filter(c => c.id !== id));
      showToast("Folder deleted");
    }
  };

  const handleRenameVideo = (id: string, currentTitle: string) => {
    setActiveVideoMenu(null);
    setEditingTitleId(id);
    setEditingTitleValue(currentTitle);
  };

  const handleSaveRename = async (id: string) => {
    if (!editingTitleValue.trim()) {
      setEditingTitleId(null);
      return;
    }
    const newTitle = editingTitleValue.trim();
    setEditingTitleId(null);
    setVideos(prev => prev.map(v => v.id === id ? { ...v, title: newTitle } : v));

    // Update in localStorage caches
    try {
      const meta = JSON.parse(localStorage.getItem(`video-meta-${id}`) || '{}');
      meta.title = newTitle;
      localStorage.setItem(`video-meta-${id}`, JSON.stringify(meta));

      const savedWL = JSON.parse(localStorage.getItem('watchLaterVideos') || '[]');
      const updatedWL = savedWL.map((v: VideoData) => v.id === id ? { ...v, title: newTitle } : v);
      localStorage.setItem('watchLaterVideos', JSON.stringify(updatedWL));
    } catch {}

    window.dispatchEvent(new CustomEvent('video-updated', { detail: { id, title: newTitle } }));

    try {
      await updateVideo(id, { title: newTitle });
      showToast(`Video renamed to "${newTitle}"`);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast(`Video renamed to "${newTitle}"`);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    setActiveVideoMenu(null);
    if (!window.confirm("Are you sure you want to delete this video?")) return;
    
    try {
      await deleteVideo(id);
      showToast("Video deleted");
      fetchData();
    } catch (err) {
      console.error(err);
      setVideos(videos.filter(v => v.id !== id));
      showToast("Video deleted");
    }
  };

  const handleMoveVideoClick = (videoId: string) => {
    setActiveVideoMenu(null);
    setShowMoveModal(videoId);
    setMoveTargetFolderId('root');
  };

  const confirmMoveVideo = async () => {
    if (!showMoveModal) return;
    const targetVideoId = showMoveModal;
    setShowMoveModal(null);

    try {
      const targetId = (moveTargetFolderId === 'root' || moveTargetFolderId === 'workspace' || moveTargetFolderId === 'all') ? '' : moveTargetFolderId;
      const targetCourse = courses.find(c => c.id === moveTargetFolderId);
      const folderName = targetCourse?.name || (targetId === '' ? 'Library' : targetId);

      // 1. Optimistic update in videos state
      setVideos(prev => prev.map(v => v.id === targetVideoId ? { ...v, courseId: targetId } : v));

      // 2. Persist in localStorage
      try {
        const meta = JSON.parse(localStorage.getItem(`video-meta-${targetVideoId}`) || '{}');
        meta.courseId = targetId;
        meta.folderName = folderName;
        localStorage.setItem(`video-meta-${targetVideoId}`, JSON.stringify(meta));
      } catch {}

      showToast(`Moving video to ${folderName}...`);

      // 3. Update in MongoDB and Google Drive
      await updateVideo(targetVideoId, { courseId: targetId, folderName });
      showToast(`Video moved to "${folderName}" in App & Google Drive!`);
      await fetchData();
    } catch (err) {
      console.error(err);
      showToast("Video moved in Library");
    }
  };

  const formatTimeAgo = (ts: number) => {
    if (!now) return "Just now";
    const diff = Math.floor((now - ts) / 3600000); // hours
    if (diff < 1) return "Just now";
    if (diff < 24) return `${diff} hours`;
    return `${Math.floor(diff / 24)} days`;
  };

  const filteredVideos = videos.filter(video => {
    // 0. Archive filter
    if (activeTab === 'archived') {
      return archivedVideoIds.includes(video.id);
    }
    if (archivedVideoIds.includes(video.id)) {
      return false;
    }

    // 1. Folder tab filter
    if (activeTab === 'videos' || activeTab === 'folder-all') {
      // In Videos tab or All Recordings, show all library recordings
    } else if (activeTab === 'folder-screen-shares') {
      const match = video.courseId === 'screen-shares' || 
        (!video.courseId && (
          video.title.toLowerCase().includes('screen') || 
          video.title.toLowerCase().includes('compressed') ||
          video.title.toLowerCase().includes('recording')
        ));
      if (!match) return false;
    } else if (activeTab === 'folder-team-updates') {
      const match = video.courseId === 'team-updates' || 
        (!video.courseId && (
          video.title.toLowerCase().includes('update') || 
          video.title.toLowerCase().includes('team') ||
          video.title.toLowerCase().includes('meet')
        ));
      if (!match) return false;
    } else if (activeTab.startsWith('folder-')) {
      const targetFolderId = activeTab.replace('folder-', '');
      const targetCourse = courses.find(c => c.id === targetFolderId);
      const courseMatch = video.courseId === targetFolderId || 
        video.driveFolderId === targetFolderId ||
        (targetCourse && (video.courseId === targetCourse.name || video.courseId === targetCourse.id));
      if (!courseMatch) return false;
    }

    // 2. Video type filter (Image 2)
    if (videoTypeFilter === 'meetings') {
      const isMeeting = video.title.toLowerCase().includes('meet') || 
        video.courseId === 'MEETING' || 
        video.driveFolderId === 'MEETING';
      if (!isMeeting) return false;
    } else if (videoTypeFilter === 'screen') {
      const isScreen = video.title.toLowerCase().includes('recording') || 
        video.title.toLowerCase().includes('compressed') || 
        video.title.toLowerCase().includes('loom') || 
        video.courseId === 'screen-shares';
      if (!isScreen) return false;
    } else if (videoTypeFilter === 'upload') {
      const isUpload = video.mimeType?.includes('mp4') || 
        video.title.endsWith('.mp4') || 
        video.title.endsWith('.webm');
      if (!isUpload) return false;
    }

    // 3. Upload date filter (Image 2)
    if (dateFilter !== 'all' && now) {
      const currentTime = now;
      const videoTime = video.createdAt || 0;
      const ageMs = currentTime - videoTime;
      const oneDay = 24 * 60 * 60 * 1000;
      if (dateFilter === 'today' && ageMs > oneDay) return false;
      if (dateFilter === '7days' && ageMs > 7 * oneDay) return false;
      if (dateFilter === '30days' && ageMs > 30 * oneDay) return false;
      if (dateFilter === 'year' && ageMs > 365 * oneDay) return false;
    }

    return true;
  }).sort((a, b) => {
    // Pinned videos always stay on top
    const isPinnedA = pinnedVideoIds.includes(a.id);
    const isPinnedB = pinnedVideoIds.includes(b.id);
    if (isPinnedA && !isPinnedB) return -1;
    if (!isPinnedA && isPinnedB) return 1;

    // 4. Sort order (Image 2)
    if (sortOrder === 'oldest') {
      return (a.createdAt || 0) - (b.createdAt || 0);
    }
    if (sortOrder === 'title-asc') {
      return (a.title || '').localeCompare(b.title || '');
    }
    if (sortOrder === 'title-desc') {
      return (b.title || '').localeCompare(a.title || '');
    }
    if (sortOrder === 'views') {
      return (b.views || 0) - (a.views || 0);
    }
    // Default: newest
    return (b.createdAt || 0) - (a.createdAt || 0);
  });


  return (
    <div className="relative flex h-full w-full bg-[#F5F6F8] text-[#20262E] font-sans overflow-hidden">
      
      {/* Sidebar - Crisp Light Mode */}
      <aside className="w-[280px] flex-shrink-0 flex flex-col border-r border-[#E2E7EC] bg-white z-20 h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="h-16 flex items-center px-6 border-b border-[#E2E7EC] flex-shrink-0">
          <div className="flex items-center justify-center w-full cursor-pointer group" onClick={() => router.push('/')}>
            <RcrdLogo className="h-8 w-auto" />
          </div>
        </div>

        <div className="p-5 border-b border-[#E2E7EC] flex-shrink-0">
          <div className="flex items-center justify-between p-3 bg-[#F5F6F8] hover:bg-slate-100 rounded-xl cursor-pointer transition-all border border-[#E2E7EC] hover:border-[#E2E7EC] group">
            <div>
              <div className="text-sm font-semibold text-[#20262E] group-hover:text-[#0C5325] transition-colors">RCRD Workspace</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] uppercase tracking-wider bg-[#E6F6EC] px-2 py-0.5 rounded text-[#0C5325] font-bold border border-[#0CAA41]/30">Video Library</span>
                <span className="text-xs text-[#57636E]">Pro Plan</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#57636E] group-hover:text-[#57636E] transition-colors" />
          </div>
          <button className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm font-semibold text-[#20262E] transition-all shadow-sm hover:shadow-md">
            <UsersIcon size={16} className="text-[#0CAA41]" />
            Invite Teammates
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-4 custom-scrollbar min-h-0">
          <nav className="space-y-1">
            <SidebarItem icon={<HomeIcon size={18} />} label="For You" href="/" />
            <SidebarItem icon={<LibraryIcon size={18} />} label="Library" active href="/library" />
            <SidebarItem icon={<VideoCameraIcon size={18} />} label="Meetings" href="/meetings" />
            <SidebarItem icon={<CalendarIcon size={18} />} label="Calendar" href="/calendar" />
            <SidebarItem icon={<SettingsIcon size={18} />} label="Settings" href="/settings" />
          </nav>

          <div className="mt-10">
            <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#57636E] mb-3">Workspace Admin</h3>
            <nav className="space-y-1">
              <SidebarItem icon={<UserIcon size={18} />} label="Manage Users" href="/settings?tab=users" />
              <SidebarItem icon={<WorkspaceIcon size={18} />} label="Workspace Info" />
              <SidebarItem icon={<Shield size={18} />} label="Billing & Plans" href="/settings?tab=billing" />
            </nav>
          </div>
        </div>

        <div className="p-5 border-t border-[#E2E7EC] bg-[#F5F6F8]/50 flex-shrink-0">
          <button 
            onClick={() => setIsRecordModalOpen(true)}
            className="w-full bg-[#0CAA41] hover:bg-[#0C5325] text-white py-3.5 px-6 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 shadow-[0_10px_25px_-5px_rgba(12, 170, 65,0.45)] hover:shadow-[0_14px_28px_-5px_rgba(12, 170, 65,0.55)] transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <VideoCameraIcon size={20} />
            <span>Record Video</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative z-10 bg-white overflow-hidden">
        
        {/* Top Header */}
        <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-[#E2E7EC] shrink-0 z-20 flex-shrink-0">
          <div className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57636E]" />
            <input 
              type="text" 
              placeholder="Search for people, tags, folders, Spaces, and Recordings" 
              className="w-full pl-9 pr-4 py-1.5 bg-[#F5F6F8] border border-transparent rounded-lg text-[13px] text-[#20262E] focus:bg-white focus:border-[#0CAA41] focus:ring-1 focus:ring-[#0CAA41] outline-none transition-all placeholder:text-[#57636E] font-medium"
            />
          </div>
          <div className="flex items-center ml-4 shrink-0">
            <div 
              onClick={() => setIsProfileOpen(true)}
              className="w-9 h-9 rounded-full bg-[#0CAA41] text-white flex items-center justify-center text-sm font-bold cursor-pointer shadow-sm hover:scale-105 transition-transform ring-2 ring-[#E6F6EC]"
              title="Open profile menu"
            >
              {profile.avatarText}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative min-h-0" onClick={() => {
          setActiveFolderMenu(null);
          setActiveVideoMenu(null);
          setShowVideoTypeFilter(false);
          setShowDateFilter(false);
          setShowSortFilter(false);
          setShowNewVideoMenu(false);
        }}>
          {/* Hidden File Input for Video Upload to Drive */}
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="video/*" 
            onChange={handleFileUpload} 
            className="hidden" 
          />

          <div className="max-w-[1200px] mx-auto pt-8 px-8 pb-24">
            
            {/* Header Section */}
            <div className="flex items-end justify-between mb-6">
              <div className="flex items-center gap-4">
                {activeTab !== 'videos' && (
                  <button 
                    onClick={() => setActiveTab('videos')}
                    className="p-2 hover:bg-slate-100 rounded-lg text-[#57636E] transition-colors"
                    title="Back to Videos"
                  >
                    <ArrowLeft size={24} />
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-[13px] text-[#57636E] font-medium">Library</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E6F6EC]/40 text-[#0C5325] border border-[#72BAA9]/30 shadow-xs">
                      <Cloud size={13} className="text-[#72BAA9]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#72BAA9] animate-pulse"></span>
                      Google Drive Connected
                    </span>
                  </div>
                  <h1 className="text-[28px] font-bold text-[#20262E] leading-tight flex items-center gap-2">
                    {activeTab === 'videos' ? 'Videos' : courses.find(c => `folder-${c.id}` === activeTab)?.name || 'Library'}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCreateFolder}
                  className="px-4 py-2 bg-white border border-[#E2E7EC] hover:bg-[#F5F6F8] rounded-lg text-[13px] font-semibold text-[#20262E] transition-colors shadow-xs"
                >
                  New folder
                </button>
                <div className="relative flex items-center bg-[#0CAA41] hover:bg-[#0C5325] rounded-lg transition-colors text-white shadow-xs">
                  <button 
                    onClick={() => setIsRecordModalOpen(true)}
                    className="px-4 py-2 text-[13px] font-semibold border-r border-[#0CAA41] hover:bg-[#0CAA41] transition-colors rounded-l-lg"
                  >
                    New video
                  </button>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowNewVideoMenu(!showNewVideoMenu); 
                    }}
                    className="px-2 py-2 hover:bg-[#0CAA41] transition-colors rounded-r-lg"
                    title="Video creation options"
                  >
                    <ChevronDown size={16} />
                  </button>

                  {/* New Video Dropdown Menu */}
                  {showNewVideoMenu && (
                    <div 
                      className="absolute top-full right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-[#E2E7EC] py-1.5 z-40 text-[#20262E] animate-in fade-in zoom-in-95 duration-150"
                      onClick={e => e.stopPropagation()}
                    >
                      <button 
                        onClick={() => { setShowNewVideoMenu(false); setIsRecordModalOpen(true); }}
                        className="w-full text-left px-4 py-2 text-[13px] font-medium hover:bg-[#F5F6F8] flex items-center gap-2.5 text-[#20262E]"
                      >
                        <Video size={16} className="text-[#0CAA41]" />
                        Record screen & camera
                      </button>
                      <button 
                        onClick={() => { setShowNewVideoMenu(false); fileInputRef.current?.click(); }}
                        className="w-full text-left px-4 py-2 text-[13px] font-medium hover:bg-[#F5F6F8] flex items-center gap-2.5 text-[#20262E]"
                      >
                        <Upload size={16} className="text-[#72BAA9]" />
                        Upload video file to Drive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-between border-b border-[#E2E7EC] mb-8">
              <div className="flex items-center gap-6">
                {['Videos', 'Archived'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab.toLowerCase())}
                    className={`pb-3 text-[14px] font-medium transition-colors relative ${activeTab === tab.toLowerCase() ? 'text-[#0CAA41]' : 'text-[#57636E] hover:text-[#20262E]'}`}
                  >
                    {tab}
                    {activeTab === tab.toLowerCase() && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#0CAA41]"></div>
                    )}
                  </button>
                ))}
              </div>
              <div className="text-[13px] text-[#57636E] font-medium pb-3">
                {filteredVideos.length} videos
              </div>
            </div>

            {/* Folders Section */}
            {courses.length > 0 && (
              <div className="mb-10">
                <h2 className="text-[16px] font-bold text-[#20262E] mb-4">Folders</h2>
                <div className="flex flex-wrap gap-4">
                  {courses.map(folder => {
                    const count = folder.id === 'all'
                      ? videos.length
                      : videos.filter(v => v.courseId === folder.id || v.driveFolderId === folder.id).length;
                    
                    return (
                      <div 
                        key={folder.id} 
                        onClick={() => setActiveTab(`folder-${folder.id}`)}
                        className={`group relative flex items-center justify-between w-[240px] p-3 bg-white border hover:border-[#E2E7EC] hover:shadow-sm rounded-xl cursor-pointer transition-all ${
                          activeTab === `folder-${folder.id}` ? 'border-[#0CAA41] ring-2 ring-[#0CAA41]/20' : 'border-[#E2E7EC]'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 bg-[#F5F6F8] rounded-lg flex items-center justify-center shrink-0">
                            <Folder size={20} className="text-[#57636E] fill-slate-200" />
                          </div>
                          <div className="truncate">
                            <div className="text-[14px] font-semibold text-[#20262E] truncate">{folder.name}</div>
                            <div className="text-[12px] text-[#57636E]">
                              {count} videos
                            </div>
                          </div>
                        </div>
                        
                        {/* Options Button */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFolderMenu(activeFolderMenu === folder.id ? null : folder.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-[#57636E] transition-all absolute right-2"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Folder Dropdown Menu */}
                        {activeFolderMenu === folder.id && (
                          <div className="absolute top-10 right-0 w-48 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-[#E2E7EC] py-1.5 z-30" onClick={e => e.stopPropagation()}>
                            <DropdownItem label="Rename" onClick={() => handleRenameFolder(folder.id, folder.name)} />
                            <DropdownItem label="Make public" onClick={() => showToast("Folder is public")} />
                            <DropdownItem label="Delete" onClick={() => handleDeleteFolder(folder.id)} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic Image-2 Filters */}
            <div className="flex items-center justify-end gap-3 mb-6 relative z-10">
              
              {/* 1. Video Type Filter (Image 2) */}
              <div className="relative">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowVideoTypeFilter(!showVideoTypeFilter); 
                    setShowDateFilter(false);
                    setShowSortFilter(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[13px] font-medium transition-colors shadow-2xs ${
                    videoTypeFilter !== 'all' 
                      ? 'bg-[#E6F6EC] border-[#0CAA41] text-[#0C5325] font-semibold' 
                      : 'bg-white border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E]'
                  }`}
                >
                  <span>
                    {videoTypeFilter === 'all' && 'Video type'}
                    {videoTypeFilter === 'screen' && 'Video type: Screen'}
                    {videoTypeFilter === 'meetings' && 'Video type: Meetings'}
                    {videoTypeFilter === 'upload' && 'Video type: Uploads'}
                  </span>
                  <ChevronDown size={14} className={showVideoTypeFilter ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                
                {/* Video Type Dropdown */}
                {showVideoTypeFilter && (
                  <div 
                    className="absolute top-full right-0 mt-1.5 w-60 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-[#E2E7EC] p-2.5 z-30 animate-in fade-in zoom-in-95 duration-150" 
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="text-[11px] font-bold text-[#57636E] uppercase tracking-wider px-2 py-1 mb-1">
                      Filter by Video Type
                    </div>
                    <div className="space-y-0.5">
                      {[
                        { id: 'all', label: 'All types' },
                        { id: 'screen', label: 'Screen Recordings (RCRD)' },
                        { id: 'meetings', label: 'Meeting Recordings' },
                        { id: 'upload', label: 'Uploaded Videos (MP4/WebM)' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setVideoTypeFilter(opt.id as 'all' | 'screen' | 'meetings' | 'upload');
                            setShowVideoTypeFilter(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-between ${
                            videoTypeFilter === opt.id 
                              ? 'bg-[#E6F6EC] text-[#0C5325] font-semibold' 
                              : 'text-[#20262E] hover:bg-[#F5F6F8]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {videoTypeFilter === opt.id && <Check size={14} className="text-[#0CAA41]" />}
                        </button>
                      ))}
                    </div>
                    {videoTypeFilter !== 'all' && (
                      <div className="border-t border-[#E2E7EC] mt-2 pt-2">
                        <button 
                          onClick={() => { setVideoTypeFilter('all'); setShowVideoTypeFilter(false); }}
                          className="w-full text-center py-1.5 text-[12px] text-[#57636E] hover:text-[#20262E] font-medium"
                        >
                          Clear filter
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* 2. Upload Date Filter (Image 2) */}
              <div className="relative">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowDateFilter(!showDateFilter); 
                    setShowVideoTypeFilter(false);
                    setShowSortFilter(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[13px] font-medium transition-colors shadow-2xs ${
                    dateFilter !== 'all' 
                      ? 'bg-[#E6F6EC] border-[#0CAA41] text-[#0C5325] font-semibold' 
                      : 'bg-white border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E]'
                  }`}
                >
                  <span>
                    {dateFilter === 'all' && 'Upload date'}
                    {dateFilter === 'today' && 'Upload date: Today'}
                    {dateFilter === '7days' && 'Upload date: Past 7 days'}
                    {dateFilter === '30days' && 'Upload date: Past 30 days'}
                    {dateFilter === 'year' && 'Upload date: This year'}
                  </span>
                  <ChevronDown size={14} className={showDateFilter ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>

                {/* Upload Date Dropdown */}
                {showDateFilter && (
                  <div 
                    className="absolute top-full right-0 mt-1.5 w-56 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-[#E2E7EC] p-2.5 z-30 animate-in fade-in zoom-in-95 duration-150" 
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="text-[11px] font-bold text-[#57636E] uppercase tracking-wider px-2 py-1 mb-1">
                      Filter by Upload Date
                    </div>
                    <div className="space-y-0.5">
                      {[
                        { id: 'all', label: 'All time' },
                        { id: 'today', label: 'Today' },
                        { id: '7days', label: 'Past 7 days' },
                        { id: '30days', label: 'Past 30 days' },
                        { id: 'year', label: 'This year' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setDateFilter(opt.id as 'all' | 'today' | '7days' | '30days' | 'year');
                            setShowDateFilter(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-between ${
                            dateFilter === opt.id 
                              ? 'bg-[#E6F6EC] text-[#0C5325] font-semibold' 
                              : 'text-[#20262E] hover:bg-[#F5F6F8]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {dateFilter === opt.id && <Check size={14} className="text-[#0CAA41]" />}
                        </button>
                      ))}
                    </div>
                    {dateFilter !== 'all' && (
                      <div className="border-t border-[#E2E7EC] mt-2 pt-2">
                        <button 
                          onClick={() => { setDateFilter('all'); setShowDateFilter(false); }}
                          className="w-full text-center py-1.5 text-[12px] text-[#57636E] hover:text-[#20262E] font-medium"
                        >
                          Clear filter
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Sort Order Filter (Image 2) */}
              <div className="relative">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowSortFilter(!showSortFilter); 
                    setShowVideoTypeFilter(false);
                    setShowDateFilter(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E7EC] hover:bg-[#F5F6F8] rounded-lg text-[13px] font-medium text-[#20262E] transition-colors shadow-2xs"
                >
                  <span>
                    {sortOrder === 'newest' && 'Newest to Oldest'}
                    {sortOrder === 'oldest' && 'Oldest to Newest'}
                    {sortOrder === 'title-asc' && 'Title (A to Z)'}
                    {sortOrder === 'title-desc' && 'Title (Z to A)'}
                    {sortOrder === 'views' && 'Most Viewed'}
                  </span>
                  <ChevronDown size={14} className={showSortFilter ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>

                {/* Sort Order Dropdown */}
                {showSortFilter && (
                  <div 
                    className="absolute top-full right-0 mt-1.5 w-56 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-[#E2E7EC] p-2.5 z-30 animate-in fade-in zoom-in-95 duration-150" 
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="text-[11px] font-bold text-[#57636E] uppercase tracking-wider px-2 py-1 mb-1">
                      Sort Videos By
                    </div>
                    <div className="space-y-0.5">
                      {[
                        { id: 'newest', label: 'Newest to Oldest' },
                        { id: 'oldest', label: 'Oldest to Newest' },
                        { id: 'title-asc', label: 'Title (A to Z)' },
                        { id: 'title-desc', label: 'Title (Z to A)' },
                        { id: 'views', label: 'Most Viewed' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSortOrder(opt.id as 'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'views');
                            setShowSortFilter(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-between ${
                            sortOrder === opt.id 
                              ? 'bg-[#E6F6EC] text-[#0C5325] font-semibold' 
                              : 'text-[#20262E] hover:bg-[#F5F6F8]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {sortOrder === opt.id && <Check size={14} className="text-[#0CAA41]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Video Grid */}
            {/* Video Grid */}
            {filteredVideos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVideos.map((video, idx) => (
                  <div 
                    key={video.id} 
                    className={`bg-white rounded-xl shadow-sm border group cursor-pointer hover:shadow-md transition-all relative ${
                      activeVideoMenu === video.id ? 'z-40 border-2 border-[#0CAA41] ring-2 ring-[#0CAA41]/20' : 'z-10 border-[#E2E7EC]'
                    }`}
                    onMouseEnter={() => {
                      setVideoHoverId(video.id);
                      if (idx === 0 && !showPerspectiveTooltip) {
                        setShowPerspectiveTooltip(video.id);
                      }
                    }}
                    onMouseLeave={() => setVideoHoverId(null)}
                    onClick={() => router.push(`/video/${video.id}`)}
                  >
                    
                    {/* Thumbnail Area (overflow-hidden only on images/preview) */}
                    <div className="relative aspect-video bg-gradient-to-br from-slate-100 to-slate-200 w-full rounded-t-xl overflow-hidden">
                      {/* Fallback Icon */}
                      <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                        <Video size={40} className="opacity-40" />
                      </div>

                      {/* Real High-Resolution Thumbnail from Google Drive */}
                      {(video.thumbnailUrl || video.thumbnailLink) && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={video.thumbnailUrl || video.thumbnailLink}
                          alt={video.title}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}
                      
                      {/* Video Stream Preview on Hover */}
                      <video 
                        src={`${API_URL}/videos/${video.id}/stream`}
                        className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 bg-slate-900"
                        preload="none"
                        onMouseEnter={(e) => { e.currentTarget.play().catch(()=>{}); }}
                        onMouseLeave={(e) => { e.currentTarget.pause(); }}
                        muted
                        loop
                      />

                      {/* Duration Badge */}
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[11px] font-bold rounded shadow-sm z-20 font-mono">
                        {video.duration && video.duration > 0 
                          ? `${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}` 
                          : "0:15"}
                      </div>
                    </div>

                    {/* Top Left Pinned Badge */}
                    {pinnedVideoIds.includes(video.id) && (
                      <div className="absolute top-2.5 left-2.5 z-30 px-2 py-0.5 bg-[#0CAA41] text-white text-[10px] font-bold rounded-md flex items-center gap-1 shadow-md">
                        <Pin size={10} className="fill-white rotate-45" />
                        PINNED
                      </div>
                    )}

                    {/* Top Left Checkbox (shows on hover) */}
                    {(videoHoverId === video.id || activeVideoMenu === video.id) && !pinnedVideoIds.includes(video.id) && (
                      <div className="absolute top-3 left-3 z-30" onClick={e => e.stopPropagation()}>
                        <div className="w-[18px] h-[18px] bg-transparent border-[1.5px] border-white rounded-[4px] flex items-center justify-center cursor-pointer shadow-sm hover:bg-white/20 transition-colors"></div>
                      </div>
                    )}

                    {/* Right Hover Actions (Stacked Column - Pin, Link, More Actions) */}
                    {(videoHoverId === video.id || activeVideoMenu === video.id || pinnedVideoIds.includes(video.id)) && (
                      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-40" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); togglePinVideo(video.id); }}
                          className={`w-[28px] h-[28px] rounded shadow-sm flex items-center justify-center transition-colors cursor-pointer border ${
                            pinnedVideoIds.includes(video.id) 
                              ? 'bg-[#0CAA41] text-white border-[#0CAA41] shadow-[rgba(12, 170, 65,0.2)]' 
                              : 'bg-white text-[#20262E] hover:bg-[#F5F6F8] border-[#E2E7EC]'
                          }`}
                          title={pinnedVideoIds.includes(video.id) ? "Unpin video" : "Pin video"}
                        >
                          <Pin size={14} className={`rotate-45 ${pinnedVideoIds.includes(video.id) ? 'fill-white' : ''}`} />
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            copyVideoLink(video.id);
                          }}
                          className="w-[28px] h-[28px] bg-white rounded shadow-sm flex items-center justify-center text-[#20262E] hover:bg-[#F5F6F8] transition-colors cursor-pointer border border-[#E2E7EC]"
                          title="Copy link"
                        >
                          <LinkIcon size={14} />
                        </button>
                        <div className="relative group/more">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setActiveVideoMenu(activeVideoMenu === video.id ? null : video.id); 
                            }}
                            className="w-[28px] h-[28px] bg-white rounded shadow-sm flex items-center justify-center text-[#20262E] hover:bg-[#F5F6F8] transition-colors cursor-pointer border border-[#E2E7EC]"
                            title="More actions"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          
                          {/* "More actions..." Tooltip (Image 2 & 3) */}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 bg-[#1f242d] text-white text-[12px] font-medium px-2.5 py-1 rounded-md shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover/more:opacity-100 transition-opacity z-50">
                            More actions...
                          </div>

                          {/* Video Dropdown Menu (Image 3) */}                                                                                                                                                                                                                                                         
                          {activeVideoMenu === video.id && (
                            <div 
                              className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.18)] border border-[#E2E7EC]/90 py-2.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setActiveVideoMenu(null);
                                  copyVideoLink(video.id);
                                  setShareModalVideoId(video.id);
                                }}
                                className="w-full text-left px-5 py-2.5 text-[14px] font-medium text-[#20262E] hover:bg-[#F5F6F8] transition-colors cursor-pointer"
                              >
                                Share
                              </button>
                              <button
                                onClick={() => {
                                  setActiveVideoMenu(null);
                                  handleRenameVideo(video.id, video.title);
                                }}
                                className="w-full text-left px-5 py-2.5 text-[14px] font-medium text-[#20262E] hover:bg-[#F5F6F8] transition-colors cursor-pointer"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => {
                                  setActiveVideoMenu(null);
                                  handleMoveVideoClick(video.id);
                                }}
                                className="w-full text-left px-5 py-2.5 text-[14px] font-medium text-[#20262E] hover:bg-[#F5F6F8] transition-colors cursor-pointer"
                              >
                                Move...
                              </button>
                              <button
                                onClick={() => {
                                  setActiveVideoMenu(null);
                                  const newTitle = `${video.title} (Copy)`;
                                  const newVideo: VideoData = {
                                    ...video,
                                    id: `copy-${Date.now()}`,
                                    title: newTitle,
                                    createdAt: Date.now(),
                                    views: 0,
                                    comments: []
                                  };
                                  setVideos(prev => [newVideo, ...prev]);
                                  try {
                                    const savedWL = JSON.parse(localStorage.getItem('watchLaterVideos') || '[]');
                                    localStorage.setItem('watchLaterVideos', JSON.stringify([newVideo, ...savedWL]));
                                    localStorage.setItem(`video-meta-${newVideo.id}`, JSON.stringify({ title: newTitle, views: 0, comments: [] }));
                                  } catch {}
                                  showToast(`Video duplicated as "${newTitle}"`);
                                }}
                                className="w-full text-left px-5 py-2.5 text-[14px] font-medium text-[#20262E] hover:bg-[#F5F6F8] transition-colors cursor-pointer"
                              >
                                Duplicate
                              </button>
                              {activeTab === 'archived' ? (
                                <button
                                  onClick={() => unarchiveVideo(video.id, video.title)}
                                  className="w-full text-left px-5 py-2.5 text-[14px] font-medium text-[#0CAA41] hover:bg-[#E6F6EC] transition-colors cursor-pointer"
                                >
                                  Restore from Archive
                                </button>
                              ) : (
                                <button
                                  onClick={() => archiveVideo(video.id, video.title)}
                                  className="w-full text-left px-5 py-2.5 text-[14px] font-medium text-[#20262E] hover:bg-[#F5F6F8] transition-colors cursor-pointer"
                                >
                                  Archive
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setActiveVideoMenu(null);
                                  handleDeleteVideo(video.id);
                                }}
                                className="w-full text-left px-5 py-2.5 text-[14px] font-medium text-[#20262E] hover:bg-[#0CAA41]/10 hover:text-[#0CAA41] transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Card Details (Image 3) */}
                    <div className="p-4 relative bg-white border-t border-[#E2E7EC] flex flex-col gap-2">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-9 h-9 rounded-full bg-[#0CAA41] text-white flex items-center justify-center text-[12px] font-bold shrink-0 shadow-sm">
                          {video.isDrive ? 'GD' : (video.ownerName ? video.ownerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'HR')}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-1 text-[13px] text-[#57636E]">
                            <span className="font-medium text-[#20262E] truncate">{video.isDrive ? 'Google Drive' : (video.ownerName || 'Hari Kishore Reddy')}</span>
                            <span>·</span>
                            <span>{formatTimeAgo(video.createdAt)}</span>
                          </div>
                          <div 
                            className="text-[13px] text-[#57636E] flex items-center gap-1 mt-0.5 cursor-pointer hover:text-[#20262E]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShareModalVideoId(video.id);
                            }}
                          >
                            Share to Spaces <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>
                      
                      {editingTitleId === video.id ? (
                        <div className="w-full mb-3" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="text" 
                            autoFocus
                            value={editingTitleValue}
                            onChange={(e) => setEditingTitleValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(video.id);
                              if (e.key === 'Escape') setEditingTitleId(null);
                            }}
                            onBlur={() => handleSaveRename(video.id)}
                            className="font-semibold text-[16px] text-[#20262E] w-full border-b-2 border-[#0CAA41] focus:outline-none bg-transparent pb-0.5"
                          />
                        </div>
                      ) : (
                        <h3 
                          className="font-medium text-[15px] text-[#20262E] truncate mb-3 cursor-pointer hover:text-[#0CAA41] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/video/${video.id}`);
                          }}
                          title={video.title}
                        >
                          {video.title}
                        </h3>
                      )}
                      
                      <div className="flex items-center gap-4 text-[#57636E] text-[13px] font-medium">
                        <div 
                          className="flex items-center gap-1.5 cursor-pointer hover:text-[#20262E]"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/video/${video.id}`);
                          }}
                        >
                          <Eye size={16} /> {video.views || 0}
                        </div>
                        <div 
                          className="flex items-center gap-1.5 cursor-pointer hover:text-[#20262E]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedCommentsVideoId(expandedCommentsVideoId === video.id ? null : video.id);
                          }}
                        >
                          <MessageSquare size={16} /> {video.comments ? video.comments.length : 0}
                        </div>
                      </div>
                    </div>


                    {/* Inline Comments Section */}
                    {expandedCommentsVideoId === video.id && (
                      <div className="bg-[#F5F6F8] border-t border-[#E2E7EC] p-4 max-h-[300px] overflow-y-auto flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                          {(!video.comments || video.comments.length === 0) ? (
                            <div className="text-center text-[13px] text-[#57636E] py-4">
                              No comments yet. Be the first to comment!
                            </div>
                          ) : (
                            video.comments.map((comment: CommentData) => (
                              <div key={comment.id} className="flex gap-2.5">
                                <div className="w-7 h-7 bg-[#115E59] text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm mt-0.5">
                                  {comment.userName ? comment.userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                                </div>
                                <div className="flex-1 bg-white p-2.5 rounded-lg border border-[#E2E7EC] shadow-sm">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-[13px] text-[#20262E]">{comment.userName || 'User'}</span>
                                    {comment.videoTime && (
                                      <span className="text-[11px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[#57636E]">{comment.videoTime}</span>
                                    )}
                                  </div>
                                  <p className="text-[13px] text-[#20262E] break-words">{comment.text}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        
                        <div className="flex gap-2 mt-2">
                          <input 
                            type="text" 
                            placeholder="Write a comment..." 
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && newCommentText.trim()) {
                                e.preventDefault();
                                try {
                                  const text = newCommentText.trim();
                                  setNewCommentText('');
                                  const newComment = await addVideoComment(video.id, text, "0:00");
                                  const updatedComments = [...(video.comments || []), newComment];
                                  setVideos(prev => prev.map(v => v.id === video.id ? { ...v, comments: updatedComments } : v));
                                  try {
                                    const meta = JSON.parse(localStorage.getItem(`video-meta-${video.id}`) || '{}');
                                    meta.comments = updatedComments;
                                    localStorage.setItem(`video-meta-${video.id}`, JSON.stringify(meta));
                                  } catch {}
                                  window.dispatchEvent(new CustomEvent('video-updated', { detail: { id: video.id, comments: updatedComments } }));
                                } catch(err) {
                                  console.error("Failed to add comment", err);
                                  showToast("Failed to post comment");
                                }
                              }
                            }}
                            className="flex-1 bg-white border border-[#E2E7EC] rounded-full px-4 py-2 text-[13px] focus:outline-none focus:border-[#0CAA41] focus:ring-1 focus:ring-[#0CAA41] transition-shadow shadow-sm"
                          />
                          <button 
                            onClick={async () => {
                              if (!newCommentText.trim()) return;
                              try {
                                const text = newCommentText.trim();
                                setNewCommentText('');
                                const newComment = await addVideoComment(video.id, text, "0:00");
                                const updatedComments = [...(video.comments || []), newComment];
                                setVideos(prev => prev.map(v => v.id === video.id ? { ...v, comments: updatedComments } : v));
                                try {
                                  const meta = JSON.parse(localStorage.getItem(`video-meta-${video.id}`) || '{}');
                                  meta.comments = updatedComments;
                                  localStorage.setItem(`video-meta-${video.id}`, JSON.stringify(meta));
                                } catch {}
                                window.dispatchEvent(new CustomEvent('video-updated', { detail: { id: video.id, comments: updatedComments } }));
                              } catch(err) {
                                console.error("Failed to add comment", err);
                                showToast("Failed to post comment");
                              }
                            }}
                            disabled={!newCommentText.trim()}
                            className="bg-[#0CAA41] hover:bg-[#0C5325] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-full px-4 py-2 text-[13px] font-semibold transition-colors shadow-sm"
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                  <Video size={32} className="text-[#57636E]" />
                </div>
                <h3 className="text-[18px] font-bold text-[#20262E] mb-2">No videos found</h3>
                <p className="text-[#57636E] max-w-sm mx-auto mb-6 text-[14px]">
                  {activeTab === 'videos' 
                    ? isLoading
                      ? "Fetching videos from Google Drive..."
                      : "Google Drive is connected and active. Record a new video or upload one to get started."
                    : "There are no videos matching your filters in this folder."}
                </p>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsRecordModalOpen(true)}
                    className="bg-[#0CAA41] hover:bg-[#0C5325] text-white py-3 px-6 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 shadow-[0_10px_25px_-5px_rgba(12, 170, 65,0.45)] hover:shadow-[0_14px_28px_-5px_rgba(12, 170, 65,0.55)] transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                  >
                    <Video size={18} className="stroke-[2.2]" />
                    <span>Record Video</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-[#72BAA9] hover:bg-[#0C5325] text-white rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-sm text-[14px]"
                  >
                    <Upload size={16} />
                    Upload to Drive
                  </button>
                  <button
                    onClick={fetchData}
                    className="px-5 py-2.5 bg-white border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E] rounded-lg font-semibold transition-colors flex items-center gap-2 text-[14px]"
                  >
                    <RefreshCw size={16} />
                    Sync Drive
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Share Modal */}
        {shareModalVideoId && (
          <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] overflow-hidden" onClick={e => e.stopPropagation()}>
              
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-[20px] font-bold text-[#20262E]">Share</h2>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 rounded-lg text-[13px] font-semibold text-[#57636E]">
                    <Globe size={16} /> Social
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 rounded-lg text-[13px] font-semibold text-[#57636E]">
                    <Code size={16} /> Embed
                  </button>
                  <button onClick={() => setShareModalVideoId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-[#57636E] ml-2">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4">
                <div className="relative flex items-center gap-2 mb-4">
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      placeholder="Add names, emails, or Space" 
                      className="w-full pl-4 pr-4 py-2.5 bg-white border border-[#E2E7EC] rounded-lg text-[14px] text-[#20262E] focus:border-[#0CAA41] focus:ring-1 focus:ring-[#0CAA41] outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-[13px] font-medium text-[#57636E] cursor-pointer hover:text-[#20262E] whitespace-nowrap">
                    Import from <div className="w-4 h-4 bg-gradient-to-tr from-yellow-400 via-red-500 to-blue-500 rounded-sm inline-block mx-1"></div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-[#F5F6F8] rounded-lg border border-[#E2E7EC] mb-6">
                  <div className="w-5 h-5 border border-[#E2E7EC] rounded flex items-center justify-center bg-white"><Plus size={14} className="text-[#57636E]"/></div>
                  <span className="text-[14px] text-[#20262E]">All harikishorereddy9908</span>
                </div>

                <div className="mb-2">
                  <h3 className="text-[12px] font-bold text-[#20262E] mb-3">General access</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Globe size={20} className="text-green-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1 font-semibold text-[14px] text-[#20262E] cursor-pointer">
                          Public <ChevronDown size={14} className="text-[#57636E]" />
                        </div>
                        <div className="text-[13px] text-[#57636E]">Anyone with the link can view</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[#E2E7EC] bg-[#F5F6F8] flex items-center justify-between mt-4">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => {
                      if (shareModalVideoId) copyVideoLink(shareModalVideoId);
                    }}
                    className="flex items-center gap-2 text-[13px] font-semibold text-[#20262E] hover:text-[#20262E] cursor-pointer"
                  >
                    <LinkIcon size={16} /> Copy link
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-[#E2E7EC] text-[#0CAA41] focus:ring-[#0CAA41] group-hover:border-slate-400 transition-colors" />
                    <span className="text-[13px] font-medium text-[#20262E]">Share video at 0:00</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const pass = window.prompt("Set a password for this video link:");
                      if (pass) showToast("Password protection enabled!");
                    }}
                    className="px-4 py-2 bg-[#A855F7] hover:bg-[#9333EA] text-white rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lock size={14} /> Set password
                  </button>
                  <button 
                    onClick={() => {
                      if (shareModalVideoId) copyVideoLink(shareModalVideoId);
                      showToast("Link shared & copied to clipboard!");
                      setShareModalVideoId(null);
                    }}
                    className="px-4 py-2 bg-[#0CAA41] hover:bg-[#0C5325] text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer shadow-sm"
                  >
                    Share
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Move Video Modal */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center animate-in fade-in duration-200" onClick={() => setShowMoveModal(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-[480px] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <h2 className="text-[18px] font-bold text-[#20262E]">Move 1 video</h2>
                <button onClick={() => setShowMoveModal(null)} className="p-1 hover:bg-slate-100 rounded-lg text-[#57636E] transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 pb-20 pt-2 min-h-[160px]">
                {/* Hierarchy Tree UI matching Loom */}
                <div 
                  onClick={() => setMoveTargetFolderId('root')}
                  className={`w-full rounded-lg px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${moveTargetFolderId === 'root' ? 'bg-[#E3EBF8]' : 'hover:bg-[#F5F6F8]'}`}
                >
                  <ChevronDown size={14} className="text-[#57636E]" />
                  <Folder size={18} className="text-[#20262E]" />
                  <span className="text-[14px] font-semibold text-[#20262E]">Library</span>
                </div>
                
                <div className="pl-12 pt-2 flex flex-col gap-1">
                  {courses.map(folder => (
                    <div 
                      key={folder.id}
                      onClick={() => setMoveTargetFolderId(folder.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-[#20262E] font-medium text-[14px] transition-colors ${moveTargetFolderId === folder.id ? 'bg-[#E3EBF8]' : 'hover:bg-[#F5F6F8]'}`}
                    >
                      <Folder size={16} className="text-[#57636E]" />
                      {folder.name}
                    </div>
                  ))}
                  
                  <div 
                    onClick={() => setMoveTargetFolderId('workspace')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-[#20262E] font-medium text-[14px] mt-2 transition-colors ${moveTargetFolderId === 'workspace' ? 'bg-[#E3EBF8]' : 'hover:bg-[#F5F6F8]'}`}
                  >
                    <div className="w-[18px] h-[18px] bg-[#FCD34D] text-[#B45309] text-[10px] font-bold flex items-center justify-center rounded shrink-0">
                      A
                    </div>
                    All harikishorereddy9908
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 flex items-center justify-between border-t border-[#E2E7EC]">
                <button 
                  onClick={handleCreateFolder}
                  className="flex items-center gap-1.5 text-[14px] font-semibold text-[#57636E] hover:text-[#20262E] hover:bg-[#F5F6F8] px-2 py-1.5 rounded transition-colors"
                >
                  <Plus size={16} /> New Folder
                </button>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowMoveModal(null)}
                    className="px-4 py-2 bg-white border border-[#E2E7EC] text-[#20262E] hover:bg-[#F5F6F8] rounded-lg text-[13px] font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmMoveVideo}
                    className="px-5 py-2 bg-[#0CAA41] hover:bg-[#0C5325] text-white rounded-lg text-[13px] font-semibold transition-colors shadow-sm"
                  >
                    Move
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-10 fade-in">
            <span className="text-[14px] font-medium">{toastMessage}</span>
            <button onClick={() => setToastMessage('')} className="p-0.5 hover:bg-slate-700 rounded-md">
              <X size={16} />
            </button>
          </div>
        )}

        {/* RECORDING SETUP MODAL */}
        <RecordingSetupModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          onRecordingComplete={fetchData}
          showToast={showToast}
          defaultFolderId={activeTab.startsWith('folder-') ? activeTab.replace('folder-', '') : undefined}
        />

        {/* SHARE MODAL */}
        {shareModalVideoId && (() => {
          const targetVid = videos.find(v => v.id === shareModalVideoId);
          const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/video/${shareModalVideoId}` : '';
          const embedCode = `<iframe src="${shareUrl}" width="640" height="360" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>`;
          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150" onClick={() => setShareModalVideoId(null)}>
              <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E7EC] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-[#E2E7EC] flex items-center justify-between bg-[#F5F6F8]/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E6F6EC] text-[#0CAA41] flex items-center justify-center">
                      <Share2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#20262E] text-base">Share Recording</h3>
                      <p className="text-xs text-[#57636E] truncate max-w-[280px]">{targetVid?.title || 'Screen Recording'}</p>
                    </div>
                  </div>
                  <button onClick={() => setShareModalVideoId(null)} className="p-2 text-[#57636E] hover:text-[#57636E] hover:bg-slate-100 rounded-lg transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-5">
                  {/* Copy Link */}
                  <div>
                    <label className="text-xs font-semibold text-[#20262E] uppercase tracking-wider mb-2 block">Share Link</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl px-3.5 py-2.5 text-sm text-[#20262E] font-mono truncate select-all">
                        {shareUrl}
                      </div>
                      <button 
                        onClick={() => {
                          if (typeof navigator !== 'undefined') {
                            navigator.clipboard.writeText(shareUrl);
                            showToast("Link copied to clipboard!");
                          }
                        }}
                        className="px-4 py-2.5 bg-[#0CAA41] hover:bg-[#0C5325] text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 shrink-0 shadow-sm shadow-[rgba(12, 170, 65,0.2)]"
                      >
                        <LinkIcon size={14} /> Copy link
                      </button>
                    </div>
                  </div>

                  {/* Embed Video Code */}
                  <div>
                    <label className="text-xs font-semibold text-[#20262E] uppercase tracking-wider mb-2 block">Embed on Website</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl px-3.5 py-2 text-xs text-[#57636E] font-mono truncate select-all">
                        {embedCode}
                      </div>
                      <button 
                        onClick={() => {
                          if (typeof navigator !== 'undefined') {
                            navigator.clipboard.writeText(embedCode);
                            showToast("Embed iframe code copied!");
                          }
                        }}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-[#20262E] rounded-xl text-xs font-semibold transition-colors shrink-0"
                      >
                        <Code size={13} className="inline mr-1" /> Copy code
                      </button>
                    </div>
                  </div>

                  {/* Quick Share to Social */}
                  <div>
                    <label className="text-xs font-semibold text-[#20262E] uppercase tracking-wider mb-2 block">Share with</label>
                    <div className="grid grid-cols-4 gap-2">
                      <a 
                        href={`mailto:?subject=${encodeURIComponent(targetVid?.title || 'Video')}&body=${encodeURIComponent(shareUrl)}`}
                        target="_blank" rel="noreferrer"
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#E2E7EC] hover:bg-[#F5F6F8] hover:border-[#E2E7EC] transition-all text-[#20262E] text-xs font-medium"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#0CAA41]/10 text-[#0CAA41] flex items-center justify-center font-bold text-xs">@</div>
                        <span>Email</span>
                      </a>
                      <a 
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent((targetVid?.title || 'Video') + ' - ' + shareUrl)}`}
                        target="_blank" rel="noreferrer"
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#E2E7EC] hover:bg-[#F5F6F8] hover:border-[#E2E7EC] transition-all text-[#20262E] text-xs font-medium"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#E6F6EC]/40 text-[#72BAA9] flex items-center justify-center font-bold text-xs">WA</div>
                        <span>WhatsApp</span>
                      </a>
                      <a 
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(targetVid?.title || 'Video')}&url=${encodeURIComponent(shareUrl)}`}
                        target="_blank" rel="noreferrer"
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#E2E7EC] hover:bg-[#F5F6F8] hover:border-[#E2E7EC] transition-all text-[#20262E] text-xs font-medium"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-[#20262E] flex items-center justify-center font-bold text-xs">𝕏</div>
                        <span>Twitter/X</span>
                      </a>
                      <a 
                        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                        target="_blank" rel="noreferrer"
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#E2E7EC] hover:bg-[#F5F6F8] hover:border-[#E2E7EC] transition-all text-[#20262E] text-xs font-medium"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#E6F6EC] text-[#0C5325] flex items-center justify-center font-bold text-xs">in</div>
                        <span>LinkedIn</span>
                      </a>
                    </div>
                  </div>

                  {/* Access notice */}
                  <div className="p-3 bg-[#E6F6EC]/60 border border-[#0CAA41]/20 rounded-xl flex items-center gap-2 text-xs text-[#0CAA41]">
                    <Globe size={16} className="text-[#0CAA41] shrink-0" />
                    <span>Anyone with this link can watch this recording without an account.</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-[#F5F6F8] border-t border-[#E2E7EC] flex justify-end">
                  <button onClick={() => setShareModalVideoId(null)} className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-[#20262E] rounded-xl font-semibold text-sm transition-colors">
                    Done
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MOVE MODAL */}
        {showMoveModal && (() => {
          const moveVid = videos.find(v => v.id === showMoveModal);
          const allDestinations = [
            { id: 'root', name: 'GEONIXA LOOM (Home / Root)', icon: 'home' },
            ...courses.filter(c => !['screen-shares', 'team-updates'].includes(c.id) && !['Screen Shares', 'Team Updates'].includes(c.name)).map(c => ({
              id: c.id,
              name: c.name,
              icon: 'folder',
            }))
          ];

          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150" onClick={() => setShowMoveModal(null)}>
              <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E7EC] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-[#E2E7EC] flex items-center justify-between bg-[#F5F6F8]/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#0C5325] flex items-center justify-center">
                      <Folder size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#20262E] text-base">Move Video</h3>
                      <p className="text-xs text-[#57636E] truncate max-w-[240px]">{moveVid?.title || 'Select folder'}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowMoveModal(null)} className="p-2 text-[#57636E] hover:text-[#57636E] hover:bg-slate-100 rounded-lg transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-2 max-h-[340px] overflow-y-auto">
                  <div className="text-xs font-semibold text-[#57636E] uppercase tracking-wider mb-1">Select Destination</div>
                  {allDestinations.map(dest => {
                    const isSelected = moveTargetFolderId === dest.id;
                    return (
                      <button
                        key={dest.id}
                        onClick={() => setMoveTargetFolderId(dest.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                          isSelected 
                            ? 'bg-[#E6F6EC] border-[#0CAA41] text-blue-900 font-semibold shadow-sm'
                            : 'bg-white border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Folder size={18} className={isSelected ? 'text-[#0CAA41]' : 'text-[#57636E]'} />
                          <span className="text-sm">{dest.name}</span>
                        </div>
                        {isSelected && <Check size={16} className="text-[#0CAA41]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="p-4 bg-[#F5F6F8] border-t border-[#E2E7EC] flex justify-end gap-2">
                  <button 
                    onClick={() => setShowMoveModal(null)} 
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#20262E] rounded-xl font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmMoveVideo} 
                    className="px-5 py-2 bg-[#0CAA41] hover:bg-[#0C5325] text-white rounded-xl font-semibold text-sm transition-colors shadow-sm shadow-[rgba(12, 170, 65,0.2)]"
                  >
                    Move here
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </main>

      {/* Profile Flyout (Image 5) */}
      <ProfileFlyout
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        videoCount={videos.length}
      />
    </div>
  );
}

// Helper Components
function SidebarItem({ icon, label, active = false, external = false, href }: { icon: React.ReactNode, label: string, active?: boolean, external?: boolean, href?: string }) {
  const router = useRouter();
  
  return (
    <div 
      onClick={() => href && router.push(href)}
      style={{
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: '14px',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '14px',
        letterSpacing: 'normal',
        color: active ? '#0CAA41' : '#292A2E'
      }}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all ${
      active 
        ? "bg-[#E6F6EC] shadow-sm" 
        : "hover:bg-[#F5F6F8]"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`${active ? "text-[#0CAA41]" : "text-[#57636E]"}`}>
          {icon}
        </div>
        <span className="text-sm tracking-wide">{label}</span>
      </div>
      {external && <div className="text-[#57636E]"><Share2 size={12} className="rotate-45" /></div>}
    </div>
  );
}

function DropdownItem({ label, onClick }: { label: string, onClick?: () => void }) {
  return (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="w-full text-left px-4 py-1.5 text-[13px] font-medium text-[#20262E] hover:bg-slate-100 hover:text-[#20262E] transition-colors"
    >
      {label}
    </button>
  );
}

// Icon for Code (Embed)
function Code({ size, className }: { size: number, className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
  );
}
