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

export const WITME_COOKIE_NAME = "coodelsur_witme_id";
export const WITME_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días de persistencia

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function saveWitmeId(witmeId: string) {
  if (typeof window === "undefined" || !witmeId?.trim()) return;
  const cleanId = witmeId.trim();
  try {
    setCookie(WITME_COOKIE_NAME, cleanId, WITME_COOKIE_MAX_AGE);
  } catch {}
  try {
    localStorage.setItem(WITME_COOKIE_NAME, cleanId);
  } catch {}
  try {
    sessionStorage.setItem(WITME_COOKIE_NAME, cleanId);
  } catch {}
}

export function getWitmeId(): string | null {
  if (typeof window === "undefined") return null;

  // 1. URL search params (máxima prioridad)
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl =
      params.get("witme_id") ||
      params.get("witmeId") ||
      params.get("click_id") ||
      params.get("id_externo");
    if (fromUrl?.trim()) {
      saveWitmeId(fromUrl.trim());
      return fromUrl.trim();
    }
  } catch {}

  // 2. Cookie (persistente entre sesiones y recargas)
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${WITME_COOKIE_NAME}=`));
    if (match) {
      const val = decodeURIComponent(match.split("=")[1] ?? "").trim();
      if (val) return val;
    }
  } catch {}

  // 3. LocalStorage
  try {
    const fromLocal = localStorage.getItem(WITME_COOKIE_NAME);
    if (fromLocal?.trim()) return fromLocal.trim();
  } catch {}

  // 4. SessionStorage
  try {
    const fromSession = sessionStorage.getItem(WITME_COOKIE_NAME);
    if (fromSession?.trim()) return fromSession.trim();
  } catch {}

  return null;
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
    const witmeCandidate =
      searchParams.get("witme_id") ||
      searchParams.get("witmeId") ||
      searchParams.get("click_id") ||
      searchParams.get("id_externo");
    if (witmeCandidate?.trim()) {
      saveWitmeId(witmeCandidate.trim());
    }

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
