"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinWorkspace } from "@/lib/api";
import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";

export default function JoinWorkspacePage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId.trim()) return;
    
    setLoading(true);
    setError("");
    try {
      await joinWorkspace(workspaceId);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to join workspace. Please check the ID.");
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F9FAFB] dark:bg-[#0f1115] items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#16181d] rounded-2xl shadow-xl shadow-slate-200/20 dark:shadow-none border border-[#E2E7EC] dark:border-slate-800 p-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-[#57636E] hover:text-[#20262E] dark:hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#EBF5FB]/40 dark:bg-[#EBF5FB]/10 rounded-xl text-[#154360] dark:text-[#EBF5FB]">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#20262E] dark:text-white">Join Workspace</h1>
        </div>
        
        <p className="text-[#57636E] dark:text-[#57636E] mb-8">
          Enter the Workspace ID provided by your administrator to join your team&apos;s workspace.
        </p>

        <form onSubmit={handleJoin} className="space-y-4">
          {error && (
            <div className="p-3 bg-[#154360]/10 text-[#0E2F44] border border-[#154360]/30 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5 text-[#20262E] dark:text-slate-300">Workspace ID</label>
            <input 
              type="text" 
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="Paste your workspace ID here"
              required
              className="w-full px-4 py-2 bg-[#F5F6F8] dark:bg-slate-900 border border-[#E2E7EC] dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all font-mono"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !workspaceId.trim()}
            className="w-full py-2.5 bg-[#154360] hover:bg-[#0E2F44] text-white font-medium rounded-lg disabled:opacity-50 transition-colors mt-6"
          >
            {loading ? "Joining..." : "Join Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
