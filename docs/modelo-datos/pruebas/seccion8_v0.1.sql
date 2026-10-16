SET search_path = kennadent, public;

-- Datos mínimos
INSERT INTO empresa(razon_social) VALUES ('KennaDent SA');
INSERT INTO sucursal(empresa_id,nombre) VALUES (1,'Centro'),(1,'Norte');
INSERT INTO unidad(sucursal_id,nombre) VALUES (1,'Sillon 1');
INSERT INTO trabajador(rol_id,nombre,usuario,password_hash)
  VALUES (4,'Dra Andrea','andrea','x'),(3,'Recepcion','rec','x');
INSERT INTO trabajador_sucursal VALUES (1,1,true),(1,2,false);
INSERT INTO paciente(nombre,apellidos) VALUES ('Juan','Perez');

-- T1: cita válida (OK)
INSERT INTO cita(paciente_id,trabajador_id,unidad_id,inicio,fin)
VALUES (1,1,1,'2026-10-01 10:00-06','2026-10-01 11:00-06');

-- T2: cita empalmada en el mismo sillón (DEBE FALLAR)
INSERT INTO cita(paciente_id,trabajador_id,unidad_id,inicio,fin)
VALUES (1,1,1,'2026-10-01 10:30-06','2026-10-01 11:30-06');

-- T3: cita cancelada en el mismo horario (DEBE PASAR)
INSERT INTO cita(paciente_id,trabajador_id,unidad_id,inicio,fin,estado)
VALUES (1,1,1,'2026-10-01 10:30-06','2026-10-01 11:30-06','cancelada');

-- T4: segunda sucursal base para el mismo trabajador (DEBE FALLAR)
INSERT INTO trabajador_sucursal VALUES (1,2,true);

-- T5: precio por sucursal (Centro=500 base, Norte=650)
INSERT INTO tratamiento(nombre,precio_base) VALUES ('Limpieza',500);
INSERT INTO precio_sucursal(tratamiento_id,sucursal_id,precio) VALUES (1,2,650);
SELECT precio_vigente(1,1) AS centro, precio_vigente(1,2) AS norte;   -- 500 y 650

-- T6: presupuesto a plazos con pago parcial (saldo 325)
INSERT INTO presupuesto(paciente_id,sucursal_id,trabajador_id) VALUES (1,2,1);
INSERT INTO presupuesto_detalle(presupuesto_id,tratamiento_id,precio_unitario)
VALUES (1,1,precio_vigente(1,2));
INSERT INTO cuota(presupuesto_id,numero,vence,monto)
VALUES (1,1,'2026-11-01',325),(1,2,'2026-12-01',325);
INSERT INTO pago(paciente_id,sucursal_id,monto,metodo,registrado_por)
VALUES (1,2,325,'efectivo',2);
INSERT INTO pago_aplicacion(pago_id,presupuesto_id,cuota_id,monto) VALUES (1,1,1,325);
SELECT * FROM v_saldo_presupuesto;      -- total 650, pagado 325, saldo 325

-- T7: pago suelto sin presupuesto (DEBE PASAR)
INSERT INTO pago(paciente_id,sucursal_id,monto,metodo,concepto,registrado_por)
VALUES (1,2,400,'tarjeta','Consulta suelta',2);

-- T8: traslado de inventario (Centro 6, Norte 4)
INSERT INTO material(nombre,unidad_medida) VALUES ('Guantes','caja');
INSERT INTO inventario_movimiento(sucursal_id,material_id,tipo,motivo,cantidad,registrado_por)
VALUES (1,1,'entrada','compra',10,2),
       (1,1,'salida','traslado',4,2),
       (2,1,'entrada','traslado',4,2);
SELECT * FROM v_existencia ORDER BY sucursal_id;

-- T9 (debilidad conocida, probablemente PASE y NO debería):
-- aplicar a un pago más dinero del que tiene
INSERT INTO pago_aplicacion(pago_id,presupuesto_id,monto) VALUES (2,1,9999);

-- T10 (debilidad conocida, probablemente PASE y NO debería):
-- cita con un doctor en una sucursal donde no está asignado
INSERT INTO sucursal(empresa_id,nombre) VALUES (1,'Sur');
INSERT INTO unidad(sucursal_id,nombre) VALUES (3,'Sillon A');
INSERT INTO cita(paciente_id,trabajador_id,unidad_id,inicio,fin)
VALUES (1,1,2,'2026-10-02 10:00-06','2026-10-02 11:00-06');
