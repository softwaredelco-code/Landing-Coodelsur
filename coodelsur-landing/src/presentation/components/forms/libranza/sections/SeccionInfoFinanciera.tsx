"use client";

import { Input } from "@/presentation/components/ui/Input";
import { CurrencyInput } from "@/presentation/components/ui/CurrencyInput";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { Controller, useFormContext } from "react-hook-form";

export function SeccionInfoFinanciera() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Controller
        name="ingresosMensuales"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            label="Ingresos mensuales"
            name={field.name}
            value={field.value}
            required
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.ingresosMensuales?.message}
          />
        )}
      />
      <Controller
        name="otrosIngresos"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            label="Otros ingresos"
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            helperText="Opcional."
            error={errors.otrosIngresos?.message}
          />
        )}
      />
      <Controller
        name="egresosMensuales"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            label="Egresos mensuales"
            name={field.name}
            value={field.value}
            required
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.egresosMensuales?.message}
          />
        )}
      />
      <Controller
        name="activosTotales"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            label="Activos totales"
            name={field.name}
            value={field.value}
            required
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.activosTotales?.message}
          />
        )}
      />
      <Controller
        name="pasivosTotales"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            label="Pasivos totales"
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            helperText="Opcional."
            error={errors.pasivosTotales?.message}
          />
        )}
      />
      <Input
        label="Número de personas a cargo"
        type="number"
        inputMode="numeric"
        min={0}
        required
        error={errors.personasACargo?.message}
        {...register("personasACargo")}
      />
    </div>
  );
}
