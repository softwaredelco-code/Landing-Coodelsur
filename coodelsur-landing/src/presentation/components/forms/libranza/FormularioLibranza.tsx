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
import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const draftId = params.get("draftLeadId") || params.get("leadId") || params.get("draftId");
    if (draftId) {
      sessionStorage.setItem("coodelsur_server_draft_id", draftId);
    }
    const nombre = params.get("nombre");
    if (nombre) setValue("nombre", nombre.trim());
    const cedula = params.get("cedula") || params.get("documento");
    if (cedula) setValue("cedula", cedula.trim());
    const telefono = params.get("telefono") || params.get("celular");
    if (telefono) setValue("telefono", telefono.trim());
    const email = params.get("email") || params.get("correo");
    if (email) setValue("email", email.trim());
    const monto = params.get("monto") || params.get("capitalSeleccionado");
    if (monto && !Number.isNaN(Number(monto)) && Number(monto) > 0) {
      setValue("capitalSeleccionado", Number(monto));
    }
  }, [setValue]);

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
    const errorKeys = Object.keys(formErrors) as (keyof LibranzaFormValues)[];
    if (errorKeys.length === 0) return;

    let firstInvalid = LIBRANZA_STEPS.findIndex((s) =>
      s.fields.some((field) => formErrors[field as keyof LibranzaFormValues]),
    );
    if (firstInvalid < 0) {
      firstInvalid = 0;
    }

    setStep(firstInvalid);

    const errorDetails = errorKeys
      .map((k) => formErrors[k]?.message)
      .filter((m): m is string => typeof m === "string" && m.trim().length > 0);

    const summaryText =
      errorDetails.length > 0
        ? `Por favor completa o corrige los siguientes campos: ${errorDetails.slice(0, 3).join(". ")}`
        : "Hay campos obligatorios incompletos o con datos incorrectos. Revisa los campos resaltados en rojo.";

    setSubmitError(summaryText);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      const draftLeadId =
        typeof window !== "undefined"
          ? sessionStorage.getItem("coodelsur_server_draft_id")
          : null;

      const cleanData: any = { ...data };
      if (
        cleanData.videoVerificacion &&
        typeof cleanData.videoVerificacion === "object" &&
        "preview" in cleanData.videoVerificacion
      ) {
        const previewStr = String(cleanData.videoVerificacion.preview ?? "");
        if (previewStr.length > 500000 || draftLeadId) {
          cleanData.videoVerificacion = {
            fileName: cleanData.videoVerificacion.fileName || "videoVerificacion.mp4",
            mimeType: cleanData.videoVerificacion.mimeType || "video/mp4",
            size: cleanData.videoVerificacion.size || 0,
            preview: draftLeadId ? "attached-in-draft" : previewStr.slice(0, 100),
          };
        }
      }

      const payload = {
        ...cleanData,
        utm,
        draftLeadId: draftLeadId ?? undefined,
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

      let result: {
        success?: boolean;
        id?: string;
        error?: string;
        details?: Record<string, string[] | unknown>;
        issues?: Array<{ field: string; message: string }>;
      } = {};

      try {
        result = (await response.json()) as typeof result;
      } catch {
        // Respuesta no-JSON (ej. HTML 413 o 504 de Nginx/cPanel)
      }

      if (!response.ok || !result.success) {
        if (response.status === 413) {
          const stepVerif = LIBRANZA_STEPS.findIndex((s) => s.id === "autorizaciones");
          if (stepVerif >= 0) setStep(stepVerif);
          throw new Error(
            "Los archivos adjuntos son demasiado pesados para el servidor. Por favor toma fotos directamente con la cámara o selecciona imágenes más livianas.",
          );
        }

        // Extraer errores específicos por campo retornados por el backend
        const fieldErrors: Record<string, string> = {};
        if (result.details && typeof result.details === "object") {
          for (const [key, val] of Object.entries(result.details)) {
            if (Array.isArray(val) && typeof val[0] === "string") {
              fieldErrors[key] = val[0];
            } else if (typeof val === "string") {
              fieldErrors[key] = val;
            }
          }
        }
        if (Array.isArray(result.issues)) {
          for (const issue of result.issues) {
            if (issue.field && issue.message && !fieldErrors[issue.field]) {
              fieldErrors[issue.field] = issue.message;
            }
          }
        }

        // Si la verificación de cédula / edad / duplicado falló
        if (
          result.error &&
          (result.error.toLowerCase().includes("identificación") ||
            result.error.toLowerCase().includes("cédula") ||
            result.error.toLowerCase().includes("edad") ||
            result.error.toLowerCase().includes("nacimiento") ||
            result.error.toLowerCase().includes("expedición"))
        ) {
          if (!fieldErrors.cedula) {
            fieldErrors.cedula = result.error;
          }
        }

        // Aplicar errores a react-hook-form para marcar los campos en rojo
        for (const [fieldName, message] of Object.entries(fieldErrors)) {
          setError(fieldName as Path<LibranzaFormValues>, {
            type: "server",
            message,
          });
        }

        // Navegar automáticamente al paso donde ocurrió el primer error
        const errorFieldNames = Object.keys(fieldErrors);
        if (errorFieldNames.length > 0) {
          const targetStep = LIBRANZA_STEPS.findIndex((s) =>
            s.fields.some((field) => errorFieldNames.includes(field)),
          );
          if (targetStep >= 0) {
            setStep(targetStep);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }

        const specificDetails = Object.values(fieldErrors).slice(0, 3).join(". ");
        const errorMessage = specificDetails
          ? `Por favor corrige la siguiente información: ${specificDetails}`
          : result.error ||
            "No se pudo enviar la solicitud. Por favor revisa que todos los campos requeridos estén completos e intenta de nuevo.";

        throw new Error(errorMessage);
      }

      setLeadId(result.id ?? null);
      setResumen(data);
      setSubmitted(true);
      trackEvent("generate_lead", {
        tipo_credito: data.tipoCredito,
        monto: data.capitalSeleccionado,
        lead_id: result.id,
      });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("coodelsur_server_draft_id");
      }
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

        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm" role="alert">
            <div className="flex items-start gap-2.5">
              <span className="text-base leading-none">⚠️</span>
              <div>
                <p className="font-semibold text-red-900">Atención al enviar la solicitud:</p>
                <p className="mt-0.5 leading-relaxed">{submitError}</p>
              </div>
            </div>
          </div>
        )}

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
