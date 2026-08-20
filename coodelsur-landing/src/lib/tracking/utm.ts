import type { UtmParams } from "@/types/credito";

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
