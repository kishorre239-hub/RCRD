"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Upload, Check, Folder, Plus, Loader2, AlertCircle, Film, ArrowRight } from "lucide-react";
import { getCourses, createCourse, uploadVideo } from "@/lib/api";
import { useRouter } from "next/navigation";

interface Course {
  id: string;
  name: string;
}

interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (videoId: string, courseId?: string) => void;
}

export default function UploadVideoModal({ isOpen, onClose, onUploadComplete }: UploadVideoModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("root");
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolderLoading, setIsCreatingFolderLoading] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      getCourses()
        .then((data) => {
          if (Array.isArray(data)) {
            setCourses(data);
            setSelectedCourseId(prev => (data.length > 0 && prev === "root" ? data[0].id : prev));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|webm|mov|mkv|avi|m4v)$/i)) {
      setErrorMessage("Please select a valid video file (MP4, WebM, MOV, MKV).");
      return;
    }
    setErrorMessage("");
    setSelectedFile(file);
    if (!videoTitle.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setVideoTitle(cleanName);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolderLoading(true);
    try {
      const created = await createCourse(newFolderName.trim());
      setCourses((prev) => [...prev, created]);
      setSelectedCourseId(created.id);
      setIsCreatingNewFolder(false);
      setNewFolderName("");
    } catch {
      setErrorMessage("Failed to create project folder");
    } finally {
      setIsCreatingFolderLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select a video file to upload");
      return;
    }

    setUploadState("uploading");
    setUploadProgress(0);
    setErrorMessage("");

    try {
      const targetCourseId = selectedCourseId === "root" ? null : selectedCourseId;
      const targetFolder = courses.find((c) => c.id === selectedCourseId);
      const res = await uploadVideo(
        selectedFile,
        targetCourseId,
        (percent) => setUploadProgress(percent),
        videoTitle.trim() || selectedFile.name,
        { folderName: targetFolder?.name }
      );

      setUploadState("success");
      if (onUploadComplete) {
        onUploadComplete(res.videoId, targetCourseId || undefined);
      }
    } catch (err: unknown) {
      setUploadState("error");
      const message = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setErrorMessage(message);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setVideoTitle("");
    setUploadProgress(0);
    setUploadState("idle");
    setErrorMessage("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#E2E7EC] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E2E7EC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E6F6EC] text-[#0CAA41] flex items-center justify-center shadow-inner">
              <Upload size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#20262E]">Upload Video to Project</h3>
              <p className="text-xs text-[#57636E]">Save and organize video in your project folder</p>
            </div>
          </div>
          <button 
            onClick={resetForm}
            className="p-2 text-[#57636E] hover:text-[#57636E] hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {uploadState === "success" ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-[#E6F6EC] text-[#0CAA41] rounded-full mx-auto flex items-center justify-center shadow-lg shadow-[#0CAA41]/20">
                <Check size={32} className="stroke-[3]" />
              </div>
              <div>
                <h4 className="text-xl font-extrabold text-[#20262E]">Upload Complete!</h4>
                <p className="text-sm text-[#57636E] mt-1 max-w-xs mx-auto">
                  Your video has been saved to the selected project folder.
                </p>
              </div>
              <div className="pt-3 flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    resetForm();
                    router.push("/library");
                  }}
                  className="px-6 py-3 bg-[#0CAA41] hover:bg-[#0C5325] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#0CAA41]/30 transition-all cursor-pointer"
                >
                  <span>Go to Library</span>
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={resetForm}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-[#20262E] rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Dropzone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#57636E] mb-2">
                  Video File
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) {
                      handleFileChange(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-[#0CAA41] bg-[#E6F6EC]"
                      : selectedFile
                      ? "border-[#0CAA41]/40 bg-[#E6F6EC]/40"
                      : "border-[#E2E7EC] hover:border-[#0CAA41] hover:bg-[#F5F6F8]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,.mp4,.webm,.mov,.mkv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />

                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0CAA41] text-white flex items-center justify-center">
                        <Film size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-[#20262E] truncate max-w-[280px]">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-[#57636E]">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Click or drag to change
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-[#E6F6EC] text-[#0CAA41] mx-auto flex items-center justify-center">
                        <Upload size={22} className="stroke-[2.2]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#20262E]">
                          Click to select a video <span className="font-normal text-[#57636E]">or drag & drop</span>
                        </p>
                        <p className="text-xs text-[#57636E] mt-1">MP4, WebM, MOV, or MKV up to 500MB</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Video Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#57636E] mb-1.5">
                  Video Title
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="e.g., Sprint Planning Demo, Project Overview"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E2E7EC] focus:border-[#0CAA41] focus:ring-4 focus:ring-[#0CAA41]/10 outline-none text-sm text-[#20262E] font-medium transition-all"
                />
              </div>

              {/* Project Folder Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#57636E]">
                    Project / Target Folder
                  </label>
                  {!isCreatingNewFolder && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewFolder(true)}
                      className="text-xs font-bold text-[#0CAA41] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> New Project Folder
                    </button>
                  )}
                </div>

                {isCreatingNewFolder ? (
                  <div className="p-3 bg-[#F5F6F8] rounded-xl border border-[#E2E7EC] space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Enter new project folder name..."
                        className="flex-1 px-3 py-1.5 bg-white border border-[#E2E7EC] rounded-lg text-xs font-semibold focus:border-[#0CAA41] outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCreateFolder}
                        disabled={isCreatingFolderLoading || !newFolderName.trim()}
                        className="px-3 py-1.5 bg-[#0CAA41] hover:bg-[#0C5325] text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isCreatingFolderLoading ? <Loader2 size={12} className="animate-spin" /> : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewFolder(false);
                          setNewFolderName("");
                        }}
                        className="px-2 py-1.5 text-xs text-[#57636E] hover:text-[#20262E]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#E2E7EC] focus:border-[#0CAA41] focus:ring-4 focus:ring-[#0CAA41]/10 outline-none text-sm text-[#20262E] font-semibold bg-white cursor-pointer appearance-none transition-all"
                    >
                      <option value="root">📁 Default / Root Library</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          📁 {c.name}
                        </option>
                      ))}
                    </select>
                    <Folder size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#57636E] pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 bg-[#0CAA41]/10 border border-[#0CAA41]/20 text-[#0CAA41] rounded-xl text-xs font-semibold">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Progress bar */}
              {uploadState === "uploading" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#57636E]">
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-[#0CAA41]" />
                      Uploading video...
                    </span>
                    <span className="text-[#0CAA41]">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0CAA41] rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {uploadState !== "success" && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#F5F6F8] border-t border-[#E2E7EC]">
            <button
              onClick={resetForm}
              disabled={uploadState === "uploading"}
              className="px-5 py-2.5 text-sm font-semibold text-[#57636E] hover:text-[#20262E] hover:bg-slate-200/50 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploadState === "uploading" || !selectedFile}
              className="px-6 py-2.5 bg-[#0CAA41] hover:bg-[#0C5325] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#0CAA41]/25 transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
            >
              {uploadState === "uploading" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Uploading {uploadProgress}%</span>
                </>
              ) : (
                <>
                  <Upload size={16} className="stroke-[2.5]" />
                  <span>Upload Video</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
