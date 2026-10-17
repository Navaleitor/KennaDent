#!/bin/sh
# Servicio "frontend" de docker-compose.yml: Vite con recarga en vivo en http://localhost:8080/app/
set -e
sh /frontend/docker/dependencias.sh
exec npm run dev
