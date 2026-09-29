import { FormularioPorTipo } from "@/presentation/components/forms/registry";
import { creditosConfig, getCreditoConfig, isTipoCredito } from "@/shared/config/creditos";
import type { TipoCredito } from "@/shared/types/credito";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface CreditoPageProps {
  params: { slug: string };
}

const SLUGS_LEGACY = ["nanocredito", "microcredito"] as const;

function resolveTipo(slug: string): TipoCredito | null {
  if (slug === "nanocredito") return "microcredito_small";
  if (slug === "microcredito") return "libranza";
  if (isTipoCredito(slug)) return slug;
  return null;
}

export function generateStaticParams() {
  const tipos = Object.keys(creditosConfig) as TipoCredito[];
  return [...tipos, ...SLUGS_LEGACY].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: CreditoPageProps): Promise<Metadata> {
  const config = getCreditoConfig(params.slug);
  if (!config) return { title: "Crédito no encontrado" };
  return {
    title: `Solicitar ${config.nombre}`,
    description: config.descripcionCorta,
  };
}

export default function CreditoPage({ params }: CreditoPageProps) {
  const tipo = resolveTipo(params.slug);
  if (!tipo) notFound();

  const config = getCreditoConfig(params.slug);
  if (!config) notFound();

  return (
    <div className="min-h-screen bg-coodel-surface">
      <div className="border-b border-coodel-primary/10 bg-coodel-primary text-white">
        <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
          <nav className="mb-5 text-sm text-white/60" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">
              Inicio
            </Link>
            <span className="mx-2">/</span>
            <Link href="/#solicitar" className="hover:text-white">
              Solicitar
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white/90">{config.nombre}</span>
          </nav>

          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-coodel-gold">
            Coodelsur
          </p>
          <h1 className="text-2xl font-bold md:text-3xl">Solicitud de {config.nombre}</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/75 md:text-base">{config.descripcion}</p>
          <p className="mt-3 text-sm text-white/55">
            Completa el formulario paso a paso. En celular te tomará unos minutos.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
        <FormularioPorTipo tipo={tipo} config={config} />
      </div>
    </div>
  );
}
