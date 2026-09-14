#!/usr/bin/env bash
# Ejecutar EN EL SERVIDOR cPanel después de extraer el deploy.
set -euo pipefail

APP_DIR="${1:-$HOME/coodelsur-landing}"
NODE_MAJOR="${2:-18}"
NODE_BIN=""
for candidate in \
  "$HOME/nodevenv/coodelsur-landing/${NODE_MAJOR}/bin" \
  "$HOME/nodeenv/coodelsur-landing/${NODE_MAJOR}/bin"; do
  if [[ -x "$candidate/npm" ]]; then
    NODE_BIN="$candidate"
    break
  fi
done

cd "$APP_DIR"
echo ">> Post-deploy en: $APP_DIR"

# Limpiar node_modules rota o enlace previo (CloudLinux)
if [[ -L node_modules ]]; then
  unlink node_modules || rm -f node_modules
elif [[ -d node_modules ]]; then
  chmod -R u+rwx node_modules 2>/dev/null || true
  rm -rf node_modules
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "ERROR: No se encontró entorno Node para coodelsur-landing (Node ${NODE_MAJOR})."
  echo "Crea la app en Setup Node.js App con root 'coodelsur-landing' y Node ${NODE_MAJOR}."
  exit 1
fi

export PATH="$NODE_BIN:$PATH"

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=512}"

echo ">> npm install (solo producción, sin scripts) ..."
npm install --omit=dev --ignore-scripts --no-audit --no-fund

if [[ -d .prisma-bundle ]]; then
  echo ">> Restaurando cliente Prisma (Linux) ..."
  mkdir -p node_modules
  cp -a .prisma-bundle/.prisma node_modules/
  cp -a .prisma-bundle/@prisma node_modules/
  rm -rf .prisma-bundle
fi

echo ">> Reiniciando app Node.js ..."
if command -v cloudlinux-selector >/dev/null 2>&1; then
  cloudlinux-selector restart \
    --json \
    --interpreter nodejs \
    --app-root coodelsur-landing \
    --user "$(whoami)" 2>/dev/null || true
fi

echo ">> Post-deploy completado."
