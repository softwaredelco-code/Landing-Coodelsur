"use client";

import { Select } from "@/presentation/components/ui/Select";
import {
  DIAS_PAGO_LIBRANZA,
  MESES,
  ANOS_PAGO,
} from "@/shared/config/creditos/opciones";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { useFormContext } from "react-hook-form";

export function SeccionFechaPago() {
  const {
    register,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="md:col-span-3">
        <div className="rounded-lg border border-coodel-accent/20 bg-coodel-accent/5 px-4 py-3">
          <p className="text-sm text-coodel-body">
            <strong>Nota:</strong> Para este producto, la fecha de pago depende del acuerdo que se
            tenga con la entidad pagadora.
          </p>
        </div>
      </div>
      <Select
        label="Día de pago"
        options={DIAS_PAGO_LIBRANZA}
        placeholder="Seleccionar..."
        required
        error={errors.diaPagoOportuno?.message}
        {...register("diaPagoOportuno")}
      />
      <Select
        label="Mes de pago"
        options={MESES}
        placeholder="Seleccionar..."
        required
        error={errors.mesPagoOportuno?.message}
        {...register("mesPagoOportuno")}
      />
      <Select
        label="Año de pago"
        options={ANOS_PAGO}
        placeholder="Seleccionar..."
        required
        error={errors.anoPagoOportuno?.message}
        {...register("anoPagoOportuno")}
      />
    </div>
  );
}
