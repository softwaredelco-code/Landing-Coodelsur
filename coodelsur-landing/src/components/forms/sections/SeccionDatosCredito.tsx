"use client";

/**
 * Datos del crédito dentro del formulario de Nanocrédito.
 * El monto se mantiene acotado al rango del producto detectado
 * (ver `config/creditos/montos.ts`).
 */

import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Select } from "@/components/ui/Select";
import {
  ANOS_PAGO,
  CANTIDAD_CUOTAS,
  DESTINOS_CREDITO,
  DIAS_PAGO,
  MESES,
  SI_NO,
} from "@/config/creditos/opciones";
import { getRangoPorTipo } from "@/config/creditos/montos";
import { formatCOP } from "@/lib/utils";
import type { NanocreditoFormValues } from "@/lib/validation/nanocredito";
import { useEffect, useRef } from "react";
import { Controller, useFormContext } from "react-hook-form";

const SMALL = getRangoPorTipo("microcredito_small")!;

export function SeccionDatosCredito() {
  const {
    register,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<NanocreditoFormValues>();

  const capital = Number(watch("capitalSeleccionado") || 0);
  const cuotas = Number(watch("cantidadCuotas") || 0);
  const cuotaEditada = useRef(false);

  useEffect(() => {
    if (cuotaEditada.current) return;
    if (capital > 0 && cuotas > 0) {
      setValue("valorCuota", Math.round(capital / cuotas), { shouldDirty: true });
    }
  }, [capital, cuotas, setValue]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="capitalSeleccionado" className="text-sm font-medium text-coodel-dark">
          Capital seleccionado <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Microcrédito Small: {formatCOP(SMALL.min)} – {formatCOP(SMALL.max)}
        </p>
        <p className="mt-1 text-lg font-semibold text-coodel-primary">{formatCOP(capital || 0)}</p>
        <input
          id="capitalSlider"
          type="range"
          min={SMALL.min}
          max={SMALL.max}
          step={SMALL.step}
          value={Math.min(Math.max(capital || SMALL.min, SMALL.min), SMALL.max)}
          onChange={(event) => {
            cuotaEditada.current = false;
            setValue("capitalSeleccionado", Number(event.target.value), { shouldValidate: true });
            setValue("tipoCredito", "microcredito_small", { shouldDirty: false });
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
                  cuotaEditada.current = false;
                  const clamped = Math.min(SMALL.max, Math.max(SMALL.min, next || SMALL.min));
                  field.onChange(clamped);
                  setValue("tipoCredito", "microcredito_small", { shouldDirty: false });
                }}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.capitalSeleccionado?.message}
              />
            )}
          />
        </div>
      </div>

      <Select
        label="Cantidad de cuotas"
        options={CANTIDAD_CUOTAS}
        placeholder="Seleccionar..."
        required
        error={errors.cantidadCuotas?.message}
        {...register("cantidadCuotas", {
          onChange: () => {
            cuotaEditada.current = false;
          },
        })}
      />
      <Controller
        name="valorCuota"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            label="Valor de cuota"
            name={field.name}
            value={field.value}
            required
            onValueChange={(next) => {
              cuotaEditada.current = true;
              field.onChange(next);
            }}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.valorCuota?.message}
          />
        )}
      />

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

      <div className="md:col-span-2">
        <p className="mb-2 text-sm font-medium text-coodel-dark">Fecha de pago oportuno</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Día"
            options={DIAS_PAGO}
            placeholder="Día"
            required
            error={errors.diaPago?.message}
            {...register("diaPago")}
          />
          <Select
            label="Mes"
            options={MESES}
            placeholder="Mes"
            required
            error={errors.mesPago?.message}
            {...register("mesPago")}
          />
          <Select
            label="Año"
            options={ANOS_PAGO}
            placeholder="Año"
            required
            error={errors.anoPago?.message}
            {...register("anoPago")}
          />
        </div>
      </div>

      <div className="md:col-span-2">
        <Select
          label="¿Tiene actualmente una mora vigente en centrales de riesgo (Datacrédito y/o TransUnion-Cifin)?"
          options={SI_NO}
          placeholder="Seleccionar..."
          required
          error={errors.moraVigente?.message}
          {...register("moraVigente")}
        />
      </div>

      <Controller
        name="ingresosMensuales"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            label="Ingresos mensuales"
            name={field.name}
            value={field.value}
            required
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.ingresosMensuales?.message}
          />
        )}
      />
      <Controller
        name="otrosIngresos"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            label="Otros ingresos"
            name={field.name}
            value={field.value}
            helperText="Opcional"
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.otrosIngresos?.message}
          />
        )}
      />
    </div>
  );
}
