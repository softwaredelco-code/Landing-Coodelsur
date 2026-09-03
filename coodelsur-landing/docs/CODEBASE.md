# Mapa del código fuente

Referencia rápida de módulos y puntos de entrada. Arquitectura: [HEXAGONAL.md](./HEXAGONAL.md).

## Capas hexagonales

| Capa | Ubicación | Responsabilidad |
|------|-----------|-----------------|
| **Adaptador HTTP** | `src/app/` | Páginas Next.js y API Routes (delgadas) |
| **Presentación** | `src/presentation/` | Componentes React, hooks, contextos |
| **Application** | `src/application/` | Casos de uso (orquestación) |
| **Domain** | `src/domain/` | Reglas de negocio puras |
| **Infrastructure** | `src/infrastructure/` | Prisma, Storage, email, geo, auth |
| **Shared** | `src/shared/` | Config, validación Zod, tipos, utilidades |
| **Persistencia** | `database/prisma/` | Schema PostgreSQL |

## Páginas (`src/app/`)

| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/` | `page.tsx` | Landing: hero, productos, contacto |
| `/solicitar` | `solicitar/page.tsx` | Selector de monto + formulario |
| `/credito/[slug]` | `credito/[slug]/page.tsx` | Entrada directa por producto |
| `/solicitud-enviada` | `solicitud-enviada/page.tsx` | Confirmación post-envío |
| `/admin` | `admin/page.tsx` | Login del panel |
| `/admin/leads` | `admin/leads/page.tsx` | Listado de solicitudes |
| `/admin/leads/[id]` | `admin/leads/[id]/page.tsx` | Detalle + cambio de estado |
| `/admin/parametros` | `admin/parametros/page.tsx` | Parámetros de amortización |

## API (`src/app/api/`)

| Método | Ruta | Caso de uso |
|--------|------|-------------|
| GET | `/api/health` | Diagnóstico DB + modo demo |
| POST | `/api/leads` | `@/application/lead/create-lead` |
| POST | `/api/leads/draft` | `@/application/lead/save-draft-lead` |
| POST | `/api/leads/witme` | Webhook externo Witme |
| POST | `/api/verify-cedula` | `@/application/identity/verify-document` |
| GET | `/api/creditos/parametros` | Parámetros públicos de producto |
| POST | `/api/admin/login` | `@/infrastructure/auth/` |
| GET | `/api/admin/leads` | Listado Prisma |
| GET/PATCH/DELETE | `/api/admin/leads/[id]` | Detalle, estado, borrado |
| GET | `/api/admin/leads/export` | Excel (`export-leads-excel.ts`) |
| GET | `/api/admin/leads/[id]/attachments/[field]` | Proxy adjuntos Storage |

## Application — leads (`src/application/lead/`)

| Archivo | Función |
|---------|---------|
| `create-lead.ts` | Solicitud completa → BD + Storage + email |
| `save-draft-lead.ts` | Borrador `incompleto`, deduplicación |
| `delete-lead.ts` | Borrado BD + objetos Storage |
| `export-leads-excel.ts` | Generación Excel para admin |
| `fetch-leads-for-export.ts` | Consulta completa para exportación |
| `admin-lead-detail.ts` | Proyección liviana para admin |
| `admin-lead-sections.ts` | Secciones del detalle admin |
| `load-admin-lead-detail.ts` | Carga detalle con adjuntos |
| `load-lead-attachment.ts` | Descarga bajo demanda de adjuntos |

## Domain — leads (`src/domain/lead/`)

| Archivo | Función |
|---------|---------|
| `attachments.ts` | Metadatos, proxy URLs, labels de adjuntos |
| `form-progress.ts` | % completado y paso actual |
| `lead-summary-fields.ts` | Campos desnormalizados al guardar |
| `lead-summary.ts` | Extracción desde JSON legacy |
| `duplicate-cedula.ts` | Ventana anti-duplicados |

## Domain — identidad y crédito

| Módulo | Archivo | Función |
|--------|---------|---------|
| `domain/identity/` | `cedula.ts`, `cedula-local.ts` | Formato CC, validación offline |
| `domain/credito/` | `amortizacion.ts` | Cálculo de cuotas y desglose |
| `application/identity/` | `verify-document.ts` | Orquestación Verifik |
| `application/credito/` | `parametros-runtime.ts` | Parámetros en runtime |

## Infrastructure

| Módulo | Ubicación | Función |
|--------|-----------|---------|
| Base de datos | `infrastructure/database/prisma.ts` | Cliente Prisma singleton |
| Parámetros BD | `infrastructure/database/parametros-store.ts` | CRUD `CreditoParametros` |
| Storage | `infrastructure/storage/upload.ts` | Supabase Storage |
| Email | `infrastructure/email/` | SMTP / Resend |
| Geo | `infrastructure/geo/` | Geolocalización por IP |
| Auth admin | `infrastructure/auth/` | Cookie firmada |
| Fallback JSON | `infrastructure/persistence/file-store.ts` | Solo dev (`LEAD_STORE=file`) |
| Media | `infrastructure/media/file-capture.ts` | Normalización base64 |

## Presentación — formulario (`src/presentation/components/forms/`)

| Componente | Rol |
|------------|-----|
| `FormularioCredito.tsx` | Orquestador 8 pasos, envío final |
| `sections/Seccion*.tsx` | Una sección por paso |
| `FileUpload.tsx` | Adjuntos imagen/PDF |
| `SignaturePad.tsx` | Firma digital |
| `VideoRecorder.tsx` | Video de verificación |
| `CameraCapture.tsx` | Foto cédula desde cámara |
| `TermsAcceptance.tsx` | Hábeas data + términos |

## Hooks (`src/presentation/hooks/`)

| Hook | Almacenamiento |
|------|----------------|
| `useNanocreditoDraft` | `localStorage` — recuperación al recargar |
| `useNanocreditoServerDraft` | `POST /api/leads/draft` — visible en admin |

## Shared — configuración y validación

| Ubicación | Contenido |
|-----------|-----------|
| `shared/config/creditos/` | Montos, amortización, opciones de selects |
| `shared/validation/nanocredito.ts` | Schema Zod, `NANOCREDITO_STEPS`, reglas cruzadas |
| `shared/validation/schemas.ts` | Schemas auxiliares |
| `shared/types/credito.ts` | `LeadPayload`, `FileCapture`, `UtmParams`, `GeoCoords` |
| `shared/data/` | Bancos, departamentos/municipios Colombia |
| `shared/content/` | Textos legales (hábeas data) |

## Prisma (`database/prisma/schema.prisma`)

Modelo `Lead` con enum `LeadEstado` y tabla `CreditoParametros`. Campos indexados para filtros admin.

Configuración en `package.json`:

```json
"prisma": { "schema": "database/prisma/schema.prisma" }
```

## Scripts (`scripts/`)

| Script | Comando |
|--------|---------|
| `verify-backend.js` | `npm run verify:backend` — health check local |

## Convenciones

1. **Reglas de negocio** en `domain/`; **orquestación** en `application/`.
2. **Routes API** delgadas: validan HTTP y delegan al caso de uso.
3. **Validación** duplicada: Zod en cliente (UX) y servidor (seguridad).
4. **Adjuntos**: nunca binarios grandes en PostgreSQL; solo paths en JSON.
5. **Admin**: fetch con `cache: 'no-store'` para datos frescos.
6. **Producción**: `NEXT_PUBLIC_DEMO_MODE=false`, `LEAD_STORE` vacío, pooler `:6543`.

## Alias TypeScript (`tsconfig.json`)

```json
"@/*"              → src/*
"@/domain/*"       → src/domain/*
"@/application/*"  → src/application/*
"@/infrastructure/*" → src/infrastructure/*
"@/presentation/*" → src/presentation/*
"@/shared/*"       → src/shared/*
```
