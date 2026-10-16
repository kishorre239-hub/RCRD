"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { 
  Search, ExternalLink, 
  ChevronDown, Info, Download, Globe, HardDrive,
  Shield, Share2, Bell, Cloud, Check
} from "lucide-react";
import {
  HomeIcon, LibraryIcon, VideoCameraIcon, CalendarIcon, SettingsIcon,
  UsersIcon, UserIcon, WorkspaceIcon, NotificationIcon
} from "@/components/CustomIcons";
import { 
  saveDriveFolder, getDriveFolder, API_URL 
} from '@/lib/api';
import BillingTab from '@/components/BillingTab';
import UsersTab from '@/components/UsersTab';
import RecordingSetupModal from '@/components/RecordingSetupModal';

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
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-[#AE2448]' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    );
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors px-2">
      <div className="flex-1 text-[13px] text-slate-700">{label}</div>
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
          setDriveLink(`https://drive.google.com/drive/folders/${data.folderId}`);
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
        setGoogleConnected(true);
        setDriveSaveMessage("✓ Successfully connected to your 5 TB Google Drive account!");
        setTimeout(() => setDriveSaveMessage(""), 5000);
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
    <div className="relative flex h-full w-full bg-white text-slate-900 font-sans overflow-hidden">
      {/* Sidebar - Crisp Light Mode */}
      <aside className="w-[280px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-white z-20 h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="h-16 flex items-center px-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-center w-full cursor-pointer group" onClick={() => router.push('/')}>
            <Image src="/ICONS/COMPANY_NAME-cropped.png" alt="RCRD." width={120} height={48} className="h-12 w-auto object-contain transition-transform group-hover:scale-105"  style={{ filter: "hue-rotate(131deg) saturate(1.4)" }}/>
          </div>
        </div>

        <div className="p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer transition-all border border-slate-100 hover:border-slate-200 group">
            <div>
              <div className="text-sm font-semibold text-slate-800 group-hover:text-[#6E1A37] transition-colors">RCRD Workspace</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] uppercase tracking-wider bg-[#D5E7B5] px-2 py-0.5 rounded text-[#6E1A37] font-bold border border-[#AE2448]/30">Settings</span>
                <span className="text-xs text-slate-500">Admin Config</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>
          <button className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all shadow-sm hover:shadow-md">
            <UsersIcon size={16} className="text-[#AE2448]" />
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
            <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Workspace Admin</h3>
            <nav className="space-y-1">
              <SidebarItem 
                icon={<UserIcon size={18} />} 
                label="Manage Users" 
                active={activeTab === 'users'} 
                onClick={() => {
                  setActiveTab('users');
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', '/settings?tab=users');
                  }
                }}
              />
              <SidebarItem icon={<WorkspaceIcon size={18} />} label="Workspace Info" />
              <SidebarItem 
                icon={<Shield size={18} />} 
                label="Billing & Plans" 
                active={activeTab === 'billing'}
                onClick={() => {
                  setActiveTab('billing');
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', '/settings?tab=billing');
                  }
                }}
              />
            </nav>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <button 
            onClick={() => setIsRecordModalOpen(true)}
            className="w-full bg-[#AE2448] hover:bg-[#6E1A37] text-white py-3.5 px-6 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2.5 shadow-[0_10px_25px_-5px_rgba(174, 36, 72,0.45)] hover:shadow-[0_14px_28px_-5px_rgba(174, 36, 72,0.55)] transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <VideoCameraIcon size={20} />
            <span>Record Video</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-white overflow-hidden">
        {/* Top Header */}
        <header className="h-[72px] flex items-center justify-between px-8 border-b border-slate-100 shrink-0 flex-shrink-0">
          <div className="flex-1 max-w-[600px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search for people, tags, folders, Spaces, and RCRDs"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-[#AE2448]/20 transition-shadow"
            />
          </div>
          <div className="flex items-center gap-4 ml-4">
            <button 
              onClick={() => setActiveTab('billing')}
              className="bg-[#AE2448] hover:bg-[#6E1A37] text-white text-[13px] font-bold px-4 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>Upgrade</span>
              <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">PRO</span>
            </button>
            <button className="text-slate-500 hover:text-slate-700 w-8 h-8 flex items-center justify-center border border-slate-300 rounded-full">?</button>
            <button className="text-slate-500 hover:text-slate-700"><NotificationIcon size={20} /></button>
            <div className="w-8 h-8 bg-[#AE2448] text-white font-bold text-[12px] flex items-center justify-center rounded-full">HR</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 min-h-0">
          <div className="max-w-[1000px]">
            {/* Title */}
            <div className="mb-6">
              <p className="text-[13px] text-slate-500 mb-1">
                {activeTab === 'users' ? 'harikishorereddy9908' : 'Hari Kishore Reddy'}
              </p>
              <h1 className="text-[32px] font-bold text-slate-900 leading-tight">
                {activeTab === 'users' ? 'Users & groups' : 'Personal Settings'}
              </h1>
            </div>

            {/* Banner (only for personal settings, not when viewing users & groups) */}
            {activeTab !== 'users' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Info size={18} className="text-slate-600" />
                  <p className="text-[14px] text-slate-700">Your profile is linked to RCRD. To edit your info, visit your profile on RCRD.</p>
                </div>
                <button className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-[13px] font-bold px-4 py-1.5 rounded transition-colors">
                  Learn more
                </button>
              </div>
            )}

            {/* Tabs (only when personal settings) */}
            {activeTab !== 'users' && (
              <div className="flex items-center gap-6 border-b border-slate-200 mb-8 overflow-x-auto">
                {[
                  { id: "my-account", label: "My account" },
                  { id: "billing", label: "Billing & Plans 💳" },
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
                        ? 'border-[#AE2448] text-[#AE2448] font-bold' 
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
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
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="border-b border-slate-200 p-6 flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#AE2448] rounded-full flex items-center justify-center text-white font-bold text-[18px]">
                      A
                    </div>
                    <h2 className="text-[20px] font-bold text-slate-900">Manage on RCRD</h2>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-[16px] font-bold text-slate-900 mb-2">Name and photo</h3>
                    <p className="text-[14px] text-slate-600 mb-6">Change your name and photo on RCRD</p>
                    
                    <div className="flex items-center gap-6 pb-8 border-b border-slate-100">
                      <div className="w-24 h-24 bg-[#AE2448] rounded-full flex items-center justify-center text-white text-[40px] font-bold shadow-sm">
                        HR
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-slate-500 mb-1">Full name</p>
                        <p className="text-[15px] font-bold text-slate-900">Hari Kishore Reddy</p>
                      </div>
                    </div>

                    <div className="py-8 border-b border-slate-100">
                      <h3 className="text-[16px] font-bold text-slate-900 mb-2">Contact Info</h3>
                      <p className="text-[12px] font-medium text-slate-500 mb-1">Email address</p>
                      <p className="text-[15px] text-slate-700">harikishorereddy9908@gmail.com</p>
                    </div>

                    <div className="pt-8">
                      <h3 className="text-[16px] font-bold text-slate-900 mb-2">Delete Account</h3>
                      <p className="text-[14px] text-slate-600 mb-4">Your account is connected to RCRD. To delete your account, go to your RCRD account page.</p>
                      <button className="border border-slate-300 hover:bg-slate-50 text-slate-700 text-[13px] font-bold px-4 py-2 rounded transition-colors flex items-center gap-2">
                        Delete RCRD Account <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 border-t border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <p className="text-[14px] text-slate-600">To make changes visit your RCRD profile or contact your RCRD Admin.</p>
                    <button className="bg-[#AE2448] hover:bg-[#6E1A37] text-white text-[13px] font-bold px-4 py-2 rounded transition-colors flex items-center gap-2 whitespace-nowrap">
                      View on RCRD <ExternalLink size={14} />
                    </button>
                  </div>
                </div>

                {/* Manage on RCRD (Loom) Card */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="border-b border-slate-200 p-6 flex items-center gap-4">
                    <div className="w-8 h-8 bg-[#AE2448] rounded-full flex items-center justify-center text-white">
                      * 
                    </div>
                    <h2 className="text-[20px] font-bold text-slate-900">Manage on RCRD</h2>
                  </div>
                  
                  <div className="p-6">
                    <div className="pb-8 border-b border-slate-100">
                      <h3 className="text-[16px] font-bold text-slate-900 mb-2">Default video access</h3>
                      <p className="text-[14px] text-slate-600 mb-4">Set the access level you want your videos to have. You can change this for any of your videos anytime.</p>
                      
                      <div className="w-[280px] mb-4">
                        <button className="w-full flex items-center justify-between border border-slate-300 rounded-lg p-3 hover:border-slate-400 transition-colors bg-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#D5E7B5] rounded-full flex items-center justify-center text-[#72BAA9]">
                              <Globe size={16} />
                            </div>
                            <div className="text-left">
                              <div className="text-[14px] font-bold text-slate-900 flex items-center gap-1">
                                {videoAccess} <ChevronDown size={14} className="text-slate-500" />
                              </div>
                              <p className="text-[12px] text-slate-500">Anyone with the link can view</p>
                            </div>
                          </div>
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button className="bg-slate-100 text-slate-400 text-[13px] font-bold px-4 py-1.5 rounded cursor-not-allowed">
                          Save
                        </button>
                        <button className="text-slate-500 hover:text-slate-700 text-[13px] font-bold transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div className="pt-8">
                      <h3 className="text-[16px] font-bold text-slate-900 mb-2">Download your data</h3>
                      <p className="text-[14px] text-slate-600 mb-4">Download a copy of your comments and notes data across your RCRD Workspaces.</p>
                      <button className="border border-slate-300 hover:bg-slate-50 text-slate-700 text-[13px] font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
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
                <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h2 className="text-[16px] font-bold text-slate-900">Calendar</h2>
                  </div>
                  <div className="p-6 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center font-bold text-xl"><Globe className="w-5 h-5 text-[#AE2448]"/></div>
                      <span className="text-[14px] font-bold text-slate-900">Google Calendar</span>
                    </div>
                    <button className="bg-[#c53030] hover:bg-[#9b2c2c] text-white text-[13px] font-bold px-4 py-1.5 rounded transition-colors">
                      Disconnect
                    </button>
                  </div>
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center font-bold text-xl"><Globe className="w-5 h-5 text-[#AE2448]"/></div>
                      <span className="text-[14px] font-bold text-slate-900">Outlook Calendar</span>
                    </div>
                    <button className="border border-slate-300 hover:bg-slate-50 text-slate-700 text-[13px] font-bold px-4 py-1.5 rounded transition-colors">
                      Connect
                    </button>
                  </div>
                </div>

                {/* Auto-recording */}
                <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden p-6">
                  <h2 className="text-[16px] font-bold text-slate-900 mb-1">Auto-recording</h2>
                  <p className="text-[13px] text-slate-500 mb-6">Only available for meetings you own.</p>
                  
                  <div className="space-y-6">
                    {[
                      { val: 'All meetings', title: 'All meetings', desc: '' },
                      { val: 'Internal meetings', title: 'Internal meetings', desc: 'All invitees are in the harikishorereddy9908 workspace.' },
                      { val: 'Internal meetings, excluding one-on-ones', title: 'Internal meetings, excluding one-on-ones', desc: 'All invitees are in the harikishorereddy9908 workspace.' },
                      { val: 'Manually-selected meetings', title: 'Manually-selected meetings', desc: 'Select meetings you want to record after setup.' }
                    ].map(opt => (
                      <div key={opt.val} className="flex items-start gap-3 cursor-pointer group" onClick={() => setMeetingSetting('autoRecording', opt.val)}>
                        <div className={`mt-0.5 flex shrink-0 items-center justify-center w-4 h-4 rounded-full border-2 ${meetingRecordings.autoRecording === opt.val ? 'border-[#AE2448]' : 'border-slate-400 group-hover:border-slate-600'}`}>
                          {meetingRecordings.autoRecording === opt.val && <div className="w-2 h-2 bg-[#AE2448] rounded-full" />}
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-slate-900">{opt.title}</div>
                          {opt.desc && <div className="text-[13px] text-slate-500 mt-0.5">{opt.desc}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* After-meeting settings */}
                <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden p-6">
                  <h2 className="text-[16px] font-bold text-slate-900 mb-6">After-meeting settings</h2>
                  
                  {/* Meeting recap */}
                  <div className="pb-6 border-b border-slate-100 mb-6">
                    <h3 className="text-[14px] font-bold text-slate-900 mb-1">Meeting recap</h3>
                    <p className="text-[13px] text-slate-500 mb-4">Send a meeting recap email and allow access to the recording.</p>
                    <div className="space-y-4">
                      {[
                        { val: 'All meeting invitees', title: 'All meeting invitees', desc: '' },
                        { val: 'Only internal invitees', title: 'Only internal invitees', desc: 'All invitees are in the harikishorereddy9908 workspace.' },
                        { val: 'Just me', title: 'Just me', desc: '' }
                      ].map(opt => (
                        <div key={opt.val} className="flex items-start gap-3 cursor-pointer group" onClick={() => setMeetingSetting('meetingRecap', opt.val)}>
                          <div className={`mt-0.5 flex shrink-0 items-center justify-center w-4 h-4 rounded-full border-2 ${meetingRecordings.meetingRecap === opt.val ? 'border-[#AE2448]' : 'border-slate-400 group-hover:border-slate-600'}`}>
                            {meetingRecordings.meetingRecap === opt.val && <div className="w-2 h-2 bg-[#AE2448] rounded-full" />}
                          </div>
                          <div>
                            <div className="text-[14px] font-bold text-slate-900">{opt.title}</div>
                            {opt.desc && <div className="text-[13px] text-slate-500 mt-0.5">{opt.desc}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Link access */}
                  <div className="pb-6 border-b border-slate-100 mb-6">
                    <h3 className="text-[14px] font-bold text-slate-900 mb-1">Link access</h3>
                    <p className="text-[13px] text-slate-500 mb-4">Manage who can view the meeting recording from a shared link.</p>
                    <div className="space-y-4">
                      {[
                        { val: 'Public', title: 'Public', desc: '' },
                        { val: 'Workspace', title: 'Workspace', desc: 'Anyone in the harikishorereddy9908 workspace' },
                        { val: 'Private', title: 'Private', desc: '' }
                      ].map(opt => (
                        <div key={opt.val} className="flex items-start gap-3 cursor-pointer group" onClick={() => setMeetingSetting('linkAccess', opt.val)}>
                          <div className={`mt-0.5 flex shrink-0 items-center justify-center w-4 h-4 rounded-full border-2 ${meetingRecordings.linkAccess === opt.val ? 'border-[#AE2448]' : 'border-slate-400 group-hover:border-slate-600'}`}>
                            {meetingRecordings.linkAccess === opt.val && <div className="w-2 h-2 bg-[#AE2448] rounded-full" />}
                          </div>
                          <div>
                            <div className="text-[14px] font-bold text-slate-900">{opt.title}</div>
                            {opt.desc && <div className="text-[13px] text-slate-500 mt-0.5">{opt.desc}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Language setting */}
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900 mb-1">Language setting</h3>
                    <p className="text-[13px] text-slate-500 mb-4">Only applies to meeting recap.</p>
                    <div className="space-y-4">
                      {[
                        { val: 'Auto-detect language', title: 'Auto-detect language' },
                        { val: 'Set default language', title: 'Set default language' }
                      ].map(opt => (
                        <div key={opt.val} className="flex items-start gap-3 cursor-pointer group" onClick={() => setMeetingSetting('languageSetting', opt.val)}>
                          <div className={`mt-0.5 flex shrink-0 items-center justify-center w-4 h-4 rounded-full border-2 ${meetingRecordings.languageSetting === opt.val ? 'border-[#AE2448]' : 'border-slate-400 group-hover:border-slate-600'}`}>
                            {meetingRecordings.languageSetting === opt.val && <div className="w-2 h-2 bg-[#AE2448] rounded-full" />}
                          </div>
                          <div className="text-[14px] font-bold text-slate-900">{opt.title}</div>
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
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#D5E7B5] rounded-full flex items-center justify-center shrink-0">
                      <Bell size={24} className="text-[#AE2448]" />
                    </div>
                    <div>
                      <h2 className="text-[16px] font-bold text-slate-900 mb-1">Turn on push notifications</h2>
                      <p className="text-[14px] text-slate-600">Get notified when someone watches or reacts to your videos.</p>
                    </div>
                  </div>
                  <button 
                    onClick={toggleMasterPushEnabled}
                    className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[13px] font-bold px-4 py-2 rounded whitespace-nowrap transition-colors"
                  >
                    {pushNotifications.enabled ? 'Turn off push notifications' : 'Allow push notifications'}
                  </button>
                </div>

                {/* Grid */}
                <div className="w-full">
                  <div className="flex items-center justify-between py-2 border-b border-slate-200 mb-6">
                    <div className="flex-1 text-[16px] font-bold text-slate-900">Notify me when...</div>
                    <div className="flex items-center gap-16 pr-8">
                      <div className="w-16 text-center">
                        <div className="text-[13px] font-bold text-slate-900 mb-1">Email</div>
                        <button 
                          onClick={() => toggleAllPushDevice('email', !isAllDeviceOn('email'))}
                          className="text-[12px] text-[#AE2448] hover:underline"
                        >
                          {isAllDeviceOn('email') ? 'Turn off all email' : 'Turn on all email'}
                        </button>
                      </div>
                      <div className="w-16 text-center">
                        <div className="text-[13px] font-bold text-slate-900 mb-1">Desktop</div>
                        <div className="text-[11px] text-slate-500 mb-1">Push notification</div>
                        <button 
                          onClick={() => toggleAllPushDevice('desktop', !isAllDeviceOn('desktop'))}
                          className="text-[12px] text-[#AE2448] hover:underline"
                        >
                          {isAllDeviceOn('desktop') ? 'Turn off all desktop' : 'Turn on all desktop'}
                        </button>
                      </div>
                      <div className="w-16 text-center">
                        <div className="text-[13px] font-bold text-slate-900 mb-1">Mobile</div>
                        <div className="text-[11px] text-slate-500 mb-1">Push notification</div>
                        <button 
                          onClick={() => toggleAllPushDevice('mobile', !isAllDeviceOn('mobile'))}
                          className="text-[12px] text-[#AE2448] hover:underline"
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
                      <h3 className="text-[14px] font-bold text-slate-900 mb-4 px-2">Engagement</h3>
                      <div className="bg-slate-50/50 rounded-lg p-2">
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
                      <h3 className="text-[14px] font-bold text-slate-900 mb-4 px-2">Video sharing</h3>
                      <div className="bg-slate-50/50 rounded-lg p-2">
                        <PushRow label="Someone shares a video with me" category="videoSharing" item="sharesVideo" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="A collaborator re-shares one of my videos" category="videoSharing" item="resharesVideo" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="A collaborator changes the privacy of my video" category="videoSharing" item="changesPrivacy" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                      </div>
                    </div>

                    {/* Video stitching */}
                    <div>
                      <h3 className="text-[14px] font-bold text-slate-900 mb-1 px-2 flex items-center gap-1">Video stitching <Info size={14} className="text-slate-400" /></h3>
                      <div className="bg-slate-50/50 rounded-lg p-2 mt-4">
                        <PushRow label="Someone adds my video to their RCRD" category="videoStitching" item="addsVideo" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="A RCRD containing one of my videos is first viewed" category="videoStitching" item="firstViewed" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                      </div>
                    </div>

                    {/* Education */}
                    <div>
                      <h3 className="text-[14px] font-bold text-slate-900 mb-4 px-2">Education</h3>
                      <div className="bg-slate-50/50 rounded-lg p-2">
                        <PushRow label="Reminders to record" category="education" item="reminders" mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Insights into my RCRD usage" category="education" item="insights" desktop={false} mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                      </div>
                    </div>

                    {/* Spaces */}
                    <div>
                      <h3 className="text-[14px] font-bold text-slate-900 mb-4 px-2">Spaces</h3>
                      <div className="bg-slate-50/50 rounded-lg p-2">
                        <PushRow label="Someone adds me to a Space" category="spaces" item="addsToSpace" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Someone shares a new video to the All harikishorereddy9908 Space" category="spaces" item="sharesToAllSpace" email={false} desktop={false} mobile={false} pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Someone shares a new video to any other Space" category="spaces" item="sharesToOtherSpace" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="Admin removes you from or deletes a Space" category="spaces" item="adminRemoves" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                        <PushRow label="A Space is archived or unarchived" category="spaces" item="spaceArchived" pushNotifications={pushNotifications} onToggle={togglePushCategory} />
                      </div>
                    </div>

                    {/* Watch later */}
                    <div>
                      <h3 className="text-[14px] font-bold text-slate-900 mb-4 px-2">Watch later</h3>
                      <div className="bg-slate-50/50 rounded-lg p-2">
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
                <div className="p-6 bg-[#D5E7B5] border border-[#AE2448]/20 rounded-xl">
                  <h2 className="text-[16px] font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-[#AE2448]" />
                    Google Drive Integration
                  </h2>
                  <p className="text-[14px] text-slate-600 mb-4">Authenticate your Google account and connect your Google Drive folder to sync recorded videos seamlessly.</p>
                  
                  <div className="flex flex-col gap-4">
                    {googleConnected ? (
                      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg text-sm font-medium">
                        <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold">5 TB Google Drive Account Connected</p>
                          <p className="text-xs text-emerald-700">All recorded videos and courses will upload directly into your personal Google One Drive without quota limits.</p>
                        </div>
                        <button 
                          onClick={() => { window.location.href = '/api/auth/google?redirect=/settings'; }}
                          className="ml-auto text-xs underline text-emerald-900 hover:text-emerald-950"
                        >
                          Reconnect
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => { window.location.href = '/api/auth/google?redirect=/settings'; }}
                          className="w-fit bg-[#AE2448] hover:bg-[#6E1A37] text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 shadow-sm"
                        >
                          <Cloud className="w-4 h-4" />
                          Connect 5 TB Google Drive (kishorre239@gmail.com)
                        </button>
                        <span className="text-xs text-slate-500">Sign in once to authorize video uploads to your 5 TB storage.</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3">
                      <input 
                        type="text" 
                        value={driveLink}
                        onChange={(e) => setDriveLink(e.target.value)}
                        placeholder="Paste your Google Drive folder link here"
                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#AE2448]"
                      />
                      <button 
                        onClick={handleSaveDriveFolder}
                        disabled={isSavingDrive || !driveLink}
                        className="bg-[#AE2448] hover:bg-[#6E1A37] disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap"
                      >
                        {isSavingDrive ? "Saving..." : "Set Folder"}
                      </button>
                    </div>
                  </div>
                  {driveSaveMessage && (
                    <p className={`text-sm mt-3 font-medium ${driveSaveMessage.includes("success") || driveSaveMessage.includes("✓") ? "text-emerald-700" : "text-[#AE2448]"}`}>
                      {driveSaveMessage}
                    </p>
                  )}
                </div>

                <div className="mb-2 mt-8">
                  <h2 className="text-[16px] font-bold text-slate-900 mb-1">Link Embedding</h2>
                  <p className="text-[14px] text-slate-600">Using the RCRD Chrome Extension, turn any link into an embedded video that can be played where you shared it.</p>
                </div>
                
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                  {integrationsList.map((intg, index) => (
                    <div 
                      key={intg.key}
                      className={`flex items-center justify-between p-5 hover:bg-slate-50 transition-colors ${
                        index !== integrationsList.length - 1 ? 'border-b border-slate-100' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded text-xl font-bold text-slate-600 shrink-0">
                          {intg.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-[14px] font-bold text-slate-900">{intg.name}</h3>
                          <p className="text-[13px] text-slate-500">{intg.desc}</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => toggleIntegration(intg.key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 shrink-0 ${integrations[intg.key] ? 'bg-[#AE2448]' : 'bg-slate-300'}`}
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
                    <h2 className="text-[16px] font-bold text-slate-900 mb-1">Quick record controls</h2>
                    <p className="text-[14px] text-slate-600">RCRD Quick Record is a one-click record tool that shows up on these sites.</p>
                  </div>
                  <button 
                    onClick={() => setQuickRecordEnabled(!quickRecordEnabled)}
                    className={`${quickRecordEnabled ? 'bg-[#c53030] hover:bg-[#9b2c2c]' : 'bg-[#AE2448] hover:bg-[#6E1A37]'} text-white text-[13px] font-bold px-4 py-2 rounded-lg transition-colors shadow-sm`}
                  >
                    {quickRecordEnabled ? 'Turn off Quick Record' : 'Turn on Quick Record'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "keyboard-shortcuts" && (
              <div className="space-y-8 pb-20">
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm p-8">
                  <h2 className="text-[24px] font-bold text-slate-900 mb-2">Keyboard shortcuts</h2>
                  <p className="text-[14px] text-slate-600 mb-6">Use keyboard shortcuts to increase the speed of your workflow. Many shortcuts appear when you hover over a setting.</p>
                  
                  <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => setUseShortcuts(!useShortcuts)}>
                    <button 
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useShortcuts ? 'bg-[#AE2448]' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useShortcuts ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-[15px] font-medium text-slate-900">Use keyboard shortcuts</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-900 mb-6">Global actions</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] text-slate-600">Quick search</span>
                          <div className="flex gap-1">
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">Ctrl</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">K</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-900 mb-6">Video playback</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] text-slate-600">Play/Pause</span>
                          <div className="flex gap-1">
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">Space</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[15px] font-bold text-slate-900 mb-6">Recording</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] text-slate-600">Start/Stop</span>
                          <div className="flex gap-1">
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">Ctrl</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">Shift</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600">L</span>
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
                <h2 className="text-[18px] font-bold text-slate-700 mb-2">Coming Soon</h2>
                <p className="text-[14px] text-slate-500 max-w-sm">
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
        fontFamily: '"Atlassian Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, system-ui, "Helvetica Neue", sans-serif',
        fontSize: '14px',
        fontWeight: 400,
        fontStyle: 'normal',
        lineHeight: '14px',
        letterSpacing: 'normal',
        color: active ? '#AE2448' : '#292A2E'
      }}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold cursor-pointer transition-all ${
      active 
        ? "bg-[#D5E7B5] shadow-sm" 
        : "hover:bg-slate-50"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`${active ? "text-[#AE2448]" : "text-slate-400"}`}>
          {icon}
        </div>
        <span className="text-sm tracking-wide">{label}</span>
      </div>
      {external && <div className="text-slate-400"><Share2 size={12} className="rotate-45" /></div>}
    </div>
  );
}
