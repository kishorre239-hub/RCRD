import React from 'react';

interface UserAvatarIconProps {
  className?: string;
  size?: number;
}

export default function UserAvatarIcon({ className = "w-9 h-9", size = 36 }: UserAvatarIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="User Profile"
    >
      {/* Head circle with vibrant blue fill and thick black outline matching Image 5 */}
      <circle 
        cx="50" 
        cy="28" 
        r="16" 
        fill="#2F80ED" 
        stroke="#111827" 
        strokeWidth="7.5" 
      />
      
      {/* Body arc with thick black outline and rounded stroke caps matching Image 5 */}
      <path 
        d="M 17 88 C 17 64, 32 53, 50 53 C 68 53, 83 64, 83 88" 
        stroke="#111827" 
        strokeWidth="7.5" 
        strokeLinecap="round" 
        fill="none"
      />
    </svg>
  );
}
