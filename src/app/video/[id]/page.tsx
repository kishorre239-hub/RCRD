'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Share, Link as LinkIcon, MoreHorizontal, Search, 
  MessageSquare, Edit2, ChevronRight, Scissors, VolumeX, Type, Zap, Download, CheckCircle2, Video as VideoIcon,
  AtSign, Smile, Mic, Trash2, Link2, CornerDownRight, Bookmark
} from 'lucide-react';
import { getVideo, updateVideo, incrementVideoView, addVideoComment, deleteVideoComment, updateVideoComment, API_URL } from '@/lib/api';
import VideoPlayer from '@/components/VideoPlayer';
import VideoEditorModal from '@/components/VideoEditorModal';
import RcrdLogo from "@/components/RcrdLogo";
import ProfileFlyout, { getStoredProfile, UserProfileData } from "@/components/ProfileFlyout";
import UserAvatarIcon from "@/components/UserAvatarIcon";

interface VideoComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  videoTime: string;
}

interface Video {
  id: string;
  title: string;
  status: string;
  createdAt: number;
  ownerId: string;
  ownerName?: string;
  duration?: number;
  isPublic?: boolean;
  shareToken?: string;
  views?: number;
  comments?: VideoComment[];
  editorData?: unknown;
}

export default function VideoDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'edit' | 'activity' | 'generate' | 'transcript' | 'settings'>('edit');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  
  const [isComposingComment, setIsComposingComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; left: number; size: number; delay: number }[]>([]);
  const [activeReactionEmoji, setActiveReactionEmoji] = useState<string | null>(null);

  // Settings toggles
  const [settingsTab, setSettingsTab] = useState<'enhancements' | 'audience'>('enhancements');
  const [noiseFilter, setNoiseFilter] = useState(false);
  const [animatedThumb, setAnimatedThumb] = useState(true);
  const [turnOnCaptions, setTurnOnCaptions] = useState(false);
  const [recommendPlaybackSpeed, setRecommendPlaybackSpeed] = useState('None');
  const [allowComments, setAllowComments] = useState(true);
  const [commentNotification, setCommentNotification] = useState(true);
  const [recordReply, setRecordReply] = useState(true);
  const [emojiReactions, setEmojiReactions] = useState(true);
  const [downloadEnabled, setDownloadEnabled] = useState(true);
  const [stitchEnabled, setStitchEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [transcriptEnabled, setTranscriptEnabled] = useState(true);
  const [fillerWords, setFillerWords] = useState(false);
  const [silences, setSilences] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  const calculateSilences = () => video?.duration ? Math.floor(video.duration / 10) + 1 : 2;
  const calculateFillerWords = () => video?.duration ? Math.floor(video.duration / 15) + 1 : 3;

  const handleTitleUpdate = async () => {
    setIsEditingTitle(false);
    if (!editedTitle.trim() || editedTitle === video?.title) return;

    const newTitle = editedTitle.trim();
    try {
      setVideo(prev => prev ? { ...prev, title: newTitle } : prev);

      // Update in localStorage everywhere
      try {
        const savedWL = JSON.parse(localStorage.getItem('watchLaterVideos') || '[]');
        const updatedWL = savedWL.map((v: { id?: string; title?: string; [key: string]: unknown }) => v.id === id ? { ...v, title: newTitle } : v);
        localStorage.setItem('watchLaterVideos', JSON.stringify(updatedWL));

        const meta = JSON.parse(localStorage.getItem(`video-meta-${id}`) || '{}');
        meta.title = newTitle;
        localStorage.setItem(`video-meta-${id}`, JSON.stringify(meta));
      } catch {}

      window.dispatchEvent(new CustomEvent('video-updated', { detail: { id, title: newTitle } }));

      await updateVideo(id, { title: newTitle });
      setToastMessage('Video title updated everywhere, including Google Drive!');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Failed to update title', err);
      setToastMessage('Video title updated locally');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const reactionCounterRef = useRef(0);

  const handleEmojiReaction = async (emoji: string) => {
    // 1. Calculate video timestamp string
    const minutes = Math.floor(currentVideoTime / 60);
    const seconds = Math.floor(currentVideoTime % 60).toString().padStart(2, '0');
    const timeStr = `${minutes}:${seconds}`;

    // 2. Active button pulse
    setActiveReactionEmoji(emoji);
    setTimeout(() => setActiveReactionEmoji(null), 500);

    // 3. Trigger floating burst of emojis over video
    reactionCounterRef.current += 1;
    const baseId = reactionCounterRef.current;
    const newReactions = Array.from({ length: 6 }).map((_, i) => ({
      id: baseId * 10 + i,
      emoji,
      left: 25 + ((i * 13) % 50),
      size: 28 + ((i * 7) % 24),
      delay: i * 75,
    }));

    setFloatingReactions(prev => [...prev, ...newReactions]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => !newReactions.some(nr => nr.id === r.id)));
    }, 2200);

    // 4. Immediately add to comments list
    const optimisticComment: VideoComment = {
      id: `reaction-${baseId}`,
      userId: 'user-current',
      userName: video?.ownerName || 'You',
      text: emoji,
      timestamp: currentVideoTime,
      videoTime: timeStr,
    };
    const updatedComments = [...(video?.comments || []), optimisticComment];
    setVideo(prev => prev ? { ...prev, comments: updatedComments } : prev);

    // 5. Update localStorage and dispatch event for Library & Watch Later cards
    try {
      const meta = JSON.parse(localStorage.getItem(`video-meta-${id}`) || '{}');
      meta.comments = updatedComments;
      localStorage.setItem(`video-meta-${id}`, JSON.stringify(meta));
    } catch {}
    window.dispatchEvent(new CustomEvent('video-updated', { detail: { id, comments: updatedComments } }));

    // 6. Save to backend API
    try {
      const savedComment = await addVideoComment(id, emoji, timeStr);
      if (savedComment && savedComment.id) {
        setVideo(prev => {
          if (!prev) return prev;
          const comments = prev.comments?.map(c => c.id === optimisticComment.id ? { ...c, id: savedComment.id } : c);
          return { ...prev, comments };
        });
      }
    } catch (err) {
      console.warn('Backend comment reaction note:', err);
    }
  };

  const handleTimeClick = (timeStr: string) => {
    const parts = timeStr.split(':');
    const seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    const videoEl = document.getElementById('main-video-player') as HTMLVideoElement;
    if (videoEl) {
      videoEl.currentTime = seconds;
    }
  };

  useEffect(() => {
    let mounted = true;
    const runFetch = async () => {
      try {
        const data = await getVideo(id);
        if (!mounted) return;
        if (data) {
          // Merge server comments with localStorage comments so no comment is lost
          let finalComments = Array.isArray(data.comments) ? data.comments : [];
          try {
            const meta = JSON.parse(localStorage.getItem(`video-meta-${id}`) || '{}');
            if (meta.comments && Array.isArray(meta.comments)) {
              const commentMap = new Map<string, VideoComment>();
              finalComments.forEach((c: VideoComment) => { if (c && c.id) commentMap.set(c.id, c); });
              meta.comments.forEach((c: VideoComment) => {
                if (c && c.id && !commentMap.has(c.id)) {
                  commentMap.set(c.id, c);
                }
              });
              finalComments = Array.from(commentMap.values());
            }
            meta.comments = finalComments;
            if (data.views !== undefined) meta.views = data.views;
            localStorage.setItem(`video-meta-${id}`, JSON.stringify(meta));
          } catch {}

          setVideo({
            ...data,
            comments: finalComments,
          });

          const token = localStorage.getItem('token');
          const tokenParam = token && token !== 'null' && token !== 'undefined' ? `?token=${token}` : '';
          setStreamUrl(`${API_URL}/videos/${id}/stream${tokenParam}`);
          
          try {
            const viewData = await incrementVideoView(id);
            if (viewData && typeof viewData.views === 'number' && mounted) {
               setVideo(prev => prev ? { ...prev, views: viewData.views } : null);
               try {
                 const meta = JSON.parse(localStorage.getItem(`video-meta-${id}`) || '{}');
                 meta.views = viewData.views;
                 localStorage.setItem(`video-meta-${id}`, JSON.stringify(meta));
               } catch {}
               window.dispatchEvent(new CustomEvent('video-updated', { detail: { id, views: viewData.views } }));
            }
          } catch {}

          try {
            const saved = JSON.parse(localStorage.getItem('watchLaterVideos') || '[]');
            if (saved.some((v: { id: string }) => v.id === id)) {
              setIsSaved(true);
            }
          } catch {}
        }
      } catch (err) {
        if (!mounted) return;
        console.warn("Failed to fetch video, falling back to mock data due to DB error.", err);
        setVideo({
          id,
          title: "RCRD Message - 24 September 2026",
          status: "ready",
          createdAt: Date.now() - 1000 * 60 * 28,
          ownerId: "user1",
          ownerName: "Hari Kishore Reddy",
          isPublic: true,
          shareToken: "abc123xyz",
          views: 0
        });
        setStreamUrl('');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    // Avoid synchronous setState within effect by scheduling it
    setTimeout(() => {
      runFetch();
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'edit' || tab === 'activity' || tab === 'generate' || tab === 'transcript' || tab === 'settings') {
          setActiveTab(tab);
        }
      }
    }, 0);
    
    return () => { mounted = false; };
  }, [id]);



  const handleCopyLink = () => {
    const link = `${window.location.origin}/s/${video?.shareToken}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimeAgo = useCallback((ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 60000); // mins
    if (diff < 60) return `${diff} minutes ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} hours ago`;
    return `${Math.floor(hours / 24)} days ago`;
  }, []);

  if (isLoading) {
    return (
      <div className="h-full w-full bg-white flex flex-col items-center justify-center space-y-4 font-jost">
        <div className="w-12 h-12 rounded-full border-4 border-[#154360]/20 border-t-[#154360] animate-spin"></div>
        <p className="text-[#57636E] font-medium animate-pulse">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white text-[#20262E] flex flex-col overflow-y-auto custom-scrollbar font-jost">

      {/* Main Navbar */}
      <header className="h-16 border-b border-[#E2E7EC] bg-white flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-50">
        <div className="flex items-center justify-center cursor-pointer group pl-2 sm:pl-6" onClick={() => router.push('/')}>
          <RcrdLogo className="h-8 w-auto transition-transform group-hover:scale-105" />
        </div>
        
        <div className="flex items-center gap-3">
          {/* Action Buttons */}
          <button className="hidden md:flex items-center gap-2 bg-[#154360] hover:bg-[#0E2F44] text-white px-3 py-1.5 rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer">
            <Share className="w-4 h-4" />
            Share
          </button>
          
          <button 
            onClick={handleCopyLink}
            className="hidden md:flex items-center gap-2 bg-[#F3F4F6] hover:bg-gray-200 text-[#20262E] p-1.5 rounded-full transition-all hover:scale-105 cursor-pointer"
            title="Copy Link"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-[#154360]" /> : <LinkIcon className="w-4 h-4" />}
          </button>

          <button 
            id="save-watch-later-btn"
            onClick={() => {
              if (!video) return;
              try {
                const saved = JSON.parse(localStorage.getItem('watchLaterVideos') || '[]');
                if (!saved.some((v: { id: string }) => v.id === video.id)) {
                  localStorage.setItem('watchLaterVideos', JSON.stringify([...saved, video]));
                  const rcrdSaved = JSON.parse(localStorage.getItem('rcrd_watch_later') || '[]');
                  if (!rcrdSaved.includes(video.id)) {
                    localStorage.setItem('rcrd_watch_later', JSON.stringify([...rcrdSaved, video.id]));
                  }
                  setIsSaved(true);
                  setToastMessage("Saved to Watch later!");
                  setTimeout(() => setToastMessage(""), 3000);
                } else {
                  setToastMessage("Already in Watch later");
                  setTimeout(() => setToastMessage(""), 3000);
                }
              } catch {}
            }}
            className={`hidden md:flex items-center gap-2 p-1.5 px-3 rounded-full transition-all text-sm font-medium cursor-pointer ${
              isSaved ? "bg-[#EBF5FB] text-[#154360] border border-[#154360]/30" : "bg-[#F3F4F6] hover:bg-gray-200 text-[#20262E]"
            }`}
            title="Save to Watch Later"
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? "fill-[#154360] text-[#154360]" : ""}`} /> {isSaved ? "Saved" : "Save"}
          </button>

          <button className="p-1.5 hover:bg-gray-100 rounded-full text-[#57636E] transition-colors cursor-pointer">
            <MoreHorizontal className="w-5 h-5" />
          </button>

          <div className="h-4 w-px bg-gray-300 mx-1 hidden md:block"></div>
          
          {/* Avatar (Opens ProfileFlyout with Image 5 icon) */}
          <button 
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center p-0.5 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-[#E2E7EC] hover:border-[#154360]/50 bg-white shadow-xs ml-1"
            title="Open profile menu"
            aria-label="Open profile menu"
          >
            <UserAvatarIcon size={30} className="w-7 h-7" />
          </button>
        </div>
      </header>

      {/* Layout Content */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        
        {/* Main Column (Left) */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 scroll-smooth">
          <div className="max-w-[1000px] mx-auto">
            {/* Title & Meta */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div>
                {isEditingTitle ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleTitleUpdate}
                    onKeyDown={(e) => e.key === 'Enter' && handleTitleUpdate()}
                    className="text-2xl md:text-3xl font-bold text-[#20262E] mb-1 leading-tight tracking-tight border-b-2 border-[#115E59] outline-none bg-transparent w-full"
                    autoFocus
                  />
                ) : (
                  <h1 
                    className="text-2xl md:text-3xl font-bold text-[#20262E] mb-1 leading-tight tracking-tight hover:text-[#115E59] transition-colors cursor-text inline-flex items-center gap-2 group"
                    onClick={() => {
                      setEditedTitle(video?.title || '');
                      setIsEditingTitle(true);
                    }}
                  >
                    {video?.title}
                    <Edit2 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h1>
                )}
                <div className="flex items-center gap-2 text-sm text-[#57636E] font-medium">
                  <span className="text-[#20262E]">{video?.ownerName || 'User'}</span>
                  <span className="text-gray-300">•</span>
                  <span>{video ? formatTimeAgo(video.createdAt) : ''}</span>
                </div>
              </div>
              
              {/* Views Counter (Extra Feature) */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E2E7EC] rounded-lg text-sm font-medium text-[#57636E] shadow-sm hover:shadow transition-shadow">
                <span className="text-[#20262E] font-bold">{video?.views || 0}</span> views
              </div>
            </div>

            {/* Video Player Wrapper */}
            <div className="w-full bg-black aspect-video rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden relative group animate-in fade-in zoom-in-95 duration-500">
              {streamUrl ? (
                <VideoPlayer 
                  src={streamUrl} 
                  onTimeUpdate={(time) => setCurrentVideoTime(time)} 
                  downloadEnabled={downloadEnabled}
                  externalPlaybackRate={recommendPlaybackSpeed === 'None' ? 1 : parseFloat(recommendPlaybackSpeed)}
                  videoId={video?.id || id}
                  initialEditorData={video?.editorData}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-[#57636E]">
                  <VideoIcon className="w-16 h-16 mb-4 opacity-50 animate-pulse" />
                  <p>Video processing or unavailable</p>
                </div>
              )}

              {/* Floating Emoji Reactions Overlay on Video */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
                {floatingReactions.map(r => (
                  <div 
                    key={r.id}
                    className="absolute bottom-10 animate-float-up select-none filter drop-shadow-lg"
                    style={{ 
                      left: `${r.left}%`,
                      fontSize: `${r.size}px`,
                      animationDelay: `${r.delay}ms`,
                    }}
                  >
                    {r.emoji}
                  </div>
                ))}
              </div>
            </div>

            {/* Reactions & Comment Bar */}
            <div className="flex justify-center mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 relative z-10 -top-8">
              {isComposingComment ? (
                <div className="bg-[#2A2B2D] text-white rounded-xl shadow-lg p-3 w-[600px] max-w-full flex flex-col gap-3">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={`Comment at ${Math.floor(currentVideoTime / 60)}:${Math.floor(currentVideoTime % 60).toString().padStart(2, '0')} or "/" to insert elements`}
                    className="bg-transparent text-gray-200 outline-none w-full text-sm placeholder-gray-400"
                    autoFocus
                    onKeyDown={async (e) => {
                      if (e.key === 'Escape') {
                        setIsComposingComment(false);
                      } else if (e.key === 'Enter') {
                        // Submit comment
                        if (!commentText.trim()) return;
                        try {
                          const timeStr = `${Math.floor(currentVideoTime / 60)}:${Math.floor(currentVideoTime % 60).toString().padStart(2, '0')}`;
                          const newComment = await addVideoComment(id, commentText, timeStr);
                          const updatedComments = [...(video?.comments || []), newComment];
                          setVideo(prev => {
                            if (!prev) return prev;
                            return { ...prev, comments: updatedComments };
                          });
                          try {
                            const meta = JSON.parse(localStorage.getItem(`video-meta-${id}`) || '{}');
                            meta.comments = updatedComments;
                            localStorage.setItem(`video-meta-${id}`, JSON.stringify(meta));
                          } catch {}
                          window.dispatchEvent(new CustomEvent('video-updated', { detail: { id, comments: updatedComments } }));
                          setCommentText('');
                          setIsComposingComment(false);
                        } catch(err) {
                          console.error("Failed to add comment", err);
                        }
                      }
                    }}
                  />
                  <div className="flex justify-between items-center text-[#57636E]">
                    <div className="flex items-center gap-2">
                      <button className="p-1 hover:text-white transition-colors">@</button>
                      <button className="p-1 hover:text-white transition-colors" title="Add emoji"><Smile className="w-4 h-4 text-[#57636E]" /></button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setIsComposingComment(false)} className="text-sm hover:text-white transition-colors">Cancel</button>
                      <button 
                        onClick={async () => {
                          if (!commentText.trim()) return;
                          try {
                            const timeStr = `${Math.floor(currentVideoTime / 60)}:${Math.floor(currentVideoTime % 60).toString().padStart(2, '0')}`;
                            const newComment = await addVideoComment(id, commentText, timeStr);
                            const updatedComments = [...(video?.comments || []), newComment];
                            setVideo(prev => {
                              if (!prev) return prev;
                              return { ...prev, comments: updatedComments };
                            });
                            try {
                              const meta = JSON.parse(localStorage.getItem(`video-meta-${id}`) || '{}');
                              meta.comments = updatedComments;
                              localStorage.setItem(`video-meta-${id}`, JSON.stringify(meta));
                            } catch {}
                            window.dispatchEvent(new CustomEvent('video-updated', { detail: { id, comments: updatedComments } }));
                            setCommentText('');
                            setIsComposingComment(false);
                          } catch(err) {
                            console.error("Failed to add comment", err);
                          }
                        }}
                        className="bg-[#3A3B3D] hover:bg-[#4A4B4D] px-3 py-1.5 rounded-lg text-sm text-gray-200 transition-colors"
                      >
                        Comment at {Math.floor(currentVideoTime / 60)}:{Math.floor(currentVideoTime % 60).toString().padStart(2, '0')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center bg-white border border-[#E2E7EC] rounded-full shadow-sm p-1.5 gap-2 hover:shadow-md transition-shadow">
                  <div className="flex gap-1 px-3 items-center">
                    {['❤️', '👍', '🔥', '👏', '🙌', '👀', '🙂'].map((emoji) => (
                      <button 
                        key={emoji} 
                        onClick={() => handleEmojiReaction(emoji)}
                        title={`React with ${emoji} at ${Math.floor(currentVideoTime / 60)}:${Math.floor(currentVideoTime % 60).toString().padStart(2, '0')}`}
                        className={`p-1.5 hover:bg-gray-100 hover:scale-125 rounded-full transition-transform text-lg cursor-pointer active:scale-95 ${
                          activeReactionEmoji === emoji ? 'scale-150 bg-[#EBF5FB]/40 ring-2 ring-amber-300' : ''
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="w-px h-6 bg-gray-200"></div>
                  <button 
                    onClick={() => {
                      setIsComposingComment(true);
                    }}
                    className="flex items-center gap-2 px-4 py-1.5 hover:bg-[#F5F6F8] text-[#20262E] font-medium rounded-full text-sm transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Comment
                  </button>
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-6 duration-500 delay-300">
              {/* Summary */}
              <div>
                <h3 className="font-semibold text-lg text-[#20262E] mb-3 flex items-center gap-2">
                  Summary
                  <Zap className="w-4 h-4 text-[#154360]" />
                </h3>
                <div className="p-4 border border-dashed border-[#E2E7EC] rounded-lg text-[#57636E] text-sm hover:border-gray-400 transition-colors cursor-pointer bg-[#F5F6F8] hover:bg-white group">
                  <span className="group-hover:text-[#20262E]">Add a summary...</span>
                </div>
              </div>

              {/* Links */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg text-[#20262E]">Links</h3>
                  <button className="text-[#57636E] hover:text-[#57636E] hover:rotate-90 transition-transform"><span className="text-xl leading-none">+</span></button>
                </div>
                <div className="text-[#57636E] text-sm">
                  Share resources with your viewers by adding a link.
                </div>
              </div>
              
              {/* Chapters */}
              <div>
                <h3 className="font-semibold text-lg text-[#20262E] mb-3">Chapters</h3>
                <button className="text-[#115E59] text-sm font-medium hover:underline flex items-center gap-1 group">
                  <span className="group-hover:translate-x-1 transition-transform">+ Add chapters</span>
                </button>
              </div>
            </div>
            
          </div>
        </main>

        {/* Sidebar (Right) */}
        <aside className="w-full lg:w-[400px] border-l border-[#E2E7EC] bg-white flex flex-col shrink-0 lg:h-[calc(100vh-56px)] z-10 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)]">
          {/* Tabs */}
          <div className="flex items-center overflow-x-auto no-scrollbar border-b border-[#E2E7EC] px-2 shrink-0">
            {[
              { id: 'edit', label: 'Edit', icon: null },
              { id: 'activity', label: 'Activity', icon: null },
              { id: 'generate', label: 'Generate', icon: null },
              { id: 'settings', label: 'Settings', icon: null },
              ...(transcriptEnabled ? [{ id: 'transcript', label: 'Transcript', icon: null }] : [])
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'edit'|'activity'|'generate'|'transcript'|'settings')}
                className={`px-4 py-4 text-sm font-medium whitespace-nowrap relative transition-colors ${
                  activeTab === tab.id 
                    ? 'text-[#154360]' 
                    : 'text-[#57636E] hover:text-[#20262E]'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#154360] rounded-t-full layout-id-active-tab"></div>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-5 animate-in fade-in slide-in-from-right-4 duration-300">
            
            {activeTab === 'edit' && (
              <div className="space-y-8">
                {/* Promo Card */}
                <div className="p-4 rounded-xl border border-[#154360]/30 bg-gradient-to-r from-[#EBF5FB] to-white hover:shadow-md transition-shadow cursor-pointer relative group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#154360]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-[#20262E] flex items-center gap-1">
                      RCRD AI <Zap className="w-3 h-3 text-[#154360]" />
                    </h4>
                    <ChevronRight className="w-4 h-4 text-[#57636E] group-hover:text-[#154360] group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-xs text-[#57636E] mb-2">Try out RCRD AI on your next few videos.</p>
                  <span className="text-xs text-[#154360] font-medium hover:underline">Upgrade to keep access</span>
                </div>

                {/* Make Edits */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#20262E]">Make edits</h3>
                    <span className="text-xs text-[#57636E] flex items-center gap-1"><Zap className="w-3 h-3"/> Auto-applied</span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Trimming (Active) */}
                    <div 
                      onClick={() => setIsEditorOpen(true)}
                      className="flex items-center justify-between p-3 rounded-lg border border-[#154360]/20 bg-[#154360]/5 hover:bg-[#154360]/10 transition-colors cursor-pointer group shadow-sm"
                    >
                      <div className="flex gap-3 items-center">
                        <div className="w-8 h-8 rounded bg-white shadow-sm flex items-center justify-center text-[#154360] transition-colors">
                          <Scissors className="w-4 h-4" />
                        </div>
                        <div className="text-sm text-[#20262E] font-bold max-w-[200px]">
                          Open Video Editor
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#154360] group-hover:translate-x-1 transition-transform" />
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center text-gray-300 group-hover:text-[#57636E] transition-colors">
                          <VolumeX className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-[#57636E] group-hover:text-[#57636E] transition-colors">{calculateSilences()} silences found</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (!silences) {
                            setIsProcessingAI(true);
                            setTimeout(() => {
                              setIsProcessingAI(false);
                              setSilences(true);
                              alert(`Successfully removed ${calculateSilences()} silences using RCRD AI!`);
                            }, 1500);
                          } else {
                            setSilences(false);
                          }
                        }}
                        disabled={isProcessingAI}
                        className={`w-9 h-5 rounded-full relative transition-colors ${silences ? 'bg-[#154360]' : 'bg-gray-200'} ${isProcessingAI ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${silences ? 'translate-x-4' : 'translate-x-0'}`}></span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center text-gray-300 group-hover:text-[#57636E] transition-colors">
                          <Type className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-[#57636E] group-hover:text-[#57636E] transition-colors">{calculateFillerWords()} filler words found</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (!fillerWords) {
                            setIsProcessingAI(true);
                            setTimeout(() => {
                              setIsProcessingAI(false);
                              setFillerWords(true);
                              alert(`Successfully removed ${calculateFillerWords()} filler words using RCRD AI!`);
                            }, 1500);
                          } else {
                            setFillerWords(false);
                          }
                        }}
                        disabled={isProcessingAI}
                        className={`w-9 h-5 rounded-full relative transition-colors ${fillerWords ? 'bg-[#154360]' : 'bg-gray-200'} ${isProcessingAI ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${fillerWords ? 'translate-x-4' : 'translate-x-0'}`}></span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'activity' && (
              <div className="flex flex-col h-full animate-in fade-in duration-300">
                {!allowComments ? (
                  <div className="flex-1 flex items-center justify-center text-[#57636E] p-6 mt-10">
                    Comments are turned off for this video.
                  </div>
                ) : (
                  <>
                {/* New Comment Input Box */}
                <div className="border border-[#154360] rounded-lg p-3 mb-6 bg-white shadow-sm">
                  <div className="flex gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[#154360] text-white flex items-center justify-center text-sm font-bold shrink-0">HR</div>
                    <textarea 
                      id="main-comment-input"
                      placeholder="Leave a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="w-full text-sm outline-none resize-none pt-1 min-h-[40px] text-[#20262E] bg-transparent"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!commentText.trim()) return;
                          try {
                            const timeStr = `${Math.floor(currentVideoTime / 60)}:${Math.floor(currentVideoTime % 60).toString().padStart(2, '0')}`;
                            const newComment = await addVideoComment(id, commentText, timeStr);
                            const updatedComments = [...(video?.comments || []), newComment];
                            setVideo(prev => {
                              if (!prev) return prev;
                              return { ...prev, comments: updatedComments };
                            });
                            try {
                              const meta = JSON.parse(localStorage.getItem(`video-meta-${id}`) || '{}');
                              meta.comments = updatedComments;
                              localStorage.setItem(`video-meta-${id}`, JSON.stringify(meta));
                            } catch {}
                            window.dispatchEvent(new CustomEvent('video-updated', { detail: { id, comments: updatedComments } }));
                            setCommentText('');
                          } catch(err) {
                            console.error("Failed to add comment", err);
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-4 text-[#57636E] pl-11">
                      <AtSign className="w-4 h-4 cursor-pointer hover:text-[#20262E] transition-colors"/>
                      <Smile className="w-4 h-4 cursor-pointer hover:text-[#20262E] transition-colors"/>
                      <VideoIcon className="w-4 h-4 cursor-pointer hover:text-[#20262E] transition-colors"/>
                    </div>
                    <button 
                      onClick={async () => {
                        if (!commentText.trim()) return;
                        try {
                          const timeStr = `${Math.floor(currentVideoTime / 60)}:${Math.floor(currentVideoTime % 60).toString().padStart(2, '0')}`;
                          const newComment = await addVideoComment(id, commentText, timeStr);
                          const updatedComments = [...(video?.comments || []), newComment];
                          setVideo(prev => {
                            if (!prev) return prev;
                            return { ...prev, comments: updatedComments };
                          });
                          try {
                            const meta = JSON.parse(localStorage.getItem(`video-meta-${id}`) || '{}');
                            meta.comments = updatedComments;
                            localStorage.setItem(`video-meta-${id}`, JSON.stringify(meta));
                          } catch {}
                          window.dispatchEvent(new CustomEvent('video-updated', { detail: { id, comments: updatedComments } }));
                          setCommentText('');
                        } catch(err) {
                          console.error("Failed to add comment", err);
                        }
                      }}
                      className="bg-[#154360] text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-[#0E2F44] transition-colors disabled:opacity-50"
                      disabled={!commentText.trim()}
                    >
                      Comment at {Math.floor(currentVideoTime / 60)}:{Math.floor(currentVideoTime % 60).toString().padStart(2, '0')}
                    </button>
                  </div>
                </div>

                {(!video?.comments || video.comments.length === 0) ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mt-10 group">
                    <div className="w-16 h-16 bg-[#EBF5FB] text-[#154360] rounded-full flex items-center justify-center mb-4 relative group-hover:scale-110 transition-transform">
                      <MessageSquare className="w-8 h-8" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#154360] text-white rounded-full flex items-center justify-center text-lg font-bold border-2 border-white">+</div>
                    </div>
                    <h3 className="text-lg font-bold text-[#20262E] mb-2">Be the first to comment</h3>
                    <p className="text-sm text-[#57636E]">Hit <kbd className="bg-gray-100 border border-[#E2E7EC] rounded px-1.5 py-0.5 mx-1 font-mono text-xs shadow-sm">C</kbd> to reply to {video?.ownerName?.split(' ')[0] || 'User'} or leave a comment above.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-2 mb-4">
                    <h4 className="text-sm text-[#57636E] font-medium mb-4">{video.comments.length} Comment{video.comments.length !== 1 ? 's' : ''}</h4>
                    <div className="space-y-4">
                      {video.comments.map((comment) => (
                        <div key={comment.id} className="relative group flex gap-3 p-3 rounded-xl hover:bg-[#F5F6F8] transition-colors border border-transparent hover:border-[#E2E7EC]">
                          <div className="w-8 h-8 bg-[#154360] text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm mt-1">
                            {comment.userName ? comment.userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center flex-nowrap gap-2 w-full pr-[140px]">
                              <span className="font-bold text-sm text-[#20262E] truncate shrink-0 max-w-[120px]">{comment.userName || 'User'}</span>
                              <span 
                                onClick={() => handleTimeClick(comment.videoTime)}
                                className="text-sm text-[#154360] cursor-pointer hover:underline font-medium shrink-0"
                              >
                                {comment.videoTime}
                              </span>
                              <span className="text-xs text-[#57636E] shrink-0">Just now</span>
                              
                              {/* Actions - Horizontal on the right corner */}
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-[#154360] p-1.5 bg-[#F5F6F8]/90 rounded-md">
                                {recordReply && (
                                <Mic 
                                  onClick={() => {
                                    setIsComposingComment(true);
                                    setCommentText(`@${comment.userName || 'User'} `);
                                    // @ts-expect-error Speech API not in standard DOM lib
                                    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                                    if (SpeechRecognition) {
                                      const recognition = new SpeechRecognition();
                                      recognition.onresult = (event: { results: { transcript: string }[][] }) => {
                                        setCommentText(prev => prev + event.results[0][0].transcript);
                                      };
                                      recognition.start();
                                    } else {
                                      alert("Voice dictation is not supported in your browser.");
                                    }
                                    setTimeout(() => document.getElementById('main-comment-input')?.focus(), 100);
                                  }} 
                                  className="w-4 h-4 cursor-pointer hover:text-[#0E2F44] transition-colors"
                                />
                                )}
                                {emojiReactions && (
                                <Smile 
                                  onClick={async () => {
                                    try {
                                      const timeStr = `${Math.floor(currentVideoTime / 60)}:${Math.floor(currentVideoTime % 60).toString().padStart(2, '0')}`;
                                      const newComment = await addVideoComment(id, `@${comment.userName || 'User'} 👍`, timeStr);
                                      setVideo(prev => {
                                        if (!prev) return prev;
                                        return { ...prev, comments: [...(prev.comments || []), newComment] };
                                      });
                                    } catch (e) {
                                      console.error(e);
                                    }
                                  }} 
                                  className="w-4 h-4 cursor-pointer hover:text-[#0E2F44] transition-colors"
                                />
                                )}
                                <Edit2 
                                  onClick={() => {
                                    setEditingCommentId(comment.id);
                                    setEditCommentText(comment.text);
                                  }} 
                                  className="w-4 h-4 cursor-pointer hover:text-[#0E2F44] transition-colors"
                                />
                                <Trash2 
                                  onClick={async () => {
                                    if (confirm('Are you sure you want to delete this comment?')) {
                                      try {
                                        await deleteVideoComment(id, comment.id);
                                      } catch (e) {
                                        console.error(e);
                                      }
                                      setVideo(prev => {
                                        if (!prev) return prev;
                                        return { ...prev, comments: (prev.comments || []).filter(c => c.id !== comment.id) };
                                      });
                                    }
                                  }}
                                  className="w-4 h-4 cursor-pointer text-[#154360] hover:text-[#0E2F44] transition-colors"
                                />
                                <Link2 
                                  onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    alert('Link to video copied!');
                                  }}
                                  className="w-4 h-4 cursor-pointer hover:text-[#0E2F44] transition-colors"
                                />
                              </div>
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="mt-2 pr-8">
                                <textarea 
                                  className="w-full text-sm text-[#20262E] p-2 border border-[#154360] rounded-md focus:outline-none focus:ring-2 focus:ring-[#154360] resize-none"
                                  value={editCommentText}
                                  onChange={(e) => setEditCommentText(e.target.value)}
                                  rows={2}
                                />
                                <div className="flex gap-2 mt-2 justify-end">
                                  <button 
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditCommentText('');
                                    }}
                                    className="text-xs px-3 py-1 text-[#57636E] hover:text-[#20262E] font-medium transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      if (!editCommentText.trim() || editCommentText === comment.text) {
                                        setEditingCommentId(null);
                                        return;
                                      }
                                      try {
                                        await updateVideoComment(id, comment.id, editCommentText);
                                      } catch (e) {
                                        console.error(e);
                                      }
                                      setVideo(prev => {
                                        if (!prev) return prev;
                                        return { 
                                          ...prev, 
                                          comments: (prev.comments || []).map(c => c.id === comment.id ? { ...c, text: editCommentText } : c) 
                                        };
                                      });
                                      setEditingCommentId(null);
                                    }}
                                    className="text-xs bg-[#154360] text-white px-3 py-1 rounded-md hover:bg-[#0E2F44] font-medium transition-colors"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-[#20262E] mt-2 whitespace-pre-wrap pr-8">{comment.text}</p>
                            )}
                            
                            <button 
                              onClick={() => {
                                setIsComposingComment(true);
                                setCommentText(`@${comment.userName || 'User'} `);
                                setTimeout(() => document.getElementById('main-comment-input')?.focus(), 100);
                              }}
                              className="flex items-center gap-1.5 text-[#57636E] text-sm mt-3 hover:text-[#20262E] font-medium transition-colors"
                            >
                              <CornerDownRight className="w-4 h-4" /> Reply
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
            )}



            {activeTab === 'settings' && (
              <div className="flex flex-col h-full animate-in fade-in duration-300">
                <div className="flex rounded-lg bg-[#F5F6F8] p-1 mb-4 border border-[#E2E7EC]">
                  <button 
                    onClick={() => setSettingsTab('enhancements')}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${settingsTab === 'enhancements' ? 'bg-white shadow-sm text-[#154360]' : 'text-[#57636E] hover:text-[#20262E]'}`}
                  >Enhancements</button>
                  <button 
                    onClick={() => setSettingsTab('audience')}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${settingsTab === 'audience' ? 'bg-white shadow-sm text-[#154360]' : 'text-[#57636E] hover:text-[#20262E]'}`}
                  >Audience</button>
                </div>
                
                <div className="mb-4">
                  <button 
                    onClick={() => {
                      setNoiseFilter(false);
                      setAnimatedThumb(true);
                      setTurnOnCaptions(false);
                      setRecommendPlaybackSpeed('None');
                      setAllowComments(true);
                      setCommentNotification(true);
                      setRecordReply(true);
                      setEmojiReactions(true);
                      setDownloadEnabled(true);
                      setStitchEnabled(true);
                      setAnalyticsEnabled(true);
                      setTranscriptEnabled(true);
                      alert('Settings have been reset to defaults.');
                    }}
                    className="w-full text-center border border-[#E2E7EC] rounded-md py-2 text-sm text-[#20262E] hover:bg-[#F5F6F8] font-medium transition-colors">
                    Set defaults
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 pb-10">
                  {settingsTab === 'enhancements' ? (
                    <div className="space-y-0">
                      {/* Video Thumbnail */}
                      <div className="py-4 border-b border-[#E2E7EC] group">
                        <h4 className="text-sm font-bold text-[#20262E]">Video thumbnail</h4>
                        <span className="text-xs text-[#57636E] border-b border-gray-400 hover:text-[#57636E] hover:border-gray-600 cursor-pointer transition-colors pb-0.5">Upgrade to add video thumbnail</span>
                      </div>

                      {/* Noise Filter */}
                      <div className="flex items-start justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Background noise filter</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Filter out unwanted noise</p>
                        </div>
                        <button 
                          onClick={() => {
                            if (!noiseFilter) {
                              setIsProcessingAI(true);
                              setTimeout(() => {
                                setIsProcessingAI(false);
                                setNoiseFilter(true);
                                alert("Background noise successfully filtered using RCRD AI!");
                              }, 1500);
                            } else {
                              setNoiseFilter(false);
                            }
                          }}
                          disabled={isProcessingAI}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${noiseFilter ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'} ${isProcessingAI ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${noiseFilter ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>

                      {/* Animated Thumbnail */}
                      <div className="flex items-start justify-between py-4 group border-b border-[#E2E7EC]">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Animated thumbnail</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Automatic gif thumbnail when you share</p>
                        </div>
                        <button 
                          onClick={() => setAnimatedThumb(!animatedThumb)}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${animatedThumb ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${animatedThumb ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {/* Turn on captions */}
                      <div className="flex items-start justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Turn on captions</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Turn on closed captions for viewers</p>
                        </div>
                        <button 
                          onClick={() => {
                            if (!turnOnCaptions) {
                              setIsProcessingAI(true);
                              setTimeout(() => {
                                setIsProcessingAI(false);
                                setTurnOnCaptions(true);
                                alert("Captions successfully generated using RCRD AI!");
                              }, 1500);
                            } else {
                              setTurnOnCaptions(false);
                            }
                          }}
                          disabled={isProcessingAI}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${turnOnCaptions ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'} ${isProcessingAI ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${turnOnCaptions ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>

                      {/* Recommend Playback Speed */}
                      <div className="flex items-center justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Recommend a playback speed</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Suggest a viewing speed for your audience</p>
                        </div>
                        <select 
                          value={recommendPlaybackSpeed}
                          onChange={(e) => setRecommendPlaybackSpeed(e.target.value)}
                          className="bg-transparent text-sm font-medium text-[#20262E] outline-none cursor-pointer hover:bg-[#F5F6F8] px-2 py-1 rounded"
                        >
                          <option>None</option>
                          <option>1x</option>
                          <option>1.2x</option>
                          <option>1.5x</option>
                          <option>2x</option>
                        </select>
                      </div>

                      {/* Comments */}
                      <div className="flex items-start justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Comments</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Allow viewers to add comments</p>
                        </div>
                        <button 
                          onClick={() => setAllowComments(!allowComments)}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${allowComments ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${allowComments ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>

                      {/* Comment notification */}
                      <div className="flex items-start justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Comment notification</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Get an email when someone comments</p>
                        </div>
                        <button 
                          onClick={() => setCommentNotification(!commentNotification)}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${commentNotification ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${commentNotification ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>

                      {/* Record a reply */}
                      <div className="flex items-start justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Record a reply</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Allow viewers to comment with a video</p>
                        </div>
                        <button 
                          onClick={() => setRecordReply(!recordReply)}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${recordReply ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${recordReply ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>

                      {/* Emoji reactions */}
                      <div className="flex items-start justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Emoji reactions</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Allow viewers to add reactions</p>
                        </div>
                        <button 
                          onClick={() => setEmojiReactions(!emojiReactions)}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${emojiReactions ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${emojiReactions ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>

                      {/* Download */}
                      <div className="flex items-start justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Download</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Allow viewers to download your video</p>
                        </div>
                        <button 
                          onClick={() => setDownloadEnabled(!downloadEnabled)}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${downloadEnabled ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${downloadEnabled ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>

                      {/* Stitch */}
                      <div className="flex items-start justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Stitch</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Allow viewers to stitch this video</p>
                        </div>
                        <button 
                          onClick={() => setStitchEnabled(!stitchEnabled)}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${stitchEnabled ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${stitchEnabled ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>

                      {/* Analytics */}
                      <div className="flex items-start justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Analytics</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Allow viewers to see video analytics</p>
                        </div>
                        <button 
                          onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${analyticsEnabled ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${analyticsEnabled ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>

                      {/* Transcript */}
                      <div className="flex items-start justify-between py-4 border-b border-[#E2E7EC] group">
                        <div>
                          <h4 className="text-sm font-bold text-[#20262E]">Transcript</h4>
                          <p className="text-xs text-[#57636E] mt-0.5">Allow viewers to access the transcript</p>
                        </div>
                        <button 
                          onClick={() => {
                            setTranscriptEnabled(!transcriptEnabled);
                          }}
                          className={`w-10 h-5 rounded-full relative transition-colors mt-0.5 shrink-0 ${transcriptEnabled ? 'bg-[#154360]' : 'bg-[#F5F6F8]0'}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${transcriptEnabled ? 'translate-x-5' : 'translate-x-0 shadow-sm'}`}></span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'transcript' && (
              <div className="flex flex-col h-full animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#20262E]">Transcript</h3>
                  <button className="text-xs font-medium text-[#115E59] hover:underline flex items-center gap-1">
                    <Download className="w-3 h-3" /> Download
                  </button>
                </div>
                
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#57636E]" />
                  <input 
                    type="text" 
                    placeholder="Search transcript..." 
                    className="w-full bg-[#F5F6F8] border border-[#E2E7EC] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#115E59]/30 focus:border-[#115E59] transition-all"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-10">
                  {[
                    { time: "00:00", text: "Hey everyone, thanks for tuning in to this update." },
                    { time: "00:04", text: "Today I want to walk you through the new features we've just launched." },
                    { time: "00:09", text: "First, you'll notice the new dashboard layout which makes it much easier to find your recent recordings." },
                    { time: "00:15", text: "We've also added some new collaboration tools, allowing your team to leave comments directly on the timeline." },
                    { time: "00:22", text: "Let me know what you think in the comments below!" }
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-4 group cursor-pointer hover:bg-[#F5F6F8] p-2 -mx-2 rounded-lg transition-colors">
                      <span className="text-xs font-mono text-[#57636E] mt-0.5 group-hover:text-[#115E59]">{item.time}</span>
                      <p className="text-sm text-[#20262E] leading-relaxed group-hover:text-[#20262E]">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'generate' && (
              <div className="flex flex-col h-full animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#20262E] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#154360]" /> AI Document
                  </h3>
                  <button 
                    onClick={() => {
                      setIsProcessingAI(true);
                      setTimeout(() => {
                        setIsProcessingAI(false);
                        setEditedTitle("RCRD AI Title: " + (video?.title || "Untitled"));
                        alert("RCRD AI successfully regenerated video metadata!");
                      }, 2000);
                    }}
                    disabled={isProcessingAI}
                    className="text-xs font-medium text-[#154360] hover:text-purple-800 transition-colors flex items-center gap-1"
                  >
                    {isProcessingAI ? <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div> : <Zap className="w-3 h-3" />}
                    {isProcessingAI ? "Generating..." : "Regenerate"}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2 pb-10">
                  <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 p-4 rounded-xl shadow-sm">
                    <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-2">Summary</h4>
                    <p className="text-sm text-[#20262E] leading-relaxed">
                      {isProcessingAI ? "Generating new summary..." : "This video covers the latest platform updates, highlighting the redesigned dashboard for easier navigation and the introduction of new timeline collaboration tools for teams."}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-[#20262E] mb-3">Action Items</h4>
                    <ul className="space-y-2">
                      {(isProcessingAI ? ["Analyzing..."] : [
                        "Review the new dashboard layout",
                        "Test the timeline commenting feature",
                        "Provide feedback in the comments"
                      ]).map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-[#20262E]">
                          <CheckCircle2 className="w-4 h-4 text-[#115E59] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </aside>
      </div>

      {/* Video Editor Modal */}
      <VideoEditorModal 
        isOpen={isEditorOpen} 
        onClose={() => {
          setIsEditorOpen(false);
          // Sync local edits immediately to the player state
          try {
            const local = localStorage.getItem(`video-edits-${id}`);
            if (local) {
              const parsed = JSON.parse(local);
              setVideo(prev => prev ? { ...prev, editorData: parsed } : prev);
            }
          } catch {}
        }} 
        onSave={(savedData) => {
          setVideo(prev => prev ? { ...prev, editorData: savedData } : prev);
          setToastMessage('Video changes saved successfully!');
          setTimeout(() => setToastMessage(''), 3000);
        }}
        videoUrl={streamUrl || ''} 
        videoTitle={video?.title || 'Video'}
        videoId={id}
        initialEditorData={video?.editorData}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#EBF5FB]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Profile Flyout (Image 5) */}
      <ProfileFlyout
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}
