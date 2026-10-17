"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkspace } from "@/lib/api";
import { ArrowLeft, Building } from "lucide-react";
import Link from "next/link";

export default function CreateWorkspacePage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    setError("");
    try {
      await createWorkspace(name);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create workspace.");
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
          <div className="p-3 bg-indigo-50 dark:bg-[#0E2F44]/10 rounded-xl text-[#0E2F44] dark:text-indigo-400">
            <Building className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#20262E] dark:text-white">Create Workspace</h1>
        </div>
        
        <p className="text-[#57636E] dark:text-[#57636E] mb-8">
          Create a new company workspace to collaborate with your team and share videos securely.
        </p>

        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="p-3 bg-[#154360]/10 text-[#0E2F44] border border-[#154360]/30 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5 text-[#20262E] dark:text-slate-300">Workspace Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              required
              className="w-full px-4 py-2 bg-[#F5F6F8] dark:bg-slate-900 border border-[#E2E7EC] dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-[#0E2F44] hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors mt-6"
          >
            {loading ? "Creating..." : "Create Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
