"use client";

import type { AdminAttachment } from "@/domain/lead/attachments";
import { isImageAttachment, isVideoAttachment } from "@/domain/lead/attachments";
import { cn } from "@/shared/utils";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

interface LeadAttachmentGalleryProps {
  attachments: AdminAttachment[];
}

function MediaUnavailable({ label }: { label: string }) {
  return (
    <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
      <p className="text-sm text-gray-400">{label} no disponible</p>
    </div>
  );
}

function AdminAttachmentImage({
  src,
  alt,
  className,
  sizes = "(max-width: 1024px) 100vw, 50vw",
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      sizes={sizes}
      className={cn("object-contain", className)}
    />
  );
}

export function LeadAttachmentGallery({ attachments }: LeadAttachmentGalleryProps) {
  const images = attachments.filter(isImageAttachment);
  const video = attachments.find(isVideoAttachment);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loadVideo, setLoadVideo] = useState(false);

  const availableImages = images.filter((item) => item.url && item.available);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowRight" && availableImages.length > 1) {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % availableImages.length,
        );
      }
      if (event.key === "ArrowLeft" && availableImages.length > 1) {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev - 1 + availableImages.length) % availableImages.length,
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [availableImages.length, closeLightbox, lightboxIndex]);

  const activeImage =
    lightboxIndex !== null ? availableImages[lightboxIndex] ?? null : null;

  return (
    <>
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-coodel-dark">Documentación</h2>
            <p className="mt-1 text-sm text-gray-500">
              Cédula, video de verificación y firma del solicitante.
            </p>
          </div>
          <p className="text-xs text-gray-400">
            {availableImages.length + (video?.available ? 1 : 0)} de {attachments.length} archivos
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {images.map((attachment) => {
            const imageIndex = availableImages.findIndex((item) => item.field === attachment.field);
            const canPreview = attachment.url && attachment.available;

            return (
              <article
                key={attachment.field}
                className={cn(
                  "overflow-hidden rounded-xl border border-gray-200 bg-gray-50",
                  attachment.field === "firma" && "lg:col-span-2 lg:max-w-md",
                )}
              >
                <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-coodel-dark">{attachment.label}</h3>
                  {attachment.fileName && (
                    <span className="truncate text-xs text-gray-400">{attachment.fileName}</span>
                  )}
                </div>

                <div className="p-3">
                  {canPreview ? (
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(imageIndex)}
                      className="group relative block w-full overflow-hidden rounded-lg border border-gray-200 bg-white"
                    >
                      <div className="relative aspect-[4/3] w-full">
                        <AdminAttachmentImage
                          src={attachment.url!}
                          alt={attachment.label}
                          className="transition group-hover:scale-[1.02]"
                        />
                      </div>
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2 text-left text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                        Ampliar
                      </span>
                    </button>
                  ) : (
                    <MediaUnavailable label={attachment.label} />
                  )}

                  {canPreview && (
                    <a
                      href={attachment.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-coodel-primary-light hover:underline"
                    >
                      Abrir en nueva pestaña
                    </a>
                  )}
                </div>
              </article>
            );
          })}

          {video && (
            <article className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 lg:col-span-2">
              <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2.5">
                <h3 className="text-sm font-semibold text-coodel-dark">{video.label}</h3>
                {video.fileName && (
                  <span className="truncate text-xs text-gray-400">{video.fileName}</span>
                )}
              </div>

              <div className="p-3">
                {!video.url || !video.available ? (
                  <MediaUnavailable label={video.label} />
                ) : !loadVideo ? (
                  <button
                    type="button"
                    onClick={() => setLoadVideo(true)}
                    className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-sm font-medium text-coodel-primary transition hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Reproducir video
                    </span>
                  </button>
                ) : (
                  <video
                    src={video.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full rounded-lg border border-gray-200 bg-black object-contain"
                  >
                    Tu navegador no soporta la reproducción de video.
                  </video>
                )}

                {video.url && video.available && (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-coodel-primary-light hover:underline"
                  >
                    Descargar / abrir video
                  </a>
                )}
              </div>
            </article>
          )}
        </div>
      </section>

      {activeImage?.url && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={activeImage.label}
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
          >
            Cerrar
          </button>

          {availableImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIndex(
                    (prev) =>
                      prev === null
                        ? null
                        : (prev - 1 + availableImages.length) % availableImages.length,
                  );
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:left-6"
                aria-label="Imagen anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIndex(
                    (prev) =>
                      prev === null ? null : (prev + 1) % availableImages.length,
                  );
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:right-6"
                aria-label="Imagen siguiente"
              >
                ›
              </button>
            </>
          )}

          <div
            className="relative max-h-[90vh] max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative mx-auto h-[85vh] w-full min-w-[280px] max-w-5xl">
              <AdminAttachmentImage
                src={activeImage.url}
                alt={activeImage.label}
                sizes="100vw"
              />
            </div>
            <p className="mt-3 text-center text-sm font-medium text-white/90">
              {activeImage.label}
              {availableImages.length > 1 && lightboxIndex !== null && (
                <span className="text-white/60">
                  {" "}
                  · {lightboxIndex + 1} / {availableImages.length}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
