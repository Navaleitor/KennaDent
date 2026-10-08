#!/bin/sh
# Le pone contrasena al usuario de la aplicacion (kd_app), que el esquema crea sin ella.
# kd_app NO es dueno de las tablas: Row Level Security si le aplica.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -v pass="$KD_APP_PASSWORD" <<'SQL'
ALTER ROLE kd_app PASSWORD :'pass';
ALTER ROLE kd_app SET search_path = kennadent, public;
SQL
