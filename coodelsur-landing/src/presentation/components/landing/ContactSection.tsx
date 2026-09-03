import { Button } from "@/presentation/components/ui/Button";
import { siteConfig, whatsappUrl } from "@/shared/config/site";

export function ContactSection() {
  return (
    <section id="contacto" className="bg-coodel-primary py-14 text-white md:py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-coodel-gold">
              Contacto
            </p>
            <h2 className="mb-4 text-2xl font-bold md:text-3xl">¿Necesitas ayuda?</h2>
            <p className="mb-6 max-w-md text-white/80">
              Escríbenos por WhatsApp o comunícate con nosotros. Un asesor de Coodelsur te
              orientará.
            </p>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button
                variant="primary"
                size="lg"
                className="bg-coodel-accent-light hover:bg-coodel-accent"
              >
                Escribir por WhatsApp
              </Button>
            </a>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                Teléfono
              </h3>
              <a href={`tel:+57${siteConfig.contact.phone}`} className="text-lg hover:underline">
                {siteConfig.contact.phone}
              </a>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                Correo
              </h3>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="break-all text-lg hover:underline"
              >
                {siteConfig.contact.email}
              </a>
            </div>
            {siteConfig.sedes.map((sede) => (
              <div key={sede.nombre}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                  {sede.nombre}
                </h3>
                <ul className="space-y-1 text-sm text-white/85">
                  {sede.direccion.map((linea) => (
                    <li key={linea}>{linea}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
