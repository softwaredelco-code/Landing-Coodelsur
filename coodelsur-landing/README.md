# Coodelsur — Landing de solicitud de crédito

Landing y formulario de **Microcrédito Small** para Coodelsur: captura de leads, validación de identidad, adjuntos en Storage, borradores incompletos y panel de administración.

## Stack

| Tecnología | Uso |
|------------|-----|
| Next.js 14 (App Router) | Frontend + API |
| TypeScript | Tipado estricto |
| Prisma + PostgreSQL | Persistencia (Supabase en prod) |
| Supabase Storage | Cédula, video, firma |
| React Hook Form + Zod | Formulario y validaciones |
| Tailwind CSS | Estilos |

## Inicio rápido

```bash
cp .env.example .env
cp .env.example .env.local
# Editar variables (reemplazar PEGAR_* con credenciales del equipo)
npm install
npm run db:push
npm run dev
```

| URL | Descripción |
|-----|-------------|
| http://localhost:3000 | Landing + formulario |
| http://localhost:3000/admin | Panel admin |
| http://localhost:3000/api/health | Diagnóstico |

## Documentación

Toda la documentación está en **[docs/](./docs/README.md)**:

- [Arquitectura hexagonal](./docs/HEXAGONAL.md)
- [Mapa del código](./docs/CODEBASE.md)
- [Backend setup](./docs/BACKEND_SETUP.md)
- [Despliegue](./docs/DESPLIEGUE.md)
- [API REST](./docs/API.md)
- [Panel admin](./docs/ADMIN.md)
- [Formulario Small](./docs/FORMULARIO.md)
- [Flujo por monto](./docs/FLUJO_MONTO.md)
- [Guía nuevo formulario](./docs/GUIA-NUEVO-FORMULARIO.md)

## Scripts

```bash
npm run dev              # Desarrollo
npm run build            # Build producción
npm run db:push          # Sincronizar schema → DB
npm run db:studio        # Explorador Prisma
npm run verify:backend   # Health check
```

## Estructura (arquitectura hexagonal)

```
database/prisma/        # Schema PostgreSQL (Lead, CreditoParametros)
src/
├── app/                # Adaptador HTTP — páginas y API (Next.js)
├── domain/             # Núcleo de negocio (reglas puras)
├── application/        # Casos de uso (create-lead, save-draft…)
├── infrastructure/     # DB, Storage, email, auth
├── presentation/       # UI React (componentes, hooks)
└── shared/             # Config, tipos, validación Zod
docs/                   # Documentación
scripts/                # Utilidades CLI
```

Guía completa: [docs/HEXAGONAL.md](./docs/HEXAGONAL.md)

## Variables críticas

| Variable | Producción |
|----------|------------|
| `DATABASE_URL` | Transaction pooler `:6543` |
| `NEXT_PUBLIC_DEMO_MODE` | **`false`** |
| `ADMIN_PASSWORD` | Contraseña fuerte |
| `LEAD_STORE` | **Vacío** (no usar `file`) |

Detalle completo en `.env.example`.

---

**Coodelsur SAS** — Microcrédito Small · Colombia
