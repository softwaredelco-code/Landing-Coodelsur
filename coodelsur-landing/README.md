# Coodelsur — Solicitud de crédito

Landing y formulario de **Microcrédito Small** con captura de leads, validaciones de identidad, correo de confirmación, tracking UTM, geolocalización, Storage y panel admin.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Prisma** + **PostgreSQL** (Supabase recomendado en producción)
- **Supabase Storage** — cédula, video, firma
- **React Hook Form** + **Zod**
- **Resend** — correo de confirmación al usuario (opcional)
- **Verifik** — consulta Registraduría para CC (opcional de pago)

---

## Inicio rápido

### 1. Variables de entorno

```bash
cp .env.local.example .env.local
cp .env.example .env
```

| Variable | Requerida | Uso |
|----------|-----------|-----|
| `DATABASE_URL` | Sí | PostgreSQL. En Supabase: **Connect → Transaction pooler** (puerto `6543`) + `?pgbouncer=true` |
| `DIRECT_URL` | Sí (Supabase) | **Connect → Session pooler** (puerto `5432`) para migraciones Prisma (`db:push`) |
| `SUPABASE_URL` | Sí | Project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Secret key de API (Settings → API Keys) |
| `SUPABASE_STORAGE_BUCKET` | Sí | Bucket de adjuntos (default: `lead-attachments`) |
| `ADMIN_PASSWORD` | Sí | Contraseña del panel `/admin` (la defines tú) |
| `NEXT_PUBLIC_SITE_URL` | Sí | URL pública del sitio |
| `NEXT_PUBLIC_DEMO_MODE` | Sí | `false` = guarda en DB y envía al backend real |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Recomendado | **Brevo o Gmail** — envía a cualquier correo del usuario |
| `SMTP_PORT` | No | Default `587` |
| `EMAIL_FROM` | Sí (con SMTP o Resend) | Remitente visible, ej. `Coodelsur <cartera@coodelsursas.com.co>` |
| `RESEND_API_KEY` | No | Alternativa; **requiere dominio verificado** para terceros |
| `VERIFIK_API_KEY` | No | Consulta Registraduría (CC). Sin esto: validación local gratuita |
| `DUPLICATE_CEDULA_DAYS` | No | Días para bloquear solicitudes duplicadas (default: `30`) |
| `WITME_API_KEY` | No | Webhook Witme |
| `IPAPI_KEY` | No | Geolocalización por IP |
| `LEAD_STORE` | No | `file` = forzar `data/leads.json`; vacío = PostgreSQL |

### 2. Supabase (producción recomendada)

1. Crea proyecto en [supabase.com](https://supabase.com) (región `sa-east-1` cerca de Colombia).
2. **Connect** (botón verde arriba) → **Transaction pooler** → copia URI → `DATABASE_URL`.
3. Misma pantalla → **Session pooler** → copia URI → `DIRECT_URL`.
4. **Settings → API Keys** → `SUPABASE_URL` + Secret key → `SUPABASE_SERVICE_ROLE_KEY`.
5. **Storage → New bucket** → nombre `lead-attachments` → marcar **Public bucket**.
6. Sincroniza schema:

```bash
npm run db:push
```

### 3. Docker local (alternativa)

```bash
docker compose up -d
npm run db:push
```

Usa la `DATABASE_URL` local del `.env.example`. No necesitas `DIRECT_URL` en local.

### 4. Arrancar

```bash
npm install
npm run dev
```

| URL | Descripción |
|-----|-------------|
| http://localhost:3000 | Formulario de solicitud |
| http://localhost:3000/admin | Panel admin |
| http://localhost:3000/api/health | Diagnóstico del backend |

---

## Dónde ver los datos guardados

### Panel admin (recomendado)

- **Listado:** `/admin/leads`
- **Detalle:** `/admin/leads/[id]`
- Login con `ADMIN_PASSWORD`

### Supabase

- **Table Editor → `Lead`** — cada solicitud (UTM, origen, estado, `datosFormulario` en JSON)
- **Storage → `lead-attachments`** — fotos, video y firma (`leads/`)

---

## Rutas API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/leads` | Guarda solicitud (validación + duplicados + email) |
| `POST` | `/api/verify-cedula` | Validación de documento en tiempo real |
| `POST` | `/api/leads/witme` | Webhook Witme (`Bearer` token) |
| `GET` | `/api/health` | Estado DB, Storage, email, verificación |
| `POST` | `/api/admin/login` | Login admin |
| `GET` | `/api/admin/leads` | Listado (cookie admin) |
| `GET` | `/api/admin/leads/:id` | Detalle |
| `PATCH` | `/api/admin/leads` | Cambiar `estado` |

---

## Flujo de una solicitud

1. Usuario elige monto y completa el formulario **Microcrédito Small** (7 pasos).
2. En **Datos generales** se valida el documento en tiempo real (`POST /api/verify-cedula`).
3. Usuario adjunta cédula (frontal/reverso), video, firma y acepta hábeas data.
4. Frontend envía `POST /api/leads` con UTM desde cookie.
5. Backend:
   - Valida schema Zod
   - Ejecuta **validaciones gratuitas** de identidad
   - Rechaza duplicados recientes (misma cédula)
   - Sube adjuntos a Supabase Storage
   - Inserta fila en `Lead`
   - Envía **correo de confirmación** (si Resend está configurado)
6. Admin revisa en `/admin/leads` y cambia el estado.

---

## Microcrédito Small — reglas de negocio

### Fecha de pago oportuno

En este producto **el cliente no elige** la fecha de pago oportuno. Se guarda:

```json
{ "fechaPagoOportunoModo": "30_dias_despues_desembolso" }
```

La regla: **30 días después del desembolso** del crédito.

---

## Validación de documentos

### Capa gratuita (activa por defecto)

Implementada en `src/lib/identity/cedula-local.ts` y `src/lib/identity/verify-document.ts`.

| Validación | Descripción |
|------------|-------------|
| Formato por tipo | CC 6–10 dígitos, CE, TI, PPT, NIT, PAS |
| Nombre completo | Mínimo 2 palabras, sin números |
| Edad mínima | 18 años para solicitar crédito |
| Fechas coherentes | Expedición posterior a nacimiento |
| CC + expedición | CC expedida a partir de los 18 años |
| Fecha futura | Expedición no puede ser futura |
| Duplicados | Bloquea misma cédula con solicitud activa en `DUPLICATE_CEDULA_DAYS` |
| Celular | Formato colombiano (10 dígitos, inicia en 3) |

Estados activos que cuentan como duplicado: `recibido`, `revisado`, `contactado`.  
No bloquea si el lead anterior está en `descartado`.

**Revisión manual:** fotos de cédula, video de verificación y firma (paso de verificación del formulario).

### Capa opcional de pago — Registraduría (Verifik)

La Registraduría **no tiene API pública gratuita**. Si configuras:

```env
VERIFIK_API_KEY=tu_token
```

el sistema consulta Registraduría vía [Verifik](https://verifik.co) **solo para CC**, además de las validaciones locales. Sin esta variable, todo funciona con la capa gratuita.

Resultado guardado en `datosFormulario.cedulaVerificacion`:

```json
{
  "status": "valid_local",
  "message": "...",
  "localChecks": ["Formato de documento válido", "..."],
  "provider": "local",
  "verifiedAt": "2026-08-20T..."
}
```

---

## Correo de confirmación

Al enviar el formulario, se envía un correo al **e-mail que el usuario escribió** (Gmail, Outlook, Yahoo, etc.) con:

- Número de solicitud
- Estado: **Recibida — en revisión**
- Resumen (capital, cuotas, domicilio, etc.)

### Opción recomendada — SMTP Brevo (gratis, sin DNS)

1. Cuenta en [brevo.com](https://www.brevo.com) (plan free ~300 correos/día)
2. **Remitentes** → agrega `cartera@coodelsursas.com.co` → verifica con el enlace que llega al buzón (**no requiere configurar DNS**)
3. **SMTP & API** → crea clave SMTP
4. Variables en `.env.local`:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=tu-email-de-login-en-brevo
SMTP_PASS=clave-smtp-generada
EMAIL_FROM=Coodelsur <cartera@coodelsursas.com.co>
```

5. Reinicia `npm run dev` → `/api/health` debe mostrar `"emailTransport": "smtp"`

### Alternativa — SMTP Gmail

Si usas Gmail o Google Workspace con contraseña de aplicación:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASS=contraseña-de-aplicacion-de-16-caracteres
EMAIL_FROM=Coodelsur <tu@gmail.com>
```

### Resend (solo si verificas dominio en DNS)

Resend con `onboarding@resend.dev` **no envía a clientes**; solo a tu cuenta. Para terceros necesitas dominio verificado en DNS.

Prioridad del código: **SMTP** (si está configurado) → **Resend** → simulado en consola.

Sin correo configurado, la solicitud **sí se guarda** en la base de datos.

---

## Tracking y campañas (UTM)

| Componente | Estado |
|------------|--------|
| Captura UTM en cookie (`coodelsur_utm`, 30 días) | ✅ |
| UTM guardado en DB al enviar formulario | ✅ |
| Geolocalización IP + navegador | ✅ |
| Panel admin con origen y UTM | ✅ |
| Google Analytics / GTM / Meta Pixel | ❌ Pendiente |

URLs de campaña de ejemplo:

```
https://tudominio.com/solicitar?monto=5000000&utm_source=facebook&utm_campaign=marzo2026
```

---

## Panel admin — estados del lead

| Estado | Significado |
|--------|-------------|
| `recibido` | Solicitud nueva |
| `revisado` | Revisada por el equipo |
| `contactado` | Asesor se comunicó |
| `descartado` | No procede |

---

## Diagnóstico (`GET /api/health`)

Respuesta esperada en producción:

```json
{
  "ok": true,
  "demoMode": false,
  "database": true,
  "storageConfigured": true,
  "adminConfigured": true,
  "emailConfigured": true,
  "cedulaVerifyConfigured": false
}
```

- `emailConfigured` — `RESEND_API_KEY` + `EMAIL_FROM`
- `cedulaVerifyConfigured` — `VERIFIK_API_KEY` (opcional)

---

## Despliegue Vercel — checklist

1. Conectar el repo en Vercel
2. Variables de entorno (todas las de `.env.example`)
3. `DATABASE_URL` (Transaction pooler, puerto 6543)
4. `DIRECT_URL` (Session pooler, puerto 5432)
5. Credenciales Supabase Storage
6. `ADMIN_PASSWORD` fuerte
7. `NEXT_PUBLIC_DEMO_MODE=false`
8. (Opcional) `RESEND_API_KEY` + `EMAIL_FROM`
9. Dominio / DNS
10. Probar `/api/health` en producción

---

## Scripts

```bash
npm run dev            # servidor de desarrollo
npm run build          # prisma generate + build producción
npm run db:push        # sincroniza schema Prisma → DB
npm run db:studio      # explorador visual Prisma
npm run verify:backend # prisma generate + health check
```

---

## Estructura relevante

```
src/
├── app/api/leads/          # Receptor de solicitudes
├── app/api/verify-cedula/  # Validación documento en tiempo real
├── app/admin/              # Panel admin
├── components/forms/       # Formulario multi-paso
├── lib/email/              # Correo de confirmación (Resend)
├── lib/identity/           # Validación local + Verifik opcional
├── lib/leads/              # Creación de leads + duplicados
├── lib/tracking/           # UTM cookie
└── lib/validation/         # Schemas Zod
```

---

## Documentación adicional

- [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md) — setup backend paso a paso
- [docs/FLUJO_MONTO.md](docs/FLUJO_MONTO.md) — flujo por monto (nano/micro)
