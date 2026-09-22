"use client";

/** Formulario multi-paso Crédito Libranza (11 pasos, Zod + reglas cruzadas). */

import { ConfirmacionSolicitud } from "@/presentation/components/forms/ConfirmacionSolicitud";
import { FormSection } from "@/presentation/components/forms/FormSection";
import { SeccionDatosPersonales } from "@/presentation/components/forms/libranza/sections/SeccionDatosPersonales";
import { SeccionInfoCredito } from "@/presentation/components/forms/libranza/sections/SeccionInfoCredito";
import { SeccionFechaPago } from "@/presentation/components/forms/libranza/sections/SeccionFechaPago";
import { SeccionCentralesRiesgo } from "@/presentation/components/forms/libranza/sections/SeccionCentralesRiesgo";
import { SeccionInfoLaboral } from "@/presentation/components/forms/libranza/sections/SeccionInfoLaboral";
import { SeccionInfoFinanciera } from "@/presentation/components/forms/libranza/sections/SeccionInfoFinanciera";
import { SeccionVivienda } from "@/presentation/components/forms/libranza/sections/SeccionVivienda";
import { SeccionVehiculo } from "@/presentation/components/forms/libranza/sections/SeccionVehiculo";
import { SeccionReferencia } from "@/presentation/components/forms/libranza/sections/SeccionReferencia";
import { SeccionBancaria } from "@/presentation/components/forms/libranza/sections/SeccionBancaria";
import { SeccionAutorizaciones } from "@/presentation/components/forms/libranza/sections/SeccionAutorizaciones";
import type { CreditoFormProps } from "@/presentation/components/forms/types";
import { Button } from "@/presentation/components/ui/Button";
import {
  LIBRANZA_STEPS,
  collectStepCrossFieldErrors,
  libranzaDefaultValues,
  libranzaSchema,
  sanitizeLibranzaForLog,
  type LibranzaFormValues,
  type LibranzaStepId,
} from "@/shared/validation/libranza/schema";
import { deserializeUtm } from "@/presentation/tracking/utm";
import { getUtmFromCookie } from "@/presentation/tracking/TrackingProvider";
import { trackEvent } from "@/presentation/tracking/analytics";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { FormProvider, useForm, type FieldErrors, type Path } from "react-hook-form";

const STEP_COMPONENTS = [
  SeccionDatosPersonales,
  SeccionInfoCredito,
  SeccionFechaPago,
  SeccionCentralesRiesgo,
  SeccionInfoLaboral,
  SeccionInfoFinanciera,
  SeccionVivienda,
  SeccionVehiculo,
  SeccionReferencia,
  SeccionBancaria,
  SeccionAutorizaciones,
];

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function FormularioLibranza({ config, initialMonto }: CreditoFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [resumen, setResumen] = useState<LibranzaFormValues | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const defaultValues = useMemo(() => {
    const base = {
      ...libranzaDefaultValues,
      tipoCredito: "libranza" as const,
    } as LibranzaFormValues;

    if (typeof initialMonto === "number" && Number.isFinite(initialMonto)) {
      return {
        ...base,
        capitalSeleccionado: initialMonto,
      };
    }

    return base;
  }, [initialMonto]);

  const methods = useForm<LibranzaFormValues>({
    resolver: zodResolver(libranzaSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { handleSubmit, trigger, reset, getValues, setError, setValue } = methods;
  const totalSteps = LIBRANZA_STEPS.length;

  const current = LIBRANZA_STEPS[step];
  const StepFields = STEP_COMPONENTS[step];
  const progress = ((step + 1) / totalSteps) * 100;

  if (!current || !StepFields) {
    return null;
  }

  const goNext = async () => {
    const fields = [...current.fields] as Path<LibranzaFormValues>[];
    const valid = await trigger(fields, { shouldFocus: true });

    const crossFieldErrors = collectStepCrossFieldErrors(current.id as LibranzaStepId, getValues());
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
      step_name: LIBRANZA_STEPS[nextStep]?.id ?? "unknown",
      tipo_credito: getValues("tipoCredito"),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onInvalid = (formErrors: FieldErrors<LibranzaFormValues>) => {
    const firstInvalid = LIBRANZA_STEPS.findIndex((s) =>
      s.fields.some((field) => formErrors[field as keyof LibranzaFormValues]),
    );
    if (firstInvalid >= 0) {
      setStep(firstInvalid);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (data: LibranzaFormValues) => {
    setSubmitError(null);
    setSubmitting(true);

    try {
      if (isDemoMode) {
        console.log(
          "[Coodelsur] DEMO_MODE — solicitud Libranza no enviada al backend:",
          sanitizeLibranzaForLog(data),
        );
        setResumen(data);
        setLeadId(null);
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const utm = deserializeUtm(getUtmFromCookie() ?? undefined) ?? undefined;

      const payload = {
        ...data,
        utm,
        geoCliente: data.geolocalizacion
          ? { lat: data.geolocalizacion.lat, lng: data.geolocalizacion.lng }
          : undefined,
      };

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90_000),
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("[FormularioLibranza] submit", error);
      const message =
        error instanceof DOMException && error.name === "TimeoutError"
          ? "El servidor tardó demasiado en responder. Intenta de nuevo; si persiste, usa «Subir imagen» en lugar de la cámara."
          : error instanceof Error
            ? error.message
            : "Error de conexión. Revisa tu internet e intenta de nuevo.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const nuevaSolicitud = () => {
    reset(defaultValues);
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
