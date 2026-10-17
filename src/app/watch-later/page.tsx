"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Video, Folder, 
  Share2, Shield,
  ChevronDown, MessageSquare, Eye, Link as LinkIcon,
  Pin, Archive, Globe, Lock, CheckCircle2,
  X, MoreHorizontal, Plus
} from "lucide-react";
import {
  HomeIcon, LibraryIcon, VideoCameraIcon, SavedIcon, SettingsIcon,
  UsersIcon, UserIcon, WorkspaceIcon
} from "@/components/CustomIcons";
import { getVideos, deleteVideo, updateVideo, syncVideos, addVideoComment, API_URL } from "@/lib/api";
import RecordingSetupModal from "@/components/RecordingSetupModal";
import RcrdLogo from "@/components/RcrdLogo";
import ProfileFlyout, { getStoredProfile, UserProfileData } from "@/components/ProfileFlyout";
import AppHeader from "@/components/AppHeader";

interface Comment {
  id: string;
  userName?: string;
  videoTime?: string;
  text: string;
  timestamp?: string;
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
  comments?: Comment[];
}

interface Course {
  id: string;
  name: string;
}

export default function WatchLaterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/calendar');
  }, [router]);

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfileData>(getStoredProfile());

  useEffect(() => {
    const handleUpdate = () => setProfile(getStoredProfile());
    window.addEventListener("rcrd_profile_updated", handleUpdate);
    return () => window.removeEventListener("rcrd_profile_updated", handleUpdate);
  }, []);
  
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [courses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState<number>(0);

  // UI States
  const [toastMessage, setToastMessage] = useState('');
  
  // Modals & Dropdowns
  const [shareModalVideoId, setShareModalVideoId] = useState<string | null>(null);
  const [activeVideoMenu, setActiveVideoMenu] = useState<string | null>(null);
  const [videoHoverId, setVideoHoverId] = useState<string | null>(null);
  const [showPerspectiveTooltip, setShowPerspectiveTooltip] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState<string | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string>('root');
  
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

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // First, sync any new files directly from Google Drive so we have real-time dynamic data
      await syncVideos().catch(() => console.warn("Failed to sync videos from Drive, using cached data."));
      
      // Load full saved video objects or IDs from either watchLaterVideos or rcrd_watch_later
      const savedVideosRaw = JSON.parse(localStorage.getItem('watchLaterVideos') || '[]');
      const rcrdSavedRaw = JSON.parse(localStorage.getItem('rcrd_watch_later') || '[]');
      const allVideos = await getVideos().catch(() => []);

      const videoMap = new Map<string, VideoData>();

      // First add full objects
      for (const item of [...savedVideosRaw, ...rcrdSavedRaw]) {
        if (!item) continue;
        if (typeof item === 'object' && item.id) {
          videoMap.set(item.id, item as VideoData);
        } else if (typeof item === 'string') {
          const found = allVideos.find((v: VideoData) => v.id === item);
          if (found) {
            videoMap.set(item, found);
          } else {
            videoMap.set(item, {
              id: item,
              title: `Saved Video · ${item.slice(-6)}`,
              createdAt: Date.now() - 3600000,
              views: 1
            });
          }
        }
      }

      const mergedList = Array.from(videoMap.values());
      mergedList.forEach((v: VideoData) => {
        try {
          const ldata = localStorage.getItem(`video-edits-${v.id}`);
          if (ldata) {
            const parsed = JSON.parse(ldata);
            if (parsed.duration) v.duration = parsed.duration;
          }
        } catch {}
      });
      setVideos(mergedList);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(Date.now());
      fetchData();
    }, 0);

    const handleUpdate = () => {
      fetchData();
    };
    window.addEventListener('focus', handleUpdate);
    window.addEventListener('video-updated', handleUpdate);

    // Real-time dynamic updating for views and comments
    const interval = setInterval(async () => {
      setNow(Date.now());
      try {
        const videosData = await getVideos(0, 50, '', '');
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
        // Silently fail polling
      }
    }, 15000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('focus', handleUpdate);
      window.removeEventListener('video-updated', handleUpdate);
    };
  }, [fetchData, enrichVideoMeta]);

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

    // Update in localStorage everywhere
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
    } catch {
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
    } catch {
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
    try {
      const targetId = (moveTargetFolderId === 'root' || moveTargetFolderId === 'workspace') ? '' : moveTargetFolderId;
      await updateVideo(showMoveModal, { courseId: targetId });
      showToast("Video moved successfully");
      fetchData(); // Refresh to reflect changes
    } catch {
      showToast("Failed to move video.");
    }
    setShowMoveModal(null);
  };

  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  const formatTimeAgo = (ts: number) => {
    if (!now) return "Just now";
    const diff = Math.floor((now - ts) / 3600000); // hours
    if (diff < 24) return `${diff} hours`;
    return `${Math.floor(diff / 24)} days`;
  };

  return (
    <div className="relative flex h-full w-full bg-[#F5F6F8] text-[#20262E] font-sans overflow-hidden">
      
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Crisp Light Mode with Mobile Drawer Support */}
      <aside className={`w-[280px] flex-shrink-0 flex-col border-r border-[#E2E7EC] bg-white h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden transition-all duration-300 ${
        isMobileMenuOpen 
          ? "fixed inset-y-0 left-0 flex z-50 shadow-2xl" 
          : "hidden md:flex z-20"
      }`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#E2E7EC] flex-shrink-0">
          <div className="flex items-center justify-start cursor-pointer group" onClick={() => { router.push('/'); setIsMobileMenuOpen(false); }}>
            <RcrdLogo className="h-8 w-auto transition-transform group-hover:scale-105" />
          </div>
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-[#57636E] hover:text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 border-b border-[#E2E7EC] flex-shrink-0">
          <div className="flex items-center justify-between p-3 bg-[#F5F6F8] hover:bg-slate-100 rounded-xl cursor-pointer transition-all border border-[#E2E7EC] hover:border-[#E2E7EC] group">
            <div>
              <div className="text-sm font-semibold text-[#20262E] group-hover:text-[#0E2F44] transition-colors">RCRD Workspace</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] uppercase tracking-wider bg-[#EBF5FB] px-2 py-0.5 rounded text-[#0E2F44] font-bold border border-[#154360]/30">Watch Later</span>
                <span className="text-xs text-[#57636E]">Saved Queue</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#57636E] group-hover:text-[#57636E] transition-colors" />
          </div>
          <button 
            onClick={() => { router.push('/settings?tab=users'); setIsMobileMenuOpen(false); }}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm font-semibold text-[#20262E] transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            <UsersIcon size={16} className="text-[#154360]" />
            Invite Teammates
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-4 custom-scrollbar min-h-0">
          <nav className="space-y-1">
            <SidebarItem icon={<HomeIcon size={18} />} label="For You" href="/" />
            <SidebarItem icon={<LibraryIcon size={18} />} label="Library" href="/library" />
            <SidebarItem icon={<VideoCameraIcon size={18} />} label="Meetings" href="/meetings" />
            <SidebarItem icon={<SavedIcon size={18} />} label="Watch Later" active href="/watch-later" />
            <SidebarItem icon={<SettingsIcon size={18} />} label="Settings" href="/settings" />
          </nav>

          <div className="mt-10">
            <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#57636E] mb-3">Workspace Admin</h3>
            <nav className="space-y-1">
              <SidebarItem icon={<UserIcon size={18} />} label="Manage Users" href="/settings?tab=users" />
              <SidebarItem icon={<WorkspaceIcon size={18} />} label="Workspace Info" href="/settings" />
              <SidebarItem icon={<Shield size={18} />} label="Billing & Plans" href="/settings?tab=billing" />
            </nav>
          </div>
        </div>

        <div className="p-5 border-t border-[#E2E7EC] bg-[#F5F6F8]/50 flex-shrink-0">
          <button 
            onClick={() => { setIsRecordModalOpen(true); setIsMobileMenuOpen(false); }}
            className="w-full bg-[#154360] hover:bg-[#0E2F44] text-white py-3.5 px-6 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 shadow-[0_10px_25px_-5px_rgba(21, 67, 96,0.45)] hover:shadow-[0_14px_28px_-5px_rgba(21, 67, 96,0.55)] transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <VideoCameraIcon size={20} />
            <span>Record Video</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative z-10 bg-white overflow-hidden">
        
        {/* Top Header - Unified Fixed h-16, Centered Search, Image 5 Avatar */}
        <AppHeader 
          placeholder="Search for people, tags, folders, Spaces, and Recordings"
          onOpenProfile={() => setIsProfileOpen(true)}
          onToggleMobileSidebar={() => setIsMobileMenuOpen(prev => !prev)}
        />

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative min-h-0" onClick={() => {
          setActiveVideoMenu(null);
        }}>
          
          <div className="max-w-[1200px] mx-auto pt-8 px-8 pb-24">
            
            {/* Header Section */}
            <div className="flex items-end justify-between mb-8">
              <div className="flex items-center gap-4">
                <h1 className="text-[28px] font-bold text-[#20262E] leading-tight">
                  Watch later
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                     localStorage.setItem('watchLaterVideos', '[]');
                     setVideos([]);
                  }}
                  className="px-4 py-2 bg-white border border-[#E2E7EC] hover:bg-[#F5F6F8] rounded-lg text-[13px] font-semibold text-[#20262E] transition-colors flex items-center gap-2"
                >
                  <Archive size={14} /> Remove viewed videos
                </button>
              </div>
            </div>

            {/* Video Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-[#154360] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 bg-[#76A838] rounded shadow-md flex items-center justify-center transform -rotate-12 translate-x-4">
                    <CheckCircle2 size={32} className="text-white opacity-80" />
                  </div>
                  <div className="w-16 h-16 bg-[#154360] rounded shadow-md flex items-center justify-center absolute top-2 right-4 transform rotate-6 z-10">
                    <X size={32} className="text-white opacity-80" />
                  </div>
                  <div className="w-16 h-16 bg-[#76A838] rounded shadow-md flex items-center justify-center absolute top-8 left-2 z-20">
                    <CheckCircle2 size={32} className="text-white opacity-80" />
                  </div>
                </div>
                <h3 className="text-[18px] font-bold text-[#20262E] mb-2">Nothing saved for later</h3>
                <p className="text-[14px] text-[#57636E] max-w-md">
                  Add RCRD videos to your watch later list to keep track of what you want to view.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video, idx) => (
                  <div 
                    key={video.id} 
                    className={`bg-white rounded-xl shadow-sm border group cursor-pointer hover:shadow-md transition-all relative ${
                      activeVideoMenu === video.id ? 'z-40 border-2 border-[#154360] ring-2 ring-[#154360]/20' : 'z-10 border-[#E2E7EC]'
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

                    {/* Top Left Checkbox (shows on hover) */}
                    {(videoHoverId === video.id || activeVideoMenu === video.id) && (
                      <div className="absolute top-3 left-3 z-30" onClick={e => e.stopPropagation()}>
                        <div className="w-[18px] h-[18px] bg-transparent border-[1.5px] border-white rounded-[4px] flex items-center justify-center cursor-pointer shadow-sm hover:bg-white/20 transition-colors"></div>
                      </div>
                    )}

                    {/* Right Hover Actions (Stacked Column - Pin, Link, More Actions) */}
                    {(videoHoverId === video.id || activeVideoMenu === video.id) && (
                      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-40" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); showToast("Video pinned!"); }}
                          className="w-[28px] h-[28px] bg-white rounded shadow-sm flex items-center justify-center text-[#20262E] hover:bg-[#F5F6F8] transition-colors cursor-pointer"
                          title="Pin video"
                        >
                          <Pin size={14} className="rotate-45" />
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            navigator.clipboard.writeText(`${window.location.origin}/video/${video.id}`);
                            showToast("Link copied to clipboard!"); 
                          }}
                          className="w-[28px] h-[28px] bg-white rounded shadow-sm flex items-center justify-center text-[#20262E] hover:bg-[#F5F6F8] transition-colors cursor-pointer"
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
                          
                          {/* "More actions..." Tooltip (Image 2) */}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 bg-[#1f242d] text-white text-[12px] font-medium px-2.5 py-1 rounded-md shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover/more:opacity-100 transition-opacity z-50">
                            More actions...
                          </div>

                          {/* Video Dropdown Menu (Image 2) */}
                          {activeVideoMenu === video.id && (
                            <div 
                              className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.18)] border border-[#E2E7EC]/90 py-2.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setActiveVideoMenu(null);
                                  setShareModalVideoId(video.id);
                                  navigator.clipboard.writeText(`${window.location.origin}/video/${video.id}`).catch(() => {});
                                  showToast("Share options opened & link copied");
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
                              <button
                                onClick={() => {
                                  setActiveVideoMenu(null);
                                  setVideos(prev => prev.filter(v => v.id !== video.id));
                                  try {
                                    const archived = JSON.parse(localStorage.getItem('archivedVideos') || '[]');
                                    localStorage.setItem('archivedVideos', JSON.stringify([video, ...archived]));
                                  } catch {}
                                  showToast(`"${video.title}" moved to archive`);
                                }}
                                className="w-full text-left px-5 py-2.5 text-[14px] font-medium text-[#20262E] hover:bg-[#F5F6F8] transition-colors cursor-pointer"
                              >
                                Archive
                              </button>
                              <button
                                onClick={() => {
                                  setActiveVideoMenu(null);
                                  handleDeleteVideo(video.id);
                                }}
                                className="w-full text-left px-5 py-2.5 text-[14px] font-medium text-[#20262E] hover:bg-[#154360]/10 hover:text-[#154360] transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Card Details */}
                    <div className="p-4 relative bg-white border-t border-[#E2E7EC] flex flex-col gap-2">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-9 h-9 rounded-full bg-[#154360] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                          {video.ownerName ? video.ownerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'HR'}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-1 text-[13px] text-[#57636E]">
                            <span className="font-medium text-[#20262E] truncate">{video.ownerName || 'Hari Kishore Reddy'}</span>
                            <span>·</span>
                            <span>{formatTimeAgo(video.createdAt)}</span>
                          </div>
                          <div className="text-[13px] text-[#57636E] flex items-center gap-1 mt-0.5 cursor-pointer hover:text-[#20262E]">
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
                            className="font-semibold text-[16px] text-[#20262E] w-full border-b-2 border-[#154360] focus:outline-none bg-transparent pb-0.5"
                          />
                        </div>
                      ) : (
                        <h3 
                          className="font-medium text-[15px] text-[#20262E] truncate mb-3 cursor-pointer hover:text-[#154360] transition-colors"
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
                            video.comments.map((comment: Comment) => (
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
                            className="flex-1 bg-white border border-[#E2E7EC] rounded-full px-4 py-2 text-[13px] focus:outline-none focus:border-[#154360] focus:ring-1 focus:ring-[#154360] transition-shadow shadow-sm"
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
                            className="bg-[#154360] hover:bg-[#0E2F44] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-full px-4 py-2 text-[13px] font-semibold transition-colors shadow-sm"
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                ))}
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
                      className="w-full pl-4 pr-4 py-2.5 bg-white border border-[#E2E7EC] rounded-lg text-[14px] text-[#20262E] focus:border-[#154360] focus:ring-1 focus:ring-[#154360] outline-none"
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
                  <button className="flex items-center gap-2 text-[13px] font-semibold text-[#20262E] hover:text-[#20262E]">
                    <LinkIcon size={16} /> Copy link
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-[#E2E7EC] text-[#154360] focus:ring-[#154360] group-hover:border-slate-400 transition-colors" />
                    <span className="text-[13px] font-medium text-[#20262E]">Share video at 0:00</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 bg-[#A855F7] hover:bg-[#9333EA] text-white rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-1.5">
                    <Lock size={14} /> Set password
                  </button>
                  <button className="px-4 py-2 bg-slate-200 text-[#57636E] rounded-lg text-[13px] font-semibold cursor-not-allowed">
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
                  onClick={() => {}}
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
                    className="px-5 py-2 bg-[#154360] hover:bg-[#0E2F44] text-white rounded-lg text-[13px] font-semibold transition-colors shadow-sm"
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

      </main>

      <RecordingSetupModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onRecordingComplete={() => router.push('/library')}
      />

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
        color: active ? '#154360' : '#292A2E'
      }}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all ${
      active 
        ? "bg-[#EBF5FB] shadow-sm" 
        : "hover:bg-[#F5F6F8]"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`${active ? "text-[#154360]" : "text-[#57636E]"}`}>
          {icon}
        </div>
        <span className="text-sm tracking-wide">{label}</span>
      </div>
      {external && <div className="text-[#57636E]"><Share2 size={12} className="rotate-45" /></div>}
    </div>
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
