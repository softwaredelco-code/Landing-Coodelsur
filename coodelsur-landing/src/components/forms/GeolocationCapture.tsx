"use client";

import type { GeoCoords } from "@/types/credito";
import { useState } from "react";

interface GeolocationCaptureProps {
  value?: GeoCoords;
  onChange: (coords: GeoCoords | undefined) => void;
  error?: string;
}

type GeoStatus = "idle" | "loading" | "success" | "denied" | "unavailable";

export function GeolocationCapture({ value, onChange, error }: GeolocationCaptureProps) {
  const [status, setStatus] = useState<GeoStatus>(value ? "success" : "idle");

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("success");
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-coodel-dark">Georreferenciación</p>
      <p className="text-xs text-gray-500">
        Permite al navegador capturar tu ubicación aproximada. No se envía a ningún servidor todavía.
      </p>
      <button
        type="button"
        onClick={captureLocation}
        disabled={status === "loading"}
        className="w-fit rounded-lg border border-coodel-primary px-4 py-2.5 text-sm font-medium text-coodel-primary transition-colors hover:bg-coodel-primary hover:text-white disabled:opacity-60"
      >
        {status === "loading" ? "Obteniendo ubicación…" : value ? "Volver a capturar ubicación" : "Capturar ubicación"}
      </button>

      {status === "success" && value && (
        <p className="rounded-lg border border-coodel-accent/30 bg-coodel-accent/10 px-3 py-2 text-sm text-coodel-accent">
          Ubicación capturada ({value.lat.toFixed(5)}, {value.lng.toFixed(5)})
        </p>
      )}
      {status === "denied" && (
        <p className="text-xs text-amber-700">
          No se otorgó permiso de ubicación. Puedes continuar y capturarla más adelante.
        </p>
      )}
      {status === "unavailable" && (
        <p className="text-xs text-amber-700">Tu dispositivo no pudo obtener la ubicación en este momento.</p>
      )}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
