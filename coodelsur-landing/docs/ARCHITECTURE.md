# Arquitectura

## Visión general

Aplicación **Next.js 14** (App Router) con **arquitectura hexagonal** que captura solicitudes de **Microcrédito Small**, las persiste en **PostgreSQL** (Supabase), almacena adjuntos en **Supabase Storage** y expone un **panel admin** protegido por contraseña.

Guía detallada de capas: [HEXAGONAL.md](./HEXAGONAL.md).

```mermaid
flowchart TB
  subgraph Cliente
    A[Landing /] --> B[Formulario 8 pasos]
    B --> C[localStorage borrador]
    B --> D[POST /api/leads/draft]
    B --> E[POST /api/leads]
  end

  subgraph AdaptadorHTTP["src/app/ — Adaptador HTTP"]
    D --> F[save-draft-lead]
    E --> G[create-lead]
  end

  subgraph Application["src/application/ — Casos de uso"]
    F
    G
  end

  subgraph Domain["src/domain/ — Negocio"]
    H[form-progress]
    I[attachments]
    J[amortización / cédula]
  end

  subgraph Infra["src/infrastructure/"]
    K[(PostgreSQL)]
    L[Supabase Storage]
    M[SMTP / Resend]
  end

  F --> H
  G --> I
  G --> J
  F --> K
  G --> K
  G --> L
  G --> M

  subgraph Admin
    N[/admin/leads] --> O[GET /api/admin/leads]
    O --> K
    N --> P[Adjuntos proxy]
    P --> L
  end
```

## Capas

| Capa | Ubicación | Responsabilidad |
|------|-----------|-----------------|
| **Adaptador HTTP** | `src/app/` | Páginas y API Routes (Next.js) |
| **Presentación** | `src/presentation/` | UI React, hooks, tracking |
| **Application** | `src/application/` | Casos de uso (create-lead, save-draft…) |
| **Domain** | `src/domain/` | Reglas de negocio puras |
| **Infrastructure** | `src/infrastructure/` | DB, Storage, email, geo, auth |
| **Shared** | `src/shared/` | Config, validación Zod, tipos |
| **Schema** | `database/prisma/` | Modelo PostgreSQL |

## Modelo de datos

Modelos Prisma en `database/prisma/schema.prisma`:

- **`Lead`** — solicitud de crédito.
- **`CreditoParametros`** — tasas y plazos editables desde admin.

Campos desnormalizados en `Lead` (`capitalSolicitado`, `progresoFormulario`, `pasoActualFormulario`) permiten listados admin rápidos sin leer JSON completo.

- **`datosFormulario` (JSON)** — payload completo del formulario + metadata de adjuntos.
- **`estado`** — workflow comercial (`incompleto` → `recibido` → …).

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

- **Arquitectura hexagonal** — negocio desacoplado de Next.js y Supabase.
- **Zod + React Hook Form** — validación compartida cliente/servidor.
- **Transaction pooler (6543)** — conexiones eficientes en serverless (Vercel).
- **Adjuntos fuera del JSON** — paths en Storage; JSON liviano en admin.
- **Validación CC colombiana** — 6, 7 o 10 dígitos (`domain/identity/cedula.ts`).
