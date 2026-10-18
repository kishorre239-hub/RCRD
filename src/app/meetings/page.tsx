"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Video, Folder,
  Users, ChevronDown, X,
  Plus, Copy, Check, Clock, FileText,
  Trash2, Calendar,
  Eye, EyeOff, Share2, Mail,
  Monitor, Play,
  CheckCircle2, ChevronRight,
  Link2, ExternalLink
} from "lucide-react";
import {
  HomeIcon, LibraryIcon, VideoCameraIcon, SettingsIcon,
  UserIcon, WorkspaceIcon
} from "@/components/CustomIcons";

import { getCourses } from "@/lib/api";
import RcrdLogo from "@/components/RcrdLogo";
import ProfileFlyout from "@/components/ProfileFlyout";
import AppHeader from "@/components/AppHeader";
import { useNavPermissions } from "@/lib/navPermissions";

interface Course { id: string; name: string; }
interface Meeting {
  id: string; title: string; courseId: string | null; password: string;
  scheduledAt: string; duration: number; status: "scheduled" | "live" | "ended";
  attendees: number; createdAt: string; notes: string;
}

const genPwd = () => {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};
const STORAGE_KEY = "rcrd_meetings";

export const isDummyMeeting = (m: { id?: string; title?: string } | null | undefined): boolean => {
  if (!m) return false;
  const id = (m.id || "").toUpperCase().trim();
  const title = (m.title || "").toLowerCase().trim();
  if (
    id === "GEO-CLASS-101" ||
    id === "RCRD-MEET-202" ||
    id === "REV-QA-303" ||
    id.startsWith("GEO-CLASS") ||
    id.startsWith("RCRD-MEET") ||
    id.startsWith("REV-QA")
  ) {
    return true;
  }
  if (
    title.includes("geonixa") ||
    title.includes("interactive screen & recording workshop") ||
    title.includes("weekly code review & mentorship")
  ) {
    return true;
  }
  return false;
};

const DURATION_PRESETS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hrs", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "3 hours", value: 180 },
];

// Sidebar Item declared outside render
function SidebarItem({ icon, label, active = false, external = false, href }: { icon: React.ReactNode, label: string, active?: boolean, external?: boolean, href?: string }) {
  const router = useRouter();
  
  return (
    <div 
      onClick={() => href && router.push(href)}
      style={{
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: '14px',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '14px',
        letterSpacing: 'normal',
        color: active ? '#154360' : '#292A2E'
      }}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all ${
      active 
        ? "bg-[#EBF5FB] shadow-sm" 
        : "hover:bg-[#F5F6F8]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={active ? "text-[#154360]" : "text-[#57636E]"}>
          {icon}
        </div>
        <span>{label}</span>
      </div>
      {external && <ChevronDown className="w-4 h-4 text-[#57636E]" />}
    </div>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
  const { canAccess } = useNavPermissions();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "live" | "past">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showShare, setShowShare] = useState<Meeting | null>(null);
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [now, setNow] = useState<number>(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Helper date generators
  const getTodayString = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };


  // New Meeting Form States (Advanced & Professional Date/Time)
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(getTodayString());
  const [selectedHour, setSelectedHour] = useState("04");
  const [selectedMinute, setSelectedMinute] = useState("30");
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("PM");
  const [newDuration, setNewDuration] = useState(60);
  const [newCourse, setNewCourse] = useState("");

  // Join Meeting Form
  const [joinId, setJoinId] = useState("");
  const [joinPwd, setJoinPwd] = useState("");
  const [joinName, setJoinName] = useState("");

  const openScheduleModal = useCallback(() => {
    const d = new Date(Date.now() + 15 * 60000);
    const remainder = 15 - (d.getMinutes() % 15);
    if (remainder < 15) {
      d.setMinutes(d.getMinutes() + remainder);
    }
    setNewDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    let h = d.getHours();
    const p = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    setSelectedHour(String(h).padStart(2, '0'));
    setSelectedMinute(String(d.getMinutes()).padStart(2, '0'));
    setSelectedPeriod(p);
    setNewDuration(60);
    setShowCreate(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(Date.now());
      try {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(m => !isDummyMeeting(m));
            setMeetings(clean);
            if (clean.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
            }
          }
        }
      } catch {}

      // Proactively purge legacy dummy meetings from server
      const dummyIds = ["GEO-CLASS-101", "RCRD-MEET-202", "REV-QA-303"];
      dummyIds.forEach(dId => {
        fetch(`/api/meetings?id=${encodeURIComponent(dId)}`, { method: 'DELETE' }).catch(() => {});
      });

      // Auto-open Join Modal if URL contains join/id parameters
      if (typeof window !== "undefined") {
        try {
          const sp = new URLSearchParams(window.location.search);
          const qJoin = sp.get("join") || sp.get("id");
          const qPwd = sp.get("pwd") || sp.get("password");
          if (qJoin) {
            setJoinId(qJoin);
            if (qPwd) setJoinPwd(qPwd);
            setShowJoin(true);
          }
          if (sp.get("schedule") === "true") {
            openScheduleModal();
          }
        } catch {}
      }
      // Sync meetings from server across all students & devices
      fetch('/api/meetings')
        .then(res => res.json())
        .then(data => {
          if (data?.meetings && Array.isArray(data.meetings)) {
            const cleanRemote = data.meetings.filter((m: Meeting) => !isDummyMeeting(m));
            setMeetings(prev => {
              const map = new Map<string, Meeting>();
              prev.filter(m => !isDummyMeeting(m)).forEach(m => map.set(m.id, m));
              cleanRemote.forEach((m: Meeting) => map.set(m.id, m));
              const merged = Array.from(map.values()).filter(m => !isDummyMeeting(m));
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              return merged;
            });
          }
        })
        .catch(() => {});
    }, 0);
    // Realtime 1-second interval for live countdowns and dynamic status updates
    const interval = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      setMeetings(prev => {
        let changed = false;
        const newMeetings = prev.map(m => {
          if (m.status === 'scheduled') {
            const t = new Date(m.scheduledAt).getTime();
            if (currentTime >= t) {
              changed = true;
              return { ...m, status: 'live' as const };
            }
          } else if (m.status === 'live' && m.duration) {
            const startT = new Date(m.scheduledAt).getTime();
            const endT = startT + m.duration * 60000;
            if (currentTime >= endT && m.attendees === 0) { // allow active meetings to keep running
              changed = true;
              return { ...m, status: 'ended' as const };
            }
          }
          return m;
        });
        if (changed) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newMeetings));
          return newMeetings;
        }
        return prev;
      });
    }, 1000);
    getCourses().then(setCourses).catch(() => {});
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [openScheduleModal]);

  const save = useCallback((list: Meeting[], singleUpdated?: Meeting) => {
    setMeetings(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    if (singleUpdated) {
      fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(singleUpdated),
      }).catch(() => {});
    }
  }, []);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const copyText = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    showToast("Copied to clipboard!");
  }, [showToast]);

  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return iso;
    }
  };

  const formatDuration = (mins: number) => {
    if (!mins || mins <= 0) return "60 mins";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h} hr ${m} min`;
    if (h > 0) return `${h} ${h === 1 ? 'hour' : 'hours'}`;
    return `${m} mins`;
  };

  const relCountdown = (iso: string) => {
    if (!now) return "Upcoming";
    try {
      const d = now - new Date(iso).getTime();
      if (d < 0) {
        const f = -d;
        if (f < 60000) return "< 1 min";
        if (f < 3600000) return `${Math.floor(f / 60000)}m`;
        if (f < 86400000) {
          const h = Math.floor(f / 3600000);
          const m = Math.floor((f % 3600000) / 60000);
          return m > 0 ? `${h}h ${m}m` : `${h}h`;
        }
        const days = Math.floor(f / 86400000);
        return days === 1 ? "1 day" : `${days} days`;
      }
      return "Now";
    } catch {
      return "Scheduled";
    }
  };

  const getModalSummary = () => {
    try {
      const dateVal = newDate || getTodayString();
      let h = parseInt(selectedHour, 10) || 12;
      if (selectedPeriod === "PM" && h < 12) h += 12;
      if (selectedPeriod === "AM" && h === 12) h = 0;
      const timeVal = `${String(h).padStart(2, '0')}:${selectedMinute || '00'}:00`;
      const startDate = new Date(`${dateVal}T${timeVal}`);
      const endDate = new Date(startDate.getTime() + newDuration * 60000);

      const startTimeStr = startDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
      const endTimeStr = endDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
      const dateStr = startDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

      const diffMs = now > 0 ? startDate.getTime() - now : 0;
      let countdown = "";
      if (diffMs <= 0) {
        countdown = "Starting now / Past";
      } else if (diffMs < 60000) {
        countdown = "Starts in <1 min";
      } else if (diffMs < 3600000) {
        countdown = `Starts in ${Math.floor(diffMs / 60000)}m`;
      } else if (diffMs < 86400000) {
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        countdown = mins > 0 ? `Starts in ${hrs}h ${mins}m` : `Starts in ${hrs}h`;
      } else {
        const days = Math.floor(diffMs / 86400000);
        countdown = `Starts in ${days} ${days === 1 ? 'day' : 'days'}`;
      }

      return {
        dateStr,
        timeRange: `${startTimeStr} – ${endTimeStr}`,
        durationStr: formatDuration(newDuration),
        countdown,
      };
    } catch {
      return {
        dateStr: "Selected Date",
        timeRange: `${selectedHour}:${selectedMinute} ${selectedPeriod}`,
        durationStr: `${newDuration} mins`,
        countdown: "Upcoming",
      };
    }
  };



  const computeScheduledIso = () => {
    const dateVal = newDate || getTodayString();
    let h = parseInt(selectedHour, 10) || 12;
    if (selectedPeriod === "PM" && h < 12) h += 12;
    if (selectedPeriod === "AM" && h === 12) h = 0;
    const timeVal = `${String(h).padStart(2, '0')}:${selectedMinute || '00'}:00`;
    return new Date(`${dateVal}T${timeVal}`).toISOString();
  };

  const handleCreate = () => {
    if (!newTitle.trim()) {
      showToast("Please enter a meeting topic/title.", false);
      return;
    }

    const scheduledIso = computeScheduledIso();
    const m: Meeting = {
      id: Date.now().toString().slice(-8),
      title: newTitle.trim(),
      courseId: newCourse || null,
      password: genPwd(),
      scheduledAt: scheduledIso,
      duration: newDuration,
      status: "scheduled",
      attendees: 0,
      createdAt: new Date().toISOString(),
      notes: "",
    };
    save([m, ...meetings], m);
    setShowCreate(false);
    setNewTitle("");
    setNewCourse("");
    setShowShare(m);
    showToast("Class meeting scheduled successfully!");
  };

  const startClass = (m: Meeting) => {
    const liveMeeting: Meeting = { ...m, status: "live" as const };
    const updated = meetings.map(x => x.id === m.id ? liveMeeting : x);
    save(updated, liveMeeting);
    sessionStorage.setItem(`meeting_${m.id}`, JSON.stringify(liveMeeting));
    router.push(`/meetings/room/${m.id}?role=mentor`);
  };

  const handleJoin = async () => {
    if (!joinId.trim() || !joinPwd.trim() || !joinName.trim()) {
      showToast("Please fill in all fields.", false);
      return;
    }
    const trimmedId = joinId.trim();
    const trimmedPwd = joinPwd.trim();
    const trimmedName = joinName.trim();

    let m = meetings.find(x => x.id.toUpperCase() === trimmedId.toUpperCase() || x.id === trimmedId);

    // Call server API to validate and fetch meeting details across all devices & students
    try {
      const res = await fetch(`/api/meetings/${encodeURIComponent(trimmedId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmedPwd, name: trimmedName }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to join meeting. Please check meeting ID and password.", false);
        return;
      }
      if (data.meeting) {
        const foundMeeting = data.meeting as Meeting;
        m = foundMeeting;
        sessionStorage.setItem(`meeting_${foundMeeting.id}`, JSON.stringify(foundMeeting));
        setMeetings(prev => prev.some(x => x.id === foundMeeting.id) ? prev : [foundMeeting, ...prev]);
      }
    } catch {
      // Local fallback
      if (!m) {
        showToast("Meeting ID not found.", false);
        return;
      }
      if (m.password.toUpperCase() !== trimmedPwd.toUpperCase()) {
        showToast("Invalid password.", false);
        return;
      }
    }

    if (!m) {
      showToast("Meeting ID not found.", false);
      return;
    }

    const startTime = new Date(m.scheduledAt).getTime();
    const isEarly = m.status !== "live" && startTime > Date.now();

    sessionStorage.setItem(`participant_name_${m.id}`, trimmedName);
    setShowJoin(false);

    if (isEarly) {
      const diffMs = startTime - Date.now();
      const diffMins = Math.ceil(diffMs / 60000);
      showToast(`Meeting is scheduled for ${fmt(m.scheduledAt)} (Starts in ${diffMins}m). Joining waiting lobby...`);
    }

    router.push(`/meetings/room/${m.id}?role=participant&name=${encodeURIComponent(trimmedName)}`);
  };

  const deleteMeeting = (id: string) => {
    if (confirm("Are you sure you want to delete this meeting?")) {
      save(meetings.filter(m => m.id !== id));
      fetch(`/api/meetings?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
      showToast("Meeting deleted.");
    }
  };

  const cleanMeetings = meetings.filter(m => !isDummyMeeting(m));
  const upcoming = cleanMeetings.filter(m => m.status === "scheduled");
  const live = cleanMeetings.filter(m => m.status === "live");
  const past = cleanMeetings.filter(m => m.status === "ended");

  const filtered = (activeTab === "upcoming" ? upcoming : activeTab === "live" ? live : past).filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.title.toLowerCase().includes(q) || m.id.includes(q);
  });

  return (
    <div className="relative flex h-full w-full bg-[#F4F7FC] text-[#111827] font-sans overflow-hidden antialiased">
      
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Crisp Modern Zoom Light Mode with Mobile Drawer Support */}
      <aside className={`w-[280px] flex-shrink-0 flex-col border-r border-[#E2E7EC]/90 bg-white h-full shadow-[2px_0_12px_rgba(0,0,0,0.03)] overflow-hidden transition-all duration-300 ${
        isMobileMenuOpen 
          ? "fixed inset-y-0 left-0 flex z-50 shadow-2xl" 
          : "hidden md:flex z-20"
      }`}>
        <div className="relative h-24 sm:h-26 flex items-center justify-center px-4 border-b border-[#E2E7EC] flex-shrink-0 w-full overflow-hidden">
          <div 
            className="flex items-center justify-center cursor-pointer group mx-auto" 
            onClick={() => { router.push('/'); setIsMobileMenuOpen(false); }}
          >
            <RcrdLogo className="h-20 sm:h-22 md:h-24 w-auto scale-175 sm:scale-190 md:scale-205 origin-center transition-transform group-hover:scale-215" />
          </div>
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 md:hidden p-1.5 text-[#57636E] hover:text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-5 px-3.5 space-y-6 custom-scrollbar min-h-0">
          <nav className="space-y-1.5">
            {canAccess('for-you') && <SidebarItem icon={<HomeIcon size={17} />} label="For You" href="/" />}
            {canAccess('library') && <SidebarItem icon={<LibraryIcon size={17} />} label="Library" href="/library" />}
            {canAccess('meetings') && <SidebarItem icon={<VideoCameraIcon size={17} />} label="Meetings" active href="/meetings" />}
            {canAccess('settings') && <SidebarItem icon={<SettingsIcon size={17} />} label="Settings" href="/settings" />}
          </nav>

          {(canAccess('manage-users') || canAccess('workspace-info')) && (
            <div>
              <h3 className="px-3.5 text-[11px] font-extrabold uppercase tracking-wider text-[#57636E] mb-2">Workspace Admin</h3>
              <nav className="space-y-1.5">
                {canAccess('manage-users') && <SidebarItem icon={<UserIcon size={17} />} label="Manage Users" href="/settings?tab=users" />}
                {canAccess('workspace-info') && <SidebarItem icon={<WorkspaceIcon size={17} />} label="Workspace Info" href="/settings?tab=workspace" />}
              </nav>
            </div>
          )}
        </div>

        {/* Schedule Meeting Button */}
        <div className="p-4 border-t border-[#E2E7EC] bg-[#F5F6F8]/50 flex-shrink-0">
          <button
            onClick={() => { openScheduleModal(); setIsMobileMenuOpen(false); }}
            className="w-full bg-[#154360] hover:bg-[#0E2F44] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Calendar size={15} className="text-white" />
            Schedule Meeting
          </button>
        </div>
      </aside>

      {/* Main Meetings Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#F8FAFD] overflow-hidden">
        
        {/* Header - Unified Fixed h-16, Centered Search, Image 5 Avatar */}
        <AppHeader 
          placeholder="Search meetings by topic, ID, or mentor..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenProfile={() => setIsProfileOpen(true)}
          onToggleMobileSidebar={() => setIsMobileMenuOpen(prev => !prev)}
        />

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          <div className="max-w-[1200px] mx-auto pt-6 sm:pt-8 px-4 sm:px-8 pb-24 space-y-5 sm:space-y-7">
            
            {/* Quick Action Cards - Clean, Unified 3-Card SaaS Pattern */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Card 1: Schedule Meeting */}
              <div
                onClick={openScheduleModal}
                className="bg-white hover:bg-[#F5F6F8]/60 rounded-2xl p-5 cursor-pointer transition-all duration-200 border border-[#E2E7EC]/90 hover:border-[#154360]/40 shadow-sm hover:shadow-md group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-[#EBF5FB] border border-[#154360]/20 flex items-center justify-center mb-3.5 transition-transform duration-200 group-hover:scale-105">
                    <Calendar size={20} className="text-[#154360]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#20262E] group-hover:text-[#154360] transition-colors">Schedule Meeting</h3>
                  <p className="text-xs text-[#57636E] mt-1 font-normal leading-relaxed">Plan upcoming classes with date, time, and curriculum folders</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E2E7EC] flex items-center justify-between text-xs font-semibold text-[#154360]">
                  <span>Schedule session</span>
                  <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>

              {/* Card 2: Join Meeting */}
              <div
                onClick={() => setShowJoin(true)}
                className="bg-white hover:bg-[#F5F6F8]/60 rounded-2xl p-5 cursor-pointer transition-all duration-200 border border-[#E2E7EC]/90 hover:border-[#E2E7EC] shadow-sm hover:shadow-md group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-[#E2E7EC] flex items-center justify-center mb-3.5 transition-transform duration-200 group-hover:scale-105">
                    <Plus size={20} className="text-[#20262E]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#20262E] group-hover:text-[#154360] transition-colors">Join with ID</h3>
                  <p className="text-xs text-[#57636E] mt-1 font-normal leading-relaxed">Enter an active meeting room with meeting ID & passcode</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E2E7EC] flex items-center justify-between text-xs font-semibold text-[#57636E] group-hover:text-[#154360] transition-colors">
                  <span>Enter room</span>
                  <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>

              {/* Card 3: Recordings & Library */}
              <div
                onClick={() => router.push('/library')}
                className="bg-white hover:bg-[#F5F6F8]/60 rounded-2xl p-5 cursor-pointer transition-all duration-200 border border-[#E2E7EC]/90 hover:border-[#E2E7EC] shadow-sm hover:shadow-md group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-[#E2E7EC] flex items-center justify-center mb-3.5 transition-transform duration-200 group-hover:scale-105">
                    <Folder size={20} className="text-[#20262E]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#20262E] group-hover:text-[#154360] transition-colors">Class Recordings</h3>
                  <p className="text-xs text-[#57636E] mt-1 font-normal leading-relaxed">Access auto-saved video recordings, notes, and AI transcripts</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E2E7EC] flex items-center justify-between text-xs font-semibold text-[#57636E] group-hover:text-[#154360] transition-colors">
                  <span>Browse library</span>
                  <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>

            </div>

            {/* Live Session Alert Banner - Clean Card Pattern */}
            {live.length > 0 && (
              <div className="p-4 bg-white rounded-2xl flex items-center justify-between gap-4 border border-[#154360]/30 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <div className="w-3.5 h-3.5 bg-[#154360] rounded-full animate-ping absolute opacity-70" />
                    <div className="w-2.5 h-2.5 bg-[#154360] rounded-full relative" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#154360]/10 text-[#154360] border border-[#154360]/30 px-2 py-0.5 rounded-full">
                        Live Session
                      </span>
                      <p className="font-bold text-sm text-[#20262E]">{live[0].title}</p>
                    </div>
                    <p className="text-xs text-[#57636E] mt-0.5">Recording & broadcast active · Room ID: <span className="font-mono font-medium text-[#20262E]">{live[0].id}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => startClass(live[0])}
                  className="px-4 py-2 bg-[#154360] hover:bg-[#0E2F44] text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Play size={12} className="fill-white" /> Rejoin Room
                </button>
              </div>
            )}

            {/* Navigation Tabs Header - Segmented Pill Control */}
            <div className="flex items-center justify-between pt-1">
              <div className="inline-flex items-center p-1 bg-slate-100/90 border border-[#E2E7EC]/70 rounded-xl">
                {[
                  { id: "upcoming", label: "Upcoming", count: upcoming.length },
                  { id: "live", label: "Live", count: live.length },
                  { id: "past", label: "Past Recorded", count: past.length },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as "upcoming" | "live" | "past")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs transition-all duration-150 flex items-center gap-2 ${
                      activeTab === tab.id
                        ? "bg-white text-[#20262E] font-semibold shadow-xs"
                        : "text-[#57636E] hover:text-[#20262E] font-medium"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        activeTab === tab.id
                          ? "bg-[#EBF5FB] text-[#0E2F44]"
                          : "bg-slate-200/70 text-[#57636E]"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="text-xs text-[#57636E] font-medium">
                {filtered.length} {filtered.length === 1 ? 'meeting' : 'meetings'}
              </div>
            </div>

            {/* Meetings Cards Grid / Empty State */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-2xl border border-dashed border-[#E2E7EC] bg-white/70 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-[#E2E7EC] flex items-center justify-center mb-3 text-[#57636E] shadow-xs">
                  <Calendar size={22} />
                </div>
                <h3 className="text-base font-bold text-[#20262E] mb-1">
                  {activeTab === "upcoming"
                    ? "No upcoming meetings"
                    : activeTab === "live"
                    ? "No live meetings right now"
                    : "No recorded meetings yet"}
                </h3>
                <p className="text-xs text-[#57636E] max-w-sm mb-5 font-normal">
                  {activeTab === "upcoming"
                    ? "Schedule a session or enter an ID to collaborate and record."
                    : activeTab === "live"
                    ? "Start any scheduled meeting to begin broadcasting live."
                    : "Completed class recordings with notes will show up here."}
                </p>
                {activeTab === "upcoming" && (
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={openScheduleModal}
                      className="px-4 py-2 bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Calendar size={14} /> Schedule Meeting
                    </button>
                    <button
                      onClick={() => setShowJoin(true)}
                      className="px-4 py-2 bg-white hover:bg-[#F5F6F8] text-[#20262E] border border-[#E2E7EC] text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Join with ID
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(m => {
                  const isLive = m.status === "live";
                  const isPast = m.status === "ended";
                  const pwdVis = showPwd[m.id];
                  const course = courses.find(c => c.id === m.courseId);

                  return (
                    <div
                      key={m.id}
                      className={`group relative rounded-2xl p-5 bg-white border transition-all duration-200 flex flex-col justify-between hover:shadow-md ${
                        isLive
                          ? "border-[#154360]/40 ring-2 ring-[#154360]/20 shadow-sm"
                          : "border-[#E2E7EC]/90 hover:border-[#E2E7EC] shadow-xs"
                      }`}
                    >
                      {/* Top Badges & Quick Delete */}
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isLive && (
                              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#154360] bg-[#154360]/10 border border-[#154360]/30 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 bg-[#154360] rounded-full animate-pulse" /> LIVE
                              </span>
                            )}
                            {isPast && (
                              <span className="text-[10px] font-semibold text-[#57636E] bg-slate-100 border border-[#E2E7EC] px-2 py-0.5 rounded-full">
                                ENDED
                              </span>
                            )}
                            {!isLive && !isPast && (
                              <span className="text-[10px] font-semibold text-[#57636E] bg-slate-100 border border-[#E2E7EC] px-2 py-0.5 rounded-full">
                                SCHEDULED
                              </span>
                            )}
                            {course && (
                              <span className="flex items-center gap-1 text-[10px] text-[#154360] bg-[#EBF5FB] border border-[#154360]/30 px-2 py-0.5 rounded-full font-semibold truncate max-w-[130px]">
                                <Folder size={10} /> {course.name}
                              </span>
                            )}
                          </div>
                          
                          <button
                            onClick={() => deleteMeeting(m.id)}
                            className="p-1 text-slate-300 hover:text-[#154360] rounded transition-colors opacity-70 hover:opacity-100"
                            title="Delete meeting"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Title & Timing */}
                        <h3 className="text-sm font-bold text-[#20262E] mb-1.5 group-hover:text-[#154360] transition-colors truncate" title={m.title}>
                          {m.title}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-[#57636E] font-medium mb-2.5">
                          <Calendar size={13} className="text-[#154360] shrink-0" />
                          <span>{fmt(m.scheduledAt)}</span>
                        </div>

                        {/* Separate Duration & Countdown badges */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-3.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-[#20262E] border border-[#E2E7EC] shadow-2xs">
                            <Clock size={12} className="text-[#57636E]" />
                            Duration: <strong className="text-[#20262E]">{formatDuration(m.duration)}</strong>
                          </span>
                          {!isPast && (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border shadow-2xs ${
                              isLive 
                                ? "bg-[#154360]/10 text-[#154360] border-[#154360]/30" 
                                : "bg-[#EBF5FB] text-[#0E2F44] border-[#154360]/30"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-[#154360] animate-ping" : "bg-[#EBF5FB]0 animate-pulse"}`} />
                              {isLive ? "Live Now" : `Starts in: ${relCountdown(m.scheduledAt)}`}
                            </span>
                          )}
                          {isPast && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F5F6F8] text-[#57636E] border border-[#E2E7EC]">
                              Completed
                            </span>
                          )}
                          {m.attendees > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-[#57636E] bg-[#F5F6F8] border border-[#E2E7EC]">
                              <Users size={11} /> {m.attendees}
                            </span>
                          )}
                        </div>

                        {/* Compact Credentials Bar */}
                        <div className="rounded-xl border border-slate-150 bg-[#F5F6F8]/80 px-3 py-2 mb-3.5 flex items-center justify-between text-xs gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-[#57636E]">ID:</span>
                            <span className="font-mono font-bold text-[#20262E] text-[11px]">{m.id}</span>
                            <button
                              onClick={() => copyText(m.id, `id-${m.id}`)}
                              className="text-[#57636E] hover:text-[#154360] transition-colors ml-0.5 cursor-pointer"
                              title="Copy ID"
                            >
                              {copied === `id-${m.id}` ? <Check size={11} className="text-[#2980B9]" /> : <Copy size={11} />}
                            </button>
                          </div>
                          <div className="h-3 w-px bg-slate-200" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-[#57636E]">Pass:</span>
                            <span className="font-mono font-bold text-[#154360] text-[11px]">{pwdVis ? m.password : "••••••"}</span>
                            <button
                              onClick={() => setShowPwd(p => ({ ...p, [m.id]: !p[m.id] }))}
                              className="text-[#57636E] hover:text-[#20262E] transition-colors cursor-pointer"
                              title={pwdVis ? "Hide Passcode" : "Show Passcode"}
                            >
                              {pwdVis ? <EyeOff size={11} /> : <Eye size={11} />}
                            </button>
                            <button
                              onClick={() => copyText(m.password, `pwd-${m.id}`)}
                              className="text-[#57636E] hover:text-[#154360] transition-colors cursor-pointer"
                              title="Copy Password"
                            >
                              {copied === `pwd-${m.id}` ? <Check size={11} className="text-[#2980B9]" /> : <Copy size={11} />}
                            </button>
                          </div>
                          <div className="h-3 w-px bg-slate-200" />
                          <button
                            onClick={() => {
                              const origin = typeof window !== "undefined" ? window.location.origin : "";
                              const link = `${origin}/meeting/${m.id}?pwd=${encodeURIComponent(m.password)}`;
                              copyText(link, `link-${m.id}`);
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-[#154360] hover:text-[#0E2F44] transition-colors px-1.5 py-0.5 rounded hover:bg-[#EBF5FB] cursor-pointer"
                            title="Copy Direct Student Join Link"
                          >
                            {copied === `link-${m.id}` ? <Check size={11} className="text-[#2980B9]" /> : <Link2 size={11} />}
                            <span>{copied === `link-${m.id}` ? "Copied Link!" : "Copy Link"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-[#E2E7EC]">
                        {!isPast ? (
                          <>
                            <button
                              onClick={() => startClass(m)}
                              className="flex-1 flex items-center justify-center gap-1.5 h-8.5 rounded-xl font-semibold text-xs transition-all shadow-sm bg-[#154360] hover:bg-[#0E2F44] text-white"
                            >
                              {isLive ? <><Play size={12} className="fill-white" /> Rejoin Room</> : <><Monitor size={12} /> Start</>}
                            </button>
                            <button
                              onClick={() => router.push(`/meetings/notes/${m.id}`)}
                              className="h-8.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-[#20262E] rounded-xl font-semibold text-xs flex items-center gap-1 transition-colors"
                              title="View and edit meeting notes"
                            >
                              <FileText size={12} /> Notes
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => router.push(`/meetings/notes/${m.id}`)}
                              className="flex-1 flex items-center justify-center gap-1.5 h-8.5 rounded-xl font-semibold text-xs bg-[#EBF5FB] hover:bg-[#EBF5FB] text-[#0E2F44] border border-[#154360]/30 transition-colors shadow-2xs"
                            >
                              <FileText size={12} /> View Notes
                            </button>
                            <button
                              onClick={() => startClass(m)}
                              className="h-8.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-[#20262E] rounded-xl font-semibold text-xs flex items-center gap-1 transition-colors"
                              title="Re-open meeting room"
                            >
                              <Play size={11} /> Room
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setShowShare(m)}
                          className="h-8.5 px-2.5 bg-white hover:bg-[#F5F6F8] border border-[#E2E7EC] text-[#20262E] rounded-xl font-semibold text-xs flex items-center gap-1 transition-colors shadow-xs"
                          title="Invite attendees"
                        >
                          <Share2 size={11} /> Invite
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 transition-opacity animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[700px] flex flex-col font-sans overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 border border-[#E2E7EC]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E2E7EC] flex items-center justify-between bg-[#F5F6F8]/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EBF5FB] border border-[#154360]/20 flex items-center justify-center text-[#154360]">
                  <Calendar size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#20262E]">Schedule Meeting</h2>
                  <p className="text-xs text-[#57636E]">Plan upcoming sessions with Google Drive recording</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={() => setShowCreate(false)} className="p-2 text-[#57636E] hover:text-[#20262E] hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
              
              {/* Topic & Folder Row */}
              <div className="p-4 rounded-2xl border border-[#E2E7EC] bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                      Meeting Topic *
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="E.g., Full-Stack Web Development"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E7EC] hover:border-[#E2E7EC] focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/15 rounded-xl text-xs outline-none transition-all shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                      Save to Folder <span className="text-[#57636E] font-normal normal-case">(Google Drive)</span>
                    </label>
                    <select
                      value={newCourse}
                      onChange={e => setNewCourse(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E7EC] hover:border-[#E2E7EC] focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/15 rounded-xl text-xs outline-none transition-all shadow-xs cursor-pointer font-medium text-[#20262E]"
                    >
                      <option value="">None (Root Library)</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Date & Time Section */}
              <div className="p-4 rounded-2xl border border-[#E2E7EC] bg-white space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider">
                      Start Date & Time
                    </label>
                    <span className="text-[11px] font-medium text-[#57636E]">
                      When should this meeting begin?
                    </span>
                  </div>

                  {/* Clean Start Time row */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Date input */}
                    <div className="flex-1 min-w-[160px]">
                      <input
                        type="date"
                        value={newDate}
                        onChange={e => setNewDate(e.target.value)}
                        className="w-full px-3 py-2.5 border border-[#E2E7EC] hover:border-[#E2E7EC] rounded-xl text-xs focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/15 outline-none shadow-xs transition-all bg-white font-medium text-[#20262E]"
                      />
                    </div>

                    {/* Time selects */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={selectedHour}
                        onChange={e => setSelectedHour(e.target.value)}
                        className="w-16 px-2 py-2.5 border border-[#E2E7EC] hover:border-[#E2E7EC] rounded-xl text-xs bg-white focus:border-[#154360] outline-none shadow-xs transition-all font-semibold text-[#20262E] text-center cursor-pointer"
                      >
                        {["01","02","03","04","05","06","07","08","09","10","11","12"].map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span className="text-[#57636E] font-bold text-sm">:</span>
                      <select
                        value={selectedMinute}
                        onChange={e => setSelectedMinute(e.target.value)}
                        className="w-16 px-2 py-2.5 border border-[#E2E7EC] hover:border-[#E2E7EC] rounded-xl text-xs bg-white focus:border-[#154360] outline-none shadow-xs transition-all font-semibold text-[#20262E] text-center cursor-pointer"
                      >
                        {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={selectedPeriod}
                        onChange={e => setSelectedPeriod(e.target.value as "AM" | "PM")}
                        className="w-16 px-2 py-2.5 border border-[#E2E7EC] hover:border-[#E2E7EC] rounded-xl text-xs bg-[#F5F6F8] focus:border-[#154360] outline-none shadow-xs transition-all font-bold text-[#0E2F44] text-center cursor-pointer"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Quick Start Presets */}
                <div className="pt-3 border-t border-[#E2E7EC]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#57636E] uppercase tracking-wider">
                      Quick Start Presets:
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5">
                    <button 
                      type="button"
                      onClick={() => {
                        const target = new Date(Date.now() + 15 * 60000);
                        setNewDate(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`);
                        let h = target.getHours(); const p = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
                        setSelectedHour(String(h).padStart(2, '0'));
                        setSelectedMinute(String(Math.floor(target.getMinutes() / 5) * 5).padStart(2, '0'));
                        setSelectedPeriod(p);
                      }}
                      className="px-3 py-1.5 bg-[#EBF5FB] hover:bg-[#EBF5FB] text-[#0E2F44] text-xs font-semibold rounded-lg transition-colors border border-[#154360]/30 shadow-2xs cursor-pointer"
                    >
                      In 15 mins
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const target = new Date(Date.now() + 30 * 60000);
                        setNewDate(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`);
                        let h = target.getHours(); const p = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
                        setSelectedHour(String(h).padStart(2, '0'));
                        setSelectedMinute(String(Math.floor(target.getMinutes() / 5) * 5).padStart(2, '0'));
                        setSelectedPeriod(p);
                      }}
                      className="px-3 py-1.5 bg-[#EBF5FB] hover:bg-[#EBF5FB] text-[#0E2F44] text-xs font-semibold rounded-lg transition-colors border border-[#154360]/30 shadow-2xs cursor-pointer"
                    >
                      In 30 mins
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const target = new Date(Date.now() + 60 * 60000);
                        setNewDate(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`);
                        let h = target.getHours(); const p = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
                        setSelectedHour(String(h).padStart(2, '0'));
                        setSelectedMinute(String(Math.floor(target.getMinutes() / 5) * 5).padStart(2, '0'));
                        setSelectedPeriod(p);
                      }}
                      className="px-3 py-1.5 bg-[#EBF5FB] hover:bg-[#EBF5FB] text-[#0E2F44] text-xs font-semibold rounded-lg transition-colors border border-[#154360]/30 shadow-2xs cursor-pointer"
                    >
                      In 1 hour
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const target = new Date(); target.setDate(target.getDate() + 1); target.setHours(10, 0, 0, 0);
                        setNewDate(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`);
                        setSelectedHour("10"); setSelectedMinute("00"); setSelectedPeriod("AM");
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#20262E] text-xs font-semibold rounded-lg transition-colors border border-[#E2E7EC] shadow-2xs cursor-pointer"
                    >
                      Tomorrow 10 AM
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const target = new Date(); target.setDate(target.getDate() + 1); target.setHours(14, 0, 0, 0);
                        setNewDate(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`);
                        setSelectedHour("02"); setSelectedMinute("00"); setSelectedPeriod("PM");
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#20262E] text-xs font-semibold rounded-lg transition-colors border border-[#E2E7EC] shadow-2xs cursor-pointer"
                    >
                      Tomorrow 2 PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Meeting Duration */}
              <div className="p-4 rounded-2xl border border-[#E2E7EC] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider">
                      Meeting Duration
                    </label>
                    <p className="text-[11px] text-[#57636E] font-normal">How long should this session run?</p>
                  </div>
                  <span className="text-xs font-bold text-[#0E2F44] bg-[#EBF5FB] px-2.5 py-1 rounded-lg border border-[#154360]/30 shadow-2xs">
                    Selected: {formatDuration(newDuration)}
                  </span>
                </div>

                {/* Duration Chips */}
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map(preset => {
                    const isSelected = newDuration === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setNewDuration(preset.value)}
                        className={`px-3 py-2 text-xs rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? "bg-[#154360] text-white font-bold shadow-sm ring-2 ring-[#154360]/20 scale-105"
                            : "bg-slate-100 hover:bg-slate-200 text-[#20262E] font-semibold"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom duration dropdown */}
                <div className="pt-2 flex items-center gap-3 text-xs text-[#57636E] font-medium">
                  <span className="text-[#57636E]">Or fine-tune:</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={newDuration >= 60 ? Math.floor(newDuration / 60) : 0}
                      onChange={e => {
                        const hrs = parseInt(e.target.value);
                        const mins = newDuration % 60;
                        setNewDuration(hrs * 60 + mins);
                      }}
                      className="px-2.5 py-1.5 border border-[#E2E7EC] hover:border-[#E2E7EC] rounded-lg text-xs bg-white focus:border-[#154360] outline-none font-semibold text-[#20262E] cursor-pointer"
                    >
                      {[0,1,2,3,4,5,6].map(h => (
                        <option key={h} value={h}>{h} hr</option>
                      ))}
                    </select>
                    <select
                      value={newDuration % 60}
                      onChange={e => {
                        const hrs = Math.floor(newDuration / 60);
                        const mins = parseInt(e.target.value);
                        setNewDuration(hrs * 60 + mins);
                      }}
                      className="px-2.5 py-1.5 border border-[#E2E7EC] hover:border-[#E2E7EC] rounded-lg text-xs bg-white focus:border-[#154360] outline-none font-semibold text-[#20262E] cursor-pointer"
                    >
                      {[0,5,10,15,20,30,45].map(m => (
                        <option key={m} value={m}>{m} min</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Schedule Overview Banner */}
              {(() => {
                const summary = getModalSummary();
                return (
                  <div className="rounded-2xl border border-[#154360]/30 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-emerald-50/70 shadow-xs p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#154360] text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Calendar size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-[#20262E] text-sm truncate max-w-[320px]">
                            {newTitle.trim() || "Untitled Meeting"}
                          </p>
                          <p className="text-xs text-[#57636E] mt-0.5 font-medium">
                            {summary.dateStr} · {summary.timeRange}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-white text-[#0E2F44] border border-[#154360]/30 shadow-2xs">
                          Starts in {summary.countdown}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#154360]/20 flex items-center justify-between text-xs flex-wrap gap-2">
                      <span className="text-[#20262E] font-semibold">
                        Meeting Duration: <span className="text-[#0E2F44] font-bold bg-white px-2 py-0.5 rounded border border-[#154360]/30">{summary.durationStr}</span>
                      </span>
                      {newCourse ? (
                        <span className="text-[#57636E] font-medium text-[11px]">
                          Folder: <strong className="text-[#20262E]">{courses.find(c => c.id === newCourse)?.name || 'Selected Folder'}</strong>
                        </span>
                      ) : (
                        <span className="text-[#57636E] text-[11px]">Save location: Root Library</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Security Details */}
              <div className="p-4 rounded-xl border border-[#E2E7EC] bg-[#F5F6F8]/60">
                <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-2.5">Meeting Security</label>
                <div className="flex gap-8">
                  <div className="flex items-center gap-2.5 opacity-90">
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-[#154360] text-white">
                      <Check size={13} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#20262E] block">Passcode</span>
                      <span className="text-[11px] text-[#57636E]">Auto-generated & encrypted</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 opacity-90">
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-[#154360] text-white">
                      <Check size={13} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#20262E] block">Waiting Room</span>
                      <span className="text-[11px] text-[#57636E]">Host admits participants</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#E2E7EC] flex justify-end items-center bg-[#F5F6F8]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 bg-white border border-[#E2E7EC] text-[#20262E] text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="px-5 py-2 bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  Schedule Meeting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JOIN MEETING MODAL */}
      {showJoin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px] overflow-hidden font-sans border border-[#E2E7EC]">
            <div className="p-6 border-b border-[#E2E7EC] flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#20262E]">Join a Meeting</h2>
                <p className="text-xs text-[#57636E] mt-0.5">Enter meeting ID and passcode to join.</p>
              </div>
              <button
                onClick={() => setShowJoin(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-[#57636E] hover:text-[#20262E] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#57636E] uppercase tracking-wider mb-1.5">
                  Your Screen Name *
                </label>
                <input
                  type="text"
                  value={joinName}
                  onChange={e => setJoinName(e.target.value)}
                  placeholder="e.g. Hari Kishore"
                  className="w-full px-3.5 py-2.5 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] placeholder:text-[#57636E] outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/15 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#57636E] uppercase tracking-wider mb-1.5">
                  Meeting ID *
                </label>
                <input
                  type="text"
                  value={joinId}
                  onChange={e => setJoinId(e.target.value)}
                  placeholder="Enter 8-digit Meeting ID"
                  className="w-full px-3.5 py-2.5 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm font-mono text-[#20262E] placeholder:text-[#57636E] outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/15 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#57636E] uppercase tracking-wider mb-1.5">
                  Passcode *
                </label>
                <div className="relative">
                  <input
                    type={showPwd["join"] ? "text" : "password"}
                    value={joinPwd}
                    onChange={e => setJoinPwd(e.target.value)}
                    placeholder="8-character passcode"
                    className="w-full px-3.5 py-2.5 pr-10 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm font-mono tracking-widest text-[#20262E] placeholder:text-[#57636E] outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/15 transition-all"
                  />
                  <button
                    onClick={() => setShowPwd(p => ({ ...p, join: !p.join }))}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#57636E] hover:text-[#57636E]"
                  >
                    {showPwd["join"] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowJoin(false)}
                className="flex-1 py-2.5 bg-white border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E] text-xs font-semibold rounded-xl transition-colors shadow-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={!joinId.trim() || !joinPwd.trim() || !joinName.trim()}
                className="flex-1 py-2.5 bg-[#154360] hover:bg-[#0E2F44] disabled:bg-slate-200 disabled:text-[#57636E] text-white text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all"
              >
                <Video size={14} /> Join Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE / INVITE MODAL */}
      {showShare && (() => {
        const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
        const directMeetingLink = `${origin}/meeting/${showShare.id}?pwd=${encodeURIComponent(showShare.password)}`;
        const msgText = `*Class Meeting Invitation*\n*Topic:* ${showShare.title}\n\n*Meeting Link:* ${directMeetingLink}\n*Meeting ID:* ${showShare.id}\n*Passcode:* ${showShare.password}\n*Time:* ${fmt(showShare.scheduledAt)}\n*Duration:* ${formatDuration(showShare.duration)}\n\nClick the meeting link to join directly, or open the link and enter the Meeting ID & Passcode.`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(msgText)}`;
        const emailSubject = encodeURIComponent(`Meeting Invite: ${showShare.title}`);
        const emailBody = encodeURIComponent(`Hello,\n\nYou are invited to join the class meeting session:\n\nTitle: ${showShare.title}\nMeeting Link: ${directMeetingLink}\nMeeting ID: ${showShare.id}\nPasscode: ${showShare.password}\nTime: ${fmt(showShare.scheduledAt)}\nDuration: ${formatDuration(showShare.duration)}\n\nClick the link to join directly or enter the Meeting ID & Passcode.\n\nSee you there!`);
        const allText = `Class Meeting: ${showShare.title}\n\nMeeting Link: ${directMeetingLink}\nMeeting ID: ${showShare.id}\nPasscode: ${showShare.password}\nTime: ${fmt(showShare.scheduledAt)}\nDuration: ${formatDuration(showShare.duration)}\n\nJoin: ${directMeetingLink}`;
        const courseName = courses.find(c => c.id === showShare.courseId)?.name;

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] overflow-hidden font-sans border border-[#E2E7EC]">
              
              <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-[#E2E7EC] bg-[#F5F6F8]/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#EBF5FB] border border-[#154360]/20 rounded-xl flex items-center justify-center text-[#154360]">
                    <Share2 size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#20262E]">Meeting Link & Invitation</h2>
                    <p className="text-xs text-[#57636E]">Share this link with students to let them join</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShare(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-xl text-[#57636E] hover:text-[#20262E] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                
                {/* 1. DIRECT MEETING LINK (PROMINENT HIGHLIGHT) */}
                <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 border border-[#154360]/30 rounded-2xl p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0E2F44] flex items-center gap-1.5">
                      <Link2 size={13} className="text-[#154360]" /> Direct Meeting Link for Students
                    </span>
                    <span className="text-[10px] font-bold text-[#0E2F44] bg-[#EBF5FB]/70 px-2 py-0.5 rounded-full border border-[#2980B9]/30">
                      Auto-fills Passcode
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={directMeetingLink}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      className="flex-1 px-3 py-2 bg-white border border-[#154360]/30 rounded-xl text-xs font-mono text-[#20262E] outline-none select-all truncate font-medium shadow-2xs"
                    />
                    <button
                      onClick={() => copyText(directMeetingLink, `share-link-${showShare.id}`)}
                      className="px-3.5 py-2 bg-[#154360] hover:bg-[#0E2F44] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {copied === `share-link-${showShare.id}` ? <Check size={13} className="text-white" /> : <Copy size={13} />}
                      <span>{copied === `share-link-${showShare.id}` ? "Copied!" : "Copy Link"}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#57636E] pt-0.5">
                    <span>Students click this link to join directly without manual typing</span>
                    <a
                      href={directMeetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#154360] hover:text-[#0E2F44] font-semibold flex items-center gap-1"
                    >
                      <span>Preview</span> <ExternalLink size={11} />
                    </a>
                  </div>
                </div>

                {/* 2. CREDENTIALS CARD */}
                <div className="bg-[#F5F6F8] border border-[#E2E7EC] rounded-2xl p-4.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[#20262E] font-bold text-sm truncate max-w-[280px]" title={showShare.title}>
                      {showShare.title}
                    </p>
                    {courseName && (
                      <span className="text-[#154360] font-semibold text-[11px] flex items-center gap-1 bg-[#EBF5FB] px-2 py-0.5 rounded border border-[#154360]/30">
                        <Folder size={10} /> {courseName}
                      </span>
                    )}
                  </div>
                  
                  <div className="h-px bg-slate-200" />

                  {/* ID */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-[#57636E] uppercase tracking-wider mb-0.5">Meeting ID</p>
                      <p className="text-sm font-mono font-bold text-[#154360] tracking-wider">{showShare.id}</p>
                    </div>
                    <button
                      onClick={() => copyText(showShare.id, `cid-${showShare.id}`)}
                      className="px-3 py-1.5 bg-white border border-[#E2E7EC] hover:bg-slate-100 text-xs font-semibold text-[#20262E] rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      {copied === `cid-${showShare.id}` ? <Check size={12} className="text-[#2980B9]" /> : <Copy size={12} />}
                      {copied === `cid-${showShare.id}` ? "Copied" : "Copy ID"}
                    </button>
                  </div>

                  {/* Passcode */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-[#57636E] uppercase tracking-wider mb-0.5">Passcode</p>
                      <p className="text-lg font-mono font-bold text-[#20262E] tracking-[0.15em]">{showShare.password}</p>
                    </div>
                    <button
                      onClick={() => copyText(showShare.password, `cpwd-${showShare.id}`)}
                      className="px-3 py-1.5 bg-white border border-[#E2E7EC] hover:bg-slate-100 text-xs font-semibold text-[#20262E] rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      {copied === `cpwd-${showShare.id}` ? <Check size={12} className="text-[#2980B9]" /> : <Copy size={12} />}
                      {copied === `cpwd-${showShare.id}` ? "Copied" : "Copy Passcode"}
                    </button>
                  </div>

                  <div className="h-px bg-slate-200" />

                  <div className="flex items-center justify-between text-xs text-[#57636E] font-medium pt-0.5">
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-[#57636E]" />
                      {fmt(showShare.scheduledAt)} ({formatDuration(showShare.duration)})
                    </span>
                    <span className="text-[#2980B9] font-semibold text-[11px] flex items-center gap-1">
                      <CheckCircle2 size={11} /> Ready to Share
                    </span>
                  </div>
                </div>

                {/* 3. SHARE ACTIONS */}
                <div className="space-y-2 pt-1">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12.05 1.667C6.277 1.667 1.59 6.357 1.59 12.13c0 1.87.492 3.628 1.35 5.147L1.5 22.5l5.38-1.413a10.432 10.432 0 004.166.868c5.774 0 10.462-4.69 10.462-10.462 0-5.774-4.688-10.462-10.458-10.462zm0 19.14a8.676 8.676 0 01-4.422-1.212l-.318-.188-3.292.864.878-3.21-.207-.33a8.636 8.636 0 01-1.325-4.6c0-4.787 3.894-8.682 8.682-8.682 4.787 0 8.682 3.895 8.682 8.682 0 4.788-3.895 8.676-8.678 8.676z"/>
                    </svg>
                    Share via WhatsApp (with Meeting Link)
                  </a>

                  <button
                    onClick={() => copyText(allText, "share-all")}
                    className="w-full py-2.5 bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    {copied === "share-all" ? <><Check size={14} className="text-white" /> Copied Full Invitation!</> : <><Copy size={14} /> Copy Full Invitation with Link</>}
                  </button>

                  <div className="flex gap-2">
                    <a
                      href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-[#20262E] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Mail size={13} /> Email Invite
                    </a>
                    <button
                      onClick={() => {
                        setShowShare(null);
                        startClass(showShare);
                      }}
                      className="flex-1 py-2 bg-[#2980B9] hover:bg-[#0E2F44] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Play size={12} className="fill-white" /> Start Room Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-[200] border  animate-in slide-in-from-bottom-5 duration-200 ${
          toast.ok
            ? "bg-slate-900 text-white border-slate-800"
            : "bg-[#154360] text-white border-[#154360]"
        }`}>
          {toast.ok ? <CheckCircle2 size={16} className="text-[#EBF5FB]" /> : <X size={16} className="text-white" />}
          <span className="text-xs font-bold">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="p-0.5 hover:bg-white/20 rounded-md ml-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Profile Flyout (Image 5) */}
      <ProfileFlyout
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        videoCount={meetings.length}
      />

    </div>
  );
}
