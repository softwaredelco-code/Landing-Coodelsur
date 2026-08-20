"use client";

import { Button } from "@/components/ui/Button";
import { formatCOP } from "@/lib/utils";
import type { NanocreditoFormValues } from "@/lib/validation/nanocredito";
import Link from "next/link";

interface ConfirmacionSolicitudProps {
  data: NanocreditoFormValues;
  leadId?: string | null;
  onNuevaSolicitud: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-gray-100 py-2 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-coodel-dark sm:text-right">{value}</dd>
    </div>
  );
}

export function ConfirmacionSolicitud({
  data,
  leadId,
  onNuevaSolicitud,
}: ConfirmacionSolicitudProps) {
  return (
    <div className="border border-gray-200 bg-white p-6 shadow-sm md:p-10">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-coodel-accent/10 text-coodel-accent">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-center text-2xl font-bold text-coodel-dark">Solicitud recibida</h2>
      <p className="mx-auto mt-2 max-w-md text-center text-coodel-body">
        En breve te contactaremos. Un asesor de Coodelsur revisará tus datos y se comunicará contigo.
      </p>
      {leadId && (
        <p className="mt-3 text-center text-xs text-gray-500">
          Número de solicitud: <span className="font-mono text-coodel-dark">{leadId}</span>
        </p>
      )}

      <dl className="mt-8">
        <Row label="Nombre" value={data.nombre} />
        <Row label="E-mail" value={data.email} />
        <Row label="Celular" value={data.telefono} />
        <Row label="Identificación" value={`${data.tipoIdentificacion} ${data.cedula}`} />
        <Row label="Capital" value={formatCOP(Number(data.capitalSeleccionado))} />
        <Row label="Cuotas" value={String(data.cantidadCuotas)} />
        <Row label="Valor cuota" value={formatCOP(Number(data.valorCuota))} />
        <Row label="Domicilio" value={`${data.municipio}, ${data.departamento}`} />
        <Row label="Cédula frontal" value={data.cedulaFrontal?.fileName ? "Archivo cargado" : "—"} />
        <Row label="Cédula reverso" value={data.cedulaReverso?.fileName ? "Archivo cargado" : "—"} />
        <Row label="Video" value={data.videoVerificacion?.fileName ? "Video cargado" : "—"} />
        <Row label="Firma" value={data.firma ? "Capturada" : "—"} />
        <Row
          label="Hábeas data"
          value={
            data.aceptaTerminos
              ? data.fechaAceptacionTerminos
                ? `Aceptado · ${new Date(data.fechaAceptacionTerminos).toLocaleString("es-CO")}`
                : "Aceptado"
              : "No aceptado"
          }
        />
        <Row
          label="Ubicación"
          value={
            data.geolocalizacion
              ? `${data.geolocalizacion.lat.toFixed(5)}, ${data.geolocalizacion.lng.toFixed(5)}`
              : "No capturada"
          }
        />
      </dl>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/">
          <Button variant="primary" className="w-full sm:w-auto">
            Volver a formularios
          </Button>
        </Link>
        <Button variant="outline" type="button" onClick={onNuevaSolicitud} className="w-full sm:w-auto">
          Nueva solicitud
        </Button>
      </div>
    </div>
  );
}
