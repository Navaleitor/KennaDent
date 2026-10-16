-- =====================================================================
-- KennaDent - Esquema PostgreSQL v0.1
-- Para correr en pgAdmin: Query Tool -> pegar todo -> F5
-- Crea el esquema "kennadent". Si algo sale mal y quieres empezar de cero:
--   DROP SCHEMA kennadent CASCADE;
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- necesaria para evitar citas encimadas

CREATE SCHEMA IF NOT EXISTS kennadent;
SET search_path = kennadent, public;

-- ---------------------------------------------------------------------
-- 1. ESTRUCTURA Y PERSONAL
-- ---------------------------------------------------------------------

CREATE TABLE empresa (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    razon_social  text NOT NULL,
    rfc           text,
    creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sucursal (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id  bigint NOT NULL REFERENCES empresa(id),
    nombre      text NOT NULL,
    direccion   text,
    telefono    text,
    activo      boolean NOT NULL DEFAULT true,
    UNIQUE (empresa_id, nombre)
);

-- Unidad = sillon dental. La agenda cuelga de la unidad.
CREATE TABLE unidad (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sucursal_id  bigint NOT NULL REFERENCES sucursal(id),
    nombre       text NOT NULL,
    activo       boolean NOT NULL DEFAULT true,
    UNIQUE (sucursal_id, nombre)
);

-- Un trabajador tiene UN solo rol (en todas las sucursales).
CREATE TABLE rol (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre  text NOT NULL UNIQUE
);

CREATE TABLE rol_permiso (
    rol_id   bigint NOT NULL REFERENCES rol(id) ON DELETE CASCADE,
    permiso  text NOT NULL,
    PRIMARY KEY (rol_id, permiso)
);

CREATE TABLE trabajador (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol_id         bigint NOT NULL REFERENCES rol(id),
    nombre         text NOT NULL,
    especialidad   text,                     -- 'ODONTOLOGIA GENERAL', 'ORTODONCIA', etc.
    usuario        text NOT NULL UNIQUE,
    password_hash  text NOT NULL,            -- NUNCA guardar la contrasena en claro
    color_agenda   text,                     -- ej. '#1F4E79'
    activo         boolean NOT NULL DEFAULT true,
    creado_en      timestamptz NOT NULL DEFAULT now()
);

-- Puente: en que sucursales puede trabajar (o cubrir) cada persona.
-- es_base = su sucursal principal. Las demas son de cobertura.
CREATE TABLE trabajador_sucursal (
    trabajador_id  bigint NOT NULL REFERENCES trabajador(id),
    sucursal_id    bigint NOT NULL REFERENCES sucursal(id),
    es_base        boolean NOT NULL DEFAULT false,
    PRIMARY KEY (trabajador_id, sucursal_id)
);
-- Maximo una sucursal base por trabajador
CREATE UNIQUE INDEX ux_trabajador_una_base
    ON trabajador_sucursal (trabajador_id) WHERE es_base;

-- ---------------------------------------------------------------------
-- 2. PACIENTES, CITAS E HISTORIAL CLINICO
-- ---------------------------------------------------------------------

-- Paciente GLOBAL: lo comparten todas las sucursales.
CREATE TABLE paciente (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre              text NOT NULL,
    apellidos           text NOT NULL,
    telefono            text,
    correo              text,
    fecha_nacimiento    date,
    sucursal_origen_id  bigint REFERENCES sucursal(id),   -- solo informativo
    creado_en           timestamptz NOT NULL DEFAULT now(),
    eliminado_en        timestamptz                       -- borrado logico (NOM-004)
);

CREATE TABLE cita (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    paciente_id    bigint NOT NULL REFERENCES paciente(id),
    trabajador_id  bigint NOT NULL REFERENCES trabajador(id),   -- doctor que atiende
    unidad_id      bigint NOT NULL REFERENCES unidad(id),
    inicio         timestamptz NOT NULL,
    fin            timestamptz NOT NULL,
    estado         text NOT NULL DEFAULT 'programada'
                   CHECK (estado IN ('programada','confirmada','en_atencion',
                                     'atendida','cancelada','no_asistio')),
    tipo           text,
    nota           text,
    creado_en      timestamptz NOT NULL DEFAULT now(),
    CHECK (fin > inicio),
    -- Un sillon no puede tener dos citas al mismo tiempo
    CONSTRAINT cita_sin_empalme_unidad EXCLUDE USING gist
        (unidad_id WITH =, tstzrange(inicio, fin) WITH &&)
        WHERE (estado NOT IN ('cancelada','no_asistio')),
    -- Un doctor tampoco puede estar en dos citas a la vez
    CONSTRAINT cita_sin_empalme_doctor EXCLUDE USING gist
        (trabajador_id WITH =, tstzrange(inicio, fin) WITH &&)
        WHERE (estado NOT IN ('cancelada','no_asistio'))
);
CREATE INDEX ix_cita_paciente ON cita (paciente_id);
CREATE INDEX ix_cita_inicio   ON cita (inicio);

-- Catalogo de hallazgos del odontograma (caries, obturacion, corona...)
CREATE TABLE catalogo_hallazgo (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo  text NOT NULL UNIQUE,
    nombre  text NOT NULL
);

-- Odontograma con historial: un registro por pieza + hallazgo + fecha.
-- No se edita el pasado: si algo se resuelve, se marca resuelto_en.
CREATE TABLE odontograma_hallazgo (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    paciente_id    bigint NOT NULL REFERENCES paciente(id),
    pieza          smallint NOT NULL CHECK (pieza BETWEEN 11 AND 85),   -- numeracion FDI
    superficie     text CHECK (superficie IN ('mesial','distal','oclusal',
                                              'vestibular','lingual','palatina')),
    hallazgo_id    bigint NOT NULL REFERENCES catalogo_hallazgo(id),
    estado         text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','resuelto')),
    registrado_en  timestamptz NOT NULL DEFAULT now(),
    resuelto_en    timestamptz,
    trabajador_id  bigint NOT NULL REFERENCES trabajador(id),
    cita_id        bigint REFERENCES cita(id),
    nota           text
);
CREATE INDEX ix_odonto_paciente ON odontograma_hallazgo (paciente_id, pieza);

-- Historial clinico: notas por consulta
CREATE TABLE nota_clinica (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    paciente_id    bigint NOT NULL REFERENCES paciente(id),
    cita_id        bigint REFERENCES cita(id),
    trabajador_id  bigint NOT NULL REFERENCES trabajador(id),
    fecha          timestamptz NOT NULL DEFAULT now(),
    nota           text NOT NULL
);
CREATE INDEX ix_nota_paciente ON nota_clinica (paciente_id, fecha);

-- ---------------------------------------------------------------------
-- 3. TRATAMIENTOS Y PRECIOS
-- ---------------------------------------------------------------------

CREATE TABLE tratamiento (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        text NOT NULL UNIQUE,
    precio_base   numeric(12,2) NOT NULL CHECK (precio_base >= 0),
    duracion_min  integer NOT NULL DEFAULT 30,
    activo        boolean NOT NULL DEFAULT true
);

-- Precio especial por sucursal (lo define el dueno). Si no hay renglon,
-- aplica precio_base. vigente_desde guarda el historial de cambios.
CREATE TABLE precio_sucursal (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tratamiento_id  bigint NOT NULL REFERENCES tratamiento(id),
    sucursal_id     bigint NOT NULL REFERENCES sucursal(id),
    precio          numeric(12,2) NOT NULL CHECK (precio >= 0),
    vigente_desde   date NOT NULL DEFAULT current_date,
    UNIQUE (tratamiento_id, sucursal_id, vigente_desde)
);

CREATE TABLE material (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre         text NOT NULL UNIQUE,
    unidad_medida  text NOT NULL            -- pieza, ml, caja...
);

-- Material que consume cada tratamiento
CREATE TABLE tratamiento_material (
    tratamiento_id  bigint NOT NULL REFERENCES tratamiento(id),
    material_id     bigint NOT NULL REFERENCES material(id),
    cantidad        numeric(12,3) NOT NULL CHECK (cantidad > 0),
    PRIMARY KEY (tratamiento_id, material_id)
);

-- ---------------------------------------------------------------------
-- 4. PRESUPUESTOS, PLAZOS Y PAGOS
-- ---------------------------------------------------------------------

CREATE TABLE presupuesto (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    paciente_id    bigint NOT NULL REFERENCES paciente(id),
    sucursal_id    bigint NOT NULL REFERENCES sucursal(id),   -- donde se vendio
    trabajador_id  bigint NOT NULL REFERENCES trabajador(id), -- a quien se le atribuye la venta
    estado         text NOT NULL DEFAULT 'borrador'
                   CHECK (estado IN ('borrador','presentado','aceptado','rechazado','cancelado')),
    nota           text,
    creado_en      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_presupuesto_paciente ON presupuesto (paciente_id);

-- Cada renglon guarda su PROPIO precio: si el catalogo cambia, no altera lo ya cotizado.
CREATE TABLE presupuesto_detalle (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    presupuesto_id   bigint NOT NULL REFERENCES presupuesto(id) ON DELETE CASCADE,
    tratamiento_id   bigint NOT NULL REFERENCES tratamiento(id),
    pieza_dental     smallint CHECK (pieza_dental BETWEEN 11 AND 85),   -- nulo si no aplica
    cantidad         integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario  numeric(12,2) NOT NULL CHECK (precio_unitario >= 0),
    descuento        numeric(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    estado           text NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','realizado','cancelado')),
    realizado_en     timestamptz,
    realizado_por    bigint REFERENCES trabajador(id)    -- desempeno del doctor que lo hizo
);
CREATE INDEX ix_detalle_presupuesto ON presupuesto_detalle (presupuesto_id);

-- Pago a plazos: calendario de cuotas de un presupuesto
CREATE TABLE cuota (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    presupuesto_id  bigint NOT NULL REFERENCES presupuesto(id) ON DELETE CASCADE,
    numero          integer NOT NULL CHECK (numero > 0),
    vence           date NOT NULL,
    monto           numeric(12,2) NOT NULL CHECK (monto > 0),
    UNIQUE (presupuesto_id, numero)
);

-- PAGO = dinero que entrega el paciente (como un deposito).
-- No depende de un presupuesto: puede ser una consulta suelta.
CREATE TABLE pago (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    paciente_id    bigint NOT NULL REFERENCES paciente(id),
    sucursal_id    bigint NOT NULL REFERENCES sucursal(id),
    monto          numeric(12,2) NOT NULL CHECK (monto > 0),
    metodo         text NOT NULL CHECK (metodo IN ('efectivo','tarjeta','transferencia','otro')),
    concepto       text,                     -- ej. 'Consulta de valoracion'
    cita_id        bigint REFERENCES cita(id),
    registrado_por bigint NOT NULL REFERENCES trabajador(id),
    pagado_en      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_pago_paciente ON pago (paciente_id);

-- PAGO_APLICACION = a que presupuesto (y cuota) se aplica el dinero.
-- Un pago puede repartirse en varios presupuestos, o no aplicarse a ninguno.
-- Regla a validar en la app: SUM(monto aplicado) <= pago.monto
CREATE TABLE pago_aplicacion (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pago_id         bigint NOT NULL REFERENCES pago(id),
    presupuesto_id  bigint NOT NULL REFERENCES presupuesto(id),
    cuota_id        bigint REFERENCES cuota(id),
    monto           numeric(12,2) NOT NULL CHECK (monto > 0)
);
CREATE INDEX ix_aplicacion_presupuesto ON pago_aplicacion (presupuesto_id);
CREATE INDEX ix_aplicacion_pago ON pago_aplicacion (pago_id);

-- ---------------------------------------------------------------------
-- 5. CAJA E INVENTARIO (libros de movimientos: solo se agregan renglones)
-- ---------------------------------------------------------------------

CREATE TABLE caja_movimiento (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sucursal_id    bigint NOT NULL REFERENCES sucursal(id),
    pago_id        bigint REFERENCES pago(id),       -- nulo en gastos o retiros
    tipo           text NOT NULL CHECK (tipo IN ('entrada','salida')),
    concepto       text NOT NULL,
    monto          numeric(12,2) NOT NULL CHECK (monto > 0),
    registrado_por bigint NOT NULL REFERENCES trabajador(id),
    registrado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_caja_sucursal_fecha ON caja_movimiento (sucursal_id, registrado_en);

-- Inventario por sucursal. Si el dueno pasa material de una sucursal a otra,
-- se registran dos movimientos: una 'salida' y una 'entrada' con motivo 'traslado'.
CREATE TABLE inventario_movimiento (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sucursal_id    bigint NOT NULL REFERENCES sucursal(id),
    material_id    bigint NOT NULL REFERENCES material(id),
    tipo           text NOT NULL CHECK (tipo IN ('entrada','salida')),
    motivo         text NOT NULL CHECK (motivo IN ('compra','consumo','traslado','ajuste','merma')),
    cantidad       numeric(12,3) NOT NULL CHECK (cantidad > 0),
    nota           text,
    registrado_por bigint NOT NULL REFERENCES trabajador(id),
    registrado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_inv_sucursal_material ON inventario_movimiento (sucursal_id, material_id);

-- ---------------------------------------------------------------------
-- 6. VISTAS Y FUNCIONES UTILES
-- ---------------------------------------------------------------------

-- Existencia actual de cada material por sucursal (entradas - salidas)
CREATE VIEW v_existencia AS
SELECT sucursal_id,
       material_id,
       SUM(CASE tipo WHEN 'entrada' THEN cantidad ELSE -cantidad END) AS existencia
FROM inventario_movimiento
GROUP BY sucursal_id, material_id;

-- Saldo de cada presupuesto: total - lo pagado
CREATE VIEW v_saldo_presupuesto AS
SELECT p.id AS presupuesto_id,
       p.paciente_id,
       COALESCE(d.total, 0)                     AS total,
       COALESCE(a.pagado, 0)                    AS pagado,
       COALESCE(d.total, 0) - COALESCE(a.pagado, 0) AS saldo
FROM presupuesto p
LEFT JOIN (SELECT presupuesto_id, SUM(cantidad * precio_unitario - descuento) AS total
           FROM presupuesto_detalle
           WHERE estado <> 'cancelado'
           GROUP BY presupuesto_id) d ON d.presupuesto_id = p.id
LEFT JOIN (SELECT presupuesto_id, SUM(monto) AS pagado
           FROM pago_aplicacion
           GROUP BY presupuesto_id) a ON a.presupuesto_id = p.id;

-- Precio vigente de un tratamiento en una sucursal (usa el especial si existe)
CREATE FUNCTION precio_vigente(p_tratamiento bigint, p_sucursal bigint,
                               p_fecha date DEFAULT current_date)
RETURNS numeric
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT ps.precio
           FROM precio_sucursal ps
          WHERE ps.tratamiento_id = p_tratamiento
            AND ps.sucursal_id    = p_sucursal
            AND ps.vigente_desde <= p_fecha
          ORDER BY ps.vigente_desde DESC
          LIMIT 1),
        (SELECT t.precio_base FROM tratamiento t WHERE t.id = p_tratamiento)
    );
$$;

-- ---------------------------------------------------------------------
-- 7. DATOS INICIALES
-- ---------------------------------------------------------------------

INSERT INTO rol (nombre) VALUES
  ('dueno'), ('gerente'), ('recepcion'), ('doctor'), ('caja'), ('almacen');

INSERT INTO catalogo_hallazgo (codigo, nombre) VALUES
  ('CARIES',     'Caries'),
  ('OBTURACION', 'Obturacion'),
  ('CORONA',     'Corona'),
  ('ENDODONCIA', 'Endodoncia'),
  ('AUSENTE',    'Pieza ausente'),
  ('EXTRACCION', 'Extraccion indicada');
