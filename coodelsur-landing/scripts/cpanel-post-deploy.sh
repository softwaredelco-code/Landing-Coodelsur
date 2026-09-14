#!/usr/bin/env bash
# Ejecutar EN EL SERVIDOR cPanel después del deploy FTP.
# No ejecuta npm install: el paquete ya trae node_modules del build en GitHub Actions.
set -euo pipefail

APP_DIR="${1:-$HOME/coodelsur-landing}"
NODE_MAJOR="${2:-18}"

cd "$APP_DIR"
echo ">> Post-deploy en: $APP_DIR"

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
  echo "Vuelve a ejecutar GitHub Actions (Deploy to cPanel) y copia el build a ~/coodelsur-landing."
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
