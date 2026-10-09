#!/bin/sh
# Arranque del backend:
#   1. migraciones (con el usuario dueno de las tablas);
#   2. datos de demostracion, solo si la base esta vacia y KD_CARGAR_DEMO=1;
#   3. servidor web con el usuario de la aplicacion (kd_app, con Row Level Security).
# En la nube, los pasos 1 y 2 se corren como un trabajo aparte (KD_MIGRAR=0 aqui).
set -e
if [ "${KD_MIGRAR:-1}" = "1" ]; then
  KD_DB_ROL=admin python manage.py migrate --noinput
  if [ "${KD_CARGAR_DEMO:-0}" = "1" ]; then
    KD_DB_ROL=admin python manage.py cargar_demo --si-vacia
  fi
fi
exec gunicorn kennadent.wsgi:application --bind 0.0.0.0:8000 \
  --workers "${KD_WORKERS:-2}" --access-logfile - --forwarded-allow-ips="*"
