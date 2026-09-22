"use client";

import { Input } from "@/presentation/components/ui/Input";
import { Select } from "@/presentation/components/ui/Select";
import { PARENTESCOS_REFERENCIA_FAMILIAR } from "@/shared/config/creditos/opciones";
import type { MicrocreditoUrbanoFormValues } from "@/shared/validation/microcredito-urbano/schema";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";

export function SeccionReferenciaFamiliar() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<MicrocreditoUrbanoFormValues>();

  const referenciaParentesco = watch("referenciaParentesco");

  useEffect(() => {
    setValue("referenciaTipo", "familiar", { shouldDirty: false });
  }, [setValue]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Select
        label="Parentesco"
        options={PARENTESCOS_REFERENCIA_FAMILIAR}
        placeholder="Seleccionar..."
        required
        error={errors.referenciaParentesco?.message}
        {...register("referenciaParentesco", {
          onChange: (event) => {
            if (event.target.value !== "otro") {
              setValue("referenciaParentescoOtro", "", { shouldValidate: true });
            }
          },
        })}
      />
      <Input
        label="Teléfono"
        type="tel"
        inputMode="tel"
        placeholder="3001234567"
        helperText="Celular colombiano de 10 dígitos."
        required
        error={errors.referenciaFamiliarTelefono?.message}
        {...register("referenciaFamiliarTelefono")}
      />
      {referenciaParentesco === "otro" && (
        <div className="md:col-span-2">
          <Input
            label="Describe el parentesco"
            placeholder="Ej. padrino, nuera, etc."
            required
            error={errors.referenciaParentescoOtro?.message}
            {...register("referenciaParentescoOtro")}
          />
        </div>
      )}
      <div className="md:col-span-2">
        <Input
          label="Nombre y apellido"
          required
          error={errors.referenciaFamiliarNombre?.message}
          {...register("referenciaFamiliarNombre")}
        />
      </div>
    </div>
  );
}
