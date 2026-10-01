"use client";

import { Input } from "@/presentation/components/ui/Input";
import { Select } from "@/presentation/components/ui/Select";
import { SI_NO, TIPOS_CONTRATO } from "@/shared/config/creditos/opciones";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { useFormContext } from "react-hook-form";

export function SeccionInfoLaboral() {
  const {
    register,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Input
        label="Actividad económica"
        required
        error={errors.actividadEconomica?.message}
        {...register("actividadEconomica")}
      />
      <Input
        label="Nombre de la empresa"
        required
        error={errors.empresaLaboral?.message}
        {...register("empresaLaboral")}
      />
      <Select
        label="¿Tiene convenio vigente?"
        options={SI_NO}
        placeholder="Seleccionar..."
        required
        error={errors.tieneConvenioVigente?.message}
        {...register("tieneConvenioVigente")}
      />
      <Input
        label="Cargo"
        placeholder="Ej. Auxiliar administrativo"
        required
        error={errors.cargoLaboral?.message}
        {...register("cargoLaboral")}
      />
      <Select
        label="Tipo de contrato"
        options={TIPOS_CONTRATO}
        placeholder="Seleccionar..."
        required
        error={errors.tipoContrato?.message}
        {...register("tipoContrato")}
      />
      <Input
        label="Fecha de ingreso"
        type="date"
        required
        error={errors.fechaIngresoLaboral?.message}
        {...register("fechaIngresoLaboral")}
      />
      <div className="md:col-span-2">
        <Input
          label="Dirección laboral"
          autoComplete="street-address"
          required
          error={errors.direccionLaboral?.message}
          {...register("direccionLaboral")}
        />
      </div>
      <Input
        label="Barrio"
        required
        error={errors.barrioLaboral?.message}
        {...register("barrioLaboral")}
      />
      <Input
        label="Ciudad"
        required
        error={errors.ciudadLaboral?.message}
        {...register("ciudadLaboral")}
      />
      <Input
        label="Teléfono laboral"
        type="tel"
        inputMode="tel"
        required
        error={errors.telefonoLaboral?.message}
        {...register("telefonoLaboral")}
      />
    </div>
  );
}
