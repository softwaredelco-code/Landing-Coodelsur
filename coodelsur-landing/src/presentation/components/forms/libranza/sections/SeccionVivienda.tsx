"use client";

import { Input } from "@/presentation/components/ui/Input";
import { RadioGroup } from "@/presentation/components/ui/RadioGroup";
import { SI_NO } from "@/shared/config/creditos/opciones";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { Controller, useFormContext } from "react-hook-form";

export function SeccionVivienda() {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  const tieneVivienda = watch("tieneVivienda");
  const viviendaANombre = watch("viviendaANombreCliente");

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
              field.onChange(event.target.value);
              if (event.target.value !== "si") {
                setValue("viviendaANombreCliente", "", { shouldValidate: true });
                setValue("direccionVivienda", "", { shouldValidate: true });
              }
            }}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.tieneVivienda?.message}
          />
        )}
      />
      {tieneVivienda === "si" && (
        <Controller
          name="viviendaANombreCliente"
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
                  setValue("direccionVivienda", "", { shouldValidate: true });
                }
              }}
              onBlur={field.onBlur}
              ref={field.ref}
              error={errors.viviendaANombreCliente?.message}
            />
          )}
        />
      )}
      {tieneVivienda === "si" && viviendaANombre === "si" && (
        <div className="md:col-span-2">
          <Input
            label="Dirección de la vivienda"
            required
            error={errors.direccionVivienda?.message}
            {...register("direccionVivienda")}
          />
        </div>
      )}
    </div>
  );
}
