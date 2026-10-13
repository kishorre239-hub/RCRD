import React, { useState, useRef, useEffect } from 'react';
import { Scissors, Play, Pause, ChevronLeft, Volume2, VolumeX, MousePointer2, Type, Image as ImageIcon, Music, Download, Check, Trash2, RotateCcw, Edit2, RotateCw } from 'lucide-react';

interface VideoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoTitle: string;
  videoId: string;
}

// Data Types
type CutRegion = { id: string; start: number; end: number; };
type TextOverlay = { id: string; text: string; x: number; y: number; color: string; size: number; start: number; end: number; rotation?: number };
type MediaOverlay = { id: string; url: string; x: number; y: number; scale: number; start: number; end: number; rotation?: number };

export default function VideoEditorModal({ isOpen, onClose, videoUrl, videoTitle, videoId }: VideoEditorModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const [waveformHeights] = useState<number[]>(() => 
    Array.from({ length: 150 }).map((_, i) => Math.max(10, ((i * 37) % 70) + 15))
  );
  
  // CUT FEATURE STATE
  const [activeCut, setActiveCut] = useState<{start: number, end: number} | null>(null);
  const [completedCuts, setCompletedCuts] = useState<CutRegion[]>([]);
  const [dragHandle, setDragHandle] = useState<'start' | 'end' | null>(null);

  // DYNAMIC OVERLAYS STATE
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  
  const [mediaOverlays, setMediaOverlays] = useState<MediaOverlay[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [audioVolume, setAudioVolume] = useState(50);
  const [audioUrl, setAudioUrl] = useState(''); 

  const [draggingOverlay, setDraggingOverlay] = useState<{ id: string, type: 'text' | 'media' } | null>(null);
  const [resizingOverlay, setResizingOverlay] = useState<{ id: string, type: 'text' | 'media', startY: number, initialSize: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = audioVolume / 100;
  }, [audioVolume, hasAudioTrack]);

  // Cut Drag Handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragHandle || !timelineRef.current || !activeCut) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const timeAtCursor = pos * duration;
      
      if (dragHandle === 'start') {
        setActiveCut(prev => prev ? { ...prev, start: Math.min(timeAtCursor, prev.end - 0.5) } : null);
      } else {
        setActiveCut(prev => prev ? { ...prev, end: Math.max(timeAtCursor, prev.start + 0.5) } : null);
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
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        if (audioRef.current) audioRef.current.pause();
      } else {
        videoRef.current.play();
        if (audioRef.current && hasAudioTrack && audioUrl) {
          audioRef.current.currentTime = videoRef.current.currentTime % (audioRef.current.duration || 1);
          audioRef.current.play().catch(e => console.log('Audio blocked:', e));
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const ct = videoRef.current.currentTime;
      setCurrentTime(ct);
      
      for (const cut of completedCuts) {
        if (ct >= cut.start && ct < cut.end) {
          videoRef.current.currentTime = cut.end;
          if (audioRef.current) audioRef.current.currentTime = cut.end % (audioRef.current.duration || 1);
          break;
        }
      }
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current || duration === 0 || dragHandle) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickTime = pos * duration;
    
    videoRef.current.currentTime = clickTime;
    if (audioRef.current) audioRef.current.currentTime = clickTime % (audioRef.current.duration || 1);
    setCurrentTime(clickTime);
  };

  const initiateNewCut = () => {
    if (duration === 0) return;
    const start = videoRef.current?.currentTime || 0;
    const end = Math.min(start + 5, duration);
    setActiveCut({ start, end });
    setSelectedTextId(null);
    setSelectedMediaId(null);
  };

  const confirmCut = () => {
    if (activeCut) {
      setCompletedCuts([...completedCuts, { id: Math.random().toString(), start: activeCut.start, end: activeCut.end }]);
      setActiveCut(null);
    }
  };

  const cancelCut = () => setActiveCut(null);

  const handleAddText = () => {
    const start = videoRef.current?.currentTime || 0;
    const newText: TextOverlay = { 
      id: Math.random().toString(), text: 'Double click to edit', x: 50, y: 50, color: '#ffffff', size: 36,
      start: start, end: Math.min(start + 5, duration || 5) // Defaults to showing for 5 seconds
    };
    setTextOverlays([...textOverlays, newText]);
    setSelectedTextId(newText.id);
    setSelectedMediaId(null);
    setActiveCut(null);
  };

  const handleAddMedia = () => {
    const start = videoRef.current?.currentTime || 0;
    const newMedia: MediaOverlay = { 
      id: Math.random().toString(), url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=150&h=150&fit=crop', x: 20, y: 20, scale: 100,
      start: start, end: Math.min(start + 5, duration || 5) // Defaults to showing for 5 seconds
    };
    setMediaOverlays([...mediaOverlays, newMedia]);
    setSelectedMediaId(newMedia.id);
    setSelectedTextId(null);
    setActiveCut(null);
  };

  const handleAddAudio = () => {
    setHasAudioTrack(true);
    if (!audioUrl) setAudioUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
    setSelectedTextId(null);
    setSelectedMediaId(null);
    setActiveCut(null);
  };

  const handleCanvasClick = () => {
    setSelectedTextId(null);
    setSelectedMediaId(null);
  };

  const handlePointerDown = (e: React.PointerEvent, id: string, type: 'text' | 'media') => {
    e.stopPropagation();
    if (type === 'text') {
      setSelectedTextId(id);
      setSelectedMediaId(null);
    } else {
      setSelectedMediaId(id);
      setSelectedTextId(null);
    }
    setDraggingOverlay({ id, type });
    
    // Explicitly set pointer capture so dragging works even if cursor moves fast
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (resizingOverlay) {
      const delta = (e.clientY - resizingOverlay.startY) * 1.5;
      if (resizingOverlay.type === 'text') {
        const newSize = Math.max(12, Math.min(200, resizingOverlay.initialSize + delta));
        setTextOverlays(prev => prev.map(t => t.id === resizingOverlay.id ? { ...t, size: newSize } : t));
      } else {
        const newScale = Math.max(10, Math.min(500, resizingOverlay.initialSize + delta));
        setMediaOverlays(prev => prev.map(m => m.id === resizingOverlay.id ? { ...m, scale: newScale } : m));
      }
      return;
    }

    if (!draggingOverlay || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    if (draggingOverlay.type === 'text') {
      setTextOverlays(prev => prev.map(t => t.id === draggingOverlay.id ? { ...t, x, y } : t));
    } else {
      setMediaOverlays(prev => prev.map(m => m.id === draggingOverlay.id ? { ...m, x, y } : m));
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

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>, mediaId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const newUrl = URL.createObjectURL(file);
      setMediaOverlays(mediaOverlays.map(m => m.id === mediaId ? { ...m, url: newUrl } : m));
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  const activeText = textOverlays.find(t => t.id === selectedTextId);
  const activeMedia = mediaOverlays.find(m => m.id === selectedMediaId);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f0f5fa] text-[#0f172a] font-sans animate-in fade-in duration-200">
      
      {/* HEADER */}
      <div className="h-16 border-b border-blue-100 bg-white flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-blue-50 rounded-full transition-colors text-slate-500 hover:text-blue-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
            {videoTitle} <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-md border border-blue-200">Editor Mode</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={async () => {
              setIsSaving(true);
              const editorData = {
                textOverlays,
                mediaOverlays,
                completedCuts,
                duration: duration === Infinity ? 0 : duration,
                savedAt: new Date().toISOString()
              };
              // Always save to localStorage for live overlay rendering
              localStorage.setItem(`video-edits-${videoId}`, JSON.stringify(editorData));
              // Also attempt to persist title to backend
              try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
                const token = localStorage.getItem('token');
                if (token && videoId) {
                  await fetch(`${API_URL}/videos/${videoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ 
                      title: videoTitle,
                      editorData: JSON.stringify(editorData)
                    })
                  });
                }
              } catch (e) {
                console.warn('Backend sync failed, changes saved locally', e);
              }
              setTimeout(() => { setIsSaving(false); onClose(); }, 1200); 
            }}
            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all active:scale-95"
          >
            {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            {isSaving ? "Saving..." : "Save Changes"} 
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Tools) */}
        <div className="w-20 border-r border-blue-100 bg-white flex flex-col items-center py-6 gap-6 shadow-sm z-0">
          <button 
            onClick={() => { setSelectedTextId(null); setSelectedMediaId(null); setActiveCut(null); }}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl w-14 transition-colors text-blue-600 bg-blue-50 border border-blue-100 shadow-sm"
          >
            <MousePointer2 className="w-5 h-5" /><span className="text-[10px] font-bold">Select</span>
          </button>
          
          <button 
            onClick={initiateNewCut}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl w-14 transition-colors ${activeCut ? 'text-red-600 bg-red-50 border border-red-100' : 'text-slate-500 hover:text-red-500 hover:bg-red-50'}`}
          >
            <Scissors className="w-5 h-5" /><span className="text-[10px] font-bold">Cut</span>
          </button>
          
          <button 
            onClick={handleAddText}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl w-14 transition-colors ${activeText ? 'text-blue-600 bg-blue-50 border border-blue-100' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
          >
            <Type className="w-5 h-5" /><span className="text-[10px] font-bold">Text</span>
          </button>

          <button 
            onClick={handleAddMedia}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl w-14 transition-colors ${activeMedia ? 'text-blue-600 bg-blue-50 border border-blue-100' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
          >
            <ImageIcon className="w-5 h-5" /><span className="text-[10px] font-bold">Media</span>
          </button>
          
          <button 
            onClick={handleAddAudio}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl w-14 transition-colors ${hasAudioTrack && !activeText && !activeMedia && !activeCut ? 'text-green-600 bg-green-50 border border-green-100 shadow-sm' : 'text-slate-500 hover:text-green-600 hover:bg-green-50'}`}
          >
            <Music className="w-5 h-5" /><span className="text-[10px] font-bold">Audio</span>
          </button>
        </div>

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col relative bg-[#f8fafc]">
          <div className="absolute top-6 left-6 bg-white/90 text-blue-700 font-mono font-bold text-sm px-3 py-1.5 rounded-lg shadow-sm  z-10 border border-blue-200">
            {formatTimeStr(currentTime)}
          </div>
          
          <div 
            ref={canvasRef}
            className="flex-1 p-8 flex items-center justify-center relative overflow-hidden touch-none" 
            onClick={handleCanvasClick}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
             {hasAudioTrack && audioUrl && (
               <audio ref={audioRef} src={audioUrl} loop className="hidden" />
             )}

             {videoUrl.includes('drive.google.com') ? (
               <iframe src={videoUrl} className="w-full h-full max-h-full object-contain border-0 pointer-events-none shadow-xl rounded-2xl bg-black" allow="autoplay"></iframe>
            ) : (
               <video 
                 ref={videoRef}
                 src={videoUrl}
                 className="w-full h-full max-h-full object-contain shadow-xl bg-black rounded-2xl"
                 onTimeUpdate={handleTimeUpdate}
                 onLoadedMetadata={handleLoadedMetadata}
                 onClick={handlePlayPause}
               />
            )}
            
            {!isPlaying && (
              <button onClick={handlePlayPause} className="absolute m-auto w-20 h-20 bg-blue-500/20 hover:bg-blue-600/90  rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 shadow-2xl">
                <Play className="w-10 h-10 ml-2" />
              </button>
            )}

            {/* TIMED TEXT OVERLAYS */}
            {textOverlays.map(text => {
              const isVisible = currentTime >= text.start && currentTime <= text.end;
              if (!isVisible) return null; // Strictly WYSIWYG

              return (
                <div
                  key={text.id}
                  onPointerDown={(e) => handlePointerDown(e, text.id, 'text')}
                  onClick={(e) => e.stopPropagation()}
                  style={{ left: `${text.x}%`, top: `${text.y}%`, color: text.color, fontSize: `${text.size}px`, transform: `translate(-50%, -50%) rotate(${text.rotation || 0}deg)` }}
                  className={`absolute font-black drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] cursor-move transition-all p-2 rounded ${selectedTextId === text.id ? 'border-2 border-blue-500 bg-blue-500/10 scale-105 z-30 ring-4 ring-blue-500/20' : 'border-2 border-transparent hover:border-white/30 z-20'}`}
                >
                  {selectedTextId === text.id && (
                    <div 
                      className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center bg-white rounded-lg shadow-xl border border-slate-200 p-1 gap-1 z-50 cursor-default"
                      onPointerDown={(e) => e.stopPropagation()} 
                    >
                      <button onClick={(e) => { e.stopPropagation(); const newText = prompt("Edit text:", text.text); if(newText) setTextOverlays(prev => prev.map(t => t.id === text.id ? {...t, text: newText} : t)); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-700 tooltip">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setTextOverlays(prev => prev.map(t => t.id === text.id ? {...t, rotation: (t.rotation || 0) + 45} : t)); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-700 tooltip">
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setTextOverlays(prev => prev.filter(t => t.id !== text.id)); setSelectedTextId(null); }} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-700 tooltip">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {selectedTextId === text.id && (
                    <div 
                      className="absolute -bottom-2 -right-2 w-5 h-5 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize z-50 shadow-md"
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
              if (!isVisible) return null; // Strictly WYSIWYG

              return (
                <div
                  key={media.id}
                  onPointerDown={(e) => handlePointerDown(e, media.id, 'media')}
                  onClick={(e) => e.stopPropagation()}
                  style={{ left: `${media.x}%`, top: `${media.y}%`, transform: `translate(-50%, -50%) scale(${media.scale / 100}) rotate(${media.rotation || 0}deg)` }}
                  className={`absolute cursor-move transition-all rounded-lg ${selectedMediaId === media.id ? 'ring-4 ring-blue-500 shadow-2xl z-30' : 'ring-2 ring-transparent hover:ring-white/30 shadow-lg z-20'}`}
                >
                  {selectedMediaId === media.id && (
                    <div 
                      className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center bg-white rounded-lg shadow-xl border border-slate-200 p-1 gap-1 z-50 cursor-default scale-100"
                      style={{ transform: `translate(-50%, 0) scale(${100 / media.scale})` }} // Counteract the parent scale so toolbar doesn't grow huge
                      onPointerDown={(e) => e.stopPropagation()} 
                    >
                      <button onClick={(e) => { e.stopPropagation(); setMediaOverlays(prev => prev.map(m => m.id === media.id ? {...m, rotation: (m.rotation || 0) + 45} : m)); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-700 tooltip">
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setMediaOverlays(prev => prev.filter(m => m.id !== media.id)); setSelectedMediaId(null); }} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded text-slate-700 tooltip">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {selectedMediaId === media.id && (
                    <div 
                      className="absolute -bottom-2 -right-2 w-6 h-6 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize z-50 shadow-md flex items-center justify-center"
                      style={{ transform: `scale(${100 / media.scale})` }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setResizingOverlay({ id: media.id, type: 'media', startY: e.clientY, initialSize: media.scale });
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                    />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={media.url} alt="Overlay" className="w-[150px] h-[150px] object-cover pointer-events-none rounded-lg" draggable={false} />
                </div>
              );
            })}
          </div>

          {/* Canvas Toolbar */}
          <div className="h-14 border-t border-blue-100 flex items-center justify-center gap-6 bg-white shadow-sm">
            <button className="p-2 rounded-lg hover:bg-blue-50 text-slate-500 transition-colors"><RotateCcw className="w-4 h-4"/></button>
            <button onClick={handlePlayPause} className="w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-md hover:bg-[#1d4ed8] transition-colors">
              {isPlaying ? <Pause className="w-5 h-5"/> : <Play className="w-5 h-5 ml-1"/>}
            </button>
            <button className="p-2 rounded-lg hover:bg-blue-50 text-slate-500 transition-colors"><RotateCcw className="w-4 h-4 scale-x-[-1]"/></button>
            <div className="w-px h-6 bg-slate-200 mx-2"></div>
            <button onClick={() => setIsMuted(!isMuted)} className="p-2 rounded-lg hover:bg-blue-50 text-slate-500 transition-colors">
              {isMuted ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
            </button>
          </div>
        </div>

        {/* Right Sidebar (Properties) */}
        <div className="w-80 border-l border-blue-100 bg-white p-6 flex flex-col gap-6 overflow-y-auto z-0 shadow-sm">
          <div className="border-b border-blue-50 pb-4">
            <h3 className="text-slate-800 font-bold text-base">Properties</h3>
          </div>
          
          {/* TEXT PROPERTIES */}
          {activeText && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">Edit Text</label>
                <textarea 
                  value={activeText.text}
                  onChange={(e) => setTextOverlays(textOverlays.map(t => t.id === activeText.id ? { ...t, text: e.target.value } : t))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none h-24 shadow-inner" 
                />
              </div>
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-bold text-slate-700">Appears At</label>
                    <span className="text-xs font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100">{formatTimeStr(activeText.start)}</span>
                  </div>
                  <input 
                    type="range" min="0" max={Math.max(0, activeText.end - 0.1)} step="0.1" value={activeText.start} 
                    onChange={(e) => {
                      const newStart = parseFloat(e.target.value);
                      setTextOverlays(textOverlays.map(t => t.id === activeText.id ? { ...t, start: newStart } : t));
                      if (videoRef.current) videoRef.current.currentTime = newStart;
                    }}
                    className="w-full accent-blue-600 cursor-pointer" 
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-bold text-slate-700">Disappears At</label>
                    <span className="text-xs font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100">{formatTimeStr(activeText.end)}</span>
                  </div>
                  <input 
                    type="range" min={activeText.start + 0.1} max={duration || 1} step="0.1" value={activeText.end} 
                    onChange={(e) => {
                      const newEnd = parseFloat(e.target.value);
                      setTextOverlays(textOverlays.map(t => t.id === activeText.id ? { ...t, end: newEnd } : t));
                      if (videoRef.current) videoRef.current.currentTime = newEnd;
                    }}
                    className="w-full accent-blue-600 cursor-pointer" 
                  />
                </div>
                <p className="text-[10px] text-slate-400 text-center uppercase tracking-wide font-bold">Use sliders to set visibility time</p>
              </div>
              
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">Font Size ({activeText.size}px)</label>
                <input 
                  type="range" min="12" max="120" value={activeText.size} 
                  onChange={(e) => setTextOverlays(textOverlays.map(t => t.id === activeText.id ? { ...t, size: parseInt(e.target.value) } : t))}
                  className="w-full accent-blue-600" 
                />
              </div>
              <button 
                onClick={() => { setTextOverlays(textOverlays.filter(t => t.id !== activeText.id)); setSelectedTextId(null); }}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete Text
              </button>
            </div>
          )}

          {/* MEDIA PROPERTIES */}
          {activeMedia && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">Upload Image Overlay</label>
                <label className="flex items-center justify-center w-full h-12 px-4 transition bg-slate-50 border-2 border-slate-200 border-dashed rounded-lg appearance-none cursor-pointer hover:border-blue-500 hover:bg-blue-50 focus:outline-none text-sm font-bold text-slate-600">
                  <span className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4 text-blue-500" />
                    <span>Choose Image File...</span>
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleMediaUpload(e, activeMedia.id)} />
                </label>
              </div>
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-bold text-slate-700">Appears At</label>
                    <span className="text-xs font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100">{formatTimeStr(activeMedia.start)}</span>
                  </div>
                  <input 
                    type="range" min="0" max={Math.max(0, activeMedia.end - 0.1)} step="0.1" value={activeMedia.start} 
                    onChange={(e) => {
                      const newStart = parseFloat(e.target.value);
                      setMediaOverlays(mediaOverlays.map(m => m.id === activeMedia.id ? { ...m, start: newStart } : m));
                      if (videoRef.current) videoRef.current.currentTime = newStart;
                    }}
                    className="w-full accent-blue-600 cursor-pointer" 
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-bold text-slate-700">Disappears At</label>
                    <span className="text-xs font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100">{formatTimeStr(activeMedia.end)}</span>
                  </div>
                  <input 
                    type="range" min={activeMedia.start + 0.1} max={duration || 1} step="0.1" value={activeMedia.end} 
                    onChange={(e) => {
                      const newEnd = parseFloat(e.target.value);
                      setMediaOverlays(mediaOverlays.map(m => m.id === activeMedia.id ? { ...m, end: newEnd } : m));
                      if (videoRef.current) videoRef.current.currentTime = newEnd;
                    }}
                    className="w-full accent-blue-600 cursor-pointer" 
                  />
                </div>
                <p className="text-[10px] text-slate-400 text-center uppercase tracking-wide font-bold">Use sliders to set visibility time</p>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">Image Scale ({activeMedia.scale}%)</label>
                <input 
                  type="range" min="20" max="300" value={activeMedia.scale} 
                  onChange={(e) => setMediaOverlays(mediaOverlays.map(m => m.id === activeMedia.id ? { ...m, scale: parseInt(e.target.value) } : m))}
                  className="w-full accent-blue-600" 
                />
              </div>
              <button 
                onClick={() => { setMediaOverlays(mediaOverlays.filter(m => m.id !== activeMedia.id)); setSelectedMediaId(null); }}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete Media
              </button>
            </div>
          )}

          {/* AUDIO PROPERTIES */}
          {!activeText && !activeMedia && hasAudioTrack && !activeCut && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full text-green-700"><Music className="w-5 h-5" /></div>
                <div>
                  <p className="font-bold text-green-800 text-sm">Background Music</p>
                  <p className="text-xs text-green-600">Active track playing</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">Upload Background Audio</label>
                <label className="flex items-center justify-center w-full h-12 px-4 transition bg-slate-50 border-2 border-slate-200 border-dashed rounded-lg appearance-none cursor-pointer hover:border-green-500 hover:bg-green-50 focus:outline-none text-sm font-bold text-slate-600">
                  <span className="flex items-center space-x-2">
                    <Music className="w-4 h-4 text-green-500" />
                    <span>Choose Audio File...</span>
                  </span>
                  <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                </label>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-2">Audio Volume ({audioVolume}%)</label>
                <input 
                  type="range" min="0" max="100" value={audioVolume} 
                  onChange={(e) => setAudioVolume(parseInt(e.target.value))}
                  className="w-full accent-green-600" 
                />
              </div>
              <button 
                onClick={() => setHasAudioTrack(false)}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Remove Audio Track
              </button>
            </div>
          )}

          {/* DEFAULT STATE */}
          {!activeText && !activeMedia && !hasAudioTrack && !activeCut && (
             <div className="flex-1 flex flex-col items-center justify-center text-center px-4 text-slate-400 gap-4 opacity-70">
              <MousePointer2 className="w-10 h-10 text-blue-300" />
              <p className="text-sm font-medium">Click on tools in the left menu to add overlays, audio, or cut sections.</p>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM TIMELINE AREA */}
      <div className="h-56 border-t border-blue-200 bg-white flex flex-col shadow-[0_-4px_20px_rgb(0,0,0,0.03)] z-10 relative">
        <div className="h-12 border-b border-blue-100 flex items-center justify-between px-6 bg-[#f8fafc]">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Video Timeline</span>
          <div className="text-sm font-bold font-mono text-blue-700 bg-white border border-blue-200 px-3 py-1 rounded-md shadow-sm">
            Total Length: {formatTimeStr(duration)}
          </div>
        </div>

        <div className="flex-1 relative p-6 bg-white flex flex-col justify-center gap-3">
          <div className="relative w-full max-w-5xl h-20 bg-blue-50 border border-blue-200 rounded-lg flex shadow-inner overflow-hidden flex-shrink-0">
            <div className="absolute inset-0 flex items-center justify-between px-2 opacity-20 pointer-events-none">
                {waveformHeights.map((h, i) => (
                  <div key={i} className="w-1 bg-[#2563eb] rounded-full" style={{ height: `${h}%` }}></div>
                ))}
            </div>

            {duration > 0 && completedCuts.map(cut => {
              const left = (cut.start / duration) * 100;
              const width = ((cut.end - cut.start) / duration) * 100;
              return (
                <div 
                  key={cut.id}
                  className="absolute top-0 bottom-0 bg-red-900/10  border-l border-r border-red-500/50 z-10"
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                   <div className="absolute inset-0 flex items-center justify-center opacity-50">
                      <div className="w-full h-px bg-red-500 rotate-12"></div>
                      <div className="w-full h-px bg-red-500 -rotate-12 absolute"></div>
                   </div>
                </div>
              );
            })}

            {activeCut && duration > 0 && (
              <div 
                className="absolute top-0 bottom-0 bg-red-500/20 border-t-2 border-b-2 border-red-500 z-30 shadow-lg shadow-red-500/20"
                style={{ left: `${(activeCut.start / duration) * 100}%`, width: `${((activeCut.end - activeCut.start) / duration) * 100}%` }}
              >
                <div onMouseDown={(e) => { e.preventDefault(); setDragHandle('start'); e.stopPropagation(); }} className="absolute -left-3 top-0 bottom-0 w-6 bg-red-500 rounded-l-md cursor-ew-resize flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                  <div className="w-1 h-6 border-l border-r border-white/50 rounded-full"></div>
                </div>
                <div onMouseDown={(e) => { e.preventDefault(); setDragHandle('end'); e.stopPropagation(); }} className="absolute -right-3 top-0 bottom-0 w-6 bg-red-500 rounded-r-md cursor-ew-resize flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                  <div className="w-1 h-6 border-l border-r border-white/50 rounded-full"></div>
                </div>
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white p-1 rounded-lg shadow-xl border border-gray-200">
                  <button onClick={confirmCut} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors"><Check className="w-3 h-3"/> Confirm Cut</button>
                  <button onClick={cancelCut} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-md text-xs font-bold transition-colors">Cancel</button>
                </div>
              </div>
            )}
            <div ref={timelineRef} className="absolute inset-0 z-20 cursor-pointer" onClick={handleTimelineClick} />
          </div>
          
          {hasAudioTrack && (
            <div className="relative w-full max-w-5xl h-10 bg-green-50 border border-green-200 rounded-md flex items-center px-4 shadow-sm animate-in slide-in-from-top-2 cursor-pointer" onClick={handleAddAudio}>
              <div className="text-xs font-bold text-green-700 flex items-center gap-2"><Music className="w-3 h-3" /> Background Audio</div>
            </div>
          )}

          {duration > 0 && (
            <div 
              className="absolute top-4 bottom-4 w-0.5 bg-blue-600 z-40 pointer-events-none shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all duration-75"
              style={{ left: `calc(1.5rem + ${(currentTime / duration) * 100}% - 3rem)` }}
            >
              <div className="absolute -top-2 -left-2 w-4.5 h-4.5 bg-blue-600 rounded-full shadow-md"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
