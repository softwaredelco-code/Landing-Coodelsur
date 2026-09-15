"use client";

import {
  captureVideoFrame,
  fileToCapture,
  getVideoStream,
  stopMediaStream,
} from "@/infrastructure/media/file-capture";
import { cn } from "@/shared/utils";
import type { FileCapture } from "@/shared/types/credito";
import { useCallback, useEffect, useRef, useState } from "react";

interface CameraCaptureProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  facingMode?: "user" | "environment";
  value?: FileCapture;
  onChange: (file: FileCapture | undefined) => void;
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export function CameraCapture({
  id,
  label,
  required,
  error,
  helperText,
  facingMode = "environment",
  value,
  onChange,
  maxBytes = DEFAULT_MAX_BYTES,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const openingRef = useRef(false);

  const [mode, setMode] = useState<"idle" | "camera">("idle");
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setMode("idle");
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (mode !== "camera") return;

    const stream = streamRef.current;
    if (!stream) return;

    let cancelled = false;
    let frameId = 0;

    const attachStream = () => {
      const video = videoRef.current;
      if (!video) return false;

      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");

      void video.play().catch(() => {
        if (cancelled) return;
        setLocalError("No se pudo iniciar la vista de cámara. Puedes subir una foto desde tu galería.");
        stopCamera();
      });

      return true;
    };

    if (!attachStream()) {
      frameId = requestAnimationFrame(() => {
        if (!cancelled) attachStream();
      });
    }

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [mode, stopCamera]);

  const startCamera = async () => {
    if (openingRef.current) return;

    setLocalError(null);
    setBusy(true);
    openingRef.current = true;

    try {
      stopCamera();
      await new Promise((resolve) => window.setTimeout(resolve, 150));

      const stream = await getVideoStream({ facingMode });
      streamRef.current = stream;
      setMode("camera");
    } catch {
      setLocalError("No pudimos abrir la cámara. Puedes subir una foto desde tu galería.");
      fileInputRef.current?.click();
    } finally {
      openingRef.current = false;
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;

    setBusy(true);
    setLocalError(null);

    try {
      const capture = await captureVideoFrame(video, `${id}.jpg`);
      if (capture.size > maxBytes) {
        setLocalError(`La foto no puede superar ${Math.round(maxBytes / (1024 * 1024))} MB`);
        return;
      }
      onChange(capture);
      stopCamera();
    } catch {
      setLocalError("No se pudo tomar la foto. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalError(null);
    setBusy(true);

    try {
      if (file.size > maxBytes) {
        setLocalError(`El archivo no puede superar ${Math.round(maxBytes / (1024 * 1024))} MB`);
        onChange(undefined);
        return;
      }
      onChange(await fileToCapture(file, `${id}.jpg`));
      stopCamera();
    } catch {
      setLocalError("No se pudo procesar la imagen.");
      onChange(undefined);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clear = () => {
    onChange(undefined);
    setLocalError(null);
    stopCamera();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const displayError = error || localError;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-coodel-dark">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </p>

      <input
        ref={fileInputRef}
        id={`${id}-file`}
        type="file"
        accept="image/*"
        capture={facingMode}
        className="sr-only"
        onChange={handleFile}
      />

      {!value && mode !== "camera" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void startCamera()}
            disabled={busy}
            className="rounded-lg bg-coodel-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-coodel-accent-light disabled:opacity-60"
          >
            {busy ? "Abriendo cámara…" : "Tomar foto con cámara"}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-coodel-dark hover:bg-gray-50 disabled:opacity-60"
          >
            Subir imagen
          </button>
        </div>
      )}

      {mode === "camera" && !value && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="min-h-[220px] max-h-64 w-full object-cover"
          />
          <div className="flex flex-wrap gap-2 bg-white p-3">
            <button
              type="button"
              onClick={() => void takePhoto()}
              disabled={busy}
              className="rounded-lg bg-coodel-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Capturar foto
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-coodel-dark"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {helperText && !displayError && <p className="text-xs text-gray-500">{helperText}</p>}
      {displayError && (
        <p className="text-xs text-red-600" role="alert">
          {displayError}
        </p>
      )}

      {value?.preview && (
        <div className="relative mt-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.preview} alt={`Vista previa de ${label}`} className="max-h-48 w-full object-contain" />
          <p className="truncate px-3 py-2 text-xs text-gray-500">{value.fileName}</p>
        </div>
      )}

      {value && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={clear}
            className={cn("text-sm text-gray-500 underline hover:text-coodel-primary")}
          >
            Quitar y repetir
          </button>
          <button
            type="button"
            onClick={() => void startCamera()}
            className="text-sm text-coodel-primary underline hover:text-coodel-primary-light"
          >
            Tomar otra foto
          </button>
        </div>
      )}
    </div>
  );
}
