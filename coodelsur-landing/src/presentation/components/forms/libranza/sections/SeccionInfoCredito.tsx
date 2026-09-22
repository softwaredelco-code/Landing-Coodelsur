"use client";

import { CurrencyInput } from "@/presentation/components/ui/CurrencyInput";
import { Select } from "@/presentation/components/ui/Select";
import {
  DESTINOS_CREDITO,
  CUOTAS_LIBRANZA,
} from "@/shared/config/creditos/opciones";
import { formatCOP } from "@/shared/utils";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { Controller, useFormContext } from "react-hook-form";

const LIBRANZA_MIN = 700_000;
const LIBRANZA_MAX = 20_000_000;
const LIBRANZA_STEP = 100_000;

export function SeccionInfoCredito() {
  const {
    register,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  const capital = Number(watch("capitalSeleccionado") || 0);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="capitalSeleccionado" className="text-sm font-medium text-coodel-dark">
          Capital seleccionado <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Crédito Libranza: {formatCOP(LIBRANZA_MIN)} – {formatCOP(LIBRANZA_MAX)}
        </p>
        <p className="mt-1 text-lg font-semibold text-coodel-primary">{formatCOP(capital || 0)}</p>
        <input
          id="capitalSlider"
          type="range"
          min={LIBRANZA_MIN}
          max={LIBRANZA_MAX}
          step={LIBRANZA_STEP}
          value={Math.min(Math.max(capital || LIBRANZA_MIN, LIBRANZA_MIN), LIBRANZA_MAX)}
          onChange={(event) => {
            setValue("capitalSeleccionado", Number(event.target.value), { shouldValidate: true });
          }}
          className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-coodel-accent"
        />
        <div className="mt-3">
          <Controller
            name="capitalSeleccionado"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                label="Ajustar monto"
                name={field.name}
                value={field.value}
                onValueChange={(next) => {
                  const clamped = Math.min(LIBRANZA_MAX, Math.max(LIBRANZA_MIN, next || LIBRANZA_MIN));
                  field.onChange(clamped);
                }}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.capitalSeleccionado?.message}
              />
            )}
          />
        </div>
      </div>

      <Controller
        name="cantidadCuotas"
        control={control}
        render={({ field }) => (
          <Select
            label="Cantidad de cuotas"
            options={CUOTAS_LIBRANZA}
            placeholder="Seleccionar..."
            required
            name={field.name}
            value={field.value != null ? String(field.value) : ""}
            onChange={(event) => {
              const next = Number(event.target.value);
              field.onChange(Number.isFinite(next) ? next : event.target.value);
            }}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.cantidadCuotas?.message}
          />
        )}
      />

      <div>
        <label className="text-sm font-medium text-coodel-dark">
          Valor de cuota mensual
        </label>
        <div className="mt-1 rounded-lg border border-coodel-accent/20 bg-coodel-accent/5 px-4 py-3">
          <p className="text-sm text-coodel-body">
            El cálculo de la cuota para Libranza será definido próximamente.
            Por ahora, este campo se completará manualmente o se dejará vacío.
          </p>
        </div>
      </div>

      <div className="md:col-span-2">
        <Select
          label="Destino del crédito"
          options={DESTINOS_CREDITO}
          placeholder="Seleccionar..."
          required
          error={errors.destinoCredito?.message}
          {...register("destinoCredito")}
        />
      </div>
    </div>
  );
}
