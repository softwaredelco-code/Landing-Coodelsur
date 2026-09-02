"use client";

import { Button } from "@/components/ui/Button";
import Image from "next/image";
import Link from "next/link";

const PILARES = [
  "Crédito accesible",
  "Proceso en línea",
  "Asesoría personalizada",
] as const;

export function CoodelsurIntro() {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-coodel-primary text-white"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 55% at 85% 20%, rgba(45,183,66,0.22), transparent 60%), radial-gradient(ellipse 45% 40% at 10% 90%, rgba(255,188,125,0.14), transparent 55%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 py-8 text-center md:px-6 md:py-10">
        <div className="animate-rise">
          <Image
            src="/images/logo-blanco.png"
            alt="Coodelsur"
            width={320}
            height={100}
            priority
            className="mx-auto h-20 w-auto object-contain md:h-28 lg:h-32"
          />

          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.22em] text-coodel-gold">
            Coodelsur SAS
          </p>

          <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl lg:text-[2.75rem]">
            Tu aliado en soluciones de crédito
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
            Somos una entidad financiera colombiana que impulsa emprendedores, familias y
            pequeños negocios con productos claros, cercanos y confiables.
          </p>

          <ul className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {PILARES.map((item) => (
              <li
                key={item}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Link href="/#solicitar">
              <Button
                size="lg"
                className="min-w-[220px] bg-coodel-accent-light hover:bg-coodel-accent"
              >
                Solicitar crédito
              </Button>
            </Link>
            <Link
              href="/#solicitar"
              className="inline-flex flex-col items-center gap-1 text-white/55 transition-colors hover:text-white/75"
              aria-label="Ir al formulario de solicitud"
            >
              <span className="text-sm">Desplázate para iniciar tu solicitud</span>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="animate-bounce"
                aria-hidden
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
