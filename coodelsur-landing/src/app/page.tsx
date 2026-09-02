import { CoodelsurIntro } from "@/components/landing/CoodelsurIntro";
import { ContactSection } from "@/components/landing/ContactSection";
import { SolicitudUnificada } from "@/components/solicitud/SolicitudUnificada";

/**
 * Entrada pública: presentación de Coodelsur y flujo de solicitud por monto.
 */
export default function HomePage() {
  return (
    <>
      <CoodelsurIntro />
      <SolicitudUnificada />
      <ContactSection />
    </>
  );
}
