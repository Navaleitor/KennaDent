-- Datos de volumen para v0.2: 5 empresas x 3 sucursales x 2 sillones,
-- citas de 9:00 a 18:00 de lunes a sabado del 2024-01-01 al 2026-10-05.
-- Se carga como superusuario (sin RLS) sobre una base con el esquema v0.2 recien creado.
SET search_path = kennadent, public;
SELECT setseed(0.2026);

INSERT INTO empresa(nombre_comercial) SELECT 'EMPRESA ' || e FROM generate_series(1,5) e;
INSERT INTO sucursal(empresa_id,nombre)
  SELECT e, 'SUC ' || s FROM generate_series(1,5) e, generate_series(1,3) s ORDER BY e, s;
INSERT INTO sucursal_horario(empresa_id,sucursal_id,dia_semana,abre,cierra)
  SELECT s.empresa_id, s.id, d, '09:00', '19:00' FROM sucursal s, generate_series(1,6) d;
INSERT INTO unidad(empresa_id,sucursal_id,nombre)
  SELECT s.empresa_id, s.id, 'SILLON ' || u FROM sucursal s, generate_series(1,2) u ORDER BY s.id, u;

-- 6 doctores (2 por sucursal) + 3 recepcionistas por empresa
INSERT INTO trabajador(empresa_id,puesto_id,nombre)
  SELECT e, CASE WHEN k <= 6 THEN 'odontologo' ELSE 'recepcion' END, 'PERSONA ' || e || '-' || k
  FROM generate_series(1,5) e, generate_series(1,9) k ORDER BY e, k;
-- base: sucursal ((k-1)/2)+1 ; ademas cubre la siguiente sucursal
INSERT INTO trabajador_sucursal(empresa_id,trabajador_id,sucursal_id,es_base)
  SELECT e, (e-1)*9 + k, (e-1)*3 + ((k-1)/2) + 1, true FROM generate_series(1,5) e, generate_series(1,6) k
  UNION ALL
  SELECT e, (e-1)*9 + k, (e-1)*3 + ((k-1)/2) + 2, false FROM generate_series(1,5) e, generate_series(1,4) k
  UNION ALL
  SELECT e, (e-1)*9 + k, (e-1)*3 + (k-6), true FROM generate_series(1,5) e, generate_series(7,9) k;

INSERT INTO tratamiento(empresa_id,nombre,categoria,precio_base)
  SELECT e, 'TRATAMIENTO ' || t, (ARRAY['Diagnostico','Preventiva','Operatoria','Cirugia','Endodoncia'])[1 + t % 5], 300 + t * 250
  FROM generate_series(1,5) e, generate_series(1,15) t ORDER BY e, t;
INSERT INTO material(empresa_id,nombre,unidad_medida,consumo_por_cita)
  SELECT e, 'MATERIAL ' || m, 'piezas', CASE WHEN m <= 2 THEN 2 ELSE 0 END
  FROM generate_series(1,5) e, generate_series(1,10) m ORDER BY e, m;
INSERT INTO material_sucursal(empresa_id,material_id,sucursal_id,minimo)
  SELECT s.empresa_id, m.id, s.id, 200 FROM sucursal s JOIN material m ON m.empresa_id = s.empresa_id;

INSERT INTO paciente(empresa_id,expediente,nombre,apellidos,fecha_nacimiento)
  SELECT e, 'KD-' || lpad(n::text,5,'0'), 'PACIENTE ' || n, 'APELLIDO', date '1950-01-01' + (random()*25000)::int
  FROM generate_series(1,5) e, generate_series(1,20000) n ORDER BY e, n;

-- Citas. Cada 20 dias el sillon lo atiende el doctor de la sucursal anterior (cobertura).
INSERT INTO cita(empresa_id,sucursal_id,unidad_id,paciente_id,trabajador_id,inicio,fin,estado)
SELECT empresa_id, sucursal_id, unidad_id, paciente_id, trabajador_id, inicio, fin,
       CASE WHEN r < 0.85 THEN 'atendida' WHEN r < 0.93 THEN 'no_asistio' ELSE 'cancelada' END
FROM (
  SELECT u.empresa_id, u.sucursal_id, u.id AS unidad_id,
         (u.empresa_id-1)*20000 + 1 + floor(random()*20000)::int AS paciente_id,
         CASE WHEN extract(doy FROM d)::int % 20 = 0 AND s_ord > 1
              THEN (u.empresa_id-1)*9 + (s_ord-2)*2 + u_ord
              ELSE (u.empresa_id-1)*9 + (s_ord-1)*2 + u_ord END AS trabajador_id,
         (d::date + make_time(h,0,0)) AT TIME ZONE 'America/Mexico_City' AS inicio,
         (d::date + make_time(h,50,0)) AT TIME ZONE 'America/Mexico_City' AS fin,
         random() AS r
  FROM (SELECT un.*, row_number() OVER (PARTITION BY un.sucursal_id ORDER BY un.id) AS u_ord,
               un.sucursal_id - (un.empresa_id-1)*3 AS s_ord FROM unidad un) u,
       generate_series(date '2024-01-01', date '2026-10-05', interval '1 day') d,
       generate_series(9,18) h
  WHERE extract(isodow FROM d) < 7
) g;

INSERT INTO consulta(empresa_id,cita_id,paciente_id,trabajador_id,sucursal_id,registrado_en)
  SELECT empresa_id, id, paciente_id, trabajador_id, sucursal_id, fin FROM cita WHERE estado = 'atendida' ORDER BY id;
INSERT INTO consulta_procedimiento(empresa_id,consulta_id,paciente_id,tratamiento_id,precio)
  SELECT c.empresa_id, c.id, c.paciente_id, t.id, t.precio_base
  FROM consulta c, LATERAL (SELECT id, precio_base FROM tratamiento
                             WHERE empresa_id = c.empresa_id ORDER BY random() + c.id * 0 LIMIT 1) t;

-- Pagos: 92% de las consultas se cobran el mismo dia
INSERT INTO pago(empresa_id,paciente_id,sucursal_id,monto,metodo,cita_id,registrado_por,registrado_en)
  SELECT c.empresa_id, c.paciente_id, c.sucursal_id, cp.precio,
         (ARRAY['efectivo','tarjeta','transferencia'])[1 + floor(random()*3)::int], c.cita_id,
         (c.empresa_id-1)*9 + 6 + (c.sucursal_id - (c.empresa_id-1)*3), c.registrado_en + interval '5 min'
  FROM consulta c JOIN consulta_procedimiento cp ON cp.consulta_id = c.id
  WHERE random() < 0.92 ORDER BY c.id;
INSERT INTO pago_aplicacion(empresa_id,pago_id,paciente_id,consulta_id,monto)
  SELECT p.empresa_id, p.id, p.paciente_id, c.id, p.monto FROM pago p JOIN consulta c ON c.cita_id = p.cita_id;

-- Plan de tratamiento y presupuestos: 15% de las consultas recomiendan algo
INSERT INTO presupuesto(empresa_id,folio,paciente_id,sucursal_id,trabajador_id,estado,creado_en)
  SELECT c.empresa_id, 'P-' || c.id, c.paciente_id, c.sucursal_id, c.trabajador_id,
         (ARRAY['enviado','aceptado','aceptado','rechazado'])[1 + floor(random()*4)::int], c.registrado_en
  FROM consulta c WHERE c.id % 7 = 0 ORDER BY c.id;
INSERT INTO plan_item(empresa_id,paciente_id,tratamiento_id,piezas,precio_unitario,estado,diagnosticado_por,sucursal_id,
                      consulta_origen_id,presupuesto_id,creado_en,estado_en)
  SELECT p.empresa_id, p.paciente_id, (p.empresa_id-1)*15 + 1 + (p.id % 15), '{16}', 1500,
         CASE p.estado WHEN 'aceptado' THEN (CASE WHEN random() < 0.6 THEN 'realizado' ELSE 'aceptado' END)
                       WHEN 'rechazado' THEN 'rechazado' ELSE 'pendiente' END,
         p.trabajador_id, p.sucursal_id, c.id, p.id, p.creado_en, p.creado_en
  FROM presupuesto p JOIN consulta c ON c.empresa_id = p.empresa_id AND 'P-' || c.id = p.folio;

-- Mensualidades: 1 de cada 3 presupuestos aceptados, 3 cuotas de 500; solo se paga la primera
UPDATE presupuesto SET forma_pago = 'mensualidades', num_pagos = 3 WHERE estado = 'aceptado' AND id % 3 = 0;
INSERT INTO cuota(empresa_id,presupuesto_id,numero,vence,monto)
  SELECT p.empresa_id, p.id, n, (p.creado_en + n * interval '30 days')::date, 500
  FROM presupuesto p, generate_series(1,3) n WHERE p.forma_pago = 'mensualidades' ORDER BY p.id, n;
INSERT INTO pago(empresa_id,paciente_id,sucursal_id,monto,metodo,concepto,registrado_por,registrado_en)
  SELECT p.empresa_id, p.paciente_id, p.sucursal_id, 500, 'transferencia', 'CUOTA ' || c.id, (p.empresa_id-1)*9 + 7, c.vence + time '12:00'
  FROM presupuesto p JOIN cuota c ON c.presupuesto_id = p.id AND c.numero = 1
  WHERE c.vence <= date '2026-10-05' ORDER BY p.id;
INSERT INTO pago_aplicacion(empresa_id,pago_id,paciente_id,presupuesto_id,cuota_id,monto)
  SELECT p.empresa_id, p.id, p.paciente_id, c.presupuesto_id, c.id, 500
  FROM pago p JOIN cuota c ON p.concepto = 'CUOTA ' || c.id;

-- Inventario: una compra grande y el consumo por cita atendida
INSERT INTO inventario_movimiento(empresa_id,sucursal_id,material_id,tipo,motivo,cantidad,registrado_por,registrado_en)
  SELECT ms.empresa_id, ms.sucursal_id, ms.material_id, 'entrada', 'compra', 50000, (ms.empresa_id-1)*9 + 7, '2024-01-01'
  FROM material_sucursal ms;
INSERT INTO inventario_movimiento(empresa_id,sucursal_id,material_id,tipo,motivo,cantidad,consulta_id,registrado_por,registrado_en)
  SELECT c.empresa_id, c.sucursal_id, m.id, 'salida', 'consumo', m.consumo_por_cita, c.id, c.trabajador_id, c.registrado_en
  FROM consulta c JOIN material m ON m.empresa_id = c.empresa_id AND m.consumo_por_cita > 0;

ANALYZE;
SELECT relname AS tabla, n_live_tup AS renglones FROM pg_stat_user_tables
 WHERE schemaname = 'kennadent' AND n_live_tup > 1000 ORDER BY n_live_tup DESC;
