"use client";

import React from "react";
import Image from "next/image";

interface RcrdLogoProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function RcrdLogo({
  className = "h-16 sm:h-18 md:h-20 w-auto scale-125 sm:scale-135 md:scale-145 origin-left",
}: RcrdLogoProps) {
  return (
    <Image
      src="/icon.png"
      alt="RCRD Logo"
      width={360}
      height={200}
      priority
      className={`object-contain transition-all duration-200 ${className}`}
    />
  );
}
