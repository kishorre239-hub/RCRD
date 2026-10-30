"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import RcrdLogo from "@/components/RcrdLogo";
import {
  Calendar, Clock, Lock, User, Video,
  CheckCircle2, AlertCircle, Eye, EyeOff, Copy,
  Check, ArrowRight, Shield,
  ChevronRight, RefreshCw, Mail
} from "lucide-react";

interface MeetingData {
  id: string;
  title: string;
  courseId: string | null;
  password?: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "live" | "ended";
  attendees?: number;
  hostName?: string;
  batchId?: string | null;
  batchName?: string | null;
  allowedEmails?: string[];
}

function JoinMeetingContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const meetingId = (params?.id as string) || "";
  const initialPwd = searchParams.get("pwd") || searchParams.get("password") || "";

  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(true);
  const [meetingNotFound, setMeetingNotFound] = useState(false);

  const [studentName, setStudentName] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("rcrd_student_name") || "";
      } catch {}
    }
    return "";
  });
  const [studentEmail, setStudentEmail] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const qEmail = searchParams.get("email") || "";
        if (qEmail) return qEmail;
        const storedAuth = localStorage.getItem("rcrd_user");
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth);
          if (parsed?.email) return parsed.email;
        }
        return localStorage.getItem("rcrd_student_email") || "";
      } catch {}
    }
    return "";
  });
  const [password, setPassword] = useState(initialPwd);
  const [showPwd, setShowPwd] = useState(false);

  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  // Clock tick for countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch meeting details for retries or manual trigger
  const fetchMeetingInfo = useCallback(async () => {
    if (!meetingId) return;
    setLoadingMeeting(true);
    setMeetingNotFound(false);
    setErrorMsg(null);

    try {
      // 1. Try server API
      const res = await fetch(`/api/meetings?id=${encodeURIComponent(meetingId)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.meeting) {
          setMeeting(data.meeting);
          setLoadingMeeting(false);
          return;
        }
      }

      // If server explicitly returned 404, the meeting does NOT exist or has been deleted
      if (res.status === 404) {
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem(`meeting_${meetingId}`);
            const localStr = localStorage.getItem("rcrd_meetings");
            if (localStr) {
              const all: MeetingData[] = JSON.parse(localStr);
              localStorage.setItem("rcrd_meetings", JSON.stringify(all.filter(m => m.id !== meetingId)));
            }
          } catch {}
        }
        setMeeting(null);
        setMeetingNotFound(true);
        setLoadingMeeting(false);
        return;
      }

      // 2. Only if server was unreachable (500 or offline), check localStorage
      if (typeof window !== "undefined") {
        const localStr = localStorage.getItem("rcrd_meetings");
        if (localStr) {
          const all: MeetingData[] = JSON.parse(localStr);
          const found = all.find(m => m.id === meetingId);
          if (found) {
            setMeeting(found);
            setLoadingMeeting(false);
            return;
          }
        }
      }

      setMeeting(null);
      setMeetingNotFound(true);
    } catch {
      if (typeof window !== "undefined") {
        const localStr = localStorage.getItem("rcrd_meetings");
        if (localStr) {
          const all: MeetingData[] = JSON.parse(localStr);
          const found = all.find(m => m.id === meetingId);
          if (found) {
            setMeeting(found);
            setLoadingMeeting(false);
            return;
          }
        }
      }
      setMeeting(null);
      setMeetingNotFound(true);
    } finally {
      setLoadingMeeting(false);
    }
  }, [meetingId]);

  // Initial load asynchronously to avoid cascading synchronous setState in effect
  useEffect(() => {
    let active = true;
    const loadMeeting = async () => {
      if (!meetingId) return;
      try {
        const res = await fetch(`/api/meetings?id=${encodeURIComponent(meetingId)}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (active && data?.meeting) {
            setMeeting(data.meeting);
            setLoadingMeeting(false);
            return;
          }
        }

        if (res.status === 404) {
          if (active) {
            if (typeof window !== "undefined") {
              try {
                sessionStorage.removeItem(`meeting_${meetingId}`);
                const localStr = localStorage.getItem("rcrd_meetings");
                if (localStr) {
                  const all: MeetingData[] = JSON.parse(localStr);
                  localStorage.setItem("rcrd_meetings", JSON.stringify(all.filter(m => m.id !== meetingId)));
                }
              } catch {}
            }
            setMeeting(null);
            setMeetingNotFound(true);
            setLoadingMeeting(false);
            return;
          }
        }

        if (typeof window !== "undefined") {
          const localStr = localStorage.getItem("rcrd_meetings");
          if (localStr) {
            const all: MeetingData[] = JSON.parse(localStr);
            const found = all.find(m => m.id === meetingId);
            if (active && found) {
              setMeeting(found);
              setLoadingMeeting(false);
              return;
            }
          }
        }

        if (active) {
          setMeeting(null);
          setMeetingNotFound(true);
        }
      } catch {
        if (active) {
          if (typeof window !== "undefined") {
            const localStr = localStorage.getItem("rcrd_meetings");
            if (localStr) {
              const all: MeetingData[] = JSON.parse(localStr);
              const found = all.find(m => m.id === meetingId);
              if (found) {
                setMeeting(found);
                setLoadingMeeting(false);
                return;
              }
            }
          }
          setMeeting(null);
          setMeetingNotFound(true);
        }
      } finally {
        if (active) {
          setLoadingMeeting(false);
        }
      }
    };

    loadMeeting();
    return () => {
      active = false;
    };
  }, [meetingId]);

  const fmtDate = (iso?: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const formatDuration = (mins?: number) => {
    if (!mins || mins <= 0) return "60 mins";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h} hr ${m} min`;
    if (h > 0) return `${h} ${h === 1 ? 'hour' : 'hours'}`;
    return `${m} mins`;
  };

  const getCountdown = (iso?: string) => {
    if (!iso) return null;
    const diff = new Date(iso).getTime() - now;
    if (diff <= 0) return "Starting now / In progress";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) return `Starts in ${days}d ${hrs}h ${mins}m`;
    if (hrs > 0) return `Starts in ${hrs}h ${mins}m ${secs}s`;
    return `Starts in ${mins}m ${secs}s`;
  };

  const copyDirectLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = password
      ? `${origin}/meeting/${meetingId}?pwd=${encodeURIComponent(password)}`
      : `${origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = studentName.trim();
    const trimmedPwd = password.trim();
    const trimmedEmail = studentEmail.trim().toLowerCase();

    if (!trimmedName) {
      setErrorMsg("Please enter your name to join the class.");
      return;
    }

    const isBatchRestricted = Boolean(meeting?.allowedEmails && meeting.allowedEmails.length > 0);
    if (isBatchRestricted && !trimmedEmail) {
      setErrorMsg(`Student email is required for this batch-restricted classroom (${meeting?.batchName || 'Assigned Batch'}).`);
      return;
    }

    setJoining(true);

    try {
      // Validate via join API
      const res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmedPwd, name: trimmedName, email: trimmedEmail }),
      });

      const data = await res.json();

      if (data?.status === 'ended' || data?.meeting?.status === 'ended' || data?.expired) {
        setJoining(false);
        setErrorMsg("This meeting has ended and the link has expired.");
        setTimeout(() => {
          window.location.href = "https://www.geonixa.com/";
        }, 1500);
        return;
      }

      if (!res.ok) {
        setJoining(false);
        setErrorMsg(data.error || "Failed to join meeting. Please verify passcode.");
        return;
      }

      // Remember student details for future classes
      try {
        localStorage.setItem("rcrd_student_name", trimmedName);
        if (trimmedEmail) {
          localStorage.setItem("rcrd_student_email", trimmedEmail);
        }
      } catch {}

      // Store meeting in session
      if (data.meeting) {
        sessionStorage.setItem(`meeting_${meetingId}`, JSON.stringify(data.meeting));
      }
      sessionStorage.setItem(`participant_name_${meetingId}`, trimmedName);

      const resolvedHost = data?.meeting?.hostName || meeting?.hostName || "";
      const hostParam = resolvedHost ? `&hostName=${encodeURIComponent(resolvedHost)}` : "";
      const emailParam = trimmedEmail ? `&email=${encodeURIComponent(trimmedEmail)}` : "";

      // Redirect into the classroom
      const targetUrl = `/meetings/room/${encodeURIComponent(meetingId)}?role=participant&name=${encodeURIComponent(trimmedName)}${emailParam}${hostParam}`;
      router.push(targetUrl);
    } catch (err: unknown) {
      setJoining(false);
      // Fallback check against cached meeting if API is unreachable
      if (meeting) {
        const expected = (meeting.password || "").trim().toUpperCase();
        if (!expected || expected === trimmedPwd.toUpperCase()) {
          try {
            localStorage.setItem("rcrd_student_name", trimmedName);
          } catch {}
          sessionStorage.setItem(`meeting_${meetingId}`, JSON.stringify(meeting));
          sessionStorage.setItem(`participant_name_${meetingId}`, trimmedName);
          const resolvedHost = meeting.hostName || "";
          const hostParam = resolvedHost ? `&hostName=${encodeURIComponent(resolvedHost)}` : "";
          const targetUrl = `/meetings/room/${encodeURIComponent(meetingId)}?role=participant&name=${encodeURIComponent(trimmedName)}${hostParam}`;
          router.push(targetUrl);
          return;
        } else {
          setErrorMsg("Invalid meeting passcode. Please check and try again.");
          return;
        }
      }
      setErrorMsg(err instanceof Error ? err.message : "Unable to connect to meeting server. Please try again.");
    }
  };

  const isDurationExpired = Boolean(
    meeting &&
    meeting.status !== "ended" &&
    (() => {
      const startStr = meeting.scheduledAt;
      if (!startStr) return false;
      const startT = new Date(startStr).getTime();
      if (isNaN(startT)) return false;
      const durationMins = Number(meeting.duration) || 60;
      return now >= startT + durationMins * 60000;
    })()
  );

  const effectiveStatus = (meeting?.status === "ended" || isDurationExpired) ? "ended" : meeting?.status;
  const isLive = effectiveStatus === "live";
  const isScheduled = effectiveStatus === "scheduled";
  const isEnded = effectiveStatus === "ended";

  return (
    <div className="min-h-screen bg-[#F4F7FC] flex flex-col justify-between selection:bg-[#154360] selection:text-white font-sans antialiased text-[#20262E] relative overflow-x-hidden">
      
      {/* Background Decorative Gradient Blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-100/60 via-indigo-50/40 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Top Navbar */}
      <header className="h-20 px-6 sm:px-10 flex items-center justify-between border-b border-[#E2E7EC]/80 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { window.location.href = "https://www.geonixa.com/"; }}>
          <RcrdLogo className="h-16 sm:h-18 md:h-20 w-auto scale-130 sm:scale-145 origin-left" />
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <span className="text-xs font-bold text-[#57636E] uppercase tracking-wider hidden sm:inline">
            Classroom Portal
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://www.geonixa.com/"
            className="text-xs font-semibold text-[#57636E] hover:text-[#154360] px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Geonixa Website
          </a>
          {!isEnded && (
            <button
              onClick={copyDirectLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E7EC] bg-white hover:bg-[#F5F6F8] text-xs font-semibold text-[#20262E] shadow-2xs transition-all"
              title="Copy direct join link"
            >
              {copiedLink ? <Check size={13} className="text-[#2980B9]" /> : <Copy size={13} className="text-[#154360]" />}
              <span>{copiedLink ? "Link Copied!" : "Share Link"}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Join Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto z-10">
        <div className="w-full max-w-[500px]">

          {/* LOADING STATE */}
          {loadingMeeting && (
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#E2E7EC]/90 shadow-xl shadow-slate-200/50 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#EBF5FB] border border-[#154360]/20 flex items-center justify-center mx-auto text-[#154360] animate-spin">
                <RefreshCw size={24} />
              </div>
              <h2 className="text-base font-bold text-[#20262E]">Connecting to Class Session...</h2>
              <p className="text-xs text-[#57636E] font-medium">Fetching meeting ID <span className="font-mono font-bold text-[#20262E]">{meetingId}</span> details</p>
            </div>
          )}

          {/* MEETING NOT FOUND STATE */}
          {!loadingMeeting && meetingNotFound && (
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#E2E7EC]/90 shadow-xl shadow-slate-200/50 text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-[#EBF5FB]/40 border border-[#2980B9]/30 flex items-center justify-center mx-auto text-[#154360]">
                <AlertCircle size={26} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#20262E]">Meeting Not Found</h2>
                <p className="text-xs text-[#57636E] mt-1 max-w-sm mx-auto leading-relaxed">
                  We could not find an active class for ID <span className="font-mono font-bold text-[#20262E]">{meetingId}</span>. The meeting may have ended, expired, or been removed.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={fetchMeetingInfo}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-[#20262E] text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={13} /> Retry
                </button>
                <a
                  href="https://www.geonixa.com/"
                  className="flex-1 py-2.5 px-4 bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  Visit Geonixa <ChevronRight size={13} />
                </a>
              </div>
            </div>
          )}

          {/* READY TO JOIN STATE */}
          {!loadingMeeting && !meetingNotFound && meeting && (
            <div className="bg-white rounded-3xl border border-[#E2E7EC]/90 shadow-xl shadow-slate-200/50 overflow-hidden">
              
              {/* Meeting Banner Header */}
              <div className="p-6 sm:p-7 bg-gradient-to-br from-[#154360] via-[#1B4F72] to-[#0E2F44] text-white relative overflow-hidden">
                <div className="absolute right-0 bottom-0 translate-x-6 translate-y-6 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                {/* Status Badges */}
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2">
                    {isLive && (
                      <span
                        style={{ color: "#ffffff", backgroundColor: "#dc2626", borderColor: "#f87171" }}
                        className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-white bg-red-600 border border-red-400 px-3.5 py-1.5 rounded-full shadow-md shadow-red-950/20"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                        <span style={{ color: "#ffffff" }}>LIVE SESSION</span>
                      </span>
                    )}
                    {isScheduled && (
                      <span
                        style={{ color: "#ffffff", backgroundColor: "#0284c7", borderColor: "#38bdf8" }}
                        className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-white bg-sky-600 border border-sky-400 px-3.5 py-1.5 rounded-full shadow-md shadow-sky-950/20"
                      >
                        <Clock size={14} className="text-white stroke-[2.5]" />
                        <span style={{ color: "#ffffff" }}>SCHEDULED CLASS</span>
                      </span>
                    )}
                    {isEnded && (
                      <span
                        style={{ color: "#ffffff", backgroundColor: "#e11d48", borderColor: "#f43f5e" }}
                        className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-white bg-rose-600 border border-rose-400 px-3.5 py-1.5 rounded-full shadow-md shadow-rose-950/20"
                      >
                        <AlertCircle size={15} className="text-white stroke-[2.5]" />
                        <span style={{ color: "#ffffff" }}>LINK EXPIRED</span>
                      </span>
                    )}
                  </div>

                  <span
                    style={{ color: "#ffffff", backgroundColor: "rgba(255, 255, 255, 0.22)", borderColor: "rgba(255, 255, 255, 0.4)" }}
                    className="text-xs font-mono font-extrabold px-3 py-1.5 rounded-xl border border-white/40 text-white shadow-xs backdrop-blur-md tracking-wider"
                  >
                    ID: {meeting.id}
                  </span>
                </div>

                {/* Title */}
                <h1
                  style={{ color: "#ffffff" }}
                  className="text-2xl sm:text-3xl font-black !text-white tracking-tight leading-snug my-2.5 drop-shadow-md capitalize"
                >
                  {meeting.title}
                </h1>

                {/* Date, Time & Duration Meta */}
                <div className="flex flex-wrap items-center gap-2.5 text-xs pt-1.5 font-bold">
                  <div
                    style={{ color: "#ffffff", backgroundColor: "rgba(255, 255, 255, 0.18)", borderColor: "rgba(255, 255, 255, 0.3)" }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/30 text-white backdrop-blur-md shadow-xs"
                  >
                    <Calendar size={15} className="text-cyan-300 stroke-[2.2] shrink-0" />
                    <span style={{ color: "#ffffff" }} className="!text-white font-semibold">{fmtDate(meeting.scheduledAt)}</span>
                  </div>
                  <div
                    style={{ color: "#ffffff", backgroundColor: "rgba(255, 255, 255, 0.18)", borderColor: "rgba(255, 255, 255, 0.3)" }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/30 text-white backdrop-blur-md shadow-xs"
                  >
                    <Clock size={15} className="text-cyan-300 stroke-[2.2] shrink-0" />
                    <span style={{ color: "#ffffff" }} className="!text-white font-semibold">{formatDuration(meeting.duration)}</span>
                  </div>
                </div>

                {/* Live Countdown Banner if Scheduled */}
                {isScheduled && (
                  <div className="mt-4 pt-3.5 border-t border-white/20 flex items-center justify-between text-xs font-bold text-sky-100">
                    <span className="flex items-center gap-1.5 text-sky-200">
                      <Clock size={14} className="text-amber-300" />
                      <span style={{ color: "#e0f2fe" }}>Class Countdown</span>
                    </span>
                    <span
                      style={{ color: "#ffffff", backgroundColor: "rgba(255, 255, 255, 0.25)", borderColor: "rgba(255, 255, 255, 0.4)" }}
                      className="font-mono font-black text-white px-3 py-1 rounded-lg border border-white/30 shadow-xs"
                    >
                      {getCountdown(meeting.scheduledAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Form Section OR Ended State */}
              {isEnded ? (
                <div className="p-7 sm:p-9 text-center space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-300 flex items-center justify-center mx-auto text-rose-600 shadow-md shadow-rose-500/10">
                    <AlertCircle size={34} className="stroke-[2.5]" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-extrabold text-[#20262E] tracking-tight">Meeting Link Expired</h3>
                    <p className="text-xs sm:text-sm text-[#57636E] leading-relaxed max-w-sm mx-auto font-medium">
                      This class session has concluded and the link has permanently expired. You can no longer join this meeting. Please visit Geonixa for upcoming courses and schedules.
                    </p>
                  </div>
                  <a
                    href="https://www.geonixa.com/"
                    className="w-full py-3.5 px-5 bg-gradient-to-r from-[#154360] via-[#1A5276] to-[#0E2F44] hover:brightness-110 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-[#154360]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span style={{ color: "#ffffff" }}>Visit Geonixa Website</span>
                    <ArrowRight size={15} />
                  </a>
                </div>
              ) : (
                <form onSubmit={handleJoinSubmit} className="p-6 sm:p-7 space-y-4.5">
                  
                  {errorMsg && (
                    <div className="p-3.5 bg-[#154360]/10 border border-[#154360]/30 rounded-2xl flex items-start gap-2.5 text-xs text-[#0E2F44] animate-in fade-in duration-200">
                      <AlertCircle size={16} className="text-[#154360] shrink-0 mt-0.5" />
                      <span className="font-semibold leading-relaxed">{errorMsg}</span>
                    </div>
                  )}

                  {/* Batch Info Badge if meeting is assigned to a batch */}
                  {meeting?.batchName && (
                    <div className="p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-indigo-600 shrink-0" />
                        <div>
                          <span className="font-bold text-indigo-950">Class Cohort: </span>
                          <span className="font-extrabold text-indigo-800">{meeting.batchName}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                        Enrolled Only
                      </span>
                    </div>
                  )}

                  {/* Student Name */}
                  <div>
                    <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                      Your Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57636E]" />
                      <input
                        type="text"
                        required
                        value={studentName}
                        onChange={e => setStudentName(e.target.value)}
                        placeholder="e.g. Alex Morgan"
                        autoFocus={!studentName}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#F5F6F8]/70 border border-[#E2E7EC] focus:border-[#154360] focus:bg-white rounded-xl text-xs text-[#20262E] placeholder:text-[#57636E] focus:ring-2 focus:ring-[#154360]/15 outline-none transition-all font-medium shadow-2xs"
                      />
                    </div>
                    <p className="text-[11px] text-[#57636E] mt-1">This name will be shown to the instructor and attendees in the live room.</p>
                  </div>

                  {/* Student Email */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider">
                        Student Email Address {Boolean(meeting?.allowedEmails && meeting.allowedEmails.length > 0) ? '*' : '(Optional)'}
                      </label>
                      {Boolean(meeting?.allowedEmails && meeting.allowedEmails.length > 0) && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          Required for Batch Access
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57636E]" />
                      <input
                        type="email"
                        required={Boolean(meeting?.allowedEmails && meeting.allowedEmails.length > 0)}
                        value={studentEmail}
                        onChange={e => setStudentEmail(e.target.value)}
                        placeholder="e.g. student@gmail.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#F5F6F8]/70 border border-[#E2E7EC] focus:border-[#154360] focus:bg-white rounded-xl text-xs text-[#20262E] placeholder:text-[#57636E] focus:ring-2 focus:ring-[#154360]/15 outline-none transition-all font-medium shadow-2xs"
                      />
                    </div>
                    <p className="text-[11px] text-[#57636E] mt-1">
                      {Boolean(meeting?.allowedEmails && meeting.allowedEmails.length > 0)
                        ? "Only students enrolled in this batch are permitted to enter this live classroom."
                        : "Optional email for identification in the live classroom."}
                    </p>
                  </div>

                  {/* Meeting ID (Read Only badge) */}
                  <div>
                    <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                      Meeting ID
                    </label>
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100 border border-[#E2E7EC] rounded-xl text-xs font-mono font-bold text-[#20262E]">
                      <span className="tracking-wider">{meeting.id}</span>
                      <span className="text-[10px] uppercase font-bold text-[#2980B9] bg-[#EBF5FB]/40 px-2 py-0.5 rounded border border-[#2980B9]/30 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Verified
                      </span>
                    </div>
                  </div>

                  {/* Meeting Passcode */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider">
                        Passcode *
                      </label>
                      {initialPwd && (
                        <span className="text-[10px] text-[#2980B9] font-bold bg-[#EBF5FB]/40 border border-[#2980B9]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check size={10} /> Auto-filled from link
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57636E]" />
                      <input
                        type={showPwd ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Enter 8-digit passcode"
                        className="w-full pl-10 pr-10 py-2.5 bg-[#F5F6F8]/70 border border-[#E2E7EC] focus:border-[#154360] focus:bg-white rounded-xl text-xs font-mono font-bold text-[#20262E] placeholder:text-[#57636E] tracking-wider focus:ring-2 focus:ring-[#154360]/15 outline-none transition-all shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#57636E] hover:text-[#57636E] transition-colors p-1"
                      >
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#57636E] mt-1">Provided in your class invitation or shared by your instructor.</p>
                  </div>

                  {/* Security Guarantee */}
                  <div className="flex items-center gap-2 p-3 bg-[#EBF5FB]/60 border border-[#154360]/20 rounded-xl text-[11px] text-[#57636E]">
                    <Shield size={14} className="text-[#154360] shrink-0" />
                    <span>Secure connection · High definition audio & screen broadcast</span>
                  </div>

                  {/* Submit Action */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={joining || !studentName.trim()}
                      className="w-full py-3 px-4 bg-gradient-to-r from-[#154360] to-[#0E2F44] hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-[#57636E] text-white font-bold text-xs rounded-xl shadow-md shadow-[rgba(21, 67, 96,0.2)] hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {joining ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Verifying & Entering Room...</span>
                        </>
                      ) : (
                        <>
                          <Video size={15} />
                          <span>Join Live Classroom</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>

                </form>
              )}

            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 text-center text-xs text-[#57636E] border-t border-[#E2E7EC]/70 bg-white/50">
        <span>© {new Date().getFullYear()} RCRD Workspace · Powered by RCRD Video & Screen Recording Engine</span>
      </footer>

    </div>
  );
}

export default function MeetingJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F4F7FC] flex items-center justify-center p-6 text-center">
          <div className="p-8 bg-white rounded-3xl border border-[#E2E7EC] shadow-xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EBF5FB] text-[#154360] flex items-center justify-center mx-auto animate-spin">
              <RefreshCw size={20} />
            </div>
            <p className="text-xs font-bold text-[#20262E]">Loading meeting room...</p>
          </div>
        </div>
      }
    >
      <JoinMeetingContent />
    </Suspense>
  );
}
