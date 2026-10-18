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
  if (r === "mentor") {
    return ["for-you", "library", "meetings"];
  }
  return ["for-you", "library", "meetings", "settings"];
}

export function useNavPermissions() {
  const [allowedNavItems, setAllowedNavItems] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("rcrd_user_profile");
        if (raw) {
          const profile = JSON.parse(raw);
          if (profile.role?.toLowerCase() === "admin") {
            return ALL_NAV_ITEMS.map(i => i.id);
          }
          if (Array.isArray(profile.allowedNavItems) && profile.allowedNavItems.length > 0) {
            return profile.allowedNavItems;
          }
          return getDefaultNavItemsForRole(profile.role || "Creator");
        }
      } catch {}
    }
    return ALL_NAV_ITEMS.map(i => i.id); // default full
  });

  const [role, setRole] = useState<string>("Admin");

  useEffect(() => {
    const syncProfile = () => {
      try {
        const raw = localStorage.getItem("rcrd_user_profile");
        if (raw) {
          const profile = JSON.parse(raw);
          setRole(profile.role || "Admin");
          if (profile.role?.toLowerCase() === "admin") {
            setAllowedNavItems(ALL_NAV_ITEMS.map(i => i.id));
            return;
          }
          if (Array.isArray(profile.allowedNavItems) && profile.allowedNavItems.length > 0) {
            setAllowedNavItems(profile.allowedNavItems);
            return;
          }
          setAllowedNavItems(getDefaultNavItemsForRole(profile.role || "Creator"));
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

  const isAdmin = role.toLowerCase() === "admin";
  const isMentor = role.toLowerCase() === "mentor";

  const canAccess = (navId: string) => {
    if (isAdmin) return true;
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
