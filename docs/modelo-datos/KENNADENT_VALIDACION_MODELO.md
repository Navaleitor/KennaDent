# KennaDent: validación del modelo de datos (v0.1)

> Documento de traspaso para Claude Code. Léelo completo antes de tocar nada.
> Objetivo: **determinar si el modelo de datos propuesto es el correcto para KennaDent**, no solo si "corre". Un esquema que ejecuta sin errores puede estar mal diseñado para el negocio.

---

## 1. Contexto

- **Proyecto:** KennaDent, sistema para una cadena de clínicas dentales (repo `Navaleitor/KennaDent`).
- **Estado actual:** prototipo 100% frontend (HTML, CSS, JavaScript) con datos en el navegador. Lógica de caja, inventario y avisos en `js/data.js`; reportes en `js/metricas.js`.
- **Plan:** backend en **Python (Django) + PostgreSQL**, dejando el frontend en JavaScript y conectándolo por API (Django REST Framework).
- **Perfil del dueño del proyecto:** experiencia en backend bancario y consultas en PostgreSQL (pgAdmin). **No tiene experiencia en desarrollo web ni en diseñar estructuras de datos.** Explica las decisiones de diseño con claridad y justifica cada hallazgo; no asumas que conoce la terminología.

## 2. Archivos que acompañan este documento

Cópialos a una carpeta `docs/modelo-datos/` del repo:

| Archivo | Qué es |
|---|---|
| `kennadent_esquema.sql` | Esquema PostgreSQL completo (esquema `kennadent`), con vistas, función `precio_vigente` y datos iniciales |
| `kennadent_modelo_est.jpg` | Diagrama: estructura y personal |
| `kennadent_modelo_pac.jpg` | Diagrama: pacientes, citas e historial clínico |
| `kennadent_modelo_din.jpg` | Diagrama: tratamientos, presupuestos y pagos |
| `kennadent_modelo_inv.jpg` | Diagrama: caja e inventario |

## 3. Reglas de negocio ya decididas por el dueño

Estas respuestas son datos del negocio, no hipótesis. El modelo debe respetarlas:

1. **Roles:** cada trabajador tiene **un solo rol**, igual en todas las sucursales. Los especialistas pueden trabajar en varias sucursales. Los odontólogos generales pueden **cubrir** otra sucursal, y su venta y desempeño personal **no debe verse afectado** por dónde trabajen.
2. **Precios:** el dueño de la cadena puede poner **precios distintos por sucursal**.
3. **Inventario:** es **por sucursal**. No hay transferencias automáticas; si el dueño mueve material de una sucursal a otra, debe quedar **registrado cada ingreso y egreso**.
4. **Pagos:** el paciente puede hacer **pagos parciales o individuales**, pagar sin presupuesto (consulta suelta), pagar solo un tratamiento de varios, y existen **tratamientos a plazos**.
5. **Clínico:** se necesita **odontograma e historial clínico** con historial (no se pierde lo anterior).
6. **Pacientes:** son **globales**; los comparten todas las sucursales.

## 4. Decisiones de diseño tomadas (a cuestionar)

| # | Decisión | Motivo original |
|---|---|---|
| D1 | Una sola base de datos para todas las sucursales, con `sucursal_id` donde corresponde | Pacientes compartidos y reportes consolidados |
| D2 | `PACIENTE` y `TRABAJADOR` sin `sucursal_id`; relación por tabla puente `TRABAJADOR_SUCURSAL` (con `es_base`) | Cobertura entre sucursales |
| D3 | Atribución de ventas por `presupuesto.trabajador_id` y de producción por `presupuesto_detalle.realizado_por` | Que el desempeño siga a la persona, no a la sucursal |
| D4 | `TRATAMIENTO.precio_base` + `PRECIO_SUCURSAL` con `vigente_desde`; función `precio_vigente()` | Precios por sucursal con historial |
| D5 | `PRESUPUESTO_DETALLE` guarda su propio `precio_unitario` | Que cambiar el catálogo no altere lo ya cotizado |
| D6 | `PAGO` independiente + `PAGO_APLICACION` (a presupuesto y opcionalmente a `CUOTA`) | Pagos parciales, sueltos y a plazos |
| D7 | `CAJA_MOVIMIENTO` e `INVENTARIO_MOVIMIENTO` como libros de solo-agregar; existencia calculada en vista | Auditabilidad (principio contable) |
| D8 | Traslado de inventario = una salida + una entrada con `motivo='traslado'`, sin vínculo entre ambas | Registro simple de lo que hace el dueño |
| D9 | Borrado lógico en `PACIENTE` (`eliminado_en`) | NOM-004: conservar expediente |
| D10 | Citas sin empalme por sillón **y** por doctor con `EXCLUDE USING gist` | Evitar dobles reservaciones |
| D11 | Odontograma como historial de hallazgos (pieza + superficie + hallazgo + fecha), numeración FDI 11–85 | Historial sin sobrescribir |
| D12 | `TRABAJADOR` guarda `usuario` y `password_hash` | Login del prototipo |

## 5. Limitaciones conocidas del trabajo previo (importante)

- **[Suposición]** El modelo se construyó a partir del README del repo y de las respuestas del dueño. **No se hizo una auditoría línea por línea de `js/data.js` ni de `js/metricas.js`.** Es posible que el frontend use campos o entidades que el modelo no contempla. Verificarlo es la prioridad 1.
- **[Cierto]** El SQL se ejecutó en un PostgreSQL embebido de prueba: tablas, vistas, `precio_vigente`, saldos de presupuesto, existencias y unicidad de sucursal base funcionaron.
- **[Cierto]** Las dos restricciones `EXCLUDE USING gist` (citas sin empalme) **no se ejecutaron**: el entorno de prueba no traía la extensión `btree_gist`. Solo se validó su sintaxis. **Hay que probarlas en un PostgreSQL real.**
- **[Cierto]** Quedan fuera de esta versión: antecedentes médicos y alergias del paciente, corte de caja diario, solicitudes de material, auditoría de cambios.

## 6. Debilidades sospechadas (verificar, no dar por ciertas)

Cada una es una hipótesis. Confírmala o descártala con evidencia.

1. **Consistencia entre tablas no forzada.** Nada impide una cita con un doctor que no está asignado (`TRABAJADOR_SUCURSAL`) a la sucursal de la unidad. Tampoco que `pago_aplicacion` sume más que `pago.monto`, ni que una `cuota` pertenezca a otro presupuesto distinto al aplicado.
2. **Traslados de inventario sin enlace.** La salida y la entrada de un mismo traslado no están vinculadas; no se puede reconciliar ni detectar que falta una de las dos.
3. **Duplicidad con Django.** `usuario`/`password_hash` en `TRABAJADOR` choca con el sistema de usuarios de Django (`auth_user`). Probablemente debe ser un `OneToOne` a `User`.
4. **Acceso a datos clínicos.** Con paciente global, cualquier sucursal podría ver el expediente completo. El modelo no expresa quién puede ver qué.
5. **Odontograma.** ¿FDI es la numeración que usa el frontend (el README menciona odontograma mexicano)? ¿Cómo se representan dientes temporales, superficies múltiples o estados de tratamiento?
6. **Consumo de material.** `TRATAMIENTO_MATERIAL` define cuánto material gasta cada tratamiento, pero nada genera la salida de inventario al realizar el tratamiento.
7. **Estado de cuotas.** No hay estado "pagada/vencida"; se tendría que derivar de `pago_aplicacion`. Evaluar si conviene columna o vista.
8. **`PRESUPUESTO.sucursal_id` vs `PAGO.sucursal_id`.** Un presupuesto de una sucursal puede cobrarse en otra. Revisar si el reporte de ingresos por sucursal queda ambiguo.
9. **Zonas horarias y citas.** `timestamptz` es correcto, pero verificar cómo el frontend maneja horarios de sucursales en distintas zonas (si aplica).
10. **Rendimiento.** Índices mínimos; sin pruebas con volumen realista.
11. **Sobre-diseño o sub-diseño.** ¿Hay tablas que el producto no necesitará en v1 (p. ej. `ROL_PERMISO` si Django ya trae permisos)? ¿Falta alguna que el frontend ya use?

## 7. Plan de validación (en este orden)

### Fase A: Cobertura contra el frontend (prioridad 1)

1. Lee `CLAUDE.md`, `README.md`, `js/data.js`, `js/metricas.js` y cualquier otro JS que lea o escriba datos.
2. Construye una **matriz** `entidad/campo del frontend → tabla.columna del modelo`. Marca:
   - campos del frontend **sin columna** en el modelo;
   - columnas del modelo **sin uso** en el frontend;
   - diferencias de tipo o de significado.
3. Lista **cada regla de negocio codificada en JS** (cálculos de caja, avisos, descuentos, inventario mínimo, etc.) e indica dónde viviría en el nuevo modelo.

### Fase B: Ejecución real

1. Levanta PostgreSQL local (Docker o instalación) y ejecuta `kennadent_esquema.sql`. Confirma que `btree_gist` se instala.
2. Ejecuta las **pruebas de la sección 8**. Reporta cuáles pasan y cuáles fallan, con la salida real.
3. Prueba específicamente que las dos restricciones `EXCLUDE` rechacen citas empalmadas **y** acepten citas canceladas en el mismo horario.

### Fase C: Casos de uso y reportes

Escribe las consultas SQL para cada reporte y confirma que el modelo las resuelve **sin trucos**:

- Ventas y producción por doctor en un periodo, incluyendo cuando cubrió otra sucursal.
- Ingresos por sucursal y por método de pago.
- Saldo pendiente por paciente y por presupuesto; cuotas vencidas.
- Existencia de material por sucursal y movimientos de un periodo.
- Ocupación de la agenda por sillón y por doctor.
- Historial completo de un paciente (citas, hallazgos por pieza, notas, pagos).
- Pacientes con tratamiento aceptado pero no terminado.

Si un reporte requiere consultas contorsionadas, **eso es una señal de mal diseño**; documéntalo.

### Fase D: Revisión de diseño

- Normalización: ¿hay datos duplicados o derivables guardados como columna?
- Integridad: ¿qué reglas deben pasar a restricciones, triggers o a la capa de aplicación? Justifica cada una.
- Seguridad y privacidad: datos de salud (LFPDPPP), conservación del expediente (NOM-004), control de acceso por rol y sucursal, auditoría de cambios.
- Encaje con Django: ¿conviene definir el modelo en Django ORM y generar migraciones, en lugar de mantener este SQL? ¿Qué cambia (usuarios, permisos, nombres de tablas)?

### Fase E: Informe

Entrega `docs/modelo-datos/INFORME_VALIDACION.md` con:

1. **Veredicto por área** (estructura, clínico, dinero, inventario): `Correcto` / `Correcto con cambios` / `Rediseñar`.
2. **Lista priorizada de cambios** (crítico / importante / opcional), cada uno con motivo y el SQL o diff propuesto.
3. **Tablas o campos que faltan** según el frontend.
4. **Tablas o campos que sobran**.
5. **Riesgos abiertos** y preguntas para el dueño del negocio.
6. Nivel de confianza (`[Cierto]`, `[Probable]`, `[Suposición]`) en cada conclusión importante.

No modifiques `kennadent_esquema.sql` directamente. Propón los cambios como `kennadent_esquema_v0.2.sql` y explica la diferencia.

## 8. Pruebas de comportamiento (SQL)

Ejecútalas tras cargar el esquema. Resultado esperado entre paréntesis.

```sql
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
```

## 9. Prompt para pegar en Claude Code

```
Lee docs/modelo-datos/KENNADENT_VALIDACION_MODELO.md completo y sigue su plan de
validación (Fases A a E) en orden. Tu tarea es determinar si el modelo de
datos propuesto (esquema SQL + 4 diagramas) es adecuado para KennaDent,
contrastándolo con el código real del frontend.

Reglas:
- No des por buena ninguna afirmación del documento sin verificarla.
  Las secciones 5 y 6 son hipótesis.
- Empieza por la Fase A (cobertura contra js/data.js y js/metricas.js).
- Ejecuta las pruebas de la sección 8 en un PostgreSQL real e informa
  resultados reales, no esperados.
- Marca cada conclusión como [Cierto], [Probable] o [Suposición].
- No modifiques kennadent_esquema.sql; propón kennadent_esquema_v0.2.sql.
- Explica cada hallazgo en lenguaje claro: el dueño sabe SQL y backend
  bancario, pero no diseño de datos ni desarrollo web.
- Termina con docs/modelo-datos/INFORME_VALIDACION.md.
```
