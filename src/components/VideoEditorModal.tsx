import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Scissors, Play, Pause, ChevronLeft, Volume2, VolumeX, MousePointer2, 
  Type, Image as ImageIcon, Music, Download, Check, Trash2, RotateCcw, 
  RotateCw, Plus, Clock, Sparkles, CheckCircle2, Sliders, Eye, HelpCircle,
  ArrowRight, ArrowLeft, X
} from 'lucide-react';

interface VideoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: VideoEditorData) => void;
  videoUrl: string;
  videoTitle: string;
  videoId: string;
  initialEditorData?: unknown;
}

// Data Types
export type CutRegion = { id: string; start: number; end: number };
export type TextStylePreset = 'subtitle' | 'lowerThird' | 'badge' | 'minimal' | 'middleSlide';
export type TextOverlay = { 
  id: string; 
  text: string; 
  x: number; 
  y: number; 
  color: string; 
  size: number; 
  start: number; 
  end: number; 
  rotation?: number;
  stylePreset?: TextStylePreset;
  mergeMode?: 'overlay' | 'middleSlide';
};
export type MediaOverlay = { 
  id: string; 
  url: string; 
  isVideo?: boolean;
  x: number; 
  y: number; 
  scale: number; 
  start: number; 
  end: number; 
  rotation?: number;
  opacity?: number;
  rounded?: boolean;
  mergeMode?: 'overlay' | 'middleSlide';
};
export type AudioSettings = {
  enabled: boolean;
  url: string;
  volume: number;
  muteOriginalAudio?: boolean;
  title?: string;
};
export type VideoEditorData = {
  textOverlays: TextOverlay[];
  mediaOverlays: MediaOverlay[];
  completedCuts: CutRegion[];
  audio: AudioSettings;
  duration: number;
  savedAt?: string;
};

// Preset tracks with clean, professional labels (no emojis)
const PRESET_AUDIO_TRACKS = [
  { id: 'lofi', title: 'Chill Lofi Beat', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3' },
  { id: 'corporate', title: 'Modern Tech Upbeat', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=corporate-ambient-109060.mp3' },
  { id: 'acoustic', title: 'Calm Acoustic Guitar', url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=acoustic-guitars-ambient-uplifting-112192.mp3' },
];

const PRESET_WATERMARK_IMAGES = [
  { id: 'watermark', label: 'RCRD Watermark', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160&h=160&fit=crop&q=80' },
  { id: 'badge', label: 'LIVE Broadcast Badge', url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=160&h=160&fit=crop&q=80' },
];

// Hand-drawn curved arrow with action burst rays matching user reference (Image 5)
function CurvedTutorialArrow({ 
  className = '', 
  flip = false,
  rotation = 0,
  strokeColor = '#2563eb'
}: { 
  className?: string; 
  flip?: boolean; 
  rotation?: number;
  strokeColor?: string;
}) {
  return (
    <div 
      style={{ transform: `rotate(${rotation}deg) ${flip ? 'scaleX(-1)' : ''}` }} 
      className={`relative inline-flex items-center justify-center animate-bounce duration-1000 ${className}`}
    >
      <svg 
        viewBox="0 0 140 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-24 h-18 filter drop-shadow-[0_4px_12px_rgba(37,99,235,0.4)]"
      >
        {/* Curled trajectory loop */}
        <path 
          d="M20 75 C 32 82, 45 45, 32 25 C 20 10, 8 38, 35 58 C 65 80, 95 45, 120 22" 
          stroke={strokeColor} 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        {/* Arrow head */}
        <path 
          d="M102 20 L122 21 L118 40" 
          stroke={strokeColor} 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        {/* Action bursts */}
        <path d="M116 8 L122 2" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <path d="M128 14 L136 10" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <path d="M130 28 L138 31" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function VideoEditorModal({ 
  isOpen, 
  onClose, 
  onSave,
  videoUrl, 
  videoTitle, 
  videoId, 
  initialEditorData 
}: VideoEditorModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Active Tool Tab: 'select' | 'cut' | 'text' | 'media' | 'audio'
  const [activeTab, setActiveTab] = useState<'select' | 'cut' | 'text' | 'media' | 'audio'>('select');
  
  const [waveformHeights] = useState<number[]>(() => 
    Array.from({ length: 140 }).map((_, i) => Math.max(12, ((i * 37) % 65) + 15))
  );
  
  // TUTORIAL STATE
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // Auto-prompt tutorial on first visit
  useEffect(() => {
    if (isOpen) {
      try {
        const hasSeen = localStorage.getItem('rcrd_video_editor_tutorial_seen');
        if (!hasSeen) {
          setShowTutorial(true);
        }
      } catch {}
    }
  }, [isOpen]);

  // CUT FEATURE STATE
  const [activeCut, setActiveCut] = useState<{start: number, end: number} | null>(null);
  const [completedCuts, setCompletedCuts] = useState<CutRegion[]>([]);
  const [dragHandle, setDragHandle] = useState<'start' | 'end' | null>(null);

  // DYNAMIC OVERLAYS STATE
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  
  const [mediaOverlays, setMediaOverlays] = useState<MediaOverlay[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  
  // AUDIO STATE
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [audioVolume, setAudioVolume] = useState(50);
  const [audioUrl, setAudioUrl] = useState(PRESET_AUDIO_TRACKS[0].url);
  const [audioTrackTitle, setAudioTrackTitle] = useState(PRESET_AUDIO_TRACKS[0].title);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [isAudioPreviewPlaying, setIsAudioPreviewPlaying] = useState(false);

  // DRAGGING / RESIZING
  const [draggingOverlay, setDraggingOverlay] = useState<{ id: string, type: 'text' | 'media' } | null>(null);
  const [resizingOverlay, setResizingOverlay] = useState<{ id: string, type: 'text' | 'media', startY: number, initialSize: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Restore saved data on open
  useEffect(() => {
    if (!isOpen) return;

    let loaded = false;
    // 1. Try initialEditorData
    if (initialEditorData) {
      try {
        const parsed = typeof initialEditorData === 'string' ? JSON.parse(initialEditorData) : initialEditorData;
        if (parsed) {
          if (Array.isArray(parsed.textOverlays)) setTextOverlays(parsed.textOverlays);
          if (Array.isArray(parsed.mediaOverlays)) setMediaOverlays(parsed.mediaOverlays);
          if (Array.isArray(parsed.completedCuts)) setCompletedCuts(parsed.completedCuts);
          if (parsed.audio) {
            setHasAudioTrack(!!parsed.audio.enabled);
            if (parsed.audio.url) setAudioUrl(parsed.audio.url);
            if (parsed.audio.volume !== undefined) setAudioVolume(parsed.audio.volume);
            if (parsed.audio.title) setAudioTrackTitle(parsed.audio.title);
            if (parsed.audio.muteOriginalAudio !== undefined) setMuteOriginalAudio(parsed.audio.muteOriginalAudio);
          }
          loaded = true;
        }
      } catch (e) {
        console.warn('Could not parse initialEditorData', e);
      }
    }

    // 2. Try localStorage if not yet loaded
    if (!loaded && videoId) {
      try {
        const local = localStorage.getItem(`video-edits-${videoId}`);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed.textOverlays)) setTextOverlays(parsed.textOverlays);
          if (Array.isArray(parsed.mediaOverlays)) setMediaOverlays(parsed.mediaOverlays);
          if (Array.isArray(parsed.completedCuts)) setCompletedCuts(parsed.completedCuts);
          if (parsed.audio) {
            setHasAudioTrack(!!parsed.audio.enabled);
            if (parsed.audio.url) setAudioUrl(parsed.audio.url);
            if (parsed.audio.volume !== undefined) setAudioVolume(parsed.audio.volume);
            if (parsed.audio.title) setAudioTrackTitle(parsed.audio.title);
            if (parsed.audio.muteOriginalAudio !== undefined) setMuteOriginalAudio(parsed.audio.muteOriginalAudio);
          }
        }
      } catch (e) {
        console.warn('Could not load localStorage edits', e);
      }
    }
  }, [isOpen, videoId, initialEditorData]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Sync background audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : audioVolume / 100;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.volume = audioVolume / 100;
    }
  }, [audioVolume, isMuted]);

  // Sync mute original audio on video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted || muteOriginalAudio;
    }
  }, [isMuted, muteOriginalAudio]);

  // Spacebar shortcut to play/pause
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying]);

  // Cut Drag Handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragHandle || !timelineRef.current || !activeCut) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const timeAtCursor = pos * duration;
      
      if (dragHandle === 'start') {
        setActiveCut(prev => prev ? { ...prev, start: Math.min(timeAtCursor, prev.end - 0.2) } : null);
      } else {
        setActiveCut(prev => prev ? { ...prev, end: Math.max(timeAtCursor, prev.start + 0.2) } : null);
      }
    };
    
    const handleMouseUp = () => setDragHandle(null);
    
    if (dragHandle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragHandle, activeCut, duration]);

  if (!isOpen) return null;

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      if (audioRef.current && hasAudioTrack && audioUrl) {
        audioRef.current.currentTime = videoRef.current.currentTime % (audioRef.current.duration || 1);
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(true);
    }
  };

  const handleRewind = () => {
    if (!videoRef.current) return;
    const nextTime = Math.max(0, videoRef.current.currentTime - 5);
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    if (audioRef.current && hasAudioTrack) {
      audioRef.current.currentTime = nextTime % (audioRef.current.duration || 1);
    }
  };

  const handleForward = () => {
    if (!videoRef.current) return;
    const nextTime = Math.min(duration || 100, videoRef.current.currentTime + 5);
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    if (audioRef.current && hasAudioTrack) {
      audioRef.current.currentTime = nextTime % (audioRef.current.duration || 1);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted || muteOriginalAudio;
    }
    if (audioRef.current) {
      audioRef.current.volume = nextMuted ? 0 : audioVolume / 100;
    }
  };


  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const ct = videoRef.current.currentTime;
    setCurrentTime(ct);
    
    // Auto-skip active cut region during playback so video never plays through cut
    if (activeCut && ct >= activeCut.start && ct < activeCut.end) {
      videoRef.current.currentTime = activeCut.end;
      setCurrentTime(activeCut.end);
      if (audioRef.current && audioRef.current.duration) {
        audioRef.current.currentTime = activeCut.end % audioRef.current.duration;
      }
      return;
    }

    // Auto-skip over completed cuts
    for (const cut of completedCuts) {
      if (ct >= cut.start && ct < cut.end) {
        videoRef.current.currentTime = cut.end;
        setCurrentTime(cut.end);
        if (audioRef.current && audioRef.current.duration) {
          audioRef.current.currentTime = cut.end % audioRef.current.duration;
        }
        break;
      }
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current || duration === 0 || dragHandle) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    let clickTime = pos * duration;
    
    // If clicked inside a completed cut, jump to the end of that cut
    for (const cut of completedCuts) {
      if (clickTime >= cut.start && clickTime < cut.end) {
        clickTime = cut.end;
        break;
      }
    }

    videoRef.current.currentTime = clickTime;
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = clickTime % audioRef.current.duration;
    }
    setCurrentTime(clickTime);
  };

  // CUT ACTIONS
  const initiateNewCut = () => {
    setActiveTab('cut');
    if (duration === 0) return;
    const start = videoRef.current?.currentTime || 0;
    const end = Math.min(start + 4, duration);
    setActiveCut({ start, end });
  };

  const cutFromStartToNow = () => {
    const end = videoRef.current?.currentTime || currentTime;
    if (end > 0.2) {
      setCompletedCuts(prev => [...prev, { id: Math.random().toString(), start: 0, end }]);
      if (videoRef.current) videoRef.current.currentTime = end;
    }
  };

  const cutFromNowToEnd = () => {
    const start = videoRef.current?.currentTime || currentTime;
    if (duration > start + 0.2) {
      setCompletedCuts(prev => [...prev, { id: Math.random().toString(), start, end: duration }]);
    }
  };

  const confirmCut = () => {
    if (activeCut && activeCut.end > activeCut.start + 0.1) {
      setCompletedCuts([...completedCuts, { id: Math.random().toString(), start: activeCut.start, end: activeCut.end }]);
      setActiveCut(null);
    }
  };

  const trimToActiveSelection = () => {
    if (!activeCut) return;
    const newCuts: CutRegion[] = [];
    if (activeCut.start > 0.1) {
      newCuts.push({ id: Math.random().toString(), start: 0, end: activeCut.start });
    }
    if (activeCut.end < duration - 0.1) {
      newCuts.push({ id: Math.random().toString(), start: activeCut.end, end: duration });
    }
    setCompletedCuts(prev => [...prev, ...newCuts]);
    setActiveCut(null);
    if (videoRef.current) {
      videoRef.current.currentTime = activeCut.start;
      setCurrentTime(activeCut.start);
    }
  };

  const cancelCut = () => setActiveCut(null);

  // TEXT ACTIONS
  const handleAddText = (mergeMode: 'middleSlide' | 'overlay' = 'middleSlide') => {
    setActiveTab('text');
    const start = videoRef.current?.currentTime || currentTime || 0;
    const count = textOverlays.length + 1;
    const newText: TextOverlay = { 
      id: Math.random().toString(), 
      text: mergeMode === 'middleSlide' ? `Title Slide #${count}` : `Caption #${count}`, 
      x: 50, 
      y: mergeMode === 'middleSlide' ? 50 : Math.min(88, 76 + ((count % 3) * 5)), 
      color: '#ffffff', 
      size: mergeMode === 'middleSlide' ? 32 : 26,
      start: start, 
      end: Math.min(start + 5, duration || start + 5),
      stylePreset: mergeMode === 'middleSlide' ? 'middleSlide' : 'subtitle',
      mergeMode
    };
    setTextOverlays([...textOverlays, newText]);
    setSelectedTextId(newText.id);
    setSelectedMediaId(null);
  };

  // MEDIA ACTIONS
  const handleAddMedia = (customUrl?: string, isVideo = false, mergeMode: 'middleSlide' | 'overlay' = 'middleSlide') => {
    setActiveTab('media');
    const start = videoRef.current?.currentTime || currentTime || 0;
    const newMedia: MediaOverlay = { 
      id: Math.random().toString(), 
      url: customUrl || PRESET_WATERMARK_IMAGES[0].url, 
      isVideo,
      x: 50, 
      y: 50, 
      scale: mergeMode === 'middleSlide' ? 100 : 65,
      start: start, 
      end: Math.min(start + 6, duration || 6),
      opacity: 100,
      rounded: true,
      mergeMode
    };
    setMediaOverlays([...mediaOverlays, newMedia]);
    setSelectedMediaId(newMedia.id);
    setSelectedTextId(null);
  };

  const handlePointerDown = (e: React.PointerEvent, id: string, type: 'text' | 'media') => {
    e.stopPropagation();
    if (type === 'text') {
      setSelectedTextId(id);
      setSelectedMediaId(null);
      setActiveTab('text');
    } else {
      setSelectedMediaId(id);
      setSelectedTextId(null);
      setActiveTab('media');
    }
    setDraggingOverlay({ id, type });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (resizingOverlay) {
      const delta = (e.clientY - resizingOverlay.startY) * 1.5;
      if (resizingOverlay.type === 'text') {
        const newSize = Math.max(14, Math.min(120, resizingOverlay.initialSize + delta));
        setTextOverlays(prev => prev.map(t => t.id === resizingOverlay.id ? { ...t, size: Math.round(newSize) } : t));
      } else {
        const newScale = Math.max(20, Math.min(300, resizingOverlay.initialSize + delta));
        setMediaOverlays(prev => prev.map(m => m.id === resizingOverlay.id ? { ...m, scale: Math.round(newScale) } : m));
      }
      return;
    }

    if (!draggingOverlay || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));

    if (draggingOverlay.type === 'text') {
      setTextOverlays(prev => prev.map(t => t.id === draggingOverlay.id ? { ...t, x: Math.round(x), y: Math.round(y) } : t));
    } else {
      setMediaOverlays(prev => prev.map(m => m.id === draggingOverlay.id ? { ...m, x: Math.round(x), y: Math.round(y) } : m));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDraggingOverlay(null);
    setResizingOverlay(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const formatTimeStr = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string;
        if (selectedMediaId) {
          setMediaOverlays(prev => prev.map(m => m.id === selectedMediaId ? { ...m, url: dataUrl, isVideo } : m));
        } else {
          handleAddMedia(dataUrl, isVideo, 'middleSlide');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newUrl = URL.createObjectURL(file);
      setAudioUrl(newUrl);
      setAudioTrackTitle(file.name || 'Custom Audio Track');
      setHasAudioTrack(true);
    }
  };

  // SAVE CHANGES
  const handleSaveChanges = async () => {
    setIsSaving(true);
    const editorData: VideoEditorData = {
      textOverlays,
      mediaOverlays,
      completedCuts,
      audio: {
        enabled: hasAudioTrack,
        url: audioUrl,
        volume: audioVolume,
        muteOriginalAudio,
        title: audioTrackTitle,
      },
      duration: duration === Infinity ? 0 : duration,
      savedAt: new Date().toISOString()
    };

    // 1. Save locally
    try {
      localStorage.setItem(`video-edits-${videoId}`, JSON.stringify(editorData));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    // 2. Dispatch real-time window event so VideoPlayer updates immediately
    window.dispatchEvent(new CustomEvent('video-editor-updated', { 
      detail: { videoId, editorData } 
    }));

    // 3. Persist to API
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      await fetch(`${API_URL}/videos/${videoId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          title: videoTitle,
          editorData: JSON.stringify(editorData)
        })
      });
    } catch (err) {
      console.warn('API save warning:', err);
    }

    setIsSaving(false);
    setSaveSuccess(true);
    onSave?.(editorData);

    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  const activeText = textOverlays.find(t => t.id === selectedTextId);
  const activeMedia = mediaOverlays.find(m => m.id === selectedMediaId);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f0f5fa] text-[#0f172a] font-sans animate-in fade-in duration-200">
      
      {/* HEADER */}
      <div className="h-16 border-b border-blue-100 bg-white flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-blue-50 rounded-full transition-colors text-slate-500 hover:text-blue-600"
            title="Exit Editor"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <span>{videoTitle}</span> 
            <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200">
              Video Studio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowTutorial(true); setTutorialStep(0); }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 shadow-xs"
            title="Open video editing tutorial and walkthrough"
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>Tutorial & Guide</span>
          </button>

          {saveSuccess ? (
            <div className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-md animate-in zoom-in-95">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved!</span>
            </div>
          ) : (
            <button 
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-75 cursor-pointer"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isSaving ? "Saving Changes..." : "Save Changes"}</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Tools) */}
        <div className="w-20 border-r border-blue-100 bg-white flex flex-col items-center py-6 gap-4 shadow-sm z-10 select-none">
          <button 
            onClick={() => { setActiveTab('select'); setSelectedTextId(null); setSelectedMediaId(null); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-16 transition-all ${
              activeTab === 'select'
                ? 'text-blue-600 bg-blue-50 border-2 border-blue-200 shadow-sm font-bold' 
                : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50'
            }`}
          >
            <MousePointer2 className="w-5 h-5" />
            <span className="text-[10px]">Overview</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab('cut'); initiateNewCut(); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-16 transition-all ${
              activeTab === 'cut' 
                ? 'text-red-600 bg-red-50 border-2 border-red-200 shadow-sm font-bold' 
                : 'text-slate-500 hover:text-red-500 hover:bg-red-50'
            }`}
          >
            <Scissors className="w-5 h-5" />
            <span className="text-[10px]">Cut</span>
            {completedCuts.length > 0 && (
              <span className="text-[9px] bg-red-500 text-white px-1.5 rounded-full font-bold">
                {completedCuts.length}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => { setActiveTab('text'); if (!textOverlays.length) handleAddText(); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-16 transition-all ${
              activeTab === 'text' 
                ? 'text-indigo-600 bg-indigo-50 border-2 border-indigo-200 shadow-sm font-bold' 
                : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            <Type className="w-5 h-5" />
            <span className="text-[10px]">Text</span>
            {textOverlays.length > 0 && (
              <span className="text-[9px] bg-indigo-500 text-white px-1.5 rounded-full font-bold">
                {textOverlays.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => { setActiveTab('media'); if (!mediaOverlays.length) handleAddMedia(); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-16 transition-all ${
              activeTab === 'media' 
                ? 'text-purple-600 bg-purple-50 border-2 border-purple-200 shadow-sm font-bold' 
                : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-[10px]">Media</span>
            {mediaOverlays.length > 0 && (
              <span className="text-[9px] bg-purple-500 text-white px-1.5 rounded-full font-bold">
                {mediaOverlays.length}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('audio')}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-16 transition-all ${
              activeTab === 'audio' 
                ? 'text-emerald-600 bg-emerald-50 border-2 border-emerald-200 shadow-sm font-bold' 
                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <Music className="w-5 h-5" />
            <span className="text-[10px]">Audio</span>
            {hasAudioTrack && (
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col relative bg-[#0f172a] select-none">
          
          {/* Timestamp Indicator */}
          <div className="absolute top-4 left-4 bg-black/75 backdrop-blur-md text-white font-mono font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg z-20 border border-white/20">
            {formatTimeStr(currentTime)} / {formatTimeStr(duration)}
          </div>
          
          <div 
            ref={canvasRef}
            className="flex-1 p-6 flex items-center justify-center relative overflow-hidden touch-none" 
            onClick={() => { setSelectedTextId(null); setSelectedMediaId(null); }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
             {/* Background Audio Player */}
             {hasAudioTrack && audioUrl && (
               <audio ref={audioRef} src={audioUrl} loop className="hidden" />
             )}

             {/* Video Stream */}
             {videoUrl.includes('drive.google.com') ? (
               <iframe 
                 src={videoUrl} 
                 className="w-full h-full max-h-full object-contain border-0 pointer-events-none shadow-2xl rounded-xl bg-black" 
                 allow="autoplay"
               />
             ) : (
               <video 
                 ref={videoRef}
                 src={videoUrl}
                 className="w-full h-full max-h-full object-contain shadow-2xl bg-black rounded-xl"
                 onTimeUpdate={handleTimeUpdate}
                 onLoadedMetadata={handleLoadedMetadata}
                 onClick={handlePlayPause}
               />
             )}
            
            {/* Center Big Play Button (when paused) */}
            {!isPlaying && (
              <button 
                onClick={handlePlayPause} 
                className="absolute m-auto w-16 h-16 bg-blue-600/90 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-all transform hover:scale-110 shadow-2xl z-20"
                title="Play (Space)"
              >
                <Play className="w-8 h-8 ml-1 fill-current" />
              </button>
            )}

            {/* TIMED TEXT OVERLAYS */}
            {textOverlays.map(text => {
              const isVisible = currentTime >= text.start && currentTime <= text.end;
              if (!isVisible) return null;

              const isSelected = selectedTextId === text.id;
              const isMiddleSlide = text.mergeMode === 'middleSlide' || text.stylePreset === 'middleSlide';

              if (isMiddleSlide) {
                return (
                  <div 
                    key={text.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedTextId(text.id); setSelectedMediaId(null); setActiveTab('text'); }}
                    className="absolute inset-0 bg-black/65 backdrop-blur-md z-30 flex items-center justify-center p-8 transition-all animate-in fade-in duration-200"
                  >
                    <div 
                      onPointerDown={(e) => handlePointerDown(e, text.id, 'text')}
                      style={{ 
                        color: text.color || '#ffffff', 
                        fontSize: `${text.size || 32}px`,
                        transform: `rotate(${text.rotation || 0}deg)`
                      }}
                      className={`relative max-w-2xl px-8 py-6 rounded-2xl bg-black/80 border border-white/20 shadow-2xl text-center select-none cursor-move ${
                        isSelected ? 'ring-4 ring-blue-500 scale-105' : 'hover:ring-2 hover:ring-white/40'
                      }`}
                    >
                      <span className="font-bold tracking-tight block leading-snug">{text.text}</span>
                      
                      {/* Floating Toolbar when selected */}
                      {isSelected && (
                        <div 
                          className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 p-1 gap-1 z-50 cursor-default text-xs"
                          onPointerDown={(e) => e.stopPropagation()} 
                        >
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setTextOverlays(prev => prev.map(t => t.id === text.id ? {...t, rotation: (t.rotation || 0) + 45} : t)); 
                            }} 
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
                            title="Rotate 45°"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setTextOverlays(prev => prev.filter(t => t.id !== text.id)); 
                              setSelectedTextId(null); 
                            }} 
                            className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-700"
                            title="Delete text"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Standard floating overlay
              let containerStyle = "font-semibold";
              if (text.stylePreset === 'subtitle' || !text.stylePreset) {
                containerStyle = "bg-slate-950/90 text-white px-5 py-2 rounded-xl border border-white/20 shadow-lg backdrop-blur-md font-semibold tracking-wide text-center";
              } else if (text.stylePreset === 'lowerThird') {
                containerStyle = "bg-slate-950/90 text-white px-5 py-2.5 rounded-r-xl border-l-4 border-blue-500 shadow-lg backdrop-blur-md font-semibold";
              } else if (text.stylePreset === 'badge') {
                containerStyle = "bg-blue-600 text-white px-4 py-1.5 rounded-full font-bold shadow-md ring-1 ring-white/30";
              } else if (text.stylePreset === 'minimal') {
                containerStyle = "text-white font-extrabold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]";
              }

              return (
                <div
                  key={text.id}
                  onPointerDown={(e) => handlePointerDown(e, text.id, 'text')}
                  onClick={(e) => { e.stopPropagation(); setSelectedTextId(text.id); setSelectedMediaId(null); setActiveTab('text'); }}
                  style={{ 
                    left: `${text.x}%`, 
                    top: `${text.y}%`, 
                    color: text.color || '#ffffff', 
                    fontSize: `${text.size}px`, 
                    transform: `translate(-50%, -50%) rotate(${text.rotation || 0}deg)` 
                  }}
                  className={`absolute cursor-move transition-all z-20 select-none ${containerStyle} ${
                    isSelected ? 'ring-2 ring-blue-500 scale-105 z-30' : 'hover:ring-1 hover:ring-white/40'
                  }`}
                >
                  <span className="block text-center whitespace-pre-wrap leading-normal pointer-events-none">
                    {text.text}
                  </span>
                  {/* Floating Toolbar when selected */}
                  {isSelected && (
                    <div 
                      className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 p-1 gap-1 z-50 cursor-default text-xs"
                      onPointerDown={(e) => e.stopPropagation()} 
                    >
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setTextOverlays(prev => prev.map(t => t.id === text.id ? {...t, rotation: (t.rotation || 0) + 45} : t)); 
                        }} 
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
                        title="Rotate 45°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setTextOverlays(prev => prev.filter(t => t.id !== text.id)); 
                          setSelectedTextId(null); 
                        }} 
                        className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-700"
                        title="Delete text"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Corner Resize Handle */}
                  {isSelected && (
                    <div 
                      className="absolute -bottom-2 -right-2 w-5 h-5 bg-blue-600 border-2 border-white rounded-full cursor-nwse-resize z-50 shadow-md"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setResizingOverlay({ id: text.id, type: 'text', startY: e.clientY, initialSize: text.size });
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                    />
                  )}
                  {text.text}
                </div>
              );
            })}

            {/* TIMED MEDIA OVERLAYS */}
            {mediaOverlays.map(media => {
              const isVisible = currentTime >= media.start && currentTime <= media.end;
              if (!isVisible) return null;

              const isSelected = selectedMediaId === media.id;
              const opacity = media.opacity !== undefined ? media.opacity / 100 : 0.9;
              const isMiddleSlide = media.mergeMode === 'middleSlide';

              if (isMiddleSlide) {
                return (
                  <div 
                    key={media.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedMediaId(media.id); setSelectedTextId(null); setActiveTab('media'); }}
                    className="absolute inset-0 bg-black/70 backdrop-blur-md z-30 flex items-center justify-center p-6 transition-all animate-in fade-in duration-200"
                  >
                    <div 
                      onPointerDown={(e) => handlePointerDown(e, media.id, 'media')}
                      style={{ 
                        transform: `scale(${media.scale / 100}) rotate(${media.rotation || 0}deg)`,
                        opacity
                      }}
                      className={`relative max-w-[85%] max-h-[85%] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black/50 p-2 cursor-move ${
                        isSelected ? 'ring-4 ring-blue-500 scale-105' : 'hover:ring-2 hover:ring-white/40'
                      }`}
                    >
                      {media.isVideo ? (
                        <video 
                          src={media.url} 
                          autoPlay 
                          loop 
                          muted 
                          className="max-h-[340px] max-w-full rounded-xl object-contain shadow-2xl" 
                        />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={media.url} 
                          alt="Merged Media" 
                          className="max-h-[340px] max-w-full rounded-xl object-contain shadow-2xl pointer-events-none" 
                          draggable={false} 
                        />
                      )}

                      {/* Floating Toolbar when selected */}
                      {isSelected && (
                        <div 
                          className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 p-1 gap-1 z-50 cursor-default text-xs"
                          onPointerDown={(e) => e.stopPropagation()} 
                        >
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setMediaOverlays(prev => prev.map(m => m.id === media.id ? {...m, rotation: (m.rotation || 0) + 45} : m)); 
                            }} 
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
                            title="Rotate 45°"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setMediaOverlays(prev => prev.filter(m => m.id !== media.id)); 
                              setSelectedMediaId(null); 
                            }} 
                            className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-700"
                            title="Delete image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Standard floating overlay
              return (
                <div
                  key={media.id}
                  onPointerDown={(e) => handlePointerDown(e, media.id, 'media')}
                  onClick={(e) => { e.stopPropagation(); setSelectedMediaId(media.id); setSelectedTextId(null); setActiveTab('media'); }}
                  style={{ 
                    left: `${media.x}%`, 
                    top: `${media.y}%`, 
                    transform: `translate(-50%, -50%) scale(${media.scale / 100}) rotate(${media.rotation || 0}deg)`,
                    opacity
                  }}
                  className={`absolute cursor-move transition-all z-20 select-none ${
                    isSelected ? 'ring-4 ring-blue-500 shadow-2xl z-30' : 'hover:ring-2 hover:ring-white/40'
                  }`}
                >
                  {/* Floating Toolbar when selected */}
                  {isSelected && (
                    <div 
                      className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 p-1 gap-1 z-50 cursor-default text-xs"
                      style={{ transform: `translate(-50%, 0) scale(${100 / (media.scale || 100)})` }}
                      onPointerDown={(e) => e.stopPropagation()} 
                    >
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setMediaOverlays(prev => prev.map(m => m.id === media.id ? {...m, rotation: (m.rotation || 0) + 45} : m)); 
                        }} 
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-700"
                        title="Rotate 45°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setMediaOverlays(prev => prev.filter(m => m.id !== media.id)); 
                          setSelectedMediaId(null); 
                        }} 
                        className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-700"
                        title="Delete image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Corner Resize Handle */}
                  {isSelected && (
                    <div 
                      className="absolute -bottom-2 -right-2 w-6 h-6 bg-blue-600 border-2 border-white rounded-full cursor-nwse-resize z-50 shadow-md"
                      style={{ transform: `scale(${100 / (media.scale || 100)})` }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setResizingOverlay({ id: media.id, type: 'media', startY: e.clientY, initialSize: media.scale });
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                    />
                  )}
                  {media.isVideo ? (
                    <video 
                      src={media.url} 
                      autoPlay 
                      loop 
                      muted 
                      className={`w-[140px] h-[140px] object-cover pointer-events-none ${
                        media.rounded !== false ? 'rounded-2xl shadow-2xl border border-white/20' : 'rounded-none shadow-lg'
                      }`} 
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img 
                      src={media.url} 
                      alt="Overlay" 
                      className={`w-[140px] h-[140px] object-cover pointer-events-none ${
                        media.rounded !== false ? 'rounded-2xl shadow-2xl border border-white/20' : 'rounded-none shadow-lg'
                      }`} 
                      draggable={false} 
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* CANVAS PLAYBACK TOOLBAR (FIXES IMAGE 3) */}
          <div className="h-14 border-t border-slate-700/60 bg-slate-900/90 backdrop-blur-md flex items-center justify-center gap-4 text-white shadow-lg z-10 px-4">
            {/* Rewind -5s button */}
            <button 
              onClick={handleRewind}
              title="Rewind 5 seconds"
              className="px-3 py-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-blue-400" />
              <span>-5s</span>
            </button>

            {/* Play/Pause Button */}
            <button 
              onClick={handlePlayPause} 
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              className="w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-[#1d4ed8] transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current"/> : <Play className="w-5 h-5 ml-0.5 fill-current"/>}
            </button>

            {/* Forward +5s button */}
            <button 
              onClick={handleForward}
              title="Forward 5 seconds"
              className="px-3 py-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold active:scale-95 cursor-pointer"
            >
              <span>+5s</span>
              <RotateCw className="w-4 h-4 text-blue-400" />
            </button>

            <div className="w-px h-5 bg-white/15 mx-1" />

            {/* Mute/Volume Toggle */}
            <button 
              onClick={handleToggleMute} 
              title={isMuted ? "Unmute" : "Mute"}
              className={`p-2 rounded-lg transition-all active:scale-95 cursor-pointer ${
                isMuted ? 'text-red-400 bg-red-500/20' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
            </button>

            <span className="text-xs font-mono text-slate-400 ml-2">
              {formatTimeStr(currentTime)}
            </span>
          </div>
        </div>

        {/* Right Sidebar (Properties Panel) */}
        <div className="w-84 border-l border-blue-100 bg-white p-5 flex flex-col gap-5 overflow-y-auto z-10 shadow-sm text-sm">
          
          {/* TAB 1: OVERVIEW / SELECT */}
          {activeTab === 'select' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Editor Overview</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">Summary of active overlays and cuts in this video.</p>
              </div>

              {/* Status summary */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div 
                  onClick={() => setActiveTab('cut')}
                  className="p-3 bg-red-50 hover:bg-red-100/70 rounded-xl border border-red-200/60 cursor-pointer transition-all"
                >
                  <p className="font-bold text-red-700 flex items-center justify-between">
                    <span>Cuts</span>
                    <Scissors className="w-3.5 h-3.5" />
                  </p>
                  <p className="text-lg font-black text-red-900 mt-1">{completedCuts.length}</p>
                </div>

                <div 
                  onClick={() => setActiveTab('text')}
                  className="p-3 bg-indigo-50 hover:bg-indigo-100/70 rounded-xl border border-indigo-200/60 cursor-pointer transition-all"
                >
                  <p className="font-bold text-indigo-700 flex items-center justify-between">
                    <span>Text</span>
                    <Type className="w-3.5 h-3.5" />
                  </p>
                  <p className="text-lg font-black text-indigo-900 mt-1">{textOverlays.length}</p>
                </div>

                <div 
                  onClick={() => setActiveTab('media')}
                  className="p-3 bg-purple-50 hover:bg-purple-100/70 rounded-xl border border-purple-200/60 cursor-pointer transition-all"
                >
                  <p className="font-bold text-purple-700 flex items-center justify-between">
                    <span>Media</span>
                    <ImageIcon className="w-3.5 h-3.5" />
                  </p>
                  <p className="text-lg font-black text-purple-900 mt-1">{mediaOverlays.length}</p>
                </div>

                <div 
                  onClick={() => setActiveTab('audio')}
                  className="p-3 bg-emerald-50 hover:bg-emerald-100/70 rounded-xl border border-emerald-200/60 cursor-pointer transition-all"
                >
                  <p className="font-bold text-emerald-700 flex items-center justify-between">
                    <span>Audio</span>
                    <Music className="w-3.5 h-3.5" />
                  </p>
                  <p className="text-xs font-bold text-emerald-900 mt-2 truncate">
                    {hasAudioTrack ? 'Active' : 'Off'}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Quick Add</p>
                <button 
                  onClick={() => handleAddText()}
                  className="w-full py-2.5 px-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-slate-700 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Type className="w-4 h-4 text-indigo-500" />
                  <span>Add Subtitle / Caption</span>
                </button>

                <button 
                  onClick={() => handleAddMedia()}
                  className="w-full py-2.5 px-3 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-lg text-slate-700 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-purple-500" />
                  <span>Add Image / Watermark</span>
                </button>

                <button 
                  onClick={initiateNewCut}
                  className="w-full py-2.5 px-3 bg-slate-50 hover:bg-red-50 hover:text-red-700 border border-slate-200 rounded-lg text-slate-700 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Scissors className="w-4 h-4 text-red-500" />
                  <span>Trim or Cut Video</span>
                </button>
              </div>
            </div>
          )}

              {/* TAB 2: CUT TOOL */}
          {activeTab === 'cut' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-red-600" />
                  <span>Cut & Trim Video</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">Remove mistakes or unwanted pauses cleanly.</p>
              </div>

              {/* Active Cut Actions Card if a selection is in progress */}
              {activeCut && (
                <div className="p-4 bg-red-50/90 border-2 border-red-300 rounded-2xl space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-red-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Scissors className="w-4 h-4 text-red-600 animate-pulse" />
                      Cut Selection Active
                    </span>
                    <span className="font-mono text-xs font-extrabold text-red-700 bg-white px-2.5 py-1 rounded-md border border-red-200 shadow-xs">
                      {formatTimeStr(activeCut.start)} - {formatTimeStr(activeCut.end)}
                    </span>
                  </div>

                  <p className="text-[11px] text-red-700 leading-relaxed font-medium">
                    The highlighted section is skipped during preview playback. Choose what to do:
                  </p>

                  <div className="space-y-2">
                    <button
                      onClick={confirmCut}
                      className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Scissors className="w-4 h-4" />
                      Cut Out & Remove Selection
                    </button>

                    <button
                      onClick={trimToActiveSelection}
                      className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                      title="Keeps only this part and trims away the rest of the video"
                    >
                      <Check className="w-4 h-4" />
                      Keep Only Selection (Trim)
                    </button>

                    <button
                      onClick={cancelCut}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium transition-all cursor-pointer"
                    >
                      Cancel Selection
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button 
                  onClick={cutFromStartToNow}
                  className="w-full p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-xs flex items-center justify-between transition-colors cursor-pointer shadow-xs"
                >
                  <span className="font-semibold text-rose-600">Trim Start</span>
                  <span className="font-mono text-slate-500 text-[11px]">0:00 → {formatTimeStr(currentTime)}</span>
                </button>

                <button 
                  onClick={cutFromNowToEnd}
                  className="w-full p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-xs flex items-center justify-between transition-colors cursor-pointer shadow-xs"
                >
                  <span className="font-semibold text-rose-600">Trim End</span>
                  <span className="font-mono text-slate-500 text-[11px]">{formatTimeStr(currentTime)} → End</span>
                </button>

                <button 
                  onClick={initiateNewCut}
                  className="w-full p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-between transition-colors cursor-pointer shadow-sm"
                >
                  <span>Create Cut Region</span>
                  <span className="font-mono text-slate-300 text-[11px]">at {formatTimeStr(currentTime)}</span>
                </button>
              </div>

              {/* List of active cuts */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-600">
                  Cut Segments ({completedCuts.length})
                </p>
                {completedCuts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No cuts applied yet.</p>
                ) : (
                  completedCuts.map((cut, idx) => (
                    <div key={cut.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-700">Cut #{idx + 1}: </span>
                        <span className="font-mono text-red-600">{formatTimeStr(cut.start)} - {formatTimeStr(cut.end)}</span>
                      </div>
                      <button 
                        onClick={() => setCompletedCuts(prev => prev.filter(c => c.id !== cut.id))}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="Remove Cut"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TEXT OVERLAYS */}
          {activeTab === 'text' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <Type className="w-4 h-4 text-indigo-600" />
                    <span>Text Overlays</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">High-clarity subtitles and lower thirds.</p>
                </div>
                <button 
                  onClick={() => handleAddText()}
                  className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Add new text"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {activeText ? (
                <div className="space-y-4">
                  {/* Textarea */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Text Content</label>
                    <textarea 
                      value={activeText.text}
                      onChange={(e) => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, text: e.target.value } : t))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none h-20 shadow-inner font-medium" 
                      placeholder="Type text here..."
                    />
                  </div>

                  {/* Display Mode (Middle Merge vs Floating Overlay) */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Display Mode</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, mergeMode: 'middleSlide', x: 50, y: 50 } : t))}
                        className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                          activeText.mergeMode === 'middleSlide' || !activeText.mergeMode
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        In Video Middle
                        <p className="text-[10px] font-normal opacity-80 mt-0.5">Blurred backdrop with centered card</p>
                      </button>
                      <button
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, mergeMode: 'overlay', x: 50, y: 88 } : t))}
                        className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                          activeText.mergeMode === 'overlay'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Floating Overlay
                        <p className="text-[10px] font-normal opacity-80 mt-0.5">Subtitle or caption over video</p>
                      </button>
                    </div>
                  </div>

                  {/* Style Presets */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Style Preset</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, stylePreset: 'subtitle', color: '#ffffff' } : t))}
                        className={`p-2 rounded-lg border text-left font-medium transition-all cursor-pointer ${
                          activeText.stylePreset === 'subtitle' || !activeText.stylePreset 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Subtitle Box
                      </button>

                      <button
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, stylePreset: 'lowerThird', color: '#ffffff' } : t))}
                        className={`p-2 rounded-lg border text-left font-medium transition-all cursor-pointer ${
                          activeText.stylePreset === 'lowerThird' 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Lower Third
                      </button>

                      <button
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, stylePreset: 'badge', color: '#ffffff' } : t))}
                        className={`p-2 rounded-lg border text-left font-medium transition-all cursor-pointer ${
                          activeText.stylePreset === 'badge' 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Accent Pill
                      </button>

                      <button
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, stylePreset: 'minimal', color: '#ffffff' } : t))}
                        className={`p-2 rounded-lg border text-left font-medium transition-all cursor-pointer ${
                          activeText.stylePreset === 'minimal' 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Clean Text
                      </button>
                    </div>
                  </div>

                  {/* Position Presets */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Position</label>
                    <div className="grid grid-cols-4 gap-1 text-[11px]">
                      <button 
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, x: 50, y: 88 } : t))}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-center text-slate-700 font-semibold cursor-pointer"
                      >
                        Subtitle
                      </button>
                      <button 
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, x: 50, y: 80 } : t))}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-center text-slate-700 font-semibold cursor-pointer"
                      >
                        Lower
                      </button>
                      <button 
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, x: 50, y: 50 } : t))}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-center text-slate-700 font-semibold cursor-pointer"
                      >
                        Center
                      </button>
                      <button 
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, x: 50, y: 12 } : t))}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-center text-slate-700 font-semibold cursor-pointer"
                      >
                        Top
                      </button>
                    </div>
                  </div>

                  {/* Timing: Simplified Start Time + Duration (in seconds) */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Display Timing & Duration</span>
                      <button 
                        type="button"
                        onClick={() => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, start: 0, end: duration || 100 } : t))}
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                      >
                        Entire Video
                      </button>
                    </div>

                    {/* Quick Duration Presets */}
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold mb-1">Quick Duration Presets</p>
                      <div className="grid grid-cols-4 gap-1.5 text-xs">
                        {[
                          { label: '3 sec', secs: 3 },
                          { label: '5 sec', secs: 5 },
                          { label: '10 sec', secs: 10 },
                          { label: 'Full', secs: duration || 100 }
                        ].map((preset) => {
                          const currentDur = Math.max(0.5, Math.round((activeText.end - activeText.start) * 10) / 10);
                          const isActive = preset.secs >= (duration || 99) 
                            ? (activeText.start === 0 && activeText.end >= (duration || 100) - 0.5) 
                            : Math.abs(currentDur - preset.secs) < 0.3;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                if (preset.secs >= (duration || 99)) {
                                  setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, start: 0, end: duration || 100 } : t));
                                } else {
                                  const maxEnd = duration || 100;
                                  const newEnd = Math.min(maxEnd, activeText.start + preset.secs);
                                  setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, end: newEnd } : t));
                                }
                              }}
                              className={`py-1.5 px-2 rounded-lg border text-center font-bold text-xs transition-all cursor-pointer ${
                                isActive 
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 1. Start Time */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-semibold">Start Time:</span>
                        <span className="font-mono font-bold text-slate-900">{formatTimeStr(activeText.start)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range" 
                          min="0" 
                          max={Math.max(0, (duration || 100) - 0.5)} 
                          step="0.1" 
                          value={activeText.start} 
                          onChange={(e) => {
                            const newStart = parseFloat(e.target.value);
                            const currentDur = Math.max(0.5, activeText.end - activeText.start);
                            const maxEnd = duration || 100;
                            const newEnd = Math.min(maxEnd, newStart + currentDur);
                            setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, start: newStart, end: newEnd } : t));
                          }}
                          className="flex-1 accent-blue-600 cursor-pointer" 
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const ct = videoRef.current?.currentTime || currentTime;
                            const currentDur = Math.max(0.5, activeText.end - activeText.start);
                            const maxEnd = duration || 100;
                            const newEnd = Math.min(maxEnd, ct + currentDur);
                            setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, start: ct, end: newEnd } : t));
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-[11px] font-bold shadow-xs whitespace-nowrap cursor-pointer transition-colors"
                          title="Set start time to current playhead position"
                        >
                          Set to Now
                        </button>
                      </div>
                    </div>

                    {/* 2. Show On Screen For (Duration in seconds) */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-semibold">Show On Screen For:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const currentDur = Math.max(0.5, activeText.end - activeText.start);
                              const newDur = Math.max(0.5, currentDur - 1);
                              setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, end: activeText.start + newDur } : t));
                            }}
                            className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-bold cursor-pointer"
                            title="Decrease by 1 second"
                          >
                            -1s
                          </button>
                          <span className="font-mono font-bold text-blue-600 text-xs min-w-[38px] text-center">
                            {Math.max(0.5, Math.round((activeText.end - activeText.start) * 10) / 10).toFixed(1)}s
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const currentDur = Math.max(0.5, activeText.end - activeText.start);
                              const maxEnd = duration || 100;
                              const newEnd = Math.min(maxEnd, activeText.start + currentDur + 1);
                              setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, end: newEnd } : t));
                            }}
                            className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-bold cursor-pointer"
                            title="Increase by 1 second"
                          >
                            +1s
                          </button>
                        </div>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max={Math.max(1, (duration || 100) - activeText.start)} 
                        step="0.5" 
                        value={Math.max(0.5, activeText.end - activeText.start)} 
                        onChange={(e) => {
                          const newDur = parseFloat(e.target.value);
                          const maxEnd = duration || 100;
                          const newEnd = Math.min(maxEnd, activeText.start + newDur);
                          setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, end: newEnd } : t));
                        }}
                        className="w-full accent-blue-600 cursor-pointer" 
                      />
                    </div>

                    {/* Live Timing Summary */}
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                      <p className="text-[11px] text-slate-600">
                        Visible from <span className="font-mono font-bold text-slate-900">{formatTimeStr(activeText.start)}</span> to <span className="font-mono font-bold text-slate-900">{formatTimeStr(activeText.end)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Font Size */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700">Font Size</span>
                      <span className="font-mono text-slate-500">{activeText.size}px</span>
                    </div>
                    <input 
                      type="range" min="14" max="80" value={activeText.size} 
                      onChange={(e) => setTextOverlays(prev => prev.map(t => t.id === activeText.id ? { ...t, size: parseInt(e.target.value) } : t))}
                      className="w-full accent-blue-600 cursor-pointer" 
                    />
                  </div>

                  {/* Delete Text */}
                  <button 
                    onClick={() => { 
                      setTextOverlays(prev => prev.filter(t => t.id !== activeText.id)); 
                      setSelectedTextId(null); 
                    }}
                    className="w-full bg-slate-50 hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Text Overlay
                  </button>
                </div>
              ) : (
                /* List of all text overlays */
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-600">Active Text Overlays ({textOverlays.length})</p>
                  {textOverlays.length === 0 ? (
                    <div className="p-6 bg-slate-50 rounded-xl text-center text-slate-400">
                      <Type className="w-6 h-6 mx-auto mb-2 text-indigo-300" />
                      <p className="text-xs">No text overlays yet. Click "+ Add" above.</p>
                    </div>
                  ) : (
                    textOverlays.map(text => (
                      <div 
                        key={text.id}
                        onClick={() => setSelectedTextId(text.id)}
                        className="p-3 bg-slate-50 hover:bg-indigo-50/60 rounded-xl border border-slate-200 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-slate-800 text-xs truncate">{text.text}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {formatTimeStr(text.start)} - {formatTimeStr(text.end)}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTextOverlays(prev => prev.filter(t => t.id !== text.id));
                          }}
                          className="text-slate-400 hover:text-red-600 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MEDIA OVERLAYS */}
          {activeTab === 'media' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span>Media & Logos</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Watermarks, icons, and picture-in-picture.</p>
                </div>
                <button 
                  onClick={() => handleAddMedia()}
                  className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Add new image"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {activeMedia ? (
                <div className="space-y-4">
                  {/* Upload Custom File (Image or Video) */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Change Photo or Video Clip</label>
                    <label className="flex items-center justify-center w-full h-11 px-4 transition bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl appearance-none cursor-pointer hover:border-purple-500 hover:bg-purple-50 text-xs font-bold text-slate-600">
                      <span className="flex items-center space-x-2">
                        <ImageIcon className="w-4 h-4 text-purple-500" />
                        <span>Upload Photo or Video Clip...</span>
                      </span>
                      <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />
                    </label>
                  </div>

                  {/* Display Mode (In Video Middle vs Floating Watermark) */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Display Mode</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        onClick={() => setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, mergeMode: 'middleSlide', x: 50, y: 50, scale: 100 } : m))}
                        className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                          activeMedia.mergeMode === 'middleSlide' || !activeMedia.mergeMode
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        In Video Middle
                        <p className="text-[10px] font-normal opacity-80 mt-0.5">Cinematic slide with backdrop blur</p>
                      </button>
                      <button
                        onClick={() => setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, mergeMode: 'overlay', scale: 65 } : m))}
                        className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                          activeMedia.mergeMode === 'overlay'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Floating Watermark
                        <p className="text-[10px] font-normal opacity-80 mt-0.5">Corner logo or PiP overlay</p>
                      </button>
                    </div>
                  </div>

                  {/* Position Presets */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Position</label>
                    <div className="grid grid-cols-4 gap-1 text-[11px]">
                      <button 
                        onClick={() => setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, x: 88, y: 12 } : m))}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-center text-slate-700 font-semibold cursor-pointer"
                      >
                        Top-R
                      </button>
                      <button 
                        onClick={() => setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, x: 12, y: 12 } : m))}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-center text-slate-700 font-semibold cursor-pointer"
                      >
                        Top-L
                      </button>
                      <button 
                        onClick={() => setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, x: 88, y: 85 } : m))}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-center text-slate-700 font-semibold cursor-pointer"
                      >
                        Bot-R
                      </button>
                      <button 
                        onClick={() => setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, x: 50, y: 50 } : m))}
                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-center text-slate-700 font-semibold cursor-pointer"
                      >
                        Center
                      </button>
                    </div>
                  </div>

                  {/* Opacity Slider */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700">Opacity (Transparency)</span>
                      <span className="font-mono text-slate-500">{activeMedia.opacity ?? 85}%</span>
                    </div>
                    <input 
                      type="range" min="20" max="100" value={activeMedia.opacity ?? 85} 
                      onChange={(e) => setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, opacity: parseInt(e.target.value) } : m))}
                      className="w-full accent-blue-600 cursor-pointer" 
                    />
                  </div>

                  {/* Scale Slider */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700">Scale</span>
                      <span className="font-mono text-slate-500">{activeMedia.scale}%</span>
                    </div>
                    <input 
                      type="range" min="20" max="250" value={activeMedia.scale} 
                      onChange={(e) => setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, scale: parseInt(e.target.value) } : m))}
                      className="w-full accent-blue-600 cursor-pointer" 
                    />
                  </div>

                  {/* Rounded Corners toggle */}
                  <div className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                    <span className="text-xs font-bold text-slate-700">Rounded Corners & Shadow</span>
                    <input 
                      type="checkbox" 
                      checked={activeMedia.rounded !== false}
                      onChange={(e) => setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, rounded: e.target.checked } : m))}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                  </div>

                  {/* Timing: Simplified Start Time + Duration (in seconds) */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Display Timing & Duration</span>
                      <button 
                        type="button"
                        onClick={() => setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, start: 0, end: duration || 100 } : m))}
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                      >
                        Entire Video
                      </button>
                    </div>

                    {/* Quick Duration Presets */}
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold mb-1">Quick Duration Presets</p>
                      <div className="grid grid-cols-4 gap-1.5 text-xs">
                        {[
                          { label: '3 sec', secs: 3 },
                          { label: '5 sec', secs: 5 },
                          { label: '10 sec', secs: 10 },
                          { label: 'Full', secs: duration || 100 }
                        ].map((preset) => {
                          const currentDur = Math.max(0.5, Math.round((activeMedia.end - activeMedia.start) * 10) / 10);
                          const isActive = preset.secs >= (duration || 99) 
                            ? (activeMedia.start === 0 && activeMedia.end >= (duration || 100) - 0.5) 
                            : Math.abs(currentDur - preset.secs) < 0.3;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                if (preset.secs >= (duration || 99)) {
                                  setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, start: 0, end: duration || 100 } : m));
                                } else {
                                  const maxEnd = duration || 100;
                                  const newEnd = Math.min(maxEnd, activeMedia.start + preset.secs);
                                  setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, end: newEnd } : m));
                                }
                              }}
                              className={`py-1.5 px-2 rounded-lg border text-center font-bold text-xs transition-all cursor-pointer ${
                                isActive 
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 1. Start Time */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-semibold">Start Time:</span>
                        <span className="font-mono font-bold text-slate-900">{formatTimeStr(activeMedia.start)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range" 
                          min="0" 
                          max={Math.max(0, (duration || 100) - 0.5)} 
                          step="0.1" 
                          value={activeMedia.start} 
                          onChange={(e) => {
                            const newStart = parseFloat(e.target.value);
                            const currentDur = Math.max(0.5, activeMedia.end - activeMedia.start);
                            const maxEnd = duration || 100;
                            const newEnd = Math.min(maxEnd, newStart + currentDur);
                            setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, start: newStart, end: newEnd } : m));
                          }}
                          className="flex-1 accent-blue-600 cursor-pointer" 
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const ct = videoRef.current?.currentTime || currentTime;
                            const currentDur = Math.max(0.5, activeMedia.end - activeMedia.start);
                            const maxEnd = duration || 100;
                            const newEnd = Math.min(maxEnd, ct + currentDur);
                            setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, start: ct, end: newEnd } : m));
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-[11px] font-bold shadow-xs whitespace-nowrap cursor-pointer transition-colors"
                          title="Set start time to current playhead position"
                        >
                          Set to Now
                        </button>
                      </div>
                    </div>

                    {/* 2. Show On Screen For (Duration in seconds) */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-semibold">Show On Screen For:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const currentDur = Math.max(0.5, activeMedia.end - activeMedia.start);
                              const newDur = Math.max(0.5, currentDur - 1);
                              setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, end: activeMedia.start + newDur } : m));
                            }}
                            className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-bold cursor-pointer"
                            title="Decrease by 1 second"
                          >
                            -1s
                          </button>
                          <span className="font-mono font-bold text-blue-600 text-xs min-w-[38px] text-center">
                            {Math.max(0.5, Math.round((activeMedia.end - activeMedia.start) * 10) / 10).toFixed(1)}s
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const currentDur = Math.max(0.5, activeMedia.end - activeMedia.start);
                              const maxEnd = duration || 100;
                              const newEnd = Math.min(maxEnd, activeMedia.start + currentDur + 1);
                              setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, end: newEnd } : m));
                            }}
                            className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-bold cursor-pointer"
                            title="Increase by 1 second"
                          >
                            +1s
                          </button>
                        </div>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max={Math.max(1, (duration || 100) - activeMedia.start)} 
                        step="0.5" 
                        value={Math.max(0.5, activeMedia.end - activeMedia.start)} 
                        onChange={(e) => {
                          const newDur = parseFloat(e.target.value);
                          const maxEnd = duration || 100;
                          const newEnd = Math.min(maxEnd, activeMedia.start + newDur);
                          setMediaOverlays(prev => prev.map(m => m.id === activeMedia.id ? { ...m, end: newEnd } : m));
                        }}
                        className="w-full accent-blue-600 cursor-pointer" 
                      />
                    </div>

                    {/* Live Timing Summary */}
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                      <p className="text-[11px] text-slate-600">
                        Visible from <span className="font-mono font-bold text-slate-900">{formatTimeStr(activeMedia.start)}</span> to <span className="font-mono font-bold text-slate-900">{formatTimeStr(activeMedia.end)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Delete Media */}
                  <button 
                    onClick={() => { 
                      setMediaOverlays(prev => prev.filter(m => m.id !== activeMedia.id)); 
                      setSelectedMediaId(null); 
                    }}
                    className="w-full bg-slate-50 hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Image Overlay
                  </button>
                </div>
              ) : (
                /* List of all media overlays */
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-600">Active Media Overlays ({mediaOverlays.length})</p>
                  {mediaOverlays.length === 0 ? (
                    <div className="p-6 bg-slate-50 rounded-xl text-center text-slate-400">
                      <ImageIcon className="w-6 h-6 mx-auto mb-2 text-purple-300" />
                      <p className="text-xs">No media overlays yet. Click "+ Add" above.</p>
                    </div>
                  ) : (
                    mediaOverlays.map(media => (
                      <div 
                        key={media.id}
                        onClick={() => setSelectedMediaId(media.id)}
                        className="p-3 bg-slate-50 hover:bg-purple-50/60 rounded-xl border border-slate-200 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={media.url} alt="" className="w-9 h-9 object-cover rounded-lg border border-slate-300" />
                          <div>
                            <p className="font-bold text-slate-800 text-xs">Image Overlay</p>
                            <p className="text-[10px] text-slate-500">
                              {formatTimeStr(media.start)} - {formatTimeStr(media.end)}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setMediaOverlays(prev => prev.filter(m => m.id !== media.id));
                          }}
                          className="text-slate-400 hover:text-red-600 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AUDIO */}
          {activeTab === 'audio' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Music className="w-4 h-4 text-emerald-600" />
                  <span>Background Audio</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">Add background music or narration track.</p>
              </div>

              {/* Master Audio Toggle */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-emerald-900 text-xs">Enable Background Music</p>
                  <p className="text-[11px] text-emerald-700">Mixes audio track into video playback</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={hasAudioTrack}
                  onChange={(e) => setHasAudioTrack(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 cursor-pointer"
                />
              </div>

              {hasAudioTrack && (
                <div className="space-y-4">
                  {/* Preset tracks */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Preset Music Tracks</label>
                    <div className="space-y-1.5">
                      {PRESET_AUDIO_TRACKS.map(track => (
                        <div 
                          key={track.id}
                          onClick={() => {
                            setAudioUrl(track.url);
                            setAudioTrackTitle(track.title);
                          }}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            audioUrl === track.url 
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold shadow-sm' 
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{track.title}</span>
                          {audioUrl === track.url && <Check className="w-4 h-4 text-emerald-600" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Upload Custom Audio */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Upload Custom Audio</label>
                    <label className="flex items-center justify-center w-full h-11 px-4 transition bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl appearance-none cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 text-xs font-bold text-slate-600">
                      <span className="flex items-center space-x-2">
                        <Music className="w-4 h-4 text-emerald-500" />
                        <span>Choose MP3 or WAV File...</span>
                      </span>
                      <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                    </label>
                  </div>

                  {/* Volume Slider */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700">Music Volume</span>
                      <span className="font-mono text-emerald-600 font-bold">{audioVolume}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" value={audioVolume} 
                      onChange={(e) => setAudioVolume(parseInt(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer" 
                    />
                  </div>

                  {/* Mute original video sound toggle */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Mute Original Video Sound</p>
                      <p className="text-[10px] text-slate-500">Only play the background music</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={muteOriginalAudio}
                      onChange={(e) => setMuteOriginalAudio(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Preview Player */}
                  <audio ref={previewAudioRef} src={audioUrl} />
                  <button 
                    onClick={() => {
                      if (!previewAudioRef.current) return;
                      if (isAudioPreviewPlaying) {
                        previewAudioRef.current.pause();
                        setIsAudioPreviewPlaying(false);
                      } else {
                        previewAudioRef.current.play().catch(() => {});
                        setIsAudioPreviewPlaying(true);
                      }
                    }}
                    className="w-full py-2.5 bg-emerald-100/70 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {isAudioPreviewPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                    <span>{isAudioPreviewPlaying ? "Pause Track Preview" : "Preview Music Track"}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM TIMELINE AREA */}
      <div className="h-52 border-t border-blue-200 bg-white flex flex-col shadow-[0_-4px_20px_rgb(0,0,0,0.03)] z-10 relative select-none">
        <div className="h-10 border-b border-blue-100 flex items-center justify-between px-6 bg-[#f8fafc]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Timeline</span>
            {activeCut && (
              <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md border border-red-200 animate-pulse">
                Adjust Cut Handles on Timeline
              </span>
            )}
          </div>
          <div className="text-xs font-bold font-mono text-blue-700 bg-white border border-blue-200 px-2.5 py-1 rounded-md shadow-sm">
            Total Length: {formatTimeStr(duration)}
          </div>
        </div>

        <div className="flex-1 relative px-6 py-4 bg-white flex flex-col justify-center gap-2">
          
          {/* Main Waveform / Playhead Bar */}
          <div className="relative w-full h-16 flex-shrink-0 mt-3 mb-1">
            {/* Visual Waveform background container with overflow-hidden */}
            <div className="absolute inset-0 bg-blue-50/70 border border-blue-200 rounded-xl overflow-hidden shadow-inner flex">
              {/* Visual Waveform bars */}
              <div className="absolute inset-0 flex items-center justify-between px-2 opacity-25 pointer-events-none">
                {waveformHeights.map((h, i) => (
                  <div key={i} className="w-1 bg-[#2563eb] rounded-full" style={{ height: `${h}%` }}></div>
                ))}
              </div>

              {/* Completed Cuts representation */}
              {duration > 0 && completedCuts.map(cut => {
                const left = (cut.start / duration) * 100;
                const width = ((cut.end - cut.start) / duration) * 100;
                return (
                  <div 
                    key={cut.id}
                    className="absolute top-0 bottom-0 bg-red-500/20 border-l-2 border-r-2 border-red-500 z-10"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                     <div className="absolute inset-0 flex items-center justify-center opacity-40">
                        <div className="w-full h-px bg-red-600 rotate-12"></div>
                        <div className="w-full h-px bg-red-600 -rotate-12 absolute"></div>
                     </div>
                  </div>
                );
              })}
            </div>

            {/* Active Cut handles and floating toolbar (UNCLIPPED) */}
            {activeCut && duration > 0 && (
              <div 
                className="absolute top-0 bottom-0 bg-red-500/30 border-t-2 border-b-2 border-red-600 z-30 shadow-lg rounded"
                style={{ 
                  left: `${(activeCut.start / duration) * 100}%`, 
                  width: `${((activeCut.end - activeCut.start) / duration) * 100}%` 
                }}
              >
                <div 
                  onMouseDown={(e) => { e.preventDefault(); setDragHandle('start'); e.stopPropagation(); }} 
                  className="absolute -left-3 top-0 bottom-0 w-6 bg-red-600 rounded-l-md cursor-ew-resize flex items-center justify-center hover:bg-red-700 shadow-md z-40"
                  title="Drag start handle"
                >
                  <div className="w-1 h-6 border-l border-r border-white/60"></div>
                </div>
                <div 
                  onMouseDown={(e) => { e.preventDefault(); setDragHandle('end'); e.stopPropagation(); }} 
                  className="absolute -right-3 top-0 bottom-0 w-6 bg-red-600 rounded-r-md cursor-ew-resize flex items-center justify-center hover:bg-red-700 shadow-md z-40"
                  title="Drag end handle"
                >
                  <div className="w-1 h-6 border-l border-r border-white/60"></div>
                </div>

                {/* Floating toolbar positioned above timeline */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute -top-11 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur text-white px-2 py-1 rounded-lg shadow-2xl border border-slate-700 z-50 whitespace-nowrap"
                >
                  <span className="text-[10px] font-mono text-red-300 font-bold px-1">
                    {formatTimeStr(activeCut.start)} - {formatTimeStr(activeCut.end)}
                  </span>
                  <button 
                    onClick={confirmCut} 
                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                    title="Cut out and delete this section"
                  >
                    <Scissors className="w-3 h-3"/> Cut Out
                  </button>
                  <button 
                    onClick={trimToActiveSelection} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                    title="Keep ONLY this section and trim everything else"
                  >
                    <Check className="w-3 h-3"/> Keep Selection
                  </button>
                  <button 
                    onClick={cancelCut} 
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer"
                    title="Cancel selection"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Clickable timeline area */}
            <div ref={timelineRef} className="absolute inset-0 z-20 cursor-pointer" onClick={handleTimelineClick} />
            
            {/* Playhead Vertical Line */}
            {duration > 0 && (
              <div 
                className="absolute top-0 bottom-0 w-1 bg-blue-600 z-40 pointer-events-none shadow-[0_0_8px_rgba(37,99,235,0.8)]"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-blue-600 rounded-full shadow-md border-2 border-white"></div>
              </div>
            )}
          </div>
          
          {/* Overlays Markers Strip */}
          <div className="relative w-full h-6 bg-slate-100 rounded-lg overflow-hidden flex items-center">
            {duration > 0 && textOverlays.map(text => {
              const left = (text.start / duration) * 100;
              const width = Math.max(2, ((text.end - text.start) / duration) * 100);
              return (
                <div 
                  key={text.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedTextId(text.id); setActiveTab('text'); }}
                  className="absolute h-4 rounded bg-indigo-500/80 hover:bg-indigo-600 text-[9px] text-white font-bold flex items-center px-1.5 truncate cursor-pointer shadow-sm transition-all"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`Text: ${text.text}`}
                >
                  <span className="truncate">{text.text}</span>
                </div>
              );
            })}

            {duration > 0 && mediaOverlays.map(media => {
              const left = (media.start / duration) * 100;
              const width = Math.max(2, ((media.end - media.start) / duration) * 100);
              return (
                <div 
                  key={media.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedMediaId(media.id); setActiveTab('media'); }}
                  className="absolute h-4 rounded bg-purple-500/80 hover:bg-purple-600 text-[9px] text-white font-bold flex items-center px-1.5 truncate cursor-pointer shadow-sm transition-all"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title="Media overlay"
                >
                  <span className="truncate">Image</span>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* INTERACTIVE VIDEO EDITING TUTORIAL WALKTHROUGH WITH REFERENCE ARROWS */}
      {showTutorial && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-200"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowTutorial(false);
                try { localStorage.setItem('rcrd_video_editor_tutorial_seen', 'true'); } catch {}
              }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Close Tutorial"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header with step pill */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                Step {tutorialStep + 1} of 4
              </span>
              <span className="text-xs font-semibold text-slate-400">Interactive Editor Guide</span>
            </div>

            {/* Step 1: Timing & Duration */}
            {tutorialStep === 0 && (
              <>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    How to Set Display Timing & Duration
                  </h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Effortlessly control when text or images appear on screen
                  </p>
                </div>

                <div className="relative bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-xl p-4 border border-blue-100 flex items-center justify-between overflow-hidden min-h-[105px]">
                  <div className="space-y-1.5 max-w-[280px]">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      No more calculating confusing numbers! Simply pick a 1-click preset (<span className="font-bold text-slate-900">3s, 5s, 10s, Full</span>) or slide <span className="font-bold text-blue-600">Show On Screen For</span> in seconds. Click <span className="font-bold text-slate-900">Set to Now</span> to align with video playhead.
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center pl-2">
                    <CurvedTutorialArrow rotation={25} />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 font-medium">
                  Tip: Use the <span className="font-bold text-slate-800">[-1s]</span> and <span className="font-bold text-slate-800">[+1s]</span> buttons to nudge duration without moving sliders.
                </div>
              </>
            )}

            {/* Step 2: In Video Middle vs Floating */}
            {tutorialStep === 1 && (
              <>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Add Titles, Subtitles & Watermarks
                  </h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Choose between full-screen title slides or floating subtitles
                  </p>
                </div>

                <div className="relative bg-gradient-to-br from-slate-50 to-indigo-50/50 rounded-xl p-4 border border-indigo-100 flex items-center justify-between overflow-hidden min-h-[105px]">
                  <div className="space-y-1.5 max-w-[280px]">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      Choose <span className="font-bold text-slate-900">In Video Middle</span> to display a cinematic centered card with backdrop blur for section headers. Or choose <span className="font-bold text-slate-900">Floating Overlay</span> for subtitles. Drag anywhere on the video preview!
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center pl-2">
                    <CurvedTutorialArrow rotation={-15} strokeColor="#4f46e5" />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 font-medium">
                  Tip: Subtitle text is cleanly bordered and shadowed so it never looks duplicated or blurry.
                </div>
              </>
            )}

            {/* Step 3: Cutting & Trimming */}
            {tutorialStep === 2 && (
              <>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Cut Out Mistakes & Trim Video
                  </h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Remove awkward pauses or trim the start and end
                  </p>
                </div>

                <div className="relative bg-gradient-to-br from-slate-50 to-rose-50/50 rounded-xl p-4 border border-rose-100 flex items-center justify-between overflow-hidden min-h-[105px]">
                  <div className="space-y-1.5 max-w-[280px]">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      Pause the video at any time. Click <span className="font-bold text-slate-900">Trim Start</span> or <span className="font-bold text-slate-900">Trim End</span> for 1-click trimming, or click <span className="font-bold text-slate-900">Create Cut Region</span> to cut a middle section.
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center pl-2">
                    <CurvedTutorialArrow rotation={65} strokeColor="#e11d48" />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 font-medium">
                  Tip: Red highlighted sections on the timeline are skipped seamlessly during playback.
                </div>
              </>
            )}

            {/* Step 4: Save & Sync */}
            {tutorialStep === 3 && (
              <>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Save Changes & Instant Sync
                  </h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    Your edits immediately apply to video playback everywhere
                  </p>
                </div>

                <div className="relative bg-gradient-to-br from-slate-50 to-emerald-50/50 rounded-xl p-4 border border-emerald-100 flex items-center justify-between overflow-hidden min-h-[105px]">
                  <div className="space-y-1.5 max-w-[280px]">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      When you are done editing, click the blue <span className="font-bold text-blue-600">Save Changes</span> button in the top right. Your title slides, cuts, watermarks, and background audio will automatically play in your library and meeting recordings!
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center pl-2">
                    <CurvedTutorialArrow rotation={-45} strokeColor="#059669" />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 font-medium">
                  Tip: You can re-open this guide anytime by clicking <span className="font-bold text-slate-800">Tutorial & Guide</span> in the top bar.
                </div>
              </>
            )}

            {/* Step Progress Dots & Navigation */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTutorialStep(idx);
                      if (idx === 0 || idx === 1) setActiveTab('text');
                      if (idx === 2) setActiveTab('cut');
                      if (idx === 3) setActiveTab('select');
                    }}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === tutorialStep 
                        ? 'w-6 bg-blue-600' 
                        : 'w-2 bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center gap-2">
                {tutorialStep > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const prevStep = tutorialStep - 1;
                      setTutorialStep(prevStep);
                      if (prevStep === 0 || prevStep === 1) setActiveTab('text');
                      if (prevStep === 2) setActiveTab('cut');
                      if (prevStep === 3) setActiveTab('select');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (tutorialStep < 3) {
                      const nextStep = tutorialStep + 1;
                      setTutorialStep(nextStep);
                      if (nextStep === 0 || nextStep === 1) setActiveTab('text');
                      if (nextStep === 2) setActiveTab('cut');
                      if (nextStep === 3) setActiveTab('select');
                    } else {
                      setShowTutorial(false);
                      try { localStorage.setItem('rcrd_video_editor_tutorial_seen', 'true'); } catch {}
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  {tutorialStep < 3 ? (
                    <>
                      <span>Next Step</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Got It, Let&apos;s Edit!</span>
                      <Check className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
