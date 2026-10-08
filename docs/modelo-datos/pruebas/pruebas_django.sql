-- Las mismas pruebas de pruebas_v0.2.sql, contra la base que crean las migraciones de Django
-- (unica diferencia: empresa.codigo, que Django agrega para iniciar sesion).
-- mas las pruebas nuevas (T11..T22). Cada una dice que DEBE pasar.
SET search_path = kennadent, public;

-- Datos minimos: dos empresas clientes independientes
INSERT INTO empresa(codigo,nombre_comercial) VALUES ('demo','KennaDent Demo'), ('otra','Otra Clinica');
INSERT INTO sucursal(empresa_id,nombre) VALUES (1,'Centro'),(1,'Norte'),(1,'Sur'),(2,'Matriz');
INSERT INTO unidad(empresa_id,sucursal_id,nombre) VALUES (1,1,'Sillon 1'),(1,1,'Sillon 2'),(1,3,'Sillon A'),(2,4,'Sillon 1');
INSERT INTO trabajador(empresa_id,puesto_id,nombre,sexo) VALUES
  (1,'odontologo','ANDREA GARZA','F'),(1,'recepcion','DANIELA FLORES','F'),(2,'odontologo','BRUNO SALAS','M');
INSERT INTO trabajador_sucursal(empresa_id,trabajador_id,sucursal_id,es_base) VALUES (1,1,1,true),(1,1,2,false),(2,3,4,true);
INSERT INTO paciente(empresa_id,expediente,nombre,apellidos) VALUES
  (1,'KD-00001','JUAN','PEREZ'),(2,'KD-00001','MARIA','RUIZ'),(1,'KD-00002','PEDRO','LOPEZ');

\echo '== T1: cita valida (DEBE PASAR)'
INSERT INTO cita(empresa_id,sucursal_id,unidad_id,paciente_id,trabajador_id,inicio,fin)
VALUES (1,1,1,1,1,'2026-10-01 10:00-06','2026-10-01 11:00-06');

\echo '== T2: cita empalmada en el mismo sillon (DEBE FALLAR)'
INSERT INTO cita(empresa_id,sucursal_id,unidad_id,paciente_id,trabajador_id,inicio,fin)
VALUES (1,1,1,3,1,'2026-10-01 10:30-06','2026-10-01 11:30-06');

\echo '== T3: cita cancelada en el mismo horario (DEBE PASAR)'
INSERT INTO cita(empresa_id,sucursal_id,unidad_id,paciente_id,trabajador_id,inicio,fin,estado)
VALUES (1,1,1,3,1,'2026-10-01 10:30-06','2026-10-01 11:30-06','cancelada');
\echo '-- T3b: reactivar esa cita cancelada choca con la T1 (DEBE FALLAR)'
UPDATE cita SET estado='programada' WHERE id=3;
\echo '-- T3c: cita "no_asistio" en el mismo horario (DEBE PASAR)'
INSERT INTO cita(empresa_id,sucursal_id,unidad_id,paciente_id,trabajador_id,inicio,fin,estado)
VALUES (1,1,1,3,1,'2026-10-01 10:00-06','2026-10-01 10:30-06','no_asistio');

\echo '== T4: segunda sucursal base para el mismo trabajador (DEBE FALLAR por ux_trabajador_una_base)'
UPDATE trabajador_sucursal SET es_base = true WHERE trabajador_id = 1 AND sucursal_id = 2;

\echo '== T5: precio por sucursal (Centro = 500 base, Norte = 650)'
INSERT INTO tratamiento(empresa_id,nombre,categoria,precio_base) VALUES (1,'LIMPIEZA DENTAL','Preventiva',500);
INSERT INTO precio_sucursal(empresa_id,tratamiento_id,sucursal_id,precio) VALUES (1,1,2,650);
SELECT precio_vigente(1,1) AS centro, precio_vigente(1,2) AS norte;

\echo '== T6: presupuesto a plazos con pago parcial (total 650, pagado 325, saldo 325)'
INSERT INTO presupuesto(empresa_id,folio,paciente_id,sucursal_id,trabajador_id,estado,forma_pago,num_pagos)
VALUES (1,'P-00001',1,2,1,'aceptado','mensualidades',2);
INSERT INTO plan_item(empresa_id,paciente_id,tratamiento_id,precio_unitario,estado,diagnosticado_por,sucursal_id,presupuesto_id)
VALUES (1,1,1,precio_vigente(1,2),'aceptado',1,2,1);
INSERT INTO cuota(empresa_id,presupuesto_id,numero,vence,monto) VALUES (1,1,1,'2026-09-01',325),(1,1,2,'2026-12-01',325);
INSERT INTO pago(empresa_id,paciente_id,sucursal_id,monto,metodo,registrado_por) VALUES (1,1,2,325,'efectivo',2);
INSERT INTO pago_aplicacion(empresa_id,pago_id,paciente_id,presupuesto_id,cuota_id,monto) VALUES (1,1,1,1,1,325);
SELECT presupuesto_id, total, pagado, saldo FROM v_saldo_presupuesto;
SELECT numero, vence, monto, pagado, estado FROM v_cuota ORDER BY numero;

\echo '== T7: pago suelto sin presupuesto (DEBE PASAR)'
INSERT INTO pago(empresa_id,paciente_id,sucursal_id,monto,metodo,concepto,registrado_por)
VALUES (1,1,2,400,'tarjeta','CONSULTA SUELTA',2);

\echo '== T8: traslado de inventario (Centro 6, Norte 4)'
INSERT INTO material(empresa_id,nombre,unidad_medida) VALUES (1,'GUANTES','caja');
INSERT INTO inventario_movimiento(empresa_id,sucursal_id,material_id,tipo,motivo,cantidad,registrado_por)
VALUES (1,1,1,'entrada','compra',10,2);
SELECT registrar_traslado(1,1,1,2,4,2) AS traslado_id;
SELECT sucursal_id, existencia FROM v_existencia ORDER BY sucursal_id;
\echo '-- T8b: trasladar mas de lo que hay (DEBE FALLAR)'
SELECT registrar_traslado(1,1,1,2,20,2);
\echo '-- T8c: movimiento "traslado" suelto, sin documento de traslado (DEBE FALLAR)'
INSERT INTO inventario_movimiento(empresa_id,sucursal_id,material_id,tipo,motivo,cantidad,registrado_por)
VALUES (1,2,1,'entrada','traslado',4,2);
\echo '-- T8d: traslados incompletos (DEBE salir vacio)'
SELECT id, movimientos FROM v_traslado_incompleto;

\echo '== T9: aplicar a un pago mas dinero del que tiene (DEBE FALLAR)'
INSERT INTO pago_aplicacion(empresa_id,pago_id,paciente_id,presupuesto_id,monto) VALUES (1,2,1,1,9999);
\echo '-- T9b: aplicar 300 de los 400 (DEBE PASAR) y luego 101 mas (DEBE FALLAR)'
INSERT INTO pago_aplicacion(empresa_id,pago_id,paciente_id,presupuesto_id,cuota_id,monto) VALUES (1,2,1,1,2,300);
INSERT INTO pago_aplicacion(empresa_id,pago_id,paciente_id,presupuesto_id,monto) VALUES (1,2,1,1,101);

\echo '== T10: cita con un doctor en una sucursal donde NO esta asignado (DEBE FALLAR)'
INSERT INTO cita(empresa_id,sucursal_id,unidad_id,paciente_id,trabajador_id,inicio,fin)
VALUES (1,3,3,1,1,'2026-10-02 10:00-06','2026-10-02 11:00-06');
\echo '-- T10b: sillon de otra sucursal distinta a la de la cita (DEBE FALLAR)'
INSERT INTO cita(empresa_id,sucursal_id,unidad_id,paciente_id,trabajador_id,inicio,fin)
VALUES (1,2,1,1,1,'2026-10-02 10:00-06','2026-10-02 11:00-06');
\echo '-- T10c: mismo doctor en otro sillon a la misma hora (DEBE PASAR con aviso, como el frontend)'
INSERT INTO cita(empresa_id,sucursal_id,unidad_id,paciente_id,trabajador_id,inicio,fin)
VALUES (1,1,2,3,1,'2026-10-01 10:15-06','2026-10-01 10:45-06');
SELECT trabajador_id, cita_a, cita_b FROM v_cita_doctor_empalmada;

\echo '== T11: aplicar a la cuota de OTRO presupuesto (DEBE FALLAR)'
INSERT INTO presupuesto(empresa_id,folio,paciente_id,sucursal_id,trabajador_id,estado) VALUES (1,'P-00002',1,1,1,'enviado');
INSERT INTO cuota(empresa_id,presupuesto_id,numero,vence,monto) VALUES (1,2,1,'2026-11-01',100);
INSERT INTO pago(empresa_id,paciente_id,sucursal_id,monto,metodo,registrado_por) VALUES (1,1,1,100,'efectivo',2);
INSERT INTO pago_aplicacion(empresa_id,pago_id,paciente_id,presupuesto_id,cuota_id,monto) VALUES (1,3,1,1,3,100);

\echo '== T12: pago de JUAN aplicado al presupuesto de PEDRO (DEBE FALLAR)'
INSERT INTO presupuesto(empresa_id,folio,paciente_id,sucursal_id,trabajador_id) VALUES (1,'P-00003',3,1,1);
INSERT INTO pago_aplicacion(empresa_id,pago_id,paciente_id,presupuesto_id,monto) VALUES (1,3,1,3,50);
\echo '-- T12b: mismo intento declarando al paciente "correcto" del presupuesto (DEBE FALLAR)'
INSERT INTO pago_aplicacion(empresa_id,pago_id,paciente_id,presupuesto_id,monto) VALUES (1,3,3,3,50);

\echo '== T13: MULTIEMPRESA, referencias cruzadas (todas DEBEN FALLAR)'
\echo '-- T13a: cita de la empresa 1 con la paciente de la empresa 2'
INSERT INTO cita(empresa_id,sucursal_id,unidad_id,paciente_id,trabajador_id,inicio,fin)
VALUES (1,1,1,2,1,'2026-10-03 10:00-06','2026-10-03 11:00-06');
\echo '-- T13b: doctor de la empresa 2 asignado a una sucursal de la empresa 1'
INSERT INTO trabajador_sucursal(empresa_id,trabajador_id,sucursal_id) VALUES (1,3,1);
\echo '-- T13c: lo mismo declarando empresa 2'
INSERT INTO trabajador_sucursal(empresa_id,trabajador_id,sucursal_id) VALUES (2,3,1);

\echo '== T14: catalogos por empresa: la empresa 2 tambien tiene "LIMPIEZA DENTAL" y "GUANTES" (DEBE PASAR)'
INSERT INTO tratamiento(empresa_id,nombre,precio_base) VALUES (2,'LIMPIEZA DENTAL',300);
INSERT INTO material(empresa_id,nombre,unidad_medida) VALUES (2,'GUANTES','caja');
\echo '-- T14b: mismo numero de expediente KD-00001 en dos empresas ya paso arriba; repetido en la MISMA empresa (DEBE FALLAR)'
INSERT INTO paciente(empresa_id,expediente,nombre,apellidos) VALUES (1,'KD-00001','OTRO','PACIENTE');

\echo '== T15: piezas FDI'
\echo '-- T15a: pieza 20 (DEBE FALLAR)'
INSERT INTO odontograma_hallazgo(empresa_id,paciente_id,pieza,hallazgo_id,trabajador_id) VALUES (1,1,20,1,1);
\echo '-- T15b: pieza temporal 55 con caries en cara oclusal (DEBE PASAR)'
INSERT INTO odontograma_hallazgo(empresa_id,paciente_id,pieza,cara,hallazgo_id,trabajador_id) VALUES (1,1,55,'O',1,1);
\echo '-- T15c: pieza 56 (no existe en temporales) (DEBE FALLAR)'
INSERT INTO odontograma_hallazgo(empresa_id,paciente_id,pieza,hallazgo_id,trabajador_id) VALUES (1,1,56,1,1);
\echo '-- T15d: plan con piezas {16,19} (DEBE FALLAR)'
INSERT INTO plan_item(empresa_id,paciente_id,tratamiento_id,piezas,precio_unitario,diagnosticado_por,sucursal_id)
VALUES (1,1,1,'{16,19}',500,1,1);

\echo '== T16: registro de consulta'
\echo '-- T16a: consulta de la cita 1 por su propio doctor (DEBE PASAR)'
INSERT INTO consulta(empresa_id,cita_id,paciente_id,trabajador_id,sucursal_id,motivo,notas)
VALUES (1,1,1,1,1,'REVISION','Se dan indicaciones de higiene.');
INSERT INTO consulta_procedimiento(empresa_id,consulta_id,paciente_id,tratamiento_id,precio,plan_item_id)
VALUES (1,1,1,1,650,1);
\echo '-- T16b: el mismo renglon del plan realizado dos veces (DEBE FALLAR)'
INSERT INTO consulta_procedimiento(empresa_id,consulta_id,paciente_id,tratamiento_id,precio,plan_item_id)
VALUES (1,1,1,1,650,1);
\echo '-- T16c: consulta de la cita 6 registrada a nombre de OTRO trabajador (DEBE FALLAR)'
INSERT INTO consulta(empresa_id,cita_id,paciente_id,trabajador_id,sucursal_id) VALUES (1,6,3,2,1);
\echo '-- T16d: segunda consulta para la misma cita (DEBE FALLAR)'
INSERT INTO consulta(empresa_id,cita_id,paciente_id,trabajador_id,sucursal_id) VALUES (1,1,1,1,1);

\echo '== T17: corte de caja cierra el dia'
INSERT INTO corte_caja(empresa_id,sucursal_id,fecha,fondo,efectivo_esperado,efectivo_contado,cerrado_por)
VALUES (1,1,(now() AT TIME ZONE 'America/Mexico_City')::date,1000,1100,1090,2);
SELECT fecha, efectivo_esperado, efectivo_contado, diferencia FROM corte_caja;
\echo '-- T17b: pago en esa sucursal hoy (DEBE FALLAR)'
INSERT INTO pago(empresa_id,paciente_id,sucursal_id,monto,metodo,registrado_por) VALUES (1,1,1,50,'efectivo',2);
\echo '-- T17c: gasto en esa sucursal hoy (DEBE FALLAR)'
INSERT INTO caja_movimiento(empresa_id,sucursal_id,tipo,concepto,monto,metodo,registrado_por) VALUES (1,1,'egreso','PAPELERIA',80,'efectivo',2);
\echo '-- T17d: pago en OTRA sucursal hoy (DEBE PASAR)'
INSERT INTO pago(empresa_id,paciente_id,sucursal_id,monto,metodo,registrado_por) VALUES (1,1,2,50,'efectivo',2);

\echo '== T18: borrar un paciente (DEBE FALLAR: NOM-004)'
DELETE FROM paciente WHERE id = 3;

\echo '== T19: estado calculado del presupuesto P-00001 (DEBE decir completado: su unico renglon se realizo)'
UPDATE plan_item SET estado='realizado' WHERE id=1;
SELECT folio, estado, estado_calculado, total FROM v_presupuesto ORDER BY id;

\echo '== T20: AISLAMIENTO con RLS, conectado como la aplicacion (kd_app)'
SET ROLE kd_app;
\echo '-- T20a: sin decir la empresa, no ve ningun paciente (DEBE dar 0)'
SELECT count(*) AS pacientes_visibles FROM paciente;
\echo '-- T20b: como empresa 2 solo ve a su paciente (DEBE dar MARIA)'
SET app.empresa_id = '2';
SELECT nombre FROM paciente;
SELECT count(*) AS citas_visibles_de_empresa_1 FROM cita;
\echo '-- T20c: como empresa 2 intenta crear un paciente de la empresa 1 (DEBE FALLAR)'
INSERT INTO paciente(empresa_id,expediente,nombre,apellidos) VALUES (1,'KD-09999','INTRUSO','X');
\echo '-- T20d: como empresa 2 intenta modificar pacientes de la empresa 1 (DEBE afectar 0 renglones)'
UPDATE paciente SET nombre='HACKEADO' WHERE id=1;
\echo '-- T20e: la aplicacion no puede modificar un pago ya registrado (DEBE FALLAR: permiso)'
SET app.empresa_id = '1';
UPDATE pago SET monto = 1 WHERE id = 1;
RESET ROLE;
RESET app.empresa_id;
SELECT nombre FROM paciente WHERE id=1;
