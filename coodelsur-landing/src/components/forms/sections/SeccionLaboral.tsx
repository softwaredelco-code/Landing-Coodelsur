"use client";

import { Input } from "@/components/ui/Input";
import type { NanocreditoFormValues } from "@/lib/validation/nanocredito";
import { useFormContext } from "react-hook-form";

export function SeccionLaboral() {
  const {
    register,
    formState: { errors },
  } = useFormContext<NanocreditoFormValues>();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input
        label="Ocupación u oficio"
        required
        error={errors.ocupacion?.message}
        {...register("ocupacion")}
      />
      <Input
        label="Empresa donde trabaja"
        required
        error={errors.empresa?.message}
        {...register("empresa")}
      />
      <Input
        label="Cargo que desempeña"
        placeholder="Ej. Asesor comercial"
        required
        error={errors.cargo?.message}
        {...register("cargo")}
      />
      <Input
        label="Fecha de ingreso"
        type="date"
        required
        error={errors.fechaIngreso?.message}
        {...register("fechaIngreso")}
      />
    </div>
  );
}
