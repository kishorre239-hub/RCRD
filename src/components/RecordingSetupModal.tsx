'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Monitor, 
  Video, 
  Mic, 
  HelpCircle, 
  Home, 
  Globe, 
  Lock, 
  Unlock, 
  Check, 
  X, 
  ChevronDown, 
  Square, 
  Pause, 
  Play, 
  RotateCcw, 
  Trash2, 
  Loader2, 
  Upload, 
  Folder, 
  ExternalLink,
  Download
} from 'lucide-react';
import { uploadVideo, getCourses } from '@/lib/api';

interface FolderOption {
  id: string;
  name: string;
}

interface RecordingSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete?: () => void;
  defaultFolderId?: string;
  showToast?: (msg: string) => void;
}

export default function RecordingSetupModal({
  isOpen,
  onClose,
  onRecordingComplete,
  defaultFolderId,
  showToast = () => {},
}: RecordingSetupModalProps) {
  // Modal flow states: 'configuring' | 'countdown' | 'recording' | 'saving' | 'uploading'
  const [phase, setPhase] = useState<'configuring' | 'countdown' | 'recording' | 'saving' | 'uploading'>('configuring');

  // Configuration options matching Loom
  const [screenType, setScreenType] = useState<'Full Screen' | 'Window' | 'Current tab' | 'Camera only'>('Full Screen');
  const [showScreenOptions, setShowScreenOptions] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  // Access options (Public, Open, Restricted)
  const [videoAccess, setVideoAccess] = useState<'Public' | 'Open' | 'Restricted'>('Public');
  const [showAccessMenu, setShowAccessMenu] = useState(false);

  // Dynamic device detection
  const [cameraDeviceName, setCameraDeviceName] = useState('HP Wide Vision HD Camera');
  const [micDeviceName, setMicDeviceName] = useState('Default - Microphone Array');
  const [audioLevel, setAudioLevel] = useState(0); // For live microphone volume meter

  // Tip banner visibility
  const [showTip, setShowTip] = useState(true);

  // Media recording state
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Streams & Blob
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Save / Upload settings
  const [videoTitle, setVideoTitle] = useState('');
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedVideoId, setSavedVideoId] = useState<string | null>(null);

  // Auto-detect user's actual audio and camera hardware names dynamically
  useEffect(() => {
    if (!isOpen) return;

    async function detectDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInput = devices.find(d => d.kind === 'videoinput' && d.label);
        const audioInput = devices.find(d => d.kind === 'audioinput' && d.label);

        if (videoInput?.label) {
          setCameraDeviceName(videoInput.label);
        }
        if (audioInput?.label) {
          setMicDeviceName(audioInput.label);
        }
      } catch {
        // Fallback to default labels
      }
    }
    detectDevices();

    // Fetch dynamic folders from Google Drive
    getCourses()
      .then(res => {
        if (Array.isArray(res) && res.length > 0) {
          setFolders(res);
        } else {
          setFolders([
            { id: '1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S', name: 'MEETING' },
            { id: '1XuI65NmTH9w_8FYM1LJZYLPCYvWg27N7', name: 'GEONIXA LOOM' }
          ]);
        }
        if (defaultFolderId) {
          setSelectedFolderId(defaultFolderId);
        }
      })
      .catch(() => {
        setFolders([
          { id: '1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S', name: 'MEETING' },
          { id: '1XuI65NmTH9w_8FYM1LJZYLPCYvWg27N7', name: 'GEONIXA LOOM' }
        ]);
      });
  }, [isOpen, defaultFolderId]);

  // Live Microphone Activity Monitor for audio meter bar
  useEffect(() => {
    if (!isOpen || !micOn || phase !== 'configuring') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setAudioLevel(0);
      return;
    }

    let audioTrack: MediaStreamTrack | null = null;
    let micStreamLocal: MediaStream | null = null;

    navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    }).then(stream => {
      micStreamLocal = stream;
      audioTrack = stream.getAudioTracks()[0];
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const norm = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(norm);
        animFrameRef.current = requestAnimationFrame(checkAudio);
      };
      checkAudio();
    }).catch(() => {
      setAudioLevel(0);
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioTrack) audioTrack.stop();
      if (micStreamLocal) micStreamLocal.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isOpen, micOn, phase]);

  // Clean up streams & URLs on unmount or reset
  const cleanupStreams = useCallback(() => {
    if (displayStream) {
      displayStream.getTracks().forEach(t => t.stop());
      setDisplayStream(null);
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [displayStream, cameraStream]);

  // Handle modal close
  const handleClose = () => {
    cleanupStreams();
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    setRecordedBlob(null);
    setPhase('configuring');
    setIsPaused(false);
    setTimer(0);
    onClose();
  };

  // Start recording flow
  const startRecordingFlow = async () => {
    try {
      let dispStream: MediaStream | null = null;
      let camStream: MediaStream | null = null;
      let micStream: MediaStream | null = null;
      const combinedStream = new MediaStream();

      // Set up Studio Web Audio pipeline to eliminate noise and mix mic + system audio seamlessly
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();

      // 1. High-pass filter to strip low-end background fan rumble (<85Hz)
      const highpass = audioCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(85, audioCtx.currentTime);

      // 2. Dynamics Compressor for broadcast vocal clarity and smooth volume leveling
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
      compressor.knee.setValueAtTime(30, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

      // 1. Screen capture (unless Camera only)
      if (screenType === 'Camera only') {
        const camConstraints: MediaStreamConstraints = {
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
          audio: micOn ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
        };
        camStream = await navigator.mediaDevices.getUserMedia(camConstraints);
        camStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
        setCameraStream(camStream);

        if (micOn && camStream.getAudioTracks().length > 0) {
          const micSource = audioCtx.createMediaStreamSource(new MediaStream(camStream.getAudioTracks()));
          micSource.connect(highpass);
          highpass.connect(compressor);
          compressor.connect(dest);
        }
      } else {
        // Screen capture: Configure browser to prioritize Entire Screen
        const surface = screenType === 'Window' ? 'window' : screenType === 'Current tab' ? 'browser' : 'monitor';
        
        try {
          dispStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: surface,
              frameRate: { ideal: 30, max: 60 },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            } as MediaTrackConstraints,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            // Prioritize entire screen and prevent defaulting to current tab
            preferCurrentTab: screenType === 'Current tab',
            selfBrowserSurface: screenType === 'Current tab' ? 'include' : 'exclude',
            systemAudio: 'include',
            surfaceSwitching: 'include',
          } as DisplayMediaStreamOptions);
        } catch {
          // Fallback if browser doesn't accept extended constraints
          dispStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        }

        dispStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
        setDisplayStream(dispStream);

        // When user clicks "Stop sharing" from browser chrome banner
        if (dispStream.getVideoTracks()[0]) {
          dispStream.getVideoTracks()[0].onended = () => {
            stopRecording();
          };
        }

        // Connect system audio to Web Audio destination
        if (dispStream.getAudioTracks().length > 0) {
          const sysSource = audioCtx.createMediaStreamSource(new MediaStream(dispStream.getAudioTracks()));
          const sysGain = audioCtx.createGain();
          sysGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
          sysSource.connect(sysGain);
          sysGain.connect(dest);
        }

        // Microphone audio track with broadcast noise suppression & compression
        if (micOn) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({
              audio: { 
                echoCancellation: true, 
                noiseSuppression: true, 
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 48000,
              },
            });
            const micSource = audioCtx.createMediaStreamSource(micStream);
            micSource.connect(highpass);
            highpass.connect(compressor);
            compressor.connect(dest);
          } catch (micErr) {
            console.warn('Microphone permission notice:', micErr);
          }
        }

        // Camera feed for circular PIP bubble
        if (cameraOn) {
          try {
            camStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 30 } },
            });
            setCameraStream(camStream);
          } catch {
            // Camera denied
          }
        }
      }

      // Add the master filtered, mixed audio track to recorder stream
      dest.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));

      // Check optimal supported MIME type
      const mimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];
      let selectedMime = 'video/webm';
      for (const m of mimeCandidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: selectedMime });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedVideoUrl(url);

        // Pre-fill smart title with formatted date/time
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setVideoTitle(`Recording · ${dateStr} (${timeStr})`);

        // Switch to saving phase
        setPhase('saving');
        cleanupStreams();
      };

      // Start countdown (3, 2, 1) as seen in Image 4
      setPhase('countdown');
      setCountdown(3);

      let currentCount = 3;
      countdownIntervalRef.current = setInterval(() => {
        currentCount -= 1;
        if (currentCount > 0) {
          setCountdown(currentCount);
        } else {
          skipCountdown(recorder);
        }
      }, 1000);

    } catch (err: unknown) {
      console.error('Error starting recording:', err);
      showToast('Screen or media permissions required to record.');
      setPhase('configuring');
      cleanupStreams();
    }
  };

  // Skip countdown immediately
  const skipCountdown = (recorderInstance?: MediaRecorder | null) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    const rec = recorderInstance || mediaRecorderRef.current;
    if (rec && rec.state === 'inactive') {
      rec.start(1000);
      setPhase('recording');
      setTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
  };

  // Toggle pause
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    handleClose();
  };

  // Handle local file selection
  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
      const url = URL.createObjectURL(file);
      setRecordedBlob(file);
      setRecordedVideoUrl(url);
      setVideoTitle(file.name.replace(/\.[^/.]+$/, ''));
      setPhase('saving');
    }
  };

  // Handle saving to Google Drive & auto-save
  const handleSaveToDrive = async () => {
    if (!recordedBlob) return;

    setPhase('uploading');
    setUploadProgress(0);
    setUploadError(null);

    const targetCourse = folders.find(c => c.id === selectedFolderId);
    const finalTitle = videoTitle.trim() || `Recording · ${new Date().toLocaleDateString('en-US')}`;

    try {
      const res = await uploadVideo(
        recordedBlob,
        selectedFolderId || '1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S',
        (percent) => {
          setUploadProgress(percent);
        },
        finalTitle,
        {
          folderName: targetCourse?.name || 'MEETING',
          isMeeting: selectedFolderId === 'MEETING' || selectedFolderId === '1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S',
        }
      );

      if (res?.videoId) {
        setSavedVideoId(res.videoId);
      }
      showToast('Video saved to Google Drive!');
      if (onRecordingComplete) {
        onRecordingComplete();
      }
      // Wait a moment so user sees 100% complete
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err: unknown) {
      console.error('Failed to upload video to Drive:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Check Google Drive connection.');
      setPhase('saving');
    }
  };

  // Attach camera stream to PIP video elements
  useEffect(() => {
    if (pipCameraVideoRef.current && cameraStream) {
      pipCameraVideoRef.current.srcObject = cameraStream;
      pipCameraVideoRef.current.play().catch(() => {});
    }
  }, [cameraStream, phase]);

  const formatRecTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Hidden file input for file selection */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelection} 
        accept="video/*" 
        className="hidden" 
      />

      {/* ── PHASE 1: RECORDING SETUP WIDGET (EXACT LOOM POPUP AS SEEN IN IMAGE 2 & 3) ── */}
      {phase === 'configuring' && (
        <>
          {/* Subtle click-outside backdrop */}
          <div 
            className="fixed inset-0 bg-black/10 z-50 transition-opacity" 
            onClick={handleClose}
          />

          {/* Floating Widget Card at Top-Right */}
          <div 
            className="fixed top-14 right-8 w-[320px] bg-white rounded-[26px] shadow-[0_20px_50px_rgba(0,0,0,0.18)] z-50 border border-slate-200/90 p-5 overflow-visible animate-in fade-in zoom-in-95 duration-200 select-none font-sans"
            onClick={e => e.stopPropagation()}
          >
            {/* Header: Loom Brand Icon + Title + Help & Home Actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {/* Loom blue sunburst icon */}
                <div className="w-7 h-7 rounded-lg bg-[#2F70F2] flex items-center justify-center text-white shadow-xs">
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 stroke-white stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
                  </svg>
                </div>
                <span className="text-[17px] font-bold text-slate-900 tracking-tight">Loom</span>
              </div>

              <div className="flex items-center gap-1">
                <button 
                  type="button"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Help & Shortcuts"
                >
                  <HelpCircle size={18} />
                </button>
                <button 
                  type="button"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close widget"
                >
                  <Home size={18} />
                </button>
                <button 
                  type="button"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
                  title="Dismiss"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Controls Stack */}
            <div className="space-y-2.5">
              
              {/* 1. Screen Picker Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowScreenOptions(!showScreenOptions)}
                  className="w-full h-12 px-4 bg-slate-100/90 hover:bg-slate-200/70 rounded-2xl flex items-center justify-between cursor-pointer transition-colors text-slate-800 text-[13.5px] font-medium"
                >
                  <div className="flex items-center gap-3">
                    <Monitor size={18} className="text-slate-800 stroke-[2.2]" />
                    <span>{screenType}</span>
                  </div>
                  <ChevronDown size={16} className={`text-slate-500 transition-transform ${showScreenOptions ? 'rotate-180' : ''}`} />
                </button>

                {showScreenOptions && (
                  <div className="absolute top-full left-0 w-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 py-1">
                    {(['Full Screen', 'Window', 'Current tab', 'Camera only'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setScreenType(opt);
                          setShowScreenOptions(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                      >
                        <span>{opt}</span>
                        {screenType === opt && <Check size={14} className="text-[#2F70F2]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Camera Selector Pill */}
              <button
                type="button"
                onClick={() => setCameraOn(!cameraOn)}
                className="w-full h-12 px-4 bg-slate-100/90 hover:bg-slate-200/70 rounded-2xl flex items-center justify-between cursor-pointer transition-colors text-slate-800 text-[13.5px] font-medium"
              >
                <div className="flex items-center gap-3 truncate pr-2">
                  <Video size={18} className="text-slate-800 stroke-[2.2] shrink-0" />
                  <span className="truncate text-slate-800">
                    {cameraDeviceName.length > 18 ? cameraDeviceName.substring(0, 18) + '...' : cameraDeviceName}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs ${cameraOn ? 'bg-[#D5F5C6] text-[#2C7717]' : 'bg-slate-200 text-slate-500'}`}>
                  {cameraOn ? 'On' : 'Off'}
                </span>
              </button>

              {/* 3. Microphone Selector Pill with Live Audio Meter Bar */}
              <button
                type="button"
                onClick={() => setMicOn(!micOn)}
                className="w-full h-12 px-4 bg-slate-100/90 hover:bg-slate-200/70 rounded-2xl flex items-center justify-between cursor-pointer transition-colors text-slate-800 text-[13.5px] font-medium relative overflow-hidden"
              >
                {/* Live audio volume wave bar at bottom of pill */}
                {micOn && audioLevel > 5 && (
                  <div 
                    className="absolute bottom-0 left-0 h-1 bg-[#2F70F2] transition-all duration-75 ease-out opacity-90 rounded-full"
                    style={{ width: `${Math.min(100, audioLevel * 1.5)}%` }}
                  />
                )}
                <div className="flex items-center gap-3 truncate pr-2 relative z-10">
                  <Mic size={18} className="text-slate-800 stroke-[2.2] shrink-0" />
                  <span className="truncate text-slate-800">
                    {micDeviceName.length > 18 ? micDeviceName.substring(0, 18) + '...' : micDeviceName}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs relative z-10 ${micOn ? 'bg-[#D5F5C6] text-[#2C7717]' : 'bg-slate-200 text-slate-500'}`}>
                  {micOn ? 'On' : 'Off'}
                </span>
              </button>

              {/* 4. Video access row & Destination Folder */}
              <div className="pt-1.5 space-y-2">
                <div className="flex items-center justify-between relative">
                  <span className="text-[13.5px] font-semibold text-slate-700">Video access</span>
                  
                  <button
                    type="button"
                    onClick={() => setShowAccessMenu(!showAccessMenu)}
                    className="h-8 px-3 rounded-xl border border-slate-300 hover:border-slate-400 bg-white flex items-center gap-1.5 text-xs font-semibold text-slate-700 shadow-xs cursor-pointer transition-colors"
                  >
                    {videoAccess === 'Public' && <Globe size={14} className="text-slate-600" />}
                    {videoAccess === 'Open' && <Unlock size={14} className="text-slate-600" />}
                    {videoAccess === 'Restricted' && <Lock size={14} className="text-slate-600" />}
                    <span>{videoAccess}</span>
                  </button>

                  {/* Popover Menu matching Image 3 */}
                  {showAccessMenu && (
                    <div 
                      className="absolute right-0 top-10 w-[240px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="px-3 py-2 text-xs font-bold text-slate-900 border-b border-slate-100">
                        Change video access
                      </div>
                      <div className="py-1">
                        {[
                          { id: 'Public', label: 'Public', icon: <Globe size={16} className="text-[#2F70F2]" /> },
                          { id: 'Open', label: 'Open', icon: <Unlock size={16} className="text-slate-700" /> },
                          { id: 'Restricted', label: 'Restricted', icon: <Lock size={16} className="text-slate-700" /> },
                        ].map((opt) => (
                          <div
                            key={opt.id}
                            onClick={() => {
                              setVideoAccess(opt.id as any);
                              setShowAccessMenu(false);
                            }}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${videoAccess === opt.id ? 'bg-blue-50/70 text-[#2F70F2]' : 'hover:bg-slate-50 text-slate-700'}`}
                          >
                            <div className="flex items-center gap-2.5">
                              {opt.icon}
                              <span>{opt.label}</span>
                            </div>
                            {videoAccess === opt.id && <Check size={16} className="text-[#2F70F2]" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Destination Folder Selector */}
                <div className="flex items-center justify-between text-xs text-slate-600 pt-0.5">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Folder size={14} className="text-amber-500" />
                    <span>Drive Folder:</span>
                  </span>
                  <select 
                    value={selectedFolderId}
                    onChange={e => setSelectedFolderId(e.target.value)}
                    className="max-w-[170px] text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer truncate"
                  >
                    <option value="1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S">MEETING</option>
                    <option value="1XuI65NmTH9w_8FYM1LJZYLPCYvWg27N7">GEONIXA LOOM</option>
                    {folders
                      .filter(f => f.id !== '1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S' && f.id !== '1XuI65NmTH9w_8FYM1LJZYLPCYvWg27N7' && f.name !== 'MEETING')
                      .map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 5. Start Recording Button in Sunset Orange */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={startRecordingFlow}
                  className="w-full h-12 bg-[#FF5841] hover:bg-[#E04833] text-white font-bold rounded-2xl text-[15px] shadow-[0_4px_14px_rgba(255,88,65,0.35)] transition-all transform hover:-translate-y-0.5 active:scale-98 cursor-pointer flex items-center justify-center tracking-wide"
                >
                  Start recording
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-2 font-medium">
                  5 minute recording limit
                </p>
              </div>

              {/* 6. Footer Tip Banner */}
              {showTip && (
                <div className="bg-[#F0F6FF] border border-[#DCEBFF] rounded-2xl p-3 mt-3.5 text-[11px] text-slate-600 leading-snug">
                  <p>Get the <span className="text-[#2F70F2] underline cursor-pointer">Chrome extension</span> or <span className="text-[#2F70F2] underline cursor-pointer">Desktop app</span> to use Loom anywhere.</p>
                  <button 
                    type="button"
                    onClick={() => setShowTip(false)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer mt-1.5 block underline"
                  >
                    Dismiss tip
                  </button>
                </div>
              )}

              {/* File upload fallback link */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-700 inline-flex items-center gap-1.5 hover:underline cursor-pointer"
                >
                  <Upload size={12} />
                  <span>Upload existing video</span>
                </button>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ── PHASE 2: COUNTDOWN SCREEN (EXACT REPLICA AS SEEN IN IMAGE 4) ── */}
      {phase === 'countdown' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs select-none">
          {/* Big Blue Countdown Circle */}
          <div className="w-48 h-48 rounded-full bg-[#2F70F2] flex flex-col items-center justify-center text-white shadow-2xl animate-in zoom-in-75 duration-300">
            <span className="text-7xl font-extrabold tracking-tight">{countdown}</span>
            <button
              type="button"
              onClick={() => skipCountdown()}
              className="mt-1 text-sm font-bold text-white/90 hover:text-white hover:underline cursor-pointer tracking-wide"
            >
              Skip
            </button>
          </div>

          {/* Webcam bubble in bottom-left during countdown (as seen in Image 4!) */}
          {cameraOn && (
            <div className="fixed bottom-6 left-6 z-50 w-36 h-36 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-950">
              <video 
                ref={pipCameraVideoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover -scale-x-100" 
              />
            </div>
          )}
        </div>
      )}

      {/* ── PHASE 3: RECORDING IN PROGRESS FLOATING TOOLBAR + WEBCAM BUBBLE ── */}
      {phase === 'recording' && (
        <>
          {/* Floating dark vertical toolbar on left screen edge (as seen in Image 2 & 4) */}
          <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 bg-[#1E1E24]/95 backdrop-blur-md text-white rounded-2xl p-2.5 flex flex-col items-center gap-3 shadow-2xl border border-white/10 select-none">
            {/* Red Stop Recording Button */}
            <button
              type="button"
              onClick={stopRecording}
              className="w-9 h-9 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-transform active:scale-90 cursor-pointer shadow-md"
              title="Stop Recording"
            >
              <Square size={16} fill="white" />
            </button>

            {/* Timer Display */}
            <span className="text-xs font-mono font-bold text-white/90 px-1 py-0.5 rounded bg-white/10">
              {formatRecTime(timer)}
            </span>

            {/* Pause / Resume Button */}
            <button
              type="button"
              onClick={togglePause}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/90 hover:text-white transition-colors cursor-pointer"
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play size={16} fill="white" /> : <Pause size={16} />}
            </button>

            {/* Restart Button */}
            <button
              type="button"
              onClick={() => {
                cancelRecording();
                setTimeout(() => startRecordingFlow(), 400);
              }}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
              title="Restart Recording"
            >
              <RotateCcw size={15} />
            </button>

            {/* Cancel / Trash Button */}
            <button
              type="button"
              onClick={cancelRecording}
              className="w-8 h-8 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors cursor-pointer"
              title="Delete / Cancel"
            >
              <Trash2 size={15} />
            </button>
          </div>

          {/* Floating camera circle in bottom-left corner */}
          {cameraOn && (
            <div className="fixed bottom-6 left-6 z-50 w-36 h-36 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-950">
              <video 
                ref={pipCameraVideoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover -scale-x-100" 
              />
            </div>
          )}
        </>
      )}

      {/* ── PHASE 4: RECORDING COMPLETED / SAVING OVERLAY ── */}
      {phase === 'saving' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div 
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="bg-[#D5F5C6] text-[#2C7717] p-2 rounded-xl">
                  <Check size={18} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Recording Completed</h3>
                  <p className="text-xs text-slate-500">Auto-routed to Google Drive</p>
                </div>
              </div>
              <button 
                onClick={handleClose} 
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Video preview */}
              {recordedVideoUrl && (
                <div className="w-full h-44 bg-slate-950 rounded-2xl overflow-hidden relative border border-slate-200 shadow-inner">
                  <video 
                    src={recordedVideoUrl} 
                    controls 
                    className="w-full h-full object-contain" 
                  />
                </div>
              )}

              {/* Error banner */}
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-medium text-red-600">
                  <X size={16} className="shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Video Title */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Video Title
                </label>
                <input 
                  type="text" 
                  value={videoTitle} 
                  onChange={e => setVideoTitle(e.target.value)} 
                  placeholder="Enter video title..." 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-[#2F70F2] focus:ring-1 focus:ring-[#2F70F2] outline-none transition-all"
                />
              </div>

              {/* Destination Folder */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Google Drive Folder
                </label>
                <div className="relative">
                  <select 
                    value={selectedFolderId} 
                    onChange={e => setSelectedFolderId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-[#2F70F2] outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S">MEETING (Google Drive)</option>
                    <option value="1XuI65NmTH9w_8FYM1LJZYLPCYvWg27N7">GEONIXA LOOM (Root)</option>
                    {folders
                      .filter(f => f.id !== '1lmf5ZIbwPLtmpNI22TCFyeJVEibkIA3S' && f.id !== '1XuI65NmTH9w_8FYM1LJZYLPCYvWg27N7' && f.name !== 'MEETING')
                      .map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3">
                {recordedVideoUrl && (
                  <a
                    href={recordedVideoUrl}
                    download={`${videoTitle || 'recording'}.webm`}
                    className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Download locally"
                  >
                    <Download size={15} />
                    <span>Download</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveToDrive}
                  className="flex-[2] py-3 px-4 bg-[#FF5841] hover:bg-[#E04833] text-white rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <Folder size={15} />
                  <span>Save to Google Drive</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE 5: UPLOADING TO GOOGLE DRIVE OVERLAY ── */}
      {phase === 'uploading' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95">
            <Loader2 className="w-12 h-12 text-[#FF5841] animate-spin" />
            <div className="text-lg font-bold text-slate-900">Saving to Google Drive...</div>
            <div className="text-xs text-slate-500 text-center">
              Target folder: {folders.find(f => f.id === selectedFolderId)?.name || 'MEETING'}
            </div>
            {uploadProgress > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-2">
                <div 
                  className="bg-[#FF5841] h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            <div className="text-xs font-mono font-bold text-slate-600">
              {uploadProgress}%
            </div>
          </div>
        </div>
      )}
    </>
  );
}
