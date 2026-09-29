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
import { useParametrosAmortizacion } from "@/presentation/contexts/ParametrosAmortizacionContext";
import { calcularDesgloseCuota } from "@/domain/credito/amortizacion";
import { useEffect, useMemo } from "react";

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
  const cuotas = Number(watch("cantidadCuotas") || 0);
  const parametros = useParametrosAmortizacion("libranza");

  const desglose = useMemo(() => {
    if (capital <= 0 || cuotas <= 0) return null;
    return calcularDesgloseCuota("libranza", capital, cuotas, parametros);
  }, [capital, cuotas, parametros]);

  useEffect(() => {
    if (!desglose) return;
    setValue("valorCuota", desglose.valorCuotaTotal, { shouldDirty: true, shouldValidate: true });
  }, [desglose, setValue]);

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
          Valor de cuota mensual <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-lg font-semibold text-coodel-primary">
          {formatCOP(desglose?.valorCuotaTotal ?? Number(watch("valorCuota") || 0))}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Calculado con tasa del {(parametros.tasaMensual * 100).toFixed(1).replace(".", ",")} %
          mensual, fianza ({(parametros.fianzaMensualPorcentaje * 100).toFixed(2).replace(".", ",")}{" "}
          % del monto) y vida deudores (
          {(parametros.vidaDeudoresPorcentaje * 100).toFixed(4).replace(".", ",")} % del monto).
        </p>
        {errors.valorCuota?.message && (
          <p className="mt-1 text-xs text-red-600">{errors.valorCuota.message}</p>
        )}
      </div>

      {desglose && (
        <div className="md:col-span-2 rounded-lg border border-gray-100 bg-coodel-surface/40 p-4 text-sm text-coodel-body">
          <p className="font-medium text-coodel-dark">Desglose estimado de tu cuota</p>
          <ul className="mt-2 space-y-1">
            <li className="flex justify-between gap-4">
              <span>Capital + intereses</span>
              <span className="font-medium">{formatCOP(desglose.cuotaCapitalInteres)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Fianza mensual</span>
              <span className="font-medium">{formatCOP(desglose.fianzaMensual)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Vida deudores</span>
              <span className="font-medium">{formatCOP(desglose.vidaDeudoresMensual)}</span>
            </li>
            <li className="flex justify-between gap-4 border-t border-gray-200 pt-2 font-medium text-coodel-dark">
              <span>Total cuota</span>
              <span>{formatCOP(desglose.valorCuotaTotal)}</span>
            </li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            Estudio de crédito (cargo único de {formatCOP(desglose.estudioCredito)}): incluido en la
            base de amortización ({formatCOP(desglose.valorCreditoFinanciado)} = capital solicitado +
            estudio).
          </p>
        </div>
      )}

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
