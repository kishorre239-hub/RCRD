"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ExternalLink, 
  ChevronDown, Info, Download, Globe, HardDrive,
  Share2, Bell, Cloud, Check, X,
  Plus, Trash2, Edit2, Users, Mail, Shield, Copy, Sparkles, Search
} from "lucide-react";
import {
  HomeIcon, LibraryIcon, VideoCameraIcon, SettingsIcon,
  UserIcon, WorkspaceIcon
} from "@/components/CustomIcons";
import { 
  saveDriveFolder, getDriveFolder, fetchWithAuth 
} from '@/lib/api';
import UsersTab from '@/components/UsersTab';
import { openGlobalRecording } from "@/components/GlobalRecordingManager";
import RecordVideoButton from "@/components/RecordVideoButton";
import RcrdLogo from "@/components/RcrdLogo";
import ProfileFlyout from "@/components/ProfileFlyout";
import AppHeader from "@/components/AppHeader";
import { useNavPermissions } from "@/lib/navPermissions";

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

interface Batch {
  id: string;
  name: string;
  topic?: string;
  description?: string;
  studentEmails: string[];
  mentorEmail?: string;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
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
  const { canAccess } = useNavPermissions();
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

  // Class Batches & Student Enrollment state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchName, setBatchName] = useState("");
  const [batchTopic, setBatchTopic] = useState("");
  const [batchDescription, setBatchDescription] = useState("");
  const [batchEmailsText, setBatchEmailsText] = useState("");
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchToast, setBatchToast] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [batchSearchQuery, setBatchSearchQuery] = useState("");
  const [copiedBatchId, setCopiedBatchId] = useState<string | null>(null);

  const showBatchNotification = (msg: string) => {
    setBatchToast(msg);
    setTimeout(() => setBatchToast(null), 3500);
  };

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetchWithAuth('/batches');
      const data = await res.json();
      if (data?.batches) {
        setBatches(data.batches);
      }
    } catch (err) {
      console.warn("Failed to load batches:", err);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "workspace") {
      loadBatches();
    }
  }, [activeTab, loadBatches]);

  const openCreateBatch = () => {
    setEditingBatch(null);
    setBatchName("");
    setBatchTopic("");
    setBatchDescription("");
    setBatchEmailsText("");
    setShowBatchModal(true);
  };

  const openEditBatch = (b: Batch) => {
    setEditingBatch(b);
    setBatchName(b.name || "");
    setBatchTopic(b.topic || "");
    setBatchDescription(b.description || "");
    setBatchEmailsText((b.studentEmails || []).join("\n"));
    setShowBatchModal(true);
  };

  const parseEmails = (text: string): string[] => {
    const list = text.split(/[\r\n,;]+/);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const set = new Set<string>();
    for (const item of list) {
      const trimmed = item.trim().toLowerCase();
      if (trimmed && emailRegex.test(trimmed)) {
        set.add(trimmed);
      }
    }
    return Array.from(set);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchName.trim()) {
      showBatchNotification("Please enter a batch name.");
      return;
    }
    const studentEmails = parseEmails(batchEmailsText);
    setBatchSaving(true);
    try {
      if (editingBatch) {
        const res = await fetchWithAuth('/batches', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingBatch.id,
            name: batchName.trim(),
            topic: batchTopic.trim(),
            description: batchDescription.trim(),
            studentEmails,
          }),
        });
        const data = await res.json();
        if (data?.batch) {
          showBatchNotification(`Batch "${batchName}" updated successfully!`);
          setShowBatchModal(false);
          loadBatches();
        } else {
          showBatchNotification(data.error || "Failed to update batch.");
        }
      } else {
        const res = await fetchWithAuth('/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: batchName.trim(),
            topic: batchTopic.trim(),
            description: batchDescription.trim(),
            studentEmails,
          }),
        });
        const data = await res.json();
        if (data?.batch) {
          showBatchNotification(`Batch "${batchName}" created with ${studentEmails.length} enrolled students!`);
          setShowBatchModal(false);
          loadBatches();
        } else {
          showBatchNotification(data.error || "Failed to create batch.");
        }
      }
    } catch {
      showBatchNotification("Network error while saving batch.");
    } finally {
      setBatchSaving(false);
    }
  };

  const handleDeleteBatch = async (b: Batch) => {
    if (!confirm(`Are you sure you want to delete the batch "${b.name}"?`)) return;
    try {
      const res = await fetchWithAuth(`/batches?id=${encodeURIComponent(b.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data?.success) {
        showBatchNotification(`Batch "${b.name}" deleted.`);
        loadBatches();
      } else {
        showBatchNotification(data.error || "Failed to delete batch.");
      }
    } catch {
      showBatchNotification("Network error deleting batch.");
    }
  };

  const copyBatchEmails = (b: Batch) => {
    if (!b.studentEmails || b.studentEmails.length === 0) return;
    navigator.clipboard.writeText(b.studentEmails.join(", "));
    setCopiedBatchId(b.id);
    showBatchNotification(`Copied ${b.studentEmails.length} student emails to clipboard.`);
    setTimeout(() => setCopiedBatchId(null), 2000);
  };

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
        if (tabParam === 'billing') {
          setTimeout(() => setActiveTab('my-account'), 0);
        } else {
          setTimeout(() => setActiveTab(tabParam), 0);
        }
      }
      if (params.get('google_connected') === 'true') {
        setTimeout(() => {
          setGoogleConnected(true);
          setDriveSaveMessage("✓ Successfully connected to your 5 TB Google Drive account!");
          setTimeout(() => setDriveSaveMessage(""), 5000);
        }, 0);
      }

      const handlePopState = () => {
        const p = new URLSearchParams(window.location.search);
        const tab = p.get('tab') || 'my-account';
        setActiveTab(tab);
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('popstate', handlePopState);
      };
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
        <div className="relative h-24 sm:h-26 flex items-center justify-center px-4 border-b border-[#E2E7EC] flex-shrink-0 w-full overflow-hidden">
          <div 
            className="flex items-center justify-center cursor-pointer group mx-auto" 
            onClick={() => { router.push('/'); setIsMobileMenuOpen(false); }}
          >
            <RcrdLogo className="h-20 sm:h-22 md:h-24 w-auto scale-175 sm:scale-190 md:scale-205 origin-center transition-transform group-hover:scale-215" />
          </div>
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 md:hidden p-1.5 text-[#57636E] hover:text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-5 px-4 custom-scrollbar min-h-0">
          <nav className="space-y-1">
            {canAccess('for-you') && <SidebarItem icon={<HomeIcon size={18} />} label="For You" href="/" />}
            {canAccess('library') && <SidebarItem icon={<LibraryIcon size={18} />} label="Library" href="/library" />}
            {canAccess('meetings') && <SidebarItem icon={<VideoCameraIcon size={18} />} label="Meetings" href="/meetings" />}
            {canAccess('settings') && (
              <SidebarItem 
                icon={<SettingsIcon size={18} />} 
                label="Settings" 
                active={activeTab !== 'users' && activeTab !== 'workspace'} 
                onClick={() => {
                  setActiveTab('my-account');
                  setIsMobileMenuOpen(false);
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', '/settings?tab=my-account');
                  }
                }} 
              />
            )}
          </nav>

          {(canAccess('manage-users') || canAccess('workspace-info')) && (
            <div className="mt-10">
              <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#57636E] mb-3">Workspace Admin</h3>
              <nav className="space-y-1">
                {canAccess('manage-users') && (
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
                )}
                {canAccess('workspace-info') && (
                  <SidebarItem 
                    icon={<WorkspaceIcon size={18} />} 
                    label="Workspace Info" 
                    active={activeTab === 'workspace'} 
                    onClick={() => {
                      setActiveTab('workspace');
                      setIsMobileMenuOpen(false);
                      if (typeof window !== 'undefined') {
                        window.history.pushState(null, '', '/settings?tab=workspace');
                      }
                    }} 
                  />
                )}
              </nav>
            </div>
          )}
        </div>

        <RecordVideoButton 
          onClick={() => { openGlobalRecording(); setIsMobileMenuOpen(false); }}
        />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-white overflow-hidden">
        {/* Top Header - Unified Fixed h-16, Centered Search, Image 5 Avatar */}
        <AppHeader 
          placeholder="Search for people, tags, folders, Spaces, and RCRDs"
          onOpenProfile={() => setIsProfileOpen(true)}
          onToggleMobileSidebar={() => setIsMobileMenuOpen(prev => !prev)}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-8 py-5 sm:py-6 min-h-0">
          <div className="max-w-[1000px]">
            {/* Title */}
            <div className="mb-6">
              <p className="text-[13px] text-[#57636E] mb-1">
                {activeTab === 'users' ? 'harikishorereddy9908' : (activeTab === 'workspace' ? 'harikishorereddy9908' : 'Hari Kishore Reddy')}
              </p>
              <h1 className="text-2xl sm:text-[32px] font-bold text-[#20262E] leading-tight">
                {activeTab === 'users' ? 'Users & groups' : (activeTab === 'workspace' ? 'Workspace Info' : 'Personal Settings')}
              </h1>
            </div>

            {/* Banner (only for personal settings, not when viewing users or workspace) */}
            {activeTab !== 'users' && activeTab !== 'workspace' && (
              <div className="bg-[#F5F6F8] border border-[#E2E7EC] rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8">
                <div className="flex items-center gap-3">
                  <Info size={18} className="text-[#57636E] shrink-0" />
                  <p className="text-[14px] text-[#20262E]">Your profile is linked to RCRD. To edit your info, visit your profile on RCRD.</p>
                </div>
                <button className="bg-slate-200 hover:bg-slate-300 text-[#20262E] text-[13px] font-bold px-4 py-1.5 rounded transition-colors shrink-0">
                  Learn more
                </button>
              </div>
            )}

            {/* Tabs (only when personal settings) */}
            {activeTab !== 'users' && activeTab !== 'workspace' && (
              <div className="flex items-center gap-6 border-b border-[#E2E7EC] mb-8 overflow-x-auto">
                {[
                  { id: "my-account", label: "My account" },
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

            {/* Tab Content: Workspace Info */}
            {activeTab === "workspace" && (
              <div className="space-y-6 pb-20">
                <div className="border border-[#E2E7EC] rounded-2xl p-6 sm:p-8 bg-white shadow-xs">
                  <div className="flex items-center gap-4 pb-6 border-b border-[#E2E7EC]">
                    <div className="w-14 h-14 rounded-2xl bg-[#EBF5FB] border border-[#154360]/20 flex items-center justify-center text-[#154360]">
                      <WorkspaceIcon size={28} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#20262E]">harikishorereddy9908 Workspace</h2>
                      <p className="text-xs text-[#57636E] mt-0.5">Primary Managed Workspace · Administrator Controlled</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E7EC]">
                      <p className="text-xs font-semibold text-[#57636E] uppercase tracking-wider mb-1">Workspace Owner</p>
                      <p className="text-sm font-bold text-[#20262E]">Hari Kishore Reddy</p>
                      <p className="text-xs text-[#57636E]">harikishorereddy9908@gmail.com</p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E7EC]">
                      <p className="text-xs font-semibold text-[#57636E] uppercase tracking-wider mb-1">Access Model</p>
                      <p className="text-sm font-bold text-[#154360]">Managed Access Only</p>
                      <p className="text-xs text-[#57636E]">Public signup disabled; employees provisioned by Admin</p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E7EC]">
                      <p className="text-xs font-semibold text-[#57636E] uppercase tracking-wider mb-1">Connected Storage</p>
                      <p className="text-sm font-bold text-emerald-700">Google Drive Enterprise (5 TB)</p>
                      <p className="text-xs text-[#57636E]">Automated backup & sync for all employee recordings</p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E7EC]">
                      <p className="text-xs font-semibold text-[#57636E] uppercase tracking-wider mb-1">Employee Roster</p>
                      <p className="text-sm font-bold text-[#20262E]">Users & Groups Provisioning</p>
                      <button 
                        onClick={() => {
                          setActiveTab('users');
                          if (typeof window !== 'undefined') {
                            window.history.pushState(null, '', '/settings?tab=users');
                          }
                        }}
                        className="text-xs font-semibold text-[#154360] hover:underline mt-0.5 flex items-center gap-1 cursor-pointer"
                      >
                        Manage Users & Permissions →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Toast Notification */}
                {batchToast && (
                  <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-[#154360] text-white text-xs font-semibold rounded-xl shadow-xl shadow-[#154360]/30 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <Check size={16} className="text-emerald-400 shrink-0" />
                    <span>{batchToast}</span>
                  </div>
                )}

                {/* Class Batches & Student Enrollment Section */}
                <div className="border border-[#E2E7EC] rounded-2xl p-6 sm:p-8 bg-white shadow-xs space-y-6">
                  {/* Section Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E2E7EC]">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shrink-0 shadow-2xs">
                        <Users size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-[#20262E]">Class Batches & Student Enrollment</h3>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            {batches.length} {batches.length === 1 ? 'Batch' : 'Batches'}
                          </span>
                        </div>
                        <p className="text-xs text-[#57636E] mt-0.5 max-w-xl">
                          Create dedicated cohorts (e.g. Web Development). When scheduling a meeting, select a batch so only enrolled students can join—outsiders are strictly blocked.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={openCreateBatch}
                        className="px-4 py-2.5 bg-gradient-to-r from-[#154360] to-[#0E2F44] hover:brightness-110 active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-md shadow-[#154360]/20 flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <Plus size={15} />
                        <span>Create New Batch</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  {batches.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#57636E]" size={14} />
                        <input
                          type="text"
                          value={batchSearchQuery}
                          onChange={e => setBatchSearchQuery(e.target.value)}
                          placeholder="Search by batch name, topic, or student email..."
                          className="w-full pl-9 pr-3.5 py-2 bg-[#F8FAFC] border border-[#E2E7EC] focus:border-[#154360] focus:bg-white rounded-xl text-xs outline-none transition-all"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#57636E]">
                        <Shield size={14} className="text-indigo-600" />
                        <span>Total Enrolled Students: <strong className="text-[#20262E]">{batches.reduce((acc, b) => acc + (b.studentEmails?.length || 0), 0)}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Batches Grid or Empty State */}
                  {loadingBatches ? (
                    <div className="py-12 text-center text-xs text-[#57636E]">
                      <div className="inline-block w-6 h-6 border-2 border-[#154360] border-t-transparent rounded-full animate-spin mb-2" />
                      <p>Loading class batches...</p>
                    </div>
                  ) : batches.length === 0 ? (
                    <div className="p-8 sm:p-10 rounded-2xl border-2 border-dashed border-[#E2E7EC] bg-[#F8FAFC] text-center space-y-4">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto text-indigo-600">
                        <Users size={28} />
                      </div>
                      <div className="max-w-md mx-auto">
                        <h4 className="text-sm font-bold text-[#20262E]">No Class Batches Created Yet</h4>
                        <p className="text-xs text-[#57636E] mt-1">
                          Create your first batch (e.g. &ldquo;Web Development&rdquo;) and add your student emails. Once created, mentors can select this batch when starting a meeting.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          openCreateBatch();
                          setBatchName("Web Development Batch");
                          setBatchTopic("Full-Stack Web Development");
                        }}
                        className="px-4 py-2.5 bg-[#154360] hover:bg-[#1A5276] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Create &ldquo;Web Development&rdquo; Batch</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {batches
                        .filter(b => {
                          if (!batchSearchQuery.trim()) return true;
                          const q = batchSearchQuery.toLowerCase();
                          return (
                            b.name.toLowerCase().includes(q) ||
                            (b.topic || "").toLowerCase().includes(q) ||
                            (b.studentEmails || []).some(e => e.toLowerCase().includes(q))
                          );
                        })
                        .map(b => {
                          const isExpanded = expandedBatchId === b.id;
                          return (
                            <div
                              key={b.id}
                              className="border border-[#E2E7EC] hover:border-indigo-300 rounded-2xl p-5 bg-white transition-all shadow-xs flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-sm font-extrabold text-[#20262E] truncate">
                                        {b.name}
                                      </h4>
                                      {b.topic && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#EBF5FB] text-[#154360] border border-[#154360]/20">
                                          {b.topic}
                                        </span>
                                      )}
                                    </div>
                                    {b.description && (
                                      <p className="text-xs text-[#57636E] mt-1 line-clamp-2">
                                        {b.description}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => openEditBatch(b)}
                                      title="Edit Batch"
                                      className="p-1.5 text-[#57636E] hover:text-[#154360] hover:bg-[#F5F6F8] rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBatch(b)}
                                      title="Delete Batch"
                                      className="p-1.5 text-[#57636E] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-[#E2E7EC]/70 flex items-center justify-between text-xs">
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-900 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100">
                                    <Shield size={12} className="text-indigo-600" />
                                    <span>{b.studentEmails?.length || 0} Students Enrolled</span>
                                  </span>

                                  <div className="flex items-center gap-2">
                                    {b.studentEmails?.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => copyBatchEmails(b)}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#57636E] hover:text-[#154360] cursor-pointer"
                                        title="Copy all student emails"
                                      >
                                        {copiedBatchId === b.id ? (
                                          <>
                                            <Check size={12} className="text-emerald-600" />
                                            <span className="text-emerald-600 font-bold">Copied</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy size={12} />
                                            <span>Copy Emails</span>
                                          </>
                                        )}
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => setExpandedBatchId(isExpanded ? null : b.id)}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#154360] hover:underline cursor-pointer"
                                    >
                                      <span>{isExpanded ? 'Hide' : 'View'} Emails</span>
                                      <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded Enrolled Emails */}
                                {isExpanded && (
                                  <div className="mt-3 pt-3 border-t border-indigo-100/60 bg-[#F8FAFC] p-3 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-[#57636E] uppercase tracking-wider">
                                      <span>Authorized Student Emails</span>
                                      <span>{b.studentEmails?.length || 0} verified</span>
                                    </div>

                                    {b.studentEmails && b.studentEmails.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                                        {b.studentEmails.map((email, idx) => (
                                          <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-[#E2E7EC] text-[#20262E] shadow-2xs"
                                          >
                                            <Mail size={10} className="text-[#57636E]" />
                                            {email}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-[#57636E] italic">
                                        No student emails registered. Click &ldquo;Edit Batch&rdquo; to paste email addresses.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Create / Edit Batch Modal */}
                {showBatchModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-[#E2E7EC] space-y-5 animate-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between pb-4 border-b border-[#E2E7EC]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                            <Users size={20} />
                          </div>
                          <div>
                            <h3 className="text-base font-extrabold text-[#20262E]">
                              {editingBatch ? 'Edit Class Batch' : 'Create New Class Batch'}
                            </h3>
                            <p className="text-xs text-[#57636E]">
                              Configure student enrollment and meeting access control
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowBatchModal(false)}
                          className="p-1.5 text-[#57636E] hover:text-[#20262E] hover:bg-[#F5F6F8] rounded-lg transition-colors cursor-pointer"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <form onSubmit={handleSaveBatch} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                            Batch Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={batchName}
                            onChange={e => setBatchName(e.target.value)}
                            placeholder="e.g. Web Development - Batch 1"
                            className="w-full px-3.5 py-2.5 bg-white border border-[#E2E7EC] focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/15 rounded-xl text-xs outline-none transition-all font-medium text-[#20262E]"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                              Course / Topic
                            </label>
                            <input
                              type="text"
                              value={batchTopic}
                              onChange={e => setBatchTopic(e.target.value)}
                              placeholder="e.g. Full-Stack Web Development"
                              className="w-full px-3.5 py-2.5 bg-white border border-[#E2E7EC] focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/15 rounded-xl text-xs outline-none transition-all font-medium text-[#20262E]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                              Short Description
                            </label>
                            <input
                              type="text"
                              value={batchDescription}
                              onChange={e => setBatchDescription(e.target.value)}
                              placeholder="e.g. Monday-Friday evening cohort"
                              className="w-full px-3.5 py-2.5 bg-white border border-[#E2E7EC] focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/15 rounded-xl text-xs outline-none transition-all font-medium text-[#20262E]"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold text-[#20262E] uppercase tracking-wider">
                              Enrolled Student Emails *
                            </label>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                              {parseEmails(batchEmailsText).length} valid emails detected
                            </span>
                          </div>
                          <textarea
                            rows={6}
                            value={batchEmailsText}
                            onChange={e => setBatchEmailsText(e.target.value)}
                            placeholder={"student1@gmail.com\nstudent2@example.com\nstudent3@domain.org\n(Paste emails separated by new lines, commas, or semicolons)"}
                            className="w-full p-3.5 bg-white border border-[#E2E7EC] focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/15 rounded-xl text-xs outline-none transition-all font-mono font-medium text-[#20262E] leading-relaxed resize-y"
                          />
                          <p className="text-[11px] text-[#57636E] mt-1 flex items-center gap-1.5">
                            <Shield size={12} className="text-indigo-600 shrink-0" />
                            <span>When a host starts a meeting assigned to this batch, only students with these emails will be allowed in.</span>
                          </p>
                        </div>

                        <div className="pt-3 border-t border-[#E2E7EC] flex items-center justify-end gap-2.5">
                          <button
                            type="button"
                            onClick={() => setShowBatchModal(false)}
                            className="px-4 py-2 border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#57636E] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={batchSaving || !batchName.trim()}
                            className="px-5 py-2 bg-gradient-to-r from-[#154360] to-[#0E2F44] hover:brightness-110 active:scale-[0.99] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-[#154360]/20 transition-all cursor-pointer"
                          >
                            {batchSaving ? 'Saving...' : (editingBatch ? 'Save Changes' : 'Create Batch')}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

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
            {!["my-account", "billing", "meeting-recordings", "push-notifications", "integrations", "quick-record", "keyboard-shortcuts", "workspace", "users"].includes(activeTab) && (
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
