"use client";

import { Input } from "@/presentation/components/ui/Input";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { useFormContext } from "react-hook-form";

export function SeccionReferencia() {
  const {
    register,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Input
          label="Nombre y apellido"
          required
          error={errors.referenciaFamiliarNombre?.message}
          {...register("referenciaFamiliarNombre")}
        />
      </div>
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
    </div>
  );
}
