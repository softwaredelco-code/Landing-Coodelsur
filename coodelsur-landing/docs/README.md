# Documentación — Coodelsur Landing

Índice técnico del proyecto. Para iniciar rápido, ver el [README principal](../README.md).

## Contenido

| Documento | Descripción |
|-----------|-------------|
| [CAPACITACION-DEV.md](./CAPACITACION-DEV.md) | **Guion de capacitación** — onboarding devs (cero → avanzado) |
| [capacitacion-desarrolladores-coodelsur.docx](./capacitacion-desarrolladores-coodelsur.docx) | Capacitación devs — Word (`npm run docs:capacitacion`) |
| [HEXAGONAL.md](./HEXAGONAL.md) | **Arquitectura hexagonal** — capas, carpetas y reglas |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitectura, capas, flujos y decisiones técnicas |
| [CODEBASE.md](./CODEBASE.md) | Mapa de archivos y responsabilidades por módulo |
| [FORMULARIO.md](./FORMULARIO.md) | Formulario Microcrédito Small: pasos, validaciones, borradores |
| [API.md](./API.md) | Endpoints REST, autenticación y respuestas |
| [ADMIN.md](./ADMIN.md) | Panel de administración y gestión de solicitudes |
| [BACKEND_SETUP.md](./BACKEND_SETUP.md) | Configuración de PostgreSQL, Supabase y verificación |
| [FLUJO_MONTO.md](./FLUJO_MONTO.md) | Selector de monto y rangos por producto |
| [GUIA-NUEVO-FORMULARIO.md](./GUIA-NUEVO-FORMULARIO.md) | **Onboarding dev** — cómo implementar urbano/rural |
| [DESPLIEGUE.md](./DESPLIEGUE.md) | Checklist de producción (Vercel + Supabase) |
| [manual-usuario-coodelsur.docx](./manual-usuario-coodelsur.docx) | **Manual de usuario** (sitio público + panel admin) — Word |
| [manual-tecnico-coodelsur.docx](./manual-tecnico-coodelsur.docx) | **Manual técnico** (arquitectura, API, despliegue) — Word |
| [formulario-microcredito-small-campos-witme.docx](./formulario-microcredito-small-campos-witme.docx) | **Campos del formulario Small para Witme** (sin API aún) |
| [WITME_FORMULARIO.md](./WITME_FORMULARIO.md) | Índice del documento Witme |
| [WITME_API.md](./WITME_API.md) | Integración API (fase posterior, cuando haya despliegue) |

## Estado del producto (agosto 2026)

| Módulo | Estado |
|--------|--------|
| Landing + selector de monto | ✅ Producción |
| Formulario Microcrédito Small | ✅ Producción |
| Borradores incompletos (servidor) | ✅ Producción |
| Panel admin | ✅ Producción |
| Supabase Storage (adjuntos) | ✅ Producción |
| Validación identidad (local) | ✅ Producción |
| Verifik / Registraduría | ⚙️ Opcional |
| Correo confirmación (SMTP/Resend) | ⚙️ Pendiente configurar |
| Microcrédito urbano / rural | 🔜 Próximamente |
| Analytics GTM / Meta | 🔜 Pendiente |

## Estructura del repositorio

```
coodelsur-landing/
├── database/             # Schema PostgreSQL (Prisma)
│   └── prisma/
├── docs/                 # Documentación técnica
├── public/               # Assets estáticos e imágenes
├── scripts/              # Utilidades (verify-backend, manuales Word)
├── src/
│   ├── app/              # Adaptador HTTP (Next.js — páginas + API)
│   ├── domain/           # Núcleo de negocio
│   ├── application/      # Casos de uso
│   ├── infrastructure/   # DB, Storage, email, auth
│   ├── presentation/     # UI React
│   └── shared/           # Config, tipos, validación
├── data/                 # Fallback JSON local (gitignored, solo dev)
└── docker-compose.yml    # PostgreSQL local opcional
```
