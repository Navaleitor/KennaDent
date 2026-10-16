#!/bin/sh
# Crea el usuario con el que se conecta la aplicacion (kd_app).
# kd_app NO es dueno de las tablas: Row Level Security si le aplica.
# Las tablas las crean despues las migraciones de Django (servicio api).
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v pass="$KD_APP_PASSWORD" <<'SQL'
CREATE ROLE kd_app LOGIN PASSWORD :'pass';
SQL
