# Empaqueta build standalone para subir a cPanel (sin npm install en el servidor).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host ">> npm run build ..."
npm run build

$standalone = Join-Path $root ".next\standalone"
$static = Join-Path $root ".next\static"
$public = Join-Path $root "public"
$out = Join-Path $root "cpanel-deploy"

if (-not (Test-Path $standalone)) {
  throw "No se genero .next/standalone. Verifica output: standalone en next.config.js"
}

Write-Host ">> Preparando carpeta cpanel-deploy ..."
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

Copy-Item "$standalone\*" $out -Recurse
New-Item -ItemType Directory -Path (Join-Path $out ".next\static") -Force | Out-Null
Copy-Item "$static\*" (Join-Path $out ".next\static") -Recurse
if (Test-Path $public) {
  Copy-Item $public (Join-Path $out "public") -Recurse
}

$zip = Join-Path $root "cpanel-deploy.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$out\*" -DestinationPath $zip

Write-Host ""
Write-Host "Listo: $zip"
Write-Host "Sube cpanel-deploy.zip a cPanel, extrae en coodelsur-landing y Restart la app Node.js."
