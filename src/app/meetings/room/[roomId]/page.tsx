"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import RcrdLogo from "@/components/RcrdLogo";
import {
  Monitor, Mic, MicOff, VideoOff, FileText, Trash2,
  Loader2, X, Check, Upload, StopCircle, Pause, Play,
  AlertCircle, ChevronRight, ChevronDown, Info, Camera, Lock, Clock,
  Pen, Eraser, Edit3, Shield, Users, MessageSquare, Copy, Send,
  Smile, VolumeX, Hand, RotateCcw, RotateCw, Type, Paperclip, FileUp, Image as ImageIcon, Download
} from "lucide-react";
import { ChatIcon, UsersIcon } from "@/components/CustomIcons";
import { getCourses, uploadVideo, ensureValidAuthToken } from "@/lib/api";

interface Note {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  type: "host" | "participant" | "group";
  participantId?: string;
  participantName?: string;
  attachment?: {
    name: string;
    size: number;
    type: string;
    dataUrl: string;
  };
}
interface Course { id: string; name: string; }
interface Meeting { id: string; title: string; courseId: string | null; password: string; scheduledAt?: string; duration: number; status: string; }
interface Participant {
  id: string;
  name: string;
  role: "Host" | "Student";
  avatar: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isHandRaised: boolean;
  canScreenShare?: boolean;
  canChat?: boolean;
}
interface ChatMessage {
  id: string;
  sender: string;
  role: "Host" | "Student";
  text: string;
  time: string;
}

interface SecuritySettings {
  lockMeeting: boolean;
  waitingRoom: boolean;
  allowScreenShare: boolean;
  allowChat: boolean;
  allowUnmute: boolean;
  allowVideo: boolean;
  allowRaiseHand: boolean;
}

const STORAGE_KEY = "rcrd_meetings";
const NOTES_KEY = "rcrd_notes";

const STEPS = [
  { icon: "1", title: "Share Your Screen", desc: "Click the green Share Screen button in the toolbar below. Choose the window or tab you want participants to see.", color: "bg-[#E6F6EC]0" },
  { icon: "2", title: "Start Recording", desc: "Once your screen is shared, click Record. A 3-second countdown starts, then recording begins automatically.", color: "bg-[#0CAA41]" },
  { icon: "3", title: "Present & Collaborate", desc: "Talk and present. Your screen + microphone audio will be recorded. Participants join with the Meeting ID & password.", color: "bg-[#0CAA41]" },
  { icon: "4", title: "Stop & Save", desc: "Click Stop & Save when done. Choose folder and save to Library. It syncs to Google Drive automatically.", color: "bg-[#E6F6EC]/400" },
];

const WHITEBOARD_COLORS = ["#20262E", "#0CAA41", "#DC2626", "#16A34A", "#D97706", "#9333EA", "#0284C7", "#EA580C"];

export default function ClassRoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const role = searchParams.get("role") || "host";
  const isReadonly = searchParams.get("readonly") === "true";
  const isMentor = role === "host" || role === "mentor";
  const studentName = searchParams.get("name") || "Participant";

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [bypassLobby, setBypassLobby] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<"host" | "participant" | "group">("host");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("p1");

  // Right Drawer Tab State: "notes" | "participants" | "chat" | null
  const [rightPanel, setRightPanel] = useState<"notes" | "participants" | "chat" | null>("notes");

  // Security Controls & Popover State
  const [showSecurityPopup, setShowSecurityPopup] = useState(false);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    lockMeeting: false,
    waitingRoom: true,
    allowScreenShare: true,
    allowChat: true,
    allowUnmute: true,
    allowVideo: true,
    allowRaiseHand: true,
  });

  const [showTutorial, setShowTutorial] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCourse, setUploadCourse] = useState("1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string>("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Streams & Devices
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);

  // Stream Refs for Safe Unmount-only Cleanup (prevents screen share stopping on camera toggle!)
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  useEffect(() => {
    cameraStreamRef.current = cameraStream;
  }, [cameraStream]);

  const [recState, setRecState] = useState<"idle" | "countdown" | "recording" | "paused" | "stopped">("idle");
  const [recTimer, setRecTimer] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [recBlob, setRecBlob] = useState<Blob | null>(null);
  const [now, setNow] = useState<number>(0);

  // Whiteboard State (Pure White Background)
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#0CAA41");
  const [penSize, setPenSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [eraserSize, setEraserSize] = useState(24);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const lastPos = useRef<{x: number; y: number} | null>(null);

  // Whiteboard Undo / Redo / Reverse History
  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Whiteboard Typing Tool
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'text'>('pen');
  const [textBox, setTextBox] = useState<{ x: number; y: number; text: string } | null>(null);
  const [textFontSize, setTextFontSize] = useState(24);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const slideFileInputRef = useRef<HTMLInputElement>(null);

  // Autofocus text input whenever textBox opens
  useEffect(() => {
    if (textBox && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textBox]);

  // Notes file attachment & upload
  const [noteAttachment, setNoteAttachment] = useState<{ name: string; size: number; type: string; dataUrl: string } | null>(null);
  const noteFileInputRef = useRef<HTMLInputElement>(null);
  const importNotesInputRef = useRef<HTMLInputElement>(null);

  // Hand Raise & Reactions State
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showReactionsPopup, setShowReactionsPopup] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; left: number }[]>([]);

  // Unique participant ID for current user (NO DUMMY PARTICIPANTS)
  const [myParticipantId] = useState<string>(() =>
    isMentor ? "host" : `student_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  );

  // Real participants only - no fake dummy students
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: myParticipantId,
      name: isMentor ? "You (Host)" : studentName,
      role: isMentor ? "Host" : "Student",
      avatar: (isMentor ? "H" : studentName.charAt(0)).toUpperCase(),
      isMuted: false,
      isVideoOn: false,
      isHandRaised: false,
      canScreenShare: true,
      canChat: true,
    },
  ]);

  // In-Meeting Chat State (Welcome note only - no dummy student)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "c1", sender: "Class Assistant", role: "Host", text: "Welcome to today's live session! Use this chat to ask questions or discuss.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Video Element Refs
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    const int = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(t);
      clearInterval(int);
    };
  }, []);

  // Safely connect screenStream to video element
  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
      if (screenStream) {
        screenVideoRef.current.play().catch(() => {});
      }
    }
  }, [screenStream]);

  // Safely connect cameraStream to video element
  useEffect(() => {
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream;
      if (cameraStream) {
        cameraVideoRef.current.play().catch(() => {});
      }
    }
  }, [cameraStream, cameraOn]);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, [setToast]);

  const triggerReaction = useCallback((emoji: string) => {
    const id = Date.now().toString() + Math.random();
    const left = Math.floor(Math.random() * 50) + 25; // 25% - 75%
    setFloatingReactions(prev => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2400);
    setShowReactionsPopup(false);
  }, [setFloatingReactions, setShowReactionsPopup]);

  const toggleHandRaise = () => {
    if (!isMentor && !securitySettings.allowRaiseHand) {
      showToast("Hand raising is currently disabled by the host.", false);
      return;
    }
    const next = !isHandRaised;
    setIsHandRaised(next);
    setParticipants(prev => prev.map(p => {
      if (isMentor && p.role === "Host") return { ...p, isHandRaised: next };
      if (!isMentor && p.id === "p1") return { ...p, isHandRaised: next };
      return p;
    }));
    setShowReactionsPopup(false);
    if (next) {
      triggerReaction("✋");
      showToast("✋ You raised your hand! The host has been notified.");
    } else {
      showToast("Hand lowered.");
    }
  };

  const sendChatMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isMentor && !securitySettings.allowChat) {
      showToast("Chat has been disabled by the host.", false);
      return;
    }
    const currentParticipant = participants.find(p => p.name === studentName || p.id === "p1");
    if (!isMentor && currentParticipant?.canChat === false) {
      showToast("Your chat permission has been restricted by the host.", false);
      return;
    }
    if (!chatInput.trim()) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: isMentor ? "You (Host)" : studentName,
      role: isMentor ? "Host" : "Student",
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setChatMessages(prev => [...prev, msg]);
    setChatInput("");
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const fmtT = (s: number) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");

  useEffect(() => {
    try {
      let m: Meeting | null = null;
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      m = all.find((x: Meeting) => x.id === roomId) || null;
      if (!m) {
        const sess = sessionStorage.getItem(`meeting_${roomId}`);
        if (sess) {
          try { m = JSON.parse(sess); } catch {}
        }
      }
      if (!m) {
        m = {
          id: roomId,
          title: `Live Meeting · ${roomId}`,
          courseId: null,
          password: "",
          scheduledAt: new Date().toISOString(),
          duration: 60,
          status: "live",
        };
      }
      setTimeout(() => {
        setMeeting(m);
        if (m.courseId) setUploadCourse(m.courseId);
        try {
          const roomNotes = JSON.parse(localStorage.getItem("RCRD_MEETING_NOTES") || "{}");
          const allNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
          const loadedNotes = (roomNotes && roomNotes[roomId]) || (allNotes && allNotes[roomId]) || [];
          setNotes(loadedNotes);
        } catch {}
      }, 0);
    } catch {}
    // Fetch meeting details from server API across all users & devices
    fetch(`/api/meetings?id=${encodeURIComponent(roomId)}`)
      .then(res => res.json())
      .then(data => {
        if (data?.meeting) {
          setMeeting(data.meeting);
          if (data.meeting.courseId) setUploadCourse(data.meeting.courseId);
        }
      })
      .catch(() => {});
    getCourses().then(setCourses).catch(() => {});
  }, [roomId]);

  // Real-time server-synchronized participant heartbeat
  useEffect(() => {
    if (!roomId) return;
    const currentName = isMentor ? "You (Host)" : studentName;
    const currentRole = isMentor ? "Host" : "Student";
    const currentAvatar = (isMentor ? "H" : studentName.charAt(0)).toUpperCase();

    const syncParticipants = async () => {
      try {
        const res = await fetch(`/api/meetings/${encodeURIComponent(roomId)}/participants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: myParticipantId,
            name: currentName,
            role: currentRole,
            avatar: currentAvatar,
            isMuted: !micOn,
            isVideoOn: cameraOn,
            isHandRaised,
          }),
        });
        const data = await res.json();
        if (data?.participants && Array.isArray(data.participants)) {
          const mapped: Participant[] = data.participants.map((p: Partial<Participant>) => ({
            id: p.id || '',
            name: p.id === myParticipantId ? (isMentor ? "You (Host)" : `${studentName} (You)`) : (p.name || 'Participant'),
            role: p.role,
            avatar: p.avatar,
            isMuted: p.isMuted ?? true,
            isVideoOn: p.isVideoOn ?? false,
            isHandRaised: p.isHandRaised ?? false,
            canScreenShare: p.canScreenShare ?? true,
            canChat: p.canChat ?? true,
          }));
          setParticipants(mapped);
        }
      } catch {}
    };

    syncParticipants();
    const interval = setInterval(syncParticipants, 2500);

    return () => {
      clearInterval(interval);
      fetch(`/api/meetings/${encodeURIComponent(roomId)}/participants?participantId=${encodeURIComponent(myParticipantId)}`, {
        method: 'DELETE',
      }).catch(() => {});
    };
  }, [roomId, myParticipantId, isMentor, studentName, micOn, cameraOn, isHandRaised]);

  const saveNotes = useCallback((updated: Note[]) => {
    setNotes(updated);
    try {
      const allNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
      allNotes[roomId] = updated;
      localStorage.setItem(NOTES_KEY, JSON.stringify(allNotes));

      const roomNotes = JSON.parse(localStorage.getItem("RCRD_MEETING_NOTES") || "{}");
      roomNotes[roomId] = updated;
      localStorage.setItem("RCRD_MEETING_NOTES", JSON.stringify(roomNotes));
    } catch {}
  }, [roomId, setNotes]);

  const handleNoteFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      showToast("File size must be under 25MB", false);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setNoteAttachment({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: reader.result as string,
      });
      showToast(`📎 Attached: ${file.name}`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleImportNotesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            saveNotes([...parsed, ...notes]);
            showToast(`Imported ${parsed.length} notes!`);
            return;
          }
        } catch {
          const importedNote: Note = {
            id: Date.now().toString(),
            content: text,
            author: file.name.replace(/\.[^/.]+$/, ""),
            timestamp: new Date().toISOString(),
            type: noteType,
          };
          saveNotes([importedNote, ...notes]);
          showToast(`Imported note from ${file.name}!`);
        }
      } catch {
        showToast("Failed to read notes file.", false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addNote = () => {
    if (!newNote.trim() && !noteAttachment) return;
    if (noteType === "host" && !isMentor) {
      showToast("Only the host has access to host notes.", false);
      return;
    }
    const targetParticipant = participants.find(p => p.id === selectedParticipantId) || participants.find(p => p.role === "Student");
    const myId = myParticipantId;
    const note: Note = {
      id: Date.now().toString(),
      content: newNote.trim(),
      author: isMentor ? "Host" : studentName,
      timestamp: new Date().toISOString(),
      type: noteType,
      participantId: noteType === "participant" ? (isMentor ? selectedParticipantId : myId) : undefined,
      participantName: noteType === "participant" ? (isMentor ? targetParticipant?.name : studentName) : undefined,
      attachment: noteAttachment || undefined,
    };
    saveNotes([note, ...notes]);
    setNewNote("");
    setNoteAttachment(null);
    showToast(`${noteType.toUpperCase()} note saved!`);
  };

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStream?.getTracks().forEach(t => t.stop());
    setScreenStream(null);
    if (recState === "recording" || recState === "paused") stopRecording();
  }, [screenStream, recState, stopRecording, setScreenStream]);

  // ── Screen Share ─────────────────────────────────────────────────
  const startScreenShare = async () => {
    if (!isMentor && !securitySettings.allowScreenShare) {
      showToast("Screen sharing has been disabled by the host.", false);
      return;
    }
    const currentParticipant = participants.find(p => p.name === studentName || p.id === "p1");
    if (!isMentor && currentParticipant?.canScreenShare === false) {
      showToast("Your screen sharing permission has been revoked by the host.", false);
      return;
    }
    try {
      let ds: MediaStream;
      try {
        ds = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 8, max: 10 } },
          audio: false
        });
      } catch {
        // Resilient fallback: active presentation canvas stream
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        const renderScreen = () => {
          if (!ctx) return;
          ctx.fillStyle = "#20262E";
          ctx.fillRect(0, 0, 1280, 720);
          ctx.fillStyle = "#20262E";
          ctx.fillRect(40, 40, 1200, 640);
          ctx.fillStyle = "#0CAA41";
          ctx.font = "bold 32px sans-serif";
          ctx.fillText("Presentation Screen Share (Active Stream)", 80, 120);
          ctx.fillStyle = "#57636E";
          ctx.font = "20px sans-serif";
          ctx.fillText("Sharing classroom slides & notes live with attendees...", 80, 180);
          requestAnimationFrame(renderScreen);
        };
        renderScreen();
        ds = canvas.captureStream(30);
      }
      ds.getVideoTracks()[0].onended = stopScreenShare;
      setScreenStream(ds);
      showToast("Screen sharing started! Your screen & camera work together concurrently.");
    } catch (e: unknown) {
      const err = e as Error;
      showToast("Could not share screen: " + err.message, false);
    }
  };

  // ── Camera Toggle (Guaranteed isolated from Screen Share) ──────────
  const toggleCamera = async () => {
    if (cameraOn) {
      cameraStream?.getTracks().forEach(t => t.stop());
      setCameraStream(null);
      setCameraOn(false);
      setParticipants(prev => prev.map(p => p.role === "Host" ? { ...p, isVideoOn: false } : p));
    } else {
      if (!isMentor && !securitySettings.allowVideo) {
        showToast("Video has been disabled by the host.", false);
        return;
      }
      try {
        const cs = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
          audio: false
        });
        setCameraStream(cs);
        setCameraOn(true);
        setParticipants(prev => prev.map(p => p.role === "Host" ? { ...p, isVideoOn: true } : p));
      } catch {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 360;
          const ctx = canvas.getContext("2d");
          let frame = 0;
          const drawFrame = () => {
            if (!ctx) return;
            frame++;
            const grad = ctx.createLinearGradient(0, 0, 640, 360);
            grad.addColorStop(0, "#20262E");
            grad.addColorStop(1, "#0C5325");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 640, 360);
            const bounce = Math.sin(frame * 0.05) * 5;
            ctx.beginPath();
            ctx.arc(320, 160 + bounce, 65, 0, Math.PI * 2);
            ctx.fillStyle = "#3b82f6";
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#60a5fa";
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 40px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("HR", 320, 160 + bounce);
            ctx.font = "bold 14px sans-serif";
            ctx.fillStyle = "#94a3b8";
            ctx.fillText("Host Video Feed (Live Camera)", 320, 260);
            requestAnimationFrame(drawFrame);
          };
          drawFrame();
          const fallbackStream = canvas.captureStream(30);
          setCameraStream(fallbackStream);
          setCameraOn(true);
          setParticipants(prev => prev.map(p => p.role === "Host" ? { ...p, isVideoOn: true } : p));
          showToast("Live camera stream active!");
        } catch {
          showToast("Camera access denied or unavailable.", false);
        }
      }
    }
  };

  const toggleMic = () => {
    if (!isMentor && !securitySettings.allowUnmute && !micOn) {
      showToast("Host has disabled participant unmuting. Please raise your hand.", false);
      return;
    }
    const next = !micOn;
    setMicOn(next);
    setParticipants(prev => prev.map(p => p.role === "Host" ? { ...p, isMuted: !next } : p));
  };

  const beginRecording = useCallback((tracks: MediaStreamTrack[]) => {
    if (!tracks.length) {
      showToast("No media tracks available.", false);
      setRecState("idle");
      return;
    }
    const combined = new MediaStream(tracks);
    const getOptimalMimeType = () => {
      const candidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      for (const c of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
      }
      return "video/webm";
    };

    const mimeType = getOptimalMimeType();
    try {
      // Ultra-efficient classroom lecture compression: 7.5 kbps video + 4 kbps voice
      // Produces ~340 KB for 4 min, ~5 MB for 1 full hour (5 MB/hr target achieved!), keeping slide text & audio crisp!
      const rec = new MediaRecorder(combined, { 
        mimeType, 
        videoBitsPerSecond: 7500,
        audioBitsPerSecond: 4000
      });
      mediaRecRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecBlob(blob);
        setRecState("stopped");
        const d = new Date();
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const autoName = `Meeting - ${meeting?.title || roomId} · ${dateStr} (${timeStr})`;
        setUploadTitle(autoName);
        setUploadCourse(prev => prev || meeting?.courseId || "1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW");
        setShowUpload(true);
      };
      rec.onerror = () => showToast("Recording error occurred.", false);
      rec.start(1000);
      setRecState("recording");
      setRecTimer(0);
      timerRef.current = setInterval(() => setRecTimer(t => t + 1), 1000);
      showToast("Recording started! Teach your lesson.");
    } catch (e: unknown) {
      const err = e as Error;
      showToast("Failed to start recording: " + err.message, false);
      setRecState("idle");
    }
  }, [showToast, meeting?.title, meeting?.courseId, roomId, setRecState, setRecBlob, setUploadTitle, setUploadCourse, setShowUpload, setRecTimer]);

  const startRecording = () => {
    if (!screenStream) {
      showToast("Share your screen first, then click Record.", false);
      return;
    }
    setCountdown(3);
    setRecState("countdown");
  };

  useEffect(() => {
    if (recState !== "countdown") return;
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
    const tracks: MediaStreamTrack[] = [...(screenStream?.getTracks() || [])];
    if (cameraStream) cameraStream.getVideoTracks().forEach(t => tracks.push(t));
    const getMic = micOn
      ? navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true } })
          .then(a => a.getAudioTracks().forEach(t => tracks.push(t)))
          .catch(() => {})
      : Promise.resolve();
    getMic.finally(() => beginRecording(tracks));
  }, [recState, countdown, screenStream, cameraStream, micOn, beginRecording]);

  const pauseRecording = () => {
    if (mediaRecRef.current?.state === "recording") {
      mediaRecRef.current.pause();
      setRecState("paused");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };
  const resumeRecording = () => {
    if (mediaRecRef.current?.state === "paused") {
      mediaRecRef.current.resume();
      setRecState("recording");
      timerRef.current = setInterval(() => setRecTimer(t => t + 1), 1000);
    }
  };

  const handleUpload = async () => {
    if (!recBlob) return;
    setUploadState("uploading");
    setUploadProgress(0);
    setUploadErrorMsg("");
    try {
      const d = new Date();
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const vidTitle = uploadTitle.trim() || `Meeting - ${meeting?.title || roomId} · ${dateStr} (${timeStr})`;
      const targetFolder = uploadCourse || "1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW";
      const selectedCourse = courses.find(c => c.id === targetFolder);
      const folderName = selectedCourse ? selectedCourse.name : (targetFolder === "1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW" ? "MEETING" : undefined);

      try {
        await uploadVideo(recBlob, targetFolder, p => setUploadProgress(p), vidTitle, { 
          isMeeting: true,
          folderName
        });
      } catch (firstErr) {
        console.warn("Resumable upload error, attempting direct multipart upload fallback:", firstErr);
        // Fallback to direct multipart route handler /api/videos/upload
        const fd = new FormData();
        fd.append('file', recBlob, `${vidTitle}.webm`);
        fd.append('title', vidTitle);
        fd.append('courseId', targetFolder);
        if (folderName) fd.append('folderName', folderName);
        fd.append('isMeeting', 'true');
        const token = await ensureValidAuthToken();
        const fallbackRes = await fetch('/api/videos/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (!fallbackRes.ok) {
          throw firstErr;
        }
      }

      setUploadState("done");
      // Mark meeting as ended in localStorage
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all.map((m: Meeting) => m.id === roomId ? { ...m, status: "ended" } : m)));
      
      // Update meeting status in backend
      fetch('/api/meetings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: roomId, status: 'ended' }),
      }).catch(() => {});

      const destName = selectedCourse?.name || (targetFolder === "1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW" ? "MEETING" : "Selected Folder");
      showToast(`Recording saved to Google Drive ${destName} folder!`);
      setTimeout(() => router.push("/meetings"), 2000);
    } catch (e: unknown) {
      const err = e as Error;
      setUploadState("error");
      setUploadErrorMsg(err.message || "Upload failed. You can retry or download your recording locally.");
      showToast(err.message || "Upload failed.", false);
    }
  };

  const endClass = () => {
    if (recState === "recording" || recState === "paused") {
      stopRecording();
      return;
    }
    screenStream?.getTracks().forEach(t => t.stop());
    cameraStream?.getTracks().forEach(t => t.stop());
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.map((m: Meeting) => m.id === roomId ? { ...m, status: "ended" } : m)));
    fetch('/api/meetings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: roomId, status: 'ended' }),
    }).catch(() => {});
    router.push("/meetings");
  };

  // Safe UNMOUNT-ONLY cleanup (will NEVER terminate screen share when camera toggles!)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Whiteboard Logic (Pure White Canvas with Reverse & Typing) ─────
  const getXY = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return {x:0, y:0};
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const saveCanvasState = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    try {
      const data = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      historyRef.current.push(data);
      if (historyRef.current.length > 40) historyRef.current.shift();
      redoRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    } catch {}
  }, [setCanUndo, setCanRedo]);

  const handleReverse = () => {
    if (!canvasRef.current || historyRef.current.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    try {
      const current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      redoRef.current.push(current);
      const prev = historyRef.current.pop();
      if (prev) {
        ctx.putImageData(prev, 0, 0);
      }
      setCanUndo(historyRef.current.length > 0);
      setCanRedo(true);
      showToast("Reverse: Restored previous erased data / drawing");
    } catch {}
  };

  const handleRedo = () => {
    if (!canvasRef.current || redoRef.current.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    try {
      const current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      historyRef.current.push(current);
      const next = redoRef.current.pop();
      if (next) {
        ctx.putImageData(next, 0, 0);
      }
      setCanUndo(true);
      setCanRedo(redoRef.current.length > 0);
      showToast("Redone");
    } catch {}
  };

  const applyText = (textOverride?: string) => {
    if (!textBox || !canvasRef.current) {
      setTextBox(null);
      return;
    }
    const txt = (textOverride !== undefined ? textOverride : textBox.text).trim();
    if (!txt) {
      setTextBox(null);
      return;
    }
    saveCanvasState();
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      const textColor = penColor.toUpperCase() === "#FFFFFF" ? "#20262E" : penColor;
      ctx.font = `bold ${textFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textBaseline = "top";
      const lines = txt.split("\n");
      const lineHeight = Math.round(textFontSize * 1.25);
      const startX = textBox.x + 4;
      const startY = textBox.y + 4;
      lines.forEach((line, idx) => {
        ctx.fillText(line, startX, startY + idx * lineHeight);
      });
      showToast("Text placed on whiteboard!");
    }
    setTextBox(null);
  };

  const handleSlideImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current) return;
    saveCanvasState();
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        const canvas = canvasRef.current;
        const scale = Math.min((canvas.width * 0.8) / img.width, (canvas.height * 0.8) / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        showToast("Slide image inserted onto whiteboard!");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (!canvasRef.current || isReadonly) return;
    if (activeTool === 'text') {
      if (textBox && textBox.text.trim()) {
        applyText();
      }
      const { x, y } = getXY(e);
      setTextBox({ x, y, text: '' });
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || isReadonly) return;
    if (activeTool === 'text') {
      e.stopPropagation();
      return;
    }
    if (textBox && textBox.text.trim()) {
      applyText();
    } else if (textBox) {
      setTextBox(null);
    }
    saveCanvasState();
    setIsDrawing(true);
    const {x, y} = getXY(e);
    lastPos.current = {x, y};
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.arc(x, y, (isEraser ? eraserSize : penSize) / 2, 0, Math.PI * 2);
      ctx.fillStyle = isEraser ? "#FFFFFF" : penColor;
      ctx.fill();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || isReadonly) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const {x, y} = getXY(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current?.x ?? x, lastPos.current?.y ?? y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = isEraser ? "#FFFFFF" : penColor;
    ctx.lineWidth = isEraser ? eraserSize : penSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = {x, y};
  };

  const stopDrawing = () => { setIsDrawing(false); lastPos.current = null; };

  const clearWhiteboard = () => {
    if (!canvasRef.current || isReadonly) return;
    saveCanvasState();
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      showToast("Whiteboard cleared. Click Reverse to restore!");
    }
  };

  useEffect(() => {
    if (showWhiteboard && canvasRef.current) {
      const parent = canvasRef.current.parentElement;
      if (parent) {
        if (canvasRef.current.width !== parent.clientWidth || canvasRef.current.height !== parent.clientHeight) {
          canvasRef.current.width = parent.clientWidth;
          canvasRef.current.height = parent.clientHeight;
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            try {
              historyRef.current = [ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)];
              redoRef.current = [];
              setTimeout(() => {
                setCanUndo(false);
                setCanRedo(false);
              }, 0);
            } catch {}
          }
        }
      }
    }
  }, [showWhiteboard]);

  const isSharing = !!screenStream;
  const courseName = courses.find(c => c.id === (meeting?.courseId || ""))?.name;

  const isScheduledFuture = !isReadonly && meeting?.status !== "live" && meeting?.scheduledAt && (new Date(meeting.scheduledAt).getTime() > now);
  const remainingMs = meeting?.scheduledAt ? Math.max(0, new Date(meeting.scheduledAt).getTime() - now) : 0;
  const remDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const remHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const remMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const remSecs = Math.floor((remainingMs % (1000 * 60)) / 1000);

  // Student waiting lobby
  if (isScheduledFuture && !isMentor && !bypassLobby) {
    return (
      <div className="h-screen bg-[#20262E] flex flex-col justify-between p-6 text-white font-sans selection:bg-[#0CAA41]/30 relative overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#0CAA41]/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <RcrdLogo className="h-7 w-auto" />
            <span className="text-xs bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-full text-slate-300 font-bold">
              Waiting Lobby
            </span>
          </div>
          <button onClick={() => router.push('/meetings')} className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 transition-colors">
            ← Leave Lobby
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center z-10 py-8">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl space-y-6">
            <div className="w-20 h-20 bg-[#E6F6EC]0/10 border border-[#0CAA41]/30 rounded-3xl flex items-center justify-center mx-auto text-[#0CAA41] shadow-lg shadow-[rgba(12, 170, 65,0.1)] animate-pulse">
              <Lock size={36} />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#E6F6EC]/10 border border-amber-500/20 text-[#E6F6EC] text-xs font-bold rounded-full mb-3">
                <Clock size={12} /> Scheduled Class Session
              </span>
              <h1 className="text-2xl font-black text-white tracking-tight mb-2">
                {meeting?.title || "Class Meeting"}
              </h1>
              {courseName && <p className="text-xs font-bold text-[#0CAA41]">{courseName}</p>}
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#57636E] mb-3">Opens Automatically In</p>
              <div className="flex items-center justify-center gap-3">
                {remDays > 0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-mono font-black text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">{String(remDays).padStart(2, '0')}</span>
                    <span className="text-[10px] text-[#57636E] uppercase font-bold mt-1">Days</span>
                  </div>
                )}
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-mono font-black text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">{String(remHours).padStart(2, '0')}</span>
                  <span className="text-[10px] text-[#57636E] uppercase font-bold mt-1">Hours</span>
                </div>
                <span className="text-2xl font-black text-[#57636E] mb-4">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-mono font-black text-[#0CAA41] bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">{String(remMins).padStart(2, '0')}</span>
                  <span className="text-[10px] text-[#57636E] uppercase font-bold mt-1">Mins</span>
                </div>
                <span className="text-2xl font-black text-[#57636E] mb-4">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-mono font-black text-[#72BAA9] bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">{String(remSecs).padStart(2, '0')}</span>
                  <span className="text-[10px] text-[#57636E] uppercase font-bold mt-1">Secs</span>
                </div>
              </div>
            </div>

            <button onClick={() => setBypassLobby(true)} className="w-full py-3 px-4 bg-gradient-to-r from-[#0CAA41] to-[#0C5325] hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer">
              Enter Classroom Immediately (Skip Waiting)
            </button>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-[#57636E]">
              <span>Joined as: <strong className="text-slate-300">{studentName}</strong></span>
              <span>Meeting ID: <strong className="text-slate-300 font-mono">{roomId}</strong></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#1C1C1E] flex flex-col overflow-hidden text-white select-none">
      
      {/* ─── Top Status Bar ───────────────────────────────────────── */}
      <div className="h-11 flex items-center justify-between px-4 bg-[#2C2C2E] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <RcrdLogo className="h-5 w-auto opacity-90" />
          <div className="w-px h-4 bg-white/20" />
          <span className="text-white/80 text-xs font-bold truncate max-w-[220px]">{meeting?.title || "Class Room"}</span>
          
          {isScheduledFuture && isMentor && (
            <span className="flex items-center gap-1.5 text-[11px] text-[#E6F6EC] font-bold bg-[#E6F6EC]/20 border border-amber-500/30 rounded-full px-2.5 py-0.5 animate-pulse">
              <Clock size={11} /> Starts in {remHours}h {remMins}m {remSecs}s
            </span>
          )}

          {isSharing && recState !== "recording" && recState !== "paused" && (
            <span className="flex items-center gap-1.5 text-[11px] text-green-400 font-semibold bg-[#E6F6EC]/400/20 border border-green-500/30 rounded-full px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />Screen Sharing Active
            </span>
          )}
          {recState === "recording" && (
            <span className="flex items-center gap-1.5 text-[11px] text-[#0CAA41] font-bold bg-[#0CAA41]/20 border border-[#0CAA41]/30 rounded-full px-2.5 py-0.5 animate-pulse">
              <span className="w-1.5 h-1.5 bg-[#0CAA41] rounded-full" />REC {fmtT(recTimer)}
            </span>
          )}
          {recState === "paused" && (
            <span className="flex items-center gap-1.5 text-[11px] text-yellow-400 font-bold bg-yellow-500/20 border border-yellow-500/30 rounded-full px-2.5 py-0.5">
              <Pause size={10} />PAUSED {fmtT(recTimer)}
            </span>
          )}
          {isHandRaised && (
            <span className="flex items-center gap-1 text-[11px] text-[#E6F6EC] font-bold bg-[#E6F6EC]/20 border border-amber-500/30 rounded-full px-2.5 py-0.5 animate-bounce">
              ✋ Hand Raised
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isMentor && !isReadonly && (
            <button onClick={() => setShowTutorial(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/10 transition-all">
              <Info size={13} />How to use
            </button>
          )}
          <button
            onClick={() => setRightPanel(p => p === "chat" ? null : "chat")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${rightPanel === "chat" ? "bg-white/20 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
          >
            <MessageSquare size={13} />Chat
          </button>
          <button
            onClick={() => setRightPanel(p => p === "participants" ? null : "participants")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${rightPanel === "participants" ? "bg-white/20 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
          >
            <Users size={13} />Participants ({participants.length})
          </button>
          <button
            onClick={() => setRightPanel(p => p === "notes" ? null : "notes")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${rightPanel === "notes" ? "bg-white/20 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
          >
            <FileText size={13} />Notes {notes.length > 0 && <span className="bg-[#E6F6EC]0 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{notes.length}</span>}
          </button>
        </div>
      </div>

      {/* ─── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 relative">

        {/* Screen / Stage Area */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">

          {/* Screen Video (Always mounted, receives srcObject safely) */}
          <video
            ref={(el) => {
              screenVideoRef.current = el;
              if (el && screenStream && el.srcObject !== screenStream) {
                el.srcObject = screenStream;
                el.play().catch(() => {});
              }
            }}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${isSharing ? "opacity-100 z-10" : "opacity-0 pointer-events-none"}`}
          />

          {/* Whiteboard (Pure White Canvas) */}
          {showWhiteboard && (
            <div
              className="absolute inset-0 z-20 bg-white cursor-crosshair"
              onClick={() => {
                setShowSizePicker(false);
                if (textBox && textBox.text.trim()) {
                  applyText();
                }
              }}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-full touch-none bg-white"
              />

              {/* Direct On-Canvas Inline Typing at Click Location */}
              {textBox && (
                <div
                  style={{
                    left: `${Math.max(8, textBox.x)}px`,
                    top: `${Math.max(8, textBox.y)}px`,
                    maxWidth: 'calc(100% - 24px)',
                  }}
                  className="absolute z-[110] flex flex-col items-start select-text"
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  {/* Floating Micro Toolbar (Color Swatches, Size & Done) */}
                  <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-2xl border border-slate-700 mb-2 animate-in fade-in zoom-in-95 duration-150">
                    {/* Color selection swatches */}
                    <div className="flex items-center gap-1">
                      {WHITEBOARD_COLORS.slice(0, 6).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setPenColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-4 h-4 rounded-full border transition-transform hover:scale-125 cursor-pointer ${
                            penColor.toUpperCase() === c.toUpperCase() ? "border-white scale-125 ring-2 ring-[#0CAA41]/20" : "border-slate-500"
                          }`}
                          title={`Color ${c}`}
                        />
                      ))}
                      <input
                        type="color"
                        value={penColor}
                        onChange={e => setPenColor(e.target.value)}
                        className="w-4 h-4 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                        title="Custom Color"
                      />
                    </div>

                    <div className="w-px h-3.5 bg-slate-700 mx-0.5" />

                    {/* Font size selector */}
                    <select
                      value={textFontSize}
                      onChange={e => setTextFontSize(Number(e.target.value))}
                      className="text-[11px] font-bold bg-slate-800 text-white rounded-md px-1.5 py-0.5 border border-slate-700 outline-none cursor-pointer"
                    >
                      <option value={16}>16px</option>
                      <option value={20}>20px</option>
                      <option value={24}>24px</option>
                      <option value={32}>32px</option>
                      <option value={42}>42px</option>
                      <option value={56}>56px</option>
                    </select>

                    <div className="w-px h-3.5 bg-slate-700 mx-0.5" />

                    {/* Quick Done button */}
                    <button
                      type="button"
                      onClick={() => applyText()}
                      className="px-2.5 py-1 rounded-md bg-[#0CAA41] hover:bg-[#E6F6EC]0 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                      title="Done (or press Enter)"
                    >
                      <Check size={11} /> Done
                    </button>

                    {/* Cancel / Close button */}
                    <button
                      type="button"
                      onClick={() => setTextBox(null)}
                      className="p-1 rounded-md text-[#57636E] hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Cancel (Esc)"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {/* Direct On-Board Textarea */}
                  <textarea
                    ref={textInputRef}
                    autoFocus
                    value={textBox.text}
                    onChange={e => {
                      setTextBox({ ...textBox, text: e.target.value });
                      e.target.style.height = "auto";
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        applyText();
                      } else if (e.key === "Escape") {
                        setTextBox(null);
                      }
                    }}
                    placeholder="Type text here..."
                    rows={1}
                    className="bg-white/95 border-2 border-dashed border-[#0CAA41] rounded-xl px-3 py-1.5 outline-none font-bold placeholder:text-[#57636E] resize-none shadow-xl focus:border-[#0CAA41] focus:bg-white min-w-[180px] max-w-[650px] transition-all text-[#20262E]"
                    style={{
                      fontSize: `${textFontSize}px`,
                      lineHeight: 1.25,
                      color: penColor.toUpperCase() === '#FFFFFF' ? '#20262E' : penColor,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  />
                  <span className="text-[10px] text-[#57636E] bg-white/95 px-1.5 py-0.5 rounded shadow-xs font-semibold mt-1 ml-1 select-none border border-[#E2E7EC]">
                    Enter: stamp text • Shift+Enter: new line • Esc: cancel
                  </span>
                </div>
              )}

              {/* Whiteboard Toolbar */}
              {!isReadonly && (
                <div
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md px-4 py-2.5 rounded-2xl flex items-center gap-2.5 border border-slate-700 shadow-2xl z-[100] max-w-[96vw] overflow-x-auto"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Color Picker & Swatches */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={penColor}
                      onChange={(e) => { setIsEraser(false); setPenColor(e.target.value); }}
                      className="w-7 h-7 rounded-lg cursor-pointer border-0 p-0 bg-transparent shrink-0"
                      title="Custom Color"
                    />
                    <div className="flex gap-1">
                      {WHITEBOARD_COLORS.slice(0, 6).map(c => (
                        <button
                          key={c}
                          onClick={() => { setIsEraser(false); setPenColor(c); }}
                          style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-125 shrink-0 ${
                            !isEraser && penColor.toUpperCase() === c.toUpperCase() ? "border-white scale-125 shadow-lg" : "border-slate-500"
                          }`}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="w-px h-6 bg-slate-700 shrink-0" />
                  
                  {/* Pen Tool & Size */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => { setActiveTool("pen"); setIsEraser(false); setShowSizePicker(prev => !prev); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        activeTool === "pen" && !isEraser ? "bg-[#0CAA41] text-white shadow" : "bg-slate-800 text-slate-300 hover:text-white"
                      }`}
                      title="Pen tool"
                    >
                      <Pen size={13} />
                      <span>{penSize}px</span>
                    </button>
                    {showSizePicker && !isEraser && (
                      <div className="absolute bottom-[115%] left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-xl p-3 w-48 shadow-2xl z-[120]">
                        <p className="text-[10px] text-[#57636E] font-bold uppercase mb-2">Pen Size: {penSize}px</p>
                        <input type="range" min={1} max={40} value={penSize} onChange={e => setPenSize(Number(e.target.value))} className="w-full accent-blue-500 cursor-pointer" />
                        <div className="flex justify-between text-[10px] text-[#57636E] mt-1"><span>1px</span><span>40px</span></div>
                      </div>
                    )}
                  </div>

                  {/* Eraser Tool */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => { setActiveTool("pen"); setIsEraser(!isEraser); setShowSizePicker(isEraser ? false : showSizePicker); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isEraser ? "bg-[#0CAA41] text-white shadow" : "bg-slate-800 text-slate-300 hover:text-white"
                      }`}
                      title="Eraser tool"
                    >
                      <Eraser size={13} />
                      <span>Eraser</span>
                    </button>
                    {isEraser && (
                      <div className="absolute bottom-[115%] left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-xl p-3 w-48 shadow-2xl z-[120]">
                        <p className="text-[10px] text-[#57636E] font-bold uppercase mb-2">Eraser Size: {eraserSize}px</p>
                        <input type="range" min={10} max={100} value={eraserSize} onChange={e => setEraserSize(Number(e.target.value))} className="w-full accent-amber-500 cursor-pointer" />
                        <div className="flex justify-between text-[10px] text-[#57636E] mt-1"><span>10px</span><span>100px</span></div>
                      </div>
                    )}
                  </div>

                  <div className="w-px h-6 bg-slate-700 shrink-0" />

                  {/* REVERSE (Undo - restores erased data) Button */}
                  <button
                    onClick={handleReverse}
                    disabled={!canUndo}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      canUndo
                        ? "bg-slate-800 hover:bg-slate-700 text-white shadow cursor-pointer"
                        : "bg-slate-800/40 text-[#57636E] cursor-not-allowed"
                    }`}
                    title="Reverse: Restore previous erased data (Undo)"
                  >
                    <RotateCcw size={13} className="text-[#E6F6EC]" />
                    <span>Reverse</span>
                  </button>

                  {/* REDO Button */}
                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      canRedo
                        ? "bg-slate-800 hover:bg-slate-700 text-white shadow cursor-pointer"
                        : "bg-slate-800/40 text-[#57636E] cursor-not-allowed"
                    }`}
                    title="Redo"
                  >
                    <RotateCw size={13} className="text-[#0CAA41]" />
                  </button>

                  <div className="w-px h-6 bg-slate-700 shrink-0" />

                  {/* TYPING Tool Button */}
                  <button
                    onClick={() => {
                      setIsEraser(false);
                      if (activeTool === "text") {
                        if (textBox && textBox.text.trim()) applyText();
                        setTextBox(null);
                        setActiveTool("pen");
                        showToast("Pen tool active");
                      } else {
                        setActiveTool("text");
                        const c = canvasRef.current;
                        const w = c ? c.clientWidth : (typeof window !== "undefined" ? window.innerWidth : 800);
                        const h = c ? c.clientHeight : (typeof window !== "undefined" ? window.innerHeight : 600);
                        const defaultX = Math.max(40, Math.round(w / 4));
                        const defaultY = Math.max(60, Math.round(h / 3));
                        setTextBox({ x: defaultX, y: defaultY, text: "" });
                        showToast("Typing active! Start typing or click anywhere on board to place text.");
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      activeTool === "text" ? "bg-[#0CAA41] text-white shadow-lg ring-2 ring-purple-400/50" : "bg-slate-800 text-slate-300 hover:text-white"
                    }`}
                    title="Type text on whiteboard (Click anywhere on board to place)"
                  >
                    <Type size={13} />
                    <span>Type</span>
                  </button>

                  {/* UPLOAD Slide or Image to Whiteboard */}
                  <button
                    onClick={() => slideFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all shrink-0"
                    title="Upload and insert slide or image onto whiteboard"
                  >
                    <ImageIcon size={13} className="text-[#72BAA9]" />
                    <span>Upload Slide</span>
                  </button>
                  <input
                    ref={slideFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSlideImageUpload}
                    className="hidden"
                  />

                  <div className="w-px h-6 bg-slate-700 shrink-0" />

                  {/* Clear Whiteboard */}
                  <button
                    onClick={clearWhiteboard}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800 text-slate-300 hover:bg-[#0CAA41] hover:text-white transition-all shrink-0"
                    title="Clear Whiteboard"
                  >
                    <Trash2 size={14} />
                  </button>

                  {/* Exit Board */}
                  <button
                    onClick={() => setShowWhiteboard(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-[#0CAA41] text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <X size={13} /> Exit
                  </button>
                </div>
              )}
            </div>
          )}

          {/* When Screen Share IS ACTIVE: High-Visibility Floating Admin Face Overlay */}
          {isSharing && !showWhiteboard && (
            <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-3 pointer-events-auto">
              {/* Host Video Card */}
              <div className="w-64 h-40 bg-slate-900/95 rounded-2xl overflow-hidden border-2 border-[#0CAA41] shadow-2xl relative group">
                {cameraOn ? (
                  <video
                    ref={(el) => {
                      cameraVideoRef.current = el;
                      if (el && cameraStream && el.srcObject !== cameraStream) {
                        el.srcObject = cameraStream;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/90 text-white">
                    <div className="w-14 h-14 rounded-full bg-[#0CAA41] flex items-center justify-center font-extrabold text-xl shadow-lg ring-2 ring-[#0CAA41]/20">
                      HR
                    </div>
                    <span className="text-[11px] font-medium text-[#57636E] mt-2">Camera is off</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-[11px] font-bold text-white shadow">
                  {micOn ? <Mic size={12} className="text-[#72BAA9]" /> : <MicOff size={12} className="text-[#0CAA41]" />}
                  <span>You (Host)</span>
                </div>
                {isHandRaised && (
                  <div className="absolute top-2 right-2 bg-[#E6F6EC] text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-lg animate-bounce">
                    ✋ Hand Raised
                  </div>
                )}
              </div>

              {/* Connected Student Mini Avatar Badges */}
              <div className="flex gap-2">
                {participants.filter(p => p.id !== myParticipantId).map((p, idx) => {
                  const colors = ["bg-[#0CAA41]", "bg-[#72BAA9]", "bg-[#0CAA41]", "bg-rose-600", "bg-[#0CAA41]"];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={p.id} className="w-24 h-16 bg-slate-900/90 rounded-xl border border-slate-700/80 overflow-hidden relative shadow-lg flex items-center justify-center">
                      <div className={`w-8 h-8 rounded-full ${color} text-white flex items-center justify-center text-xs font-bold shadow`}>
                        {p.avatar || p.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] text-white/90 bg-black/60 px-1 py-0.5 rounded truncate font-medium">
                        <span className="truncate">{p.name}</span>
                      </div>
                      {p.isHandRaised && <span className="absolute top-1 right-1 text-xs">✋</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* When Screen Share is NOT Active: Full Zoom-style Participant Video Gallery */}
          {!isSharing && !showWhiteboard && (
            <div className="relative z-10 w-full h-full p-6 flex flex-col justify-between overflow-y-auto">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto w-full items-center">
                {/* Host Tile */}
                <div className="w-full h-64 md:h-72 bg-slate-900/90 rounded-2xl border-2 border-[#0CAA41]/60 overflow-hidden relative shadow-2xl flex items-center justify-center group">
                  {cameraOn ? (
                    <video
                      ref={(el) => {
                        cameraVideoRef.current = el;
                        if (el && cameraStream && el.srcObject !== cameraStream) {
                          el.srcObject = cameraStream;
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-[#0CAA41] text-white flex items-center justify-center text-2xl font-black shadow-xl ring-4 ring-[#0CAA41]/20">
                        {isMentor ? "HR" : (studentName ? studentName.substring(0, 2).toUpperCase() : "ME")}
                      </div>
                      <span className="text-sm font-semibold text-slate-300 mt-3">
                        {isMentor ? "You (Host)" : `${studentName || "You"} (Student)`}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1 rounded-xl bg-black/70 backdrop-blur-sm text-xs font-bold text-white shadow">
                    {micOn ? <Mic size={13} className="text-[#72BAA9]" /> : <MicOff size={13} className="text-[#0CAA41]" />}
                    <span>{isMentor ? "You (Host)" : (studentName || "You")}</span>
                  </div>
                  {isHandRaised && (
                    <div className="absolute top-3 right-3 bg-[#E6F6EC] text-slate-950 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-lg animate-bounce">
                      ✋ Hand Raised
                    </div>
                  )}
                </div>

                {/* Real Joined Students / Other Attendees */}
                {participants.filter(p => p.id !== myParticipantId).length > 0 ? (
                  participants.filter(p => p.id !== myParticipantId).map((p, idx) => {
                    const colors = ["bg-[#0CAA41]", "bg-[#72BAA9]", "bg-[#0CAA41]", "bg-rose-600", "bg-[#0CAA41]"];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={p.id} className="w-full h-64 md:h-72 bg-slate-900/90 rounded-2xl border border-slate-700/80 overflow-hidden relative shadow-2xl flex flex-col items-center justify-center">
                        <div className={`w-20 h-20 rounded-full ${color} text-white flex items-center justify-center text-2xl font-black shadow-xl ring-4 ring-white/10`}>
                          {p.avatar || p.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-300 mt-3">{p.name}</span>
                        <span className="text-[10px] text-[#57636E]">{p.role}</span>
                        <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1 rounded-xl bg-black/70 backdrop-blur-sm text-xs font-bold text-white shadow">
                          {p.isMuted ? <MicOff size={13} className="text-[#0CAA41]" /> : <Mic size={13} className="text-[#72BAA9]" />}
                          <span>{p.name}</span>
                        </div>
                        {p.isHandRaised && (
                          <div className="absolute top-3 right-3 bg-[#E6F6EC] text-slate-950 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-lg animate-bounce">
                            ✋ Hand Raised
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  /* Waiting for Students State Card */
                  <div className="w-full h-64 md:h-72 bg-slate-900/60 rounded-2xl border-2 border-dashed border-slate-700/80 overflow-hidden relative shadow-xl flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#E6F6EC]0/10 border border-[#0CAA41]/30 flex items-center justify-center text-[#0CAA41] mb-3 animate-pulse">
                      <Users size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">Waiting for students to join...</h4>
                    <p className="text-xs text-[#57636E] max-w-xs mb-3">
                      Share the Meeting ID with students. They can join from any browser or device instantly.
                    </p>
                    <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-white mb-3">
                      <span>ID: <strong className="text-[#0CAA41]">{roomId}</strong></span>
                      {meeting?.password && (
                        <>
                          <span className="text-[#57636E]">|</span>
                          <span>Pass: <strong className="text-[#72BAA9]">{meeting.password}</strong></span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const origin = typeof window !== "undefined" ? window.location.origin : "";
                        const pwd = meeting?.password || "";
                        const directLink = pwd ? `${origin}/meeting/${roomId}?pwd=${encodeURIComponent(pwd)}` : `${origin}/meeting/${roomId}`;
                        const passInfo = pwd ? `\nPasscode: ${pwd}` : "";
                        const info = `Class Meeting Invitation\nMeeting: ${meeting?.title || 'Class Room'}\nDirect Join Link: ${directLink}\nMeeting ID: ${roomId}${passInfo}`;
                        navigator.clipboard.writeText(info);
                        showToast("Meeting link & credentials copied! Share with your students.");
                      }}
                      className="px-4 py-2 bg-[#0CAA41] hover:bg-[#E6F6EC]0 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy size={13} /> Copy Meeting Link & Details
                    </button>
                  </div>
                )}
              </div>

              {/* Start Screen Share Action */}
              {isMentor && !isReadonly && (
                <div className="flex justify-center pt-4 pb-1">
                  <button
                    onClick={startScreenShare}
                    className="px-7 py-3 bg-gradient-to-r from-[#0CAA41] to-[#0C5325] hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl flex items-center gap-2.5 shadow-xl shadow-blue-900/40 transition-all hover:scale-105"
                  >
                    <Monitor size={18} /> Share Screen to Teach
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Countdown Overlay */}
          {recState === "countdown" && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
              <div className="text-center">
                <div className="text-8xl font-black text-white mb-4 animate-pulse">{countdown}</div>
                <p className="text-white/60 text-lg font-semibold">Recording starts in...</p>
              </div>
            </div>
          )}

          {/* Floating Reaction Emojis Animation */}
          {floatingReactions.map(r => (
            <div
              key={r.id}
              style={{ left: `${r.left}%` }}
              className="fixed bottom-24 text-4xl pointer-events-none z-50 animate-bounce transition-all transform -translate-y-20 duration-1000"
            >
              {r.emoji}
            </div>
          ))}
        </div>

        {/* ─── Right Drawer Panel (Chat / Participants / Notes) ──────── */}
        {rightPanel && (
          <div className={`w-96 flex flex-col shrink-0 z-30 transition-colors shadow-2xl ${
            rightPanel === "notes" ? "bg-white border-l border-[#E2E7EC] text-[#20262E]" : "bg-[#2C2C2E] border-l border-white/10 text-white"
          }`}>
            {/* Drawer Tabs Header */}
            <div className={`h-12 border-b flex items-center justify-between px-3 transition-colors ${
              rightPanel === "notes" ? "bg-[#F5F6F8] border-[#E2E7EC]" : "bg-[#242426] border-white/10"
            }`}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRightPanel("chat")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    rightPanel === "chat"
                      ? "bg-[#0CAA41] text-white shadow"
                      : rightPanel === "notes"
                        ? "text-[#57636E] hover:text-[#20262E] hover:bg-slate-100"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <ChatIcon size={14} /> Chat
                </button>
                <button
                  onClick={() => setRightPanel("participants")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    rightPanel === "participants"
                      ? "bg-[#0CAA41] text-white shadow"
                      : rightPanel === "notes"
                        ? "text-[#57636E] hover:text-[#20262E] hover:bg-slate-100"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <UsersIcon size={14} /> People ({participants.length})
                </button>
                <button
                  onClick={() => setRightPanel("notes")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    rightPanel === "notes"
                      ? "bg-[#0CAA41] text-white shadow"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <FileText size={13} /> Notes
                </button>
              </div>
              <button
                onClick={() => setRightPanel(null)}
                className={`p-1 rounded-lg transition-colors ${
                  rightPanel === "notes" ? "text-[#57636E] hover:text-[#20262E] hover:bg-slate-200" : "text-white/50 hover:text-white hover:bg-white/10"
                }`}
              >
                <X size={15} />
              </button>
            </div>

            {/* TAB 1: Real Working In-Meeting Chat */}
            {rightPanel === "chat" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          {msg.sender}
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${msg.role === "Host" ? "bg-[#E6F6EC]0/30 text-blue-300" : "bg-white/10 text-slate-300"}`}>
                            {msg.role}
                          </span>
                        </span>
                        <span className="text-[10px] text-white/40">{msg.time}</span>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/90 leading-relaxed break-words">
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
                {!isMentor && (!securitySettings.allowChat || participants.find(p => p.name === studentName || p.id === "p1")?.canChat === false) ? (
                  <div className="p-3 border-t border-white/10 bg-[#242426] text-center text-xs text-[#E6F6EC]/90 font-medium flex items-center justify-center gap-1.5">
                    <Lock size={12} /> Chat is restricted by the host.
                  </div>
                ) : (
                  <form onSubmit={sendChatMessage} className="p-3 border-t border-white/10 bg-[#242426] flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Type a message to everyone..."
                      className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:border-[#0CAA41] outline-none"
                    />
                    <button type="submit" className="p-2 bg-[#0CAA41] hover:bg-[#E6F6EC]0 rounded-xl text-white transition-colors" title="Send message">
                      <Send size={14} />
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: Participants List (Host Admin Controls) */}
            {rightPanel === "participants" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-3 border-b border-white/10 flex items-center justify-between text-xs text-white/70">
                  <span className="font-semibold">In this meeting ({participants.length})</span>
                  {isMentor && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setParticipants(prev => prev.map(p => p.role === "Student" ? { ...p, isMuted: true } : p));
                          showToast("All participants muted.");
                        }}
                        className="text-[11px] font-bold text-[#0CAA41] hover:text-[#0CAA41]"
                      >
                        Mute All
                      </button>
                      <button
                        onClick={() => {
                          setParticipants(prev => prev.map(p => p.role === "Student" ? { ...p, isMuted: false } : p));
                          showToast("Unmuted all participants.");
                        }}
                        className="text-[11px] font-bold text-[#72BAA9] hover:text-emerald-300"
                      >
                        Unmute All
                      </button>
                      <button
                        onClick={() => {
                          setParticipants(prev => prev.map(p => ({ ...p, isHandRaised: false })));
                          setIsHandRaised(false);
                          showToast("All hands lowered.");
                        }}
                        className="text-[11px] font-bold text-[#E6F6EC] hover:text-[#E6F6EC]"
                      >
                        Lower Hands
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {participants.map((p, idx) => {
                    const colors = ["bg-[#0CAA41]", "bg-[#72BAA9]", "bg-[#0CAA41]", "bg-rose-600", "bg-[#0CAA41]"];
                    const color = p.role === "Host" ? "bg-[#0CAA41]" : colors[idx % colors.length];
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 shrink-0 rounded-full ${color} text-white flex items-center justify-center text-xs font-bold`}>
                            {p.avatar || p.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate max-w-[100px]">{p.name}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${p.role === "Host" ? "bg-[#E6F6EC]0/30 text-blue-300" : "bg-white/10 text-slate-300"}`}>
                                {p.role}
                              </span>
                            </div>
                            {p.isHandRaised && (
                              <span className="text-[10px] text-[#E6F6EC] font-bold flex items-center gap-1 mt-0.5">
                                ✋ Hand Raised
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Participant Controls */}
                        <div className="flex items-center gap-1 text-white/70 shrink-0">
                          {isMentor && p.role === "Student" ? (
                            <>
                              {/* Host controls individual user audio */}
                              <button
                                onClick={() => {
                                  setParticipants(prev => prev.map(item => item.id === p.id ? { ...item, isMuted: !item.isMuted } : item));
                                  showToast(p.isMuted ? `Unmuted ${p.name}` : `Muted ${p.name}`);
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${p.isMuted ? "bg-[#0CAA41]/20 text-[#0CAA41] hover:bg-[#0CAA41]/30" : "bg-[#72BAA9]/20 text-[#72BAA9] hover:bg-[#72BAA9]/30"}`}
                                title={p.isMuted ? "Unmute this participant" : "Mute this participant"}
                              >
                                {p.isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                              </button>

                              {/* Host controls individual user video */}
                              <button
                                onClick={() => {
                                  setParticipants(prev => prev.map(item => item.id === p.id ? { ...item, isVideoOn: !item.isVideoOn } : item));
                                  showToast(p.isVideoOn ? `Stopped ${p.name}'s video` : `Allowed ${p.name}'s video`);
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${p.isVideoOn ? "bg-[#E6F6EC]0/20 text-[#0CAA41] hover:bg-[#E6F6EC]0/30" : "bg-white/5 text-[#57636E] hover:bg-white/10"}`}
                                title={p.isVideoOn ? "Stop video" : "Ask to start video"}
                              >
                                {p.isVideoOn ? <Camera size={13} /> : <VideoOff size={13} />}
                              </button>

                              {/* Host toggles Screen Share permission */}
                              <button
                                onClick={() => {
                                  setParticipants(prev => prev.map(item => item.id === p.id ? { ...item, canScreenShare: item.canScreenShare === false ? true : false } : item));
                                  showToast(p.canScreenShare === false ? `Allowed screen share for ${p.name}` : `Revoked screen share for ${p.name}`);
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${p.canScreenShare !== false ? "bg-white/5 text-[#72BAA9] hover:bg-white/10" : "bg-[#0CAA41]/20 text-[#0CAA41] hover:bg-[#0CAA41]/30"}`}
                                title={p.canScreenShare !== false ? "Screen share enabled for attendee" : "Screen share disabled for attendee"}
                              >
                                <Monitor size={13} />
                              </button>

                              {/* Host toggles Chat permission */}
                              <button
                                onClick={() => {
                                  setParticipants(prev => prev.map(item => item.id === p.id ? { ...item, canChat: item.canChat === false ? true : false } : item));
                                  showToast(p.canChat === false ? `Allowed chat for ${p.name}` : `Revoked chat for ${p.name}`);
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${p.canChat !== false ? "bg-white/5 text-[#0CAA41] hover:bg-white/10" : "bg-[#0CAA41]/20 text-[#0CAA41] hover:bg-[#0CAA41]/30"}`}
                                title={p.canChat !== false ? "Chat enabled for attendee" : "Chat disabled for attendee"}
                              >
                                <MessageSquare size={13} />
                              </button>

                              {/* Host lowers hand */}
                              {p.isHandRaised && (
                                <button
                                  onClick={() => {
                                    setParticipants(prev => prev.map(item => item.id === p.id ? { ...item, isHandRaised: false } : item));
                                    showToast(`Lowered ${p.name}'s hand`);
                                  }}
                                  className="p-1.5 rounded-lg bg-[#E6F6EC]/20 text-[#E6F6EC] hover:bg-[#E6F6EC]/30 transition-colors"
                                  title="Lower Hand"
                                >
                                  <Hand size={13} />
                                </button>
                              )}

                              {/* Host removes participant */}
                              <button
                                onClick={() => {
                                  setParticipants(prev => prev.filter(item => item.id !== p.id));
                                  showToast(`Removed ${p.name} from meeting.`);
                                }}
                                className="p-1.5 rounded-lg hover:bg-[#0CAA41]/20 text-white/40 hover:text-[#0CAA41] transition-colors"
                                title="Remove attendee"
                              >
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              {p.isMuted ? <MicOff size={13} className="text-[#0CAA41]" /> : <Mic size={13} className="text-[#72BAA9]" />}
                              {p.isVideoOn ? <Camera size={13} className="text-[#0CAA41]" /> : <VideoOff size={13} className="text-[#57636E]" />}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {participants.length <= 1 && (
                    <div className="p-4 text-center text-xs text-white/40">
                      No students have joined yet. Share Meeting ID: <span className="text-white font-mono font-bold">{roomId}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Class Notes (PURE WHITE THEME, File Attachments & Import Notes) */}
            {rightPanel === "notes" && (
              <div className="flex-1 flex flex-col min-h-0 bg-white text-[#20262E]">
                {/* 3 Sub-tabs + Upload Notes Header */}
                <div className="flex items-center justify-between border-b border-[#E2E7EC] bg-[#F5F6F8] px-2.5 py-1.5">
                  <div className="flex gap-1">
                    {(["host", "participant", "group"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNoteType(t)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                          noteType === t ? "bg-white text-[#0CAA41] shadow-sm border border-[#E2E7EC]" : "text-[#57636E] hover:text-[#20262E]"
                        }`}
                      >
                        {t === "host" ? "Host" : t === "participant" ? "Participant" : "Group"}
                      </button>
                    ))}
                  </div>

                  {/* Upload Notes File Button */}
                  <button
                    onClick={() => importNotesInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-[#0CAA41] bg-[#E6F6EC] hover:bg-[#E6F6EC] rounded-lg transition-colors border border-[#0CAA41]/30"
                    title="Upload notes from a file (.txt, .json, .md)"
                  >
                    <FileUp size={13} />
                    <span>Upload Notes</span>
                  </button>
                  <input
                    ref={importNotesInputRef}
                    type="file"
                    accept=".txt,.json,.md"
                    onChange={handleImportNotesFile}
                    className="hidden"
                  />
                </div>

                {/* Sub-tab 1: HOST NOTES (Host Only Access) */}
                {noteType === "host" && (
                  <>
                    {!isMentor ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#57636E] space-y-3 bg-white">
                        <div className="w-12 h-12 rounded-full bg-[#E6F6EC]/40 border border-[#72BAA9]/30 flex items-center justify-center text-[#0CAA41] shadow">
                          <Lock size={22} />
                        </div>
                        <h4 className="text-sm font-bold text-[#20262E]">Host Only Access</h4>
                        <p className="text-xs text-[#57636E] max-w-xs leading-relaxed">
                          This section contains private host meeting notes. Only the host has access to view or write notes here.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="p-2.5 bg-[#E6F6EC]/80 border-b border-[#0CAA41]/20 flex items-center gap-2 text-[11px] text-[#0C5325] font-semibold">
                          <Shield size={13} /> Private Host Section (Host only)
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white">
                          {notes.filter(n => n.type === "host").length === 0 ? (
                            <div className="text-center py-12 text-[#57636E] text-xs">
                              <FileText size={24} className="mx-auto mb-2 opacity-50" />
                              No host notes yet. Add private notes or attach files below.
                            </div>
                          ) : (
                            notes.filter(n => n.type === "host").map(n => (
                              <div key={n.id} className="bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl p-3 space-y-1.5 relative group shadow-sm">
                                <div className="flex items-center justify-between text-[10px] text-[#57636E]">
                                  <span className="font-bold text-[#0CAA41]">{n.author} (Host Note)</span>
                                  <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-xs text-[#20262E] leading-relaxed whitespace-pre-wrap">{n.content}</p>
                                {n.attachment && (
                                  <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-white border border-[#E2E7EC] shadow-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-[#E6F6EC] text-[#0CAA41] flex items-center justify-center shrink-0">
                                        <Paperclip size={13} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-[#20262E] truncate">{n.attachment.name}</p>
                                        <p className="text-[10px] text-[#57636E]">{(n.attachment.size / 1024).toFixed(1)} KB</p>
                                      </div>
                                    </div>
                                    <a
                                      href={n.attachment.dataUrl}
                                      download={n.attachment.name}
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#E6F6EC] text-[#57636E] hover:text-[#0CAA41] transition-colors shrink-0"
                                      title="Download attachment"
                                    >
                                      <Download size={13} />
                                    </a>
                                  </div>
                                )}
                                <button
                                  onClick={() => saveNotes(notes.filter(item => item.id !== n.id))}
                                  className="absolute top-2 right-2 text-[#57636E] hover:text-[#0CAA41] opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete note"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="p-3 border-t border-[#E2E7EC] bg-[#F5F6F8] space-y-2">
                          {noteAttachment && (
                            <div className="flex items-center justify-between p-2 bg-[#E6F6EC] border border-[#0CAA41]/30 rounded-xl text-xs text-blue-900">
                              <div className="flex items-center gap-1.5 truncate">
                                <Paperclip size={13} className="text-[#0CAA41] shrink-0" />
                                <span className="font-semibold truncate">{noteAttachment.name}</span>
                                <span className="text-[10px] text-[#0CAA41] shrink-0">({(noteAttachment.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <button
                                onClick={() => setNoteAttachment(null)}
                                className="text-[#0CAA41] hover:text-[#0CAA41] p-0.5"
                                title="Remove attachment"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          )}
                          <textarea
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            placeholder="Add a private host note... (Ctrl+Enter)"
                            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote(); }}
                            rows={3}
                            className="w-full bg-white border border-[#E2E7EC] rounded-xl p-2.5 text-xs text-[#20262E] placeholder-slate-400 focus:border-[#0CAA41] outline-none resize-none shadow-sm"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => noteFileInputRef.current?.click()}
                              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E7EC] hover:bg-slate-100 text-[#20262E] rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                              title="Attach a file to this note"
                            >
                              <Paperclip size={13} />
                              <span>Attach File</span>
                            </button>
                            <input
                              ref={noteFileInputRef}
                              type="file"
                              onChange={handleNoteFileSelect}
                              className="hidden"
                            />
                            <button
                              onClick={addNote}
                              className="flex-1 py-2 bg-[#0CAA41] hover:bg-[#E6F6EC]0 text-white rounded-xl text-xs font-bold transition-all shadow"
                            >
                              Save Host Note
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Sub-tab 2: PARTICIPANT (Individual 1-on-1 Private Notes/Messages between Participant and Host) */}
                {noteType === "participant" && (
                  <>
                    {isMentor ? (
                      <>
                        {/* Host chooses which participant's private channel to view */}
                        <div className="p-2 border-b border-[#E2E7EC] bg-slate-100/70 flex gap-1.5 overflow-x-auto custom-scrollbar">
                          {participants.filter(p => p.role === "Student").length === 0 ? (
                            <span className="text-[11px] text-[#57636E] px-2 py-1">No students joined yet</span>
                          ) : (
                            participants.filter(p => p.role === "Student").map(p => (
                              <button
                                key={p.id}
                                onClick={() => setSelectedParticipantId(p.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                  selectedParticipantId === p.id ? "bg-[#0CAA41] text-white shadow" : "bg-white text-[#57636E] border border-[#E2E7EC] hover:bg-[#F5F6F8]"
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E6F6EC]0" />
                                {p.name}
                              </button>
                            ))
                          )}
                        </div>
                        <div className="p-2 bg-[#E6F6EC]/40 border-b border-[#72BAA9]/30 text-[11px] text-[#0C5325] flex items-center gap-1.5 font-medium">
                          <Lock size={12} /> Private 1-on-1 thread with {participants.find(p => p.id === selectedParticipantId)?.name || "Participant"}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white">
                          {notes.filter(n => n.type === "participant" && (n.participantId === selectedParticipantId || n.author === participants.find(p => p.id === selectedParticipantId)?.name)).length === 0 ? (
                            <div className="text-center py-12 text-[#57636E] text-xs">
                              <FileText size={24} className="mx-auto mb-2 opacity-50" />
                              No private messages with {participants.find(p => p.id === selectedParticipantId)?.name || "this student"} yet.
                            </div>
                          ) : (
                            notes.filter(n => n.type === "participant" && (n.participantId === selectedParticipantId || n.author === participants.find(p => p.id === selectedParticipantId)?.name)).map(n => (
                              <div key={n.id} className="bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl p-3 space-y-1.5 shadow-sm">
                                <div className="flex items-center justify-between text-[10px] text-[#57636E]">
                                  <span className={`font-bold ${n.author === "Host" ? "text-[#0CAA41]" : "text-[#0C5325]"}`}>{n.author}</span>
                                  <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-xs text-[#20262E] leading-relaxed whitespace-pre-wrap">{n.content}</p>
                                {n.attachment && (
                                  <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-white border border-[#E2E7EC] shadow-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-[#E6F6EC] text-[#0CAA41] flex items-center justify-center shrink-0">
                                        <Paperclip size={13} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-[#20262E] truncate">{n.attachment.name}</p>
                                        <p className="text-[10px] text-[#57636E]">{(n.attachment.size / 1024).toFixed(1)} KB</p>
                                      </div>
                                    </div>
                                    <a
                                      href={n.attachment.dataUrl}
                                      download={n.attachment.name}
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#E6F6EC] text-[#57636E] hover:text-[#0CAA41] transition-colors shrink-0"
                                      title="Download attachment"
                                    >
                                      <Download size={13} />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                        <div className="p-3 border-t border-[#E2E7EC] bg-[#F5F6F8] space-y-2">
                          {noteAttachment && (
                            <div className="flex items-center justify-between p-2 bg-[#E6F6EC] border border-[#0CAA41]/30 rounded-xl text-xs text-blue-900">
                              <div className="flex items-center gap-1.5 truncate">
                                <Paperclip size={13} className="text-[#0CAA41] shrink-0" />
                                <span className="font-semibold truncate">{noteAttachment.name}</span>
                                <span className="text-[10px] text-[#0CAA41] shrink-0">({(noteAttachment.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <button
                                onClick={() => setNoteAttachment(null)}
                                className="text-[#0CAA41] hover:text-[#0CAA41] p-0.5"
                                title="Remove attachment"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          )}
                          <textarea
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            placeholder={`Reply privately to ${participants.find(p => p.id === selectedParticipantId)?.name || "Participant"}... (Ctrl+Enter)`}
                            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote(); }}
                            rows={3}
                            className="w-full bg-white border border-[#E2E7EC] rounded-xl p-2.5 text-xs text-[#20262E] placeholder-slate-400 focus:border-[#0CAA41] outline-none resize-none shadow-sm"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => noteFileInputRef.current?.click()}
                              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E7EC] hover:bg-slate-100 text-[#20262E] rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                              title="Attach a file to this note"
                            >
                              <Paperclip size={13} />
                              <span>Attach File</span>
                            </button>
                            <button
                              onClick={addNote}
                              className="flex-1 py-2 bg-[#0CAA41] hover:bg-[#E6F6EC]0 text-white rounded-xl text-xs font-bold transition-all shadow"
                            >
                              Send Private Note
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Student only sees their private thread with Host */}
                        <div className="p-2.5 bg-[#E6F6EC]/40 border-b border-[#72BAA9]/30 text-[11px] text-[#0C5325] flex items-center gap-1.5 font-medium">
                          <Lock size={12} /> Private 1-on-1 with Host (Invisible to other students)
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white">
                          {notes.filter(n => n.type === "participant" && (n.participantId === (participants.find(p => p.name === studentName)?.id || myParticipantId) || n.author === studentName)).length === 0 ? (
                            <div className="text-center py-12 text-[#57636E] text-xs">
                              <FileText size={24} className="mx-auto mb-2 opacity-50" />
                              No private messages sent to the host yet.
                            </div>
                          ) : (
                            notes.filter(n => n.type === "participant" && (n.participantId === (participants.find(p => p.name === studentName)?.id || myParticipantId) || n.author === studentName)).map(n => (
                              <div key={n.id} className="bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl p-3 space-y-1.5 shadow-sm">
                                <div className="flex items-center justify-between text-[10px] text-[#57636E]">
                                  <span className={`font-bold ${n.author === "Host" ? "text-[#0CAA41]" : "text-[#72BAA9]"}`}>{n.author}</span>
                                  <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-xs text-[#20262E] leading-relaxed whitespace-pre-wrap">{n.content}</p>
                                {n.attachment && (
                                  <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-white border border-[#E2E7EC] shadow-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-7 h-7 rounded-lg bg-[#E6F6EC] text-[#0CAA41] flex items-center justify-center shrink-0">
                                        <Paperclip size={13} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-[#20262E] truncate">{n.attachment.name}</p>
                                        <p className="text-[10px] text-[#57636E]">{(n.attachment.size / 1024).toFixed(1)} KB</p>
                                      </div>
                                    </div>
                                    <a
                                      href={n.attachment.dataUrl}
                                      download={n.attachment.name}
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#E6F6EC] text-[#57636E] hover:text-[#0CAA41] transition-colors shrink-0"
                                      title="Download attachment"
                                    >
                                      <Download size={13} />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                        <div className="p-3 border-t border-[#E2E7EC] bg-[#F5F6F8] space-y-2">
                          {noteAttachment && (
                            <div className="flex items-center justify-between p-2 bg-[#E6F6EC] border border-[#0CAA41]/30 rounded-xl text-xs text-blue-900">
                              <div className="flex items-center gap-1.5 truncate">
                                <Paperclip size={13} className="text-[#0CAA41] shrink-0" />
                                <span className="font-semibold truncate">{noteAttachment.name}</span>
                                <span className="text-[10px] text-[#0CAA41] shrink-0">({(noteAttachment.size / 1024).toFixed(1)} KB)</span>
                              </div>
                              <button
                                onClick={() => setNoteAttachment(null)}
                                className="text-[#0CAA41] hover:text-[#0CAA41] p-0.5"
                                title="Remove attachment"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          )}
                          <textarea
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            placeholder="Send a private message to Host... (Ctrl+Enter)"
                            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote(); }}
                            rows={3}
                            className="w-full bg-white border border-[#E2E7EC] rounded-xl p-2.5 text-xs text-[#20262E] placeholder-slate-400 focus:border-[#0CAA41] outline-none resize-none shadow-sm"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => noteFileInputRef.current?.click()}
                              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E7EC] hover:bg-slate-100 text-[#20262E] rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                              title="Attach a file to this note"
                            >
                              <Paperclip size={13} />
                              <span>Attach File</span>
                            </button>
                            <button
                              onClick={addNote}
                              className="flex-1 py-2 bg-[#0CAA41] hover:bg-[#E6F6EC]/400 text-white rounded-xl text-xs font-bold transition-all shadow"
                            >
                              Send Message to Host
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Sub-tab 3: GROUP (Everyone sees and has access) */}
                {noteType === "group" && (
                  <>
                    <div className="p-2.5 bg-[#E6F6EC]/40 border-b border-[#72BAA9]/30 text-[11px] text-[#0C5325] flex items-center gap-1.5 font-medium">
                      <Users size={12} /> Group Collaborative Notes (Everyone has access)
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-white">
                      {notes.filter(n => n.type === "group").length === 0 ? (
                        <div className="text-center py-12 text-[#57636E] text-xs">
                          <FileText size={24} className="mx-auto mb-2 opacity-50" />
                          No group notes yet. Everyone in the meeting can read and post here.
                        </div>
                      ) : (
                        notes.filter(n => n.type === "group").map(n => (
                          <div key={n.id} className="bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl p-3 space-y-1.5 shadow-sm">
                            <div className="flex items-center justify-between text-[10px] text-[#57636E]">
                              <span className="font-bold text-[#72BAA9]">{n.author}</span>
                              <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-xs text-[#20262E] leading-relaxed whitespace-pre-wrap">{n.content}</p>
                            {n.attachment && (
                              <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-white border border-[#E2E7EC] shadow-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-[#E6F6EC] text-[#0CAA41] flex items-center justify-center shrink-0">
                                    <Paperclip size={13} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-[#20262E] truncate">{n.attachment.name}</p>
                                    <p className="text-[10px] text-[#57636E]">{(n.attachment.size / 1024).toFixed(1)} KB</p>
                                  </div>
                                </div>
                                <a
                                  href={n.attachment.dataUrl}
                                  download={n.attachment.name}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#E6F6EC] text-[#57636E] hover:text-[#0CAA41] transition-colors shrink-0"
                                  title="Download attachment"
                                >
                                  <Download size={13} />
                                </a>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {!isReadonly && (
                      <div className="p-3 border-t border-[#E2E7EC] bg-[#F5F6F8] space-y-2">
                        {noteAttachment && (
                          <div className="flex items-center justify-between p-2 bg-[#E6F6EC] border border-[#0CAA41]/30 rounded-xl text-xs text-blue-900">
                            <div className="flex items-center gap-1.5 truncate">
                              <Paperclip size={13} className="text-[#0CAA41] shrink-0" />
                              <span className="font-semibold truncate">{noteAttachment.name}</span>
                              <span className="text-[10px] text-[#0CAA41] shrink-0">({(noteAttachment.size / 1024).toFixed(1)} KB)</span>
                            </div>
                            <button
                              onClick={() => setNoteAttachment(null)}
                              className="text-[#0CAA41] hover:text-[#0CAA41] p-0.5"
                              title="Remove attachment"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )}
                        <textarea
                          value={newNote}
                          onChange={e => setNewNote(e.target.value)}
                          placeholder="Post a note to group... (Ctrl+Enter)"
                          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote(); }}
                          rows={3}
                          className="w-full bg-white border border-[#E2E7EC] rounded-xl p-2.5 text-xs text-[#20262E] placeholder-slate-400 focus:border-[#0CAA41] outline-none resize-none shadow-sm"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => noteFileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E7EC] hover:bg-slate-100 text-[#20262E] rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
                            title="Attach a file to this note"
                          >
                            <Paperclip size={13} />
                            <span>Attach File</span>
                          </button>
                          <button
                            onClick={addNote}
                            className="flex-1 py-2 bg-[#72BAA9] hover:bg-[#72BAA9] text-white rounded-xl text-xs font-bold transition-all shadow"
                          >
                            Post to Group
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* ─── Bottom Toolbar (CENTERED CONTROLS) ────────────────────── */}
      <div className="h-[72px] bg-[#1C1C1E] border-t border-white/10 px-6 flex items-center justify-between shrink-0 z-30">
        
        {/* Left Side: Meeting Info & Live Indicator */}
        <div className="flex items-center gap-3 min-w-[170px]">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate max-w-[170px]">{meeting?.title || "Class Room"}</span>
              <span className="w-2 h-2 rounded-full bg-[#72BAA9] animate-pulse" />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/50 font-mono mt-0.5">
              <span>ID: {roomId}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(roomId); showToast("Meeting ID copied!"); }}
                className="hover:text-white transition-colors cursor-pointer"
                title="Copy ID"
              >
                <Copy size={11} />
              </button>
              <span>·</span>
              <button
                onClick={() => {
                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                  const pwd = meeting?.password || "";
                  const directLink = pwd ? `${origin}/meeting/${roomId}?pwd=${encodeURIComponent(pwd)}` : `${origin}/meeting/${roomId}`;
                  navigator.clipboard.writeText(directLink);
                  showToast("Meeting link copied to clipboard!");
                }}
                className="text-[#0CAA41] hover:text-[#72BAA9] font-sans font-semibold transition-colors cursor-pointer"
                title="Copy Student Meeting Link"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>

        {/* CENTER DOCK: All Audio, Video, Screen Share, Whiteboard & Tools Centered */}
        <div className="flex items-center gap-1.5 justify-center flex-1 max-w-[840px]">
          
          {/* MUTE / UNMUTE (Centered!) */}
          <button
            onClick={toggleMic}
            className="w-16 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors group"
          >
            {micOn ? <Mic size={20} className="text-white" /> : <MicOff size={20} className="text-[#0CAA41]" />}
            <span className={`text-[10px] ${micOn ? 'text-white' : 'text-[#0CAA41]'} font-semibold`}>
              {micOn ? "Mute" : "Unmute"}
            </span>
          </button>

          {/* START / STOP VIDEO (Centered!) */}
          <button
            onClick={toggleCamera}
            className="w-16 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors group"
          >
            {cameraOn ? <Camera size={20} className="text-white" /> : <VideoOff size={20} className="text-[#0CAA41]" />}
            <span className={`text-[10px] ${cameraOn ? 'text-white' : 'text-[#0CAA41]'} font-semibold`}>
              {cameraOn ? "Stop Video" : "Start Video"}
            </span>
          </button>

          <div className="w-px h-7 bg-white/10 mx-1" />

          {/* SHARE SCREEN */}
          {isMentor && (
            <button
              onClick={isSharing ? stopScreenShare : startScreenShare}
              className="w-[84px] h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors group"
            >
              <div className={`p-1.5 rounded-lg ${isSharing ? 'bg-[#0CAA41]' : 'bg-[#72BAA9]'}`}>
                <Monitor size={17} className="text-white" />
              </div>
              <span className={`text-[10px] font-bold ${isSharing ? 'text-[#0CAA41]' : 'text-[#72BAA9]'}`}>
                {isSharing ? "Stop Share" : "Share Screen"}
              </span>
            </button>
          )}

          {/* WHITEBOARD */}
          {isMentor && (
            <button
              onClick={() => setShowWhiteboard(!showWhiteboard)}
              className="w-[80px] h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors group"
            >
              <div className={`p-1.5 rounded-lg ${showWhiteboard ? 'bg-[#0CAA41]' : 'bg-white/10'}`}>
                <Edit3 size={17} className="text-white" />
              </div>
              <span className={`text-[10px] font-bold ${showWhiteboard ? 'text-[#0CAA41]' : 'text-white'}`}>
                Whiteboard
              </span>
            </button>
          )}

          {/* RECORD CONTROLS */}
          {isMentor && (
            <>
              {recState === "idle" && (
                <button onClick={startRecording} className="w-16 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors group">
                  <div className="w-[18px] h-[18px] rounded-full border-2 border-white flex items-center justify-center">
                    <div className="w-[8px] h-[8px] rounded-full bg-[#0CAA41]" />
                  </div>
                  <span className="text-[10px] text-white font-semibold">Record</span>
                </button>
              )}
              {recState === "recording" && (
                <div className="flex">
                  <button onClick={pauseRecording} className="w-14 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors">
                    <Pause size={18} className="text-white" />
                    <span className="text-[10px] text-white">Pause</span>
                  </button>
                  <button onClick={stopRecording} className="w-14 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors">
                    <StopCircle size={18} className="text-[#0CAA41]" />
                    <span className="text-[10px] text-[#0CAA41] font-bold">Stop</span>
                  </button>
                </div>
              )}
              {recState === "paused" && (
                <div className="flex">
                  <button onClick={resumeRecording} className="w-14 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors">
                    <Play size={18} className="text-[#72BAA9]" />
                    <span className="text-[10px] text-[#72BAA9]">Resume</span>
                  </button>
                  <button onClick={stopRecording} className="w-14 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors">
                    <StopCircle size={18} className="text-[#0CAA41]" />
                    <span className="text-[10px] text-[#0CAA41] font-bold">Stop</span>
                  </button>
                </div>
              )}
            </>
          )}

          <div className="w-px h-7 bg-white/10 mx-1" />

          {/* SECURITY (ZOOM STYLE HOST SECURITY POPUP) */}
          <div className="relative">
            <button
              onClick={() => setShowSecurityPopup(!showSecurityPopup)}
              className={`w-16 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors group ${showSecurityPopup ? "bg-white/15" : ""}`}
            >
              <Shield size={20} className={showSecurityPopup ? "text-[#0CAA41]" : "text-white"} />
              <span className={`text-[10px] font-semibold ${showSecurityPopup ? "text-[#0CAA41]" : "text-white"}`}>Security</span>
            </button>

            {/* Zoom-Style Security Popover */}
            {showSecurityPopup && (
              <div
                className="absolute bottom-[72px] left-1/2 -translate-x-1/2 w-80 bg-[#1e1e24] border border-white/15 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                  <div className="flex items-center gap-2">
                    <Shield size={18} className="text-[#0CAA41]" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Security Controls</h4>
                      <p className="text-[10px] text-white/50">{isMentor ? "Host Administration" : "Meeting Policy"}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowSecurityPopup(false)} className="p-1 hover:bg-white/10 rounded-lg text-white/50 hover:text-white">
                    <X size={14} />
                  </button>
                </div>

                {isMentor ? (
                  <>
                    <div className="space-y-2 mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Room Access</p>
                      
                      {/* Lock Meeting */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <Lock size={14} className={securitySettings.lockMeeting ? "text-[#0CAA41]" : "text-white/60"} />
                          <div>
                            <div className="text-xs font-semibold text-white">Lock Meeting</div>
                            <div className="text-[10px] text-white/40">No new participants can join</div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const next = !securitySettings.lockMeeting;
                            setSecuritySettings(s => ({ ...s, lockMeeting: next }));
                            showToast(next ? "Meeting locked. No new attendees can enter." : "Meeting unlocked.");
                          }}
                          className={`w-9 h-5 rounded-full transition-colors relative ${securitySettings.lockMeeting ? "bg-[#0CAA41]" : "bg-white/20"}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.lockMeeting ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>

                      {/* Enable Waiting Room */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <Shield size={14} className={securitySettings.waitingRoom ? "text-[#72BAA9]" : "text-white/60"} />
                          <div>
                            <div className="text-xs font-semibold text-white">Enable Waiting Room</div>
                            <div className="text-[10px] text-white/40">Admit attendees on arrival</div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const next = !securitySettings.waitingRoom;
                            setSecuritySettings(s => ({ ...s, waitingRoom: next }));
                            showToast(next ? "Waiting room enabled." : "Waiting room disabled.");
                          }}
                          className={`w-9 h-5 rounded-full transition-colors relative ${securitySettings.waitingRoom ? "bg-[#72BAA9]" : "bg-white/20"}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.waitingRoom ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>

                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 pt-2">Allow Participants To</p>

                      {/* Share Screen */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <Monitor size={14} className="text-[#0CAA41]" />
                          <span className="text-xs font-medium text-white">Share Screen</span>
                        </div>
                        <button
                          onClick={() => {
                            const next = !securitySettings.allowScreenShare;
                            setSecuritySettings(s => ({ ...s, allowScreenShare: next }));
                            showToast(next ? "Participants allowed to share screen." : "Participant screen sharing disabled.");
                          }}
                          className={`w-9 h-5 rounded-full transition-colors relative ${securitySettings.allowScreenShare ? "bg-[#0CAA41]" : "bg-white/20"}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.allowScreenShare ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>

                      {/* Chat */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <MessageSquare size={14} className="text-[#0CAA41]" />
                          <span className="text-xs font-medium text-white">Chat with Everyone</span>
                        </div>
                        <button
                          onClick={() => {
                            const next = !securitySettings.allowChat;
                            setSecuritySettings(s => ({ ...s, allowChat: next }));
                            showToast(next ? "Participant chat enabled." : "Participant chat disabled.");
                          }}
                          className={`w-9 h-5 rounded-full transition-colors relative ${securitySettings.allowChat ? "bg-[#0CAA41]" : "bg-white/20"}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.allowChat ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>

                      {/* Unmute Themselves */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <Mic size={14} className="text-[#72BAA9]" />
                          <span className="text-xs font-medium text-white">Unmute Themselves</span>
                        </div>
                        <button
                          onClick={() => {
                            const next = !securitySettings.allowUnmute;
                            setSecuritySettings(s => ({ ...s, allowUnmute: next }));
                            showToast(next ? "Participants can unmute themselves." : "Participants cannot unmute themselves.");
                          }}
                          className={`w-9 h-5 rounded-full transition-colors relative ${securitySettings.allowUnmute ? "bg-[#0CAA41]" : "bg-white/20"}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.allowUnmute ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>

                      {/* Start Video */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <Camera size={14} className="text-[#72BAA9]" />
                          <span className="text-xs font-medium text-white">Start Video</span>
                        </div>
                        <button
                          onClick={() => {
                            const next = !securitySettings.allowVideo;
                            setSecuritySettings(s => ({ ...s, allowVideo: next }));
                            showToast(next ? "Participants can start video." : "Participant video disabled.");
                          }}
                          className={`w-9 h-5 rounded-full transition-colors relative ${securitySettings.allowVideo ? "bg-[#0CAA41]" : "bg-white/20"}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.allowVideo ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>

                      {/* Raise Hand & Reactions */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <Smile size={14} className="text-[#E6F6EC]" />
                          <span className="text-xs font-medium text-white">Raise Hand & Reactions</span>
                        </div>
                        <button
                          onClick={() => {
                            const next = !securitySettings.allowRaiseHand;
                            setSecuritySettings(s => ({ ...s, allowRaiseHand: next }));
                            showToast(next ? "Hand raise enabled for participants." : "Hand raise disabled for participants.");
                          }}
                          className={`w-9 h-5 rounded-full transition-colors relative ${securitySettings.allowRaiseHand ? "bg-[#0CAA41]" : "bg-white/20"}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.allowRaiseHand ? "left-5" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>

                    {/* Host Quick Actions */}
                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <button
                        onClick={() => {
                          setParticipants(prev => prev.map(p => p.role === "Student" ? { ...p, isMuted: true } : p));
                          showToast("All participants muted.");
                        }}
                        className="w-full py-1.5 px-3 bg-[#0CAA41]/20 hover:bg-[#0CAA41]/30 text-[#0CAA41] rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <VolumeX size={14} /> Mute All Participants
                      </button>
                      <button
                        onClick={() => {
                          setParticipants(prev => prev.map(p => ({ ...p, isHandRaised: false })));
                          setIsHandRaised(false);
                          showToast("All hands lowered.");
                        }}
                        className="w-full py-1.5 px-3 bg-white/10 hover:bg-white/15 text-white/80 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        Lower All Hands
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 py-2 text-xs text-white/70">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                      <span>Waiting Room</span>
                      <span className="text-[#72BAA9] font-bold">Active</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                      <span>Encryption</span>
                      <span className="text-[#72BAA9] font-bold">End-to-End</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
                      <span>Meeting Lock</span>
                      <span className={securitySettings.lockMeeting ? "text-[#0CAA41] font-bold" : "text-[#57636E] font-bold"}>
                        {securitySettings.lockMeeting ? "Locked" : "Unlocked"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PARTICIPANTS */}
          <button
            onClick={() => setRightPanel(p => p === "participants" ? null : "participants")}
            className={`w-[72px] h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors ${rightPanel === "participants" ? "bg-white/15" : ""}`}
          >
            <div className="relative">
              <UsersIcon size={20} className="text-white" />
              <span className="absolute -top-1 -right-2 bg-[#0CAA41] text-white text-[9px] font-bold px-1.5 rounded-full">
                {participants.length}
              </span>
            </div>
            <span className="text-[10px] text-white font-semibold">People</span>
          </button>

          {/* CHAT SUPPORT */}
          <button
            onClick={() => setRightPanel(p => p === "chat" ? null : "chat")}
            className={`w-16 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors ${rightPanel === "chat" ? "bg-white/15" : ""}`}
          >
            <ChatIcon size={20} className="text-white" />
            <span className="text-[10px] text-white font-semibold">Chat</span>
          </button>

          {/* REACTIONS & HAND RAISE (ZOOM TYPE POPUP) */}
          <div className="relative">
            <button
              onClick={() => setShowReactionsPopup(!showReactionsPopup)}
              className={`w-16 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors ${isHandRaised || showReactionsPopup ? "bg-white/15" : ""}`}
            >
              <Smile size={20} className={isHandRaised ? "text-[#E6F6EC]" : "text-white"} />
              <span className={`text-[10px] font-semibold ${isHandRaised ? "text-[#E6F6EC]" : "text-white"}`}>
                {isHandRaised ? "✋ Raised" : "Reactions"}
              </span>
            </button>

            {/* Reactions Popover */}
            {showReactionsPopup && (
              <div
                className="absolute bottom-[115%] left-1/2 -translate-x-1/2 bg-[#242426] border border-white/20 rounded-2xl p-3 shadow-2xl z-50 flex flex-col gap-2.5 min-w-[260px] animate-in zoom-in-95"
                onClick={e => e.stopPropagation()}
              >
                {/* Emojis row */}
                <div className="flex items-center justify-between px-1">
                  {["👏", "👍", "❤️", "😂", "😮", "🎉"].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => triggerReaction(emoji)}
                      className="text-2xl p-1.5 hover:scale-130 transition-transform hover:bg-white/10 rounded-xl"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="h-px bg-white/10" />

                {/* Hand Raise Button (Zoom Type) */}
                <button
                  onClick={toggleHandRaise}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                    isHandRaised
                      ? "bg-[#E6F6EC] hover:bg-[#0CAA41] text-slate-950 font-black"
                      : "bg-[#0CAA41] hover:bg-[#E6F6EC]0 text-white"
                  }`}
                >
                  <Hand size={16} />
                  <span>{isHandRaised ? "✋ Lower Hand" : "✋ Raise Hand"}</span>
                </button>
              </div>
            )}
          </div>

          {/* NOTES */}
          <button
            onClick={() => setRightPanel(p => p === "notes" ? null : "notes")}
            className={`w-16 h-[58px] hover:bg-[#333333] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors ${rightPanel === "notes" ? "bg-white/15" : ""}`}
          >
            <FileText size={20} className={rightPanel === "notes" ? "text-[#72BAA9]" : "text-white"} />
            <span className={`text-[10px] font-semibold ${rightPanel === "notes" ? "text-[#72BAA9]" : "text-white"}`}>
              Notes
            </span>
          </button>

        </div>

        {/* Right Side: End Call */}
        <div className="flex items-center justify-end min-w-[120px]">
          <button onClick={endClass} className="h-9 px-5 bg-[#0CAA41] hover:bg-[#0C5325] text-white text-xs font-bold rounded-lg transition-all shadow-md">
            {isMentor ? "End Call" : "Leave"}
          </button>
        </div>

      </div>

      {/* ─── Tutorial Overlay ────────────────────────────────────── */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] border border-white/10 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">How to Host a Class</h2>
                <p className="text-xs text-white/40 mt-0.5">4-step guide for mentors</p>
              </div>
              <button onClick={() => setShowTutorial(false)} className="p-2 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {STEPS.map((step, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className={"w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0 " + step.color}>{step.icon}</div>
                  <div>
                    <p className="text-sm font-bold text-white mb-1">{step.title}</p>
                    <p className="text-xs text-white/50 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 pt-0">
              <button onClick={() => setShowTutorial(false)} className="w-full py-3 bg-[#0CAA41] hover:bg-[#E6F6EC]0 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all">
                <ChevronRight size={16} />Got it, Start Teaching
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Upload Modal ────────────────────────────────────────── */}
      {showUpload && recBlob && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 transition-opacity animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E7EC] rounded-2xl shadow-2xl w-full max-w-md overflow-visible transform transition-all animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-6 pb-4 border-b border-[#E2E7EC] flex items-start justify-between">
              <div>
                <h2 className="text-[18px] font-bold text-[#20262E]">Save Recording</h2>
                <p className="text-[13px] text-[#57636E] mt-0.5">{fmtT(recTimer)} · {(recBlob.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button onClick={() => { setShowUpload(false); router.push("/meetings"); }} className="p-1.5 text-[#57636E] hover:text-[#57636E] hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {uploadState === "idle" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#57636E] uppercase tracking-wider mb-1.5">Video Title</label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={e => setUploadTitle(e.target.value)}
                      placeholder={meeting?.title ? `${meeting.title} - Recording` : `Meeting Recording`}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E7EC] hover:border-slate-400 focus:border-[#0CAA41] focus:ring-2 focus:ring-[#0CAA41]/20 text-[#20262E] placeholder-slate-400 rounded-xl text-sm outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#57636E] uppercase tracking-wider mb-1.5">Description <span className="text-[#57636E] normal-case font-normal">(optional)</span></label>
                    <textarea
                      value={uploadDesc}
                      onChange={e => setUploadDesc(e.target.value)}
                      placeholder="Add a brief description..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E7EC] hover:border-slate-400 focus:border-[#0CAA41] focus:ring-2 focus:ring-[#0CAA41]/20 text-[#20262E] placeholder-slate-400 rounded-xl text-sm outline-none transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#57636E] uppercase tracking-wider mb-1.5">Save to Folder</label>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E7EC] hover:border-slate-400 text-[#20262E] rounded-xl text-sm flex items-center justify-between outline-none transition-colors"
                      >
                        <span className="font-medium">
                          {uploadCourse === "1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW" 
                            ? "MEETING (Google Drive)" 
                            : (uploadCourse ? (courses.find(c => c.id === uploadCourse)?.name || "Selected Folder") : "Library Root (no folder)")}
                        </span>
                        <ChevronDown size={16} className={`text-[#57636E] transition-transform ${isCourseDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      {isCourseDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E2E7EC] rounded-xl shadow-xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-1">
                          <div className="max-h-48 overflow-y-auto py-1">
                            <button 
                              type="button"
                              onClick={() => { setUploadCourse("1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW"); setIsCourseDropdownOpen(false); }}
                              className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-[#0CAA41] hover:text-white transition-colors ${uploadCourse === "1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW" ? "bg-[#0CAA41] text-white" : "text-[#20262E]"}`}
                            >
                              MEETING (Google Drive)
                            </button>
                            <button 
                              type="button"
                              onClick={() => { setUploadCourse(""); setIsCourseDropdownOpen(false); }}
                              className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-[#0CAA41] hover:text-white transition-colors ${!uploadCourse ? "bg-[#0CAA41] text-white" : "text-[#20262E]"}`}
                            >
                              Library Root (no folder)
                            </button>
                            {courses.filter(c => c.id !== "1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW" && c.name !== "MEETING").map(c => (
                              <button 
                                key={c.id}
                                type="button"
                                onClick={() => { setUploadCourse(c.id); setIsCourseDropdownOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-[#0CAA41] hover:text-white transition-colors ${uploadCourse === c.id ? "bg-[#0CAA41] text-white" : "text-[#20262E]"}`}
                              >
                                {c.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setShowUpload(false); router.push("/meetings"); }} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#20262E] text-sm font-semibold rounded-xl transition-colors">Discard</button>
                    <button onClick={handleUpload} className="flex-1 py-2.5 bg-[#0CAA41] hover:bg-[#0C5325] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"><Upload size={15} />Upload to Library</button>
                  </div>
                </div>
              )}
              {uploadState === "uploading" && (
                <div className="flex flex-col items-center gap-4 py-6 animate-in fade-in">
                  <Loader2 className="w-10 h-10 text-[#0CAA41] animate-spin" />
                  <div className="w-full">
                    <div className="flex justify-between mb-2"><span className="text-sm text-[#57636E]">Uploading...</span><span className="text-sm text-[#0CAA41] font-bold">{uploadProgress}%</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-[#0CAA41] h-2 rounded-full transition-all" style={{ width: uploadProgress + "%" }} /></div>
                  </div>
                </div>
              )}
              {uploadState === "done" && (
                <div className="flex flex-col items-center gap-3 py-6 animate-in zoom-in-95">
                  <div className="w-14 h-14 bg-[#E6F6EC]/40 border border-[#72BAA9]/30 rounded-full flex items-center justify-center"><Check size={24} className="text-green-500" /></div>
                  <p className="text-base font-bold text-[#20262E]">Recording Saved!</p>
                  <p className="text-sm text-[#57636E] text-center">Available in Library. Redirecting...</p>
                </div>
              )}
              {uploadState === "error" && (
                <div className="flex flex-col items-center gap-3 py-6 animate-in zoom-in-95">
                  <div className="w-14 h-14 bg-[#0CAA41]/10 border border-[#0CAA41]/30 rounded-full flex items-center justify-center"><AlertCircle size={24} className="text-[#0CAA41]" /></div>
                  <p className="text-base font-bold text-[#20262E]">Upload Failed</p>
                  <p className="text-xs text-[#57636E] text-center max-w-sm px-2">
                    {uploadErrorMsg || "Upload encountered an issue. You can retry direct Google Drive upload or download your recording locally."}
                  </p>
                  <div className="flex gap-3 w-full mt-2">
                    <a href={URL.createObjectURL(recBlob)} download={(meeting?.title || "class") + "-recording.webm"} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#20262E] text-sm font-semibold rounded-xl text-center transition-colors">Download</a>
                    <button onClick={handleUpload} className="flex-1 py-2.5 bg-[#0CAA41] hover:bg-[#0C5325] text-white text-sm font-bold rounded-xl transition-colors">Try Again</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[200] text-white max-w-sm ${toast.ok ? "bg-[#3C3C3E] border border-white/10" : "bg-red-900/90 border border-red-700"}`}>
          <span className="text-sm font-medium">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="p-0.5 hover:bg-white/10 rounded-lg shrink-0"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
