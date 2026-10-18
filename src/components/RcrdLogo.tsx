"use client";

import React from "react";
import Image from "next/image";

interface RcrdLogoProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function RcrdLogo({
  className = "h-12 sm:h-14 md:h-16 w-auto",
}: RcrdLogoProps) {
  return (
    <Image
      src="/icon.png"
      alt="RCRD Logo"
      width={320}
      height={177}
      priority
      className={`object-contain ${className}`}
    />
  );
}
