"use client";

import { CameraCapture } from "@/presentation/components/forms/CameraCapture";
import { GeolocationCapture } from "@/presentation/components/forms/GeolocationCapture";
import { TermsAcceptance } from "@/presentation/components/forms/TermsAcceptance";
import { VideoRecorder } from "@/presentation/components/forms/VideoRecorder";
import type { NanocreditoFormValues } from "@/shared/validation/nanocredito";
import dynamic from "next/dynamic";
import { Controller, useFormContext, useWatch } from "react-hook-form";

const SignaturePad = dynamic(() => import("@/presentation/components/forms/SignaturePad").then((m) => m.SignaturePad), {
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
          <CameraCapture
            id="cedulaFrontal"
            label="Foto de la cédula — cara frontal"
            facingMode="environment"
            required
            helperText="Funciona en celular y computador. Usa la cámara trasera o sube una imagen nítida."
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
          <CameraCapture
            id="cedulaReverso"
            label="Foto de la cédula — cara posterior"
            facingMode="environment"
            required
            helperText="Toma el reverso con la cámara o súbelo desde tu galería."
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
            <VideoRecorder
              id="videoVerificacion"
              label="Video de 3 segundos"
              durationSeconds={3}
              required
              helperText="Graba un video corto de tu rostro con la cámara frontal. También puedes subir un video si tu navegador no permite grabar."
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
                  ? "Puedes firmar con el dedo o el mouse, o subir una imagen de tu firma."
                  : "Primero lee y acepta los términos para habilitar la firma."
              }
            />
          )}
        />
      </div>
    </div>
  );
}
