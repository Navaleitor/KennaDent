#!/bin/sh
# Dos cajeros aplican 300 cada uno, al mismo tiempo, del mismo pago de 400.
# Solo uno debe lograrlo. Se corre como la aplicacion (kd_app) con RLS.
# Uso: PGHOST=... PGPORT=... sh concurrencia_v0.2.sh <base>
DB=${1:-kd02}
psql -U postgres -d "$DB" -Atq -c "SET search_path=kennadent; INSERT INTO pago(empresa_id,paciente_id,sucursal_id,monto,metodo,registrado_por) VALUES (1,3,2,400,'efectivo',2) RETURNING id" > /tmp/kd_pago_id
P=$(tail -1 /tmp/kd_pago_id)
SQL="SET search_path=kennadent; SET ROLE kd_app; SET app.empresa_id='1'; BEGIN;
INSERT INTO pago_aplicacion(empresa_id,pago_id,paciente_id,presupuesto_id,monto) VALUES (1,$P,3,3,300);
SELECT pg_sleep(2); COMMIT;"
echo "pago $P de 400; cajero A y cajero B aplican 300 cada uno a la vez"
psql -U postgres -d "$DB" -q -c "$SQL" > /tmp/kd_a.txt 2>&1 &
sleep 0.5
psql -U postgres -d "$DB" -q -c "$SQL" > /tmp/kd_b.txt 2>&1
wait
echo "-- cajero A:"; cat /tmp/kd_a.txt
echo "-- cajero B:"; cat /tmp/kd_b.txt
echo "-- total aplicado al pago $P:"
psql -U postgres -d "$DB" -Atc "SELECT COALESCE(SUM(monto),0) FROM kennadent.pago_aplicacion WHERE pago_id=$P"
