# KennaDent

Sistema de gestión para clínicas dentales con varias sucursales: agenda, pacientes con historial clínico, presupuestos, personal con permisos y estadísticas.

> **Estado: prototipo navegable de la Fase 1.** Usa datos de ejemplo guardados en el navegador. Sirve para validar pantallas y flujos antes de construir la versión con base de datos real.

Requisitos completos, fases y pendientes por definir: [`docs/requisitos.md`](docs/requisitos.md)

## Secciones

| Sección | Qué incluye |
|---|---|
| **Inicio** | Citas del día, ventas del mes, tratamientos más vendidos y pacientes con mayor presupuesto pendiente |
| **Agenda** | Vista por día con columnas por doctor; alta de citas, estados y aviso de empalmes |
| **Pacientes** | Expedientes compartidos entre sucursales, alta/baja, historial clínico, plan de tratamiento y registro de consultas |
| **Presupuestos** | Pacientes ordenados por monto de tratamientos pendientes, con contacto por WhatsApp |
| **Estadísticas** | Ranking de tratamientos, doctores, sucursales y áreas |
| **Personal** | Alta y baja de trabajadores por puesto, sucursales y permisos por casilla |
| **Empresa** | Datos fiscales, sucursales, catálogo de tratamientos y precios, tipos de cita |

Tiene modo día/noche (botón de luna o sol) y se adapta a celular, tablet y computadora.

## Cómo probarlo

- **En línea:** https://navaleitor.github.io/KennaDent/ (con GitHub Pages activado sobre `main`)
- **En tu computadora:** descarga el repositorio y abre `index.html` con doble clic.

Para ver el sistema como otro trabajador (recepcionista, pasante, doctor…), haz clic en tu nombre arriba a la derecha y elige a otra persona. Desde ahí también puedes **restablecer los datos de ejemplo**.

## Estructura

```
index.html            Estructura de la aplicación
css/app.css           Estilos, modo día/noche y diseño responsive
js/roles.js           Puestos y permisos
js/data.js            Datos de ejemplo y almacenamiento en el navegador
js/metricas.js        Cálculo de rankings y estadísticas
js/ui.js              Componentes: ventanas, avisos, íconos
js/app.js             Menú, barra superior y navegación
js/views/*.js         Una pantalla por archivo
docs/requisitos.md    Requisitos, fases y pendientes
```

Los nombres, teléfonos, precios y cifras son de ejemplo.
