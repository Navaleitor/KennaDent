#!/bin/sh
# Instala las librerías del frontend dentro del contenedor solo si cambió package-lock.json.
# node_modules vive en un volumen de Docker (no en tu disco): así no hace falta Node en la computadora.
set -e
cd /frontend
huella=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ "$(cat node_modules/.huella 2>/dev/null)" != "$huella" ]; then
  echo "Instalando las librerías del frontend (solo cuando cambian)..."
  # node_modules es un volumen: se vacía su contenido (no la carpeta) y se instala lo del lockfile
  find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  npm ci --no-audit --no-fund
  echo "$huella" > node_modules/.huella
fi
