'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Video, 
  Monitor, 
  Camera, 
  Mic, 
  X, 
  ChevronDown, 
  Loader2, 
  Upload, 
  Folder, 
  Check, 
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
  // Modal flow states: 'configuring' | 'countdown' | 'recording' | 'saving' | 'uploading'
  const [phase, setPhase] = useState<'configuring' | 'countdown' | 'recording' | 'saving' | 'uploading'>('configuring');

  // Configuration options
  const [screenType, setScreenType] = useState<'Full Screen' | 'Window' | 'Current tab' | 'Camera only'>('Full Screen');
  const [showScreenOptions, setShowScreenOptions] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  // Dynamic device detection
  const [cameraDeviceName, setCameraDeviceName] = useState('HD Pro Webcam C920');
  const [micDeviceName, setMicDeviceName] = useState('Default - Microphone Array');

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
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Save / Upload settings
  const [videoTitle, setVideoTitle] = useState('');
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
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
        // Fallback to default labels
      }
    }
    detectDevices();

    // Fetch dynamic folders from Google Drive
    getCourses()
      .then(res => {
        setFolders(res);
        if (defaultFolderId) {
          setSelectedFolderId(defaultFolderId);
        }
      })
      .catch(() => {});
  }, [isOpen, defaultFolderId]);

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
      const combinedStream = new MediaStream();

      // 1. Screen capture (unless Camera only)
      if (screenType === 'Camera only') {
        const camConstraints: MediaStreamConstraints = {
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
          audio: micOn ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
        };
        camStream = await navigator.mediaDevices.getUserMedia(camConstraints);
        camStream.getTracks().forEach(t => combinedStream.addTrack(t));
        setCameraStream(camStream);
      } else {
        // Screen capture: Full Screen / Window / Current tab
        const surface = screenType === 'Window' ? 'window' : screenType === 'Current tab' ? 'browser' : 'monitor';
        
        try {
          dispStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: surface,
              frameRate: { ideal: 30, max: 60 },
            } as any,
            audio: true, // System / tab audio
          });
        } catch {
          // If displaySurface causes constraint error, fallback to standard displayMedia
          dispStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        }

        dispStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
        dispStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
        setDisplayStream(dispStream);

        // When user clicks "Stop sharing" from browser chrome banner
        dispStream.getVideoTracks()[0].onended = () => {
          stopRecording();
        };

        // Microphone audio track
        if (micOn) {
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
            micStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
          } catch {
            // Mic denied or unavailable
          }
        }

        // Camera feed for PIP bubble
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

      // Start countdown (3, 2, 1)
      setPhase('countdown');
      setCountdown(3);

      let currentCount = 3;
      const countInterval = setInterval(() => {
        currentCount -= 1;
        if (currentCount > 0) {
          setCountdown(currentCount);
        } else {
          clearInterval(countInterval);
          setPhase('recording');
          recorder.start(1000);

          setTimer(0);
          timerIntervalRef.current = setInterval(() => {
            setTimer(prev => prev + 1);
          }, 1000);
        }
      }, 1000);

    } catch (err: unknown) {
      console.error('Error starting recording:', err);
      showToast('Screen or media permissions required to record.');
      setPhase('configuring');
      cleanupStreams();
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

  // Handle local file selection replacement if user selects a pre-recorded video file
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

  // Handle saving to Google Drive
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
        selectedFolderId || null,
        (percent) => {
          setUploadProgress(percent);
        },
        finalTitle,
        {
          folderName: targetCourse?.name,
          isMeeting: selectedFolderId === 'MEETING',
        }
      );

      showToast('Video saved to Google Drive!');
      if (onRecordingComplete) {
        onRecordingComplete();
      }
      handleClose();
    } catch (err: unknown) {
      console.error('Failed to upload video to Drive:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Check Google Drive connection.');
      setPhase('saving');
    }
  };

  // Attach camera stream to PIP video element
  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
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

      {/* DIM OVERLAY */}
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 transition-opacity" 
        onClick={() => {
          if (phase === 'configuring' || phase === 'saving') handleClose();
        }}
      />

      {/* ── PHASE 1: RECORDING SETUP MODAL (EXACT VISUAL REPLICA) ── */}
      {phase === 'configuring' && (
        <div 
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] z-50 border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Blue top accent bar */}
          <div className="h-1 w-full bg-blue-600" />

          {/* Modal Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3 font-bold text-lg text-slate-900">
              <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg border border-blue-100">
                <Video size={16} />
              </div>
              <span>Recording Setup</span>
            </div>
            <button 
              onClick={handleClose} 
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-5">
            {/* Screen Selection */}
            <div className="relative">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                SCREEN
              </label>
              <button
                type="button"
                onClick={() => setShowScreenOptions(!showScreenOptions)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-sm text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Monitor size={18} className="text-blue-600" />
                  <span>{screenType}</span>
                </div>
                <ChevronDown size={16} className="text-slate-400" />
              </button>

              {showScreenOptions && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                  {(['Full Screen', 'Window', 'Current tab', 'Camera only'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setScreenType(opt);
                        setShowScreenOptions(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors text-slate-700"
                    >
                      <span>{opt}</span>
                      {screenType === opt && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Camera Toggle */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                CAMERA
              </label>
              <button
                type="button"
                onClick={() => setCameraOn(!cameraOn)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-sm text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3 truncate pr-2">
                  <Camera size={18} className={`${cameraOn ? 'text-blue-600' : 'text-slate-400'} shrink-0`} />
                  <span className="truncate">{cameraDeviceName}</span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${cameraOn ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${cameraOn ? 'left-6' : 'left-1'}`} />
                </div>
              </button>
            </div>

            {/* Microphone Toggle */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                MICROPHONE
              </label>
              <button
                type="button"
                onClick={() => setMicOn(!micOn)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-medium text-sm text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3 truncate pr-2">
                  <Mic size={18} className={`${micOn ? 'text-blue-600' : 'text-slate-400'} shrink-0`} />
                  <span className="truncate">{micDeviceName}</span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${micOn ? 'bg-blue-600' : 'bg-slate-300'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${micOn ? 'left-6' : 'left-1'}`} />
                </div>
              </button>
            </div>

            {/* File selection option */}
            <div className="pt-1 flex items-center justify-between text-xs text-slate-500">
              <span>Or choose existing video:</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline"
              >
                <Upload size={12} />
                Select File
              </button>
            </div>

            {/* Start Recording Button */}
            <button
              type="button"
              onClick={startRecordingFlow}
              className="w-full bg-[#FF5A26] hover:bg-[#E04B1D] text-white py-3.5 mt-2 rounded-xl font-bold transition-all shadow-[0_4px_14px_rgba(255,90,38,0.3)] hover:shadow-[0_6px_20px_rgba(255,90,38,0.4)] transform hover:-translate-y-0.5 active:scale-98 text-base cursor-pointer"
            >
              Start Recording
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE 2: COUNTDOWN OVERLAY ── */}
      {phase === 'countdown' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-[120px] font-black text-white drop-shadow-2xl animate-pulse">
            {countdown}
          </div>
        </div>
      )}

      {/* ── FLOATING CAMERA PIP BUBBLE (During recording/countdown) ── */}
      {(phase === 'recording' || phase === 'countdown') && cameraOn && cameraStream && screenType !== 'Camera only' && (
        <div className="fixed bottom-24 right-8 z-50 w-44 h-44 rounded-full overflow-hidden shadow-2xl border-4 border-white bg-black">
          <video 
            ref={cameraVideoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover scale-x-[-1]" 
          />
        </div>
      )}

      {/* ── PHASE 3: RECORDING HUD BAR ── */}
      {phase === 'recording' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white rounded-2xl shadow-2xl border border-slate-200 px-6 py-4 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
            <div className="w-3.5 h-3.5 bg-red-500 rounded-full animate-pulse" />
            <span className="font-mono font-bold text-slate-900 text-lg">
              {formatRecTime(timer)}
            </span>
          </div>

          <button
            type="button"
            onClick={togglePause}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-colors"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button
            type="button"
            onClick={stopRecording}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            Stop & Save
          </button>

          <button
            type="button"
            onClick={cancelRecording}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-semibold text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── PHASE 4: POST-RECORDING SAVE MODAL (Name & Drive Folder Selection) ── */}
      {phase === 'saving' && (
        <div 
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] max-w-[92vw] bg-white rounded-2xl shadow-2xl z-50 border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl">
                <Check size={18} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Recording Completed</h3>
                <p className="text-xs text-slate-500">Save your recording to Google Drive</p>
              </div>
            </div>
            <button 
              onClick={handleClose} 
              className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Video preview */}
            {recordedVideoUrl && (
              <div className="w-full h-40 bg-slate-950 rounded-xl overflow-hidden relative border border-slate-200">
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
                <AlertCircle size={16} className="shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Video File Name */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Video Title / File Name
              </label>
              <input 
                type="text" 
                value={videoTitle} 
                onChange={e => setVideoTitle(e.target.value)} 
                placeholder="Enter video title..." 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all"
              />
            </div>

            {/* Target Google Drive Folder */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Google Drive Destination Folder
              </label>
              <div className="relative">
                <select 
                  value={selectedFolderId} 
                  onChange={e => setSelectedFolderId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">GEONIXA LOOM (Root)</option>
                  <option value="MEETING">MEETING (Google Drive)</option>
                  {folders
                    .filter(f => f.id !== 'MEETING' && f.name !== 'MEETING')
                    .map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
                <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveToDrive}
                className="flex-[2] py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-98"
              >
                <Folder size={16} />
                Save to Google Drive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE 5: UPLOADING PROGRESS OVERLAY ── */}
      {phase === 'uploading' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 flex flex-col items-center gap-4 max-w-sm w-full animate-in zoom-in-95">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <div className="text-lg font-bold text-slate-900">Uploading to Google Drive...</div>
            <div className="text-xs text-slate-500 text-center">
              Saving to {folders.find(f => f.id === selectedFolderId)?.name || 'GEONIXA LOOM'} folder
            </div>
            {uploadProgress > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mt-2">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
