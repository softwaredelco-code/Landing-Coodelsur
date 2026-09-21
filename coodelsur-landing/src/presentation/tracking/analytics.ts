declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Server runtime (cPanel: GA_MEASUREMENT_ID) o build CI (NEXT_PUBLIC_GA_MEASUREMENT_ID). */
export function getGaMeasurementId(): string {
  return (
    process.env.GA_MEASUREMENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ||
    ""
  );
}

export function isAnalyticsConfigured(): boolean {
  return getGaMeasurementId().length > 0;
}

export function isAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") {
    return isAnalyticsConfigured();
  }
  return typeof window.gtag === "function";
}

export function trackPageView(pagePath: string): void {
  if (typeof window.gtag !== "function") return;

  window.gtag("event", "page_view", {
    page_path: pagePath,
  });
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (typeof window.gtag !== "function") return;

  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined))
    : undefined;

  window.gtag("event", eventName, cleanParams);
}
