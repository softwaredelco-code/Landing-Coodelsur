import { CoodelsurIntro } from "@/presentation/components/landing/CoodelsurIntro";
import { ContactSection } from "@/presentation/components/landing/ContactSection";
import { SolicitudUnificada } from "@/presentation/components/solicitud/SolicitudUnificada";

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
