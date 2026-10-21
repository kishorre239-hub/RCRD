"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, FileText, Download, Upload, Paperclip, 
  Trash2, Search, Plus, Calendar, Clock, Check, Video, X, Lock
} from "lucide-react";

interface NoteAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}

interface Note {
  id: string;
  type: "host" | "participant" | "group";
  content: string;
  author: string;
  timestamp: number | string;
  participantId?: string;
  participantName?: string;
  attachment?: NoteAttachment;
}

interface Meeting {
  id: string;
  title: string;
  courseId?: string | null;
  scheduledAt: string;
  duration: number;
  password?: string;
  status: "scheduled" | "live" | "ended";
  attendees?: number;
  notes?: Note[];
  hostName?: string;
}

function MeetingNotesContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const meetingId = (params?.id as string) || "";

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "host" | "participant" | "group">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteType, setNewNoteType] = useState<"host" | "participant" | "group">("group");
  const [newAttachment, setNewAttachment] = useState<NoteAttachment | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Determine if viewer is Host (only Host can download or add/edit notes)
  useEffect(() => {
    const roleParam = searchParams.get("role")?.toLowerCase();
    if (roleParam === "host" || roleParam === "mentor") {
      setIsHost(true);
      return;
    }
    try {
      const userProfile = localStorage.getItem("rcrd_user_profile");
      const userObj = localStorage.getItem("user");
      if (userProfile) {
        const p = JSON.parse(userProfile);
        if (p?.role === "admin" || p?.role === "instructor" || p?.role === "host") {
          setIsHost(true);
          return;
        }
      }
      if (userObj) {
        const u = JSON.parse(userObj);
        if (u?.role === "admin" || u?.role === "instructor" || u?.role === "host") {
          setIsHost(true);
          return;
        }
      }
    } catch {}
    setIsHost(false);
  }, [searchParams]);

  // Load meeting details & real notes from backend API, room state, and localStorage
  useEffect(() => {
    if (!meetingId) return;

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      let resolvedNotes: Note[] = [];

      // 1. Try local storage cache
      try {
        const local = localStorage.getItem(`meeting_notes_${meetingId}`);
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            resolvedNotes = parsed;
          }
        }
        if (resolvedNotes.length === 0) {
          const roomNotesJson = localStorage.getItem("RCRD_MEETING_NOTES");
          if (roomNotesJson) {
            const roomNotesObj = JSON.parse(roomNotesJson);
            if (Array.isArray(roomNotesObj[meetingId]) && roomNotesObj[meetingId].length > 0) {
              resolvedNotes = roomNotesObj[meetingId];
            }
          }
        }
        if (resolvedNotes.length === 0) {
          const altNotesJson = localStorage.getItem("rcrd_notes");
          if (altNotesJson) {
            const altNotesObj = JSON.parse(altNotesJson);
            if (Array.isArray(altNotesObj[meetingId]) && altNotesObj[meetingId].length > 0) {
              resolvedNotes = altNotesObj[meetingId];
            }
          }
        }
      } catch {}

      if (isMounted && resolvedNotes.length > 0) {
        setNotes(resolvedNotes);
      }

      // 2. Fetch from backend /api/meetings
      try {
        const res = await fetch(`/api/meetings?id=${encodeURIComponent(meetingId)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.meeting) {
            setMeeting(data.meeting);
            if (Array.isArray(data.meeting.notes) && data.meeting.notes.length > 0) {
              resolvedNotes = data.meeting.notes;
              setNotes(data.meeting.notes);
            }
          }
        }
      } catch {}

      // 3. Fetch from room state API /api/meetings/[id]/state (captures real-time notes uploaded during meeting)
      try {
        const stateRes = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/state`);
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          if (isMounted) {
            if (stateData?.status && !meeting?.status) {
              setMeeting(prev => prev ? { ...prev, status: stateData.status } : null);
            }
            if (Array.isArray(stateData.notes) && stateData.notes.length > 0) {
              // Merge with existing
              const map = new Map<string, Note>();
              resolvedNotes.forEach(n => map.set(n.id, n));
              stateData.notes.forEach((n: Note) => map.set(n.id, n));
              const merged = Array.from(map.values());
              setNotes(merged);
              try {
                localStorage.setItem(`meeting_notes_${meetingId}`, JSON.stringify(merged));
              } catch {}
            }
          }
        }
      } catch {}

      if (isMounted) {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [meetingId]);

  // Persist notes across all storage keys and backend APIs
  const saveNotes = (updated: Note[]) => {
    setNotes(updated);
    try {
      localStorage.setItem(`meeting_notes_${meetingId}`, JSON.stringify(updated));
      const roomNotesJson = localStorage.getItem("RCRD_MEETING_NOTES");
      const roomNotesObj = roomNotesJson ? JSON.parse(roomNotesJson) : {};
      roomNotesObj[meetingId] = updated;
      localStorage.setItem("RCRD_MEETING_NOTES", JSON.stringify(roomNotesObj));

      const altNotesJson = localStorage.getItem("rcrd_notes");
      const altNotesObj = altNotesJson ? JSON.parse(altNotesJson) : {};
      altNotesObj[meetingId] = updated;
      localStorage.setItem("rcrd_notes", JSON.stringify(altNotesObj));
    } catch {}

    // Persist to database meeting document
    fetch('/api/meetings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: meetingId, notes: updated }),
    }).catch(() => {});

    // Persist to room state
    fetch(`/api/meetings/${encodeURIComponent(meetingId)}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: updated }),
    }).catch(() => {});
  };

  // Handle file attachment for new note
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost) {
      showToast("Only the host has access to upload files.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showToast("File size too large (max 20MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewAttachment({
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataUrl: event.target?.result as string,
      });
      showToast(`Attached ${file.name}`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Import notes from file (.txt, .md, .json)
  const handleImportNotes = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost) {
      showToast("Only the host has access to import notes.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      if (file.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter(n => n.content);
            saveNotes([...valid, ...notes]);
            showToast(`Imported ${valid.length} notes from JSON!`);
            return;
          }
        } catch {}
      }
      // Text or markdown import
      const importedNote: Note = {
        id: `note-${Date.now()}`,
        type: "group",
        author: isHost ? "Host" : "Instructor",
        content: text,
        timestamp: Date.now(),
        attachment: {
          name: file.name,
          size: file.size,
          type: file.type || "text/plain",
          dataUrl: text.length < 500000 ? `data:text/plain;charset=utf-8,${encodeURIComponent(text)}` : "",
        }
      };
      saveNotes([importedNote, ...notes]);
      showToast(`Imported notes from ${file.name}!`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Export notes to Markdown/Text (Host only)
  const handleExportNotes = () => {
    if (!isHost) {
      showToast("Only the host has access to export notes.");
      return;
    }
    if (notes.length === 0) {
      showToast("No notes to export.");
      return;
    }
    let md = `# Meeting Notes: ${meeting?.title || "Class Session"}\n`;
    md += `Meeting ID: ${meetingId}\n`;
    md += `Exported: ${new Date().toLocaleString()}\n\n---\n\n`;

    notes.forEach((n, i) => {
      md += `### Note #${i + 1} (${n.type.toUpperCase()})\n`;
      md += `**Author:** ${n.author} | **Time:** ${new Date(n.timestamp).toLocaleString()}\n\n`;
      md += `${n.content}\n\n`;
      if (n.attachment) {
        md += `*Attachment: ${n.attachment.name} (${(n.attachment.size / 1024).toFixed(1)} KB)*\n\n`;
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting_notes_${meetingId}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Notes exported to Markdown!");
  };

  // Add a note (Host only)
  const handleAddNote = () => {
    if (!isHost) {
      showToast("Only the host has permission to add notes.");
      return;
    }
    if (!newNoteText.trim() && !newAttachment) {
      showToast("Please enter text or attach a file.");
      return;
    }
    const created: Note = {
      id: `note-${Date.now()}`,
      type: newNoteType,
      author: "Host",
      content: newNoteText.trim() || (newAttachment ? `Attached file: ${newAttachment.name}` : ""),
      timestamp: Date.now(),
      attachment: newAttachment || undefined,
    };
    saveNotes([created, ...notes]);
    setNewNoteText("");
    setNewAttachment(null);
    showToast("Note added successfully!");
  };

  // Delete a note (Host only)
  const handleDeleteNote = (id: string) => {
    if (!isHost) {
      showToast("Only the host can delete notes.");
      return;
    }
    saveNotes(notes.filter(n => n.id !== id));
    showToast("Note deleted.");
  };

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesTab = activeTab === "all" ? true : n.type === activeTab;
      const matchesSearch = !searchQuery.trim()
        ? true
        : n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (n.attachment && n.attachment.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [notes, activeTab, searchQuery]);

  const isMeetingEnded = meeting?.status === "ended";

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#20262E] font-sans flex flex-col">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-2xl z-50 text-xs font-bold animate-in fade-in slide-in-from-top-2 border border-slate-700 flex items-center gap-2">
          <Check size={14} className="text-[#EBF5FB]" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-[#E2E7EC] px-6 py-4 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/meetings")}
              className="p-2 rounded-xl text-[#57636E] hover:text-[#20262E] hover:bg-slate-100 transition-colors cursor-pointer"
              title="Back to Meetings"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#20262E]">
                  {meeting?.title || "Class Meeting Notes"}
                </h1>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                  isMeetingEnded
                    ? "bg-slate-100 text-slate-700 border-slate-300"
                    : meeting?.status === "live"
                    ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                    : "bg-sky-50 text-sky-600 border-sky-200"
                }`}>
                  {isMeetingEnded ? "Ended" : (meeting?.status || "Ended")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#57636E] mt-0.5">
                <span className="font-mono">ID: {meetingId}</span>
                {meeting?.scheduledAt && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(meeting.scheduledAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    })}
                  </span>
                )}
                {meeting?.duration && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {meeting.duration} mins
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Host Only: Upload Notes */}
            {isHost && (
              <>
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl border border-[#E2E7EC] hover:bg-[#F5F6F8] text-xs font-bold text-[#20262E] flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  title="Upload Notes file (.txt, .md, .json)"
                >
                  <Upload size={13} className="text-[#154360]" />
                  <span>Upload Notes</span>
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".txt,.md,.json"
                  onChange={handleImportNotes}
                  className="hidden"
                />
              </>
            )}

            {/* Host Only: Export Notes */}
            {isHost && (
              <button
                onClick={handleExportNotes}
                className="px-3 py-1.5 rounded-xl border border-[#E2E7EC] hover:bg-[#F5F6F8] text-xs font-bold text-[#20262E] flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                title="Export all notes to Markdown"
              >
                <Download size={13} className="text-[#2980B9]" />
                <span>Export Notes</span>
              </button>
            )}

            {/* Open Room: Only visible if meeting is NOT ended */}
            {!isMeetingEnded && (
              <button
                onClick={() => router.push(`/meetings/room/${meetingId}`)}
                className="px-4 py-1.5 rounded-xl bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="Open meeting room"
              >
                <Video size={13} />
                <span>Open Room</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-6xl mx-auto w-full p-6 flex-1 flex flex-col gap-6">
        {/* Controls Bar: Sub-tabs & Search */}
        <div className="bg-white rounded-2xl border border-[#E2E7EC] p-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
          {/* Sub-tabs */}
          <div className="flex items-center gap-1 w-full md:w-auto">
            {(["all", "host", "participant", "group"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all capitalize flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab
                    ? "bg-[#154360] text-white shadow-sm"
                    : "text-[#57636E] hover:text-[#20262E] hover:bg-slate-100"
                }`}
              >
                {tab === "all" ? "All Notes" : tab === "host" ? "Host Notes" : tab === "participant" ? "Participant Notes" : "Group Notes"}
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === tab ? "bg-white/20 text-white" : "bg-slate-100 text-[#57636E]"
                }`}>
                  {tab === "all" ? notes.length : notes.filter(n => n.type === tab).length}
                </span>
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57636E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes or files..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#E2E7EC] bg-[#F5F6F8] text-xs text-[#20262E] placeholder-slate-400 focus:bg-white focus:border-[#154360] outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#57636E] hover:text-[#20262E] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-full bg-white rounded-2xl border border-[#E2E7EC] p-12 text-center text-[#57636E] flex flex-col items-center justify-center">
              <FileText size={32} className="text-[#154360] animate-pulse mb-2" />
              <p className="text-xs font-semibold text-[#57636E]">Loading class notes...</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-[#E2E7EC] p-12 text-center text-[#57636E] flex flex-col items-center justify-center">
              <FileText size={36} className="text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-[#20262E]">No notes uploaded</h3>
              <p className="text-xs text-[#57636E] max-w-sm mt-1">
                {searchQuery
                  ? "No notes matching your search filter."
                  : isHost
                  ? "No notes uploaded during this class session yet. Use the composer below to add notes or attachments."
                  : "No notes were uploaded by the instructor during this meeting session."}
              </p>
            </div>
          ) : (
            filteredNotes.map(n => (
              <div
                key={n.id}
                className="bg-white rounded-2xl border border-[#E2E7EC] p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative"
              >
                <div>
                  {/* Top metadata */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E7EC] mb-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        n.type === "host" ? "bg-[#154360]" : n.type === "participant" ? "bg-[#0E2F44]" : "bg-[#2980B9]"
                      }`}>
                        {n.author.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-[#20262E]">{n.author}</span>
                        <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          n.type === "host" ? "bg-[#EBF5FB] text-[#0E2F44] border border-[#154360]/30" :
                          n.type === "participant" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                          "bg-[#EBF5FB]/40 text-[#0E2F44] border border-[#2980B9]/30"
                        }`}>
                          {n.type === "host" ? "Host Note" : n.type === "participant" ? "Private Thread" : "Group Note"}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-[#57636E]">
                      {new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Note Content */}
                  <p className="text-xs text-[#20262E] leading-relaxed whitespace-pre-wrap">
                    {n.content}
                  </p>

                  {/* Attached File Preview Card */}
                  {n.attachment && (
                    <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-[#F5F6F8] border border-[#E2E7EC]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#EBF5FB] text-[#0E2F44] flex items-center justify-center shrink-0">
                          <Paperclip size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#20262E] truncate">{n.attachment.name}</p>
                          <p className="text-[10px] text-[#57636E]">{(n.attachment.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      {/* Host has exclusive access to download attachments */}
                      {isHost ? (
                        <a
                          href={n.attachment.dataUrl}
                          download={n.attachment.name}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#E2E7EC] hover:bg-[#EBF5FB] hover:border-[#154360]/30 text-[#20262E] hover:text-[#0E2F44] text-xs font-bold flex items-center gap-1 transition-colors shadow-xs shrink-0 cursor-pointer"
                          title="Download attachment"
                        >
                          <Download size={12} />
                          <span>Download</span>
                        </a>
                      ) : (
                        <div
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-medium flex items-center gap-1 border border-slate-200 shrink-0"
                          title="Only the host has permission to download class attachments"
                        >
                          <Lock size={11} className="text-slate-400" />
                          <span>Host Only</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card footer delete button (Host only) */}
                {isHost && (
                  <div className="flex justify-end pt-3 mt-2 border-t border-slate-50">
                    <button
                      onClick={() => handleDeleteNote(n.id)}
                      className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Delete Note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Note Composer Bar: Only shown to Host */}
        {isHost ? (
          <div className="bg-white rounded-2xl border border-[#E2E7EC] p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#20262E] flex items-center gap-1.5">
                <Plus size={14} className="text-[#154360]" />
                Add New Meeting Note
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                {(["group", "host", "participant"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewNoteType(t)}
                    className={`px-2.5 py-0.5 rounded-md transition-all capitalize cursor-pointer ${
                      newNoteType === t ? "bg-white text-[#154360] shadow-xs" : "text-[#57636E] hover:text-[#20262E]"
                    }`}
                  >
                    {t === "group" ? "Group Note" : t === "host" ? "Host Private" : "Participant"}
                  </button>
                ))}
              </div>
            </div>

            {/* Attached file chip preview */}
            {newAttachment && (
              <div className="flex items-center justify-between p-2 bg-[#EBF5FB] border border-[#154360]/30 rounded-xl text-xs text-blue-900">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip size={13} className="text-[#154360] shrink-0" />
                  <span className="font-semibold truncate">{newAttachment.name}</span>
                  <span className="text-[10px] text-[#154360] shrink-0">({(newAttachment.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  onClick={() => setNewAttachment(null)}
                  className="text-[#154360] hover:text-[#154360] p-0.5 cursor-pointer"
                  title="Remove attachment"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            <textarea
              value={newNoteText}
              onChange={e => setNewNoteText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  handleAddNote();
                }
              }}
              placeholder="Write meeting notes, key discussion points, or summaries... (Ctrl+Enter to save)"
              rows={3}
              className="w-full bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl p-3 text-xs text-[#20262E] placeholder-slate-400 focus:bg-white focus:border-[#154360] outline-none resize-none shadow-xs font-normal"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E7EC] hover:bg-slate-100 text-[#20262E] text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Attach a file to this note"
              >
                <Paperclip size={13} />
                <span>Attach File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                onClick={handleAddNote}
                className="px-5 py-2 bg-[#154360] hover:bg-[#0E2F44] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Save Note
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E2E7EC] p-4 text-center text-xs text-[#57636E] flex items-center justify-center gap-1.5">
            <Lock size={13} className="text-slate-400" />
            <span>Class lecture notes and attachments are managed exclusively by the instructor.</span>
          </div>
        )}
      </main>
    </div>
  );
}

export default function MeetingNotesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
        <div className="text-xs font-bold text-[#57636E]">Loading notes...</div>
      </div>
    }>
      <MeetingNotesContent />
    </Suspense>
  );
}
