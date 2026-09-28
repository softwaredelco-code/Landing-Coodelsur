# Handoff completo para IA — Coodelsur Landing

> **Propósito:** Este documento concentra **todo el contexto** de las sesiones de trabajo (sep 2026) para que otro modelo de IA pueda continuar sin perderse.  
> **Complementa:** `docs/CONTEXTO-PROYECTO-COMPLETO.md` (arquitectura y variables base).  
> **Última actualización:** 16 de septiembre de 2026  
> **Transcript Cursor:** `agent-transcripts/e54628a7-e3bc-4a44-91ad-6861bce935e5.jsonl`

---

## Tabla de contenido

1. [Resumen en 30 segundos](#1-resumen-en-30-segundos)
2. [Repositorio y entorno](#2-repositorio-y-entorno)
3. [Cronología del trabajo (chat)](#3-cronología-del-trabajo-chat)
4. [Despliegue actual (GitHub Actions → FTP → cPanel)](#4-despliegue-actual-github-actions--ftp--cpanel)
5. [Configuración del servidor cPanel](#5-configuración-del-servidor-cpanel)
6. [Problemas encontrados y soluciones aplicadas](#6-problemas-encontrados-y-soluciones-aplicadas)
7. [Estado actual y bloqueador crítico](#7-estado-actual-y-bloqueador-crítico)
8. [Código modificado — referencia por archivo](#8-código-modificado--referencia-por-archivo)
9. [Commits importantes en main](#9-commits-importantes-en-main)
10. [Variables de entorno (producción)](#10-variables-de-entorno-producción)
11. [Flujos funcionales](#11-flujos-funcionales)
12. [Comandos de diagnóstico y redeploy](#12-comandos-de-diagnóstico-y-redeploy)
13. [Trabajo pendiente / recomendaciones](#13-trabajo-pendiente--recomendaciones)
14. [Instrucciones para la próxima IA](#14-instrucciones-para-la-próxima-ia)
15. [Documentación relacionada](#15-documentación-relacionada)

---

## 1. Resumen en 30 segundos

| Aspecto | Valor |
|---------|--------|
| **Proyecto** | Landing + formulario de solicitud de crédito Coodelsur |
| **Repo GitHub** | `softwaredelco-code/Landing-Coodelsur` |
| **Código app** | Carpeta `coodelsur-landing/` dentro del monorepo |
| **Producción** | https://solicitar-credito.coodelsursas.com.co |
| **Hosting** | cPanel Conexcol, usuario `creditocoodelsur` |
| **BD** | PostgreSQL Supabase (Prisma 5) |
| **Deploy** | Push a `main` → GitHub Actions → FTP sube `cpanel-deploy.tar.gz` → extracción manual en Terminal cPanel |
| **Admin** | `/admin` (password en `ADMIN_PASSWORD` en cPanel) |
| **Estado sep-16** | App llegó a funcionar (landing, admin, móvil). Luego **cuenta bloqueada por límites CloudLinux** (`cagefs_enter: Unable to fork`). Requiere soporte Conexcol. |

---

## 2. Repositorio y entorno

### Estructura del monorepo

```
Landing-Coodelsur/                    ← raíz git
├── .github/workflows/deploy-cpanel.yml
└── coodelsur-landing/                ← aplicación Next.js (working-directory del CI)
    ├── database/prisma/schema.prisma
    ├── scripts/package-cpanel.sh
    ├── scripts/cpanel-post-deploy.sh
    ├── server.js                     ← NO usar en prod (legacy); prod usa server.js del standalone
    ├── src/
    └── docs/
```

### Ramas Git relevantes

| Rama | Estado |
|------|--------|
| **`main`** | Rama de producción. Deploy automático al push. Contiene todos los fixes de sep 2026. |
| **`PaulaPachonDev`** | Rama de desarrollo de Paula. Se fusionó a `main` (fast-forward, sin conflictos). |

### Deploy solo desde `main`

El workflow `.github/workflows/deploy-cpanel.yml` dispara **solo** en push a `main` o `workflow_dispatch`.

### Cambios locales NO commiteados (sep-16)

En el PC de Paula hay modificaciones locales sin subir (WITME, drafts, docs, etc.). **No están en producción.** Solo lo mergeado a `main` está desplegado.

---

## 3. Cronología del trabajo (chat)

### Fase 1 — Despliegue inicial (10 sep)

1. **Problema:** El dominio mostraba WordPress ("Hello world!") en lugar de la landing Next.js.
2. **Causa:** Subdominio apuntaba a `public_html` con WordPress; app Node en `coodelsur-landing` vacía o incompleta.
3. **Acciones:**
   - Se creó `server.js` custom en raíz (luego **descartado en prod** — ver fase 4).
   - Guía manual: subir ZIP, `npm install`, `npm run build` en cPanel.
   - **Problema RAM:** `npm install` / `npm run build` → `Killed` en shared hosting.
   - **Decisión:** Build en CI (GitHub Actions), no en servidor.

### Fase 2 — CI/CD GitHub Actions (10-11 sep)

1. Workflow inicial con **SSH/SCP** → falló (hosting bloquea SSH externo).
2. Cambio a **FTP** con usuario dedicado.
3. Primeros intentos subiendo miles de archivos/`node_modules` → **timeout FTP (~22 min)**.
4. **Solución:** Un solo archivo `cpanel-deploy.tar.gz` vía FTP.

### Fase 3 — Empaquetado standalone (11-14 sep)

Problemas resueltos en cadena:

| # | Error | Solución |
|---|-------|----------|
| 1 | Archivos en carpeta FTP equivocada | FTP sube a `~/solicitar-credito.coodelsursas.com.co/despliegue/`; copiar/extraer a `~/coodelsur-landing/` |
| 2 | `503 Cannot find module './bundle5'` | **No sobrescribir** `server.js` standalone con el custom de raíz (`package-cpanel.sh` corregido) |
| 3 | `npm install` Killed en servidor | Incluir `node_modules` del build standalone en el tar.gz; **no** `npm install` en servidor |
| 4 | Post-deploy `nodeenv` vs `nodevenv` | Script usa PATH a `~/nodevenv/coodelsur-landing/18/bin` |

### Fase 4 — Producción funcionando + bugs post-deploy (15 sep)

La landing quedó desplegada. Aparecieron 3 problemas:

#### 4.1 Admin: "No se pudieron cargar solicitudes" + parámetros no cargan

- **Diagnóstico:** `GET /api/health` → `"database": false`
- **Error Prisma:** Engine generado para `debian-openssl-3.0.x` (GitHub Actions Ubuntu) pero cPanel necesita `debian-openssl-1.1.x`
- **Fix:** En `database/prisma/schema.prisma`:
  ```prisma
  generator client {
    provider      = "prisma-client-js"
    binaryTargets = ["native", "debian-openssl-1.1.x"]
  }
  ```
- **Commit:** `5c32914` — merge `PaulaPachonDev` → `main`

#### 4.2 Cámara negra en iPhone

- **Síntoma:** Permiso concedido (punto verde iOS), preview negro, botones visibles.
- **Causa:** Stream asignado antes de montar `<video>`; `video.play()` sin await en Safari.
- **Fix:** `CameraCapture.tsx` y `VideoRecorder.tsx` — `useEffect` para adjuntar stream, `playsinline`/`webkit-playsinline`, retry con `requestAnimationFrame`.
- **Commits:** `5c32914`, mejoras en `448cede`, `9abcda4`

#### 4.3 Cámara en PC — diálogo Chrome colgado

- **Síntoma:** Popup permisos con spinner infinito.
- **Causa:** `facingMode: "environment"` en desktop (no hay cámara trasera); timeout 15s cortaba antes de pulsar Permitir.
- **Fix:** `getVideoStream()` en `file-capture.ts` — en PC usa `video: true` primero, sin timeout en permisos desktop; mensajes de error claros.
- **Commits:** `9abcda4`, `448cede`

#### 4.4 ConfirmacionSolicitud.tsx

- Errores TS en IDE por `node_modules` faltantes localmente (no bug real).
- Fix semántico HTML: `dt`/`dd` hijos directos de `dl` con CSS Grid.
- **Nota:** Cambio en rama local; verificar si está en `main`.

### Fase 5 — Error al enviar solicitud (15 sep)

#### 5.1 Prisma PANIC: `timer has gone away`

- **Al enviar formulario:** Error en `prisma.creditoParametros.count()` invocado desde `warmParametrosCache()` en cada `POST /api/leads`.
- **Causa:** Límite procesos/hilos CloudLinux + consulta innecesaria en cada envío.
- **Fixes (`a33caf2`):**
  - Quitar `warmParametrosCache()` de `POST /api/leads` (no se usaba el resultado).
  - Singleton Prisma en producción (`globalForPrisma.prisma = prisma` siempre).
  - `warmParametrosCache()` con fallback a defaults del código si BD falla.
  - Reemplazar `count()` por `findFirst()` en seed de parámetros.

#### 5.2 Formulario colgado en "Enviando…"

- **Causa:** Subida Supabase sin timeout; consultas Prisma lentas; payload grande (base64 fotos/video).
- **Fixes (`d6e5046`):**
  - Timeout 15s por upload Supabase → fallback preview inline en BD.
  - Variable `LEAD_ATTACHMENTS_INLINE=true` recomendada en cPanel (salta Supabase en envío).
  - Timeouts: procesamiento archivos 45s, guardado BD 20s, duplicados 8s, cliente 90s.

### Fase 6 — Bloqueo total del hosting (15-16 sep)

- **Síntoma Terminal:** `cagefs_enter: Unable to fork` + "User has reached resource limits (PMEM, number of processes)".
- **Síntoma cPanel Node.js App:** Error rojo "The received data is wrong... cagefs_enter: U..."
- **Causa:** Plan shared agotó procesos/RAM (Node + Prisma + uploads + deploys acumulados).
- **Estado:** **No resoluble desde código.** Requiere ticket Conexcol (LVE faults, aumentar PMEM/NPROC) o migrar a VPS/Vercel.
- **Acción usuario:** Ticket a soporte Conexcol con texto del chat (sección 7).

---

## 4. Despliegue actual (GitHub Actions → FTP → cPanel)

### Pipeline (`.github/workflows/deploy-cpanel.yml`)

```
Push main
  → npm ci
  → npx prisma generate
  → npx next build (standalone)
  → bash scripts/package-cpanel.sh
  → tar -czf cpanel-release/cpanel-deploy.tar.gz
  → FTP upload (solo el .tar.gz)
  → [MANUAL en cPanel] extraer + cpanel-post-deploy.sh + RESTART
```

### GitHub Secrets configurados (7)

| Secret | Valor / notas |
|--------|----------------|
| `FTP_SERVER` | `cpanel2-co.conexcol.net` |
| `FTP_USERNAME` | `github-deploy@solicitar-credito.coodelsursas.com.co` |
| `FTP_PASSWORD` | (configurado en GitHub, no en repo) |
| `NEXT_PUBLIC_SITE_URL` | `https://solicitar-credito.coodelsursas.com.co` |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `DATABASE_URL` | Supabase pooler `:6543?pgbouncer=true` |
| `DIRECT_URL` | Supabase session `:5432` |

> **Nota:** `docs/DEPLOY-GITHUB-ACTIONS.md` describe SSH (obsoleto). El flujo real es **FTP + tar.gz**.

### Qué incluye `package-cpanel.sh`

- Copia `.next/standalone` completo (incluye `node_modules` de producción).
- Copia `.next/static`, `public/`, `database/`.
- **NO** copia `server.js` custom de raíz — usa el generado por Next (`startServer`).
- Empaqueta `.prisma-bundle` (cliente Prisma Linux + OpenSSL 1.1.x).
- Genera `package.json` mínimo con `"start": "node server.js"`.

### Post-deploy manual (OBLIGATORIO tras cada deploy)

```bash
cd ~/coodelsur-landing
rm -rf ./* ./.[!.]* 2>/dev/null
tar -xzf ~/solicitar-credito.coodelsursas.com.co/despliegue/cpanel-deploy.tar.gz
bash cpanel-post-deploy.sh ~/coodelsur-landing 18
```

Luego: **Setup Node.js App → RESTART**

El script `cpanel-post-deploy.sh`:
- Busca el tar en varias rutas candidatas.
- Elimina symlink `node_modules` de CloudLinux si existe.
- Restaura `.prisma-bundle` → `node_modules/.prisma` y `@prisma`.
- **NO** ejecuta `npm install`.

---

## 5. Configuración del servidor cPanel

| Campo | Valor |
|-------|--------|
| Usuario cPanel | `creditocoodelsur` |
| Application root | `coodelsur-landing` → `/home/creditocoodelsur/coodelsur-landing` |
| Application URL | `solicitar-credito.coodelsursas.com.co` |
| Startup file | `server.js` (el del **standalone**, no el de raíz del repo) |
| Node version | 18 |
| Mode | Production |

### Rutas importantes en servidor

| Ruta | Contenido |
|------|-----------|
| `/home/creditocoodelsur/coodelsur-landing/` | App en ejecución |
| `/home/creditocoodelsur/solicitar-credito.coodelsursas.com.co/despliegue/` | Donde FTP deja el `.tar.gz` |
| `/home/creditocoodelsur/nodevenv/coodelsur-landing/18/bin/` | Node del virtualenv CloudLinux |
| `/home/creditocoodelsur/public_html/` | WordPress movido/fuera del flujo Node |

### Verificación health

```bash
curl -s https://solicitar-credito.coodelsursas.com.co/api/health
```

Esperado cuando todo OK:

```json
{
  "ok": true,
  "database": true,
  "storageConfigured": true,
  "witmeConfigured": true,
  "adminConfigured": true
}
```

---

## 6. Problemas encontrados y soluciones aplicadas

### Tabla maestra

| Problema | Síntoma | Causa raíz | Fix | Commit |
|----------|---------|------------|-----|--------|
| WordPress en dominio | "Hello world!" | WP en public_html | Mover WP; app Node en coodelsur-landing | (manual) |
| SSH deploy falla | Connection refused | Hosting bloquea SSH | Cambio a FTP | `9acdd9d` |
| FTP timeout | 22 min, falla | Subir node_modules entero | Un solo tar.gz | `a18cbb3` |
| bundle5 503 | Cannot find module | server.js custom wrong | Usar standalone server.js | `245f22c` |
| npm Killed | OOM en servidor | RAM insuficiente | node_modules en tar, sin npm install | `8b50b8c` |
| Admin sin datos | database: false | Prisma OpenSSL mismatch | binaryTargets 1.1.x | `5c32914` |
| Cámara iOS negra | Preview negro | video.play timing | useEffect + playsInline | `5c32914` |
| Cámara PC colgada | Spinner permisos | facingMode environment | getVideoStream desktop fallback | `9abcda4`, `448cede` |
| PANIC timer | Error al enviar | warmParametrosCache + LVE | Quitar warmup en POST /api/leads | `a33caf2` |
| Enviando infinito | Spinner cliente | Supabase sin timeout | Timeouts + inline fallback | `d6e5046` |
| Unable to fork | Terminal/Node roto | LVE CloudLinux | **Soporte hosting** | pendiente |

---

## 7. Estado actual y bloqueador crítico

### Lo que funcionaba antes del bloqueo (según usuario, 15 sep)

- ✅ Landing pública desplegada
- ✅ Login admin
- ✅ Cámara en móvil
- ⚠️ Cámara en PC (fixes desplegados, pendiente re-verificar)
- ⚠️ Envío solicitud (fixes desplegados, pendiente re-verificar)

### Bloqueador actual (16 sep)

**CloudLinux CageFS — límite de recursos agotado.**

Errores:
```
cagefs_enter: Unable to fork
User's process failed... PMEM, number of processes, or overall package limits
```

Impacto:
- Terminal cPanel no abre comandos
- Setup Node.js App no carga (spinner + error rojo)
- App probablemente caída o inestable
- Imposible hacer RESTART o redeploy manual

### Texto para ticket Conexcol

```
Asunto: Error cagefs_enter Unable to fork - cuenta creditocoodelsur

Mi cuenta creditocoodelsur no puede ejecutar procesos. Aparece:

- Terminal: "cagefs_enter: Unable to fork"
- "User has reached resource limits (PMEM, number of processes)"
- Setup Node.js App: "The received data is wrong... cagefs_enter: U..."

Dominio: solicitar-credito.coodelsursas.com.co
App Node: coodelsur-landing (Node 18)

Necesito que:
1. Revisen los LVE faults de mi usuario
2. Maten procesos zombie si los hay
3. Aumenten PMEM y NPROC (límite de procesos)
4. Confirmen si mi plan shared soporta Node.js + PostgreSQL (Prisma)

Gracias.
```

### Después de que soporte libere recursos

1. Setup Node.js App → RESTART
2. Agregar env var: `LEAD_ATTACHMENTS_INLINE=true`
3. Si hubo deploy nuevo en GitHub Actions, ejecutar post-deploy en Terminal
4. Verificar `/api/health` y probar formulario + admin

---

## 8. Código modificado — referencia por archivo

### Infraestructura / deploy

| Archivo | Cambio |
|---------|--------|
| `.github/workflows/deploy-cpanel.yml` | CI build + FTP tar.gz |
| `scripts/package-cpanel.sh` | Standalone + prisma bundle, NO server.js custom |
| `scripts/cpanel-post-deploy.sh` | Extrae tar, restaura Prisma, sin npm install |
| `database/prisma/schema.prisma` | `binaryTargets = ["native", "debian-openssl-1.1.x"]` |
| `src/infrastructure/database/prisma.ts` | Singleton global en prod y dev |

### Formulario / cámara

| Archivo | Cambio |
|---------|--------|
| `src/infrastructure/media/file-capture.ts` | `getVideoStream()`, `getCameraErrorMessage()`, fallbacks desktop/móvil |
| `src/presentation/components/forms/CameraCapture.tsx` | useEffect stream, sin auto-abrir file picker en error |
| `src/presentation/components/forms/VideoRecorder.tsx` | Igual que CameraCapture |
| `src/presentation/components/forms/ConfirmacionSolicitud.tsx` | Grid semántico dl/dt/dd |

### Leads / envío / storage

| Archivo | Cambio |
|---------|--------|
| `src/app/api/leads/route.ts` | **Eliminado** `warmParametrosCache()` del POST |
| `src/infrastructure/database/parametros-store.ts` | Fallback defaults, findFirst vs count, try/catch |
| `src/infrastructure/storage/upload.ts` | Timeout 15s upload, `LEAD_ATTACHMENTS_INLINE` |
| `src/application/lead/create-lead.ts` | Timeouts processFileFields y prisma create/update |
| `src/domain/lead/duplicate-cedula.ts` | Timeout 8s en findFirst |
| `src/infrastructure/persistence/file-store.ts` | `isDbConnectionError` incluye Prisma panic |
| `src/presentation/.../FormularioMicrocreditoSmall.tsx` | Fetch timeout 90s, mensajes error |
| `src/shared/utils.ts` | Helper `withTimeout()` |

### Archivo NO usar en producción

| Archivo | Notas |
|---------|-------|
| `coodelsur-landing/server.js` (raíz repo) | Custom createServer — **obsoleto**. Prod usa standalone. |

---

## 9. Commits importantes en main

```
d6e5046 Prevent lead submit hang with upload and DB timeouts
a33caf2 Fix Prisma panic on lead submit by removing unnecessary DB warmup
448cede Improve desktop camera: simple constraints first and no permission timeout
9abcda4 Fix desktop camera hang by falling back from environment facing mode
5c32914 Fix Prisma engine for cPanel OpenSSL 1.1 and iOS camera preview
245f22c Use Next.js standalone server.js on cPanel to fix webpack bundle5 error
a18cbb3 Deploy single tar.gz via FTP to avoid node_modules upload timeout
8b50b8c Include standalone node_modules in FTP deploy and skip server npm install
2230ba0 Fix post-deploy: use nodevenv PATH instead of sourcing activate
9acdd9d Switch cPanel deploy from SSH to FTP
71bcc80 Add GitHub Actions workflow for cPanel deployment
```

---

## 10. Variables de entorno (producción)

### Obligatorias en cPanel (Setup Node.js App)

Ver plantilla completa en `docs/CONTEXTO-PROYECTO-COMPLETO.md` sección 8.

### Variable nueva recomendada (sep-15)

```env
LEAD_ATTACHMENTS_INLINE=true
```

**Efecto:** Los adjuntos (cédula, video, firma) se guardan como preview en PostgreSQL sin subir a Supabase en cada envío. Reduce RAM, procesos y tiempo de respuesta en shared hosting.

### Credenciales sensibles

- **`ADMIN_PASSWORD`:** Configurada en sesión de deploy en cPanel (no está en el repo). Preguntar al usuario o revisar Setup Node.js App.
- **Supabase, SMTP, WITME_API_KEY:** Solo en cPanel env vars.
- **GitHub Secrets:** Solo las 7 listadas en sección 4 (build + FTP).

### Variables que NO deben estar en producción

```env
NEXT_PUBLIC_DEMO_MODE=true
LEAD_STORE=file
```

---

## 11. Flujos funcionales

### Envío formulario (`POST /api/leads`)

```
Cliente FormularioMicrocreditoSmall
  → JSON con datos + FileCapture (base64 preview)
  → Validación Zod
  → verifyDocumentComplete (local + duplicados BD + opcional Verifik 4s)
  → createLead:
      → processFileFields (upload Supabase o inline)
      → prisma.lead.create / update (promover borrador incompleto)
  → email confirmación (async, no bloquea)
  → 201 { success, id }
```

**Importante:** Ya NO se llama `warmParametrosCache()` en este endpoint.

### Admin leads

```
GET /api/admin/leads → prisma.lead.findMany + count
GET /api/admin/creditos/parametros → warmParametrosCache (con fallback)
```

### Borradores

```
POST /api/leads/draft → save-draft-lead (sin adjuntos pesados, stripHeavyFieldsForDraft)
Hook: useNanocreditoServerDraft (debounce 2s)
```

### Cámara

- Componentes: `CameraCapture.tsx`, `VideoRecorder.tsx`
- Helper: `getVideoStream()` en `file-capture.ts`
- Desktop: `video: true` primero
- Móvil: `facingMode: environment` para cédula, `user` para video rostro

---

## 12. Comandos de diagnóstico y redeploy

### Health check

```bash
curl -s https://solicitar-credito.coodelsursas.com.co/api/health | jq .
```

### Logs servidor (cuando Terminal funcione)

```bash
tail -80 ~/coodelsur-landing/stderr.log
head -5 ~/coodelsur-landing/server.js   # debe contener "startServer"
```

### Verificar Prisma engine en servidor

```bash
ls ~/coodelsur-landing/node_modules/.prisma/client/libquery_engine*
# Debe existir libquery_engine-debian-openssl-1.1.x.so.node
```

### Límites CloudLinux (diagnóstico fork)

```bash
ulimit -u
# Si < ~50, plan insuficiente para Node+Prisma
```

### Redeploy completo (cuando hosting responda)

1. Push a `main` o Run workflow en GitHub Actions
2. Esperar FTP verde
3. Terminal cPanel (comandos sección 4)
4. RESTART Node.js App
5. Verificar health + formulario + admin

---

## 13. Trabajo pendiente / recomendaciones

### Urgente (hosting)

- [ ] Ticket Conexcol — LVE faults, PMEM/NPROC
- [ ] RESTART app cuando cPanel responda
- [ ] Agregar `LEAD_ATTACHMENTS_INLINE=true`

### Verificación post-recuperación

- [ ] `/api/health` → database true
- [ ] Admin solicitudes + parámetros
- [ ] Envío formulario completo (PC y móvil)
- [ ] Cámara PC y móvil

### Mejoras recomendadas (mediano plazo)

| Tema | Recomendación |
|------|----------------|
| Hosting | Migrar a **VPS** o **Vercel + Supabase** — shared hosting es frágil con Prisma |
| Prisma | Evaluar Prisma 6+ engine WASM (`engineType = "client"`) cuando se actualice stack |
| Deploy doc | Actualizar `DEPLOY-GITHUB-ACTIONS.md` (SSH → FTP) |
| FTP path | Opcional: cambiar `server-dir` FTP para que tar llegue directo a `coodelsur-landing` |
| Payload size | Subir adjuntos en requests separados antes del submit final (reduce timeouts) |
| Rama PaulaPachonDev | Sincronizar cambios locales sin commitear si se necesitan |

### Cambios locales sin merge (revisar con Paula)

Archivos modificados localmente pero no en `main` (sep-16):
- WITME docs/routes
- nanocredito draft hooks
- ConfirmacionSolicitud (verificar si ya en main)
- package.json / package-lock (prisma en dependencies)

---

## 14. Instrucciones para la próxima IA

### Antes de tocar código

1. Leer este documento + `docs/CONTEXTO-PROYECTO-COMPLETO.md`.
2. Preguntar si el bloqueo CloudLinux ya fue resuelto por soporte.
3. Verificar `curl /api/health` en producción.
4. Confirmar rama de trabajo (`main` para prod).

### Reglas de deploy

- **Nunca** volver a poner `server.js` custom en el paquete cPanel.
- **Nunca** `npm install` / `npm run build` en servidor shared (Killed / fork).
- **Siempre** post-deploy manual + RESTART tras FTP.
- Deploy = push a **`main`**.

### Si reportan error Prisma

1. `/api/health` → `databaseError`
2. Verificar `binaryTargets` incluye `debian-openssl-1.1.x`
3. Verificar `.prisma-bundle` restaurado en post-deploy
4. Si `timer has gone away` → **LVE/hosting**, no solo código

### Si reportan cámara

- Móvil: `CameraCapture.tsx`, playsInline, useEffect
- PC: `getVideoStream()` — no usar `environment` en desktop
- Permisos bloqueados: candado URL → Cámara → Permitir

### Si reportan envío colgado

1. ¿`LEAD_ATTACHMENTS_INLINE=true`?
2. Timeouts en `upload.ts` y `create-lead.ts`
3. Tamaño payload (base64 en JSON)
4. LVE / recursos servidor

### Usuario (Paula)

- Trabaja en rama `PaulaPachonDev`, merge a `main` para prod.
- Hosting: Conexcol cPanel, usuario `creditocoodelsur`.
- Prefiere instrucciones paso a paso en español.
- No commitear sin pedirlo (regla usuario); deploy requiere merge a main.

---

## 15. Documentación relacionada

| Documento | Uso |
|-----------|-----|
| `docs/CONTEXTO-PROYECTO-COMPLETO.md` | Arquitectura, variables, Witme, checklist base |
| `docs/HANDOFF-CONTEXTO-IA-COMPLETO.md` | **Este archivo** — historial chat + fixes + estado |
| `docs/ADMIN.md` | Panel administración |
| `docs/BACKEND_SETUP.md` | Supabase + Prisma setup |
| `docs/DESPLIEGUE.md` | Checklist despliegue (parcialmente pre-CI) |
| `docs/DEPLOY-GITHUB-ACTIONS.md` | ⚠️ Parcialmente obsoleto (SSH); ver sección 4 aquí |
| `docs/WITME-API-PARA-INTEGRADOR.md` | API Witme v2 |
| `docs/GUIA-NUEVO-FORMULARIO.md` | Agregar productos |

---

*Documento generado para continuidad de trabajo con IA — Coodelsur SAS — Confidencial*
