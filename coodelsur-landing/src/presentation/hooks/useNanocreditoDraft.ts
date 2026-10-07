"use client";

/**
 * Borrador local del formulario en `localStorage` (recuperación al recargar)
 * y precarga de datos desde parámetros de URL / webhook (ej. Witme o campañas).
 *
 * Complementa `useNanocreditoServerDraft`: el local restaura campos al instante;
 * el servidor persiste leads incompletos visibles en el panel admin.
 */

import {
  clearNanocreditoDraft,
  hasMeaningfulDraftValues,
  loadNanocreditoDraft,
  saveNanocreditoDraft,
} from "@/presentation/forms/nanocredito-draft";
import { calcularDesgloseCuota } from "@/domain/credito/amortizacion";
import { normalizeDocumentNumber } from "@/domain/identity/cedula";
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
  const cuotasRaw = Number(values.cantidadCuotas);
  const plazo = Number.isFinite(cuotasRaw) && cuotasRaw > 0 ? cuotasRaw : 2;
  const desglose = calcularDesgloseCuota("microcredito_small", initialMonto, plazo);
  return {
    ...values,
    capitalSeleccionado: initialMonto,
    cantidadCuotas: plazo,
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

    // 1. Extraer parámetros de la URL si vienen de una redirección (ej. Witme o campañas)
    const searchParams =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;

    const urlDraftId =
      searchParams?.get("draftLeadId") ||
      searchParams?.get("leadId") ||
      searchParams?.get("draftId");

    if (urlDraftId && typeof window !== "undefined") {
      sessionStorage.setItem("coodelsur_server_draft_id", urlDraftId);
    }

    const urlValues: Partial<NanocreditoFormValues> = {};
    if (searchParams) {
      const nombre = searchParams.get("nombre") || searchParams.get("name");
      if (nombre?.trim()) urlValues.nombre = nombre.trim();

      const cedulaRaw = searchParams.get("cedula") || searchParams.get("documento");
      if (cedulaRaw?.trim()) {
        urlValues.cedula = normalizeDocumentNumber(cedulaRaw) || cedulaRaw.trim();
      }

      const telefono = searchParams.get("telefono") || searchParams.get("celular");
      if (telefono?.trim()) urlValues.telefono = telefono.trim();

      const email = searchParams.get("email") || searchParams.get("correo");
      if (email?.trim()) urlValues.email = email.trim();

      const montoRaw =
        searchParams.get("monto") ||
        searchParams.get("capitalSeleccionado") ||
        searchParams.get("capital_solicitado");
      if (montoRaw && !Number.isNaN(Number(montoRaw)) && Number(montoRaw) > 0) {
        urlValues.capitalSeleccionado = Number(montoRaw);
      }

      const cuotasRaw =
        searchParams.get("cuotas") ||
        searchParams.get("cantidadCuotas") ||
        searchParams.get("plazo");
      if (cuotasRaw && !Number.isNaN(Number(cuotasRaw)) && Number(cuotasRaw) > 0) {
        urlValues.cantidadCuotas = Number(cuotasRaw);
      } else if (urlValues.capitalSeleccionado) {
        urlValues.cantidadCuotas = 2;
      }

      const tipoDoc =
        searchParams.get("tipoIdentificacion") ||
        searchParams.get("tipoDocumento") ||
        searchParams.get("tipo_documento");
      if (tipoDoc?.trim()) {
        urlValues.tipoIdentificacion = tipoDoc.trim() as NanocreditoFormValues["tipoIdentificacion"];
      }

      const departamento = searchParams.get("departamento");
      if (departamento?.trim()) urlValues.departamento = departamento.trim();

      const municipio = searchParams.get("municipio") || searchParams.get("ciudad");
      if (municipio?.trim()) urlValues.municipio = municipio.trim();

      const direccion = searchParams.get("direccion");
      if (direccion?.trim()) urlValues.direccion = direccion.trim();

      const barrio = searchParams.get("barrio");
      if (barrio?.trim()) urlValues.barrio = barrio.trim();
    }

    const hasUrlData = Object.keys(urlValues).length > 0;
    const draft = loadNanocreditoDraft();

    if (urlDraftId || hasUrlData) {
      // Prioridad a los datos de la URL / Witme
      let merged = {
        ...baseValuesRef.current,
        ...(draft?.values ?? {}),
        ...urlValues,
      } as NanocreditoFormValues;

      const monto =
        urlValues.capitalSeleccionado ??
        initialMontoRef.current ??
        merged.capitalSeleccionado;

      if (typeof monto === "number" && Number.isFinite(monto) && monto > 0) {
        merged = applyInitialMontoToValues(merged, monto);
      }

      reset(merged);

      if (urlDraftId) {
        setDraftMessage(
          "Recuperamos tus datos iniciales para que completes los campos faltantes de tu crédito.",
        );

        // Consultar el borrador en el servidor para hidratar campos adicionales guardados por el webhook
        fetch(`/api/leads/draft?id=${encodeURIComponent(urlDraftId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.found && data.lead?.values && typeof data.lead.values === "object") {
              const serverValues = data.lead.values as Record<string, unknown>;
              const currentVals = getValues();
              let hasNewFields = false;
              const updated = { ...currentVals };

              for (const [key, val] of Object.entries(serverValues)) {
                if (
                  val !== undefined &&
                  val !== null &&
                  val !== "" &&
                  !key.startsWith("_") &&
                  key !== "payloadOriginal" &&
                  ((currentVals as Record<string, unknown>)[key] === undefined ||
                    (currentVals as Record<string, unknown>)[key] === "" ||
                    (currentVals as Record<string, unknown>)[key] === null)
                ) {
                  (updated as Record<string, unknown>)[key] = val;
                  hasNewFields = true;
                }
              }

              if (hasNewFields) {
                reset(updated as NanocreditoFormValues);
              }
            }
          })
          .catch((err) => {
            console.warn("[useNanocreditoDraft] Error cargando borrador del servidor:", err);
          });
      } else {
        setDraftMessage("Hemos precargado los datos de tu crédito. Completa los pasos faltantes.");
      }
    } else if (draft && hasMeaningfulDraftValues(draft.values)) {
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
    } else if (draft) {
      clearNanocreditoDraft();
    }

    hydratedRef.current = true;
  }, [enabled, reset, totalSteps, getValues]);

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
