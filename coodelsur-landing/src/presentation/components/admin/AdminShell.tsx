"use client";

import { Button } from "@/presentation/components/ui/Button";
import { Logo } from "@/presentation/components/ui/Logo";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

export interface CurrentUser {
  id: string;
  usuario: string;
  nombre: string;
  rol: "sistemas" | "administrador" | "asesor";
}

interface AdminShellProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  userRole?: string;
}

export function AdminShell({
  title,
  subtitle,
  backHref,
  backLabel = "Volver",
  actions,
  children,
}: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/admin/login", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.authenticated && data?.user) {
          setCurrentUser(data.user);
        } else {
          router.replace("/admin");
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [router]);

  const logout = async () => {
    await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.replace("/admin");
  };

  const navItems = [
    { href: "/admin/leads", label: "Solicitudes", shortLabel: "Solicitudes" },
    { href: "/admin/parametros", label: "Tasas y parámetros", shortLabel: "Tasas" },
    ...(currentUser?.rol === "sistemas"
      ? [{ href: "/admin/usuarios", label: "Control de Usuarios", shortLabel: "Usuarios" }]
      : []),
  ];

  const getRoleBadgeClass = (rol?: string) => {
    switch (rol) {
      case "sistemas":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "administrador":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  return (
    <div className="min-h-screen bg-coodel-surface">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <Logo size="md" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-coodel-accent">
                Panel administración
              </p>
              <p className="truncate text-sm font-medium text-gray-500">Coodelsur SAS</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <nav
              className="inline-flex rounded-xl bg-coodel-surface p-1 ring-1 ring-inset ring-gray-200"
              aria-label="Secciones del panel admin"
            >
              {navItems.map((item) => {
                const active =
                  pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-coodel-primary text-white shadow-sm"
                        : "text-coodel-primary hover:bg-white/80"
                    }`}
                  >
                    <span className="sm:hidden">{item.shortLabel}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {currentUser && (
              <div className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 text-xs sm:flex">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coodel-primary text-[10px] font-bold text-white">
                  {currentUser.nombre ? currentUser.nombre.charAt(0).toUpperCase() : "U"}
                </span>
                <span className="max-w-[130px] truncate font-medium text-coodel-dark">
                  {currentUser.nombre || currentUser.usuario}
                </span>
                <span
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getRoleBadgeClass(
                    currentUser.rol,
                  )}`}
                >
                  {currentUser.rol}
                </span>
              </div>
            )}

            <Button variant="outline" size="sm" type="button" onClick={() => void logout()}>
              Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 md:flex-row md:items-end md:justify-between md:px-6">
          <div className="min-w-0">
            {backHref && (
              <Link
                href={backHref}
                className="mb-1 inline-flex text-xs font-semibold text-coodel-primary-light hover:underline"
              >
                ← {backLabel}
              </Link>
            )}
            <h1 className="truncate text-xl font-bold text-coodel-dark md:text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</div>
    </div>
  );
}
