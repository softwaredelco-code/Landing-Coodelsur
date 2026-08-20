"use client";

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
  const [width, setWidth] = useState(320);

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
    if (disabled) return;
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
  };

  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-60")}>
      <p className="text-sm font-medium text-coodel-dark">
        {title} <span className="text-red-500">*</span>
      </p>
      <p className="text-xs text-gray-500">{helperText}</p>
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
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="w-fit text-sm text-gray-500 underline hover:text-coodel-primary disabled:cursor-not-allowed disabled:no-underline"
        >
          Limpiar y volver a firmar
        </button>
        {value && !disabled && <span className="text-sm text-coodel-accent">Firma capturada</span>}
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
