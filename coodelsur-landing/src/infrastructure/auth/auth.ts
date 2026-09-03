import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "coodelsur_admin";
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12h

function getSecret() {
  return process.env.ADMIN_PASSWORD || process.env.WITME_API_KEY || "dev-admin-secret";
}

export function signAdminToken(password: string): string {
  return createHmac("sha256", getSecret()).update(`admin:${password}`).digest("hex");
}

export function isValidAdminToken(token: string | undefined, password: string): boolean {
  if (!token || !password) return false;
  const expected = signAdminToken(password);
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildAdminCookie(token: string): string {
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function clearAdminCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}
