"use client";

import type { ParametrosAmortizacion } from "@/config/creditos/amortizacion";
import { getDefaultParametrosAmortizacion } from "@/config/creditos/amortizacion";
import { setClientParametrosOverrides } from "@/lib/credito/parametros-store";
import type { TipoCredito } from "@/types/credito";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface ParametrosAmortizacionContextValue {
  ready: boolean;
  getParametros: (tipo: TipoCredito) => ParametrosAmortizacion;
}

const ParametrosAmortizacionContext = createContext<ParametrosAmortizacionContextValue>({
  ready: false,
  getParametros: getDefaultParametrosAmortizacion,
});

export function ParametrosAmortizacionProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Partial<Record<TipoCredito, ParametrosAmortizacion>>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/creditos/parametros");
        if (!res.ok) return;
        const data = (await res.json()) as {
          parametros?: Partial<Record<TipoCredito, ParametrosAmortizacion>>;
        };
        if (cancelled || !data.parametros) return;
        setOverrides(data.parametros);
        setClientParametrosOverrides(data.parametros);
      } catch {
        // Defaults del código siguen activos.
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      ready: true,
      getParametros: (tipo: TipoCredito) =>
        overrides[tipo] ?? getDefaultParametrosAmortizacion(tipo),
    }),
    [overrides],
  );

  return (
    <ParametrosAmortizacionContext.Provider value={value}>
      {children}
    </ParametrosAmortizacionContext.Provider>
  );
}

export function useParametrosAmortizacion(tipo: TipoCredito) {
  return useContext(ParametrosAmortizacionContext).getParametros(tipo);
}

export function useParametrosAmortizacionReady() {
  return useContext(ParametrosAmortizacionContext).ready;
}
