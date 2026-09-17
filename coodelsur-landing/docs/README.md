# Documentación — Coodelsur Landing

Índice técnico del proyecto. Inicio rápido: [README principal](../README.md).

## Documentos activos

| Documento | Para qué |
|-----------|----------|
| [HEXAGONAL.md](./HEXAGONAL.md) | Arquitectura hexagonal, capas, flujos y reglas |
| [CODEBASE.md](./CODEBASE.md) | Mapa de archivos y responsabilidades |
| [BACKEND_SETUP.md](./BACKEND_SETUP.md) | PostgreSQL, Supabase, variables de entorno |
| [ENV-EQUIPO.md](./ENV-EQUIPO.md) | Crear `.env` en máquina nueva (equipo) |
| [DESPLIEGUE.md](./DESPLIEGUE.md) | Checklist producción (Vercel + Supabase) |
| [API.md](./API.md) | Endpoints REST |
| [ADMIN.md](./ADMIN.md) | Panel de administración |
| [FORMULARIO.md](./FORMULARIO.md) | Microcrédito Small: pasos y validaciones |
| [FLUJO_MONTO.md](./FLUJO_MONTO.md) | Selector de monto y rangos por producto |
| [GUIA-NUEVO-FORMULARIO.md](./GUIA-NUEVO-FORMULARIO.md) | Implementar formularios urbano/rural |
| [witme/COODELSUR-INTEGRACION-WITME.pdf](./witme/COODELSUR-INTEGRACION-WITME.pdf) | **Entregar a Witme** — API + redirect (documento único) |
| [witme/README.md](./witme/README.md) | Índice carpeta Witme |
| [HANDOFF-CONTEXTO-IA-COMPLETO.md](./HANDOFF-CONTEXTO-IA-COMPLETO.md) | Contexto completo del proyecto (handoff IA) |

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
