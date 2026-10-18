"use client";

import { useState, useEffect } from "react";

export interface NavItemConfig {
  id: string;
  label: string;
  path: string;
  description: string;
}

export const ALL_NAV_ITEMS: NavItemConfig[] = [
  { id: "for-you", label: "For You", path: "/", description: "Home feed & recent activity" },
  { id: "library", label: "Library", path: "/library", description: "Recorded videos, uploads & folders" },
  { id: "meetings", label: "Meetings", path: "/meetings", description: "Schedule and join video meetings" },
  { id: "settings", label: "Settings", path: "/settings", description: "Personal preferences & account info" },
  { id: "manage-users", label: "Manage Users", path: "/settings?tab=users", description: "Workspace users and access control" },
  { id: "workspace-info", label: "Workspace Info", path: "/settings?tab=workspace", description: "Workspace details and plan" },
];

export function getDefaultNavItemsForRole(role: string): string[] {
  const r = (role || "").toLowerCase();
  if (r === "admin") {
    return ALL_NAV_ITEMS.map(i => i.id);
  }
  return ["for-you", "library", "meetings"];
}

const PRIMARY_OWNER_EMAIL = "harikishorereddy9908@gmail.com";

function resolveAllowedNavForUser(email?: string, profileNav?: string[], role?: string): string[] {
  const cleanEmail = (email || "").toLowerCase().trim();
  if (cleanEmail === PRIMARY_OWNER_EMAIL) {
    return ALL_NAV_ITEMS.map(i => i.id);
  }

  // 1. Look up user in workspace users store (updated directly when admin onboards/edits user)
  if (typeof window !== "undefined" && cleanEmail) {
    try {
      const saved = localStorage.getItem("RCRD_workspace_users_list");
      if (saved) {
        const users = JSON.parse(saved);
        if (Array.isArray(users)) {
          const matched = users.find((u: { email?: string; allowedNavItems?: string[] }) => 
            (u.email || "").toLowerCase().trim() === cleanEmail
          );
          if (matched && Array.isArray(matched.allowedNavItems)) {
            return matched.allowedNavItems;
          }
        }
      }
    } catch {}
  }

  // 2. Use user profile allowedNavItems
  if (Array.isArray(profileNav)) {
    return profileNav;
  }

  // 3. Fallback to role default
  return getDefaultNavItemsForRole(role || "Mentor");
}

export function useNavPermissions() {
  const [allowedNavItems, setAllowedNavItems] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("rcrd_user_profile");
        if (raw) {
          const profile = JSON.parse(raw);
          return resolveAllowedNavForUser(profile.email, profile.allowedNavItems, profile.role);
        }
      } catch {}
    }
    return ALL_NAV_ITEMS.map(i => i.id);
  });

  const [role, setRole] = useState<string>("Admin");
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const syncProfile = () => {
      try {
        const raw = localStorage.getItem("rcrd_user_profile");
        if (raw) {
          const profile = JSON.parse(raw);
          const email = (profile.email || "").toLowerCase().trim();
          setUserEmail(email);
          setRole(profile.role || "Admin");
          setAllowedNavItems(resolveAllowedNavForUser(email, profile.allowedNavItems, profile.role));
          return;
        }
      } catch {}
    };

    syncProfile();
    window.addEventListener("rcrd_profile_updated", syncProfile);
    window.addEventListener("storage", syncProfile);
    return () => {
      window.removeEventListener("rcrd_profile_updated", syncProfile);
      window.removeEventListener("storage", syncProfile);
    };
  }, []);

  const isPrimaryOwner = userEmail === PRIMARY_OWNER_EMAIL;
  const isAdmin = role.toLowerCase() === "admin";
  const isMentor = role.toLowerCase() === "mentor";

  const canAccess = (navId: string) => {
    if (isPrimaryOwner) return true;
    return allowedNavItems.includes(navId);
  };

  return {
    allowedNavItems,
    role,
    isAdmin,
    isMentor,
    canAccess,
  };
}
