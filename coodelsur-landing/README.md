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
cp .env.local.example .env.local
cp .env.example .env
# Editar variables (Supabase o Docker)
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

Toda la documentación técnica está en **[docs/](./docs/README.md)**:

- [Arquitectura](./docs/ARCHITECTURE.md)
- [Mapa del código](./docs/CODEBASE.md)
- [Formulario](./docs/FORMULARIO.md)
- [API REST](./docs/API.md)
- [Panel admin](./docs/ADMIN.md)
- [Backend setup](./docs/BACKEND_SETUP.md)
- [Despliegue](./docs/DESPLIEGUE.md)
- [Flujo por monto](./docs/FLUJO_MONTO.md)

## Scripts

```bash
npm run dev              # Desarrollo
npm run build            # Build producción
npm run db:push          # Sincronizar schema → DB
npm run db:studio        # Explorador Prisma
npm run verify:backend   # Health check
```

## Estructura

```
src/
├── app/              # Páginas y API routes
├── components/       # UI, landing, formularios
├── config/           # Productos y reglas de crédito
├── hooks/            # Borradores (local + servidor)
├── lib/              # Lógica de negocio
└── types/            # Tipos compartidos
docs/                 # Documentación
prisma/               # Schema PostgreSQL
scripts/              # verify-backend.js
```

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
