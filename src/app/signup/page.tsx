"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Project is invite/admin-access only. No public sign up.
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="text-center space-y-2">
        <p className="text-sm font-semibold text-[#0F172A]">Redirecting to Sign In...</p>
        <p className="text-xs text-[#475569]">Employee accounts are created directly by workspace administrators.</p>
      </div>
    </div>
  );
}
