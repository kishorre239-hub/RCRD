'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { 
  Monitor, 
  Video, 
  Mic, 
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
  Download,
  AlertCircle
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
  // Modal flow states: 'configuring' | 'requesting' | 'countdown' | 'recording' | 'saving' | 'uploading'
  const [phase, setPhase] = useState<'configuring' | 'requesting' | 'countdown' | 'recording' | 'saving' | 'uploading'>('configuring');

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
  const [audioLevel, setAudioLevel] = useState(0);

  // Tip banner visibility
  const [showTip, setShowTip] = useState(true);

  // Media recording state
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const totalPausedDurationRef = useRef<number>(0);
  const pipWindowRef = useRef<Window | null>(null);
  const hasPipSupport = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  // Streams & Blob
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const pipCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const bottomPipCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const activeStreamsRef = useRef<{ disp?: MediaStream | null; cam?: MediaStream | null; mic?: MediaStream | null }>({});

  // Save / Upload settings
  const [videoTitle, setVideoTitle] = useState('');
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(defaultFolderId || '');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
        // Fallback to defaults
      }
    }
    detectDevices();

    // Fetch dynamic folders from Google Drive
    async function fetchDynamicFolders() {
      try {
        const res = await fetch('/api/folders', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setFolders(data);
            if (defaultFolderId) {
              setSelectedFolderId(defaultFolderId);
            } else {
              setSelectedFolderId(prev => (prev && data.some(d => d.id === prev) ? prev : data[0].id));
            }
            return;
          }
        }
      } catch {
        // Continue to fallback
      }

      try {
        const fallbackCourses = await getCourses();
        if (Array.isArray(fallbackCourses) && fallbackCourses.length > 0) {
          setFolders(fallbackCourses);
          if (defaultFolderId) {
            setSelectedFolderId(defaultFolderId);
          } else {
            setSelectedFolderId(prev => (prev && fallbackCourses.some(d => d.id === prev) ? prev : fallbackCourses[0].id));
          }
        }
      } catch {}
    }

    fetchDynamicFolders();
  }, [isOpen, defaultFolderId]);

  // Live Microphone Activity Monitor for audio meter bar
  useEffect(() => {
    if (!isOpen || !micOn || phase !== 'configuring') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const timer = setTimeout(() => setAudioLevel(0), 0);
      return () => clearTimeout(timer);
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
    if (activeStreamsRef.current.disp) {
      activeStreamsRef.current.disp.getTracks().forEach(t => t.stop());
      activeStreamsRef.current.disp = null;
    }
    if (activeStreamsRef.current.cam) {
      activeStreamsRef.current.cam.getTracks().forEach(t => t.stop());
      activeStreamsRef.current.cam = null;
    }
    if (activeStreamsRef.current.mic) {
      activeStreamsRef.current.mic.getTracks().forEach(t => t.stop());
      activeStreamsRef.current.mic = null;
    }
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

  // Handle modal close safely (only when NOT recording)
  const handleClose = () => {
    if (phase === 'recording' || phase === 'countdown') {
      if (!confirm('Are you sure you want to stop and discard this recording?')) {
        return;
      }
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try { pipWindowRef.current.close(); } catch {}
      pipWindowRef.current = null;
    }
    cleanupStreams();
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    setRecordedBlob(null);
    setPhase('configuring');
    setIsPaused(false);
    setTimer(0);
    startTimeRef.current = 0;
    totalPausedDurationRef.current = 0;
    onClose();
  };

  // Stop recording and transition to Save screen
  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try { pipWindowRef.current.close(); } catch {}
      pipWindowRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Error stopping MediaRecorder:', err);
      }
    }
  }, []);

  // Cancel recording and close
  const cancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try { pipWindowRef.current.close(); } catch {}
      pipWindowRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    cleanupStreams();
    setPhase('configuring');
    setIsPaused(false);
    setTimer(0);
    startTimeRef.current = 0;
    totalPausedDurationRef.current = 0;
    onClose();
  };

  // Start recording flow
  const startRecordingFlow = async () => {
    // 1. Immediately switch to requesting phase: Hides setup popup and eliminates backdrop click-outside!
    setPhase('requesting');

    try {
      let dispStream: MediaStream | null = null;
      let camStream: MediaStream | null = null;
      let micStream: MediaStream | null = null;
      const combinedStream = new MediaStream();

      // Set up Studio Web Audio pipeline
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }
      const dest = audioCtx.createMediaStreamDestination();

      const highpass = audioCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(85, audioCtx.currentTime);

      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
      compressor.knee.setValueAtTime(30, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

      // Connect filter pipeline to destination
      highpass.connect(compressor);
      compressor.connect(dest);

      // 1. Screen capture (unless Camera only)
      if (screenType === 'Camera only') {
        const camConstraints: MediaStreamConstraints = {
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 12, max: 15 } },
          audio: micOn ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 16000 } : false,
        };
        camStream = await navigator.mediaDevices.getUserMedia(camConstraints);
        activeStreamsRef.current.cam = camStream;
        camStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
        setCameraStream(camStream);

        if (micOn && camStream.getAudioTracks().length > 0) {
          const micSource = audioCtx.createMediaStreamSource(new MediaStream(camStream.getAudioTracks()));
          micSource.connect(highpass);
        }
      } else {
        // Screen capture: Configure browser to prioritize Entire Screen
        const surface = screenType === 'Window' ? 'window' : screenType === 'Current tab' ? 'browser' : 'monitor';
        
        try {
          dispStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: surface,
              frameRate: { ideal: 12, max: 15 },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            } as MediaTrackConstraints,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            preferCurrentTab: screenType === 'Current tab',
            selfBrowserSurface: screenType === 'Current tab' ? 'include' : 'exclude',
            systemAudio: 'include',
            surfaceSwitching: 'include',
          } as DisplayMediaStreamOptions);
        } catch {
          dispStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: { ideal: 12, max: 15 } } as MediaTrackConstraints,
            audio: true,
          });
        }

        activeStreamsRef.current.disp = dispStream;
        dispStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
        setDisplayStream(dispStream);

        // When user clicks "Stop sharing" from Chrome's bottom banner on any tab or window
        dispStream.getVideoTracks().forEach(t => {
          t.onended = () => {
            stopRecording();
          };
        });

        // Connect system audio to Web Audio destination if available
        if (dispStream.getAudioTracks().length > 0) {
          try {
            const sysSource = audioCtx.createMediaStreamSource(new MediaStream(dispStream.getAudioTracks()));
            const sysGain = audioCtx.createGain();
            sysGain.gain.setValueAtTime(0.85, audioCtx.currentTime);
            sysSource.connect(sysGain);
            sysGain.connect(dest);
          } catch (e) {
            console.warn('System audio mix note:', e);
          }
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
                sampleRate: 16000,
              },
            });
            activeStreamsRef.current.mic = micStream;
            const micSource = audioCtx.createMediaStreamSource(micStream);
            micSource.connect(highpass);
          } catch (micErr) {
            console.warn('Microphone stream optional note:', micErr);
          }
        }

        // Camera feed for circular PIP bubble
        if (cameraOn) {
          try {
            camStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 12, max: 15 } },
            });
            activeStreamsRef.current.cam = camStream;
            setCameraStream(camStream);
          } catch {
            // Camera optional
          }
        }
      }

      // Add filtered audio track to recorder stream if available
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

      combinedStream.getVideoTracks().forEach((t) => {
        if ('contentHint' in t) {
          t.contentHint = 'detail';
        }
      });

      // Ultra-efficient storage compression: 16 kbps video + 6 kbps Opus voice
      // Exactly ~10 MB per 1 full 60-minute lecture (~340 KB for 2 minutes instead of 16 MB)
      const recorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 16000,
        audioBitsPerSecond: 6000,
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

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setVideoTitle(`Recording · ${dateStr} (${timeStr})`);

        setPhase('saving');
        cleanupStreams();
      };

      // Start countdown (3, 2, 1) then transition to recording
      setPhase('countdown');
      setCountdown(3);

      // Pre-open Document Picture-in-Picture window on desktop so controller is ALWAYS floating across all tabs/apps
      if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
        openPipController().catch(() => {});
      }

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
      showToast('Screen share was cancelled or permission denied.');
      setPhase('configuring');
      cleanupStreams();
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        try { pipWindowRef.current.close(); } catch {}
        pipWindowRef.current = null;
      }
    }
  };

  // High-precision elapsed time calculation resilient to background tab throttling
  const updateTimer = useCallback(() => {
    if (startTimeRef.current > 0 && !isPaused) {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - startTimeRef.current - totalPausedDurationRef.current) / 1000));
      setTimer(elapsed);
    }
  }, [isPaused]);

  // Toggle pause / resume with exact pause-duration subtraction
  const togglePause = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;

    if (rec.state === 'paused') {
      rec.resume();
      if (pauseTimeRef.current > 0) {
        totalPausedDurationRef.current += (Date.now() - pauseTimeRef.current);
        pauseTimeRef.current = 0;
      }
      setIsPaused(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current > 0) {
          const now = Date.now();
          const elapsed = Math.max(0, Math.floor((now - startTimeRef.current - totalPausedDurationRef.current) / 1000));
          setTimer(elapsed);
        }
      }, 500);
    } else if (rec.state === 'recording') {
      rec.pause();
      pauseTimeRef.current = Date.now();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, []);

  // Open Document Picture-in-Picture window (always on top across desktop applications)
  const openPipController = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
          pipWindowRef.current.focus();
          return;
        }

        // @ts-expect-error - Document Picture-in-Picture API
        const pip = await window.documentPictureInPicture.requestWindow({
          width: 380,
          height: 85,
        });
        pipWindowRef.current = pip;

        // Copy styles
        Array.from(document.styleSheets).forEach(sheet => {
          try {
            const rules = Array.from(sheet.cssRules).map(r => r.cssText).join('');
            const style = document.createElement('style');
            style.textContent = rules;
            pip.document.head.appendChild(style);
          } catch {
            if (sheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = sheet.href;
              pip.document.head.appendChild(link);
            }
          }
        });

        pip.document.title = "RCRD";
        try {
          const pipFavicon = pip.document.createElement('link');
          pipFavicon.rel = 'icon';
          pipFavicon.href = '/icon.png';
          pip.document.head.appendChild(pipFavicon);
        } catch {}

        pip.document.body.style.margin = '0';
        pip.document.body.style.background = '#1E1E24';
        pip.document.body.style.overflow = 'hidden';
        pip.document.body.style.display = 'flex';
        pip.document.body.style.alignItems = 'center';
        pip.document.body.style.justifyContent = 'center';
        pip.document.body.style.fontFamily = 'system-ui, -apple-system, sans-serif';

        pip.document.body.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;color:white;padding:10px 16px;background:#1E1E24;border-radius:16px;user-select:none;width:100%;justify-content:center;">
            <img src="/icon.png" alt="RCRD" style="height:26px;width:auto;object-fit:contain;margin-right:2px;" />
            <div style="display:flex;align-items:center;gap:6px;padding-right:10px;border-right:1px solid rgba(255,255,255,0.2);">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;"></span>
              <span style="font-weight:bold;font-size:11px;color:#f87171;">REC</span>
              <span id="pip-timer-display" style="font-family:monospace;font-weight:bold;font-size:13px;min-width:44px;">00:00</span>
            </div>
            <button id="pip-pause-btn" style="background:rgba(255,255,255,0.15);border:none;color:white;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:bold;cursor:pointer;">
              ⏸ Pause
            </button>
            <button id="pip-stop-btn" style="background:#ef4444;border:none;color:white;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 2px 8px rgba(239,68,68,0.5);">
              ⏹ Stop & Save
            </button>
          </div>
        `;

        const pBtn = pip.document.getElementById('pip-pause-btn');
        if (pBtn) {
          pBtn.onclick = () => togglePause();
        }
        const sBtn = pip.document.getElementById('pip-stop-btn');
        if (sBtn) {
          sBtn.onclick = () => {
            stopRecording();
            try { pip.close(); } catch {}
            window.focus();
          };
        }

        pip.addEventListener('pagehide', () => {
          pipWindowRef.current = null;
        });
      }
    } catch (err) {
      console.warn('Document Picture-in-Picture optional note:', err);
    }
  }, [stopRecording, togglePause]);

  const openPipRef = useRef(openPipController);
  useEffect(() => {
    openPipRef.current = openPipController;
  }, [openPipController]);

  // Skip countdown immediately and start recording
  const skipCountdown = useCallback((recorderInstance?: MediaRecorder | null) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    const rec = recorderInstance || mediaRecorderRef.current;
    if (rec && rec.state === 'inactive') {
      try {
        rec.start(1000);
      } catch (e) {
        console.warn('Recorder start fallback:', e);
        rec.start();
      }
      setPhase('recording');
      startTimeRef.current = Date.now();
      totalPausedDurationRef.current = 0;
      setTimer(0);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        if (startTimeRef.current > 0) {
          const now = Date.now();
          const elapsed = Math.max(0, Math.floor((now - startTimeRef.current - totalPausedDurationRef.current) / 1000));
          setTimer(elapsed);
        }
      }, 500);

      // Offer / auto-open Picture-in-Picture on desktop so controller is always visible across windows
      if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
        openPipRef.current().catch(() => {});
      }
    } else if (rec && rec.state === 'recording') {
      setPhase('recording');
    }
  }, []);

  // Sync timer & state into Document Picture-in-Picture window
  useEffect(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      const m = Math.floor(timer / 60).toString().padStart(2, '0');
      const s = (timer % 60).toString().padStart(2, '0');
      const timerEl = pipWindowRef.current.document.getElementById('pip-timer-display');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
      const pauseEl = pipWindowRef.current.document.getElementById('pip-pause-btn');
      if (pauseEl) pauseEl.textContent = isPaused ? "▶ Resume" : "⏸ Pause";
    }
  }, [timer, isPaused]);

  // Window focus & tab visibility recovery
  useEffect(() => {
    if (phase !== 'recording') return;

    const handleSync = () => {
      updateTimer();
    };

    window.addEventListener('focus', handleSync);
    window.addEventListener('blur', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Recording in progress. Are you sure you want to exit?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('blur', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [phase, isPaused, updateTimer]);

  // Global Keyboard Shortcut (Escape or Alt+S or Ctrl+Shift+S) to finish and save recording anytime
  useEffect(() => {
    if (phase !== 'recording') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' ||
        (e.altKey && (e.key === 's' || e.key === 'S')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S'))
      ) {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, stopRecording]);

  // Dynamic browser tab title with live recording time
  useEffect(() => {
    if (phase === 'recording') {
      const origTitle = document.title;
      const m = Math.floor(timer / 60).toString().padStart(2, '0');
      const s = (timer % 60).toString().padStart(2, '0');
      document.title = `● REC (${m}:${s}) - CLICK TO STOP - RCRD`;
      return () => {
        document.title = origTitle;
      };
    }
  }, [phase, timer]);

  // If tab becomes hidden during countdown, immediately skip countdown to start recording without waiting
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && (phase === 'countdown' || phase === 'requesting')) {
        skipCountdown();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [phase, skipCountdown]);

  // Handle local file selection
  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
      const url = URL.createObjectURL(file);
      setRecordedBlob(file);
      setRecordedVideoUrl(url);

      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setVideoTitle(nameWithoutExt);

      setPhase('saving');
    }
  };

  // Save video to Google Drive / Course folder
  const handleSaveToDrive = async () => {
    if (!recordedBlob) return;

    setPhase('uploading');
    setUploadProgress(0);
    setUploadError(null);

    const targetCourse = folders.find(c => c.id === selectedFolderId);
    const finalTitle = videoTitle.trim() || `Recording · ${new Date().toLocaleDateString('en-US')}`;

    try {
      await uploadVideo(
        recordedBlob,
        selectedFolderId || '',
        (percent) => {
          setUploadProgress(percent);
        },
        finalTitle,
        {
          folderName: targetCourse?.name,
          isMeeting: targetCourse?.name?.toLowerCase().includes('meeting') ?? false,
        }
      );

      showToast('Video saved to Library & Course folder!');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('video-updated'));
      }
      if (onRecordingComplete) {
        onRecordingComplete();
      }
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: unknown) {
      console.error('Failed to upload video to Drive:', err);
      setUploadError(err instanceof Error ? err.message : 'Save failed. Video is kept in preview to download locally.');
      setPhase('saving');
    }
  };

  // Attach camera stream to PIP video elements
  useEffect(() => {
    if (pipCameraVideoRef.current && cameraStream) {
      pipCameraVideoRef.current.srcObject = cameraStream;
      pipCameraVideoRef.current.play().catch(() => {});
    }
    if (bottomPipCameraVideoRef.current && cameraStream) {
      bottomPipCameraVideoRef.current.srcObject = cameraStream;
      bottomPipCameraVideoRef.current.play().catch(() => {});
    }
  }, [cameraStream, phase]);

  const formatRecTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // NEVER unmount or hide if active recording, countdown, saving, or uploading is in progress!
  if (!isOpen && phase === 'configuring') return null;

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

      {/* ── PHASE 1: CONFIGURING (CENTERED POPUP) ── */}
      {phase === 'configuring' && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[9990] flex items-center justify-center p-4 transition-opacity animate-in fade-in duration-200" 
          onClick={handleClose}
        >
          {/* Centered Widget Card */}
          <div 
            className="w-[340px] max-w-full bg-white rounded-[26px] shadow-[0_25px_60px_rgba(0,0,0,0.25)] z-[9995] border border-[#E2E8F0]/90 p-5 overflow-visible animate-in fade-in zoom-in-95 duration-200 select-none font-sans relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Header: Brand Icon + Title (RCRD - One Solution) + Close Action */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#E2E8F0]/70">
              <div className="flex items-center gap-3">
                <Image
                  src="/icon.png"
                  alt="RCRD Logo"
                  width={140}
                  height={80}
                  priority
                  className="h-10 w-auto object-contain scale-125 origin-left"
                />
                <span className="text-[17px] font-extrabold text-[#0F172A] tracking-tight">
                  RCRD - One Solution
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button 
                  type="button"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Dismiss"
                >
                  <X size={18} />
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
                  className="w-full h-12 px-4 bg-slate-100/90 hover:bg-slate-200/70 rounded-2xl flex items-center justify-between cursor-pointer transition-colors text-[#0F172A] text-[13.5px] font-medium"
                >
                  <div className="flex items-center gap-3">
                    <Monitor size={18} className="text-[#0F172A] stroke-[2.2]" />
                    <span>{screenType}</span>
                  </div>
                  <ChevronDown size={16} className={`text-[#475569] transition-transform ${showScreenOptions ? 'rotate-180' : ''}`} />
                </button>

                {showScreenOptions && (
                  <div className="absolute top-full left-0 w-full mt-1.5 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl overflow-hidden z-[9999] animate-in fade-in zoom-in-95 duration-150 py-1">
                    {(['Full Screen', 'Window', 'Current tab', 'Camera only'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setScreenType(opt);
                          setShowScreenOptions(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold hover:bg-[#F8FAFC] text-[#0F172A] transition-colors cursor-pointer"
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
                className="w-full h-12 px-4 bg-slate-100/90 hover:bg-slate-200/70 rounded-2xl flex items-center justify-between cursor-pointer transition-colors text-[#0F172A] text-[13.5px] font-medium"
              >
                <div className="flex items-center gap-3 truncate pr-2">
                  <Video size={18} className="text-[#0F172A] stroke-[2.2] shrink-0" />
                  <span className="truncate text-[#0F172A]">
                    {cameraDeviceName.length > 18 ? cameraDeviceName.substring(0, 18) + '...' : cameraDeviceName}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs ${cameraOn ? 'bg-[#D5F5C6] text-[#2C7717]' : 'bg-slate-200 text-[#475569]'}`}>
                  {cameraOn ? 'On' : 'Off'}
                </span>
              </button>

              {/* 3. Microphone Selector Pill with Live Audio Meter Bar */}
              <button
                type="button"
                onClick={() => setMicOn(!micOn)}
                className="w-full h-12 px-4 bg-slate-100/90 hover:bg-slate-200/70 rounded-2xl flex items-center justify-between cursor-pointer transition-colors text-[#0F172A] text-[13.5px] font-medium relative overflow-hidden"
              >
                {micOn && audioLevel > 5 && (
                  <div 
                    className="absolute bottom-0 left-0 h-1 bg-[#2F70F2] transition-all duration-75 ease-out opacity-90 rounded-full"
                    style={{ width: `${Math.min(100, audioLevel * 1.5)}%` }}
                  />
                )}
                <div className="flex items-center gap-3 truncate pr-2 relative z-10">
                  <Mic size={18} className="text-[#0F172A] stroke-[2.2] shrink-0" />
                  <span className="truncate text-[#0F172A]">
                    {micDeviceName.length > 18 ? micDeviceName.substring(0, 18) + '...' : micDeviceName}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs relative z-10 ${micOn ? 'bg-[#D5F5C6] text-[#2C7717]' : 'bg-slate-200 text-[#475569]'}`}>
                  {micOn ? 'On' : 'Off'}
                </span>
              </button>

              {/* 4. Video access row & Destination Folder */}
              <div className="pt-1.5 space-y-2">
                <div className="flex items-center justify-between relative">
                  <span className="text-[13.5px] font-semibold text-[#0F172A]">Video access</span>
                  
                  <button
                    type="button"
                    onClick={() => setShowAccessMenu(!showAccessMenu)}
                    className="h-8 px-3 rounded-xl border border-[#E2E8F0] hover:border-slate-400 bg-white flex items-center gap-1.5 text-xs font-semibold text-[#0F172A] shadow-xs cursor-pointer transition-colors"
                  >
                    {videoAccess === 'Public' && <Globe size={14} className="text-[#475569]" />}
                    {videoAccess === 'Open' && <Unlock size={14} className="text-[#475569]" />}
                    {videoAccess === 'Restricted' && <Lock size={14} className="text-[#475569]" />}
                    <span>{videoAccess}</span>
                  </button>

                  {showAccessMenu && (
                    <div 
                      className="absolute right-0 top-10 w-[240px] bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] p-2 z-[9999] animate-in fade-in zoom-in-95 duration-150"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="px-3 py-2 text-xs font-bold text-[#0F172A] border-b border-[#E2E8F0]">
                        Change video access
                      </div>
                      <div className="py-1">
                        {[
                          { id: 'Public' as const, label: 'Public', icon: <Globe size={16} className="text-[#2F70F2]" /> },
                          { id: 'Open' as const, label: 'Open', icon: <Unlock size={16} className="text-[#0F172A]" /> },
                          { id: 'Restricted' as const, label: 'Restricted', icon: <Lock size={16} className="text-[#0F172A]" /> },
                        ].map((opt) => (
                          <div
                            key={opt.id}
                            onClick={() => {
                              setVideoAccess(opt.id);
                              setShowAccessMenu(false);
                            }}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${videoAccess === opt.id ? 'bg-blue-50/70 text-[#2F70F2]' : 'hover:bg-[#F8FAFC] text-[#0F172A]'}`}
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
                <div className="flex items-center justify-between text-xs text-[#475569] pt-0.5">
                  <span className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                    <Folder size={14} className="text-amber-500" />
                    <span>Drive Folder:</span>
                  </span>
                  <select 
                    value={selectedFolderId}
                    onChange={e => setSelectedFolderId(e.target.value)}
                    className="max-w-[170px] text-xs font-semibold text-[#0F172A] bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] rounded-lg px-2 py-1 outline-none cursor-pointer truncate"
                  >
                    {folders.length === 0 ? (
                      <option value={selectedFolderId}>Loading folders...</option>
                    ) : (
                      folders.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* 5. Start Recording Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={startRecordingFlow}
                  className="w-full h-12 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold rounded-2xl text-[15px] shadow-[0_4px_14px_rgba(21, 67, 96,0.35)] transition-all transform hover:-translate-y-0.5 active:scale-98 cursor-pointer flex items-center justify-center tracking-wide"
                >
                  Start recording
                </button>
                <p className="text-[11px] text-[#475569] text-center mt-2 font-medium">
                  5 minute recording limit
                </p>
              </div>

              {/* 6. Footer Tip Banner */}
              {showTip && (
                <div className="bg-[#F0F6FF] border border-[#DCEBFF] rounded-2xl p-3 mt-3.5 text-[11px] text-[#475569] leading-snug">
                  <p>Get the <span className="text-[#2F70F2] underline cursor-pointer">Chrome extension</span> or <span className="text-[#2F70F2] underline cursor-pointer">Desktop app</span> to use RCRD anywhere.</p>
                  <button 
                    type="button"
                    onClick={() => setShowTip(false)}
                    className="text-[11px] font-semibold text-[#475569] hover:text-[#0F172A] cursor-pointer mt-1.5 block underline"
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
                  className="text-xs font-semibold text-[#475569] hover:text-[#0F172A] inline-flex items-center gap-1.5 hover:underline cursor-pointer"
                >
                  <Upload size={12} />
                  <span>Upload existing video</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── PHASE 1.5: REQUESTING PERMISSION NOTIFICATION ── */}
      {phase === 'requesting' && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[99999] bg-[#1E1E24]/95 text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <Loader2 className="w-5 h-5 text-[#4F46E5] animate-spin shrink-0" />
          <div className="text-sm font-semibold">
            Choose what to share in the browser popup...
          </div>
          <button
            type="button"
            onClick={cancelRecording}
            className="ml-3 text-xs text-white/60 hover:text-white underline cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── PHASE 2: COUNTDOWN SCREEN (3-2-1) ── */}
      {phase === 'countdown' && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-xs select-none">
          <div className="w-48 h-48 rounded-full bg-[#2F70F2] flex flex-col items-center justify-center text-white shadow-2xl animate-in zoom-in-75 duration-300 border-4 border-white/30">
            <span className="text-7xl font-extrabold tracking-tight">{countdown}</span>
            <button
              type="button"
              onClick={() => skipCountdown()}
              className="mt-1 text-sm font-bold text-white/90 hover:text-white hover:underline cursor-pointer tracking-wide"
            >
              Skip
            </button>
          </div>

          {/* Webcam bubble in bottom-left during countdown */}
          {cameraOn && (
            <div className="fixed bottom-8 left-8 z-[99999] w-36 h-36 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-950">
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

      {/* ── PHASE 3: RECORDING IN PROGRESS FLOATING DOCK & CONTROLS ── */}
      {phase === 'recording' && (
        <>
          {/* TOP EMERGENCY LIVE RECORDING BAR (Full-width, impossible to hide or miss on screen) */}
          <div className="fixed top-0 left-0 right-0 z-[999999] bg-[#1E1E24]/95 text-white backdrop-blur-xl border-b border-red-500/50 shadow-2xl px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between select-none font-sans flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-black tracking-widest text-red-400 uppercase">REC</span>
              <span className="text-sm font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-white min-w-[48px] text-center">
                {formatRecTime(timer)}
              </span>
              <span className="hidden md:inline text-xs text-white/70 font-medium">
                • Screen & Voice capture running (Safe to switch to any window)
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {hasPipSupport && (
                <button
                  type="button"
                  onClick={openPipController}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center gap-1 text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title="Float controller over any other application on your desktop"
                >
                  <ExternalLink size={13} />
                  <span className="hidden sm:inline">Float</span>
                </button>
              )}

              <button
                type="button"
                onClick={togglePause}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center gap-1 text-xs font-bold transition-all cursor-pointer shadow-xs"
                title={isPaused ? "Resume Recording" : "Pause Recording"}
              >
                {isPaused ? <Play size={13} fill="white" /> : <Pause size={13} fill="white" />}
                <span>{isPaused ? "Resume" : "Pause"}</span>
              </button>

              <button
                type="button"
                onClick={stopRecording}
                className="px-3 sm:px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 active:bg-red-700 text-white flex items-center gap-1.5 text-xs font-extrabold transition-all cursor-pointer shadow-[0_2px_12px_rgba(239,68,68,0.5)]"
                title="Finish & Save Recording"
              >
                <Square size={13} fill="white" />
                <span>Stop</span>
              </button>
            </div>
          </div>

          {/* PRIMARY: Floating Bottom Control Dock Bar (Centered, Ultra-Visible, z-[9999999]) */}
          <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-[9999999] pointer-events-auto bg-[#1E1E24]/95 backdrop-blur-xl border border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.7)] px-3 sm:px-5 py-2 sm:py-3 rounded-2xl flex items-center gap-2 sm:gap-4 text-white select-none max-w-[calc(100vw-16px)] overflow-x-auto custom-scrollbar">
            
            {/* Live recording indicator & Time */}
            <div className="flex items-center gap-2.5 pr-2 border-r border-white/15">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-bold tracking-wider text-red-400 uppercase">REC</span>
              <span className="text-sm font-mono font-bold text-white/90 min-w-[44px]">
                {formatRecTime(timer)}
              </span>
            </div>

            {/* Float on Desktop (Picture-in-Picture) Button */}
            {hasPipSupport && (
              <button
                type="button"
                onClick={openPipController}
                className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-white transition-all cursor-pointer active:scale-95"
                title="Float controller over other desktop windows"
              >
                <ExternalLink size={14} />
                <span className="hidden sm:inline text-[11px]">Float</span>
              </button>
            )}

            {/* Pause / Resume Button */}
            <button
              type="button"
              onClick={togglePause}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 flex items-center gap-2 text-xs font-bold transition-all cursor-pointer active:scale-95"
              title={isPaused ? "Resume Recording" : "Pause Recording"}
            >
              {isPaused ? <Play size={15} fill="white" /> : <Pause size={15} fill="white" />}
              <span>{isPaused ? "Resume" : "Pause"}</span>
            </button>

            {/* BIG RED STOP & FINISH BUTTON */}
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center gap-2 text-xs font-extrabold text-white transition-all shadow-[0_4px_16px_rgba(239,68,68,0.5)] transform hover:scale-105 active:scale-95 cursor-pointer tracking-wide"
              title="Finish and Save Recording"
            >
              <Square size={14} fill="white" />
              <span>Stop & Save</span>
            </button>

            {/* Restart Button */}
            <button
              type="button"
              onClick={() => {
                cancelRecording();
                setTimeout(() => startRecordingFlow(), 400);
              }}
              className="p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Restart Recording"
            >
              <RotateCcw size={16} />
            </button>

            {/* Discard / Trash Button */}
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2.5 rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
              title="Discard Recording"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* SECONDARY: Left-edge vertical pill bar for Loom-style muscle memory */}
          <div className="fixed left-5 top-1/2 -translate-y-1/2 z-[999999] bg-[#1E1E24]/95 backdrop-blur-xl text-white rounded-2xl p-2.5 flex flex-col items-center gap-3 shadow-2xl border border-white/15 select-none">
            {/* Red Stop Recording Button */}
            <button
              type="button"
              onClick={stopRecording}
              className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-transform active:scale-90 cursor-pointer shadow-lg"
              title="Stop & Save Recording"
            >
              <Square size={16} fill="white" />
            </button>

            {/* Timer Display */}
            <span className="text-[11px] font-mono font-bold text-white/90 px-1 py-0.5 rounded bg-white/10">
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

            {/* Discard / Trash Button */}
            <button
              type="button"
              onClick={cancelRecording}
              className="w-8 h-8 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors cursor-pointer"
              title="Delete / Cancel"
            >
              <Trash2 size={15} />
            </button>
          </div>

          {/* Circular webcam bubble in bottom-left corner */}
          {cameraOn && (
            <div className="fixed bottom-8 left-8 z-[99999] w-36 h-36 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-950">
              <video 
                ref={bottomPipCameraVideoRef} 
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div 
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] bg-[#F8FAFC]/50">
              <div className="flex items-center gap-2.5">
                <div className="bg-[#D5F5C6] text-[#2C7717] p-2 rounded-xl">
                  <Check size={18} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] text-base">Recording Completed</h3>
                  <p className="text-xs text-[#475569]">Ready to save and organize</p>
                </div>
              </div>
              <button 
                onClick={handleClose} 
                className="p-2 hover:bg-slate-200 rounded-xl text-[#475569] hover:text-[#0F172A] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Video preview playback */}
              {recordedVideoUrl && (
                <div className="w-full h-44 bg-slate-950 rounded-2xl overflow-hidden relative border border-[#E2E8F0] shadow-inner">
                  <video 
                    src={recordedVideoUrl} 
                    controls 
                    className="w-full h-full object-contain" 
                  />
                </div>
              )}

              {/* Error banner if upload encountered an issue */}
              {uploadError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-800 space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle size={15} className="shrink-0 text-amber-600" />
                    <span>Upload Notice:</span>
                  </div>
                  <p className="pl-6 text-[11px] leading-relaxed text-amber-700">
                    {uploadError}
                  </p>
                </div>
              )}

              {/* Video Title */}
              <div>
                <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider block mb-1.5">
                  Video Title
                </label>
                <input 
                  type="text" 
                  value={videoTitle} 
                  onChange={e => setVideoTitle(e.target.value)} 
                  placeholder="Enter video title..." 
                  className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:bg-white focus:border-[#2F70F2] focus:ring-1 focus:ring-[#2F70F2] outline-none transition-all font-medium"
                />
              </div>

              {/* Target Folder Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    Target Course / Drive Folder
                  </label>
                  <a
                    href={`https://drive.google.com/drive/folders/${selectedFolderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#2F70F2] hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <span>Open Drive Folder</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <div className="relative">
                  <select 
                    value={selectedFolderId} 
                    onChange={e => setSelectedFolderId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:bg-white focus:border-[#2F70F2] outline-none transition-all appearance-none cursor-pointer font-medium"
                  >
                    {folders.length === 0 ? (
                      <option value={selectedFolderId}>Loading folders...</option>
                    ) : (
                      folders.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))
                    )}
                  </select>
                  <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-3">
                {recordedVideoUrl && (
                  <a
                    href={recordedVideoUrl}
                    download={`${videoTitle || 'recording'}.webm`}
                    className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-[#0F172A] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Download locally"
                  >
                    <Download size={15} />
                    <span>Download</span>
                  </a>
                )}
                <div className="flex items-center gap-2.5 flex-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-3 px-3 bg-slate-100 hover:bg-slate-200 text-[#0F172A] rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveToDrive}
                    className="flex-[2] py-3 px-4 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                  >
                    <Folder size={15} />
                    <span>Save to Course Folder</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE 5: UPLOADING TO GOOGLE DRIVE OVERLAY ── */}
      {phase === 'uploading' && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] p-8 flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95">
            <Loader2 className="w-12 h-12 text-[#4F46E5] animate-spin" />
            <div className="text-lg font-bold text-[#0F172A]">Saving to Course Folder...</div>
            <div className="text-xs text-[#475569] text-center">
              Target folder: {folders.find(f => f.id === selectedFolderId)?.name || 'MEETING'}
            </div>
            {uploadProgress > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-2">
                <div 
                  className="bg-[#4F46E5] h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            <div className="text-xs font-mono font-bold text-[#475569]">
              {uploadProgress}%
            </div>
          </div>
        </div>
      )}
    </>
  );
}
