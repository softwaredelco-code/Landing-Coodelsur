import type { GeoLocation } from "@/types/credito";

interface IpApiResponse {
  city?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
  error?: boolean;
  reason?: string;
}

export async function geolocateByIp(ip: string | null): Promise<GeoLocation> {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("::")) {
    return {};
  }

  try {
    const apiKey = process.env.IPAPI_KEY;
    const url = apiKey
      ? `https://ipapi.co/${ip}/json/?key=${apiKey}`
      : `https://ipapi.co/${ip}/json/`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return {};
    }

    const data = (await response.json()) as IpApiResponse;
    if (data.error) {
      return {};
    }

    return {
      ciudad: data.city,
      pais: data.country_name,
      latitud: data.latitude,
      longitud: data.longitude,
    };
  } catch {
    return {};
  }
}
