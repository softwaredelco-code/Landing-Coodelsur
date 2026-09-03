"use client";

import { Input } from "@/presentation/components/ui/Input";
import { Select } from "@/presentation/components/ui/Select";
import { TIPOS_CUENTA } from "@/shared/config/creditos/opciones";
import { opcionesBancos } from "@/shared/data/bancos";
import type { NanocreditoFormValues } from "@/shared/validation/nanocredito";
import { useFormContext } from "react-hook-form";

export function SeccionDatosBancarios() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<NanocreditoFormValues>();

  const tipoCuenta = watch("tipoCuenta");
  const esLlave = tipoCuenta === "llave";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Select
        label="Tipo de cuenta"
        options={TIPOS_CUENTA}
        placeholder="Seleccionar..."
        required
        error={errors.tipoCuenta?.message}
        {...register("tipoCuenta", {
          onChange: () => setValue("numeroCuenta", "", { shouldValidate: true }),
        })}
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
          label={esLlave ? "Llave bancaria" : "Número de cuenta"}
          inputMode={esLlave ? "text" : "numeric"}
          placeholder={
            esLlave ? "Ej. 3001234567, correo@ejemplo.com o @usuario" : "Ej. 1234567890"
          }
          helperText={
            esLlave
              ? "Puede ser tu celular, cédula, correo electrónico o código alfanumérico registrado en Bre-B."
              : undefined
          }
          required
          error={errors.numeroCuenta?.message}
          {...register("numeroCuenta")}
        />
      </div>
    </div>
  );
}
