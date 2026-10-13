import React from "react";

interface ProgressBarProps {
  value: number; // 0 to 100
  color?: string; // Tailwind bg class
  className?: string;
}

export function ProgressBar({ value, color = "bg-primary", className = "" }: ProgressBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className={`w-full bg-gray-100 h-1.5 rounded-full overflow-hidden ${className}`}>
      <div 
        className={`h-full rounded-full transition-all duration-500 ease-in-out ${color}`} 
        style={{ width: `${clampedValue}%` }} 
      />
    </div>
  );
}
