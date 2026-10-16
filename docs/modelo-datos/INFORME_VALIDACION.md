# KennaDent: informe de validación del modelo de datos v0.1

Fecha: 6 de octubre de 2026 · Base de pruebas: PostgreSQL 16.15 con `btree_gist` 1.7.

> **Veredicto corto.** El modelo v0.1 está bien pensado en su núcleo de dinero (pago separado de su aplicación, precio congelado en lo cotizado, libros de solo-agregar), pero **no sirve tal cual para KennaDent** por tres motivos:
> 1. **No es multiempresa.** KennaDent se vende a varios negocios independientes, y en v0.1 solo `sucursal` sabe a qué empresa pertenece. Pacientes, personal, tratamientos, materiales y citas no tienen dueño. Además, dos clínicas distintas no podrían tener ambas un tratamiento llamado "Limpieza".
> 2. **Le falta la consulta.** El frontend gira en torno a la consulta, es decir, lo que el doctor hizo en cada cita y su precio. De ahí salen ventas, reportes por doctor, cobro en caja y descuento de inventario. v0.1 no tiene dónde guardarla.
> 3. **Varias reglas quedaron "para la app" y la base acepta datos absurdos.** Las pruebas reales lo confirman: un saldo de **−9,674** y una cita con un doctor en una sucursal donde no trabaja.
>
> La propuesta `kennadent_esquema_v0.2.sql` corrige todo lo anterior y se comportó como se esperaba en los **46 casos de prueba** y en la prueba de concurrencia. Hay **10 preguntas de negocio** (sección 6) que cambian detalles del diseño. Conviene contestarlas antes de escribir código de backend.

Cómo leer las marcas de confianza:
- **[Cierto]**: lo comprobé ejecutando algo o leyendo el código, y cito dónde.
- **[Probable]**: es una inferencia sólida, pero no lo probé directamente.
- **[Suposición]**: llené un vacío de información. Hay que confirmarlo con el dueño.

---

## 0. Antes de empezar: dos contradicciones en los documentos de partida

1. **[Cierto] El stack no está decidido de forma consistente.** `CLAUDE.md` y `docs/requisitos.md` (sección 5) recomiendan **Next.js + Supabase**. El documento de validación dice **Django + PostgreSQL**. Las dos opciones usan PostgreSQL y v0.2 sirve para ambas, pero cambian cómo se hace el inicio de sesión y el aislamiento entre empresas (sección 4.4). **Hay que decidir uno y actualizar `CLAUDE.md`.**
2. **[Cierto] La sección 5 del documento dice que quedan "fuera de esta versión" alergias/antecedentes, corte de caja y solicitudes de material.** Sin embargo, el frontend **ya los usa**:
   - alergias y antecedentes: `js/views/pacientes.js` y el aviso al doctor en `js/data.js:654`;
   - corte de caja: `js/views/caja.js:217`;
   - solicitudes de material: `js/views/inventario.js:254`.

   No son extras para después. Son funciones que la v1 ya tiene.

---

## 1. Veredicto por área

| Área | Veredicto | Motivo principal |
|---|---|---|
| **Estructura** (empresa, sucursal, personal) | **Rediseñar** | Sin `empresa_id` en casi nada; usuario y nombres únicos a nivel mundial; permisos solo por rol, cuando el frontend los ajusta persona por persona. **[Cierto]** |
| **Clínico** (paciente, cita, odontograma) | **Correcto con cambios** | Le faltan la consulta y el plan de tratamiento. El catálogo de hallazgos está incompleto. Acepta piezas dentales inexistentes. La regla de "doctor sin empalme" contradice al frontend. **[Cierto]** |
| **Dinero** (presupuesto, pago, caja) | **Correcto con cambios** | La idea de `pago` + `pago_aplicacion` es buena. Faltan candados de consistencia (T9, X3, X4), el método de pago en los gastos y el corte de caja. Además, caja duplica los montos de los pagos. **[Cierto]** |
| **Inventario** | **Correcto con cambios** | Las existencias calculadas desde un libro de movimientos son correctas. Faltan el mínimo por sucursal, el costo y el proveedor, el enlace de los traslados y el consumo automático. **[Cierto]** |

---

## 2. Resultados de la ejecución real (Fase B)

### 2.1 Pruebas de la sección 8 sobre v0.1 (resultados reales)

Salida completa en `pruebas/seccion8_v0.1.salida.txt`.

| Prueba | Esperado según el documento | Resultado real | Lectura |
|---|---|---|---|
| Carga del esquema | — | Carga sin errores; `btree_gist` 1.7 instalado | **[Cierto]** |
| T1 cita válida | Pasa | **Pasa** | ✔ |
| T2 empalme en el mismo sillón | Falla | **Falla** (`cita_sin_empalme_unidad`) | ✔ La restricción funciona |
| T3 cancelada en el mismo horario | Pasa | **Pasa** | ✔ |
| T4 segunda sucursal base | Falla | **Falla, pero por otra razón**: llave primaria duplicada `(1,2)`, no la regla de "una sola base" | ⚠ La prueba estaba mal escrita. La reescribí (X1) y la regla **sí** funciona |
| T5 precio por sucursal | 500 y 650 | **500.00 y 650.00** | ✔ |
| T6 plazos con pago parcial | total 650, pagado 325, saldo 325 | **650 / 325 / 325** | ✔ |
| T7 pago suelto | Pasa | **Pasa** | ✔ |
| T8 traslado | Centro 6, Norte 4 | **6.000 y 4.000** | ✔ (ver X8 para lo que no se ve) |
| T9 aplicar 9,999 de un pago de 400 | "probablemente pase" | **Pasa** → el saldo del presupuesto queda en **−9,674** (X2) | ✖ Debilidad confirmada |
| T10 doctor en una sucursal donde no está asignado | "probablemente pase" | **Pasa** | ✖ Debilidad confirmada |

### 2.2 Pruebas adicionales sobre v0.1

Estas pruebas cubren lo que la sección 8 no revisaba. Están en `pruebas/extra_v0.1.sql` y su salida en `.salida.txt`.

| Prueba | Resultado real | Lectura |
|---|---|---|
| X1 regla de "una sola base", bien probada | Falla con `ux_trabajador_una_base` | ✔ **[Cierto]** |
| X3 aplicar dinero a la **cuota de otro presupuesto** | **Pasa** | ✖ **[Cierto]** |
| X4 pago de Juan aplicado al **presupuesto de Pedro** | **Pasa** | ✖ **[Cierto]** |
| X5 presupuesto **rechazado** | Aparece con saldo de 500 en `v_saldo_presupuesto` | ✖ Un reporte de cartera mostraría deuda que no existe **[Cierto]** |
| X6 el mismo doctor en **dos sillones** a la misma hora | **Falla** (`cita_sin_empalme_doctor`) | ⚠ El frontend sí lo permite, con aviso (`js/views/agenda.js:446`: "Presiona de nuevo para agendar de todos modos"). La base contradice una regla ya acordada **[Cierto]** |
| X7 pieza dental **20** (no existe) | **Pasa** | ✖ El rango 11–85 deja entrar 19, 20, 30, 49, 56… **[Cierto]** |
| X8a/b/c segunda empresa con su tratamiento "Limpieza", su material "Guantes" o su usuario "andrea" | **Las tres fallan** por `UNIQUE` global | ✖ Imposible como multiempresa **[Cierto]** |
| X8d trabajador de la empresa 1 asignado a una sucursal de la empresa 2 | **Pasa** | ✖ Fuga entre clientes **[Cierto]** |
| X8f tablas sin `empresa_id` ni `sucursal_id` | 15 tablas, entre ellas `paciente`, `trabajador`, `cita`, `tratamiento` y `material` | ✖ **[Cierto]** |
| X9 borrar un paciente | Se borra físicamente (si no tiene citas) | ✖ Contra NOM-004; `eliminado_en` no lo impide **[Cierto]** |

### 2.3 Pruebas sobre v0.2

Están en `pruebas/pruebas_v0.2.sql` y su salida en `.salida.txt`. **Los 46 casos se comportaron como se esperaba: 19 que deben pasar y 27 que deben fallar.**

- **T1–T10, las mismas de la sección 8 adaptadas:**
  - T9 ahora falla: "El pago 2 es de 400.00, ya tiene 0 aplicado; no alcanza para 9999.00".
  - T10 ahora falla por llave foránea.
  - T10c permite al mismo doctor en otro sillón, como hace el frontend, y lo reporta en `v_cita_doctor_empalmada`.
- **T11/T12:** una cuota de otro presupuesto y el pago de otro paciente ahora **fallan**.
- **T13:** las referencias cruzadas entre empresas **fallan las tres**.
- **T14:** dos empresas pueden tener cada una "LIMPIEZA DENTAL" y su expediente KD-00001.
- **T15:** las piezas 20 y 56 fallan; la 55 (temporal) pasa.
- **T16:**
  - la consulta solo se registra a nombre del doctor de la cita;
  - una cita solo admite una consulta;
  - un renglón del plan no se puede realizar dos veces.
- **T17:** después del corte de caja, ese día no admite ni pagos ni gastos; otra sucursal sí.
- **T18:** borrar un paciente → "No se permite borrar renglones de paciente".
- **T20, aislamiento con RLS**, conectado como la aplicación (`kd_app`) y no como administrador:
  - sin indicar la empresa ve 0 pacientes;
  - como empresa 2 solo ve a MARIA;
  - no puede crear ni modificar datos de la empresa 1;
  - no puede modificar un pago ya registrado.
- **Concurrencia** (`pruebas/concurrencia_v0.2.sh`): dos cajeros aplican 300 al mismo tiempo de un pago de 400. Uno lo logra y el otro recibe el error. Total aplicado: 300. **[Cierto]**

> **Corrección propia.** Al probar como `kd_app` descubrí que mi primera versión del candado (`SELECT … FOR UPDATE`) fallaba con "permission denied", porque la app no tiene permiso para modificar pagos. Lo cambié por `pg_advisory_xact_lock` y lo volví a probar. Lo menciono porque es justo el tipo de error que solo aparece al probar con el usuario real de la aplicación.

### 2.4 Volumen (hipótesis 6.10)

Datos de prueba en `pruebas/volumen_v0.2.sql`: 5 empresas, 15 sucursales y 30 sillones. Del 2024-01-01 al 2026-10-05:
- 259,500 citas;
- 220,669 consultas;
- 207,943 pagos;
- 441,488 movimientos de inventario;
- 100,000 pacientes.

Los 7 reportes de la Fase C, ejecutados como la app con RLS, tardaron **entre 2 y 392 ms** cada uno. **[Cierto]** para esta máquina y este volumen, que equivale a unas 5 clínicas medianas durante casi 3 años.

**[Probable]** Con cientos de empresas convendrá que los índices empiecen por `empresa_id`. Hoy solo lo hace `ix_paciente_nombre`. El más lento, el saldo por paciente (C3, 392 ms), suma todas las consultas históricas. Si crece, se resuelve con una tabla de saldos que se actualiza al cobrar.

---

## 3. Cobertura contra el frontend (Fase A)

### 3.1 Matriz entidad/campo → tabla.columna

Leyenda: ✔ existe · ✖ falta en v0.1 · ≠ existe, pero con distinto tipo o significado · ➕ agregado en v0.2.

**Empresa** (`KD.db.empresa`, `js/views/empresa.js`)

| Frontend | v0.1 | v0.2 |
|---|---|---|
| nombre (comercial) | ✖ solo `razon_social` | ➕ `nombre_comercial` |
| razonSocial, rfc | ✔ | ✔ |
| telefono, email | ✖ | ➕ |

**Sucursal**

| Frontend | v0.1 | v0.2 |
|---|---|---|
| nombre, direccion, telefono, activa | ✔ | ✔ |
| horario (texto) | ✖ | ➕ `sucursal_horario`, día por día (sirve para medir ocupación) |
| unidades (número de sillones) | ≠ tabla `unidad` (mejor: tiene nombre) | ✔ |
| — (no existe en el frontend) | ✖ | ➕ `zona_horaria` (ver 4.6) |

**Personal** (`js/data.js:145`, `js/views/personal.js`)

| Frontend | v0.1 | v0.2 |
|---|---|---|
| nombre, especialidad, color, activo | ✔ | ✔ |
| puesto (12 puestos con banderas atiende/cedula/titulo) | ≠ `rol` con 6 valores; no distingue odontólogo, especialista e higienista | ➕ `puesto` con las mismas 12 claves y banderas de `js/roles.js` |
| sexo, titulo (DR./DRA.), cedula, telefono, email | ✖ | ➕ |
| permisos (lista **por persona**, editable) | ≠ solo por rol (`rol_permiso`) | ➕ `trabajador_permiso` + `puesto_permiso` como plantilla |
| sucursales | ✔ `trabajador_sucursal` | ✔ |
| alta, baja (fecha) y motivoBaja | ✖ | ➕ `alta_en`, `baja_en`, `baja_motivo` |
| usuario y password | ≠ `usuario`, `password_hash` | ➕ `auth_user_id` (la contraseña va en el sistema de usuarios, ver 4.4) |

**Paciente** (`js/data.js:185`, `js/views/pacientes.js`)

| Frontend | v0.1 | v0.2 |
|---|---|---|
| expediente (KD-00001) | ✖ | ➕ único por empresa |
| nombre (un solo campo) | ≠ `nombre` + `apellidos` | Se conserva la separación de v0.1: mejora búsquedas e impresión. **El frontend debe cambiar** |
| nacimiento, telefono, email, sucursalId | ✔ | ✔ |
| sexo | ✖ | ➕ |
| alergias, antecedentes, datosClinicos=false | ✖ | ➕ `paciente_clinico` (tabla aparte, ver 4.3) |
| activo, baja | ≠ `eliminado_en` | ➕ `activo`, `baja_en`, `baja_motivo` + prohibido borrar |
| odonto.piezas / odonto.log | ≠ ver Odontograma | ✔ |

**Cita** (`js/data.js:269`, `js/views/agenda.js:449`)

| Frontend | v0.1 | v0.2 |
|---|---|---|
| fecha + hora + duracion | ✔ `inicio`/`fin` | ✔ |
| unidad, doctorId, pacienteId | ✔ | ✔ + `sucursal_id` explícito para poder validar |
| estado `en_sala` | ≠ `en_atencion` (la palabra cambia y el significado también: el frontend habla de sala de espera) | ✔ `en_sala` |
| tipoId (catálogo de tipos con duración y banderas) | ≠ `tipo` texto libre | ➕ `tipo_cita` |
| tratamientoId, piezas, planId | ✖ | ➕ |
| notas | ✔ `nota` | ✔ |
| cobro {monto, metodo, fecha, hora, usuarioId} | ≠ `pago.cita_id` | ✔ |

**Consulta** (`KD.db.consultas`, `js/views/expediente.js:499`): **✖ no existe en v0.1.**

| Frontend | v0.1 | v0.2 |
|---|---|---|
| citaId, pacienteId, doctorId, sucursalId, fecha | ✖ | ➕ `consulta`, ligada a su cita con llave compuesta |
| motivo, diagnostico, notas | ≠ `nota_clinica.nota`, solo texto | ➕ |
| procedimientos[] {tratamientoId, pieza, precio, planId} | ✖ | ➕ `consulta_procedimiento` |

**Plan de tratamiento** (`KD.db.planes`): **≠ en v0.1 solo existe dentro de un presupuesto** (`presupuesto_detalle`).

| Frontend | v0.1 | v0.2 |
|---|---|---|
| plan sin presupuesto (lo recomendado y aún no cotizado) | ✖ `presupuesto_id` es obligatorio | ➕ `plan_item.presupuesto_id` opcional |
| estado pendiente/aceptado/realizado/rechazado | ≠ pendiente/realizado/cancelado | ✔ |
| doctorId (quién lo diagnosticó), consultaId, sucursalId, fecha | ✖ | ➕ |
| pieza "16, 17" (varias piezas) | ≠ `pieza_dental` una sola | ➕ `piezas smallint[]` validadas |
| cantidad, precio | ✔ | ✔ |

**Presupuesto** (`js/views/presupuestos.js:256`)

| Frontend | v0.1 | v0.2 |
|---|---|---|
| folio | ✖ | ➕ único por empresa |
| descuento (**% del presupuesto**) | ≠ monto por renglón | ➕ `descuento_pct` |
| formaPago (contado/mensualidades), pagos (número) | ✖ | ➕ |
| estado borrador/enviado/aceptado/rechazado | ≠ "presentado", "cancelado" | ✔ |
| en_tratamiento / completado (calculados, `js/data.js:534`) | ✖ | ➕ calculados en `v_presupuesto` (no se guardan) |
| fechaEstado, notas | ✖ / ✔ | ✔ |

**Caja** (`js/data.js:575`, `js/views/caja.js`)

| Frontend | v0.1 | v0.2 |
|---|---|---|
| movimientos {tipo ingreso/egreso, concepto, monto, **metodo**, hora, usuarioId} | ≠ `caja_movimiento` **sin método de pago** | ➕ `metodo` |
| cortes {fondo, porMetodo, esperado, contado, diferencia, notas} | ✖ | ➕ `corte_caja` + bloqueo del día cerrado |

**Inventario** (`js/data.js:142`, `js/views/inventario.js`)

| Frontend | v0.1 | v0.2 |
|---|---|---|
| producto: nombre, unidad | ✔ `material` | ✔ |
| categoria, costo, proveedor, activo | ✖ | ➕ |
| minimo **por sucursal** | ✖ | ➕ `material_sucursal` |
| existencias por sucursal | ✔ calculado (`v_existencia`) | ✔ |
| tratamiento.materiales | ✔ `tratamiento_material` | ✔ |
| CONSUMO_BASE (guantes, cubrebocas por cita) | ✖ | ➕ `material.consumo_por_cita` |
| movInventario {tipo, cantidad, nota, usuarioId} | ✔ | ✔ + `consulta_id`, `traslado_id` |
| solicitudes {productoId, cantidad, nota, estado, atendio} | ✖ | ➕ `solicitud_material` |

**Tratamiento**

| Frontend | v0.1 | v0.2 |
|---|---|---|
| nombre, precio, duracion, activo | ✔ | ✔ |
| categoria (reporte "ventas por categoría") | ✖ | ➕ |

**Seguimiento**

| Frontend | v0.1 | v0.2 |
|---|---|---|
| tareas | ✖ | ➕ `tarea` |
| seguimientoHecho (ocultar 30 días) | ✖ | ➕ `seguimiento_marca` |

**Odontograma** (`js/odonto.js`)

| Frontend | v0.1 | v0.2 |
|---|---|---|
| numeración FDI, permanentes y temporales | ✔ (pero acepta piezas inexistentes) | ✔ validación exacta |
| 5 caras V, L, M, D, O | ≠ 6 superficies (separa lingual de palatina) | ✔ las 5 del frontend |
| 12 hallazgos: caries, resina, sellador, extracción, ausente, endodoncia(±hecha), corona(±hecha), implante(±hecho), fractura | ≠ 6; faltan sellador, implante y fractura, y no hay rojo/azul | ✔ los 12, con `color` y `ambito` |
| bitácora con fecha y doctor | ✔ registrado_en + trabajador_id | ✔ |

### 3.2 Columnas de v0.1 que el frontend no usa

- `trabajador_sucursal.es_base`: el frontend no lo usa, pero sirve para la regla 1 del dueño ("cubrir"). **Se queda.** **[Probable]**
- `precio_sucursal`: el frontend tiene un solo precio por tratamiento. **Se queda** porque es la regla 2 del dueño. **El frontend tendrá que agregarlo.** **[Cierto]**
- `cuota` y `pago_aplicacion`: el frontend todavía no tiene abonos (es la Fase 2 de `requisitos.md`). **Se quedan.**
- `nota_clinica`: queda cubierta por `consulta.notas`. **Se elimina.**
- `rol` y `rol_permiso`: se reemplazan por `puesto`, `puesto_permiso` y `trabajador_permiso`.

### 3.3 Reglas de negocio que hoy viven en JavaScript y dónde vivirían

| Regla (archivo) | Dónde en v0.2 | Por qué ahí |
|---|---|---|
| Un sillón no atiende a dos pacientes a la vez (`agenda.js`, `choqueCita`) | **Base**: `EXCLUDE` por unidad | Es un invariante físico; dos recepcionistas simultáneas lo romperían si solo lo revisa la app. **[Cierto]** |
| El doctor empalmado solo **avisa** (`agenda.js:446`) | **App** + vista `v_cita_doctor_empalmada` | Es una advertencia, no una prohibición. **[Cierto]** |
| La consulta solo la registra el doctor de la cita (`KD.puedeRegistrar`) | **Base**: llave compuesta consulta→cita. **App**: que sea "ese día" | Que sea el mismo doctor es un dato; que sea "hoy" depende del reloj y del usuario conectado. **[Probable]** |
| Aviso si pasaron más de 15 min sin registro (`KD.registrosPendientes`) | **App** (consulta sobre `cita` sin `consulta`) | Es un aviso, no un dato. |
| Estado del presupuesto en_tratamiento/completado (`KD.estadoPresupuesto`) | **Vista** `v_presupuesto` | Se puede calcular; guardarlo permitiría que se contradiga. **[Cierto]** |
| Total = subtotal × (1 − descuento%) (`KD.totalPresupuesto`) | **Vista** `v_presupuesto` | Igual. |
| Por cobrar = atendida con registro y sin cobro, últimos 45 días (`KD.porCobrar`) | **Consulta** sobre `consulta` sin `pago_aplicacion` | **[Suposición]** Los 45 días parecen un límite del prototipo, no una regla del negocio. |
| Corte: fondo + efectivo − gastos en efectivo = esperado; el día cerrado no admite movimientos (`caja.js:214`) | **Base**: `corte_caja` + trigger de caja cerrada | Es una regla contable: debe ser imposible saltársela. **[Cierto]** |
| Descontar material al registrar una consulta, × número de piezas, + CONSUMO_BASE (`KD.descontarConsulta`) | **App**, en la misma transacción que la consulta, con `inventario_movimiento.consulta_id` | Un trigger podría hacerlo, pero la fórmula (por pieza, consumo base) es de negocio y cambiará. **[Probable]** |
| Existencia nunca menor que 0 (`Math.max(0, …)` en `data.js:636`) | **No replicar**: el libro puede quedar negativo | Un negativo es información real ("se usó material no registrado"); recortarlo a 0 la esconde. **[Probable]** |
| Stock crítico ≤ 60 % del mínimo, bajo ≤ mínimo (`KD.estadoStock`) | **Vista** `v_stock` | **[Cierto]** |
| Proyección semanal de miércoles a martes (`KD.cicloInventario`) | **App** | Es un cálculo de planeación, no un dato. |
| No entregar material si no hay existencia (`inventario.js:151`) | **App**; en traslados, **base** (`registrar_traslado`) | |
| Seguimiento: presupuesto enviado sin respuesta ≥ 7 días, revisión preventiva a los 150–400 días, ocultar 30 días (`metricas.js:125`) | **App** + `seguimiento_marca` | Son políticas que el negocio ajustará. |
| Reportes: ventas = suma de `procedimientos.precio` de las consultas (`metricas.js:52`) | **Consulta** sobre `consulta_procedimiento` (C1) | **[Cierto]** En v0.1 no hay de dónde sacarlo. |
| "Nuevos" = consultas con el tratamiento `t1` (`metricas.js:58`) | **App**, usando `tipo_cita.es_diagnostico` | **[Cierto]** Hoy depende de un id fijo de la demo (`t1`); con catálogos por empresa ese id no existe. |
| Nombres en MAYÚSCULAS (`KD.mayus`) | **App** | |
| Usuario `nombre.apellido` y contraseña inicial (`KD.sugerirUsuario`) | **App** | |
| Solo con permiso `dinero` se ven montos (`KD.verDinero`) | **App** (API) | La base no sabe qué pantalla está viendo el usuario. |

---

## 4. Revisión de diseño (Fase D)

### 4.1 Multiempresa: la decisión más importante

**[Cierto]** v0.1 trata a KennaDent como si fuera **una sola cadena**. Para venderlo a varios negocios hay tres caminos. Uso una analogía bancaria:

| Opción | Analogía bancaria | Ventajas | Desventajas |
|---|---|---|---|
| **A. Tablas compartidas con `empresa_id`** (v0.2) | Un solo core con número de cliente en cada cuenta | Una sola migración para todos, métricas de toda la plataforma y bajo costo | Un error en una consulta podría mezclar clientes, salvo que la base lo impida |
| B. Un esquema de PostgreSQL por empresa (`django-tenants`) | Un core por cliente en el mismo servidor | Aislamiento fuerte | Cada cambio se migra N veces; reportes de la plataforma más difíciles |
| C. Una base de datos por empresa | Un servidor por cliente | Máximo aislamiento | Caro y pesado de operar con clínicas pequeñas |

**Recomendación [Probable]: A, blindada en dos capas.**
1. **Llaves foráneas compuestas `(empresa_id, id)`.** La base rechaza, por construcción, una cita de la empresa 1 con un paciente de la empresa 2 (pruebas T13a/b/c).
   - Es como validar que la cuenta destino pertenezca al mismo cliente, pero hecho por la base y no por el programa.
   - Con el mismo truco también se resuelven, sin triggers: la cuota del mismo presupuesto (T11), el pago y el presupuesto del mismo paciente (T12), el doctor asignado a la sucursal (T10) y el sillón de la sucursal correcta (T10b).
2. **Row Level Security (RLS).** En cada petición, la app declara `SET LOCAL app.empresa_id = …`, y la base filtra sola. Aunque un programador olvide un `WHERE empresa_id = …`, no se ven datos de otro cliente (T20).
   - **Cuidado [Cierto]:** el dueño de las tablas y los superusuarios **se saltan** RLS. La app debe conectarse con un usuario aparte (`kd_app`). Las migraciones sí corren con el dueño.

Los catálogos que define KennaDent y no el cliente (puestos, permisos, hallazgos del odontograma) quedan **sin** `empresa_id`. Los catálogos del cliente (tratamientos, tipos de cita, materiales) llevan `empresa_id` y nombre único **por empresa**.

### 4.2 Normalización: ¿hay datos duplicados o que se pueden calcular?

- **[Cierto] `caja_movimiento.pago_id` en v0.1 duplica el monto del pago.**
  - Si se registra el pago y no el movimiento, o con otro monto, caja y cartera dejan de cuadrar.
  - v0.2: los pagos **ya son** un libro; `caja_movimiento` guarda solo lo que no es pago de paciente; y la vista `v_caja` los une.
- **[Cierto] `presupuesto_detalle.realizado_por`/`realizado_en` en v0.1** son información de la consulta copiada en el presupuesto, y no existen para lo que se hace sin presupuesto. En v0.2 se obtienen de `consulta_procedimiento → consulta`.
- **[Probable] Estado de la cuota (hipótesis 6.7): vista, no columna.** Una columna "pagada" puede contradecir lo aplicado. `v_cuota` lo calcula (pagada / vencida / por vencer) y responde en 13 ms con 15,600 cuotas.
- **Excepción justificada:** `corte_caja.efectivo_esperado` sí se guarda. Es la foto oficial al cerrar la caja, como un estado de cuenta emitido, y no debe cambiar después.

### 4.3 Seguridad y privacidad

- **[Cierto] Datos de salud separados.** Alergias y antecedentes viven en `paciente_clinico`, aparte de los datos de contacto. Así se puede dar a recepción permiso de **leer** la alerta de alergias pero no de editarla, que es la regla de `requisitos.md` 2.2, y auditar el acceso a esa tabla por separado.
- **[Cierto] Conservación (NOM-004, al menos 5 años).**
  - Un trigger impide borrar renglones de paciente, consulta, odontograma, pagos, caja e inventario (T18).
  - La app además no tiene permiso UPDATE sobre los libros de dinero e inventario (T20e). Una corrección se registra como un movimiento nuevo, igual que en contabilidad.
- **[Probable] Hipótesis 6.4 (acceso clínico).**
  - Dentro de la empresa, que todo el personal clínico vea a todos los pacientes **es una regla acordada** (`requisitos.md` 2.2). Lo que faltaba era el aislamiento **entre empresas**, y está resuelto con RLS.
  - El control por puesto (recepción sin datos clínicos) queda en la API.
  - Hay una tabla `bitacora` para registrar quién **consultó** cada expediente (NOM-024). Una base de datos no puede registrar lecturas por sí sola; eso lo debe escribir la app.
- **[Suposición] Derechos ARCO (LFPDPPP) contra NOM-004.** Si un paciente pide cancelar sus datos, la NOM-004 obliga a conservar el expediente. Lo usual es "bloquear" (`activo = false` + motivo) y no borrar. Conviene confirmarlo con un abogado.

### 4.4 Encaje con Django (o con Supabase)

| Tema | Django | Supabase |
|---|---|---|
| Usuarios y contraseñas (hipótesis 6.3, **confirmada [Probable]**) | `trabajador.auth_user_id` → relación uno a uno con el usuario de Django. Conviene definir un usuario personalizado desde el día 1 | `auth_user_id` → `auth.users.id` (uuid) |
| Aislamiento por empresa | Middleware que hace `SET LOCAL app.empresa_id` en cada petición y conexión con el rol `kd_app` | RLS nativo; la política usa el `empresa_id` del token (`auth.jwt()`) en lugar de `current_setting` |
| Permisos | Los grupos de Django **solo suman** permisos; el frontend también los **quita** persona por persona. Se mantiene `trabajador_permiso` propio | Igual |
| Llaves foráneas compuestas | **El ORM de Django no las soporta** (5.x añadió llaves primarias compuestas, no foráneas). Se agregan con migraciones `RunSQL` | SQL directo |
| `EXCLUDE` | Soportado (`django.contrib.postgres.constraints.ExclusionConstraint`) | SQL directo |
| Triggers y RLS | Migraciones `RunSQL` | SQL directo |

**Recomendación [Probable].** Si se elige Django, los modelos se definen en el ORM, porque así nacen las migraciones y la API. Este SQL sirve como **especificación y prueba**: se migra lo que el ORM sabe hacer y se agrega con `RunSQL` lo que no (llaves compuestas, triggers, RLS). Se vuelven a correr `pruebas/pruebas_v0.2.sql` contra la base generada por Django para comprobar que quedó igual.

**Pendiente de decidir:** con multiempresa, el usuario `andrea.garza` puede existir en dos clínicas. Hay que elegir entre que el inicio de sesión sea por **correo** (único en el mundo) o que pida **clínica + usuario**. Ver la pregunta 3.

### 4.5 Respuesta a cada hipótesis de la sección 6

| # | Hipótesis | Veredicto | Evidencia |
|---|---|---|---|
| 6.1 | Consistencia entre tablas no forzada | **Confirmada [Cierto]** | T9, T10, X3, X4. En v0.2 se resuelve con llaves compuestas + trigger (T9–T12) |
| 6.2 | Traslados sin enlace | **Confirmada [Cierto]** | En v0.2 hay un documento `inventario_traslado` con sus dos movimientos, `registrar_traslado()` y la vista `v_traslado_incompleto` (T8–T8d) |
| 6.3 | Duplicidad con Django | **Confirmada [Probable]** | Ver 4.4 |
| 6.4 | Acceso a datos clínicos | **Confirmada y más grave [Cierto]**: el problema real era *entre empresas*, no entre sucursales | X8f, T20 |
| 6.5 | ¿FDI? ¿temporales? ¿superficies? ¿estados? | **FDI correcto [Cierto]** (`js/odonto.js:1`). Rango demasiado permisivo (X7); 6 superficies contra las 5 del frontend; faltan 6 hallazgos y el rojo/azul | Matriz 3.1, T15 |
| 6.6 | Consumo de material no se genera | **Confirmada [Cierto]**: el frontend sí lo hace (`KD.descontarConsulta`) y v0.1 no tiene cómo ligarlo | v0.2: `consulta_id` en el movimiento + `consumo_por_cita` |
| 6.7 | Estado de cuotas | **Vista [Probable]** | `v_cuota`, C3b |
| 6.8 | Sucursal del presupuesto contra la del pago | **No es ambigüedad del modelo sino de nombres [Probable]**: "ingresos de caja" = dónde entró el dinero (`pago.sucursal_id`); "ventas" = dónde se atendió (`consulta.sucursal_id`). Son dos reportes distintos | Pregunta 7 |
| 6.9 | Zonas horarias | **[Cierto]** El frontend no maneja zonas: usa la hora del dispositivo (`KD.hoy`, `js/data.js:11`). México tiene 4 zonas. v0.2 agrega `sucursal.zona_horaria`, y la caja calcula "el día" con esa zona | `v_caja`, T17 |
| 6.10 | Rendimiento | **Aceptable a esta escala [Cierto]** | 2.4 |
| 6.11 | Sobre- o sub-diseño | **Sub-diseño [Cierto]**: v0.2 agrega 17 tablas, y 15 de ellas guardan cosas que el frontend ya usa. Sobra `nota_clinica` y se reemplaza `rol_permiso` | 3.1, 3.2 |

### 4.6 Las decisiones D1–D12, una por una

| # | Veredicto | Comentario |
|---|---|---|
| D1 una base con `sucursal_id` | **Cambiar** | Una base sí, pero con `empresa_id` en todo y RLS |
| D2 paciente/trabajador sin sucursal + tabla puente | **Correcto** | Ahora con `empresa_id` y `activo` en la tabla puente: no se borra la asignación, porque la usan citas pasadas |
| D3 ventas por `presupuesto.trabajador_id`, producción por `realizado_por` | **Cambiar** | La producción sale de `consulta_procedimiento` (incluye lo hecho sin presupuesto y la sucursal donde se hizo). Lo presupuestado sale de `plan_item.diagnosticado_por`, igual que `KD.metricas` |
| D4 precio base + precio por sucursal | **Correcto** (T5) | El frontend aún no tiene precio por sucursal |
| D5 el renglón guarda su precio | **Correcto** | |
| D6 pago + aplicación | **Correcto con candados** | + aplicación a una consulta suelta; + llaves compuestas; + trigger con candado |
| D7 libros de solo-agregar | **Correcto con cambios** | Agregar `metodo`; caja sin copiar pagos; corte de caja; sin permiso UPDATE para la app |
| D8 traslado = 2 movimientos sueltos | **Cambiar** | Documento de traslado (6.2) |
| D9 borrado lógico con `eliminado_en` | **Cambiar** | `activo`/`baja_en`/`baja_motivo`, como el frontend, + trigger que prohíbe borrar |
| D10 sin empalme por sillón **y** por doctor | **Cambiar a medias** | Por sillón sí. Por doctor contradice al frontend (X6) → aviso. Ver la pregunta 1 |
| D11 odontograma como historial FDI | **Correcto con cambios** | Validación exacta de piezas, 5 caras, 12 hallazgos con color |
| D12 usuario y contraseña en trabajador | **Cambiar** | `auth_user_id` |

---

## 5. Lista priorizada de cambios (todos en `kennadent_esquema_v0.2.sql`)

### Críticos (sin esto, el modelo no sirve para el producto)

1. **Multiempresa: `empresa_id` en todas las tablas del cliente + llaves compuestas + RLS.**
   - Motivo: X8a–f.
   - Patrón (se repite en cada tabla):
     ```sql
     CREATE TABLE paciente (
         id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         empresa_id bigint NOT NULL REFERENCES empresa(id),
         expediente text NOT NULL,
         ...
         UNIQUE (empresa_id, expediente),
         UNIQUE (empresa_id, id)                  -- para que otros apunten con (empresa_id, id)
     );
     -- quien apunta:
     FOREIGN KEY (empresa_id, paciente_id) REFERENCES paciente(empresa_id, id)
     -- y el candado de lectura:
     ALTER TABLE paciente ENABLE ROW LEVEL SECURITY;
     CREATE POLICY por_empresa ON paciente
       USING (empresa_id = current_setting('app.empresa_id', true)::bigint)
       WITH CHECK (empresa_id = current_setting('app.empresa_id', true)::bigint);
     ```
2. **Consulta, procedimientos y plan de tratamiento** (`consulta`, `consulta_procedimiento`, `plan_item`; este último reemplaza a `presupuesto_detalle`).
   - Motivo: son la base de ventas, reportes por doctor, cobro e inventario en el frontend (3.1).
3. **Candados de dinero.**
   ```sql
   -- la cuota es de ESE presupuesto, y pago y presupuesto son del MISMO paciente
   FOREIGN KEY (empresa_id, cuota_id, presupuesto_id)    REFERENCES cuota(empresa_id, id, presupuesto_id),
   FOREIGN KEY (empresa_id, pago_id, paciente_id)        REFERENCES pago(empresa_id, id, paciente_id),
   FOREIGN KEY (empresa_id, presupuesto_id, paciente_id) REFERENCES presupuesto(empresa_id, id, paciente_id)
   -- y trigger tg_aplicacion_no_excede (con pg_advisory_xact_lock)
   ```
4. **Doctor asignado a la sucursal de la cita y sillón de esa sucursal** (T10).
   ```sql
   FOREIGN KEY (empresa_id, trabajador_id, sucursal_id) REFERENCES trabajador_sucursal(empresa_id, trabajador_id, sucursal_id),
   FOREIGN KEY (empresa_id, sucursal_id, unidad_id)     REFERENCES unidad(empresa_id, sucursal_id, id)
   ```
5. **Caja.**
   - `metodo` en `caja_movimiento`;
   - quitar `pago_id`, y que la caja sea `v_caja`;
   - tabla `corte_caja` con el trigger que cierra el día.
   - Motivo: sin el método no se puede calcular el efectivo esperado del corte (`js/views/caja.js:214`).
6. **Quitar `cita_sin_empalme_doctor`** (o confirmar con la pregunta 1 que se quiere prohibir y cambiar el frontend).

### Importantes

7. Traslado como documento (`inventario_traslado`, `registrar_traslado`, `v_traslado_incompleto`).
8. `paciente_clinico` (alergias y antecedentes) y prohibición de borrar en el expediente y los libros.
9. Validación exacta FDI (`es_pieza_fdi`), 5 caras y los 12 hallazgos con `color`.
10. Campos de material: `categoria`, `costo`, `proveedor`, `consumo_por_cita`, más `material_sucursal.minimo` y `solicitud_material`.
11. `tipo_cita`, `tratamiento.categoria` y los campos de presupuesto (`folio`, `descuento_pct`, `forma_pago`, `num_pagos`).
12. Personal: `puesto` (12, con banderas), `trabajador_permiso` y los campos de alta y baja; `auth_user_id` en lugar de la contraseña.
13. `sucursal.zona_horaria`; estado de cita `en_sala`.
14. `v_saldo_presupuesto` solo con presupuestos **aceptados** y con el descuento en porcentaje (X5).

### Opcionales

15. `sucursal_horario`, para medir ocupación (C5).
16. `tarea`, `seguimiento_marca` y `bitacora`.
17. Índices que empiecen por `empresa_id` cuando haya cientos de clientes.

---

## 6. Riesgos abiertos y preguntas para el dueño del negocio

1. **¿Se prohíbe que un doctor tenga dos citas a la misma hora (en dos sillones), o solo se avisa?** El frontend avisa y deja continuar; v0.1 lo prohibía. v0.2 sigue al frontend.
2. **¿Cuándo nace la deuda del paciente?** Hoy el frontend cobra **por cita**, lo que se hizo ese día. Con mensualidades, la deuda nace al **aceptar el presupuesto**. Si un tratamiento de un presupuesto a plazos se realiza en una cita, ¿se cobra en la caja de ese día o ya está cubierto por las cuotas? v0.2 permite ambas cosas: el pago se aplica a una consulta **o** a un presupuesto. Pero el saldo del paciente (C3) cuenta las dos y **podría duplicarse** si se usan para el mismo tratamiento. **[Cierto]** que se puede duplicar; la regla la tiene que fijar el negocio.
3. **Inicio de sesión: ¿correo o clínica + usuario?** Con varias empresas, `andrea.garza` puede repetirse.
4. **¿Django o Next.js + Supabase?** Los documentos se contradicen (sección 0).
5. **Precio de un renglón con varias piezas ("16, 17"): ¿es por pieza o por renglón?** Hoy el frontend multiplica el precio por la `cantidad`, no por el número de piezas, pero el **material** sí lo multiplica por pieza (`js/data.js:631`). **[Cierto]** que es inconsistente.
6. **Cobertura:** para que un doctor cubra otra sucursal, ¿hay que darlo de alta antes en esa sucursal (v0.2 lo exige), o debe poder agendarse en cualquiera de la empresa?
7. **"Ingresos por sucursal": ¿dónde entró el dinero o dónde se atendió?** Son dos reportes distintos (6.8).
8. **Descuento:** ¿solo por porcentaje del presupuesto (como el frontend) o también por renglón (como v0.1)?
9. **Multiempresa:** ¿alguna clínica exigirá por contrato tener su propia base de datos? Eso cambiaría la opción A por la C (4.1).
10. **Eliminar presupuestos:** el frontend permite borrarlos. ¿Basta con eso, o se debe conservar como "cancelado" para auditoría?

**Otros riesgos:**
- **[Probable]** El frontend usa ids de texto (`"p12"`, `"t1"`) y reglas atadas a ids de la demo, como `t1` = valoración o `t14` = control de ortodoncia (`js/views/expediente.js:478`). Al conectar la base, esas reglas deben pasar a banderas del catálogo, por ejemplo `tipo_cita.es_diagnostico`.
- **[Probable]** El frontend permite escribir la existencia directamente (`js/views/inventario.js:185`). Con libros de movimientos, eso debe convertirse en un movimiento de "ajuste".

---

## 7. Archivos de esta validación

| Archivo | Qué es |
|---|---|
| `KENNADENT_VALIDACION_MODELO.md`, `kennadent_esquema.sql`, `kennadent_modelo_*.jpg` | Material de partida, sin cambios |
| `kennadent_esquema_v0.2.sql` | Propuesta. Carga en una base vacía en PostgreSQL 16 |
| `pruebas/seccion8_v0.1.sql` + `.salida.txt` | Sección 8 tal cual, con la salida real |
| `pruebas/extra_v0.1.sql` + `.salida.txt` | Pruebas X1–X9 sobre v0.1 |
| `pruebas/pruebas_v0.2.sql` + `.salida.txt` | T1–T20 sobre v0.2 |
| `pruebas/concurrencia_v0.2.sh` + `.salida.txt` | Dos cajeros simultáneos |
| `pruebas/volumen_v0.2.sql` + `.salida.txt` | Datos de volumen |
| `pruebas/fase_c_reportes_v0.2.sql` + `.salida.txt` | Los 7 reportes con sus tiempos |

Para repetir todo en pgAdmin o psql:
1. Crea una base vacía y corre `kennadent_esquema_v0.2.sql`.
2. Corre `pruebas/pruebas_v0.2.sql` y compara con su `.salida.txt`.
3. Para los reportes, usa otra base vacía con el esquema, corre `pruebas/volumen_v0.2.sql` (tarda alrededor de 1 minuto) y luego `pruebas/fase_c_reportes_v0.2.sql`.
