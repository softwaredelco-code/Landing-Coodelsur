"use client";

import { Select } from "@/presentation/components/ui/Select";
import { SI_NO_NOSE } from "@/shared/config/creditos/opciones";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { useFormContext } from "react-hook-form";

export function SeccionCentralesRiesgo() {
  const {
    register,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  return (
    <div className="grid grid-cols-1 gap-4">
      <Select
        label="¿Tiene actualmente una mora vigente en centrales de riesgo (Datacrédito y/o TransUnion-CIFIN)?"
        options={SI_NO_NOSE}
        placeholder="Seleccionar..."
        required
        error={errors.moraVigente?.message}
        {...register("moraVigente")}
      />
    </div>
  );
}
