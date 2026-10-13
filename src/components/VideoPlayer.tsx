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

type EditorData = {
  textOverlays?: { id: string; text: string; x: number; y: number; color: string; size: number; start: number; end: number; rotation?: number }[];
  mediaOverlays?: { id: string; url: string; x: number; y: number; scale: number; start: number; end: number; rotation?: number }[];
  [key: string]: unknown;
};

export default function VideoPlayer({ src, onError, onTimeUpdate, downloadEnabled = true, externalPlaybackRate = 1, videoId, initialEditorData }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
          setEditorData(typeof initialEditorData === 'string' ? JSON.parse(initialEditorData) : initialEditorData);
        } catch {
          setEditorData(null);
        }
      } else if (videoId) {
        try {
          const data = localStorage.getItem(`video-edits-${videoId}`);
          if (data) setEditorData(JSON.parse(data));
        } catch {
          console.error("Failed to load editor data");
        }
      }
    };
    setTimeout(handleData, 0);
  }, [videoId, initialEditorData]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      setCurrentTime(video.currentTime);
      setProgress((video.currentTime / (video.duration || 1)) * 100);
      if (onTimeUpdate) {
        onTimeUpdate(video.currentTime);
      }
    };
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsBuffering(false);
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    const handleError = () => {
      setHasError(true);
      if (onError) onError("Failed to load video stream.");
    };

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
    };
  }, [onError, onTimeUpdate]);

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
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = (parseFloat(e.target.value) / 100) * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
      setProgress(parseFloat(e.target.value));
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
        id="main-video-player"
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        controlsList={downloadEnabled ? "" : "nodownload"}
      />
      
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-20">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      )}

      {/* TIMED TEXT OVERLAYS */}
      {editorData?.textOverlays?.map((text) => {
        const isVisible = currentTime >= text.start && currentTime <= text.end;
        if (!isVisible) return null;
        return (
          <div
            key={text.id}
            style={{ left: `${text.x}%`, top: `${text.y}%`, color: text.color, fontSize: `${text.size}px`, transform: `translate(-50%, -50%) rotate(${text.rotation || 0}deg)` }}
            className="absolute font-black drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] pointer-events-none z-10"
          >
            {text.text}
          </div>
        );
      })}

      {/* TIMED MEDIA OVERLAYS */}
      {editorData?.mediaOverlays?.map((media) => {
        const isVisible = currentTime >= media.start && currentTime <= media.end;
        if (!isVisible) return null;
        return (
          <div
            key={media.id}
            style={{ left: `${media.x}%`, top: `${media.y}%`, transform: `translate(-50%, -50%) scale(${media.scale / 100}) rotate(${media.rotation || 0}deg)` }}
            className="absolute pointer-events-none z-10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.url} alt="Overlay" className="w-[150px] h-[150px] object-cover pointer-events-none rounded-lg" />
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
