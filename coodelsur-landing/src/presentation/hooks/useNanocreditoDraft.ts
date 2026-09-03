"use client";

/**
 * Borrador local del formulario en `localStorage` (recuperación al recargar).
 *
 * Complementa `useNanocreditoServerDraft`: el local restaura campos al instante;
 * el servidor persiste leads incompletos visibles en el panel admin.
 */

import {
  clearNanocreditoDraft,
  loadNanocreditoDraft,
  saveNanocreditoDraft,
} from "@/presentation/forms/nanocredito-draft";
import { calcularDesgloseCuota } from "@/domain/credito/amortizacion";
import type { NanocreditoFormValues } from "@/shared/validation/nanocredito";
import { useEffect, useRef, useState } from "react";
import type { UseFormGetValues, UseFormReset, UseFormWatch } from "react-hook-form";

const SAVE_DEBOUNCE_MS = 700;

interface UseNanocreditoDraftOptions {
  watch: UseFormWatch<NanocreditoFormValues>;
  getValues: UseFormGetValues<NanocreditoFormValues>;
  reset: UseFormReset<NanocreditoFormValues>;
  baseValues: NanocreditoFormValues;
  totalSteps: number;
  enabled: boolean;
  /** Monto del selector unificado; prevalece sobre borrador local en `capitalSeleccionado`. */
  initialMonto?: number;
}

function applyInitialMontoToValues(
  values: NanocreditoFormValues,
  initialMonto: number,
): NanocreditoFormValues {
  const plazo = Number(values.cantidadCuotas || 2);
  const desglose = calcularDesgloseCuota("microcredito_small", initialMonto, plazo);
  return {
    ...values,
    capitalSeleccionado: initialMonto,
    valorCuota: desglose.valorCuotaTotal,
    valorCreditoFinanciado: desglose.valorCreditoFinanciado,
    estudioCredito: desglose.estudioCredito,
    cuotaCapitalInteres: desglose.cuotaCapitalInteres,
    cuotaFianzaMensual: desglose.fianzaMensual,
    cuotaVidaDeudoresMensual: desglose.vidaDeudoresMensual,
  };
}

export function useNanocreditoDraft({
  watch,
  getValues,
  reset,
  baseValues,
  totalSteps,
  enabled,
  initialMonto,
}: UseNanocreditoDraftOptions) {
  const hydratedRef = useRef(false);
  const restoredRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseValuesRef = useRef(baseValues);
  baseValuesRef.current = baseValues;
  const initialMontoRef = useRef(initialMonto);
  initialMontoRef.current = initialMonto;
  const [step, setStep] = useState(0);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      hydratedRef.current = true;
      return;
    }

    if (restoredRef.current) return;
    restoredRef.current = true;

    const draft = loadNanocreditoDraft();
    if (draft) {
      let merged = {
        ...baseValuesRef.current,
        ...draft.values,
      } as NanocreditoFormValues;

      const monto = initialMontoRef.current;
      if (typeof monto === "number" && Number.isFinite(monto)) {
        merged = applyInitialMontoToValues(merged, monto);
      }

      reset(merged);
      setStep(Math.min(Math.max(0, draft.step ?? 0), totalSteps - 1));
      setDraftMessage(
        draft.partial
          ? "Recuperamos tu solicitud en progreso. Si tenías fotos o video, vuelve a cargarlos en Verificación."
          : "Continúas donde lo dejaste. Recuperamos tu solicitud en progreso.",
      );
    }

    hydratedRef.current = true;
  }, [enabled, reset, totalSteps]);

  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;

    const persist = () => saveNanocreditoDraft(step, getValues());

    persist();

    const subscription = watch(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(persist, SAVE_DEBOUNCE_MS);
    });

    const onPageHide = () => persist();
    window.addEventListener("pagehide", onPageHide);

    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [enabled, getValues, step, watch]);

  const dismissDraftMessage = () => setDraftMessage(null);

  return {
    step,
    setStep,
    draftMessage,
    dismissDraftMessage,
    clearDraft: clearNanocreditoDraft,
  };
}
