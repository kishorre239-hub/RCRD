"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsUsersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings?tab=users");
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-white">
      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
        <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span>Loading Users & groups...</span>
      </div>
    </div>
  );
}
