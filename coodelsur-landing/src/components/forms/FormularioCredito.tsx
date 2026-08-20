"use client";

import { ConfirmacionSolicitud } from "@/components/forms/ConfirmacionSolicitud";
import { FormSection } from "@/components/forms/FormSection";
import { SeccionActivos } from "@/components/forms/sections/SeccionActivos";
import { SeccionDatosBancarios } from "@/components/forms/sections/SeccionDatosBancarios";
import { SeccionDatosCredito } from "@/components/forms/sections/SeccionDatosCredito";
import { SeccionDatosGenerales } from "@/components/forms/sections/SeccionDatosGenerales";
import { SeccionDomicilio } from "@/components/forms/sections/SeccionDomicilio";
import { SeccionLaboral } from "@/components/forms/sections/SeccionLaboral";
import { SeccionReferenciaFamiliar } from "@/components/forms/sections/SeccionReferenciaFamiliar";
import { SeccionVerificacion } from "@/components/forms/sections/SeccionVerificacion";
import { Button } from "@/components/ui/Button";
import {
  NANOCREDITO_STEPS,
  nanocreditoDefaultValues,
  nanocreditoSchema,
  sanitizeNanocreditoForLog,
  type NanocreditoFormValues,
} from "@/lib/validation/nanocredito";
import { deserializeUtm } from "@/lib/tracking/utm";
import { getUtmFromCookie } from "@/lib/tracking/TrackingProvider";
import type { CreditoConfig } from "@/types/credito";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { FormProvider, useForm, type FieldErrors, type Path } from "react-hook-form";

interface FormularioCreditoProps {
  config: CreditoConfig;
  /** Monto elegido en el selector unificado; precarga `capitalSeleccionado`. */
  initialMonto?: number;
}

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

export function FormularioCredito({ config, initialMonto }: FormularioCreditoProps) {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [resumen, setResumen] = useState<NanocreditoFormValues | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = {
    ...nanocreditoDefaultValues,
    tipoCredito: "microcredito_small" as const,
    ...(typeof initialMonto === "number" && Number.isFinite(initialMonto)
      ? {
          capitalSeleccionado: initialMonto,
          valorCuota: Math.round(
            initialMonto / Number(nanocreditoDefaultValues.cantidadCuotas || 12),
          ),
        }
      : {}),
  } as NanocreditoFormValues;

  const methods = useForm<NanocreditoFormValues>({
    resolver: zodResolver(nanocreditoSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { handleSubmit, trigger, reset } = methods;
  const totalSteps = NANOCREDITO_STEPS.length;
  const current = NANOCREDITO_STEPS[step];
  const StepFields = STEP_COMPONENTS[step];
  const progress = ((step + 1) / totalSteps) * 100;

  if (!current || !StepFields) {
    return null;
  }

  const goNext = async () => {
    const fields = [...current.fields] as Path<NanocreditoFormValues>[];
    const valid = await trigger(fields, { shouldFocus: true });
    if (!valid) return;
    setStep((prev) => Math.min(prev + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onInvalid = (formErrors: FieldErrors<NanocreditoFormValues>) => {
    const firstInvalid = NANOCREDITO_STEPS.findIndex((s) =>
      s.fields.some((field) => formErrors[field as keyof NanocreditoFormValues]),
    );
    if (firstInvalid >= 0) {
      setStep(firstInvalid);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (data: NanocreditoFormValues) => {
    setSubmitError(null);
    setSubmitting(true);

    try {
      if (isDemoMode) {
        console.log(
          "[Coodelsur] DEMO_MODE — solicitud no enviada al backend:",
          sanitizeNanocreditoForLog(data),
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("[FormularioCredito] submit", error);
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
