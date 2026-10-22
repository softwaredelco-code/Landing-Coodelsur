"use client";

import { AdminShell } from "@/presentation/components/admin/AdminShell";
import { Button } from "@/presentation/components/ui/Button";
import { Input } from "@/presentation/components/ui/Input";
import { RolUsuario, UsuarioPublico, USER_ROLES } from "@/domain/usuario/usuario";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

interface CurrentUser {
  id: string;
  usuario: string;
  nombre: string;
  rol: RolUsuario;
}

const ROLE_CONFIG: Record<
  RolUsuario,
  { label: string; badge: string; icon: string; description: string }
> = {
  sistemas: {
    label: "Sistemas",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    icon: "🛡️",
    description: "Acceso total y control de usuarios",
  },
  administrador: {
    label: "Administrador",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: "⚡",
    description: "Gestión de solicitudes y configuración de tasas",
  },
  asesor: {
    label: "Asesor",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    icon: "👤",
    description: "Visualización y gestión operativa de solicitudes",
  },
};

export default function UsuariosPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<UsuarioPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("todos");

  // Modales
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalUser, setEditModalUser] = useState<UsuarioPublico | null>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<UsuarioPublico | null>(null);

  // Form states - Nuevo
  const [nuevoUsuario, setNuevoUsuario] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPassword, setNuevoPassword] = useState("");
  const [nuevoRol, setNuevoRol] = useState<RolUsuario>("asesor");
  const [nuevoActivo, setNuevoActivo] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states - Editar
  const [editNombre, setEditNombre] = useState("");
  const [editRol, setEditRol] = useState<RolUsuario>("asesor");
  const [editActivo, setEditActivo] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Cargar usuario actual
  useEffect(() => {
    fetch("/api/admin/login", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setCurrentUser(data.user);
        } else {
          router.replace("/admin");
        }
      })
      .catch(() => router.replace("/admin"))
      .finally(() => setAuthLoading(false));
  }, [router]);

  // Cargar lista de usuarios
  const loadUsuarios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/usuarios", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin");
        return;
      }
      if (res.status === 403) {
        throw new Error("No tienes permisos para ver esta sección.");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al cargar la lista de usuarios.");
      }
      const data = await res.json();
      setUsuarios(data.usuarios || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (currentUser?.rol === "sistemas") {
      void loadUsuarios();
    }
  }, [currentUser, loadUsuarios]);

  // Crear usuario
  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: nuevoUsuario,
          nombre: nuevoNombre,
          password: nuevoPassword,
          rol: nuevoRol,
          activo: nuevoActivo,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear el usuario");
      }

      setSuccessMessage(`Usuario @${data.usuario.usuario} creado correctamente.`);
      setCreateModalOpen(false);
      // Reset form
      setNuevoUsuario("");
      setNuevoNombre("");
      setNuevoPassword("");
      setNuevoRol("asesor");
      setNuevoActivo(true);
      await loadUsuarios();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setCreateLoading(false);
    }
  };

  // Abrir modal editar
  const openEditModal = (u: UsuarioPublico) => {
    setEditModalUser(u);
    setEditNombre(u.nombre);
    setEditRol(u.rol);
    setEditActivo(u.activo);
    setEditPassword("");
    setEditError(null);
  };

  // Guardar edición
  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editModalUser) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const payload: {
        nombre: string;
        rol: RolUsuario;
        activo: boolean;
        password?: string;
      } = {
        nombre: editNombre,
        rol: editRol,
        activo: editActivo,
      };

      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const res = await fetch(`/api/admin/usuarios/${editModalUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el usuario");
      }

      setSuccessMessage(`Usuario @${editModalUser.usuario} actualizado.`);
      setEditModalUser(null);
      await loadUsuarios();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle activo directo
  const handleToggleActivo = async (u: UsuarioPublico) => {
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !u.activo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "No se pudo cambiar el estado del usuario.");
        return;
      }
      setSuccessMessage(
        `Usuario @${u.usuario} ${!u.activo ? "activado" : "desactivado"} exitosamente.`,
      );
      await loadUsuarios();
    } catch {
      alert("Error de conexión al modificar el estado.");
    }
  };

  // Eliminar usuario
  const handleDeleteConfirm = async () => {
    if (!deleteModalUser) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/usuarios/${deleteModalUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo eliminar el usuario");
      }

      setSuccessMessage(`Usuario @${deleteModalUser.usuario} eliminado del sistema.`);
      setDeleteModalUser(null);
      await loadUsuarios();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtrado de usuarios
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      const matchSearch =
        search === "" ||
        u.usuario.toLowerCase().includes(search.toLowerCase()) ||
        u.nombre.toLowerCase().includes(search.toLowerCase());

      const matchRole = roleFilter === "todos" || u.rol === roleFilter;

      return matchSearch && matchRole;
    });
  }, [usuarios, search, roleFilter]);

  // Métricas
  const totalUsuarios = usuarios.length;
  const usuariosActivos = usuarios.filter((u) => u.activo).length;
  const sistemasCount = usuarios.filter((u) => u.rol === "sistemas").length;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-coodel-surface">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-coodel-primary border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500">Verificando credenciales...</p>
        </div>
      </div>
    );
  }

  // Protección: Si no es sistemas
  if (currentUser && currentUser.rol !== "sistemas") {
    return (
      <AdminShell title="Acceso Restringido">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
            🔒
          </div>
          <h2 className="mt-4 text-xl font-bold text-coodel-dark">Control de Usuarios Restringido</h2>
          <p className="mt-2 text-sm text-gray-600">
            Esta sección contiene funciones críticas de administración y configuración de credenciales.
            Solo puede ser gestionada por el usuario con rol de{" "}
            <span className="font-semibold text-purple-700">Sistemas</span>.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/admin/leads"
              className="inline-flex items-center rounded-xl bg-coodel-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-coodel-primary-light"
            >
              Volver a Solicitudes
            </Link>
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Control de Usuarios"
      subtitle="Administración de cuentas con acceso al panel, asignación de roles y control de seguridad."
      actions={
        <Button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreateModalOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <span>➕</span>
          <span>Nuevo Usuario</span>
        </Button>
      }
    >
      {/* Toast de éxito */}
      {successMessage && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-emerald-600 hover:text-emerald-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Alerta de error global */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Ocurrió un error al cargar la información:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Tarjetas de métricas rápidas */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Total Cuentas
          </p>
          <p className="mt-1 text-3xl font-bold text-coodel-dark">{totalUsuarios}</p>
          <p className="mt-1 text-xs text-gray-400">Registradas en la plataforma</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Usuarios Activos
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">{usuariosActivos}</p>
          <p className="mt-1 text-xs text-gray-400">Con autorización de ingreso</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
            Cuentas Sistemas
          </p>
          <p className="mt-1 text-3xl font-bold text-purple-700">{sistemasCount}</p>
          <p className="mt-1 text-xs text-gray-400">Privilegios totales de control</p>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              placeholder="Buscar por usuario o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-coodel-surface/50 px-3.5 py-2 text-sm text-coodel-dark placeholder:text-gray-400 focus:border-coodel-primary-light focus:bg-white focus:outline-none focus:ring-2 focus:ring-coodel-primary-light/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="w-full sm:w-48">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-coodel-dark focus:border-coodel-primary-light focus:outline-none focus:ring-2 focus:ring-coodel-primary-light/20"
            >
              <option value="todos">Todos los roles</option>
              <option value="sistemas">Sistemas</option>
              <option value="administrador">Administrador</option>
              <option value="asesor">Asesor</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-medium text-gray-500">
          Mostrando {usuariosFiltrados.length} de {totalUsuarios} usuarios
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-coodel-primary border-t-transparent" />
            <p className="mt-3 text-sm text-gray-500">Cargando usuarios...</p>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-base font-semibold text-gray-700">No se encontraron usuarios</p>
            <p className="mt-1 text-sm text-gray-400">
              Prueba modificando los filtros de búsqueda o registra un nuevo usuario.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-coodel-body">
              <thead className="border-b border-gray-200 bg-gray-50/80 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <tr>
                  <th className="px-6 py-3.5">Usuario</th>
                  <th className="px-6 py-3.5">Nombre Completo</th>
                  <th className="px-6 py-3.5">Rol</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5">Último Acceso</th>
                  <th className="px-6 py-3.5">Registro</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuariosFiltrados.map((u) => {
                  const roleConfig = ROLE_CONFIG[u.rol] || {
                    label: u.rol,
                    badge: "bg-gray-100 text-gray-700 border-gray-200",
                    icon: "👤",
                    description: "",
                  };
                  const isCurrent = currentUser?.id === u.id;

                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors hover:bg-coodel-surface/50 ${
                        !u.activo ? "opacity-60 bg-gray-50/40" : ""
                      }`}
                    >
                      {/* Usuario */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coodel-primary/10 text-sm font-bold text-coodel-primary">
                            {u.nombre ? u.nombre.charAt(0).toUpperCase() : u.usuario.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold text-coodel-dark">
                              <span>@{u.usuario}</span>
                              {isCurrent && (
                                <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-700">
                                  Tú
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 font-mono">
                              ID: {u.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Nombre */}
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {u.nombre}
                      </td>

                      {/* Rol */}
                      <td className="px-6 py-4">
                        <span
                          title={roleConfig.description}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${roleConfig.badge}`}
                        >
                          <span>{roleConfig.icon}</span>
                          <span>{roleConfig.label}</span>
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-4">
                        {u.activo ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 border border-gray-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                            Inactivo
                          </span>
                        )}
                      </td>

                      {/* Último acceso */}
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {u.ultimoAcceso
                          ? new Date(u.ultimoAcceso).toLocaleString("es-CO", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "Nunca"}
                      </td>

                      {/* Registro */}
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(u.fechaCreacion).toLocaleDateString("es-CO", {
                          dateStyle: "short",
                        })}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-coodel-primary hover:bg-gray-50"
                            title="Editar usuario"
                          >
                            ✏️ Editar
                          </button>

                          <button
                            type="button"
                            disabled={isCurrent && u.activo}
                            onClick={() => void handleToggleActivo(u)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                              u.activo
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                            title={
                              isCurrent
                                ? "No puedes desactivarte a ti mismo"
                                : u.activo
                                ? "Desactivar usuario"
                                : "Activar usuario"
                            }
                          >
                            {u.activo ? "Desactivar" : "Activar"}
                          </button>

                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteModalUser(u);
                            }}
                            className="rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-white"
                            title={
                              isCurrent
                                ? "No puedes eliminarte a ti mismo"
                                : "Eliminar usuario permanentemente"
                            }
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Nuevo Usuario */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl md:p-8">
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-coodel-accent">
                  Gestión Sistemas
                </span>
                <h3 className="text-xl font-bold text-coodel-dark">Crear Nuevo Usuario</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-6 space-y-4">
              <Input
                label="Nombre de Usuario (Login)"
                type="text"
                value={nuevoUsuario}
                onChange={(e) => setNuevoUsuario(e.target.value.toLowerCase().trim())}
                placeholder="ej. asesor1"
                required
                helperText="Solo letras minúsculas, números, puntos o guiones."
              />

              <Input
                label="Nombre Completo"
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="ej. Carlos Pérez"
                required
              />

              <Input
                label="Contraseña Temporal"
                type="password"
                value={nuevoPassword}
                onChange={(e) => setNuevoPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-coodel-dark">
                  Rol de Usuario <span className="text-red-500">*</span>
                </label>
                <select
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value as RolUsuario)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-coodel-body focus:border-coodel-primary-light focus:outline-none focus:ring-2 focus:ring-coodel-primary-light/20"
                >
                  {USER_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} — {r.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="nuevo-activo"
                  checked={nuevoActivo}
                  onChange={(e) => setNuevoActivo(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-coodel-primary focus:ring-coodel-primary"
                />
                <label htmlFor="nuevo-activo" className="text-sm font-medium text-coodel-dark">
                  Usuario activo (puede iniciar sesión inmediatamente)
                </label>
              </div>

              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {createError}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={createLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" loading={createLoading}>
                  Guardar Usuario
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuario */}
      {editModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl md:p-8">
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-coodel-accent">
                  Editar Credenciales
                </span>
                <h3 className="text-xl font-bold text-coodel-dark">
                  Usuario @{editModalUser.usuario}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModalUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-6 space-y-4">
              <Input
                label="Nombre Completo"
                type="text"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-coodel-dark">
                  Rol del Usuario <span className="text-red-500">*</span>
                </label>
                <select
                  value={editRol}
                  onChange={(e) => setEditRol(e.target.value as RolUsuario)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-coodel-body focus:border-coodel-primary-light focus:outline-none focus:ring-2 focus:ring-coodel-primary-light/20"
                >
                  {USER_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} — {r.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <Input
                  label="Nueva Contraseña (Opcional)"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Dejar en blanco para mantener la actual"
                  helperText="Solo diligencie si desea restablecer la contraseña del usuario."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="edit-activo"
                  checked={editActivo}
                  disabled={currentUser?.id === editModalUser.id}
                  onChange={(e) => setEditActivo(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-coodel-primary focus:ring-coodel-primary"
                />
                <label htmlFor="edit-activo" className="text-sm font-medium text-coodel-dark">
                  Usuario activo (acceso permitido al panel)
                </label>
              </div>

              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {editError}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  disabled={editLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" loading={editLoading}>
                  Actualizar Usuario
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl md:p-8">
            <div className="flex items-center gap-3 text-red-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-gray-900">¿Eliminar usuario?</h3>
            </div>

            <p className="mt-3 text-sm text-gray-600">
              ¿Estás seguro de que deseas eliminar permanentemente al usuario{" "}
              <strong className="text-gray-900">@{deleteModalUser.usuario}</strong> ({deleteModalUser.nombre})?
              Esta acción no se puede deshacer.
            </p>

            {deleteError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => setDeleteModalUser(null)}
                disabled={deleteLoading}
              >
                Cancelar
              </Button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => void handleDeleteConfirm()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? "Eliminando..." : "Sí, eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
