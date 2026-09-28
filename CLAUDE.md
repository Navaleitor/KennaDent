# KennaDent: guía para Claude

## El proyecto
- **KennaDent** (nombre sujeto a cambio) es un software de gestión para clínicas dentales con varias sucursales, vendido por suscripción mensual. Es de **uso interno** de la clínica: los pacientes no entran al sistema.
- La dueña del producto es **Kenia**, dentista. El repositorio lo maneja su hermano, que no es programador: explicarle todo en español claro y sin tecnicismos innecesarios.
- Requisitos, fases y pendientes: `docs/requisitos.md`. Leerlo antes de proponer cambios de funcionalidad y mantenerlo actualizado cuando se tomen decisiones nuevas.

## Estado actual
- Prototipo navegable de la **Fase 1**: HTML, CSS y JavaScript sin dependencias ni compilación, publicado con GitHub Pages desde `main`.
- Los datos son de ejemplo (`js/data.js`) y se guardan en `localStorage`. Si cambia la estructura de los datos, subir `STORAGE_KEY` para que se regeneren.
- Los scripts son clásicos (no módulos ES) para que funcione abriendo `index.html` con doble clic. Todo cuelga de `window.KD`.
- Todo texto que venga de datos se escapa con `KD.esc()` antes de meterlo en `innerHTML`.
- Producción futura recomendada: Next.js + Supabase (Row Level Security para separar empresas). Considerar LFPDPPP, NOM-004-SSA3-2012 y NOM-024-SSA3-2012 (datos de salud).

## Estructura
- `js/roles.js`: puestos y permisos. `js/data.js`: datos y almacenamiento. `js/metricas.js`: estadísticas. `js/ui.js`: modales, avisos e íconos. `js/app.js`: menú, barra y rutas (`#/seccion`).
- `js/views/*.js`: una pantalla por archivo, registrada en `KD.vistas`.
- `css/app.css`: tokens de color en `:root`, con modo noche por `prefers-color-scheme` y `[data-theme="dark"]`. Estilo sobrio y empresarial.

## Forma de trabajo
- **Cada entrega va en un pull request hacia `main`.** Nunca hacer push directo a `main` ni hacer merge sin que el usuario lo pida.
- **Versiones**: versionado semántico 0.x mientras sea prototipo. Entrega grande → sube el segundo número (0.3.0); corrección → el tercero (0.2.1). En cada PR:
  - Actualizar `CHANGELOG.md`.
  - Actualizar la versión en el menú lateral (`index.html`, `.sidebar-pie`) y en el `README.md`.
  - Poner la versión en el título del PR.
- **Bugs y mejoras** llegan como Issues de GitHub (hay plantillas en `.github/ISSUE_TEMPLATE`). El PR que lo arregla debe decir "Corrige #N" para que el Issue se cierre solo al hacer merge.
- **Antes de subir cambios**, probar en Chromium (Playwright ya está instalado) en computadora (~1366 px) y celular (~390 px), en modo día y noche:
  - que no haya errores de JavaScript;
  - que no haya scroll horizontal;
  - que funcionen los flujos tocados.
- Probar los permisos cambiando de usuario de demostración (clic en el nombre, arriba a la derecha).
