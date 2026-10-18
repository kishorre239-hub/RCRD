"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CalendarPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/meetings");
  }, [router]);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-white text-[#57636E] text-sm font-medium">
      Redirecting to Meetings...
    </div>
  );
}
