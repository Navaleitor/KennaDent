# KennaDent: guía para Claude

## El proyecto
- **KennaDent** (nombre sujeto a cambio) es un software de gestión para clínicas dentales con varias sucursales, vendido por suscripción mensual. Es de **uso interno** de la clínica: los pacientes no entran al sistema.
- La dueña del producto es **Kenia**, dentista. El repositorio lo maneja su hermano, que no es programador: explicarle todo en español claro y sin tecnicismos innecesarios.
- **Las decisiones de él valen lo mismo que las de Kenia.** Lo que cualquiera de los dos decide y queda anotado es definitivo: no pedir que el otro lo confirme.
- Requisitos, fases y pendientes: `docs/requisitos.md`. Leerlo antes de proponer cambios de funcionalidad y mantenerlo actualizado cuando se tomen decisiones nuevas.

## Estado actual
- Prototipo navegable de la **Fase 1**: HTML, CSS y JavaScript sin dependencias ni compilación, publicado con GitHub Pages desde `main`.
- Los datos son de ejemplo (`js/data.js`) y se guardan en `localStorage` en formato por columnas (`empacar`/`desempacar`) para caber en ~2.5 MB (límite de Safari en iPad). Si cambia la estructura de los datos, subir `STORAGE_KEY` (hoy `kennadent-demo-v6`) y agregar la anterior a `LLAVES_VIEJAS`.
- Los campos vacíos (`""`) no se guardan: al leer, tratarlos como opcionales (`KD.esc` ya acepta `undefined`).
- Los scripts son clásicos (no módulos ES) para que funcione abriendo `index.html` con doble clic. Todo cuelga de `window.KD`.
- Todo texto que venga de datos se escapa con `KD.esc()` antes de meterlo en `innerHTML`.
- **Frontend real: React + TypeScript en `frontend/`** (decidido en octubre de 2026, v0.6.0; **fase F0 hecha en v0.7.0**). La estructura, las reglas y las fases están en `docs/frontend.md`: seguirla en todo trabajo de frontend nuevo. El prototipo (`index.html`, `js/`, `css/`) queda como demo y referencia de diseño y reglas; no se conecta a la API.
  - Corre en Docker (servicio `frontend`, Vite con recarga en vivo): http://localhost:8080/app/. No hay Node en la computadora: todo comando de npm va por `docker compose exec frontend ...`.
  - Tipos de la API **generados** (`src/api/esquema.d.ts`, nunca a mano): si cambia la API, regenerarlos (`docs/entorno-local.md`, "Tipos de la API"). GitHub Actions falla si quedaron viejos.
  - Permisos solo con `usePuede("permiso")` (`src/utilidades/permisos.ts`); errores de la API tal cual (`src/api/cliente.ts`); nunca `dangerouslySetInnerHTML` (ESLint lo prohíbe).
  - Pruebas: `docker compose exec frontend npm run revisar` (tipos, ESLint, Prettier), `docker compose exec frontend npm test` (Vitest) y `docker compose run --rm pruebas-pantallas` (Playwright: flujos y 1366/1024/390 px en día y noche; capturas en `frontend/pruebas/capturas/`). Correrlas antes de subir cambios del frontend.
- **Backend: Django 5.2 LTS + Django REST Framework + PostgreSQL 16** (decidido en octubre de 2026). Vive en `backend/`; el prototipo todavía no lo consume.
  - **El esquema lo definen las migraciones de Django** (`backend/nucleo/migrations/`). `docs/modelo-datos/kennadent_esquema_v0.2.sql` queda como especificación; `pruebas/pruebas_django.sql` comprueba que el esquema de Django se comporta igual.
  - Lo que el ORM no sabe declarar (llaves compuestas `(empresa_id, x_id)`, triggers, vistas, Row Level Security, permisos de `kd_app`) va en migraciones `RunSQL` (ver `0002_base_de_datos.py`). Toda tabla nueva de un cliente hereda de `DeEmpresa` y necesita su política RLS y sus llaves compuestas en una migración nueva.
  - **Multiempresa:** cada petición corre en una transacción como el rol `kd_app` con `app.empresa_id` fijado (`nucleo/empresa_actual.py`). No confiar en filtrar por empresa en el código: lo hace PostgreSQL. El backend se conecta como `kd_app`; solo migraciones y `cargar_demo` usan el dueño de las tablas (`KD_DB_ROL=admin`).
  - Las reglas que rechaza la base se traducen a mensajes en `nucleo/api/errores.py` (guardar con `guardar_con_reglas()`).
  - Permisos por persona (`trabajador_permiso`), igual que en `js/roles.js`: cada vista declara `permisos_por_accion`.
  - Pruebas: `docker compose exec -e KD_DB_ROL=admin api python manage.py test nucleo` (o con `backend/.venv` contra el PostgreSQL local). Correrlas antes de subir cambios del backend.
  - Sin sesión la API responde **401**; los errores traen `detail` (mensaje en español, con acentos) y `codigo` (ej. `cambiar_password`). Esquema OpenAPI en `/api/v1/esquema/` (solo con sesión).
- **Entorno local de QA** (`docker-compose.yml`, guía en `docs/entorno-local.md`): PostgreSQL 16 en `localhost:5433`, backend, prototipo y frontend nuevo en `localhost:8080` (nginx: `/` prototipo, `/app/` frontend nuevo, `/api` y `/admin` Django), pgAdmin en `:5050`. El disco de Docker vive en `D:\Docker\wsl` (el disco C: se llenó en octubre de 2026): no guardar nada pesado en C:. Datos ficticios de dos empresas en `backend/nucleo/sql/datos_demo.sql`, cargados por `python manage.py cargar_demo`. Si cambias el esquema o la demo: `docker compose down -v && docker compose up -d --build` y revisa `docker compose logs api`. Nunca datos reales de pacientes en QA.
- Considerar LFPDPPP, NOM-004-SSA3-2012 y NOM-024-SSA3-2012 (datos de salud): el expediente y los libros de dinero no se borran (triggers `tg_no_borrar`) y la consulta de expedientes queda en `bitacora`.

## Estructura
- `js/roles.js`: puestos, permisos y paleta de colores del equipo. `js/data.js`: datos, almacenamiento y reglas (registro de consulta, caja, inventario, avisos). `js/odonto.js`: odontograma. `js/metricas.js`: reportes y seguimiento. `js/ui.js`: modales, menús, avisos, íconos y gráficas. `js/app.js`: menú (Principal/Gestión), barra y rutas (`#/seccion`).
- `js/views/*.js`: una pantalla por archivo, registrada en `KD.vistas`.
- `frontend/`: React + TypeScript (`docs/frontend.md` §3): `src/app/` (rutas, menú, diseño), `src/api/` (cliente, tipos generados, consultas), `src/modulos/` (una carpeta por sección), `src/estilos/tokens.css` (copia de los tokens de `css/app.css`: si cambia un color, cambiarlo en los dos), `pruebas/` (Playwright).
- `backend/`: Django. `kennadent/settings.py` (todo por variables `KD_*`), `nucleo/models/` (tablas), `nucleo/migrations/`, `nucleo/api/` (vistas, serializadores, permisos), `nucleo/tests/`.
- `docs/modelo-datos/`: modelo de datos (esquemas, informe de validación y pruebas SQL). `infra/local/`: nginx, usuario `kd_app` de la base y pgAdmin para el entorno local.
- `css/app.css`: tokens de color en `:root`, con modo noche por `prefers-color-scheme` y `[data-theme="dark"]`. Estilo sobrio y empresarial.

## Reglas del negocio (acordadas con el usuario)
- **Nombres en mayúsculas** (pacientes, personal, tratamientos): usar `KD.mayus()` al guardar. Personal clínico con `titulo` lleva "DR." / "DRA." según el sexo (`KD.nombrePersona`).
- **Dinero** solo con el permiso `dinero` (`KD.verDinero()`): no mostrar precios, montos ni ingresos sin él (la excepción es el monto a cobrar de cada paciente, que recepción sí ve para cobrar; requisitos §2.2).
- **Quién atiende pacientes se decide por persona** (`KD.atiende`; en la API, `trabajador.atiende`): sale marcado según el puesto y se puede activar, por ejemplo, a un administrador que también es dentista. Solo quien atiende aparece como doctor y puede tener citas a su nombre.
- La agenda es **por unidad** (sillón): nunca dos citas en la misma unidad a la vez (`choqueUnidad`). Sin `agenda_todas`, el usuario ve solo sus citas.
- Al **cancelar o eliminar** una cita se pide motivo (`KD.pedirMotivo`) y se guarda quién y cuándo. La cancelada queda en `citas` con `cancelacion`; la eliminada pasa a `citasEliminadas` con `eliminacion`. Las dos salen de la agenda y se ven en el historial del paciente. En la base **ninguna cita se borra**: quedan con estado `cancelada` o `eliminada` y `baja_motivo`/`baja_por`/`baja_en` (`POST /api/v1/citas/{id}/cancelar/` o `/eliminar/`).
- Al crear o mover una cita solo se ofrecen horarios a las :00 y :30 (`AG_PASO`), sin pasado y con al menos una unidad libre. Si el **doctor** ya tiene otra cita a esa hora, **se avisa diciendo cuál es y quien agenda decide** (`avisoDoctor`; en la API, `confirmar_empalme`). Decidido en octubre 2026 (v0.6.0).
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
- **Bugs y mejoras** llegan como Issues de GitHub (hay plantillas en `.github/ISSUE_TEMPLATE`). El PR que lo arregla debe decir **"Fixes #N"** (una línea por Issue): GitHub solo reconoce las palabras en inglés para cerrar el Issue solo al hacer merge.
- **Antes de subir cambios**, probar en Chromium (Playwright ya está instalado; para el frontend nuevo, `docker compose run --rm pruebas-pantallas`) en computadora (~1366 px), iPad (~1024 px, frontend nuevo) y celular (~390 px), en modo día y noche:
  - que no haya errores de JavaScript;
  - que no haya scroll horizontal;
  - que funcionen los flujos tocados.
- Probar los permisos cambiando de usuario de demostración (clic en el nombre, arriba a la derecha).
- **Agentes de revisión** (`.claude/agents/`). **Antes de abrir cada PR** (y antes de unirlo) se corre **`/revision`**: el agente `revision` mira qué cambió respecto a `main`, lanza solo los agentes que aplican y entrega un solo reporte con el semáforo más grave arriba (🔴 bloquea · ⚪ no se pudo probar · 🟡 conviene arreglar · 🟢 bien). Los agentes **solo reportan**: nunca corrigen código, abren PRs ni los unen. Todos son de solo lectura: el hook `.claude/hooks/solo_lectura.py` bloquea cualquier comando que no sea de consulta (y aprueba solo los de consulta, sin pedir permiso).

  | Agente | Modelo | Qué revisa | Cuándo lo lanza `/revision` |
  |---|---|---|---|
  | `revisor-pr` | haiku | CHANGELOG, versión en `index.html` y `README.md`, versión en el título del PR, "Fixes #N", sin firmas de Claude | siempre |
  | `docs-al-dia` | sonnet | contradicciones entre documentos y entre documentos y código (cita las dos partes, no decide) | siempre |
  | `reglas-negocio` | opus | cambios contra las reglas de `docs/requisitos.md` y de este archivo; lo decidido y no programado sale 🟡 "pendiente conocido" | si cambia backend, pantallas o documentos de reglas |
  | `seguridad-datos` | opus | aislamiento entre clínicas (RLS, llaves compuestas, `kd_app`), permisos por vista, secretos, migraciones nuevas; consulta la base de QA solo en lectura | si cambia el backend |
  | `qa-backend` | sonnet | pruebas de la API (22) y pruebas SQL (29 rechazos) en Docker; la verificación desde cero (`down -v`) solo si se pide, porque borra los datos ficticios de QA | si cambia el backend |
  | `qa-pantallas` | sonnet | frontend nuevo: tipos, ESLint y Prettier, Vitest y Playwright (flujos y 1366/1024/390 px en día y noche) y revisa las capturas | si cambia `frontend/`, `docker-compose.yml` o nginx |

  Cada agente también se puede usar solo ("usa el agente seguridad-datos"). Para pasarle a `/revision` el título y la descripción del PR: `/revision <título y descripción>`.
  **Faltan por agregar:** `paridad-prototipo` con la F1 del frontend nuevo (`docs/frontend.md`) y `preproduccion-legal` al preparar producción (§6 "Para después").
- **Sin firmas de Claude**: no poner al final de commits, pull requests, Issues ni comentarios textos como "Generated with Claude Code", "Generated by Claude Code", "Co-Authored-By: Claude" ni enlaces a la sesión.
