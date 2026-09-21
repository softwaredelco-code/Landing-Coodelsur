# Coodelsur Landing — Contexto completo del proyecto

> **Documento interno** — Coodelsur SAS  
> **Fecha:** 11 de septiembre de 2026  
> **Clasificación:** Confidencial — contiene credenciales y configuración de producción  
> **Repositorio:** `Landing-Coodelsur/coodelsur-landing`

---

## Tabla de contenido

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Qué es este proyecto](#2-qué-es-este-proyecto)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Arquitectura y composición del código](#4-arquitectura-y-composición-del-código)
5. [Base de datos — estrategia única para todos los formularios](#5-base-de-datos--estrategia-única-para-todos-los-formularios)
6. [Flujos de captura de leads](#6-flujos-de-captura-de-leads)
7. [Integración Witme](#7-integración-witme)
8. [Variables de entorno (completas)](#8-variables-de-entorno-completas)
9. [Panel de administración](#9-panel-de-administración)
10. [API REST — endpoints principales](#10-api-rest--endpoints-principales)
11. [Despliegue en cPanel (estado actual)](#11-despliegue-en-cpanel-estado-actual)
12. [Requisitos de hardware](#12-requisitos-de-hardware)
13. [Documentación relacionada](#13-documentación-relacionada)
14. [Checklist de verificación](#14-checklist-de-verificación)

---

## 1. Resumen ejecutivo

**Coodelsur Landing** es una aplicación web para capturar solicitudes de crédito (microcrédito y futuros productos), almacenarlas en PostgreSQL (Supabase), gestionar adjuntos en Supabase Storage y administrarlas desde un panel interno.

| Aspecto | Detalle |
|---------|---------|
| **Dominio producción** | `https://solicitar-credito.coodelsursas.com.co` |
| **Hosting** | cPanel (Conexcol) — Node.js 18+ |
| **Base de datos** | PostgreSQL en Supabase (nube) |
| **Archivos adjuntos** | Supabase Storage (bucket `lead-attachments`) |
| **Integración externa** | Webhook Witme → `/api/leads/witme` |
| **Panel admin** | `/admin` — protegido con `ADMIN_PASSWORD` |

**Principio clave:** Una sola base de datos PostgreSQL para **todos** los formularios y orígenes. Los productos se distinguen por `tipoCredito`; los campos dinámicos van en JSON (`datosFormulario`).

---

## 2. Qué es este proyecto

### Objetivo de negocio

- Landing pública con información de productos crediticios.
- Formulario multi-paso para solicitar crédito (actualmente **Microcrédito Small**).
- Recepción de leads desde **Witme** vía webhook.
- Panel admin para revisar, exportar, cambiar estado y eliminar solicitudes.

### Usuarios del sistema

| Actor | Interacción |
|-------|-------------|
| **Solicitante** | Completa formulario web o es redirigido desde Witme |
| **Equipo Coodelsur** | Accede a `/admin/leads` para gestionar solicitudes |
| **Witme (integrador)** | Envía `POST` al webhook con datos del lead |

---

## 3. Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Next.js API Routes (Node.js) |
| ORM | Prisma 5 |
| Base de datos | PostgreSQL (Supabase) |
| Storage | Supabase Storage |
| Validación | Zod + React Hook Form |
| Email | SMTP (Brevo) o Resend |
| Despliegue cPanel | `server.js` custom + `output: standalone` |

---

## 4. Arquitectura y composición del código

El proyecto usa **arquitectura hexagonal** (ports & adapters): el negocio está en el centro; Next.js, Prisma y Supabase son adaptadores.

### Estructura de carpetas

```
coodelsur-landing/
├── database/prisma/schema.prisma   # Schema PostgreSQL (Lead, CreditoParametros)
├── docs/                           # Documentación
├── public/                         # Assets estáticos (logo, imágenes)
├── scripts/                        # Utilidades (build cPanel, verify-backend)
├── server.js                       # Entry point para cPanel Node.js
├── next.config.js                  # output: "standalone"
├── package.json
└── src/
    ├── app/                        # Páginas Next.js + API Routes (adaptador HTTP)
    │   ├── api/                    # REST endpoints
    │   ├── admin/                  # Panel administración
    │   ├── solicitar/              # Formulario principal
    │   └── ...
    ├── domain/                     # Reglas de negocio puras
    │   ├── lead/                   # Adjuntos, progreso, duplicados
    │   ├── credito/                # Amortización
    │   └── identity/               # Validación cédula
    ├── application/                # Casos de uso (orquestación)
    │   ├── lead/                   # create-lead, save-draft, map-witme-payload
    │   ├── identity/               # verify-document
    │   └── credito/                # parametros-runtime
    ├── infrastructure/             # Adaptadores técnicos
    │   ├── database/               # Prisma client
    │   ├── storage/                # Supabase upload
    │   ├── email/                  # SMTP / Resend
    │   ├── geo/                    # Geolocalización IP
    │   └── auth/                   # Sesión admin
    ├── presentation/               # Componentes React, formularios, hooks
    └── shared/                     # Config, validación Zod, tipos, datos Colombia
```

### Capas y responsabilidad

| Capa | Ubicación | Qué hace |
|------|-----------|----------|
| **Adaptador HTTP** | `src/app/` | Recibe requests, delega a application |
| **Presentación** | `src/presentation/` | UI React, formularios multi-paso |
| **Application** | `src/application/` | Orquesta: guardar lead, mapear Witme, verificar cédula |
| **Domain** | `src/domain/` | Reglas puras sin I/O |
| **Infrastructure** | `src/infrastructure/` | Prisma, Supabase, email, auth |
| **Persistencia** | `database/prisma/` | Schema y migraciones |

### Páginas públicas principales

| Ruta | Descripción |
|------|-------------|
| `/` | Landing: hero, productos, contacto |
| `/solicitar` | Selector de monto + formulario |
| `/credito/[slug]` | Entrada directa por producto |
| `/solicitud-enviada` | Confirmación post-envío |

### Formulario actual

- **Producto:** Microcrédito Small (`tipoCredito: microcredito_small`)
- **Componente:** `src/presentation/components/forms/microcredito-small/FormularioMicrocreditoSmall.tsx`
- **Pasos:** 8 secciones (identidad, crédito, domicilio, laboral, referencia, bancarios, adjuntos, términos)
- **Adjuntos:** cédula (×2), video, firma digital → Supabase Storage

---

## 5. Base de datos — estrategia única para todos los formularios

### Respuesta concreta

**Una sola base PostgreSQL para todos los formularios.** No se crea una base por producto.

| Concepto | Implementación |
|----------|----------------|
| **Producto / tipo de crédito** | Campo `tipoCredito` (ej. `microcredito_small`) |
| **Campos específicos del formulario** | JSON `datosFormulario` |
| **Estado del lead** | Enum `LeadEstado`: incompleto, recibido, revisado, contactado, descartado |
| **Origen** | Campo `origen`: `web`, `witme`, etc. |
| **Parámetros de amortización** | Tabla `CreditoParametros` por `tipoCredito` |

### Modelos Prisma

**Lead** — solicitud de crédito:
- Datos desnormalizados: `nombre`, `cedula`, `telefono`, `email`, `capitalSolicitado`
- Progreso borrador: `progresoFormulario`, `pasoActualFormulario`
- Payload completo: `datosFormulario` (JSON)
- Tracking: UTM, IP, geo, fechas
- Adjuntos: rutas en JSON (no binarios en BD)

**CreditoParametros** — tasas y plazos editables desde admin:
- `tipoCredito`, `tasaMensual`, `plazosPermitidos`, etc.

### Conexión Supabase

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | Transaction pooler, puerto **6543**, `?pgbouncer=true` |
| `DIRECT_URL` | Session pooler, puerto **5432** (migraciones Prisma) |

---

## 6. Flujos de captura de leads

### Flujo A — Formulario web (Coodelsur)

```
Usuario → /solicitar → Formulario 8 pasos
    → POST /api/leads/draft (borradores incompletos)
    → POST /api/leads (envío final)
    → PostgreSQL + Supabase Storage + email confirmación
    → Visible en /admin/leads (origen: web)
```

### Flujo B — Webhook Witme

```
Witme → POST /api/leads/witme (Bearer WITME_API_KEY)
    → map-witme-payload.ts (mapeo de campos)
    → create-lead.ts
    → PostgreSQL
    → Visible en /admin/leads (origen: witme)
```

### Flujo C — Redirección URL (alternativa Witme)

Witme puede redirigir al usuario a la landing con parámetros UTM. El usuario completa el formulario web (Flujo A). Documentado en `WITME-API-PARA-INTEGRADOR.md` sección 8.

---

## 7. Integración Witme

### Cómo funciona (resumen)

1. Coodelsur expone un **webhook REST** en producción.
2. Witme envía un `POST` JSON cuando el usuario completa una solicitud en su plataforma.
3. Coodelsur valida la **API Key** en el header `Authorization`.
4. Los datos se mapean al modelo interno `Lead`.
5. El lead aparece en **`/admin/leads`** con `origen = witme`.

### Endpoint producción

| Parámetro | Valor |
|-----------|--------|
| **URL** | `https://solicitar-credito.coodelsursas.com.co/api/leads/witme` |
| **Método** | `POST` |
| **Content-Type** | `application/json` |
| **Autenticación** | `Authorization: Bearer {WITME_API_KEY}` |

### Verificación sin auth

```http
GET https://solicitar-credito.coodelsursas.com.co/api/leads/witme
```

Devuelve URL del webhook, campos esperados y si `witmeConfigured: true`.

### API Key — cómo funciona

| Pregunta | Respuesta |
|----------|-----------|
| **¿De dónde sale?** | La genera Coodelsur (no Witme). Es un secreto compartido. |
| **¿Dónde se configura?** | Variable `WITME_API_KEY` en cPanel / `.env` |
| **¿Cómo la usa Witme?** | Header `Authorization: Bearer {clave}` en cada POST |
| **¿Cómo verificar?** | `GET /api/health` → `"witmeConfigured": true` |

**Clave de producción:** configurada en cPanel / GitHub Secrets — **no incluir en Git**.

### Campos mínimos que Witme debe enviar

```json
{
  "nombre": "María López García",
  "cedula": "1056523965",
  "telefono": "3001234567"
}
```

Alias aceptados: `documento` (cédula), `celular` (teléfono), `correo` (email).

### Respuesta exitosa

- **HTTP 201**
- Body: `{ "success": true, "id": "uuid-del-lead" }`

### Archivos de implementación

| Archivo | Función |
|---------|---------|
| `src/app/api/leads/witme/route.ts` | Endpoint webhook + auth |
| `src/application/lead/map-witme-payload.ts` | Mapeo Witme → Lead interno |
| `docs/WITME-API-PARA-INTEGRADOR.md` | Especificación formal v2.0 (WITME-API-001) |
| `docs/WITME-MENSAJE-ENTREGA.md` | Plantillas email/WhatsApp para entregar credenciales |

---

## 8. Variables de entorno (completas)

### Producción cPanel — bloque listo para copiar

```env
NODE_ENV=production

DATABASE_URL=postgresql://postgres.[PROYECTO]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[PROYECTO]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres

SUPABASE_URL=https://[PROYECTO].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[SUPABASE_SECRET_KEY]
SUPABASE_STORAGE_BUCKET=lead-attachments

ADMIN_PASSWORD=[CONTRASEÑA_ADMIN_FUERTE]
WITME_API_KEY=[CLAVE_WITME_MIN_32_CHARS]

NEXT_PUBLIC_SITE_URL=https://solicitar-credito.coodelsursas.com.co
NEXT_PUBLIC_DEMO_MODE=false

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=[SMTP_USER]
SMTP_PASS=[SMTP_PASS]
EMAIL_FROM=Coodelsur <coodelsurcartera@gmail.com>

DUPLICATE_CEDULA_DAYS=30
```

> **Valores reales:** solo en cPanel (Setup Node.js App) y GitHub Secrets — nunca en el repositorio.

> **Nota:** En `.env` local `NEXT_PUBLIC_SITE_URL` sigue en `localhost`; en producción debe ser el dominio HTTPS final.

### Tabla de referencia — todas las variables

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `NODE_ENV` | Sí (prod) | `production` en cPanel |
| `DATABASE_URL` | Sí | PostgreSQL pooler Supabase (puerto 6543) |
| `DIRECT_URL` | Sí | PostgreSQL directo (puerto 5432) |
| `SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Secret key para Storage |
| `SUPABASE_STORAGE_BUCKET` | Sí | Nombre del bucket (`lead-attachments`) |
| `ADMIN_PASSWORD` | Sí | Contraseña panel `/admin` |
| `WITME_API_KEY` | Sí (si Witme) | Bearer token webhook Witme |
| `NEXT_PUBLIC_SITE_URL` | Sí | URL pública HTTPS del sitio |
| `NEXT_PUBLIC_DEMO_MODE` | Sí | `false` en producción |
| `SMTP_HOST` | Recomendada | Servidor SMTP (Brevo) |
| `SMTP_PORT` | Recomendada | `587` |
| `SMTP_USER` | Recomendada | Usuario SMTP |
| `SMTP_PASS` | Recomendada | Contraseña SMTP |
| `SMTP_SECURE` | Opcional | `false` para puerto 587 |
| `EMAIL_FROM` | Recomendada | Remitente correos al cliente |
| `DUPLICATE_CEDULA_DAYS` | Opcional | Ventana anti-duplicados (default 30) |
| `VERIFIK_API_KEY` | Opcional | Validación cédula en tiempo real |
| `RESEND_API_KEY` | Opcional | Alternativa a SMTP |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Opcional | Google Analytics |
| `IPAPI_KEY` | Opcional | Geolocalización por IP |
| `LEAD_STORE` | **No en prod** | Solo dev: `file` guarda JSON local |
| `PORT` | Auto | cPanel lo asigna; no configurar manualmente |

### Variables que NO deben usarse en producción

```
NEXT_PUBLIC_DEMO_MODE=true    → formulario no guarda en BD real
LEAD_STORE=file               → guarda en JSON local, no PostgreSQL
```

### Dónde configurarlas en cPanel

1. **Setup Node.js App** → Edit → Environment variables (recomendado)
2. O archivo `/home/creditocoodelsur/coodelsur-landing/.env`

---

## 9. Panel de administración

| Aspecto | Detalle |
|---------|---------|
| **URL login** | `/admin` |
| **Credencial** | `ADMIN_PASSWORD` |
| **Sesión** | Cookie `coodelsur_admin` (12 horas) |
| **Listado** | `/admin/leads` — búsqueda, filtros, export Excel |
| **Detalle** | `/admin/leads/[id]` — datos, adjuntos, cambio estado |
| **Parámetros** | `/admin/parametros` — tasas y plazos por producto |

### Estados de un lead

| Estado | Significado |
|--------|-------------|
| `incompleto` | Borrador abandonado (visible en admin) |
| `recibido` | Solicitud enviada |
| `revisado` | Revisión interna completada |
| `contactado` | Equipo comercial contactó al solicitante |
| `descartado` | Solicitud descartada |

---

## 10. API REST — endpoints principales

Base URL producción: `https://solicitar-credito.coodelsursas.com.co`

### Públicos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Diagnóstico: DB, storage, witme, admin, email |
| POST | `/api/leads` | Envío formulario completo |
| POST | `/api/leads/draft` | Borrador incompleto |
| POST | `/api/leads/witme` | Webhook Witme (Bearer auth) |
| GET | `/api/leads/witme` | Info del webhook (sin auth) |
| POST | `/api/verify-cedula` | Validación documento |
| GET | `/api/creditos/parametros` | Parámetros públicos de producto |

### Admin (requieren sesión)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/admin/login` | Login con password |
| GET | `/api/admin/leads` | Listado paginado |
| GET/PATCH/DELETE | `/api/admin/leads/[id]` | Detalle, estado, borrado |
| GET | `/api/admin/leads/export` | Export Excel |
| GET | `/api/admin/leads/[id]/attachments/[field]` | Descarga adjuntos |

### Respuesta esperada de `/api/health` en producción

```json
{
  "ok": true,
  "demoMode": false,
  "database": true,
  "storageConfigured": true,
  "witmeConfigured": true,
  "adminConfigured": true,
  "emailConfigured": true,
  "emailTransport": "smtp"
}
```

---

## 11. Despliegue en cPanel (estado actual)

### Configuración Node.js App

| Campo | Valor |
|-------|--------|
| Application root | `coodelsur-landing` |
| Application URL | `solicitar-credito.coodelsursas.com.co` |
| Application startup file | `server.js` |
| Mode | **Production** |

### Archivos requeridos en el servidor

```
/home/creditocoodelsur/coodelsur-landing/
├── server.js
├── package.json          ← prisma en dependencies, start: "node server.js"
├── .next/                ← build de producción
├── public/
├── database/prisma/schema.prisma
└── node_modules/         ← symlink CloudLinux (no subir desde Windows)
```

### Problemas conocidos y soluciones

| Problema | Causa | Solución |
|----------|-------|----------|
| WordPress "Hello world!" | `public_html` con WordPress | Mover WP fuera de `public_html` |
| Error CloudLinux node_modules | ZIP trae `node_modules` de Windows | Borrar carpeta, Run NPM Install |
| Error Prisma en npm install | `prisma` en devDependencies o falta schema | Mover `prisma` a dependencies; subir `database/` |
| `npm install` → `Killed` | Sin RAM en hosting compartido | Instalar paquetes en partes o build en PC |
| HTTP 503 | App no arranca / sin dependencias | npm install + RESTART |

### Build local (recomendado)

```powershell
cd C:\Users\Delco\Documents\GitHub\Landing-Coodelsur\coodelsur-landing
powershell -ExecutionPolicy Bypass -File scripts\package-cpanel.ps1
```

Genera `cpanel-deploy.zip` en el proyecto. Subir a cPanel **sin** `node_modules`, luego instalar dependencias en el servidor.

### Git (alternativa)

Archivo `.cpanel.yml` en la raíz del repo para deploy automático vía Git Version Control de cPanel.

---

## 12. Requisitos de hardware

### Servidor cPanel (app Node.js)

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| Node.js | 18.x | 20.x LTS |
| RAM libre | 512 MB | 1 GB+ |
| Disco libre | 300 MB | 1 GB+ |
| HTTPS/SSL | Obligatorio | Obligatorio |

### Servicios externos (no en cPanel)

| Servicio | Proveedor |
|----------|-----------|
| PostgreSQL | Supabase |
| Archivos adjuntos | Supabase Storage |
| Email | Brevo SMTP |

---

## 13. Documentación relacionada

| Documento | Contenido |
|-----------|-----------|
| `docs/WITME-API-PARA-INTEGRADOR.md` | Especificación formal API Witme v2.0 |
| `docs/WITME-MENSAJE-ENTREGA.md` | Plantillas entrega credenciales Witme |
| `docs/WITME.md` | Guía interna integración Witme |
| `docs/BACKEND_SETUP.md` | Configuración Supabase y Prisma |
| `docs/DESPLIEGUE.md` | Checklist despliegue producción |
| `docs/ADMIN.md` | Panel administración |
| `docs/API.md` | Referencia API REST |
| `docs/CODEBASE.md` | Mapa del código fuente |
| `docs/HEXAGONAL.md` | Arquitectura hexagonal |
| `docs/GUIA-NUEVO-FORMULARIO.md` | Cómo agregar nuevos productos/formularios |
| `docs/ENV-EQUIPO.md` | Variables para equipo de desarrollo |

---

## 14. Checklist de verificación

### Antes de go-live

- [ ] WordPress movido fuera de `public_html`
- [ ] App Node.js **started** en cPanel
- [ ] Variables de entorno configuradas (producción)
- [ ] `NEXT_PUBLIC_SITE_URL` = dominio HTTPS final
- [ ] `NEXT_PUBLIC_DEMO_MODE=false`
- [ ] `npm install` completado (o dependencias mínimas instaladas)
- [ ] `GET /api/health` → `database: true`, `witmeConfigured: true`
- [ ] Prueba formulario web real
- [ ] Prueba webhook Witme (`POST` con Bearer token)
- [ ] Lead visible en `/admin/leads`
- [ ] Documentación WITME-API-001 entregada a Witme
- [ ] API Key enviada a Witme por canal privado

### Comandos útiles en Terminal cPanel

```bash
source /home/creditocoodelsur/nodevenv/coodelsur-landing/18/bin/activate
cd /home/creditocoodelsur/coodelsur-landing
node -v
npm install --ignore-scripts --no-audit --no-fund
npx prisma generate
```

Luego **RESTART** en Setup Node.js App.

---

*Fin del documento — Coodelsur SAS — Confidencial*
