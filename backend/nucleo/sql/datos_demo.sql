-- =====================================================================
-- KennaDent QA: datos de demostracion (FICTICIOS).
-- Los carga: python manage.py cargar_demo   (despues de las migraciones;
-- el mismo comando crea los usuarios para iniciar sesion).
-- Copian la demo del prototipo (js/data.js): GRUPO DENTAL DEMO con
-- CUMBRES, SAN PEDRO y CENTRO. Se agrega una segunda empresa para probar
-- que una no ve los datos de la otra.
-- Las fechas son relativas al dia en que se crea la base: 30 dias de
-- historia y 7 de agenda futura. Para "refrescarlas": docker compose down -v
--
-- NUNCA cargar datos reales de pacientes en QA (LFPDPPP).
-- =====================================================================
SELECT setseed(0.29);

-- ---------- Empresas, sucursales y sillones ----------
INSERT INTO empresa (codigo, nombre_comercial, razon_social, rfc, telefono, correo) VALUES
  ('demo', 'GRUPO DENTAL DEMO', 'Grupo Dental Demo S.A. de C.V.', 'GDD000000XX0', '81 0000 0000', 'contacto@grupodentaldemo.mx'),
  ('aislamiento', 'CLINICA AISLAMIENTO', 'Clinica de Prueba S.C.', 'CPR000000XX0', '55 0000 0000', 'prueba@clinica.mx');

INSERT INTO sucursal (empresa_id, nombre, direccion, telefono, zona_horaria) VALUES
  (1, 'CUMBRES',   'Av. Ejemplo 100, Cumbres, Monterrey, N.L.',            '81 0000 0001', 'America/Monterrey'),
  (1, 'SAN PEDRO', 'Calzada Ejemplo 200, San Pedro Garza Garcia, N.L.',    '81 0000 0002', 'America/Monterrey'),
  (1, 'CENTRO',    'Calle Ejemplo 300, Centro, Monterrey, N.L.',           '81 0000 0003', 'America/Monterrey'),
  (2, 'MATRIZ',    'Av. Prueba 1, CDMX',                                   '55 0000 0001', 'America/Mexico_City');

-- Lun-Vie 9 a 19; sabado 9 a 14 (CENTRO no abre sabado)
INSERT INTO sucursal_horario (empresa_id, sucursal_id, dia_semana, abre, cierra)
SELECT s.empresa_id, s.id, d, '09:00', CASE WHEN d = 6 THEN time '14:00' ELSE time '19:00' END
FROM sucursal s, generate_series(1, 6) d
WHERE NOT (s.nombre = 'CENTRO' AND d = 6);

INSERT INTO unidad (empresa_id, sucursal_id, nombre)
SELECT s.empresa_id, s.id, 'UNIDAD ' || u
FROM sucursal s
JOIN (VALUES ('CUMBRES', 3), ('SAN PEDRO', 2), ('CENTRO', 2), ('MATRIZ', 1)) n(suc, total) ON n.suc = s.nombre,
     generate_series(1, n.total) u
ORDER BY s.id, u;

-- ---------- Personal ----------
INSERT INTO trabajador (empresa_id, puesto_id, nombre, sexo, lleva_titulo, especialidad, cedula, telefono, color_agenda, alta_en)
SELECT e, puesto, nombre, sexo, titulo, esp, ced, tel, color, current_date - alta
FROM (VALUES
  (1, 'admin',        'KENIA NAVARRO',          'F', true,  NULL,          '1234567', '81 1000 0001', '#b0793a', 900),
  (1, 'odontologo',   'ANDREA GARZA LEAL',      'F', true,  NULL,          '2345678', '81 1000 0002', '#3d6b7d', 800),
  (1, 'odontologo',   'LUIS TREVINO CHAPA',     'M', true,  NULL,          '3456789', '81 1000 0003', '#5f8a6c', 700),
  (1, 'especialista', 'MARIANA CANTU RIOS',     'F', true,  'Ortodoncia',  '4567890', '81 1000 0004', '#7d6fb0', 600),
  (1, 'odontologo',   'JORGE SALINAS MORA',     'M', true,  NULL,          '5678901', '81 1000 0005', '#b4614b', 500),
  (1, 'especialista', 'RICARDO ELIZONDO PENA',  'M', true,  'Endodoncia',  '6789012', '81 1000 0006', '#5b7fa6', 450),
  (1, 'odontologo',   'PAOLA RIOS GUERRA',      'F', true,  NULL,          '7890123', '81 1000 0007', '#7f8440', 400),
  (1, 'odontologo',   'HECTOR MONTEMAYOR SADA', 'M', true,  NULL,          '8901234', '81 1000 0008', '#9c8457', 350),
  (1, 'recepcion',    'DANIELA FLORES ROJAS',   'F', false, NULL,          NULL,      '81 1000 0009', '#5d6873', 300),
  (1, 'recepcion',    'VALERIA GUERRA LOPEZ',   'F', false, NULL,          NULL,      '81 1000 0010', '#5d6873', 300),
  (1, 'recepcion',    'FERNANDA LEAL SOTO',     'F', false, NULL,          NULL,      '81 1000 0011', '#5d6873', 300),
  (1, 'gerente',      'CARLOS MARTINEZ VEGA',   'M', false, NULL,          NULL,      '81 1000 0012', '#5b7fa6', 600),
  (1, 'caja',         'ROBERTO GARZA LEAL',     'M', false, NULL,          NULL,      '81 1000 0013', '#b4614b', 250),
  (1, 'almacen',      'JAVIER ORTIZ LUNA',      'M', false, NULL,          NULL,      '81 1000 0014', '#9c8457', 200),
  (2, 'odontologo',   'BRUNO SALAS ORTEGA',     'M', true,  NULL,          '9012345', '55 1000 0001', '#3d6b7d', 100),
  (2, 'recepcion',    'LAURA PEREZ NUNEZ',      'F', false, NULL,          NULL,      '55 1000 0002', '#5d6873', 100)
) v(e, puesto, nombre, sexo, titulo, esp, ced, tel, color, alta);

-- Permisos efectivos = los sugeridos de su puesto
INSERT INTO trabajador_permiso (empresa_id, trabajador_id, permiso_id)
SELECT t.empresa_id, t.id, pp.permiso_id
FROM trabajador t JOIN puesto_permiso pp ON pp.puesto_id = t.puesto_id;

-- Sucursales de cada persona (base = la primera de la lista)
INSERT INTO trabajador_sucursal (empresa_id, trabajador_id, sucursal_id, es_base)
SELECT t.empresa_id, t.id, s.id, x.ord = 1
FROM (VALUES
  ('KENIA NAVARRO',          ARRAY['CUMBRES','SAN PEDRO','CENTRO']),
  ('ANDREA GARZA LEAL',      ARRAY['CUMBRES']),
  ('LUIS TREVINO CHAPA',     ARRAY['CUMBRES']),
  ('MARIANA CANTU RIOS',     ARRAY['CUMBRES','SAN PEDRO']),
  ('JORGE SALINAS MORA',     ARRAY['SAN PEDRO']),
  ('RICARDO ELIZONDO PENA',  ARRAY['SAN PEDRO','CENTRO']),
  ('PAOLA RIOS GUERRA',      ARRAY['CENTRO']),
  ('HECTOR MONTEMAYOR SADA', ARRAY['CENTRO']),
  ('DANIELA FLORES ROJAS',   ARRAY['CUMBRES']),
  ('VALERIA GUERRA LOPEZ',   ARRAY['SAN PEDRO']),
  ('FERNANDA LEAL SOTO',     ARRAY['CENTRO']),
  ('CARLOS MARTINEZ VEGA',   ARRAY['CUMBRES']),
  ('ROBERTO GARZA LEAL',     ARRAY['CUMBRES']),
  ('JAVIER ORTIZ LUNA',      ARRAY['CUMBRES','SAN PEDRO','CENTRO']),
  ('BRUNO SALAS ORTEGA',     ARRAY['MATRIZ']),
  ('LAURA PEREZ NUNEZ',      ARRAY['MATRIZ'])
) a(nombre, sucs)
JOIN trabajador t ON t.nombre = a.nombre
CROSS JOIN LATERAL unnest(a.sucs) WITH ORDINALITY x(suc, ord)
JOIN sucursal s ON s.nombre = x.suc AND s.empresa_id = t.empresa_id;

-- ---------- Catalogos de cada empresa ----------
INSERT INTO tratamiento (empresa_id, nombre, categoria, precio_base, duracion_min) VALUES
  (1, 'VALORACION DE PRIMERA VEZ',   'Diagnostico',    400,   30),
  (1, 'RADIOGRAFIA PANORAMICA',      'Diagnostico',    500,   15),
  (1, 'LIMPIEZA DENTAL',             'Preventiva',     850,   45),
  (1, 'SELLADOR DE FOSETAS',         'Preventiva',     450,   30),
  (1, 'RESINA ESTETICA',             'Operatoria',     1200,  45),
  (1, 'EXTRACCION SIMPLE',           'Cirugia',        850,   45),
  (1, 'EXTRACCION DE TERCER MOLAR',  'Cirugia',        3500,  90),
  (1, 'ENDODONCIA',                  'Endodoncia',     4800,  90),
  (1, 'CORONA DE ZIRCONIA',          'Rehabilitacion', 5400,  60),
  (1, 'IMPLANTE UNITARIO',           'Implantologia',  13200, 120),
  (1, 'BLANQUEAMIENTO DENTAL',       'Estetica',       2800,  60),
  (1, 'CARILLA DE PORCELANA',        'Estetica',       6500,  90),
  (1, 'COLOCACION DE BRACKETS',      'Ortodoncia',     15000, 120),
  (1, 'CONTROL DE ORTODONCIA',       'Ortodoncia',     800,   30),
  (1, 'RASPADO Y ALISADO RADICULAR', 'Periodoncia',    2500,  60),
  (2, 'VALORACION DE PRIMERA VEZ',   'Diagnostico',    350,   30),
  (2, 'LIMPIEZA DENTAL',             'Preventiva',     700,   45);

-- SAN PEDRO cobra mas caro la limpieza y la resina (regla 2 del dueno)
INSERT INTO precio_sucursal (empresa_id, tratamiento_id, sucursal_id, precio, vigente_desde)
SELECT 1, t.id, s.id, t.precio_base * 1.15, current_date - 60
FROM tratamiento t, sucursal s
WHERE t.empresa_id = 1 AND t.nombre IN ('LIMPIEZA DENTAL', 'RESINA ESTETICA') AND s.nombre = 'SAN PEDRO';

INSERT INTO tipo_cita (empresa_id, nombre, duracion_min, pide_tratamiento, es_diagnostico) VALUES
  (1, 'PRIMERA VEZ / VALORACION', 30, false, true),
  (1, 'SEGUIMIENTO',              30, false, false),
  (1, 'TRATAMIENTO',              60, true,  false),
  (1, 'CONTROL DE ORTODONCIA',    30, false, false),
  (1, 'URGENCIA',                 45, true,  false),
  (2, 'PRIMERA VEZ / VALORACION', 30, false, true);

INSERT INTO material (empresa_id, nombre, categoria, unidad_medida, costo, proveedor, consumo_por_cita) VALUES
  (1, 'GUANTES DE NITRILO',       'Consumibles', 'pares',     6,    'DENTAL SUPPLY', 2),
  (1, 'CUBREBOCAS',               'Consumibles', 'piezas',    2,    'DENTAL SUPPLY', 2),
  (1, 'EYECTORES DE SALIVA',      'Consumibles', 'piezas',    1.5,  'DENTAL SUPPLY', 1),
  (1, 'BOLSAS DE ESTERILIZACION', 'Consumibles', 'piezas',    1.2,  'DENTAL SUPPLY', 2),
  (1, 'GASAS ESTERILES',          'Consumibles', 'paquetes',  35,   'DENTAL SUPPLY', 0),
  (1, 'ANESTESIA LIDOCAINA',      'Farmacia',    'cartuchos', 14,   'DENTSPLY',      0),
  (1, 'AGUJAS DENTALES',          'Farmacia',    'piezas',    5,    'DENTSPLY',      0),
  (1, 'RESINA FILTEK Z350',       'Operatoria',  'jeringas',  680,  '3M MEXICO',     0),
  (1, 'ACIDO GRABADOR 37%',       'Operatoria',  'jeringas',  330,  'ULTRADENT',     0),
  (1, 'ADHESIVO DENTAL',          'Operatoria',  'frascos',   950,  '3M MEXICO',     0),
  (1, 'PASTA PROFILACTICA',       'Preventiva',  'frascos',   160,  'DENTSPLY',      0),
  (1, 'LIMAS ENDODONTICAS',       'Endodoncia',  'juegos',    420,  'KOMET',         0),
  (1, 'HIPOCLORITO DE SODIO',     'Endodoncia',  'frascos',   90,   'DENTSPLY',      0),
  (1, 'SUTURA SEDA 3-0',          'Cirugia',     'sobres',    45,   'DENTAL SUPPLY', 0),
  (1, 'GEL BLANQUEADOR',          'Estetica',    'kits',      1100, 'ULTRADENT',     0),
  (1, 'BRACKETS METALICOS',       'Ortodoncia',  'juegos',    1800, '3M MEXICO',     0),
  (2, 'GUANTES DE NITRILO',       'Consumibles', 'pares',     7,    'OTRO PROVEEDOR', 2);

-- Material por tratamiento (por pieza), como en js/data.js
INSERT INTO tratamiento_material (empresa_id, tratamiento_id, material_id, cantidad)
SELECT 1, t.id, m.id, x.cant
FROM (VALUES
  ('LIMPIEZA DENTAL', 'PASTA PROFILACTICA', 0.05),
  ('SELLADOR DE FOSETAS', 'ACIDO GRABADOR 37%', 0.05), ('SELLADOR DE FOSETAS', 'ADHESIVO DENTAL', 0.02),
  ('RESINA ESTETICA', 'ANESTESIA LIDOCAINA', 1), ('RESINA ESTETICA', 'AGUJAS DENTALES', 1),
  ('RESINA ESTETICA', 'RESINA FILTEK Z350', 0.1), ('RESINA ESTETICA', 'ACIDO GRABADOR 37%', 0.05),
  ('RESINA ESTETICA', 'ADHESIVO DENTAL', 0.03),
  ('EXTRACCION SIMPLE', 'ANESTESIA LIDOCAINA', 2), ('EXTRACCION SIMPLE', 'AGUJAS DENTALES', 1),
  ('EXTRACCION SIMPLE', 'GASAS ESTERILES', 1), ('EXTRACCION SIMPLE', 'SUTURA SEDA 3-0', 1),
  ('EXTRACCION DE TERCER MOLAR', 'ANESTESIA LIDOCAINA', 3), ('EXTRACCION DE TERCER MOLAR', 'AGUJAS DENTALES', 2),
  ('EXTRACCION DE TERCER MOLAR', 'GASAS ESTERILES', 2), ('EXTRACCION DE TERCER MOLAR', 'SUTURA SEDA 3-0', 2),
  ('ENDODONCIA', 'ANESTESIA LIDOCAINA', 2), ('ENDODONCIA', 'AGUJAS DENTALES', 1),
  ('ENDODONCIA', 'LIMAS ENDODONTICAS', 0.5), ('ENDODONCIA', 'HIPOCLORITO DE SODIO', 0.2),
  ('CORONA DE ZIRCONIA', 'ANESTESIA LIDOCAINA', 1), ('CORONA DE ZIRCONIA', 'AGUJAS DENTALES', 1),
  ('IMPLANTE UNITARIO', 'ANESTESIA LIDOCAINA', 3), ('IMPLANTE UNITARIO', 'AGUJAS DENTALES', 2),
  ('IMPLANTE UNITARIO', 'GASAS ESTERILES', 2), ('IMPLANTE UNITARIO', 'SUTURA SEDA 3-0', 2),
  ('BLANQUEAMIENTO DENTAL', 'GEL BLANQUEADOR', 1),
  ('CARILLA DE PORCELANA', 'ANESTESIA LIDOCAINA', 1), ('CARILLA DE PORCELANA', 'ACIDO GRABADOR 37%', 0.1),
  ('CARILLA DE PORCELANA', 'ADHESIVO DENTAL', 0.05),
  ('COLOCACION DE BRACKETS', 'BRACKETS METALICOS', 1), ('COLOCACION DE BRACKETS', 'ACIDO GRABADOR 37%', 0.2),
  ('COLOCACION DE BRACKETS', 'ADHESIVO DENTAL', 0.1),
  ('RASPADO Y ALISADO RADICULAR', 'ANESTESIA LIDOCAINA', 2), ('RASPADO Y ALISADO RADICULAR', 'AGUJAS DENTALES', 2),
  ('RASPADO Y ALISADO RADICULAR', 'GASAS ESTERILES', 1)
) x(trat, mat, cant)
JOIN tratamiento t ON t.empresa_id = 1 AND t.nombre = x.trat
JOIN material m ON m.empresa_id = 1 AND m.nombre = x.mat;

INSERT INTO material_sucursal (empresa_id, material_id, sucursal_id, minimo)
SELECT m.empresa_id, m.id, s.id, CASE WHEN m.consumo_por_cita > 0 THEN 150 ELSE 5 END
FROM material m JOIN sucursal s ON s.empresa_id = m.empresa_id;

-- ---------- Pacientes (nombres al azar, ficticios) ----------
INSERT INTO paciente (empresa_id, expediente, nombre, apellidos, sexo, fecha_nacimiento, telefono, sucursal_origen_id, creado_en)
SELECT 1, 'KD-' || lpad(n::text, 5, '0'),
       (ARRAY['JOSE','MARIA','JUAN','GUADALUPE','LUIS','FERNANDA','CARLOS','XIMENA','JORGE','SOFIA',
              'MIGUEL','VALERIA','DIEGO','CAMILA','ALEJANDRO','REGINA','EDUARDO','RENATA','ROBERTO','PAULINA'])[1 + (n * 7) % 20],
       (ARRAY['GARCIA','MARTINEZ','LOPEZ','GONZALEZ','RODRIGUEZ','PEREZ','SANCHEZ','RAMIREZ','CRUZ','FLORES',
              'TREVINO','GARZA','CANTU','VILLARREAL','SALINAS','ELIZONDO'])[1 + (n * 3) % 16] || ' ' ||
       (ARRAY['GOMEZ','MORALES','REYES','JIMENEZ','LEAL','GUERRA','CHAPA','ZAMBRANO','MONTEMAYOR'])[1 + (n * 5) % 9],
       CASE WHEN n % 9 < 5 THEN 'F' ELSE 'M' END,
       CASE WHEN n % 8 = 0 THEN current_date - (365 * (4 + n % 8))        -- ninos (denticion temporal o mixta)
            ELSE current_date - (365 * (18 + (n * 13) % 55) + n) END,
       '81 ' || (2000 + n) || ' ' || (5000 + n * 7),
       (SELECT id FROM sucursal WHERE empresa_id = 1 ORDER BY id OFFSET n % 3 LIMIT 1),
       now() - (n * interval '9 days')
FROM generate_series(1, 120) n;

INSERT INTO paciente (empresa_id, expediente, nombre, apellidos, sexo, fecha_nacimiento, sucursal_origen_id) VALUES
  (2, 'KD-00001', 'MARIA', 'RUIZ SOTO', 'F', '1985-04-12', (SELECT id FROM sucursal WHERE nombre = 'MATRIZ')),
  (2, 'KD-00002', 'PEDRO', 'LUNA DIAZ', 'M', '1979-11-30', (SELECT id FROM sucursal WHERE nombre = 'MATRIZ')),
  (2, 'KD-00003', 'ANA',   'SOLIS MEZA', 'F', '1992-07-08', (SELECT id FROM sucursal WHERE nombre = 'MATRIZ'));

-- Datos clinicos: los ultimos 5 los dio de alta recepcion y faltan (aviso al doctor)
INSERT INTO paciente_clinico (empresa_id, paciente_id, alergias, antecedentes, completado)
SELECT p.empresa_id, p.id,
       (ARRAY[NULL, NULL, NULL, NULL, 'Penicilina', 'Latex', 'Ibuprofeno'])[1 + p.id % 7],
       (ARRAY[NULL, NULL, NULL, NULL, NULL, 'Diabetes tipo 2', 'Hipertension', 'Asma'])[1 + p.id % 8],
       p.id <= (SELECT max(id) - 5 FROM paciente WHERE empresa_id = p.empresa_id)
FROM paciente p;

-- ---------- Agenda: 30 dias atras y 7 adelante ----------
-- Que doctor atiende cada sillon. Los viernes la UNIDAD 2 de CENTRO la cubre
-- RICARDO (base SAN PEDRO) y la UNIDAD 2 de SAN PEDRO no abre.
CREATE TEMP TABLE turno AS
SELECT u.id AS unidad_id, u.sucursal_id, u.empresa_id, s.zona_horaria, t.id AS trabajador_id, x.solo_viernes, x.no_viernes
FROM (VALUES
  ('CUMBRES',   'UNIDAD 1', 'ANDREA GARZA LEAL',      false, false),
  ('CUMBRES',   'UNIDAD 2', 'LUIS TREVINO CHAPA',     false, false),
  ('CUMBRES',   'UNIDAD 3', 'MARIANA CANTU RIOS',     false, false),
  ('SAN PEDRO', 'UNIDAD 1', 'JORGE SALINAS MORA',     false, false),
  ('SAN PEDRO', 'UNIDAD 2', 'RICARDO ELIZONDO PENA',  false, true),
  ('CENTRO',    'UNIDAD 1', 'PAOLA RIOS GUERRA',      false, false),
  ('CENTRO',    'UNIDAD 2', 'HECTOR MONTEMAYOR SADA', false, true),
  ('CENTRO',    'UNIDAD 2', 'RICARDO ELIZONDO PENA',  true,  false),
  ('MATRIZ',    'UNIDAD 1', 'BRUNO SALAS ORTEGA',     false, false)
) x(suc, uni, doc, solo_viernes, no_viernes)
JOIN sucursal s ON s.nombre = x.suc
JOIN unidad u ON u.sucursal_id = s.id AND u.nombre = x.uni
JOIN trabajador t ON t.nombre = x.doc;

CREATE TEMP TABLE agenda AS
SELECT tu.empresa_id, tu.sucursal_id, tu.unidad_id, tu.trabajador_id, tu.zona_horaria, d::date AS dia, h, random() AS r, random() AS r2, random() AS r3
FROM turno tu
CROSS JOIN generate_series(current_date - 30, current_date + 7, interval '1 day') d
CROSS JOIN generate_series(9, 18) h
JOIN sucursal_horario sh ON sh.sucursal_id = tu.sucursal_id AND sh.dia_semana = extract(isodow FROM d)
WHERE make_time(h, 0, 0) < sh.cierra
  AND (NOT tu.solo_viernes OR extract(isodow FROM d) = 5)
  AND (NOT tu.no_viernes   OR extract(isodow FROM d) <> 5);

INSERT INTO cita (empresa_id, sucursal_id, unidad_id, paciente_id, trabajador_id, tipo_cita_id, tratamiento_id, piezas,
                  inicio, fin, estado, creado_por)
SELECT a.empresa_id, a.sucursal_id, a.unidad_id,
       (SELECT id FROM paciente p WHERE p.empresa_id = a.empresa_id
         ORDER BY p.id OFFSET floor(a.r2 * (SELECT count(*) FROM paciente q WHERE q.empresa_id = a.empresa_id)) LIMIT 1),
       a.trabajador_id, tc.id,
       CASE WHEN tc.pide_tratamiento THEN tr.id END,
       CASE WHEN tc.pide_tratamiento AND tr.nombre IN ('RESINA ESTETICA','ENDODONCIA','CORONA DE ZIRCONIA','EXTRACCION SIMPLE')
            THEN ARRAY[(ARRAY[16,26,36,46,14,24])[1 + (a.h % 6)]]::smallint[] END,
       (a.dia + make_time(a.h, 0, 0)) AT TIME ZONE a.zona_horaria,
       (a.dia + make_time(a.h, 0, 0) + make_interval(mins => LEAST(tc.duracion_min, 50))) AT TIME ZONE a.zona_horaria,
       CASE
         WHEN (a.dia + make_time(a.h, 50, 0)) AT TIME ZONE a.zona_horaria < now() THEN
              CASE WHEN a.r3 < 0.86 THEN 'atendida' WHEN a.r3 < 0.93 THEN 'no_asistio' ELSE 'cancelada' END
         WHEN (a.dia + make_time(a.h, 0, 0)) AT TIME ZONE a.zona_horaria < now() THEN 'en_sala'
         WHEN a.r3 < 0.5 THEN 'confirmada' ELSE 'programada' END,
       (SELECT ts.trabajador_id FROM trabajador_sucursal ts JOIN trabajador w ON w.id = ts.trabajador_id
         WHERE ts.sucursal_id = a.sucursal_id AND w.puesto_id = 'recepcion' LIMIT 1)
FROM agenda a
JOIN LATERAL (SELECT * FROM tipo_cita WHERE empresa_id = a.empresa_id
               ORDER BY id OFFSET (CASE WHEN a.empresa_id = 2 THEN 0 ELSE floor(a.r2 * 1000)::int % 5 END) LIMIT 1) tc ON true
JOIN LATERAL (SELECT * FROM tratamiento WHERE empresa_id = a.empresa_id
                AND nombre IN ('RESINA ESTETICA','LIMPIEZA DENTAL','EXTRACCION SIMPLE','ENDODONCIA','CORONA DE ZIRCONIA')
               ORDER BY id OFFSET floor(a.r * 1000)::int % 5 LIMIT 1) tr ON true
WHERE a.r < 0.65 OR a.empresa_id = 2 AND a.r < 0.3            -- huecos libres en la agenda
ORDER BY a.dia, a.h, a.unidad_id;

-- ---------- Consultas de las citas atendidas ----------
INSERT INTO consulta (empresa_id, cita_id, paciente_id, trabajador_id, sucursal_id, registrado_en, motivo, diagnostico, notas)
SELECT c.empresa_id, c.id, c.paciente_id, c.trabajador_id, c.sucursal_id, c.fin + interval '5 min',
       CASE WHEN tc.es_diagnostico THEN (ARRAY['Revision general','Dolor en muela','Sensibilidad dental','Sangrado de encias'])[1 + c.id % 4] END,
       CASE WHEN tc.es_diagnostico THEN 'Valoracion completa; ver odontograma.' ELSE 'Evolucion favorable.' END,
       (ARRAY[NULL, 'Se dan indicaciones de higiene.', 'Paciente tolera bien el procedimiento.', 'Se receta analgesico por 3 dias.'])[1 + c.id % 4]
FROM cita c LEFT JOIN tipo_cita tc ON tc.id = c.tipo_cita_id
WHERE c.estado = 'atendida'
ORDER BY c.id;

-- Que se hizo: valoracion, control de ortodoncia o el tratamiento agendado
INSERT INTO consulta_procedimiento (empresa_id, consulta_id, paciente_id, tratamiento_id, piezas, precio)
SELECT co.empresa_id, co.id, co.paciente_id, tr.id, CASE WHEN tr.id = c.tratamiento_id THEN c.piezas END,
       precio_vigente(tr.id, co.sucursal_id, c.inicio::date) * GREATEST(COALESCE(array_length(c.piezas, 1), 1), 1)
FROM consulta co
JOIN cita c ON c.id = co.cita_id
JOIN tipo_cita tc ON tc.id = c.tipo_cita_id
JOIN tratamiento tr ON tr.empresa_id = co.empresa_id AND tr.id = COALESCE(c.tratamiento_id,
     (SELECT id FROM tratamiento x WHERE x.empresa_id = co.empresa_id AND x.nombre =
        CASE WHEN tc.nombre = 'CONTROL DE ORTODONCIA' THEN 'CONTROL DE ORTODONCIA'
             WHEN tc.es_diagnostico THEN 'VALORACION DE PRIMERA VEZ' ELSE 'LIMPIEZA DENTAL' END))
WHERE tc.nombre <> 'SEGUIMIENTO';

-- ---------- Plan de tratamiento y presupuestos (de las valoraciones) ----------
INSERT INTO plan_item (empresa_id, paciente_id, tratamiento_id, piezas, precio_unitario, estado, estado_en,
                       diagnosticado_por, sucursal_id, consulta_origen_id, creado_en)
SELECT co.empresa_id, co.paciente_id, tr.id, ARRAY[(ARRAY[16,26,36,46,15,25])[1 + co.id % 6]]::smallint[],
       precio_vigente(tr.id, co.sucursal_id), 'pendiente', co.registrado_en,
       co.trabajador_id, co.sucursal_id, co.id, co.registrado_en
FROM consulta co
JOIN cita c ON c.id = co.cita_id
JOIN tipo_cita tc ON tc.id = c.tipo_cita_id AND tc.es_diagnostico
JOIN tratamiento tr ON tr.empresa_id = co.empresa_id
 AND tr.nombre = (ARRAY['RESINA ESTETICA','ENDODONCIA','CORONA DE ZIRCONIA','EXTRACCION SIMPLE'])[1 + co.id % 4]
WHERE co.empresa_id = 1 AND co.id % 3 <> 0;

-- Hallazgo en rojo en el odontograma para cada recomendacion
INSERT INTO odontograma_hallazgo (empresa_id, paciente_id, pieza, cara, hallazgo_id, trabajador_id, consulta_id, registrado_en)
SELECT pi.empresa_id, pi.paciente_id, pi.piezas[1],
       CASE WHEN t.nombre = 'RESINA ESTETICA' THEN 'O' END,
       ch.id, pi.diagnosticado_por, pi.consulta_origen_id, pi.creado_en
FROM plan_item pi
JOIN tratamiento t ON t.id = pi.tratamiento_id
JOIN catalogo_hallazgo ch ON ch.codigo = CASE t.nombre WHEN 'RESINA ESTETICA' THEN 'caries' WHEN 'ENDODONCIA' THEN 'endodoncia'
                                                       WHEN 'CORONA DE ZIRCONIA' THEN 'corona' ELSE 'extraccion' END;

-- Presupuesto para 2 de cada 3 planes; estados variados
INSERT INTO presupuesto (empresa_id, folio, paciente_id, sucursal_id, trabajador_id, estado, descuento_pct,
                         forma_pago, num_pagos, creado_en, estado_en)
SELECT pi.empresa_id, 'P-' || lpad(row_number() OVER (ORDER BY pi.id)::text, 5, '0'), pi.paciente_id, pi.sucursal_id,
       pi.diagnosticado_por,
       (ARRAY['enviado','aceptado','aceptado','rechazado','borrador'])[1 + pi.id % 5],
       (ARRAY[0, 0, 5, 10])[1 + pi.id % 4],
       CASE WHEN pi.precio_unitario >= 4000 THEN 'mensualidades' ELSE 'contado' END,
       CASE WHEN pi.precio_unitario >= 4000 THEN 3 ELSE 1 END,
       pi.creado_en, pi.creado_en + interval '1 day'
FROM plan_item pi WHERE pi.id % 3 <> 0;

UPDATE plan_item pi SET presupuesto_id = pr.id,
       estado = CASE pr.estado WHEN 'aceptado' THEN 'aceptado' WHEN 'rechazado' THEN 'rechazado' ELSE 'pendiente' END
FROM presupuesto pr
WHERE pr.paciente_id = pi.paciente_id AND pr.creado_en = pi.creado_en AND pr.trabajador_id = pi.diagnosticado_por;

INSERT INTO cuota (empresa_id, presupuesto_id, numero, vence, monto)
SELECT v.empresa_id, v.id, n, (v.creado_en + (n - 1) * interval '30 days')::date, round(v.total / 3, 2)
FROM v_presupuesto v, generate_series(1, 3) n
WHERE v.forma_pago = 'mensualidades' AND v.estado = 'aceptado';

-- ---------- Cobros: lo de hoy y algunos de ayer quedan "por cobrar" ----------
INSERT INTO pago (empresa_id, paciente_id, sucursal_id, monto, metodo, concepto, cita_id, registrado_por, registrado_en)
SELECT co.empresa_id, co.paciente_id, co.sucursal_id, x.total,
       (ARRAY['efectivo','efectivo','tarjeta','tarjeta','transferencia'])[1 + co.id % 5],
       'CONSULTA ' || co.id, co.cita_id,
       (SELECT ts.trabajador_id FROM trabajador_sucursal ts JOIN trabajador w ON w.id = ts.trabajador_id
         WHERE ts.sucursal_id = co.sucursal_id AND w.puesto_id = 'recepcion' LIMIT 1),
       co.registrado_en + interval '10 min'
FROM consulta co
JOIN (SELECT consulta_id, sum(precio) AS total FROM consulta_procedimiento GROUP BY consulta_id) x ON x.consulta_id = co.id
WHERE co.registrado_en < date_trunc('day', now()) - interval '1 day' OR co.id % 4 = 0
ORDER BY co.id;

INSERT INTO pago_aplicacion (empresa_id, pago_id, paciente_id, consulta_id, monto)
SELECT p.empresa_id, p.id, p.paciente_id, co.id, p.monto
FROM pago p JOIN consulta co ON co.cita_id = p.cita_id;

-- Primera mensualidad de los presupuestos aceptados ya vencida y pagada
INSERT INTO pago (empresa_id, paciente_id, sucursal_id, monto, metodo, concepto, registrado_por, registrado_en)
SELECT pr.empresa_id, pr.paciente_id, pr.sucursal_id, c.monto, 'transferencia', 'MENSUALIDAD ' || c.id,
       (SELECT ts.trabajador_id FROM trabajador_sucursal ts JOIN trabajador w ON w.id = ts.trabajador_id
         WHERE ts.sucursal_id = pr.sucursal_id AND w.puesto_id = 'recepcion' LIMIT 1),
       c.vence + time '12:00'
FROM cuota c JOIN presupuesto pr ON pr.id = c.presupuesto_id
WHERE c.numero = 1 AND c.vence < current_date AND c.presupuesto_id % 2 = 0;

INSERT INTO pago_aplicacion (empresa_id, pago_id, paciente_id, presupuesto_id, cuota_id, monto)
SELECT p.empresa_id, p.id, p.paciente_id, c.presupuesto_id, c.id, p.monto
FROM pago p JOIN cuota c ON p.concepto = 'MENSUALIDAD ' || c.id;

-- ---------- Gastos de caja ----------
INSERT INTO caja_movimiento (empresa_id, sucursal_id, tipo, concepto, monto, metodo, registrado_por, registrado_en)
SELECT s.empresa_id, s.id, 'egreso', g.concepto, g.monto, g.metodo,
       (SELECT ts.trabajador_id FROM trabajador_sucursal ts JOIN trabajador w ON w.id = ts.trabajador_id
         WHERE ts.sucursal_id = s.id AND w.puesto_id = 'recepcion' LIMIT 1),
       (d::date + time '13:30') AT TIME ZONE s.zona_horaria
FROM sucursal s
CROSS JOIN generate_series(current_date - 30, current_date - 1, interval '1 day') d
JOIN LATERAL (SELECT * FROM (VALUES ('PAPELERIA', 180, 'efectivo'), ('SERVICIO DE LIMPIEZA', 500, 'efectivo'),
                                    ('PAGO DE LABORATORIO', 1800, 'transferencia'), ('MANTENIMIENTO DE EQUIPO', 2200, 'transferencia'))
                     v(concepto, monto, metodo)
               OFFSET (extract(doy FROM d)::int + s.id) % 4 LIMIT 1) g ON true
WHERE extract(isodow FROM d) < 6 AND (extract(doy FROM d)::int + s.id) % 3 = 0;

-- ---------- Cortes de caja: dias cerrados hasta antier (ayer y hoy abiertos) ----------
INSERT INTO corte_caja (empresa_id, sucursal_id, fecha, fondo, efectivo_esperado, efectivo_contado, notas, cerrado_por, cerrado_en)
SELECT v.empresa_id, v.sucursal_id, v.fecha, 1000,
       1000 + sum(CASE WHEN v.tipo = 'ingreso' AND v.metodo = 'efectivo' THEN v.monto ELSE 0 END)
            - sum(CASE WHEN v.tipo = 'egreso'  AND v.metodo = 'efectivo' THEN v.monto ELSE 0 END),
       1000 + sum(CASE WHEN v.tipo = 'ingreso' AND v.metodo = 'efectivo' THEN v.monto ELSE 0 END)
            - sum(CASE WHEN v.tipo = 'egreso'  AND v.metodo = 'efectivo' THEN v.monto ELSE 0 END)
            - CASE WHEN extract(day FROM v.fecha)::int % 9 = 0 THEN 50 ELSE 0 END,
       CASE WHEN extract(day FROM v.fecha)::int % 9 = 0 THEN 'Faltante por cambio mal entregado.' END,
       min(v.registrado_por), (v.fecha + time '19:10') AT TIME ZONE min(s.zona_horaria)
FROM v_caja v JOIN sucursal s ON s.id = v.sucursal_id
WHERE v.fecha <= current_date - 2
GROUP BY v.empresa_id, v.sucursal_id, v.fecha;

-- ---------- Inventario: compra inicial, consumo por consulta y un traslado ----------
INSERT INTO inventario_movimiento (empresa_id, sucursal_id, material_id, tipo, motivo, cantidad, nota, registrado_por, registrado_en)
SELECT m.empresa_id, s.id, m.id, 'entrada', 'compra',
       CASE WHEN m.consumo_por_cita > 0 THEN 1500 ELSE 300 END, 'Compra inicial',
       (SELECT id FROM trabajador WHERE empresa_id = m.empresa_id AND puesto_id IN ('almacen','admin','odontologo') ORDER BY puesto_id LIMIT 1),
       now() - interval '35 days'
FROM material m JOIN sucursal s ON s.empresa_id = m.empresa_id;

-- Lo que gasta cualquier cita atendida + lo que gasta cada tratamiento (por pieza)
INSERT INTO inventario_movimiento (empresa_id, sucursal_id, material_id, tipo, motivo, cantidad, consulta_id, registrado_por, registrado_en)
SELECT co.empresa_id, co.sucursal_id, x.material_id, 'salida', 'consumo', sum(x.cant), co.id, co.trabajador_id, co.registrado_en
FROM consulta co
JOIN LATERAL (
  SELECT m.id AS material_id, m.consumo_por_cita AS cant FROM material m
   WHERE m.empresa_id = co.empresa_id AND m.consumo_por_cita > 0
  UNION ALL
  SELECT tm.material_id, tm.cantidad * GREATEST(COALESCE(array_length(cp.piezas, 1), 1), 1)
    FROM consulta_procedimiento cp JOIN tratamiento_material tm ON tm.tratamiento_id = cp.tratamiento_id
   WHERE cp.consulta_id = co.id
) x ON true
GROUP BY co.empresa_id, co.sucursal_id, x.material_id, co.id, co.trabajador_id, co.registrado_en;

SELECT registrar_traslado(1, (SELECT id FROM material WHERE empresa_id = 1 AND nombre = 'RESINA FILTEK Z350'),
                          (SELECT id FROM sucursal WHERE nombre = 'CUMBRES'), (SELECT id FROM sucursal WHERE nombre = 'CENTRO'),
                          3, (SELECT id FROM trabajador WHERE nombre = 'JAVIER ORTIZ LUNA'), 'Traslado de prueba');

-- Para probar alertas: un material en estado "critico" y otro "bajo" en cada sucursal de la empresa 1
UPDATE material_sucursal ms SET minimo = ceil(e.existencia / CASE m.nombre WHEN 'RESINA FILTEK Z350' THEN 0.5 ELSE 0.9 END)
FROM v_existencia e, material m
WHERE e.sucursal_id = ms.sucursal_id AND e.material_id = ms.material_id AND m.id = ms.material_id
  AND m.nombre IN ('RESINA FILTEK Z350', 'LIMAS ENDODONTICAS');

-- Solicitudes de material pendientes (avisos para almacen)
INSERT INTO solicitud_material (empresa_id, sucursal_id, material_id, cantidad, nota, solicitado_por, solicitado_en)
SELECT 1, s.id, m.id, x.cant, x.nota, t.id, now() - x.hace
FROM (VALUES ('CUMBRES', 'RESINA FILTEK Z350', 2, 'Se termino la resina A2 en la unidad 2.', 'ANDREA GARZA LEAL', interval '1 day'),
             ('SAN PEDRO', 'LIMAS ENDODONTICAS', 1, 'Limas del 15 al 40.', 'RICARDO ELIZONDO PENA', interval '2 hours'))
     x(suc, mat, cant, nota, doc, hace)
JOIN sucursal s ON s.nombre = x.suc
JOIN material m ON m.empresa_id = 1 AND m.nombre = x.mat
JOIN trabajador t ON t.nombre = x.doc;

INSERT INTO tarea (empresa_id, sucursal_id, titulo, creado_por)
SELECT 1, s.id, 'LLAMAR A PROVEEDOR DE RAYOS X', t.id
FROM sucursal s, trabajador t WHERE s.nombre = 'CUMBRES' AND t.nombre = 'CARLOS MARTINEZ VEGA';

ANALYZE;

-- Resumen de lo cargado (aparece en el log del contenedor)
SELECT e.nombre_comercial AS empresa,
       (SELECT count(*) FROM sucursal x WHERE x.empresa_id = e.id) AS sucursales,
       (SELECT count(*) FROM trabajador x WHERE x.empresa_id = e.id) AS personal,
       (SELECT count(*) FROM paciente x WHERE x.empresa_id = e.id) AS pacientes,
       (SELECT count(*) FROM cita x WHERE x.empresa_id = e.id) AS citas,
       (SELECT count(*) FROM consulta x WHERE x.empresa_id = e.id) AS consultas,
       (SELECT count(*) FROM pago x WHERE x.empresa_id = e.id) AS pagos
FROM empresa e ORDER BY e.id;
