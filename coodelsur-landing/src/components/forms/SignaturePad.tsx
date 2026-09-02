"use client";

import { readFileAsDataUrl } from "@/lib/media/file-capture";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

interface SignaturePadProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  error?: string;
  disabled?: boolean;
  title?: string;
  helperText?: string;
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export function SignaturePad({
  value,
  onChange,
  error,
  disabled = false,
  title = "Firma",
  helperText = "Firma dentro del recuadro con el dedo o el mouse.",
}: SignaturePadProps) {
  const padRef = useRef<SignatureCanvas>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState(320);
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => setWidth(Math.max(280, el.clientWidth));
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (disabled) {
      padRef.current?.clear();
    }
  }, [disabled]);

  const handleEnd = () => {
    if (disabled || mode !== "draw") return;
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      onChange("");
      return;
    }
    onChange(pad.toDataURL("image/png"));
  };

  const clear = () => {
    if (disabled) return;
    padRef.current?.clear();
    onChange("");
    setLocalError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalError(null);

    if (!file.type.startsWith("image/")) {
      setLocalError("Sube una imagen de tu firma (JPG, PNG o WEBP).");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError("La imagen no puede superar 2 MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange(dataUrl);
      padRef.current?.clear();
    } catch {
      setLocalError("No se pudo cargar la imagen de firma.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const switchMode = (next: "draw" | "upload") => {
    if (disabled || mode === next) return;
    setMode(next);
    setLocalError(null);
    onChange("");
    padRef.current?.clear();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const displayError = error || localError;

  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-60")}>
      <p className="text-sm font-medium text-coodel-dark">
        {title} <span className="text-red-500">*</span>
      </p>
      <p className="text-xs text-gray-500">{helperText}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => switchMode("draw")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium",
            mode === "draw"
              ? "bg-coodel-accent text-white"
              : "border border-gray-300 bg-white text-coodel-dark",
          )}
        >
          Firmar aquí
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => switchMode("upload")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium",
            mode === "upload"
              ? "bg-coodel-accent text-white"
              : "border border-gray-300 bg-white text-coodel-dark",
          )}
        >
          Subir imagen de firma
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={handleUpload}
      />

      {mode === "draw" ? (
        <div
          ref={wrapRef}
          className={cn(
            "w-full max-w-md overflow-hidden border border-gray-300 bg-white",
            disabled && "pointer-events-none bg-gray-50",
          )}
        >
          <SignatureCanvas
            ref={padRef}
            penColor="#002446"
            onEnd={handleEnd}
            clearOnResize={false}
            canvasProps={{
              width,
              height: 160,
              className: "touch-none w-full",
              "aria-label": "Área de firma",
            }}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-coodel-surface/40 p-4">
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-coodel-accent px-4 py-2 text-sm font-semibold text-white hover:bg-coodel-accent-light disabled:opacity-60"
          >
            Elegir imagen de firma
          </button>
          <p className="mt-2 text-xs text-gray-500">Foto o escaneo de tu firma sobre fondo claro.</p>
        </div>
      )}

      {value && mode === "upload" && (
        <div className="max-w-md overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Vista previa de la firma" className="max-h-40 w-full object-contain" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="w-fit text-sm text-gray-500 underline hover:text-coodel-primary disabled:cursor-not-allowed disabled:no-underline"
        >
          Limpiar firma
        </button>
        {value && !disabled && <span className="text-sm text-coodel-accent">Firma capturada</span>}
      </div>

      {displayError && (
        <p className="text-xs text-red-600" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
