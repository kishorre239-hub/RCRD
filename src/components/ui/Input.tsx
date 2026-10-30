import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-bold text-text-primary">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`h-12 px-4 rounded-xl border bg-background text-text-primary text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
            error 
              ? "border-[#EF4444] focus:ring-[#EF4444]/30" 
              : "border-border focus:ring-[#4F46E5]/30 focus:border-[#4F46E5] focus:bg-surface"
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-[#EF4444] font-medium">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
