"use client";

import React from "react";

interface RcrdLogoProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function RcrdLogo({
  className = "h-8 w-auto",
}: RcrdLogoProps) {
  return (
    <img
      src="/icon.png"
      alt="RCRD Logo"
      className={`object-contain ${className}`}
    />
  );
}
