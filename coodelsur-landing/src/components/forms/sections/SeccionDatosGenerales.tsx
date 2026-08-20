"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  ESTADOS_CIVILES,
  ESTRATOS,
  GENEROS,
  TIPOS_IDENTIFICACION,
} from "@/config/creditos/opciones";
import type { NanocreditoFormValues } from "@/lib/validation/nanocredito";
import { useFormContext } from "react-hook-form";

export function SeccionDatosGenerales() {
  const {
    register,
    formState: { errors },
  } = useFormContext<NanocreditoFormValues>();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Input
          label="Nombre y apellido"
          autoComplete="name"
          required
          error={errors.nombre?.message}
          {...register("nombre")}
        />
      </div>
      <Input
        label="E-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register("email")}
      />
      <Select
        label="Tipo de identificación"
        options={TIPOS_IDENTIFICACION}
        placeholder="Seleccionar..."
        required
        error={errors.tipoIdentificacion?.message}
        {...register("tipoIdentificacion")}
      />
      <Input
        label="Número de identificación"
        inputMode="numeric"
        required
        error={errors.cedula?.message}
        {...register("cedula")}
      />
      <Input
        label="Teléfono celular"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="3001234567"
        helperText="Celular colombiano de 10 dígitos (puede incluir +57)."
        required
        error={errors.telefono?.message}
        {...register("telefono")}
      />
      <Select
        label="Género"
        options={GENEROS}
        placeholder="Seleccionar..."
        required
        error={errors.genero?.message}
        {...register("genero")}
      />
      <Select
        label="Estado civil"
        options={ESTADOS_CIVILES}
        placeholder="Seleccionar..."
        required
        error={errors.estadoCivil?.message}
        {...register("estadoCivil")}
      />
      <Input
        label="Fecha de nacimiento"
        type="date"
        required
        error={errors.fechaNacimiento?.message}
        {...register("fechaNacimiento")}
      />
      <Input
        label="Fecha de expedición del documento"
        type="date"
        required
        error={errors.fechaExpedicion?.message}
        {...register("fechaExpedicion")}
      />
      <Input
        label="Número de personas a cargo"
        type="number"
        inputMode="numeric"
        min={0}
        required
        error={errors.personasACargo?.message}
        {...register("personasACargo")}
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
