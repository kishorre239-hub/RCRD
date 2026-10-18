"use client";

import React from "react";
import Image from "next/image";

interface RcrdLogoProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function RcrdLogo({
  className = "h-20 sm:h-22 md:h-24 w-auto scale-145 sm:scale-160 md:scale-175 origin-left",
}: RcrdLogoProps) {
  return (
    <Image
      src="/icon.png"
      alt="RCRD Logo"
      width={440}
      height={240}
      priority
      className={`object-contain transition-all duration-200 ${className}`}
    />
  );
}
