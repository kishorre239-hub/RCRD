"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  ChevronDown, Plus, ChevronRight, X,
  Trash2, Check, UserPlus,
  RefreshCw, AlertCircle
} from "lucide-react";

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Creator" | string;
  dateAdded: string;
  status: "Active" | "Invited" | "Suspended" | string;
}

const DEFAULT_USERS: WorkspaceUser[] = [
  {
    id: "usr-admin-1",
    name: "Hari Kishore Reddy",
    email: "harikishorereddy9908@gmail.com",
    role: "Admin",
    dateAdded: "24 April 2026",
    status: "Active",
  },
];

const LOCAL_STORAGE_KEY = "RCRD_workspace_users_list";

export default function UsersTab() {
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All Roles" | "Admins" | "Creators">("All Roles");
  const [memberFilter, setMemberFilter] = useState<"All members" | "Active" | "Invited">("All members");
  
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
  const [newRole, setNewRole] = useState<"Creator" | "Admin">("Creator");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
          const formatted: WorkspaceUser[] = data.map((u: Record<string, unknown>, idx: number) => {
            const rawDate = u.createdAt ? new Date(Number(u.createdAt)) : new Date();
            const dateStr = !isNaN(rawDate.getTime()) 
              ? rawDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
              : "24 April 2026";
            
            const rawRole = String(u.role || "Creator");
            const roleFormatted = rawRole.toUpperCase() === "ADMIN" ? "Admin" : "Creator";

            return {
              id: String(u.id || u._id || `usr-${idx}`),
              name: String(u.name || "Workspace Member"),
              email: String(u.email || ""),
              role: roleFormatted,
              dateAdded: dateStr,
              status: String(u.status || "Active"),
            };
          });
          setUsers(formatted);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formatted));
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not fetch remote users, checking local store:", err);
    }

    // Fallback to local storage or defaults
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUsers(parsed);
          setLoading(false);
          return;
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
        }),
      });

      // 2. Optionally trigger invitation email
      try {
        await fetch("/api/invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ emails: [newEmail.trim().toLowerCase()] }),
        });
      } catch {}

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
          status: "Active",
        };
      } else {
        newUser = {
          id: `usr-${Date.now()}`,
          name: cleanName,
          email: newEmail.trim().toLowerCase(),
          role: newRole,
          dateAdded: today,
          status: "Active",
        };
      }

      const updated = [...users.filter(u => u.email !== newUser.email), newUser];
      saveUsers(updated);
      setNewName("");
      setNewEmail("");
      setNewRole("Creator");
      setShowAddModal(false);
      showToast(`User ${newUser.name} added to workspace!`);
    } catch (err) {
      console.error("Error adding user:", err);
      showToast("Failed to add user. Saved locally.", false);
    } finally {
      setIsSubmitting(false);
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

      // Member status filter
      const matchesMember = 
        memberFilter === "All members" ||
        (memberFilter === "Active" && user.status.toLowerCase() === "active") ||
        (memberFilter === "Invited" && user.status.toLowerCase() !== "active");

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
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-7 font-sans">
        
        {/* Card Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-bold text-slate-900 tracking-tight">
              Users
            </h2>
            <span className="text-[14px] text-slate-500 font-medium">
              ({users.length})
            </span>
          </div>
          <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
            Global permissions define what people can do on Loom. You can grant permissions to groups and individuals.
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
                className="w-full px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#AE2448] focus:ring-2 focus:ring-[#AE2448]/10 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className="h-[38px] px-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-[13px] font-medium text-slate-700 flex items-center gap-2 transition-colors focus:outline-none focus:border-[#AE2448]"
              >
                <span>{roleFilter}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isRoleDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isRoleDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {(["All Roles", "Admins", "Creators"] as const).map(option => (
                    <button
                      key={option}
                      onClick={() => {
                        setRoleFilter(option);
                        setIsRoleDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-[13px] flex items-center justify-between transition-colors ${
                        roleFilter === option 
                          ? "bg-[#D5E7B5] text-[#6E1A37] font-semibold" 
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{option}</span>
                      {roleFilter === option && <Check size={14} className="text-[#AE2448]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Member Status Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsMemberDropdownOpen(!isMemberDropdownOpen);
                  setIsRoleDropdownOpen(false);
                }}
                className="h-[38px] px-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-[13px] font-medium text-slate-700 flex items-center gap-2 transition-colors focus:outline-none focus:border-[#AE2448]"
              >
                <span>{memberFilter}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isMemberDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isMemberDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {(["All members", "Active", "Invited"] as const).map(option => (
                    <button
                      key={option}
                      onClick={() => {
                        setMemberFilter(option);
                        setIsMemberDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-[13px] flex items-center justify-between transition-colors ${
                        memberFilter === option 
                          ? "bg-[#D5E7B5] text-[#6E1A37] font-semibold" 
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{option}</span>
                      {memberFilter === option && <Check size={14} className="text-[#AE2448]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Add User Action Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchUsers()}
              title="Refresh users"
              className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-[#AE2448]" : ""} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#AE2448] hover:bg-[#6E1A37] text-white text-[13px] font-bold px-4 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1.5"
            >
              <Plus size={16} />
              <span>Add user</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Date added</th>
                <th className="py-3 px-4">Email address</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 w-10 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2 text-xs font-medium">
                      <RefreshCw size={15} className="animate-spin text-[#AE2448]" />
                      <span>Loading workspace users...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-700 text-sm">No users found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filter settings.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isAdmin = user.role.toLowerCase() === "admin";
                  const avatarColor = isAdmin 
                    ? "bg-[#72BAA9] text-white" // Emerald Green matching Loom's admin badge
                    : "bg-[#AE2448] text-white";

                  return (
                    <tr 
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setShowUserModal(true);
                      }}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Name with circular avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold ${avatarColor} shrink-0`}>
                            {getInitials(user.name)}
                          </div>
                          <span className="font-semibold text-slate-900 group-hover:text-[#AE2448] transition-colors">
                            {user.name}
                          </span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-medium bg-slate-100 text-slate-700">
                          {user.role}
                        </span>
                      </td>

                      {/* Date Added */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {user.dateAdded}
                      </td>

                      {/* Email address */}
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[12px]">
                        {user.email}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6E1A37] bg-[#D5E7B5] px-2 py-0.5 rounded-full border border-[#72BAA9]/30/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#72BAA9]" />
                          {user.status}
                        </span>
                      </td>

                      {/* Arrow / Action */}
                      <td className="py-3.5 px-4 text-right text-slate-400 group-hover:text-slate-700 transition-colors">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[480px] overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D5E7B5] border border-[#AE2448]/20 flex items-center justify-center text-[#AE2448]">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add User to Workspace</h3>
                  <p className="text-xs text-slate-500">Invite a teammate with custom permissions.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#AE2448] focus:bg-white focus:ring-2 focus:ring-[#AE2448]/10 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#AE2448] focus:bg-white focus:ring-2 focus:ring-[#AE2448]/10 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Role & Permissions
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setNewRole("Creator")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      newRole === "Creator"
                        ? "border-[#AE2448] bg-[#D5E7B5]/50 ring-1 ring-[#AE2448]/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-900">Creator</span>
                      {newRole === "Creator" && <Check size={14} className="text-[#AE2448]" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">Can record, edit, and share videos in the workspace</p>
                  </div>

                  <div
                    onClick={() => setNewRole("Admin")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      newRole === "Admin"
                        ? "border-[#AE2448] bg-[#D5E7B5]/50 ring-1 ring-[#AE2448]/20"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-900">Admin</span>
                      {newRole === "Admin" && <Check size={14} className="text-[#AE2448]" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">Full workspace access, user management, and billing</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newEmail.trim()}
                  className="px-5 py-2 bg-[#AE2448] hover:bg-[#6E1A37] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>{isSubmitting ? "Adding..." : "Add user"}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* USER DETAILS & MANAGEMENT DRAWER/MODAL */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px] overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 font-sans">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                  selectedUser.role.toLowerCase() === "admin" ? "bg-[#72BAA9] text-white" : "bg-[#AE2448] text-white"
                }`}>
                  {getInitials(selectedUser.name)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedUser.name}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span className="font-semibold text-[#6E1A37] bg-[#D5E7B5] px-2 py-0.5 rounded-full border border-[#72BAA9]/30/60">
                    {selectedUser.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Date added</span>
                  <span className="font-semibold text-slate-800">{selectedUser.dateAdded}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">User ID</span>
                  <span className="font-mono text-slate-700">{selectedUser.id}</span>
                </div>
              </div>

              {/* Role Toggle */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Change Workspace Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChangeRole(selectedUser.id, "Admin")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      selectedUser.role === "Admin"
                        ? "bg-[#AE2448] text-white border-[#AE2448] shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeRole(selectedUser.id, "Creator")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      selectedUser.role === "Creator"
                        ? "bg-[#AE2448] text-white border-[#AE2448] shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    Creator
                  </button>
                </div>
              </div>

              {/* Remove User Action */}
              {selectedUser.email !== "harikishorereddy9908@gmail.com" && (
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleRemoveUser(selectedUser.id)}
                    className="w-full py-2.5 bg-[#AE2448]/10 hover:bg-[#AE2448]/20 text-[#AE2448] font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-[#AE2448]/30/60"
                  >
                    <Trash2 size={14} /> Remove User from Workspace
                  </button>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-xs"
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
            : "bg-[#AE2448] text-white border-[#6E1A37]"
        }`}>
          {toastMessage.ok ? <Check size={15} className="text-[#D5E7B5]" /> : <AlertCircle size={15} className="text-white" />}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}

    </div>
  );
}
