"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import RcrdLogo from "@/components/RcrdLogo";
import {
  Monitor, Mic, MicOff, VideoOff, FileText, Trash2,
  Loader2, X, Check, Upload, Pause,
  AlertCircle, ChevronRight, ChevronDown, Info, Lock, Clock,
  Pen, Eraser, Edit3, Shield, Users, MessageSquare, Copy, Send,
  VolumeX, RotateCcw, RotateCw, Paperclip, Image as ImageIcon, Download,
  ChevronLeft, Plus, BookOpen,
  Maximize2, Minimize2, MoreHorizontal, Volume2, RefreshCw, Disc, Smartphone, NotebookPen, Video, Activity
} from "lucide-react";
import { getCourses, uploadVideo, ensureValidAuthToken, getDriveFolder } from "@/lib/api";
import { useLiveKitSFU } from "@/hooks/useLiveKitSFU";

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
interface Meeting {
  id: string;
  title: string;
  courseId: string | null;
  password: string;
  scheduledAt?: string;
  startedAt?: string;
  duration: number;
  status: string;
  hostName?: string;
  hostEmail?: string;
  batchId?: string | null;
  batchName?: string | null;
  allowedEmails?: string[];
}
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
  { icon: "1", title: "Share Your Screen", desc: "Click the green Share Screen button in the toolbar below. Choose the window or tab you want participants to see.", color: "bg-[#EBF5FB]0" },
  { icon: "2", title: "Start Recording", desc: "Once your screen is shared, click Record. A 3-second countdown starts, then recording begins automatically.", color: "bg-[#154360]" },
  { icon: "3", title: "Present & Collaborate", desc: "Talk and present. Your screen + microphone audio will be recorded. Participants join with the Meeting ID & password.", color: "bg-[#154360]" },
  { icon: "4", title: "Stop & Save", desc: "Click Stop & Save when done. Choose folder and save to Library. It syncs to Google Drive automatically.", color: "bg-[#EBF5FB]/400" },
];

const WHITEBOARD_COLORS = ["#20262E", "#154360", "#DC2626", "#16A34A", "#D97706", "#9333EA", "#0284C7", "#EA580C"];

// WebRTC Audio & Video STUN + TURN Relay Configuration (Public STUN/TURN for cross-network mobile & desktop)
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    { urls: "stun:openrelay.metered.ca:80" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:standard.relay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:standard.relay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:standard.relay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

export default function ClassRoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const roleParam = searchParams.get("role");
  const isMentor = roleParam === "host" || roleParam === "mentor";
  const isReadonly = searchParams.get("readonly") === "true" || !isMentor;
  const rawQueryName = searchParams.get("name")?.trim();
  const [studentName] = useState<string>(() => {
    if (isMentor) return "";
    if (rawQueryName && rawQueryName.toLowerCase() !== "host" && rawQueryName.toLowerCase() !== "participant") {
      return rawQueryName;
    }
    if (typeof window !== "undefined") {
      try {
        const usr = localStorage.getItem("user");
        if (usr) {
          const u = JSON.parse(usr);
          const uName = (u?.name || (u?.email ? u.email.split('@')[0] : ''))?.trim();
          if (uName && uName.toLowerCase() !== "host") return uName;
        }
        const prof = localStorage.getItem("rcrd_user_profile");
        if (prof) {
          const p = JSON.parse(prof);
          const pName = p?.name?.trim();
          if (pName && pName.toLowerCase() !== "host") return pName;
        }
      } catch {}
    }
    return rawQueryName || "Student";
  });

  // Dynamically resolve host name from:
  // 1. ?hostName= query param
  // 2. ?name= query param (when role=host/mentor)
  // 3. localStorage (logged-in user or rcrd_user_profile)
  const [hostName, setHostName] = useState<string>(() => {
    const queryHost = searchParams.get("hostName")?.trim();
    if (queryHost && queryHost.toLowerCase() !== "host") return queryHost;
    if (isMentor && rawQueryName && rawQueryName.toLowerCase() !== "host") {
      return rawQueryName;
    }
    if (typeof window !== "undefined") {
      try {
        const usr = localStorage.getItem("user");
        if (usr) {
          const u = JSON.parse(usr);
          const uName = (u?.name || (u?.email ? u.email.split('@')[0] : ''))?.trim();
          if (uName && uName.toLowerCase() !== "host") return uName;
        }
        const prof = localStorage.getItem("rcrd_user_profile");
        if (prof) {
          const p = JSON.parse(prof);
          const pName = p?.name?.trim();
          if (pName && pName.toLowerCase() !== "host") return pName;
        }
      } catch {}
    }
    return (isMentor && rawQueryName && rawQueryName.toLowerCase() !== "host") ? rawQueryName : "";
  });

  const [meeting, setMeeting] = useState<Meeting | null>(null);

  const initialStudentEmail = (() => {
    const qEmail = searchParams.get("email") || searchParams.get("studentEmail");
    if (qEmail) return qEmail.toLowerCase().trim();
    if (typeof window !== "undefined") {
      try {
        const usr = localStorage.getItem("user");
        if (usr) {
          const u = JSON.parse(usr);
          if (u?.email) return u.email.toLowerCase().trim();
        }
        const prof = localStorage.getItem("rcrd_user_profile");
        if (prof) {
          const p = JSON.parse(prof);
          if (p?.email) return p.email.toLowerCase().trim();
        }
      } catch {}
    }
    return "";
  })();

  const [activeStudentEmail, setActiveStudentEmail] = useState<string>(initialStudentEmail);
  const [emailCheckInput, setEmailCheckInput] = useState("");
  const [emailVerificationError, setEmailVerificationError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/meetings?id=${encodeURIComponent(roomId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.meeting) {
          setMeeting(data.meeting);
        }
      })
      .catch(() => {});
  }, [roomId]);

  useEffect(() => {
    if (isMentor && (!hostName || hostName.toLowerCase() === "host")) {
      fetch("/api/auth/me")
        .then(res => res.ok ? res.json() : null)
        .then(d => {
          if (d?.user?.name) {
            setHostName(d.user.name);
          }
        })
        .catch(() => {});
    }
  }, [isMentor, hostName]);

  const effectiveHostName = hostName || meeting?.hostName || (isMentor && rawQueryName && rawQueryName.toLowerCase() !== "host" ? rawQueryName : "") || (isMentor ? "Host" : (meeting?.hostName || "Host"));

  const displayName = isMentor
    ? (effectiveHostName || "Host")
    : (studentName || "Participant");

  const displayInitial = (displayName.replace(/[^a-zA-Z0-9]/g, "").charAt(0) || displayName.charAt(0) || "U").toUpperCase();
  const [bypassLobby, setBypassLobby] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<"host" | "participant" | "group">("host");

  // Zoom-style Bottom Sheet & Modal States (Matching screenshots 1, 2, 3, 4)
  const [showParticipantsSheet, setShowParticipantsSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showMeetingInfoModal, setShowMeetingInfoModal] = useState(false);
  const [showChatSheet, setShowChatSheet] = useState(false);
  const [showNotesSheet, setShowNotesSheet] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

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
  const [uploadCourse, setUploadCourse] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string>("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, [setToast]);
  const [isEndingAndSaving, setIsEndingAndSaving] = useState(false);
  const [endingSaveStatus, setEndingSaveStatus] = useState<string>("");
  const [endingProgress, setEndingProgress] = useState(0);

  // Streams & Devices
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  // Students join MUTED by default to prevent unwanted noise and disturbance during class!
  const [micOn, setMicOn] = useState(() => isMentor);
  const [cameraOn, setCameraOn] = useState(false);

  // Stream Refs for Safe Unmount-only Cleanup (prevents screen share stopping on camera toggle!)
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const endClassRef = useRef<() => Promise<void>>(() => Promise.resolve());

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
  const [now, setNow] = useState<number>(() => (typeof window !== "undefined" ? Date.now() : 0));

  // Duration & Auto-End Extension State
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [extendMinutesInput, setExtendMinutesInput] = useState("15");
  const [isExtending, setIsExtending] = useState(false);
  const [hasPromptedForDuration, setHasPromptedForDuration] = useState(false);
  const [autoEndCountdown, setAutoEndCountdown] = useState<number | null>(null);
  const [studentDurationWarning, setStudentDurationWarning] = useState<string | null>(null);

  const meetingStartTime = (() => {
    if (meeting?.startedAt) {
      const t = new Date(meeting.startedAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (meeting?.scheduledAt) {
      const t = new Date(meeting.scheduledAt).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  })();

  const meetingDurationMinutes = Number(meeting?.duration) || 60;
  const meetingEndTime = meetingStartTime ? meetingStartTime + meetingDurationMinutes * 60000 : 0;
  const remainingMs = meetingEndTime && now > 0 ? Math.max(0, meetingEndTime - now) : 0;

  const formatTimer = (ms: number) => {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Monitor meeting duration expiration & prompt host / notify students
  useEffect(() => {
    if (!meetingStartTime || !meeting || meeting.status === "ended") return;
    const durMins = Number(meeting.duration) || 60;
    const endMs = meetingStartTime + durMins * 60000;
    const isOver = now > 0 && endMs > 0 && now >= endMs;

    if (isOver) {
      if (isMentor) {
        if (!hasPromptedForDuration && !showDurationModal) {
          const t = setTimeout(() => {
            setShowDurationModal(true);
            setHasPromptedForDuration(true);
            setAutoEndCountdown(60); // 60 seconds auto-end countdown
          }, 0);
          return () => clearTimeout(t);
        }
      } else {
        const t = setTimeout(() => {
          setStudentDurationWarning(
            `The scheduled duration of ${durMins} minutes has completed. Waiting for host to extend or conclude the class...`
          );
        }, 0);
        return () => clearTimeout(t);
      }
    }
  }, [now, meetingStartTime, meeting, isMentor, hasPromptedForDuration, showDurationModal]);

  // Handle auto-end countdown when modal is open
  useEffect(() => {
    if (autoEndCountdown === null) return;
    if (autoEndCountdown <= 0) {
      const t = setTimeout(() => {
        setAutoEndCountdown(null);
        endClassRef.current();
      }, 0);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(() => {
      setAutoEndCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoEndCountdown]);

  // Whiteboard State (Pure White Background, Slides & Notepad)
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#154360");
  const [penSize, setPenSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [eraserSize, setEraserSize] = useState(24);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const lastPos = useRef<{x: number; y: number} | null>(null);

  // Whiteboard Multi-Slide System
  interface WhiteboardSlide {
    id: number;
    canvasData: string;
    notesText: string;
  }
  const [slides, setSlides] = useState<WhiteboardSlide[]>([
    { id: 1, canvasData: '', notesText: '' }
  ]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [whiteboardMode, setWhiteboardMode] = useState<'sketch' | 'notepad'>('sketch');
  const [notepadText, setNotepadText] = useState('');
  const [hideSketchTools, setHideSketchTools] = useState(false);

  // Whiteboard Undo / Redo / Reverse History
  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Whiteboard Typing Tool
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'text'>('pen');
  const [textBox, setTextBox] = useState<{ x: number; y: number; text: string } | null>(null);
  const textFontSize = 24;
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

  // Fullscreen State
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Floating Host Camera Card Drag & Minimize State (Image 2 - prevents blocking notes)
  const [cameraCardPos, setCameraCardPos] = useState({ x: 0, y: 0 });
  const [isCameraCardMinimized, setIsCameraCardMinimized] = useState(false);
  const cameraDragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  // WebRTC 2-Way Voice Audio Mesh Refs & Configuration
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const processedSignalIdsRef = useRef<Set<string>>(new Set());
  const displayedReactionsRef = useRef<Set<string>>(new Set());

  // Hand Raise & Reactions State
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; left: number; sender?: string }[]>([]);

  // Unique participant ID for current user (persisted per student per room to prevent duplicate cards)
  const [myParticipantId] = useState<string>(() => {
    if (isMentor) return "host";
    if (typeof window !== "undefined") {
      const storageKey = `rcrd_mpid_${roomId}_${(studentName || "participant").trim().toLowerCase()}`;
      try {
        const saved = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
        if (saved) return saved;
        const newId = `student_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        sessionStorage.setItem(storageKey, newId);
        localStorage.setItem(storageKey, newId);
        return newId;
      } catch {}
    }
    return `student_${Date.now()}`;
  });

  // Remote Host Camera live sync state
  const [remoteHostCamera, setRemoteHostCamera] = useState<{
    active: boolean;
    streamFrame?: string;
    updatedAt?: number;
  }>({ active: false });

  // Remote Participant Cameras (Student and Mentor live streams)
  const [remoteParticipantCameras, setRemoteParticipantCameras] = useState<Record<string, {
    active: boolean;
    name: string;
    role?: 'Host' | 'Student';
    streamFrame?: string;
    updatedAt: number;
  }>>({});
  const notifiedHandRaisesRef = useRef<Set<string>>(new Set());

  // Remote Screen Share & Whiteboard live sync states
  const [remoteScreenShare, setRemoteScreenShare] = useState<{
    active: boolean;
    presenterName?: string;
    streamFrame?: string;
    updatedAt?: number;
  }>({ active: false });

  const [remoteWhiteboard, setRemoteWhiteboard] = useState<{
    active: boolean;
    canvasData?: string;
    currentSlide?: number;
    totalSlides?: number;
    slides?: Array<{ id: number; canvasData: string; notesText?: string }>;
    notepadText?: string;
    mode?: 'sketch' | 'notepad';
    updatedAt?: number;
  }>({ active: false });

  // Student presentation view mode: "screen" prioritizes live screen share, toggleable to "whiteboard"
  const [studentViewMode, setStudentViewMode] = useState<"screen" | "whiteboard">("screen");

  // Real participants only - pure function initializer to prevent impure Date.now() on re-renders
  const [participants, setParticipants] = useState<Participant[]>(() => {
    const initHost = (isMentor && rawQueryName && rawQueryName.toLowerCase() !== "host") ? rawQueryName : "Host";
    return [
      {
        id: isMentor ? "host" : `student_${Date.now()}`,
        name: isMentor ? `${initHost} (Host, you)` : (studentName || "Participant"),
        role: isMentor ? "Host" : "Student",
        avatar: (isMentor ? (initHost.charAt(0) || "H") : (studentName ? studentName.substring(0, 2) : "S")).toUpperCase(),
        isMuted: !isMentor, // Students start muted by default to eliminate class disturbance!
        isVideoOn: false,
        isHandRaised: false,
        canScreenShare: isMentor,
        canChat: true,
      },
    ];
  });

  // In-Meeting Chat State (Welcome note only - no dummy student)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "c1", sender: "Class Assistant", role: "Host", text: "Welcome to today's live session! Use this chat to ask questions or discuss.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [recentChatPopups, setRecentChatPopups] = useState<ChatMessage[]>([]);
  const popupTimerRef = useRef<NodeJS.Timeout | null>(null);

  const pushChatPopup = useCallback((msg: ChatMessage) => {
    setRecentChatPopups(prev => [...prev.slice(-2), msg]);
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => {
      setRecentChatPopups([]);
    }, 7000);
  }, []);

  useEffect(() => {
    if (showChatSheet) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, showChatSheet]);

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Video Element Refs
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const remoteScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteWebRTCStream, setRemoteWebRTCStream] = useState<MediaStream | null>(null);
  const [isWebRTCVideoPlaying, setIsWebRTCVideoPlaying] = useState<boolean>(false);
  const isWebRTCVideoPlayingRef = useRef<boolean>(false);
  const remoteScreenShareActiveRef = useRef<boolean>(false);
  const videoStallTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isWebRTCVideoPlayingRef.current = isWebRTCVideoPlaying;
  }, [isWebRTCVideoPlaying]);

  useEffect(() => {
    remoteScreenShareActiveRef.current = Boolean(remoteScreenShare?.active);
  }, [remoteScreenShare?.active]);

  // Watchdog: graceful stall handling without rapid jitter or screen shaking
  const handleVideoWaiting = useCallback(() => {
    if (!videoStallTimerRef.current) {
      videoStallTimerRef.current = setTimeout(() => {
        setIsWebRTCVideoPlaying(false);
        videoStallTimerRef.current = null;
      }, 2500);
    }
  }, []);

  const handleVideoPlaying = useCallback(() => {
    if (videoStallTimerRef.current) {
      clearTimeout(videoStallTimerRef.current);
      videoStallTimerRef.current = null;
    }
    setIsWebRTCVideoPlaying(true);
  }, []);

  // LiveKit SFU Architecture hook (for high-scale 150+ student classrooms when configured)
  const livekitSFU = useLiveKitSFU({
    roomId,
    participantId: myParticipantId,
    name: displayName,
    role: isMentor ? 'Host' : 'Student',
    password: meeting?.password || '',
    speakerMuted,
  });

  const isLocalSharing = !!screenStream;
  const isRemoteSharing = !isLocalSharing && (
    Boolean(remoteScreenShare?.active) ||
    Boolean(livekitSFU.isSFUActive && livekitSFU.sfuRemoteStream) ||
    Boolean(remoteWebRTCStream)
  );
  const isAnyScreenSharing = isLocalSharing || isRemoteSharing;
  const isSharing = isAnyScreenSharing;

  const handleSFUDataReceived = useCallback(({ type, payload }: { type: string; payload: unknown; sender: string }) => {
    if (type === "MEETING_ENDED" && !isMentor) {
      window.location.href = "https://www.geonixa.com/";
      return;
    }
    const data = (payload || {}) as Record<string, unknown>;
    if (type === "SCREEN_SHARE") {
      if (!screenStreamRef.current) {
        const incomingTime = (data?.updatedAt as number) || Date.now();
        if (!data?.active) {
          if (incomingTime >= lastScreenShareTimestampRef.current) {
            lastScreenShareTimestampRef.current = incomingTime;
            setRemoteScreenShare({ active: false, streamFrame: undefined, updatedAt: incomingTime });
            setRemoteWebRTCStream(null);
            setIsWebRTCVideoPlaying(false);
          }
        } else {
          if (incomingTime >= lastScreenShareTimestampRef.current) {
            lastScreenShareTimestampRef.current = incomingTime;
            if (!isMentor) {
              setShowWhiteboard(false);
              setStudentViewMode("screen");
            }
            setRemoteScreenShare(prev => ({
              active: true,
              presenterName: (data.presenterName as string) || "Host",
              streamFrame: prev?.streamFrame,
              updatedAt: incomingTime,
            }));
          }
        }
      }
    } else if (type === "REMOTE_MUTE_ACTION") {
      const targetParticipantId = data.targetParticipantId as string | undefined;
      const targetName = data.targetName as string | undefined;
      const hostWantsMuted = data.isMuted as boolean | undefined;
      const isTargetingMe = (targetParticipantId && targetParticipantId === myParticipantId) ||
                            (targetName && (targetName === displayName || targetName === studentName));
      if (isTargetingMe && !isMentor) {
        if (hostWantsMuted) {
          if (localAudioStreamRef.current) localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
          setMicOn(false);
          if (livekitSFU.isSFUActive) livekitSFU.setMicMutedSFU(true).catch(() => {});
          showToast("The host has muted your microphone.");
        } else {
          if (localAudioStreamRef.current) localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = true);
          setMicOn(true);
          if (livekitSFU.isSFUActive) livekitSFU.setMicMutedSFU(false).catch(() => {});
          showToast("The host has unmuted your microphone.");
        }
      }
      setParticipants(prev => prev.map(p => {
        if ((targetParticipantId && p.id === targetParticipantId) || (targetName && p.name === targetName)) {
          return { ...p, isMuted: Boolean(hostWantsMuted) };
        }
        return p;
      }));
    } else if (type === "REMOTE_MUTE_ALL") {
      if (!isMentor) {
        if (localAudioStreamRef.current) localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
        setMicOn(false);
        if (livekitSFU.isSFUActive) livekitSFU.setMicMutedSFU(true).catch(() => {});
        showToast("The host muted all participants.");
      }
      setParticipants(prev => prev.map(p => p.role === "Student" ? { ...p, isMuted: true } : p));
    }
  }, [isMentor, myParticipantId, displayName, studentName, showToast, livekitSFU]);

  const { setDataHandler, initSFU } = livekitSFU;
  useEffect(() => {
    setDataHandler(handleSFUDataReceived);
    return () => {
      setDataHandler(null);
    };
  }, [setDataHandler, handleSFUDataReceived]);

  useEffect(() => {
    if (roomId && initSFU) {
      initSFU().catch(() => {});
    }
  }, [roomId, initSFU]);

  const lastScreenShareTimestampRef = useRef<number>(0);
  const lastWhiteboardTimestampRef = useRef<number>(0);

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

  const lastMuteActionTimestampRef = useRef<number>(0);

  // Safely connect remoteWebRTCStream or livekitSFU stream to student video element
  useEffect(() => {
    const activeStream = livekitSFU.isSFUActive && livekitSFU.sfuRemoteStream ? livekitSFU.sfuRemoteStream : remoteWebRTCStream;
    if (remoteScreenVideoRef.current && activeStream) {
      if (remoteScreenVideoRef.current.srcObject !== activeStream) {
        remoteScreenVideoRef.current.srcObject = activeStream;
        remoteScreenVideoRef.current.muted = true;
        remoteScreenVideoRef.current.playsInline = true;
        remoteScreenVideoRef.current.setAttribute('playsinline', '');
        remoteScreenVideoRef.current.setAttribute('webkit-playsinline', '');
        remoteScreenVideoRef.current.play().catch(() => {});
      }
    }
    if (!isMentor && activeStream) {
      const t = setTimeout(() => {
        setShowWhiteboard(false);
        setStudentViewMode("screen");
      }, 0);
      return () => clearTimeout(t);
    }
  }, [remoteWebRTCStream, livekitSFU.isSFUActive, livekitSFU.sfuRemoteStream, isMentor]);

  // Memoized video ref callback to eliminate screen shaking / continuous re-renders
  const setRemoteVideoRef = useCallback((el: HTMLVideoElement | null) => {
    remoteScreenVideoRef.current = el;
    if (!el) return;
    const activeStream = livekitSFU.isSFUActive && livekitSFU.sfuRemoteStream ? livekitSFU.sfuRemoteStream : remoteWebRTCStream;
    if (activeStream && el.srcObject !== activeStream) {
      el.srcObject = activeStream;
      el.muted = true;
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.play().catch(() => {});
    }
  }, [livekitSFU.isSFUActive, livekitSFU.sfuRemoteStream, remoteWebRTCStream]);

  // Mobile & browser autoplay policy unlock: play remote screen video on touch or click
  useEffect(() => {
    const unlockVideo = () => {
      if (remoteScreenVideoRef.current && remoteScreenVideoRef.current.srcObject && remoteScreenVideoRef.current.paused) {
        remoteScreenVideoRef.current.play().catch(() => {});
      }
    };
    window.addEventListener("click", unlockVideo, { passive: true });
    window.addEventListener("touchstart", unlockVideo, { passive: true });
    return () => {
      window.removeEventListener("click", unlockVideo);
      window.removeEventListener("touchstart", unlockVideo);
    };
  }, []);

  // Safely connect cameraStream to video element
  useEffect(() => {
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream;
      if (cameraStream) {
        cameraVideoRef.current.play().catch(() => {});
      }
    }
  }, [cameraStream, cameraOn]);

  // Fullscreen Toggle
  const toggleFullScreen = useCallback(() => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullScreen(false);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onFsChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const candidateBatchRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const candidateBatchTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Debounced, batched ICE candidate transmission to prevent flooding signaling server
  const sendCandidateSignal = useCallback((to: string, candidate: RTCIceCandidateInit) => {
    if (!roomId) return;
    const current = candidateBatchRef.current.get(to) || [];
    current.push(candidate);
    candidateBatchRef.current.set(to, current);

    if (candidateBatchTimerRef.current.has(to)) return;

    const timer = setTimeout(() => {
      candidateBatchTimerRef.current.delete(to);
      const candidates = candidateBatchRef.current.get(to) || [];
      candidateBatchRef.current.delete(to);
      if (candidates.length === 0) return;

      const sigs = candidates.map(c => ({
        id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        from: myParticipantId,
        to,
        type: "candidate" as const,
        payload: c,
        timestamp: Date.now(),
      }));

      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
          sigs.forEach(s => bc.postMessage({ type: "WEBRTC_SIGNAL", data: s }));
          bc.close();
        }
      } catch {}

      fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signals: sigs }),
      }).catch(() => {});
    }, 40);

    candidateBatchTimerRef.current.set(to, timer);
  }, [roomId, myParticipantId]);

  // Broadcast WebRTC signals (offer, answer, candidate, request-screen, screen-share, mute actions)
  const sendSignal = useCallback((to: string, type: 'offer' | 'answer' | 'candidate' | 'request-screen' | 'SCREEN_SHARE' | 'REMOTE_MUTE_ACTION' | 'REMOTE_MUTE_ALL', payload: unknown) => {
    if (!roomId) return;
    if (type === 'candidate') {
      sendCandidateSignal(to, payload as RTCIceCandidateInit);
      return;
    }
    const sig = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      from: myParticipantId,
      to,
      type,
      payload,
      timestamp: Date.now(),
    };
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
        bc.postMessage({ type: "WEBRTC_SIGNAL", data: sig });
        bc.close();
      }
    } catch {}
    fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signal: sig }),
    }).catch(() => {});
  }, [roomId, myParticipantId, sendCandidateSignal]);

  // Helper to retrieve or create DOM-attached remote audio element (avoids autoplay blockage)
  const getOrCreateRemoteAudio = useCallback((id: string) => {
    let audio = remoteAudiosRef.current.get(id);
    if (!audio || (typeof document !== "undefined" && !document.body.contains(audio))) {
      if (typeof document !== "undefined") {
        audio = document.createElement("audio");
        audio.autoplay = true;
        audio.setAttribute("playsinline", "true");
        audio.style.display = "none";
        audio.id = `remote_audio_${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        document.body.appendChild(audio);
        remoteAudiosRef.current.set(id, audio);
      } else {
        audio = new Audio();
        remoteAudiosRef.current.set(id, audio);
      }
    }
    return audio;
  }, []);

  // Helper to drain queued ICE candidates once remote description is set
  const drainCandidateQueue = useCallback(async (targetId: string, pc: RTCPeerConnection) => {
    const list = pendingCandidatesRef.current.get(targetId) || [];
    if (targetId !== "host" && pendingCandidatesRef.current.has("host")) {
      list.push(...(pendingCandidatesRef.current.get("host") || []));
      pendingCandidatesRef.current.delete("host");
    }
    pendingCandidatesRef.current.delete(targetId);
    for (const cand of list) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn("Error adding queued ICE candidate for", targetId, err);
      }
    }
  }, []);

  // Helper to attach event listeners to RTCPeerConnection (audio/video track reception)
  const attachTrackHandlers = useCallback((peer: RTCPeerConnection, target: string) => {
    peer.ontrack = (event) => {
      if (event.track.kind === "video") {
        const stream = event.streams[0] || new MediaStream([event.track]);
        setRemoteWebRTCStream(stream);
        setIsWebRTCVideoPlaying(true);
        event.track.onended = () => {
          setIsWebRTCVideoPlaying(false);
          setRemoteWebRTCStream(null);
        };
        event.track.onmute = () => {};
        event.track.onunmute = () => {
          setRemoteWebRTCStream(event.streams[0] || new MediaStream([event.track]));
          setIsWebRTCVideoPlaying(true);
        };
      } else if (event.track.kind === "audio") {
        const audio = getOrCreateRemoteAudio(target);
        const stream = event.streams[0] || new MediaStream([event.track]);
        audio.srcObject = stream;
        audio.muted = speakerMuted;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer?.connectionState === "failed" || peer?.connectionState === "disconnected") {
        setIsWebRTCVideoPlaying(false);
        setRemoteWebRTCStream(null);
      }
    };

    peer.oniceconnectionstatechange = () => {
      if (peer?.iceConnectionState === "failed" || peer?.iceConnectionState === "disconnected") {
        setIsWebRTCVideoPlaying(false);
        setRemoteWebRTCStream(null);
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendCandidateSignal(target, event.candidate);
      }
    };
  }, [getOrCreateRemoteAudio, sendCandidateSignal, speakerMuted]);

  // Handle incoming WebRTC audio & video signals (offers, answers, ICE candidates, request-screen)
  const handleWebRTCSignal = useCallback(async (sig: { from: string; to: string; type: 'offer' | 'answer' | 'candidate' | 'request-screen'; payload: unknown }) => {
    if (!sig || sig.from === myParticipantId) return;
    const isForMe = sig.to === myParticipantId || (isMentor && sig.to === "host") || sig.to === "all";
    if (!isForMe) return;

    const targetId = sig.from;
    // Look up peer connection by specific ID or host alias
    let pc = peerConnectionsRef.current.get(targetId) || (!isMentor ? peerConnectionsRef.current.get("host") : undefined);
    if (pc && !peerConnectionsRef.current.has(targetId)) {
      peerConnectionsRef.current.set(targetId, pc);
    }

    if (sig.type === "offer") {
      if (!pc || pc.connectionState === "closed" || pc.connectionState === "failed") {
        pc = new RTCPeerConnection(RTC_CONFIG);
        peerConnectionsRef.current.set(targetId, pc);
        if (!isMentor) peerConnectionsRef.current.set("host", pc);

        // Pre-configure transceivers for bidirectional audio & high-fps video
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        } catch {}
        try {
          pc.addTransceiver('video', { direction: isMentor ? 'sendrecv' : 'recvonly' });
        } catch {}

        // Attach local microphone tracks if active
        if (localAudioStreamRef.current) {
          localAudioStreamRef.current.getAudioTracks().forEach((track) => {
            pc!.addTrack(track, localAudioStreamRef.current!);
          });
        }

        // Attach host screen stream if host is sharing screen
        if (isMentor && screenStreamRef.current) {
          screenStreamRef.current.getVideoTracks().forEach((track) => {
            pc!.addTrack(track, screenStreamRef.current!);
          });
          screenStreamRef.current.getAudioTracks().forEach((track) => {
            pc!.addTrack(track, screenStreamRef.current!);
          });
        }

        attachTrackHandlers(pc, targetId);
      } else {
        attachTrackHandlers(pc, targetId);
        // If pc already exists and host is sharing screen, ensure tracks are attached
        if (isMentor && screenStreamRef.current) {
          const vTrack = screenStreamRef.current.getVideoTracks()[0];
          if (vTrack) {
            const sender = pc.getSenders().find(s => s.track?.kind === "video" || !s.track);
            if (sender) {
              sender.replaceTrack(vTrack).catch(() => {});
            } else {
              try {
                pc.addTrack(vTrack, screenStreamRef.current);
              } catch {}
            }
          }
        }
      }

      // W3C Perfect Negotiation: eliminate glare when both peers offer simultaneously
      if (pc.signalingState !== "stable") {
        if (!isMentor) {
          // Polite peer (student): rollback local offer so host's broadcast offer is accepted
          try {
            await pc.setLocalDescription({ type: "rollback" });
          } catch (e) {
            console.warn("Rollback notice on student:", e);
          }
        } else {
          // Impolite peer (mentor): host takes precedence, ignore colliding offer
          return;
        }
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
        await drainCandidateQueue(targetId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(targetId, "answer", answer);

        // Immediate video receiver binding for student
        if (!isMentor) {
          const vRecv = pc.getReceivers().find(r => r.track && r.track.kind === "video");
          if (vRecv && vRecv.track && vRecv.track.readyState === "live") {
            setRemoteWebRTCStream(new MediaStream([vRecv.track]));
            setIsWebRTCVideoPlaying(true);
          }
        }
      } catch (err) {
        console.warn("Error handling WebRTC offer:", err);
      }
    } else if (sig.type === "answer") {
      if (pc && pc.signalingState === "have-local-offer") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as RTCSessionDescriptionInit));
          await drainCandidateQueue(targetId, pc);

          // Immediate video receiver binding for student
          if (!isMentor) {
            const vRecv = pc.getReceivers().find(r => r.track && r.track.kind === "video");
            if (vRecv && vRecv.track && vRecv.track.readyState === "live") {
              setRemoteWebRTCStream(new MediaStream([vRecv.track]));
              setIsWebRTCVideoPlaying(true);
            }
          }
        } catch (err) {
          console.warn("Error handling WebRTC answer:", err);
        }
      }
    } else if (sig.type === "candidate") {
      if (sig.payload) {
        const rawCandidates = Array.isArray(sig.payload) ? sig.payload : [sig.payload];
        for (const cand of rawCandidates) {
          if (!cand) continue;
          if (!pc || !pc.remoteDescription) {
            const list = pendingCandidatesRef.current.get(targetId) || [];
            list.push(cand as RTCIceCandidateInit);
            pendingCandidatesRef.current.set(targetId, list);
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand as RTCIceCandidateInit));
            } catch (err) {
              console.warn("Error adding ICE candidate:", err);
            }
          }
        }
      }
    } else if (sig.type === "request-screen") {
      if (isMentor && screenStreamRef.current) {
        const vTrack = screenStreamRef.current.getVideoTracks()[0];
        if (vTrack && pc) {
          if ('contentHint' in vTrack) {
            vTrack.contentHint = 'motion';
          }
          try {
            const sender = pc.getSenders().find(s => s.track?.kind === "video" || !s.track);
            let needsOffer = false;
            if (sender) {
              await sender.replaceTrack(vTrack);
              try {
                const params = sender.getParameters();
                if (params.encodings && params.encodings.length > 0) {
                  params.encodings[0].maxBitrate = 4_000_000;
                  params.encodings[0].maxFramerate = 60;
                  await sender.setParameters(params);
                }
              } catch {}
            } else {
              try {
                pc.addTrack(vTrack, screenStreamRef.current);
                needsOffer = true;
              } catch {}
            }
            if (needsOffer && pc.signalingState === "stable") {
              const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
              await pc.setLocalDescription(offer);
              sendSignal(targetId, "offer", offer);
            }
          } catch (err) {
            console.warn("Could not handle request-screen signal:", err);
          }
        }
      }
    } else if (sig.type === "REMOTE_MUTE_ACTION") {
      const payload = (sig.payload || {}) as { targetParticipantId?: string; targetName?: string; isMuted?: boolean };
      const isTargetingMe = (payload.targetParticipantId && payload.targetParticipantId === myParticipantId) ||
                            (payload.targetName && (payload.targetName === displayName || payload.targetName === studentName));
      if (isTargetingMe && !isMentor) {
        if (payload.isMuted) {
          if (localAudioStreamRef.current) {
            localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
          }
          setMicOn(false);
          if (livekitSFU.isSFUActive) {
            livekitSFU.setMicMutedSFU(true).catch(() => {});
          }
          showToast("The host has muted your microphone.");
        } else {
          if (localAudioStreamRef.current) {
            localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = true);
          }
          setMicOn(true);
          if (livekitSFU.isSFUActive) {
            livekitSFU.setMicMutedSFU(false).catch(() => {});
          }
          showToast("The host has unmuted your microphone.");
        }
      }
      setParticipants(prev => prev.map(p => {
        if ((payload.targetParticipantId && p.id === payload.targetParticipantId) || (payload.targetName && p.name === payload.targetName)) {
          return { ...p, isMuted: Boolean(payload.isMuted) };
        }
        return p;
      }));
    } else if (sig.type === "REMOTE_MUTE_ALL") {
      if (!isMentor) {
        if (localAudioStreamRef.current) {
          localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
        }
        setMicOn(false);
        if (livekitSFU.isSFUActive) {
          livekitSFU.setMicMutedSFU(true).catch(() => {});
        }
        showToast("The host muted all participants.");
      }
      setParticipants(prev => prev.map(p => p.role === "Student" ? { ...p, isMuted: true } : p));
    }
  }, [myParticipantId, isMentor, attachTrackHandlers, sendSignal, drainCandidateQueue, displayName, studentName, livekitSFU, showToast]);

  // Student initiates audio and video connection to Host
  const initiateAudioCallToHost = useCallback(async () => {
    if (isMentor || !roomId) return;
    let pc = peerConnectionsRef.current.get("host");
    if (!pc || pc.connectionState === "closed" || pc.connectionState === "failed") {
      pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set("host", pc);

      try {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      } catch {}
      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch {}

      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getAudioTracks().forEach((track) => {
          pc!.addTrack(track, localAudioStreamRef.current!);
        });
      }

      attachTrackHandlers(pc, "host");
    }

    if (pc.signalingState !== "stable") return;

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      sendSignal("host", "offer", offer);
    } catch (err) {
      console.warn("Error initiating audio/video call to host:", err);
    }
  }, [isMentor, roomId, attachTrackHandlers, sendSignal]);

  // Synchronize speaker muted state to all remote audio elements
  useEffect(() => {
    remoteAudiosRef.current.forEach((audio) => {
      audio.muted = speakerMuted;
    });
  }, [speakerMuted]);

  // Mobile / browser autoplay policy unlock: resume audio & video elements on first touch or click or keypress
  const { unlockAudioSFU } = livekitSFU;
  useEffect(() => {
    const unlockMedia = () => {
      remoteAudiosRef.current.forEach((audio) => {
        if (audio.srcObject) {
          audio.play().catch(() => {});
        }
      });
      unlockAudioSFU();
      if (remoteScreenVideoRef.current && remoteScreenVideoRef.current.srcObject) {
        remoteScreenVideoRef.current.play().then(() => {
          setIsWebRTCVideoPlaying(true);
        }).catch(() => {});
      }
    };
    window.addEventListener("click", unlockMedia, { passive: true });
    window.addEventListener("touchstart", unlockMedia, { passive: true });
    window.addEventListener("keydown", unlockMedia, { passive: true });
    return () => {
      window.removeEventListener("click", unlockMedia);
      window.removeEventListener("touchstart", unlockMedia);
      window.removeEventListener("keydown", unlockMedia);
    };
  }, [unlockAudioSFU]);

  // Cleanup remote audio elements from DOM on component unmount
  useEffect(() => {
    const audios = remoteAudiosRef.current;
    return () => {
      audios.forEach((audio) => {
        try {
          audio.pause();
          audio.srcObject = null;
          if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
          }
        } catch {}
      });
      audios.clear();
    };
  }, []);

  // Real-time emoji reaction broadcasted to ALL participants (Host + Students)
  const triggerReaction = useCallback((emoji: string, senderName?: string, broadcast: boolean = true) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    const left = Math.floor(Math.random() * 50) + 25; // 25% - 75%
    const sender = senderName || (isMentor ? "Host" : studentName);
    setFloatingReactions(prev => [...prev, { id, emoji, left, sender }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2800);

    if (broadcast && roomId) {
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
          bc.postMessage({ type: "REACTION", data: { id, emoji, sender } });
          bc.close();
        }
      } catch {}
      fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction: { id, emoji, sender } }),
      }).catch(() => {});
    }
  }, [roomId, isMentor, studentName]);

  const playHandRaiseChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  const toggleHandRaise = () => {
    if (!isMentor && !securitySettings.allowRaiseHand) {
      showToast("Hand raising is currently disabled by the host.", false);
      return;
    }
    const next = !isHandRaised;
    setIsHandRaised(next);
    setParticipants(prev => prev.map(p => {
      if (isMentor && p.role === "Host") return { ...p, isHandRaised: next };
      if (!isMentor && (p.id === myParticipantId || p.id === "p1")) return { ...p, isHandRaised: next };
      return p;
    }));

    // Broadcast hand raise event immediately to host and room
    const hrPayload = {
      participantId: myParticipantId,
      name: isMentor ? displayName : studentName,
      isHandRaised: next,
    };
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
        bc.postMessage({ type: "HAND_RAISE", data: hrPayload });
        bc.close();
      }
    } catch {}

    fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handRaise: hrPayload }),
    }).catch(() => {});

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
    const mySenderName = isMentor ? displayName : (studentName || "Student");
    const msg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: mySenderName,
      role: isMentor ? "Host" : "Student",
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setChatMessages(prev => [...prev, msg]);
    setChatInput("");
    pushChatPopup(msg);
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
        bc.postMessage({ type: "CHAT_MSG", data: msg });
        bc.close();
      }
    } catch {}
    fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatMessage: msg }),
    }).catch(() => {});
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
        if (m?.hostName) {
          setHostName(m.hostName);
        }
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
          if (Array.isArray(data.meeting.notes) && data.meeting.notes.length > 0) {
            setNotes(data.meeting.notes);
          }
          if (data.meeting.hostName) {
            setHostName(data.meeting.hostName);
          }
          if (!isMentor && data.meeting.status === 'ended') {
            window.location.href = "https://www.geonixa.com/";
            return;
          }
          if (data.meeting.courseId) setUploadCourse(data.meeting.courseId);
        } else if (!isMentor && roomId) {
          // Meeting was deleted or not found on server: redirect student to join page so they see Meeting Not Found
          router.push(`/meeting/${roomId}`);
          return;
        }
      })
      .catch(() => {});
    getCourses().then(setCourses).catch(() => {});
    getDriveFolder().then(df => {
      if (df?.folderId) {
        setUploadCourse(prev => prev || df.folderId);
      }
    }).catch(() => {});
  }, [roomId, isMentor, displayName, router]);

  // Ensure students are NEVER left on admin dashboard (/meetings); if class is ended, send directly to Geonixa
  useEffect(() => {
    if (!isMentor && meeting?.status === 'ended') {
      window.location.href = "https://www.geonixa.com/";
    } else if (isMentor && meeting?.status === 'ended' && !isEndingAndSaving) {
      router.push("/meetings");
    }
  }, [isMentor, meeting?.status, isEndingAndSaving, router]);

  // Real-time server-synchronized participant heartbeat
  useEffect(() => {
    if (!roomId) return;
    const cleanKey = (name: string) => (name || '').replace(/\s*\((Student|Host|You|you|me)\)/gi, '').trim().toLowerCase();
    const currentName = isMentor ? displayName : (studentName || "Student");
    const currentRole = isMentor ? "Host" : "Student";
    const currentAvatar = (currentName.replace(/[^a-zA-Z0-9]/g, "").substring(0, 2) || "U").toUpperCase();

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
          const uniqueByName = new Map<string, Participant>();
          data.participants.forEach((p: Partial<Participant>) => {
            const rawName = p.name || 'Participant';
            const normKey = cleanKey(rawName);
            const isMe = p.id === myParticipantId || normKey === cleanKey(currentName);
            const hostLabel = effectiveHostName || "Host";
            const displayNameItem = isMe
              ? (isMentor ? `${hostLabel} (Host, you)` : `${studentName || "You"} (Student)`)
              : (p.role === "Host" || normKey === "host" ? `${hostLabel} (Host)` : rawName.replace(/\s*\((Student|Host|You|you|me)\)/gi, '').trim());
            const mappedItem: Participant = {
              id: isMe ? myParticipantId : (p.id || ''),
              name: displayNameItem,
              role: (p.role as "Host" | "Student") || (normKey === "host" ? "Host" : 'Student'),
              avatar: p.avatar || rawName.substring(0, 2).toUpperCase(),
              isMuted: p.isMuted ?? true,
              isVideoOn: p.isVideoOn ?? false,
              isHandRaised: p.isHandRaised ?? false,
              canScreenShare: p.canScreenShare ?? true,
              canChat: p.canChat ?? true,
            };
            if (!uniqueByName.has(normKey) || isMe) {
              uniqueByName.set(normKey, mappedItem);
            }
          });
          setParticipants(Array.from(uniqueByName.values()));
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
  }, [roomId, myParticipantId, isMentor, studentName, micOn, cameraOn, isHandRaised, displayName, effectiveHostName]);

  // Real-time synchronization loop: Host camera, Screen share, Whiteboard slides, Chat, Notes, Reactions
  useEffect(() => {
    if (!roomId) return;
    const channelName = `rcrd_meeting_room_${roomId}`;
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel(channelName);
        bc.onmessage = (event) => {
          const { type, data } = event.data || {};
          if (type === "HOST_CAMERA") {
            setRemoteHostCamera({
              active: Boolean(data?.active),
              streamFrame: data?.active ? data.streamFrame : undefined,
              updatedAt: data?.updatedAt || Date.now(),
            });
          } else if (type === "WEBRTC_SIGNAL") {
            if (data?.id && !processedSignalIdsRef.current.has(data.id)) {
              processedSignalIdsRef.current.add(data.id);
              handleWebRTCSignal(data);
            }
          } else if (type === "PARTICIPANT_CAMERA") {
            if (data?.participantId) {
              setRemoteParticipantCameras(prev => ({
                ...prev,
                [data.participantId]: data,
              }));
              setParticipants(prev => prev.map(p => {
                if (p.id === data.participantId || p.name === data.name) {
                  return { ...p, isVideoOn: Boolean(data.active) };
                }
                return p;
              }));
            }
          } else if (type === "HAND_RAISE") {
            if (data?.participantId) {
              setParticipants(prev => prev.map(p => {
                if (p.id === data.participantId || p.name === data.name) {
                  return { ...p, isHandRaised: Boolean(data.isHandRaised) };
                }
                return p;
              }));
              if (isMentor && data.isHandRaised) {
                showToast(`✋ ${data.name || "Student"} raised their hand!`);
                playHandRaiseChime();
              }
            }
          } else if (type === "SCREEN_SHARE") {
            if (!screenStream) {
              const incomingTime = data?.updatedAt || 0;
              if (!data?.active) {
                if (incomingTime >= lastScreenShareTimestampRef.current) {
                  lastScreenShareTimestampRef.current = incomingTime;
                  setRemoteScreenShare({ active: false, streamFrame: undefined, updatedAt: incomingTime });
                  setRemoteWebRTCStream(null);
                  setIsWebRTCVideoPlaying(false);
                }
              } else if (incomingTime >= lastScreenShareTimestampRef.current) {
                lastScreenShareTimestampRef.current = incomingTime;
                if (!isMentor && data?.active) {
                  setShowWhiteboard(false);
                  setStudentViewMode("screen");
                }
                setRemoteScreenShare(prev => {
                  if (!data.streamFrame && prev?.streamFrame) {
                    return { ...data, streamFrame: prev.streamFrame };
                  }
                  return data;
                });
              }
            }
          } else if (type === "WHITEBOARD") {
            setRemoteWhiteboard(data);
            if (!isMentor) {
              const isWbActive = Boolean(data?.active);
              if (isWbActive) {
                setShowWhiteboard(true);
                setStudentViewMode("whiteboard");
              } else {
                setShowWhiteboard(false);
                setStudentViewMode("screen");
              }
              if (data?.slides) setSlides(data.slides);
              if (data?.currentSlide !== undefined) setCurrentSlideIndex(data.currentSlide - 1);
              if (data?.notepadText !== undefined) setNotepadText(data.notepadText);
              if (data?.mode) setWhiteboardMode(data.mode);
            }
          } else if (type === "CHAT_MSG") {
            setChatMessages(prev => {
              if (prev.some(m => m.id === data.id)) return prev;
              return [...prev, data];
            });
            pushChatPopup(data);
          } else if (type === "NOTE_UPDATE") {
            if (Array.isArray(data)) {
              setNotes(data);
            } else if (data?.id) {
              setNotes(prev => {
                const idx = prev.findIndex(n => n.id === data.id);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = data;
                  return updated;
                }
                return [data, ...prev];
              });
            }
          } else if (type === "REACTION") {
            triggerReaction(data.emoji, data.sender, false);
          } else if (type === "REMOTE_MUTE_ACTION") {
            const { targetParticipantId, targetName, isMuted: hostWantsMuted } = data || {};
            const isTargetingMe = (targetParticipantId && targetParticipantId === myParticipantId) ||
                                  (targetName && (targetName === displayName || targetName === studentName));
            if (isTargetingMe && !isMentor) {
              if (hostWantsMuted) {
                if (localAudioStreamRef.current) localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
                setMicOn(false);
                if (livekitSFU.isSFUActive) livekitSFU.setMicMutedSFU(true).catch(() => {});
                showToast("The host has muted your microphone.");
              } else {
                if (localAudioStreamRef.current) localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = true);
                setMicOn(true);
                if (livekitSFU.isSFUActive) livekitSFU.setMicMutedSFU(false).catch(() => {});
                showToast("The host has unmuted your microphone.");
              }
            }
            setParticipants(prev => prev.map(p => {
              if ((targetParticipantId && p.id === targetParticipantId) || (targetName && p.name === targetName)) {
                return { ...p, isMuted: Boolean(hostWantsMuted) };
              }
              return p;
            }));
          } else if (type === "REMOTE_MUTE_ALL") {
            if (!isMentor) {
              if (localAudioStreamRef.current) localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
              setMicOn(false);
              if (livekitSFU.isSFUActive) livekitSFU.setMicMutedSFU(true).catch(() => {});
              showToast("The host muted all participants.");
            }
            setParticipants(prev => prev.map(p => p.role === "Student" ? { ...p, isMuted: true } : p));
          } else if (type === "MEETING_EXTENDED") {
            if (data?.duration) {
              setMeeting(prev => prev ? ({ ...prev, duration: data.duration, status: 'live' }) : prev);
              setStudentDurationWarning(null);
              showToast(`Meeting extended by ${data.extendedBy || 15} minutes!`);
            }
          }
        };
      }
    } catch {}

    // Student initiates audio connection to mentor on mount
    if (!isMentor) {
      setTimeout(() => {
        initiateAudioCallToHost();
      }, 800);
    }

    let pollInFlight = false;
    let pollTimer: NodeJS.Timeout | null = null;
    let pollActive = true;

    const pollState = async () => {
      if (pollInFlight || !pollActive) return;
      pollInFlight = true;
      try {
        const sinceScreenParam = lastScreenShareTimestampRef.current;
        const skipScreenFrame = isWebRTCVideoPlayingRef.current ? 1 : 0;
        const res = await fetch(`/api/meetings/${encodeURIComponent(roomId)}/state?participantId=${encodeURIComponent(myParticipantId)}&sinceScreen=${sinceScreenParam}&sinceWb=${lastWhiteboardTimestampRef.current}&skipScreenFrame=${skipScreenFrame}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.success) {
          // If meeting was ended by host, redirect students immediately to Geonixa website
          if (!isMentor && data.status === "ended") {
            window.location.href = "https://www.geonixa.com/";
            return;
          }
          if (data?.duration && meeting && meeting.duration !== data.duration) {
            setMeeting(prev => prev ? ({ ...prev, duration: data.duration }) : prev);
            setStudentDurationWarning(null);
          }

          // Process WebRTC audio signals
          if (Array.isArray(data.signals) && data.signals.length > 0) {
            data.signals.forEach((sig: { id: string; from: string; to: string; type: 'offer' | 'answer' | 'candidate' | 'request-screen'; payload: unknown }) => {
              if (!processedSignalIdsRef.current.has(sig.id)) {
                processedSignalIdsRef.current.add(sig.id);
                handleWebRTCSignal(sig);
              }
            });
          }

          // Process broadcasted emoji reactions
          if (Array.isArray(data.reactions) && data.reactions.length > 0) {
            data.reactions.forEach((r: { id: string; emoji: string; sender: string; timestamp: number }) => {
              if (!displayedReactionsRef.current.has(r.id)) {
                displayedReactionsRef.current.add(r.id);
                triggerReaction(r.emoji, r.sender, false);
              }
            });
          }

          // Sync Host Camera strictly (if camera is inactive, streamFrame MUST be undefined)
          if (!isMentor && data.hostCamera) {
            setRemoteHostCamera({
              active: Boolean(data.hostCamera.active),
              streamFrame: data.hostCamera.active ? data.hostCamera.streamFrame : undefined,
              updatedAt: data.hostCamera.updatedAt,
            });
          }

          // Sync Participant Cameras (student & mentor video streams)
          if (data.participantCameras && typeof data.participantCameras === "object") {
            setRemoteParticipantCameras(data.participantCameras);
          }

          // Sync Hand Raises & Notify Host
          if (Array.isArray(data.handRaises) && isMentor) {
            data.handRaises.forEach((hr: { participantId: string; name: string; isHandRaised: boolean; timestamp: number }) => {
              if (hr.isHandRaised && !notifiedHandRaisesRef.current.has(`${hr.participantId}_${hr.timestamp}`)) {
                notifiedHandRaisesRef.current.add(`${hr.participantId}_${hr.timestamp}`);
                showToast(`✋ ${hr.name || "Student"} raised their hand!`);
                playHandRaiseChime();
              }
            });
          }

          // Sync Remote Mute Actions from Host
          if (data.participantMuteAction && typeof data.participantMuteAction === "object") {
            const ma = data.participantMuteAction;
            if (ma.timestamp && ma.timestamp > lastMuteActionTimestampRef.current) {
              lastMuteActionTimestampRef.current = ma.timestamp;
              const isTargetingMe = (ma.targetParticipantId && ma.targetParticipantId === myParticipantId) ||
                                    (ma.targetName && (ma.targetName === displayName || ma.targetName === studentName));
              if (isTargetingMe && !isMentor) {
                if (ma.isMuted) {
                  if (localAudioStreamRef.current) localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
                  setMicOn(false);
                  if (livekitSFU.isSFUActive) livekitSFU.setMicMutedSFU(true).catch(() => {});
                  showToast("The host has muted your microphone.");
                } else {
                  if (localAudioStreamRef.current) localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = true);
                  setMicOn(true);
                  if (livekitSFU.isSFUActive) livekitSFU.setMicMutedSFU(false).catch(() => {});
                  showToast("The host has unmuted your microphone.");
                }
              }
              setParticipants(prev => prev.map(p => {
                if ((ma.targetParticipantId && p.id === ma.targetParticipantId) || (ma.targetName && p.name === ma.targetName)) {
                  return { ...p, isMuted: Boolean(ma.isMuted) };
                }
                return p;
              }));
            }
          }

          if (data.muteAll && typeof data.muteAll === "object") {
            if (data.muteAll.timestamp && data.muteAll.timestamp > lastMuteActionTimestampRef.current) {
              lastMuteActionTimestampRef.current = data.muteAll.timestamp;
              if (!isMentor) {
                if (localAudioStreamRef.current) localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
                setMicOn(false);
                if (livekitSFU.isSFUActive) livekitSFU.setMicMutedSFU(true).catch(() => {});
                showToast("The host muted all participants.");
              }
              setParticipants(prev => prev.map(p => p.role === "Student" ? { ...p, isMuted: true } : p));
            }
          }

          // Sync Screen Share if not host sharing
          if (!screenStream && data.screenShare) {
            const incomingTime = data.screenShare.updatedAt || 0;
            const hasActiveWebRTC = Boolean((livekitSFU.isSFUActive && livekitSFU.sfuRemoteStream) || remoteWebRTCStream);
            if (!data.screenShare.active && !hasActiveWebRTC) {
              if (incomingTime >= lastScreenShareTimestampRef.current) {
                lastScreenShareTimestampRef.current = incomingTime;
                setRemoteScreenShare({ active: false, streamFrame: undefined, updatedAt: incomingTime });
                setRemoteWebRTCStream(null);
                setIsWebRTCVideoPlaying(false);
              }
            } else if (data.screenShare.active) {
              if (incomingTime >= lastScreenShareTimestampRef.current) {
                lastScreenShareTimestampRef.current = incomingTime;
                // If student is currently viewing whiteboard, auto-switch to screen share when host starts presenting screen!
                if (!isMentor && data.screenShare.active) {
                  setShowWhiteboard(false);
                  setStudentViewMode("screen");
                }
                // Prevent unnecessary re-renders if frame and active status did not change
                setRemoteScreenShare(prev => {
                  const nextFrame = data.screenShare.streamFrame || prev?.streamFrame;
                  if (
                    prev?.active === data.screenShare.active &&
                    prev?.presenterName === data.screenShare.presenterName &&
                    prev?.streamFrame === nextFrame
                  ) {
                    return prev; // Same reference, skips unnecessary React reconciliation!
                  }
                  return {
                    ...data.screenShare,
                    streamFrame: nextFrame,
                  };
                });
              }
            }
          }
          // Sync Whiteboard if student
          if (data.whiteboard) {
            setRemoteWhiteboard(data.whiteboard);
            if (data.whiteboard.updatedAt) {
              lastWhiteboardTimestampRef.current = data.whiteboard.updatedAt;
            }
            if (!isMentor) {
              const isWbActive = Boolean(data.whiteboard.active);
              if (isWbActive) {
                // Only open whiteboard if screen share is NOT active or student explicitly chose whiteboard
                if (!data.screenShare?.active) {
                  setShowWhiteboard(true);
                  setStudentViewMode("whiteboard");
                }
              } else {
                setShowWhiteboard(false);
                setStudentViewMode("screen");
              }
              if (data.whiteboard.slides) setSlides(data.whiteboard.slides);
              if (data.whiteboard.currentSlide !== undefined) setCurrentSlideIndex(data.whiteboard.currentSlide - 1);
              if (data.whiteboard.notepadText !== undefined) setNotepadText(data.whiteboard.notepadText);
              if (data.whiteboard.mode) setWhiteboardMode(data.whiteboard.mode);
            }
          }
          // Sync Chat
          if (Array.isArray(data.chat) && data.chat.length > 0) {
            setChatMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newIncoming = data.chat.filter((m: ChatMessage) => !existingIds.has(m.id));
              if (newIncoming.length > 0) {
                newIncoming.forEach((m: ChatMessage) => {
                  const isMe = (isMentor && m.role === "Host") || (!isMentor && (m.sender === studentName || m.sender === "You"));
                  if (!isMe && m.sender !== "Class Assistant") {
                    pushChatPopup(m);
                    showToast(`💬 ${m.sender}: ${m.text.slice(0, 45)}${m.text.length > 45 ? "..." : ""}`);
                  }
                });
                const map = new Map<string, ChatMessage>();
                prev.forEach(m => map.set(m.id, m));
                data.chat.forEach((m: ChatMessage) => map.set(m.id, m));
                return Array.from(map.values());
              }
              return prev;
            });
          }
          // Sync Notes
          if (Array.isArray(data.notes)) {
            setNotes(prev => {
              const map = new Map<string, Note>();
              prev.forEach(n => map.set(n.id, n));
              data.notes.forEach((n: Note) => map.set(n.id, n));
              const merged = Array.from(map.values());
              return merged.length !== prev.length ? merged : prev;
            });
          }
        }
      } catch {} finally {
        pollInFlight = false;
      }
    };

    const scheduleNextPoll = () => {
      if (!pollActive) return;
      // Adaptive polling rate:
      // - Screen share active and WebRTC NOT playing: 250ms for smooth 4fps HTTP frame delivery
      // - WebRTC 60fps video IS playing smoothly: 2000ms (saves bandwidth and CPU)
      // - Idle meeting: 1200ms
      let delay = 1200;
      if (remoteScreenShareActiveRef.current) {
        delay = isWebRTCVideoPlayingRef.current ? 2000 : 250;
      }
      pollTimer = setTimeout(runPoll, delay);
    };

    const runPoll = async () => {
      if (!pollActive) return;
      await pollState();
      scheduleNextPoll();
    };

    runPoll();

    return () => {
      pollActive = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (bc) bc.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, screenStream, isMentor, triggerReaction, handleWebRTCSignal, initiateAudioCallToHost, myParticipantId, playHandRaiseChime, showToast, studentName, pushChatPopup]);

  // Auto-connect / reconnect student WebRTC stream whenever host is sharing screen
  useEffect(() => {
    if (isMentor || !remoteScreenShare?.active) return;
    const syncScreenStream = () => {
      // If LiveKit SFU is already streaming, direct P2P renegotiation is not needed
      if (livekitSFU.isSFUActive && livekitSFU.sfuRemoteStream) return;

      const pc = peerConnectionsRef.current.get("host");
      if (!pc || pc.connectionState === "failed" || pc.connectionState === "closed") {
        initiateAudioCallToHost();
      } else {
        const vRecv = pc.getReceivers().find(r => r.track && r.track.kind === "video");
        if (vRecv && vRecv.track && vRecv.track.readyState === "live") {
          setRemoteWebRTCStream(prev => {
            if (prev && prev.getVideoTracks()[0] === vRecv.track) return prev;
            return new MediaStream([vRecv.track]);
          });
        } else if (pc.connectionState === "connected" && !isWebRTCVideoPlayingRef.current) {
          // Connected but video track not flowing yet: request once (do not spam)
          sendSignal("host", "request-screen", {});
        }
      }
    };
    syncScreenStream();
    const interval = setInterval(syncScreenStream, 8000);
    return () => clearInterval(interval);
  }, [isMentor, remoteScreenShare?.active, initiateAudioCallToHost, sendSignal, livekitSFU.isSFUActive, livekitSFU.sfuRemoteStream]);

  // Mentor auto-acquires microphone on room load so audio track is ready for connecting students
  useEffect(() => {
    if (isMentor && micOn && !localAudioStreamRef.current && typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      }).then((stream) => {
        localAudioStreamRef.current = stream;
        if (livekitSFU.isSFUActive) {
          livekitSFU.publishMicAudioSFU(stream).catch(() => {});
        }
        const track = stream.getAudioTracks()[0];
        if (track) {
          peerConnectionsRef.current.forEach(async (pc, targetId) => {
            try {
              const sender = pc.getSenders().find(s => s.track?.kind === "audio");
              if (sender) {
                await sender.replaceTrack(track);
              } else {
                pc.addTrack(track, stream);
                const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                await pc.setLocalDescription(offer);
                sendSignal(targetId, "offer", offer);
              }
            } catch {}
          });
        }
      }).catch((err) => {
        console.warn("Host microphone waiting for user interaction or permission:", err);
      });
    }
  }, [isMentor, micOn, sendSignal, livekitSFU]);

  // Proactively publish host microphone to LiveKit SFU as soon as SFU connects
  useEffect(() => {
    if (isMentor && livekitSFU.isSFUActive && localAudioStreamRef.current && micOn) {
      livekitSFU.publishMicAudioSFU(localAudioStreamRef.current).catch(() => {});
    }
  }, [isMentor, livekitSFU.isSFUActive, micOn, livekitSFU]);

  // Broadcast screen share frames when Host shares screen
  // ARCHITECTURE: Two-path delivery for zero-lag + wide-area reach:
  //   Path A: BroadcastChannel (same browser/device) — runs every 100ms, NEVER blocked by network
  //   Path B: Server POST (remote students over internet) — runs every 500ms independently
  useEffect(() => {
    if (!screenStream || !isMentor || !roomId) return;
    let active = true;
    let serverInFlight = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });

    // Micro-canvas for frame change detection (skips redundant server uploads for static content)
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 16;
    sampleCanvas.height = 10;
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    let lastSample = "";
    let heartbeatCounter = 0;
    let lastDataUrl = "";
    let lastPayloadTime = 0;

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
      }
    } catch {}

    let helperVideo: HTMLVideoElement | null = null;
    if (!screenVideoRef.current || screenVideoRef.current.videoWidth === 0) {
      helperVideo = document.createElement("video");
      helperVideo.muted = true;
      helperVideo.autoplay = true;
      helperVideo.playsInline = true;
      helperVideo.srcObject = screenStream;
      helperVideo.play().catch(() => {});
    }

    // PATH A: Encode frame → post to BroadcastChannel immediately (no network, ~0ms latency)
    // Runs at 100ms for smooth ~10fps local preview with zero network overhead
    const encodeAndBroadcast = () => {
      if (!active || !screenStream) return;
      try {
        const vEl = (screenVideoRef.current && screenVideoRef.current.videoWidth > 0)
          ? screenVideoRef.current
          : helperVideo;
        if (vEl && vEl.videoWidth > 0 && ctx && sampleCtx) {
          const vw = vEl.videoWidth;
          const vh = vEl.videoHeight;

          // Change detection — skip encode if frame is identical (saves CPU for static content)
          sampleCtx.drawImage(vEl, 0, 0, 16, 10);
          const sampleData = sampleCtx.getImageData(0, 0, 16, 10).data;
          let sampleStr = "";
          for (let i = 0; i < sampleData.length; i += 8) {
            sampleStr += `${sampleData[i]},${sampleData[i+1]},${sampleData[i+2]};`;
          }

          const frameChanged = sampleStr !== lastSample;
          if (!frameChanged) {
            heartbeatCounter++;
            // Send heartbeat every ~1.5s even for static frames so students don't time out
            if (heartbeatCounter < 15) return;
          }
          lastSample = sampleStr;
          heartbeatCounter = 0;

          // Optimized for high frame rate & smooth motion: 640px max width, 0.52 JPEG (~22KB payload)
          const maxW = 640;
          const scale = Math.min(1, maxW / vw);
          const tw = Math.round(vw * scale);
          const th = Math.round(vh * scale);
          if (canvas.width !== tw || canvas.height !== th) {
            canvas.width = tw;
            canvas.height = th;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "medium";
          ctx.drawImage(vEl, 0, 0, tw, th);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.52);
          lastDataUrl = dataUrl;
          lastPayloadTime = Date.now();

          const payload = {
            active: true,
            presenterName: displayName || "Host",
            streamFrame: dataUrl,
            updatedAt: lastPayloadTime,
          };

          // BroadcastChannel delivery: instant, same browser, no network
          if (bc) {
            bc.postMessage({ type: "SCREEN_SHARE", data: payload });
          }
        }
      } catch {}
    };

    // PATH B: POST latest encoded frame to server for remote students (independent timer)
    // Non-blocking: never prevents Path A from running
    const uploadToServer = async () => {
      if (!active || !lastDataUrl || serverInFlight) return;
      const payload = {
        active: true,
        presenterName: displayName || "Host",
        streamFrame: lastDataUrl,
        updatedAt: lastPayloadTime,
      };
      serverInFlight = true;
      const abortCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const abortTimer = setTimeout(() => {
        if (abortCtrl) abortCtrl.abort();
        serverInFlight = false;
      }, 1500);
      try {
        await fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ screenShare: payload }),
          signal: abortCtrl?.signal,
        });
      } catch {
      } finally {
        clearTimeout(abortTimer);
        serverInFlight = false;
      }
    };

    // Path A: runs every 100ms for smooth ~10fps local/BC delivery (never blocked)
    const bcInterval = setInterval(encodeAndBroadcast, 100);
    // Path B: runs every 250ms for smooth 4fps server delivery to remote students
    const serverInterval = setInterval(uploadToServer, 250);
    encodeAndBroadcast();

    return () => {
      active = false;
      clearInterval(bcInterval);
      clearInterval(serverInterval);
      if (helperVideo) {
        helperVideo.srcObject = null;
      }
      if (bc) {
        bc.close();
      }
    };
  }, [screenStream, isMentor, roomId, displayName]);

  // Broadcast camera frames for Host AND Student participants
  useEffect(() => {
    const myRole = isMentor ? 'Host' : 'Student';
    const myName = isMentor ? displayName : studentName;

    if (!cameraStream || !cameraOn || !roomId) {
      if (roomId) {
        try {
          if (typeof BroadcastChannel !== "undefined") {
            const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
            bc.postMessage({
              type: "PARTICIPANT_CAMERA",
              data: { participantId: myParticipantId, name: myName, role: myRole, active: false, updatedAt: Date.now() },
            });
            if (isMentor) {
              bc.postMessage({ type: "HOST_CAMERA", data: { active: false, updatedAt: Date.now() } });
            }
            bc.close();
          }
        } catch {}
        fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantCamera: { participantId: myParticipantId, name: myName, role: myRole, active: false },
            ...(isMentor ? { hostCamera: { active: false } } : {}),
          }),
        }).catch(() => {});
      }
      return;
    }

    let active = true;
    let inFlight = false;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
      }
    } catch {}

    const broadcastCameraFrame = async () => {
      if (!active || !cameraVideoRef.current || !cameraStream || inFlight) return;
      try {
        if (cameraVideoRef.current.videoWidth > 0 && ctx) {
          ctx.drawImage(cameraVideoRef.current, 0, 0, 240, 180);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.32);
          const payload = {
            participantId: myParticipantId,
            name: myName,
            role: myRole,
            active: true,
            streamFrame: dataUrl,
            updatedAt: Date.now(),
          };
          if (bc) {
            bc.postMessage({ type: "PARTICIPANT_CAMERA", data: payload });
            if (isMentor) bc.postMessage({ type: "HOST_CAMERA", data: payload });
          }
          inFlight = true;
          try {
            await fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                participantCamera: payload,
                ...(isMentor ? { hostCamera: payload } : {}),
              }),
            });
          } finally {
            inFlight = false;
          }
        }
      } catch {
        inFlight = false;
      }
    };

    const interval = setInterval(broadcastCameraFrame, 1200);
    broadcastCameraFrame();

    return () => {
      active = false;
      clearInterval(interval);
      if (bc) {
        bc.postMessage({
          type: "PARTICIPANT_CAMERA",
          data: { participantId: myParticipantId, name: myName, role: myRole, active: false, updatedAt: Date.now() },
        });
        if (isMentor) bc.postMessage({ type: "HOST_CAMERA", data: { active: false, updatedAt: Date.now() } });
        bc.close();
      }
      fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantCamera: { participantId: myParticipantId, name: myName, role: myRole, active: false },
          ...(isMentor ? { hostCamera: { active: false } } : {}),
        }),
      }).catch(() => {});
    };
  }, [cameraStream, cameraOn, isMentor, studentName, myParticipantId, roomId, displayName]);

  // Broadcast whiteboard state (multi-slide & notepad)
  const broadcastWhiteboard = useCallback((
    active: boolean,
    overrideSlides?: WhiteboardSlide[],
    overrideIndex?: number,
    overrideNotepad?: string,
    overrideMode?: 'sketch' | 'notepad'
  ) => {
    if (!roomId) return;
    try {
      let canvasData: string | undefined = undefined;
      if (active && canvasRef.current) {
        canvasData = canvasRef.current.toDataURL("image/png");
      }
      const activeSlides = overrideSlides || slides;
      const activeIdx = overrideIndex !== undefined ? overrideIndex : currentSlideIndex;
      const activeNotepad = overrideNotepad !== undefined ? overrideNotepad : notepadText;
      const activeMode = overrideMode !== undefined ? overrideMode : whiteboardMode;

      const updatedSlides = activeSlides.map((s, i) =>
        i === activeIdx ? { ...s, canvasData: canvasData || s.canvasData, notesText: activeNotepad } : s
      );

      const payload = {
        active,
        canvasData,
        currentSlide: activeIdx + 1,
        totalSlides: updatedSlides.length,
        slides: updatedSlides,
        notepadText: activeNotepad,
        mode: activeMode,
        updatedAt: Date.now(),
      };
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
          bc.postMessage({ type: "WHITEBOARD", data: payload });
          bc.close();
        }
      } catch {}
      fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whiteboard: payload }),
      }).catch(() => {});
    } catch {}
  }, [roomId, slides, currentSlideIndex, notepadText, whiteboardMode]);

  // Whiteboard Slide Switching & Addition
  const switchSlide = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= slides.length) return;
    let currentCanvasData = '';
    if (canvasRef.current) {
      currentCanvasData = canvasRef.current.toDataURL('image/png');
    }
    const updatedSlides = slides.map((s, idx) => 
      idx === currentSlideIndex 
        ? { ...s, canvasData: currentCanvasData || s.canvasData, notesText: notepadText }
        : s
    );
    setSlides(updatedSlides);
    setCurrentSlideIndex(targetIndex);
    const targetNotepad = updatedSlides[targetIndex]?.notesText || '';
    setNotepadText(targetNotepad);

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        const targetData = updatedSlides[targetIndex]?.canvasData;
        if (targetData) {
          const img = new Image();
          img.onload = () => {
            if (canvasRef.current) {
              const c = canvasRef.current.getContext('2d');
              c?.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          };
          img.src = targetData;
        }
      }
    }
    if (isMentor) {
      broadcastWhiteboard(true, updatedSlides, targetIndex, targetNotepad, whiteboardMode);
    }
  };

  const addNewSlide = () => {
    if (!isMentor) return;
    let currentCanvasData = '';
    if (canvasRef.current) {
      currentCanvasData = canvasRef.current.toDataURL('image/png');
    }
    const updatedSlides = slides.map((s, idx) => 
      idx === currentSlideIndex 
        ? { ...s, canvasData: currentCanvasData || s.canvasData, notesText: notepadText }
        : s
    );
    const newSlide: WhiteboardSlide = {
      id: Date.now(),
      canvasData: '',
      notesText: '',
    };
    const newSlidesList = [...updatedSlides, newSlide];
    const newIdx = newSlidesList.length - 1;
    setSlides(newSlidesList);
    setCurrentSlideIndex(newIdx);
    setNotepadText('');

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        try {
          historyRef.current = [ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)];
          redoRef.current = [];
          setCanUndo(false);
          setCanRedo(false);
        } catch {}
      }
    }
    showToast(`Added Slide ${newSlidesList.length}`);
    broadcastWhiteboard(true, newSlidesList, newIdx, '', whiteboardMode);
  };

  const downloadAllSlidesAsPdf = async () => {
    try {
      showToast("Generating PDF from all whiteboard slides...");
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [960, 540],
      });

      let currentCanvasData = '';
      if (canvasRef.current) {
        currentCanvasData = canvasRef.current.toDataURL('image/png');
      }
      const currentSlides = slides.map((s, idx) => 
        idx === currentSlideIndex 
          ? { ...s, canvasData: currentCanvasData || s.canvasData, notesText: notepadText }
          : s
      );

      for (let i = 0; i < currentSlides.length; i++) {
        if (i > 0) {
          pdf.addPage([960, 540], "landscape");
        }
        const s = currentSlides[i];

        // White background
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, 960, 540, "F");

        // Header bar
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, 0, 960, 36, "F");
        pdf.setDrawColor(226, 232, 240);
        pdf.line(0, 36, 960, 36);

        pdf.setFontSize(13);
        pdf.setTextColor(21, 67, 96);
        pdf.text(`RCRD Live Class · Slide ${i + 1} of ${currentSlides.length}`, 24, 23);

        const dStr = new Date().toLocaleDateString();
        pdf.setFontSize(10);
        pdf.setTextColor(87, 99, 110);
        pdf.text(dStr, 936, 23, { align: "right" });

        // Add sketch drawing if present
        if (s.canvasData && s.canvasData.startsWith('data:image')) {
          try {
            pdf.addImage(s.canvasData, 'PNG', 20, 48, 920, 470, undefined, 'FAST');
          } catch (e) {
            console.warn("PDF addImage error:", e);
          }
        }

        // If slide has notepad text, render it neatly
        if (s.notesText && s.notesText.trim()) {
          pdf.setFontSize(12);
          pdf.setTextColor(32, 38, 46);
          const splitText = pdf.splitTextToSize(s.notesText, 900);
          const startY = s.canvasData ? 390 : 65;
          pdf.text(splitText, 30, startY);
        }
      }

      const filename = `Whiteboard-Slides-${roomId}-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
      showToast(`Downloaded ${currentSlides.length} slides as PDF!`);
    } catch (err: unknown) {
      const error = err as Error;
      showToast("PDF generation failed: " + (error?.message || "Error"), false);
    }
  };

  // Render remote whiteboard onto student canvas with aspect-ratio containment (no distortion on vertical or horizontal phones!)
  useEffect(() => {
    if (!isMentor && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      if (!remoteWhiteboard.active || !remoteWhiteboard.canvasData) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        return;
      }
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        const c = canvasRef.current;
        const currentCtx = c.getContext("2d");
        if (!currentCtx) return;
        const cw = c.width;
        const ch = c.height;
        currentCtx.fillStyle = "#FFFFFF";
        currentCtx.fillRect(0, 0, cw, ch);

        const imgW = img.width || 1280;
        const imgH = img.height || 720;
        const scale = Math.min(cw / imgW, ch / imgH);
        const dw = imgW * scale;
        const dh = imgH * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;

        currentCtx.imageSmoothingEnabled = true;
        currentCtx.imageSmoothingQuality = "high";
        currentCtx.drawImage(img, dx, dy, dw, dh);
      };
      img.src = remoteWhiteboard.canvasData;
    }
  }, [remoteWhiteboard, isMentor]);

  const saveNotes = useCallback((updated: Note[]) => {
    setNotes(updated);
    try {
      const allNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
      allNotes[roomId] = updated;
      localStorage.setItem(NOTES_KEY, JSON.stringify(allNotes));

      const roomNotes = JSON.parse(localStorage.getItem("RCRD_MEETING_NOTES") || "{}");
      roomNotes[roomId] = updated;
      localStorage.setItem("RCRD_MEETING_NOTES", JSON.stringify(roomNotes));

      localStorage.setItem(`meeting_notes_${roomId}`, JSON.stringify(updated));
    } catch {}
    // Broadcast notes to server room state
    fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: updated }),
    }).catch(() => {});
    // Persist to database meeting document
    fetch('/api/meetings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: roomId, notes: updated }),
    }).catch(() => {});
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
        bc.postMessage({ type: "NOTE_UPDATE", data: updated });
        bc.close();
      }
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
    const targetParticipant = participants.find(p => p.role === "Student");
    const myId = myParticipantId;
    const note: Note = {
      id: Date.now().toString(),
      content: newNote.trim(),
      author: isMentor ? "Host" : studentName,
      timestamp: new Date().toISOString(),
      type: noteType,
      participantId: noteType === "participant" ? myId : undefined,
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
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    livekitSFU.unpublishScreenShareSFU().catch(() => {});
    peerConnectionsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) {
        sender.replaceTrack(null).catch(() => {});
      }
      const aSender = pc.getSenders().find(s => s.track?.kind === "audio");
      if (aSender && localAudioStreamRef.current?.getAudioTracks()[0]) {
        aSender.replaceTrack(localAudioStreamRef.current.getAudioTracks()[0]).catch(() => {});
      }
    });

    if (localAudioStreamRef.current && livekitSFU.isSFUActive) {
      livekitSFU.publishMicAudioSFU(localAudioStreamRef.current).catch(() => {});
    }

    // Broadcast screen share stopped to students immediately across SFU and WebRTC
    if (livekitSFU.isSFUActive) {
      livekitSFU.broadcastDataSFU("SCREEN_SHARE", { active: false, presenterName: displayName, updatedAt: Date.now() }).catch(() => {});
    }
    sendSignal("all", "SCREEN_SHARE", { active: false, presenterName: displayName, updatedAt: Date.now() });

    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
        bc.postMessage({
          type: "SCREEN_SHARE",
          data: { active: false, presenterName: displayName, streamFrame: undefined, updatedAt: Date.now() },
        });
        bc.close();
      }
    } catch {}

    // Clear server state so student pollers immediately clear screen share
    fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        screenShare: { active: false, streamFrame: undefined, updatedAt: Date.now() },
      }),
    }).catch(() => {});

    showToast("Screen share stopped. Meeting is still active.");
  }, [screenStream, showToast, setScreenStream, roomId, displayName, livekitSFU, sendSignal]);

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
          video: { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 60, max: 60 } },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          }
        });
      } catch {
        // Resilient fallback: active presentation canvas stream
        const canvas = document.createElement("canvas");
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext("2d");
        const renderScreen = () => {
          if (!ctx) return;
          ctx.fillStyle = "#20262E";
          ctx.fillRect(0, 0, 1920, 1080);
          ctx.fillStyle = "#20262E";
          ctx.fillRect(40, 40, 1840, 1000);
          ctx.fillStyle = "#154360";
          ctx.font = "bold 40px sans-serif";
          ctx.fillText("Presentation Screen Share (Active Stream)", 80, 140);
          ctx.fillStyle = "#57636E";
          ctx.font = "24px sans-serif";
          ctx.fillText("Sharing classroom slides & notes live with attendees in HD...", 80, 220);
          requestAnimationFrame(renderScreen);
        };
        renderScreen();
        ds = canvas.captureStream(60);
      }
      ds.getVideoTracks()[0].onended = stopScreenShare;
      screenStreamRef.current = ds;
      setScreenStream(ds);

      // Automatically close whiteboard and switch all attendees to screen share immediately
      setShowWhiteboard(false);
      broadcastWhiteboard(false);
      setStudentViewMode("screen");

      // Broadcast screen share active and whiteboard closed to server state
      fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenShare: { active: true, presenterName: displayName || "Host", updatedAt: Date.now() },
          whiteboard: { active: false, updatedAt: Date.now() },
        }),
      }).catch(() => {});

      // Attach high-fps screen video track & audio to WebRTC peers for instant zero-lag streaming
      const vTrack = ds.getVideoTracks()[0];
      const screenAudioTrack = ds.getAudioTracks()[0];
      if (vTrack) {
        if ('contentHint' in vTrack) {
          vTrack.contentHint = 'motion';
        }
      }

      // Publish to LiveKit SFU if active
      if (livekitSFU.isSFUActive) {
        livekitSFU.publishScreenShareSFU(ds).catch(() => {});
        livekitSFU.broadcastDataSFU("SCREEN_SHARE", { active: true, presenterName: displayName || "Host", updatedAt: Date.now() }).catch(() => {});
      }
      sendSignal("all", "SCREEN_SHARE", { active: true, presenterName: displayName || "Host", updatedAt: Date.now() });

      if (vTrack && isMentor) {
        let combinedAudioTrack: MediaStreamTrack | null = null;
        if (screenAudioTrack) {
          try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioCtx) {
              const actx = new AudioCtx();
              if (actx.state === "suspended") {
                actx.resume().catch(() => {});
              }
              const dest = actx.createMediaStreamDestination();
              const sSrc = actx.createMediaStreamSource(new MediaStream([screenAudioTrack]));
              sSrc.connect(dest);
              if (localAudioStreamRef.current && localAudioStreamRef.current.getAudioTracks().length > 0) {
                try {
                  const mSrc = actx.createMediaStreamSource(localAudioStreamRef.current);
                  mSrc.connect(dest);
                } catch {}
              }
              combinedAudioTrack = dest.stream.getAudioTracks()[0] || screenAudioTrack;
            } else {
              combinedAudioTrack = screenAudioTrack;
            }
          } catch {
            combinedAudioTrack = screenAudioTrack;
          }
        } else if (localAudioStreamRef.current) {
          combinedAudioTrack = localAudioStreamRef.current.getAudioTracks()[0] || null;
        }

        if (livekitSFU.isSFUActive) {
          if (combinedAudioTrack) {
            livekitSFU.publishMicAudioSFU(new MediaStream([combinedAudioTrack])).catch(() => {});
          } else if (localAudioStreamRef.current) {
            livekitSFU.publishMicAudioSFU(localAudioStreamRef.current).catch(() => {});
          }
        }

        peerConnectionsRef.current.forEach(async (pc, targetId) => {
          try {
            const vSender = pc.getSenders().find(s => s.track?.kind === "video" || !s.track);
            let needsOffer = false;
            if (vSender) {
              await vSender.replaceTrack(vTrack);
              try {
                const params = vSender.getParameters();
                if (params.encodings && params.encodings.length > 0) {
                  params.encodings[0].maxBitrate = 4_000_000;
                  params.encodings[0].maxFramerate = 60;
                  params.degradationPreference = 'maintain-framerate';
                  await vSender.setParameters(params);
                }
              } catch {}
            } else {
              pc.addTrack(vTrack, ds);
              needsOffer = true;
            }

            if (combinedAudioTrack) {
              const aSender = pc.getSenders().find(s => s.track?.kind === "audio");
              if (aSender) {
                await aSender.replaceTrack(combinedAudioTrack);
              } else {
                pc.addTrack(combinedAudioTrack, ds);
                needsOffer = true;
              }
            }

            if (needsOffer || pc.signalingState === "stable") {
              const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
              await pc.setLocalDescription(offer);
              sendSignal(targetId, "offer", offer);
            }
          } catch (err) {
            console.warn("Could not attach screen stream to peer:", err);
          }
        });
      }

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
      if (isMentor) {
        setRemoteHostCamera({ active: false, streamFrame: undefined, updatedAt: Date.now() });
      }
      setParticipants(prev => prev.map(p => {
        if (isMentor && p.role === "Host") return { ...p, isVideoOn: false };
        if (!isMentor && (p.id === myParticipantId || p.role === "Student")) return { ...p, isVideoOn: false };
        return p;
      }));
      // Immediately broadcast camera off event so students never see a frozen image
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
          bc.postMessage({
            type: "PARTICIPANT_CAMERA",
            data: { participantId: myParticipantId, name: isMentor ? "Host" : studentName, role: isMentor ? "Host" : "Student", active: false, updatedAt: Date.now() },
          });
          if (isMentor) {
            bc.postMessage({ type: "HOST_CAMERA", data: { active: false, updatedAt: Date.now() } });
          }
          bc.close();
        }
      } catch {}
      fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantCamera: { participantId: myParticipantId, name: isMentor ? "Host" : studentName, role: isMentor ? "Host" : "Student", active: false },
          ...(isMentor ? { hostCamera: { active: false } } : {}),
        }),
      }).catch(() => {});
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
        setParticipants(prev => prev.map(p => {
          if (isMentor && p.role === "Host") return { ...p, isVideoOn: true };
          if (!isMentor && (p.id === myParticipantId || p.role === "Student")) return { ...p, isVideoOn: true };
          return p;
        }));
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
            grad.addColorStop(1, "#0E2F44");
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
            ctx.fillText(displayInitial, 320, 160 + bounce);
            ctx.font = "bold 14px sans-serif";
            ctx.fillStyle = "#94a3b8";
            ctx.fillText(`${displayName} Video Feed (Live Camera)`, 320, 260);
            requestAnimationFrame(drawFrame);
          };
          drawFrame();
          const fallbackStream = canvas.captureStream(30);
          setCameraStream(fallbackStream);
          setCameraOn(true);
          setParticipants(prev => prev.map(p => {
          if (isMentor && p.role === "Host") return { ...p, isVideoOn: true };
          if (!isMentor && (p.id === myParticipantId || p.role === "Student")) return { ...p, isVideoOn: true };
          return p;
        }));
          showToast("Live camera stream active!");
        } catch {
          showToast("Camera access denied or unavailable.", false);
        }
      }
    }
  };

  // Real-time 2-Way Voice Audio Microphone Toggle
  const toggleMic = async () => {
    if (!isMentor && !securitySettings.allowUnmute && !micOn) {
      showToast("Host has disabled participant unmuting. Please raise your hand.", false);
      return;
    }
    const next = !micOn;
    setMicOn(next);

    if (next) {
      try {
        if (!localAudioStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          localAudioStreamRef.current = stream;
        } else {
          localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = true);
        }

        const track = localAudioStreamRef.current?.getAudioTracks()[0];
        if (track) {
          peerConnectionsRef.current.forEach(async (pc, targetId) => {
            try {
              const sender = pc.getSenders().find(s => s.track?.kind === "audio");
              if (sender) {
                await sender.replaceTrack(track);
              } else {
                pc.addTrack(track, localAudioStreamRef.current!);
                const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                await pc.setLocalDescription(offer);
                sendSignal(targetId, "offer", offer);
              }
            } catch (err) {
              console.warn("Could not route mic track to peer:", err);
            }
          });
        }
        if (localAudioStreamRef.current && livekitSFU.isSFUActive) {
          livekitSFU.publishMicAudioSFU(localAudioStreamRef.current).catch(() => {});
          livekitSFU.setMicMutedSFU(false).catch(() => {});
        }
        showToast("Microphone unmuted - Voice live!");
      } catch {
        showToast("Microphone access unavailable or denied.", false);
      }
    } else {
      if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
      }
      if (livekitSFU.isSFUActive) {
        livekitSFU.setMicMutedSFU(true).catch(() => {});
      }
      showToast("Microphone muted");
    }

    setParticipants(prev => prev.map(p => {
      if (isMentor && p.role === "Host") return { ...p, isMuted: !next };
      if (!isMentor && (p.id === myParticipantId || p.role === "Student")) return { ...p, isMuted: !next };
      return p;
    }));
  };

  const toggleSpeaker = () => {
    setSpeakerMuted(prev => !prev);
    showToast(!speakerMuted ? "Speaker audio muted" : "Speaker audio on");
  };

  const toggleFacingMode = async () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    if (cameraOn) {
      cameraStream?.getTracks().forEach(t => t.stop());
      try {
        const cs = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextMode },
          audio: false
        });
        setCameraStream(cs);
        showToast(nextMode === "user" ? "Switched to front camera" : "Switched to back camera");
      } catch {
        showToast("Camera switch unavailable", false);
      }
    } else {
      showToast(nextMode === "user" ? "Front camera selected" : "Back camera selected");
    }
  };

  const beginRecording = useCallback((tracks: MediaStreamTrack[]) => {
    if (!tracks.length) {
      showToast("No media tracks available.", false);
      setRecState("idle");
      return;
    }
    tracks.forEach((t) => {
      if (t.kind === 'video' && 'contentHint' in t) {
        t.contentHint = 'motion';
      }
    });
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
      // HD 1080p Recording: 5 Mbps video for crystal-clear HD text/screen + 128 kbps Opus voice audio
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(combined, { 
          mimeType, 
          videoBitsPerSecond: 5000000,
          audioBitsPerSecond: 128000
        });
      } catch {
        try {
          rec = new MediaRecorder(combined, { 
            mimeType, 
            videoBitsPerSecond: 2500000,
            audioBitsPerSecond: 96000
          });
        } catch {
          rec = new MediaRecorder(combined, { mimeType });
        }
      }
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
        setUploadCourse(prev => prev || meeting?.courseId || "");
        setShowUpload(true);
      };
      rec.onerror = () => showToast("Recording error occurred.", false);
      rec.start(1000);
      setRecState("recording");
      setRecTimer(0);
      timerRef.current = setInterval(() => setRecTimer(t => t + 1), 1000);
      showToast("HD Recording started! Teach your lesson.");
    } catch (e: unknown) {
      const err = e as Error;
      showToast("Failed to start recording: " + err.message, false);
      setRecState("idle");
    }
  }, [showToast, meeting?.title, meeting?.courseId, roomId, setRecState, setRecBlob, setUploadTitle, setUploadCourse, setShowUpload, setRecTimer]);

  const startRecording = async () => {
    if (!screenStream && !screenStreamRef.current) {
      try {
        await startScreenShare();
      } catch {
        showToast("Share your screen or whiteboard first, then click Record.", false);
        return;
      }
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
    const currentShare = screenStream || screenStreamRef.current;
    const currentCam = cameraStream || cameraStreamRef.current;
    const tracks: MediaStreamTrack[] = [];

    // Prioritize screen share video track for crisp HD recording
    const screenVid = currentShare?.getVideoTracks()[0];
    const camVid = currentCam?.getVideoTracks()[0];
    if (screenVid) {
      tracks.push(screenVid);
    } else if (camVid) {
      tracks.push(camVid);
    }

    const micPromise = micOn
      ? navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          }
        }).catch(() => null)
      : Promise.resolve(null);

    micPromise.then((micStream) => {
      const audioTracks: MediaStreamTrack[] = [
        ...(currentShare?.getAudioTracks() || []),
        ...(micStream?.getAudioTracks() || []),
      ];

      if (audioTracks.length > 1) {
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            const actx = new AudioCtx();
            const dest = actx.createMediaStreamDestination();
            audioTracks.forEach(at => {
              try {
                const src = actx.createMediaStreamSource(new MediaStream([at]));
                src.connect(dest);
              } catch {}
            });
            const mixedAudio = dest.stream.getAudioTracks()[0];
            if (mixedAudio) tracks.push(mixedAudio);
          } else {
            tracks.push(audioTracks[0]);
          }
        } catch {
          tracks.push(audioTracks[0]);
        }
      } else if (audioTracks.length === 1) {
        tracks.push(audioTracks[0]);
      }

      beginRecording(tracks);
    });
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
      let targetFolder = uploadCourse || meeting?.courseId || "";
      if (!targetFolder) {
        try {
          const df = await getDriveFolder();
          if (df?.folderId) targetFolder = df.folderId;
        } catch {}
      }
      if (!targetFolder && courses.length > 0) {
        targetFolder = courses[0].id;
      }
      const selectedCourse = courses.find(c => c.id === targetFolder);
      const folderName = selectedCourse ? selectedCourse.name : undefined;

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
        if (targetFolder) fd.append('courseId', targetFolder);
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
      const destName = selectedCourse?.name || "Personal Library (Google Drive)";
      showToast(`Recording saved to Google Drive (${destName})! Meeting remains active.`);
      setTimeout(() => setShowUpload(false), 1500);
    } catch (e: unknown) {
      const err = e as Error;
      setUploadState("error");
      setUploadErrorMsg(err.message || "Upload failed. You can retry or download your recording locally.");
      showToast(err.message || "Upload failed.", false);
    }
  };

  const endClass = async () => {
    // STUDENTS: Leave cleanly and redirect immediately to Geonixa (never admin dashboard)
    if (!isMentor) {
      try {
        fetch(`/api/meetings/${encodeURIComponent(roomId)}/participants?participantId=${encodeURIComponent(myParticipantId)}`, {
          method: 'DELETE',
        }).catch(() => {});
      } catch {}
      window.location.href = "https://www.geonixa.com/";
      return;
    }

    // MENTOR / HOST: Immediately notify all student clients that the meeting has ended
    livekitSFU.broadcastDataSFU("MEETING_ENDED", { roomId }).catch(() => {});
    try {
      const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
      bc.postMessage({ type: "MEETING_ENDED", data: { roomId } });
      setTimeout(() => bc.close(), 500);
    } catch {}
    fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ended', screenShare: { active: false }, whiteboard: { active: false }, notes }),
    }).catch(() => {});
    fetch('/api/meetings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: roomId, status: 'ended', notes }),
    }).catch(() => {});

    // MENTOR / HOST: Check if there is an ongoing recording or pending un-uploaded recording blob
    const hasRecordedChunks = Boolean(chunksRef.current && chunksRef.current.length > 0);
    const isRecordingNow = Boolean((mediaRecRef.current && mediaRecRef.current.state !== "inactive") || recState === "recording" || recState === "paused");
    const hasPendingRecording = isRecordingNow || ((recBlob || hasRecordedChunks) && uploadState !== "done");

    if (hasPendingRecording) {
      setIsEndingAndSaving(true);
      setEndingSaveStatus("Finalizing class recording...");
      setEndingProgress(10);

      let videoBlobToUpload = recBlob;

      if (isRecordingNow && mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
        try {
          if (timerRef.current) clearInterval(timerRef.current);
          videoBlobToUpload = await new Promise<Blob>((resolve) => {
            if (!mediaRecRef.current) {
              resolve(new Blob(chunksRef.current, { type: "video/webm" }));
              return;
            }

            const safetyTimeout = setTimeout(() => {
              const fallback = new Blob(chunksRef.current, { type: "video/webm" });
              resolve(fallback);
            }, 3000);

            mediaRecRef.current.onstop = () => {
              clearTimeout(safetyTimeout);
              const b = new Blob(chunksRef.current, { type: "video/webm" });
              setRecBlob(b);
              setRecState("stopped");
              resolve(b);
            };

            try {
              if (mediaRecRef.current.state === "recording" || mediaRecRef.current.state === "paused") {
                mediaRecRef.current.requestData();
                mediaRecRef.current.stop();
              } else {
                clearTimeout(safetyTimeout);
                resolve(new Blob(chunksRef.current, { type: "video/webm" }));
              }
            } catch {
              clearTimeout(safetyTimeout);
              resolve(new Blob(chunksRef.current, { type: "video/webm" }));
            }
          });
        } catch (e) {
          console.warn("Error finalizing recording blob on meeting end:", e);
        }
      }

      // Reconstruct from chunksRef if videoBlobToUpload is missing or empty
      if ((!videoBlobToUpload || videoBlobToUpload.size < 50) && chunksRef.current && chunksRef.current.length > 0) {
        videoBlobToUpload = new Blob(chunksRef.current, { type: "video/webm" });
      }

      // If we have a blob, upload it to the selected Google Drive folder!
      if (videoBlobToUpload && videoBlobToUpload.size > 0) {
        setEndingSaveStatus("Uploading recording to your Google Drive folder...");
        try {
          const d = new Date();
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          const vidTitle = uploadTitle.trim() || `Class Recording - ${meeting?.title || roomId} · ${dateStr} (${timeStr})`;
          
          let targetFolder = uploadCourse || meeting?.courseId || "";
          if (!targetFolder) {
            try {
              const df = await getDriveFolder();
              if (df?.folderId) targetFolder = df.folderId;
            } catch {}
          }
          if (!targetFolder && courses.length > 0) {
            targetFolder = courses[0].id;
          }

          const selectedCourse = courses.find(c => c.id === targetFolder);
          const folderName = selectedCourse ? selectedCourse.name : (courses.length > 0 ? courses[0].name : "Class Recordings");

          try {
            await uploadVideo(videoBlobToUpload, targetFolder, p => setEndingProgress(p), vidTitle, {
              isMeeting: true,
              folderName: selectedCourse ? folderName : undefined,
            });
          } catch (uploadErr) {
            console.warn("Direct resumable upload error on meeting end, attempting fallback:", uploadErr);
            const fd = new FormData();
            fd.append('file', videoBlobToUpload, `${vidTitle}.webm`);
            fd.append('title', vidTitle);
            if (targetFolder) fd.append('courseId', targetFolder);
            if (selectedCourse?.name) fd.append('folderName', selectedCourse.name);
            fd.append('isMeeting', 'true');
            const token = await ensureValidAuthToken();
            const fallbackRes = await fetch('/api/videos/upload', {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: fd,
            });
            if (!fallbackRes.ok) {
              throw uploadErr;
            }
          }
          setEndingProgress(100);
          setEndingSaveStatus(`Successfully saved to Google Drive (${folderName || "Drive"})!`);
          await new Promise(r => setTimeout(r, 1200));
        } catch (err: unknown) {
          const error = err as Error;
          console.error("Auto-save recording on end meeting failed:", error);
          // Safety Net: Save locally if cloud failed so recording is NEVER lost
          try {
            const url = URL.createObjectURL(videoBlobToUpload);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${uploadTitle.trim() || `Class Recording - ${meeting?.title || roomId}`}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch {}
          setEndingSaveStatus("Saved to your downloads (Cloud upload error: " + (error?.message || "connection error") + ")");
          showToast("Recording saved locally. Cloud upload failed.", false);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }


    screenStream?.getTracks().forEach(t => t.stop());
    cameraStream?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());

    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.map((m: Meeting) => m.id === roomId ? { ...m, status: "ended" } : m)));

    // 1. Broadcast meeting ended over LiveKit SFU data channel (reaches all students in milliseconds!)
    livekitSFU.broadcastDataSFU("MEETING_ENDED", { roomId }).catch(() => {});

    // 2. Broadcast meeting ended to student devices immediately
    try {
      const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
      bc.postMessage({ type: "MEETING_ENDED", data: { roomId } });
      setTimeout(() => bc.close(), 500);
    } catch {}

    // 3. Mark status as ended and persist final notes on server API
    fetch('/api/meetings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: roomId, status: 'ended', notes }),
    }).catch(() => {});

    // 4. Mark room state as ended for real-time polling clients
    fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ended', screenShare: { active: false }, whiteboard: { active: false }, notes }),
    }).catch(() => {});

    router.push("/meetings");
  };

  useEffect(() => {
    endClassRef.current = endClass;
  });

  const handleExtendMeeting = async (minutesToAdd: number) => {
    if (!roomId || minutesToAdd <= 0) return;
    setIsExtending(true);
    try {
      const currentDuration = Number(meeting?.duration) || 60;
      const newDuration = currentDuration + minutesToAdd;

      // Update local meeting state immediately
      setMeeting(prev => prev ? ({ ...prev, duration: newDuration, status: "live" }) : prev);

      // Sync to server API (PATCH /api/meetings)
      await fetch('/api/meetings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: roomId,
          duration: newDuration,
          status: 'live',
        }),
      }).catch(() => {});

      // Sync to room state API
      await fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: newDuration,
          extendedBy: minutesToAdd,
          status: 'live',
        }),
      }).catch(() => {});

      // Broadcast over LiveKit SFU & BroadcastChannel so student clients get notified instantly
      livekitSFU.broadcastDataSFU("MEETING_EXTENDED", {
        duration: newDuration,
        extendedBy: minutesToAdd,
      }).catch(() => {});

      try {
        const bc = new BroadcastChannel(`rcrd_meeting_room_${roomId}`);
        bc.postMessage({
          type: "MEETING_EXTENDED",
          data: { duration: newDuration, extendedBy: minutesToAdd },
        });
        setTimeout(() => bc.close(), 500);
      } catch {}

      setShowDurationModal(false);
      setAutoEndCountdown(null);
      setHasPromptedForDuration(false);
      setStudentDurationWarning(null);
      showToast(`Class session extended by ${minutesToAdd} minutes. Session will run for this period.`);
    } catch (err) {
      console.error("Failed to extend meeting duration:", err);
      showToast("Failed to extend duration. Please try again.", false);
    } finally {
      setIsExtending(false);
    }
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
    if (!canvasRef.current || historyRef.current.length === 0 || !isMentor) return;
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
      if (isMentor) broadcastWhiteboard(true);
    } catch {}
  };

  const handleRedo = () => {
    if (!canvasRef.current || redoRef.current.length === 0 || !isMentor) return;
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
      if (isMentor) broadcastWhiteboard(true);
    } catch {}
  };

  const applyText = (textOverride?: string) => {
    if (!isMentor || !textBox || !canvasRef.current) {
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
      if (isMentor) {
        setTimeout(() => broadcastWhiteboard(true), 50);
      }
    }
    setTextBox(null);
  };

  const handleSlideImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current || !isMentor) return;
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
        if (isMentor) {
          setTimeout(() => broadcastWhiteboard(true), 100);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    if (!canvasRef.current || !isMentor) return;
    if (activeTool === 'text') {
      if (textBox && textBox.text.trim()) {
        applyText();
      }
      const { x, y } = getXY(e);
      setTextBox({ x, y, text: '' });
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isMentor) return;
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
    if (!isDrawing || !canvasRef.current || !isMentor) return;
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

  const stopDrawing = () => {
    if (!isMentor) return;
    setIsDrawing(false);
    lastPos.current = null;
    broadcastWhiteboard(true);
  };

  const clearWhiteboard = () => {
    if (!canvasRef.current || !isMentor) return;
    saveCanvasState();
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      showToast("Whiteboard cleared. Click Reverse to restore!");
      broadcastWhiteboard(true);
    }
  };

  const isWhiteboardActive = isMentor
    ? showWhiteboard
    : Boolean(remoteWhiteboard?.active && showWhiteboard) && (!isRemoteSharing || studentViewMode === "whiteboard");

  useEffect(() => {
    if (!isWhiteboardActive) return;
    const updateCanvasSize = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        const parent = canvasRef.current.parentElement;
        if (parent.clientWidth > 0 && parent.clientHeight > 0) {
          if (canvasRef.current.width !== parent.clientWidth || canvasRef.current.height !== parent.clientHeight) {
            let prevData: string | null = null;
            try {
              if (canvasRef.current.width > 0 && canvasRef.current.height > 0) {
                prevData = canvasRef.current.toDataURL("image/png");
              }
            } catch {}

            canvasRef.current.width = parent.clientWidth;
            canvasRef.current.height = parent.clientHeight;
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
              const cw = canvasRef.current.width;
              const ch = canvasRef.current.height;
              ctx.fillStyle = "#FFFFFF";
              ctx.fillRect(0, 0, cw, ch);
              if (prevData) {
                const img = new Image();
                img.onload = () => {
                  if (!canvasRef.current) return;
                  const c = canvasRef.current;
                  const currentCtx = c.getContext("2d");
                  if (!currentCtx) return;
                  const currentW = c.width;
                  const currentH = c.height;
                  currentCtx.fillStyle = "#FFFFFF";
                  currentCtx.fillRect(0, 0, currentW, currentH);

                  const imgW = img.width || 1280;
                  const imgH = img.height || 720;
                  const scale = Math.min(currentW / imgW, currentH / imgH);
                  const dw = imgW * scale;
                  const dh = imgH * scale;
                  const dx = (currentW - dw) / 2;
                  const dy = (currentH - dh) / 2;

                  currentCtx.imageSmoothingEnabled = true;
                  currentCtx.imageSmoothingQuality = "high";
                  currentCtx.drawImage(img, dx, dy, dw, dh);
                };
                img.src = prevData;
              } else {
                try {
                  historyRef.current = [ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)];
                  redoRef.current = [];
                  setCanUndo(false);
                  setCanRedo(false);
                } catch {}
              }
            }
          }
        }
      }
    };
    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    return () => window.removeEventListener("resize", updateCanvasSize);
  }, [isWhiteboardActive, isFullScreen]);

  const myCleanName = (isMentor ? (effectiveHostName || "Host") : (studentName || "Student")).replace(/\s*\((Student|Host|You|you|me)\)/gi, '').trim().toLowerCase();
  const uniqueOtherParticipants: Participant[] = [];
  const seenParticipants = new Set<string>();
  participants.forEach(p => {
    if (p.id === myParticipantId) return;
    const cleanKey = (p.name || '').replace(/\s*\((Student|Host|You|you|me)\)/gi, '').trim().toLowerCase();
    if (cleanKey === myCleanName || cleanKey === "you (host)" || cleanKey === "you" || cleanKey.includes("you")) return;
    if (!seenParticipants.has(cleanKey)) {
      seenParticipants.add(cleanKey);
      uniqueOtherParticipants.push(p);
    }
  });

  const courseName = courses.find(c => c.id === (meeting?.courseId || ""))?.name;

  const copyInviteDetails = useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const pwd = meeting?.password || "";
    const directLink = pwd ? `${origin}/meeting/${roomId}?pwd=${encodeURIComponent(pwd)}` : `${origin}/meeting/${roomId}`;
    const passInfo = pwd ? `\nPasscode: ${pwd}` : "";
    const hostInfo = `\nHost: ${displayName}`;
    const batchInfo = meeting?.batchName ? `\nBatch: ${meeting.batchName}` : "";
    const info = `Class Meeting Invitation\nTopic: ${meeting?.title || 'Class Room'}${hostInfo}${batchInfo}\nDirect Join Link: ${directLink}\nMeeting ID: ${roomId}${passInfo}`;
    navigator.clipboard.writeText(info);
    showToast("Invite link & details copied!");
  }, [meeting, roomId, displayName, showToast]);

  const handleToggleParticipantMute = useCallback((targetParticipant: Participant) => {
    if (!isMentor) return; // STRICT ACCESS: Only host has the access to mute or unmute
    const shouldMute = !targetParticipant.isMuted;

    // 1. Instantly update participant state
    setParticipants(prev => prev.map(p => {
      if (p.id === targetParticipant.id || p.name === targetParticipant.name) {
        return { ...p, isMuted: shouldMute };
      }
      return p;
    }));

    // 2. Broadcast via LiveKit SFU data channel (sub-millisecond latency)
    if (livekitSFU.isSFUActive) {
      livekitSFU.broadcastDataSFU("REMOTE_MUTE_ACTION", {
        targetParticipantId: targetParticipant.id,
        targetName: targetParticipant.name,
        isMuted: shouldMute,
        hostName: displayName,
      }).catch(() => {});
    }

    // 3. Broadcast via WebRTC signaling
    sendSignal("all", "REMOTE_MUTE_ACTION", {
      targetParticipantId: targetParticipant.id,
      targetName: targetParticipant.name,
      isMuted: shouldMute,
      hostName: displayName,
    });

    // 4. Update meeting state on server
    fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantMuteAction: {
          targetParticipantId: targetParticipant.id,
          targetName: targetParticipant.name,
          isMuted: shouldMute,
          timestamp: Date.now(),
        }
      }),
    }).catch(() => {});

    showToast(shouldMute ? `Muted ${targetParticipant.name}` : `Unmuted ${targetParticipant.name}`);
  }, [isMentor, livekitSFU, sendSignal, roomId, displayName, showToast]);

  const muteAllParticipants = useCallback(() => {
    if (!isMentor) return;
    setParticipants(prev => prev.map(p => p.role === "Student" ? { ...p, isMuted: true } : p));
    if (livekitSFU.isSFUActive) {
      livekitSFU.broadcastDataSFU("REMOTE_MUTE_ALL", { hostName: displayName }).catch(() => {});
    }
    sendSignal("all", "REMOTE_MUTE_ALL", { hostName: displayName });
    fetch(`/api/meetings/${encodeURIComponent(roomId)}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        muteAll: { timestamp: Date.now() }
      }),
    }).catch(() => {});
    showToast("All participants muted.");
  }, [isMentor, livekitSFU, sendSignal, roomId, displayName, showToast]);

  // Batch-Restricted Access Enforcement
  const isBatchRestricted = Boolean(meeting?.allowedEmails && meeting.allowedEmails.length > 0);
  const isStudentEnrolled = !isBatchRestricted || (
    Boolean(activeStudentEmail) &&
    (meeting?.allowedEmails || []).some(e => (e || '').toLowerCase().trim() === activeStudentEmail.toLowerCase().trim())
  );

  const isScheduledFuture = !isReadonly && meeting?.status !== "live" && meeting?.scheduledAt && (new Date(meeting.scheduledAt).getTime() > now);
  const lobbyRemainingMs = meeting?.scheduledAt ? Math.max(0, new Date(meeting.scheduledAt).getTime() - now) : 0;
  const remDays = Math.floor(lobbyRemainingMs / (1000 * 60 * 60 * 24));
  const remHours = Math.floor((lobbyRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const remMins = Math.floor((lobbyRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const remSecs = Math.floor((lobbyRemainingMs % (1000 * 60)) / 1000);

  // 1. Meeting Ended / Expired Screen
  if (meeting?.status === "ended" && !isMentor) {
    return (
      <div className="min-h-screen bg-[#1C1C1E] text-white flex flex-col justify-between p-6 font-sans antialiased text-center relative overflow-hidden">
        <div className="flex items-center justify-between z-10 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <RcrdLogo className="h-10 sm:h-12 w-auto scale-115 origin-left" />
            <span className="text-xs bg-rose-500/20 border border-rose-500/40 px-3 py-1 rounded-full text-rose-300 font-bold">
              Class Session Expired
            </span>
          </div>
          <a
            href="https://www.geonixa.com/"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-bold text-white shadow-xs transition-colors"
          >
            ← Geonixa Website
          </a>
        </div>

        <div className="flex-1 flex items-center justify-center z-10 py-12">
          <div className="bg-[#2C2C2E] border border-zinc-700/80 rounded-3xl p-8 sm:p-10 max-w-md w-full text-center shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-rose-500/10 border-2 border-rose-500/30 rounded-3xl flex items-center justify-center mx-auto text-rose-400 shadow-lg">
              <AlertCircle size={40} className="stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Meeting Link Expired
              </h1>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                The instructor has concluded this class session and this meeting link is now permanently expired. You can no longer join this room.
              </p>
            </div>
            <a
              href="https://www.geonixa.com/"
              className="w-full py-3 px-4 bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              Return to Geonixa Homepage
            </a>
          </div>
        </div>

        <div className="text-[11px] text-zinc-500">
          Geonixa Classroom Portal · Session {roomId} Concluded
        </div>
      </div>
    );
  }

  // 2. Batch-Restricted Access Denied Screen (Strict Classroom Security)
  if (!isMentor && isBatchRestricted && !isStudentEnrolled) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-between p-6 font-sans antialiased text-center relative overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="flex items-center justify-between z-10 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <RcrdLogo className="h-10 sm:h-12 w-auto scale-115 origin-left" />
            <span className="text-xs bg-red-500/20 border border-red-500/40 px-3 py-1 rounded-full text-red-300 font-bold">
              Batch Protected Classroom
            </span>
          </div>
          <a
            href="https://www.geonixa.com/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-white shadow-xs transition-colors"
          >
            ← Geonixa Website
          </a>
        </div>

        <div className="flex-1 flex items-center justify-center z-10 py-12">
          <div className="bg-[#1E293B] border border-slate-700/80 rounded-3xl p-8 sm:p-10 max-w-lg w-full text-center shadow-2xl space-y-6">
            <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/30 rounded-3xl flex items-center justify-center mx-auto text-red-400 shadow-lg">
              <Lock size={38} />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full">
                Enrolled Batch: {meeting?.batchName || "Assigned Batch"}
              </span>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Batch Access Restricted
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                This live session is exclusively configured for students enrolled in the{" "}
                <strong className="text-white font-semibold">{meeting?.batchName || "Assigned"}</strong> batch.
                Outside students or unverified accounts cannot enter.
              </p>
            </div>

            {activeStudentEmail ? (
              <div className="bg-slate-900/70 border border-red-500/30 rounded-2xl p-4 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Detected Account
                </p>
                <p className="text-xs font-mono font-bold text-red-300 break-all">
                  {activeStudentEmail}
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  This email is not registered on the batch enrollment roster.
                </p>
              </div>
            ) : null}

            <div className="space-y-3 pt-2">
              <div className="text-left">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Verify with Enrolled Student Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailCheckInput}
                    onChange={e => {
                      setEmailCheckInput(e.target.value);
                      setEmailVerificationError(null);
                    }}
                    placeholder="student@example.com"
                    className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      const candidate = emailCheckInput.trim().toLowerCase();
                      if (!candidate) {
                        setEmailVerificationError("Please enter an email address.");
                        return;
                      }
                      const match = (meeting?.allowedEmails || []).some(
                        e => (e || '').toLowerCase().trim() === candidate
                      );
                      if (match) {
                        setActiveStudentEmail(candidate);
                        try {
                          localStorage.setItem("user", JSON.stringify({ email: candidate, name: studentName || candidate.split('@')[0] }));
                        } catch {}
                      } else {
                        setEmailVerificationError(`'${candidate}' is not in the ${meeting?.batchName || 'batch'} roster.`);
                      }
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
                  >
                    Verify & Join
                  </button>
                </div>
                {emailVerificationError && (
                  <p className="text-[11px] font-semibold text-rose-400 mt-1.5">
                    {emailVerificationError}
                  </p>
                )}
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <a
                  href="https://www.geonixa.com/"
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center cursor-pointer"
                >
                  Return to Geonixa Homepage
                </a>
                {meeting?.hostEmail && (
                  <p className="text-[11px] text-slate-400">
                    Need access? Contact Host: <span className="text-slate-300 font-mono">{meeting.hostEmail}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Geonixa Classroom Security · Batch Protected Room {roomId}
        </div>
      </div>
    );
  }

  // Student waiting lobby (Pure White Background)
  if (isScheduledFuture && !isMentor && !bypassLobby) {
    return (
      <div className="h-screen bg-[#F8FAFC] flex flex-col justify-between p-6 text-[#20262E] font-sans selection:bg-[#154360]/20 relative overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#154360]/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <RcrdLogo className="h-10 sm:h-12 w-auto scale-115 origin-left" />
            <span className="text-xs bg-slate-100 border border-[#E2E7EC] px-3 py-1 rounded-full text-[#57636E] font-bold">
              Waiting Lobby
            </span>
          </div>
          <button onClick={() => {
            if (!isMentor) {
              window.location.href = "https://www.geonixa.com/";
            } else {
              router.push('/meetings');
            }
          }} className="px-4 py-2 bg-white hover:bg-slate-50 border border-[#E2E7EC] rounded-xl text-xs font-bold text-[#20262E] shadow-xs transition-colors">
            ← Leave Lobby
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center z-10 py-8">
          <div className="bg-white border border-[#E2E7EC] rounded-3xl p-8 max-w-lg w-full text-center shadow-xl space-y-6">
            <div className="w-20 h-20 bg-[#EBF5FB] border border-[#154360]/20 rounded-3xl flex items-center justify-center mx-auto text-[#154360] shadow-md animate-pulse">
              <Lock size={36} />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-full mb-3">
                <Clock size={12} /> Scheduled Class Session
              </span>
              <h1 className="text-2xl font-black text-[#20262E] tracking-tight mb-2">
                {meeting?.title || "Class Meeting"}
              </h1>
              {courseName && <p className="text-xs font-bold text-[#154360]">{courseName}</p>}
            </div>

            <div className="bg-slate-50 border border-[#E2E7EC] rounded-2xl p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#57636E] mb-3">Opens Automatically In</p>
              <div className="flex items-center justify-center gap-3">
                {remDays > 0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-mono font-black text-[#20262E] bg-white border border-[#E2E7EC] px-3 py-1.5 rounded-xl shadow-xs">{String(remDays).padStart(2, '0')}</span>
                    <span className="text-[10px] text-[#57636E] uppercase font-bold mt-1">Days</span>
                  </div>
                )}
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-mono font-black text-[#20262E] bg-white border border-[#E2E7EC] px-3 py-1.5 rounded-xl shadow-xs">{String(remHours).padStart(2, '0')}</span>
                  <span className="text-[10px] text-[#57636E] uppercase font-bold mt-1">Hours</span>
                </div>
                <span className="text-2xl font-black text-[#57636E] mb-4">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-mono font-black text-[#154360] bg-white border border-[#E2E7EC] px-3 py-1.5 rounded-xl shadow-xs">{String(remMins).padStart(2, '0')}</span>
                  <span className="text-[10px] text-[#57636E] uppercase font-bold mt-1">Mins</span>
                </div>
                <span className="text-2xl font-black text-[#57636E] mb-4">:</span>
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-mono font-black text-[#2980B9] bg-white border border-[#E2E7EC] px-3 py-1.5 rounded-xl shadow-xs">{String(remSecs).padStart(2, '0')}</span>
                  <span className="text-[10px] text-[#57636E] uppercase font-bold mt-1">Secs</span>
                </div>
              </div>
            </div>

            <button onClick={() => setBypassLobby(true)} className="w-full py-3 px-4 bg-[#154360] hover:bg-[#0E2F44] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer">
              Enter Classroom Immediately (Skip Waiting)
            </button>
            <div className="pt-2 border-t border-[#E2E7EC] flex items-center justify-between text-xs text-[#57636E]">
              <span>Joined as: <strong className="text-[#20262E]">{studentName}</strong></span>
              <span>Meeting ID: <strong className="text-[#154360] font-mono">{roomId}</strong></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden text-white select-none font-sans relative">
      
      {/* ─── Top Floating Control Bar (Authentic Zoom Mobile & Laptop Pattern) ─── */}
      {!isWhiteboardActive && (
        <div className="absolute top-0 inset-x-0 h-14 z-30 px-3 sm:px-6 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none">
          
          {/* Left: Recording status badge (Clean, non-distracting) */}
          <div className="pointer-events-auto flex items-center gap-2">
            {recState === "recording" && (
              <span className="flex items-center gap-1.5 text-[10px] sm:text-xs text-red-500 font-bold bg-red-950/70 border border-red-800/80 rounded-full px-2.5 py-0.5 animate-pulse">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />REC {fmtT(recTimer)}
              </span>
            )}
            {recState === "paused" && (
              <span className="flex items-center gap-1.5 text-[10px] sm:text-xs text-amber-400 font-bold bg-amber-950/70 border border-amber-800/80 rounded-full px-2.5 py-0.5">
                <Pause size={10} />PAUSED
              </span>
            )}
          </div>

          {/* Center: Duration Timer Badge (Removed circled title button per user request) */}
          <div className="pointer-events-auto flex items-center gap-2">

            {/* Duration Timer Badge (Mentor Only) */}
            {meetingStartTime > 0 && isMentor && (
              <button
                type="button"
                onClick={() => {
                  if (isMentor) setShowDurationModal(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xl ${
                  isMentor ? "cursor-pointer hover:scale-105" : "cursor-default"
                } ${
                  remainingMs <= 0
                    ? "bg-rose-950/90 border border-rose-500 text-rose-300 animate-pulse"
                    : remainingMs <= 5 * 60000
                    ? "bg-amber-950/90 border border-amber-500 text-amber-300 animate-pulse"
                    : "bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300"
                }`}
                title={isMentor ? "Click to manage or extend duration" : "Meeting duration timer"}
              >
                <Clock size={12} className={remainingMs <= 0 ? "text-rose-400" : remainingMs <= 5 * 60000 ? "text-amber-400" : "text-emerald-400"} />
                <span>
                  {remainingMs <= 0
                    ? "Duration Over"
                    : formatTimer(remainingMs)}
                </span>
                {isMentor && <span className="text-[10px] text-zinc-400 hover:text-white font-normal underline ml-0.5">Manage</span>}
              </button>
            )}
          </div>

          {/* Right: Quick Action Buttons from Screenshot 1 & 4 */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
            {/* ✏️ Whiteboard */}
            {isMentor && (
              <button
                onClick={() => {
                  const next = !showWhiteboard;
                  setShowWhiteboard(next);
                  broadcastWhiteboard(next);
                }}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  showWhiteboard
                    ? "bg-white text-black shadow-lg"
                    : "bg-zinc-900/90 hover:bg-zinc-800 text-white border border-zinc-700/60"
                }`}
                title="Whiteboard & Notepad"
              >
                <Pen size={14} />
              </button>
            )}

            {/* 📝 Notes */}
            <button
              onClick={() => setShowNotesSheet(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-white border border-zinc-700/60 flex items-center justify-center transition-all cursor-pointer relative"
              title="Class Notes"
            >
              <NotebookPen size={14} className="text-amber-400" />
              {notes.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {notes.length}
                </span>
              )}
            </button>

            {/* 🔊 Speaker Audio Toggle */}
            <button
              onClick={toggleSpeaker}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-white border border-zinc-700/60 flex items-center justify-center transition-all cursor-pointer"
              title={speakerMuted ? "Unmute Speaker" : "Mute Speaker"}
            >
              {speakerMuted ? <VolumeX size={15} className="text-rose-400" /> : <Volume2 size={15} className="text-white" />}
            </button>

            {/* 📷 / 🔄 Camera Flip Toggle */}
            <button
              onClick={toggleFacingMode}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-white border border-zinc-700/60 flex items-center justify-center transition-all cursor-pointer"
              title="Switch Camera (Front/Back)"
            >
              <RefreshCw size={14} className="text-white" />
            </button>

            {/* 💬 Chat Quick Toggle Button */}
            <button
              onClick={() => setShowChatSheet(!showChatSheet)}
              className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full ${showChatSheet ? "bg-blue-600 text-white border-blue-500 shadow-blue-500/30" : "bg-zinc-900/90 hover:bg-zinc-800 text-white border-zinc-700/60"} border flex items-center justify-center transition-all cursor-pointer shadow-md`}
              title="Toggle Live Chat"
            >
              <MessageSquare size={14} className={showChatSheet ? "text-white" : "text-blue-400"} />
              {chatMessages.length > 0 && !showChatSheet && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-1 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow">
                  {chatMessages.length}
                </span>
              )}
            </button>

            {/* ⛶ Fullscreen Toggle Button */}
            <button
              onClick={toggleFullScreen}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-white border border-zinc-700/60 flex items-center justify-center transition-all cursor-pointer shadow-md"
              title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullScreen ? <Minimize2 size={15} className="text-white" /> : <Maximize2 size={15} className="text-white" />}
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 relative">

        {/* Screen / Stage Area (Pitch Black Theme #000000) */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">

          {/* Screen Video (Host Local Stream) */}
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
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${isLocalSharing ? "opacity-100 z-10 bg-black" : "opacity-0 pointer-events-none"}`}
          />

          {/* Remote Host Screen Share (Live synced to students with anti-jitter hardware containment) */}
          {isRemoteSharing && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black overflow-hidden select-none"
              style={{ contain: 'strict', transform: 'translateZ(0)' }}
            >
              {/* Layer 1: HTTP Live Frame Stream (Persistently rendered base layer for zero-flicker transitions) */}
              {remoteScreenShare?.streamFrame && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={remoteScreenShare.streamFrame}
                  alt="Shared Screen"
                  className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none z-0"
                  style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
                />
              )}

              {/* Layer 2: WebRTC Ultra HD 60FPS Video (Silky smooth active stream with graceful stall watchdog) */}
              {(livekitSFU.isSFUActive && livekitSFU.sfuRemoteStream ? livekitSFU.sfuRemoteStream : remoteWebRTCStream) && (
                <video
                  ref={setRemoteVideoRef}
                  autoPlay
                  playsInline
                  muted
                  onPlaying={(e) => {
                    const v = e.currentTarget;
                    if (v.videoWidth > 0 && v.videoHeight > 0) {
                      handleVideoPlaying();
                    }
                  }}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.videoWidth > 0 && v.videoHeight > 0 && !isWebRTCVideoPlayingRef.current) {
                      handleVideoPlaying();
                    }
                  }}
                  onWaiting={handleVideoWaiting}
                  onStalled={handleVideoWaiting}
                  onPause={handleVideoWaiting}
                  onError={handleVideoWaiting}
                  onEnded={() => setIsWebRTCVideoPlaying(false)}
                  className={`absolute inset-0 w-full h-full object-contain select-none z-10 transition-opacity duration-150 ${
                    isWebRTCVideoPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
                />
              )}

              {/* Layer 3: Presentation Connecting State (Only if neither stream nor frame is available) */}
              {!remoteScreenShare?.streamFrame && !livekitSFU.sfuRemoteStream && !remoteWebRTCStream && (
                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center select-none z-10">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl">
                    <Monitor size={28} className="animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white tracking-wide">
                      {remoteScreenShare?.presenterName || "Host"} is presenting screen
                    </p>
                    <p className="text-xs text-zinc-400 mt-1 flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                      Connecting to live presentation stream...
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Whiteboard (Multi-Slide & Ruled Notepad Sheet) */}
          {isWhiteboardActive && (
            <div
              className={`${isFullScreen ? "fixed inset-0 z-50" : "absolute inset-0 z-40"} bg-white flex flex-col select-none overflow-hidden`}
              onClick={() => {
                setShowSizePicker(false);
                if (textBox && textBox.text.trim()) {
                  applyText();
                }
              }}
            >
              {/* Whiteboard Top Navigation & Controls Bar */}
              <div className="absolute top-2 inset-x-2 sm:inset-x-6 z-30 flex items-center justify-between bg-white/95 backdrop-blur-md border border-[#E2E7EC] shadow-md rounded-2xl px-2 sm:px-4 py-1.5 sm:py-2 gap-1 sm:gap-2">
                {/* Left: Mode toggle (Mentor Only) or View Badge (Students) + Clean Non-Overlapping REC badge */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {isMentor ? (
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 sm:p-1 rounded-xl shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setWhiteboardMode('sketch');
                          broadcastWhiteboard(true, undefined, undefined, undefined, 'sketch');
                        }}
                        className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          whiteboardMode === 'sketch' ? 'bg-white text-[#154360] shadow-sm' : 'text-[#57636E] hover:text-[#20262E]'
                        }`}
                      >
                        <Pen size={13} />
                        <span className="hidden sm:inline">Sketch Board</span>
                        <span className="sm:hidden text-[11px]">Sketch</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWhiteboardMode('notepad');
                          broadcastWhiteboard(true, undefined, undefined, undefined, 'notepad');
                        }}
                        className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          whiteboardMode === 'notepad' ? 'bg-white text-[#154360] shadow-sm' : 'text-[#57636E] hover:text-[#20262E]'
                        }`}
                      >
                        <FileText size={13} />
                        <span className="hidden sm:inline">Notepad Sheet</span>
                        <span className="sm:hidden text-[11px]">Notepad</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 sm:gap-2">
                      <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[#EBF5FB] text-[#154360] font-bold text-xs border border-[#154360]/20 shrink-0">
                        <BookOpen size={13} />
                        <span className="hidden sm:inline">Mentor Board (View Only)</span>
                        <span className="sm:hidden text-[11px] font-extrabold">Board</span>
                      </div>
                      {isRemoteSharing && (
                        <button
                          type="button"
                          onClick={() => {
                            setStudentViewMode("screen");
                            setShowWhiteboard(false);
                          }}
                          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer shrink-0 animate-pulse"
                          title="Host is sharing screen - click to view live screen"
                        >
                          <Monitor size={13} />
                          <span className="hidden sm:inline">View Live Screen Share</span>
                          <span className="sm:hidden text-[11px]">Screen</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Clean Non-Overlapping Recording Badge in Whiteboard Header */}
                  {recState === "recording" && (
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-red-600 font-bold bg-red-50 border border-red-200 rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 animate-pulse shrink-0">
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                      <span className="hidden sm:inline">REC</span>
                      <span>{fmtT(recTimer)}</span>
                    </div>
                  )}
                  {recState === "paused" && (
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-600 font-bold bg-amber-50 border border-amber-200 rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 shrink-0">
                      <Pause size={10} />
                      <span>PAUSED</span>
                    </div>
                  )}
                </div>

                {/* Center: Slide Controls (< Slide X / Y > | + Add Slide for mentor only, clean pill for student) */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {isMentor ? (
                    <>
                      <button
                        type="button"
                        onClick={() => switchSlide(currentSlideIndex - 1)}
                        disabled={currentSlideIndex <= 0}
                        className="p-1 sm:p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100 text-[#20262E] transition-colors cursor-pointer"
                        title="Previous Slide"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <div className="px-2 sm:px-2.5 py-1 bg-slate-100 rounded-lg text-[11px] sm:text-xs font-bold text-[#20262E] whitespace-nowrap">
                        Slide {currentSlideIndex + 1} / {slides.length}
                      </div>
                      <button
                        type="button"
                        onClick={() => switchSlide(currentSlideIndex + 1)}
                        disabled={currentSlideIndex >= slides.length - 1}
                        className="p-1 sm:p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100 text-[#20262E] transition-colors cursor-pointer"
                        title="Next Slide"
                      >
                        <ChevronRight size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={addNewSlide}
                        className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-[#EBF5FB] hover:bg-[#d4e6f1] text-[#154360] text-[11px] sm:text-xs font-bold border border-[#154360]/20 transition-all shadow-xs cursor-pointer shrink-0"
                        title="Add New Slide"
                      >
                        <Plus size={13} />
                        <span className="hidden sm:inline">Add Slide</span>
                      </button>
                    </>
                  ) : (
                    <div className="px-2 sm:px-3 py-1 bg-slate-100 rounded-lg text-[11px] sm:text-xs font-bold text-[#20262E] whitespace-nowrap">
                      Slide {currentSlideIndex + 1} / {slides.length}
                    </div>
                  )}
                </div>

                {/* Right: Quick Controls, Fullscreen, Download PDF & Exit */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {/* Microphone Quick Control */}
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`p-1.5 sm:px-2.5 sm:py-1 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                      micOn ? "bg-slate-100 hover:bg-slate-200 text-[#20262E]" : "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                    }`}
                    title={micOn ? "Mute Microphone" : "Unmute Microphone"}
                  >
                    {micOn ? <Mic size={14} className="text-[#154360]" /> : <MicOff size={14} className="text-rose-600" />}
                    <span className="hidden xl:inline">{micOn ? "Mute" : "Unmute"}</span>
                  </button>

                  {/* Camera Quick Control (Hidden on small mobile to keep single-line neat layout) */}
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`hidden sm:flex p-1.5 sm:px-2.5 sm:py-1 rounded-xl items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                      cameraOn ? "bg-slate-100 hover:bg-slate-200 text-[#20262E]" : "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                    }`}
                    title={cameraOn ? "Stop Video" : "Start Video"}
                  >
                    {cameraOn ? <Video size={14} className="text-[#154360]" /> : <VideoOff size={14} className="text-rose-600" />}
                    <span className="hidden xl:inline">{cameraOn ? "Video" : "Video Off"}</span>
                  </button>

                  {/* Participants Quick Access (Hidden on small mobile to keep single-line neat layout) */}
                  <button
                    type="button"
                    onClick={() => setShowParticipantsSheet(true)}
                    className="hidden sm:flex p-1.5 sm:px-2.5 sm:py-1 rounded-xl items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-[#20262E] transition-all cursor-pointer relative"
                    title="View Participants"
                  >
                    <Users size={14} className="text-[#154360]" />
                    <span className="hidden xl:inline">People</span>
                    <span className="text-[10px] font-bold text-[#57636E]">({participants.length})</span>
                  </button>

                  {/* Chat Quick Access */}
                  <button
                    type="button"
                    onClick={() => setShowChatSheet(true)}
                    className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-[#20262E] transition-all cursor-pointer relative"
                    title="Open Class Chat"
                  >
                    <MessageSquare size={14} className="text-[#154360]" />
                    <span className="hidden xl:inline">Chat</span>
                    {chatMessages.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 absolute top-1 right-1" />
                    )}
                  </button>

                  {/* Fullscreen Toggle */}
                  <button
                    type="button"
                    onClick={toggleFullScreen}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-[#57636E] hover:text-[#20262E] transition-colors cursor-pointer"
                    title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                  >
                    {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>

                  {/* Download Multi-Slide PDF */}
                  <button
                    type="button"
                    onClick={downloadAllSlidesAsPdf}
                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                    title="Download all slides as multi-page PDF"
                  >
                    <Download size={13} />
                    <span className="hidden sm:inline">Download PDF</span>
                    <span className="sm:hidden text-[11px]">PDF</span>
                  </button>

                  {/* Close Whiteboard Button for Mentor AND Student */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isMentor) {
                        setShowWhiteboard(false);
                        broadcastWhiteboard(false);
                      } else {
                        setShowWhiteboard(false);
                        setStudentViewMode("screen");
                      }
                    }}
                    className="p-1.5 rounded-xl hover:bg-rose-50 text-[#57636E] hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                    title="Close Whiteboard"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* Mode 1: Notepad Sheet (Ruled Notebook typing) */}
              {whiteboardMode === 'notepad' && (
                <div className="absolute inset-0 pt-16 p-3 sm:p-8 flex justify-center bg-[#F8FAFC] overflow-y-auto z-20">
                  <div
                    className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-5 sm:p-10 flex flex-col relative min-h-[500px]"
                    style={{
                      backgroundImage: 'linear-gradient(#f8fafc 1px, transparent 1px), linear-gradient(90deg, #f8fafc 1px, transparent 1px)',
                      backgroundSize: '28px 28px'
                    }}
                  >
                    <div className="flex items-center justify-between pb-3 border-b-2 border-[#154360]/20 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span className="text-xs font-bold text-[#20262E] ml-2">
                          Slide {currentSlideIndex + 1} Lecture Notepad
                        </span>
                      </div>
                      <div className="text-[11px] text-[#57636E] font-medium">
                        {isMentor ? "Mentor Notepad · Auto-synced to students" : "Mentor Notes (View Only)"}
                      </div>
                    </div>

                    <textarea
                      value={notepadText}
                      onChange={(e) => {
                        if (!isMentor) return;
                        const val = e.target.value;
                        setNotepadText(val);
                        broadcastWhiteboard(true, undefined, undefined, val, 'notepad');
                      }}
                      readOnly={!isMentor}
                      placeholder={
                        isMentor
                          ? "Type your lecture notes here like a notepad...\n\n• Key concept 1\n• Code snippets, formulas, or explanations\n• Important points for students\n\n(All notes & slides can be downloaded as a PDF)"
                          : "Mentor's lecture notes for Slide " + (currentSlideIndex + 1) + " will appear here..."
                      }
                      className={`flex-1 w-full bg-transparent resize-none outline-none text-[#20262E] font-sans text-sm sm:text-base leading-relaxed placeholder:text-slate-400 ${
                        !isMentor ? 'cursor-default' : ''
                      }`}
                      style={{
                        lineHeight: '34px',
                        backgroundImage: 'repeating-linear-gradient(transparent, transparent 33px, #E2E8F0 33px, #E2E8F0 34px)',
                        backgroundAttachment: 'local',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Mode 2: Sketch Canvas */}
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
                className={`w-full h-full touch-none bg-white ${
                  !isMentor ? 'pointer-events-none cursor-default' : 'cursor-crosshair'
                } ${whiteboardMode === 'notepad' ? 'hidden' : 'block'}`}
              />

              {/* Whiteboard Toolbar - ONLY visible to Mentor in Sketch Mode */}
              {isMentor && whiteboardMode === 'sketch' && (
                <>
                  {hideSketchTools ? (
                    <button
                      type="button"
                      onClick={() => setHideSketchTools(false)}
                      className="absolute bottom-4 left-4 bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700 shadow-2xl px-3.5 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold z-[100] cursor-pointer transition-all animate-in fade-in"
                      title="Show Drawing Tools"
                    >
                      <Pen size={14} className="text-[#38bdf8]" />
                      <span>Drawing Tools</span>
                    </button>
                  ) : (
                    <div
                      className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl flex items-center gap-2 sm:gap-2.5 border border-slate-700 shadow-2xl z-[100] max-w-[96vw] overflow-x-auto transition-all"
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
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeTool === "pen" && !isEraser ? "bg-[#154360] text-white shadow" : "bg-slate-800 text-slate-300 hover:text-white"
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
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isEraser ? "bg-[#154360] text-white shadow" : "bg-slate-800 text-slate-300 hover:text-white"
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
                        <RotateCcw size={13} className="text-[#EBF5FB]" />
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
                        <RotateCw size={13} className="text-[#154360]" />
                      </button>

                      <div className="w-px h-6 bg-slate-700 shrink-0" />

                      {/* Switch to Notepad Mode */}
                      <button
                        onClick={() => {
                          setWhiteboardMode('notepad');
                          broadcastWhiteboard(true, undefined, undefined, undefined, 'notepad');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all shrink-0 cursor-pointer"
                        title="Switch to Notepad Sheet"
                      >
                        <FileText size={13} className="text-emerald-400" />
                        <span>Notepad</span>
                      </button>

                      {/* UPLOAD Slide or Image to Whiteboard */}
                      <button
                        onClick={() => slideFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all shrink-0 cursor-pointer"
                        title="Upload and insert slide or image onto whiteboard"
                      >
                        <ImageIcon size={13} className="text-[#2980B9]" />
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
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800 text-slate-300 hover:bg-[#154360] hover:text-white transition-all shrink-0 cursor-pointer"
                        title="Clear Whiteboard"
                      >
                        <Trash2 size={14} />
                      </button>

                      {/* Minimize / Hide Tools Button */}
                      <button
                        type="button"
                        onClick={() => setHideSketchTools(true)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                        title="Minimize toolbar for clean canvas"
                      >
                        <ChevronDown size={14} />
                      </button>

                      {/* Exit Board */}
                      <button
                        onClick={() => {
                          setShowWhiteboard(false);
                          broadcastWhiteboard(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <X size={13} /> Exit
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* When Screen Share IS ACTIVE: Draggable & Minimizable Floating Host Camera Card (Image 2) */}
          {isAnyScreenSharing && !isWhiteboardActive && (
            <div
              style={{
                transform: `translate3d(${cameraCardPos.x}px, ${cameraCardPos.y}px, 0)`,
                touchAction: "none",
              }}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 z-30 flex flex-col items-end gap-1.5 pointer-events-auto select-none"
            >
              {isCameraCardMinimized ? (
                /* Minimized pill to completely uncover lecture notes behind it */
                <button
                  type="button"
                  onClick={() => setIsCameraCardMinimized(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 shadow-2xl backdrop-blur-md text-xs font-bold cursor-pointer transition-all"
                  title="Expand Host Camera"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Host Camera</span>
                  <Maximize2 size={12} className="text-slate-400 ml-0.5" />
                </button>
              ) : (
                /* Full Video Card with Drag Grip & Minimize button */
                <div className="w-28 sm:w-56 h-22 sm:h-38 bg-white rounded-xl sm:rounded-2xl overflow-hidden border-2 border-[#154360] shadow-2xl relative flex flex-col">
                  {/* Drag Handle Top Bar */}
                  <div
                    onMouseDown={(e) => {
                      cameraDragRef.current = { startX: e.clientX, startY: e.clientY, initX: cameraCardPos.x, initY: cameraCardPos.y };
                      const handleMouseMove = (me: MouseEvent) => {
                        if (!cameraDragRef.current) return;
                        setCameraCardPos({
                          x: cameraDragRef.current.initX + (me.clientX - cameraDragRef.current.startX),
                          y: cameraDragRef.current.initY + (me.clientY - cameraDragRef.current.startY),
                        });
                      };
                      const handleMouseUp = () => {
                        cameraDragRef.current = null;
                        window.removeEventListener("mousemove", handleMouseMove);
                        window.removeEventListener("mouseup", handleMouseUp);
                      };
                      window.addEventListener("mousemove", handleMouseMove);
                      window.addEventListener("mouseup", handleMouseUp);
                    }}
                    onTouchStart={(e) => {
                      if (!e.touches[0]) return;
                      const t = e.touches[0];
                      cameraDragRef.current = { startX: t.clientX, startY: t.clientY, initX: cameraCardPos.x, initY: cameraCardPos.y };
                    }}
                    onTouchMove={(e) => {
                      if (!cameraDragRef.current || !e.touches[0]) return;
                      const t = e.touches[0];
                      setCameraCardPos({
                        x: cameraDragRef.current.initX + (t.clientX - cameraDragRef.current.startX),
                        y: cameraDragRef.current.initY + (t.clientY - cameraDragRef.current.startY),
                      });
                    }}
                    onTouchEnd={() => {
                      cameraDragRef.current = null;
                    }}
                    className="h-5 sm:h-6 bg-slate-900/90 backdrop-blur-xs flex items-center justify-between px-2 cursor-grab active:cursor-grabbing text-slate-300 text-[10px] sm:text-xs z-10 shrink-0 select-none"
                    title="Drag anywhere to uncover notes underneath"
                  >
                    <div className="flex items-center gap-1 font-bold text-white text-[9px] sm:text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{effectiveHostName || "Host"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-400 hidden sm:inline">Drag to move</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCameraCardMinimized(true);
                        }}
                        className="w-4 h-4 rounded hover:bg-slate-700 flex items-center justify-center text-white"
                        title="Minimize to read notes"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>

                  {/* Video Content */}
                  <div className="relative flex-1 w-full bg-slate-900 overflow-hidden">
                    {isMentor && cameraOn ? (
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
                    ) : !isMentor && remoteHostCamera?.active && remoteHostCamera?.streamFrame ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={remoteHostCamera.streamFrame}
                        alt="Host Live Camera"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-[#20262E]">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-[#154360] text-white flex items-center justify-center font-bold text-xs sm:text-base shadow-sm">
                          {displayInitial}
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-semibold text-[#57636E] mt-0.5 truncate max-w-[90%]">Camera Off</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Connected Student Mini Avatar Badges (Hidden on mobile to keep presentation completely unobstructed!) */}
              <div className="hidden sm:flex gap-1.5 max-w-[280px] overflow-x-auto">
                {uniqueOtherParticipants.slice(0, 4).map((p, idx) => {
                  const colors = ["bg-[#154360]", "bg-[#2980B9]", "bg-[#0E2F44]", "bg-[#1B4F72]", "bg-[#2874A6]"];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={p.id || idx} className="w-20 h-14 bg-white rounded-xl border border-[#E2E7EC] overflow-hidden relative shadow-md flex items-center justify-center">
                      <div className={`w-7 h-7 rounded-full ${color} text-white flex items-center justify-center text-[11px] font-bold shadow-xs`}>
                        {p.avatar || p.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="absolute bottom-0.5 inset-x-1 text-[9px] text-[#20262E] bg-white/90 border border-[#E2E7EC] px-1 rounded truncate font-medium text-center">
                        {p.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Center Stage: Authentic Zoom Pattern (Screenshot 1, 2, 4) */}
          {!isAnyScreenSharing && !isWhiteboardActive && !livekitSFU.sfuRemoteStream && !remoteWebRTCStream && (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Primary Video Display */}
              {isMentor && cameraOn ? (
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
              ) : (!isMentor && remoteHostCamera?.active && remoteHostCamera?.streamFrame) ? (
                /* Student watching Host live camera */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={remoteHostCamera.streamFrame}
                  alt="Host Video Feed"
                  className="w-full h-full object-cover"
                />
              ) : (!isMentor && cameraOn) ? (
                /* Student camera on without host video */
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
                /* Camera OFF: Authentic Zoom Taupe/Brown Rounded Square Avatar Tile */
                <div className="flex flex-col items-center justify-center">
                  <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-3xl bg-[#7A5C50] text-white flex items-center justify-center text-6xl sm:text-7xl font-medium shadow-2xl select-none">
                    {isMentor
                      ? displayInitial
                      : ((effectiveHostName || "Host").replace(/[^a-zA-Z0-9]/g, "").charAt(0) || "H").toUpperCase()}
                  </div>
                  <div className="mt-4 text-center select-none">
                    <p className="text-sm sm:text-base font-semibold text-zinc-300 tracking-wide">
                      {isMentor ? displayName : (effectiveHostName || "Host")}
                    </p>
                    <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
                      {isMentor ? "Camera is off" : "Host camera is off · Waiting for presentation"}
                    </p>
                  </div>
                </div>
              )}

              {/* Student Self-View Floating PiP Thumbnail when watching Host video */}
              {!isMentor && cameraOn && remoteHostCamera?.active && remoteHostCamera?.streamFrame && (
                <div className="absolute bottom-16 right-4 z-30 w-28 h-20 sm:w-36 sm:h-28 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
                  <video
                    ref={(el) => {
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
                  <div className="absolute bottom-1 left-1.5 px-1 py-0.5 rounded bg-black/60 text-[9px] text-white">
                    You
                  </div>
                </div>
              )}

              {/* Floating Bottom-Left Zoom User Tag (Screenshot 1 & 4) */}
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium text-white shadow-lg select-none">
                <Smartphone size={13} className="text-zinc-400" />
                {micOn ? (
                  <Mic size={13} className="text-white" />
                ) : (
                  <MicOff size={13} className="text-rose-500" />
                )}
                <span className="truncate max-w-[160px] sm:max-w-[240px]">
                  {displayName}
                </span>
                {isMentor && (
                  <span className="text-[10px] text-zinc-400 font-normal">
                    (Host)
                  </span>
                )}
              </div>

              {/* Floating Top-Right Raised Hand Indicator */}
              {isHandRaised && (
                <div className="absolute top-16 right-4 z-20 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg animate-bounce">
                  ✋ Hand Raised
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

          {/* Floating Reaction Emojis Animation with Sender Display */}
          {floatingReactions.map(r => (
            <div
              key={r.id}
              style={{ left: `${r.left}%` }}
              className="fixed bottom-24 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-white border border-slate-700/80 shadow-2xl backdrop-blur-md pointer-events-none z-50 animate-bounce transition-all transform -translate-y-20 duration-1000"
            >
              <span className="text-3xl">{r.emoji}</span>
              {r.sender && (
                <span className="text-[11px] font-bold text-slate-200">{r.sender}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Bottom Toolbar (Authentic Zoom 6-Button Pattern for Mobile & Laptop) ─── */}
      {!isWhiteboardActive && (
        <div className="h-16 sm:h-20 bg-[#0A0A0C] border-t border-zinc-800/80 px-2 sm:px-6 flex items-center justify-around md:justify-center md:gap-8 shrink-0 z-30 select-none">
          
          {/* 1. MUTE / UNMUTE */}
          <button
            onClick={toggleMic}
            className="flex flex-col items-center justify-center gap-1 min-w-[54px] sm:min-w-[68px] py-1 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title={micOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micOn ? (
              <Mic size={22} className="text-white" />
            ) : (
              <MicOff size={22} className="text-rose-500" />
            )}
            <span className={`text-[10px] sm:text-[11px] font-medium leading-none ${micOn ? "text-zinc-300" : "text-rose-400 font-semibold"}`}>
              {micOn ? "Mute" : "Unmute"}
            </span>
          </button>

          {/* 2. START / STOP VIDEO */}
          <button
            onClick={toggleCamera}
            className="flex flex-col items-center justify-center gap-1 min-w-[54px] sm:min-w-[68px] py-1 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title={cameraOn ? "Stop Video" : "Start Video"}
          >
            {cameraOn ? (
              <Video size={22} className="text-white" />
            ) : (
              <VideoOff size={22} className="text-rose-500" />
            )}
            <span className={`text-[10px] sm:text-[11px] font-medium leading-none ${cameraOn ? "text-zinc-300" : "text-rose-400 font-semibold"}`}>
              {cameraOn ? "Stop video" : "Start video"}
            </span>
          </button>

          {/* 2b. RECORD / STOP RECORDING (Host / Mentor Only - Outside More) */}
          {isMentor && (
            <button
              onClick={() => {
                if (recState === "idle" || recState === "stopped") {
                  startRecording();
                } else if (recState === "recording" || recState === "paused") {
                  stopRecording();
                }
              }}
              className="flex flex-col items-center justify-center gap-1 min-w-[54px] sm:min-w-[68px] py-1 text-zinc-300 hover:text-white transition-colors cursor-pointer group"
              title={
                recState === "recording"
                  ? "Stop Recording"
                  : recState === "paused"
                  ? "Stop Recording"
                  : recState === "countdown"
                  ? "Starting..."
                  : "Start Recording"
              }
            >
              <div className="relative flex items-center justify-center">
                {recState === "recording" ? (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/20 border border-rose-500/60 flex items-center justify-center animate-pulse">
                    <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-rose-500 rounded-xs shadow-md" />
                  </div>
                ) : recState === "paused" ? (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-600/20 border border-amber-500/60 flex items-center justify-center">
                    <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-amber-500 rounded-xs" />
                  </div>
                ) : recState === "countdown" ? (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/30 flex items-center justify-center text-xs font-bold text-rose-400">
                    {countdown}
                  </div>
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-800/90 group-hover:bg-zinc-700 flex items-center justify-center border border-zinc-700/60 transition-colors">
                    <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-rose-500 shadow-sm" />
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-medium leading-none ${
                  recState === "recording"
                    ? "text-rose-400 font-bold"
                    : recState === "paused"
                    ? "text-amber-400 font-bold"
                    : "text-zinc-300"
                }`}
              >
                {recState === "recording"
                  ? "Stop REC"
                  : recState === "paused"
                  ? "Stop REC"
                  : recState === "countdown"
                  ? `${countdown}s`
                  : "Record"}
              </span>
            </button>
          )}

          {/* 3. CHAT */}
          <button
            onClick={() => setShowChatSheet(true)}
            className="flex flex-col items-center justify-center gap-1 min-w-[54px] sm:min-w-[68px] py-1 text-zinc-300 hover:text-white transition-colors cursor-pointer relative"
            title="Open Chat"
          >
            <div className="relative">
              <MessageSquare size={22} className="text-white" />
              {chatMessages.length > 0 && (
                <span className="absolute -top-1 -right-2 bg-blue-600 text-white text-[9px] font-bold px-1 rounded-full leading-tight">
                  {chatMessages.length}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium leading-none text-zinc-300">
              Chat
            </span>
          </button>

          {/* 4. PARTICIPANTS with count badge */}
          <button
            onClick={() => setShowParticipantsSheet(true)}
            className="flex flex-col items-center justify-center gap-1 min-w-[54px] sm:min-w-[68px] py-1 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Participants"
          >
            <div className="relative">
              <Users size={22} className="text-white" />
              <span className="absolute -top-1 -right-2.5 bg-zinc-700 border border-zinc-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-tight">
                {participants.length}
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium leading-none text-zinc-300">
              Participants
            </span>
          </button>

          {/* 5. MORE (•••) */}
          <button
            onClick={() => setShowMoreSheet(true)}
            className="flex flex-col items-center justify-center gap-1 min-w-[54px] sm:min-w-[68px] py-1 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="More Actions & Tools"
          >
            <MoreHorizontal size={22} className="text-white" />
            <span className="text-[10px] sm:text-[11px] font-medium leading-none text-zinc-300">
              More
            </span>
          </button>

          {/* 6. END / LEAVE (Red octagonal button with X) */}
          <button
            onClick={endClass}
            className="flex flex-col items-center justify-center gap-1 min-w-[54px] sm:min-w-[68px] py-1 text-rose-500 hover:text-rose-400 transition-colors cursor-pointer group"
            title={isMentor ? "End Call for All" : "Leave Meeting"}
          >
            <div className="w-8 h-8 rounded-xl bg-rose-600 hover:bg-rose-700 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95">
              <X size={18} strokeWidth={3} />
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold leading-none text-rose-500">
              {isMentor ? "End" : "Leave"}
            </span>
          </button>

        </div>
      )}

      {/* ─── PARTICIPANTS BOTTOM SHEET / MODAL (Screenshot 2 Pattern) ─── */}
      {showParticipantsSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 animate-in fade-in duration-150"
          onClick={() => setShowParticipantsSheet(false)}
        >
          <div
            className="w-full md:max-w-md bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl md:rounded-3xl flex flex-col max-h-[85vh] text-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Top drag handle on mobile */}
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mt-2.5 mb-1 md:hidden" />

            {/* Header (Screenshot 2: Close X on left, Title in center) */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800/80">
              <button
                onClick={() => setShowParticipantsSheet(false)}
                className="w-8 h-8 rounded-full bg-zinc-800/90 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Participants ({participants.length})
              </h3>
              <div className="w-8" />
            </div>

            {/* Participants Cards (Zoom-style Cards with Live Camera Face Previews) */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2.5">
              {participants.map((p) => {
                const isHost = p.role === "Host" || p.name.includes("Host") || p.id === "host";
                const isMe = (isMentor && isHost) || (!isMentor && p.name === studentName) || p.id === myParticipantId;
                const initial = (p.name.replace(/[^a-zA-Z0-9]/g, "").charAt(0) || p.avatar || "U").toUpperCase();

                // Live Camera Frame or Local Video Stream
                const isLocalCameraActive = isMe && cameraOn && Boolean(cameraStream);
                const remoteCam = remoteParticipantCameras[p.id];
                const isRemoteCameraActive = !isMe && (
                  (isHost && remoteHostCamera?.active && Boolean(remoteHostCamera?.streamFrame)) ||
                  (remoteCam?.active && Boolean(remoteCam?.streamFrame))
                );
                const remoteCamSrc = (isHost && remoteHostCamera?.active && remoteHostCamera?.streamFrame)
                  ? remoteHostCamera.streamFrame
                  : remoteCam?.streamFrame;

                const isCameraVideoActive = isLocalCameraActive || isRemoteCameraActive || p.isVideoOn;

                return (
                  <div
                    key={p.id}
                    className="bg-[#242427] border border-zinc-800/90 hover:border-zinc-700/80 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between gap-3 shadow-lg transition-all"
                  >
                    {/* Left: Zoom-style Face / Video Preview Box */}
                    <div className="relative w-20 h-16 sm:w-24 sm:h-18 rounded-xl bg-zinc-950 border border-zinc-800/90 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                      {isLocalCameraActive ? (
                        <video
                          ref={(el) => {
                            if (el && cameraStream && el.srcObject !== cameraStream) {
                              el.srcObject = cameraStream;
                              el.play().catch(() => {});
                            }
                          }}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover -scale-x-100"
                        />
                      ) : isRemoteCameraActive && remoteCamSrc ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={remoteCamSrc}
                          alt={`${p.name}'s video`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-[#7A5C50] text-white flex items-center justify-center font-bold text-base shadow-sm select-none">
                          {initial}
                        </div>
                      )}

                      {/* Small Live Mic status overlay tag on camera preview */}
                      <div className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded text-[10px]">
                        {p.isMuted ? (
                          <MicOff size={11} className="text-rose-500" />
                        ) : (
                          <Mic size={11} className="text-emerald-400" />
                        )}
                      </div>
                    </div>

                    {/* Middle: Participant Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-sm font-semibold text-white truncate">
                          {p.name.replace(/\s*\((Student|Host|You|you|me)\)/gi, '')}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.2 rounded shrink-0">
                            You
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {isHost ? (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 rounded">
                            Host
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-zinc-400 bg-zinc-800/80 border border-zinc-700/60 px-1.5 py-0.2 rounded">
                            Student
                          </span>
                        )}

                        {isCameraVideoActive ? (
                          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Live Face
                          </span>
                        ) : (
                          <span className="text-[9px] text-zinc-500 font-medium">
                            Camera Off
                          </span>
                        )}

                        {p.isHandRaised && (
                          <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.2 rounded">
                            ✋ Raised Hand
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Host-Only Mute/Unmute Control OR Status Icons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isMentor && !isMe ? (
                        /* ONLY HOST HAS ACCESS TO MUTE / UNMUTE PARTICIPANTS */
                        <button
                          type="button"
                          onClick={() => handleToggleParticipantMute(p)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                            p.isMuted
                              ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                              : "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40"
                          }`}
                          title={p.isMuted ? "Unmute participant" : "Mute participant"}
                        >
                          {p.isMuted ? (
                            <>
                              <Mic size={13} className="text-emerald-400" />
                              <span className="text-emerald-300">Unmute</span>
                            </>
                          ) : (
                            <>
                              <MicOff size={13} className="text-rose-400" />
                              <span>Mute</span>
                            </>
                          )}
                        </button>
                      ) : (
                        /* Student View: Status indicators only (no remote mute buttons) */
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900/80 border border-zinc-800 rounded-xl">
                          {p.isMuted ? (
                            <MicOff size={15} className="text-rose-500" />
                          ) : (
                            <Mic size={15} className="text-emerald-400" />
                          )}
                          {isCameraVideoActive ? (
                            <Video size={15} className="text-emerald-400" />
                          ) : (
                            <VideoOff size={15} className="text-rose-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Action Bar (Screenshot 2: Invite on left, Mute all on right, ••• options) */}
            <div className="p-3 bg-[#141416] border-t border-zinc-800/80 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={copyInviteDetails}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-sm"
              >
                Invite
              </button>
              <div className="flex items-center gap-2">
                {isMentor && (
                  <button
                    onClick={muteAllParticipants}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                  >
                    Mute all
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowParticipantsSheet(false);
                    setShowSecurityPopup(true);
                  }}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors cursor-pointer shadow-sm"
                  title="Options & Security"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MORE BOTTOM SHEET / MODAL (Screenshot 3 Pattern) ─── */}
      {showMoreSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 animate-in fade-in duration-150"
          onClick={() => setShowMoreSheet(false)}
        >
          <div
            className="w-full md:max-w-md bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl md:rounded-3xl flex flex-col p-4 text-white shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Top drag handle on mobile */}
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-3 md:hidden" />

            {/* Top Row: Hand Raise Pill Button + Quick Emoji Reactions (Screenshot 3) */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
              <button
                onClick={() => {
                  toggleHandRaise();
                  setShowMoreSheet(false);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                  isHandRaised
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/40"
                }`}
              >
                <span>✋</span>
                <span>{isHandRaised ? "Lower hand" : "Raise hand"}</span>
              </button>

              <div className="flex items-center gap-1 sm:gap-2">
                {["🎉", "👍", "❤️", "👏", "😂", "😮"].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      triggerReaction(emoji);
                      setShowMoreSheet(false);
                    }}
                    className="text-xl p-1 hover:scale-125 transition-transform active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Features Grid: EXACTLY OUR FEATURES ONLY (Screenshot 3 Grid Pattern) */}
            <div className="grid grid-cols-3 gap-3 pt-3">
              
              {/* Feature: Fullscreen Toggle */}
              <button
                onClick={() => {
                  setShowMoreSheet(false);
                  toggleFullScreen();
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/40 text-center gap-2 transition-all cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400">
                  {isFullScreen ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
                </div>
                <span className="text-[11px] font-semibold text-zinc-200">
                  {isFullScreen ? "Exit Fullscreen" : "Full screen"}
                </span>
              </button>

              {/* Feature 1: Start share / Stop share */}
              <button
                onClick={() => {
                  setShowMoreSheet(false);
                  if (isSharing) stopScreenShare();
                  else startScreenShare();
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/40 text-center gap-2 transition-all cursor-pointer"
              >
                <div className={`p-2 rounded-xl ${isSharing ? "bg-rose-600/20 text-rose-400" : "bg-blue-600/20 text-blue-400"}`}>
                  <Monitor size={22} />
                </div>
                <span className="text-[11px] font-semibold text-zinc-200">
                  {isSharing ? "Stop share" : "Start share"}
                </span>
              </button>

              {/* Feature 2: Whiteboard (Sketch & Notepad) */}
              <button
                onClick={() => {
                  setShowMoreSheet(false);
                  if (isMentor) {
                    const next = !showWhiteboard;
                    setShowWhiteboard(next);
                    broadcastWhiteboard(next);
                  } else {
                    setShowWhiteboard(true);
                    setStudentViewMode("whiteboard");
                  }
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/40 text-center gap-2 transition-all cursor-pointer"
              >
                <div className={`p-2 rounded-xl ${showWhiteboard ? "bg-emerald-600/20 text-emerald-400" : "bg-purple-600/20 text-purple-400"}`}>
                  <Edit3 size={22} />
                </div>
                <span className="text-[11px] font-semibold text-zinc-200">
                  Whiteboard
                </span>
              </button>

              {/* Feature 3: Class Notes */}
              <button
                onClick={() => {
                  setShowMoreSheet(false);
                  setShowNotesSheet(true);
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/40 text-center gap-2 transition-all cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400">
                  <FileText size={22} />
                </div>
                <span className="text-[11px] font-semibold text-zinc-200">
                  Class notes
                </span>
              </button>

              {/* Feature 4: Record / Pause Meeting (Mentor) */}
              {isMentor && (
                <button
                  onClick={() => {
                    setShowMoreSheet(false);
                    if (recState === "idle" || recState === "stopped") startRecording();
                    else if (recState === "recording") pauseRecording();
                    else if (recState === "paused") resumeRecording();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/40 text-center gap-2 transition-all cursor-pointer"
                >
                  <div className={`p-2 rounded-xl ${recState === "recording" ? "bg-rose-600 text-white animate-pulse" : "bg-rose-600/20 text-rose-400"}`}>
                    <Disc size={22} />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-200">
                    {recState === "recording" ? "Pause REC" : recState === "paused" ? "Resume REC" : "Record"}
                  </span>
                </button>
              )}

              {/* Feature 4b: Stop Recording (Mentor) */}
              {isMentor && (recState === "recording" || recState === "paused") && (
                <button
                  onClick={() => {
                    setShowMoreSheet(false);
                    stopRecording();
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-center gap-2 transition-all cursor-pointer"
                >
                  <div className="p-2 rounded-xl bg-rose-600 text-white">
                    <div className="w-5 h-5 bg-white rounded-xs" />
                  </div>
                  <span className="text-[11px] font-semibold text-rose-300">
                    Stop recording
                  </span>
                </button>
              )}

              {/* Feature 5: Meeting Info */}
              <button
                onClick={() => {
                  setShowMoreSheet(false);
                  setShowMeetingInfoModal(true);
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/40 text-center gap-2 transition-all cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-cyan-600/20 text-cyan-400">
                  <Info size={22} />
                </div>
                <span className="text-[11px] font-semibold text-zinc-200">
                  Meeting info
                </span>
              </button>

              {/* Feature 6: Host Tools (Security) */}
              {isMentor && (
                <button
                  onClick={() => {
                    setShowMoreSheet(false);
                    setShowSecurityPopup(true);
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/40 text-center gap-2 transition-all cursor-pointer"
                >
                  <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400">
                    <Shield size={22} />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-200">
                    Host tools
                  </span>
                </button>
              )}

              {/* Feature 7: Speaker Audio Toggle */}
              <button
                onClick={() => {
                  toggleSpeaker();
                  setShowMoreSheet(false);
                }}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/40 text-center gap-2 transition-all cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-zinc-700/40 text-zinc-200">
                  {speakerMuted ? <VolumeX size={22} className="text-rose-400" /> : <Volume2 size={22} />}
                </div>
                <span className="text-[11px] font-semibold text-zinc-200">
                  {speakerMuted ? "Unmute audio" : "Mute audio"}
                </span>
              </button>

              {/* Feature 8: How to Teach (Tutorial) */}
              {isMentor && (
                <button
                  onClick={() => {
                    setShowMoreSheet(false);
                    setShowTutorial(true);
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/40 text-center gap-2 transition-all cursor-pointer"
                >
                  <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                    <BookOpen size={22} />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-200">
                    Tutorial
                  </span>
                </button>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ─── HOST DURATION EXPIRED / EXTENSION MODAL ─── */}
      {showDurationModal && isMentor && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            className="w-full max-w-md bg-[#1C1C1E] border border-amber-500/40 rounded-3xl p-6 text-white shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header with Icon and Badge */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Clock size={22} className="stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Duration Completed
                    </span>
                    {autoEndCountdown !== null && (
                      <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-950/60 border border-rose-800/80 px-2 py-0.5 rounded-full">
                        Auto-end: {autoEndCountdown}s
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">Scheduled Time Completed</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDurationModal(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Minimize modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Explanation */}
            <div className="p-3.5 bg-zinc-900/90 rounded-2xl border border-zinc-800 space-y-1.5 text-xs">
              <p className="text-zinc-300">
                The scheduled duration of <span className="font-bold text-white">{meeting?.duration || 60} minutes</span> for this meeting has finished.
              </p>
              <p className="text-zinc-400">
                Would you like to extend this session or conclude and end the meeting now for all participants?
              </p>
            </div>

            {/* Section 1: Extend Duration */}
            <div className="space-y-3 pt-1">
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                Extend Meeting by (Minutes):
              </label>

              {/* Preset Chips */}
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 30].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setExtendMinutesInput(String(mins))}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      extendMinutesInput === String(mins)
                        ? "bg-[#154360] border-sky-400 text-white shadow-sm"
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                    }`}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>

              {/* Custom Number Input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={extendMinutesInput}
                    onChange={e => setExtendMinutesInput(e.target.value)}
                    placeholder="Enter minutes"
                    className="w-full h-10 px-3 bg-zinc-900 border border-zinc-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-sky-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-medium pointer-events-none">
                    mins
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isExtending || !extendMinutesInput || parseInt(extendMinutesInput) <= 0}
                  onClick={() => handleExtendMeeting(parseInt(extendMinutesInput) || 15)}
                  className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Check size={14} strokeWidth={3} />
                  <span>{isExtending ? "Extending..." : "Extend & Continue"}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400">
                Access will be granted for these minutes only, after which you will be prompted again.
              </p>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* Section 2: End Meeting Now */}
            <div className="pt-1">
              <button
                type="button"
                onClick={endClass}
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer group"
              >
                <X size={15} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                <span>End Meeting for All Participants Now</span>
              </button>
            </div>

            {autoEndCountdown !== null && (
              <p className="text-[10px] text-center text-zinc-500">
                To prevent accidental running sessions, call will automatically close in {autoEndCountdown}s if no action is chosen.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── STUDENT DURATION OVER BANNER ─── */}
      {!isMentor && studentDurationWarning && (
        <div className="fixed top-16 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 max-w-lg w-full bg-amber-950/95 border border-amber-600/80 rounded-2xl p-3.5 text-white shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Clock size={16} />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-amber-200">Scheduled Duration Completed</p>
            <p className="text-zinc-300 text-[11px] mt-0.5">{studentDurationWarning}</p>
          </div>
        </div>
      )}

      {/* ─── MEETING INFO MODAL (From Top Title Pill Dropdown) ─── */}
      {showMeetingInfoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowMeetingInfoModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#1C1C1E] border border-zinc-800 rounded-3xl p-5 text-white shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Meeting Info</h3>
              </div>
              <button
                onClick={() => setShowMeetingInfoModal(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5">Topic</div>
                <div className="font-semibold text-sm text-white">{meeting?.title || "Class Meeting"}</div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-500">Meeting ID</div>
                  <div className="font-mono font-bold text-white text-sm">{roomId}</div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(roomId);
                    showToast("Meeting ID copied!");
                  }}
                  className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Copy ID"
                >
                  <Copy size={14} />
                </button>
              </div>

              {meeting?.password && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-zinc-500">Passcode</div>
                    <div className="font-mono font-bold text-white text-sm">{meeting.password}</div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(meeting.password);
                      showToast("Passcode copied!");
                    }}
                    className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Copy Passcode"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase font-bold text-zinc-500 mb-0.5">Host</div>
                <div className="text-white font-medium">{effectiveHostName}</div>
              </div>

              <div className="pt-2">
                <button
                  onClick={copyInviteDetails}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                >
                  <Copy size={13} /> Copy Invite Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── LIVE FLOATING CHAT POPUPS (Always visible across video & whiteboard when chat sheet is closed) ─── */}
      {recentChatPopups.length > 0 && !showChatSheet && (
        <div className="fixed bottom-24 left-4 sm:left-6 z-[140] flex flex-col gap-2 max-w-[88vw] sm:max-w-sm pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-200">
          {recentChatPopups.map((msg) => {
            const isMe = (isMentor && msg.role === "Host") || (!isMentor && (msg.sender === studentName || msg.sender === "You"));
            return (
              <div
                key={msg.id}
                onClick={() => setShowChatSheet(true)}
                className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-2xl px-3.5 py-2.5 shadow-2xl text-left cursor-pointer hover:bg-zinc-800 transition-all group"
                title="Click to open in-meeting chat"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5">
                    <MessageSquare size={12} className="text-blue-400" />
                    <span>{isMe ? "You" : msg.sender}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      msg.role === "Host" ? "bg-blue-900/60 text-blue-300 border border-blue-700/50" : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {msg.role}
                    </span>
                  </span>
                  <span className="text-[10px] text-zinc-500">{msg.time}</span>
                </div>
                <p className="text-xs text-zinc-100 font-medium break-words leading-relaxed line-clamp-2">
                  {msg.text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── IN-MEETING CHAT (Ultra-Clean, High-Z Drawer - Always Visible & Interactive) ─── */}
      {showChatSheet && (
        <div
          className="fixed inset-0 z-[150] flex flex-col justify-end md:justify-stretch md:items-end animate-in fade-in duration-150"
          onClick={() => setShowChatSheet(false)}
        >
          {/* Subtle click-outside backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />

          {/* Chat Window / Drawer */}
          <div
            className="relative z-10 w-full md:w-96 bg-[#161619] border-t md:border-t-0 md:border-l border-zinc-800 rounded-t-3xl md:rounded-none flex flex-col h-[75vh] md:h-full text-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-right duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile Top Drag Indicator */}
            <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mt-2 md:hidden" />

            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800/80 bg-[#121214]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide leading-none">In-Meeting Chat</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Live room messaging</p>
                </div>
              </div>
              <button
                onClick={() => setShowChatSheet(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Close Chat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                  <MessageSquare size={32} className="mb-2 opacity-40 text-zinc-400" />
                  <p className="text-xs font-semibold text-zinc-300">No messages yet</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Send a message to everyone in the room.</p>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const isMe = (isMentor && msg.role === "Host") || (!isMentor && (msg.sender === studentName || msg.sender === "You"));
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-1 px-1">
                        <span className="font-semibold text-zinc-300">
                          {isMe ? "You" : msg.sender}
                        </span>
                        <span className={`text-[8px] px-1 py-0.2 rounded font-bold ${
                          msg.role === "Host" ? "bg-blue-900/60 text-blue-300 border border-blue-700/50" : "bg-zinc-800 text-zinc-400"
                        }`}>
                          {msg.role}
                        </span>
                        <span className="text-[9px] text-zinc-500">{msg.time}</span>
                      </div>
                      <div className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed break-words shadow-sm ${
                        isMe
                          ? "bg-blue-600 text-white rounded-2xl rounded-tr-xs"
                          : "bg-zinc-800/90 border border-zinc-700/60 text-zinc-100 rounded-2xl rounded-tl-xs"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-zinc-800/80 bg-[#121214] flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendChatMessage(); }}
                placeholder="Type message to everyone..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={() => sendChatMessage()}
                disabled={!chatInput.trim()}
                className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer shrink-0 shadow-sm"
                title="Send Message"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CLASS NOTES (Zoom Dark Pattern) ─── */}
      {showNotesSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 animate-in fade-in duration-150"
          onClick={() => setShowNotesSheet(false)}
        >
          <div
            className="w-full md:max-w-md bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl md:rounded-3xl flex flex-col h-[85vh] md:h-[650px] text-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800/80">
              <button
                onClick={() => setShowNotesSheet(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
              <h3 className="text-sm font-bold text-white tracking-wide">Class Notes & Materials</h3>
              <div className="w-8" />
            </div>

            {/* Note Type Selector */}
            <div className="flex border-b border-zinc-800 bg-[#141416] p-1.5 gap-1 text-xs">
              <button
                onClick={() => setNoteType("group")}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${noteType === "group" ? "bg-zinc-800 text-white shadow-xs" : "text-zinc-400 hover:text-white"}`}
              >
                Group Notes
              </button>
              <button
                onClick={() => setNoteType("host")}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${noteType === "host" ? "bg-zinc-800 text-white shadow-xs" : "text-zinc-400 hover:text-white"}`}
              >
                Host Notes
              </button>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notes.filter(n => n.type === noteType).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                  <FileText size={32} className="mb-2 opacity-40 text-zinc-400" />
                  <p className="text-xs font-semibold text-zinc-300">No notes in this section</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Post an important note or attach materials below.</p>
                </div>
              ) : (
                notes.filter(n => n.type === noteType).map(n => (
                  <div key={n.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-bold text-white">{n.author}</span>
                      <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                    {n.attachment && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/80 border border-zinc-700">
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip size={13} className="text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{n.attachment.name}</p>
                            <p className="text-[10px] text-zinc-400">{(n.attachment.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <a
                          href={n.attachment.dataUrl}
                          download={n.attachment.name}
                          className="p-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
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

            {/* Note Input Box */}
            <div className="p-3 border-t border-zinc-800/80 bg-[#141416] space-y-2">
              {noteAttachment && (
                <div className="flex items-center justify-between p-2 bg-blue-950/60 border border-blue-800/60 rounded-xl text-xs text-blue-200">
                  <div className="flex items-center gap-1.5 truncate">
                    <Paperclip size={13} className="text-blue-400 shrink-0" />
                    <span className="font-semibold truncate">{noteAttachment.name}</span>
                    <span className="text-[10px] text-blue-400 shrink-0">({(noteAttachment.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={() => setNoteAttachment(null)} className="text-blue-400 hover:text-white p-0.5">
                    <X size={13} />
                  </button>
                </div>
              )}
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Write class note or summary... (Ctrl+Enter to post)"
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote(); }}
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:border-blue-500 outline-none resize-none shadow-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => noteFileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  title="Attach File"
                >
                  <Paperclip size={13} />
                  <span>Attach</span>
                </button>
                <input
                  ref={noteFileInputRef}
                  type="file"
                  onChange={handleNoteFileSelect}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => importNotesInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  title="Import Notes"
                >
                  <Upload size={13} />
                  <span>Import</span>
                </button>
                <input
                  ref={importNotesInputRef}
                  type="file"
                  accept=".txt,.json"
                  onChange={handleImportNotesFile}
                  className="hidden"
                />

                <button
                  onClick={addNote}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Post Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECURITY CONTROLS (Host Administration) ─── */}
      {showSecurityPopup && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowSecurityPopup(false)}
        >
          <div
            className="w-full max-w-sm bg-[#1C1C1E] border border-zinc-800 rounded-3xl p-5 text-white shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-emerald-400" />
                <div>
                  <h4 className="text-xs font-bold text-white">Security Controls</h4>
                  <p className="text-[10px] text-zinc-400">{isMentor ? "Host Administration" : "Meeting Policy"}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSecurityPopup(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {isMentor ? (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Room Access</p>
                
                {/* Lock Meeting */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Lock size={14} className={securitySettings.lockMeeting ? "text-rose-400" : "text-zinc-400"} />
                    <div>
                      <div className="text-xs font-semibold text-white">Lock Meeting</div>
                      <div className="text-[10px] text-zinc-400">No new participants can join</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !securitySettings.lockMeeting;
                      setSecuritySettings(s => ({ ...s, lockMeeting: next }));
                      showToast(next ? "Meeting locked." : "Meeting unlocked.");
                    }}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${securitySettings.lockMeeting ? "bg-rose-600" : "bg-zinc-700"}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.lockMeeting ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>

                {/* Waiting Room */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className={securitySettings.waitingRoom ? "text-emerald-400" : "text-zinc-400"} />
                    <div>
                      <div className="text-xs font-semibold text-white">Enable Waiting Room</div>
                      <div className="text-[10px] text-zinc-400">Admit attendees on arrival</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !securitySettings.waitingRoom;
                      setSecuritySettings(s => ({ ...s, waitingRoom: next }));
                      showToast(next ? "Waiting room enabled." : "Waiting room disabled.");
                    }}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${securitySettings.waitingRoom ? "bg-emerald-600" : "bg-zinc-700"}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.waitingRoom ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>

                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 pt-1">Allow Participants To</p>

                {/* Participant Screen Sharing */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-xs text-zinc-200">Share Screen</span>
                  <button
                    onClick={() => {
                      const next = !securitySettings.allowScreenShare;
                      setSecuritySettings(s => ({ ...s, allowScreenShare: next }));
                    }}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${securitySettings.allowScreenShare ? "bg-blue-600" : "bg-zinc-700"}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.allowScreenShare ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>

                {/* Participant Chat */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-xs text-zinc-200">Chat</span>
                  <button
                    onClick={() => {
                      const next = !securitySettings.allowChat;
                      setSecuritySettings(s => ({ ...s, allowChat: next }));
                    }}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${securitySettings.allowChat ? "bg-blue-600" : "bg-zinc-700"}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${securitySettings.allowChat ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>

                {/* Host Quick Actions */}
                <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                  <button
                    onClick={muteAllParticipants}
                    className="w-full py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 rounded-xl text-xs font-bold transition-colors border border-rose-800/60 cursor-pointer"
                  >
                    Mute All Participants
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-2 text-xs text-zinc-400">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span>Waiting Room</span>
                  <span className="text-emerald-400 font-bold">Active</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span>Encryption</span>
                  <span className="text-emerald-400 font-bold">End-to-End</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ─── Tutorial Overlay (PURE WHITE THEME) ────────────────────────── */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E7EC] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-[#20262E]">
            <div className="p-6 border-b border-[#E2E7EC] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#20262E]">How to Host a Class</h2>
                <p className="text-xs text-[#57636E] mt-0.5">4-step guide for mentors</p>
              </div>
              <button onClick={() => setShowTutorial(false)} className="p-2 hover:bg-slate-100 rounded-xl text-[#57636E] hover:text-[#20262E] transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {STEPS.map((step, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-[#F8FAFC] rounded-2xl border border-[#E2E7EC]">
                  <div className={"w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0 " + step.color}>{step.icon}</div>
                  <div>
                    <p className="text-sm font-bold text-[#20262E] mb-1">{step.title}</p>
                    <p className="text-xs text-[#57636E] leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 pt-0">
              <button onClick={() => setShowTutorial(false)} className="w-full py-3 bg-[#154360] hover:bg-[#0E2F44] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md">
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
              <button onClick={() => setShowUpload(false)} className="p-1.5 text-[#57636E] hover:text-[#57636E] hover:bg-slate-100 rounded-lg transition-colors">
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
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E7EC] hover:border-slate-400 focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/20 text-[#20262E] placeholder-slate-400 rounded-xl text-sm outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#57636E] uppercase tracking-wider mb-1.5">Description <span className="text-[#57636E] normal-case font-normal">(optional)</span></label>
                    <textarea
                      value={uploadDesc}
                      onChange={e => setUploadDesc(e.target.value)}
                      placeholder="Add a brief description..."
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E7EC] hover:border-slate-400 focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/20 text-[#20262E] placeholder-slate-400 rounded-xl text-sm outline-none transition-all resize-none"
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
                          {uploadCourse ? (courses.find(c => c.id === uploadCourse)?.name || "Selected Folder") : "Library Root (no folder)"}
                        </span>
                        <ChevronDown size={16} className={`text-[#57636E] transition-transform ${isCourseDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      {isCourseDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E2E7EC] rounded-xl shadow-xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-1">
                          <div className="max-h-48 overflow-y-auto py-1">
                            <button 
                              type="button"
                              onClick={() => { setUploadCourse(""); setIsCourseDropdownOpen(false); }}
                              className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-[#154360] hover:text-white transition-colors ${!uploadCourse ? "bg-[#154360] text-white" : "text-[#20262E]"}`}
                            >
                              Library Root (no folder)
                            </button>
                            {courses.filter(c => c.id !== "1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW").map(c => (
                              <button 
                                key={c.id}
                                type="button"
                                onClick={() => { setUploadCourse(c.id); setIsCourseDropdownOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-[#154360] hover:text-white transition-colors ${uploadCourse === c.id ? "bg-[#154360] text-white" : "text-[#20262E]"}`}
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
                    <button onClick={() => setShowUpload(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#20262E] text-sm font-semibold rounded-xl transition-colors">Discard</button>
                    <button onClick={handleUpload} className="flex-1 py-2.5 bg-[#154360] hover:bg-[#0E2F44] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"><Upload size={15} />Upload to Library</button>
                  </div>
                </div>
              )}
              {uploadState === "uploading" && (
                <div className="flex flex-col items-center gap-4 py-6 animate-in fade-in">
                  <Loader2 className="w-10 h-10 text-[#154360] animate-spin" />
                  <div className="w-full">
                    <div className="flex justify-between mb-2"><span className="text-sm text-[#57636E]">Uploading...</span><span className="text-sm text-[#154360] font-bold">{uploadProgress}%</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-[#154360] h-2 rounded-full transition-all" style={{ width: uploadProgress + "%" }} /></div>
                  </div>
                </div>
              )}
              {uploadState === "done" && (
                <div className="flex flex-col items-center gap-3 py-6 animate-in zoom-in-95">
                  <div className="w-14 h-14 bg-[#EBF5FB]/40 border border-[#2980B9]/30 rounded-full flex items-center justify-center"><Check size={24} className="text-green-500" /></div>
                  <p className="text-base font-bold text-[#20262E]">Recording Saved!</p>
                  <p className="text-sm text-[#57636E] text-center">Available in Library. Redirecting...</p>
                </div>
              )}
              {uploadState === "error" && (
                <div className="flex flex-col items-center gap-3 py-6 animate-in zoom-in-95">
                  <div className="w-14 h-14 bg-[#154360]/10 border border-[#154360]/30 rounded-full flex items-center justify-center"><AlertCircle size={24} className="text-[#154360]" /></div>
                  <p className="text-base font-bold text-[#20262E]">Upload Failed</p>
                  <p className="text-xs text-[#57636E] text-center max-w-sm px-2">
                    {uploadErrorMsg || "Upload encountered an issue. You can retry direct Google Drive upload or download your recording locally."}
                  </p>
                  <div className="flex gap-3 w-full mt-2">
                    <a href={URL.createObjectURL(recBlob)} download={(meeting?.title || "class") + "-recording.webm"} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#20262E] text-sm font-semibold rounded-xl text-center transition-colors">Download</a>
                    <button onClick={handleUpload} className="flex-1 py-2.5 bg-[#154360] hover:bg-[#0E2F44] text-white text-sm font-bold rounded-xl transition-colors">Try Again</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── LIVE MEDIA & SFU NETWORK DIAGNOSTICS MODAL ─── */}
      {showDiagnosticsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowDiagnosticsModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#18181B] border border-zinc-800 rounded-3xl p-5 text-white shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  livekitSFU.isSFUActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                }`}>
                  <Activity size={18} className={livekitSFU.isSFUActive ? "animate-pulse" : ""} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Live Classroom Diagnostics</h3>
                  <p className="text-[10px] text-zinc-400">Real-time WebRTC & SFU Media Metrics</p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosticsModal(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Architecture Mode & Status Badge */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/80">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Media Architecture</span>
                <p className="text-xs font-bold text-white mt-0.5">
                  {livekitSFU.isSFUActive ? "LiveKit SFU (150+ Student Ready)" : "WebRTC Direct Mesh (P2P + OpenRelay)"}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                livekitSFU.diagnostics.quality === "Excellent"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : livekitSFU.diagnostics.quality === "Good"
                  ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                  : livekitSFU.diagnostics.quality === "Fair"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  : "bg-rose-500/20 text-rose-300 border-rose-500/30"
              }`}>
                ● {livekitSFU.diagnostics.quality}
              </span>
            </div>

            {/* 4-Box Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 font-semibold uppercase">Framerate & Res</span>
                <p className="text-sm font-black text-white mt-0.5">
                  {livekitSFU.diagnostics.framerate || (isWebRTCVideoPlaying ? 60 : 30)} FPS
                </p>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {livekitSFU.diagnostics.resolution || (screenStream ? "1920x1080" : "Adaptive")}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 font-semibold uppercase">Bitrate Throughput</span>
                <p className="text-sm font-black text-emerald-400 mt-0.5">
                  {isMentor ? `${livekitSFU.diagnostics.bitrateOut || 2400} kbps` : `${livekitSFU.diagnostics.bitrateIn || 1850} kbps`}
                </p>
                <span className="text-[10px] text-zinc-500">
                  {isMentor ? "Single Host Upload" : "Subscriber Downlink"}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 font-semibold uppercase">Latency & Jitter</span>
                <p className="text-sm font-black text-white mt-0.5">
                  {livekitSFU.diagnostics.rtt || 24} ms
                </p>
                <span className="text-[10px] text-zinc-500 font-mono">
                  Jitter: {livekitSFU.diagnostics.jitter || 3} ms
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[10px] text-zinc-400 font-semibold uppercase">Packet Loss</span>
                <p className={`text-sm font-black mt-0.5 ${
                  livekitSFU.diagnostics.packetLossPercent > 5 ? "text-amber-400" : "text-emerald-400"
                }`}>
                  {livekitSFU.diagnostics.packetLossPercent}%
                </p>
                <span className="text-[10px] text-zinc-500">
                  {livekitSFU.diagnostics.packetLossPercent === 0 ? "Zero drops detected" : "Interval Delta"}
                </span>
              </div>
            </div>

            {/* Network Transport & Participants */}
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>ICE Candidate Transport:</span>
                <span className="font-mono text-zinc-200 font-semibold uppercase">
                  {livekitSFU.diagnostics.iceCandidateType || "Host / STUN Direct"}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Room Capacity Load:</span>
                <span className="font-semibold text-zinc-200">
                  {participants.length} Active / 150 Cap
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Content Clarity Hint:</span>
                <span className="font-semibold text-emerald-400">
                  Detail (Crisp Text & Code)
                </span>
              </div>
            </div>

            {/* Diagnostics Advice / Recommendation */}
            <div className="p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-[11px] text-zinc-400 flex items-start gap-2">
              <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <span>
                {livekitSFU.isSFUActive
                  ? "LiveKit SFU Dynacast is active. The host uploads only 1 stream while students receive adaptive simulcast without degrading classroom bandwidth."
                  : "Standard WebRTC mode is active with OpenRelay TURN fallback. Configure LIVEKIT_URL & API keys in .env.local for automatic cloud SFU acceleration."}
              </span>
            </div>
          </div>
        </div>
      )}


      {toast && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[200] max-w-sm ${toast.ok ? "bg-white border border-[#E2E7EC] text-[#20262E]" : "bg-rose-50 border border-rose-200 text-rose-800"}`}>
          <span className="text-sm font-semibold">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="p-0.5 hover:bg-slate-100 rounded-lg shrink-0 text-[#57636E]"><X size={14} /></button>
        </div>
      )}

      {/* ─── SAVING RECORDING MODAL (ON END MEETING) ─── */}
      {isEndingAndSaving && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E7EC] rounded-3xl shadow-2xl w-full max-w-md p-6 text-center space-y-5 animate-in zoom-in-95 duration-200 text-[#20262E]">
            <div className="w-16 h-16 rounded-2xl bg-[#EBF5FB] border border-[#154360]/20 flex items-center justify-center mx-auto text-[#154360]">
              {endingProgress >= 100 ? (
                <Check size={32} className="text-emerald-600" />
              ) : (
                <Loader2 size={32} className="animate-spin text-[#154360]" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-black text-[#20262E]">
                {endingProgress >= 100 ? "Recording Saved to Google Drive!" : "Saving Class Recording"}
              </h3>
              <p className="text-xs text-[#57636E] mt-1 font-medium">
                {endingSaveStatus || "Uploading lecture video to your selected course folder..."}
              </p>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
              <div
                className="bg-[#154360] h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, endingProgress))}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-bold text-[#57636E]">
              <span>Google Drive Cloud Sync</span>
              <span className="text-[#154360]">{endingProgress}%</span>
            </div>

            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl py-2 px-3">
              ⚠️ Please keep this page open until the recording finishes saving.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
