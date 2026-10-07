"use client";

/** Formulario multi-paso Microcrédito Small (8 pasos, Zod + reglas cruzadas). */

import { ConfirmacionSolicitud } from "@/presentation/components/forms/ConfirmacionSolicitud";
import { FormSection } from "@/presentation/components/forms/FormSection";
import { SeccionActivos } from "@/presentation/components/forms/microcredito-small/sections/SeccionActivos";
import { SeccionDatosBancarios } from "@/presentation/components/forms/microcredito-small/sections/SeccionDatosBancarios";
import { SeccionDatosCredito } from "@/presentation/components/forms/microcredito-small/sections/SeccionDatosCredito";
import { SeccionDatosGenerales } from "@/presentation/components/forms/microcredito-small/sections/SeccionDatosGenerales";
import { SeccionDomicilio } from "@/presentation/components/forms/microcredito-small/sections/SeccionDomicilio";
import { SeccionLaboral } from "@/presentation/components/forms/microcredito-small/sections/SeccionLaboral";
import { SeccionReferenciaFamiliar } from "@/presentation/components/forms/microcredito-small/sections/SeccionReferenciaFamiliar";
import { SeccionVerificacion } from "@/presentation/components/forms/microcredito-small/sections/SeccionVerificacion";
import type { CreditoFormProps } from "@/presentation/components/forms/types";
import { Button } from "@/presentation/components/ui/Button";
import { ParametrosAmortizacionProvider } from "@/presentation/contexts/ParametrosAmortizacionContext";
import { useNanocreditoDraft } from "@/presentation/hooks/useNanocreditoDraft";
import {
  clearNanocreditoServerDraftId,
  disableNanocreditoServerDraftSync,
  enableNanocreditoServerDraftSync,
  getNanocreditoServerDraftId,
  syncNanocreditoDraftToServer,
  useNanocreditoServerDraft,
} from "@/presentation/hooks/useNanocreditoServerDraft";
import { calcularDesgloseCuota } from "@/domain/credito/amortizacion";
import { getParametrosAmortizacion } from "@/shared/config/creditos/amortizacion";
import {
  NANOCREDITO_STEPS,
  collectStepCrossFieldErrors,
  nanocreditoDefaultValues,
  nanocreditoSchema,
  sanitizeNanocreditoForLog,
  type NanocreditoFormValues,
} from "@/shared/validation/nanocredito";
import { deserializeUtm, resolveOrigenFromAttribution } from "@/presentation/tracking/utm";
import { getUtmFromCookie } from "@/presentation/tracking/TrackingProvider";
import { trackEvent } from "@/presentation/tracking/analytics";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
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

const FIELD_LABELS_ES: Record<string, string> = {
  nombre: "Nombre y apellido",
  email: "Correo electrónico",
  tipoIdentificacion: "Tipo de documento",
  cedula: "Número de cédula",
  telefono: "Teléfono celular",
  genero: "Género",
  estadoCivil: "Estado civil",
  fechaNacimiento: "Fecha de nacimiento",
  fechaExpedicion: "Fecha de expedición",
  personasACargo: "Personas a cargo",
  estrato: "Estrato socioeconómico",
  capitalSeleccionado: "Monto del crédito",
  cantidadCuotas: "Plazo / cuotas",
  valorCuota: "Valor de cuota",
  destinoCredito: "Destino del crédito",
  moraVigente: "Mora vigente",
  moraEntidad: "Entidad en mora",
  moraTiempo: "Tiempo de mora",
  moraValor: "Valor aproximado de mora",
  ingresosMensuales: "Ingresos mensuales",
  origenOtrosIngresos: "Origen de otros ingresos",
  origenOtrosIngresosOtro: "Detalle de otros ingresos",
  otrosIngresos: "Valor de otros ingresos",
  departamento: "Departamento",
  municipio: "Municipio / Ciudad",
  sectorDomicilio: "Sector de domicilio",
  direccion: "Dirección de residencia",
  barrio: "Barrio",
  tieneVivienda: "Vivienda propia",
  tieneVehiculo: "Vehículo propio",
  placaVehiculo: "Placa del vehículo",
  ocupacion: "Ocupación laboral",
  empresa: "Nombre de empresa",
  cargo: "Cargo laboral",
  fechaIngreso: "Fecha de vinculación laboral",
  referenciaTipo: "Tipo de referencia",
  referenciaParentesco: "Parentesco de referencia",
  referenciaParentescoOtro: "Detalle de parentesco",
  referenciaFamiliarNombre: "Nombre de la referencia",
  referenciaFamiliarTelefono: "Teléfono de la referencia",
  tipoCuenta: "Tipo de cuenta bancaria",
  entidadBancaria: "Banco o entidad financiera",
  numeroCuenta: "Número de cuenta o llave bancaria",
  geolocalizacion: "Ubicación GPS",
  cedulaFrontal: "Foto frontal de la cédula",
  cedulaReverso: "Foto posterior de la cédula",
  videoVerificacion: "Video de verificación de rostro",
  aceptaTerminos: "Aceptación de hábeas data y términos legales",
  firma: "Firma de aceptación",
};

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

export function FormularioMicrocreditoSmall(props: CreditoFormProps) {
  return (
    <ParametrosAmortizacionProvider>
      <FormularioMicrocreditoSmallInner {...props} />
    </ParametrosAmortizacionProvider>
  );
}

function FormularioMicrocreditoSmallInner({ config, initialMonto }: CreditoFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [resumen, setResumen] = useState<NanocreditoFormValues | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultValues = useMemo(() => {
    const base = {
      ...nanocreditoDefaultValues,
      tipoCredito: "microcredito_small" as const,
    } as NanocreditoFormValues;

    if (typeof initialMonto === "number" && Number.isFinite(initialMonto)) {
      const plazo = Number(nanocreditoDefaultValues.cantidadCuotas || 2);
      const desglose = calcularDesgloseCuota("microcredito_small", initialMonto, plazo);
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

  const methods = useForm<NanocreditoFormValues>({
    resolver: zodResolver(nanocreditoSchema),
    defaultValues,
    mode: "onTouched",
  });

  const { handleSubmit, trigger, reset, watch, getValues, setError, setValue } = methods;
  const totalSteps = NANOCREDITO_STEPS.length;

  const {
    step,
    setStep,
    draftMessage,
    dismissDraftMessage,
    clearDraft,
  } = useNanocreditoDraft({
    watch,
    getValues,
    reset,
    baseValues: defaultValues,
    totalSteps,
    enabled: !submitted,
    initialMonto,
  });

  useNanocreditoServerDraft({
    watch,
    getValues,
    step,
    enabled: !submitted && !submitting,
  });

  useEffect(() => {
    const utm = deserializeUtm(getUtmFromCookie() ?? undefined);
    trackEvent("begin_form", {
      tipo_credito: defaultValues.tipoCredito,
      origen: resolveOrigenFromAttribution(utm),
      utm_source: utm?.utmSource,
      utm_campaign: utm?.utmCampaign,
    });
  }, [defaultValues.tipoCredito]);

  const current = NANOCREDITO_STEPS[step];
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

    const fields = [...current.fields] as Path<NanocreditoFormValues>[];
    const valid = await trigger(fields, { shouldFocus: true });

    const crossFieldErrors = collectStepCrossFieldErrors(current.id, getValues());
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
        const friendlyName = FIELD_LABELS_ES[String(root)] || String(key);
        return `• ${friendlyName}: ${msg}`;
      });

      if (crossFieldErrors.length > 0) {
        for (const cErr of crossFieldErrors) {
          const friendlyName = FIELD_LABELS_ES[String(cErr.path)] || String(cErr.path);
          bulletItems.push(`• ${friendlyName}: ${cErr.message}`);
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
      step_name: NANOCREDITO_STEPS[nextStep]?.id ?? "unknown",
      tipo_credito: getValues("tipoCredito"),
    });
    void syncNanocreditoDraftToServer(nextStep, getValues);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onInvalid = (formErrors: FieldErrors<NanocreditoFormValues>) => {
    const rawKeys = Object.keys(formErrors) as (keyof NanocreditoFormValues)[];
    if (rawKeys.length === 0) return;

    // Normalizar llaves quitando sub-propiedades como .preview
    const rootKeys = rawKeys.map((k) => String(k).split(".")[0] as keyof NanocreditoFormValues);

    let firstInvalidStep = NANOCREDITO_STEPS.findIndex((s) =>
      s.fields.some((field) => rootKeys.includes(field as keyof NanocreditoFormValues)),
    );
    if (firstInvalidStep < 0) {
      firstInvalidStep = 0;
    }

    setStep(firstInvalidStep);

    const firstInvalidField = String(rootKeys[0]);
    focusAndHighlightField(firstInvalidField);

    const bulletItems = rawKeys.map((k) => {
      const root = String(k).split(".")[0];
      const friendlyName = FIELD_LABELS_ES[root] || root;
      const rawMsg = formErrors[k]?.message;
      const msg =
        typeof rawMsg === "string" && rawMsg.trim().length > 0
          ? rawMsg
          : "Requerido o con formato incorrecto";
      return `• ${friendlyName}: ${msg}`;
    });

    const summaryText =
      bulletItems.length > 0
        ? `Por favor completa o corrige los siguientes datos marcados en rojo:\n${bulletItems.slice(0, 5).join("\n")}`
        : "Hay campos obligatorios incompletos o con datos incorrectos. Revisa los campos resaltados en rojo.";

    setSubmitError(summaryText);
  };

  const onSubmit = async (data: NanocreditoFormValues) => {
    setSubmitError(null);
    setSubmitting(true);
    const draftLeadId = getNanocreditoServerDraftId();
    disableNanocreditoServerDraftSync();

    try {
      if (isDemoMode) {
        console.log(
          "[Coodelsur] DEMO_MODE — solicitud no enviada al backend:",
          sanitizeNanocreditoForLog(data),
        );
        setResumen(data);
        setLeadId(null);
        setSubmitted(true);
        clearDraft();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // Asegurar sincronización exacta de fórmulas antes del envío
      const capital = Number(data.capitalSeleccionado || 0);
      const cuotas = Number(data.cantidadCuotas || 0);
      let synchedData = { ...data };
      if (capital > 0 && cuotas > 0) {
        try {
          const desglose = calcularDesgloseCuota(data.tipoCredito, capital, cuotas);
          synchedData = {
            ...synchedData,
            valorCuota: desglose.valorCuotaTotal,
            valorCreditoFinanciado: desglose.valorCreditoFinanciado,
            estudioCredito: desglose.estudioCredito,
            cuotaCapitalInteres: desglose.cuotaCapitalInteres,
            cuotaFianzaMensual: desglose.fianzaMensual,
            cuotaVidaDeudoresMensual: desglose.vidaDeudoresMensual,
          };
        } catch {
          // Mantener datos originales si no aplica
        }
      }

      const utm = deserializeUtm(getUtmFromCookie() ?? undefined) ?? undefined;

      // Optimizar payload para garantizar envío inmediato sin saturar buffer ni provocar 503 de LiteSpeed/Passenger
      const cleanData: any = { ...synchedData };
      if (
        cleanData.videoVerificacion &&
        typeof cleanData.videoVerificacion === "object" &&
        "preview" in cleanData.videoVerificacion
      ) {
        const previewStr = String(cleanData.videoVerificacion.preview ?? "");
        // Si el borrador ya está en el servidor o el base64 excede 600 KB, enviamos referencia liviana
        if (draftLeadId || previewStr.length > 600_000) {
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

      const sendWithRetry = async (retriesLeft = 2): Promise<Response> => {
        try {
          const res = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(60_000),
          });

          // Si el servidor retornó 503/504 (proceso despertando o reinicio de worker), reintentar automáticamente
          if ((res.status === 503 || res.status === 504) && retriesLeft > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            return sendWithRetry(retriesLeft - 1);
          }
          return res;
        } catch (fetchErr) {
          if (retriesLeft > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            return sendWithRetry(retriesLeft - 1);
          }
          throw fetchErr;
        }
      };

      const response = await sendWithRetry(2);

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
        // Respuesta no-JSON (ej. HTML 413, 503 o 504 de Nginx/cPanel/LiteSpeed)
      }

      if (!response.ok || !result.success) {
        if (response.status === 413) {
          const stepVerif = NANOCREDITO_STEPS.findIndex((s) => s.id === "verificacion");
          if (stepVerif >= 0) setStep(stepVerif);
          focusAndHighlightField("videoVerificacion");
          throw new Error(
            "Los archivos adjuntos son demasiado pesados para el servidor. Por favor graba un video más corto o selecciona imágenes más livianas.",
          );
        }

        if (response.status === 503 || response.status === 504) {
          throw new Error(
            "El servidor está procesando solicitudes en este momento. Tus datos se encuentran seguros y guardados; por favor presiona 'Enviar solicitud' nuevamente para completar el registro.",
          );
        }

        // Extraer errores específicos por campo retornados por el backend
        const fieldErrors: Record<string, string> = {};
        if (result.details && typeof result.details === "object") {
          for (const [key, val] of Object.entries(result.details)) {
            const rootKey = key.split(".")[0];
            if (Array.isArray(val) && typeof val[0] === "string") {
              fieldErrors[rootKey] = val[0];
            } else if (typeof val === "string") {
              fieldErrors[rootKey] = val;
            }
          }
        }
        if (Array.isArray(result.issues)) {
          for (const issue of result.issues) {
            const rootKey = (issue.field || "").split(".")[0];
            if (rootKey && issue.message && !fieldErrors[rootKey]) {
              fieldErrors[rootKey] = issue.message;
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
          setError(fieldName as Path<NanocreditoFormValues>, {
            type: "server",
            message,
          });
        }

        // Navegar automáticamente al paso donde ocurrió el primer error
        const errorFieldNames = Object.keys(fieldErrors);
        if (errorFieldNames.length > 0) {
          const targetStep = NANOCREDITO_STEPS.findIndex((s) =>
            s.fields.some((field) => errorFieldNames.includes(field)),
          );
          if (targetStep >= 0) {
            setStep(targetStep);
          }
          focusAndHighlightField(errorFieldNames[0]);
        }

        const bulletItems = Object.entries(fieldErrors).map(([key, msg]) => {
          const friendlyName = FIELD_LABELS_ES[key] || key;
          return `• ${friendlyName}: ${msg}`;
        });

        const errorMessage =
          bulletItems.length > 0
            ? `Por favor revisa y corrige los siguientes campos señalados en rojo:\n${bulletItems.slice(0, 5).join("\n")}`
            : result.error ||
              `No se pudo procesar la solicitud (código ${response.status || 500}). Por favor revisa que todos los campos requeridos estén completos e intenta de nuevo.`;

        throw new Error(errorMessage);
      }

      setLeadId(result.id ?? null);
      setResumen(data);
      setSubmitted(true);
      trackEvent("generate_lead", {
        tipo_credito: data.tipoCredito,
        monto: data.capitalSeleccionado,
        lead_id: result.id,
        origen: resolveOrigenFromAttribution(utm),
        utm_source: utm?.utmSource,
        utm_campaign: utm?.utmCampaign,
      });
      clearDraft();
      clearNanocreditoServerDraftId();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("[FormularioMicrocreditoSmall] submit", error);
      enableNanocreditoServerDraftSync();
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
    clearDraft();
    clearNanocreditoServerDraftId();
    enableNanocreditoServerDraftSync();
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

        {submitError && (
          <div
            id="submit-error-top"
            className="rounded-xl border-2 border-red-400 bg-red-50/95 p-4 text-sm text-red-950 shadow-sm"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none">⚠️</span>
              <div className="flex-1">
                <p className="font-bold text-red-950 text-base">Revisa la siguiente información requerida:</p>
                <div className="mt-2 text-sm leading-relaxed text-red-900 whitespace-pre-line font-medium">
                  {submitError}
                </div>
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
                  submitError.includes("ocupado") ||
                  submitError.includes("código") ||
                  submitError.includes("tardó")
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
