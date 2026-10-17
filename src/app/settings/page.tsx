"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ExternalLink, 
  ChevronDown, Info, Download, Globe, HardDrive,
  Shield, Share2, Bell, Cloud, Check, X
} from "lucide-react";
import {
  HomeIcon, LibraryIcon, VideoCameraIcon, CalendarIcon, SettingsIcon,
  UsersIcon, UserIcon, WorkspaceIcon
} from "@/components/CustomIcons";
import { 
  saveDriveFolder, getDriveFolder 
} from '@/lib/api';
import BillingTab from '@/components/BillingTab';
import UsersTab from '@/components/UsersTab';
import RecordingSetupModal from '@/components/RecordingSetupModal';
import RcrdLogo from "@/components/RcrdLogo";
import ProfileFlyout, { getStoredProfile, UserProfileData } from "@/components/ProfileFlyout";
import AppHeader from "@/components/AppHeader";

interface PushDeviceSetting {
  email?: boolean;
  desktop?: boolean;
  mobile?: boolean;
}

type PushCategoryData = Record<string, PushDeviceSetting>;

interface PushNotificationsData {
  enabled: boolean;
  engagement: PushCategoryData;
  videoSharing: PushCategoryData;
  videoStitching: PushCategoryData;
  education: PushCategoryData;
  spaces: PushCategoryData;
  watchLater: PushCategoryData;
  [key: string]: boolean | PushCategoryData;
}

interface MeetingRecordingsState {
  autoRecording: string;
  meetingRecap: string;
  linkAccess: string;
  languageSetting: string;
}

// PushRow declared outside of render to prevent recreation and React lint errors
function PushRow({
  label,
  category,
  item,
  email = true,
  desktop = true,
  mobile = true,
  pushNotifications,
  onToggle
}: {
  label: string;
  category: keyof PushNotificationsData;
  item: string;
  email?: boolean;
  desktop?: boolean;
  mobile?: boolean;
  pushNotifications: PushNotificationsData;
  onToggle: (category: keyof PushNotificationsData, item: string, device: 'email' | 'desktop' | 'mobile') => void;
}) {
  const catObj = pushNotifications[category] as PushCategoryData | undefined;
  const itemObj = catObj?.[item];

  const renderBtn = (device: 'email' | 'desktop' | 'mobile', visible: boolean) => {
    if (!visible || !itemObj || itemObj[device] === undefined) return <div className="w-11"></div>;
    const isActive = itemObj[device];
    return (
      <button 
        onClick={() => onToggle(category, item, device)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-[#154360]' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    );
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-[#E2E7EC] last:border-0 hover:bg-[#F5F6F8] transition-colors px-2">
      <div className="flex-1 text-[13px] text-[#20262E]">{label}</div>
      <div className="flex items-center gap-16 pr-8">
        <div className="w-16 flex justify-center">{renderBtn('email', email)}</div>
        <div className="w-16 flex justify-center">{renderBtn('desktop', desktop)}</div>
        <div className="w-16 flex justify-center">{renderBtn('mobile', mobile)}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Tab State
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      return p.get("tab") || "my-account";
    }
    return "my-account";
  });

  // Form State
  const [videoAccess, setVideoAccess] = useState("Public");
  const [useShortcuts, setUseShortcuts] = useState(true);
  
  // Google Drive State
  const [driveLink, setDriveLink] = useState("");
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [driveSaveMessage, setDriveSaveMessage] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  
  // Integrations State
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({
    dropbox: true,
    github: true,
    gitlab: true,
    gmail: true,
    googleDocs: true,
    hackerNews: true,
    intercom: true,
    jira: true,
    productHunt: true,
    salesforce: true,
    salesforceIQ: true
  });
  
  // Quick Record State
  const [quickRecordEnabled, setQuickRecordEnabled] = useState(true);

  // Meeting Recordings State
  const [meetingRecordings, setMeetingRecordings] = useState<MeetingRecordingsState>({
    autoRecording: 'All meetings',
    meetingRecap: 'Only internal invitees',
    linkAccess: 'Private',
    languageSetting: 'Auto-detect language'
  });

  // Push Notifications State
  const [pushNotifications, setPushNotifications] = useState<PushNotificationsData>({
    enabled: false,
    engagement: {
      firstViewed: { email: true, desktop: true, mobile: true },
      comments: { email: true, desktop: true, mobile: true },
      reactionsToComments: { email: false, desktop: true, mobile: true },
      reactionsOnVideos: { email: true, desktop: true, mobile: false },
      repliesToComments: { email: true, desktop: true, mobile: false },
      mentionedComment: { email: true, desktop: true, mobile: true },
      followsMe: { email: true, desktop: true, mobile: true },
      mentionedTask: { email: true, desktop: true, mobile: true },
      respondsTask: { email: true, desktop: true, mobile: true },
      transcriptSuccess: { email: true, desktop: true, mobile: false },
      transcriptFail: { email: true, desktop: true, mobile: false }
    },
    videoSharing: {
      sharesVideo: { email: true, desktop: true, mobile: true },
      resharesVideo: { email: false, desktop: true, mobile: true },
      changesPrivacy: { email: false, desktop: true, mobile: true }
    },
    videoStitching: {
      addsVideo: { email: true, desktop: true, mobile: true },
      firstViewed: { email: true, desktop: true, mobile: true }
    },
    education: {
      reminders: { email: true, desktop: true, mobile: false },
      insights: { email: true, desktop: false, mobile: false }
    },
    spaces: {
      addsToSpace: { email: true, desktop: true, mobile: true },
      sharesToAllSpace: { email: false, desktop: false, mobile: false },
      sharesToOtherSpace: { email: true, desktop: true, mobile: true },
      adminRemoves: { email: true, desktop: true, mobile: true },
      spaceArchived: { email: true, desktop: true, mobile: true }
    },
    watchLater: {
      morningDigest: { email: true, desktop: false, mobile: true },
      weekdaysOnly: { email: false, desktop: false, mobile: false }
    }
  });

  // Mounted state to prevent overwriting local storage on load
  const [isMounted, setIsMounted] = useState(false);

  // Initialize from LocalStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = localStorage.getItem('RCRD_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.videoAccess) setVideoAccess(parsed.videoAccess);
          if (parsed.useShortcuts !== undefined) setUseShortcuts(parsed.useShortcuts);
          if (parsed.integrations) setIntegrations(parsed.integrations);
          if (parsed.quickRecordEnabled !== undefined) setQuickRecordEnabled(parsed.quickRecordEnabled);
          if (parsed.meetingRecordings) setMeetingRecordings(parsed.meetingRecordings);
          if (parsed.pushNotifications) setPushNotifications(parsed.pushNotifications);
        } catch {}
      }
      setIsMounted(true);
    }, 0);

    const fetchDriveInfo = async () => {
      try {
        const data = await getDriveFolder();
        if (data && data.folderId) {
          const match = String(data.folderId).match(/folders\/([a-zA-Z0-9_-]+)/);
          const rawId = match ? match[1] : data.folderId.replace(/^https?:\/\/.*folders\//, '').trim();
          setDriveLink(`https://drive.google.com/drive/folders/${rawId}`);
        }
      } catch {}

      try {
        const statusRes = await fetch('/api/auth/google/status');
        const statusData = await statusRes.json();
        if (statusData?.connected) {
          setGoogleConnected(true);
        }
      } catch {}
    };
    fetchDriveInfo();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        setTimeout(() => setActiveTab(tabParam), 0);
      }
      if (params.get('google_connected') === 'true') {
        setTimeout(() => {
          setGoogleConnected(true);
          setDriveSaveMessage("✓ Successfully connected to your 5 TB Google Drive account!");
          setTimeout(() => setDriveSaveMessage(""), 5000);
        }, 0);
      }
    }

    return () => clearTimeout(timer);
  }, []);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('RCRD_settings', JSON.stringify({
        videoAccess,
        useShortcuts,
        integrations,
        quickRecordEnabled,
        meetingRecordings,
        pushNotifications
      }));
    }
  }, [videoAccess, useShortcuts, integrations, quickRecordEnabled, meetingRecordings, pushNotifications, isMounted]);

  const toggleIntegration = (key: string) => {
    setIntegrations((prev: Record<string, boolean>) => ({ ...prev, [key]: !prev[key] }));
  };

  const setMeetingSetting = (key: keyof MeetingRecordingsState, value: string) => {
    setMeetingRecordings((prev: MeetingRecordingsState) => ({ ...prev, [key]: value }));
  };

  const handleSaveDriveFolder = async () => {
    setIsSavingDrive(true);
    setDriveSaveMessage("");
    try {
      await saveDriveFolder(driveLink);
      setDriveSaveMessage("Google Drive folder connected successfully!");
      setTimeout(() => setDriveSaveMessage(""), 3000);
    } catch {
      setDriveSaveMessage("Failed to connect Google Drive folder.");
    } finally {
      setIsSavingDrive(false);
    }
  };

  const togglePushCategory = (category: keyof PushNotificationsData, item: string, device: 'email' | 'desktop' | 'mobile') => {
    setPushNotifications((prev: PushNotificationsData) => {
      if (category === 'enabled') return prev;
      const catObj = (prev[category] as PushCategoryData) || {};
      const currentItem = catObj[item] || {};
      return {
        ...prev,
        [category]: {
          ...catObj,
          [item]: {
            ...currentItem,
            [device]: !currentItem[device]
          }
        }
      };
    });
  };

  const toggleMasterPushEnabled = () => {
    setPushNotifications((prev: PushNotificationsData) => {
      const isEnabled = !prev.enabled;
      const newState: PushNotificationsData = JSON.parse(JSON.stringify(prev));
      newState.enabled = isEnabled;
      if (!isEnabled) {
        Object.keys(newState).forEach(cat => {
          if (cat === 'enabled') return;
          const catObj = newState[cat] as PushCategoryData;
          if (catObj && typeof catObj === 'object') {
            Object.keys(catObj).forEach(item => {
              if (catObj[item]?.email !== undefined) catObj[item].email = false;
              if (catObj[item]?.desktop !== undefined) catObj[item].desktop = false;
              if (catObj[item]?.mobile !== undefined) catObj[item].mobile = false;
            });
          }
        });
      }
      return newState;
    });
  };

  const toggleAllPushDevice = (device: 'email' | 'desktop' | 'mobile', state: boolean) => {
    setPushNotifications((prev: PushNotificationsData) => {
      const newState: PushNotificationsData = JSON.parse(JSON.stringify(prev));
      Object.keys(newState).forEach(cat => {
        if (cat === 'enabled') return;
        const catObj = newState[cat] as PushCategoryData;
        if (catObj && typeof catObj === 'object') {
          Object.keys(catObj).forEach(item => {
            if (catObj[item]?.[device] !== undefined) {
              catObj[item][device] = state;
            }
          });
        }
      });
      return newState;
    });
  };

  // Helper to determine if all are on/off
  const isAllDeviceOn = (device: 'email' | 'desktop' | 'mobile') => {
    let allOn = true;
    Object.keys(pushNotifications).forEach(cat => {
      if (cat === 'enabled') return;
      const catObj = pushNotifications[cat] as PushCategoryData;
      if (catObj && typeof catObj === 'object') {
        Object.keys(catObj).forEach(item => {
          if (catObj[item]?.[device] !== undefined && catObj[item][device] === false) {
            allOn = false;
          }
        });
      }
    });
    return allOn;
  };

  const integrationsList = [
    { key: 'dropbox', name: 'Dropbox', desc: 'Reinventing teamwork just got a little easier with quick videos' },
    { key: 'github', name: 'GitHub', desc: 'Built for developers, quick videos are for all things GitHub' },
    { key: 'gitlab', name: 'GitLab', desc: 'Platform for modern developers even more modern with quick videos' },
    { key: 'gmail', name: 'Gmail', desc: 'Create and share quick videos right from your inbox' },
    { key: 'googleDocs', name: 'Google Docs', desc: 'Bring GDocs to life with quick videos' },
    { key: 'hackerNews', name: 'Hacker News', desc: 'Remain on topic with quick videos in Hacker News' },
    { key: 'intercom', name: 'Intercom', desc: 'Communicate with customers the new way with quick videos' },
    { key: 'jira', name: 'JIRA', desc: 'Stay agile with quick videos in JIRA' },
    { key: 'productHunt', name: 'Product Hunt', desc: 'Get the best comments in ProductHunt daily with quick videos' },
    { key: 'salesforce', name: 'Salesforce', desc: 'Success. Not software. With quick videos' },
    { key: 'salesforceIQ', name: 'SalesforceIQ', desc: 'Quick videos for growing business\'s CRM' }
  ];

  return (
    <div className="relative flex h-full w-full bg-white text-[#20262E] font-sans overflow-hidden">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Crisp Light Mode with Mobile Drawer Support */}
      <aside className={`w-[280px] flex-shrink-0 flex-col border-r border-[#E2E7EC] bg-white h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden transition-all duration-300 ${
        isMobileMenuOpen 
          ? "fixed inset-y-0 left-0 flex z-50 shadow-2xl" 
          : "hidden md:flex z-20"
      }`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#E2E7EC] flex-shrink-0">
          <div className="flex items-center justify-start cursor-pointer group" onClick={() => { router.push('/'); setIsMobileMenuOpen(false); }}>
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

        <div className="p-5 border-b border-[#E2E7EC] flex-shrink-0">
          <div className="flex items-center justify-between p-3 bg-[#F5F6F8] hover:bg-slate-100 rounded-xl cursor-pointer transition-all border border-[#E2E7EC] hover:border-[#E2E7EC] group">
            <div>
              <div className="text-sm font-semibold text-[#20262E] group-hover:text-[#0E2F44] transition-colors">RCRD Workspace</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] uppercase tracking-wider bg-[#EBF5FB] px-2 py-0.5 rounded text-[#0E2F44] font-bold border border-[#154360]/30">Settings</span>
                <span className="text-xs text-[#57636E]">Admin Config</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#57636E] group-hover:text-[#57636E] transition-colors" />
          </div>
          <button 
            onClick={() => { router.push('/settings?tab=users'); setIsMobileMenuOpen(false); }}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm font-semibold text-[#20262E] transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            <UsersIcon size={16} className="text-[#154360]" />
            Invite Teammates
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-5 px-4 custom-scrollbar min-h-0">
          <nav className="space-y-1">
            <SidebarItem icon={<HomeIcon size={18} />} label="For You" href="/" />
            <SidebarItem icon={<LibraryIcon size={18} />} label="Library" href="/library" />
            <SidebarItem icon={<VideoCameraIcon size={18} />} label="Meetings" href="/meetings" />
            <SidebarItem icon={<CalendarIcon size={18} />} label="Calendar" href="/calendar" />
            <SidebarItem icon={<SettingsIcon size={18} />} label="Settings" active href="/settings" />
          </nav>

          <div className="mt-10">
            <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#57636E] mb-3">Workspace Admin</h3>
            <nav className="space-y-1">
              <SidebarItem 
                icon={<UserIcon size={18} />} 
                label="Manage Users" 
                active={activeTab === 'users'} 
                onClick={() => {
                  setActiveTab('users');
                  setIsMobileMenuOpen(false);
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', '/settings?tab=users');
                  }
                }}
              />
              <SidebarItem icon={<WorkspaceIcon size={18} />} label="Workspace Info" href="/settings" />
              <SidebarItem 
                icon={<Shield size={18} />} 
                label="Billing & Plans" 
                active={activeTab === 'billing'}
                onClick={() => {
                  setActiveTab('billing');
                  setIsMobileMenuOpen(false);
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', '/settings?tab=billing');
                  }
                }}
              />
            </nav>
          </div>
        </div>

        <div className="p-5 border-t border-[#E2E7EC] bg-[#F5F6F8]/50 flex-shrink-0">
          <button 
            onClick={() => { setIsRecordModalOpen(true); setIsMobileMenuOpen(false); }}
            className="w-full bg-[#154360] hover:bg-[#0E2F44] text-white py-3.5 px-6 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 shadow-[0_10px_25px_-5px_rgba(21, 67, 96,0.45)] hover:shadow-[0_14px_28px_-5px_rgba(21, 67, 96,0.55)] transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <VideoCameraIcon size={20} />
            <span>Record Video</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-white overflow-hidden">
        {/* Top Header - Unified Fixed h-16, Centered Search, Image 5 Avatar */}
        <AppHeader 
          placeholder="Search for people, tags, folders, Spaces, and RCRDs"
          onOpenProfile={() => setIsProfileOpen(true)}
          onToggleMobileSidebar={() => setIsMobileMenuOpen(prev => !prev)}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 min-h-0">
          <div className="max-w-[1000px]">
            {/* Title */}
            <div className="mb-6">
              <p className="text-[13px] text-[#57636E] mb-1">
                {activeTab === 'users' ? 'harikishorereddy9908' : 'Hari Kishore Reddy'}
              </p>
              <h1 className="text-[32px] font-bold text-[#20262E] leading-tight">
                {activeTab === 'users' ? 'Users & groups' : 'Personal Settings'}
              </h1>
            </div>

            {/* Banner (only for personal settings, not when viewing users & groups) */}
            {activeTab !== 'users' && (
              <div className="bg-[#F5F6F8] border border-[#E2E7EC] rounded-lg p-4 flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Info size={18} className="text-[#57636E]" />
                  <p className="text-[14px] text-[#20262E]">Your profile is linked to RCRD. To edit your info, visit your profile on RCRD.</p>
                </div>
                <button className="bg-slate-200 hover:bg-slate-300 text-[#20262E] text-[13px] font-bold px-4 py-1.5 rounded transition-colors">
                  Learn more
                </button>
              </div>
            )}

            {/* Tabs (only when personal settings) */}
            {activeTab !== 'users' && (
              <div className="flex items-center gap-6 border-b border-[#E2E7EC] mb-8 overflow-x-auto">
                {[
                  { id: "my-account", label: "My account" },
                  { id: "billing", label: "Billing & Plans" },
                  { id: "meeting-recordings", label: "Meeting recordings" },
                  { id: "push-notifications", label: "Push notifications" },
                  { id: "integrations", label: "Integrations" },
                  { id: "quick-record", label: "Quick record" },
                  { id: "keyboard-shortcuts", label: "Keyboard shortcuts" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 text-[14px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === tab.id 
                        ? 'border-[#154360] text-[#154360] font-bold' 
                        : 'border-transparent text-[#57636E] hover:text-[#20262E] hover:border-[#E2E7EC]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* Tab Content: Users Management */}
            {activeTab === "users" && <UsersTab />}

            {/* Tab Content */}
            {activeTab === "my-account" && (
              <div className="space-y-8 pb-20">
                {/* Manage on RCRD (Restored Atlassian equivalent) */}
                <div className="border border-[#E2E7EC] rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="border-b border-[#E2E7EC] p-6 flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#154360] rounded-full flex items-center justify-center text-white font-bold text-[18px]">
                      A
                    </div>
                    <h2 className="text-[20px] font-bold text-[#20262E]">Manage on RCRD</h2>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-[16px] font-bold text-[#20262E] mb-2">Name and photo</h3>
                    <p className="text-[14px] text-[#57636E] mb-6">Change your name and photo on RCRD</p>
                    
                    <div className="flex items-center gap-6 pb-8 border-b border-[#E2E7EC]">
                      <div className="w-24 h-24 bg-[#154360] rounded-full flex items-center justify-center text-white text-[40px] font-bold shadow-sm">
                        HR
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-[#57636E] mb-1">Full name</p>
                        <p className="text-[15px] font-bold text-[#20262E]">Hari Kishore Reddy</p>
                      </div>
                    </div>

                    <div className="py-8 border-b border-[#E2E7EC]">
                      <h3 className="text-[16px] font-bold text-[#20262E] mb-2">Contact Info</h3>
                      <p className="text-[12px] font-medium text-[#57636E] mb-1">Email address</p>
                      <p className="text-[15px] text-[#20262E]">harikishorereddy9908@gmail.com</p>
                    </div>

                    <div className="pt-8">
                      <h3 className="text-[16px] font-bold text-[#20262E] mb-2">Delete Account</h3>
                      <p className="text-[14px] text-[#57636E] mb-4">Your account is connected to RCRD. To delete your account, go to your RCRD account page.</p>
                      <button className="border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E] text-[13px] font-bold px-4 py-2 rounded transition-colors flex items-center gap-2">
                        Delete RCRD Account <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#F5F6F8] border-t border-[#E2E7EC] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <p className="text-[14px] text-[#57636E]">To make changes visit your RCRD profile or contact your RCRD Admin.</p>
                    <button className="bg-[#154360] hover:bg-[#0E2F44] text-white text-[13px] font-bold px-4 py-2 rounded transition-colors flex items-center gap-2 whitespace-nowrap">
                      View on RCRD <ExternalLink size={14} />
                    </button>
                  </div>
                </div>

                {/* Manage on RCRD (Loom) Card */}
                <div className="border border-[#E2E7EC] rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="border-b border-[#E2E7EC] p-6 flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#154360] rounded-full flex items-center justify-center text-white">
                      * 
                    </div>
                    <h2 className="text-[20px] font-bold text-[#20262E]">Manage on RCRD</h2>
                  </div>
                  
                  <div className="p-6">
                    <div className="pb-8 border-b border-[#E2E7EC]">
                      <h3 className="text-[16px] font-bold text-[#20262E] mb-2">Default video access</h3>
                      <p className="text-[14px] text-[#57636E] mb-4">Set the access level you want your videos to have. You can change this for any of your videos anytime.</p>
                      
                      <div className="w-[280px] mb-4">
                        <button className="w-full flex items-center justify-between border border-[#E2E7EC] rounded-lg p-3 hover:border-slate-400 transition-colors bg-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#EBF5FB] rounded-full flex items-center justify-center text-[#2980B9]">
                              <Globe size={16} />
                            </div>
                            <div className="text-left">
                              <div className="text-[14px] font-bold text-[#20262E] flex items-center gap-1">
                                {videoAccess} <ChevronDown size={14} className="text-[#57636E]" />
                              </div>
                              <p className="text-[12px] text-[#57636E]">Anyone with the link can view</p>
                            </div>
                          </div>
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button className="bg-slate-100 text-[#57636E] text-[13px] font-bold px-4 py-1.5 rounded cursor-not-allowed">
                          Save
                        </button>
                        <button className="text-[#57636E] hover:text-[#20262E] text-[13px] font-bold transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div className="pt-8">
                      <h3 className="text-[16px] font-bold text-[#20262E] mb-2">Download your data</h3>
                      <p className="text-[14px] text-[#57636E] mb-4">Download a copy of your comments and notes data across your RCRD Workspaces.</p>
                      <button className="border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E] text-[13px] font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                        <Download size={14} /> Download ZIP
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <BillingTab />
            )}

            {activeTab === "meeting-recordings" && (
              <div className="space-y-6 pb-20">
                {/* Calendar */}
                <div className="border border-[#E2E7EC] rounded-xl bg-white shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-[#E2E7EC]">
                    <h2 className="text-[16px] font-bold text-[#20262E]">Calendar</h2>
                  </div>
                  <div className="p-6 flex items-center justify-between border-b border-[#E2E7EC]">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center font-bold text-xl"><Globe className="w-5 h-5 text-[#154360]"/></div>
                      <span className="text-[14px] font-bold text-[#20262E]">Google Calendar</span>
                    </div>
                    <button className="bg-[#c53030] hover:bg-[#9b2c2c] text-white text-[13px] font-bold px-4 py-1.5 rounded transition-colors">
                      Disconnect
                    </button>
                  </div>
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center font-bold text-xl"><Globe className="w-5 h-5 text-[#154360]"/></div>
                      <span className="text-[14px] font-bold text-[#20262E]">Outlook Calendar</span>
                    </div>
                    <button className="border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E] text-[13px] font-bold px-4 py-1.5 rounded transition-colors">
                      Connect
                    </button>
                  </div>
                </div>

                {/* Auto-recording */}
                <div className="border border-[#E2E7EC] rounded-xl bg-white shadow-sm overflow-hidden p-6">
                  <h2 className="text-[16px] font-bold text-[#20262E] mb-1">Auto-recording</h2>
                  <p className="text-[13px] text-[#57636E] mb-6">Only available for meetings you own.</p>
                  
                  <div className="space-y-6">
                    {[
                      { val: 'All meetings', title: 'All meetings', desc: '' },
                      { val: 'Internal meetings', title: 'Internal meetings', desc: 'All invitees are in the harikishorereddy9908 workspace.' },
                      { val: 'Internal meetings, excluding one-on-ones', title: 'Internal meetings, excluding one-on-ones', desc: 'All invitees are in the harikishorereddy9908 workspace.' },
                      { val: 'Manually-selected meetings', title: 'Manually-selected meetings', desc: 'Select meetings you want to record after setup.' }
                    ].map(opt => (
                      <div key={opt.val} className="flex items-start gap-3 cursor-pointer group" onClick={() => setMeetingSetting('autoRecording', opt.val)}>
                        <div className={`mt-0.5 flex shrink-0 items-center justify-center w-4 h-4 rounded-full border-2 ${meetingRecordings.autoRecording === opt.val ? 'border-[#154360]' : 'border-slate-400 group-hover:border-slate-600'}`}>
                          {meetingRecordings.autoRecording === opt.val && <div className="w-2 h-2 bg-[#154360] rounded-full" />}
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-[#20262E]">{opt.title}</div>
                          {opt.desc && <div className="text-[13px] text-[#57636E] mt-0.5">{opt.desc}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* After-meeting settings */}
                <div className="border border-[#E2E7EC] rounded-xl bg-white shadow-sm overflow-hidden p-6">
                  <h2 className="text-[16px] font-bold text-[#20262E] mb-6">After-meeting settings</h2>
                  
                  {/* Meeting recap */}
                  <div className="pb-6 border-b border-[#E2E7EC] mb-6">
                    <h3 className="text-[14px] font-bold text-[#20262E] mb-1">Meeting recap</h3>
                    <p className="text-[13px] text-[#57636E] mb-4">Send a meeting recap email and allow access to the recording.</p>
                    <div className="space-y-4">
                      {[
                        { val: 'All meeting invitees', title: 'All meeting invitees', desc: '' },
                        { val: 'Only internal invitees', title: 'Only internal invitees', desc: 'All invitees are in the harikishorereddy9908 workspace.' },
                        { val: 'Just me', title: 'Just me', desc: '' }
                      ].map(opt => (
                        <div key={opt.val} className="flex items-start gap-3 cursor-pointer group" onClick={() => setMeetingSetting('meetingRecap', opt.val)}>
                          <div className={`mt-0.5 flex shrink-0 items-center justify-center w-4 h-4 rounded-full border-2 ${meetingRecordings.meetingRecap === opt.val ? 'border-[#154360]' : 'border-slate-400 group-hover:border-slate-600'}`}>
                            {meetingRecordings.meetingRecap === opt.val && <div className="w-2 h-2 bg-[#154360] rounded-full" />}
                          </div>
                          <div>
                            <div className="text-[14px] font-bold text-[#20262E]">{opt.title}</div>
                            {opt.desc && <div className="text-[13px] text-[#57636E] mt-0.5">{opt.desc}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Link access */}
                  <div className="pb-6 border-b border-[#E2E7EC] mb-6">
                    <h3 className="text-[14px] font-bold text-[#20262E] mb-1">Link access</h3>
                    <p className="text-[13px] text-[#57636E] mb-4">Manage who can view the meeting recording from a shared link.</p>
                    <div className="space-y-4">
                      {[
                        { val: 'Public', title: 'Public', desc: '' },
                        { val: 'Workspace', title: 'Workspace', desc: 'Anyone in the harikishorereddy9908 workspace' },
                        { val: 'Private', title: 'Private', desc: '' }
                      ].map(opt => (
                        <div key={opt.val} className="flex items-start gap-3 cursor-pointer group" onClick={() => setMeetingSetting('linkAccess', opt.val)}>
                          <div className={`mt-0.5 flex shrink-0 items-center justify-center w-4 h-4 rounded-full border-2 ${meetingRecordings.linkAccess === opt.val ? 'border-[#154360]' : 'border-slate-400 group-hover:border-slate-600'}`}>
                            {meetingRecordings.linkAccess === opt.val && <div className="w-2 h-2 bg-[#154360] rounded-full" />}
                          </div>
                          <div>
                            <div className="text-[14px] font-bold text-[#20262E]">{opt.title}</div>
                            {opt.desc && <div className="text-[13px] text-[#57636E] mt-0.5">{opt.desc}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Language setting */}
                  <div>
                    <h3 className="text-[14px] font-bold text-[#20262E] mb-1">Language setting</h3>
                    <p className="text-[13px] text-[#57636E] mb-4">Only applies to meeting recap.</p>
                    <div className="space-y-4">
                      {[
                        { val: 'Auto-detect language', title: 'Auto-detect language' },
                        { val: 'Set default language', title: 'Set default language' }
                      ].map(opt => (
                        <div key={opt.val} className="flex items-start gap-3 cursor-pointer group" onClick={() => setMeetingSetting('languageSetting', opt.val)}>
                          <div className={`mt-0.5 flex shrink-0 items-center justify-center w-4 h-4 rounded-full border-2 ${meetingRecordings.languageSetting === opt.val ? 'border-[#154360]' : 'border-slate-400 group-hover:border-slate-600'}`}>
                            {meetingRecordings.languageSetting === opt.val && <div className="w-2 h-2 bg-[#154360] rounded-full" />}
                          </div>
                          <div className="text-[14px] font-bold text-[#20262E]">{opt.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {activeTab === "push-notifications" && (
              <div className="space-y-8 pb-20">
                {/* Banner */}
                <div className="bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#EBF5FB] rounded-full flex items-center justify-center shrink-0">
                      <Bell size={24} className="text-[#154360]" />
                    </div>
                    <div>
                      <h2 className="text-[16px] font-bold text-[#20262E] mb-1">Turn on push notifications</h2>
                      <p className="text-[14px] text-[#57636E]">Get notified when someone watches or reacts to your videos.</p>
                    </div>
                  </div>
                  <button 
                    onClick={toggleMasterPushEnabled}
                    className="bg-white border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E] text-[13px] font-bold px-4 py-2 rounded whitespace-nowrap transition-colors"
                  >
                    {pushNotifications.enabled ? 'Turn off push notifications' : 'Allow push notifications'}
                  </button>
                </div>

                {/* Grid */}
                <div className="w-full">
                  <div className="flex items-center justify-between py-2 border-b border-[#E2E7EC] mb-6">
                    <div className="flex-1 text-[16px] font-bold text-[#20262E]">Notify me when...</div>
                    <div className="flex items-center gap-16 pr-8">
                      <div className="w-16 text-center">
                        <div className="text-[13px] font-bold text-[#20262E] mb-1">Email</div>
                        <button 
                          onClick={() => toggleAllPushDevice('email', !isAllDeviceOn('email'))}
                          className="text-[12px] text-[#154360] hover:underline"
                        >
                          {isAllDeviceOn('email') ? 'Turn off all email' : 'Turn on all email'}
                        </button>
                      </div>
                      <div className="w-16 text-center">
                        <div className="text-[13px] font-bold text-[#20262E] mb-1">Desktop</div>
                        <div className="text-[11px] text-[#57636E] mb-1">Push notification</div>
                        <button 
                          onClick={() => toggleAllPushDevice('desktop', !isAllDeviceOn('desktop'))}
                          className="text-[12px] text-[#154360] hover:underline"
                        >
                          {isAllDeviceOn('desktop') ? 'Turn off all desktop' : 'Turn on all desktop'}
                        </button>
                      </div>
                      <div className="w-16 text-center">
                        <div className="text-[13px] font-bold text-[#20262E] mb-1">Mobile</div>
                        <div className="text-[11px] text-[#57636E] mb-1">Push notification</div>
                        <button 
                          onClick={() => toggleAllPushDevice('mobile', !isAllDeviceOn('mobile'))}
                          className="text-[12px] text-[#154360] hover:underline"
                        >
                          {isAllDeviceOn('mobile') ? 'Turn off all mobile' : 'Turn on all mobile'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sections */}
                  <div className="space-y-8">
                    {/* Engagement */}
                    <div>
                      <h3 className="text-[14px] font-bold text-[#20262E] mb-4 px-2">Engagement</h3>
                      <div className="bg-[#F5F6F8]/50 rounded-lg p-2">
                        <PushRow label="My videos are first viewed" category="engagement" item="firstViewed" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Comments and replies on my videos" category="engagement" item="comments" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Reactions to comments on my videos" category="engagement" item="reactionsToComments" email={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Reactions on my videos" category="engagement" item="reactionsOnVideos" mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Replies to my comments left on others' videos" category="engagement" item="repliesToComments" mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Someone mentioned me on a comment or a reply" category="engagement" item="mentionedComment" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Someone follows me" category="engagement" item="followsMe" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Someone mentioned me on a task" category="engagement" item="mentionedTask" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Someone responds to a task" category="engagement" item="respondsTask" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Transcript regeneration completes successfully" category="engagement" item="transcriptSuccess" mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Transcript regeneration fails" category="engagement" item="transcriptFail" mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                      </div>
                    </div>

                    {/* Video sharing */}
                    <div>
                      <h3 className="text-[14px] font-bold text-[#20262E] mb-4 px-2">Video sharing</h3>
                      <div className="bg-[#F5F6F8]/50 rounded-lg p-2">
                        <PushRow label="Someone shares a video with me" category="videoSharing" item="sharesVideo" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="A collaborator re-shares one of my videos" category="videoSharing" item="resharesVideo" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="A collaborator changes the privacy of my video" category="videoSharing" item="changesPrivacy" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                      </div>
                    </div>

                    {/* Video stitching */}
                    <div>
                      <h3 className="text-[14px] font-bold text-[#20262E] mb-1 px-2 flex items-center gap-1">Video stitching <Info size={14} className="text-[#57636E]" /></h3>
                      <div className="bg-[#F5F6F8]/50 rounded-lg p-2 mt-4">
                        <PushRow label="Someone adds my video to their RCRD" category="videoStitching" item="addsVideo" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="A RCRD containing one of my videos is first viewed" category="videoStitching" item="firstViewed" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                      </div>
                    </div>

                    {/* Education */}
                    <div>
                      <h3 className="text-[14px] font-bold text-[#20262E] mb-4 px-2">Education</h3>
                      <div className="bg-[#F5F6F8]/50 rounded-lg p-2">
                        <PushRow label="Reminders to record" category="education" item="reminders" mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Insights into my RCRD usage" category="education" item="insights" desktop={false} mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                      </div>
                    </div>

                    {/* Spaces */}
                    <div>
                      <h3 className="text-[14px] font-bold text-[#20262E] mb-4 px-2">Spaces</h3>
                      <div className="bg-[#F5F6F8]/50 rounded-lg p-2">
                        <PushRow label="Someone adds me to a Space" category="spaces" item="addsToSpace" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Someone shares a new video to the All harikishorereddy9908 Space" category="spaces" item="sharesToAllSpace" email={false} desktop={false} mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Someone shares a new video to any other Space" category="spaces" item="sharesToOtherSpace" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Admin removes you from or deletes a Space" category="spaces" item="adminRemoves" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="A Space is archived or unarchived" category="spaces" item="spaceArchived" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                      </div>
                    </div>

                    {/* Watch later */}
                    <div>
                      <h3 className="text-[14px] font-bold text-[#20262E] mb-4 px-2">Watch later</h3>
                      <div className="bg-[#F5F6F8]/50 rounded-lg p-2">
                        <PushRow label="Send a morning digest when I have RCRDs to watch" category="watchLater" item="morningDigest" desktop={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Deliver digest notification on weekdays only" category="watchLater" item="weekdaysOnly" desktop={false} email={false} mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="space-y-6 pb-20">
                <div className="p-6 bg-[#EBF5FB] border border-[#154360]/20 rounded-xl">
                  <h2 className="text-[16px] font-bold text-[#20262E] mb-2 flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-[#154360]" />
                    Google Drive Integration
                  </h2>
                  <p className="text-[14px] text-[#57636E] mb-4">Authenticate your Google account and connect your Google Drive folder to sync recorded videos seamlessly.</p>
                  
                  <div className="flex flex-col gap-4">
                    {googleConnected ? (
                      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg text-sm font-medium">
                        <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold">5 TB Google Drive Account Connected</p>
                          <p className="text-xs text-emerald-700">All recorded videos and courses will upload directly into your personal Google One Drive without quota limits.</p>
                        </div>
                        <a 
                          href="/api/auth/google?redirect=/settings"
                          className="ml-auto text-xs underline text-emerald-900 hover:text-emerald-950 cursor-pointer"
                        >
                          Reconnect
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <a 
                          href="/api/auth/google?redirect=/settings"
                          className="w-fit bg-[#154360] hover:bg-[#0E2F44] text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
                        >
                          <Cloud className="w-4 h-4" />
                          Connect 5 TB Google Drive (kishorre239@gmail.com)
                        </a>
                        <span className="text-xs text-[#57636E]">Sign in once to authorize video uploads to your 5 TB storage.</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3">
                      <input 
                        type="text" 
                        value={driveLink}
                        onChange={(e) => setDriveLink(e.target.value)}
                        placeholder="Paste your Google Drive folder link here"
                        className="flex-1 px-4 py-2 border border-[#E2E7EC] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#154360]"
                      />
                      <button 
                        onClick={handleSaveDriveFolder}
                        disabled={isSavingDrive || !driveLink}
                        className="bg-[#154360] hover:bg-[#0E2F44] disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap"
                      >
                        {isSavingDrive ? "Saving..." : "Set Folder"}
                      </button>
                    </div>
                  </div>
                  {driveSaveMessage && (
                    <p className={`text-sm mt-3 font-medium ${driveSaveMessage.includes("success") || driveSaveMessage.includes("✓") ? "text-emerald-700" : "text-[#154360]"}`}>
                      {driveSaveMessage}
                    </p>
                  )}
                </div>

                <div className="mb-2 mt-8">
                  <h2 className="text-[16px] font-bold text-[#20262E] mb-1">Link Embedding</h2>
                  <p className="text-[14px] text-[#57636E]">Using the RCRD Chrome Extension, turn any link into an embedded video that can be played where you shared it.</p>
                </div>
                
                <div className="border border-[#E2E7EC] rounded-xl bg-white overflow-hidden shadow-sm">
                  {integrationsList.map((intg, index) => (
                    <div 
                      key={intg.key}
                      className={`flex items-center justify-between p-5 hover:bg-[#F5F6F8] transition-colors ${
                        index !== integrationsList.length - 1 ? 'border-b border-[#E2E7EC]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded text-xl font-bold text-[#57636E] shrink-0">
                          {intg.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-[14px] font-bold text-[#20262E]">{intg.name}</h3>
                          <p className="text-[13px] text-[#57636E]">{intg.desc}</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => toggleIntegration(intg.key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 shrink-0 ${integrations[intg.key] ? 'bg-[#154360]' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${integrations[intg.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "quick-record" && (
              <div className="pb-20">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold text-[#20262E] mb-1">Quick record controls</h2>
                    <p className="text-[14px] text-[#57636E]">RCRD Quick Record is a one-click record tool that shows up on these sites.</p>
                  </div>
                  <button 
                    onClick={() => setQuickRecordEnabled(!quickRecordEnabled)}
                    className={`${quickRecordEnabled ? 'bg-[#c53030] hover:bg-[#9b2c2c]' : 'bg-[#154360] hover:bg-[#0E2F44]'} text-white text-[13px] font-bold px-4 py-2 rounded-lg transition-colors shadow-sm`}
                  >
                    {quickRecordEnabled ? 'Turn off Quick Record' : 'Turn on Quick Record'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "keyboard-shortcuts" && (
              <div className="space-y-8 pb-20">
                <div className="border border-[#E2E7EC] rounded-xl overflow-hidden bg-white shadow-sm p-8">
                  <h2 className="text-[24px] font-bold text-[#20262E] mb-2">Keyboard shortcuts</h2>
                  <p className="text-[14px] text-[#57636E] mb-6">Use keyboard shortcuts to increase the speed of your workflow. Many shortcuts appear when you hover over a setting.</p>
                  
                  <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => setUseShortcuts(!useShortcuts)}>
                    <button 
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useShortcuts ? 'bg-[#154360]' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useShortcuts ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-[15px] font-medium text-[#20262E]">Use keyboard shortcuts</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div>
                      <h3 className="text-[15px] font-bold text-[#20262E] mb-6">Global actions</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] text-[#57636E]">Quick search</span>
                          <div className="flex gap-1">
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-[#E2E7EC] rounded text-[11px] font-mono text-[#57636E]">Ctrl</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-[#E2E7EC] rounded text-[11px] font-mono text-[#57636E]">K</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-[15px] font-bold text-[#20262E] mb-6">Video playback</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] text-[#57636E]">Play/Pause</span>
                          <div className="flex gap-1">
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-[#E2E7EC] rounded text-[11px] font-mono text-[#57636E]">Space</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[15px] font-bold text-[#20262E] mb-6">Recording</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] text-[#57636E]">Start/Stop</span>
                          <div className="flex gap-1">
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-[#E2E7EC] rounded text-[11px] font-mono text-[#57636E]">Ctrl</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-[#E2E7EC] rounded text-[11px] font-mono text-[#57636E]">Shift</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-[#E2E7EC] rounded text-[11px] font-mono text-[#57636E]">L</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Fallback for other tabs */}
            {!["my-account", "billing", "meeting-recordings", "push-notifications", "integrations", "quick-record", "keyboard-shortcuts"].includes(activeTab) && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <SettingsIcon size={48} className="text-slate-300 mb-4" />
                <h2 className="text-[18px] font-bold text-[#20262E] mb-2">Coming Soon</h2>
                <p className="text-[14px] text-[#57636E] max-w-sm">
                  The {activeTab.replace('-', ' ')} settings will be available in a future update.
                </p>
              </div>
            )}
            
          </div>
        </div>
      </main>

      <RecordingSetupModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onRecordingComplete={() => router.push('/library')}
      />

      {/* Profile Flyout (Image 5) */}
      <ProfileFlyout
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}

// Helper Component
function SidebarItem({ 
  icon, 
  label, 
  active = false, 
  external = false, 
  href, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  external?: boolean; 
  href?: string; 
  onClick?: () => void; 
}) {
  const router = useRouter();
  
  return (
    <div 
      onClick={() => {
        if (onClick) onClick();
        else if (href) router.push(href);
      }}
      style={{
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: '14px',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '14px',
        letterSpacing: 'normal',
        color: active ? '#154360' : '#292A2E'
      }}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all ${
      active 
        ? "bg-[#EBF5FB] shadow-sm" 
        : "hover:bg-[#F5F6F8]"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`${active ? "text-[#154360]" : "text-[#57636E]"}`}>
          {icon}
        </div>
        <span className="text-sm tracking-wide">{label}</span>
      </div>
      {external && <div className="text-[#57636E]"><Share2 size={12} className="rotate-45" /></div>}
    </div>
  );
}
