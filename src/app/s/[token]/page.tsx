'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Folder, Loader2 } from 'lucide-react';
import { getSharedVideo, API_URL } from '@/lib/api';
import VideoPlayer from '@/components/VideoPlayer';

interface SharedVideo {
  title: string;
  createdAt: number;
  courseName?: string;
  editorData?: Record<string, unknown>;
}

export default function SharedVideoPage() {
  const routeParams = useParams();
  const token = routeParams?.token as string;
  
  const [video, setVideo] = useState<SharedVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSharedVideo = async () => {
      try {
        const data = await getSharedVideo(token);
        if (!data) {
          setError("This video is no longer available or the link is invalid.");
        } else {
          setVideo(data);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSharedVideo();
  }, [token]);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0f1115] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0E2F44] animate-spin" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0f1115] p-8 flex flex-col items-center justify-center">
        <div className="bg-white dark:bg-[#16181d] p-8 rounded-2xl shadow-sm border border-[#E2E7EC] dark:border-slate-800 text-center max-w-md">
          <h2 className="text-xl font-bold mb-4 text-[#20262E] dark:text-white">Video Unavailable</h2>
          <p className="text-[#57636E]">{error}</p>
        </div>
      </div>
    );
  }

  const streamUrl = `${API_URL}/videos/share/${token}/stream`;

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0f1115] text-[#20262E] dark:text-white flex flex-col">
      <header className="h-16 border-b border-[#E2E7EC] dark:border-slate-800 bg-white dark:bg-[#16181d] flex items-center justify-center px-8 shrink-0">
        <div className="font-bold text-xl tracking-tight text-[#0E2F44] dark:text-indigo-400">
          MEET
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        <div className="mb-8">
          <VideoPlayer src={streamUrl} initialEditorData={video.editorData} />
        </div>

        <div className="bg-white dark:bg-[#16181d] rounded-2xl shadow-sm border border-[#E2E7EC] dark:border-slate-800 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-4">{video.title}</h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#57636E]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(video.createdAt)}
            </div>
            
            {video.courseName && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-medium rounded-full">
                <Folder className="w-3 h-3" />
                {video.courseName}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
