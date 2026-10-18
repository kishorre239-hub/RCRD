"use client";

import React from "react";
import Image from "next/image";

interface RcrdLogoProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function RcrdLogo({
  className = "h-8 w-auto",
}: RcrdLogoProps) {
  return (
    <Image
      src="/icon.png"
      alt="RCRD Logo"
      width={160}
      height={48}
      priority
      className={`object-contain ${className}`}
    />
  );
}
