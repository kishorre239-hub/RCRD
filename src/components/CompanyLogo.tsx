import React from 'react';

export function CompanyLogo({ className = "" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 1280 1280" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <image href="/ICONS/COMPANY NAME.jpeg" x="0" y="0" width="1280" height="1280" />
    </svg>
  );
}
