# Historial de versiones

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [versionado semántico](https://semver.org/lang/es/):

- **0.x.y**: prototipo (todavía sin base de datos real).
- El segundo número (**x**) sube con cada entrega grande; el tercero (**y**) con correcciones.
- La **1.0.0** será la primera versión lista para usarse con clínicas reales.

## [0.3.0] - 2026-09-29
Rediseño con el estilo del prototipo de Kenia (Manus) y nuevas secciones. Corrige los Issues #3 al #11.

### Agregado
- **Diseño nuevo**: tonos petróleo, tarjetas suaves y encabezados con etiqueta. El menú lateral se divide en **Principal** y **Gestión**. Barra superior con buscador de pacientes (Ctrl + K), campana de avisos y modo día/noche.
- **Dashboard** (antes "Inicio"):
  - saludo y tarjetas de cifras;
  - próximas citas del día y oportunidades de seguimiento;
  - actividad de la semana y disponibilidad del equipo con la ocupación de las unidades.
- **Agenda por unidad (sillón dental)**:
  - vistas Día, Semana y Mes;
  - filtro por una, varias o todas las unidades y por doctor;
  - cada cita lleva la bandera del color del doctor y, del lado derecho, su estado editable;
  - se arrastra para moverla y se estira para cambiar su duración;
  - se cancela o elimina para liberar el espacio;
  - una unidad no admite dos pacientes a la vez.
- **Empresa**: número de unidades por sucursal; tipos de cita que piden tratamiento y piezas, o que son de diagnóstico.
- **Colores del equipo**: cada integrante tiene un color de la paleta de Kenia (agenda y avatar).
- **Odontograma mexicano** (pestaña "Historial clínico"):
  - numeración FDI con 5 caras por diente: rojo = por tratar, azul = realizado;
  - dentición temporal, mixta o permanente detectada por la edad;
  - selección de varias piezas a la vez y tratamiento sugerido por pieza;
  - "Agregar al plan" y "Generar presupuesto";
  - bitácora de cambios con fecha y doctor.
- **Resumen clínico** (antes "Historial clínico"): todas las citas con su estado y la nota del doctor.
- **Barra de progreso** de tratamientos realizados contra presupuestados.
- **Presupuestos** (Gestión):
  - folio, tratamientos por pieza, descuento, contado o mensualidades, notas;
  - flujo borrador → enviado → aceptado → en tratamiento → completado;
  - exportar a CSV, imprimir y eliminar;
  - actividad reciente del más antiguo al más reciente, sin completados.
- **Caja**:
  - las citas atendidas quedan por cobrar;
  - cobro en efectivo (con cambio), tarjeta o transferencia;
  - entradas y salidas de dinero;
  - **corte diario** con arqueo de efectivo, que cierra el día.
- **Seguimiento**: presupuestos sin respuesta, pacientes sin próxima cita, tratamientos aceptados sin agendar y tareas propias.
- **Reportes**:
  - periodos semanal, mensual, trimestral y anual;
  - ventas, pacientes, ticket promedio y proyección de venta;
  - gráfica de ingresos, ventas por categoría y estado de los tratamientos (terminados, activos, nuevos, diagnosticados);
  - rankings y exportación.
- **Inventario** (Gestión):
  - existencias, mínimos, costos y proveedores;
  - revisión de los miércoles con proyección de una semana (miércoles a martes) según las citas;
  - lista de compra y solicitudes del personal.
  - El doctor tiene la pantalla "Solicitar material". Al registrar una consulta se descuenta el material usado.
- **Tratamientos** (Gestión): catálogo propio con editar y eliminar en cada renglón (si ya tiene historial, se desactiva) y el material que consume.

### Cambiado
- Todos los nombres (pacientes, personal, tratamientos) se guardan y muestran en **mayúsculas**.
- **Solo administración y gerencia ven dinero** (precios, ingresos, presupuestos con monto, reportes) (#10).
- El doctor ve **solo su agenda** y a todos los pacientes; solo puede registrar consultas de las citas que él atiende (#10).
- La recepcionista captura solo datos generales del paciente; ve la alerta de alergias pero no edita datos clínicos (#11).
- La consulta solo se registra si hay cita ese día y el paciente asistió. Si pasan 15 minutos del final de la cita sin registro, el doctor recibe un aviso (#8).
- Personal:
  - usuario `nombre.apellido` (o el segundo apellido si ya existe) y contraseña `nombreapellido` + 3 números, visibles para el administrador (#6);
  - prefijo **Dr./Dra.** según el sexo (#7).
- "Estadísticas" ahora se llama "Reportes".
- Los datos de ejemplo cubren desde enero y se guardan compactos para caber en el iPad. Los datos anteriores se regeneran.

### Corregido
- No se podía elegir la hora al agendar desde Agenda ni desde Pacientes: ahora es una lista cada 15 minutos que marca los horarios ocupados (#3, #9).
- La ficha del paciente no tenía botón para regresar (#4).
- La ventana de alta de personal se cortaba y no dejaba llegar al botón de guardar (#5).

## [0.2.0] - 2026-09-28
### Agregado
- Prototipo navegable de la **Fase 1** del sistema interno para clínicas:
  - Inicio, Agenda, Pacientes, Presupuestos, Estadísticas, Personal y Empresa.
  - Expediente del paciente compartido entre sucursales, con historial clínico y plan de tratamiento.
  - Registro de consulta: qué se hizo, pieza dental, monto y tratamientos recomendados.
  - Rankings de tratamientos, doctores, sucursales y áreas.
  - Alta y baja de personal con 12 puestos y permisos por casilla.
  - Cambio de usuario de demostración para probar permisos.
- Diseño empresarial con modo día/noche, adaptable a celular, tablet y computadora.
- `docs/requisitos.md` con requisitos, fases y pendientes por definir.
- Plantillas de Issues para reportar bugs y proponer mejoras.
- `CLAUDE.md` con el contexto del proyecto y la forma de trabajo, para las próximas sesiones.

### Eliminado
- Página informativa para pacientes de la v0.1.0: el sistema es de uso interno.

## [0.1.0] - 2026-09-28
### Agregado
- Página informativa de una clínica dental (servicios, contacto y formulario por WhatsApp).
