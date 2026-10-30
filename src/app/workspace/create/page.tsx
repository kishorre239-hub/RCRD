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
      <div className="max-w-md w-full bg-white dark:bg-[#16181d] rounded-2xl shadow-xl shadow-slate-200/20 dark:shadow-none border border-[#E2E8F0] dark:border-slate-800 p-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-[#475569] hover:text-[#0F172A] dark:hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-50 dark:bg-[#4338CA]/10 rounded-xl text-[#4338CA] dark:text-indigo-400">
            <Building className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A] dark:text-white">Create Workspace</h1>
        </div>
        
        <p className="text-[#475569] dark:text-[#475569] mb-8">
          Create a new company workspace to collaborate with your team and share videos securely.
        </p>

        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="p-3 bg-[#4F46E5]/10 text-[#4338CA] border border-[#4F46E5]/30 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5 text-[#0F172A] dark:text-slate-300">Workspace Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              required
              className="w-full px-4 py-2 bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-[#4338CA] hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors mt-6"
          >
            {loading ? "Creating..." : "Create Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
