"use client";

import React from "react";
import { Search, Menu } from "lucide-react";
import UserAvatarIcon from "@/components/UserAvatarIcon";

interface AppHeaderProps {
  placeholder?: string;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onOpenProfile: () => void;
  onToggleMobileSidebar?: () => void;
}

export default function AppHeader({
  placeholder = "Search for videos, folders, tags, or people...",
  searchQuery,
  onSearchChange,
  onOpenProfile,
  onToggleMobileSidebar,
}: AppHeaderProps) {
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const prof = localStorage.getItem("rcrd_user_profile");
      if (prof) {
        const p = JSON.parse(prof);
        if (p.avatarUrl) return p.avatarUrl;
      }
      const usr = localStorage.getItem("user");
      if (usr) {
        const u = JSON.parse(usr);
        if (u.avatarUrl) return u.avatarUrl;
      }
    } catch {}
    return null;
  });

  React.useEffect(() => {
    const handleProfileUpdate = () => {
      try {
        const prof = localStorage.getItem("rcrd_user_profile");
        if (prof) {
          const p = JSON.parse(prof);
          setAvatarUrl(p.avatarUrl || null);
          return;
        }
        const usr = localStorage.getItem("user");
        if (usr) {
          const u = JSON.parse(usr);
          setAvatarUrl(u.avatarUrl || null);
          return;
        }
      } catch {}
      setAvatarUrl(null);
    };

    window.addEventListener("rcrd_profile_updated", handleProfileUpdate);
    window.addEventListener("storage", handleProfileUpdate);
    return () => {
      window.removeEventListener("rcrd_profile_updated", handleProfileUpdate);
      window.removeEventListener("storage", handleProfileUpdate);
    };
  }, []);

  return (
    <header className="h-16 flex items-center justify-between px-4 sm:px-6 md:px-8 bg-white border-b border-[#E2E7EC] shrink-0 flex-shrink-0 z-20 shadow-xs">
      {/* Left Section: Mobile Menu Toggle Button */}
      <div className="flex items-center shrink-0 w-9">
        {onToggleMobileSidebar ? (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 -ml-2 text-[#57636E] hover:text-[#20262E] hover:bg-[#F5F6F8] rounded-xl transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5 text-[#57636E]" />
          </button>
        ) : (
          <div className="w-5 md:w-0" />
        )}
      </div>

      {/* Center Section: Perfectly Centered Search Bar */}
      <div className="flex-1 flex justify-center px-2 sm:px-6 max-w-2xl mx-auto">
        <div className="w-full relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57636E] group-focus-within:text-[#154360] transition-colors pointer-events-none" />
          <input
            type="text"
            value={searchQuery !== undefined ? searchQuery : undefined}
            onChange={onSearchChange ? (e) => onSearchChange(e.target.value) : undefined}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] focus:bg-white focus:border-[#154360] focus:ring-4 focus:ring-[#154360]/10 outline-none transition-all placeholder:text-[#57636E] font-medium"
          />
        </div>
      </div>

      {/* Right Section: Image 5 Profile Avatar */}
      <div className="flex items-center shrink-0 w-9 justify-end">
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-10 h-10 rounded-full flex items-center justify-center p-0.5 hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-[#E2E7EC] hover:border-[#154360]/50 bg-white shadow-xs group overflow-hidden"
          title="Open profile menu"
          aria-label="Open profile menu"
        >
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt="Mentor Profile" 
              className="w-full h-full rounded-full object-cover" 
            />
          ) : (
            <UserAvatarIcon size={34} className="w-8 h-8 transition-transform group-hover:scale-105" />
          )}
        </button>
      </div>
    </header>
  );
}
