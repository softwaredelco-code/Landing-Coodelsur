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
    "$HOME/solicitar-credito.coodelsursas.com.co/despliegue/cpanel-deploy.tar.gz" \
    "$HOME/coodelsur-landing/cpanel-deploy.tar.gz"; do
    if [[ -f "$candidate" ]]; then
      TAR_FILE="$candidate"
      break
    fi
  done
fi

if [[ -n "$TAR_FILE" && -f "$TAR_FILE" ]]; then
  echo ">> Extrayendo $TAR_FILE ..."
  tar -xzf "$TAR_FILE" -C "$APP_DIR"
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

echo ">> Reiniciando app Node.js ..."
if command -v cloudlinux-selector >/dev/null 2>&1; then
  cloudlinux-selector restart \
    --json \
    --interpreter nodejs \
    --app-root coodelsur-landing \
    --user "$(whoami)" 2>/dev/null || true
fi

echo ">> Post-deploy completado."
