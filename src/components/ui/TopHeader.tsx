import React from "react";
import { Bell, Search, Menu } from "lucide-react";

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function TopHeader({ title, subtitle, onMenuClick, showMenuButton = false }: TopHeaderProps) {
  return (
    <header className="px-4 lg:px-8 py-4 lg:py-6 flex justify-between items-center bg-background sticky top-0 z-10 border-b lg:border-none border-border">
      <div className="flex items-center gap-3">
        {showMenuButton && (
          <button 
            className="lg:hidden p-2 -ml-2 text-text-secondary hover:bg-gray-100 rounded-lg transition-colors"
            onClick={onMenuClick}
            aria-label="Toggle menu"
          >
            <Menu size={24} />
          </button>
        )}
        <div>
          <h1 className="text-xl lg:text-3xl font-extrabold text-text-primary tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-xs lg:text-sm text-text-secondary mt-1 hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex gap-4">
        <button className="w-10 h-10 bg-surface rounded-full flex items-center justify-center border border-border shadow-sm text-text-secondary hover:text-text-primary hover:border-gray-300 transition-colors">
          <Search size={18} />
        </button>
        <button className="relative w-10 h-10 bg-surface rounded-full flex items-center justify-center border border-border shadow-sm text-text-secondary hover:text-text-primary hover:border-gray-300 transition-colors">
          <Bell size={18} />
          {/* Notification Dot */}
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-surface" />
        </button>
      </div>
    </header>
  );
}
