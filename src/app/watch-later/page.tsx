"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Bell, Settings, Video, Folder, 
  Share2, Users, Building, Shield,
  ChevronDown, MessageSquare, Eye, Link as LinkIcon,
  Pin, Archive, Globe, Lock, CheckCircle2,
  X, Home, Bookmark, MoreVertical, Plus
} from "lucide-react";
import Image from "next/image";
import { getVideos, deleteVideo, updateVideo, syncVideos, addVideoComment, API_URL } from "@/lib/api";

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(Date.now());
      fetchData();
    }, 0);

    // Real-time dynamic updating for views and comments
    const interval = setInterval(async () => {
      setNow(Date.now());
      try {
        const videosData = await getVideos(0, 50, '', '');
        if (videosData && videosData.content) {
          const vids = videosData.content;
          vids.forEach((v: VideoData) => {
            try {
              const ldata = localStorage.getItem(`video-edits-${v.id}`);
              if (ldata) {
                const parsed = JSON.parse(ldata);
                if (parsed.duration) v.duration = parsed.duration;
              }
            } catch {}
          });
          setVideos(prevVideos => {
            return prevVideos.map(prevV => {
              const newV = vids.find((v: VideoData) => v.id === prevV.id);
              if (newV) {
                // Only update dynamic fields to prevent full card re-renders
                if (newV.views !== prevV.views || JSON.stringify(newV.comments) !== JSON.stringify(prevV.comments) || newV.duration !== prevV.duration) {
                  return { ...prevV, views: newV.views, comments: newV.comments, duration: newV.duration };
                }
              }
              return prevV;
            });
          });
        }
      } catch {
        // Silently fail polling
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchData]);

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
    try {
      await updateVideo(id, { title: editingTitleValue });
      showToast(`Video renamed to ${editingTitleValue}`);
      fetchData();
    } catch {
      setVideos(videos.map(v => v.id === id ? { ...v, title: editingTitleValue } : v));
      showToast(`Video renamed to ${editingTitleValue}`);
    }
    setEditingTitleId(null);
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
    <div className="relative flex h-full w-full bg-[#F7F9FA] text-[#11151A] font-sans overflow-hidden">
      
      {/* Sidebar - Crisp Light Mode */}
      <aside className="w-[280px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-white z-20 h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="h-16 flex items-center px-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-center w-full cursor-pointer group" onClick={() => router.push('/')}>
            <Image src="/ICONS/COMPANY_NAME-cropped.png" alt="RCRD." width={120} height={48} className="h-12 w-auto object-contain transition-transform group-hover:scale-105" />
          </div>
        </div>

        <div className="p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-all border border-slate-100 hover:border-slate-200 group">
            <div>
              <div className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">RCRD Workspace</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded text-blue-700 font-bold border border-blue-200">Watch Later</span>
                <span className="text-xs text-slate-500">Saved Queue</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>
          <button className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all shadow-sm hover:shadow-md">
            <Users className="w-4 h-4 text-blue-600" />
            Invite Teammates
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-4 custom-scrollbar min-h-0">
          <nav className="space-y-1">
            <SidebarItem icon={<Home size={18} />} label="For You" href="/" />
            <SidebarItem icon={<Folder size={18} />} label="Library" href="/library" />
            <SidebarItem icon={<Video size={18} />} label="Meetings" href="/meetings" />
            <SidebarItem icon={<Bookmark size={18} />} label="Watch Later" active href="/watch-later" />
            <SidebarItem icon={<Settings size={18} />} label="Settings" href="/settings" />
          </nav>

          <div className="mt-10">
            <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Workspace Admin</h3>
            <nav className="space-y-1">
              <SidebarItem icon={<Settings size={18} />} label="Manage Users" href="/settings?tab=users" />
              <SidebarItem icon={<Building size={18} />} label="Workspace Info" />
              <SidebarItem icon={<Shield size={18} />} label="Billing & Plans" href="/settings?tab=billing" />
            </nav>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <button 
            onClick={() => router.push('/record')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] transition-all transform hover:-translate-y-0.5"
          >
            <Video size={18} />
            Record Video
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative z-10 bg-white overflow-hidden">
        
        {/* Top Header */}
        <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-200 shrink-0 z-20 flex-shrink-0">
          <div className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search for people, tags, folders, Spaces, and Looms" 
              className="w-full pl-9 pr-4 py-1.5 bg-[#F2F5F7] border border-transparent rounded-lg text-[13px] text-slate-900 focus:bg-white focus:border-[#0E71EB] focus:ring-1 focus:ring-[#0E71EB] outline-none transition-all placeholder:text-slate-500 font-medium"
            />
          </div>
          <div className="flex items-center gap-4 ml-4 shrink-0">
            <button className="bg-[#0E71EB] hover:bg-[#1655B8] text-white px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all">
              Upgrade
            </button>
            <button className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-md transition-colors">
              <div className="w-5 h-5 border-2 border-slate-500 rounded-full flex items-center justify-center text-[11px] font-bold">?</div>
            </button>
            <button className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-md transition-colors">
              <Bell size={18} />
            </button>
            <div className="w-7 h-7 rounded-full bg-[#0E71EB] text-white flex items-center justify-center text-[11px] font-bold cursor-pointer">
              HR
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative min-h-0" onClick={() => {
          setActiveVideoMenu(null);
        }}>
          
          <div className="max-w-[1200px] mx-auto pt-8 px-8 pb-24">
            
            {/* Header Section */}
            <div className="flex items-end justify-between mb-8">
              <div className="flex items-center gap-4">
                <h1 className="text-[28px] font-bold text-slate-900 leading-tight">
                  Watch later
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                     localStorage.setItem('watchLaterVideos', '[]');
                     setVideos([]);
                  }}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-[13px] font-semibold text-slate-700 transition-colors flex items-center gap-2"
                >
                  <Archive size={14} /> Remove viewed videos
                </button>
              </div>
            </div>

            {/* Video Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 bg-[#76A838] rounded shadow-md flex items-center justify-center transform -rotate-12 translate-x-4">
                    <CheckCircle2 size={32} className="text-white opacity-80" />
                  </div>
                  <div className="w-16 h-16 bg-[#0E71EB] rounded shadow-md flex items-center justify-center absolute top-2 right-4 transform rotate-6 z-10">
                    <X size={32} className="text-white opacity-80" />
                  </div>
                  <div className="w-16 h-16 bg-[#76A838] rounded shadow-md flex items-center justify-center absolute top-8 left-2 z-20">
                    <CheckCircle2 size={32} className="text-white opacity-80" />
                  </div>
                </div>
                <h3 className="text-[18px] font-bold text-slate-900 mb-2">Nothing saved for later</h3>
                <p className="text-[14px] text-slate-500 max-w-md">
                  Add Loom videos to your watch later list to keep track of what you want to view.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video, idx) => (
                  <div 
                    key={video.id} 
                    className="bg-white rounded-xl shadow-sm border border-slate-200 group cursor-pointer hover:shadow-md transition-all relative"
                    onMouseEnter={() => {
                      setVideoHoverId(video.id);
                      if (idx === 0 && !showPerspectiveTooltip) {
                        setShowPerspectiveTooltip(video.id);
                      }
                    }}
                    onMouseLeave={() => setVideoHoverId(null)}
                    onClick={() => router.push(`/video/${video.id}`)}
                  >
                    
                    {/* Thumbnail Area */}
                    <div className="relative aspect-video bg-gradient-to-br from-slate-100 to-slate-200 w-full rounded-t-xl group/thumb overflow-hidden">
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
                      
                      {/* Top Left Checkbox (shows on hover) */}
                      {videoHoverId === video.id && (
                        <div className="absolute top-3 left-3 z-20" onClick={e => e.stopPropagation()}>
                          <div className="w-[18px] h-[18px] bg-transparent border-[1.5px] border-white rounded-[4px] flex items-center justify-center cursor-pointer shadow-sm hover:bg-white/20 transition-colors"></div>
                        </div>
                      )}

                      {/* Right Hover Actions (Stacked Column) */}
                      {videoHoverId === video.id && (
                        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); showToast("Video pinned!"); }}
                            className="w-[28px] h-[28px] bg-white rounded shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Pin size={14} className="rotate-45" />
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              navigator.clipboard.writeText(`http://localhost:3000/video/${video.id}`);
                              showToast("Link copied to clipboard!"); 
                            }}
                            className="w-[28px] h-[28px] bg-white rounded shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <LinkIcon size={14} />
                          </button>
                          <div className="relative">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveVideoMenu(activeVideoMenu === video.id ? null : video.id); }}
                              className="w-[28px] h-[28px] bg-white rounded shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors group-hover/menu"
                            >
                              <MoreVertical size={14} />
                            </button>
                            
                            {/* Video Dropdown Menu */}
                            {activeVideoMenu === video.id && (
                              <div className="absolute top-0 right-8 w-44 bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-slate-200 py-1.5 z-40">
                                <DropdownItem label="Share" onClick={() => { setShareModalVideoId(video.id); setActiveVideoMenu(null); }} />
                                <DropdownItem label="Rename" onClick={() => handleRenameVideo(video.id, video.title)} />
                                <DropdownItem label="Move..." onClick={() => handleMoveVideoClick(video.id)} />
                                <DropdownItem label="Duplicate" onClick={() => {
                                  setActiveVideoMenu(null);
                                  const newVideo = { ...video, id: `dummy-${Date.now()}`, title: `${video.title} (Copy)` };
                                  setVideos([newVideo, ...videos]);
                                  showToast("Video duplicated");
                                }} />
                                <DropdownItem label="Archive" onClick={() => {
                                  setActiveVideoMenu(null);
                                  setVideos(videos.filter(v => v.id !== video.id));
                                  showToast("Video archived");
                                }} />
                                <DropdownItem label="Delete" onClick={() => handleDeleteVideo(video.id)} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Duration Badge */}
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[11px] font-bold rounded shadow-sm z-20 font-mono">
                        {video.duration && video.duration > 0 
                          ? `${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}` 
                          : "0:15"}
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="p-4 relative bg-white border-t border-slate-100 flex flex-col gap-2">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-9 h-9 rounded-full bg-[#0E71EB] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
                          {video.ownerName ? video.ownerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'HR'}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-1 text-[13px] text-slate-500">
                            <span className="font-medium text-slate-700 truncate">{video.ownerName || 'Hari Kishore Reddy'}</span>
                            <span>·</span>
                            <span>{formatTimeAgo(video.createdAt)}</span>
                          </div>
                          <div className="text-[13px] text-slate-500 flex items-center gap-1 mt-0.5 cursor-pointer hover:text-slate-700">
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
                            className="font-semibold text-[16px] text-slate-900 w-full border-b-2 border-blue-600 focus:outline-none bg-transparent pb-0.5"
                          />
                        </div>
                      ) : (
                        <h3 
                          className="font-medium text-[15px] text-slate-900 truncate mb-3 cursor-pointer hover:text-blue-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTitleId(video.id);
                            setEditingTitleValue(video.title);
                          }}
                          title="Click to rename"
                        >
                          {video.title}
                        </h3>
                      )}
                      
                      <div className="flex items-center gap-4 text-slate-500 text-[13px] font-medium">
                        <div 
                          className="flex items-center gap-1.5 cursor-pointer hover:text-slate-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/video/${video.id}`);
                          }}
                        >
                          <Eye size={16} /> {video.views || 0}
                        </div>
                        <div 
                          className="flex items-center gap-1.5 cursor-pointer hover:text-slate-700"
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
                      <div className="bg-slate-50 border-t border-slate-100 p-4 max-h-[300px] overflow-y-auto flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                          {(!video.comments || video.comments.length === 0) ? (
                            <div className="text-center text-[13px] text-slate-500 py-4">
                              No comments yet. Be the first to comment!
                            </div>
                          ) : (
                            video.comments.map((comment: Comment) => (
                              <div key={comment.id} className="flex gap-2.5">
                                <div className="w-7 h-7 bg-[#115E59] text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm mt-0.5">
                                  {comment.userName ? comment.userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                                </div>
                                <div className="flex-1 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-[13px] text-slate-900">{comment.userName || 'User'}</span>
                                    {comment.videoTime && (
                                      <span className="text-[11px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{comment.videoTime}</span>
                                    )}
                                  </div>
                                  <p className="text-[13px] text-slate-700 break-words">{comment.text}</p>
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
                                  const newComment = await addVideoComment(video.id, newCommentText.trim(), "0:00");
                                  setVideos(videos.map(v => v.id === video.id ? { ...v, comments: [...(v.comments || []), newComment] } : v));
                                  setNewCommentText('');
                                } catch(err) {
                                  console.error("Failed to add comment", err);
                                  showToast("Failed to post comment");
                                }
                              }
                            }}
                            className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-2 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow shadow-sm"
                          />
                          <button 
                            onClick={async () => {
                              if (!newCommentText.trim()) return;
                              try {
                                const newComment = await addVideoComment(video.id, newCommentText.trim(), "0:00");
                                setVideos(videos.map(v => v.id === video.id ? { ...v, comments: [...(v.comments || []), newComment] } : v));
                                setNewCommentText('');
                              } catch(err) {
                                console.error("Failed to add comment", err);
                                showToast("Failed to post comment");
                              }
                            }}
                            disabled={!newCommentText.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-full px-4 py-2 text-[13px] font-semibold transition-colors shadow-sm"
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
                <h2 className="text-[20px] font-bold text-slate-900">Share</h2>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 rounded-lg text-[13px] font-semibold text-slate-600">
                    <Globe size={16} /> Social
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 rounded-lg text-[13px] font-semibold text-slate-600">
                    <Code size={16} /> Embed
                  </button>
                  <button onClick={() => setShareModalVideoId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 ml-2">
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
                      className="w-full pl-4 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-[14px] text-slate-900 focus:border-[#0E71EB] focus:ring-1 focus:ring-[#0E71EB] outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-[13px] font-medium text-slate-500 cursor-pointer hover:text-slate-700 whitespace-nowrap">
                    Import from <div className="w-4 h-4 bg-gradient-to-tr from-yellow-400 via-red-500 to-blue-500 rounded-sm inline-block mx-1"></div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-100 mb-6">
                  <div className="w-5 h-5 border border-slate-300 rounded flex items-center justify-center bg-white"><Plus size={14} className="text-slate-500"/></div>
                  <span className="text-[14px] text-slate-700">All harikishorereddy9908</span>
                </div>

                <div className="mb-2">
                  <h3 className="text-[12px] font-bold text-slate-900 mb-3">General access</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Globe size={20} className="text-green-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1 font-semibold text-[14px] text-slate-900 cursor-pointer">
                          Public <ChevronDown size={14} className="text-slate-500" />
                        </div>
                        <div className="text-[13px] text-slate-500">Anyone with the link can view</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between mt-4">
                <div className="flex items-center gap-6">
                  <button className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 hover:text-slate-900">
                    <LinkIcon size={16} /> Copy link
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#0E71EB] focus:ring-[#0E71EB] group-hover:border-slate-400 transition-colors" />
                    <span className="text-[13px] font-medium text-slate-700">Share video at 0:00</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 bg-[#A855F7] hover:bg-[#9333EA] text-white rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-1.5">
                    <Lock size={14} /> Set password
                  </button>
                  <button className="px-4 py-2 bg-slate-200 text-slate-400 rounded-lg text-[13px] font-semibold cursor-not-allowed">
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
                <h2 className="text-[18px] font-bold text-slate-900">Move 1 video</h2>
                <button onClick={() => setShowMoveModal(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 pb-20 pt-2 min-h-[160px]">
                {/* Hierarchy Tree UI matching Loom */}
                <div 
                  onClick={() => setMoveTargetFolderId('root')}
                  className={`w-full rounded-lg px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${moveTargetFolderId === 'root' ? 'bg-[#E3EBF8]' : 'hover:bg-slate-50'}`}
                >
                  <ChevronDown size={14} className="text-slate-600" />
                  <Folder size={18} className="text-slate-700" />
                  <span className="text-[14px] font-semibold text-slate-900">Library</span>
                </div>
                
                <div className="pl-12 pt-2 flex flex-col gap-1">
                  {courses.map(folder => (
                    <div 
                      key={folder.id}
                      onClick={() => setMoveTargetFolderId(folder.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-slate-800 font-medium text-[14px] transition-colors ${moveTargetFolderId === folder.id ? 'bg-[#E3EBF8]' : 'hover:bg-slate-50'}`}
                    >
                      <Folder size={16} className="text-slate-500" />
                      {folder.name}
                    </div>
                  ))}
                  
                  <div 
                    onClick={() => setMoveTargetFolderId('workspace')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-slate-800 font-medium text-[14px] mt-2 transition-colors ${moveTargetFolderId === 'workspace' ? 'bg-[#E3EBF8]' : 'hover:bg-slate-50'}`}
                  >
                    <div className="w-[18px] h-[18px] bg-[#FCD34D] text-[#B45309] text-[10px] font-bold flex items-center justify-center rounded shrink-0">
                      A
                    </div>
                    All harikishorereddy9908
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100">
                <button 
                  onClick={() => {}}
                  className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-2 py-1.5 rounded transition-colors"
                >
                  <Plus size={16} /> New Folder
                </button>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowMoveModal(null)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-[13px] font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmMoveVideo}
                    className="px-5 py-2 bg-[#0E71EB] hover:bg-[#1655B8] text-white rounded-lg text-[13px] font-semibold transition-colors shadow-sm"
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
        fontFamily: '"Atlassian Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, system-ui, "Helvetica Neue", sans-serif',
        fontSize: '14px',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '14px',
        letterSpacing: 'normal',
        color: active ? '#1D4ED8' : '#292A2E'
      }}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all ${
      active 
        ? "bg-blue-50 shadow-sm" 
        : "hover:bg-slate-50"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`${active ? "text-blue-600" : "text-slate-400"}`}>
          {icon}
        </div>
        <span className="text-sm tracking-wide">{label}</span>
      </div>
      {external && <div className="text-slate-400"><Share2 size={12} className="rotate-45" /></div>}
    </div>
  );
}

function DropdownItem({ label, onClick }: { label: string, onClick?: () => void }) {
  return (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="w-full text-left px-4 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
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
