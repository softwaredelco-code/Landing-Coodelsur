"use client";

import { Logo } from "@/components/ui/Logo";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <Logo />

        <div className="hidden items-center gap-6 md:flex">
          <nav className="flex items-center gap-8" aria-label="Navegación principal">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm font-semibold uppercase tracking-wide text-coodel-body transition-colors hover:text-coodel-primary-light"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {!isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg border border-coodel-primary/20 bg-coodel-primary/[0.06] px-4 py-2 text-sm font-semibold text-coodel-primary transition-colors hover:bg-coodel-primary hover:text-white"
            >
              Login
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {!isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg border border-coodel-primary/20 px-3 py-1.5 text-xs font-semibold text-coodel-primary"
            >
              Login
            </Link>
          )}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileOpen}
          >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-coodel-primary"
            aria-hidden
          >
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
          </button>
        </div>
      </div>

      <div className={cn("border-t border-gray-100 bg-white md:hidden", !mobileOpen && "hidden")}>
        <nav className="flex flex-col px-4 py-3" aria-label="Navegación móvil">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="py-3 text-sm font-semibold uppercase text-coodel-body"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {!isAdmin && (
            <Link
              href="/admin"
              className="mt-1 rounded-lg border border-coodel-primary/20 bg-coodel-primary/[0.06] py-3 text-center text-sm font-semibold text-coodel-primary"
              onClick={() => setMobileOpen(false)}
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
