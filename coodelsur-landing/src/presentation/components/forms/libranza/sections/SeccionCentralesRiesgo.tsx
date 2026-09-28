"use client";

import { CurrencyInput } from "@/presentation/components/ui/CurrencyInput";
import { Input } from "@/presentation/components/ui/Input";
import { Select } from "@/presentation/components/ui/Select";
import { SI_NO_NOSE, TIEMPOS_MORA } from "@/shared/config/creditos/opciones";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { Controller, useFormContext } from "react-hook-form";

export function SeccionCentralesRiesgo() {
  const {
    register,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  const moraVigente = watch("moraVigente");

  return (
    <div className="grid grid-cols-1 gap-4">
      <Select
        label="¿Tiene actualmente una mora vigente en centrales de riesgo (Datacrédito y/o TransUnion-CIFIN)?"
        options={SI_NO_NOSE}
        placeholder="Seleccionar..."
        required
        error={errors.moraVigente?.message}
        {...register("moraVigente", {
          onChange: (event) => {
            if (event.target.value !== "si") {
              setValue("moraEntidad", "", { shouldValidate: true });
              setValue("moraTiempo", "", { shouldValidate: true });
              setValue("moraValor", undefined, { shouldValidate: true });
            }
          },
        })}
      />

      {moraVigente === "si" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Detalle de la mora reportada
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Input
                label="¿Con qué entidad tiene la mora?"
                placeholder="Ej. Bancolombia, Claro..."
                required
                error={errors.moraEntidad?.message}
                {...register("moraEntidad")}
              />
            </div>
            <div>
              <Select
                label="¿Hace cuánto tiempo?"
                options={TIEMPOS_MORA}
                placeholder="Seleccionar..."
                required
                error={errors.moraTiempo?.message}
                {...register("moraTiempo")}
              />
            </div>
            <div>
              <Controller
                name="moraValor"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    label="¿De qué monto es la mora?"
                    name={field.name}
                    value={field.value}
                    required
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    error={errors.moraValor?.message}
                  />
                )}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

