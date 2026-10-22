import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { SessionUser } from "@/domain/usuario/usuario";

export type { SessionUser };

export const ADMIN_COOKIE = "coodelsur_admin";
export const COOKIE_MAX_AGE = 60 * 60 * 12; // 12h

function getSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.WITME_API_KEY ||
    "coodelsur-secret-key-auth-2026"
  );
}

/**
 * Genera un hash seguro con sal para una contraseña usando scrypt de node:crypto.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

/**
 * Verifica si una contraseña coincide con el hash almacenado.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuf = Buffer.from(key, "hex");
    const derived = scryptSync(password, salt, 64);
    if (keyBuf.length !== derived.length) return false;
    return timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

interface SessionPayload extends SessionUser {
  exp: number;
}

/**
 * Genera un token firmado con HMAC-SHA256 para la sesión del usuario.
 */
export function signSessionToken(user: SessionUser): string {
  const payload: SessionPayload = {
    ...user,
    exp: Date.now() + COOKIE_MAX_AGE * 1000,
  };
  const payloadJson = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(payloadJson).digest("hex");
  return `${payloadJson}.${signature}`;
}

/**
 * Verifica y decodifica un token de sesión. Si es válido retorna el SessionUser.
 * Si es un token legado de ADMIN_PASSWORD, retorna un usuario sistemas temporal por retrocompatibilidad.
 */
export function verifySessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null;

  // 1. Token moderno: payload.signature
  if (token.includes(".")) {
    const [payloadJson, signature] = token.split(".");
    if (!payloadJson || !signature) return null;

    const expectedSignature = createHmac("sha256", getSecret()).update(payloadJson).digest("hex");
    try {
      const sigBuf = Buffer.from(signature);
      const expSigBuf = Buffer.from(expectedSignature);
      if (sigBuf.length !== expSigBuf.length || !timingSafeEqual(sigBuf, expSigBuf)) {
        return null;
      }

      const decoded = JSON.parse(Buffer.from(payloadJson, "base64url").toString("utf-8")) as SessionPayload;
      if (!decoded || !decoded.id || !decoded.usuario || !decoded.rol) {
        return null;
      }

      if (typeof decoded.exp === "number" && decoded.exp < Date.now()) {
        return null; // Expirado
      }

      return {
        id: decoded.id,
        usuario: decoded.usuario,
        nombre: decoded.nombre || decoded.usuario,
        rol: decoded.rol,
      };
    } catch {
      return null;
    }
  }

  // 2. Soporte retrocompatible para token legado basado en ADMIN_PASSWORD
  const legacyPassword = process.env.ADMIN_PASSWORD;
  if (legacyPassword && isValidAdminToken(token, legacyPassword)) {
    return {
      id: "legacy-admin",
      usuario: "sistemas",
      nombre: "Administrador de Sistemas",
      rol: "sistemas",
    };
  }

  return null;
}

/**
 * Token legado (firma basada en admin:password)
 */
export function signAdminToken(password: string): string {
  return createHmac("sha256", getSecret()).update(`admin:${password}`).digest("hex");
}

/**
 * Comprueba si un token es válido. Acepta tanto tokens modernos de usuario como legados.
 */
export function isValidAdminToken(token: string | undefined, password?: string): boolean {
  if (!token) return false;

  // Si es token de sesión moderno válido
  const user = verifySessionToken(token);
  if (user) return true;

  // Fallback legado si se pasó password
  if (password) {
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

  return false;
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
