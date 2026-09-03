"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isAnalyticsEnabled, trackPageView } from "./analytics";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const utm = parseUtmFromSearchParams(searchParams);
    if (utm) {
      setCookie(UTM_COOKIE_NAME, serializeUtm(utm), UTM_COOKIE_MAX_AGE);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isAnalyticsEnabled() || pathname.startsWith("/admin")) return;

    const query = searchParams.toString();
    trackPageView(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  return <>{children}</>;
}
