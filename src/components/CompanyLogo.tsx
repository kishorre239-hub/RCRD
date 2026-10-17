import React from 'react';

export function CompanyLogo({ className = "" }: { className?: string }) {
  return (
    <img 
      src="/icon.png" 
      alt="RCRD Logo" 
      className={`object-contain ${className}`} 
    />
  );
}
