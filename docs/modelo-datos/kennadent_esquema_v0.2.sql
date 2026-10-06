-- =====================================================================
-- KennaDent - Esquema PostgreSQL v0.2 (PROPUESTA)
-- Sustituye a kennadent_esquema.sql (v0.1). Ver INFORME_VALIDACION.md.
--
-- Cambios de fondo respecto a v0.1:
--   1. Multiempresa: cada negocio cliente es una EMPRESA. Todas las tablas
--      de datos llevan empresa_id y las llaves foraneas son compuestas
--      (empresa_id, id) para que la base RECHACE mezclar datos de dos
--      empresas. Ademas, Row Level Security (RLS) filtra por empresa.
--   2. Consulta y plan de tratamiento como entidades propias (el frontend
--      ya las usa: KD.db.consultas y KD.db.planes).
--   3. Reglas que v0.1 dejaba "a la app" pasan a la base: cuota del mismo
--      presupuesto, pago y presupuesto del mismo paciente, doctor asignado
--      a la sucursal de la cita, no aplicar mas dinero del que tiene un
--      pago, traslados enlazados, caja cerrada, piezas FDI validas.
--
-- Probado en PostgreSQL 16.15 (ver pruebas/).
-- Para empezar de cero: DROP SCHEMA kennadent CASCADE;
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- citas sin empalme por sillon

CREATE SCHEMA IF NOT EXISTS kennadent;
SET search_path = kennadent, public;

-- ---------------------------------------------------------------------
-- 0. FUNCIONES DE VALIDACION
-- ---------------------------------------------------------------------

-- Pieza dental FDI valida: permanentes 11-18, 21-28, 31-38, 41-48;
-- temporales 51-55, 61-65, 71-75, 81-85. (v0.1 aceptaba 11..85 completo,
-- es decir, tambien 19, 20, 30, 49, 56, 60...)
CREATE FUNCTION es_pieza_fdi(p smallint) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
    SELECT (p / 10 BETWEEN 1 AND 4 AND p % 10 BETWEEN 1 AND 8)
        OR (p / 10 BETWEEN 5 AND 8 AND p % 10 BETWEEN 1 AND 5)
$$;

CREATE FUNCTION son_piezas_fdi(a smallint[]) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(bool_and(kennadent.es_pieza_fdi(x)), true) FROM unnest(a) AS x
$$;

-- ---------------------------------------------------------------------
-- 1. PLATAFORMA (catalogos comunes a todas las empresas, sin empresa_id)
-- ---------------------------------------------------------------------

-- Puestos y permisos los define KennaDent (js/roles.js). Cada empresa
-- no inventa puestos; si ajusta permisos persona por persona.
CREATE TABLE puesto (
    id               text PRIMARY KEY,          -- 'odontologo', 'recepcion'...
    nombre           text NOT NULL,
    atiende          boolean NOT NULL DEFAULT false,  -- puede tener citas a su nombre
    requiere_cedula  boolean NOT NULL DEFAULT false,
    lleva_titulo     boolean NOT NULL DEFAULT false   -- DR. / DRA.
);

CREATE TABLE permiso (
    id      text PRIMARY KEY,                   -- 'dinero', 'agenda_todas'...
    nombre  text NOT NULL,
    grupo   text NOT NULL
);

-- Permisos sugeridos de cada puesto (plantilla al dar de alta a alguien)
CREATE TABLE puesto_permiso (
    puesto_id   text NOT NULL REFERENCES puesto(id),
    permiso_id  text NOT NULL REFERENCES permiso(id),
    PRIMARY KEY (puesto_id, permiso_id)
);

-- Hallazgos del odontograma (js/odonto.js). color: rojo = por tratar,
-- azul = realizado/existente. ambito: se marca en una cara o en el diente.
CREATE TABLE catalogo_hallazgo (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo  text NOT NULL UNIQUE,
    nombre  text NOT NULL,
    ambito  text NOT NULL CHECK (ambito IN ('cara','diente')),
    color   text NOT NULL CHECK (color IN ('rojo','azul'))
);

-- ---------------------------------------------------------------------
-- 2. EMPRESA, SUCURSALES Y PERSONAL
-- ---------------------------------------------------------------------

CREATE TABLE empresa (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_comercial  text NOT NULL,
    razon_social      text,
    rfc               text,
    telefono          text,
    correo            text,
    activo            boolean NOT NULL DEFAULT true,   -- suscripcion vigente
    creado_en         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sucursal (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id    bigint NOT NULL REFERENCES empresa(id),
    nombre        text NOT NULL,
    direccion     text,
    telefono      text,
    -- Define que es "hoy" para la caja y la agenda de ESA sucursal.
    zona_horaria  text NOT NULL DEFAULT 'America/Mexico_City',
    activo        boolean NOT NULL DEFAULT true,
    UNIQUE (empresa_id, nombre),
    UNIQUE (empresa_id, id)
);

-- Horario de atencion (para medir ocupacion de la agenda)
CREATE TABLE sucursal_horario (
    empresa_id   bigint NOT NULL,
    sucursal_id  bigint NOT NULL,
    dia_semana   smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),  -- 1 = lunes
    abre         time NOT NULL,
    cierra       time NOT NULL CHECK (cierra > abre),
    PRIMARY KEY (sucursal_id, dia_semana, abre),
    FOREIGN KEY (empresa_id, sucursal_id) REFERENCES sucursal(empresa_id, id)
);

-- Unidad = sillon dental. La agenda cuelga de la unidad.
CREATE TABLE unidad (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id   bigint NOT NULL,
    sucursal_id  bigint NOT NULL,
    nombre       text NOT NULL,
    activo       boolean NOT NULL DEFAULT true,
    UNIQUE (sucursal_id, nombre),
    UNIQUE (empresa_id, sucursal_id, id),
    FOREIGN KEY (empresa_id, sucursal_id) REFERENCES sucursal(empresa_id, id)
);

CREATE TABLE trabajador (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id     bigint NOT NULL REFERENCES empresa(id),
    puesto_id      text NOT NULL REFERENCES puesto(id),   -- UN solo puesto
    nombre         text NOT NULL,                          -- en MAYUSCULAS
    sexo           char(1) CHECK (sexo IN ('F','M')),
    lleva_titulo   boolean NOT NULL DEFAULT false,         -- DR. / DRA.
    especialidad   text,
    cedula         text,
    telefono       text,
    correo         text,
    color_agenda   text,
    -- Inicio de sesion: lo maneja Django (auth_user) o Supabase (auth.users).
    -- Aqui solo se enlaza; la contrasena NO vive en esta tabla.
    auth_user_id   bigint UNIQUE,
    activo         boolean NOT NULL DEFAULT true,
    alta_en        date NOT NULL DEFAULT current_date,
    baja_en        date,
    baja_motivo    text,
    UNIQUE (empresa_id, id),
    CHECK (activo OR baja_en IS NOT NULL)
);

-- Permisos EFECTIVOS de cada persona (se copian del puesto y luego el
-- administrador los ajusta: js/views/personal.js)
CREATE TABLE trabajador_permiso (
    empresa_id     bigint NOT NULL,
    trabajador_id  bigint NOT NULL,
    permiso_id     text NOT NULL REFERENCES permiso(id),
    PRIMARY KEY (trabajador_id, permiso_id),
    FOREIGN KEY (empresa_id, trabajador_id) REFERENCES trabajador(empresa_id, id)
);

-- En que sucursales trabaja o puede cubrir cada persona.
CREATE TABLE trabajador_sucursal (
    empresa_id     bigint NOT NULL,
    trabajador_id  bigint NOT NULL,
    sucursal_id    bigint NOT NULL,
    es_base        boolean NOT NULL DEFAULT false,
    activo         boolean NOT NULL DEFAULT true,  -- no se borra: lo usan citas pasadas
    PRIMARY KEY (trabajador_id, sucursal_id),
    UNIQUE (empresa_id, trabajador_id, sucursal_id),
    FOREIGN KEY (empresa_id, trabajador_id) REFERENCES trabajador(empresa_id, id),
    FOREIGN KEY (empresa_id, sucursal_id)   REFERENCES sucursal(empresa_id, id)
);
CREATE UNIQUE INDEX ux_trabajador_una_base ON trabajador_sucursal (trabajador_id) WHERE es_base;

-- ---------------------------------------------------------------------
-- 3. CATALOGOS DE CADA EMPRESA
-- ---------------------------------------------------------------------

CREATE TABLE tratamiento (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id    bigint NOT NULL REFERENCES empresa(id),
    nombre        text NOT NULL,
    categoria     text NOT NULL DEFAULT 'Otro',   -- reportes "ventas por categoria"
    precio_base   numeric(12,2) NOT NULL CHECK (precio_base >= 0),
    duracion_min  integer NOT NULL DEFAULT 30 CHECK (duracion_min > 0),
    activo        boolean NOT NULL DEFAULT true,
    UNIQUE (empresa_id, nombre),                  -- v0.1: UNIQUE (nombre) global
    UNIQUE (empresa_id, id)
);

CREATE TABLE precio_sucursal (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint NOT NULL,
    tratamiento_id  bigint NOT NULL,
    sucursal_id     bigint NOT NULL,
    precio          numeric(12,2) NOT NULL CHECK (precio >= 0),
    vigente_desde   date NOT NULL DEFAULT current_date,
    UNIQUE (tratamiento_id, sucursal_id, vigente_desde),
    FOREIGN KEY (empresa_id, tratamiento_id) REFERENCES tratamiento(empresa_id, id),
    FOREIGN KEY (empresa_id, sucursal_id)    REFERENCES sucursal(empresa_id, id)
);

-- Tipos de cita (js/views/empresa.js): duracion y si pide tratamiento/piezas
CREATE TABLE tipo_cita (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id        bigint NOT NULL REFERENCES empresa(id),
    nombre            text NOT NULL,
    duracion_min      integer NOT NULL DEFAULT 30 CHECK (duracion_min > 0),
    pide_tratamiento  boolean NOT NULL DEFAULT false,
    es_diagnostico    boolean NOT NULL DEFAULT false,
    activo            boolean NOT NULL DEFAULT true,
    UNIQUE (empresa_id, nombre),
    UNIQUE (empresa_id, id)
);

CREATE TABLE material (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id        bigint NOT NULL REFERENCES empresa(id),
    nombre            text NOT NULL,
    categoria         text,
    unidad_medida     text NOT NULL,
    costo             numeric(12,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),
    proveedor         text,
    -- Lo que gasta CUALQUIER cita atendida (guantes, cubrebocas):
    -- en el frontend es la constante CONSUMO_BASE de js/data.js
    consumo_por_cita  numeric(12,3) NOT NULL DEFAULT 0 CHECK (consumo_por_cita >= 0),
    activo            boolean NOT NULL DEFAULT true,
    UNIQUE (empresa_id, nombre),
    UNIQUE (empresa_id, id)
);

-- Minimo por sucursal (alertas de stock bajo y critico)
CREATE TABLE material_sucursal (
    empresa_id   bigint NOT NULL,
    material_id  bigint NOT NULL,
    sucursal_id  bigint NOT NULL,
    minimo       numeric(12,3) NOT NULL DEFAULT 0 CHECK (minimo >= 0),
    PRIMARY KEY (material_id, sucursal_id),
    FOREIGN KEY (empresa_id, material_id) REFERENCES material(empresa_id, id),
    FOREIGN KEY (empresa_id, sucursal_id) REFERENCES sucursal(empresa_id, id)
);

CREATE TABLE tratamiento_material (
    empresa_id      bigint NOT NULL,
    tratamiento_id  bigint NOT NULL,
    material_id     bigint NOT NULL,
    cantidad        numeric(12,3) NOT NULL CHECK (cantidad > 0),   -- por pieza
    PRIMARY KEY (tratamiento_id, material_id),
    FOREIGN KEY (empresa_id, tratamiento_id) REFERENCES tratamiento(empresa_id, id),
    FOREIGN KEY (empresa_id, material_id)    REFERENCES material(empresa_id, id)
);

-- ---------------------------------------------------------------------
-- 4. PACIENTES Y AGENDA
-- ---------------------------------------------------------------------

-- Paciente de la EMPRESA: lo comparten sus sucursales, no otras empresas.
CREATE TABLE paciente (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          bigint NOT NULL REFERENCES empresa(id),
    expediente          text NOT NULL,              -- 'KD-00001'
    nombre              text NOT NULL,
    apellidos           text NOT NULL,
    sexo                char(1) CHECK (sexo IN ('F','M')),
    fecha_nacimiento    date,                       -- define la denticion
    telefono            text,
    correo              text,
    sucursal_origen_id  bigint,
    activo              boolean NOT NULL DEFAULT true,
    baja_en             date,
    baja_motivo         text,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    creado_por          bigint,
    UNIQUE (empresa_id, expediente),
    UNIQUE (empresa_id, id),
    FOREIGN KEY (empresa_id, sucursal_origen_id) REFERENCES sucursal(empresa_id, id),
    FOREIGN KEY (empresa_id, creado_por)         REFERENCES trabajador(empresa_id, id)
);
CREATE INDEX ix_paciente_nombre ON paciente (empresa_id, apellidos, nombre);

-- Datos clinicos generales, separados de los datos de contacto: recepcion
-- puede leer la alerta de alergias pero no editarla, y el acceso se puede
-- restringir y auditar aparte (LFPDPPP: datos sensibles).
CREATE TABLE paciente_clinico (
    empresa_id       bigint NOT NULL,
    paciente_id      bigint PRIMARY KEY,
    alergias         text,
    antecedentes     text,
    completado       boolean NOT NULL DEFAULT false,  -- false = aviso al doctor
    actualizado_en   timestamptz NOT NULL DEFAULT now(),
    actualizado_por  bigint,
    FOREIGN KEY (empresa_id, paciente_id)     REFERENCES paciente(empresa_id, id),
    FOREIGN KEY (empresa_id, actualizado_por) REFERENCES trabajador(empresa_id, id)
);

CREATE TABLE cita (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint NOT NULL,
    sucursal_id     bigint NOT NULL,
    unidad_id       bigint NOT NULL,
    paciente_id     bigint NOT NULL,
    trabajador_id   bigint NOT NULL,     -- doctor que atiende
    tipo_cita_id    bigint,
    tratamiento_id  bigint,              -- lo que se le va a hacer (si el tipo lo pide)
    piezas          smallint[] CHECK (son_piezas_fdi(piezas)),
    plan_item_id    bigint,              -- si viene del plan del paciente
    inicio          timestamptz NOT NULL,
    fin             timestamptz NOT NULL,
    estado          text NOT NULL DEFAULT 'programada'
                    CHECK (estado IN ('programada','confirmada','en_sala',
                                      'atendida','no_asistio','cancelada')),
    nota            text,
    creado_por      bigint,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    CHECK (fin > inicio),
    UNIQUE (empresa_id, id),
    UNIQUE (empresa_id, id, paciente_id, trabajador_id, sucursal_id),
    -- El sillon pertenece a la sucursal de la cita
    FOREIGN KEY (empresa_id, sucursal_id, unidad_id) REFERENCES unidad(empresa_id, sucursal_id, id),
    -- El doctor esta asignado a esa sucursal (corrige T10 de v0.1)
    FOREIGN KEY (empresa_id, trabajador_id, sucursal_id)
        REFERENCES trabajador_sucursal(empresa_id, trabajador_id, sucursal_id),
    FOREIGN KEY (empresa_id, paciente_id)    REFERENCES paciente(empresa_id, id),
    FOREIGN KEY (empresa_id, tipo_cita_id)   REFERENCES tipo_cita(empresa_id, id),
    FOREIGN KEY (empresa_id, tratamiento_id) REFERENCES tratamiento(empresa_id, id),
    FOREIGN KEY (empresa_id, creado_por)     REFERENCES trabajador(empresa_id, id),
    -- Un sillon no puede tener dos citas a la vez.
    -- (El empalme del DOCTOR no se prohibe: el frontend solo avisa y deja
    --  agendar de todos modos. Ver v_cita_doctor_empalmada.)
    CONSTRAINT cita_sin_empalme_unidad EXCLUDE USING gist
        (unidad_id WITH =, tstzrange(inicio, fin) WITH &&)
        WHERE (estado NOT IN ('cancelada','no_asistio'))
);
CREATE INDEX ix_cita_paciente ON cita (paciente_id);
CREATE INDEX ix_cita_sucursal_inicio ON cita (sucursal_id, inicio);
CREATE INDEX ix_cita_doctor_inicio ON cita (trabajador_id, inicio);

-- ---------------------------------------------------------------------
-- 5. HISTORIAL CLINICO: CONSULTA, PLAN Y ODONTOGRAMA
-- ---------------------------------------------------------------------

-- Registro de consulta (js/views/expediente.js): una por cita, la hace el
-- doctor de esa cita. Las llaves compuestas obligan a que paciente,
-- doctor y sucursal sean los mismos de la cita.
CREATE TABLE consulta (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id     bigint NOT NULL,
    cita_id        bigint NOT NULL UNIQUE,
    paciente_id    bigint NOT NULL,
    trabajador_id  bigint NOT NULL,
    sucursal_id    bigint NOT NULL,
    registrado_en  timestamptz NOT NULL DEFAULT now(),
    motivo         text,
    diagnostico    text,
    notas          text,
    UNIQUE (empresa_id, id),
    UNIQUE (empresa_id, id, paciente_id),
    FOREIGN KEY (empresa_id, cita_id, paciente_id, trabajador_id, sucursal_id)
        REFERENCES cita(empresa_id, id, paciente_id, trabajador_id, sucursal_id)
);
CREATE INDEX ix_consulta_paciente ON consulta (paciente_id, registrado_en);
CREATE INDEX ix_consulta_doctor ON consulta (trabajador_id, registrado_en);

CREATE TABLE presupuesto (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id     bigint NOT NULL,
    folio          text NOT NULL,                -- 'P-00001'
    paciente_id    bigint NOT NULL,
    sucursal_id    bigint NOT NULL,              -- donde se vendio
    trabajador_id  bigint NOT NULL,              -- a quien se atribuye la venta
    estado         text NOT NULL DEFAULT 'borrador'
                   CHECK (estado IN ('borrador','enviado','aceptado','rechazado')),
    -- "en tratamiento" y "completado" NO se guardan: se calculan del avance
    -- de sus renglones (igual que KD.estadoPresupuesto). Ver v_presupuesto.
    descuento_pct  numeric(5,2) NOT NULL DEFAULT 0 CHECK (descuento_pct BETWEEN 0 AND 100),
    forma_pago     text NOT NULL DEFAULT 'contado' CHECK (forma_pago IN ('contado','mensualidades')),
    num_pagos      integer NOT NULL DEFAULT 1 CHECK (num_pagos > 0),
    nota           text,
    creado_en      timestamptz NOT NULL DEFAULT now(),
    estado_en      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, folio),
    UNIQUE (empresa_id, id),
    UNIQUE (empresa_id, id, paciente_id),
    FOREIGN KEY (empresa_id, paciente_id)   REFERENCES paciente(empresa_id, id),
    FOREIGN KEY (empresa_id, sucursal_id)   REFERENCES sucursal(empresa_id, id),
    FOREIGN KEY (empresa_id, trabajador_id) REFERENCES trabajador(empresa_id, id),
    CHECK (forma_pago = 'mensualidades' OR num_pagos = 1)
);
CREATE INDEX ix_presupuesto_paciente ON presupuesto (paciente_id);

-- Plan de tratamiento = lo que el doctor recomienda (KD.db.planes).
-- Existe aunque todavia no haya presupuesto. Sustituye a presupuesto_detalle.
-- Guarda su PROPIO precio (D5 de v0.1 se conserva).
CREATE TABLE plan_item (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          bigint NOT NULL,
    paciente_id         bigint NOT NULL,
    tratamiento_id      bigint NOT NULL,
    piezas              smallint[] CHECK (son_piezas_fdi(piezas)),
    cantidad            integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario     numeric(12,2) NOT NULL CHECK (precio_unitario >= 0),
    estado              text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','aceptado','realizado','rechazado')),
    estado_en           timestamptz NOT NULL DEFAULT now(),
    diagnosticado_por   bigint NOT NULL,          -- desempeno: "presupuestado" por doctor
    sucursal_id         bigint NOT NULL,
    consulta_origen_id  bigint,                   -- consulta donde se recomendo
    presupuesto_id      bigint,                   -- nulo = aun sin presupuesto
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, id, paciente_id),
    FOREIGN KEY (empresa_id, paciente_id)       REFERENCES paciente(empresa_id, id),
    FOREIGN KEY (empresa_id, tratamiento_id)    REFERENCES tratamiento(empresa_id, id),
    FOREIGN KEY (empresa_id, diagnosticado_por) REFERENCES trabajador(empresa_id, id),
    FOREIGN KEY (empresa_id, sucursal_id)       REFERENCES sucursal(empresa_id, id),
    -- mismo paciente que la consulta y que el presupuesto
    FOREIGN KEY (empresa_id, consulta_origen_id, paciente_id) REFERENCES consulta(empresa_id, id, paciente_id),
    FOREIGN KEY (empresa_id, presupuesto_id, paciente_id)     REFERENCES presupuesto(empresa_id, id, paciente_id)
);
CREATE INDEX ix_plan_paciente ON plan_item (paciente_id);
CREATE INDEX ix_plan_presupuesto ON plan_item (presupuesto_id);

-- La cita puede venir de un renglon del plan del mismo paciente
ALTER TABLE cita ADD FOREIGN KEY (empresa_id, plan_item_id, paciente_id)
    REFERENCES plan_item(empresa_id, id, paciente_id);

-- Lo que el doctor REALMENTE hizo en la consulta y su precio.
-- Es la base de "ventas", "ingresos por doctor" y "por categoria" en
-- js/metricas.js. Incluye lo que no venia en ningun presupuesto
-- (valoracion, limpieza, urgencia).
CREATE TABLE consulta_procedimiento (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint NOT NULL,
    consulta_id     bigint NOT NULL,
    paciente_id     bigint NOT NULL,
    tratamiento_id  bigint NOT NULL,
    piezas          smallint[] CHECK (son_piezas_fdi(piezas)),
    cantidad        integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio          numeric(12,2) NOT NULL CHECK (precio >= 0),   -- total del renglon
    plan_item_id    bigint,
    UNIQUE (empresa_id, id),
    FOREIGN KEY (empresa_id, consulta_id, paciente_id)  REFERENCES consulta(empresa_id, id, paciente_id),
    FOREIGN KEY (empresa_id, plan_item_id, paciente_id) REFERENCES plan_item(empresa_id, id, paciente_id),
    FOREIGN KEY (empresa_id, tratamiento_id)            REFERENCES tratamiento(empresa_id, id)
);
CREATE INDEX ix_proc_consulta ON consulta_procedimiento (consulta_id);
CREATE UNIQUE INDEX ux_proc_plan_una_vez ON consulta_procedimiento (plan_item_id) WHERE plan_item_id IS NOT NULL;

-- Odontograma con historial: un renglon por pieza + (cara) + hallazgo.
-- Lo rojo que se resuelve se marca resuelto_en y se agrega el azul nuevo.
CREATE TABLE odontograma_hallazgo (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id     bigint NOT NULL,
    paciente_id    bigint NOT NULL,
    pieza          smallint NOT NULL CHECK (es_pieza_fdi(pieza)),
    -- 5 caras como en el frontend: Vestibular, Lingual/palatina, Mesial,
    -- Distal, Oclusal/incisal. Nulo = hallazgo del diente completo.
    cara           char(1) CHECK (cara IN ('V','L','M','D','O')),
    hallazgo_id    bigint NOT NULL REFERENCES catalogo_hallazgo(id),
    registrado_en  timestamptz NOT NULL DEFAULT now(),
    resuelto_en    timestamptz,
    trabajador_id  bigint NOT NULL,
    consulta_id    bigint,
    nota           text,
    CHECK (resuelto_en IS NULL OR resuelto_en >= registrado_en),
    FOREIGN KEY (empresa_id, paciente_id)              REFERENCES paciente(empresa_id, id),
    FOREIGN KEY (empresa_id, trabajador_id)            REFERENCES trabajador(empresa_id, id),
    FOREIGN KEY (empresa_id, consulta_id, paciente_id) REFERENCES consulta(empresa_id, id, paciente_id)
);
CREATE INDEX ix_odonto_paciente ON odontograma_hallazgo (paciente_id, pieza);

-- ---------------------------------------------------------------------
-- 6. PAGOS
-- ---------------------------------------------------------------------

CREATE TABLE cuota (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint NOT NULL,
    presupuesto_id  bigint NOT NULL,
    numero          integer NOT NULL CHECK (numero > 0),
    vence           date NOT NULL,
    monto           numeric(12,2) NOT NULL CHECK (monto > 0),
    UNIQUE (presupuesto_id, numero),
    UNIQUE (empresa_id, id, presupuesto_id),
    FOREIGN KEY (empresa_id, presupuesto_id) REFERENCES presupuesto(empresa_id, id)
);

-- PAGO = dinero que entrega el paciente (como un deposito). No se edita
-- ni se borra: una correccion es un pago nuevo que lo revierte.
CREATE TABLE pago (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id     bigint NOT NULL,
    paciente_id    bigint NOT NULL,
    sucursal_id    bigint NOT NULL,          -- donde entro el dinero (caja)
    monto          numeric(12,2) NOT NULL CHECK (monto > 0),
    metodo         text NOT NULL CHECK (metodo IN ('efectivo','tarjeta','transferencia','otro')),
    concepto       text,
    cita_id        bigint,
    registrado_por bigint NOT NULL,
    registrado_en  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, id, paciente_id),
    FOREIGN KEY (empresa_id, paciente_id)    REFERENCES paciente(empresa_id, id),
    FOREIGN KEY (empresa_id, sucursal_id)    REFERENCES sucursal(empresa_id, id),
    FOREIGN KEY (empresa_id, cita_id)        REFERENCES cita(empresa_id, id),
    FOREIGN KEY (empresa_id, registrado_por) REFERENCES trabajador(empresa_id, id)
);
CREATE INDEX ix_pago_paciente ON pago (paciente_id);
CREATE INDEX ix_pago_sucursal_fecha ON pago (sucursal_id, registrado_en);

-- A que se aplica el dinero: a un presupuesto (y opcionalmente a una de
-- sus cuotas) O a una consulta suelta. Siempre del MISMO paciente.
CREATE TABLE pago_aplicacion (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint NOT NULL,
    pago_id         bigint NOT NULL,
    paciente_id     bigint NOT NULL,
    presupuesto_id  bigint,
    cuota_id        bigint,
    consulta_id     bigint,
    monto           numeric(12,2) NOT NULL CHECK (monto > 0),
    CHECK (num_nonnulls(presupuesto_id, consulta_id) = 1),
    CHECK (cuota_id IS NULL OR presupuesto_id IS NOT NULL),
    FOREIGN KEY (empresa_id, pago_id, paciente_id)        REFERENCES pago(empresa_id, id, paciente_id),
    FOREIGN KEY (empresa_id, presupuesto_id, paciente_id) REFERENCES presupuesto(empresa_id, id, paciente_id),
    FOREIGN KEY (empresa_id, consulta_id, paciente_id)    REFERENCES consulta(empresa_id, id, paciente_id),
    -- la cuota pertenece a ESE presupuesto (corrige hipotesis 6.1 de v0.1)
    FOREIGN KEY (empresa_id, cuota_id, presupuesto_id)    REFERENCES cuota(empresa_id, id, presupuesto_id)
);
CREATE INDEX ix_aplicacion_pago ON pago_aplicacion (pago_id);
CREATE INDEX ix_aplicacion_presupuesto ON pago_aplicacion (presupuesto_id);
CREATE INDEX ix_aplicacion_consulta ON pago_aplicacion (consulta_id);

-- No se puede aplicar mas dinero del que trae el pago (corrige T9).
-- El candado (advisory lock) por pago hace que dos cajeros simultaneos
-- no lo "gasten" dos veces: el segundo espera a que el primero termine.
-- (No se usa SELECT ... FOR UPDATE porque exige permiso UPDATE sobre
-- pago, y la aplicacion no lo tiene: pago es de solo-agregar.)
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
            NEW.pago_id, v_monto, v_aplicado, NEW.monto;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER aplicacion_no_excede BEFORE INSERT OR UPDATE ON pago_aplicacion
    FOR EACH ROW EXECUTE FUNCTION tg_aplicacion_no_excede();

-- ---------------------------------------------------------------------
-- 7. CAJA
-- ---------------------------------------------------------------------

-- Movimientos de caja que NO son pagos de pacientes (gastos, otros
-- ingresos, retiros). Los pagos ya son un libro: no se copian aqui, asi
-- no hay dos montos que puedan no cuadrar. La caja del dia = v_caja.
CREATE TABLE caja_movimiento (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id     bigint NOT NULL,
    sucursal_id    bigint NOT NULL,
    tipo           text NOT NULL CHECK (tipo IN ('ingreso','egreso')),
    concepto       text NOT NULL,
    monto          numeric(12,2) NOT NULL CHECK (monto > 0),
    metodo         text NOT NULL CHECK (metodo IN ('efectivo','tarjeta','transferencia','otro')),
    registrado_por bigint NOT NULL,
    registrado_en  timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (empresa_id, sucursal_id)    REFERENCES sucursal(empresa_id, id),
    FOREIGN KEY (empresa_id, registrado_por) REFERENCES trabajador(empresa_id, id)
);
CREATE INDEX ix_caja_sucursal_fecha ON caja_movimiento (sucursal_id, registrado_en);

-- Corte diario (js/views/caja.js). Es un documento cerrado: guardar el
-- "esperado" calculado en ese momento es correcto (es una foto oficial).
CREATE TABLE corte_caja (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id         bigint NOT NULL,
    sucursal_id        bigint NOT NULL,
    fecha              date NOT NULL,                 -- dia local de la sucursal
    fondo              numeric(12,2) NOT NULL CHECK (fondo >= 0),
    efectivo_esperado  numeric(12,2) NOT NULL,
    efectivo_contado   numeric(12,2) NOT NULL CHECK (efectivo_contado >= 0),
    diferencia         numeric(12,2) GENERATED ALWAYS AS (efectivo_contado - efectivo_esperado) STORED,
    notas              text,
    cerrado_por        bigint NOT NULL,
    cerrado_en         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (sucursal_id, fecha),
    FOREIGN KEY (empresa_id, sucursal_id) REFERENCES sucursal(empresa_id, id),
    FOREIGN KEY (empresa_id, cerrado_por) REFERENCES trabajador(empresa_id, id)
);

-- Con el corte hecho, ese dia ya no admite pagos ni movimientos.
CREATE FUNCTION tg_caja_abierta() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_dia date;
BEGIN
    SELECT (NEW.registrado_en AT TIME ZONE s.zona_horaria)::date INTO v_dia
      FROM sucursal s WHERE s.id = NEW.sucursal_id;
    IF EXISTS (SELECT 1 FROM corte_caja c WHERE c.sucursal_id = NEW.sucursal_id AND c.fecha = v_dia) THEN
        RAISE EXCEPTION 'La caja de la sucursal % ya se cerro el %', NEW.sucursal_id, v_dia;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER pago_caja_abierta BEFORE INSERT ON pago
    FOR EACH ROW EXECUTE FUNCTION tg_caja_abierta();
CREATE TRIGGER mov_caja_abierta BEFORE INSERT ON caja_movimiento
    FOR EACH ROW EXECUTE FUNCTION tg_caja_abierta();

-- ---------------------------------------------------------------------
-- 8. INVENTARIO
-- ---------------------------------------------------------------------

-- Un traslado es UN documento con origen y destino; sus dos movimientos
-- apuntan a el (corrige D8: ya se puede reconciliar).
CREATE TABLE inventario_traslado (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint NOT NULL,
    material_id     bigint NOT NULL,
    origen_id       bigint NOT NULL,
    destino_id      bigint NOT NULL,
    cantidad        numeric(12,3) NOT NULL CHECK (cantidad > 0),
    nota            text,
    registrado_por  bigint NOT NULL,
    registrado_en   timestamptz NOT NULL DEFAULT now(),
    CHECK (origen_id <> destino_id),
    UNIQUE (empresa_id, id),
    FOREIGN KEY (empresa_id, material_id)    REFERENCES material(empresa_id, id),
    FOREIGN KEY (empresa_id, origen_id)      REFERENCES sucursal(empresa_id, id),
    FOREIGN KEY (empresa_id, destino_id)     REFERENCES sucursal(empresa_id, id),
    FOREIGN KEY (empresa_id, registrado_por) REFERENCES trabajador(empresa_id, id)
);

CREATE TABLE inventario_movimiento (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint NOT NULL,
    sucursal_id     bigint NOT NULL,
    material_id     bigint NOT NULL,
    tipo            text NOT NULL CHECK (tipo IN ('entrada','salida')),
    motivo          text NOT NULL CHECK (motivo IN ('compra','consumo','entrega','traslado','ajuste','merma')),
    cantidad        numeric(12,3) NOT NULL CHECK (cantidad > 0),
    nota            text,
    consulta_id     bigint,      -- consumo generado al registrar una consulta
    traslado_id     bigint,
    registrado_por  bigint NOT NULL,
    registrado_en   timestamptz NOT NULL DEFAULT now(),
    CHECK ((motivo = 'traslado') = (traslado_id IS NOT NULL)),
    FOREIGN KEY (empresa_id, sucursal_id)    REFERENCES sucursal(empresa_id, id),
    FOREIGN KEY (empresa_id, material_id)    REFERENCES material(empresa_id, id),
    FOREIGN KEY (empresa_id, consulta_id)    REFERENCES consulta(empresa_id, id),
    FOREIGN KEY (empresa_id, traslado_id)    REFERENCES inventario_traslado(empresa_id, id),
    FOREIGN KEY (empresa_id, registrado_por) REFERENCES trabajador(empresa_id, id)
);
CREATE INDEX ix_inv_sucursal_material ON inventario_movimiento (sucursal_id, material_id);
-- Un traslado no puede tener dos salidas ni dos entradas
CREATE UNIQUE INDEX ux_inv_traslado_tipo ON inventario_movimiento (traslado_id, tipo) WHERE traslado_id IS NOT NULL;

-- Registra el traslado y sus dos movimientos en una sola operacion
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
            p_origen, v_hay, p_cantidad;
    END IF;
    INSERT INTO inventario_traslado (empresa_id, material_id, origen_id, destino_id, cantidad, nota, registrado_por)
    VALUES (p_empresa, p_material, p_origen, p_destino, p_cantidad, p_nota, p_por) RETURNING id INTO v_id;
    INSERT INTO inventario_movimiento (empresa_id, sucursal_id, material_id, tipo, motivo, cantidad, traslado_id, registrado_por)
    VALUES (p_empresa, p_origen,  p_material, 'salida',  'traslado', p_cantidad, v_id, p_por),
           (p_empresa, p_destino, p_material, 'entrada', 'traslado', p_cantidad, v_id, p_por);
    RETURN v_id;
END $$;

-- Solicitudes de material del personal clinico (js/views/inventario.js)
CREATE TABLE solicitud_material (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint NOT NULL,
    sucursal_id     bigint NOT NULL,
    material_id     bigint NOT NULL,
    cantidad        numeric(12,3) NOT NULL CHECK (cantidad > 0),
    nota            text,
    solicitado_por  bigint NOT NULL,
    solicitado_en   timestamptz NOT NULL DEFAULT now(),
    estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','entregada','rechazada')),
    atendido_por    bigint,
    atendido_en     timestamptz,
    FOREIGN KEY (empresa_id, sucursal_id)    REFERENCES sucursal(empresa_id, id),
    FOREIGN KEY (empresa_id, material_id)    REFERENCES material(empresa_id, id),
    FOREIGN KEY (empresa_id, solicitado_por) REFERENCES trabajador(empresa_id, id),
    FOREIGN KEY (empresa_id, atendido_por)   REFERENCES trabajador(empresa_id, id),
    CHECK ((estado = 'pendiente') = (atendido_por IS NULL))
);

-- ---------------------------------------------------------------------
-- 9. SEGUIMIENTO Y BITACORA
-- ---------------------------------------------------------------------

CREATE TABLE tarea (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id   bigint NOT NULL,
    sucursal_id  bigint,
    paciente_id  bigint,
    titulo       text NOT NULL,
    hecho        boolean NOT NULL DEFAULT false,
    creado_por   bigint NOT NULL,
    creado_en    timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (empresa_id, sucursal_id) REFERENCES sucursal(empresa_id, id),
    FOREIGN KEY (empresa_id, paciente_id) REFERENCES paciente(empresa_id, id),
    FOREIGN KEY (empresa_id, creado_por)  REFERENCES trabajador(empresa_id, id)
);

-- "Marcar realizado" en el centro de seguimiento lo oculta 30 dias
-- (KD.db.seguimientoHecho). clave = 'pres:<id>', 'trat:<id>', 'pac:<id>'.
CREATE TABLE seguimiento_marca (
    empresa_id   bigint NOT NULL REFERENCES empresa(id),
    clave        text NOT NULL,
    marcado_en   date NOT NULL DEFAULT current_date,
    marcado_por  bigint NOT NULL,
    PRIMARY KEY (empresa_id, clave),
    FOREIGN KEY (empresa_id, marcado_por) REFERENCES trabajador(empresa_id, id)
);

-- Quien vio o cambio que expediente (NOM-024 / LFPDPPP). La escribe la
-- aplicacion: una base de datos no puede registrar por si sola cada lectura.
CREATE TABLE bitacora (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id     bigint NOT NULL REFERENCES empresa(id),
    trabajador_id  bigint,
    accion         text NOT NULL,        -- 'ver', 'crear', 'editar', 'baja'
    entidad        text NOT NULL,        -- 'paciente', 'consulta'...
    entidad_id     bigint,
    paciente_id    bigint,
    detalle        jsonb,
    en             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_bitacora_paciente ON bitacora (paciente_id, en);

-- Expediente y libros contables: no se borran (NOM-004 y auditoria).
CREATE FUNCTION tg_no_borrar() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'No se permite borrar renglones de %: use baja o un movimiento de correccion', TG_TABLE_NAME;
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

-- ---------------------------------------------------------------------
-- 10. VISTAS
-- ---------------------------------------------------------------------

CREATE VIEW v_existencia WITH (security_invoker = true) AS
SELECT empresa_id, sucursal_id, material_id,
       SUM(CASE tipo WHEN 'entrada' THEN cantidad ELSE -cantidad END) AS existencia
FROM inventario_movimiento
GROUP BY empresa_id, sucursal_id, material_id;

-- Estado de stock como KD.estadoStock: critico <= 60% del minimo, bajo <= minimo
CREATE VIEW v_stock WITH (security_invoker = true) AS
SELECT ms.empresa_id, ms.sucursal_id, ms.material_id, m.nombre,
       COALESCE(e.existencia, 0) AS existencia, ms.minimo,
       CASE WHEN COALESCE(e.existencia, 0) <= ms.minimo * 0.6 THEN 'critico'
            WHEN COALESCE(e.existencia, 0) <= ms.minimo THEN 'bajo'
            ELSE 'ok' END AS estado
FROM material_sucursal ms
JOIN material m ON m.id = ms.material_id
LEFT JOIN v_existencia e ON e.sucursal_id = ms.sucursal_id AND e.material_id = ms.material_id;

-- Traslados a los que les falta la salida o la entrada
CREATE VIEW v_traslado_incompleto WITH (security_invoker = true) AS
SELECT t.*, COUNT(m.id) AS movimientos
FROM inventario_traslado t
LEFT JOIN inventario_movimiento m ON m.traslado_id = t.id AND m.cantidad = t.cantidad
GROUP BY t.id
HAVING COUNT(m.id) <> 2;

-- Presupuesto con su estado calculado (borrador/enviado/aceptado/
-- en_tratamiento/completado/rechazado) y su total con descuento
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

-- Saldo SOLO de presupuestos aceptados (v0.1 incluia borradores y rechazados)
CREATE VIEW v_saldo_presupuesto WITH (security_invoker = true) AS
SELECT v.empresa_id, v.id AS presupuesto_id, v.paciente_id, v.total,
       COALESCE(a.pagado, 0) AS pagado,
       v.total - COALESCE(a.pagado, 0) AS saldo
FROM v_presupuesto v
LEFT JOIN (SELECT presupuesto_id, SUM(monto) AS pagado
             FROM pago_aplicacion WHERE presupuesto_id IS NOT NULL
            GROUP BY presupuesto_id) a ON a.presupuesto_id = v.id
WHERE v.estado = 'aceptado';

-- Estado de cada cuota (pagada / vencida / por vencer), calculado
CREATE VIEW v_cuota WITH (security_invoker = true) AS
SELECT c.*, COALESCE(a.pagado, 0) AS pagado,
       CASE WHEN COALESCE(a.pagado, 0) >= c.monto THEN 'pagada'
            WHEN c.vence < current_date THEN 'vencida'
            ELSE 'por_vencer' END AS estado
FROM cuota c
LEFT JOIN (SELECT cuota_id, SUM(monto) AS pagado FROM pago_aplicacion
            WHERE cuota_id IS NOT NULL GROUP BY cuota_id) a ON a.cuota_id = c.id;

-- Caja del dia: pagos de pacientes + otros movimientos, con fecha LOCAL
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

-- Citas donde el doctor esta en dos lugares a la vez (aviso, no bloqueo)
CREATE VIEW v_cita_doctor_empalmada WITH (security_invoker = true) AS
SELECT a.empresa_id, a.trabajador_id, a.id AS cita_a, b.id AS cita_b, a.inicio, b.inicio AS inicio_b
FROM cita a JOIN cita b ON b.trabajador_id = a.trabajador_id AND b.id > a.id
 AND tstzrange(a.inicio, a.fin) && tstzrange(b.inicio, b.fin)
WHERE a.estado NOT IN ('cancelada','no_asistio') AND b.estado NOT IN ('cancelada','no_asistio');

-- Precio vigente de un tratamiento en una sucursal (igual que v0.1)
CREATE FUNCTION precio_vigente(p_tratamiento bigint, p_sucursal bigint,
                               p_fecha date DEFAULT current_date)
RETURNS numeric LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT ps.precio FROM precio_sucursal ps
          WHERE ps.tratamiento_id = p_tratamiento AND ps.sucursal_id = p_sucursal
            AND ps.vigente_desde <= p_fecha
          ORDER BY ps.vigente_desde DESC LIMIT 1),
        (SELECT t.precio_base FROM tratamiento t WHERE t.id = p_tratamiento))
$$;

-- ---------------------------------------------------------------------
-- 11. AISLAMIENTO ENTRE EMPRESAS (Row Level Security)
-- ---------------------------------------------------------------------
-- La aplicacion, al recibir cada peticion, hace:
--     SET LOCAL app.empresa_id = '<empresa del usuario>';
-- y la base solo le muestra y deja escribir renglones de esa empresa.
-- OJO: un superusuario o el DUENO de las tablas se salta RLS; la app debe
-- conectarse con un usuario sin esos privilegios (aqui: kd_app).
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT c.table_name FROM information_schema.columns c
              JOIN information_schema.tables x ON x.table_schema = c.table_schema AND x.table_name = c.table_name
             WHERE c.table_schema = 'kennadent' AND c.column_name = 'empresa_id' AND x.table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format($p$CREATE POLICY por_empresa ON %I
                         USING (empresa_id = current_setting('app.empresa_id', true)::bigint)
                         WITH CHECK (empresa_id = current_setting('app.empresa_id', true)::bigint)$p$, t);
    END LOOP;
END $$;
ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY por_empresa ON empresa USING (id = current_setting('app.empresa_id', true)::bigint);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kd_app') THEN CREATE ROLE kd_app LOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA kennadent TO kd_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA kennadent TO kd_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA kennadent TO kd_app;
-- Libros de solo-agregar: la app no puede modificarlos
REVOKE UPDATE ON pago, pago_aplicacion, caja_movimiento, corte_caja,
                 inventario_movimiento, inventario_traslado, bitacora FROM kd_app;

-- ---------------------------------------------------------------------
-- 12. DATOS INICIALES (catalogos de plataforma, tomados de js/roles.js
--     y js/odonto.js)
-- ---------------------------------------------------------------------

INSERT INTO puesto (id, nombre, atiende, requiere_cedula, lleva_titulo) VALUES
  ('admin',        'Administrador(a) general',        false, false, false),
  ('gerente',      'Gerente de sucursal',             false, false, false),
  ('coordinador',  'Coordinador(a) de tratamientos',  false, false, false),
  ('recepcion',    'Recepcionista',                   false, false, false),
  ('caja',         'Caja y cobranza',                 false, false, false),
  ('almacen',      'Almacen e inventario',            false, false, false),
  ('odontologo',   'Odontologo(a) general',           true,  true,  true),
  ('especialista', 'Especialista',                    true,  true,  true),
  ('higienista',   'Higienista dental',               true,  true,  true),
  ('asistente',    'Asistente dental',                false, false, false),
  ('radiologo',    'Tecnico(a) radiologo',            false, true,  false),
  ('pasante',      'Pasante / practicante',           false, false, false);

INSERT INTO permiso (id, nombre, grupo) VALUES
  ('panel','Ver dashboard','General'),
  ('agenda_ver','Ver su propia agenda','Agenda'),
  ('agenda_todas','Ver la agenda de todo el equipo','Agenda'),
  ('agenda_editar','Crear, mover y cancelar citas','Agenda'),
  ('pacientes_ver','Ver pacientes','Pacientes'),
  ('pacientes_editar','Alta y edicion de datos generales','Pacientes'),
  ('clinico_editar','Editar datos clinicos y odontograma','Pacientes'),
  ('historial_ver','Ver resumen e historial clinico','Historial clinico'),
  ('historial_editar','Registrar consultas de sus pacientes','Historial clinico'),
  ('seguimiento','Seguimiento de pacientes','Operacion'),
  ('cobrar','Cobrar a pacientes','Operacion'),
  ('material_solicitar','Solicitar material','Operacion'),
  ('dinero','Ver precios, montos e ingresos','Gestion'),
  ('presupuestos','Presupuestos','Gestion'),
  ('caja','Caja: totales, egresos y corte diario','Gestion'),
  ('reportes','Reportes','Gestion'),
  ('inventario','Inventario','Gestion'),
  ('tratamientos','Catalogo de tratamientos','Gestion'),
  ('personal','Alta y baja de personal','Gestion'),
  ('empresa','Empresa y sucursales','Gestion'),
  ('todas_sucursales','Acceso a todas las sucursales','Gestion');

INSERT INTO puesto_permiso (puesto_id, permiso_id)
SELECT 'admin', id FROM permiso
UNION ALL SELECT 'gerente', id FROM permiso WHERE id NOT IN ('empresa','todas_sucursales')
UNION ALL SELECT 'coordinador', unnest(ARRAY['panel','agenda_ver','agenda_todas','agenda_editar','pacientes_ver','pacientes_editar','historial_ver','seguimiento','dinero','presupuestos'])
UNION ALL SELECT 'recepcion', unnest(ARRAY['panel','agenda_ver','agenda_todas','agenda_editar','pacientes_ver','pacientes_editar','seguimiento','cobrar'])
UNION ALL SELECT 'caja', unnest(ARRAY['panel','agenda_ver','agenda_todas','pacientes_ver','cobrar','caja','dinero'])
UNION ALL SELECT 'almacen', unnest(ARRAY['panel','inventario'])
UNION ALL SELECT p, unnest(ARRAY['panel','agenda_ver','pacientes_ver','clinico_editar','historial_ver','historial_editar','material_solicitar'])
          FROM unnest(ARRAY['odontologo','especialista','higienista']) AS p
UNION ALL SELECT 'asistente', unnest(ARRAY['panel','agenda_ver','agenda_todas','pacientes_ver','historial_ver','material_solicitar'])
UNION ALL SELECT 'radiologo', unnest(ARRAY['agenda_ver','agenda_todas','pacientes_ver','historial_ver'])
UNION ALL SELECT 'pasante', unnest(ARRAY['pacientes_ver','historial_ver']);

INSERT INTO catalogo_hallazgo (codigo, nombre, ambito, color) VALUES
  ('caries',            'Caries',                'cara',   'rojo'),
  ('resina',            'Resina / obturacion',   'cara',   'azul'),
  ('sellador',          'Sellador',              'cara',   'azul'),
  ('extraccion',        'Extraccion indicada',   'diente', 'rojo'),
  ('ausente',           'Ausente / extraido',    'diente', 'azul'),
  ('endodoncia',        'Endodoncia indicada',   'diente', 'rojo'),
  ('endodoncia_hecha',  'Endodoncia realizada',  'diente', 'azul'),
  ('corona',            'Corona indicada',       'diente', 'rojo'),
  ('corona_hecha',      'Corona existente',      'diente', 'azul'),
  ('implante',          'Implante indicado',     'diente', 'rojo'),
  ('implante_hecho',    'Implante existente',    'diente', 'azul'),
  ('fractura',          'Fractura',              'diente', 'rojo');
