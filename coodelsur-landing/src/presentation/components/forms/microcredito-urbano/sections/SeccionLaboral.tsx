"use client";

import { Input } from "@/presentation/components/ui/Input";
import type { MicrocreditoUrbanoFormValues } from "@/shared/validation/microcredito-urbano/schema";
import { useFormContext } from "react-hook-form";

export function SeccionLaboral() {
  const {
    register,
    formState: { errors },
  } = useFormContext<MicrocreditoUrbanoFormValues>();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input
        label="Actividad económica"
        required
        error={errors.actividadEconomica?.message}
        {...register("actividadEconomica")}
      />
      <Input
        label="Nombre del negocio"
        required
        error={errors.nombreNegocio?.message}
        {...register("nombreNegocio")}
      />
      <Input
        label="Fecha de inicio"
        type="date"
        required
        error={errors.fechaInicioNegocio?.message}
        {...register("fechaInicioNegocio")}
      />
      <div className="md:col-span-2">
        <Input
          label="Dirección"
          autoComplete="street-address"
          required
          error={errors.direccionNegocio?.message}
          {...register("direccionNegocio")}
        />
      </div>
      <Input
        label="Barrio"
        required
        error={errors.barrioNegocio?.message}
        {...register("barrioNegocio")}
      />
      <Input
        label="Ciudad"
        autoComplete="address-level2"
        required
        error={errors.ciudadNegocio?.message}
        {...register("ciudadNegocio")}
      />
      <Input
        label="Teléfono"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="3001234567"
        helperText="Ingresa un celular colombiano válido (10 dígitos, inicia en 3)"
        required
        error={errors.telefonoNegocio?.message}
        {...register("telefonoNegocio")}
      />
    </div>
  );
}
