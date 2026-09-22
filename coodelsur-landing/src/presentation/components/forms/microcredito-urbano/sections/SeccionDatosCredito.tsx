"use client";

/**
 * Datos del crédito — Microcrédito urbano.
 * El monto se mantiene acotado al rango del producto (ver `montos.ts`).
 */

import { CurrencyInput } from "@/presentation/components/ui/CurrencyInput";
import { Input } from "@/presentation/components/ui/Input";
import { Select } from "@/presentation/components/ui/Select";
import { useParametrosAmortizacion } from "@/presentation/contexts/ParametrosAmortizacionContext";
import {
  DESTINOS_CREDITO_URBANO,
  DIAS_PAGO_CUOTA_URBANO,
  ORIGENES_OTROS_INGRESOS,
  SI_NO,
} from "@/shared/config/creditos/opciones";
import { getRangoPorTipo } from "@/shared/config/creditos/montos";
import { calcularDesgloseCuota } from "@/domain/credito/amortizacion";
import { formatCOP } from "@/shared/utils";
import type { MicrocreditoUrbanoFormValues } from "@/shared/validation/microcredito-urbano/schema";
import { useEffect, useMemo } from "react";
import { Controller, useFormContext } from "react-hook-form";

const URBANO = getRangoPorTipo("microcredito_urbano")!;

export function SeccionDatosCredito() {
  const {
    register,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<MicrocreditoUrbanoFormValues>();

  const capital = Number(watch("capitalSeleccionado") || 0);
  const cuotas = Number(watch("cantidadCuotas") || 0);
  const tipoCredito = watch("tipoCredito") || "microcredito_urbano";
  const origenOtrosIngresos = watch("origenOtrosIngresos");
  const parametros = useParametrosAmortizacion(tipoCredito);
  const opcionesCuotas = useMemo(
    () =>
      parametros.plazosPermitidos.map((n) => ({
        label: `${n} cuotas`,
        value: String(n),
      })),
    [parametros.plazosPermitidos],
  );

  const desglose = useMemo(() => {
    if (capital <= 0 || cuotas <= 0) return null;
    return calcularDesgloseCuota(tipoCredito, capital, cuotas, parametros);
  }, [capital, cuotas, tipoCredito, parametros]);

  useEffect(() => {
    if (!desglose) return;

    setValue("valorCuota", desglose.valorCuotaTotal, { shouldDirty: true, shouldValidate: true });
    setValue("valorCreditoFinanciado", desglose.valorCreditoFinanciado, { shouldDirty: true });
    setValue("estudioCredito", desglose.estudioCredito, { shouldDirty: true });
    setValue("cuotaCapitalInteres", desglose.cuotaCapitalInteres, { shouldDirty: true });
    setValue("cuotaFianzaMensual", desglose.fianzaMensual, { shouldDirty: true });
    setValue("cuotaVidaDeudoresMensual", desglose.vidaDeudoresMensual, { shouldDirty: true });
  }, [desglose, setValue]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="capitalSeleccionado" className="text-sm font-medium text-coodel-dark">
          Capital seleccionado <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Microcrédito urbano: {formatCOP(URBANO.min)} – {formatCOP(URBANO.max)}
        </p>
        <p className="mt-1 text-lg font-semibold text-coodel-primary">{formatCOP(capital || 0)}</p>
        <input
          id="capitalSlider"
          type="range"
          min={URBANO.min}
          max={URBANO.max}
          step={URBANO.step}
          value={Math.min(Math.max(capital || URBANO.min, URBANO.min), URBANO.max)}
          onChange={(event) => {
            setValue("capitalSeleccionado", Number(event.target.value), { shouldValidate: true });
            setValue("tipoCredito", "microcredito_urbano", { shouldDirty: false });
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
                  const clamped = Math.min(URBANO.max, Math.max(URBANO.min, next || URBANO.min));
                  field.onChange(clamped);
                  setValue("tipoCredito", "microcredito_urbano", { shouldDirty: false });
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
            options={opcionesCuotas}
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
          options={DESTINOS_CREDITO_URBANO}
          placeholder="Seleccionar..."
          required
          error={errors.destinoCredito?.message}
          {...register("destinoCredito")}
        />
      </div>

      <div className="md:col-span-2">
        <Select
          label="Día de pago de la cuota"
          options={DIAS_PAGO_CUOTA_URBANO}
          placeholder="Seleccionar..."
          required
          error={errors.diaPagoCuota?.message}
          {...register("diaPagoCuota")}
        />
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
        name="egresosMensuales"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            label="Egresos mensuales"
            name={field.name}
            value={field.value}
            required
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            error={errors.egresosMensuales?.message}
          />
        )}
      />

      <div className="md:col-span-2 rounded-lg border border-gray-100 bg-coodel-surface/40 p-4">
        <p className="mb-3 text-sm font-medium text-coodel-dark">Otros ingresos</p>
        <p className="mb-3 text-xs text-gray-500">Opcional. Complétalo si recibes ingresos adicionales.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="¿De dónde provienen?"
            options={ORIGENES_OTROS_INGRESOS}
            placeholder="Seleccionar..."
            error={errors.origenOtrosIngresos?.message}
            {...register("origenOtrosIngresos", {
              onChange: (event) => {
                if (event.target.value !== "otro") {
                  setValue("origenOtrosIngresosOtro", "", { shouldValidate: true });
                }
              },
            })}
          />
          <Controller
            name="otrosIngresos"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                label="Valor de otros ingresos"
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                error={errors.otrosIngresos?.message}
              />
            )}
          />
          {origenOtrosIngresos === "otro" && (
            <div className="md:col-span-2">
              <Input
                label="Describe el origen de tus otros ingresos"
                placeholder="Ej. venta de productos caseros, comisiones, etc."
                required
                error={errors.origenOtrosIngresosOtro?.message}
                {...register("origenOtrosIngresosOtro")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
