import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "neutral";
}

export function Badge({ className = "", variant = "default", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-[#E6F6EC]/40 text-[#0C5325]",
    success: "bg-[#E6F6EC] text-[#0C5325]",
    warning: "bg-[#72BAA9]/25 text-[#0C5325]",
    error: "bg-[#0CAA41]/15 text-[#0CAA41]",
    neutral: "bg-[#72BAA9]/10 text-[#0C5325]",
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
