# KennaDent: requisitos del sistema

> Nombre sujeto a cambio. Documento vivo: complétenlo con Kenia conforme se definan los puntos marcados como **Por definir**.

## 1. Qué es KennaDent

Un **software de gestión para clínicas dentales**, vendido por **suscripción mensual**. Lo usa el personal de la clínica; los pacientes no entran al sistema.

### Niveles de acceso

| Nivel | Quién | Qué hace |
|---|---|---|
| **Plataforma** | KennaDent (Kenia) | Da de alta a las empresas que contratan y crea la cuenta del administrador de cada una |
| **Empresa** | Dueño o administrador de la clínica | Administra sus sucursales, su personal, sus permisos y ve las métricas globales |
| **Personal** | Recepción, doctores, asistentes, etc. | Ven únicamente lo que su administrador les habilitó |

### Organización de la información

```
KennaDent
└── Empresa (cliente que paga la suscripción)
    ├── Sucursales (1, 2, 3…)
    ├── Personal → cada persona con un puesto, sucursales asignadas y permisos
    ├── Catálogo de tratamientos y precios · Tipos de cita
    └── Pacientes → pertenecen a la empresa, no a una sucursal
        ├── Historial clínico (consultas)
        ├── Plan de tratamiento / presupuesto
        └── Citas
```

Un paciente atendido en la sucursal 1 puede ir a la sucursal 2 y ahí ya está todo su expediente: no se vuelve a dar de alta ni hay que pedir reportes.

## 2. Fase 1: lo esencial (prototipo en este repositorio)

### 2.1 Empresa, sucursales y unidades
- Datos de la empresa: nombre comercial, razón social, RFC, teléfono, correo.
- Alta, edición y desactivación de sucursales: nombre, dirección, teléfono, horario y **número de unidades dentales (sillones)**.
- La agenda se organiza **por unidad**: una unidad no puede atender a dos pacientes a la vez (evita el cuello de botella de tener más doctores que sillones).
- Tipos de cita con duración predeterminada. Cada tipo indica si al agendar **pide tratamiento y piezas** (ej. extracción) o si es **de diagnóstico** (el doctor llena el odontograma).

### 2.2 Personal (alta y baja)
Puestos incluidos:

| Área | Puestos |
|---|---|
| Dirección y administración | Administrador(a) general · Gerente de sucursal · Coordinador(a) de tratamientos · Recepcionista · Caja y cobranza · Almacén e inventario |
| Personal clínico | Odontólogo(a) general · Especialista (Ortodoncia, Endodoncia, Periodoncia, Odontopediatría, Cirugía maxilofacial, Prostodoncia/Rehabilitación, Implantología) · Higienista dental · Asistente dental · Técnico(a) radiólogo · Pasante / practicante |

- Datos: nombre (en mayúsculas), sexo, puesto, especialidad, cédula profesional, teléfono, correo opcional, sucursales y **color en la agenda** (paleta del prototipo de Kenia).
- **Prefijo Dr. / Dra.** según el sexo, automático para odontólogo, especialista e higienista (se puede activar o quitar por persona).
- **Usuario y contraseña predeterminados** (Issue #6):
  - Usuario: `nombre.apellido` (ej. RICARDO NAVA CORTÉS → `ricardo.nava`). Si ya existe, se usa el segundo apellido (`ricardo.cortes`) y el sistema lo avisa.
  - Contraseña: en el prototipo, `nombreapellido` + 3 números al azar (ej. `ricardonava123`). **Con el backend será al azar** (no adivinable) y se muestra solo al crearla o regenerarla (ver sección 6).
  - El administrador puede copiarlos y generar una nueva contraseña. Con el backend ya no puede consultar la contraseña actual, porque se guarda cifrada.
- **Permisos por casilla.** Cada puesto trae permisos sugeridos, que el administrador puede ajustar persona por persona.
- **Baja** con fecha y motivo. La persona ya no puede entrar, pero su historial se conserva. Se puede reactivar.

Reglas de acceso acordadas (Issues #10 y #11):

| Regla | Detalle |
|---|---|
| Dinero | Solo administración y gerencia (permiso "Ver precios, montos e ingresos") ven precios, ingresos, presupuestos con monto y reportes. |
| Agenda del doctor | El personal clínico ve **solo su agenda**. Recepción, asistentes y gerencia ven la de todos. |
| Pacientes | Todo el personal clínico ve a **todos** los pacientes (por si atiende a uno de otro compañero). |
| Registro de consulta | Solo el doctor **que atiende la cita** la registra; nadie registra por otro. Recepción no registra consultas. |
| Recepción | Da de alta pacientes con datos generales (nombre, nacimiento, sexo, teléfono, correo, sucursal). **Ve** la alerta de alergias, pero **no** captura ni modifica datos clínicos. |
| Caja | Recepción solo ve el **monto a cobrar** de cada paciente; los totales, balance, egresos y corte son de gestión. |

### 2.3 Agenda
- Vistas **Día, Semana y Mes**. En el día hay una columna por **unidad**; se puede ver una, varias o todas las unidades.
- Filtro por sucursal y por doctor.
- Cada cita se ve dividida en dos: a la izquierda una **bandera del color del doctor**, el paciente, el tratamiento y el doctor; a la derecha el **estado** (por confirmar, confirmada, en sala, atendida, no asistió), que se cambia ahí mismo.
- **Arrastrar** una cita para cambiarla de hora o de unidad; **estirar** desde abajo para cambiar la duración. Cancelar o eliminar libera el espacio.
- La hora se elige de una lista **cada 30 minutos (solo :00 y :30)** que marca los horarios ocupados de la unidad (Issues #3, #9 y #15). Arrastrar una cita también la acomoda a :00 o :30. Las duraciones no cambian (15, 45, 75 min… siguen existiendo).
- **No se agenda en el pasado:** no se puede crear ni mover una cita a un día u hora que ya pasó (#14). Los días pasados se siguen viendo con todas sus citas; la parte que ya pasó se ve rayada.
- Arriba de la agenda: vista (Día/Semana/Mes) a la izquierda, sucursal y doctor fijos a la derecha y las unidades en su propio renglón (#13).
- No se permite empalmar dos citas en la misma unidad; si el doctor ya tiene otra cita **se avisa y quien agenda decide**. El aviso dice qué cita es: *"DRA. ANDREA GARZA LEAL ya tiene una cita de 10:00 a 10:50 (RESINA ESTÉTICA, JUAN PÉREZ) en UNIDAD 2"*.

### 2.4 Pacientes, resumen clínico e historial clínico
- Alta con número de expediente automático (KD-00001…) y nombre en mayúsculas. Si lo da de alta recepción, al doctor le llega un aviso para completar **alergias y antecedentes**.
- Búsqueda desde cualquier pantalla (barra superior, Ctrl + K).
- **Baja lógica.** El expediente nunca se borra (NOM-004-SSA3-2012: conservarlo al menos 5 años).
- Ficha del paciente con botón **Regresar** (Issue #4) y pestañas: Resumen, Resumen clínico, Historial clínico, Presupuestos, Pagos y Citas.
- **Resumen clínico:** todas las citas (agendadas, confirmadas, atendidas, no asistió) con la nota del doctor que atendió.
- **Historial clínico = odontograma mexicano** (numeración FDI, 5 caras por diente; rojo = por tratar, azul = realizado):
  - La dentición se detecta con la fecha de nacimiento: temporal (hasta 5 años), mixta (6 a 12) o permanente (13+).
  - El doctor marca caras (caries, resina, sellador) y el diente completo (extracción, ausente, endodoncia, corona, implante, fractura). Puede seleccionar varias piezas a la vez.
  - Cada hallazgo sugiere su tratamiento y se puede agregar al plan; de ahí se genera el presupuesto.
  - Queda una bitácora de cambios con fecha y doctor.
- **Registro de consulta** (Issue #8): solo si el paciente tiene cita ese día con ese doctor y no está marcada como "no asistió". Si la cita terminó hace más de 15 minutos sin registro, el doctor recibe un aviso. Lo realizado pasa a azul en el odontograma y lo recomendado queda en rojo y en el plan.
- **Barra de progreso** de tratamientos realizados contra presupuestados.

### 2.5 Presupuestos (gestión)
- Documento con folio, tratamientos por pieza, cantidad, precio, descuento, forma de pago (contado o mensualidades) y notas. Se genera desde el odontograma o desde cero.
- Flujo: borrador → enviado → aceptado → en tratamiento → completado · rechazado.
- Agregar, editar, imprimir y **exportar** (CSV).
- **Eliminar solo borradores** que nunca se enviaron al paciente. Uno enviado, aceptado o rechazado se **cancela** con motivo (queda registrado quién y cuándo) y sus tratamientos regresan al plan del paciente. "Rechazado" = el paciente dijo que no; "cancelado" = la clínica lo retira. Un presupuesto con pagos aplicados no se cancela hasta devolver o reasignar ese dinero.
- **Actividad reciente** del más antiguo al más reciente, sin los completados.

### 2.6 Caja
- Una cita atendida con registro del doctor aparece **por cobrar**; recepción revisa lo que se hizo y cobra (efectivo con cambio, tarjeta o transferencia).
- Entradas y salidas de dinero (compras, laboratorio, etc.).
- **Corte diario:** fondo inicial + cobros en efectivo − gastos en efectivo = efectivo esperado; se compara con el efectivo contado (sobrante o faltante). Tarjeta y transferencias se concilian aparte. Al cerrar, ese día ya no admite movimientos. Se puede imprimir.

### 2.7 Seguimiento
- Presupuestos sin respuesta, pacientes sin próxima cita, tratamientos aceptados sin agendar y tareas manuales. "Marcar realizado" los oculta 30 días.

### 2.8 Reportes (gestión)
- Periodos **semanal, mensual, trimestral y anual**, comparados con el mismo tramo del periodo anterior.
- Indicadores: **ventas, pacientes, ticket promedio y proyección de venta** al cierre del periodo.
- Gráficas: ingresos por día/semana/mes, ventas por categoría y **estado de los tratamientos** (terminados, activos en proceso, nuevos y diagnosticados sin atender).
- Rankings de tratamientos, doctores y sucursales. Exportar a CSV.

### 2.9 Inventario (gestión)
- Administración y gerencia ven existencias, mínimos, costos y proveedores; el personal clínico **solo solicita** material.
- Cada tratamiento del catálogo indica el material que consume.
- **Revisión cada miércoles:** proyección de material para una semana (miércoles a martes) con las citas agendadas. No se proyecta más de una semana porque las citas lejanas se pueden cancelar.
- Al registrar una consulta se descuenta el material usado.

### 2.10 Diseño
- Estilo del prototipo de Kenia (Manus): tonos petróleo, tarjetas suaves, menú con bloques **Principal** y **Gestión**, **modo día y noche**.
- Todos los nombres (pacientes, personal, tratamientos) en mayúsculas.
- En celular todo va en una columna; en tablet y computadora se acomoda a lo ancho con menú lateral.

## 3. Fases siguientes

**Fase 2**
- Inicio de sesión real con usuario y contraseña, y cambio obligatorio de contraseña al primer acceso.
- Recordatorios por **WhatsApp** (API oficial de WhatsApp Business):
  - Al paciente, 24 h antes, pidiendo confirmar o cancelar.
  - A la recepcionista y al doctor, 15 min antes.
- Abonos y pagos parciales de presupuestos en mensualidades.

**Fase 3**
- Historial clínico completo: radiografías y archivos, recetas, consentimientos firmados.
- Portal de KennaDent para dar de alta empresas.
- Cobro automático de la suscripción (Stripe o Mercado Pago).

## 4. Por definir con Kenia

- [ ] Nombre final del producto y dominio.
- [ ] Lista definitiva de **tipos de cita** y su duración.
- [ ] Material exacto que consume cada tratamiento (el de la demo es de ejemplo).
- [ ] Horario de la agenda por sucursal (hoy es de 8:00 a 20:00 para todas).
- [ ] ¿La mensualidad se cobra por sucursal, por doctor o con un precio fijo?
- [ ] Qué hacer cuando una cita no cabe en el espacio libre de la unidad (alerta, redondear la duración a bloques de 30 min o sugerir otra silla). Se decide después de más pruebas (#15).

Decidido (octubre 2026): el backend será Django + PostgreSQL (ver sección 5).

Decidido (septiembre 2026): la agenda es por unidad; el doctor ve solo su agenda y a todos los pacientes; solo gestión ve dinero; recepción no toca datos clínicos; "presupuestos" se queda con ese nombre.

Decidido (octubre 2026): citas solo a las :00 y :30; no se agenda en el pasado; al eliminar **o** cancelar una cita se pide motivo, la cita desaparece de la agenda y queda en el historial del paciente; puede hacerlo quien edita la agenda (v0.4.0, #18 y #19).

## 6. Decisiones de octubre 2026 (backend, seguridad y reglas)

Acordadas al revisar el documento de seguridad, privacidad y reglas del negocio.

**Cobro y presupuestos**
- El paciente paga **al salir de la cita** lo que se le hizo. Lo que está en un presupuesto **a plazos** se cobra por mensualidad, no por cita.
- Presupuestos: se eliminan solo los borradores; lo demás se cancela con motivo (ver 2.5).

**Acceso**
- **Inicio de sesión estándar para todos** (QA y producción): código de la clínica + usuario + contraseña. **Sin correos** (se quita la entrada por correo del backend).
- Contraseña inicial al azar. Mientras no la cambie, la persona **no puede usar nada más** (igual cuando el administrador la regenera).
- Contraseña olvidada: la regenera el administrador de la clínica.
- La sesión se cierra tras **30 minutos sin uso**.
- **"Acceso a todas las sucursales"** es un permiso: quien no lo tiene ve agenda, caja, inventario y reportes solo de las sucursales donde el administrador lo asignó. El **gerente** ve solo su sucursal en esos módulos; el directorio de pacientes sigue siendo de toda la empresa.
- Cobertura: el administrador asigna, cambia o retira las sucursales de cada persona.
- **Equipo de KennaDent:** puede ver expedientes de las clínicas para dar soporte, solo personas con nombre, y cada consulta de datos de una clínica queda registrada.

**Bitácora del sistema** (distinta del historial clínico)
- Registra entradas, quién vio o cambió qué paciente, cambios de permisos y correcciones de dinero.
- La leen administradores y gerentes (el gerente, solo lo de su sucursal). Se guarda **5 años**.

**Exportar expedientes**
- Uno por uno: cualquiera con permiso de ver historial.
- Todos a la vez: solo el administrador general, con segunda confirmación de contraseña, y siempre registrado en la bitácora.
- Formato: un PDF por paciente, todos dentro de un ZIP.

**Para después** (antes de producción)
- Todo lo legal (aviso de privacidad, consentimiento firmado, contrato con cada clínica, plan ante incidentes), respaldos, proveedor y país de los datos, verificación en 2 pasos.
- Condición: **ningún dato real de pacientes entra al sistema hasta cerrar lo legal.** En QA solo datos inventados.
- Las medidas técnicas de seguridad (conexión cifrada, HTTPS, gestor de secretos) las define el equipo técnico.

## 5. Notas técnicas

- **Prototipo actual:** HTML, CSS y JavaScript sin dependencias. Los datos son de ejemplo y se guardan en el navegador (`localStorage`), así que cada persona que lo abre ve su propia copia.
- **Producción (decidido, octubre 2026):** backend en **Django 5.2 LTS + Django REST Framework** sobre **PostgreSQL 16**, con *Row Level Security* para que ninguna empresa pueda ver datos de otra, autenticación real y respaldos. El frontend actual se conectará a la API (`/api/v1/`). Modelo de datos: `docs/modelo-datos/` (validación y propuesta v0.2, ya implementada como migraciones de Django en `backend/`).
- **Inicio de sesión:** código de la clínica + usuario (`demo` / `andrea.garza`) o correo. Pendiente de confirmar cuál se muestra en la pantalla de entrada.
- **Datos de salud:** cumplir con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, NOM-004-SSA3-2012 (expediente clínico) y NOM-024-SSA3-2012 (sistemas de información de registro electrónico para la salud). Esto incluye aviso de privacidad, cifrado y bitácora de quién consulta cada expediente.
- **Contraseñas:** en el prototipo se guardan tal cual para que el administrador las vea (Issue #6). En producción deben guardarse cifradas (*hash*); el administrador solo verá la contraseña inicial al crearla o regenerarla, y el empleado la cambiará al entrar por primera vez.
