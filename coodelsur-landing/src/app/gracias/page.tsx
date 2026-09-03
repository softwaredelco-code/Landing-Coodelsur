import { Button } from "@/presentation/components/ui/Button";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solicitud enviada",
  robots: { index: false },
};

export default function GraciasPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-coodel-surface px-4 py-16">
      <div className="max-w-lg border border-gray-200 bg-white p-8 text-center shadow-sm md:p-12">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-coodel-accent/10 text-coodel-accent">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-3 text-2xl font-bold text-coodel-dark md:text-3xl">
          ¡Solicitud recibida!
        </h1>
        <p className="mb-8 text-coodel-body">
          Hemos recibido tu solicitud de crédito. Un asesor de Coodelsur se comunicará contigo
          pronto para continuar con el proceso.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/">
            <Button variant="primary">Volver a formularios</Button>
          </Link>
          <Link href="/#contacto">
            <Button variant="outline">Contacto</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
