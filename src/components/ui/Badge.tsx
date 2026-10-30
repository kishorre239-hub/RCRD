import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "danger" | "info" | "neutral";
}

export function Badge({ className = "", variant = "default", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-[#EEF2FF] text-[#4F46E5] border border-[#EEF2FF]",
    success: "bg-[#ECFDF5] text-[#10B981] border border-[#ECFDF5]",
    warning: "bg-[#FFFBEB] text-[#F59E0B] border border-[#FFFBEB]",
    error: "bg-[#FEF2F2] text-[#EF4444] border border-[#FEF2F2]",
    danger: "bg-[#FEF2F2] text-[#EF4444] border border-[#FEF2F2]",
    info: "bg-[#F0F9FF] text-[#0284C7] border border-[#F0F9FF]",
    neutral: "bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]",
  };

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold tracking-wide ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
