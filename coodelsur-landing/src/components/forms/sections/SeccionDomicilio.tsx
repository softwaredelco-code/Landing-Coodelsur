"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SECTORES_DOMICILIO } from "@/config/creditos/opciones";
import { opcionesDepartamento, opcionesMunicipio } from "@/data/colombia";
import type { NanocreditoFormValues } from "@/lib/validation/nanocredito";
import { useFormContext } from "react-hook-form";

export function SeccionDomicilio() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<NanocreditoFormValues>();

  const departamento = watch("departamento");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Select
        label="Departamento"
        options={opcionesDepartamento}
        placeholder="Seleccionar..."
        required
        error={errors.departamento?.message}
        {...register("departamento", {
          onChange: () => setValue("municipio", ""),
        })}
      />
      <Select
        label="Municipio"
        options={opcionesMunicipio(departamento)}
        placeholder={departamento ? "Seleccionar..." : "Primero elige un departamento"}
        required
        disabled={!departamento}
        error={errors.municipio?.message}
        {...register("municipio")}
      />
      <Select
        label="Sector"
        options={SECTORES_DOMICILIO}
        placeholder="Seleccionar..."
        required
        error={errors.sectorDomicilio?.message}
        {...register("sectorDomicilio")}
      />
      <div className="md:col-span-2">
        <Input
          label="Dirección"
          autoComplete="street-address"
          required
          error={errors.direccion?.message}
          {...register("direccion")}
        />
      </div>
      <Input label="Barrio" required error={errors.barrio?.message} {...register("barrio")} />
    </div>
  );
}
