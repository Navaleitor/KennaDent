# Historial de versiones

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [versionado semántico](https://semver.org/lang/es/):

- **0.x.y**: prototipo (todavía sin base de datos real).
- El segundo número (**x**) sube con cada entrega grande; el tercero (**y**) con correcciones.
- La **1.0.0** será la primera versión lista para usarse con clínicas reales.

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
