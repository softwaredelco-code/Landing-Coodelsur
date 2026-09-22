"use client";

import { Input } from "@/presentation/components/ui/Input";
import { Select } from "@/presentation/components/ui/Select";
import { ESTRATOS } from "@/shared/config/creditos/opciones";
import { opcionesDepartamento, opcionesMunicipio } from "@/shared/data/colombia";
import type { MicrocreditoUrbanoFormValues } from "@/shared/validation/microcredito-urbano/schema";
import { useFormContext } from "react-hook-form";

export function SeccionDomicilio() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<MicrocreditoUrbanoFormValues>();

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
      <Input
        label="Ciudad"
        autoComplete="address-level2"
        required
        error={errors.ciudad?.message}
        {...register("ciudad")}
      />
      <Select
        label="Estrato"
        options={ESTRATOS}
        placeholder="Seleccionar..."
        required
        error={errors.estrato?.message}
        {...register("estrato")}
      />
    </div>
  );
}
