"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  ArrowLeft, FileText, Download, Upload, Paperclip, 
  Trash2, Search, Plus, Calendar, Clock, Check, Video, X
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
  courseId: string;
  scheduledAt: string;
  duration: number;
  password: string;
  status: "scheduled" | "live" | "ended";
  attendees?: number;
}

export default function MeetingNotesPage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = (params?.id as string) || "";

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "host" | "participant" | "group">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteType, setNewNoteType] = useState<"host" | "participant" | "group">("group");
  const [newAttachment, setNewAttachment] = useState<NoteAttachment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Load meeting details
  useEffect(() => {
    if (!meetingId) return;

    setTimeout(() => {
      // 1. Try sessionStorage or localStorage
      try {
        const sess = sessionStorage.getItem(`meeting_${meetingId}`);
        if (sess) {
          setMeeting(JSON.parse(sess));
        }
        const local = localStorage.getItem("RCRD_SCHEDULED_MEETINGS");
        if (local) {
          const list: Meeting[] = JSON.parse(local);
          const found = list.find(m => m.id === meetingId);
          if (found) setMeeting(found);
        }
      } catch {}
    }, 0);

    // 2. Fetch from backend API
    fetch(`/api/meetings?id=${meetingId}`)
      .then(res => res.json())
      .then(data => {
        if (data?.meeting) {
          setMeeting(data.meeting);
        }
      })
      .catch(() => {});
  }, [meetingId]);

  // Load notes (supporting both room session notes and saved notes)
  useEffect(() => {
    if (!meetingId) return;

    setTimeout(() => {
      try {
        // 1. Try RCRD_MEETING_NOTES and rcrd_notes first (created during live call)
        const roomNotesJson = localStorage.getItem("RCRD_MEETING_NOTES");
        const altNotesJson = localStorage.getItem("rcrd_notes");
        if (roomNotesJson) {
          const roomNotesObj = JSON.parse(roomNotesJson);
          if (Array.isArray(roomNotesObj[meetingId]) && roomNotesObj[meetingId].length > 0) {
            setNotes(roomNotesObj[meetingId]);
            return;
          }
        }
        if (altNotesJson) {
          const altNotesObj = JSON.parse(altNotesJson);
          if (Array.isArray(altNotesObj[meetingId]) && altNotesObj[meetingId].length > 0) {
            setNotes(altNotesObj[meetingId]);
            return;
          }
        }
        // 2. Try meeting_notes_${meetingId}
        const saved = localStorage.getItem(`meeting_notes_${meetingId}`);
        if (saved) {
          const parsed: Note[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotes(parsed);
            return;
          }
        }
      } catch {}

      // Initial default session notes if completely empty
      setNotes([
        {
          id: "note-demo-1",
          type: "group",
          author: "Host",
          timestamp: Date.now() - 3600000,
          content: "Class session summary: Core lecture discussion, whiteboard formulas, and class materials.",
        }
      ]);
    }, 0);
  }, [meetingId]);

  // Persist notes across all storage keys
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
  };

  // Handle file attachment for new note
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast("File size too large (max 15MB).");
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
        author: "Imported File",
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

  // Export notes to Markdown/Text
  const handleExportNotes = () => {
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

  // Add a note
  const handleAddNote = () => {
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

  // Delete a note
  const handleDeleteNote = (id: string) => {
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
              className="p-2 rounded-xl text-[#57636E] hover:text-[#20262E] hover:bg-slate-100 transition-colors"
              title="Back to Meetings"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#20262E]">
                  {meeting?.title || "Class Meeting Notes"}
                </h1>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#EBF5FB] text-[#0E2F44] border border-[#154360]/30">
                  {meeting?.status || "Ended"}
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
            <button
              onClick={() => importInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl border border-[#E2E7EC] hover:bg-[#F5F6F8] text-xs font-bold text-[#20262E] flex items-center gap-1.5 transition-colors shadow-xs"
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

            <button
              onClick={handleExportNotes}
              className="px-3 py-1.5 rounded-xl border border-[#E2E7EC] hover:bg-[#F5F6F8] text-xs font-bold text-[#20262E] flex items-center gap-1.5 transition-colors shadow-xs"
              title="Export all notes to Markdown"
            >
              <Download size={13} className="text-[#2980B9]" />
              <span>Export Notes</span>
            </button>

            <button
              onClick={() => router.push(`/meetings/room/${meetingId}`)}
              className="px-4 py-1.5 rounded-xl bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title="Open meeting room"
            >
              <Video size={13} />
              <span>Open Room</span>
            </button>
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all capitalize flex items-center gap-1.5 ${
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#57636E] hover:text-[#57636E]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-[#E2E7EC] p-12 text-center text-[#57636E] flex flex-col items-center justify-center">
              <FileText size={36} className="text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-[#20262E]">No notes found</h3>
              <p className="text-xs text-[#57636E] max-w-sm mt-1">
                {searchQuery ? "No notes matching your search filter." : "There are no notes in this section yet. Add a note or upload a file below."}
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
                      <a
                        href={n.attachment.dataUrl}
                        download={n.attachment.name}
                        className="px-2.5 py-1 rounded-lg bg-white border border-[#E2E7EC] hover:bg-[#EBF5FB] hover:border-[#154360]/30 text-[#20262E] hover:text-[#0E2F44] text-xs font-bold flex items-center gap-1 transition-colors shadow-xs shrink-0"
                        title="Download attachment"
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Card footer delete button */}
                <div className="flex justify-end pt-3 mt-2 border-t border-slate-50">
                  <button
                    onClick={() => handleDeleteNote(n.id)}
                    className="p-1 text-slate-300 hover:text-[#154360] hover:bg-[#154360]/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Note"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Note Composer Bar */}
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
                  className={`px-2.5 py-0.5 rounded-md transition-all capitalize ${
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
                className="text-[#154360] hover:text-[#154360] p-0.5"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E7EC] hover:bg-slate-100 text-[#20262E] text-xs font-bold transition-all shadow-xs"
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
              className="px-5 py-2 bg-[#154360] hover:bg-[#0E2F44] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              Save Note
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
