"use client";

import React from "react";
import Image from "next/image";

interface RcrdLogoProps {
  className?: string;
  size?: number;
  color?: string;
}

export default function RcrdLogo({
  className = "h-11 sm:h-12 md:h-14 w-auto",
}: RcrdLogoProps) {
  return (
    <Image
      src="/icon.png"
      alt="RCRD Logo"
      width={260}
      height={130}
      priority
      className={`object-contain ${className}`}
    />
  );
}
