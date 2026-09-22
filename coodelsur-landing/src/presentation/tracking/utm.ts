import type { UtmParams } from "@/shared/types/credito";

export const UTM_COOKIE_NAME = "coodelsur_utm";
export const UTM_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export const UTM_PARAM_KEYS = [
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "utm_term",
  "utm_content",
] as const;

export function parseUtmFromSearchParams(
  searchParams: URLSearchParams,
): UtmParams | null {
  const utm: UtmParams = {};
  let hasAny = false;

  const mapping: Record<string, keyof UtmParams> = {
    utm_source: "utmSource",
    utm_campaign: "utmCampaign",
    utm_medium: "utmMedium",
    utm_term: "utmTerm",
    utm_content: "utmContent",
  };

  for (const [param, key] of Object.entries(mapping)) {
    const value = searchParams.get(param);
    if (value) {
      utm[key] = value;
      hasAny = true;
    }
  }

  return hasAny ? utm : null;
}

/**
 * Lee UTM estándar o atajos de campaña (`ref=witme`, `origen=witme`, `source=witme`).
 * Witme debe usar estas URLs para que el lead quede marcado como origen `witme` en admin.
 */
export function parseAttributionFromSearchParams(
  searchParams: URLSearchParams,
): UtmParams | null {
  const fromUtm = parseUtmFromSearchParams(searchParams);
  if (fromUtm) return fromUtm;

  const ref =
    searchParams.get("ref") ??
    searchParams.get("origen") ??
    searchParams.get("source");

  if (!ref?.trim()) return null;

  const normalized = ref.trim().toLowerCase();
  if (!normalized.includes("witme")) return null;

  return {
    utmSource: "witme",
    utmMedium: searchParams.get("utm_medium") ?? "redirect",
    utmCampaign:
      searchParams.get("utm_campaign") ??
      searchParams.get("campaign") ??
      searchParams.get("campana") ??
      undefined,
    utmTerm: searchParams.get("utm_term") ?? undefined,
    utmContent: searchParams.get("utm_content") ?? undefined,
  };
}

export function resolveOrigenFromAttribution(utm: UtmParams | null | undefined): string {
  return inferOrigen(utm);
}

export function serializeUtm(utm: UtmParams): string {
  return JSON.stringify(utm);
}

export function deserializeUtm(raw: string | undefined): UtmParams | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UtmParams;
  } catch {
    return null;
  }
}

export function inferOrigen(utm: UtmParams | null | undefined): string {
  if (!utm?.utmSource) return "directo";
  const source = utm.utmSource.toLowerCase();
  if (source.includes("witme")) return "witme";
  if (source.includes("google") || source.includes("facebook") || source.includes("instagram")) {
    return "organico";
  }
  return utm.utmSource;
}
