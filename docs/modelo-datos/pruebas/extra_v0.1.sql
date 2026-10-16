-- Pruebas adicionales sobre v0.1 (se corren DESPUES de seccion8_v0.1.sql)
SET search_path = kennadent, public;

\echo '== X1: T4 corregida. La T4 original falla por llave primaria duplicada, no por la regla de "una sola base". Prueba real de la regla:'
UPDATE trabajador_sucursal SET es_base = true WHERE trabajador_id = 1 AND sucursal_id = 2;

\echo '== X2: saldo despues de T9 (se aplicaron 9999 de un pago de 400)'
SELECT * FROM v_saldo_presupuesto;

\echo '== X3: cuota de OTRO presupuesto aplicada a este (deberia fallar)'
INSERT INTO presupuesto(paciente_id,sucursal_id,trabajador_id) VALUES (1,1,1);
INSERT INTO cuota(presupuesto_id,numero,vence,monto) VALUES (2,1,'2026-11-01',100);
INSERT INTO pago(paciente_id,sucursal_id,monto,metodo,registrado_por) VALUES (1,1,100,'efectivo',2);
INSERT INTO pago_aplicacion(pago_id,presupuesto_id,cuota_id,monto) VALUES (3,1,3,100);

\echo '== X4: pago de un paciente aplicado al presupuesto de OTRO paciente (deberia fallar)'
INSERT INTO paciente(nombre,apellidos) VALUES ('Pedro','Lopez');
INSERT INTO pago(paciente_id,sucursal_id,monto,metodo,registrado_por) VALUES (2,1,50,'efectivo',2);
INSERT INTO pago_aplicacion(pago_id,presupuesto_id,monto) VALUES (4,1,50);

\echo '== X5: saldo de un presupuesto RECHAZADO (no deberia contar como deuda)'
UPDATE presupuesto SET estado='rechazado' WHERE id=2;
INSERT INTO presupuesto_detalle(presupuesto_id,tratamiento_id,precio_unitario) VALUES (2,1,500);
SELECT * FROM v_saldo_presupuesto WHERE presupuesto_id = 2;

\echo '== X6: el mismo doctor en DOS sillones a la misma hora. El frontend lo permite con aviso; v0.1 lo prohibe:'
INSERT INTO unidad(sucursal_id,nombre) VALUES (1,'Sillon 2');
INSERT INTO cita(paciente_id,trabajador_id,unidad_id,inicio,fin)
VALUES (2,1,4,'2026-10-01 10:15-06','2026-10-01 10:45-06');

\echo '== X7: pieza 20 no existe en FDI (deberia fallar)'
INSERT INTO odontograma_hallazgo(paciente_id,pieza,hallazgo_id,trabajador_id) VALUES (1,20,1,1);

\echo '== X8: MULTIEMPRESA. Segunda empresa (otro negocio cliente)'
INSERT INTO empresa(razon_social) VALUES ('Otra Clinica SA');
INSERT INTO sucursal(empresa_id,nombre) VALUES (2,'Matriz');
\echo '-- X8a: la otra empresa no puede tener su tratamiento "Limpieza" (UNIQUE global):'
INSERT INTO tratamiento(nombre,precio_base) VALUES ('Limpieza',300);
\echo '-- X8b: ni su material "Guantes":'
INSERT INTO material(nombre,unidad_medida) VALUES ('Guantes','caja');
\echo '-- X8c: ni un usuario "andrea":'
INSERT INTO trabajador(rol_id,nombre,usuario,password_hash) VALUES (4,'Andrea Otra','andrea','x');
\echo '-- X8d: un trabajador de la empresa 1 asignado a la sucursal de la empresa 2 (deberia fallar):'
INSERT INTO trabajador_sucursal VALUES (2,4,false);
\echo '-- X8e: a que empresa pertenece el paciente 1? (no hay forma de saberlo):'
SELECT column_name FROM information_schema.columns
 WHERE table_schema='kennadent' AND table_name='paciente' AND column_name='empresa_id';
\echo '-- X8f: tablas SIN empresa_id ni camino directo a sucursal:'
SELECT t.table_name FROM information_schema.tables t
 WHERE t.table_schema='kennadent' AND t.table_type='BASE TABLE'
   AND NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='kennadent'
                    AND c.table_name=t.table_name AND c.column_name IN ('empresa_id','sucursal_id'))
 ORDER BY 1;

\echo '== X9: borrar un paciente con citas (la FK lo impide, pero uno sin citas se borra fisicamente):'
INSERT INTO paciente(nombre,apellidos) VALUES ('Sin','Citas');
DELETE FROM paciente WHERE nombre='Sin';
