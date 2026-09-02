"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  opcionesParentescoReferencia,
  TIPOS_REFERENCIA,
} from "@/config/creditos/opciones";
import type { NanocreditoFormValues } from "@/lib/validation/nanocredito";
import { useFormContext } from "react-hook-form";

export function SeccionReferenciaFamiliar() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<NanocreditoFormValues>();

  const referenciaTipo = watch("referenciaTipo");
  const referenciaParentesco = watch("referenciaParentesco");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Select
        label="Tipo de referencia"
        options={TIPOS_REFERENCIA}
        placeholder="Seleccionar..."
        required
        error={errors.referenciaTipo?.message}
        {...register("referenciaTipo", {
          onChange: (event) => {
            if (event.target.value !== referenciaTipo) {
              setValue("referenciaParentesco", "", { shouldValidate: true });
              setValue("referenciaParentescoOtro", "", { shouldValidate: true });
            }
          },
        })}
      />
      <Select
        label={referenciaTipo === "personal" ? "Relación con la persona" : "Parentesco"}
        options={opcionesParentescoReferencia(referenciaTipo)}
        placeholder={referenciaTipo ? "Seleccionar..." : "Primero elige el tipo de referencia"}
        required
        disabled={!referenciaTipo}
        error={errors.referenciaParentesco?.message}
        {...register("referenciaParentesco", {
          onChange: (event) => {
            if (event.target.value !== "otro") {
              setValue("referenciaParentescoOtro", "", { shouldValidate: true });
            }
          },
        })}
      />
      {referenciaParentesco === "otro" && (
        <div className="md:col-span-2">
          <Input
            label={
              referenciaTipo === "personal"
                ? "Describe la relación con la persona"
                : "Describe el parentesco"
            }
            placeholder="Ej. padrino, nuera, jefe directo, etc."
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
