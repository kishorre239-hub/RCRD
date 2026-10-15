"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, Bell, Settings, Video, Folder, 
  Play, Share2, Users, Shield, Building,
  ChevronDown, Monitor, Camera, Mic, X,
  Square, Pause, RotateCcw, Trash2, Home, Zap, Loader2, Bookmark
} from "lucide-react";
import Image from "next/image";
import { uploadVideo } from "../lib/api";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import RecordingSetupModal from "@/components/RecordingSetupModal";

export default function HomePage() {
  const router = useRouter();
  
  // App States
  // Recording Setup Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSeenTour = localStorage.getItem("hasSeenTour");
      if (!hasSeenTour) {
        const driverObj = driver({
          showProgress: true,
          steps: [
            { element: '#tour-sidebar-home', popover: { title: 'Dashboard', description: 'This is your main dashboard where you can start a recording instantly.' } },
            { element: '#tour-sidebar-library', popover: { title: 'My Library', description: 'Access all your past recorded videos, folders, and shared content.' } },
            { element: '#tour-sidebar-meetings', popover: { title: 'Meetings', description: 'Schedule or join live meetings and access past meeting recordings.' } },
            { element: '#tour-sidebar-settings', popover: { title: 'Settings', description: 'Manage your profile, team settings, and recording preferences.' } },
            { element: '#tour-record-btn', popover: { title: 'Record Video', description: 'Click here anytime to start a new screen or camera recording.' } },
          ],
          onDestroyStarted: () => {
            if (!driverObj.hasNextStep() || confirm("Are you sure you want to skip the tutorial?")) {
              localStorage.setItem("hasSeenTour", "true");
              driverObj.destroy();
            }
          },
        });
        driverObj.drive();
      }
    }
  }, []);



  return (
    <div className="relative flex h-full w-full bg-[#FAFAFA] text-slate-800 font-outfit overflow-hidden selection:bg-[#0E71EB]/20">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none"></div>

      {/* Sidebar - Crisp Light Mode */}
      <aside className="w-[280px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-white z-20 h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="h-16 flex items-center px-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-center w-full cursor-pointer group" onClick={() => router.push('/')}>
            <Image src="/ICONS/COMPANY_NAME-cropped.png" alt="RCRD." width={120} height={48} className="h-12 w-auto object-contain transition-transform group-hover:scale-105" />
          </div>
        </div>

        <div className="p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-all border border-slate-100 hover:border-slate-200 group">
            <div>
              <div className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">RCRD Workspace</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded text-blue-700 font-bold border border-blue-200">Pro Plan</span>
                <span className="text-xs text-slate-500">Team Space</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>
          <button className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all shadow-sm hover:shadow-md">
            <Users className="w-4 h-4 text-blue-600" />
            Invite Teammates
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-4 custom-scrollbar min-h-0">
          <nav className="space-y-1">
            <div id="tour-sidebar-home"><SidebarItem icon={<Home size={18} />} label="For You" active href="/" /></div>
            <div id="tour-sidebar-library"><SidebarItem icon={<Folder size={18} />} label="Library" href="/library" /></div>
            <div id="tour-sidebar-meetings"><SidebarItem icon={<Video size={18} />} label="Meetings" href="/meetings" /></div>
            <SidebarItem icon={<Bookmark size={18} />} label="Watch Later" href="/watch-later" />
            <div id="tour-sidebar-settings"><SidebarItem icon={<Settings size={18} />} label="Settings" href="/settings" /></div>
          </nav>

          <div className="mt-10">
            <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Workspace Admin</h3>
            <nav className="space-y-1">
              <SidebarItem icon={<Settings size={18} />} label="Manage Users" href="/settings?tab=users" />
              <SidebarItem icon={<Building size={18} />} label="Workspace Info" />
              <SidebarItem icon={<Shield size={18} />} label="Billing & Plans" href="/settings?tab=billing" />
            </nav>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <button 
            id="tour-record-btn"
            onClick={() => setIsRecordModalOpen(true)}
            className="w-full bg-[#1A68FF] hover:bg-[#1557D6] text-white py-3.5 px-6 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 shadow-[0_10px_25px_-5px_rgba(26,104,255,0.45)] hover:shadow-[0_14px_28px_-5px_rgba(26,104,255,0.55)] transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <Video size={20} className="stroke-[2.2]" />
            <span>Record Video</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative z-10 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-white/80  border-b border-slate-200 shrink-0 z-20 shadow-sm">
          <div className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search for videos, folders, tags, or people..." 
              className="w-full pl-11 pr-4 py-2 bg-slate-100 border border-transparent rounded-xl text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-5 ml-4 shrink-0">
            <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-2">
              <Zap size={14} className="text-amber-500 fill-amber-500" /> Upgrade
            </button>
            <button className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-bold cursor-pointer shadow-md hover:scale-105 transition-transform border border-blue-500">
              HR
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center pt-24 px-8 relative custom-scrollbar min-h-0">
          
          {/* Animated Clean Orb / Camera Graphic */}
          <div className="relative mb-10 w-48 h-48 flex items-center justify-center group cursor-pointer" onClick={() => setIsRecordModalOpen(true)}>
            {/* Background Image instead of glowing circle */}
            <div className="absolute inset-0 flex items-center justify-center blur-md opacity-50 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700">
              <Image src="/ICONS/WhatsApp_Image_2026-09-25_at_11.50.51_AM-removebg-preview.png" width={160} height={160} className="w-full h-full object-contain" alt="" />
            </div>
            
            <Image 
              src="/ICONS/WhatsApp_Image_2026-09-25_at_11.50.51_AM-removebg-preview.png" 
              alt="icon" 
              width={160}
              height={160}
              className="relative z-10 w-40 h-40 object-contain animate-float group-hover:scale-110 transition-transform duration-500" 
            />
            
            {/* Floating particles */}
            <div className="absolute top-2 right-2 w-3 h-3 bg-blue-400 rounded-full opacity-60 animate-bounce delay-75"></div>
            <div className="absolute bottom-4 left-0 w-2 h-2 bg-blue-400 rounded-full opacity-60 animate-bounce delay-300"></div>
          </div>

          <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight text-center">
            Capture Your Screen in Seconds
          </h1>
          <p className="text-slate-500 mb-12 max-w-md text-center text-lg leading-relaxed">
            Record, share, and collaborate with async video messages that bring your team closer together.
          </p>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsRecordModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all shadow-[0_8px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_12px_25px_rgba(37,99,235,0.35)] transform hover:-translate-y-1"
            >
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Video size={18} className="fill-white" />
              </div>
              Start Recording
            </button>
          </div>

        </div>

        {/* RECORDING SETUP MODAL */}
        <RecordingSetupModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          onRecordingComplete={() => router.push('/library')}
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
    }`}>
      <div className="flex items-center gap-3">
        <div className={`${active ? "text-blue-600" : "text-slate-400"}`}>
          {icon}
        </div>
        <span className="text-sm tracking-wide">{label}</span>
      </div>
      {external && <div className="text-slate-400"><Share2 size={12} className="rotate-45" /></div>}
    </div>
  );
}


/* 
<div className="fixed bottom-4 right-4 flex gap-4 bg-white p-4 shadow-xl rounded-xl z-50">
  <Link href="/signup" className="font-bold text-blue-600 hover:underline">Signup UI</Link>
  <Link href="/id-cards" className="font-bold text-blue-600 hover:underline">ID Cards UI</Link>
</div>
*/
