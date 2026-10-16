import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "neutral";
}

export function Badge({ className = "", variant = "default", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-[#D5E7B5]/40 text-[#6E1A37]",
    success: "bg-[#D5E7B5] text-[#6E1A37]",
    warning: "bg-[#72BAA9]/25 text-[#6E1A37]",
    error: "bg-[#AE2448]/15 text-[#AE2448]",
    neutral: "bg-[#72BAA9]/10 text-[#6E1A37]",
  };

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
