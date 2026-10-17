"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarLucide,
  Clock, ExternalLink, Plus, Copy, Check,
  CheckCircle2, Sparkles, Folder, Play, Info,
  CalendarDays, ListFilter, X
} from "lucide-react";
import {
  HomeIcon, LibraryIcon, VideoCameraIcon, SettingsIcon,
  UserIcon, WorkspaceIcon, CalendarIcon
} from "@/components/CustomIcons";
import { getCourses } from "@/lib/api";
import RcrdLogo from "@/components/RcrdLogo";
import ProfileFlyout, { getStoredProfile, UserProfileData } from "@/components/ProfileFlyout";
import AppHeader from "@/components/AppHeader";

interface Course {
  id: string;
  name: string;
}

interface Meeting {
  id: string;
  title: string;
  courseId: string | null;
  password: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "live" | "ended";
  attendees: number;
  createdAt: string;
  notes: string;
}

const STORAGE_KEY = "rcrd_meetings";

// Opal Google Calendar templates provided by the user
const OPAL_TEMPLATE_NEW_MEETING =
  "https://www.google.com/calendar/render?action=TEMPLATE&text=New+Meeting&dates=20261016T160000Z%2F20261016T170000Z&details=Event+extracted+from+screenshot.+(Opal-generated+template:+Note+that+rich+text+and+hyperlinks+are+not+supported+in+this+field+via+URL).&location=TBD";

const OPAL_TEMPLATE_GEONIXA =
  "https://www.google.com/calendar/render?action=TEMPLATE&text=Geonixa&dates=20261016T160000/20261016T170000&details=(Opal-generated+template)";

// Helper: generate Google Calendar URL dynamically for any meeting
function makeGoogleCalendarUrl(m: Meeting, courseName?: string) {
  try {
    const startDate = new Date(m.scheduledAt);
    const durationMins = m.duration || 60;
    const endDate = new Date(startDate.getTime() + durationMins * 60000);

    const pad = (n: number) => String(n).padStart(2, "0");
    const toGCal = (d: Date) =>
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";
    const roomUrl = `${origin}/meetings/room/${m.id}?role=participant`;

    const details = [
      `Class Meeting: ${m.title}`,
      courseName ? `Folder / Course: ${courseName}` : "",
      `Meeting ID: ${m.id}`,
      `Password: ${m.password}`,
      `Join Live Classroom: ${roomUrl}`,
      m.notes ? `\nNotes:\n${m.notes}` : "",
      `\n(Opal Google Calendar integration)`
    ]
      .filter(Boolean)
      .join("\n");

    const url = new URL("https://www.google.com/calendar/render");
    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", m.title || "Class Meeting");
    url.searchParams.set("dates", `${toGCal(startDate)}/${toGCal(endDate)}`);
    url.searchParams.set("details", details);
    url.searchParams.set("location", roomUrl);

    return url.toString();
  } catch {
    return OPAL_TEMPLATE_NEW_MEETING;
  }
}

// Sidebar item
function SidebarItem({
  icon,
  label,
  active = false,
  href
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  href?: string;
}) {
  const router = useRouter();
  return (
    <div
      onClick={() => href && router.push(href)}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all ${
        active
          ? "bg-[#E6F6EC] text-[#0CAA41] shadow-xs font-bold border border-[#0CAA41]/20"
          : "text-[#57636E] hover:bg-[#F5F6F8] hover:text-[#20262E] font-medium"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={active ? "text-[#0CAA41]" : "text-[#57636E]"}>
          {icon}
        </div>
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2026, 9, 1)); // October 2026
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "agenda" | "gcal">("calendar");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load meetings & courses
  useEffect(() => {
    // Fetch from backend API
    fetch("/api/meetings")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Meeting[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setMeetings(data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } else {
          // If no meetings exist yet, seed initial class meeting so calendar is rich
          const seedMeetings: Meeting[] = [
            {
              id: "GEO-CLASS-101",
              title: "Geonixa Web & AI Engineering Live Class",
              courseId: "MEETING",
              password: "GEO" + Math.floor(1000 + Math.random() * 9000),
              scheduledAt: "2026-10-16T16:00:00.000Z",
              duration: 60,
              status: "scheduled",
              attendees: 12,
              createdAt: new Date().toISOString(),
              notes: "Full-stack development, Next.js, and AI agent integration session."
            },
            {
              id: "RCRD-MEET-202",
              title: "RCRD Interactive Screen & Recording Workshop",
              courseId: "PROJECT",
              password: "RC" + Math.floor(1000 + Math.random() * 9000),
              scheduledAt: "2026-10-18T10:30:00.000Z",
              duration: 90,
              status: "scheduled",
              attendees: 8,
              createdAt: new Date().toISOString(),
              notes: "Async video messaging best practices and camera capture tricks."
            },
            {
              id: "REV-QA-303",
              title: "Weekly Code Review & Mentorship Session",
              courseId: "MEETING",
              password: "REV" + Math.floor(1000 + Math.random() * 9000),
              scheduledAt: "2026-10-21T14:00:00.000Z",
              duration: 60,
              status: "scheduled",
              attendees: 15,
              createdAt: new Date().toISOString(),
              notes: "Review student pull requests and answer live architectural questions."
            }
          ];
          setMeetings(seedMeetings);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seedMeetings));
        }
      })
      .catch(() => {});

    getCourses().then(setCourses).catch(() => {});
  }, []);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast("Copied to clipboard!");
  };

  // Calendar calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(year, month, 1).getDay(); // 0 = Sun
  }, [year, month]);

  const monthName = currentMonth.toLocaleString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    const pad = (n: number) => String(n).padStart(2, "0");
    setSelectedDateStr(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  };

  // Helper map meetings by YYYY-MM-DD
  const meetingsByDate = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    meetings.forEach((m) => {
      try {
        const d = new Date(m.scheduledAt);
        const pad = (n: number) => String(n).padStart(2, "0");
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const existing = map.get(key) || [];
        existing.push(m);
        map.set(key, existing);
      } catch {}
    });
    return map;
  }, [meetings]);

  // Filtered meetings
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.notes && m.notes.toLowerCase().includes(q));

      if (!matchQuery) return false;

      if (selectedDateStr) {
        try {
          const d = new Date(m.scheduledAt);
          const pad = (n: number) => String(n).padStart(2, "0");
          const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          return key === selectedDateStr;
        } catch {
          return false;
        }
      }

      return true;
    });
  }, [meetings, searchQuery, selectedDateStr]);

  const getCourseName = (cid: string | null) => {
    if (!cid) return "General Classroom";
    const found = courses.find((c) => c.id === cid);
    return found ? found.name : cid;
  };

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#FFFFFF] text-[#20262E] font-sans overflow-hidden antialiased">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR - with Mobile Drawer Support */}
      <aside className={`w-[280px] flex-shrink-0 flex-col border-r border-[#E2E7EC] bg-white h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden transition-all duration-300 ${
        isMobileMenuOpen 
          ? "fixed inset-y-0 left-0 flex z-50 shadow-2xl" 
          : "hidden md:flex z-20"
      }`}>
        {/* Brand Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#E2E7EC] flex-shrink-0">
          <div
            className="flex items-center justify-start cursor-pointer group"
            onClick={() => { router.push("/"); setIsMobileMenuOpen(false); }}
          >
            <RcrdLogo className="h-8 w-auto transition-transform group-hover:scale-105" />
          </div>
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-[#57636E] hover:text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Card */}
        <div className="p-5 border-b border-[#E2E7EC] flex-shrink-0">
          <div className="flex items-center justify-between p-3 bg-[#F5F6F8] hover:bg-slate-100 rounded-xl cursor-pointer transition-all border border-[#E2E7EC] hover:border-[#E2E7EC] group">
            <div>
              <div className="text-sm font-semibold text-[#20262E] group-hover:text-[#0CAA41] transition-colors">
                RCRD Workspace
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] uppercase tracking-wider bg-[#E6F6EC] px-2 py-0.5 rounded text-[#0CAA41] font-bold border border-[#0CAA41]/20">
                  Pro Plan
                </span>
                <span className="text-xs text-[#57636E]">Team Space</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => { router.push("/settings?tab=users"); setIsMobileMenuOpen(false); }}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-xs font-bold text-[#20262E] hover:text-[#20262E] transition-all shadow-xs cursor-pointer"
          >
            <UserIcon size={16} className="text-[#0CAA41]" />
            Invite Teammates
          </button>
        </div>

        {/* Navigation - Watch Later is replaced with Calendar */}
        <div className="flex-1 overflow-y-auto py-5 px-4 space-y-6 custom-scrollbar min-h-0">
          <nav className="space-y-1">
            <SidebarItem icon={<HomeIcon size={18} />} label="For You" href="/" />
            <SidebarItem icon={<LibraryIcon size={18} />} label="Library" href="/library" />
            <SidebarItem icon={<VideoCameraIcon size={18} />} label="Meetings" href="/meetings" />
            <SidebarItem icon={<CalendarIcon size={18} />} label="Calendar" active href="/calendar" />
            <SidebarItem icon={<SettingsIcon size={18} />} label="Settings" href="/settings" />
          </nav>

          <div>
            <h3 className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#57636E] mb-2">
              Workspace Admin
            </h3>
            <nav className="space-y-1">
              <SidebarItem icon={<UserIcon size={18} />} label="Manage Users" href="/settings?tab=users" />
              <SidebarItem icon={<WorkspaceIcon size={18} />} label="Workspace Info" href="/settings" />
              <SidebarItem icon={<WorkspaceIcon size={18} />} label="Billing & Plans" href="/settings?tab=billing" />
            </nav>
          </div>
        </div>

        {/* Bottom Record Video button */}
        <div className="p-5 border-t border-[#E2E7EC] bg-[#F5F6F8]/50 flex-shrink-0">
          <button
            onClick={() => { router.push("/meetings?schedule=true"); setIsMobileMenuOpen(false); }}
            className="w-full bg-[#0CAA41] hover:bg-[#0C5325] text-white py-3.5 px-6 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2.5 shadow-[0_10px_25px_-5px_rgba(12, 170, 65,0.45)] hover:shadow-[0_14px_28px_-5px_rgba(12, 170, 65,0.55)] transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <CalendarLucide size={18} className="text-white" />
            <span>Schedule Class</span>
          </button>
        </div>
      </aside>

      {/* MAIN CALENDAR CONTENT */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-white overflow-hidden">
        {/* Top Header - Unified Fixed h-16, Centered Search, Image 5 Avatar */}
        <AppHeader 
          placeholder="Search class meetings by topic, ID, or notes..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenProfile={() => setIsProfileOpen(true)}
          onToggleMobileSidebar={() => setIsMobileMenuOpen(prev => !prev)}
        />

        {/* CALENDAR BODY */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
          {/* Hero Banner: Class Meeting Calendar & Google Calendar Integration */}
          <div className="bg-gradient-to-r from-white via-[#E6F6EC] to-white border-2 border-[#0CAA41]/20 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#E6F6EC] border border-[#0CAA41]/30 rounded-full text-xs font-bold text-[#0CAA41]">
                <CalendarDays size={14} />
                <span>Class Meetings Google Calendar</span>
              </div>
              <h1 className="text-3xl font-extrabold text-[#20262E] tracking-tight">
                Class Meeting Calendar
              </h1>
              <p className="text-[#57636E] text-sm leading-relaxed">
                Seamlessly schedule and sync all your student class sessions with <strong>Google Calendar</strong>. Every class meeting includes 1-click Google Calendar sync, room links, and meeting credentials.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push("/meetings?schedule=true")}
                className="bg-[#0CAA41] hover:bg-[#0C5325] text-white px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all hover:scale-102 cursor-pointer"
              >
                <Plus size={16} /> Schedule Class Meeting
              </button>

              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noreferrer"
                className="bg-white hover:bg-[#E6F6EC] text-[#0CAA41] border-2 border-[#0CAA41] px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <CalendarLucide size={16} /> Open Google Calendar <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* OPAL GOOGLE CALENDAR TEMPLATES & FREE STATUS CARD */}
          <div className="bg-white border border-[#E2E7EC] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E7EC] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E6F6EC] text-[#0CAA41] flex items-center justify-center shrink-0 border border-[#0CAA41]/20">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#20262E]">Google Calendar Opal Templates</h3>
                    <span className="bg-[#E6F6EC] text-emerald-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-[#72BAA9]/40">
                      ✓ 100% Free
                    </span>
                  </div>
                  <p className="text-xs text-[#57636E] mt-0.5">
                    Launch pre-formatted Opal meeting templates or add any class directly to Google Calendar.
                  </p>
                </div>
              </div>

              {/* Free explanation badge */}
              <div className="text-xs bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl p-3 text-[#57636E] max-w-sm">
                <div className="font-bold text-[#20262E] flex items-center gap-1.5 mb-0.5">
                  <Info size={14} className="text-[#0CAA41]" /> Is Opal Google Calendar free?
                </div>
                <span>
                  <strong>Yes, it is 100% free!</strong> Google Calendar template URLs (Opal) require no billing, API subscriptions, or fees. You and your students can use them completely free.
                </span>
              </div>
            </div>

            {/* Provided Template Quick Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="text-xs font-bold text-[#57636E] uppercase tracking-wider">Quick Templates:</span>

              {/* Template 1: Geonixa Class Meeting */}
              <a
                href={OPAL_TEMPLATE_GEONIXA}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#E6F6EC] text-[#0CAA41] border border-[#0CAA41] rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <CalendarLucide size={14} />
                <span>Geonixa Class Session (Google Calendar)</span>
                <ExternalLink size={12} />
              </a>

              {/* Template 2: New Meeting Template */}
              <a
                href={OPAL_TEMPLATE_NEW_MEETING}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#F5F6F8] text-[#20262E] border border-[#E2E7EC] rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <CalendarLucide size={14} />
                <span>New Meeting (Opal Template)</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* VIEW SWITCHER & CONTROLS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E2E7EC] rounded-2xl p-4 shadow-xs">
            {/* View Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-[#0CAA41] text-white shadow-xs"
                    : "text-[#57636E] hover:text-[#20262E]"
                }`}
              >
                <CalendarDays size={14} />
                <span>Month Calendar</span>
              </button>
              <button
                onClick={() => setViewMode("agenda")}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  viewMode === "agenda"
                    ? "bg-[#0CAA41] text-white shadow-xs"
                    : "text-[#57636E] hover:text-[#20262E]"
                }`}
              >
                <ListFilter size={14} />
                <span>Meeting Agenda ({meetings.length})</span>
              </button>
              <button
                onClick={() => setViewMode("gcal")}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  viewMode === "gcal"
                    ? "bg-[#0CAA41] text-white shadow-xs"
                    : "text-[#57636E] hover:text-[#20262E]"
                }`}
              >
                <ExternalLink size={14} />
                <span>Google Calendar View</span>
              </button>
            </div>

            {/* Month Navigation */}
            {viewMode === "calendar" && (
              <div className="flex items-center gap-3">
                <button
                  onClick={jumpToToday}
                  className="px-3 py-1.5 bg-[#F5F6F8] hover:bg-slate-100 text-[#20262E] text-xs font-bold rounded-lg border border-[#E2E7EC] transition-colors cursor-pointer"
                >
                  Today
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-[#57636E] transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm font-bold text-[#20262E] min-w-[140px] text-center">
                    {monthName}
                  </span>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-[#57636E] transition-colors cursor-pointer"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* VIEW MODE 1: MONTH CALENDAR GRID */}
          {viewMode === "calendar" && (
            <div className="bg-white border border-[#E2E7EC] rounded-2xl overflow-hidden shadow-xs">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-[#E2E7EC] bg-[#F5F6F8]/70 text-center text-xs font-bold text-[#57636E] py-3">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
                {/* Empty prefix cells */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[110px] bg-[#F5F6F8]/40 p-2 opacity-30" />
                ))}

                {/* Days of current month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const pad = (n: number) => String(n).padStart(2, "0");
                  const dateKey = `${year}-${pad(month + 1)}-${pad(dayNum)}`;
                  const dayMeetings = meetingsByDate.get(dateKey) || [];
                  const isSelected = selectedDateStr === dateKey;

                  const isToday =
                    new Date().getDate() === dayNum &&
                    new Date().getMonth() === month &&
                    new Date().getFullYear() === year;

                  return (
                    <div
                      key={dateKey}
                      onClick={() =>
                        setSelectedDateStr(isSelected ? null : dateKey)
                      }
                      className={`min-h-[115px] p-2 transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-[#E6F6EC] ring-2 ring-[#0CAA41] z-10"
                          : isToday
                          ? "bg-[#F5F6F8]/70 hover:bg-slate-100/70"
                          : "hover:bg-[#F5F6F8]/70"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday
                              ? "bg-[#0CAA41] text-white shadow-xs"
                              : isSelected
                              ? "text-[#0CAA41] font-black"
                              : "text-[#20262E]"
                          }`}
                        >
                          {dayNum}
                        </span>

                        {dayMeetings.length > 0 && (
                          <span className="text-[10px] bg-[#E6F6EC] text-[#0CAA41] font-bold px-1.5 py-0.5 rounded-full border border-[#0CAA41]/20">
                            {dayMeetings.length} class{dayMeetings.length > 1 ? "es" : ""}
                          </span>
                        )}
                      </div>

                      {/* Meeting Chips */}
                      <div className="space-y-1 mt-1.5 flex-1">
                        {dayMeetings.slice(0, 2).map((m) => (
                          <div
                            key={m.id}
                            className="text-[11px] font-semibold bg-[#0CAA41] text-white px-2 py-1 rounded-md truncate shadow-xs flex items-center gap-1"
                            title={`${m.title} (${fmtTime(m.scheduledAt)})`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                            <span className="truncate">{m.title}</span>
                          </div>
                        ))}
                        {dayMeetings.length > 2 && (
                          <div className="text-[10px] text-[#57636E] font-bold px-1">
                            +{dayMeetings.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW MODE 2: GCAL EMBED / LAUNCHER VIEW */}
          {viewMode === "gcal" && (
            <div className="bg-white border border-[#E2E7EC] rounded-2xl p-8 shadow-xs text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-[#E6F6EC] border-2 border-[#0CAA41] flex items-center justify-center mx-auto text-[#0CAA41] shadow-md">
                <CalendarDays size={32} />
              </div>
              <div className="max-w-xl mx-auto space-y-2">
                <h2 className="text-2xl font-extrabold text-[#20262E]">
                  Google Calendar Classroom Sync
                </h2>
                <p className="text-sm text-[#57636E] leading-relaxed">
                  Open your connected Google Calendar in a new tab to see all your synced class meetings, exam schedules, and notifications in real-time.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-[#0CAA41] hover:bg-[#0C5325] text-white px-7 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all hover:scale-105 cursor-pointer"
                >
                  <CalendarLucide size={18} /> Launch Google Calendar <ExternalLink size={14} />
                </a>

                <a
                  href={OPAL_TEMPLATE_GEONIXA}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white hover:bg-[#E6F6EC] text-[#0CAA41] border-2 border-[#0CAA41] px-7 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <span>Geonixa Opal Template</span> <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

          {/* DETAILED CLASS MEETINGS LIST (AGENDA OR FILTERED BY DATE) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#20262E]">
                  {selectedDateStr ? `Class Meetings on ${selectedDateStr}` : "All Class Meetings"}
                </h2>
                <p className="text-xs text-[#57636E] mt-0.5">
                  {filteredMeetings.length} scheduled class meeting{filteredMeetings.length === 1 ? "" : "s"} found.
                </p>
              </div>

              {selectedDateStr && (
                <button
                  onClick={() => setSelectedDateStr(null)}
                  className="text-xs font-bold text-[#0CAA41] hover:underline cursor-pointer"
                >
                  Show all dates
                </button>
              )}
            </div>

            {filteredMeetings.length === 0 ? (
              <div className="bg-white border border-[#E2E7EC] rounded-2xl p-12 text-center space-y-3">
                <CalendarLucide size={36} className="text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-[#20262E]">No Class Meetings Found</h3>
                <p className="text-xs text-[#57636E] max-w-sm mx-auto">
                  There are no scheduled class meetings matching this date or search. Schedule a new class meeting or add from Google Calendar templates!
                </p>
                <button
                  onClick={() => router.push("/meetings?schedule=true")}
                  className="bg-[#0CAA41] hover:bg-[#0C5325] text-white px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                >
                  <Plus size={14} /> Schedule Class Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredMeetings.map((m) => {
                  const courseName = getCourseName(m.courseId);
                  const gcalUrl = makeGoogleCalendarUrl(m, courseName);
                  const isLive = m.status === "live";

                  return (
                    <div
                      key={m.id}
                      className="bg-white border-2 border-[#E2E7EC] hover:border-[#0CAA41]/40 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                    >
                      {/* Top Row: Title, Course Badge, Status */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-extrabold text-[#20262E] group-hover:text-[#0CAA41] transition-colors leading-tight">
                            {m.title}
                          </h3>
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${
                              isLive
                                ? "bg-[#E6F6EC]/40 text-[#0C5325] border-[#72BAA9]/40 animate-pulse"
                                : "bg-[#E6F6EC] text-[#0CAA41] border-[#0CAA41]/30"
                            }`}
                          >
                            {isLive ? "● LIVE NOW" : "SCHEDULED"}
                          </span>
                        </div>

                        {/* Folder / Course */}
                        <div className="flex items-center gap-2 text-xs text-[#57636E] font-semibold">
                          <Folder size={13} className="text-[#0CAA41]" />
                          <span>{courseName}</span>
                        </div>
                      </div>

                      {/* Middle Details: Date, Time, ID & Password */}
                      <div className="bg-[#F5F6F8] rounded-xl p-3 border border-[#E2E7EC] space-y-2 text-xs">
                        <div className="flex items-center justify-between text-[#20262E]">
                          <div className="flex items-center gap-1.5 font-bold">
                            <CalendarLucide size={14} className="text-[#0CAA41]" />
                            <span>{fmtDate(m.scheduledAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-semibold text-[#57636E]">
                            <Clock size={13} className="text-[#57636E]" />
                            <span>
                              {fmtTime(m.scheduledAt)} ({m.duration || 60}m)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#E2E7EC]/60 font-mono text-[11px] text-[#57636E]">
                          <div>
                            ID: <span className="font-bold text-[#20262E]">{m.id}</span>
                          </div>
                          <div>
                            Pass: <span className="font-bold text-[#20262E]">{m.password}</span>
                          </div>
                        </div>

                        {m.notes && (
                          <div className="text-[11px] text-[#57636E] line-clamp-1 italic pt-0.5">
                            &quot;{m.notes}&quot;
                          </div>
                        )}
                      </div>

                      {/* Bottom Actions: 1-Click Add to Google Calendar & Join */}
                      <div className="flex items-center gap-2 pt-1">
                        {/* 1-Click Add to Google Calendar button */}
                        <a
                          href={gcalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2.5 px-3 bg-[#E6F6EC] hover:bg-[#E6F6EC] text-[#0CAA41] border border-[#0CAA41]/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          title="Add this meeting directly to your Google Calendar"
                        >
                          <CalendarLucide size={14} />
                          <span>Add to Google Calendar</span>
                          <ExternalLink size={11} />
                        </a>

                        {/* Join / Start Room Button */}
                        <button
                          onClick={() => router.push(`/meetings/room/${m.id}?role=mentor`)}
                          className="py-2.5 px-4 bg-[#0CAA41] hover:bg-[#0C5325] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <Play size={13} className="fill-white" />
                          <span>Start Room</span>
                        </button>

                        {/* Copy Link Button */}
                        <button
                          onClick={() => {
                            const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";
                            copyText(
                              `Class Meeting: ${m.title}\nDate: ${fmtDate(m.scheduledAt)} at ${fmtTime(m.scheduledAt)}\nID: ${m.id} | Pass: ${m.password}\nLink: ${origin}/meetings/room/${m.id}?role=participant`,
                              m.id
                            );
                          }}
                          className="p-2.5 bg-white hover:bg-slate-100 text-[#57636E] border border-[#E2E7EC] rounded-xl transition-colors cursor-pointer"
                          title="Copy meeting invitation details"
                        >
                          {copiedKey === m.id ? (
                            <Check size={14} className="text-[#72BAA9]" />
                          ) : (
                            <Copy size={14} />
                          )}
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

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-[200] border animate-in slide-in-from-bottom-5 duration-200 ${
            toast.ok
              ? "bg-slate-900 text-white border-slate-800"
              : "bg-[#0CAA41] text-white border-[#0CAA41]"
          }`}
        >
          {toast.ok ? (
            <CheckCircle2 size={16} className="text-[#E6F6EC]" />
          ) : (
            <Info size={16} className="text-white" />
          )}
          <span className="text-xs font-bold">{toast.msg}</span>
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
