"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

interface LogoProps {
  variant?: "default" | "light";
  size?: "md" | "lg";
  className?: string;
}

const logoSizes = {
  md: "h-11 w-auto object-contain md:h-12",
  lg: "h-14 w-auto object-contain md:h-16",
} as const;

export function Logo({ variant = "default", size = "lg", className }: LogoProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <Link href="/" className={className} aria-label="Coodelsur — Inicio">
        <span
          className={
            variant === "light"
              ? "text-lg font-bold tracking-wide text-white"
              : "text-lg font-bold tracking-wide text-coodel-primary"
          }
        >
          COODELSUR
        </span>
      </Link>
    );
  }

  return (
    <Link href="/" className={className} aria-label="Coodelsur — Inicio">
      <Image
        src="/images/logo.jpg"
        alt="Coodelsur"
        width={180}
        height={56}
        className={logoSizes[size]}
        priority
        onError={() => setImgError(true)}
      />
    </Link>
  );
}
