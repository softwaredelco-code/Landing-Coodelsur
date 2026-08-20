"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  parseUtmFromSearchParams,
  serializeUtm,
  UTM_COOKIE_MAX_AGE,
  UTM_COOKIE_NAME,
} from "./utm";

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getUtmFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${UTM_COOKIE_NAME}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=")[1] ?? "");
}

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const utm = parseUtmFromSearchParams(searchParams);
    if (utm) {
      setCookie(UTM_COOKIE_NAME, serializeUtm(utm), UTM_COOKIE_MAX_AGE);
    }
  }, [searchParams]);

  return <>{children}</>;
}
