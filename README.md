# KennaDent

Sistema de gestión para clínicas dentales con varias sucursales: agenda por unidad, pacientes con odontograma, presupuestos, caja, inventario, personal con permisos y reportes.

> **Estado: prototipo navegable de la Fase 1.** Usa datos de ejemplo guardados en el navegador. Sirve para validar pantallas y flujos antes de construir la versión con base de datos real.

Requisitos completos, fases y pendientes por definir: [`docs/requisitos.md`](docs/requisitos.md)

## Secciones

**Principal** (operación diaria)

| Sección | Qué incluye |
|---|---|
| **Dashboard** | Citas del día, ingresos, presupuestos pendientes, oportunidades, actividad de la semana y disponibilidad del equipo |
| **Agenda** | Por unidad (sillón): vistas día, semana y mes; arrastrar para mover, estirar para cambiar duración; color por doctor y estado de cada cita |
| **Pacientes** | Directorio compartido entre sucursales; ficha con resumen, resumen clínico, odontograma mexicano, presupuestos, pagos y citas |
| **Seguimiento** | Presupuestos sin respuesta, pacientes sin próxima cita y tratamientos por continuar |
| **Caja** | Cobro de pacientes atendidos, entradas y salidas, corte diario |
| **Solicitar material** | Para el personal clínico: pedir material al almacén |

**Gestión** (administración y gerencia)

| Sección | Qué incluye |
|---|---|
| **Presupuestos** | Flujo de presupuestos, exportar, imprimir y eliminar |
| **Reportes** | Semanal, mensual, trimestral y anual: ventas, pacientes, ticket promedio, proyección y estado de los tratamientos |
| **Inventario** | Existencias, revisión de los miércoles con proyección de una semana y solicitudes del personal |
| **Tratamientos** | Catálogo con precio, duración y material que consume |
| **Personal** | Alta y baja, usuario y contraseña automáticos, color en la agenda y permisos |
| **Empresa** | Datos fiscales, sucursales con sus unidades y tipos de cita |

Tiene modo día/noche (botón de luna o sol) y se adapta a celular, tablet y computadora.

## Cómo probarlo

- **En línea:** https://navaleitor.github.io/KennaDent/ (con GitHub Pages activado sobre `main`)
- **En tu computadora:** descarga el repositorio y abre `index.html` con doble clic.
- **Entorno de pruebas con base de datos y backend (QA):** `docker compose up -d --build` levanta PostgreSQL, el backend Django (API en `/api/v1/` y admin de plataforma), pgAdmin y el prototipo, con datos de demostración de dos clínicas. Guía paso a paso: [`docs/entorno-local.md`](docs/entorno-local.md).

Para ver el sistema como otro trabajador (recepcionista, doctor, caja…), haz clic en tu nombre arriba a la derecha y elige a otra persona. Por ejemplo, **DRA. ANDREA GARZA LEAL** (doctora), **DANIELA FLORES ROJAS** (recepción) o **CARLOS MARTÍNEZ VEGA** (gerente). Desde ahí también puedes **restablecer los datos de ejemplo**.

## Estructura

```
index.html            Estructura de la aplicación
css/app.css           Estilos, modo día/noche y diseño responsive
js/roles.js           Puestos y permisos
js/data.js            Datos de ejemplo, almacenamiento en el navegador y reglas (caja, inventario, avisos)
js/odonto.js          Odontograma mexicano: piezas, hallazgos y dibujo
js/metricas.js        Reportes, rankings y centro de seguimiento
js/ui.js              Componentes: ventanas, menús, avisos, íconos y gráficas
js/app.js             Menú, barra superior y navegación
js/views/*.js         Una pantalla por archivo
docs/requisitos.md    Requisitos, fases y pendientes
docs/modelo-datos/    Modelo de datos: esquemas SQL, informe de validación y pruebas
docs/entorno-local.md Guía del entorno local de pruebas (Docker)
backend/              Backend Django: modelos, migraciones, API y pruebas
docker-compose.yml    Entorno local: base de datos, backend, pgAdmin y prototipo
infra/local/          nginx, usuario de la base y configuración de pgAdmin
```

Los nombres, teléfonos, precios y cifras son de ejemplo.

## Versiones

Versión actual: **0.3.0**. Cada entrega llega como pull request, se anota en [`CHANGELOG.md`](CHANGELOG.md) y, al unirse a `main`, se marca con una etiqueta (`v0.2.0`, `v0.3.0`…).

## Reportar bugs o proponer mejoras

En la pestaña **Issues** del repositorio → **New issue** → elige "Reportar un bug" o "Proponer una mejora". Puedes arrastrar capturas directo al formulario.
