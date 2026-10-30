"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Share2,
  Upload, Calendar, X
} from "lucide-react";
import {
  HomeIcon, LibraryIcon, VideoCameraIcon, SettingsIcon,
  UserIcon, WorkspaceIcon
} from "@/components/CustomIcons";
import Image from "next/image";
import "driver.js/dist/driver.css";
import UploadVideoModal from "@/components/UploadVideoModal";
import RcrdLogo from "@/components/RcrdLogo";
import ProfileFlyout from "@/components/ProfileFlyout";
import AppHeader from "@/components/AppHeader";
import { openGlobalRecording } from "@/components/GlobalRecordingManager";
import RecordVideoButton from "@/components/RecordVideoButton";
import { useNavPermissions } from "@/lib/navPermissions";

export default function HomePage() {
  const router = useRouter();
  const { canAccess } = useNavPermissions();
  
  // App States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="relative flex h-full w-full bg-[#F8FAFC] text-[#0F172A] font-sans overflow-hidden selection:bg-[#4F46E5]/20">
      
      {/* Background Ambient Glow in Indigo and Cyan Accent */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#EEF2FF]/50 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#06B6D4]/10 blur-[120px] pointer-events-none"></div>

      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Midnight Navy #0F172A with active glow indicator in #4F46E5 */}
      <aside className={`w-[280px] flex-shrink-0 flex-col border-r border-[#1E293B] bg-[#0F172A] h-full shadow-[4px_0_24px_rgba(0,0,0,0.15)] overflow-hidden transition-all duration-300 ${
        isMobileMenuOpen 
          ? "fixed inset-y-0 left-0 flex z-50 shadow-2xl" 
          : "hidden md:flex z-20"
      }`}>
        <div className="relative h-24 sm:h-26 flex items-center justify-center px-4 border-b border-[#1E293B] flex-shrink-0 w-full overflow-hidden bg-[#0F172A]">
          <div 
            className="flex items-center justify-center cursor-pointer group mx-auto" 
            onClick={() => { router.push('/'); setIsMobileMenuOpen(false); }}
          >
            <RcrdLogo className="h-20 sm:h-22 md:h-24 w-auto scale-175 sm:scale-190 md:scale-205 origin-center transition-transform group-hover:scale-215" />
          </div>
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 md:hidden p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-4 custom-scrollbar min-h-0 bg-[#0F172A]">
          <nav className="space-y-1">
            {canAccess('for-you') && <div id="tour-sidebar-home"><SidebarItem icon={<HomeIcon size={18} />} label="For You" active href="/" /></div>}
            {canAccess('library') && <div id="tour-sidebar-library"><SidebarItem icon={<LibraryIcon size={18} />} label="Library" href="/library" /></div>}
            {canAccess('meetings') && <div id="tour-sidebar-meetings"><SidebarItem icon={<VideoCameraIcon size={18} />} label="Meetings" href="/meetings" /></div>}
            {canAccess('settings') && <div id="tour-sidebar-settings"><SidebarItem icon={<SettingsIcon size={18} />} label="Settings" href="/settings" /></div>}
          </nav>

          {(canAccess('manage-users') || canAccess('workspace-info')) && (
            <div className="mt-10">
              <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-3">Workspace Admin</h3>
              <nav className="space-y-1">
                {canAccess('manage-users') && <SidebarItem icon={<UserIcon size={18} />} label="Manage Users" href="/settings?tab=users" />}
                {canAccess('workspace-info') && <SidebarItem icon={<WorkspaceIcon size={18} />} label="Workspace Info" href="/settings?tab=workspace" />}
              </nav>
            </div>
          )}
        </div>

        <RecordVideoButton 
          id="tour-record-btn"
          onClick={() => { openGlobalRecording(); setIsMobileMenuOpen(false); }}
        />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative z-10 bg-[#F8FAFC] overflow-hidden">
        
        {/* Top Header - Unified Fixed h-16, Centered Search */}
        <AppHeader 
          placeholder="Search for videos, folders, tags, or people..."
          onOpenProfile={() => setIsProfileOpen(true)}
          onToggleMobileSidebar={() => setIsMobileMenuOpen(prev => !prev)}
        />

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center pt-8 sm:pt-10 px-4 sm:px-8 relative custom-scrollbar min-h-0 bg-[#F8FAFC]">
          
          {/* Animated Clean Orb / Camera Graphic */}
          <div className="relative mb-6 w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center group cursor-pointer" onClick={() => openGlobalRecording()}>
            <div className="absolute inset-0 flex items-center justify-center blur-md opacity-30 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700">
              <Image 
                src="/ICONS/center-orb.svg" 
                width={140} 
                height={140} 
                className="w-full h-full object-contain" 
                alt="" 
              />
            </div>
            
            <Image 
              src="/ICONS/center-orb.svg" 
              alt="Record Orb" 
              width={140}
              height={140}
              className="relative z-10 w-28 h-28 sm:w-32 sm:h-32 object-contain animate-float group-hover:scale-110 transition-transform duration-500" 
            />
            
            {/* Floating particles in Brand Indigo and Geospatial Cyan */}
            <div className="absolute top-2 right-2 w-3 h-3 bg-[#4F46E5] rounded-full opacity-80 animate-bounce delay-75 shadow-[0_0_8px_#4F46E5]"></div>
            <div className="absolute bottom-4 left-0 w-2.5 h-2.5 bg-[#06B6D4] rounded-full opacity-80 animate-bounce delay-300 shadow-[0_0_8px_#06B6D4]"></div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] mb-3 tracking-tight text-center">
            Capture Your Screen in Seconds
          </h1>
          <p className="text-[#475569] mb-8 max-w-lg text-center text-sm sm:text-base leading-relaxed px-2">
            Record, share, and collaborate with async video messages that bring your team closer together.
          </p>

          {/* Action Buttons: Start Recording + Upload Video + Schedule Meeting */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none px-4 mb-12">
            
            {/* 1. Start Recording Button */}
            <button 
              onClick={() => openGlobalRecording()}
              className="w-full sm:w-auto bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-3.5 sm:py-3 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all shadow-[0_8px_20px_rgba(79,70,229,0.35)] hover:shadow-[0_12px_28px_rgba(79,70,229,0.45)] transform hover:-translate-y-0.5 active:scale-95 cursor-pointer text-sm"
            >
              <div className="bg-white/20 p-1 rounded-lg">
                <VideoCameraIcon size={16} className="text-white" />
              </div>
              <span>Start Recording</span>
            </button>

            {/* 2. Upload Video Button */}
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="w-full sm:w-auto bg-white hover:bg-[#EEF2FF]/60 text-[#0F172A] border-2 border-[#E2E8F0] hover:border-[#4F46E5] px-6 py-3.5 sm:py-3 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all shadow-xs hover:shadow-sm transform hover:-translate-y-0.5 active:scale-95 cursor-pointer text-sm"
            >
              <div className="bg-[#EEF2FF] p-1 rounded-lg text-[#4F46E5]">
                <Upload size={16} className="stroke-[2.5]" />
              </div>
              <span>Upload a Video</span>
            </button>

            {/* 3. Schedule Meeting Button */}
            <button 
              onClick={() => router.push('/meetings?schedule=true')}
              className="w-full sm:w-auto bg-white hover:bg-[#EEF2FF]/60 text-[#0F172A] border-2 border-[#E2E8F0] hover:border-[#4F46E5] px-6 py-3.5 sm:py-3 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all shadow-xs hover:shadow-sm transform hover:-translate-y-0.5 active:scale-95 cursor-pointer text-sm"
            >
              <div className="bg-[#EEF2FF] p-1 rounded-lg text-[#4F46E5]">
                <Calendar size={16} className="stroke-[2.5]" />
              </div>
              <span>Schedule Meeting</span>
            </button>
          </div>

        </div>

        {/* Profile Sidebar Flyout */}
        <ProfileFlyout
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />

        {/* UPLOAD VIDEO TO PROJECT FOLDER MODAL */}
        <UploadVideoModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadComplete={() => router.push('/library')}
        />
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, external = false, href }: { icon: React.ReactNode, label: string, active?: boolean, external?: boolean, href?: string }) {
  const router = useRouter();
  
  return (
    <div 
      onClick={() => href && router.push(href)}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all ${
      active 
        ? "bg-[#4F46E5] text-white shadow-[0_0_16px_rgba(79,70,229,0.45)] font-bold" 
        : "hover:bg-white/5 text-[#94A3B8] hover:text-[#F8FAFC]"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`${active ? "text-white" : "text-[#94A3B8]"}`}>
          {icon}
        </div>
        <span className="text-sm tracking-wide">{label}</span>
      </div>
      {external && <div className="text-[#94A3B8]"><Share2 size={12} className="rotate-45" /></div>}
    </div>
  );
}


/* 
<div className="fixed bottom-4 right-4 flex gap-4 bg-white p-4 shadow-xl rounded-xl z-50">
  <Link href="/signup" className="font-bold text-[#4F46E5] hover:underline">Signup UI</Link>
  <Link href="/id-cards" className="font-bold text-[#4F46E5] hover:underline">ID Cards UI</Link>
</div>
*/
