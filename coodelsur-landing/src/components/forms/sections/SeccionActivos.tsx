"use client";

import { RadioGroup } from "@/components/ui/RadioGroup";
import { SI_NO } from "@/config/creditos/opciones";
import type { NanocreditoFormValues } from "@/lib/validation/nanocredito";
import { Controller, useFormContext } from "react-hook-form";

export function SeccionActivos() {
  const {
    control,
    formState: { errors },
  } = useFormContext<NanocreditoFormValues>();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Controller
        name="tieneVivienda"
        control={control}
        render={({ field }) => (
          <RadioGroup
            label="¿Tiene vivienda?"
            name={field.name}
            options={SI_NO}
            value={field.value ?? ""}
            required
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.tieneVivienda?.message}
          />
        )}
      />
      <Controller
        name="tieneVehiculo"
        control={control}
        render={({ field }) => (
          <RadioGroup
            label="¿Tiene vehículo?"
            name={field.name}
            options={SI_NO}
            value={field.value ?? ""}
            required
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.tieneVehiculo?.message}
          />
        )}
      />
    </div>
  );
}
