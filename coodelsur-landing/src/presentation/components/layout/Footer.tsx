"use client";

import { Logo } from "@/presentation/components/ui/Logo";
import { siteConfig, whatsappUrl } from "@/shared/config/site";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="border-t border-white/10 bg-coodel-primary text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-center md:flex-row md:px-6 md:text-left">
        <div className="flex flex-col items-center gap-3 md:flex-row md:gap-6">
          <Logo variant="light" />
          <div className="text-sm text-white/70">
            <a href={`tel:+57${siteConfig.contact.phone}`} className="hover:text-white">
              {siteConfig.contact.phone}
            </a>
            <span className="mx-2 hidden md:inline">·</span>
            <br className="md:hidden" />
            <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-white">
              {siteConfig.contact.email}
            </a>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 text-xs text-white/55 md:items-end">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-coodel-accent-light"
          >
            WhatsApp
          </a>
          <p>© {new Date().getFullYear()} Coodelsur SAS</p>
          <Link href="/#solicitar" className="hover:text-white">
            Solicitar
          </Link>
        </div>
      </div>
    </footer>
  );
}
