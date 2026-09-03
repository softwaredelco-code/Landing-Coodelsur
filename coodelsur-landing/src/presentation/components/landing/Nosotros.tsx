import Image from "next/image";

const LINEAS = ["Nanocrédito", "Microcrédito", "Consumo", "Libranza"];

export function Nosotros() {
  return (
    <section id="nosotros" className="bg-white py-16 md:py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 md:grid-cols-2 md:px-6">
        <div className="animate-rise">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-coodel-accent">
            Nosotros
          </p>
          <h2 className="mb-6 text-3xl font-bold text-coodel-dark md:text-4xl">
            Financiamos tus mejores ideas para tu futuro
          </h2>
          <p className="mb-4 leading-relaxed text-coodel-body">
            Coodelsur es una empresa líder en el sector financiero, comprometida con el
            desarrollo económico y la inclusión financiera de todos los ciudadanos. Nos
            especializamos en ofrecer soluciones de crédito innovadoras y adaptadas a las
            necesidades específicas de cada cliente, abarcando las líneas de Consumo,
            Microcrédito y Comercial.
          </p>
          <p className="leading-relaxed text-coodel-body">
            Con un equipo de profesionales altamente capacitados y un enfoque centrado en la
            responsabilidad social, Coodelsur se posiciona como el aliado estratégico para
            quienes buscan soluciones financieras confiables, transparentes y accesibles.
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-3 text-sm font-medium text-coodel-primary-light">
            {LINEAS.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coodel-accent/15 text-coodel-accent"
                  aria-hidden
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden bg-coodel-primary">
          <Image
            src="/images/nosotros-person.png"
            alt="Clientes Coodelsur"
            fill
            className="object-contain object-bottom"
            sizes="(max-width: 768px) 100vw, 28rem"
          />
        </div>
      </div>

      <blockquote className="mx-auto mt-14 max-w-3xl border-l-4 border-coodel-accent px-4 py-2 text-center italic text-coodel-muted md:px-6 md:text-left">
        «Nuestros clientes confían en la excelencia de nuestros productos. Ofrecemos servicios
        financieros confiables y soluciones centradas en el cliente, respaldados por un legado
        de confiabilidad financiera.»
      </blockquote>
    </section>
  );
}
