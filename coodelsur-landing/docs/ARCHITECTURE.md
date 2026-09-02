# Arquitectura

## Visión general

Aplicación **Next.js 14** (App Router) que captura solicitudes de **Microcrédito Small**, las persiste en **PostgreSQL** (Supabase), almacena adjuntos en **Supabase Storage** y expone un **panel admin** protegido por contraseña.

```mermaid
flowchart TB
  subgraph Cliente
    A[Landing /] --> B[Formulario 8 pasos]
    B --> C[localStorage borrador]
    B --> D[POST /api/leads/draft]
    B --> E[POST /api/leads]
  end

  subgraph NextJS["Next.js (API Routes)"]
    D --> F[save-draft-lead]
    E --> G[create-lead]
    F --> H[(PostgreSQL)]
    G --> H
    G --> I[Supabase Storage]
    G --> J[SMTP / Resend]
  end

  subgraph Admin
    K[/admin/leads] --> L[GET /api/admin/leads]
    L --> H
    K --> M[Adjuntos proxy]
    M --> I
  end
```

## Capas

| Capa | Ubicación | Responsabilidad |
|------|-----------|-----------------|
| **Presentación** | `src/app/`, `src/components/` | Páginas, UI, formulario multi-paso |
| **API** | `src/app/api/` | HTTP, auth admin, orquestación |
| **Dominio** | `src/lib/leads/`, `src/lib/identity/` | Reglas de negocio, validaciones |
| **Infraestructura** | `src/lib/prisma.ts`, `src/lib/storage/` | DB, Storage, email, geo |
| **Configuración** | `src/config/`, `.env` | Productos, montos, amortización |

## Modelo de datos

Un solo modelo Prisma: **`Lead`**.

- **Campos desnormalizados** (`capitalSolicitado`, `progresoFormulario`, `pasoActualFormulario`) — listados admin rápidos sin leer JSON completo.
- **`datosFormulario` (JSON)** — payload completo del formulario + metadata de adjuntos.
- **`estado`** — workflow comercial (`incompleto` → `recibido` → …).

Ver `prisma/schema.prisma`.

## Flujo: solicitud completa

1. Usuario completa 8 pasos con validación Zod + reglas cruzadas (`collectCrossFieldErrors`).
2. `POST /api/leads` valida schema, identidad, duplicados de cédula.
3. Adjuntos se suben en **paralelo** a Storage (`processFileFields`).
4. Se inserta/actualiza fila en `Lead` (si venía de borrador `incompleto`).
5. Email de confirmación (si SMTP/Resend configurado).

## Flujo: borrador incompleto

1. Hook `useNanocreditoServerDraft` guarda cada ~2 s y al cambiar de paso.
2. `POST /api/leads/draft` → estado `incompleto` en BD.
3. Deduplicación por cédula/teléfono + cola serializada en cliente (evita duplicados).
4. Al enviar formulario completo, mismo registro pasa a `recibido`.

## Fallback de desarrollo

Si PostgreSQL no responde, `create-lead` y `save-draft-lead` pueden escribir en `data/leads.json` (`LEAD_STORE=file` fuerza esto). **No usar en producción.**

## Seguridad

| Recurso | Protección |
|---------|------------|
| Panel admin | Cookie firmada (`ADMIN_PASSWORD`) |
| APIs admin | Middleware en cada route |
| Storage | Service role key solo en servidor; admin sirve adjuntos vía proxy |
| Witme webhook | Bearer `WITME_API_KEY` |

## Decisiones técnicas

- **Zod + React Hook Form** — validación compartida cliente/servidor.
- **Transaction pooler (6543)** — conexiones eficientes en serverless (Vercel).
- **Adjuntos fuera del JSON** — paths en Storage; JSON liviano en admin.
- **Validación CC colombiana** — 6, 7 o 10 dígitos (`src/lib/identity/cedula.ts`).
