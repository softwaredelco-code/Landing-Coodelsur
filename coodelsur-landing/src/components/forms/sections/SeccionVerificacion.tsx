"use client";

import { FileUpload } from "@/components/forms/FileUpload";
import { GeolocationCapture } from "@/components/forms/GeolocationCapture";
import { TermsAcceptance } from "@/components/forms/TermsAcceptance";
import type { NanocreditoFormValues } from "@/lib/validation/nanocredito";
import dynamic from "next/dynamic";
import { Controller, useFormContext, useWatch } from "react-hook-form";

const SignaturePad = dynamic(() => import("@/components/forms/SignaturePad").then((m) => m.SignaturePad), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-lg bg-gray-100" />,
});

export function SeccionVerificacion() {
  const { control, setValue } = useFormContext<NanocreditoFormValues>();
  const aceptaTerminos = useWatch({ control, name: "aceptaTerminos" });

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <Controller
          name="geolocalizacion"
          control={control}
          render={({ field, fieldState }) => (
            <GeolocationCapture value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
          )}
        />
      </div>

      <Controller
        name="cedulaFrontal"
        control={control}
        render={({ field, fieldState }) => (
          <FileUpload
            id="cedulaFrontal"
            label="Foto de la cédula — cara frontal"
            accept="image/*"
            capture="environment"
            kind="image"
            required
            helperText="Usa la cámara trasera del celular o sube una imagen nítida."
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        name="cedulaReverso"
        control={control}
        render={({ field, fieldState }) => (
          <FileUpload
            id="cedulaReverso"
            label="Foto de la cédula — cara posterior"
            accept="image/*"
            capture="environment"
            kind="image"
            required
            helperText="Foto del reverso del documento."
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      <div className="md:col-span-2">
        <Controller
          name="videoVerificacion"
          control={control}
          render={({ field, fieldState }) => (
            <FileUpload
              id="videoVerificacion"
              label="Video de 3 segundos"
              accept="video/*"
              capture="user"
              kind="video"
              required
              helperText="Graba un video corto de tu rostro (cámara frontal) para verificación de identidad."
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>

      <div className="md:col-span-2">
        <Controller
          name="aceptaTerminos"
          control={control}
          render={({ field, fieldState }) => (
            <TermsAcceptance
              checked={field.value === true}
              onCheckedChange={(next) => {
                field.onChange(next);
                setValue(
                  "fechaAceptacionTerminos",
                  next ? new Date().toISOString() : "",
                  { shouldDirty: true },
                );
                if (!next) {
                  setValue("firma", "", { shouldDirty: true, shouldValidate: true });
                }
              }}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>

      <div className="md:col-span-2">
        <Controller
          name="firma"
          control={control}
          render={({ field, fieldState }) => (
            <SignaturePad
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              disabled={!aceptaTerminos}
              title="Firma de aceptación"
              helperText={
                aceptaTerminos
                  ? "Firma para confirmar que aceptas la autorización de hábeas data y esta solicitud."
                  : "Primero lee y acepta los términos para habilitar la firma."
              }
            />
          )}
        />
      </div>
    </div>
  );
}
