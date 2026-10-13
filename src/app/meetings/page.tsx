"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search, Bell, Settings, Video, Folder,
  Users, Building, Shield, ChevronDown, X, Home,
  Bookmark, Plus, Copy, Check, Clock, FileText,
  Trash2, Calendar,
  Eye, EyeOff, Share2, Mail,
  Monitor, Play, Radio,
  HelpCircle, CheckCircle2, ChevronRight
} from "lucide-react";

import { getCourses } from "@/lib/api";

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

// Sidebar Item declared outside render
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
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={active ? "text-blue-600" : "text-slate-400"}>
          {icon}
        </div>
        <span>{label}</span>
      </div>
      {external && <ChevronDown className="w-4 h-4 text-slate-400" />}
    </div>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setNow(Date.now());
      try {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) setMeetings(JSON.parse(s));
      } catch {}
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
  }, []);

  const save = useCallback((list: Meeting[]) => {
    setMeetings(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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

  const rel = (iso: string) => {
    if (!now) return "Upcoming";
    try {
      const d = now - new Date(iso).getTime();
      if (d < 0) {
        const f = -d;
        if (f < 60000) return "Starts in <1m";
        if (f < 3600000) return `in ${Math.floor(f / 60000)}m`;
        if (f < 86400000) return `in ${Math.floor(f / 3600000)}h ${Math.floor((f % 3600000) / 60000)}m`;
        return `in ${Math.floor(f / 86400000)}d`;
      }
      if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
      if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
      return `${Math.floor(d / 86400000)}d ago`;
    } catch {
      return "Scheduled";
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
    save([m, ...meetings]);
    setShowCreate(false);
    setNewTitle("");
    setNewCourse("");
    setShowShare(m);
    showToast("Class meeting scheduled successfully!");
  };

  const startInstantMeeting = () => {
    const m: Meeting = {
      id: Date.now().toString().slice(-8),
      title: `Instant Meeting · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      courseId: null,
      password: genPwd(),
      scheduledAt: new Date().toISOString(),
      duration: 60,
      status: "live",
      attendees: 1,
      createdAt: new Date().toISOString(),
      notes: "",
    };
    save([m, ...meetings]);
    sessionStorage.setItem(`meeting_${m.id}`, JSON.stringify(m));
    router.push(`/meetings/room/${m.id}?role=mentor`);
  };

  const startClass = (m: Meeting) => {
    const updated = meetings.map(x => x.id === m.id ? { ...x, status: "live" as const } : x);
    save(updated);
    sessionStorage.setItem(`meeting_${m.id}`, JSON.stringify({ ...m, status: "live" }));
    router.push(`/meetings/room/${m.id}?role=mentor`);
  };

  const handleJoin = () => {
    if (!joinId.trim() || !joinPwd.trim() || !joinName.trim()) {
      showToast("Please fill in all fields.", false);
      return;
    }
    const m = meetings.find(x => x.id === joinId.trim());
    if (!m) {
      showToast("Meeting ID not found.", false);
      return;
    }
    if (m.password.toUpperCase() !== joinPwd.trim().toUpperCase()) {
      showToast("Invalid password.", false);
      return;
    }

    const startTime = new Date(m.scheduledAt).getTime();
    const isEarly = m.status !== "live" && startTime > Date.now();

    sessionStorage.setItem(`participant_name_${m.id}`, joinName.trim());
    setShowJoin(false);

    if (isEarly) {
      const diffMs = startTime - Date.now();
      const diffMins = Math.ceil(diffMs / 60000);
      showToast(`🔒 Meeting is scheduled for ${fmt(m.scheduledAt)} (Starts in ${diffMins}m). Joining waiting lobby...`);
    }

    router.push(`/meetings/room/${m.id}?role=participant&name=${encodeURIComponent(joinName.trim())}`);
  };

  const deleteMeeting = (id: string) => {
    if (confirm("Are you sure you want to delete this meeting?")) {
      save(meetings.filter(m => m.id !== id));
      showToast("Meeting deleted.");
    }
  };

  const upcoming = meetings.filter(m => m.status === "scheduled");
  const live = meetings.filter(m => m.status === "live");
  const past = meetings.filter(m => m.status === "ended");

  const filtered = (activeTab === "upcoming" ? upcoming : activeTab === "live" ? live : past).filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.title.toLowerCase().includes(q) || m.id.includes(q);
  });

  return (
    <div className="relative flex h-full w-full bg-[#F4F7FC] text-[#111827] font-sans overflow-hidden antialiased">
      
      {/* Sidebar - Crisp Modern Zoom Light Mode */}
      <aside className="w-[280px] flex-shrink-0 flex flex-col border-r border-slate-200/90 bg-white z-20 h-full shadow-[2px_0_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="h-16 flex items-center px-6 border-b border-slate-100 cursor-pointer group flex-shrink-0" onClick={() => router.push('/')}>
          <Image
            src="/ICONS/COMPANY_NAME-cropped.png"
            alt="RCRD."
            width={120}
            height={48}
            className="h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
          />
        </div>

        {/* User Workspace Profile */}
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between p-3 bg-slate-50/80 hover:bg-slate-100 rounded-2xl cursor-pointer transition-all border border-slate-200/60 group">
            <div>
              <div className="text-sm font-bold text-slate-800 group-hover:text-[#0E71EB] transition-colors truncate max-w-[170px]">
                RCRD Workspace
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] uppercase tracking-wider bg-blue-100 text-[#0E71EB] px-2 py-0.5 rounded-full font-bold border border-blue-200">
                  Meetings Hub
                </span>
                <span className="text-xs text-slate-500 font-medium">1 host</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>
          <button className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition-all shadow-sm">
            <Users className="w-3.5 h-3.5 text-[#0E71EB]" />
            Invite Members
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-5 px-3.5 space-y-6 custom-scrollbar min-h-0">
          <nav className="space-y-1.5">
            <SidebarItem icon={<Home size={17} />} label="For You" href="/" />
            <SidebarItem icon={<Folder size={17} />} label="Library" href="/library" />
            <SidebarItem icon={<Video size={17} />} label="Meetings" active href="/meetings" />
            <SidebarItem icon={<Bookmark size={17} />} label="Watch Later" href="/watch-later" />
            <SidebarItem icon={<Settings size={17} />} label="Settings" href="/settings" />
          </nav>

          <div>
            <h3 className="px-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">Workspace Admin</h3>
            <nav className="space-y-1.5">
              <SidebarItem icon={<Settings size={17} />} label="Manage Users" />
              <SidebarItem icon={<Building size={17} />} label="Workspace Info" />
              <SidebarItem icon={<Shield size={17} />} label="Billing & Plans" href="/settings?tab=billing" />
            </nav>
          </div>
        </div>

        {/* Start Instant Meeting Tile */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <button
            onClick={startInstantMeeting}
            className="w-full bg-[#0E71EB] hover:bg-[#0c63ce] text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(14,113,235,0.35)] hover:shadow-[0_6px_20px_rgba(14,113,235,0.45)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Radio size={16} className="animate-pulse text-white" />
            New Meeting
          </button>
        </div>
      </aside>

      {/* Main Meetings Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#F8FAFD] overflow-hidden">
        
        {/* Zoom-Style Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200/80 shrink-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex-shrink-0">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search meetings by topic, ID, or mentor..."
              className="w-full pl-10 pr-4 py-2 bg-[#F1F4F9] border border-transparent focus:border-[#0E71EB] focus:bg-white rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#0E71EB]/20 outline-none transition-all font-medium"
            />
          </div>

          <div className="flex items-center gap-3.5 ml-4 shrink-0">
            <button className="bg-[#0E71EB] hover:bg-[#0c63ce] text-white px-4 py-2 rounded-xl text-[13px] font-bold transition-all shadow-[0_2px_8px_rgba(14,113,235,0.25)] hover:shadow-[0_4px_14px_rgba(14,113,235,0.35)]">
              Upgrade Plan
            </button>
            <button className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-2 rounded-xl transition-colors">
              <HelpCircle size={19} />
            </button>
            <button className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-2 rounded-xl transition-colors relative">
              <Bell size={19} />
              <span className="w-2 h-2 bg-blue-600 rounded-full absolute top-2 right-2 ring-2 ring-white" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0E71EB] to-[#2D8CFF] text-white flex items-center justify-center text-[12px] font-extrabold ring-2 ring-blue-100 cursor-pointer shadow-sm">
              HR
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          <div className="max-w-[1200px] mx-auto pt-8 px-8 pb-24 space-y-8">
            
            {/* Top 4 Quick Action Tiles - Single Theme Color System */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Tile 1: New Instant Meeting */}
              <div
                onClick={startInstantMeeting}
                className="bg-gradient-to-br from-[#0E71EB] to-[#0052cc] text-white rounded-2xl p-5 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-[0_8px_20px_rgba(14,113,235,0.28)] hover:shadow-[0_12px_28px_rgba(14,113,235,0.4)] group relative overflow-hidden border border-[#0E71EB]"
              >
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-inner">
                  <Video size={24} className="text-white" />
                </div>
                <h3 className="text-base font-extrabold tracking-tight">New Meeting</h3>
                <p className="text-xs text-blue-100 mt-1 font-medium">Start instant room now</p>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play size={16} className="text-white/80 fill-white" />
                </div>
              </div>

              {/* Tile 2: Join Meeting */}
              <div
                onClick={() => setShowJoin(true)}
                className="bg-white hover:bg-blue-50/40 text-slate-900 rounded-2xl p-5 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-sm hover:shadow-[0_12px_24px_rgba(14,113,235,0.12)] border border-slate-200 hover:border-blue-300 group relative overflow-hidden"
              >
                <div className="w-12 h-12 bg-blue-50 text-[#0E71EB] border border-blue-100 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-sm">
                  <Plus size={24} className="text-[#0E71EB]" />
                </div>
                <h3 className="text-base font-extrabold tracking-tight group-hover:text-[#0E71EB] transition-colors">Join</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Via meeting ID & pin</p>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={18} className="text-[#0E71EB]" />
                </div>
              </div>

              {/* Tile 3: Schedule Meeting */}
              <div
                onClick={() => setShowCreate(true)}
                className="bg-white hover:bg-blue-50/40 text-slate-900 rounded-2xl p-5 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-sm hover:shadow-[0_12px_24px_rgba(14,113,235,0.12)] border border-slate-200 hover:border-blue-300 group relative overflow-hidden"
              >
                <div className="w-12 h-12 bg-blue-50 text-[#0E71EB] border border-blue-100 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-sm">
                  <Calendar size={24} className="text-[#0E71EB]" />
                </div>
                <h3 className="text-base font-extrabold tracking-tight group-hover:text-[#0E71EB] transition-colors">Schedule</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Plan for later date & time</p>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={18} className="text-[#0E71EB]" />
                </div>
              </div>

              {/* Tile 4: Share Screen / Library */}
              <div
                onClick={() => router.push('/library')}
                className="bg-white hover:bg-blue-50/40 text-slate-900 rounded-2xl p-5 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-sm hover:shadow-[0_12px_24px_rgba(14,113,235,0.12)] border border-slate-200 hover:border-blue-300 group relative overflow-hidden"
              >
                <div className="w-12 h-12 bg-blue-50 text-[#0E71EB] border border-blue-100 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-sm">
                  <Monitor size={24} className="text-[#0E71EB]" />
                </div>
                <h3 className="text-base font-extrabold tracking-tight group-hover:text-[#0E71EB] transition-colors">Recordings</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Auto-saved to Library</p>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Folder size={16} className="text-[#0E71EB]" />
                </div>
              </div>

            </div>

            {/* Live Session Alert Banner */}
            {live.length > 0 && (
              <div className="p-4 bg-[#0E71EB] rounded-2xl flex items-center justify-between gap-4 text-white shadow-[0_8px_20px_rgba(14,113,235,0.3)] animate-in fade-in slide-in-from-top-3 duration-300">
                <div className="flex items-center gap-3.5">
                  <div className="relative flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-full animate-ping absolute opacity-75" />
                    <div className="w-3.5 h-3.5 bg-white rounded-full relative" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/20  px-2 py-0.5 rounded-full border border-white/30">
                        Class In Progress
                      </span>
                      <p className="font-extrabold text-sm">{live[0].title}</p>
                    </div>
                    <p className="text-xs text-blue-100 mt-0.5">Recording & stream active · ID: {live[0].id}</p>
                  </div>
                </div>
                <button
                  onClick={() => startClass(live[0])}
                  className="px-5 py-2 bg-white hover:bg-slate-50 text-[#0E71EB] font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 transform hover:scale-105"
                >
                  <Play size={13} className="fill-[#0E71EB]" /> Rejoin Room
                </button>
              </div>
            )}

            {/* Navigation Tabs Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                {[
                  { id: "upcoming", label: "Upcoming", count: upcoming.length },
                  { id: "live", label: "Live", count: live.length },
                  { id: "past", label: "Past Recorded", count: past.length },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as "upcoming" | "live" | "past")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                      activeTab === tab.id
                        ? "bg-[#0E71EB] text-white shadow-md shadow-[#0E71EB]/20"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                        activeTab === tab.id
                          ? "bg-white text-[#0E71EB]"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-500 font-medium">
                {filtered.length} {filtered.length === 1 ? 'meeting' : 'meetings'}
              </div>
            </div>

            {/* Meetings Cards Grid / Empty State */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-3xl border-2 border-dashed border-slate-200 bg-white/70 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 text-[#0E71EB] shadow-sm">
                  <Calendar size={28} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  {activeTab === "upcoming"
                    ? "No upcoming meetings"
                    : activeTab === "live"
                    ? "No live meetings right now"
                    : "No recorded meetings yet"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mb-6 font-medium">
                  {activeTab === "upcoming"
                    ? "Schedule a meeting or start an instant classroom session to collaborate and record."
                    : activeTab === "live"
                    ? "Start any scheduled meeting to begin broadcasting live."
                    : "Completed class recordings with notes will show up here."}
                </p>
                {activeTab === "upcoming" && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={startInstantMeeting}
                      className="px-5 py-2.5 bg-[#0E71EB] hover:bg-[#0c63ce] text-white text-xs font-bold rounded-xl transition-all shadow-[0_4px_14px_rgba(14,113,235,0.3)] flex items-center gap-2 transform hover:-translate-y-0.5"
                    >
                      <Video size={15} /> Start Instant Meeting
                    </button>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 transform hover:-translate-y-0.5"
                    >
                      <Calendar size={15} /> Schedule for Later
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
                      className={`group relative rounded-xl p-4 bg-white border transition-all duration-200 flex flex-col justify-between hover:shadow-md ${
                        isLive
                          ? "border-[#0E71EB] shadow-sm ring-1 ring-[#0E71EB]/30 bg-blue-50/20"
                          : "border-slate-200/90 shadow-none hover:border-slate-300"
                      }`}
                    >
                      {/* Top Badges & Quick Delete */}
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isLive && (
                              <span className="flex items-center gap-1 text-[10px] font-extrabold text-[#0E71EB] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full animate-pulse">
                                <span className="w-1.5 h-1.5 bg-[#0E71EB] rounded-full" /> LIVE
                              </span>
                            )}
                            {isPast && (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                ENDED
                              </span>
                            )}
                            {!isLive && !isPast && (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                SCHEDULED
                              </span>
                            )}
                            {course && (
                              <span className="flex items-center gap-1 text-[10px] text-[#0E71EB] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-semibold truncate max-w-[130px]">
                                <Folder size={10} /> {course.name}
                              </span>
                            )}
                          </div>
                          
                          <button
                            onClick={() => deleteMeeting(m.id)}
                            className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors opacity-70 hover:opacity-100"
                            title="Delete meeting"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Title & Timing */}
                        <h3 className="text-sm font-bold text-slate-900 mb-1 group-hover:text-[#0E71EB] transition-colors truncate" title={m.title}>
                          {m.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-3 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock size={11} className="text-slate-400" />
                            {fmt(m.scheduledAt)} ({m.duration}m)
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-[#0E71EB] font-semibold">{rel(m.scheduledAt)}</span>
                          {m.attendees > 0 && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="flex items-center gap-0.5 text-slate-500">
                                <Users size={11} /> {m.attendees}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Compact Credentials Bar */}
                        <div className="rounded-lg border border-slate-100 bg-[#F8FAFC] px-3 py-2 mb-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400">ID:</span>
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{m.id}</span>
                            <button
                              onClick={() => copyText(m.id, `id-${m.id}`)}
                              className="text-slate-400 hover:text-[#0E71EB] transition-colors ml-0.5"
                              title="Copy ID"
                            >
                              {copied === `id-${m.id}` ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            </button>
                          </div>
                          <div className="h-3 w-px bg-slate-200" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Pass:</span>
                            <span className="font-mono font-bold text-[#0E71EB] text-[11px]">{pwdVis ? m.password : "••••••"}</span>
                            <button
                              onClick={() => setShowPwd(p => ({ ...p, [m.id]: !p[m.id] }))}
                              className="text-slate-400 hover:text-slate-700 transition-colors"
                            >
                              {pwdVis ? <EyeOff size={11} /> : <Eye size={11} />}
                            </button>
                            <button
                              onClick={() => copyText(m.password, `pwd-${m.id}`)}
                              className="text-slate-400 hover:text-[#0E71EB] transition-colors"
                              title="Copy Password"
                            >
                              {copied === `pwd-${m.id}` ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        {!isPast ? (
                          <button
                            onClick={() => startClass(m)}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg font-bold text-xs transition-all shadow-sm bg-[#0E71EB] hover:bg-[#0c63ce] text-white"
                          >
                            {isLive ? <><Play size={12} className="fill-white" /> Rejoin Room</> : <><Monitor size={12} /> Start</>}
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push(`/meetings/room/${m.id}?role=mentor&readonly=true`)}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            <FileText size={12} /> View Notes
                          </button>
                        )}
                        <button
                          onClick={() => setShowShare(m)}
                          className="h-8 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1 transition-colors"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] flex flex-col font-outfit overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Schedule Meeting</h2>
                <p className="text-[13px] text-slate-500 mt-1">Plan your upcoming session with advanced options.</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[75vh] space-y-7">
              
              {/* Topic & Folder Row */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-2">Topic</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="E.g., Full-Stack Web Development"
                    className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 focus:border-[#0E71EB] focus:ring-2 focus:ring-[#0E71EB]/20 rounded-xl text-[14px] outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-2">Save to Folder <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                  <select
                    value={newCourse}
                    onChange={e => setNewCourse(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 focus:border-[#0E71EB] focus:ring-2 focus:ring-[#0E71EB]/20 rounded-xl text-[14px] outline-none transition-all shadow-sm cursor-pointer"
                  >
                    <option value="">None (Root Library)</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Dynamic Presets */}
              <div>
                 <label className="block text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-3">Quick Presets</label>
                 <div className="flex gap-3">
                   <button 
                     onClick={() => {
                        const target = new Date(Date.now() + 15 * 60000);
                        setNewDate(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`);
                        let h = target.getHours(); const p = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
                        setSelectedHour(String(h).padStart(2, '0'));
                        setSelectedMinute(String(Math.floor(target.getMinutes() / 15) * 15).padStart(2, '0'));
                        setSelectedPeriod(p);
                     }}
                     className="px-4 py-2 bg-[#0E71EB]/10 text-[#0E71EB] hover:bg-[#0E71EB]/20 text-[13px] font-bold rounded-lg transition-colors border border-[#0E71EB]/20"
                   >
                     In 15 mins
                   </button>
                   <button 
                     onClick={() => {
                        const target = new Date(Date.now() + 60 * 60000);
                        setNewDate(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`);
                        let h = target.getHours(); const p = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
                        setSelectedHour(String(h).padStart(2, '0'));
                        setSelectedMinute("00");
                        setSelectedPeriod(p);
                     }}
                     className="px-4 py-2 bg-[#0E71EB]/10 text-[#0E71EB] hover:bg-[#0E71EB]/20 text-[13px] font-bold rounded-lg transition-colors border border-[#0E71EB]/20"
                   >
                     In 1 hour
                   </button>
                   <button 
                     onClick={() => {
                        const target = new Date(); target.setDate(target.getDate() + 1); target.setHours(10, 0, 0, 0);
                        setNewDate(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`);
                        setSelectedHour("10"); setSelectedMinute("00"); setSelectedPeriod("AM");
                     }}
                     className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[13px] font-bold rounded-lg transition-colors"
                   >
                     Tomorrow 10 AM
                   </button>
                 </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-2">Start Time</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="px-3 py-3 border border-slate-200 hover:border-slate-300 rounded-xl text-[14px] flex-1 focus:border-[#0E71EB] focus:ring-2 focus:ring-[#0E71EB]/20 outline-none shadow-sm transition-all bg-white"
                    />
                    <select
                      value={selectedHour}
                      onChange={e => setSelectedHour(e.target.value)}
                      className="px-3 py-3 border border-slate-200 hover:border-slate-300 rounded-xl text-[14px] bg-white focus:border-[#0E71EB] outline-none shadow-sm transition-all"
                    >
                      {["01","02","03","04","05","06","07","08","09","10","11","12"].map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-slate-400 font-bold">:</span>
                    <select
                      value={selectedMinute}
                      onChange={e => setSelectedMinute(e.target.value)}
                      className="px-3 py-3 border border-slate-200 hover:border-slate-300 rounded-xl text-[14px] bg-white focus:border-[#0E71EB] outline-none shadow-sm transition-all"
                    >
                      {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={selectedPeriod}
                      onChange={e => setSelectedPeriod(e.target.value as "AM" | "PM")}
                      className="px-3 py-3 border border-slate-200 hover:border-slate-300 rounded-xl text-[14px] bg-white focus:border-[#0E71EB] outline-none shadow-sm transition-all font-semibold text-slate-700"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-2">Duration</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={newDuration >= 60 ? Math.floor(newDuration / 60) : 0}
                      onChange={e => {
                        const hrs = parseInt(e.target.value);
                        const mins = newDuration % 60;
                        setNewDuration(hrs * 60 + mins);
                      }}
                      className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 rounded-xl text-[14px] bg-white focus:border-[#0E71EB] outline-none shadow-sm transition-all"
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
                      className="w-full px-4 py-3 border border-slate-200 hover:border-slate-300 rounded-xl text-[14px] bg-white focus:border-[#0E71EB] outline-none shadow-sm transition-all"
                    >
                      {[0,15,30,45].map(m => (
                        <option key={m} value={m}>{m} min</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Security */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-3">Meeting Security</label>
                <div className="flex gap-8">
                  <label className="flex items-center gap-3 cursor-not-allowed opacity-80">
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-[#0E71EB] border border-[#0E71EB]">
                       <Check size={14} className="text-white" />
                    </div>
                    <div>
                      <span className="text-[14px] font-semibold text-slate-800 block">Passcode</span>
                      <span className="text-[12px] text-slate-500">Auto-generated</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-not-allowed opacity-80">
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-[#0E71EB] border border-[#0E71EB]">
                       <Check size={14} className="text-white" />
                    </div>
                    <div>
                      <span className="text-[14px] font-semibold text-slate-800 block">Waiting Room</span>
                      <span className="text-[12px] text-slate-500">Strict access enabled</span>
                    </div>
                  </label>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setShowCreate(false)}
                className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-8 py-2.5 bg-[#0E71EB] text-white text-sm font-bold rounded-xl hover:bg-[#1655B8] transition-colors shadow-md shadow-[#0E71EB]/20 flex items-center gap-2"
              >
                Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOIN MEETING MODAL */}
      {showJoin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[440px] overflow-hidden font-outfit">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Join a Meeting</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter meeting ID or personal link name.</p>
              </div>
              <button
                onClick={() => setShowJoin(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                  Your Screen Name *
                </label>
                <input
                  type="text"
                  value={joinName}
                  onChange={e => setJoinName(e.target.value)}
                  placeholder="e.g. Hari Kishore"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0E71EB]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                  Meeting ID *
                </label>
                <input
                  type="text"
                  value={joinId}
                  onChange={e => setJoinId(e.target.value)}
                  placeholder="Enter 8-digit Meeting ID"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0E71EB]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5">
                  Passcode *
                </label>
                <div className="relative">
                  <input
                    type={showPwd["join"] ? "text" : "password"}
                    value={joinPwd}
                    onChange={e => setJoinPwd(e.target.value)}
                    placeholder="8-character passcode"
                    className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-widest text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0E71EB]"
                  />
                  <button
                    onClick={() => setShowPwd(p => ({ ...p, join: !p.join }))}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd["join"] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowJoin(false)}
                className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={!joinId.trim() || !joinPwd.trim() || !joinName.trim()}
                className="flex-1 py-2.5 bg-[#0E71EB] hover:bg-[#0c63ce] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl shadow-[0_4px_14px_rgba(14,113,235,0.3)] flex items-center justify-center gap-2 transition-all"
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
        const joinUrl = `${origin}/meetings`;
        const msgText = `🎓 *${showShare.title}*\n\n📋 *Meeting ID:* ${showShare.id}\n🔑 *Passcode:* ${showShare.password}\n⏰ *Time:* ${fmt(showShare.scheduledAt)} · ${showShare.duration} min\n\n👉 Join: ${joinUrl}\n(Enter Meeting ID & Passcode)`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(msgText)}`;
        const emailSubject = encodeURIComponent(`Zoom Meeting Invite: ${showShare.title}`);
        const emailBody = encodeURIComponent(`Hello,\n\nYou are invited to join the meeting session:\n\nTitle: ${showShare.title}\nMeeting ID: ${showShare.id}\nPasscode: ${showShare.password}\nTime: ${fmt(showShare.scheduledAt)} (${showShare.duration} min)\n\nJoin at: ${joinUrl}\n\nSee you there!`);
        const allText = `🎓 ${showShare.title}\nMeeting ID: ${showShare.id}\nPasscode: ${showShare.password}\nTime: ${fmt(showShare.scheduledAt)} · ${showShare.duration} min\nJoin: ${joinUrl}`;
        const courseName = courses.find(c => c.id === showShare.courseId)?.name;

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-[480px] overflow-hidden font-outfit">
              
              <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0E71EB] rounded-2xl flex items-center justify-center shadow-md">
                    <Share2 size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Share Meeting Invitation</h2>
                    <p className="text-xs text-slate-500">Copy credentials or share directly with attendees</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShare(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Credentials Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3.5">
                  <p className="text-slate-900 font-extrabold text-base truncate">{showShare.title}</p>
                  <div className="h-px bg-slate-200" />

                  {/* ID */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Meeting ID</p>
                      <p className="text-sm font-mono font-bold text-[#0E71EB] tracking-wider">{showShare.id}</p>
                    </div>
                    <button
                      onClick={() => copyText(showShare.id, `cid-${showShare.id}`)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      {copied === `cid-${showShare.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      {copied === `cid-${showShare.id}` ? "Copied" : "Copy ID"}
                    </button>
                  </div>

                  {/* Passcode */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Passcode</p>
                      <p className="text-2xl font-mono font-black text-amber-600 tracking-[0.2em]">{showShare.password}</p>
                    </div>
                    <button
                      onClick={() => copyText(showShare.password, `cpwd-${showShare.id}`)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      {copied === `cpwd-${showShare.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      {copied === `cpwd-${showShare.id}` ? "Copied" : "Copy Passcode"}
                    </button>
                  </div>

                  <div className="h-px bg-slate-200" />

                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>{fmt(showShare.scheduledAt)}</span>
                    {courseName && <span className="text-emerald-600 font-bold flex items-center gap-1"><Folder size={11} /> {courseName}</span>}
                  </div>
                </div>

                {/* Share Actions */}
                <div className="space-y-2 pt-1">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_2px_8px_rgba(37,211,102,0.3)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12.05 1.667C6.277 1.667 1.59 6.357 1.59 12.13c0 1.87.492 3.628 1.35 5.147L1.5 22.5l5.38-1.413a10.432 10.432 0 004.166.868c5.774 0 10.462-4.69 10.462-10.462 0-5.774-4.688-10.462-10.458-10.462zm0 19.14a8.676 8.676 0 01-4.422-1.212l-.318-.188-3.292.864.878-3.21-.207-.33a8.636 8.636 0 01-1.325-4.6c0-4.787 3.894-8.682 8.682-8.682 4.787 0 8.682 3.895 8.682 8.682 0 4.788-3.895 8.676-8.678 8.676z"/>
                    </svg>
                    Share via WhatsApp
                  </a>

                  <button
                    onClick={() => copyText(allText, "share-all")}
                    className="w-full py-2.5 bg-[#0E71EB] hover:bg-[#0c63ce] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_2px_8px_rgba(14,113,235,0.25)]"
                  >
                    {copied === "share-all" ? <><Check size={14} className="text-white" /> Copied All Details!</> : <><Copy size={14} /> Copy Full Invitation</>}
                  </button>

                  <a
                    href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Mail size={13} /> Email Invitation
                  </a>
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
            : "bg-red-600 text-white border-red-500"
        }`}>
          {toast.ok ? <CheckCircle2 size={16} className="text-emerald-400" /> : <X size={16} className="text-white" />}
          <span className="text-xs font-bold">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="p-0.5 hover:bg-white/20 rounded-md ml-1">
            <X size={14} />
          </button>
        </div>
      )}

    </div>
  );
}
