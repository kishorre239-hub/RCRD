"use client";

import React from "react";
import Image from "next/image";

interface RcrdLogoProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function RcrdLogo({
  className = "h-22 sm:h-24 md:h-26 w-auto scale-175 sm:scale-190 md:scale-205 origin-center",
}: RcrdLogoProps) {
  return (
    <Image
      src="/icon.png"
      alt="RCRD Logo"
      width={480}
      height={260}
      priority
      className={`object-contain transition-all duration-200 ${className}`}
    />
  );
}
