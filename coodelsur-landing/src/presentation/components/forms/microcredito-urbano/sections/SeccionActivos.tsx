"use client";

import { Input } from "@/presentation/components/ui/Input";
import { RadioGroup } from "@/presentation/components/ui/RadioGroup";
import { SI_NO } from "@/shared/config/creditos/opciones";
import type { MicrocreditoUrbanoFormValues } from "@/shared/validation/microcredito-urbano/schema";
import { Controller, useFormContext } from "react-hook-form";

export function SeccionActivos() {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<MicrocreditoUrbanoFormValues>();

  const tieneVivienda = watch("tieneVivienda");
  const tieneVehiculo = watch("tieneVehiculo");

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
            onChange={(event) => {
              const value = event.target.value;
              field.onChange(value);
              if (value !== "si") {
                setValue("direccionVivienda", "", { shouldValidate: true });
              }
            }}
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
            onChange={(event) => {
              const value = event.target.value;
              field.onChange(value);
              if (value !== "si") {
                setValue("placaVehiculo", "", { shouldValidate: true });
              }
            }}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.tieneVehiculo?.message}
          />
        )}
      />
      {tieneVivienda === "si" && (
        <div className="md:col-span-2">
          <Input
            label="Dirección de la vivienda"
            placeholder="Ej. Calle 10 # 5-20"
            required
            autoComplete="street-address"
            helperText="Obligatorio si tienes vivienda."
            error={errors.direccionVivienda?.message}
            {...register("direccionVivienda")}
          />
        </div>
      )}
      {tieneVehiculo === "si" && (
        <div className="md:col-span-2">
          <Input
            label="Placa del vehículo"
            placeholder="Ej. ABC123"
            required
            autoComplete="off"
            helperText="Obligatorio si tienes vehículo."
            error={errors.placaVehiculo?.message}
            {...register("placaVehiculo", {
              setValueAs: (value) => String(value ?? "").toUpperCase().trim(),
            })}
          />
        </div>
      )}
    </div>
  );
}
