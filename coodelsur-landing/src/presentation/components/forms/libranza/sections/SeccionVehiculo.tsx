"use client";

import { Input } from "@/presentation/components/ui/Input";
import { RadioGroup } from "@/presentation/components/ui/RadioGroup";
import { SI_NO } from "@/shared/config/creditos/opciones";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { Controller, useFormContext } from "react-hook-form";

export function SeccionVehiculo() {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  const tieneVehiculo = watch("tieneVehiculo");
  const vehiculoANombre = watch("vehiculoANombreCliente");

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
              field.onChange(event.target.value);
              if (event.target.value !== "si") {
                setValue("vehiculoANombreCliente", "", { shouldValidate: true });
                setValue("placaVehiculo", "", { shouldValidate: true });
              }
            }}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.tieneVehiculo?.message}
          />
        )}
      />
      {tieneVehiculo === "si" && (
        <Controller
          name="vehiculoANombreCliente"
          control={control}
          render={({ field }) => (
            <RadioGroup
              label="¿Está a nombre del cliente?"
              name={field.name}
              options={SI_NO}
              value={field.value ?? ""}
              required
              onChange={(event) => {
                field.onChange(event.target.value);
                if (event.target.value !== "si") {
                  setValue("placaVehiculo", "", { shouldValidate: true });
                }
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              error={errors.vehiculoANombreCliente?.message}
            />
          )}
        />
      )}
      {tieneVehiculo === "si" && vehiculoANombre === "si" && (
        <div className="md:col-span-2">
          <Input
            label="Placa del vehículo"
            placeholder="Ej. ABC123"
            required
            autoComplete="off"
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
