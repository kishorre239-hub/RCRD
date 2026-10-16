"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth, getCompanyVideos } from "@/lib/api";
import { Play, ArrowLeft, Building } from "lucide-react";
import Link from "next/link";

interface CompanyVideo {
  id: string;
  title: string;
  duration?: number;
  ownerId: string;
  courseName?: string;
  createdAt: number;
}

export default function CompanyVideosPage() {
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<CompanyVideo[]>([]);
  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchWithAuth('/auth/me');
        if (!res.ok) {
          // router.push('/login');
          // return;
        }
        const userData = await res.json();

        if (!userData.workspaceId) {
          router.push('/');
          return;
        }
        
        const videosData = await getCompanyVideos(0, 50);
        setVideos(videosData.content || []);
      } catch (err) {
        console.error(err);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <div className="flex h-screen bg-[#F9FAFB] dark:bg-[#0f1115] text-slate-900 dark:text-slate-100 font-sans">
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center px-4 md:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#16181d]/50 ">
          <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mr-6">
            <ArrowLeft size={20} />
            <span className="font-medium hidden sm:inline">Back to App</span>
          </Link>
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-[#72BAA9]" />
            <h1 className="text-xl font-bold">Company Shared Videos</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {videos.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <Building className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No videos have been shared with the company yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.map(video => (
                  <Link href={`/video/${video.id}`} key={video.id} className="group flex flex-col bg-white dark:bg-[#16181d] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 hover:-translate-y-1">
                    <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden cursor-pointer flex items-center justify-center">
                      <Play className="w-12 h-12 text-slate-300 dark:text-slate-600 group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20  flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                          <Play className="w-5 h-5 text-white fill-white ml-1" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/70  text-white text-xs font-medium px-2 py-1 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-1 group-hover:text-[#6E1A37] dark:group-hover:text-indigo-400 transition-colors cursor-pointer" title={video.title}>
                          {video.title}
                        </h3>
                      </div>
                      <div className="flex flex-col text-xs text-slate-500 dark:text-slate-400 mt-auto">
                        <span className="mb-1">Shared by: {video.ownerId.slice(-6)}...</span>
                        <div className="flex items-center">
                          <span>{video.courseName || 'Uncategorized'}</span>
                          <span className="mx-2">•</span>
                          <span>{formatDate(video.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
