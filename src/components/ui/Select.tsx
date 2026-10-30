import React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, error, children, id, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="text-sm font-bold text-text-primary">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={`w-full h-12 pl-4 pr-10 rounded-xl border bg-background text-text-primary text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors appearance-none cursor-pointer ${
              error 
                ? "border-[#EF4444] focus:ring-[#EF4444]/30" 
                : "border-border focus:ring-[#4F46E5]/30 focus:border-[#4F46E5] focus:bg-surface"
            } ${className}`}
            {...props}
          >
            {children}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
            <ChevronDown size={18} />
          </div>
        </div>
        {error && <span className="text-xs text-[#EF4444] font-medium">{error}</span>}
      </div>
    );
  }
);
Select.displayName = "Select";
