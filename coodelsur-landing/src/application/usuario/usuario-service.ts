import { prisma } from "@/infrastructure/database/prisma";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/auth";
import {
  RolUsuario,
  SessionUser,
  UsuarioPublico,
  sanitizeUsuario,
  validatePassword,
  validateUsuarioUsername,
} from "@/domain/usuario/usuario";

/**
 * Garantiza que exista al menos un usuario con rol 'sistemas' en la base de datos.
 * Si no existe ninguno, se crea automáticamente 'sistemas' con la contraseña configurada en ADMIN_PASSWORD.
 */
export async function ensureInitialSistemasUser(): Promise<void> {
  try {
    const sistemasCount = await prisma.usuario.count({
      where: { rol: "sistemas" },
    });

    if (sistemasCount === 0) {
      const defaultPassword = process.env.ADMIN_PASSWORD || "sistemas123";
      await prisma.usuario.create({
        data: {
          usuario: "sistemas",
          nombre: "Administrador de Sistemas",
          rol: "sistemas",
          passwordHash: hashPassword(defaultPassword),
          activo: true,
        },
      });
      console.log("[Auth] Usuario inicial 'sistemas' creado satisfactoriamente.");
    }
  } catch (err) {
    console.error("[Auth] Error verificando/creando usuario inicial 'sistemas':", err);
  }
}

export interface LoginParams {
  usuario: string;
  password: string;
}

export async function authenticateUsuario({
  usuario,
  password,
}: LoginParams): Promise<SessionUser> {
  const cleanUsuario = sanitizeUsuario(usuario);
  if (!cleanUsuario || !password) {
    throw new Error("Debe ingresar usuario y contraseña");
  }

  await ensureInitialSistemasUser();

  const user = await prisma.usuario.findUnique({
    where: { usuario: cleanUsuario },
  });

  if (!user) {
    throw new Error("Usuario o contraseña incorrectos");
  }

  if (!user.activo) {
    throw new Error("Esta cuenta de usuario está desactivada. Contacte a Sistemas.");
  }

  const isMatch = verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    throw new Error("Usuario o contraseña incorrectos");
  }

  // Registrar último acceso de manera asíncrona sin bloquear la respuesta
  prisma.usuario
    .update({
      where: { id: user.id },
      data: { ultimoAcceso: new Date() },
    })
    .catch((err: unknown) => console.error("[Auth] Error actualizando ultimoAcceso:", err));

  return {
    id: user.id,
    usuario: user.usuario,
    nombre: user.nombre,
    rol: user.rol as RolUsuario,
  };
}

export async function listarUsuarios(): Promise<UsuarioPublico[]> {
  await ensureInitialSistemasUser();

  const usuarios = await prisma.usuario.findMany({
    orderBy: [{ rol: "asc" }, { fechaCreacion: "asc" }],
  });

  return usuarios.map((u) => ({
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    rol: u.rol as RolUsuario,
    activo: u.activo,
    ultimoAcceso: u.ultimoAcceso ? u.ultimoAcceso.toISOString() : null,
    fechaCreacion: u.fechaCreacion.toISOString(),
    fechaActualizacion: u.fechaActualizacion.toISOString(),
  }));
}

export interface CrearUsuarioParams {
  usuario: string;
  nombre: string;
  password: string;
  rol: RolUsuario;
  activo?: boolean;
}

export async function crearUsuario(params: CrearUsuarioParams): Promise<UsuarioPublico> {
  const cleanUsuario = sanitizeUsuario(params.usuario);
  const usernameError = validateUsuarioUsername(cleanUsuario);
  if (usernameError) {
    throw new Error(usernameError);
  }

  const cleanNombre = params.nombre?.trim();
  if (!cleanNombre || cleanNombre.length < 2) {
    throw new Error("El nombre completo debe tener al menos 2 caracteres");
  }

  const passwordError = validatePassword(params.password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const validRoles: RolUsuario[] = ["sistemas", "administrador", "asesor"];
  if (!validRoles.includes(params.rol)) {
    throw new Error("El rol especificado no es válido");
  }

  const existing = await prisma.usuario.findUnique({
    where: { usuario: cleanUsuario },
  });
  if (existing) {
    throw new Error(`El usuario '${cleanUsuario}' ya se encuentra registrado`);
  }

  const created = await prisma.usuario.create({
    data: {
      usuario: cleanUsuario,
      nombre: cleanNombre,
      passwordHash: hashPassword(params.password),
      rol: params.rol,
      activo: params.activo ?? true,
    },
  });

  return {
    id: created.id,
    usuario: created.usuario,
    nombre: created.nombre,
    rol: created.rol as RolUsuario,
    activo: created.activo,
    ultimoAcceso: created.ultimoAcceso ? created.ultimoAcceso.toISOString() : null,
    fechaCreacion: created.fechaCreacion.toISOString(),
    fechaActualizacion: created.fechaActualizacion.toISOString(),
  };
}

export interface ActualizarUsuarioParams {
  nombre?: string;
  rol?: RolUsuario;
  activo?: boolean;
  password?: string;
}

export async function actualizarUsuario(
  id: string,
  params: ActualizarUsuarioParams,
  currentUserId: string,
): Promise<UsuarioPublico> {
  const existing = await prisma.usuario.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("El usuario especificado no existe");
  }

  // Protección: No puede desactivarse a sí mismo
  if (id === currentUserId && params.activo === false) {
    throw new Error("No puedes desactivar tu propia cuenta de usuario");
  }

  // Protección: Si es el único Sistemas activo, no puede desactivarse ni cambiar rol
  if (
    existing.rol === "sistemas" &&
    ((params.rol !== undefined && params.rol !== "sistemas") || params.activo === false)
  ) {
    const sistemasActivos = await prisma.usuario.count({
      where: { rol: "sistemas", activo: true },
    });
    if (sistemasActivos <= 1) {
      throw new Error("No es posible desactivar ni cambiar el rol del único usuario de Sistemas activo.");
    }
  }

  const dataToUpdate: {
    nombre?: string;
    rol?: any;
    activo?: boolean;
    passwordHash?: string;
  } = {};

  if (params.nombre !== undefined) {
    const cleanNombre = params.nombre.trim();
    if (!cleanNombre || cleanNombre.length < 2) {
      throw new Error("El nombre completo debe tener al menos 2 caracteres");
    }
    dataToUpdate.nombre = cleanNombre;
  }

  if (params.rol !== undefined) {
    const validRoles: RolUsuario[] = ["sistemas", "administrador", "asesor"];
    if (!validRoles.includes(params.rol)) {
      throw new Error("El rol especificado no es válido");
    }
    dataToUpdate.rol = params.rol;
  }

  if (params.activo !== undefined) {
    dataToUpdate.activo = params.activo;
  }

  if (params.password) {
    const passwordError = validatePassword(params.password);
    if (passwordError) {
      throw new Error(passwordError);
    }
    dataToUpdate.passwordHash = hashPassword(params.password);
  }

  const updated = await prisma.usuario.update({
    where: { id },
    data: dataToUpdate,
  });

  return {
    id: updated.id,
    usuario: updated.usuario,
    nombre: updated.nombre,
    rol: updated.rol as RolUsuario,
    activo: updated.activo,
    ultimoAcceso: updated.ultimoAcceso ? updated.ultimoAcceso.toISOString() : null,
    fechaCreacion: updated.fechaCreacion.toISOString(),
    fechaActualizacion: updated.fechaActualizacion.toISOString(),
  };
}

export async function eliminarUsuario(
  id: string,
  currentUserId: string,
): Promise<{ success: boolean; usuario: string }> {
  const existing = await prisma.usuario.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("El usuario especificado no existe");
  }

  if (id === currentUserId) {
    throw new Error("Por seguridad, no puedes eliminar tu propia cuenta de usuario");
  }

  if (existing.rol === "sistemas") {
    const sistemasCount = await prisma.usuario.count({
      where: { rol: "sistemas" },
    });
    if (sistemasCount <= 1) {
      throw new Error("No se puede eliminar el único usuario con rol de Sistemas");
    }
  }

  await prisma.usuario.delete({ where: { id } });
  return { success: true, usuario: existing.usuario };
}
