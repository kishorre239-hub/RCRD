import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Scissors, Play, Pause, ChevronLeft, Volume2, VolumeX, MousePointer2, 
  Type, Image as ImageIcon, Music, Download, Check, Trash2, RotateCcw, 
  RotateCw, Plus, CheckCircle2, Sliders, HelpCircle,
  ArrowRight, X
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

// Directional pointing arrow with bouncing keyframe animations pointing to specific UI features
function AnimatedPointingArrow({ 
  direction = 'left',
  className = '', 
  strokeColor = '#2563eb'
}: { 
  direction?: 'left' | 'up' | 'down' | 'right';
  className?: string; 
  strokeColor?: string;
}) {
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      <style>{`
        @keyframes arrowBounceLeft {
          0%, 100% { transform: translateX(0) scale(1); }
          50% { transform: translateX(-10px) scale(1.05); }
        }
        @keyframes arrowBounceUp {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.05); }
        }
        .anim-arrow-left { animation: arrowBounceLeft 1s ease-in-out infinite; }
        .anim-arrow-up { animation: arrowBounceUp 1s ease-in-out infinite; }
      `}</style>

      {direction === 'left' && (
        <div className="anim-arrow-left flex items-center">
          <svg viewBox="0 0 120 70" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-14 filter drop-shadow-[0_4px_12px_rgba(37,99,235,0.45)]">
            <path d="M110 50 C 90 65, 70 60, 50 35 C 38 20, 25 25, 14 35" stroke={strokeColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M26 22 L10 35 L26 48" stroke={strokeColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 20 L3 15" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
            <path d="M4 35 L-2 35" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
            <path d="M8 50 L3 55" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {direction === 'up' && (
        <div className="anim-arrow-up flex flex-col items-center">
          <svg viewBox="0 0 70 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-24 filter drop-shadow-[0_4px_12px_rgba(37,99,235,0.45)]">
            <path d="M50 110 C 65 90, 60 70, 35 50 C 20 38, 25 25, 35 14" stroke={strokeColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 26 L35 10 L48 26" stroke={strokeColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 8 L15 3" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
            <path d="M35 4 L35 -2" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
            <path d="M50 8 L55 3" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      )}
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
    if (!isOpen) return;
    const timer = setTimeout(() => {
      try {
        const hasSeen = localStorage.getItem('rcrd_video_editor_tutorial_seen');
        if (!hasSeen) {
          setShowTutorial(true);
        }
      } catch {}
    }, 50);
    return () => clearTimeout(timer);
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

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handlePlayPause = useCallback(() => {
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
  }, [isPlaying, hasAudioTrack, audioUrl]);

  // Restore saved data on open
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      let loaded = false;
      // 1. Try initialEditorData
      if (initialEditorData) {
        try {
          const parsed = typeof initialEditorData === 'string' ? JSON.parse(initialEditorData) : initialEditorData;
          if (parsed && typeof parsed === 'object') {
            const p = parsed as Record<string, unknown>;
            if (Array.isArray(p.textOverlays)) setTextOverlays(p.textOverlays as TextOverlay[]);
            if (Array.isArray(p.mediaOverlays)) setMediaOverlays(p.mediaOverlays as MediaOverlay[]);
            if (Array.isArray(p.completedCuts)) setCompletedCuts(p.completedCuts as CutRegion[]);
            if (p.audio && typeof p.audio === 'object') {
              const a = p.audio as Record<string, unknown>;
              setHasAudioTrack(!!a.enabled);
              if (typeof a.url === 'string') setAudioUrl(a.url);
              if (typeof a.volume === 'number') setAudioVolume(a.volume);
              if (typeof a.title === 'string') setAudioTrackTitle(a.title);
              if (typeof a.muteOriginalAudio === 'boolean') setMuteOriginalAudio(a.muteOriginalAudio);
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
            if (parsed && typeof parsed === 'object') {
              if (Array.isArray(parsed.textOverlays)) setTextOverlays(parsed.textOverlays as TextOverlay[]);
              if (Array.isArray(parsed.mediaOverlays)) setMediaOverlays(parsed.mediaOverlays as MediaOverlay[]);
              if (Array.isArray(parsed.completedCuts)) setCompletedCuts(parsed.completedCuts as CutRegion[]);
              if (parsed.audio) {
                setHasAudioTrack(!!parsed.audio.enabled);
                if (parsed.audio.url) setAudioUrl(parsed.audio.url);
                if (parsed.audio.volume !== undefined) setAudioVolume(parsed.audio.volume);
                if (parsed.audio.title) setAudioTrackTitle(parsed.audio.title);
                if (parsed.audio.muteOriginalAudio !== undefined) setMuteOriginalAudio(parsed.audio.muteOriginalAudio);
              }
            }
          }
        } catch (e) {
          console.warn('Could not load localStorage edits', e);
        }
      }
    }, 10);

    return () => clearTimeout(timer);
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
  }, [isOpen, handlePlayPause]);

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
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      setCurrentTime(start);
    }
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
    if (videoRef.current) {
      videoRef.current.currentTime = start;
      setCurrentTime(start);
    }
  };

  const handlePointerDown = (e: React.PointerEvent, id: string, type: 'text' | 'media') => {
    e.stopPropagation();
    if (type === 'text') {
      setSelectedTextId(id);
      setSelectedMediaId(null);
      setActiveTab('text');
      const item = textOverlays.find(t => t.id === id);
      if (item && videoRef.current) {
        videoRef.current.currentTime = item.start;
        setCurrentTime(item.start);
      }
    } else {
      setSelectedMediaId(id);
      setSelectedTextId(null);
      setActiveTab('media');
      const item = mediaOverlays.find(m => m.id === id);
      if (item && videoRef.current) {
        videoRef.current.currentTime = item.start;
        setCurrentTime(item.start);
      }
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
      const meta = JSON.parse(localStorage.getItem(`video-meta-${videoId}`) || '{}');
      meta.editorData = editorData;
      localStorage.setItem(`video-meta-${videoId}`, JSON.stringify(meta));
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
          editorData: editorData
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

  if (!isOpen) return null;

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
              id="editor-save-btn"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className={`bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-75 cursor-pointer ${
                showTutorial && tutorialStep === 4 ? 'ring-4 ring-blue-400 ring-offset-2 animate-pulse' : ''
              }`}
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
            id="editor-tab-overview"
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
            id="editor-tab-cut"
            onClick={() => { setActiveTab('cut'); initiateNewCut(); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-16 transition-all relative ${
              showTutorial && tutorialStep === 0 ? 'ring-4 ring-rose-400 ring-offset-2 z-30' : ''
            } ${
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
            id="editor-tab-text"
            onClick={() => { setActiveTab('text'); if (!textOverlays.length) handleAddText(); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-16 transition-all relative ${
              showTutorial && tutorialStep === 1 ? 'ring-4 ring-indigo-400 ring-offset-2 z-30' : ''
            } ${
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
            id="editor-tab-media"
            onClick={() => { setActiveTab('media'); if (!mediaOverlays.length) handleAddMedia(); }}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-16 transition-all relative ${
              showTutorial && tutorialStep === 2 ? 'ring-4 ring-purple-400 ring-offset-2 z-30' : ''
            } ${
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
            id="editor-tab-audio"
            onClick={() => setActiveTab('audio')}
            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl w-16 transition-all relative ${
              showTutorial && tutorialStep === 3 ? 'ring-4 ring-emerald-400 ring-offset-2 z-30' : ''
            } ${
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
              const isVisible = (currentTime >= text.start && currentTime <= text.end) || (selectedTextId === text.id && activeTab === 'text');
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
                </div>
              );
            })}

            {/* TIMED MEDIA OVERLAYS */}
            {mediaOverlays.map(media => {
              const isVisible = (currentTime >= media.start && currentTime <= media.end) || (selectedMediaId === media.id && activeTab === 'media');
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
          {/* TAB 2: CUT TOOL */}
          {activeTab === 'cut' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-rose-600" />
                    <span>Cut & Trim Video</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Remove mistakes or unwanted pauses cleanly.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTutorial(true)}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Guide
                </button>
              </div>

              {/* Quick How-To Banner */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-3 space-y-2">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  💡 How to Cut Video in 3 Steps:
                </span>
                <div className="text-[11px] text-slate-600 space-y-1 font-medium leading-relaxed">
                  <div className="flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <span>Play and pause video at the mistake you want to remove.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <span>Click <b>Cut Beginning</b>, <b>Cut Ending</b>, or select a middle part below.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <span>That section is skipped automatically during preview and playback!</span>
                  </div>
                </div>
              </div>

              {/* Quick 1-Click Trim Actions */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                  Quick 1-Click Trim
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    type="button"
                    onClick={cutFromStartToNow}
                    disabled={currentTime < 0.2}
                    className="w-full p-3 bg-white hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 rounded-xl text-left transition-all cursor-pointer shadow-xs group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-800 group-hover:text-rose-700 flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-rose-500" />
                        Cut Off Beginning (Intro)
                      </span>
                      <span className="font-mono text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        0:00 → {formatTimeStr(currentTime)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Deletes everything before playhead so the video starts at {formatTimeStr(currentTime)}.
                    </p>
                  </button>

                  <button 
                    type="button"
                    onClick={cutFromNowToEnd}
                    disabled={duration <= currentTime + 0.2}
                    className="w-full p-3 bg-white hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 rounded-xl text-left transition-all cursor-pointer shadow-xs group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-800 group-hover:text-rose-700 flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-rose-500" />
                        Cut Off Ending (Outro)
                      </span>
                      <span className="font-mono text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {formatTimeStr(currentTime)} → End
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Deletes everything after playhead so the video stops at {formatTimeStr(currentTime)}.
                    </p>
                  </button>
                </div>
              </div>

              {/* Cut Section in Middle */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                      Cut Section in Middle
                    </label>
                    <p className="text-[11px] text-slate-500">Remove an awkward pause, mistake, or cough</p>
                  </div>
                  {!activeCut && (
                    <button
                      type="button"
                      onClick={initiateNewCut}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Mark Section
                    </button>
                  )}
                </div>

                {activeCut ? (
                  <div className="p-3.5 bg-rose-50/90 border-2 border-rose-300 rounded-2xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                        <Scissors className="w-4 h-4 text-rose-600 animate-pulse" />
                        Marked Section to Remove
                      </span>
                      <span className="font-mono text-xs font-extrabold text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-200">
                        {formatTimeStr(activeCut.start)} → {formatTimeStr(activeCut.end)}
                      </span>
                    </div>

                    {/* Quick Set Buttons at Current Time */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newStart = Math.min(currentTime, activeCut.end - 0.2);
                          setActiveCut({ ...activeCut, start: Math.max(0, newStart) });
                        }}
                        className="py-1.5 px-2 bg-white hover:bg-rose-100/70 border border-rose-200 rounded-lg text-xs font-bold text-slate-700 flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Set start of cut to current video playhead"
                      >
                        📍 Start at Now ({formatTimeStr(currentTime)})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newEnd = Math.max(currentTime, activeCut.start + 0.2);
                          setActiveCut({ ...activeCut, end: Math.min(duration || 100, newEnd) });
                        }}
                        className="py-1.5 px-2 bg-white hover:bg-rose-100/70 border border-rose-200 rounded-lg text-xs font-bold text-slate-700 flex items-center justify-center gap-1 transition-all cursor-pointer"
                        title="Set end of cut to current video playhead"
                      >
                        📍 End at Now ({formatTimeStr(currentTime)})
                      </button>
                    </div>

                    {/* Sliders for precise adjustment */}
                    <div className="space-y-2 bg-white/80 p-2.5 rounded-xl border border-rose-200">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-600">Cut Start Time:</span>
                          <span className="font-mono font-bold text-slate-900">{formatTimeStr(activeCut.start)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={Math.max(0, activeCut.end - 0.2)}
                          step="0.1"
                          value={activeCut.start}
                          onChange={(e) => setActiveCut({ ...activeCut, start: parseFloat(e.target.value) })}
                          className="w-full accent-rose-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-600">Cut End Time:</span>
                          <span className="font-mono font-bold text-slate-900">{formatTimeStr(activeCut.end)}</span>
                        </div>
                        <input
                          type="range"
                          min={activeCut.start + 0.2}
                          max={duration || 100}
                          step="0.1"
                          value={activeCut.end}
                          onChange={(e) => setActiveCut({ ...activeCut, end: parseFloat(e.target.value) })}
                          className="w-full accent-rose-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* CapCut / InShot Style Actions: Keep Selected Range as primary */}
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={trimToActiveSelection}
                        className="w-full py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex flex-col items-center justify-center gap-0.5 shadow-md shadow-emerald-600/20 transition-all active:scale-98 cursor-pointer border border-emerald-500"
                        title="Keeps only this selected portion and cuts out everything before and after"
                      >
                        <div className="flex items-center gap-1.5 text-sm">
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>✂️ Keep Only This Range ({formatTimeStr(activeCut.start)} → {formatTimeStr(activeCut.end)})</span>
                        </div>
                        <span className="text-[10px] font-medium text-emerald-100">
                          Keeps this clip & cuts out remaining parts (00:00 to {formatTimeStr(activeCut.start)} & {formatTimeStr(activeCut.end)} to End)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={confirmCut}
                        className="w-full py-2 px-3 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        title="Cuts out and deletes only this selected section"
                      >
                        <Scissors className="w-3.5 h-3.5 text-rose-500" />
                        <span>❌ Delete This Range Instead (Cut Out {formatTimeStr(activeCut.start)} → {formatTimeStr(activeCut.end)})</span>
                      </button>

                      <button
                        type="button"
                        onClick={cancelCut}
                        className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-medium transition-all cursor-pointer"
                      >
                        Cancel Selection
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={initiateNewCut}
                    className="w-full py-3 px-4 bg-slate-50 hover:bg-blue-50 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-2xl text-slate-700 hover:text-blue-700 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Scissors className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                    <span>Click to Mark & Cut a Middle Section</span>
                  </button>
                )}
              </div>

              {/* List of active cuts */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Applied Cuts ({completedCuts.length})
                  </p>
                  {completedCuts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCompletedCuts([])}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      Reset All Cuts
                    </button>
                  )}
                </div>

                {completedCuts.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <p className="text-xs text-slate-500 font-medium">No cuts applied yet.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Use the buttons above to trim start/end or cut out mistakes.</p>
                  </div>
                ) : (
                  completedCuts.map((cut, idx) => {
                    const cutDuration = Math.max(0.1, cut.end - cut.start);
                    return (
                      <div key={cut.id} className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">Cut #{idx + 1}</span>
                            <span className="font-mono font-bold text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                              {formatTimeStr(cut.start)} → {formatTimeStr(cut.end)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {cutDuration.toFixed(1)}s removed & skipped during playback
                          </p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setCompletedCuts(prev => prev.filter(c => c.id !== cut.id))}
                          className="px-2.5 py-1.5 bg-white hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                          title="Restore this cut"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      </div>
                    );
                  })
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
                      <p className="text-xs">No text overlays yet. Click &quot;+ Add&quot; above.</p>
                    </div>
                  ) : (
                    textOverlays.map(text => (
                      <div 
                        key={text.id}
                        onClick={() => {
                          setSelectedTextId(text.id);
                          if (videoRef.current) {
                            videoRef.current.currentTime = text.start;
                            setCurrentTime(text.start);
                          }
                        }}
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
                      <p className="text-xs">No media overlays yet. Click &quot;+ Add&quot; above.</p>
                    </div>
                  ) : (
                    mediaOverlays.map(media => (
                      <div 
                        key={media.id}
                        onClick={() => {
                          setSelectedMediaId(media.id);
                          if (videoRef.current) {
                            videoRef.current.currentTime = media.start;
                            setCurrentTime(media.start);
                          }
                        }}
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

            {/* Active Cut handles and floating toolbar (CapCut/InShot Keep Selected Range) */}
            {activeCut && duration > 0 && (
              <>
                {/* Visual indicator for region BEFORE selection (trimmed out if Keep Range clicked) */}
                {activeCut.start > 0.05 && (
                  <div 
                    className="absolute top-0 bottom-0 bg-red-600/25 border-r-2 border-red-500 z-20 pointer-events-none rounded-l-xl overflow-hidden flex items-center justify-center"
                    style={{ left: 0, width: `${(activeCut.start / duration) * 100}%` }}
                  >
                    <span className="text-[10px] font-black text-red-700 bg-white/95 px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">
                      Cut Out
                    </span>
                  </div>
                )}

                {/* Selected Range: GREEN/EMERALD to visually signify KEPT CLIP */}
                <div 
                  className="absolute top-0 bottom-0 bg-emerald-500/25 border-t-2 border-b-2 border-emerald-500 z-30 shadow-lg rounded"
                  style={{ 
                    left: `${(activeCut.start / duration) * 100}%`, 
                    width: `${((activeCut.end - activeCut.start) / duration) * 100}%` 
                  }}
                >
                  {/* Left Drag Handle */}
                  <div 
                    onMouseDown={(e) => { e.preventDefault(); setDragHandle('start'); e.stopPropagation(); }} 
                    className="absolute -left-3 top-0 bottom-0 w-6 bg-emerald-600 rounded-l-md cursor-ew-resize flex items-center justify-center hover:bg-emerald-700 shadow-md z-40"
                    title="Drag start handle"
                  >
                    <div className="w-1 h-6 border-l border-r border-white/80"></div>
                  </div>
                  {/* Right Drag Handle */}
                  <div 
                    onMouseDown={(e) => { e.preventDefault(); setDragHandle('end'); e.stopPropagation(); }} 
                    className="absolute -right-3 top-0 bottom-0 w-6 bg-emerald-600 rounded-r-md cursor-ew-resize flex items-center justify-center hover:bg-emerald-700 shadow-md z-40"
                    title="Drag end handle"
                  >
                    <div className="w-1 h-6 border-l border-r border-white/80"></div>
                  </div>

                  {/* Floating toolbar positioned above timeline */}
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute -top-11 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur text-white px-2.5 py-1 rounded-xl shadow-2xl border border-slate-700 z-50 whitespace-nowrap"
                  >
                    <span className="text-[10px] font-mono text-emerald-300 font-bold px-1">
                      🟢 Keep: {formatTimeStr(activeCut.start)} - {formatTimeStr(activeCut.end)}
                    </span>
                    <button 
                      onClick={trimToActiveSelection} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                      title="Keep ONLY this section and trim everything else outside"
                    >
                      <Check className="w-3 h-3"/> Keep Range
                    </button>
                    <button 
                      onClick={confirmCut} 
                      className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                      title="Delete only this section"
                    >
                      <Scissors className="w-3 h-3"/> Delete Section
                    </button>
                    <button 
                      onClick={cancelCut} 
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer"
                      title="Cancel selection"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Visual indicator for region AFTER selection (trimmed out if Keep Range clicked) */}
                {activeCut.end < duration - 0.05 && (
                  <div 
                    className="absolute top-0 bottom-0 bg-red-600/25 border-l-2 border-red-500 z-20 pointer-events-none rounded-r-xl overflow-hidden flex items-center justify-center"
                    style={{ 
                      left: `${(activeCut.end / duration) * 100}%`, 
                      width: `${((duration - activeCut.end) / duration) * 100}%` 
                    }}
                  >
                    <span className="text-[10px] font-black text-red-700 bg-white/95 px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">
                      Cut Out
                    </span>
                  </div>
                )}
              </>
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

      {/* IN-CONTEXT INTERACTIVE TUTORIAL WITH ANIMATED POINTING ARROWS */}
      {showTutorial && (
        <div className="fixed inset-0 z-[120] pointer-events-none select-none">
          {/* Subtle dimming backdrop that allows seeing the editor */}
          <div 
            className="absolute inset-0 bg-slate-950/40 pointer-events-auto backdrop-blur-[1px] transition-opacity" 
            onClick={() => {
              if (tutorialStep < 4) {
                setTutorialStep(s => {
                  const next = s + 1;
                  if (next === 1) setActiveTab('text');
                  if (next === 2) setActiveTab('media');
                  if (next === 3) setActiveTab('audio');
                  if (next === 4) setActiveTab('select');
                  return next;
                });
              } else {
                setShowTutorial(false);
                try { localStorage.setItem('rcrd_video_editor_tutorial_seen', 'true'); } catch {}
              }
            }}
          />

          {/* STEP 0: CUT TOOL (Points directly at Cut button in left sidebar) */}
          {tutorialStep === 0 && (
            <div 
              className="absolute left-[84px] top-[135px] flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-300 z-[130]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Pointing Animated Arrow pointing LEFT directly at Cut tab button */}
              <AnimatedPointingArrow direction="left" strokeColor="#e11d48" />

              {/* Floating Tooltip Card */}
              <div className="w-[370px] bg-white rounded-2xl p-5 shadow-2xl border-2 border-rose-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black tracking-wider uppercase bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-200">
                    Step 1 of 5 • Cut & Trim
                  </span>
                  <button 
                    type="button" 
                    onClick={() => { setShowTutorial(false); try { localStorage.setItem('rcrd_video_editor_tutorial_seen', 'true'); } catch {} }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Scissors className="w-4 h-4 text-rose-600" />
                    CapCut-Style Cut & Trim
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Select the exact seconds of the video you want. Click <strong className="text-emerald-700 font-bold">&quot;Keep Only This Range&quot;</strong> to trim away everything before and after — or click <strong className="text-rose-700 font-bold">&quot;Delete Section&quot;</strong> to cut out middle pauses!
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 font-semibold space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Green on timeline = Clip you keep</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                    <span>Red hatched zones = Parts cut out</span>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2, 3, 4].map(idx => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTutorialStep(idx);
                          if (idx === 0) setActiveTab('cut');
                          if (idx === 1) setActiveTab('text');
                          if (idx === 2) setActiveTab('media');
                          if (idx === 3) setActiveTab('audio');
                          if (idx === 4) setActiveTab('select');
                        }}
                        className={`h-2 rounded-full transition-all cursor-pointer ${idx === 0 ? 'w-6 bg-rose-600' : 'w-2 bg-slate-200 hover:bg-slate-300'}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTutorialStep(1);
                      setActiveTab('text');
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>Next: Text & Subtitles</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: TEXT TOOL (Points directly at Text button in left sidebar) */}
          {tutorialStep === 1 && (
            <div 
              className="absolute left-[84px] top-[210px] flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-300 z-[130]"
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatedPointingArrow direction="left" strokeColor="#4f46e5" />

              <div className="w-[370px] bg-white rounded-2xl p-5 shadow-2xl border-2 border-indigo-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black tracking-wider uppercase bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    Step 2 of 5 • Subtitles & Slides
                  </span>
                  <button 
                    type="button" 
                    onClick={() => { setShowTutorial(false); try { localStorage.setItem('rcrd_video_editor_tutorial_seen', 'true'); } catch {} }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Type className="w-4 h-4 text-indigo-600" />
                    Subtitles & In-Video Slides
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Add text anywhere in the middle of your video! Choose <strong className="text-slate-900">&quot;In Video Middle&quot;</strong> for full centered title cards or <strong className="text-slate-900">&quot;Subtitle&quot;</strong> for bottom captions. Set exact appearance seconds and drag freely on preview!
                  </p>
                </div>

                <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 font-semibold">
                  💡 Tip: Clicking on any subtitle in the list automatically jumps the playhead to that exact second so you can see and edit it live!
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2, 3, 4].map(idx => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTutorialStep(idx);
                          if (idx === 0) setActiveTab('cut');
                          if (idx === 1) setActiveTab('text');
                          if (idx === 2) setActiveTab('media');
                          if (idx === 3) setActiveTab('audio');
                          if (idx === 4) setActiveTab('select');
                        }}
                        className={`h-2 rounded-full transition-all cursor-pointer ${idx === 1 ? 'w-6 bg-indigo-600' : 'w-2 bg-slate-200 hover:bg-slate-300'}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setTutorialStep(0); setActiveTab('cut'); }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTutorialStep(2); setActiveTab('media'); }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span>Next: Media & Logos</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MEDIA TOOL (Points directly at Media button in left sidebar) */}
          {tutorialStep === 2 && (
            <div 
              className="absolute left-[84px] top-[285px] flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-300 z-[130]"
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatedPointingArrow direction="left" strokeColor="#9333ea" />

              <div className="w-[370px] bg-white rounded-2xl p-5 shadow-2xl border-2 border-purple-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black tracking-wider uppercase bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200">
                    Step 3 of 5 • Photos & Stickers
                  </span>
                  <button 
                    type="button" 
                    onClick={() => { setShowTutorial(false); try { localStorage.setItem('rcrd_video_editor_tutorial_seen', 'true'); } catch {} }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    Image, Logo & Clip Overlays
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Upload your company logo, photos, or video clips to appear at specific seconds. Choose corner watermark or full middle slide, adjust scale and transparency, and drag anywhere!
                  </p>
                </div>

                <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl text-[11px] text-purple-900 font-semibold">
                  💡 Tip: Use the Quick Presets (3s, 5s, 10s, Full) to effortlessly set how long images stay on screen!
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2, 3, 4].map(idx => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTutorialStep(idx);
                          if (idx === 0) setActiveTab('cut');
                          if (idx === 1) setActiveTab('text');
                          if (idx === 2) setActiveTab('media');
                          if (idx === 3) setActiveTab('audio');
                          if (idx === 4) setActiveTab('select');
                        }}
                        className={`h-2 rounded-full transition-all cursor-pointer ${idx === 2 ? 'w-6 bg-purple-600' : 'w-2 bg-slate-200 hover:bg-slate-300'}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setTutorialStep(1); setActiveTab('text'); }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTutorialStep(3); setActiveTab('audio'); }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span>Next: Audio & Music</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: AUDIO TOOL (Points directly at Audio button in left sidebar) */}
          {tutorialStep === 3 && (
            <div 
              className="absolute left-[84px] top-[355px] flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-300 z-[130]"
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatedPointingArrow direction="left" strokeColor="#059669" />

              <div className="w-[370px] bg-white rounded-2xl p-5 shadow-2xl border-2 border-emerald-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black tracking-wider uppercase bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Step 4 of 5 • Background Audio
                  </span>
                  <button 
                    type="button" 
                    onClick={() => { setShowTutorial(false); try { localStorage.setItem('rcrd_video_editor_tutorial_seen', 'true'); } catch {} }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Music className="w-4 h-4 text-emerald-600" />
                    Background Music & Sound
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Add soothing background music or upload your own narration track. Adjust track volume and optionally mute original camera audio with one toggle!
                  </p>
                </div>

                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-semibold">
                  💡 Tip: The music automatically loops and syncs seamlessly with cuts and video playback!
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2, 3, 4].map(idx => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTutorialStep(idx);
                          if (idx === 0) setActiveTab('cut');
                          if (idx === 1) setActiveTab('text');
                          if (idx === 2) setActiveTab('media');
                          if (idx === 3) setActiveTab('audio');
                          if (idx === 4) setActiveTab('select');
                        }}
                        className={`h-2 rounded-full transition-all cursor-pointer ${idx === 3 ? 'w-6 bg-emerald-600' : 'w-2 bg-slate-200 hover:bg-slate-300'}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setTutorialStep(2); setActiveTab('media'); }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTutorialStep(4); setActiveTab('select'); }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span>Next: Save Changes</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SAVE CHANGES (Points directly UP at Save button in top right header) */}
          {tutorialStep === 4 && (
            <div 
              className="absolute right-6 top-[68px] flex flex-col items-end gap-2 pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-300 z-[130]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pr-12">
                <AnimatedPointingArrow direction="up" strokeColor="#2563eb" />
              </div>

              <div className="w-[370px] bg-white rounded-2xl p-5 shadow-2xl border-2 border-blue-400 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black tracking-wider uppercase bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Step 5 of 5 • Cloud & Local Save
                  </span>
                  <button 
                    type="button" 
                    onClick={() => { setShowTutorial(false); try { localStorage.setItem('rcrd_video_editor_tutorial_seen', 'true'); } catch {} }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-blue-600" />
                    Save Changes Instantly
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    When you are done editing, click this blue <strong className="text-blue-600 font-bold">&quot;Save Changes&quot;</strong> button! All your title slides, cuts, subtitles, and background audio will automatically persist to cloud and local storage and play everywhere!
                  </p>
                </div>

                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 font-semibold">
                  🎉 You are now ready to create high-impact videos like in CapCut and InShot!
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setTutorialStep(3); setActiveTab('audio'); }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTutorial(false);
                      try { localStorage.setItem('rcrd_video_editor_tutorial_seen', 'true'); } catch {}
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    <span>Start Editing Now 🚀</span>
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
