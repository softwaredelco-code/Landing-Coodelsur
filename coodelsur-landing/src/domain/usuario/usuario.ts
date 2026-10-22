export type RolUsuario = "sistemas" | "administrador" | "asesor";
export type UserRole = RolUsuario;

export interface SessionUser {
  id: string;
  usuario: string;
  nombre: string;
  rol: UserRole;
}

export interface UsuarioPublico {
  id: string;
  usuario: string;
  nombre: string;
  rol: UserRole;
  activo: boolean;
  ultimoAcceso: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export const USER_ROLES: { value: UserRole; label: string; description: string }[] = [
  {
    value: "sistemas",
    label: "Sistemas",
    description: "Control total de la plataforma y administración exclusiva de usuarios",
  },
  {
    value: "administrador",
    label: "Administrador",
    description: "Gestión de solicitudes, descargas, exportaciones y configuración de parámetros",
  },
  {
    value: "asesor",
    label: "Asesor",
    description: "Visualización y gestión de solicitudes de crédito",
  },
];

export function sanitizeUsuario(usuario: string): string {
  return usuario.trim().toLowerCase();
}

export function validateUsuarioUsername(username: string): string | null {
  const clean = sanitizeUsuario(username);
  if (!clean || clean.length < 3) {
    return "El usuario debe tener al menos 3 caracteres";
  }
  if (clean.length > 30) {
    return "El usuario no puede superar 30 caracteres";
  }
  if (!/^[a-z0-9._-]+$/.test(clean)) {
    return "El usuario solo puede contener letras, números, puntos, guiones y guiones bajos";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < 6) {
    return "La contraseña debe tener al menos 6 caracteres";
  }
  return null;
}
