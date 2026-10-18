"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles, Play } from "lucide-react";

interface HariInsightsProps {
  userName?: string;
  onStartRecord: () => void;
  viewsThisWeek?: number;
}

export default function HariInsights({
  userName = "Hari",
  onStartRecord,
  viewsThisWeek = 0
}: HariInsightsProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const getWeekLabel = () => {
    if (weekOffset === 0) return "This week";
    if (weekOffset === -1) return "Last week";
    return `${Math.abs(weekOffset)} weeks ago`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto mb-10 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#EBF5FB] text-[#154360] flex items-center justify-center">
            <Sparkles size={12} />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#57636E]">
            {userName.toUpperCase()}&apos;S INSIGHTS
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#57636E]">
          <span>{getWeekLabel()}</span>
          <div className="flex items-center">
            <button 
              onClick={() => setWeekOffset(w => w - 1)}
              className="p-1 hover:bg-[#F5F6F8] rounded text-[#57636E] hover:text-[#20262E] cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => setWeekOffset(w => Math.min(0, w + 1))}
              disabled={weekOffset === 0}
              className={`p-1 rounded ${weekOffset === 0 ? "opacity-30 cursor-not-allowed text-[#57636E]" : "hover:bg-[#F5F6F8] text-[#57636E] hover:text-[#20262E] cursor-pointer"}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 3 Grid Cards (Matching Image 5) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Your views over time */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E7EC] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#20262E] mb-1">Your views over time</h3>
            <p className="text-xs text-[#57636E] leading-relaxed mb-4">
              Be efficient with async video. Start by recording a video.
            </p>

            <button
              onClick={onStartRecord}
              className="w-full py-2 bg-white hover:bg-[#EBF5FB]/40 border border-[#E2E7EC] hover:border-[#154360] text-[#20262E] text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer mb-5"
            >
              Start recording
            </button>
          </div>

          {/* Minimal Grid & Zero State */}
          <div className="relative pt-4 border-t border-[#E2E7EC]/60">
            <div className="h-28 flex items-center justify-center">
              <span className="text-xs font-bold text-[#57636E]">{viewsThisWeek} views this week</span>
            </div>
            <div className="flex justify-between text-[10px] text-[#57636E] font-medium pt-2 border-t border-[#E2E7EC]/40">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>
          </div>
        </div>

        {/* Card 2: Video spotlights */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E7EC] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#20262E] mb-1">Video spotlights</h3>
            <p className="text-xs text-[#57636E] leading-relaxed mb-4">
              Celebrate your impact. Learn how others create value with RCRD.
            </p>

            <button
              onClick={onStartRecord}
              className="w-full py-2 bg-white hover:bg-[#EBF5FB]/40 border border-[#E2E7EC] hover:border-[#154360] text-[#20262E] text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer mb-4"
            >
              Explore the Community
            </button>
          </div>

          {/* Spotlight Graphic Card in Glassdoor green */}
          <div 
            onClick={onStartRecord}
            className="relative h-32 rounded-xl bg-gradient-to-br from-[#EBF5FB] via-white to-[#EBF5FB] border border-[#154360]/20 flex flex-col items-center justify-center p-3 cursor-pointer group overflow-hidden"
          >
            <div className="w-12 h-12 rounded-full bg-[#154360] text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <Play size={18} className="fill-white translate-x-0.5" />
            </div>
            <span className="text-xs font-bold text-[#0E2F44] mt-2 group-hover:text-[#154360] transition-colors">
              Skip the meeting, send a RCRD
            </span>
          </div>
        </div>

        {/* Card 3: Speech breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E7EC] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#20262E] mb-1">Speech breakdown</h3>
            <p className="text-sm font-bold text-[#20262E]">You communicate like a pro.</p>
            
            <div className="flex items-center gap-3 text-[11px] text-[#57636E] font-medium mt-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#154360]" />
                0% filler words
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                100% other
              </span>
            </div>
          </div>

          {/* Donut graphic */}
          <div className="py-4 flex flex-col items-center justify-center">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#154360]"
                  strokeDasharray="98, 100"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-base font-extrabold text-[#20262E] leading-tight">247</span>
                <span className="text-[9px] text-[#57636E] font-semibold">total words</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E2E7EC]/60 flex items-center justify-between text-xs text-[#154360] hover:text-[#0E2F44] font-semibold cursor-pointer">
            <span>Learn how to remove filler words</span>
            <ArrowRight size={13} />
          </div>
        </div>

      </div>
    </div>
  );
}
