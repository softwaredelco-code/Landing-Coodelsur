# Documentación — Coodelsur Landing

Índice técnico del proyecto. Inicio rápido: [README principal](../README.md).

## Documentos activos

| Documento | Para qué |
|-----------|----------|
| [HEXAGONAL.md](./HEXAGONAL.md) | Arquitectura hexagonal, capas, flujos y reglas |
| [CODEBASE.md](./CODEBASE.md) | Mapa de archivos y responsabilidades |
| [BACKEND_SETUP.md](./BACKEND_SETUP.md) | PostgreSQL, Supabase, variables de entorno |
| [DESPLIEGUE.md](./DESPLIEGUE.md) | Checklist producción (Vercel + Supabase) |
| [API.md](./API.md) | Endpoints REST |
| [ADMIN.md](./ADMIN.md) | Panel de administración |
| [FORMULARIO.md](./FORMULARIO.md) | Microcrédito Small: pasos y validaciones |
| [FLUJO_MONTO.md](./FLUJO_MONTO.md) | Selector de monto y rangos por producto |
| [GUIA-NUEVO-FORMULARIO.md](./GUIA-NUEVO-FORMULARIO.md) | Implementar formularios urbano/rural |
| [WITME.md](./WITME.md) | Webhook Witme |

## Estado del producto

| Módulo | Estado |
|--------|--------|
| Landing + selector de monto | ✅ Producción |
| Formulario Microcrédito Small | ✅ Producción |
| Borradores incompletos | ✅ Producción |
| Panel admin | ✅ Producción |
| Supabase Storage | ✅ Producción |
| Microcrédito urbano / rural | 🔜 En desarrollo |

## Estructura del repositorio

```
coodelsur-landing/
├── database/prisma/     # Schema PostgreSQL
├── docs/                # Esta documentación
├── src/
│   ├── app/             # Páginas + API (Next.js)
│   ├── domain/          # Reglas de negocio
│   ├── application/     # Casos de uso
│   ├── infrastructure/  # DB, Storage, email
│   ├── presentation/    # UI React + formularios por producto
│   └── shared/          # Config, validación, tipos
└── scripts/             # verify-backend
```
