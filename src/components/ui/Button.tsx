import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-bold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-[#4F46E5] text-white hover:bg-[#4338CA] shadow-sm hover:shadow active:scale-[0.99] transition-all",
      secondary: "bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF] active:scale-[0.99] transition-all",
      outline: "border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all",
      ghost: "text-[#475569] hover:text-[#0F172A] hover:bg-slate-100 transition-all",
    };

    const sizes = {
      sm: "h-9 px-3 text-xs",
      md: "h-11 px-6 text-sm",
      lg: "h-14 px-8 text-base",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
