"use client";

import { cn } from "@/shared/utils";
import type { FileCapture } from "@/shared/types/credito";
import { useRef, useState } from "react";

interface FileUploadProps {
  id: string;
  label: string;
  accept: string;
  capture?: "user" | "environment";
  required?: boolean;
  error?: string;
  helperText?: string;
  kind: "image" | "video";
  value?: FileCapture;
  onChange: (file: FileCapture | undefined) => void;
  maxBytes?: number;
}

const DEFAULT_MAX = {
  image: 5 * 1024 * 1024,
  video: 15 * 1024 * 1024,
} as const;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export function FileUpload({
  id,
  label,
  accept,
  capture,
  required,
  error,
  helperText,
  kind,
  value,
  onChange,
  maxBytes,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const limit = maxBytes ?? DEFAULT_MAX[kind];

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      onChange(undefined);
      setLocalError(null);
      return;
    }

    if (file.size > limit) {
      setLocalError(`El archivo no puede superar ${Math.round(limit / (1024 * 1024))} MB`);
      onChange(undefined);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setReading(true);
    setLocalError(null);
    try {
      const preview = await readFileAsDataUrl(file);
      onChange({
        fileName: file.name || (kind === "video" ? "video-verificacion" : "foto-cedula"),
        mimeType: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
        size: file.size,
        preview,
      });
    } catch {
      setLocalError("No se pudo procesar el archivo. Intenta de nuevo.");
      onChange(undefined);
    } finally {
      setReading(false);
    }
  };

  const clear = () => {
    onChange(undefined);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const displayError = error || localError;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-coodel-dark">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        capture={capture}
        onChange={handleChange}
        disabled={reading}
        className="rounded-lg border border-dashed border-gray-300 bg-coodel-surface/50 px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-coodel-accent file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-coodel-accent-light disabled:opacity-60"
      />

      {reading && <p className="text-xs text-coodel-primary">Procesando archivo…</p>}
      {helperText && !displayError && <p className="text-xs text-gray-500">{helperText}</p>}
      {displayError && (
        <p className="text-xs text-red-600" role="alert">
          {displayError}
        </p>
      )}

      {value?.preview && kind === "image" && (
        <div className="relative mt-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.preview} alt={`Vista previa de ${label}`} className="max-h-48 w-full object-contain" />
          <p className="truncate px-3 py-2 text-xs text-gray-500">{value.fileName}</p>
        </div>
      )}

      {value?.preview && kind === "video" && (
        <div className="relative mt-1 overflow-hidden rounded-lg border border-gray-200 bg-black">
          <video src={value.preview} controls playsInline className="max-h-56 w-full" />
          <p className="truncate bg-white px-3 py-2 text-xs text-gray-500">{value.fileName}</p>
        </div>
      )}

      {value && (
        <button
          type="button"
          onClick={clear}
          className={cn("w-fit text-sm text-gray-500 underline hover:text-coodel-primary")}
        >
          Quitar archivo
        </button>
      )}
    </div>
  );
}
