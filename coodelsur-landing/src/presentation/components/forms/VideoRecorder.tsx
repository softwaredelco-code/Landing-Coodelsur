"use client";

import {
  blobToCapture,
  fileToCapture,
  getCameraErrorMessage,
  getVideoStream,
  pickRecorderMimeType,
  stopMediaStream,
} from "@/infrastructure/media/file-capture";
import { cn } from "@/shared/utils";
import type { FileCapture } from "@/shared/types/credito";
import { useCallback, useEffect, useRef, useState } from "react";

interface VideoRecorderProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  durationSeconds?: number;
  value?: FileCapture;
  onChange: (file: FileCapture | undefined) => void;
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

export function VideoRecorder({
  id,
  label,
  required,
  error,
  helperText,
  durationSeconds = 3,
  value,
  onChange,
  maxBytes = DEFAULT_MAX_BYTES,
}: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const openingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);

  const [mode, setMode] = useState<"idle" | "preview" | "recording">("idle");
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    if (stopTimerRef.current) {
      window.clearInterval(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    setMode("idle");
    setSecondsLeft(durationSeconds);
  }, [durationSeconds]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (mode !== "preview" && mode !== "recording") return;

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
        setLocalError("No se pudo iniciar la vista de cámara. Puedes subir un video desde tu galería.");
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

  const openCameraFallback = () => {
    captureInputRef.current?.click();
  };

  const openPreview = async () => {
    if (openingRef.current) return;

    setLocalError(null);
    setBusy(true);
    openingRef.current = true;

    try {
      stopCamera();
      await new Promise((resolve) => window.setTimeout(resolve, 150));

      const stream = await getVideoStream({ facingMode: "user" });

      if (stream.getVideoTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Sin pista de video");
      }

      stream.getAudioTracks().forEach((track) => track.stop());

      streamRef.current = stream;
      setMode("preview");
    } catch (error) {
      setLocalError(getCameraErrorMessage(error));
    } finally {
      openingRef.current = false;
      setBusy(false);
    }
  };

  const finalizeRecording = async () => {
    const blob = new Blob(chunksRef.current, {
      type: chunksRef.current[0]?.type || pickRecorderMimeType() || "video/webm",
    });
    chunksRef.current = [];

    if (blob.size === 0) {
      setLocalError("No se grabó el video. Intenta de nuevo.");
      stopCamera();
      return;
    }

    if (blob.size > maxBytes) {
      setLocalError(`El video no puede superar ${Math.round(maxBytes / (1024 * 1024))} MB`);
      stopCamera();
      return;
    }

    try {
      onChange(await blobToCapture(blob, `${id}.webm`));
    } catch {
      setLocalError("No se pudo procesar el video.");
    } finally {
      stopCamera();
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || stream.getVideoTracks().length === 0 || typeof MediaRecorder === "undefined") {
      setLocalError("Tu navegador no permite grabar video aquí. Sube un video desde tu galería.");
      return;
    }

    setLocalError(null);
    chunksRef.current = [];

    const mimeType = pickRecorderMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      void finalizeRecording();
    };

    recorder.start(200);
    setMode("recording");
    setSecondsLeft(durationSeconds);

    stopTimerRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    window.setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, durationSeconds * 1000);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalError(null);
    setBusy(true);

    try {
      if (!file.type.startsWith("video/")) {
        setLocalError("Selecciona un archivo de video (no audio ni otro tipo).");
        onChange(undefined);
        return;
      }
      if (file.size > maxBytes) {
        setLocalError(`El archivo no puede superar ${Math.round(maxBytes / (1024 * 1024))} MB`);
        onChange(undefined);
        return;
      }
      onChange(await fileToCapture(file, `${id}.mp4`));
      stopCamera();
    } catch {
      setLocalError("No se pudo procesar el video.");
      onChange(undefined);
    } finally {
      setBusy(false);
      clearInput(event.target);
    }
  };

  const clearInput = (input: HTMLInputElement | null) => {
    if (input) input.value = "";
  };

  const clear = () => {
    onChange(undefined);
    setLocalError(null);
    stopCamera();
    clearInput(uploadInputRef.current);
    clearInput(captureInputRef.current);
  };

  const displayError = error || localError;
  const isLive = mode === "preview" || mode === "recording";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-coodel-dark">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </p>

      <input
        ref={uploadInputRef}
        id={`${id}-upload`}
        type="file"
        accept="video/*"
        className="sr-only"
        onChange={handleFile}
      />
      <input
        ref={captureInputRef}
        id={`${id}-capture`}
        type="file"
        accept="video/*"
        capture="user"
        className="sr-only"
        onChange={handleFile}
      />

      {!value && !isLive && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void openPreview()}
            disabled={busy}
            className="rounded-lg bg-coodel-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-coodel-accent-light disabled:opacity-60"
          >
            {busy ? "Abriendo cámara…" : `Grabar video de ${durationSeconds} s`}
          </button>
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-coodel-dark hover:bg-gray-50 disabled:opacity-60"
          >
            Subir video
          </button>
        </div>
      )}

      {isLive && !value && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="min-h-[220px] max-h-64 w-full -scale-x-100 object-cover"
          />
          <div className="space-y-2 bg-white p-3">
            {mode === "recording" ? (
              <p className="text-sm font-medium text-red-600">Grabando… {secondsLeft}s</p>
            ) : (
              <p className="text-sm text-gray-600">
                Centra tu rostro y pulsa grabar. Se detiene solo a los {durationSeconds} segundos.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {mode === "preview" && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="rounded-lg bg-coodel-accent px-4 py-2 text-sm font-semibold text-white"
                >
                  Iniciar grabación
                </button>
              )}
              {mode === "recording" && (
                <button
                  type="button"
                  onClick={() => recorderRef.current?.stop()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Detener
                </button>
              )}
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-coodel-dark"
              >
                Cancelar
              </button>
            </div>
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
        <div className="relative mt-1 overflow-hidden rounded-lg border border-gray-200 bg-black">
          <video src={value.preview} controls playsInline className="max-h-56 w-full" />
          <p className="truncate bg-white px-3 py-2 text-xs text-gray-500">{value.fileName}</p>
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
            onClick={() => void openPreview()}
            className="text-sm text-coodel-primary underline hover:text-coodel-primary-light"
          >
            Grabar de nuevo
          </button>
        </div>
      )}

    </div>
  );
}
