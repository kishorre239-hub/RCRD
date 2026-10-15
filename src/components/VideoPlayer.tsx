'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, AlertCircle } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  onError?: (err: string) => void;
  onTimeUpdate?: (time: number) => void;
  downloadEnabled?: boolean;
  externalPlaybackRate?: number;
  videoId?: string;
  initialEditorData?: unknown;
}

type CutRegion = { id: string; start: number; end: number };
type TextOverlay = {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
  size?: number;
  start: number;
  end: number;
  rotation?: number;
  stylePreset?: 'subtitle' | 'lowerThird' | 'badge' | 'minimal';
  bgOpacity?: number;
  mergeMode?: 'overlay' | 'middleSlide';
};
type MediaOverlay = {
  id: string;
  url: string;
  x: number;
  y: number;
  scale?: number;
  start: number;
  end: number;
  rotation?: number;
  opacity?: number;
  rounded?: boolean;
  mergeMode?: 'overlay' | 'middleSlide';
  isVideo?: boolean;
};
type AudioSettings = {
  enabled: boolean;
  url: string;
  volume: number;
  muteOriginalAudio?: boolean;
};
type EditorData = {
  textOverlays?: TextOverlay[];
  mediaOverlays?: MediaOverlay[];
  completedCuts?: CutRegion[];
  audio?: AudioSettings;
  [key: string]: unknown;
};

export default function VideoPlayer({ src, onError, onTimeUpdate, downloadEnabled = true, externalPlaybackRate = 1, videoId, initialEditorData }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgAudioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  const [quality, setQuality] = useState('1080p');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  
  const [hasError, setHasError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);

  const [editorData, setEditorData] = useState<EditorData | null>(null);

  useEffect(() => {
    const handleData = () => {
      if (initialEditorData) {
        try {
          const parsed = typeof initialEditorData === 'string' ? JSON.parse(initialEditorData) : initialEditorData;
          setEditorData(parsed);
          return;
        } catch {}
      }
      if (videoId) {
        try {
          const data = localStorage.getItem(`video-edits-${videoId}`);
          if (data) {
            setEditorData(JSON.parse(data));
            return;
          }
        } catch {}
      }
    };
    handleData();

    // Listen to real-time editor updates
    const handleEditorUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ videoId?: string; editorData?: unknown }>;
      if (customEvent?.detail?.editorData) {
        if (!videoId || !customEvent.detail.videoId || customEvent.detail.videoId === videoId) {
          const rawData = customEvent.detail.editorData;
          const updated = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          setEditorData(updated as EditorData);
        }
      }
    };

    window.addEventListener('video-editor-updated', handleEditorUpdated as EventListener);
    return () => {
      window.removeEventListener('video-editor-updated', handleEditorUpdated as EventListener);
    };
  }, [videoId, initialEditorData]);

  // Sync background audio with play/pause and volume
  useEffect(() => {
    if (!bgAudioRef.current) return;
    const bgAudio = bgAudioRef.current;
    const audioVol = editorData?.audio?.volume !== undefined ? editorData.audio.volume / 100 : 0.5;
    bgAudio.volume = isMuted ? 0 : audioVol * volume;

    if (editorData?.audio?.enabled && editorData?.audio?.url && isPlaying) {
      bgAudio.play().catch(() => {});
    } else {
      bgAudio.pause();
    }
  }, [isPlaying, editorData?.audio, volume, isMuted]);

  // Sync mute original audio if enabled
  useEffect(() => {
    if (editorData?.audio?.muteOriginalAudio && videoRef.current) {
      videoRef.current.muted = true;
    }
  }, [editorData?.audio?.muteOriginalAudio]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const cuts = ((editorData?.completedCuts || editorData?.cuts || []) as CutRegion[])
      .filter(c => typeof c.start === 'number' && typeof c.end === 'number' && c.end > c.start);

    const updateProgress = () => {
      const ct = video.currentTime;
      setCurrentTime(ct);
      setProgress((ct / (video.duration || 1)) * 100);
      if (onTimeUpdate) {
        onTimeUpdate(ct);
      }

      // Check cuts: skip over cut regions automatically!
      for (const cut of cuts) {
        if (ct >= cut.start && ct < cut.end) {
          if (cut.end >= (video.duration || 1) - 0.15) {
            video.pause();
            setIsPlaying(false);
            video.currentTime = video.duration || cut.start;
            return;
          }
          video.currentTime = cut.end;
          if (bgAudioRef.current && bgAudioRef.current.duration) {
            bgAudioRef.current.currentTime = cut.end % bgAudioRef.current.duration;
          }
          break;
        }
      }
    };
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsBuffering(false);
      // If there is an intro cut starting at 0, jump past it immediately
      for (const cut of cuts) {
        if (cut.start <= 0.1 && cut.end > 0) {
          video.currentTime = cut.end;
          setCurrentTime(cut.end);
          setProgress((cut.end / (video.duration || 1)) * 100);
          break;
        }
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
      if (bgAudioRef.current && editorData?.audio?.enabled && editorData?.audio?.url) {
        bgAudioRef.current.play().catch(() => {});
      }
    };
    const handlePause = () => {
      setIsPlaying(false);
      if (bgAudioRef.current) bgAudioRef.current.pause();
    };

    const handleError = () => {
      if (video.src && !video.src.includes('retry=1')) {
        const sep = video.src.includes('?') ? '&' : '?';
        video.src = `${video.src}${sep}retry=1`;
        video.load();
        return;
      }
      setHasError(true);
      if (onError) onError("Failed to load video stream.");
    };

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    // Initial check for intro cut
    for (const cut of cuts) {
      if (cut.start <= 0.1 && cut.end > 0 && video.currentTime < cut.end) {
        video.currentTime = cut.end;
        setCurrentTime(cut.end);
        break;
      }
    }

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [onError, onTimeUpdate, editorData?.completedCuts, editorData?.cuts, editorData?.audio]);

  // High-frequency 60fps cut checker during playback (zero audio/video leakage)
  useEffect(() => {
    if (!isPlaying) return;
    const cuts = ((editorData?.completedCuts || editorData?.cuts || []) as CutRegion[])
      .filter(c => typeof c.start === 'number' && typeof c.end === 'number' && c.end > c.start);
    if (cuts.length === 0) return;

    let animId: number;
    const checkCutsLoop = () => {
      const vid = videoRef.current;
      if (vid && !vid.paused) {
        const ct = vid.currentTime;
        const dur = vid.duration || 1;
        for (const cut of cuts) {
          if (ct >= cut.start && ct < cut.end) {
            if (cut.end >= dur - 0.15) {
              vid.pause();
              setIsPlaying(false);
              vid.currentTime = dur;
              return;
            }
            vid.currentTime = cut.end;
            setCurrentTime(cut.end);
            if (bgAudioRef.current && bgAudioRef.current.duration) {
              bgAudioRef.current.currentTime = cut.end % bgAudioRef.current.duration;
            }
            break;
          }
        }
      }
      animId = requestAnimationFrame(checkCutsLoop);
    };
    animId = requestAnimationFrame(checkCutsLoop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, editorData?.completedCuts, editorData?.cuts]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = externalPlaybackRate;
      setPlaybackSpeed(externalPlaybackRate);
    }
  }, [externalPlaybackRate]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        const cuts = ((editorData?.completedCuts || editorData?.cuts || []) as CutRegion[])
          .filter(c => typeof c.start === 'number' && typeof c.end === 'number' && c.end > c.start);
        
        let startAt = videoRef.current.currentTime;
        const dur = videoRef.current.duration || 1;
        for (const cut of cuts) {
          if (startAt >= cut.start && startAt < cut.end) {
            startAt = cut.end < dur - 0.15 ? cut.end : 0;
            break;
          }
        }
        videoRef.current.currentTime = startAt;
        setCurrentTime(startAt);
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    let seekTime = (parseFloat(e.target.value) / 100) * duration;
    const cuts = ((editorData?.completedCuts || editorData?.cuts || []) as CutRegion[])
      .filter(c => typeof c.start === 'number' && typeof c.end === 'number' && c.end > c.start);
    for (const cut of cuts) {
      if (seekTime >= cut.start && seekTime < cut.end) {
        seekTime = cut.end < duration - 0.15 ? cut.end : Math.max(0, cut.start - 0.1);
        break;
      }
    }
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
      setProgress((seekTime / (duration || 1)) * 100);
      setCurrentTime(seekTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const changeSpeed = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    const m = Math.floor(timeInSeconds / 60);
    const s = Math.floor(timeInSeconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (hasError) {
    return (
      <div className="w-full aspect-video bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-xl font-bold mb-2">Video Unavailable</h3>
        <p className="text-slate-400 max-w-md">The video stream could not be loaded. This might happen if the file was deleted from Google Drive, or if you don&apos;t have permission to view it.</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="relative group w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl"
      onMouseLeave={() => {
        setShowSpeedMenu(false);
        setShowQualityMenu(false);
      }}
    >
      <video
        key={src}
        id="main-video-player"
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        controlsList={downloadEnabled ? "" : "nodownload"}
        onError={() => {
          setHasError(true);
          onError?.('Failed to load video stream');
        }}
      />
      
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-20">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      )}

      {/* BACKGROUND AUDIO */}
      {editorData?.audio?.enabled && editorData?.audio?.url && (
        <audio ref={bgAudioRef} src={editorData.audio.url} loop className="hidden" />
      )}

      {/* TIMED TEXT OVERLAYS */}
      {editorData?.textOverlays?.map((text) => {
        const isVisible = currentTime >= text.start && currentTime <= text.end;
        if (!isVisible) return null;

        // Merged in middle of video
        if (text.mergeMode === 'middleSlide') {
          return (
            <div
              key={text.id}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/65 backdrop-blur-md transition-all animate-in fade-in duration-200 pointer-events-none p-6"
            >
              <div className="max-w-xl mx-auto px-8 py-6 rounded-2xl bg-white/10 border border-white/25 shadow-2xl backdrop-blur-xl text-center">
                <p 
                  style={{ color: text.color || '#ffffff', fontSize: `${text.size ? Math.max(24, text.size) : 32}px` }}
                  className="font-extrabold tracking-wide drop-shadow-lg"
                >
                  {text.text}
                </p>
              </div>
            </div>
          );
        }

        let styleClasses = "font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]";
        if (text.stylePreset === 'subtitle' || !text.stylePreset) {
          styleClasses = "bg-slate-950/90 backdrop-blur-md px-5 py-2 rounded-xl border border-white/20 shadow-lg font-semibold tracking-wide text-center";
        } else if (text.stylePreset === 'lowerThird') {
          styleClasses = "bg-slate-950/90 backdrop-blur-md px-5 py-2.5 rounded-r-xl border-l-4 border-blue-500 shadow-lg font-semibold";
        } else if (text.stylePreset === 'badge') {
          styleClasses = "bg-blue-600 text-white px-4 py-1.5 rounded-full font-bold shadow-md ring-1 ring-white/30";
        } else if (text.stylePreset === 'minimal') {
          styleClasses = "font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]";
        }

        return (
          <div
            key={text.id}
            style={{ 
              left: `${text.x}%`, 
              top: `${text.y}%`, 
              color: text.color || '#ffffff', 
              fontSize: `${text.size || 28}px`, 
              transform: `translate(-50%, -50%) rotate(${text.rotation || 0}deg)` 
            }}
            className={`absolute pointer-events-none z-10 select-none transition-all ${styleClasses}`}
          >
            {text.text}
          </div>
        );
      })}

      {/* TIMED MEDIA OVERLAYS */}
      {editorData?.mediaOverlays?.map((media) => {
        const isVisible = currentTime >= media.start && currentTime <= media.end;
        if (!isVisible) return null;
        const opacity = media.opacity !== undefined ? media.opacity / 100 : 1;

        // Merged in middle of video
        if (media.mergeMode === 'middleSlide') {
          return (
            <div
              key={media.id}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-md transition-all animate-in fade-in duration-200 pointer-events-none p-6"
            >
              <div 
                style={{ 
                  transform: `scale(${(media.scale || 100) / 100}) rotate(${media.rotation || 0}deg)`,
                  opacity
                }}
                className="relative max-h-[85%] max-w-[85%] rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black/50 flex items-center justify-center"
              >
                {media.isVideo ? (
                  <video
                    src={media.url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="max-h-[70vh] max-w-full object-contain rounded-2xl"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={media.url}
                    alt="Merged Media"
                    className="max-h-[70vh] max-w-full object-contain rounded-2xl"
                  />
                )}
              </div>
            </div>
          );
        }

        return (
          <div
            key={media.id}
            style={{ 
              left: `${media.x}%`, 
              top: `${media.y}%`, 
              transform: `translate(-50%, -50%) scale(${(media.scale || 100) / 100}) rotate(${media.rotation || 0}deg)`,
              opacity
            }}
            className="absolute pointer-events-none z-10 select-none transition-all"
          >
            {media.isVideo ? (
              <video 
                src={media.url} 
                autoPlay 
                loop 
                muted 
                playsInline 
                className={`w-[150px] h-[150px] object-cover pointer-events-none ${media.rounded !== false ? 'rounded-2xl shadow-2xl border border-white/20' : 'rounded-none shadow-lg'}`}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img 
                src={media.url} 
                alt="Overlay" 
                className={`w-[150px] h-[150px] object-cover pointer-events-none ${media.rounded !== false ? 'rounded-2xl shadow-2xl border border-white/20' : 'rounded-none shadow-lg'}`} 
              />
            )}
          </div>
        );
      })}

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-4 group/progress cursor-pointer">
          <input 
            type="range" 
            min="0" 
            max="100" 
            step="0.1"
            value={progress} 
            onChange={handleSeek}
            className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer hover:h-2 transition-all accent-indigo-500"
          />
        </div>

        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="hover:text-indigo-400 transition-colors">
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>
            
            <div className="flex items-center gap-2 group/volume">
              <button onClick={toggleMute} className="hover:text-indigo-400 transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="w-0 opacity-0 group-hover/volume:w-20 group-hover/volume:opacity-100 transition-all duration-300 h-1.5 bg-white/30 rounded-full appearance-none accent-indigo-500"
              />
            </div>
            
            <span className="text-xs font-medium tabular-nums opacity-80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4 relative">
            
            {/* Quality Selector */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowQualityMenu(!showQualityMenu);
                  setShowSpeedMenu(false);
                }}
                className="hover:text-indigo-400 transition-colors text-sm font-medium opacity-80"
              >
                {quality}
              </button>
              
              {showQualityMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-[#1f2023] border border-white/10 rounded-lg shadow-xl overflow-hidden py-1 w-24 z-10 animate-in fade-in zoom-in-95 duration-200">
                  {['Auto', '1080p', '720p', '480p'].map(q => (
                    <button 
                      key={q}
                      onClick={() => {
                        setQuality(q);
                        setShowQualityMenu(false);
                        setIsBuffering(true); // Simulate quality change buffering
                        setTimeout(() => setIsBuffering(false), 500);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${quality === q ? 'text-white font-bold' : 'text-white/60'}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowQualityMenu(false);
                }}
                className="flex items-center gap-1 hover:text-indigo-400 transition-colors text-sm font-medium opacity-80"
              >
                {playbackSpeed}x <Settings className="w-4 h-4 ml-1" />
              </button>
            </div>

            <button onClick={toggleFullscreen} className="hover:text-indigo-400 transition-colors opacity-80">
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Speed Control Overlay */}
      {showSpeedMenu && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-16 bg-[#1f2023] rounded-xl shadow-2xl p-4 flex flex-col items-center gap-3 z-50 min-w-[300px] border border-white/10 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-center gap-3 font-semibold text-white/90">
            {[0.8, 1, 1.2, 1.5, 1.7, 2, 2.5].map(speed => (
              <button 
                key={speed}
                onClick={() => changeSpeed(speed)}
                className={`transition-colors ${playbackSpeed === speed ? 'text-white font-bold scale-110' : 'text-white/50 hover:text-white/80'}`}
              >
                {speed}x
              </button>
            ))}
          </div>
          <div className="w-full h-px bg-white/10"></div>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <span className="text-white/50 line-through decoration-white/30">{Math.round(duration)} sec</span>
            <span className="text-yellow-500 text-lg">⚡</span>
            <span className="text-white font-bold">{Math.round(duration / playbackSpeed)} sec</span>
          </div>
        </div>
      )}
    </div>
  );
}
