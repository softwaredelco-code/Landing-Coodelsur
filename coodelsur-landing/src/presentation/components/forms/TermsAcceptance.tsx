"use client";

import { TERMINOS_HABEAS_DATA } from "@/shared/content/terminos-habeas-data";
import { cn } from "@/shared/utils";
import { useEffect, useRef, useState } from "react";

interface TermsAcceptanceProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onReadComplete?: () => void;
  error?: string;
}

export function TermsAcceptance({
  checked,
  onCheckedChange,
  onReadComplete,
  error,
}: TermsAcceptanceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasReadToEnd, setHasReadToEnd] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const check = () => {
      const reached = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
      if (reached) {
        setHasReadToEnd(true);
        onReadComplete?.();
      }
    };

    // Contenido corto en pantallas altas: considerar leído si no hay scroll
    if (el.scrollHeight <= el.clientHeight + 8) {
      setHasReadToEnd(true);
      onReadComplete?.();
    }

    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [onReadComplete]);

  return (
    <div className="border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-coodel-primary px-4 py-3 text-white md:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-coodel-gold">
          Autorización legal
        </p>
        <h3 className="mt-1 text-base font-semibold leading-snug md:text-lg">
          Hábeas data y tratamiento de datos personales
        </h3>
      </div>

      <div className="px-4 py-4 md:px-5">
        <p className="mb-3 text-sm text-coodel-body">
          Lee el documento completo. Debes llegar al final para habilitar la aceptación y continuar
          con tu firma.
        </p>

        <div
          ref={scrollRef}
          className="max-h-64 overflow-y-auto border border-gray-200 bg-coodel-surface/60 px-4 py-4 text-sm leading-relaxed text-coodel-body md:max-h-80"
          tabIndex={0}
          role="region"
          aria-label="Texto de autorización de hábeas data"
        >
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-coodel-primary">
            {TERMINOS_HABEAS_DATA.title}
          </h4>
          <p className="mb-4">{TERMINOS_HABEAS_DATA.intro}</p>

          {TERMINOS_HABEAS_DATA.sections.map((section) => (
            <div key={section.heading} className="mb-4">
              <h5 className="mb-2 font-semibold text-coodel-dark">{section.heading}</h5>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="mb-2">
                  {paragraph}
                </p>
              ))}
              {"bullets" in section && section.bullets && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <p className="mt-4 font-medium text-coodel-dark">{TERMINOS_HABEAS_DATA.closing}</p>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p
            className={cn(
              "text-xs",
              hasReadToEnd ? "font-medium text-coodel-accent" : "text-gray-500",
            )}
          >
            {hasReadToEnd
              ? "Documento leído. Ya puedes aceptar."
              : "Desplázate hasta el final del documento."}
          </p>
          <a
            href={TERMINOS_HABEAS_DATA.downloadHref}
            download
            className="text-xs font-semibold text-coodel-primary-light underline-offset-2 hover:underline"
          >
            {TERMINOS_HABEAS_DATA.downloadLabel}
          </a>
        </div>

        <label
          className={cn(
            "mt-4 flex cursor-pointer items-start gap-3 border px-3 py-3 transition-colors",
            hasReadToEnd
              ? "border-coodel-accent/40 bg-coodel-accent/5"
              : "cursor-not-allowed border-gray-200 bg-gray-50 opacity-70",
          )}
        >
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-coodel-accent"
            checked={checked}
            disabled={!hasReadToEnd}
            onChange={(event) => onCheckedChange(event.target.checked)}
          />
          <span className="text-sm text-coodel-body">
            He leído y acepto la autorización para el tratamiento de datos personales y hábeas data
            financiero, crediticio y comercial de COODELSUR S.A.S.{" "}
            <span className="text-red-500">*</span>
          </span>
        </label>

        {error && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
