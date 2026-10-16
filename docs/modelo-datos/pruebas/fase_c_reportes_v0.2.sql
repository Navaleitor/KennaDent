-- Fase C: los reportes del negocio escritos contra v0.2.
-- Se ejecutan como la aplicacion (kd_app) con RLS, viendo solo la empresa 1.
SET search_path = kennadent, public;
SET ROLE kd_app;
SET app.empresa_id = '1';
\timing on

\echo '== C1. Ventas y produccion por doctor en septiembre 2026, separando cuando cubrio otra sucursal'
-- Produccion = lo que hizo (consulta_procedimiento). Se atribuye a la PERSONA,
-- y la sucursal solo se usa para mostrar si estaba cubriendo.
SELECT t.nombre AS doctor, s.nombre AS sucursal_donde_atendio,
       NOT ts.es_base AS cubriendo,
       COUNT(DISTINCT co.id) AS consultas, SUM(cp.precio) AS produccion
FROM consulta co
JOIN cita ci ON ci.id = co.cita_id
JOIN consulta_procedimiento cp ON cp.consulta_id = co.id
JOIN trabajador t ON t.id = co.trabajador_id
JOIN sucursal s ON s.id = co.sucursal_id
JOIN trabajador_sucursal ts ON ts.trabajador_id = co.trabajador_id AND ts.sucursal_id = co.sucursal_id
WHERE ci.inicio >= '2026-09-01' AND ci.inicio < '2026-10-01'
GROUP BY t.nombre, s.nombre, ts.es_base
ORDER BY t.nombre, cubriendo;

\echo '-- C1b. Presupuestado y tasa de aceptacion por doctor (como KD.metricas)'
SELECT t.nombre AS doctor, SUM(pi.precio_unitario * pi.cantidad) AS presupuestado,
       COUNT(*) FILTER (WHERE pi.estado <> 'pendiente') AS decididos,
       ROUND(COUNT(*) FILTER (WHERE pi.estado IN ('aceptado','realizado'))::numeric
             / NULLIF(COUNT(*) FILTER (WHERE pi.estado <> 'pendiente'), 0), 2) AS tasa_aceptacion
FROM plan_item pi JOIN trabajador t ON t.id = pi.diagnosticado_por
WHERE pi.creado_en >= '2026-01-01'
GROUP BY t.nombre ORDER BY presupuestado DESC;

\echo '== C2. Ingresos por sucursal y metodo de pago, septiembre 2026 (dia local de cada sucursal)'
SELECT s.nombre AS sucursal, c.metodo, SUM(c.monto) AS ingresos
FROM v_caja c JOIN sucursal s ON s.id = c.sucursal_id
WHERE c.tipo = 'ingreso' AND c.fecha BETWEEN '2026-09-01' AND '2026-09-30'
GROUP BY ROLLUP (s.nombre, c.metodo) ORDER BY 1, 2;

\echo '== C3. Saldo pendiente por paciente (consultas no cobradas + presupuestos aceptados), top 5'
WITH cargos AS (
  SELECT co.paciente_id, SUM(cp.precio) - COALESCE(SUM(pa.monto), 0) AS saldo
  FROM consulta co
  JOIN (SELECT consulta_id, SUM(precio) AS precio FROM consulta_procedimiento GROUP BY consulta_id) cp ON cp.consulta_id = co.id
  LEFT JOIN (SELECT consulta_id, SUM(monto) AS monto FROM pago_aplicacion WHERE consulta_id IS NOT NULL GROUP BY consulta_id) pa
         ON pa.consulta_id = co.id
  GROUP BY co.paciente_id
  UNION ALL
  SELECT paciente_id, saldo FROM v_saldo_presupuesto
)
SELECT p.expediente, SUM(c.saldo) AS saldo
FROM cargos c JOIN paciente p ON p.id = c.paciente_id
GROUP BY p.expediente HAVING SUM(c.saldo) > 0
ORDER BY saldo DESC LIMIT 5;
\echo '-- C3b. Cuotas vencidas'
SELECT presupuesto_id, numero, vence, monto, pagado FROM v_cuota WHERE estado = 'vencida' LIMIT 5;

\echo '== C4. Existencia por sucursal (con estado de stock) y movimientos de septiembre'
SELECT s.nombre AS sucursal, v.nombre AS material, v.existencia, v.minimo, v.estado
FROM v_stock v JOIN sucursal s ON s.id = v.sucursal_id
WHERE v.material_id IN (SELECT id FROM material WHERE consumo_por_cita > 0)
ORDER BY 1, 2;
SELECT sucursal_id, motivo, tipo, COUNT(*) AS movimientos, SUM(cantidad) AS cantidad
FROM inventario_movimiento
WHERE registrado_en >= '2026-09-01' AND registrado_en < '2026-10-01'
GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;

\echo '== C5. Ocupacion de la agenda por sillon, septiembre 2026 (minutos agendados / minutos abiertos)'
WITH dias AS (
  SELECT d::date AS dia FROM generate_series(date '2026-09-01', date '2026-09-30', interval '1 day') d
), abierto AS (
  SELECT u.id AS unidad_id, SUM(EXTRACT(epoch FROM h.cierra - h.abre) / 60) AS minutos
  FROM unidad u JOIN sucursal_horario h ON h.sucursal_id = u.sucursal_id
  JOIN dias ON EXTRACT(isodow FROM dias.dia) = h.dia_semana
  GROUP BY u.id
), ocupado AS (
  SELECT unidad_id, SUM(EXTRACT(epoch FROM fin - inicio) / 60) AS minutos
  FROM cita WHERE estado NOT IN ('cancelada','no_asistio')
    AND inicio >= '2026-09-01' AND inicio < '2026-10-01'
  GROUP BY unidad_id
)
SELECT s.nombre AS sucursal, u.nombre AS sillon, ROUND(100 * o.minutos / a.minutos, 1) AS ocupacion_pct
FROM abierto a JOIN unidad u ON u.id = a.unidad_id JOIN sucursal s ON s.id = u.sucursal_id
LEFT JOIN ocupado o ON o.unidad_id = a.unidad_id
ORDER BY 1, 2;
\echo '-- C5b. Ocupacion por doctor (horas atendidas en septiembre)'
SELECT t.nombre, ROUND(SUM(EXTRACT(epoch FROM c.fin - c.inicio)) / 3600, 1) AS horas
FROM cita c JOIN trabajador t ON t.id = c.trabajador_id
WHERE c.estado NOT IN ('cancelada','no_asistio') AND c.inicio >= '2026-09-01' AND c.inicio < '2026-10-01'
GROUP BY t.nombre ORDER BY 1;

\echo '== C6. Historial completo de un paciente (linea de tiempo)'
WITH pac AS (SELECT paciente_id AS id FROM consulta ORDER BY id LIMIT 1)
SELECT * FROM (
  SELECT c.inicio AS fecha, 'cita' AS tipo, c.estado AS detalle FROM cita c, pac WHERE c.paciente_id = pac.id
  UNION ALL
  SELECT co.registrado_en, 'consulta', COALESCE(co.motivo, '') || ' ' || COALESCE(co.notas, '') FROM consulta co, pac WHERE co.paciente_id = pac.id
  UNION ALL
  SELECT co.registrado_en, 'procedimiento', t.nombre || ' $' || cp.precio
    FROM consulta_procedimiento cp JOIN consulta co ON co.id = cp.consulta_id JOIN tratamiento t ON t.id = cp.tratamiento_id, pac
   WHERE cp.paciente_id = pac.id
  UNION ALL
  SELECT h.registrado_en, 'odontograma', 'pieza ' || h.pieza || ' ' || ch.nombre
    FROM odontograma_hallazgo h JOIN catalogo_hallazgo ch ON ch.id = h.hallazgo_id, pac WHERE h.paciente_id = pac.id
  UNION ALL
  SELECT p.registrado_en, 'pago', p.metodo || ' $' || p.monto FROM pago p, pac WHERE p.paciente_id = pac.id
) x ORDER BY fecha LIMIT 12;

\echo '== C7. Pacientes con tratamiento ACEPTADO pero no terminado y sin cita futura'
SELECT p.expediente, COUNT(*) AS pendientes, MIN(pi.estado_en)::date AS desde
FROM plan_item pi
JOIN presupuesto pr ON pr.id = pi.presupuesto_id AND pr.estado = 'aceptado'
JOIN paciente p ON p.id = pi.paciente_id
WHERE pi.estado = 'aceptado'
  AND NOT EXISTS (SELECT 1 FROM cita c WHERE c.paciente_id = pi.paciente_id
                   AND c.inicio > now() AND c.estado IN ('programada','confirmada'))
GROUP BY p.expediente ORDER BY pendientes DESC, desde LIMIT 5;
SELECT COUNT(DISTINCT pi.paciente_id) AS total_pacientes_con_pendientes
FROM plan_item pi JOIN presupuesto pr ON pr.id = pi.presupuesto_id AND pr.estado = 'aceptado'
WHERE pi.estado = 'aceptado';
\timing off
RESET ROLE;
