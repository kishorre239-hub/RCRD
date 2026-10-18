import React from 'react';
import Image from 'next/image';

export function CompanyLogo({ className = "" }: { className?: string }) {
  return (
    <Image 
      src="/icon.png" 
      alt="RCRD Logo" 
      width={48}
      height={48}
      priority
      className={`object-contain ${className}`} 
    />
  );
}
