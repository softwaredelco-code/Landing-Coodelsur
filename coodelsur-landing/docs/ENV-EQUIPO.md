# Variables de entorno — equipo de desarrollo

Guía para crear `.env` y `.env.local` en una máquina nueva.

## Opción rápida (PowerShell)

Desde la raíz del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-env.ps1
```

Eso crea `.env` y `.env.local` copiando `.env.example`.

## Qué debe pegar el líder del equipo

El líder comparte **por canal privado** (no Git, no Slack público) estos valores:

| Variable en `.env` | Qué es |
|--------------------|--------|
| `DATABASE_URL` | Supabase → Transaction pooler (`:6543`) |
| `DIRECT_URL` | Supabase → Session pooler (`:5432`) |
| `SUPABASE_URL` | URL del proyecto (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_...`) |
| `ADMIN_PASSWORD` | Contraseña del panel `/admin` |

El resto puede quedar como en la plantilla.

## Valores fijos para desarrollo local

```env
SUPABASE_STORAGE_BUCKET="lead-attachments"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_DEMO_MODE="false"
LEAD_STORE=""
```

## Verificar

```powershell
npm run db:push
npm run dev
```

Abrir http://localhost:3000/api/health → debe mostrar `"database": true`.

## Errores comunes

| Síntoma | Causa |
|---------|--------|
| `database: false` | `DATABASE_URL` incorrecta o sin internet |
| Adjuntos no suben | `SUPABASE_SERVICE_ROLE_KEY` mal o bucket inexistente |
| Formulario no guarda | `NEXT_PUBLIC_DEMO_MODE=true` |
| Admin no entra | `ADMIN_PASSWORD` distinta a la del líder |
