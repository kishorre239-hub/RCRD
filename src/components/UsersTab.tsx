"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  ChevronDown, Plus, ChevronRight, X,
  Trash2, Check, UserPlus,
  RefreshCw, AlertCircle, UserCheck, UserX,
  Key, ShieldCheck, Eye, EyeOff
} from "lucide-react";

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Creator" | string;
  dateAdded: string;
  status: "Active" | "Access Revoked" | "Suspended" | string;
  hasAccess?: boolean;
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
  },
];

const LOCAL_STORAGE_KEY = "RCRD_workspace_users_list";

const isDummyUserEmail = (email: string) => {
  const e = (email || "").toLowerCase().trim();
  if (e === "harikishorereddy9908@gmail.com") return false;
  return (
    e.includes("geonixa.com") ||
    e.includes("@example.com") ||
    e.includes("@meet.com") ||
    /^(sarah|student_|mentor_|newadmin|sec_admin|reuse|test|audit)/i.test(e)
  );
};

export default function UsersTab() {
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All Roles" | "Admins" | "Creators">("All Roles");
  const [memberFilter, setMemberFilter] = useState<"All members" | "Access Granted" | "Access Revoked">("All members");
  
  // Dropdown states
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WorkspaceUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  
  // Add User Form States
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [giveImmediateAccess, setGiveImmediateAccess] = useState(true);
  const [newRole, setNewRole] = useState<"Creator" | "Admin">("Creator");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit / Reset Password in User Modal
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const showToast = (text: string, ok = true) => {
    setToastMessage({ text, ok });
    setTimeout(() => setToastMessage(null), 3500);
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
            
            const rawRole = String(u.role || "Creator");
            const roleFormatted = rawRole.toUpperCase() === "ADMIN" ? "Admin" : "Creator";
            const rawStatus = String(u.status || "Active");
            const hasAccess = u.hasAccess !== undefined ? !!u.hasAccess : rawStatus.toLowerCase() === "active";

            return {
              id: String(u.id || u._id || `usr-${idx}`),
              name: String(u.name || "Workspace Member"),
              email: String(u.email || ""),
              role: roleFormatted,
              dateAdded: dateStr,
              status: rawStatus,
              hasAccess,
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

    // Fallback to local storage (filtering out any legacy dummy accounts) or defaults
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanLocal = parsed.filter((u: WorkspaceUser) => !isDummyUserEmail(u.email));
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

  // Add User Handler
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) {
      showToast("Please enter a valid email address.", false);
      return;
    }
    const cleanName = newName.trim() || newEmail.split("@")[0];
    const initialStatus = giveImmediateAccess ? "Active" : "Access Revoked";
    const passwordToSet = newPassword.trim() || "rcrd2026";

    setIsSubmitting(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

      // 1. Post to workspace users API
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
        };
      }

      const updated = [...users.filter(u => u.email !== newUser.email), newUser];
      saveUsers(updated);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setGiveImmediateAccess(true);
      setShowAddModal(false);
      showToast(giveImmediateAccess 
        ? `User ${newUser.name} created! Login access is Active.` 
        : `User ${newUser.name} created! Access is Revoked.`);
    } catch (err) {
      console.error("Error adding user:", err);
      showToast("Failed to add user to server. Saved locally.", false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Login Access (Give Access / Revoke Access)
  const handleToggleAccess = async (userId: string, grant: boolean) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    if (target.email === "harikishorereddy9908@gmail.com" && !grant) {
      showToast("Cannot revoke access for the primary workspace owner.", false);
      return;
    }

    const nextStatus = grant ? "Active" : "Access Revoked";
    const updated = users.map(u => u.id === userId ? { ...u, status: nextStatus, hasAccess: grant } : u);
    saveUsers(updated);

    if (selectedUser && selectedUser.id === userId) {
      setSelectedUser({ ...selectedUser, status: nextStatus, hasAccess: grant });
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

  // Update Password for User
  const handleUpdatePassword = async (userId: string) => {
    if (!editPassword.trim()) {
      showToast("Please enter a new password.", false);
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`/api/workspaces/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password: editPassword.trim() }),
      });
      if (res.ok) {
        showToast("Employee password updated successfully!");
        setEditPassword("");
      } else {
        showToast("Failed to update password on server.", false);
      }
    } catch {
      showToast("Error updating password.", false);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Remove User Handler
  const handleRemoveUser = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    if (target.email === "harikishorereddy9908@gmail.com") {
      showToast("Cannot remove the primary workspace owner.", false);
      return;
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      await fetch(`/api/workspaces/users/${userId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {}

    const updated = users.filter(u => u.id !== userId);
    saveUsers(updated);
    setShowUserModal(false);
    showToast(`Removed ${target.name} from workspace.`);
  };

  // Change Role Handler
  const handleChangeRole = async (userId: string, role: "Admin" | "Creator") => {
    const updated = users.map(u => u.id === userId ? { ...u, role } : u);
    saveUsers(updated);
    if (selectedUser && selectedUser.id === userId) {
      setSelectedUser({ ...selectedUser, role });
    }
    showToast(`Updated role to ${role}`);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      await fetch(`/api/workspaces/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ role }),
      });
    } catch (err) {
      console.warn("Could not sync role change to server:", err);
    }
  };

  // Filtered Users computation
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      const matchesSearch = 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Role filter
      const matchesRole = 
        roleFilter === "All Roles" ||
        (roleFilter === "Admins" && user.role.toLowerCase() === "admin") ||
        (roleFilter === "Creators" && user.role.toLowerCase() !== "admin");

      // Member access status filter
      const isUserActive = (user.status || "Active").toLowerCase() === "active";
      const matchesMember = 
        memberFilter === "All members" ||
        (memberFilter === "Access Granted" && isUserActive) ||
        (memberFilter === "Access Revoked" && !isUserActive);

      return matchesSearch && matchesRole && matchesMember;
    });
  }, [users, searchQuery, roleFilter, memberFilter]);

  // Generate Initials
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Main Users & Groups Card */}
      <div className="bg-white border border-[#E2E7EC]/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-7 font-sans">
        
        {/* Card Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-bold text-[#20262E] tracking-tight">
              Users &amp; groups
            </h2>
            <span className="text-[14px] text-[#57636E] font-medium">
              ({users.length})
            </span>
          </div>
          <p className="text-[13px] text-[#57636E] mt-1 leading-relaxed">
            Global permissions define what people can do on RCRD. Administrators can grant or revoke employee login access at any time.
          </p>
        </div>

        {/* Filter & Action Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Enter a name or email address"
                className="w-full px-3.5 py-2 bg-white border border-[#E2E7EC] hover:border-[#E2E7EC] rounded-lg text-[13px] text-[#20262E] placeholder:text-[#57636E] focus:outline-none focus:border-[#154360] focus:ring-2 focus:ring-[#154360]/10 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#57636E] hover:text-[#57636E]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Role Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsRoleDropdownOpen(!isRoleDropdownOpen);
                  setIsMemberDropdownOpen(false);
                }}
                className="h-[38px] px-3.5 bg-white border border-[#E2E7EC] hover:border-[#E2E7EC] rounded-lg text-[13px] font-medium text-[#20262E] flex items-center gap-2 transition-colors focus:outline-none focus:border-[#154360]"
              >
                <span>{roleFilter}</span>
                <ChevronDown size={14} className={`text-[#57636E] transition-transform ${isRoleDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isRoleDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-40 bg-white border border-[#E2E7EC] rounded-xl shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {(["All Roles", "Admins", "Creators"] as const).map(option => (
                    <button
                      key={option}
                      onClick={() => {
                        setRoleFilter(option);
                        setIsRoleDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-[13px] flex items-center justify-between transition-colors ${
                        roleFilter === option 
                          ? "bg-[#EBF5FB] text-[#0E2F44] font-semibold" 
                          : "text-[#20262E] hover:bg-[#F5F6F8]"
                      }`}
                    >
                      <span>{option}</span>
                      {roleFilter === option && <Check size={14} className="text-[#154360]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Member Access Status Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsMemberDropdownOpen(!isMemberDropdownOpen);
                  setIsRoleDropdownOpen(false);
                }}
                className="h-[38px] px-3.5 bg-white border border-[#E2E7EC] hover:border-[#E2E7EC] rounded-lg text-[13px] font-medium text-[#20262E] flex items-center gap-2 transition-colors focus:outline-none focus:border-[#154360]"
              >
                <span>{memberFilter}</span>
                <ChevronDown size={14} className={`text-[#57636E] transition-transform ${isMemberDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isMemberDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-48 bg-white border border-[#E2E7EC] rounded-xl shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {(["All members", "Access Granted", "Access Revoked"] as const).map(option => (
                    <button
                      key={option}
                      onClick={() => {
                        setMemberFilter(option);
                        setIsMemberDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-[13px] flex items-center justify-between transition-colors ${
                        memberFilter === option 
                          ? "bg-[#EBF5FB] text-[#0E2F44] font-semibold" 
                          : "text-[#20262E] hover:bg-[#F5F6F8]"
                      }`}
                    >
                      <span>{option}</span>
                      {memberFilter === option && <Check size={14} className="text-[#154360]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Add User Action Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchUsers(true)}
              title="Refresh users"
              className="p-2 border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#57636E] hover:text-[#20262E] rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-[#154360]" : ""} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#154360] hover:bg-[#0E2F44] text-white text-[13px] font-bold px-4 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>Add user</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="border border-[#E2E7EC]/80 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2E7EC]/80 bg-[#F5F6F8]/60 text-[12px] font-semibold text-[#57636E] uppercase tracking-wider">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Date added</th>
                <th className="py-3 px-4">Email address</th>
                <th className="py-3 px-4">Login Status</th>
                <th className="py-3 px-4 text-right">Access Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#57636E]">
                    <div className="flex items-center justify-center gap-2 text-xs font-medium">
                      <RefreshCw size={15} className="animate-spin text-[#154360]" />
                      <span>Loading workspace users...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#57636E]">
                    <p className="font-semibold text-[#20262E] text-sm">No users found</p>
                    <p className="text-xs text-[#57636E] mt-1">Try adjusting your search or filter settings.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isAdmin = user.role.toLowerCase() === "admin";
                  const avatarColor = isAdmin 
                    ? "bg-[#2980B9] text-white" 
                    : "bg-[#154360] text-white";
                  const isActive = (user.status || "Active").toLowerCase() === "active";
                  const isPrimaryOwner = user.email === "harikishorereddy9908@gmail.com";

                  return (
                    <tr 
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setShowUserModal(true);
                      }}
                      className="hover:bg-[#F5F6F8]/80 cursor-pointer transition-colors group"
                    >
                      {/* Name with circular avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold ${avatarColor} shrink-0`}>
                            {getInitials(user.name)}
                          </div>
                          <span className="font-semibold text-[#20262E] group-hover:text-[#154360] transition-colors">
                            {user.name}
                          </span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4 text-[#57636E]">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-slate-100 text-[#20262E]">
                          {user.role}
                        </span>
                      </td>

                      {/* Date Added */}
                      <td className="py-3.5 px-4 text-[#57636E]">
                        {user.dateAdded}
                      </td>

                      {/* Email address */}
                      <td className="py-3.5 px-4 text-[#57636E] font-mono text-[12px]">
                        {user.email}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Access Revoked
                          </span>
                        )}
                      </td>

                      {/* Access Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {!isPrimaryOwner ? (
                            isActive ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleAccess(user.id, false);
                                }}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                                title="Revoke login access for this employee"
                              >
                                <UserX size={13} />
                                <span>Revoke Access</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleAccess(user.id, true);
                                }}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                                title="Give login access to this employee"
                              >
                                <UserCheck size={13} />
                                <span>Give Access</span>
                              </button>
                            )
                          ) : (
                            <span className="text-[11px] font-bold text-[#57636E] uppercase bg-slate-100 px-2 py-0.5 rounded">Owner</span>
                          )}
                          <ChevronRight size={16} className="text-[#57636E] group-hover:text-[#20262E] transition-colors" />
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

      {/* ADD USER MODAL (ADMIN CREATES EMPLOYEE ACCESS) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[480px] overflow-hidden border border-[#E2E7EC] animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[#E2E7EC] flex items-center justify-between bg-[#F5F6F8]/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EBF5FB] border border-[#154360]/20 flex items-center justify-center text-[#154360]">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#20262E]">Add Employee &amp; Grant Access</h3>
                  <p className="text-xs text-[#57636E]">Create user credentials so employees can sign in.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-[#57636E] hover:text-[#20262E] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#20262E] uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full px-3.5 py-2.5 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] placeholder:text-[#57636E] focus:outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/10 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#20262E] uppercase tracking-wider mb-1.5">
                  Work Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="sarah.jenkins@company.com"
                  className="w-full px-3.5 py-2.5 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] placeholder:text-[#57636E] focus:outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/10 transition-all font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-semibold text-[#20262E] uppercase tracking-wider">
                    Login Password
                  </label>
                  <span className="text-[11px] text-[#57636E]">Default: rcrd2026</span>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Set employee password (or leave empty for rcrd2026)"
                    className="w-full px-3.5 py-2.5 bg-[#F5F6F8] border border-[#E2E7EC] rounded-xl text-sm text-[#20262E] placeholder:text-[#57636E] focus:outline-none focus:border-[#154360] focus:bg-white focus:ring-2 focus:ring-[#154360]/10 transition-all font-medium pr-10"
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

              <div>
                <label className="block text-[12px] font-semibold text-[#20262E] uppercase tracking-wider mb-1.5">
                  Role &amp; Permissions
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setNewRole("Creator")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      newRole === "Creator"
                        ? "border-[#154360] bg-[#EBF5FB]/50 ring-1 ring-[#154360]/20"
                        : "border-[#E2E7EC] hover:border-[#E2E7EC] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-[#20262E]">Creator</span>
                      {newRole === "Creator" && <Check size={14} className="text-[#154360]" />}
                    </div>
                    <p className="text-[11px] text-[#57636E] leading-snug">Can record, edit, and attend meetings</p>
                  </div>

                  <div
                    onClick={() => setNewRole("Admin")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      newRole === "Admin"
                        ? "border-[#154360] bg-[#EBF5FB]/50 ring-1 ring-[#154360]/20"
                        : "border-[#E2E7EC] hover:border-[#E2E7EC] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-[#20262E]">Admin</span>
                      {newRole === "Admin" && <Check size={14} className="text-[#154360]" />}
                    </div>
                    <p className="text-[11px] text-[#57636E] leading-snug">Full workspace access and employee management</p>
                  </div>
                </div>
              </div>

              {/* Immediate Access Checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-[#E2E7EC] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={giveImmediateAccess}
                    onChange={e => setGiveImmediateAccess(e.target.checked)}
                    className="w-4 h-4 rounded text-[#154360] focus:ring-[#154360] border-[#E2E7EC] cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#20262E] block">Grant Immediate Login Access</span>
                    <span className="text-[11px] text-[#57636E] block">Employee will be able to log in with these credentials right away.</span>
                  </div>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-[#E2E7EC]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#E2E7EC] hover:bg-[#F5F6F8] text-[#20262E] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newEmail.trim()}
                  className="px-5 py-2 bg-[#154360] hover:bg-[#0E2F44] disabled:bg-slate-200 disabled:text-[#57636E] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>{isSubmitting ? "Adding..." : "Add user & Give Access"}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* USER DETAILS & ACCESS MANAGEMENT MODAL */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[480px] overflow-hidden border border-[#E2E7EC] animate-in zoom-in-95 duration-150 font-sans">
            
            {/* Header */}
            <div className="p-6 border-b border-[#E2E7EC] flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                  selectedUser.role.toLowerCase() === "admin" ? "bg-[#2980B9] text-white" : "bg-[#154360] text-white"
                }`}>
                  {getInitials(selectedUser.name)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#20262E]">{selectedUser.name}</h3>
                  <p className="text-xs text-[#57636E] font-mono mt-0.5">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1.5 text-[#57636E] hover:text-[#20262E] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              
              {/* Access Control Box */}
              <div className="p-4 rounded-xl border border-[#E2E7EC] bg-[#F8FAFC] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className={(selectedUser.status || "Active").toLowerCase() === "active" ? "text-emerald-600" : "text-rose-600"} />
                    <span className="text-xs font-bold text-[#20262E]">Login Access Status</span>
                  </div>
                  {(selectedUser.status || "Active").toLowerCase() === "active" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Access Granted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Access Revoked
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#57636E] leading-relaxed">
                  {(selectedUser.status || "Active").toLowerCase() === "active"
                    ? "This employee is permitted to log in with their work email and assigned password."
                    : "This employee is blocked from logging in. Give access to allow them to sign in again."}
                </p>

                {selectedUser.email !== "harikishorereddy9908@gmail.com" && (
                  <div className="pt-1">
                    {(selectedUser.status || "Active").toLowerCase() === "active" ? (
                      <button
                        type="button"
                        onClick={() => handleToggleAccess(selectedUser.id, false)}
                        className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <UserX size={14} />
                        <span>Revoke Login Access</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleAccess(selectedUser.id, true)}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <UserCheck size={14} />
                        <span>Give Login Access</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Reset Password */}
              <div className="p-4 rounded-xl border border-[#E2E7EC] bg-white space-y-2.5">
                <div className="flex items-center gap-2">
                  <Key size={16} className="text-[#154360]" />
                  <span className="text-xs font-bold text-[#20262E]">Set Employee Password</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showEditPassword ? "text" : "password"}
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-3 py-2 bg-[#F5F6F8] border border-[#E2E7EC] rounded-lg text-xs text-[#20262E] pr-8 outline-none focus:border-[#154360]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#57636E] hover:text-[#20262E] cursor-pointer"
                    >
                      {showEditPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={isUpdatingPassword || !editPassword.trim()}
                    onClick={() => handleUpdatePassword(selectedUser.id)}
                    className="px-3.5 py-2 bg-[#154360] hover:bg-[#0E2F44] disabled:bg-slate-200 disabled:text-[#57636E] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    {isUpdatingPassword ? "Saving..." : "Update"}
                  </button>
                </div>
              </div>

              {/* Role Toggle */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#57636E] mb-2">
                  Change Workspace Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChangeRole(selectedUser.id, "Admin")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      selectedUser.role === "Admin"
                        ? "bg-[#154360] text-white border-[#154360] shadow-xs"
                        : "bg-white text-[#20262E] border-[#E2E7EC] hover:bg-[#F5F6F8]"
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeRole(selectedUser.id, "Creator")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      selectedUser.role === "Creator"
                        ? "bg-[#154360] text-white border-[#154360] shadow-xs"
                        : "bg-white text-[#20262E] border-[#E2E7EC] hover:bg-[#F5F6F8]"
                    }`}
                  >
                    Creator
                  </button>
                </div>
              </div>

              {/* Remove User Action */}
              {selectedUser.email !== "harikishorereddy9908@gmail.com" && (
                <div className="pt-2 border-t border-[#E2E7EC]">
                  <button
                    onClick={() => handleRemoveUser(selectedUser.id)}
                    className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-rose-200 cursor-pointer"
                  >
                    <Trash2 size={14} /> Remove User from Workspace
                  </button>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#F5F6F8] border-t border-[#E2E7EC] flex justify-end">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 bg-white border border-[#E2E7EC] hover:bg-slate-100 text-[#20262E] text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating Toast */}
      {toastMessage && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 z-[100] border animate-in slide-in-from-bottom-5 duration-150 ${
          toastMessage.ok 
            ? "bg-slate-900 text-white border-slate-800" 
            : "bg-[#154360] text-white border-[#0E2F44]"
        }`}>
          {toastMessage.ok ? <Check size={15} className="text-[#EBF5FB]" /> : <AlertCircle size={15} className="text-white" />}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}

    </div>
  );
}
