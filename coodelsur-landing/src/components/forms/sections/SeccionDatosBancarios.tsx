"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TIPOS_CUENTA } from "@/config/creditos/opciones";
import { opcionesBancos } from "@/data/bancos";
import type { NanocreditoFormValues } from "@/lib/validation/nanocredito";
import { useFormContext } from "react-hook-form";

export function SeccionDatosBancarios() {
  const {
    register,
    formState: { errors },
  } = useFormContext<NanocreditoFormValues>();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Select
        label="Tipo de cuenta"
        options={TIPOS_CUENTA}
        placeholder="Seleccionar..."
        required
        error={errors.tipoCuenta?.message}
        {...register("tipoCuenta")}
      />
      <Select
        label="Entidad bancaria"
        options={opcionesBancos}
        placeholder="Seleccionar..."
        required
        error={errors.entidadBancaria?.message}
        {...register("entidadBancaria")}
      />
      <div className="md:col-span-2">
        <Input
          label="Número de cuenta"
          inputMode="numeric"
          required
          error={errors.numeroCuenta?.message}
          {...register("numeroCuenta")}
        />
      </div>
    </div>
  );
}
