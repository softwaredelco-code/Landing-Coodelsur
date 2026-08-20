# Coodelsur — Solicitud de crédito

Formularios públicos de crédito con captura de leads, tracking UTM, geolocalización, Storage y panel admin.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Prisma** + **PostgreSQL** (local Docker o Supabase)
- **Supabase Storage** — cédula, video, firma
- **React Hook Form** + **Zod**

## Inicio rápido (backend)

### 1. Variables de entorno

```bash
cp .env.local.example .env.local
cp .env.local.example .env
```

Ajusta en `.env` / `.env.local`:

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | PostgreSQL (local o Supabase) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Subida de archivos |
| `SUPABASE_STORAGE_BUCKET` | Default `lead-attachments` |
| `ADMIN_PASSWORD` | Acceso a `/admin` |
| `WITME_API_KEY` | Webhook Witme |
| `NEXT_PUBLIC_DEMO_MODE` | `false` para guardar en DB |

### 2. Base de datos

**Opción A — Docker local**

```bash
docker compose up -d
npm run db:push
```

**Opción B — Supabase**

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Copia la connection string URI a `DATABASE_URL`
3. Storage → New bucket `lead-attachments` (público o con URLs firmadas)
4. API → `SUPABASE_URL` + `service_role` key
5. `npm run db:push`

### 3. Arrancar

```bash
npm install
npm run dev
```

- Formularios: http://localhost:3000  
- Salud backend: http://localhost:3000/api/health  
- Admin: http://localhost:3000/admin  

## Rutas API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/leads` | Guarda solicitud del formulario |
| `POST` | `/api/leads/witme` | Webhook Witme (`Bearer` token) |
| `GET` | `/api/health` | Estado DB / Storage / flags |
| `POST` | `/api/admin/login` | Login admin |
| `GET` | `/api/admin/leads` | Listado (cookie admin) |
| `GET` | `/api/admin/leads/:id` | Detalle |
| `PATCH` | `/api/admin/leads` | Cambiar `estado` |

## Flujo de una solicitud

1. Usuario completa Microcrédito Small y acepta hábeas data + firma  
2. Frontend hace `POST /api/leads` (UTM desde cookie)  
3. Backend valida con Zod, sube adjuntos a Storage, inserta `Lead`  
4. Admin revisa en `/admin/leads`

## Despliegue Vercel — checklist

1. Conectar el repo en Vercel  
2. Variables de entorno (todas las de `.env.example`)  
3. `NEXT_PUBLIC_DEMO_MODE=false`  
4. `DATABASE_URL` de Supabase (pooler si aplica)  
5. Credenciales Storage  
6. `ADMIN_PASSWORD` fuerte  
7. Dominio / DNS  
8. Probar `/api/health` en producción  

## Scripts

```bash
npm run db:push      # sincroniza schema Prisma → DB
npm run db:studio    # explorador visual
npm run verify:backend  # prisma generate + health check
```

Guía detallada: [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md)

Flujo por monto (nano/micro): [docs/FLUJO_MONTO.md](docs/FLUJO_MONTO.md)
