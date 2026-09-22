"use client";

import { Input } from "@/presentation/components/ui/Input";
import { Select } from "@/presentation/components/ui/Select";
import {
  TIPOS_IDENTIFICACION_LIBRANZA,
  GENEROS,
  ESTADOS_CIVILES,
  ESTRATOS,
  NIVELES_EDUCACION,
} from "@/shared/config/creditos/opciones";
import {
  formatDocumentInput,
  getDocumentFormatHint,
  isValidDocumentFormat,
} from "@/domain/identity/cedula-local";
import { opcionesDepartamento, opcionesMunicipio } from "@/shared/data/colombia";
import type { LibranzaFormValues } from "@/shared/validation/libranza/schema";
import { useCallback, useState } from "react";
import { useFormContext } from "react-hook-form";

type VerificationUi = {
  status: string;
  message: string;
  registeredName?: string;
  localChecks?: string[];
} | null;

export function SeccionDatosPersonales() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<LibranzaFormValues>();

  const [verification, setVerification] = useState<VerificationUi>(null);
  const [checking, setChecking] = useState(false);

  const tipoIdentificacion = watch("tipoIdentificacion");
  const cedula = watch("cedula");
  const nombre = watch("nombre");
  const fechaNacimiento = watch("fechaNacimiento");
  const fechaExpedicion = watch("fechaExpedicion");
  const departamento = watch("departamento");
  const estadoCivil = watch("estadoCivil");

  const verifyDocument = useCallback(async () => {
    if (
      !tipoIdentificacion ||
      !cedula ||
      !isValidDocumentFormat(tipoIdentificacion, cedula) ||
      !nombre ||
      !fechaNacimiento ||
      !fechaExpedicion
    ) {
      setVerification(null);
      return;
    }

    setChecking(true);
    try {
      const response = await fetch("/api/verify-cedula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: tipoIdentificacion,
          documentNumber: cedula,
          nombre,
          fechaNacimiento,
          fechaExpedicion,
        }),
      });

      const result = (await response.json()) as {
        verification?: VerificationUi;
      };

      setVerification(result.verification ?? null);
    } catch {
      setVerification({
        status: "service_unavailable",
        message: "No pudimos validar el documento en este momento.",
      });
    } finally {
      setChecking(false);
    }
  }, [cedula, fechaExpedicion, fechaNacimiento, nombre, tipoIdentificacion]);

  const isSuccess =
    verification?.status === "valid_local" ||
    verification?.status === "valid" ||
    verification?.status === "not_configured";

  const verificationClass = checking
    ? "border-gray-200 bg-gray-50 text-gray-700"
    : isSuccess
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  const cedulaField = register("cedula");
  const documentHint = tipoIdentificacion ? getDocumentFormatHint(tipoIdentificacion) : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Input
          label="Nombres y apellidos"
          autoComplete="name"
          required
          error={errors.nombre?.message}
          {...register("nombre", {
            onBlur: () => {
              void verifyDocument();
            },
          })}
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
        options={TIPOS_IDENTIFICACION_LIBRANZA}
        placeholder="Seleccionar..."
        required
        error={errors.tipoIdentificacion?.message}
        {...register("tipoIdentificacion", {
          onChange: () => setVerification(null),
        })}
      />
      <Input
        label="Número de identificación"
        inputMode={tipoIdentificacion === "CE" ? "text" : "numeric"}
        autoComplete="off"
        required
        helperText={documentHint}
        maxLength={10}
        error={errors.cedula?.message}
        name={cedulaField.name}
        ref={cedulaField.ref}
        value={cedula ?? ""}
        onChange={(event) => {
          const formatted = tipoIdentificacion
            ? formatDocumentInput(tipoIdentificacion, event.target.value)
            : event.target.value;
          setValue("cedula", formatted, { shouldDirty: true, shouldValidate: true });
        }}
        onBlur={(event) => {
          void cedulaField.onBlur(event);
          void verifyDocument();
        }}
      />
      <Input
        label="Teléfono celular"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="3001234567"
        helperText="Celular colombiano de 10 dígitos."
        required
        error={errors.telefono?.message}
        {...register("telefono")}
      />

      {(checking || verification) && (
        <div className={`md:col-span-2 rounded-lg border px-4 py-3 text-sm ${verificationClass}`}>
          {checking ? (
            <p>Validando documento…</p>
          ) : (
            <>
              <p className="font-medium">{verification?.message}</p>
              {verification?.registeredName && (
                <p className="mt-1 text-xs opacity-80">
                  Nombre registrado: {verification.registeredName}
                </p>
              )}
              {verification?.localChecks && verification.localChecks.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs opacity-90">
                  {verification.localChecks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

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
      {(estadoCivil === "casado" || estadoCivil === "union_libre") && (
        <div className="md:col-span-2">
          <Input
            label="Nombre completo del cónyuge"
            helperText="Opcional. Déjalo en blanco si no aplica."
            error={errors.nombreConyuge?.message}
            {...register("nombreConyuge")}
          />
        </div>
      )}
      <Input
        label="Fecha de nacimiento"
        type="date"
        required
        error={errors.fechaNacimiento?.message}
        {...register("fechaNacimiento", {
          onBlur: () => {
            void verifyDocument();
          },
        })}
      />
      <Input
        label="Fecha de expedición del documento"
        type="date"
        required
        error={errors.fechaExpedicion?.message}
        {...register("fechaExpedicion", {
          onBlur: () => {
            void verifyDocument();
          },
        })}
      />
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
      <Input
        label="Ciudad"
        required
        error={errors.ciudad?.message}
        {...register("ciudad")}
      />
      <Input
        label="Dirección"
        autoComplete="street-address"
        required
        error={errors.direccion?.message}
        {...register("direccion")}
      />
      <Input
        label="Barrio"
        required
        error={errors.barrio?.message}
        {...register("barrio")}
      />
      <Select
        label="Estrato"
        options={ESTRATOS}
        placeholder="Seleccionar..."
        required
        error={errors.estrato?.message}
        {...register("estrato")}
      />
      <Select
        label="Nivel de educación"
        options={NIVELES_EDUCACION}
        placeholder="Seleccionar..."
        required
        error={errors.nivelEducacion?.message}
        {...register("nivelEducacion")}
      />
      <Input
        label="Profesión"
        required
        error={errors.profesion?.message}
        {...register("profesion")}
      />
    </div>
  );
}
