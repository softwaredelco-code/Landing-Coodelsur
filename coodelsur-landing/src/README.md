# Código fuente — Arquitectura hexagonal

Este proyecto usa **arquitectura hexagonal** (ports & adapters). Cada carpeta tiene una responsabilidad clara.

```
src/
├── app/                    # Adaptadores HTTP (Next.js App Router)
├── domain/                 # Núcleo de negocio (sin I/O)
├── application/            # Casos de uso (orquestación)
├── infrastructure/         # Adaptadores de salida (DB, Storage, email…)
├── presentation/           # UI React (componentes, hooks)
└── shared/                 # Config, tipos, validación, utilidades
```

## Reglas de dependencia

| Capa | Puede importar de |
|------|-------------------|
| `domain/` | Solo `shared/`, otros módulos `domain/` |
| `application/` | `domain/`, `shared/` |
| `infrastructure/` | `domain/`, `application/`, `shared/` |
| `presentation/` | `application/`, `domain/`, `shared/` |
| `app/` (API/pages) | Todas (capa delgada, solo orquesta) |

**Prohibido:** `domain/` no debe importar de `infrastructure/` ni `presentation/`.

## Base de datos

El schema PostgreSQL vive en **`database/prisma/`** (raíz del repo, no dentro de `src/`).

Ver [docs/HEXAGONAL.md](../docs/HEXAGONAL.md) para el mapa completo.
