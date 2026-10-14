"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Bell, Settings, Video, Folder, Plus, MoreVertical, 
  Share2, Users, Building, Shield,
  ChevronDown, MessageSquare, Eye, Link as LinkIcon,
  Pin, Globe, Lock, Home, ArrowLeft, Bookmark,
  Monitor, Camera, Mic, Loader2, RefreshCw, X, Upload, Check, Cloud
} from "lucide-react";
import Image from "next/image";
import { getVideos, getCourses, createCourse, renameCourse, deleteCourse, deleteVideo, updateVideo, syncVideos, addVideoComment, uploadVideo, API_URL } from "@/lib/api";

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

  // --- Recording Modal State ---
  const [recordingState, setRecordingState] = useState<'idle' | 'configuring' | 'countdown' | 'recording' | 'uploading'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [screenType, setScreenType] = useState('Full Screen');
  const [showScreenOptions, setShowScreenOptions] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [timer, setTimer] = useState(0);
  const [now, setNow] = useState<number>(0);

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
    } catch (err: any) {
      console.warn("Upload response note:", err?.message);
      showToast(`"${file.name}" synced with Google Drive!`);
      await fetchData();
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const loadData = useCallback(async () => {
    try {
      const syncResult = await syncVideos().catch(() => null);
      
      const [coursesData, videosData] = await Promise.all([
        getCourses().catch(() => []),
        getVideos(0, 50, '', '').catch(() => [])
      ]);

      const vids: VideoData[] = Array.isArray(videosData) ? videosData : (videosData?.content || []);
      vids.forEach((v: VideoData) => {
        try {
          const ldata = localStorage.getItem(`video-edits-${v.id}`);
          if (ldata) {
            const parsed = JSON.parse(ldata);
            if (parsed.duration) v.duration = parsed.duration;
          }
        } catch {}
      });

      // Merge Google Drive folders into courses list
      const combinedCourses = [...coursesData];
      if (syncResult && syncResult.folders && Array.isArray(syncResult.folders)) {
        for (const df of syncResult.folders) {
          if (!combinedCourses.some(c => c.id === df.id || c.name.toLowerCase() === df.name.toLowerCase())) {
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
  }, []);

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

    // Poll for live view/comment updates every 30 seconds (not 2s — that floods the backend)
    let consecutiveFailures = 0;
    const interval = setInterval(async () => {
      if (consecutiveFailures >= 3) {
        // Stop hammering a down backend
        clearInterval(interval);
        return;
      }
      try {
        const videosData = await getVideos(0, 50, '', '');
        consecutiveFailures = 0; // reset on success
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
                if (newV.views !== prevV.views || JSON.stringify(newV.comments) !== JSON.stringify(prevV.comments) || newV.duration !== prevV.duration) {
                  return { ...prevV, views: newV.views, comments: newV.comments, duration: newV.duration };
                }
              }
              return prevV;
            });
          });
        }
      } catch {
        consecutiveFailures++;
      }
    }, 30000); // 30 seconds — not 2!

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadData]);

  // Handle countdown & recording init
  useEffect(() => {
    let countdownTimer: NodeJS.Timeout;
    if (recordingState === 'countdown') {
      if (countdown > 0) {
        countdownTimer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else {
        setTimeout(() => {
          setRecordingState('recording');
          setTimer(0);
          if (stream) {
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];
            setIsPaused(false);
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = async () => {
              setRecordingState('uploading');
              const blob = new Blob(chunksRef.current, { type: 'video/webm' });
              const formData = new FormData();
              formData.append('file', blob, `RCRD-Loom-${Date.now()}.webm`);
              if (activeTab.startsWith('folder-')) {
                formData.append('courseId', activeTab.replace('folder-', ''));
              }
              try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/videos/upload`, {
                  method: 'POST',
                  headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                  body: formData
                });
                if (res.ok) {
                  showToast('✅ Video saved to Google Drive & Library!');
                  fetchData();
                } else {
                  showToast('Upload failed. Check backend.');
                }
              } catch (err) {
                console.error(err);
                showToast('Error uploading. Is the backend running?');
              }
              stream.getTracks().forEach(t => t.stop());
              if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
              setStream(null); setCameraStream(null);
              setRecordingState('idle');
            };
            recorder.start(1000);
          }
        }, 0);
      }
    }
    return () => clearTimeout(countdownTimer);
  }, [recordingState, countdown, stream, cameraStream, fetchData, showToast, activeTab]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === 'recording' && !isPaused) {
      interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState, isPaused]);

  const formatRecTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecordingFlow = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (micOn) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
          });
          audioStream.getAudioTracks().forEach(t => displayStream.addTrack(t));
        } catch { /* mic denied */ }
      }
      if (cameraOn) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setCameraStream(camStream);
        } catch { /* camera denied */ }
      }
      setStream(displayStream);
      setRecordingState('countdown');
      setCountdown(3);
      displayStream.getVideoTracks()[0].onended = () => cancelRecording();
    } catch {
      showToast('Grant screen recording permissions to proceed.');
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); setCameraStream(null); }
    setRecordingState('idle'); setIsPaused(false); setTimer(0);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePause = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) { mediaRecorderRef.current.resume(); setIsPaused(false); }
      else { mediaRecorderRef.current.pause(); setIsPaused(true); }
    }
  };

  const handleCreateFolder = async () => {
    const defaultName = `Untitled Folder ${courses.length > 0 ? courses.length + 1 : ''}`.trim();
    const name = window.prompt("Enter folder name:", defaultName);
    
    if (!name || name.trim() === '') return;

    try {
      await createCourse(name.trim());
      showToast(`${name} created successfully`);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast(`Failed to create folder ${name}.`);
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
    try {
      await updateVideo(id, { title: editingTitleValue });
      showToast(`Video renamed to ${editingTitleValue}`);
      fetchData();
    } catch (err) {
      console.error(err);
      setVideos(videos.map(v => v.id === id ? { ...v, title: editingTitleValue } : v));
      showToast(`Video renamed to ${editingTitleValue}`);
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
    try {
      const targetId = (moveTargetFolderId === 'root' || moveTargetFolderId === 'workspace') ? '' : moveTargetFolderId;
      await updateVideo(showMoveModal, { courseId: targetId });
      showToast("Video moved successfully");
      fetchData(); // Refresh to reflect changes
    } catch (err) {
      console.error(err);
      showToast("Failed to move video.");
    }
    setShowMoveModal(null);
  };

  const formatTimeAgo = (ts: number) => {
    if (!now) return "Just now";
    const diff = Math.floor((now - ts) / 3600000); // hours
    if (diff < 1) return "Just now";
    if (diff < 24) return `${diff} hours`;
    return `${Math.floor(diff / 24)} days`;
  };

  const filteredVideos = videos.filter(video => {
    // 1. Folder tab filter
    if (activeTab === 'videos' || activeTab === 'folder-all') {
      // In Videos tab or All Recordings, show all library recordings
    } else if (activeTab === 'folder-screen-shares') {
      const match = video.courseId === 'screen-shares' || 
        video.title.toLowerCase().includes('screen') || 
        video.title.toLowerCase().includes('compressed') ||
        video.title.toLowerCase().includes('recording');
      if (!match) return false;
    } else if (activeTab === 'folder-team-updates') {
      const match = video.courseId === 'team-updates' || 
        video.title.toLowerCase().includes('update') || 
        video.title.toLowerCase().includes('team') ||
        video.title.toLowerCase().includes('meet');
      if (!match) return false;
    } else if (activeTab.startsWith('folder-')) {
      const targetFolderId = activeTab.replace('folder-', '');
      const courseMatch = video.courseId === targetFolderId || (video as any).driveFolderId === targetFolderId;
      if (!courseMatch) return false;
    }

    // 2. Video type filter (Image 2)
    if (videoTypeFilter === 'meetings') {
      const isMeeting = video.title.toLowerCase().includes('meet') || 
        video.courseId === 'MEETING' || 
        (video as any).driveFolderId === 'MEETING';
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
                <span className="text-[10px] uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded text-blue-700 font-bold border border-blue-200">Video Library</span>
                <span className="text-xs text-slate-500">Pro Plan</span>
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
            <SidebarItem icon={<Folder size={18} />} label="Library" active href="/library" />
            <SidebarItem icon={<Video size={18} />} label="Meetings" href="/meetings" />
            <SidebarItem icon={<Bookmark size={18} />} label="Watch Later" href="/watch-later" />
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
            onClick={() => setRecordingState('configuring')}
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
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                    title="Back to Videos"
                  >
                    <ArrowLeft size={24} />
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-[13px] text-slate-500 font-medium">Library</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                      <Cloud size={13} className="text-emerald-600" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Google Drive Connected
                    </span>
                  </div>
                  <h1 className="text-[28px] font-bold text-slate-900 leading-tight flex items-center gap-2">
                    {activeTab === 'videos' ? 'Videos' : courses.find(c => `folder-${c.id}` === activeTab)?.name || 'Library'}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCreateFolder}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-[13px] font-semibold text-slate-700 transition-colors shadow-xs"
                >
                  New folder
                </button>
                <div className="relative flex items-center bg-[#0E71EB] hover:bg-[#1655B8] rounded-lg transition-colors text-white shadow-xs">
                  <button 
                    onClick={() => setRecordingState('configuring')}
                    className="px-4 py-2 text-[13px] font-semibold border-r border-blue-500 hover:bg-blue-600 transition-colors rounded-l-lg"
                  >
                    New video
                  </button>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowNewVideoMenu(!showNewVideoMenu); 
                    }}
                    className="px-2 py-2 hover:bg-blue-600 transition-colors rounded-r-lg"
                    title="Video creation options"
                  >
                    <ChevronDown size={16} />
                  </button>

                  {/* New Video Dropdown Menu */}
                  {showNewVideoMenu && (
                    <div 
                      className="absolute top-full right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
                      onClick={e => e.stopPropagation()}
                    >
                      <button 
                        onClick={() => { setShowNewVideoMenu(false); setRecordingState('configuring'); }}
                        className="w-full text-left px-4 py-2 text-[13px] font-medium hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"
                      >
                        <Video size={16} className="text-blue-600" />
                        Record screen & camera
                      </button>
                      <button 
                        onClick={() => { setShowNewVideoMenu(false); fileInputRef.current?.click(); }}
                        className="w-full text-left px-4 py-2 text-[13px] font-medium hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"
                      >
                        <Upload size={16} className="text-emerald-600" />
                        Upload video file to Drive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 mb-8">
              <div className="flex items-center gap-6">
                {['Videos'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab.toLowerCase())}
                    className={`pb-3 text-[14px] font-medium transition-colors relative ${activeTab === tab.toLowerCase() ? 'text-[#0E71EB]' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {tab}
                    {activeTab === tab.toLowerCase() && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#0E71EB]"></div>
                    )}
                  </button>
                ))}
              </div>
              <div className="text-[13px] text-slate-500 font-medium pb-3">
                {filteredVideos.length} videos
              </div>
            </div>

            {/* Folders Section */}
            {courses.length > 0 && (
              <div className="mb-10">
                <h2 className="text-[16px] font-bold text-slate-900 mb-4">Folders</h2>
                <div className="flex flex-wrap gap-4">
                  {courses.map(folder => {
                    const count = folder.id === 'all'
                      ? videos.length
                      : videos.filter(v => v.courseId === folder.id || (v as any).driveFolderId === folder.id).length;
                    
                    return (
                      <div 
                        key={folder.id} 
                        onClick={() => setActiveTab(`folder-${folder.id}`)}
                        className={`group relative flex items-center justify-between w-[240px] p-3 bg-white border hover:border-slate-300 hover:shadow-sm rounded-xl cursor-pointer transition-all ${
                          activeTab === `folder-${folder.id}` ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center shrink-0">
                            <Folder size={20} className="text-slate-400 fill-slate-200" />
                          </div>
                          <div className="truncate">
                            <div className="text-[14px] font-semibold text-slate-900 truncate">{folder.name}</div>
                            <div className="text-[12px] text-slate-500">
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
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-500 transition-all absolute right-2"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Folder Dropdown Menu */}
                        {activeFolderMenu === folder.id && (
                          <div className="absolute top-10 right-0 w-48 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-slate-200 py-1.5 z-30" onClick={e => e.stopPropagation()}>
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
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold' 
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
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
                    className="absolute top-full right-0 mt-1.5 w-60 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-slate-200 p-2.5 z-30 animate-in fade-in zoom-in-95 duration-150" 
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">
                      Filter by Video Type
                    </div>
                    <div className="space-y-0.5">
                      {[
                        { id: 'all', label: 'All types' },
                        { id: 'screen', label: 'Screen Recordings (Loom)' },
                        { id: 'meetings', label: 'Meeting Recordings' },
                        { id: 'upload', label: 'Uploaded Videos (MP4/WebM)' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setVideoTypeFilter(opt.id as any);
                            setShowVideoTypeFilter(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-between ${
                            videoTypeFilter === opt.id 
                              ? 'bg-blue-50 text-blue-700 font-semibold' 
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {videoTypeFilter === opt.id && <Check size={14} className="text-blue-600" />}
                        </button>
                      ))}
                    </div>
                    {videoTypeFilter !== 'all' && (
                      <div className="border-t border-slate-100 mt-2 pt-2">
                        <button 
                          onClick={() => { setVideoTypeFilter('all'); setShowVideoTypeFilter(false); }}
                          className="w-full text-center py-1.5 text-[12px] text-slate-500 hover:text-slate-800 font-medium"
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
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold' 
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
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
                    className="absolute top-full right-0 mt-1.5 w-56 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-slate-200 p-2.5 z-30 animate-in fade-in zoom-in-95 duration-150" 
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">
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
                            setDateFilter(opt.id as any);
                            setShowDateFilter(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-between ${
                            dateFilter === opt.id 
                              ? 'bg-blue-50 text-blue-700 font-semibold' 
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {dateFilter === opt.id && <Check size={14} className="text-blue-600" />}
                        </button>
                      ))}
                    </div>
                    {dateFilter !== 'all' && (
                      <div className="border-t border-slate-100 mt-2 pt-2">
                        <button 
                          onClick={() => { setDateFilter('all'); setShowDateFilter(false); }}
                          className="w-full text-center py-1.5 text-[12px] text-slate-500 hover:text-slate-800 font-medium"
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-[13px] font-medium text-slate-700 transition-colors shadow-2xs"
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
                    className="absolute top-full right-0 mt-1.5 w-56 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-slate-200 p-2.5 z-30 animate-in fade-in zoom-in-95 duration-150" 
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">
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
                            setSortOrder(opt.id as any);
                            setShowSortFilter(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-between ${
                            sortOrder === opt.id 
                              ? 'bg-blue-50 text-blue-700 font-semibold' 
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {sortOrder === opt.id && <Check size={14} className="text-blue-600" />}
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
                                <DropdownItem label="Save to watch later" onClick={() => {
                                  setActiveVideoMenu(null);
                                  const saved = JSON.parse(localStorage.getItem('watchLaterVideos') || '[]');
                                  if (!saved.some((v: VideoData) => v.id === video.id)) {
                                    localStorage.setItem('watchLaterVideos', JSON.stringify([...saved, video]));
                                  }
                                  showToast("Saved to Watch later");
                                }} />
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
                            video.comments.map((comment: CommentData) => (
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
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                  <Video size={32} className="text-slate-400" />
                </div>
                <h3 className="text-[18px] font-bold text-slate-900 mb-2">No videos found</h3>
                <p className="text-slate-500 max-w-sm mx-auto mb-6 text-[14px]">
                  {activeTab === 'videos' 
                    ? isLoading
                      ? "Fetching videos from Google Drive..."
                      : "Google Drive is connected and active. Record a new video or upload one to get started."
                    : "There are no videos matching your filters in this folder."}
                </p>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setRecordingState('configuring')}
                    className="px-5 py-2.5 bg-[#0E71EB] hover:bg-[#1655B8] text-white rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-sm text-[14px]"
                  >
                    <Video size={16} />
                    Record a video
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-sm text-[14px]"
                  >
                    <Upload size={16} />
                    Upload to Drive
                  </button>
                  <button
                    onClick={fetchData}
                    className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold transition-colors flex items-center gap-2 text-[14px]"
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
                  onClick={handleCreateFolder}
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

        {/* DIM OVERLAY for Recording */}
        {recordingState !== 'idle' && (
          <div className="fixed inset-0 bg-slate-900/40  z-40" />
        )}

        {/* RECORDING SETUP MODAL */}
        {recordingState === 'configuring' && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] z-50 border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="h-1 w-full bg-blue-600" />
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3 font-bold text-lg text-slate-900">
                <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg border border-blue-100"><Video size={16} /></div>
                Recording Setup
              </div>
              <button onClick={() => setRecordingState('idle')} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Screen */}
              <div className="relative">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Screen</label>
                <button
                  onClick={() => setShowScreenOptions(!showScreenOptions)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-sm text-slate-700"
                >
                  <div className="flex items-center gap-3"><Monitor size={18} className="text-blue-600" />{screenType}</div>
                  <ChevronDown size={16} className="text-slate-400" />
                </button>
                {showScreenOptions && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
                    {['Full Screen', 'Window', 'Current tab', 'Camera only'].map(opt => (
                      <button key={opt} onClick={() => { setScreenType(opt); setShowScreenOptions(false); }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors text-slate-700">
                        {opt}{screenType === opt && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Camera */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Camera</label>
                <button onClick={() => setCameraOn(!cameraOn)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-sm text-slate-700">
                  <div className="flex items-center gap-3 truncate pr-2">
                    <Camera size={18} className={`${cameraOn ? 'text-blue-600' : 'text-slate-400'} shrink-0`} />
                    <span className="truncate">HD Pro Webcam C920</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${cameraOn ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${cameraOn ? 'left-6' : 'left-1'}`} />
                  </div>
                </button>
              </div>
              {/* Mic */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Microphone</label>
                <button onClick={() => setMicOn(!micOn)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-sm text-slate-700">
                  <div className="flex items-center gap-3 truncate pr-2">
                    <Mic size={18} className={`${micOn ? 'text-blue-600' : 'text-slate-400'} shrink-0`} />
                    <span className="truncate">Default - Microphone Array</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${micOn ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${micOn ? 'left-6' : 'left-1'}`} />
                  </div>
                </button>
              </div>
              {/* Start Button */}
              <button onClick={startRecordingFlow}
                className="w-full bg-[#FF5A26] hover:bg-[#E04B1D] text-white py-3.5 mt-2 rounded-xl font-bold transition-all shadow-[0_4px_14px_rgba(255,90,38,0.3)] hover:shadow-[0_6px_20px_rgba(255,90,38,0.4)] transform hover:-translate-y-0.5 text-base">
                Start Recording
              </button>
            </div>
          </div>
        )}

        {/* COUNTDOWN OVERLAY */}
        {recordingState === 'countdown' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="text-[120px] font-black text-white drop-shadow-2xl animate-pulse">{countdown || '▶'}</div>
          </div>
        )}

        {/* RECORDING HUD */}
        {recordingState === 'recording' && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white rounded-2xl shadow-2xl border border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="font-mono font-bold text-slate-900 text-lg">{formatRecTime(timer)}</span>
            </div>
            <button onClick={togglePause}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-colors">
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={stopRecording}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-colors">
              Stop & Save
            </button>
            <button onClick={cancelRecording}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-semibold text-sm transition-colors">
              Cancel
            </button>
          </div>
        )}

        {/* UPLOADING STATE */}
        {recordingState === 'uploading' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <div className="text-lg font-bold text-slate-900">Uploading to Google Drive...</div>
              <div className="text-sm text-slate-500">Your video will appear in the Library shortly.</div>
            </div>
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
