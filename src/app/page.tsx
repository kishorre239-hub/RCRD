"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Bell, Settings, Video, Folder, 
  Play, Share2, Users, Shield, Building,
  ChevronDown, Monitor, Camera, Mic, X,
  Square, Pause, RotateCcw, Trash2, Home, Sparkles, Loader2, Bookmark
} from "lucide-react";
import Image from "next/image";
import { uploadVideo } from "../lib/api";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export default function HomePage() {
  const router = useRouter();
  
  // App States
  const [recordingState, setRecordingState] = useState<'idle' | 'configuring' | 'countdown' | 'recording' | 'uploading'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  
  // Recording Settings
  const [screenType, setScreenType] = useState('Full Screen');
  const [showScreenOptions, setShowScreenOptions] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  // Recording References
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  // Timer
  const [timer, setTimer] = useState(0);

  // Handle Countdown & Recording Initialization
  useEffect(() => {
    let countdownTimer: NodeJS.Timeout;
    if (recordingState === 'countdown') {
      if (countdown > 0) {
        countdownTimer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      } else {
        countdownTimer = setTimeout(() => {
          setRecordingState('recording');
          setTimer(0);
          
          // Start actual recording
          if (stream) {
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];
            setIsPaused(false);
            
            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) {
                chunksRef.current.push(e.data);
              }
            };

            recorder.onstop = async () => {
              setRecordingState('uploading');
              const blob = new Blob(chunksRef.current, { type: 'video/webm' });
              
              const d = new Date();
              const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              const vidTitle = `Screen Recording · ${dateStr} (${timeStr})`;
              
              try {
                const uploadRes = await uploadVideo(blob, null, undefined, vidTitle);
                alert("Success! Video successfully recorded and saved directly to Google Drive.");
                if (uploadRes?.videoId) {
                  router.push(`/video/${uploadRes.videoId}`);
                }
              } catch (err) {
                console.error(err);
                alert("Error uploading video to Google Drive. Please retry.");
              }
              
              // Stop all tracks
              stream.getTracks().forEach(track => track.stop());
              if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
              }
              setStream(null);
              setCameraStream(null);
              setRecordingState('idle');
            };

            recorder.start(1000); // capture in 1s chunks
          }
        }, 0);
      }
    }
    return () => clearTimeout(countdownTimer);
  }, [recordingState, countdown, stream, cameraStream, router]);

  // Handle Timer during recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === 'recording' && !isPaused) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState, isPaused]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  
  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !micOn; // toggle
      });
      setMicOn(!micOn);
    }
  };

  const toggleCamera = async () => {
    if (cameraOn && cameraStream) {
      // Turn off
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setCameraOn(false);
    } else {
      // Turn on
      try {
        const newCameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(newCameraStream);
        setCameraOn(true);
      } catch (err) {
        console.warn("Camera access denied or unavailable", err);
      }
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSeenTour = localStorage.getItem("hasSeenTour");
      if (!hasSeenTour) {
        const driverObj = driver({
          showProgress: true,
          steps: [
            { element: '#tour-sidebar-home', popover: { title: 'Dashboard', description: 'This is your main dashboard where you can start a recording instantly.' } },
            { element: '#tour-sidebar-library', popover: { title: 'My Library', description: 'Access all your past recorded videos, folders, and shared content.' } },
            { element: '#tour-sidebar-meetings', popover: { title: 'Meetings', description: 'Schedule or join live meetings and access past meeting recordings.' } },
            { element: '#tour-sidebar-settings', popover: { title: 'Settings', description: 'Manage your profile, team settings, and recording preferences.' } },
            { element: '#tour-record-btn', popover: { title: 'Record Video', description: 'Click here anytime to start a new screen or camera recording.' } },
          ],
          onDestroyStarted: () => {
            if (!driverObj.hasNextStep() || confirm("Are you sure you want to skip the tutorial?")) {
              localStorage.setItem("hasSeenTour", "true");
              driverObj.destroy();
            }
          },
        });
        driverObj.drive();
      }
    }
  }, []);

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, cameraOn, recordingState]);
  
  const startRecordingFlow = async () => {
    try {
      // Prompt user for screen sharing
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false // Getting audio separately for noise cancellation
      });
      
      // Get High Quality Microphone Audio with Noise Cancellation
      if (micOn) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              noiseSuppression: true,
              echoCancellation: true,
              autoGainControl: true
            }
          });
          // Add the clear audio track to the display stream
          audioStream.getAudioTracks().forEach(track => {
            displayStream.addTrack(track);
          });
        } catch (audioErr) {
          console.warn("Microphone access denied or unavailable", audioErr);
        }
      }

      // Get Camera if turned on
      if (cameraOn) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setCameraStream(camStream);
        } catch (camErr) {
          console.warn("Camera access denied or unavailable", camErr);
        }
      }

      setStream(displayStream);
      
      setRecordingState('countdown');
      setCountdown(3);
      
      // Handle user stopping screen share from browser controls
      displayStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };
      
    } catch (err) {
      console.error("Error accessing display media", err);
      alert("You need to grant screen recording permissions to proceed.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      // If it wasn't recording yet but they cancel
      setRecordingState('idle');
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        setCameraStream(null);
      }
    }
  };

  const togglePause = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null; // Prevent upload
      mediaRecorderRef.current.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setRecordingState('idle');
    setIsPaused(false);
    setTimer(0);
  };

  const restartRecording = () => {
    cancelRecording();
    setTimeout(() => {
      startRecordingFlow();
    }, 500);
  };

  return (
    <div className="relative flex h-full w-full bg-[#FAFAFA] text-slate-800 font-outfit overflow-hidden selection:bg-[#0E71EB]/20">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none"></div>

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
                <span className="text-[10px] uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded text-blue-700 font-bold border border-blue-200">Pro Plan</span>
                <span className="text-xs text-slate-500">Team Space</span>
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
            <div id="tour-sidebar-home"><SidebarItem icon={<Home size={18} />} label="For You" active href="/" /></div>
            <div id="tour-sidebar-library"><SidebarItem icon={<Folder size={18} />} label="Library" href="/library" /></div>
            <div id="tour-sidebar-meetings"><SidebarItem icon={<Video size={18} />} label="Meetings" href="/meetings" /></div>
            <SidebarItem icon={<Bookmark size={18} />} label="Watch Later" href="/watch-later" />
            <div id="tour-sidebar-settings"><SidebarItem icon={<Settings size={18} />} label="Settings" href="/settings" /></div>
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
            id="tour-record-btn"
            onClick={() => router.push('/record')}
            className="w-full bg-[#1A68FF] hover:bg-[#1557D6] text-white py-3.5 px-6 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 shadow-[0_10px_25px_-5px_rgba(26,104,255,0.45)] hover:shadow-[0_14px_28px_-5px_rgba(26,104,255,0.55)] transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <Video size={20} className="stroke-[2.2]" />
            <span>Record Video</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative z-10 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-white/80  border-b border-slate-200 shrink-0 z-20 shadow-sm">
          <div className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search for videos, folders, tags, or people..." 
              className="w-full pl-11 pr-4 py-2 bg-slate-100 border border-transparent rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-5 ml-4 shrink-0">
            <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-2">
              <Sparkles size={14} className="text-yellow-500" /> Upgrade
            </button>
            <button className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-bold cursor-pointer shadow-md hover:scale-105 transition-transform border border-blue-500">
              HR
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center pt-24 px-8 relative custom-scrollbar min-h-0">
          
          {/* Animated Clean Orb / Camera Graphic */}
          <div className="relative mb-10 w-48 h-48 flex items-center justify-center group cursor-pointer" onClick={() => router.push('/record')}>
            {/* Background Image instead of glowing circle */}
            <div className="absolute inset-0 flex items-center justify-center blur-md opacity-50 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700">
              <Image src="/ICONS/WhatsApp_Image_2026-09-25_at_11.50.51_AM-removebg-preview.png" width={160} height={160} className="w-full h-full object-contain" alt="" />
            </div>
            
            <Image 
              src="/ICONS/WhatsApp_Image_2026-09-25_at_11.50.51_AM-removebg-preview.png" 
              alt="icon" 
              width={160}
              height={160}
              className="relative z-10 w-40 h-40 object-contain animate-float group-hover:scale-110 transition-transform duration-500" 
            />
            
            {/* Floating particles */}
            <div className="absolute top-2 right-2 w-3 h-3 bg-blue-400 rounded-full opacity-60 animate-bounce delay-75"></div>
            <div className="absolute bottom-4 left-0 w-2 h-2 bg-blue-400 rounded-full opacity-60 animate-bounce delay-300"></div>
          </div>

          <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight text-center">
            Capture Your Screen in Seconds
          </h1>
          <p className="text-slate-500 mb-12 max-w-md text-center text-lg leading-relaxed">
            Record, share, and collaborate with async video messages that bring your team closer together.
          </p>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setRecordingState('configuring')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all shadow-[0_8px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_12px_25px_rgba(37,99,235,0.35)] transform hover:-translate-y-1"
            >
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Video size={18} className="fill-white" />
              </div>
              Start Recording
            </button>
          </div>

        </div>

        {/* DIM OVERLAY */}
        {recordingState !== 'idle' && (
          <div className="absolute inset-0 bg-slate-900/40  z-30 transition-all duration-500"></div>
        )}

        {/* RECORDING SETTINGS POPUP - Clean Light Mode */}
        {recordingState === 'configuring' && (
          <div className="absolute top-24 right-10 w-[340px] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] z-40 border border-slate-200 animate-in fade-in slide-in-from-top-10 zoom-in-95 duration-300 overflow-hidden">
            
            {/* Top accent line */}
            <div className="h-1 w-full bg-blue-600"></div>

            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3 font-bold text-lg text-slate-900">
                <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg border border-blue-100">
                  <Video size={16} />
                </div>
                Recording Setup
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setRecordingState('idle')}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                ><X size={18} /></button>
              </div>
            </div>

            <div className="p-5 space-y-5 relative">
              
              {/* Screen Select */}
              <div className="relative">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Screen</label>
                <button 
                  onClick={() => setShowScreenOptions(!showScreenOptions)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors rounded-xl font-medium text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20"
                >
                  <div className="flex items-center gap-3">
                    <Monitor size={18} className="text-blue-600" />
                    {screenType}
                  </div>
                  <ChevronDown size={16} className="text-slate-400" />
                </button>
                
                {/* Dropdown Options */}
                {showScreenOptions && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    {['Full Screen', 'Window', 'Current tab', 'Camera only'].map((opt) => (
                      <button 
                        key={opt}
                        onClick={() => { setScreenType(opt); setShowScreenOptions(false); }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors text-slate-700"
                      >
                        {opt}
                        {screenType === opt && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Camera Select */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Camera</label>
                <button 
                  onClick={() => setCameraOn(!cameraOn)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors rounded-xl font-medium text-sm text-slate-700 group"
                >
                  <div className="flex items-center gap-3 truncate pr-2">
                    <Camera size={18} className={`${cameraOn ? 'text-blue-600' : 'text-slate-400'} shrink-0 transition-colors`} />
                    <span className="truncate">HD Pro Webcam C920</span>
                  </div>
                  {/* Toggle Switch UI */}
                  <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${cameraOn ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${cameraOn ? 'left-6' : 'left-1'}`}></div>
                  </div>
                </button>
              </div>

              {/* Mic Select */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Microphone</label>
                <button 
                  onClick={() => setMicOn(!micOn)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors rounded-xl font-medium text-sm text-slate-700 group"
                >
                  <div className="flex items-center gap-3 truncate pr-2">
                    <Mic size={18} className={`${micOn ? 'text-blue-600' : 'text-slate-400'} shrink-0 transition-colors`} />
                    <span className="truncate">Default - Microphone Array</span>
                  </div>
                  {/* Toggle Switch UI */}
                  <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${micOn ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${micOn ? 'left-6' : 'left-1'}`}></div>
                  </div>
                </button>
              </div>

              {/* Start Button */}
              <button 
                onClick={startRecordingFlow}
                className="w-full bg-[#FF5A26] hover:bg-[#E04B1D] text-white py-3.5 mt-2 rounded-xl font-bold transition-all shadow-[0_4px_14px_rgba(255,90,38,0.3)] hover:shadow-[0_6px_20px_rgba(255,90,38,0.4)] transform hover:-translate-y-0.5 text-base"
              >
                Start Recording
              </button>
            </div>
          </div>
        )}

        {/* COUNTDOWN OVERLAY */}
        {recordingState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center z-50">
            <div className="w-56 h-56 relative flex items-center justify-center animate-in zoom-in-50 duration-500">
              {/* Outer pulsing rings */}
              <div className="absolute inset-0 border-2 border-blue-400/30 rounded-full animate-ping"></div>
              
              {/* Main circle */}
              <div className="w-40 h-40 bg-blue-600 border-4 border-white/20 rounded-full flex flex-col items-center justify-center text-white shadow-2xl z-10">
                <span className="text-7xl font-black leading-none mb-1 text-white">{countdown}</span>
              </div>
            </div>
          </div>
        )}

        {/* UPLOADING OVERLAY */}
        {recordingState === 'uploading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-white/50 ">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center border border-slate-100">
              <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
              <h2 className="text-xl font-bold text-slate-800">Saving to Google Drive...</h2>
              <p className="text-slate-500 text-sm mt-2">Please wait while we upload your recording securely.</p>
            </div>
          </div>
        )}

        {/* FLOATING RECORDING CONTROLS */}
        {(recordingState === 'countdown' || recordingState === 'recording') && (
          <>
            {/* Floating Action Bar */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 w-14 bg-white border border-slate-200 rounded-full flex flex-col items-center py-5 gap-5 z-40 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] animate-in slide-in-from-left-10 duration-500">
              
              {/* Stop Button */}
              <button 
                onClick={stopRecording}
                className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white rounded-full transition-all group relative shadow-sm hover:shadow-md"
              >
                <Square size={16} className="fill-current" />
                <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all shadow-xl translate-x-2 group-hover:translate-x-0">Stop Recording</span>
              </button>
              
              <div className="w-8 h-px bg-slate-200"></div>
              
              {/* Pause Button */}
              <button 
                onClick={togglePause}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-all group relative"
              >
                {isPaused ? <Play size={18} className="text-blue-600 fill-current" /> : <Pause size={18} />}
                <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all shadow-xl translate-x-2 group-hover:translate-x-0">{isPaused ? "Resume" : "Pause"}</span>
              </button>
              
              {/* Camera Toggle Button */}
              <button 
                onClick={toggleCamera}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-all group relative"
              >
                <Camera size={16} className={cameraOn ? 'text-blue-600' : 'text-slate-400 line-through'} />
                <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all shadow-xl translate-x-2 group-hover:translate-x-0">{cameraOn ? "Turn Camera Off" : "Turn Camera On"}</span>
              </button>

              {/* Mic Toggle Button */}
              <button 
                onClick={toggleMute}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-all group relative"
              >
                <Mic size={16} className={micOn ? 'text-blue-600' : 'text-slate-400 line-through'} />
                <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all shadow-xl translate-x-2 group-hover:translate-x-0">{micOn ? "Mute" : "Unmute"}</span>
              </button>

              {/* Restart Button */}
              <button 
                onClick={restartRecording}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full transition-all group relative"
              >
                <RotateCcw size={16} />
                <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all shadow-xl translate-x-2 group-hover:translate-x-0">Restart</span>
              </button>
              
              {/* Cancel/Delete Button */}
              <button 
                onClick={cancelRecording}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-full transition-all group relative"
              >
                <Trash2 size={16} />
                <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all shadow-xl translate-x-2 group-hover:translate-x-0">Cancel</span>
              </button>
            </div>

            {/* Camera Bubble (Bottom Left) */}
            {cameraOn && (
              <div className="absolute left-8 bottom-8 w-40 h-40 bg-slate-900 rounded-full border-4 border-white shadow-[0_15px_35px_-5px_rgba(0,0,0,0.2)] overflow-hidden z-40 animate-in slide-in-from-bottom-10 duration-700 flex items-center justify-center group cursor-move">
                {cameraStream ? (
                  <video 
                    ref={cameraVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover -scale-x-100"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800"></div>
                    <div className="w-14 h-14 bg-white/20 rounded-full flex flex-col items-center justify-center pt-2 relative z-10 ">
                      <div className="w-5 h-5 bg-white/90 rounded-full mb-1.5"></div>
                      <div className="w-8 h-4 bg-white/90 rounded-t-xl"></div>
                    </div>
                  </>
                )}
                
                {/* Recording indicator & timer */}
                {recordingState === 'recording' && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60  px-3 py-1 rounded-full flex items-center gap-2 border border-white/20">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,1)]"></div>
                    <span className="text-white text-xs font-bold font-mono tracking-wider">{formatTime(timer)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

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


/* 
<div className="fixed bottom-4 right-4 flex gap-4 bg-white p-4 shadow-xl rounded-xl z-50">
  <Link href="/signup" className="font-bold text-blue-600 hover:underline">Signup UI</Link>
  <Link href="/id-cards" className="font-bold text-blue-600 hover:underline">ID Cards UI</Link>
</div>
*/
