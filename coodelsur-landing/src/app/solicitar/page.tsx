import { ContactSection } from "@/presentation/components/landing/ContactSection";
import { SolicitudUnificada } from "@/presentation/components/solicitud/SolicitudUnificada";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solicitar crédito",
  description:
    "Indica el monto que necesitas. Coodelsur detecta el tipo de crédito y te guía en el formulario.",
};

interface SolicitarPageProps {
  searchParams: { monto?: string };
}

/**
 * Ruta dedicada para campañas / redirecciones:
 * `/solicitar?monto=500000` precarga el selector.
 */
export default function SolicitarPage({ searchParams }: SolicitarPageProps) {
  const raw = Number(searchParams.monto);
  const initialMonto = Number.isFinite(raw) && raw > 0 ? raw : undefined;

  return (
    <>
      <SolicitudUnificada initialMonto={initialMonto} />
      <ContactSection />
    </>
  );
}
