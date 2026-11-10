#!/usr/bin/env bash
# Ejecutar EN EL SERVIDOR cPanel después del deploy FTP.
# Extrae cpanel-deploy.tar.gz (si existe) y NO ejecuta npm install.
set -euo pipefail

APP_DIR="${1:-$HOME/coodelsur-landing}"
NODE_MAJOR="${2:-18}"
TAR_FILE="${3:-}"

mkdir -p "$APP_DIR"
cd "$APP_DIR"
echo ">> Post-deploy en: $APP_DIR"

# 0. Prevenir y limpiar archivos core.* (volcados de memoria de Node/V8 de 2-4GB cada uno), papelera y cachés
ulimit -c 0 2>/dev/null || true
if [[ -f "$HOME/.bashrc" ]] && ! grep -q "ulimit -c 0" "$HOME/.bashrc" 2>/dev/null; then
  echo "ulimit -c 0" >> "$HOME/.bashrc"
fi
echo ">> Limpiando volcados de memoria (core.*), logs gigantes y caches temporales..."
rm -f "$HOME"/core.* "$HOME"/core "$APP_DIR"/core.* "$APP_DIR"/core "$HOME/public_html"/core.* "$HOME/solicitar-credito.coodelsursas.com.co"/core.* 2>/dev/null || true
find "$HOME" -maxdepth 3 -type f -name 'core.[0-9]*' -delete 2>/dev/null || true
rm -rf "$HOME/.Trash/"* "$HOME/.npm/_cacache" 2>/dev/null || true
if [[ -f "$APP_DIR/stderr.log" ]]; then
  tail -c 1048576 "$APP_DIR/stderr.log" > "$APP_DIR/stderr.log.tmp" 2>/dev/null && mv "$APP_DIR/stderr.log.tmp" "$APP_DIR/stderr.log" || rm -f "$APP_DIR/stderr.log"
fi

if [[ -z "$TAR_FILE" ]]; then
  for candidate in \
    "$APP_DIR/cpanel-deploy.tar.gz" \
    "$HOME/cpanel-deploy.tar.gz" \
    "$HOME/solicitar-credito.coodelsursas.com.co/despliegue/cpanel-deploy.tar.gz" \
    "$HOME/coodelsur-landing/cpanel-deploy.tar.gz"; do
    if [[ -f "$candidate" ]]; then
      TAR_FILE="$candidate"
      break
    fi
  done
fi

if [[ -n "$TAR_FILE" && -f "$TAR_FILE" ]]; then
  echo ">> Extrayendo $TAR_FILE en $APP_DIR ..."
  tar -xzf "$TAR_FILE" -C "$APP_DIR"
  echo ">> Extraccion completada con exito."
else
  echo ">> AVISO: No se encontro archivo tar de deploy. Verificando archivos existentes..."
fi

# Corregir estructura si public/public llegó a crearse en algún deploy anterior
if [[ -d "$APP_DIR/public/public" ]]; then
  echo ">> Corrigiendo estructura de public/ ..."
  cp -a "$APP_DIR/public/public/." "$APP_DIR/public/"
  rm -rf "$APP_DIR/public/public"
fi

# Asegurar copia de favicons e imágenes en public_html por si el servidor web los busca allí
if [[ -d "$HOME/public_html" ]]; then
  if [[ -d "$APP_DIR/public/images" ]]; then
    mkdir -p "$HOME/public_html/images"
    cp -a "$APP_DIR/public/images/." "$HOME/public_html/images/" 2>/dev/null || true
  fi
  cp -a "$APP_DIR/public/favicon.ico" "$HOME/public_html/favicon.ico" 2>/dev/null || true
  cp -a "$APP_DIR/public/favicon.png" "$HOME/public_html/favicon.png" 2>/dev/null || true
  cp -a "$APP_DIR/public/apple-icon.png" "$HOME/public_html/apple-icon.png" 2>/dev/null || true
fi

# Quitar enlace simbólico viejo de CloudLinux (no el node_modules del standalone)
if [[ -L node_modules ]]; then
  echo ">> Eliminando enlace simbólico node_modules ..."
  unlink node_modules || rm -f node_modules
fi

if [[ -d .prisma-bundle ]]; then
  echo ">> Restaurando cliente Prisma (Linux) ..."
  mkdir -p node_modules
  cp -a .prisma-bundle/.prisma node_modules/
  cp -a .prisma-bundle/@prisma node_modules/
  rm -rf .prisma-bundle
fi
rm -rf "$APP_DIR/node_modules/@prisma/engines" "$APP_DIR/.next/cache" 2>/dev/null || true

if [[ ! -d node_modules ]] || [[ -z "$(ls -A node_modules 2>/dev/null)" ]]; then
  echo "ERROR: Falta node_modules en el deploy."
  echo "Ejecuta GitHub Actions y luego: bash cpanel-post-deploy.sh ~/coodelsur-landing 18"
  exit 1
fi

echo ">> node_modules del build standalone OK (sin npm install en el servidor)."

# Configurar .htaccess con redirección HTTPS 308 (preserva POST method/body), LiteSpeed no-timeout y límites
for ht_dir in "$APP_DIR" "$HOME/solicitar-credito.coodelsursas.com.co" "$HOME/public_html"; do
  if [[ -d "$ht_dir" ]]; then
    touch "$ht_dir/.htaccess"
    if ! grep -q "RewriteRule ^ https:" "$ht_dir/.htaccess"; then
      cat << 'EOF' >> "$ht_dir/.htaccess"

# Coodelsur: Forzar HTTPS preservando POST (308) y aumentar buffer
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} !=on
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=308]
</IfModule>
LimitRequestBody 20971520
EOF
      echo ">> Reglas de HTTPS y LimitRequestBody agregadas en $ht_dir/.htaccess"
    fi

    # Eliminar cualquier regla previa de noconntimeout/noabort global que dejaba conexiones zombie abiertas por 500+ segundos
    if grep -q "noconntimeout\|noabort" "$ht_dir/.htaccess" 2>/dev/null; then
      sed -i '/Prevenir timeouts 503 en LiteSpeed/d' "$ht_dir/.htaccess" 2>/dev/null || true
      sed -i '/noconntimeout/d' "$ht_dir/.htaccess" 2>/dev/null || true
      sed -i '/noabort/d' "$ht_dir/.htaccess" 2>/dev/null || true
      echo ">> Reglas globales noconntimeout/noabort eliminadas de $ht_dir/.htaccess"
    fi
  fi
done

echo ">> Reiniciando app Node.js (liberando procesos previos + Passenger restart.txt) ..."
pkill -9 -f "lsnode" 2>/dev/null || true
pkill -9 -f "node.*server.js" 2>/dev/null || true
mkdir -p "$APP_DIR/tmp"
touch "$APP_DIR/tmp/restart.txt"

if command -v cloudlinux-selector >/dev/null 2>&1; then
  cloudlinux-selector restart \
    --json \
    --interpreter nodejs \
    --app-root coodelsur-landing \
    --user "$(whoami)" 2>/dev/null || true
fi

echo ">> Post-deploy completado."
