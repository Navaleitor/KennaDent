#!/bin/sh
# Servicio "pruebas-pantallas": Playwright contra el entorno local (nginx → /app/ y /api/).
# Uso: docker compose run --rm pruebas-pantallas   (más opciones de Playwright al final, ej. -g "entrar")
set -e
sh /frontend/docker/dependencias.sh
exec npx playwright test "$@"
