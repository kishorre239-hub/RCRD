import React from "react";

export function LoomSparkIcon({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Center Donut Ring with hollow center */}
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2.2" fill="none" />
      {/* 12 Radial Rays */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="2.2"
          x2="12"
          y2="5.6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

interface RecordVideoButtonProps {
  onClick: () => void;
  id?: string;
  className?: string;
}

export default function RecordVideoButton({ onClick, id = "tour-record-btn", className = "" }: RecordVideoButtonProps) {
  return (
    <div className={`py-4 pl-0 pr-4 border-t border-[#1E293B] bg-[#0F172A] flex-shrink-0 flex items-center ${className}`}>
      <button
        id={id}
        type="button"
        onClick={onClick}
        className="bg-[#4F46E5] hover:bg-[#4338CA] text-white py-3 pl-4 pr-6 rounded-r-2xl rounded-l-none text-[15px] font-bold flex items-center gap-2.5 shadow-[0_4px_16px_rgba(79,70,229,0.4)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.55)] transition-all active:scale-[0.98] cursor-pointer select-none"
        title="Record a video"
      >
        <LoomSparkIcon size={22} className="text-white shrink-0" />
        <span className="whitespace-nowrap font-bold tracking-tight">Record a video</span>
      </button>
    </div>
  );
}
