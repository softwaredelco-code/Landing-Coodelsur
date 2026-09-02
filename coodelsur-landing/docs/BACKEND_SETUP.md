# Configuración del backend

Guía para conectar PostgreSQL, Supabase Storage y verificar que el entorno responde correctamente.

## Requisitos

- Node.js 18+
- Cuenta [Supabase](https://supabase.com) (producción) **o** Docker (local)

## Supabase (recomendado)

1. Crear proyecto (región `sa-east-1`).
2. **Connect → Transaction pooler** → `DATABASE_URL` (puerto `6543`, `?pgbouncer=true`).
3. **Connect → Session pooler** → `DIRECT_URL` (puerto `5432`).
4. **Settings → API Keys** → `SUPABASE_URL` + Secret key → `SUPABASE_SERVICE_ROLE_KEY`.
5. **Storage → New bucket** → `lead-attachments`.
6. Sincronizar schema:

```bash
npm run db:push
npm run dev
```

7. Verificar: [http://localhost:3000/api/health](http://localhost:3000/api/health) → `"database": true`.

## Docker local (alternativa)

```bash
docker compose up -d
npm run db:push
```

Usar `DATABASE_URL` de `.env.example`. No requiere `DIRECT_URL`.

## Script de verificación

```bash
npm run verify:backend
```

Ejecuta `prisma generate` y consulta `/api/health`.

## Checklist antes de producción

- [ ] `NEXT_PUBLIC_DEMO_MODE=false`
- [ ] `LEAD_STORE` vacío (usa PostgreSQL, no JSON local)
- [ ] `ADMIN_PASSWORD` definida
- [ ] Storage configurado (`storageConfigured: true` en health)
- [ ] SMTP o Resend para correos al cliente (opcional pero recomendado)

## Solución de problemas

| Error | Causa | Solución |
|-------|-------|----------|
| `P1001` localhost:5432 | PostgreSQL no corre | Docker o Supabase |
| `Invalid Compact JWS` en Storage | Clave `sb_secret_` mal usada | Ya corregido en `supabaseStorageHeaders` |
| Admin vacío pero hay datos | Caché navegador | Ctrl+Shift+R en `/admin/leads` |
| Lentitud en admin | Pooler incorrecto | Usar puerto 6543 en `DATABASE_URL` |

Ver también: [DESPLIEGUE.md](./DESPLIEGUE.md), [API.md](./API.md).
