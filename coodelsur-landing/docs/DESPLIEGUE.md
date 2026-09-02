# Despliegue a producción

## Checklist Vercel + Supabase

### 1. Supabase

- [ ] Proyecto en región cercana (`sa-east-1` recomendado)
- [ ] `DATABASE_URL` — Transaction pooler, puerto **6543**, `?pgbouncer=true`
- [ ] `DIRECT_URL` — Session pooler, puerto **5432**
- [ ] Bucket Storage `lead-attachments` (privado o público según política)
- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Ejecutar `npm run db:push` contra producción (una vez)

### 2. Variables Vercel

Copiar desde `.env.example`. Obligatorias:

```
DATABASE_URL
DIRECT_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
ADMIN_PASSWORD          # Contraseña fuerte, única
NEXT_PUBLIC_SITE_URL    # https://tudominio.com
NEXT_PUBLIC_DEMO_MODE=false
```

Recomendadas:

```
SMTP_* + EMAIL_FROM     # Correo al cliente
DUPLICATE_CEDULA_DAYS=30
VERIFIK_API_KEY         # Opcional
```

**Nunca** en producción:

```
NEXT_PUBLIC_DEMO_MODE=true
LEAD_STORE=file
```

### 3. Build

```bash
npm run build
```

Vercel ejecuta `prisma generate` vía script `build` en `package.json`.

### 4. Verificación post-deploy

1. `GET https://tudominio.com/api/health` → `database: true`, `demoMode: false`
2. Enviar solicitud de prueba real
3. Revisar `/admin/leads`
4. Confirmar adjuntos en Storage

### 5. Dominio y HTTPS

- Configurar dominio en Vercel
- `NEXT_PUBLIC_SITE_URL` debe coincidir con el dominio final

## Mantenimiento

| Tarea | Comando / acción |
|-------|------------------|
| Ver schema DB | Supabase Table Editor o `npm run db:studio` |
| Backup | Supabase → Backups (plan Pro) |
| Rotar admin | Cambiar `ADMIN_PASSWORD` en Vercel + redeploy |
| Limpiar solicitud | Admin → Eliminar solicitud |
