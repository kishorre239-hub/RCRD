import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "neutral";
}

export function Badge({ className = "", variant = "default", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-[#EBF5FB]/40 text-[#0E2F44]",
    success: "bg-[#EBF5FB] text-[#0E2F44]",
    warning: "bg-[#2980B9]/25 text-[#0E2F44]",
    error: "bg-[#154360]/15 text-[#154360]",
    neutral: "bg-[#2980B9]/10 text-[#0E2F44]",
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
