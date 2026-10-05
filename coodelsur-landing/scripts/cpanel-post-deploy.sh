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

if [[ ! -d node_modules ]] || [[ -z "$(ls -A node_modules 2>/dev/null)" ]]; then
  echo "ERROR: Falta node_modules en el deploy."
  echo "Ejecuta GitHub Actions y luego: bash cpanel-post-deploy.sh ~/coodelsur-landing 18"
  exit 1
fi

echo ">> node_modules del build standalone OK (sin npm install en el servidor)."

echo ">> Reiniciando app Node.js (Passenger restart.txt + cloudlinux-selector) ..."
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
