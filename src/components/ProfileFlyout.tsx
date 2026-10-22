"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  X, Check, ExternalLink, Sparkles, User, CreditCard, 
  Keyboard, Download, Smartphone, LogOut, Edit3,
  Camera, Trash2, Loader2
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

interface ProfileFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  videoCount?: number;
}

export interface UserProfileData {
  name: string;
  email: string;
  role: string;
  plan: string;
  avatarText: string;
  avatarUrl?: string;
}

const DEFAULT_PROFILE: UserProfileData = {
  name: "Hari Kishore Reddy",
  email: "hari@rcrd.com",
  role: "Admin",
  plan: "Pro Plan",
  avatarText: "HR"
};

export function getStoredProfile(): UserProfileData {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem("rcrd_user_profile");
    const parsedProf = raw ? JSON.parse(raw) : null;
    const userRaw = localStorage.getItem("user");
    const u = userRaw ? JSON.parse(userRaw) : null;

    const name = (parsedProf?.name || u?.name || (u?.email ? u.email.split('@')[0] : '') || '').trim() || DEFAULT_PROFILE.name;
    const email = parsedProf?.email || u?.email || DEFAULT_PROFILE.email;
    const role = parsedProf?.role || u?.role || DEFAULT_PROFILE.role;
    const plan = parsedProf?.plan || 'Pro Plan';
    const avatarUrl = parsedProf?.avatarUrl || u?.avatarUrl || undefined;

    const initials = name
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'U';

    return {
      name,
      email,
      role,
      plan,
      avatarText: initials,
      avatarUrl,
    };
  } catch {}
  return DEFAULT_PROFILE;
}

export default function ProfileFlyout({
  isOpen,
  onClose,
  videoCount = 4
}: ProfileFlyoutProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<UserProfileData>(getStoredProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<UserProfileData>(getStoredProfile);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Secondary modals
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showDownloadApp, setShowDownloadApp] = useState(false);
  const [showMobileApp, setShowMobileApp] = useState(false);
  const [showChromeExt, setShowChromeExt] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    const handleUpdate = () => {
      const up = getStoredProfile();
      setProfile(up);
      setEditForm(up);
    };
    window.addEventListener("rcrd_profile_updated", handleUpdate);
    return () => window.removeEventListener("rcrd_profile_updated", handleUpdate);
  }, []);

  if (!isOpen) return null;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file.");
      return;
    }

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) {
        setIsUploadingPhoto(false);
        return;
      }

      // Resize & compress via Canvas for optimal performance
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

          const updated: UserProfileData = {
            ...profile,
            avatarUrl: compressedDataUrl,
          };
          localStorage.setItem("rcrd_user_profile", JSON.stringify(updated));
          try {
            const usr = localStorage.getItem("user");
            if (usr) {
              const u = JSON.parse(usr);
              u.avatarUrl = compressedDataUrl;
              localStorage.setItem("user", JSON.stringify(u));
            }
          } catch {}

          setProfile(updated);
          setEditForm(updated);
          setIsUploadingPhoto(false);

          // Sync to server API
          fetchWithAuth("/auth/profile", {
            method: "PATCH",
            body: JSON.stringify({ email: updated.email, avatarUrl: compressedDataUrl }),
          }).catch(() => {});

          window.dispatchEvent(new CustomEvent("rcrd_profile_updated", { detail: updated }));
          showToast("Profile photo uploaded successfully!");
        } else {
          setIsUploadingPhoto(false);
        }
      };
      img.onerror = () => setIsUploadingPhoto(false);
      img.src = src;
    };
    reader.onerror = () => setIsUploadingPhoto(false);
    reader.readAsDataURL(file);

    if (e.target) e.target.value = "";
  };

  const handleRemoveAvatar = () => {
    const updated: UserProfileData = {
      ...profile,
      avatarUrl: undefined,
    };
    localStorage.setItem("rcrd_user_profile", JSON.stringify(updated));
    try {
      const usr = localStorage.getItem("user");
      if (usr) {
        const u = JSON.parse(usr);
        delete u.avatarUrl;
        localStorage.setItem("user", JSON.stringify(u));
      }
    } catch {}

    setProfile(updated);
    setEditForm(updated);

    fetchWithAuth("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ email: updated.email, avatarUrl: null }),
    }).catch(() => {});

    window.dispatchEvent(new CustomEvent("rcrd_profile_updated", { detail: updated }));
    showToast("Profile photo removed.");
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const initials = editForm.name
      .split(" ")
      .map(n => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "HR";
    const updated = {
      ...editForm,
      avatarText: initials
    };
    localStorage.setItem("rcrd_user_profile", JSON.stringify(updated));
    setProfile(updated);
    setIsEditing(false);

    fetchWithAuth("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ email: updated.email, name: updated.name, role: updated.role }),
    }).catch(() => {});

    window.dispatchEvent(new CustomEvent("rcrd_profile_updated", { detail: updated }));
    showToast("Profile updated successfully!");
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-50 transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Flyout Sidebar (Right side, matching 5th image) */}
      <div 
        className="fixed top-0 right-0 h-full w-[340px] bg-white z-50 shadow-2xl border-l border-[#E2E7EC] flex flex-col font-sans animate-in slide-in-from-right duration-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with Close Button */}
        <div className="flex items-center justify-end p-4 border-b border-[#E2E7EC]">
          <button 
            onClick={onClose}
            className="p-1.5 text-[#57636E] hover:text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors cursor-pointer"
            aria-label="Close Profile"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          
          {/* Section 1: User Avatar & Name Card */}
          <div className="flex flex-col items-center text-center">
            {/* Clickable Avatar Circle with Hover Overlay and Badge */}
            <div 
              className="relative group/avatar cursor-pointer mb-3"
              onClick={() => fileInputRef.current?.click()}
              title="Click to upload profile photo"
            >
              <div className="w-20 h-20 rounded-full bg-[#154360] text-white flex items-center justify-center text-xl font-bold shadow-md ring-4 ring-[#EBF5FB] overflow-hidden">
                {profile.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={profile.avatarUrl} 
                    alt={profile.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span>{profile.avatarText}</span>
                )}
              </div>
              
              {/* Hover Overlay */}
              <div className="absolute inset-0 rounded-full bg-black/45 text-white flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                <Camera size={18} />
                <span className="text-[10px] font-semibold mt-0.5">Upload</span>
              </div>

              {/* Camera icon badge */}
              <div className="absolute bottom-0 right-0 p-1.5 bg-[#154360] hover:bg-[#0E2F44] text-white rounded-full shadow-md ring-2 ring-white transition-transform group-hover/avatar:scale-110">
                <Camera size={12} />
              </div>
            </div>

            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />

            <h3 className="text-base font-bold text-[#20262E]">{profile.name}</h3>
            <p className="text-xs text-[#57636E] mt-0.5">{profile.email}</p>

            {/* Photo Action Buttons */}
            <div className="flex items-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="px-3 py-1 bg-[#EBF5FB] hover:bg-[#154360]/15 text-[#154360] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isUploadingPhoto ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Camera size={12} />
                    <span>{profile.avatarUrl ? "Change photo" : "Upload photo"}</span>
                  </>
                )}
              </button>

              {profile.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="px-2 py-1 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="Remove photo"
                >
                  <Trash2 size={12} />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="mt-2.5 px-4 py-1.5 border border-[#E2E7EC] hover:border-[#154360] hover:bg-[#EBF5FB]/40 text-[#20262E] hover:text-[#0E2F44] text-xs font-semibold rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 size={12} className="text-[#154360]" />
              {isEditing ? "Cancel editing" : "Edit profile details"}
            </button>
          </div>

          {/* Inline Edit Form when editing is active */}
          {isEditing && (
            <form onSubmit={handleSaveProfile} className="bg-[#F5F6F8] p-4 rounded-xl border border-[#E2E7EC] space-y-3 animate-in fade-in duration-150">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#20262E] mb-1">Update Details</h4>
              <div>
                <label className="block text-[11px] font-semibold text-[#57636E] mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2E7EC] rounded-lg text-[#20262E] focus:border-[#154360] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#57636E] mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  required
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2E7EC] rounded-lg text-[#20262E] focus:border-[#154360] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#57636E] mb-1">Role / Job Title</label>
                <input
                  type="text"
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#E2E7EC] rounded-lg text-[#20262E] focus:border-[#154360] outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <Check size={14} />
                Save Changes
              </button>
            </form>
          )}

          {/* Section 2: Plan & Role Info (Matching 5th image) */}
          <div className="pt-4 border-t border-[#E2E7EC] space-y-1.5">
            <div 
              onClick={() => { onClose(); router.push('/settings?tab=billing'); }}
              className="text-xs font-bold text-[#154360] hover:text-[#0E2F44] cursor-pointer flex items-center justify-between group"
            >
              <span>Upgrade plan</span>
              <ExternalLink size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-[#57636E]">
              Current role: <strong className="text-[#20262E] font-semibold">{profile.role}</strong>
            </p>
            <p className="text-xs text-[#57636E]">
              Current plan: <strong className="text-[#20262E] font-semibold">{profile.plan}</strong>
            </p>
            <p className="text-xs text-[#57636E]">
              {videoCount}/25 videos
            </p>
          </div>

          {/* Section 3: AI Feature Card (Matching 5th image, Loom -> RCRD) */}
          <div className="pt-4 border-t border-[#E2E7EC]">
            <div 
              onClick={() => showToast("RCRD AI feature activated!")}
              className="p-3.5 bg-gradient-to-br from-[#EBF5FB] to-white rounded-xl border border-[#154360]/25 hover:border-[#154360] transition-all cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0E2F44] group-hover:text-[#154360]">
                <Sparkles size={14} className="text-[#154360]" />
                <span>Get RCRD AI✦</span>
              </div>
              <p className="text-[11px] text-[#57636E] mt-1 leading-relaxed">
                Create better video messages without lifting a finger
              </p>
            </div>
          </div>

          {/* Section 4: Navigational Links (Matching 5th image) */}
          <div className="pt-4 border-t border-[#E2E7EC] space-y-1">
            <button
              onClick={() => { onClose(); router.push('/settings'); }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <User size={15} className="text-[#57636E]" />
              <span>View profile</span>
            </button>

            <button
              onClick={() => { onClose(); router.push('/settings?tab=billing'); }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <CreditCard size={15} className="text-[#57636E]" />
                <span>Billing</span>
              </span>
              <ExternalLink size={12} className="text-[#57636E]" />
            </button>

            <button
              onClick={() => setShowShortcuts(true)}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <Keyboard size={15} className="text-[#57636E]" />
              <span>Keyboard shortcuts</span>
            </button>

            <button
              onClick={() => setShowChromeExt(true)}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <Download size={15} className="text-[#57636E]" />
              <span>Install Chrome extension</span>
            </button>

            <button
              onClick={() => setShowDownloadApp(true)}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <Download size={15} className="text-[#57636E]" />
              <span>Download desktop app</span>
            </button>

            <button
              onClick={() => setShowMobileApp(true)}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <Smartphone size={15} className="text-[#57636E]" />
              <span>Download mobile app</span>
            </button>
          </div>

          {/* Section 5: Sign out */}
          <div className="pt-4 border-t border-[#E2E7EC]">
            <button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                localStorage.removeItem("rcrd_user_profile");
                localStorage.removeItem("rcrd_meetings");
                try {
                  sessionStorage.clear();
                } catch {}
                onClose();
                router.push('/login');
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2.5 cursor-pointer"
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          </div>

        </div>

        {/* Interactive Toast Notification */}
        {toastMsg && (
          <div className="absolute bottom-4 left-4 right-4 bg-[#20262E] text-white text-xs px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom duration-200 z-50">
            <Check size={14} className="text-[#154360]" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E2E7EC] font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E7EC] mb-4">
              <h3 className="text-base font-bold text-[#20262E] flex items-center gap-2">
                <Keyboard size={18} className="text-[#154360]" />
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="text-[#57636E] hover:text-[#20262E]">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-[#E2E7EC]/60">
                <span className="text-[#57636E]">Start / Stop Recording</span>
                <kbd className="px-2 py-1 bg-[#F5F6F8] border border-[#E2E7EC] rounded font-mono font-bold text-[#20262E]">Ctrl + Shift + R</kbd>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#E2E7EC]/60">
                <span className="text-[#57636E]">Pause / Resume Recording</span>
                <kbd className="px-2 py-1 bg-[#F5F6F8] border border-[#E2E7EC] rounded font-mono font-bold text-[#20262E]">Ctrl + Shift + P</kbd>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[#E2E7EC]/60">
                <span className="text-[#57636E]">Toggle Microphone</span>
                <kbd className="px-2 py-1 bg-[#F5F6F8] border border-[#E2E7EC] rounded font-mono font-bold text-[#20262E]">Ctrl + Shift + M</kbd>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-[#57636E]">Cancel Recording</span>
                <kbd className="px-2 py-1 bg-[#F5F6F8] border border-[#E2E7EC] rounded font-mono font-bold text-[#20262E]">Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chrome Extension Modal */}
      {showChromeExt && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E2E7EC] font-sans text-center">
            <div className="w-12 h-12 bg-[#EBF5FB] text-[#154360] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Download size={24} />
            </div>
            <h3 className="text-base font-bold text-[#20262E]">RCRD Chrome Extension</h3>
            <p className="text-xs text-[#57636E] mt-1.5 leading-relaxed">
              Record full screen, tab, or webcam directly from Chrome with 1 click.
            </p>
            <div className="mt-5 flex gap-2">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText("https://chromewebstore.google.com");
                  showToast("Chrome Web Store link copied!");
                  setShowChromeExt(false);
                }}
                className="flex-1 py-2.5 bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Copy Extension Link
              </button>
              <button onClick={() => setShowChromeExt(false)} className="px-4 py-2.5 border border-[#E2E7EC] text-xs font-semibold rounded-xl text-[#20262E]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop App Modal */}
      {showDownloadApp && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E2E7EC] font-sans text-center">
            <div className="w-12 h-12 bg-[#EBF5FB] text-[#154360] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Download size={24} />
            </div>
            <h3 className="text-base font-bold text-[#20262E]">Download RCRD Desktop</h3>
            <p className="text-xs text-[#57636E] mt-1.5 leading-relaxed">
              Native desktop app for Windows and macOS with system tray hotkeys.
            </p>
            <div className="mt-5 flex gap-2">
              <button 
                onClick={() => {
                  showToast("Starting Windows desktop installer download...");
                  setShowDownloadApp(false);
                }}
                className="flex-1 py-2.5 bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Download for Windows
              </button>
              <button 
                onClick={() => {
                  showToast("Starting macOS desktop installer download...");
                  setShowDownloadApp(false);
                }}
                className="flex-1 py-2.5 bg-white border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                macOS (.dmg)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile App Modal */}
      {showMobileApp && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E2E7EC] font-sans text-center">
            <div className="w-12 h-12 bg-[#EBF5FB] text-[#154360] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Smartphone size={24} />
            </div>
            <h3 className="text-base font-bold text-[#20262E]">RCRD for iOS & Android</h3>
            <p className="text-xs text-[#57636E] mt-1.5 leading-relaxed">
              Record and view video messages on your phone on the go.
            </p>
            <div className="mt-5 flex gap-2">
              <button 
                onClick={() => {
                  showToast("Redirecting to App Store...");
                  setShowMobileApp(false);
                }}
                className="flex-1 py-2.5 bg-[#154360] hover:bg-[#0E2F44] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Apple App Store
              </button>
              <button 
                onClick={() => {
                  showToast("Redirecting to Google Play...");
                  setShowMobileApp(false);
                }}
                className="flex-1 py-2.5 bg-white border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Google Play
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
