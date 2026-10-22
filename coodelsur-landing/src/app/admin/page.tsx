"use client";

import { Button } from "@/presentation/components/ui/Button";
import { Input } from "@/presentation/components/ui/Input";
import { Logo } from "@/presentation/components/ui/Logo";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: usuario.trim(),
          password,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        user?: { rol?: string };
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo iniciar sesión. Verifique sus credenciales.");
      }

      // Redirigir según rol o directamente a solicitudes
      router.replace("/admin/leads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de acceso al sistema");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-coodel-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" />
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm md:p-10"
        >
          <div className="mb-6 text-center">
            <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-coodel-accent">
              Panel Administrativo
            </span>
            <h1 className="mt-2 text-2xl font-bold text-coodel-dark">Iniciar Sesión</h1>
            <p className="mt-1 text-sm text-gray-500">
              Ingrese su usuario y contraseña autorizados
            </p>
          </div>

          <div className="space-y-4">
            <Input
              label="Usuario"
              type="text"
              name="usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="ej. sistemas"
              required
              autoFocus
              autoComplete="username"
              disabled={loading}
            />

            <div className="relative">
              <Input
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-[38px] text-xs font-medium text-gray-400 hover:text-gray-700"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              <span className="shrink-0 text-base">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="mt-6 w-full" loading={loading}>
            Ingresar al panel
          </Button>

          <p className="mt-6 text-center text-xs text-gray-400">
            Coodelsur SAS &bull; Acceso restringido a personal autorizado
          </p>
        </form>
      </div>
    </div>
  );
}
