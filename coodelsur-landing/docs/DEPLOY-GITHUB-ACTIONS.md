# Despliegue con GitHub Actions → cPanel

Este flujo **compila en GitHub** (Linux, con RAM suficiente) y sube el build al servidor por **SSH**. Evita `npm run build` y `npm install` pesados en cPanel.

---

## Cómo funciona

```
Push a main  →  GitHub Actions
                  ├── npm ci
                  ├── npm run build (Prisma + Next standalone)
                  ├── Empaqueta cpanel-deploy/
                  ├── SCP al servidor
                  └── SSH: npm install mínimo + restart app
```

Archivos del workflow:

| Archivo | Función |
|---------|---------|
| `.github/workflows/deploy-cpanel.yml` | Pipeline CI/CD |
| `scripts/package-cpanel.sh` | Empaqueta build Linux |
| `scripts/cpanel-post-deploy.sh` | Instala deps mínimas y reinicia en cPanel |

---

## Requisitos previos (una sola vez)

### 1. SSH activo en cPanel

1. **cPanel** → **Manage Shell** / **Terminal** → debe estar habilitado SSH.
2. **cPanel** → **SSH Access** → **Manage SSH Keys**.
3. Genera un par de claves (o usa las de abajo desde tu PC).

### 2. Crear clave para GitHub Actions (en tu PC)

```powershell
ssh-keygen -t ed25519 -C "github-actions-coodelsur" -f "$env:USERPROFILE\.ssh\coodelsur_deploy"
```

- **Public key** (`coodelsur_deploy.pub`) → pegar en cPanel → SSH Access → **Authorize**.
- **Private key** (`coodelsur_deploy`) → contenido completo → secret `CPANEL_SSH_KEY` en GitHub.

### 3. App Node.js en cPanel (manual, una vez)

| Campo | Valor |
|-------|--------|
| Application root | `coodelsur-landing` |
| Application URL | `solicitar-credito.coodelsursas.com.co` |
| Startup file | `server.js` |
| Mode | **Production** |

Agrega **todas** las variables de entorno en el panel (no se suben desde GitHub por seguridad). Ver `CONTEXTO-PROYECTO-COMPLETO.md`.

### 4. WordPress fuera de public_html

Mueve WordPress fuera de `public_html` para que el dominio sirva la app Node.js.

---

## Secrets en GitHub

Repositorio → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Conexión cPanel (obligatorios)

| Secret | Ejemplo | Descripción |
|--------|---------|-------------|
| `CPANEL_HOST` | `cpanel2-co.conexcol.net` | Hostname del servidor |
| `CPANEL_USER` | `creditocoodelsur` | Usuario cPanel |
| `CPANEL_SSH_KEY` | `(contenido clave privada)` | Clave privada SSH |
| `CPANEL_SSH_PORT` | `22` | Puerto SSH |
| `CPANEL_DEPLOY_PATH` | `/home/creditocoodelsur/coodelsur-landing` | Carpeta de la app |
| `CPANEL_NODE_VERSION` | `18` | Versión Node en cPanel |

### Build (obligatorios para compilar)

| Secret | Valor producción |
|--------|------------------|
| `NEXT_PUBLIC_SITE_URL` | `https://solicitar-credito.coodelsursas.com.co` |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `DATABASE_URL` | Transaction pooler Supabase (`:6543`) |
| `DIRECT_URL` | Session pooler Supabase (`:5432`) |

> Las demás variables (`ADMIN_PASSWORD`, `WITME_API_KEY`, SMTP, Supabase…) van **solo en cPanel**, no en GitHub, salvo que las necesites en build (no es el caso).

---

## Disparar el deploy

### Automático

Push a la rama **`main`**:

```bash
git checkout main
git merge PaulaPachonDev
git push origin main
```

### Manual

GitHub → **Actions** → **Deploy to cPanel** → **Run workflow**.

---

## Verificación post-deploy

1. GitHub Actions → workflow en verde ✅
2. Navegador: `https://solicitar-credito.coodelsursas.com.co/api/health`
3. cPanel → Setup Node.js App → estado **started**

Respuesta esperada:

```json
{
  "ok": true,
  "database": true,
  "witmeConfigured": true,
  "adminConfigured": true
}
```

---

## Solución de problemas

| Error | Solución |
|-------|----------|
| SSH connection refused | Verificar `CPANEL_HOST`, puerto, clave autorizada en cPanel |
| `npm install` Killed en post-deploy | Pedir más RAM al hosting; el script ya usa install mínimo |
| 503 después del deploy | Setup Node.js App → **RESTART** |
| WordPress en lugar de la app | Vaciar `public_html` de WordPress |
| `nodevenv` not found | Crear app Node.js en cPanel con root `coodelsur-landing` |

---

## Notas

- El archivo `.env` del servidor **no se sobrescribe** (no va en el paquete).
- Variables sensibles de runtime: solo en **Setup Node.js App** de cPanel.
- El archivo `.cpanel.yml` ya no es necesario si usas GitHub Actions; el build ocurre en CI.
