# Capa de persistencia — Base de datos

Aquí vive el **schema PostgreSQL** del proyecto (Prisma).

```
database/
└── prisma/
    └── schema.prisma    # Modelos Lead, CreditoParametros
```

## Comandos

```bash
npm run db:push      # Sincronizar schema → PostgreSQL
npm run db:studio    # Explorador visual
npx prisma generate  # Regenerar cliente (postinstall lo hace solo)
```

## Conexión

Variables en `.env`:

- `DATABASE_URL` — pooler Supabase `:6543` (producción)
- `DIRECT_URL` — session pooler `:5432` (migraciones)

Guía: [docs/BACKEND_SETUP.md](../docs/BACKEND_SETUP.md)
