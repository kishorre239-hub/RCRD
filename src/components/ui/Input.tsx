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
              ? "border-[#0CAA41] focus:ring-[#0CAA41]/50" 
              : "border-border focus:ring-[#0CAA41]/50 focus:bg-surface"
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-[#0CAA41] font-medium">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
