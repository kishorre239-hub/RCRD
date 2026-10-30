"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight, TrendingUp, Play } from "lucide-react";

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
          <div className="w-5 h-5 rounded-full bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
            <TrendingUp size={12} />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
            {userName.toUpperCase()}&apos;S INSIGHTS
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
          <span>{getWeekLabel()}</span>
          <div className="flex items-center">
            <button 
              onClick={() => setWeekOffset(w => w - 1)}
              className="p-1 hover:bg-[#F8FAFC] rounded text-[#475569] hover:text-[#0F172A] cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => setWeekOffset(w => Math.min(0, w + 1))}
              disabled={weekOffset === 0}
              className={`p-1 rounded ${weekOffset === 0 ? "opacity-30 cursor-not-allowed text-[#475569]" : "hover:bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A] cursor-pointer"}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 3 Grid Cards (Matching Image 5) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Your views over time */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] mb-1">Your views over time</h3>
            <p className="text-xs text-[#475569] leading-relaxed mb-4">
              Be efficient with async video. Start by recording a video.
            </p>

            <button
              onClick={onStartRecord}
              className="w-full py-2 bg-white hover:bg-[#EEF2FF]/40 border border-[#E2E8F0] hover:border-[#4F46E5] text-[#0F172A] text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer mb-5"
            >
              Start recording
            </button>
          </div>

          {/* Minimal Grid & Zero State */}
          <div className="relative pt-4 border-t border-[#E2E8F0]/60">
            <div className="h-28 flex items-center justify-center">
              <span className="text-xs font-bold text-[#475569]">{viewsThisWeek} views this week</span>
            </div>
            <div className="flex justify-between text-[10px] text-[#475569] font-medium pt-2 border-t border-[#E2E8F0]/40">
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
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] mb-1">Video spotlights</h3>
            <p className="text-xs text-[#475569] leading-relaxed mb-4">
              Celebrate your impact. Learn how others create value with RCRD.
            </p>

            <button
              onClick={onStartRecord}
              className="w-full py-2 bg-white hover:bg-[#EEF2FF]/40 border border-[#E2E8F0] hover:border-[#4F46E5] text-[#0F172A] text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer mb-4"
            >
              Explore the Community
            </button>
          </div>

          {/* Spotlight Graphic Card in Glassdoor green */}
          <div 
            onClick={onStartRecord}
            className="relative h-32 rounded-xl bg-gradient-to-br from-[#EEF2FF] via-white to-[#EEF2FF] border border-[#4F46E5]/20 flex flex-col items-center justify-center p-3 cursor-pointer group overflow-hidden"
          >
            <div className="w-12 h-12 rounded-full bg-[#4F46E5] text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <Play size={18} className="fill-white translate-x-0.5" />
            </div>
            <span className="text-xs font-bold text-[#4338CA] mt-2 group-hover:text-[#4F46E5] transition-colors">
              Skip the meeting, send a RCRD
            </span>
          </div>
        </div>

        {/* Card 3: Speech breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] mb-1">Speech breakdown</h3>
            <p className="text-sm font-bold text-[#0F172A]">You communicate like a pro.</p>
            
            <div className="flex items-center gap-3 text-[11px] text-[#475569] font-medium mt-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#4F46E5]" />
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
                  className="text-[#4F46E5]"
                  strokeDasharray="98, 100"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-base font-extrabold text-[#0F172A] leading-tight">247</span>
                <span className="text-[9px] text-[#475569] font-semibold">total words</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E2E8F0]/60 flex items-center justify-between text-xs text-[#4F46E5] hover:text-[#4338CA] font-semibold cursor-pointer">
            <span>Learn how to remove filler words</span>
            <ArrowRight size={13} />
          </div>
        </div>

      </div>
    </div>
  );
}
