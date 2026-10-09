"""Reglas que viven en PostgreSQL y que el ORM de Django no sabe declarar.

Es la traduccion de docs/modelo-datos/kennadent_esquema_v0.2.sql (probado en
la validacion del modelo). Incluye:
  1. validacion exacta de piezas dentales FDI;
  2. llaves foraneas COMPUESTAS (empresa_id, x_id): la base rechaza mezclar
     datos de dos empresas, una cuota de otro presupuesto, el pago de otro
     paciente, un doctor no asignado a la sucursal de la cita...;
  3. triggers: no aplicar mas dinero del que trae un pago, caja cerrada,
     prohibido borrar expediente y libros;
  4. funciones y vistas de calculo (precio vigente, existencias, saldos...);
  5. Row Level Security por empresa y permisos del usuario de la aplicacion.
"""
from django.db import migrations

# (tabla, columnas locales, tabla referida, columnas referidas)
LLAVES_COMPUESTAS = [
    ("sucursal_horario", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("unidad", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("trabajador", "empresa_id, usuario_id", "usuario", "empresa_id, id"),
    ("trabajador_permiso", "empresa_id, trabajador_id", "trabajador", "empresa_id, id"),
    ("trabajador_sucursal", "empresa_id, trabajador_id", "trabajador", "empresa_id, id"),
    ("trabajador_sucursal", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("precio_sucursal", "empresa_id, tratamiento_id", "tratamiento", "empresa_id, id"),
    ("precio_sucursal", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("material_sucursal", "empresa_id, material_id", "material", "empresa_id, id"),
    ("material_sucursal", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("tratamiento_material", "empresa_id, tratamiento_id", "tratamiento", "empresa_id, id"),
    ("tratamiento_material", "empresa_id, material_id", "material", "empresa_id, id"),
    ("paciente", "empresa_id, sucursal_origen_id", "sucursal", "empresa_id, id"),
    ("paciente", "empresa_id, creado_por", "trabajador", "empresa_id, id"),
    ("paciente_clinico", "empresa_id, paciente_id", "paciente", "empresa_id, id"),
    ("paciente_clinico", "empresa_id, actualizado_por", "trabajador", "empresa_id, id"),
    # El sillon pertenece a la sucursal de la cita y el doctor esta asignado a ella
    ("cita", "empresa_id, sucursal_id, unidad_id", "unidad", "empresa_id, sucursal_id, id"),
    ("cita", "empresa_id, trabajador_id, sucursal_id", "trabajador_sucursal", "empresa_id, trabajador_id, sucursal_id"),
    ("cita", "empresa_id, paciente_id", "paciente", "empresa_id, id"),
    ("cita", "empresa_id, tipo_cita_id", "tipo_cita", "empresa_id, id"),
    ("cita", "empresa_id, tratamiento_id", "tratamiento", "empresa_id, id"),
    ("cita", "empresa_id, creado_por", "trabajador", "empresa_id, id"),
    ("cita", "empresa_id, plan_item_id, paciente_id", "plan_item", "empresa_id, id, paciente_id"),
    # La consulta es del mismo paciente, doctor y sucursal que su cita
    ("consulta", "empresa_id, cita_id, paciente_id, trabajador_id, sucursal_id",
     "cita", "empresa_id, id, paciente_id, trabajador_id, sucursal_id"),
    ("presupuesto", "empresa_id, paciente_id", "paciente", "empresa_id, id"),
    ("presupuesto", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("presupuesto", "empresa_id, trabajador_id", "trabajador", "empresa_id, id"),
    ("plan_item", "empresa_id, paciente_id", "paciente", "empresa_id, id"),
    ("plan_item", "empresa_id, tratamiento_id", "tratamiento", "empresa_id, id"),
    ("plan_item", "empresa_id, diagnosticado_por", "trabajador", "empresa_id, id"),
    ("plan_item", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("plan_item", "empresa_id, consulta_origen_id, paciente_id", "consulta", "empresa_id, id, paciente_id"),
    ("plan_item", "empresa_id, presupuesto_id, paciente_id", "presupuesto", "empresa_id, id, paciente_id"),
    ("consulta_procedimiento", "empresa_id, consulta_id, paciente_id", "consulta", "empresa_id, id, paciente_id"),
    ("consulta_procedimiento", "empresa_id, plan_item_id, paciente_id", "plan_item", "empresa_id, id, paciente_id"),
    ("consulta_procedimiento", "empresa_id, tratamiento_id", "tratamiento", "empresa_id, id"),
    ("odontograma_hallazgo", "empresa_id, paciente_id", "paciente", "empresa_id, id"),
    ("odontograma_hallazgo", "empresa_id, trabajador_id", "trabajador", "empresa_id, id"),
    ("odontograma_hallazgo", "empresa_id, consulta_id, paciente_id", "consulta", "empresa_id, id, paciente_id"),
    ("cuota", "empresa_id, presupuesto_id", "presupuesto", "empresa_id, id"),
    ("pago", "empresa_id, paciente_id", "paciente", "empresa_id, id"),
    ("pago", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("pago", "empresa_id, cita_id", "cita", "empresa_id, id"),
    ("pago", "empresa_id, registrado_por", "trabajador", "empresa_id, id"),
    # Pago y destino del MISMO paciente; la cuota es de ESE presupuesto
    ("pago_aplicacion", "empresa_id, pago_id, paciente_id", "pago", "empresa_id, id, paciente_id"),
    ("pago_aplicacion", "empresa_id, presupuesto_id, paciente_id", "presupuesto", "empresa_id, id, paciente_id"),
    ("pago_aplicacion", "empresa_id, consulta_id, paciente_id", "consulta", "empresa_id, id, paciente_id"),
    ("pago_aplicacion", "empresa_id, cuota_id, presupuesto_id", "cuota", "empresa_id, id, presupuesto_id"),
    ("caja_movimiento", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("caja_movimiento", "empresa_id, registrado_por", "trabajador", "empresa_id, id"),
    ("corte_caja", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("corte_caja", "empresa_id, cerrado_por", "trabajador", "empresa_id, id"),
    ("inventario_traslado", "empresa_id, material_id", "material", "empresa_id, id"),
    ("inventario_traslado", "empresa_id, origen_id", "sucursal", "empresa_id, id"),
    ("inventario_traslado", "empresa_id, destino_id", "sucursal", "empresa_id, id"),
    ("inventario_traslado", "empresa_id, registrado_por", "trabajador", "empresa_id, id"),
    ("inventario_movimiento", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("inventario_movimiento", "empresa_id, material_id", "material", "empresa_id, id"),
    ("inventario_movimiento", "empresa_id, consulta_id", "consulta", "empresa_id, id"),
    ("inventario_movimiento", "empresa_id, traslado_id", "inventario_traslado", "empresa_id, id"),
    ("inventario_movimiento", "empresa_id, registrado_por", "trabajador", "empresa_id, id"),
    ("solicitud_material", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("solicitud_material", "empresa_id, material_id", "material", "empresa_id, id"),
    ("solicitud_material", "empresa_id, solicitado_por", "trabajador", "empresa_id, id"),
    ("solicitud_material", "empresa_id, atendido_por", "trabajador", "empresa_id, id"),
    ("tarea", "empresa_id, sucursal_id", "sucursal", "empresa_id, id"),
    ("tarea", "empresa_id, paciente_id", "paciente", "empresa_id, id"),
    ("tarea", "empresa_id, creado_por", "trabajador", "empresa_id, id"),
    ("seguimiento_marca", "empresa_id, marcado_por", "trabajador", "empresa_id, id"),
]


def sql_llaves():
    partes = [
        # Destinos que aun no tenian la combinacion unica que se necesita
        "ALTER TABLE usuario ADD CONSTRAINT usuario_empresa_id_id_key UNIQUE (empresa_id, id);",
        "ALTER TABLE paciente_clinico ADD CONSTRAINT paciente_clinico_empresa_paciente_key UNIQUE (empresa_id, paciente_id);",
    ]
    contador = {}
    for tabla, locales, destino, remotas in LLAVES_COMPUESTAS:
        contador[tabla] = contador.get(tabla, 0) + 1
        nombre = f"{tabla}_emp_{destino}_{contador[tabla]}"[:63]
        partes.append(f"ALTER TABLE {tabla} ADD CONSTRAINT {nombre} "
                      f"FOREIGN KEY ({locales}) REFERENCES {destino} ({remotas});")
    return "\n".join(partes)


PIEZAS = r"""
-- Pieza FDI valida: permanentes 11-18, 21-28, 31-38, 41-48; temporales 51-55 ... 81-85
CREATE FUNCTION public.es_pieza_fdi(p smallint) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
    SELECT (p / 10 BETWEEN 1 AND 4 AND p % 10 BETWEEN 1 AND 8)
        OR (p / 10 BETWEEN 5 AND 8 AND p % 10 BETWEEN 1 AND 5)
$$;
CREATE FUNCTION public.son_piezas_fdi(a smallint[]) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(bool_and(public.es_pieza_fdi(x)), true) FROM unnest(a) AS x
$$;
ALTER TABLE odontograma_hallazgo ADD CONSTRAINT odontograma_hallazgo_pieza_check CHECK (public.es_pieza_fdi(pieza));
ALTER TABLE cita ADD CONSTRAINT cita_piezas_check CHECK (public.son_piezas_fdi(piezas));
ALTER TABLE plan_item ADD CONSTRAINT plan_item_piezas_check CHECK (public.son_piezas_fdi(piezas));
ALTER TABLE consulta_procedimiento ADD CONSTRAINT consulta_procedimiento_piezas_check CHECK (public.son_piezas_fdi(piezas));
"""

TRIGGERS = r"""
-- No se puede aplicar mas dinero del que trae el pago. El candado por pago
-- evita que dos cajeros simultaneos lo "gasten" dos veces.
CREATE FUNCTION tg_aplicacion_no_excede() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_monto numeric; v_aplicado numeric;
BEGIN
    PERFORM pg_advisory_xact_lock(NEW.pago_id);
    SELECT monto INTO v_monto FROM pago WHERE id = NEW.pago_id;
    SELECT COALESCE(SUM(monto), 0) INTO v_aplicado
      FROM pago_aplicacion WHERE pago_id = NEW.pago_id AND id <> NEW.id;
    IF v_aplicado + NEW.monto > v_monto THEN
        RAISE EXCEPTION 'El pago % es de %, ya tiene % aplicado; no alcanza para %',
            NEW.pago_id, v_monto, v_aplicado, NEW.monto USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER aplicacion_no_excede BEFORE INSERT OR UPDATE ON pago_aplicacion
    FOR EACH ROW EXECUTE FUNCTION tg_aplicacion_no_excede();

-- Con el corte hecho, ese dia (local de la sucursal) ya no admite pagos ni movimientos
CREATE FUNCTION tg_caja_abierta() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_dia date;
BEGIN
    SELECT (NEW.registrado_en AT TIME ZONE s.zona_horaria)::date INTO v_dia
      FROM sucursal s WHERE s.id = NEW.sucursal_id;
    IF EXISTS (SELECT 1 FROM corte_caja c WHERE c.sucursal_id = NEW.sucursal_id AND c.fecha = v_dia) THEN
        RAISE EXCEPTION 'La caja de la sucursal % ya se cerro el %', NEW.sucursal_id, v_dia
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER pago_caja_abierta BEFORE INSERT ON pago FOR EACH ROW EXECUTE FUNCTION tg_caja_abierta();
CREATE TRIGGER mov_caja_abierta BEFORE INSERT ON caja_movimiento FOR EACH ROW EXECUTE FUNCTION tg_caja_abierta();

-- Expediente y libros contables: no se borran (NOM-004 y auditoria)
CREATE FUNCTION tg_no_borrar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'No se permite borrar renglones de %: use baja o un movimiento de correccion', TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END $$;
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['paciente','paciente_clinico','consulta','consulta_procedimiento',
                             'odontograma_hallazgo','pago','pago_aplicacion','caja_movimiento',
                             'corte_caja','inventario_movimiento','inventario_traslado','bitacora']
    LOOP
        EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tg_no_borrar()',
                       t || '_no_borrar', t);
    END LOOP;
END $$;
"""

FUNCIONES_Y_VISTAS = r"""
CREATE FUNCTION registrar_traslado(p_empresa bigint, p_material bigint, p_origen bigint,
                                   p_destino bigint, p_cantidad numeric, p_por bigint,
                                   p_nota text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id bigint; v_hay numeric;
BEGIN
    SELECT COALESCE(SUM(CASE tipo WHEN 'entrada' THEN cantidad ELSE -cantidad END), 0) INTO v_hay
      FROM inventario_movimiento WHERE sucursal_id = p_origen AND material_id = p_material;
    IF v_hay < p_cantidad THEN
        RAISE EXCEPTION 'La sucursal % solo tiene % de este material; no se pueden trasladar %',
            p_origen, v_hay, p_cantidad USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO inventario_traslado (empresa_id, material_id, origen_id, destino_id, cantidad, nota, registrado_por)
    VALUES (p_empresa, p_material, p_origen, p_destino, p_cantidad, p_nota, p_por) RETURNING id INTO v_id;
    INSERT INTO inventario_movimiento (empresa_id, sucursal_id, material_id, tipo, motivo, cantidad, traslado_id, registrado_por)
    VALUES (p_empresa, p_origen,  p_material, 'salida',  'traslado', p_cantidad, v_id, p_por),
           (p_empresa, p_destino, p_material, 'entrada', 'traslado', p_cantidad, v_id, p_por);
    RETURN v_id;
END $$;

CREATE FUNCTION precio_vigente(p_tratamiento bigint, p_sucursal bigint, p_fecha date DEFAULT current_date)
RETURNS numeric LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT ps.precio FROM precio_sucursal ps
          WHERE ps.tratamiento_id = p_tratamiento AND ps.sucursal_id = p_sucursal
            AND ps.vigente_desde <= p_fecha
          ORDER BY ps.vigente_desde DESC LIMIT 1),
        (SELECT t.precio_base FROM tratamiento t WHERE t.id = p_tratamiento))
$$;

CREATE VIEW v_existencia WITH (security_invoker = true) AS
SELECT empresa_id, sucursal_id, material_id,
       SUM(CASE tipo WHEN 'entrada' THEN cantidad ELSE -cantidad END) AS existencia
FROM inventario_movimiento
GROUP BY empresa_id, sucursal_id, material_id;

CREATE VIEW v_stock WITH (security_invoker = true) AS
SELECT ms.empresa_id, ms.sucursal_id, ms.material_id, m.nombre,
       COALESCE(e.existencia, 0) AS existencia, ms.minimo,
       CASE WHEN COALESCE(e.existencia, 0) <= ms.minimo * 0.6 THEN 'critico'
            WHEN COALESCE(e.existencia, 0) <= ms.minimo THEN 'bajo'
            ELSE 'ok' END AS estado
FROM material_sucursal ms
JOIN material m ON m.id = ms.material_id
LEFT JOIN v_existencia e ON e.sucursal_id = ms.sucursal_id AND e.material_id = ms.material_id;

CREATE VIEW v_traslado_incompleto WITH (security_invoker = true) AS
SELECT t.*, COUNT(m.id) AS movimientos
FROM inventario_traslado t
LEFT JOIN inventario_movimiento m ON m.traslado_id = t.id AND m.cantidad = t.cantidad
GROUP BY t.id
HAVING COUNT(m.id) <> 2;

CREATE VIEW v_presupuesto WITH (security_invoker = true) AS
SELECT p.*,
       COALESCE(i.subtotal, 0) AS subtotal,
       ROUND(COALESCE(i.subtotal, 0) * (1 - p.descuento_pct / 100), 2) AS total,
       CASE
         WHEN p.estado IN ('borrador','rechazado') THEN p.estado
         WHEN i.vivos > 0 AND i.hechos = i.vivos THEN 'completado'
         WHEN i.hechos > 0 THEN 'en_tratamiento'
         ELSE p.estado
       END AS estado_calculado
FROM presupuesto p
LEFT JOIN (SELECT presupuesto_id,
                  SUM(precio_unitario * cantidad) FILTER (WHERE estado <> 'rechazado') AS subtotal,
                  COUNT(*) FILTER (WHERE estado <> 'rechazado') AS vivos,
                  COUNT(*) FILTER (WHERE estado = 'realizado')  AS hechos
             FROM plan_item GROUP BY presupuesto_id) i ON i.presupuesto_id = p.id;

CREATE VIEW v_saldo_presupuesto WITH (security_invoker = true) AS
SELECT v.empresa_id, v.id AS presupuesto_id, v.paciente_id, v.total,
       COALESCE(a.pagado, 0) AS pagado,
       v.total - COALESCE(a.pagado, 0) AS saldo
FROM v_presupuesto v
LEFT JOIN (SELECT presupuesto_id, SUM(monto) AS pagado
             FROM pago_aplicacion WHERE presupuesto_id IS NOT NULL
            GROUP BY presupuesto_id) a ON a.presupuesto_id = v.id
WHERE v.estado = 'aceptado';

CREATE VIEW v_cuota WITH (security_invoker = true) AS
SELECT c.*, COALESCE(a.pagado, 0) AS pagado,
       CASE WHEN COALESCE(a.pagado, 0) >= c.monto THEN 'pagada'
            WHEN c.vence < current_date THEN 'vencida'
            ELSE 'por_vencer' END AS estado
FROM cuota c
LEFT JOIN (SELECT cuota_id, SUM(monto) AS pagado FROM pago_aplicacion
            WHERE cuota_id IS NOT NULL GROUP BY cuota_id) a ON a.cuota_id = c.id;

CREATE VIEW v_caja WITH (security_invoker = true) AS
SELECT p.empresa_id, p.sucursal_id,
       (p.registrado_en AT TIME ZONE s.zona_horaria)::date AS fecha,
       'ingreso'::text AS tipo, COALESCE(p.concepto, 'COBRO A PACIENTE') AS concepto,
       p.monto, p.metodo, p.registrado_por, p.registrado_en, p.id AS pago_id
FROM pago p JOIN sucursal s ON s.id = p.sucursal_id
UNION ALL
SELECT m.empresa_id, m.sucursal_id,
       (m.registrado_en AT TIME ZONE s.zona_horaria)::date,
       m.tipo, m.concepto, m.monto, m.metodo, m.registrado_por, m.registrado_en, NULL
FROM caja_movimiento m JOIN sucursal s ON s.id = m.sucursal_id;

CREATE VIEW v_cita_doctor_empalmada WITH (security_invoker = true) AS
SELECT a.empresa_id, a.trabajador_id, a.id AS cita_a, b.id AS cita_b, a.inicio, b.inicio AS inicio_b
FROM cita a JOIN cita b ON b.trabajador_id = a.trabajador_id AND b.id > a.id
 AND tstzrange(a.inicio, a.fin) && tstzrange(b.inicio, b.fin)
WHERE a.estado NOT IN ('cancelada','no_asistio') AND b.estado NOT IN ('cancelada','no_asistio');
"""

SEGURIDAD = r"""
-- Rol de la aplicacion. En la nube lo crea la infraestructura (con contrasena);
-- aqui solo se crea si no existe (por ejemplo, en la base de pruebas).
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kd_app') THEN CREATE ROLE kd_app NOLOGIN; END IF;
END $$;

-- Row Level Security: cada tabla con empresa_id (menos usuario, que se lee
-- antes de saber la empresa) solo muestra y acepta renglones de app.empresa_id.
-- app.plataforma = 'on' es solo para el personal de KennaDent (admin).
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT c.table_name FROM information_schema.columns c
              JOIN information_schema.tables x ON x.table_schema = c.table_schema AND x.table_name = c.table_name
             WHERE c.table_schema = 'public' AND c.column_name = 'empresa_id'
               AND x.table_type = 'BASE TABLE' AND c.table_name <> 'usuario'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format($p$CREATE POLICY por_empresa ON %I
            USING (empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::bigint
                   OR current_setting('app.plataforma', true) = 'on')
            WITH CHECK (empresa_id = NULLIF(current_setting('app.empresa_id', true), '')::bigint
                   OR current_setting('app.plataforma', true) = 'on')$p$, t);
    END LOOP;
END $$;
ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY por_empresa ON empresa
    USING (id = NULLIF(current_setting('app.empresa_id', true), '')::bigint
           OR current_setting('app.plataforma', true) = 'on');

GRANT USAGE ON SCHEMA public TO kd_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kd_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kd_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO kd_app;
-- Tablas que creen migraciones futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kd_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kd_app;
-- Libros de solo-agregar: la aplicacion no los puede modificar
REVOKE UPDATE ON pago, pago_aplicacion, caja_movimiento, corte_caja,
                 inventario_movimiento, inventario_traslado, bitacora FROM kd_app;
-- Catalogos de la plataforma y control de migraciones: solo lectura
REVOKE INSERT, UPDATE, DELETE ON puesto, permiso, puesto_permiso, catalogo_hallazgo, django_migrations FROM kd_app;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("nucleo", "0001_inicial"),
        ("admin", "0003_logentry_add_action_flag_choices"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
        ("sessions", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(PIEZAS, migrations.RunSQL.noop),
        migrations.RunSQL(sql_llaves(), migrations.RunSQL.noop),
        migrations.RunSQL(TRIGGERS, migrations.RunSQL.noop),
        migrations.RunSQL(FUNCIONES_Y_VISTAS, migrations.RunSQL.noop),
        migrations.RunSQL(SEGURIDAD, migrations.RunSQL.noop),
    ]
