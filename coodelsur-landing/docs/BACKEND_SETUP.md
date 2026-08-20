# Verificación backend (cuando tengas PostgreSQL)

## Estado actual del código

- Formulario Nanocrédito → `POST /api/leads`
- Schema Prisma con `estado`, `aceptaTerminos`, `fechaAceptacionTerminos`
- Storage con límites (imagen 5MB, video 15MB)
- Panel `/admin` + APIs admin
- Webhook Witme listo (`WITME_API_KEY`)
- `GET /api/health` para diagnóstico

## Por qué `db:push` puede fallar en local

Si ves `P1001: Can't reach database server at localhost:5432`, aún no hay PostgreSQL corriendo.

### Opción rápida (Supabase)

1. Crea proyecto en https://supabase.com  
2. Settings → Database → URI → pégalo en `.env` y `.env.local` como `DATABASE_URL`  
3. Storage → bucket `lead-attachments`  
4. Settings → API → `SUPABASE_URL` + `service_role` en `.env.local`  
5. Ejecuta:

```bash
npm run db:push
npm run dev
```

6. Abre http://localhost:3000/api/health → `"database": true`  
7. Envía un Nanocrédito de prueba y revisa Table Editor → `Lead`  
8. Entra a http://localhost:3000/admin con `ADMIN_PASSWORD`

### Opción Docker (si instalas Docker Desktop)

```bash
docker compose up -d
npm run db:push
```

## Checklist de prueba manual (Fase 1)

- [ ] `/api/health` responde `database: true`
- [ ] `NEXT_PUBLIC_DEMO_MODE=false`
- [ ] Envío de formulario crea fila en `Lead`
- [ ] Con Storage configurado, adjuntos tienen `url`
- [ ] Confirmación muestra número de solicitud (id)
- [ ] Admin lista el lead en `/admin/leads`
