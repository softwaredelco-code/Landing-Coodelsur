"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  parseAttributionFromSearchParams,
  resolveOrigenFromAttribution,
  serializeUtm,
  UTM_COOKIE_MAX_AGE,
  UTM_COOKIE_NAME,
} from "./utm";
import { isAnalyticsEnabled, trackEvent, trackPageView } from "./analytics";

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
    const attribution = parseAttributionFromSearchParams(searchParams);
    if (attribution) {
      setCookie(UTM_COOKIE_NAME, serializeUtm(attribution), UTM_COOKIE_MAX_AGE);

      if (isAnalyticsEnabled()) {
        trackEvent("campaign_attribution", {
          origen: resolveOrigenFromAttribution(attribution),
          utm_source: attribution.utmSource,
          utm_medium: attribution.utmMedium,
          utm_campaign: attribution.utmCampaign,
        });
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isAnalyticsEnabled() || pathname.startsWith("/admin")) return;

    const query = searchParams.toString();
    trackPageView(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  return <>{children}</>;
}
