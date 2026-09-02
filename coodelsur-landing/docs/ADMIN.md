# Panel de administración

## Acceso

- **URL:** `/admin`
- **Credencial:** variable de entorno `ADMIN_PASSWORD`
- Sesión: cookie HTTP-only `coodelsur_admin` (12 h)

## Listado (`/admin/leads`)

- Búsqueda por nombre, cédula, teléfono, email
- Filtro por estado (incluye **Incompletas**)
- Columnas: fecha, nombre, progreso %, monto, teléfono, estado
- **Selección múltiple** con checkboxes (incluye “seleccionar todas” en la página visible)
- **Exportar seleccionadas** — Excel con las filas marcadas
- **Exportar informe general** — Excel con todas las solicitudes que coincidan con los filtros actuales (hasta 5.000)
- Sin caché del navegador (datos en tiempo real)

### Columnas del Excel

El archivo incluye datos administrativos (ID, fechas, estado, UTM, geo) y **todos los campos del formulario**: identidad, crédito, domicilio, laboral, referencia, bancarios y metadatos de adjuntos (nombre de archivo, sin binarios).

Archivo generado: `solicitudes-coodelsur-informe-general-YYYY-MM-DD.xlsx` o `...-seleccionadas-...`.

## Detalle (`/admin/leads/[id]`)

- Datos principales del solicitante y crédito
- **Ubicación y domicilio:** dirección del formulario (depto, municipio, barrio, calle), mapa GPS si el usuario capturó geolocalización, y ubicación aproximada por IP con enlace a Google Maps
- **Adjuntos:** cédula (×2), video (carga bajo demanda), firma
- Cambio de estado desde select
- **Eliminar solicitud** — borra registro en PostgreSQL y archivos en Storage

## Solicitudes incompletas

Usuarios que abandonan el formulario con datos mínimos de contacto quedan con:

- `estado = incompleto`
- `progresoFormulario` y `pasoActualFormulario` visibles en listado
- Banner amarillo en detalle con % de avance

Al completar el formulario, el mismo registro pasa a `recibido` (no se duplica).

## Rendimiento

- Listado: solo columnas desnormalizadas (no carga JSON completo)
- Detalle: respuesta ~1–2 KB (adjuntos vía proxy separado)
- Cada adjunto lee solo su campo del JSON en PostgreSQL

## Operaciones recomendadas

| Acción | Cómo |
|--------|------|
| Revisar nueva solicitud | Filtro `recibido` o Todos |
| Contactar abandonos | Filtro `Incompletas` |
| Limpiar solicitud errónea | Detalle → Eliminar solicitud |
| Marcar gestión | Cambiar estado en detalle |
