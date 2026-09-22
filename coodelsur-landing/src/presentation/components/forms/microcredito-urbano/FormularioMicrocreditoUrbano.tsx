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
      if (crossFieldErrors.length > 0) {
        await trigger(crossFieldErrors[0].path, { shouldFocus: true });
      }
      return;
    }

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

      const payload = {
        ...data,
        utm,
        draftLeadId,
        geoCliente: data.geolocalizacion
          ? { lat: data.geolocalizacion.lat, lng: data.geolocalizacion.lng }
          : undefined,
      };

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        id?: string;
        error?: string;
        details?: unknown;
      };

      if (!response.ok || !result.success) {
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
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {submitError}
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
