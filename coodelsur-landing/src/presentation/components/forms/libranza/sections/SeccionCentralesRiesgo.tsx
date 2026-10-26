"use client";

import { CurrencyInput } from "@/presentation/components/ui/CurrencyInput";
import { Input } from "@/presentation/components/ui/Input";
import { Select } from "@/presentation/components/ui/Select";
import { SI_NO, SI_NO_NOSE, TIEMPOS_MORA } from "@/shared/config/creditos/opciones";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { Controller, useFormContext } from "react-hook-form";

export function SeccionCentralesRiesgo() {
  const {
    register,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  const moraVigente = watch("moraVigente");
  const tieneCodeudor = watch("tieneCodeudor");

  return (
    <div className="grid grid-cols-1 gap-4">
      <Select
        label="¿Tiene actualmente una mora vigente en centrales de riesgo (Datacrédito y/o TransUnion-CIFIN)?"
        options={SI_NO_NOSE}
        placeholder="Seleccionar..."
        required
        error={errors.moraVigente?.message}
        {...register("moraVigente", {
          onChange: (event) => {
            if (event.target.value !== "si") {
              setValue("moraEntidad", "", { shouldValidate: true });
              setValue("moraTiempo", "", { shouldValidate: true });
              setValue("moraValor", undefined, { shouldValidate: true });
              setValue("tieneCodeudor", "", { shouldValidate: true });
              setValue("codeudorNombre", "", { shouldValidate: true });
              setValue("codeudorCedula", "", { shouldValidate: true });
              setValue("codeudorTelefono", "", { shouldValidate: true });
            }
          },
        })}
      />

      {moraVigente === "si" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Detalle de la mora reportada
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 [&_label]:min-h-[2.75rem] [&_label]:flex [&_label]:items-end">
            <div>
              <Input
                label="¿Con qué entidad tiene la mora?"
                placeholder="Ej. Bancolombia, Claro..."
                required
                error={errors.moraEntidad?.message}
                {...register("moraEntidad")}
              />
            </div>
            <div>
              <Select
                label="¿Hace cuánto tiempo tiene la mora?"
                options={TIEMPOS_MORA}
                placeholder="Seleccionar..."
                required
                error={errors.moraTiempo?.message}
                {...register("moraTiempo")}
              />
            </div>
            <div>
              <Controller
                name="moraValor"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    label="¿De qué monto es la mora?"
                    name={field.name}
                    value={field.value}
                    required
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    error={errors.moraValor?.message}
                  />
                )}
              />
            </div>
          </div>

          {/* Sección de Codeudor si tiene reporte */}
          <div className="pt-3 border-t border-amber-200/80 space-y-3">
            <div className="flex items-center gap-2 text-coodel-dark font-medium text-sm">
              <svg className="h-4 w-4 text-coodel-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Codeudor (Persona sin reporte en centrales)</span>
            </div>

            <div>
              <Select
                label="¿Cuenta con un codeudor que no esté reportado?"
                options={SI_NO}
                placeholder="Seleccionar..."
                required
                error={errors.tieneCodeudor?.message}
                {...register("tieneCodeudor", {
                  onChange: (event) => {
                    if (event.target.value !== "si") {
                      setValue("codeudorNombre", "", { shouldValidate: true });
                      setValue("codeudorCedula", "", { shouldValidate: true });
                      setValue("codeudorTelefono", "", { shouldValidate: true });
                    }
                  },
                })}
              />
            </div>

            {tieneCodeudor === "si" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 pt-1">
                <div>
                  <Input
                    label="Nombre del codeudor"
                    placeholder="Nombres y apellidos completos"
                    required
                    error={errors.codeudorNombre?.message}
                    {...register("codeudorNombre")}
                  />
                </div>
                <div>
                  <Input
                    label="Cédula del codeudor"
                    placeholder="Ej. 1020304050"
                    required
                    error={errors.codeudorCedula?.message}
                    {...register("codeudorCedula", {
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\D/g, "");
                      },
                    })}
                  />
                </div>
                <div>
                  <Input
                    label="Teléfono del codeudor"
                    placeholder="Ej. 3001234567"
                    type="tel"
                    required
                    error={errors.codeudorTelefono?.message}
                    {...register("codeudorTelefono", {
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\D/g, "");
                      },
                    })}
                  />
                </div>
              </div>
            )}

            {tieneCodeudor === "no" && (
              <p className="text-xs text-amber-800 bg-amber-100/70 p-2.5 rounded-md">
                Nota: Contar con un codeudor sin reporte en centrales agiliza el estudio y aumenta las probabilidades de aprobación de tu crédito.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

