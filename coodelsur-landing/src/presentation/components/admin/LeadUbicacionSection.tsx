"use client";

import type { AdminLeadDetail } from "@/application/lead/admin-lead-detail";
import {
  buildGoogleMapsUrl,
  buildOpenStreetMapEmbedUrl,
  formatCoords,
} from "@/infrastructure/geo/map-links";

function MapPreview({
  lat,
  lng,
  title,
}: {
  lat: number;
  lng: number;
  title: string;
}) {
  return (
    <div className="space-y-2">
      <iframe
        title={title}
        src={buildOpenStreetMapEmbedUrl(lat, lng)}
        className="h-56 w-full rounded border border-gray-200 bg-gray-50"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a
        href={buildGoogleMapsUrl(lat, lng)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-semibold text-coodel-primary-light hover:underline"
      >
        Abrir en Google Maps ({formatCoords(lat, lng)})
      </a>
    </div>
  );
}

function hasDomicilio(domicilio: AdminLeadDetail["domicilio"]): boolean {
  return Boolean(
    domicilio.direccionCompleta ||
      domicilio.sectorDomicilio ||
      domicilio.departamento ||
      domicilio.municipio,
  );
}

export function LeadUbicacionSection({ lead }: { lead: AdminLeadDetail }) {
  const { domicilio, geoFormulario, latitud, longitud, ciudad, pais } = lead;
  const hasGeoIp =
    typeof latitud === "number" &&
    typeof longitud === "number" &&
    Number.isFinite(latitud) &&
    Number.isFinite(longitud);
  const hasAny = hasDomicilio(domicilio) || geoFormulario || hasGeoIp || ciudad || pais;

  if (!hasAny) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-2 text-lg font-semibold text-coodel-dark">Ubicación</h2>
        <p className="text-sm text-gray-400">
          Sin datos de domicilio ni ubicación registrados.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-4 text-lg font-semibold text-coodel-dark">Ubicación</h2>

      <div className="grid gap-6">
        {hasDomicilio(domicilio) && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-coodel-dark">Dirección registrada</h3>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {domicilio.direccionCompleta && (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Dirección completa</dt>
                  <dd className="font-medium text-coodel-dark">{domicilio.direccionCompleta}</dd>
                </div>
              )}
              {domicilio.departamento && (
                <div>
                  <dt className="text-gray-500">Departamento</dt>
                  <dd>{domicilio.departamento}</dd>
                </div>
              )}
              {domicilio.municipio && (
                <div>
                  <dt className="text-gray-500">Municipio</dt>
                  <dd>{domicilio.municipio}</dd>
                </div>
              )}
              {domicilio.barrio && (
                <div>
                  <dt className="text-gray-500">Barrio</dt>
                  <dd>{domicilio.barrio}</dd>
                </div>
              )}
              {domicilio.direccion && (
                <div>
                  <dt className="text-gray-500">Dirección</dt>
                  <dd>{domicilio.direccion}</dd>
                </div>
              )}
              {domicilio.sectorDomicilio && (
                <div>
                  <dt className="text-gray-500">Sector</dt>
                  <dd>{domicilio.sectorDomicilio}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {geoFormulario && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-coodel-dark">
              Ubicación GPS (capturada en el formulario)
            </h3>
            <p className="mb-3 text-xs text-gray-500">
              Coordenadas que el solicitante autorizó desde su dispositivo al llenar el formulario.
            </p>
            <MapPreview
              lat={geoFormulario.lat}
              lng={geoFormulario.lng}
              title="Ubicación GPS del solicitante"
            />
          </div>
        )}

        {(hasGeoIp || ciudad || pais) && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-coodel-dark">
              Ubicación aproximada (IP al enviar)
            </h3>
            <dl className="mb-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {(ciudad || pais) && (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Ciudad / país detectados</dt>
                  <dd>
                    {[ciudad, pais].filter(Boolean).join(", ") || "—"}
                  </dd>
                </div>
              )}
              {hasGeoIp && (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Coordenadas aproximadas</dt>
                  <dd>{formatCoords(latitud!, longitud!)}</dd>
                </div>
              )}
            </dl>
            {hasGeoIp && (
              <MapPreview
                lat={latitud!}
                lng={longitud!}
                title="Ubicación aproximada por IP"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
