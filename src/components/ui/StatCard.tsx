import React from "react";
import { LucideIcon } from "lucide-react";
import { Card } from "./Card";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  className?: string;
}

export function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  iconColor = "text-primary", 
  iconBg = "bg-primary/10",
  className = "" 
}: StatCardProps) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center mb-4`}>
        <Icon size={20} className={iconColor} />
      </div>
      <p className="text-[11px] font-bold text-[#94A3B8] mb-1 uppercase tracking-wider">{label}</p>
      <p className="text-[32px] font-bold text-[#0F172A] tracking-tight leading-tight">{value}</p>
    </Card>
  );
}
