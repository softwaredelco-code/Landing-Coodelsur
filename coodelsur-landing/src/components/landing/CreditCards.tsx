import { Button } from "@/components/ui/Button";
import { creditosList } from "@/config/creditos";
import Link from "next/link";

export function CreditCards() {
  return (
    <section id="formularios" className="bg-coodel-surface py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-10 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-coodel-accent">
            Solicitudes
          </p>
          <h1 className="text-3xl font-bold text-coodel-dark md:text-4xl">Formularios de crédito</h1>
          <p className="mt-3 text-coodel-body">
            Elige el tipo de crédito que deseas solicitar y completa el formulario.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {creditosList.map((credito, index) => (
            <article
              key={credito.slug}
              className={`relative flex flex-col border bg-white p-6 transition-shadow ${
                credito.disponible
                  ? "border-coodel-accent/40 shadow-sm hover:shadow-md"
                  : "border-gray-200 opacity-80"
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold tracking-wider text-coodel-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    credito.disponible ? "text-coodel-accent" : "text-gray-400"
                  }`}
                >
                  {credito.disponible ? "Disponible" : "Próximamente"}
                </span>
              </div>
              <h2 className="mb-2 text-xl font-bold text-coodel-dark">{credito.nombre}</h2>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-coodel-body">
                {credito.descripcionCorta}
              </p>
              {credito.disponible ? (
                <Link href={`/credito/${credito.slug}`}>
                  <Button variant="primary" className="w-full">
                    Solicitar
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  Próximamente
                </Button>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
