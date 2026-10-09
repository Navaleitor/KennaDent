# KennaDent: guía para Claude

## El proyecto
- **KennaDent** (nombre sujeto a cambio) es un software de gestión para clínicas dentales con varias sucursales, vendido por suscripción mensual. Es de **uso interno** de la clínica: los pacientes no entran al sistema.
- La dueña del producto es **Kenia**, dentista. El repositorio lo maneja su hermano, que no es programador: explicarle todo en español claro y sin tecnicismos innecesarios.
- Requisitos, fases y pendientes: `docs/requisitos.md`. Leerlo antes de proponer cambios de funcionalidad y mantenerlo actualizado cuando se tomen decisiones nuevas.

## Estado actual
- Prototipo navegable de la **Fase 1**: HTML, CSS y JavaScript sin dependencias ni compilación, publicado con GitHub Pages desde `main`.
- Los datos son de ejemplo (`js/data.js`) y se guardan en `localStorage` en formato por columnas (`empacar`/`desempacar`) para caber en ~2.5 MB (límite de Safari en iPad). Si cambia la estructura de los datos, subir `STORAGE_KEY` (hoy `kennadent-demo-v4`) y agregar la anterior a `LLAVES_VIEJAS`.
- Los campos vacíos (`""`) no se guardan: al leer, tratarlos como opcionales (`KD.esc` ya acepta `undefined`).
- Los scripts son clásicos (no módulos ES) para que funcione abriendo `index.html` con doble clic. Todo cuelga de `window.KD`.
- Todo texto que venga de datos se escapa con `KD.esc()` antes de meterlo en `innerHTML`.
- **Backend: Django 5.2 LTS + Django REST Framework + PostgreSQL 16** (decidido en octubre de 2026). Vive en `backend/`; el prototipo todavía no lo consume.
  - **El esquema lo definen las migraciones de Django** (`backend/nucleo/migrations/`). `docs/modelo-datos/kennadent_esquema_v0.2.sql` queda como especificación; `pruebas/pruebas_django.sql` comprueba que el esquema de Django se comporta igual.
  - Lo que el ORM no sabe declarar (llaves compuestas `(empresa_id, x_id)`, triggers, vistas, Row Level Security, permisos de `kd_app`) va en migraciones `RunSQL` (ver `0002_base_de_datos.py`). Toda tabla nueva de un cliente hereda de `DeEmpresa` y necesita su política RLS y sus llaves compuestas en una migración nueva.
  - **Multiempresa:** cada petición corre en una transacción como el rol `kd_app` con `app.empresa_id` fijado (`nucleo/empresa_actual.py`). No confiar en filtrar por empresa en el código: lo hace PostgreSQL. El backend se conecta como `kd_app`; solo migraciones y `cargar_demo` usan el dueño de las tablas (`KD_DB_ROL=admin`).
  - Las reglas que rechaza la base se traducen a mensajes en `nucleo/api/errores.py` (guardar con `guardar_con_reglas()`).
  - Permisos por persona (`trabajador_permiso`), igual que en `js/roles.js`: cada vista declara `permisos_por_accion`.
  - Pruebas: `docker compose exec -e KD_DB_ROL=admin api python manage.py test nucleo` (o con `backend/.venv` contra el PostgreSQL local). Correrlas antes de subir cambios del backend.
- **Entorno local de QA** (`docker-compose.yml`, guía en `docs/entorno-local.md`): PostgreSQL 16 en `localhost:5433`, backend y prototipo en `localhost:8080` (nginx: `/` prototipo, `/api` y `/admin` Django), pgAdmin en `:5050`. Datos ficticios de dos empresas en `backend/nucleo/sql/datos_demo.sql`, cargados por `python manage.py cargar_demo`. Si cambias el esquema o la demo: `docker compose down -v && docker compose up -d --build` y revisa `docker compose logs api`. Nunca datos reales de pacientes en QA.
- Considerar LFPDPPP, NOM-004-SSA3-2012 y NOM-024-SSA3-2012 (datos de salud): el expediente y los libros de dinero no se borran (triggers `tg_no_borrar`) y la consulta de expedientes queda en `bitacora`.

## Estructura
- `js/roles.js`: puestos, permisos y paleta de colores del equipo. `js/data.js`: datos, almacenamiento y reglas (registro de consulta, caja, inventario, avisos). `js/odonto.js`: odontograma. `js/metricas.js`: reportes y seguimiento. `js/ui.js`: modales, menús, avisos, íconos y gráficas. `js/app.js`: menú (Principal/Gestión), barra y rutas (`#/seccion`).
- `js/views/*.js`: una pantalla por archivo, registrada en `KD.vistas`.
- `backend/`: Django. `kennadent/settings.py` (todo por variables `KD_*`), `nucleo/models/` (tablas), `nucleo/migrations/`, `nucleo/api/` (vistas, serializadores, permisos), `nucleo/tests/`.
- `docs/modelo-datos/`: modelo de datos (esquemas, informe de validación y pruebas SQL). `infra/local/`: nginx, usuario `kd_app` de la base y pgAdmin para el entorno local.
- `css/app.css`: tokens de color en `:root`, con modo noche por `prefers-color-scheme` y `[data-theme="dark"]`. Estilo sobrio y empresarial.

## Reglas del negocio (acordadas con el usuario)
- **Nombres en mayúsculas** (pacientes, personal, tratamientos): usar `KD.mayus()` al guardar. Personal clínico con `titulo` lleva "DR." / "DRA." según el sexo (`KD.nombrePersona`).
- **Dinero** solo con el permiso `dinero` (`KD.verDinero()`): no mostrar precios, montos ni ingresos sin él.
- La agenda es **por unidad** (sillón): nunca dos citas en la misma unidad a la vez (`choqueCita`). Sin `agenda_todas`, el usuario ve solo sus citas.
- La consulta solo la registra el doctor de la cita, ese día (`KD.puedeRegistrar`). Recepción no toca datos clínicos (`clinico_editar`).
- Odontograma: rojo = por tratar, azul = realizado. Lo realizado en una consulta pasa a azul (`KD.odontoRealizado`).
- Inventario: la proyección es de una semana, de miércoles a martes (`KD.cicloInventario`).
- Decisiones de octubre 2026 (`docs/requisitos.md`, sección 6): se cobra al salir de la cita (lo que está a plazos, por mensualidad); presupuestos: solo se eliminan borradores, lo demás se cancela con motivo; inicio de sesión = clínica + usuario + contraseña, sin correos; contraseña inicial al azar que bloquea todo hasta cambiarla; sesión de 30 min sin uso; gerente solo ve su sucursal (agenda, caja, inventario, reportes, bitácora); el equipo de KennaDent ve expedientes con cada acceso registrado; exportar todos los expedientes solo el administrador general. **Ningún dato real de pacientes antes de cerrar lo legal.**

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
- **Sin firmas de Claude**: no poner al final de commits, pull requests, Issues ni comentarios textos como "Generated with Claude Code", "Generated by Claude Code", "Co-Authored-By: Claude" ni enlaces a la sesión.
