import { ContactSection } from "@/components/landing/ContactSection";
import { SolicitudUnificada } from "@/components/solicitud/SolicitudUnificada";

/**
 * Entrada pública: el usuario llega y empieza por el monto.
 * No elige “producto”; el sistema lo deduce.
 */
export default function HomePage() {
  return (
    <>
      <SolicitudUnificada />
      <ContactSection />
    </>
  );
}
