# Mapa del código fuente

Referencia rápida de módulos, responsabilidades y puntos de entrada. Para arquitectura de alto nivel ver [ARCHITECTURE.md](./ARCHITECTURE.md).

## Páginas (`src/app/`)

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `page.tsx` | Landing: hero, productos, contacto |
| `/solicitar` | `solicitar/page.tsx` | Selector de monto + formulario |
| `/credito/[slug]` | `credito/[slug]/page.tsx` | Entrada directa por producto |
| `/gracias` | `gracias/page.tsx` | Confirmación post-envío |
| `/admin` | `admin/page.tsx` | Login del panel |
| `/admin/leads` | `admin/leads/page.tsx` | Listado de solicitudes |
| `/admin/leads/[id]` | `admin/leads/[id]/page.tsx` | Detalle + cambio de estado |

## API (`src/app/api/`)

| Método | Ruta | Módulo de dominio |
|--------|------|-------------------|
| GET | `/api/health` | Diagnóstico DB + modo demo |
| POST | `/api/leads` | `create-lead.ts` |
| POST | `/api/leads/draft` | `save-draft-lead.ts` |
| POST | `/api/leads/witme` | Webhook externo Witme |
| POST | `/api/verify-cedula` | `cedula.ts` / Verifik |
| POST | `/api/admin/login` | `admin/auth.ts` |
| GET | `/api/admin/leads` | Listado Prisma |
| GET/PATCH/DELETE | `/api/admin/leads/[id]` | Detalle, estado, `delete-lead.ts` |
| GET | `/api/admin/leads/export` | Excel con solicitudes (`export-leads-excel.ts`) |
| GET | `/api/admin/leads/[id]/attachments/[field]` | Proxy adjuntos Storage |

## Dominio — leads (`src/lib/leads/`)

| Archivo | Función |
|---------|---------|
| `create-lead.ts` | Solicitud completa → BD + Storage + email |
| `save-draft-lead.ts` | Borrador `incompleto`, deduplicación |
| `delete-lead.ts` | Borrado BD + objetos Storage |
| `export-leads-excel.ts` | Generación Excel para admin |
| `fetch-leads-for-export.ts` | Consulta completa para exportación |
| `admin-lead-detail.ts` | Proyección liviana para admin |
| `load-lead-attachment.ts` | Descarga bajo demanda de adjuntos |
| `attachments.ts` | Metadatos y paths en JSON |
| `form-progress.ts` | % completado y paso actual |
| `lead-summary-fields.ts` | Campos desnormalizados al guardar |
| `lead-summary.ts` | Extracción desde JSON legacy |
| `duplicate-cedula.ts` | Ventana anti-duplicados |
| `file-store.ts` | Fallback JSON local (solo dev) |

## Identidad (`src/lib/identity/`)

| Archivo | Función |
|---------|---------|
| `cedula.ts` | Formato CC (6/7/10 dígitos), Verifik |
| `cedula-local.ts` | Validación offline en formulario |
| `verify-document.ts` | Orquestación verificación externa |

## Storage y media (`src/lib/storage/`, `src/lib/media/`)

| Archivo | Función |
|---------|---------|
| `upload.ts` | Subida/eliminación Supabase Storage |
| `file-capture.ts` | Normalización de capturas base64 |

## Formulario (`src/components/forms/`)

| Componente | Rol |
|------------|-----|
| `FormularioCredito.tsx` | Orquestador 8 pasos, envío final |
| `sections/Seccion*.tsx` | Una sección por paso |
| `FileUpload.tsx` | Adjuntos imagen/PDF |
| `SignaturePad.tsx` | Firma digital |
| `VideoRecorder.tsx` | Video de verificación |
| `CameraCapture.tsx` | Foto cédula desde cámara |
| `TermsAcceptance.tsx` | Hábeas data + términos |

## Hooks (`src/hooks/`)

| Hook | Almacenamiento |
|------|----------------|
| `useNanocreditoDraft` | `localStorage` — recuperación al recargar |
| `useNanocreditoServerDraft` | `POST /api/leads/draft` — visible en admin |

## Configuración de producto (`src/config/creditos/`)

| Archivo | Contenido |
|---------|-----------|
| `montos.ts` | Rangos $200K–$600K (Small) |
| `amortizacion.ts` | Tasas, fianza, vida deudores |
| `nanocredito.ts` | Constantes del producto |
| `form-sections.ts` | IDs de pasos (legacy) |
| `opciones.ts` | Selects: bancos, parentesco, documentos |

## Validación (`src/lib/validation/`)

| Archivo | Contenido |
|---------|-----------|
| `nanocredito.ts` | Schema Zod, `NANOCREDITO_STEPS`, reglas cruzadas |
| `schemas.ts` | Schemas compartidos auxiliares |

## Tracking y email

| Módulo | Uso |
|--------|-----|
| `lib/tracking/utm.ts` | Captura y serialización UTM |
| `lib/tracking/analytics.ts` | Eventos GA4 |
| `lib/email/send.ts` | SMTP / Resend |
| `lib/email/lead-confirmation.ts` | Plantilla confirmación |

## Tipos (`src/types/credito.ts`)

Contratos compartidos: `LeadPayload`, `FileCapture`, `UtmParams`, `GeoCoords`.

## Prisma (`prisma/schema.prisma`)

Modelo único `Lead` con enum `LeadEstado`. Campos indexados para filtros admin.

## Scripts (`scripts/`)

| Script | Comando |
|--------|---------|
| `verify-backend.js` | `npm run verify:backend` — health check local |

## Convenciones

1. **Lógica de negocio** en `src/lib/`, no en componentes ni routes.
2. **Validación** duplicada: Zod en cliente (UX) y servidor (seguridad).
3. **Adjuntos**: nunca binarios grandes en PostgreSQL; solo paths en JSON.
4. **Admin**: fetch con `cache: 'no-store'` para datos frescos.
5. **Producción**: `NEXT_PUBLIC_DEMO_MODE=false`, `LEAD_STORE` vacío, pooler `:6543`.
