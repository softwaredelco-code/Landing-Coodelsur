import { Button } from "@/components/ui/Button";
import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section
      id="inicio"
      className="relative min-h-[88vh] overflow-hidden bg-coodel-primary text-white md:min-h-[92vh]"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 70% 40%, rgba(45,183,66,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 15% 80%, rgba(255,188,125,0.12), transparent 50%)",
        }}
      />
      <div className="absolute inset-y-0 right-0 hidden w-[52%] md:block">
        <Image
          src="/images/hero-person.png"
          alt="Asesoría financiera Coodelsur"
          fill
          priority
          className="object-contain object-bottom animate-fade-in"
          sizes="52vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-coodel-primary via-coodel-primary/40 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-4 py-16 md:min-h-[92vh] md:px-6 md:py-24">
        <div className="max-w-xl animate-rise">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-coodel-gold">
            Coodelsur
          </p>
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-white/70">
            La mejor opción
          </p>
          <h1 className="mb-5 text-4xl font-bold leading-[1.1] md:text-5xl lg:text-6xl">
            LOS MEJORES{" "}
            <span className="block text-coodel-accent-light">Créditos</span>
          </h1>
          <p className="mb-8 max-w-md text-base text-white/80 md:text-lg">
            Impulsando pequeños negocios con préstamos de bajo interés para PYMES y
            emprendedores.
          </p>
          <Link href="/#creditos">
            <Button size="lg" className="bg-coodel-accent-light hover:bg-coodel-accent">
              Quiero mi crédito
            </Button>
          </Link>
        </div>

        <div className="relative mt-10 h-72 w-full md:hidden">
          <Image
            src="/images/hero-person.png"
            alt="Asesoría financiera Coodelsur"
            fill
            priority
            className="object-contain object-bottom"
            sizes="100vw"
          />
        </div>
      </div>
    </section>
  );
}
