#!/usr/bin/env bash
# Empaqueta build standalone para desplegar en cPanel (Linux / GitHub Actions).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ">> Preparando carpeta cpanel-deploy ..."
STANDALONE="$ROOT/.next/standalone"
STATIC="$ROOT/.next/static"
OUT="$ROOT/cpanel-deploy"

if [[ ! -d "$STANDALONE" ]]; then
  echo "ERROR: No existe .next/standalone. Ejecuta 'npm run build' primero."
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT"

cp -a "$STANDALONE/." "$OUT/"
mkdir -p "$OUT/.next/static"
cp -a "$STATIC/." "$OUT/.next/static/"
cp -a "$ROOT/public" "$OUT/public"
# Usar server.js generado por Next standalone (no el custom de la raíz).
cp -a "$ROOT/database" "$OUT/database"

# package.json de producción (sin postinstall — Prisma ya se generó en CI)
node <<'NODE'
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const production = {
  name: pkg.name,
  version: pkg.version,
  private: true,
  engines: pkg.engines,
  prisma: pkg.prisma,
  scripts: {
    start: "node server.js",
  },
  dependencies: pkg.dependencies,
};
fs.writeFileSync("cpanel-deploy/package.json", JSON.stringify(production, null, 2) + "\n");
NODE

# Cliente Prisma compilado en Linux (evita prisma generate en el servidor)
if [[ -d "$ROOT/node_modules/.prisma" ]]; then
  mkdir -p "$OUT/.prisma-bundle"
  cp -a "$ROOT/node_modules/.prisma" "$OUT/.prisma-bundle/"
  cp -a "$ROOT/node_modules/@prisma" "$OUT/.prisma-bundle/"
fi

cp "$ROOT/scripts/cpanel-post-deploy.sh" "$OUT/cpanel-post-deploy.sh"
chmod +x "$OUT/cpanel-post-deploy.sh"

echo ">> Listo: $OUT"
du -sh "$OUT"
