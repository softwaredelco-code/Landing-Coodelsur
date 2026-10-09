"use client";

/** Formulario multi-paso Microcrédito urbano (8 pasos, Zod + reglas cruzadas). */

import { ConfirmacionSolicitud } from "@/presentation/components/forms/ConfirmacionSolicitud";
import { FormSection } from "@/presentation/components/forms/FormSection";
import { SeccionActivos } from "@/presentation/components/forms/microcredito-urbano/sections/SeccionActivos";
import { SeccionDatosBancarios } from "@/presentation/components/forms/microcredito-urbano/sections/SeccionDatosBancarios";
import { SeccionDatosCredito } from "@/presentation/components/forms/microcredito-urbano/sections/SeccionDatosCredito";
import { SeccionDatosGenerales } from "@/presentation/components/forms/microcredito-urbano/sections/SeccionDatosGenerales";
import { SeccionDomicilio } from "@/presentation/components/forms/microcredito-urbano/sections/SeccionDomicilio";
import { SeccionLaboral } from "@/presentation/components/forms/microcredito-urbano/sections/SeccionLaboral";
import { SeccionReferenciaFamiliar } from "@/presentation/components/forms/microcredito-urbano/sections/SeccionReferenciaFamiliar";
import { SeccionVerificacion } from "@/presentation/components/forms/microcredito-urbano/sections/SeccionVerificacion";
import type { CreditoFormProps } from "@/presentation/components/forms/types";
import { Button } from "@/presentation/components/ui/Button";
import { ParametrosAmortizacionProvider } from "@/presentation/contexts/ParametrosAmortizacionContext";
import { useMicrocreditoUrbanoDraft } from "@/presentation/hooks/useMicrocreditoUrbanoDraft";
import {
  clearMicrocreditoUrbanoServerDraftId,
  getMicrocreditoUrbanoServerDraftId,
  restoreMicrocreditoUrbanoServerDraftId,
  resumeMicrocreditoUrbanoServerDraftSync,
  stopMicrocreditoUrbanoServerDraftSync,
  syncMicrocreditoUrbanoDraftToServer,
  useMicrocreditoUrbanoServerDraft,
} from "@/presentation/hooks/useMicrocreditoUrbanoServerDraft";
import { calcularDesgloseCuota } from "@/domain/credito/amortizacion";
import { getParametrosAmortizacion } from "@/shared/config/creditos/amortizacion";
import {
  MICROCREDITO_URBANO_STEPS,
  collectMicrocreditoUrbanoStepCrossFieldErrors,
  microcreditoUrbanoDefaultValues,
  microcreditoUrbanoSchema,
  sanitizeMicrocreditoUrbanoForLog,
  type MicrocreditoUrbanoFormValues,
} from "@/shared/validation/microcredito-urbano/schema";
import { deserializeUtm } from "@/presentation/tracking/utm";
import { getUtmFromCookie } from "@/presentation/tracking/TrackingProvider";
import { trackEvent } from "@/presentation/tracking/analytics";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { FormProvider, useForm, type FieldErrors, type Path } from "react-hook-form";

const STEP_COMPONENTS = [
  SeccionDatosGenerales,
  SeccionDatosCredito,
  SeccionDomicilio,
  SeccionActivos,
  SeccionLaboral,
  SeccionReferenciaFamiliar,
  SeccionDatosBancarios,
  SeccionVerificacion,
];

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function focusAndHighlightField(fieldName?: string) {
  if (!fieldName || typeof document === "undefined") return;
  const root = fieldName.split(".")[0];

  setTimeout(() => {
    const el =
      document.getElementById(root) ||
      document.getElementById(`${root}-container`) ||
      document.getElementById(`${root}-upload`) ||
      document.getElementById(`${root}-file`) ||
      document.querySelector(`[name="${root}"]`) ||
      document.getElementById(`${root}-error`);

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if ("focus" in el && typeof (el as HTMLElement).focus === "function") {
        (el as HTMLElement).focus();
      }
      el.classList.add("ring-4", "ring-red-400", "ring-offset-2", "transition-all");
      setTimeout(() => {
        el.classList.remove("ring-4", "ring-red-400", "ring-offset-2");
      }, 4000);
    }
  }, 120);
}

export function FormularioMicrocreditoUrbano(props: CreditoFormProps) {
  return (
    <ParametrosAmortizacionProvider>
      <FormularioMicrocreditoUrbanoInner {...props} />
    </ParametrosAmortizacionProvider>
  );
}

function FormularioMicrocreditoUrbanoInner({ config, initialMonto }: CreditoFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [resumen, setResumen] = useState<MicrocreditoUrbanoFormValues | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo(() => {
    const base = {
      ...microcreditoUrbanoDefaultValues,
      tipoCredito: "microcredito_urbano" as const,
    } as MicrocreditoUrbanoFormValues;

    if (typeof initialMonto === "number" && Number.isFinite(initialMonto)) {
      const plazo = Number(microcreditoUrbanoDefaultValues.cantidadCuotas || 6);
      const desglose = calcularDesgloseCuota("microcredito_urbano", initialMonto, plazo);
      return {
        ...base,
        capitalSeleccionado: initialMonto,
        valorCuota: desglose.valorCuotaTotal,
        valorCreditoFinanciado: desglose.valorCreditoFinanciado,
        estudioCredito: desglose.estudioCredito,
        cuotaCapitalInteres: desglose.cuotaCapitalInteres,
        cuotaFianzaMensual: desglose.fianzaMensual,
        cuotaVidaDeudoresMensual: desglose.vidaDeudoresMensual,
      };
    }

    return base;
  }, [initialMonto]);

  const methods = useForm<MicrocreditoUrbanoFormValues>({
    resolver: zodResolver(microcreditoUrbanoSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { handleSubmit, trigger, reset, watch, getValues, setError, setValue } = methods;
  const totalSteps = MICROCREDITO_URBANO_STEPS.length;

  const {
    step,
    setStep,
    draftMessage,
    dismissDraftMessage,
    clearDraft,
  } = useMicrocreditoUrbanoDraft({
    watch,
    getValues,
    reset,
    baseValues: defaultValues,
    totalSteps,
    enabled: !submitted,
    initialMonto,
  });

  useMicrocreditoUrbanoServerDraft({
    watch,
    getValues,
    step,
    enabled: !submitted,
  });
  const current = MICROCREDITO_URBANO_STEPS[step];
  const StepFields = STEP_COMPONENTS[step];
  const progress = ((step + 1) / totalSteps) * 100;

  if (!current || !StepFields) {
    return null;
  }

  const goNext = async () => {
    if (current.id === "credito") {
      const values = getValues();
      const capital = Number(values.capitalSeleccionado);
      const cuotas = Number(values.cantidadCuotas);
      if (capital > 0 && cuotas > 0) {
        const parametros = getParametrosAmortizacion(values.tipoCredito);
        const desglose = calcularDesgloseCuota(values.tipoCredito, capital, cuotas, parametros);
        setValue("valorCuota", desglose.valorCuotaTotal, { shouldValidate: true });
        setValue("valorCreditoFinanciado", desglose.valorCreditoFinanciado);
        setValue("estudioCredito", desglose.estudioCredito);
        setValue("cuotaCapitalInteres", desglose.cuotaCapitalInteres);
        setValue("cuotaFianzaMensual", desglose.fianzaMensual);
        setValue("cuotaVidaDeudoresMensual", desglose.vidaDeudoresMensual);
      }
    }

    const fields = [...current.fields] as Path<MicrocreditoUrbanoFormValues>[];
    const valid = await trigger(fields, { shouldFocus: true });

    const crossFieldErrors = collectMicrocreditoUrbanoStepCrossFieldErrors(current.id, getValues());
    for (const error of crossFieldErrors) {
      setError(error.path, { type: "manual", message: error.message });
    }

    if (!valid || crossFieldErrors.length > 0) {
      const formErrors = methods.formState.errors as Record<string, any>;
      const fieldsWithErrors = fields.filter((f) => {
        const root = String(f).split(".")[0];
        return Boolean(formErrors[root] || formErrors[String(f)]);
      });

      const firstErrorField = String(fieldsWithErrors[0] || (crossFieldErrors[0]?.path as string) || fields[0]);
      focusAndHighlightField(firstErrorField);

      const bulletItems = fieldsWithErrors.map((key) => {
        const root = String(key).split(".")[0];
        const errObj = formErrors[root] || formErrors[String(key)];
        const msg =
          (errObj && typeof errObj.message === "string" && errObj.message) ||
          "Por favor completa o selecciona este campo";
        return `• ${String(root)}: ${msg}`;
      });

      if (crossFieldErrors.length > 0) {
        for (const cErr of crossFieldErrors) {
          bulletItems.push(`• ${String(cErr.path)}: ${cErr.message}`);
        }
      }

      const summaryText =
        bulletItems.length > 0
          ? `Por favor completa o corrige los siguientes campos señalados en rojo para continuar:\n${bulletItems.slice(0, 5).join("\n")}`
          : "Hay campos obligatorios incompletos en este paso. Revisa los campos resaltados en rojo.";

      setSubmitError(summaryText);
      return;
    }

    setSubmitError(null);
    const nextStep = Math.min(step + 1, totalSteps - 1);
    setStep(nextStep);
    trackEvent("form_step", {
      step_number: nextStep + 1,
      step_name: MICROCREDITO_URBANO_STEPS[nextStep]?.id ?? "unknown",
      tipo_credito: getValues("tipoCredito"),
    });
    void syncMicrocreditoUrbanoDraftToServer(nextStep, getValues);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onInvalid = (formErrors: FieldErrors<MicrocreditoUrbanoFormValues>) => {
    const firstInvalid = MICROCREDITO_URBANO_STEPS.findIndex((s) =>
      s.fields.some((field) => formErrors[field as keyof MicrocreditoUrbanoFormValues]),
    );
    if (firstInvalid >= 0) {
      setStep(firstInvalid);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (data: MicrocreditoUrbanoFormValues) => {
    setSubmitError(null);
    setSubmitting(true);

    // Capturar el id del borrador y cortar syncs en cola para no crear otro lead incompleto.
    const draftLeadId = getMicrocreditoUrbanoServerDraftId() ?? undefined;
    stopMicrocreditoUrbanoServerDraftSync();

    try {
      if (isDemoMode) {
        console.log(
          "[Coodelsur] DEMO_MODE — solicitud no enviada al backend:",
          sanitizeMicrocreditoUrbanoForLog(data),
        );
        setResumen(data);
        setLeadId(null);
        setSubmitted(true);
        clearDraft();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const utm = deserializeUtm(getUtmFromCookie() ?? undefined) ?? undefined;

      // El video real siempre viaja en el envío final: el borrador del servidor solo
      // conserva metadatos, por lo que nunca se debe sustituir por una referencia liviana.
      const cleanData: any = { ...data };

      const payload = {
        ...cleanData,
        utm,
        draftLeadId,
        geoCliente: data.geolocalizacion
          ? { lat: data.geolocalizacion.lat, lng: data.geolocalizacion.lng }
          : undefined,
      };

      let response: Response | null = null;
      let retriesLeft = 2;
      while (retriesLeft >= 0) {
        try {
          response = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (response.status === 502 || response.status === 503 || response.status === 504) {
            if (retriesLeft > 0) {
              retriesLeft--;
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
          }
          break;
        } catch (fetchErr) {
          if (retriesLeft > 0) {
            retriesLeft--;
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          throw fetchErr;
        }
      }

      if (!response) {
        throw new Error("No se pudo conectar con el servidor. Intenta de nuevo.");
      }

      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        id?: string;
        error?: string;
        details?: unknown;
      };

      if (!response.ok || !result.success) {
        if (response.status === 503 || response.status === 502 || response.status === 504) {
          throw new Error(
            "El servidor está procesando solicitudes en este momento. Tus datos se encuentran seguros y guardados; por favor presiona 'Enviar solicitud' nuevamente para completar el registro.",
          );
        }
        throw new Error(result.error || "No se pudo enviar la solicitud. Intenta de nuevo.");
      }

      setLeadId(result.id ?? null);
      setResumen(data);
      setSubmitted(true);
      trackEvent("generate_lead", {
        tipo_credito: data.tipoCredito,
        monto: data.capitalSeleccionado,
        lead_id: result.id,
      });
      clearDraft();
      clearMicrocreditoUrbanoServerDraftId();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("[FormularioMicrocreditoUrbano] submit", error);
      if (draftLeadId) {
        restoreMicrocreditoUrbanoServerDraftId(draftLeadId);
      } else {
        resumeMicrocreditoUrbanoServerDraftSync();
      }
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Error de conexión. Revisa tu internet e intenta de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const nuevaSolicitud = () => {
    clearDraft();
    clearMicrocreditoUrbanoServerDraftId();
    resumeMicrocreditoUrbanoServerDraftSync();
    reset(defaultValues);
    dismissDraftMessage();
    setSubmitted(false);
    setResumen(null);
    setLeadId(null);
    setSubmitError(null);
    setStep(0);
  };

  if (submitted && resumen) {
    return (
      <ConfirmacionSolicitud data={resumen} leadId={leadId} onNuevaSolicitud={nuevaSolicitud} />
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="flex flex-col gap-5">
        <input type="hidden" {...methods.register("tipoCredito")} />

        {draftMessage && (
          <div className="flex items-start justify-between gap-3 border border-coodel-accent/30 bg-coodel-accent/5 px-4 py-3 text-sm text-coodel-dark">
            <p>{draftMessage}</p>
            <button
              type="button"
              onClick={dismissDraftMessage}
              className="shrink-0 text-xs text-gray-500 underline hover:text-coodel-primary"
            >
              Entendido
            </button>
          </div>
        )}

        <div className="border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
            <span>
              Paso {step + 1} de {totalSteps}
            </span>
            <span className="font-semibold text-coodel-primary">{current.title}</span>
          </div>
          <div className="h-1.5 overflow-hidden bg-gray-100">
            <div
              className="h-full bg-coodel-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <FormSection
          id={current.id}
          title={current.title}
          description={current.description}
          stepNumber={step + 1}
          totalSteps={totalSteps}
        >
          <StepFields />
        </FormSection>

        {submitError && (
          <div
            id="submit-error-bottom"
            className="rounded-xl border-2 border-red-400 bg-red-50/95 p-4 text-sm text-red-950 shadow-sm"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none">⚠️</span>
              <div className="flex-1">
                <p className="font-bold text-red-950">
                  {submitError.includes("servidor") ||
                  submitError.includes("conexión") ||
                  submitError.includes("procesando") ||
                  submitError.includes("ocupado")
                    ? "Aviso del sistema al enviar la solicitud:"
                    : step < totalSteps - 1
                      ? "Por favor completa o corrige los campos señalados en rojo para continuar:"
                      : "Por favor completa o corrige los campos señalados en rojo antes de enviar:"}
                </p>
                <div className="mt-1.5 text-sm leading-relaxed text-red-800 whitespace-pre-line font-medium">
                  {submitError}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-4 flex gap-3 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur-sm md:mx-0 md:px-0">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              className="flex-1 md:flex-none"
              disabled={submitting}
            >
              Atrás
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button type="button" onClick={goNext} className="flex-1 md:flex-none">
              Continuar
            </Button>
          ) : (
            <Button type="submit" size="lg" className="flex-1 md:flex-none" loading={submitting}>
              {submitting ? "Enviando…" : "Enviar solicitud"}
            </Button>
          )}
        </div>
        <p className="text-center text-xs text-gray-400">Solicitud de {config.nombre} · Coodelsur</p>
      </form>
    </FormProvider>
  );
}
