"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Video, 
  Share2, Shield,
  ChevronDown, Upload, Calendar
} from "lucide-react";
import {
  HomeIcon, LibraryIcon, VideoCameraIcon, CalendarIcon, SettingsIcon,
  UsersIcon, UserIcon, WorkspaceIcon
} from "@/components/CustomIcons";
import Image from "next/image";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import RecordingSetupModal from "@/components/RecordingSetupModal";
import UploadVideoModal from "@/components/UploadVideoModal";
import RcrdLogo from "@/components/RcrdLogo";
import ProfileFlyout, { getStoredProfile } from "@/components/ProfileFlyout";
import HariInsights from "@/components/HariInsights";

export default function HomePage() {
  const router = useRouter();
  
  // App States
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState(getStoredProfile());

  useEffect(() => {
    const handleProfileUpdate = () => {
      setProfile(getStoredProfile());
    };
    window.addEventListener("rcrd_profile_updated", handleProfileUpdate);
    return () => window.removeEventListener("rcrd_profile_updated", handleProfileUpdate);
  }, []);

  return (
    <div className="relative flex h-full w-full bg-[#F5F6F8] text-[#20262E] font-sans overflow-hidden selection:bg-[#0CAA41]/20">
      
      {/* Background Ambient Glow in Glassdoor Mint */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#E6F6EC]/30 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#E6F6EC]/30 blur-[120px] pointer-events-none"></div>

      {/* Sidebar - Crisp Light Mode */}
      <aside className="w-[280px] flex-shrink-0 flex flex-col border-r border-[#E2E7EC] bg-white z-20 h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="h-16 flex items-center px-6 border-b border-[#E2E7EC] flex-shrink-0">
          <div className="flex items-center justify-start w-full cursor-pointer group" onClick={() => router.push('/')}>
            <RcrdLogo className="h-8 w-auto transition-transform group-hover:scale-105" />
          </div>
        </div>

        <div className="p-5 border-b border-[#E2E7EC] flex-shrink-0">
          <div className="flex items-center justify-between p-3 bg-[#F5F6F8] hover:bg-[#E6F6EC]/40 rounded-xl cursor-pointer transition-all border border-[#E2E7EC] group">
            <div>
              <div className="text-sm font-semibold text-[#20262E] group-hover:text-[#0CAA41] transition-colors">RCRD Workspace</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] uppercase tracking-wider bg-[#E6F6EC] px-2 py-0.5 rounded text-[#0CAA41] font-bold border border-[#0CAA41]/20">Pro Plan</span>
                <span className="text-xs text-[#57636E]">Team Space</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#57636E] group-hover:text-[#20262E] transition-colors" />
          </div>
          <button 
            onClick={() => router.push('/settings?tab=users')}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-[#E6F6EC]/50 border border-[#E2E7EC] hover:border-[#0CAA41]/30 rounded-xl text-sm font-semibold text-[#20262E] transition-all shadow-xs cursor-pointer"
          >
            <UsersIcon size={16} className="text-[#0CAA41]" />
            Invite Teammates
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-4 custom-scrollbar min-h-0">
          <nav className="space-y-1">
            <div id="tour-sidebar-home"><SidebarItem icon={<HomeIcon size={18} />} label="For You" active href="/" /></div>
            <div id="tour-sidebar-library"><SidebarItem icon={<LibraryIcon size={18} />} label="Library" href="/library" /></div>
            <div id="tour-sidebar-meetings"><SidebarItem icon={<VideoCameraIcon size={18} />} label="Meetings" href="/meetings" /></div>
            <SidebarItem icon={<CalendarIcon size={18} />} label="Calendar" href="/calendar" />
            <div id="tour-sidebar-settings"><SidebarItem icon={<SettingsIcon size={18} />} label="Settings" href="/settings" /></div>
          </nav>

          <div className="mt-10">
            <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#57636E] mb-3">Workspace Admin</h3>
            <nav className="space-y-1">
              <SidebarItem icon={<UserIcon size={18} />} label="Manage Users" href="/settings?tab=users" />
              <SidebarItem icon={<WorkspaceIcon size={18} />} label="Workspace Info" href="/settings" />
              <SidebarItem icon={<Shield size={18} />} label="Billing & Plans" href="/settings?tab=billing" />
            </nav>
          </div>
        </div>

        <div className="p-5 border-t border-[#E2E7EC] bg-white flex-shrink-0">
          <button 
            id="tour-record-btn"
            onClick={() => setIsRecordModalOpen(true)}
            className="w-full bg-[#0CAA41] hover:bg-[#0C5325] text-white py-3.5 px-6 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 shadow-[0_10px_25px_-5px_rgba(12,170,65,0.45)] hover:shadow-[0_14px_28px_-5px_rgba(12,83,37,0.55)] transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <VideoCameraIcon size={20} />
            <span>Record Video</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative z-10 bg-[#F5F6F8] overflow-hidden">
        
        {/* Top Header - Clean, 4th image type icons removed */}
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-[#E2E7EC] shrink-0 z-20 shadow-xs">
          <div className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#57636E] group-focus-within:text-[#0CAA41] transition-colors" />
            <input 
              type="text" 
              placeholder="Search for videos, folders, tags, or people..." 
              className="w-full pl-11 pr-4 py-2 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] focus:bg-white focus:border-[#0CAA41] focus:ring-4 focus:ring-[#0CAA41]/10 outline-none transition-all placeholder:text-[#57636E] font-medium"
            />
          </div>
          
          {/* Header Action: Profile Avatar (Opens 5th Image Profile Flyout) */}
          <div className="flex items-center ml-4 shrink-0">
            <div 
              onClick={() => setIsProfileOpen(true)}
              className="w-9 h-9 rounded-full bg-[#0CAA41] text-white flex items-center justify-center text-sm font-bold cursor-pointer shadow-sm hover:scale-105 transition-transform ring-2 ring-[#E6F6EC]"
              title="Open profile menu"
            >
              {profile.avatarText}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center pt-10 px-8 relative custom-scrollbar min-h-0 bg-[#F5F6F8]">
          
          {/* Animated Clean Orb / Camera Graphic in Glassdoor Green */}
          <div className="relative mb-6 w-40 h-40 flex items-center justify-center group cursor-pointer" onClick={() => setIsRecordModalOpen(true)}>
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
              className="relative z-10 w-32 h-32 object-contain animate-float group-hover:scale-110 transition-transform duration-500" 
            />
            
            {/* Floating particles in Mint and Glassdoor Green */}
            <div className="absolute top-2 right-2 w-3 h-3 bg-[#0CAA41] rounded-full opacity-80 animate-bounce delay-75"></div>
            <div className="absolute bottom-4 left-0 w-2.5 h-2.5 bg-[#0C5325] rounded-full opacity-80 animate-bounce delay-300"></div>
          </div>

          <h1 className="text-3xl font-extrabold text-[#20262E] mb-3 tracking-tight text-center">
            Capture Your Screen in Seconds
          </h1>
          <p className="text-[#57636E] mb-8 max-w-lg text-center text-base leading-relaxed">
            Record, share, and collaborate with async video messages that bring your team closer together.
          </p>

          {/* Action Buttons: Start Recording + Upload Video + Schedule Meeting */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            
            {/* 1. Start Recording Button */}
            <button 
              onClick={() => setIsRecordModalOpen(true)}
              className="bg-[#0CAA41] hover:bg-[#0C5325] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2.5 transition-all shadow-[0_8px_20px_rgba(12,170,65,0.35)] hover:shadow-[0_12px_28px_rgba(12,83,37,0.45)] transform hover:-translate-y-0.5 active:scale-95 cursor-pointer text-sm"
            >
              <div className="bg-white/20 p-1 rounded-lg">
                <VideoCameraIcon size={16} className="text-white" />
              </div>
              <span>Start Recording</span>
            </button>

            {/* 2. Upload Video Button */}
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-white hover:bg-[#E6F6EC]/40 text-[#20262E] border-2 border-[#E2E7EC] hover:border-[#0CAA41] px-6 py-3 rounded-2xl font-bold flex items-center gap-2.5 transition-all shadow-xs hover:shadow-sm transform hover:-translate-y-0.5 active:scale-95 cursor-pointer text-sm"
            >
              <div className="bg-[#E6F6EC] p-1 rounded-lg text-[#0CAA41]">
                <Upload size={16} className="stroke-[2.5]" />
              </div>
              <span>Upload a Video</span>
            </button>

            {/* 3. Schedule Meeting Button */}
            <button 
              onClick={() => router.push('/meetings?schedule=true')}
              className="bg-white hover:bg-[#E6F6EC]/40 text-[#20262E] border-2 border-[#E2E7EC] hover:border-[#0CAA41] px-6 py-3 rounded-2xl font-bold flex items-center gap-2.5 transition-all shadow-xs hover:shadow-sm transform hover:-translate-y-0.5 active:scale-95 cursor-pointer text-sm"
            >
              <div className="bg-[#E6F6EC] p-1 rounded-lg text-[#0CAA41]">
                <Calendar size={16} className="stroke-[2.5]" />
              </div>
              <span>Schedule Meeting</span>
            </button>
          </div>

          {/* Hari's Insights Grid (Matching Image 5) */}
          <HariInsights 
            userName={profile.name.split(" ")[0]}
            onStartRecord={() => setIsRecordModalOpen(true)}
          />

        </div>

        {/* Profile Sidebar Flyout (5th Image) */}
        <ProfileFlyout
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
        />

        {/* RECORDING SETUP MODAL */}
        <RecordingSetupModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          onRecordingComplete={() => router.push('/library')}
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
      style={{
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: '14px',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '14px',
        letterSpacing: 'normal',
        color: active ? '#0CAA41' : '#292A2E'
      }}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all ${
      active 
        ? "bg-[#E6F6EC] text-[#0CAA41] shadow-sm font-bold" 
        : "hover:bg-[#F5F6F8] text-[#20262E]"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`${active ? "text-[#0CAA41]" : "text-[#57636E]"}`}>
          {icon}
        </div>
        <span className="text-sm tracking-wide">{label}</span>
      </div>
      {external && <div className="text-[#57636E]"><Share2 size={12} className="rotate-45" /></div>}
    </div>
  );
}


/* 
<div className="fixed bottom-4 right-4 flex gap-4 bg-white p-4 shadow-xl rounded-xl z-50">
  <Link href="/signup" className="font-bold text-[#0CAA41] hover:underline">Signup UI</Link>
  <Link href="/id-cards" className="font-bold text-[#0CAA41] hover:underline">ID Cards UI</Link>
</div>
*/
