"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  ChevronDown, X,
  Trash2, Check, UserPlus,
  RefreshCw, AlertCircle, UserCheck, UserX,
  Eye, EyeOff, Edit2,
  Home, Film, Video, Settings as SettingsIcon, Users, Building2, CreditCard
} from "lucide-react";
import { ALL_NAV_ITEMS, getDefaultNavItemsForRole, useNavPermissions } from "@/lib/navPermissions";

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Mentor" | string;
  dateAdded: string;
  status: "Active" | "Access Revoked" | "Suspended" | string;
  hasAccess?: boolean;
  allowedNavItems?: string[];
  avatarUrl?: string | null;
}

const DEFAULT_USERS: WorkspaceUser[] = [
  {
    id: "usr-admin-1",
    name: "Hari Kishore Reddy",
    email: "harikishorereddy9908@gmail.com",
    role: "Admin",
    dateAdded: "24 April 2026",
    status: "Active",
    hasAccess: true,
    allowedNavItems: ALL_NAV_ITEMS.map(i => i.id),
    avatarUrl: null,
  },
];

const LOCAL_STORAGE_KEY = "RCRD_workspace_users_list";
const PRIMARY_OWNER_EMAIL = "harikishorereddy9908@gmail.com";

const isDummyUserEmail = (email: string) => {
  const e = (email || "").toLowerCase().trim();
  if (e === PRIMARY_OWNER_EMAIL) return false;
  return (
    e.includes("geonixa.com") ||
    e.includes("@example.com") ||
    e.includes("@meet.com") ||
    /^(sarah|student_|mentor_|newadmin|sec_admin|reuse|test|audit)/i.test(e)
  );
};

const NAV_ICONS: Record<string, React.ReactNode> = {
  "for-you": <Home size={14} />,
  "library": <Film size={14} />,
  "meetings": <Video size={14} />,
  "settings": <SettingsIcon size={14} />,
  "manage-users": <Users size={14} />,
  "workspace-info": <Building2 size={14} />,
  "billing": <CreditCard size={14} />,
};

export default function UsersTab() {
  const { userEmail, role: currentRole, isAdmin: isPermAdmin } = useNavPermissions();
  const isAdmin = 
    (userEmail || "").toLowerCase().trim() === PRIMARY_OWNER_EMAIL || 
    isPermAdmin ||
    (typeof window !== "undefined" && (() => {
      try {
        const p = JSON.parse(localStorage.getItem("rcrd_user_profile") || "{}");
        return (p.email || "").toLowerCase().trim() === PRIMARY_OWNER_EMAIL || (p.role || "").toUpperCase() === "ADMIN";
      } catch { return false; }
    })());

  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All Roles" | "Admins" | "Mentors">("All Roles");
  const [memberFilter, setMemberFilter] = useState<"All members" | "Access Granted" | "Access Revoked">("All members");
  
  // Selection for bulk delete
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Dropdown states
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<WorkspaceUser | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<WorkspaceUser | null>(null);
  
  // Add User Form States (Only Mentor & Admin)
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [giveImmediateAccess, setGiveImmediateAccess] = useState(true);
  const [newRole, setNewRole] = useState<"Mentor" | "Admin">("Mentor");
  const [newAllowedNav, setNewAllowedNav] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit User Form States
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"Mentor" | "Admin">("Mentor");
  const [editAllowedNav, setEditAllowedNav] = useState<string[]>([]);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>("Active");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, ok = true) => {
    setToastMessage({ text, ok });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper when role changes in Add modal - Admin gets all 7 items, Mentor gets customizable defaults
  const handleNewRoleChange = (role: "Mentor" | "Admin") => {
    setNewRole(role);
    if (role === "Admin") {
      setNewAllowedNav(ALL_NAV_ITEMS.map(i => i.id));
    } else {
      setNewAllowedNav(getDefaultNavItemsForRole("Mentor"));
    }
  };

  // Helper when role changes in Edit modal - Admin gets all 7 items
  const handleEditRoleChange = (role: "Mentor" | "Admin") => {
    setEditRole(role);
    if (role === "Admin") {
      setEditAllowedNav(ALL_NAV_ITEMS.map(i => i.id));
    }
  };

  // Fetch users from API and sync with local storage
  const fetchUsers = async (showLoadingState = false) => {
    if (showLoadingState) setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch("/api/workspaces/users", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const cleanRemote = data.filter((u: Record<string, unknown>) => !isDummyUserEmail(String(u.email || "")));
          const formatted: WorkspaceUser[] = cleanRemote.map((u: Record<string, unknown>, idx: number) => {
            const rawDate = u.createdAt ? new Date(Number(u.createdAt)) : new Date();
            const dateStr = !isNaN(rawDate.getTime()) 
              ? rawDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
              : "24 April 2026";
            
            const rawRole = String(u.role || "Mentor");
            const roleUpper = rawRole.toUpperCase();
            const roleFormatted: "Admin" | "Mentor" = roleUpper === "ADMIN" ? "Admin" : "Mentor";

            const rawStatus = String(u.status || "Active");
            const hasAccess = u.hasAccess !== undefined ? !!u.hasAccess : rawStatus.toLowerCase() === "active";
            const allowedNav = Array.isArray(u.allowedNavItems)
              ? (u.allowedNavItems as string[])
              : getDefaultNavItemsForRole(roleFormatted);

            return {
              id: String(u.id || u._id || `usr-${idx}`),
              name: String(u.name || "Workspace Member"),
              email: String(u.email || ""),
              role: roleFormatted,
              dateAdded: dateStr,
              status: rawStatus,
              hasAccess,
              allowedNavItems: allowedNav,
              avatarUrl: (u.avatarUrl as string) || null,
            };
          });
          const resultList = formatted.length > 0 ? formatted : DEFAULT_USERS;
          setUsers(resultList);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(resultList));
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote users, checking local store:", err);
    }

    // Fallback to local storage (filtering out dummy accounts) or defaults
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanLocal = parsed
            .filter((u: WorkspaceUser) => !isDummyUserEmail(u.email))
            .map((u: WorkspaceUser) => ({
              ...u,
              role: (u.role || "").toUpperCase() === "ADMIN" ? "Admin" : "Mentor",
              allowedNavItems: u.allowedNavItems || getDefaultNavItemsForRole(u.role),
            }));
          if (cleanLocal.length > 0) {
            setUsers(cleanLocal);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanLocal));
            setLoading(false);
            return;
          }
        }
      }
    } catch {}

    setUsers(DEFAULT_USERS);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        void fetchUsers();
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const saveUsers = (updated: WorkspaceUser[]) => {
    setUsers(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  // ADD USER HANDLER
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) {
      showToast("Please enter a valid work email address.", false);
      return;
    }
    const cleanName = newName.trim() || newEmail.split("@")[0];
    const initialStatus = giveImmediateAccess ? "Active" : "Access Revoked";
    const passwordToSet = newPassword.trim() || "rcrd2026";

    setIsSubmitting(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

      const res = await fetch("/api/workspaces/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: cleanName,
          email: newEmail.trim().toLowerCase(),
          role: newRole,
          password: passwordToSet,
          status: initialStatus,
          allowedNavItems: newAllowedNav,
        }),
      });

      const today = new Date().toLocaleDateString("en-GB", { 
        day: "numeric", 
        month: "long", 
        year: "numeric" 
      });

      let newUser: WorkspaceUser;
      if (res.ok) {
        const data = await res.json();
        newUser = {
          id: data.id || data._id || `usr-${Date.now()}`,
          name: data.name || cleanName,
          email: data.email || newEmail.trim().toLowerCase(),
          role: newRole,
          dateAdded: today,
          status: initialStatus,
          hasAccess: giveImmediateAccess,
          allowedNavItems: newAllowedNav,
        };
      } else {
        newUser = {
          id: `usr-${Date.now()}`,
          name: cleanName,
          email: newEmail.trim().toLowerCase(),
          role: newRole,
          dateAdded: today,
          status: initialStatus,
          hasAccess: giveImmediateAccess,
          allowedNavItems: newAllowedNav,
        };
      }

      const updated = [...users.filter(u => u.email !== newUser.email), newUser];
      saveUsers(updated);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setGiveImmediateAccess(true);
      setShowAddModal(false);
      showToast(`Employee ${newUser.name} provisioned as ${newUser.role} with ${newAllowedNav.length} sidebars enabled!`);
    } catch (err) {
      console.error("Error adding user:", err);
      showToast("Failed to add user to server. Saved locally.", false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // OPEN EDIT MODAL
  const openEditModal = (user: WorkspaceUser) => {
    setEditingUser(user);
    setEditName(user.name);
    const roleClean: "Mentor" | "Admin" = user.role === "Admin" ? "Admin" : "Mentor";
    setEditRole(roleClean);
    setEditAllowedNav(user.allowedNavItems && Array.isArray(user.allowedNavItems)
      ? [...user.allowedNavItems] 
      : getDefaultNavItemsForRole(roleClean));
    setEditAvatarUrl(user.avatarUrl || null);
    setEditStatus(user.status || "Active");
    setEditPassword("");
    setShowEditPassword(false);
  };

  // SAVE EDIT USER
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSavingEdit(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const payload: Record<string, unknown> = {
        name: editName.trim() || editingUser.name,
        role: editRole,
        allowedNavItems: editAllowedNav,
        status: editStatus,
        hasAccess: editStatus.toLowerCase() === "active",
        avatarUrl: editAvatarUrl,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const res = await fetch(`/api/workspaces/users/${editingUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const updatedList = users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            name: editName.trim() || u.name,
            role: editRole,
            allowedNavItems: editAllowedNav,
            status: editStatus,
            hasAccess: editStatus.toLowerCase() === "active",
            avatarUrl: editAvatarUrl,
          };
        }
        return u;
      });

      saveUsers(updatedList);
      setEditingUser(null);
      showToast(res.ok ? `Updated ${editName || editingUser.name} successfully!` : "Saved changes locally.");
    } catch {
      showToast("Error updating user settings.", false);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // TOGGLE LOGIN ACCESS (GIVE ACCESS / REVOKE ACCESS)
  const handleToggleAccess = async (userId: string, grant: boolean) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    if (target.email === PRIMARY_OWNER_EMAIL && !grant) {
      showToast("Cannot revoke access for the primary workspace owner.", false);
      return;
    }

    const nextStatus = grant ? "Active" : "Access Revoked";
    const updated = users.map(u => u.id === userId ? { ...u, status: nextStatus, hasAccess: grant } : u);
    saveUsers(updated);

    if (editingUser && editingUser.id === userId) {
      setEditingUser({ ...editingUser, status: nextStatus, hasAccess: grant });
    }

    showToast(grant ? `Login access granted for ${target.name}.` : `Login access revoked for ${target.name}.`);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      await fetch(`/api/workspaces/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus, hasAccess: grant }),
      });
    } catch (err) {
      console.warn("Could not sync access status to server:", err);
    }
  };

  // SINGLE DELETE USER HANDLER
  const handleConfirmDelete = async () => {
    if (!deleteTargetUser) return;
    const target = deleteTargetUser;
    if (target.email === PRIMARY_OWNER_EMAIL) {
      showToast("Cannot remove the primary workspace owner.", false);
      setDeleteTargetUser(null);
      return;
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      await fetch(`/api/workspaces/users/${target.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {}

    const updated = users.filter(u => u.id !== target.id);
    saveUsers(updated);
    setSelectedUserIds(prev => prev.filter(id => id !== target.id));
    setDeleteTargetUser(null);
    if (editingUser?.id === target.id) {
      setEditingUser(null);
    }
    showToast(`Deleted employee ${target.name} from workspace.`);
  };

  // MULTIPLE USERS BULK DELETE HANDLER
  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;
    setIsBulkDeleting(true);

    const idsToDelete = [...selectedUserIds];
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      // 1. Attempt bulk API delete
      const res = await fetch("/api/workspaces/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userIds: idsToDelete }),
      });

      // 2. Fallback to individual deletes if bulk route wasn't matched
      if (!res.ok) {
        await Promise.all(
          idsToDelete.map(id =>
            fetch(`/api/workspaces/users/${id}`, {
              method: "DELETE",
              headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            }).catch(() => {})
          )
        );
      }
    } catch (err) {
      console.warn("Bulk delete server sync error:", err);
    }

    const updated = users.filter(u => !idsToDelete.includes(u.id));
    saveUsers(updated);
    setSelectedUserIds([]);
    setShowBulkDeleteModal(false);
    setIsBulkDeleting(false);
    showToast(`Successfully deleted ${idsToDelete.length} employee${idsToDelete.length === 1 ? '' : 's'} from workspace.`);
  };

  // Filtered Users computation
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const userRole = (user.role || "").toLowerCase();
      let matchesRole = true;
      if (roleFilter === "Admins") matchesRole = userRole === "admin";
      else if (roleFilter === "Mentors") matchesRole = userRole === "mentor";

      let matchesMember = true;
      const isActive = (user.status || "Active").toLowerCase() === "active";
      if (memberFilter === "Access Granted") matchesMember = isActive;
      if (memberFilter === "Access Revoked") matchesMember = !isActive;

      return matchesSearch && matchesRole && matchesMember;
    });
  }, [users, searchQuery, roleFilter, memberFilter]);

  // Selectable users (excludes primary owner)
  const selectableUsers = useMemo(() => {
    return filteredUsers.filter(u => u.email !== PRIMARY_OWNER_EMAIL);
  }, [filteredUsers]);

  const isAllSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedUserIds.includes(u.id));
  const isSomeSelected = selectableUsers.some(u => selectedUserIds.includes(u.id)) && !isAllSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(selectableUsers.map(u => u.id));
    }
  };

  const handleToggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  // Toggle single nav item in Add User modal
  const toggleNewNavItem = (id: string) => {
    setNewAllowedNav(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Toggle single nav item in Edit User modal
  const toggleEditNavItem = (id: string) => {
    setEditAllowedNav(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  if (!isAdmin) {
    return (
      <div className="bg-white border border-[#E2E7EC] rounded-2xl p-8 text-center max-w-lg mx-auto my-12 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-bold text-[#20262E] mb-2">Administrator Access Required</h3>
        <p className="text-xs text-[#57636E] leading-relaxed mb-4">
          Only the workspace administrator (<strong className="text-[#20262E]">{PRIMARY_OWNER_EMAIL}</strong>) has access to manage workspace users and select side navbar permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold animate-in slide-in-from-top-3 ${
          toastMessage.ok 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-rose-50 text-rose-800 border-rose-200"
        }`}>
          {toastMessage.ok ? <Check size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-rose-600" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white border border-[#E2E7EC] rounded-2xl p-6 sm:p-8 shadow-xs">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-bold text-[#20262E] flex items-center gap-2.5">
                <span>Users &amp; groups</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#EBF5FB] text-[#154360] font-bold border border-[#154360]/15">
                  {users.length} {users.length === 1 ? "Employee" : "Employees"}
                </span>
              </h2>
              <p className="text-[13px] text-[#57636E] mt-1">
                Manage roles (Admin, Mentor), side navbar access, and login permissions dynamically.
              </p>
            </div>
            <button
              onClick={() => {
                setNewName("");
                setNewEmail("");
                setNewPassword("");
                setNewRole("Mentor");
                setNewAllowedNav(getDefaultNavItemsForRole("Mentor"));
                setGiveImmediateAccess(true);
                setShowAddModal(true);
              }}
              className="bg-[#154360] hover:bg-[#0E2F44] text-white text-[13px] font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <UserPlus size={16} />
              <span>+ Add user</span>
            </button>
          </div>

          {/* Quick Metrics Strip utilizing full screen width */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[#E2E7EC]/80">
            <div className="p-4 bg-[#F8FAFC] border border-[#E2E7EC] rounded-2xl transition-all hover:shadow-xs">
              <span className="text-[11px] font-bold text-[#57636E] uppercase tracking-wider block">Total Members</span>
              <span className="text-2xl font-black text-[#20262E] mt-1 block">{users.length}</span>
            </div>
            <div className="p-4 bg-purple-50/60 border border-purple-200/70 rounded-2xl transition-all hover:shadow-xs">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">Mentors</span>
              <span className="text-2xl font-black text-[#6C3483] mt-1 block">{users.filter(u => u.role === "Mentor").length}</span>
            </div>
            <div className="p-4 bg-blue-50/60 border border-blue-200/70 rounded-2xl transition-all hover:shadow-xs">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Administrators</span>
              <span className="text-2xl font-black text-[#154360] mt-1 block">{users.filter(u => u.role === "Admin").length}</span>
            </div>
            <div className="p-4 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl transition-all hover:shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Active Logins</span>
              <span className="text-2xl font-black text-emerald-800 mt-1 block">{users.filter(u => (u.status || "Active").toLowerCase() === "active").length}</span>
            </div>
          </div>
        </div>

        {/* Floating Bulk Action Bar (when multiple users selected) */}
        {selectedUserIds.length > 0 && (
          <div className="mb-4 p-3 px-4 bg-[#154360] text-white rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-white/20 text-white flex items-center justify-center text-xs font-bold">
                {selectedUserIds.length}
              </span>
              <span className="text-xs font-bold tracking-wide">
                {selectedUserIds.length} {selectedUserIds.length === 1 ? "Employee" : "Employees"} Selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedUserIds([])}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-100 transition-colors cursor-pointer"
              >
                Deselect All
              </button>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Delete Selected ({selectedUserIds.length})</span>
              </button>
            </div>
          </div>
        )}

        {/* Toolbar: Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-[340px]">
              <input
                type="text"
                placeholder="Search by name or email address"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-3.5 pr-8 py-2 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] placeholder:text-[#57636E] focus:outline-none focus:border-[#154360] focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#57636E] hover:text-[#20262E]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Role Filter (Only All Roles, Admins, Mentors) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsRoleDropdownOpen(!isRoleDropdownOpen);
                  setIsMemberDropdownOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-[#F5F6F8] hover:bg-slate-200/80 border border-[#E2E7EC] rounded-xl text-xs font-semibold text-[#20262E] transition-colors cursor-pointer"
              >
                <span>Role: {roleFilter}</span>
                <ChevronDown size={14} className="text-[#57636E]" />
              </button>

              {isRoleDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-40 bg-white border border-[#E2E7EC] rounded-xl shadow-lg py-1 z-30 animate-in fade-in zoom-in-95">
                  {(["All Roles", "Admins", "Mentors"] as const).map(role => (
                    <button
                      key={role}
                      onClick={() => {
                        setRoleFilter(role);
                        setIsRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                        roleFilter === role ? "bg-[#EBF5FB] text-[#154360]" : "text-[#20262E] hover:bg-[#F5F6F8]"
                      }`}
                    >
                      <span>{role}</span>
                      {roleFilter === role && <Check size={12} className="text-[#154360]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Access Status Filter */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsMemberDropdownOpen(!isMemberDropdownOpen);
                  setIsRoleDropdownOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-[#F5F6F8] hover:bg-slate-200/80 border border-[#E2E7EC] rounded-xl text-xs font-semibold text-[#20262E] transition-colors cursor-pointer"
              >
                <span>Status: {memberFilter}</span>
                <ChevronDown size={14} className="text-[#57636E]" />
              </button>

              {isMemberDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-44 bg-white border border-[#E2E7EC] rounded-xl shadow-lg py-1 z-30 animate-in fade-in zoom-in-95">
                  {(["All members", "Access Granted", "Access Revoked"] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        setMemberFilter(status);
                        setIsMemberDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors ${
                        memberFilter === status ? "bg-[#EBF5FB] text-[#154360]" : "text-[#20262E] hover:bg-[#F5F6F8]"
                      }`}
                    >
                      <span>{status}</span>
                      {memberFilter === status && <Check size={12} className="text-[#154360]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Refresh Action */}
          <button
            onClick={() => fetchUsers(true)}
            title="Refresh users from server"
            className="p-2 border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#57636E] hover:text-[#20262E] rounded-xl transition-colors cursor-pointer shrink-0 self-end sm:self-center"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-[#154360]" : ""} />
          </button>
        </div>

        {/* Users Table */}
        <div className="border border-[#E2E7EC]/90 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[#E2E7EC] bg-[#F8FAFC] text-[11px] font-bold text-[#57636E] uppercase tracking-wider">
                  {/* Select All Checkbox */}
                  <th className="py-3.5 px-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      ref={headerCheckboxRef}
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      disabled={selectableUsers.length === 0}
                      title="Select all employees for bulk delete"
                      className="w-4 h-4 rounded text-[#154360] focus:ring-[#154360] border-slate-300 cursor-pointer disabled:opacity-40"
                    />
                  </th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Side Navbar Access</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Login Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E7EC]/60 text-[13px]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-[#57636E]">
                      <div className="flex items-center justify-center gap-2 text-xs font-medium">
                        <RefreshCw size={16} className="animate-spin text-[#154360]" />
                        <span>Loading workspace users...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-[#57636E]">
                      <p className="font-bold text-[#20262E] text-sm">No employees match your filter</p>
                      <p className="text-xs text-[#57636E] mt-1">Click &quot;+ Add user&quot; to provision a new team member.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    const roleUpper = (user.role || "Mentor").toUpperCase();
                    const isAdmin = roleUpper === "ADMIN";
                    const isActive = (user.status || "Active").toLowerCase() === "active";
                    const isPrimaryOwner = user.email === PRIMARY_OWNER_EMAIL;
                    const allowed = user.allowedNavItems || getDefaultNavItemsForRole(user.role);
                    const isSelected = selectedUserIds.includes(user.id);

                    return (
                      <tr 
                        key={user.id}
                        className={`hover:bg-[#F5F6F8]/70 transition-colors group ${isSelected ? "bg-[#EBF5FB]/50" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-3.5 w-10 text-center">
                          {!isPrimaryOwner ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectUser(user.id)}
                              className="w-4 h-4 rounded text-[#154360] focus:ring-[#154360] border-slate-300 cursor-pointer"
                              title={`Select ${user.name}`}
                            />
                          ) : (
                            <span className="text-[11px] text-slate-300 select-none" title="Primary owner protected">•</span>
                          )}
                        </td>

                        {/* Name with mentor profile photo or initials */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            {user.avatarUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={user.avatarUrl}
                                alt={user.name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs shrink-0 ring-1 ring-slate-200"
                              />
                            ) : (
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 shadow-xs ${
                                isAdmin ? "bg-[#154360] text-white" : "bg-[#6C3483] text-white"
                              }`}>
                                {getInitials(user.name)}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-[#20262E]">{user.name}</p>
                              <p className="text-[11px] text-[#57636E]">Added {user.dateAdded}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                            isAdmin 
                              ? "bg-blue-50 text-blue-800 border-blue-200" 
                              : "bg-purple-50 text-purple-800 border-purple-200"
                          }`}>
                            {isAdmin ? "Admin" : "Mentor"}
                          </span>
                        </td>

                        {/* Allowed Side Navbars */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-[260px]">
                            {isAdmin ? (
                              <span className="text-[11px] font-semibold text-[#154360] bg-[#EBF5FB] px-2 py-0.5 rounded-md border border-[#154360]/15">
                                All Sidebars ({ALL_NAV_ITEMS.length})
                              </span>
                            ) : allowed.length === 0 ? (
                              <span className="text-[11px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                None Enabled
                              </span>
                            ) : (
                              allowed.map(navId => {
                                const item = ALL_NAV_ITEMS.find(i => i.id === navId);
                                return (
                                  <span 
                                    key={navId}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#20262E] bg-slate-100 px-2 py-0.5 rounded-md border border-[#E2E7EC]"
                                    title={item?.description}
                                  >
                                    {NAV_ICONS[navId]}
                                    <span>{item?.label || navId}</span>
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </td>

                        {/* Email address */}
                        <td className="py-3.5 px-4 text-[#57636E] font-mono text-[12px]">
                          {user.email}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Access Revoked
                            </span>
                          )}
                        </td>

                        {/* Actions: Give/Revoke, Edit, Delete */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Give / Revoke Access Button */}
                            {!isPrimaryOwner && (
                              isActive ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleAccess(user.id, false)}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="Revoke login access"
                                >
                                  <UserX size={13} />
                                  <span className="hidden md:inline">Revoke Access</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleAccess(user.id, true)}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="Give login access"
                                >
                                  <UserCheck size={13} />
                                  <span className="hidden md:inline">Give Access</span>
                                </button>
                              )
                            )}

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => openEditModal(user)}
                              className="p-1.5 bg-slate-100 hover:bg-[#EBF5FB] text-[#20262E] hover:text-[#154360] border border-[#E2E7EC] hover:border-[#154360]/30 rounded-lg transition-colors cursor-pointer"
                              title="Edit user role and sidebar navigation"
                            >
                              <Edit2 size={14} />
                            </button>

                            {/* Delete Button */}
                            {!isPrimaryOwner && (
                              <button
                                type="button"
                                onClick={() => setDeleteTargetUser(user)}
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 text-[#57636E] hover:text-rose-700 border border-[#E2E7EC] hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                                title="Delete employee from workspace"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}

                            {isPrimaryOwner && (
                              <span className="text-[11px] font-bold text-[#57636E] uppercase bg-slate-100 px-2 py-0.5 rounded">Owner</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD EMPLOYEE MODAL (ROLE + SIDE NAVBAR SELECTION + CREDENTIALS) */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[540px] my-8 overflow-hidden border border-[#E2E7EC] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#E2E7EC] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#EBF5FB] border border-[#154360]/20 flex items-center justify-center text-[#154360]">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#20262E]">Add Employee &amp; Grant Access</h3>
                  <p className="text-xs text-[#57636E]">Assign role, side navbars, and initial login password.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-[#57636E] hover:text-[#20262E] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddUser} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Full Name */}
              <div>
                <label className="block text-[12px] font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Geonixa Instructor"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] focus:outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/10 transition-all font-medium"
                />
              </div>

              {/* Work Email */}
              <div>
                <label className="block text-[12px] font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                  Work Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="geonixa@rcrd.com"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] focus:outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/10 transition-all font-medium"
                />
              </div>

              {/* Login Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-bold text-[#20262E] uppercase tracking-wider">
                    Login Password
                  </label>
                  <span className="text-[11px] text-[#57636E]">Default: rcrd2026</span>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Set password (or empty for rcrd2026)"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] focus:outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/10 transition-all font-medium pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#57636E] hover:text-[#20262E] cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* ROLE SELECTION (Mentor and Admin only - Creator removed) */}
              <div>
                <label className="block text-[12px] font-bold text-[#20262E] uppercase tracking-wider mb-2">
                  Role &amp; Responsibility
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Mentor */}
                  <div
                    onClick={() => handleNewRoleChange("Mentor")}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      newRole === "Mentor"
                        ? "border-[#6C3483] bg-[#F4ECF7] ring-2 ring-[#6C3483]/20 shadow-xs"
                        : "border-[#E2E7EC] hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#5B2C6F]">Mentor</span>
                      {newRole === "Mentor" && <Check size={16} className="text-[#6C3483]" />}
                    </div>
                    <p className="text-[11px] text-[#57636E] leading-tight">Custom Sidebars</p>
                  </div>

                  {/* Admin */}
                  <div
                    onClick={() => handleNewRoleChange("Admin")}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      newRole === "Admin"
                        ? "border-[#154360] bg-[#EBF5FB] ring-2 ring-[#154360]/20 shadow-xs"
                        : "border-[#E2E7EC] hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#154360]">Admin</span>
                      {newRole === "Admin" && <Check size={16} className="text-[#154360]" />}
                    </div>
                    <p className="text-[11px] text-[#57636E] leading-tight">Full Workspace</p>
                  </div>
                </div>
              </div>

              {/* SIDE NAVBAR ACCESS SELECTION FOR ONBOARDING (Selected by admin for each user) */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E7EC]">
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-[#20262E] uppercase tracking-wider">
                      Side Navbar Access ({newAllowedNav.length} of {ALL_NAV_ITEMS.length} Selected)
                    </h4>
                    <p className="text-[11px] text-[#57636E]">
                      Select how many side navbar items will appear for this employee.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewAllowedNav(ALL_NAV_ITEMS.map(i => i.id))}
                      className="text-[11px] font-bold text-[#154360] hover:underline px-2 py-0.5 rounded bg-white border border-[#E2E7EC] cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAllowedNav([])}
                      className="text-[11px] font-bold text-[#57636E] hover:underline px-2 py-0.5 rounded bg-white border border-[#E2E7EC] cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {ALL_NAV_ITEMS.map(item => {
                    const isChecked = newAllowedNav.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleNewNavItem(item.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleNewNavItem(item.id);
                          }
                        }}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left cursor-pointer transition-all select-none ${
                          isChecked 
                            ? "bg-white border-[#154360] shadow-xs ring-2 ring-[#154360]/20" 
                            : "bg-white/60 border-[#E2E7EC] hover:border-slate-300 hover:bg-white opacity-70 hover:opacity-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          tabIndex={-1}
                          className="mt-0.5 w-4 h-4 rounded text-[#154360] focus:ring-[#154360] border-slate-300 pointer-events-none cursor-pointer"
                        />
                        <div className="flex-1 min-w-0 pointer-events-none">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#20262E]">
                            {NAV_ICONS[item.id]}
                            <span>{item.label}</span>
                          </div>
                          <p className="text-[10px] text-[#57636E] truncate">{item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Immediate Login Access Switch */}
              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-[#E2E7EC] cursor-pointer">
                <input
                  type="checkbox"
                  checked={giveImmediateAccess}
                  onChange={e => setGiveImmediateAccess(e.target.checked)}
                  className="w-4 h-4 rounded text-[#154360] focus:ring-[#154360] border-slate-300 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-[#20262E] block">Grant Immediate Login Access</span>
                  <span className="text-[11px] text-[#57636E] block">
                    Employee can log in immediately upon creation. If unchecked, access is Revoked until granted.
                  </span>
                </div>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#57636E] hover:text-[#20262E] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#154360] hover:bg-[#0E2F44] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving Employee...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} />
                      <span>+ Add User &amp; Give Access</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT EMPLOYEE MODAL (CUSTOMIZE ROLE, SIDEBARS, ACCESS, PASSWORD) */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[560px] my-8 overflow-hidden border border-[#E2E7EC] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#E2E7EC] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#20262E]">Edit Employee &amp; Permissions</h3>
                  <p className="text-xs text-[#57636E]">{editingUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-[#57636E] hover:text-[#20262E] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Mentor Profile Photo (For Admins to view and change) */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E7EC] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {editAvatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={editAvatarUrl}
                      alt={editName || "User"}
                      className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-indigo-200"
                    />
                  ) : (
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-bold text-white shadow-md ${
                      editRole === "Admin" ? "bg-[#154360]" : "bg-[#6C3483]"
                    }`}>
                      {getInitials(editName || editingUser.name)}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-[#20262E] uppercase tracking-wider">Mentor Profile Photo</p>
                    <p className="text-[11px] text-[#57636E]">Visible to admins and throughout classroom portals</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#E2E7EC] hover:border-[#154360]/40 rounded-xl text-xs font-bold text-[#154360] cursor-pointer transition-all shadow-2xs">
                    <span>{editAvatarUrl ? "Change Photo" : "Upload Photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          setEditAvatarUrl(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {editAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setEditAvatarUrl(null)}
                      className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-semibold transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[12px] font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] focus:outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/10 transition-all font-medium"
                />
              </div>

              {/* Role Assignment (Mentor & Admin only) */}
              <div>
                <label className="block text-[12px] font-bold text-[#20262E] uppercase tracking-wider mb-2">
                  Role Assignment
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["Mentor", "Admin"] as const).map(r => (
                    <div
                      key={r}
                      onClick={() => handleEditRoleChange(r)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        editRole === r
                          ? r === "Mentor" 
                            ? "border-[#6C3483] bg-[#F4ECF7] ring-2 ring-[#6C3483]/20 shadow-xs" 
                            : "border-[#154360] bg-[#EBF5FB] ring-2 ring-[#154360]/20 shadow-xs"
                          : "border-[#E2E7EC] hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold text-xs ${r === "Mentor" ? "text-[#5B2C6F]" : "text-[#154360]"}`}>{r}</span>
                        {editRole === r && <Check size={16} className={r === "Mentor" ? "text-[#6C3483]" : "text-[#154360]"} />}
                      </div>
                      <p className="text-[11px] text-[#57636E]">
                        {r === "Mentor" ? "Custom Sidebars" : "Full Access"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SIDE NAVBAR SELECTION FOR THIS EMPLOYEE */}
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E7EC]">
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-[#20262E] uppercase tracking-wider">
                      Side Navbar Access ({editAllowedNav.length} of {ALL_NAV_ITEMS.length} Enabled)
                    </h4>
                    <p className="text-[11px] text-[#57636E]">
                      Customize which side navbars appear when this employee logs in.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditAllowedNav(ALL_NAV_ITEMS.map(i => i.id))}
                      className="text-[11px] font-bold text-[#154360] hover:underline px-2 py-0.5 rounded bg-white border border-[#E2E7EC] cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditAllowedNav([])}
                      className="text-[11px] font-bold text-[#57636E] hover:underline px-2 py-0.5 rounded bg-white border border-[#E2E7EC] cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {ALL_NAV_ITEMS.map(item => {
                    const isChecked = editAllowedNav.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleEditNavItem(item.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleEditNavItem(item.id);
                          }
                        }}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left cursor-pointer transition-all select-none ${
                          isChecked 
                            ? "bg-white border-[#154360] shadow-xs ring-2 ring-[#154360]/20" 
                            : "bg-white/60 border-[#E2E7EC] hover:border-slate-300 hover:bg-white opacity-70 hover:opacity-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          tabIndex={-1}
                          className="mt-0.5 w-4 h-4 rounded text-[#154360] focus:ring-[#154360] border-slate-300 pointer-events-none cursor-pointer"
                        />
                        <div className="flex-1 min-w-0 pointer-events-none">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#20262E]">
                            {NAV_ICONS[item.id]}
                            <span>{item.label}</span>
                          </div>
                          <p className="text-[10px] text-[#57636E] truncate">{item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Login Access Status */}
              <div>
                <label className="block text-[12px] font-bold text-[#20262E] uppercase tracking-wider mb-2">
                  Login Access Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setEditStatus("Active")}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      editStatus === "Active" 
                        ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200" 
                        : "bg-white border-[#E2E7EC]"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-emerald-800">Active (Access Granted)</p>
                      <p className="text-[10px] text-[#57636E]">Employee can log in</p>
                    </div>
                    {editStatus === "Active" && <Check size={16} className="text-emerald-600" />}
                  </div>

                  <div
                    onClick={() => setEditStatus("Access Revoked")}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      editStatus !== "Active" 
                        ? "bg-rose-50 border-rose-300 ring-2 ring-rose-200" 
                        : "bg-white border-[#E2E7EC]"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-rose-800">Access Revoked</p>
                      <p className="text-[10px] text-[#57636E]">Login blocked</p>
                    </div>
                    {editStatus !== "Active" && <Check size={16} className="text-rose-600" />}
                  </div>
                </div>
              </div>

              {/* Password Reset */}
              <div>
                <label className="block text-[12px] font-bold text-[#20262E] uppercase tracking-wider mb-1.5">
                  Reset Password (Optional)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="Enter new password to reset"
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] focus:outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/10 transition-all font-medium pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#57636E] hover:text-[#20262E] cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Actions: Save & Delete */}
              <div className="flex items-center justify-between pt-4 border-t border-[#E2E7EC]">
                {editingUser.email !== PRIMARY_OWNER_EMAIL ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTargetUser(editingUser);
                    }}
                    className="px-3.5 py-2 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Delete User</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2.5 border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#57636E] hover:text-[#20262E] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2.5 bg-[#154360] hover:bg-[#0E2F44] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEdit ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SINGLE DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteTargetUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[420px] p-6 border border-[#E2E7EC] text-center animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-sm">
              <Trash2 size={26} />
            </div>
            <h3 className="text-lg font-bold text-[#20262E] mb-1">Delete Employee?</h3>
            <p className="text-xs text-[#57636E] mb-4">
              Are you sure you want to remove <strong className="text-[#20262E] font-bold">{deleteTargetUser.name}</strong> ({deleteTargetUser.email}) from the workspace? They will permanently lose login access.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="px-4 py-2.5 border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#57636E] hover:text-[#20262E] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Yes, Delete Employee</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MULTIPLE USERS BULK DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[460px] p-6 border border-[#E2E7EC] text-center animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-sm">
              <Trash2 size={26} />
            </div>
            <h3 className="text-lg font-bold text-[#20262E] mb-1">
              Delete {selectedUserIds.length} {selectedUserIds.length === 1 ? "Employee" : "Employees"}?
            </h3>
            <p className="text-xs text-[#57636E] mb-3">
              Are you sure you want to delete {selectedUserIds.length} selected employees from this workspace? They will immediately lose access and this action cannot be undone.
            </p>

            {/* List of users being deleted */}
            <div className="max-h-36 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-4 text-left divide-y divide-slate-100 custom-scrollbar">
              {users.filter(u => selectedUserIds.includes(u.id)).map(u => (
                <div key={u.id} className="py-1.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-[#20262E] truncate">{u.name}</span>
                  <span className="text-[11px] text-[#57636E] font-mono ml-2">{u.email}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2.5 border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#57636E] hover:text-[#20262E] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleBulkDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Yes, Delete {selectedUserIds.length} Employees</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
