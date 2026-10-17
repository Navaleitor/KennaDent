# Frontend de KennaDent (React + TypeScript)

> Decidido en octubre de 2026 (v0.6.0): el sistema real se construye con un **frontend nuevo en React + TypeScript**, conectado a la API de Django. Es la base para muchas clínicas, muchas personas y uso en línea. El prototipo actual (`index.html`, `js/`, `css/`) se conserva como **demo** y como **referencia de diseño y reglas**, pero no se conecta a la API.
>
> Este documento es la estructura que se usa de aquí en adelante. Si algo cambia, se cambia aquí primero.

## En pocas palabras

- **No se empieza de cero en diseño ni en reglas.** Colores, estilo, pantallas, flujos y reglas ya están probados en el prototipo; se copian. Lo que se reescribe es el código de las pantallas.
- **Los datos viven en la base, no en el navegador.** Todo se pide a la API (`/api/v1/`), así que cualquier persona de la clínica ve lo mismo desde su computadora, tablet o celular.
- **Se construye por partes**, una por pull request: primero la base y la entrada, luego pacientes, luego agenda, y así cada módulo conforme exista su parte en la API.
- **Se usa principalmente en iPad** (recepción y consultorio), además de computadora y celular. Se puede "agregar a la pantalla de inicio" como una app.

## 1. Tecnología

| Pieza | Elección | Para qué |
|---|---|---|
| Lenguaje | **TypeScript** en modo estricto | Detecta errores antes de que lleguen a la clínica |
| Interfaz | **React** | Pantallas por componentes reutilizables |
| Herramienta | **Vite** | Servidor de desarrollo con recarga en vivo y compilación para producción |
| Rutas | **React Router** | Una dirección por pantalla (`/agenda`, `/pacientes/123`…), con carga por partes |
| Datos del servidor | **TanStack Query** | Pide, guarda en caché y refresca los datos de la API; maneja cargando y error |
| Formularios | **React Hook Form + Zod** | Validación clara en español, igual a la de la API |
| Tipos de la API | **Generados** desde el esquema OpenAPI de Django (`drf-spectacular` → `openapi-typescript`) | El frontend y la API nunca se desalinean; no se escriben a mano |
| Componentes base | **Radix UI** (solo primitivas sin estilo: diálogos, menús, pestañas) | Accesibilidad y teclado resueltos, con el estilo propio de KennaDent |
| Estilos | **CSS propio** con los tokens de `css/app.css` (colores, modo noche) en **CSS Modules** | Mantiene el estilo de Kenia; sin librerías visuales que lo cambien |
| Fechas | `Intl` del navegador + zona horaria de la sucursal | Horas correctas aunque haya sucursales en otras zonas |
| Pruebas | **Vitest + Testing Library** (componentes) y **Playwright** (flujos completos contra el entorno de QA) | Cada PR se prueba solo |
| Calidad | ESLint, Prettier y revisión de tipos en GitHub Actions | Nada se une a `main` si no compila o falla una prueba |

Las versiones exactas se fijan en `frontend/package.json` al crear el proyecto (la estable vigente) y se actualizan en PRs propios.

## 2. Dónde vive y cómo corre

- **Carpeta:** `frontend/`, en este mismo repositorio.
- **Sin instalar nada en tu computadora:** igual que el backend, corre en Docker. Un servicio `frontend` (imagen de Node) levanta Vite con recarga en vivo.
- **Mismo dominio que la API:** nginx sirve el frontend y manda `/api` y `/admin` a Django. Así la sesión (cookie + CSRF) funciona sin configuraciones extra y sin abrir la API a otros sitios (sin CORS).
- **Durante la transición** (entorno local de QA):
  - `http://localhost:8080/app/` → frontend nuevo;
  - `http://localhost:8080/` → prototipo (sigue igual), también en GitHub Pages.
- **Cuando el frontend nuevo cubra lo esencial del prototipo**, pasa a `/` y el prototipo a `/demo/`.
- **Producción:** se compila a archivos estáticos (imagen de Docker en dos etapas) que sirve nginx junto con la API, en el mismo servidor o en la nube.

## 3. Estructura de carpetas

```
frontend/
├── src/
│   ├── app/                 # arranque: rutas, proveedores (sesión, consultas), diseño general (menú, barra)
│   ├── api/
│   │   ├── esquema.d.ts     # tipos GENERADOS desde OpenAPI (no se editan a mano)
│   │   ├── cliente.ts       # fetch con cookie, CSRF y manejo de errores (401, 403, 409)
│   │   └── consultas/       # un archivo por recurso: pacientes.ts, citas.ts… (hooks de TanStack Query)
│   ├── modulos/             # una carpeta por sección del sistema
│   │   ├── sesion/          # entrada, cambio de contraseña, cierre por inactividad
│   │   ├── pacientes/
│   │   ├── agenda/
│   │   └── …                # caja, presupuestos, inventario, reportes, personal, empresa
│   ├── componentes/         # piezas compartidas: Boton, Modal, Tabla, CampoFecha, AvisoMotivo…
│   ├── estilos/             # tokens.css (de css/app.css), base.css
│   └── utilidades/          # fechas, formatos de dinero, permisos, mayúsculas
├── pruebas/                 # Playwright (flujos completos)
├── public/                  # manifiesto para "agregar a pantalla de inicio", íconos
└── package.json
```

Cada módulo tiene sus pantallas, sus componentes propios y sus pruebas juntos. Un módulo no importa archivos internos de otro: lo compartido va en `componentes/` o `utilidades/`.

## 4. Reglas del frontend

Las reglas del negocio son las de `CLAUDE.md` y `docs/requisitos.md`; aquí, cómo se aplican en el frontend:

1. **La seguridad real está en la API y en la base.** El frontend oculta lo que no corresponde (por comodidad), pero nunca es la única protección.
2. **Permisos** desde `GET /api/v1/sesion/` (`permisos`, `sucursales`). Un solo ayudante, `usePuede("dinero")`, decide qué se muestra. Sin el permiso `dinero` no se muestran precios, montos ni ingresos (salvo el monto a cobrar de cada paciente, que recepción ve para cobrar; requisitos §2.2).
3. **Sesión:**
   - Si la API responde que no hay sesión (30 minutos sin uso), se vuelve a la pantalla de entrada con un aviso.
   - Si responde "cambia tu contraseña inicial", se va a la pantalla de cambio de contraseña y no se deja usar nada más.
4. **Errores:** los mensajes de la API ya vienen en español; se muestran tal cual. Si la API responde **409** con el aviso del doctor ocupado, se muestra el aviso y se ofrece "Agendar de todos modos" (`confirmar_empalme`).
5. **Nunca `dangerouslySetInnerHTML`.** React ya protege el texto que viene de datos; no se desactiva esa protección.
6. **Fechas y horas** en la zona horaria de la sucursal (`sucursal.zona_horaria`), no en la del dispositivo.
7. **Nada de cargar "toda la base".** Listas paginadas y filtros en el servidor (el prototipo carga todo porque es una demo; el sistema real no).
8. **Diseño:** el del prototipo de Kenia. Modo día y noche, todos los nombres en mayúsculas, en celular una columna, en tablet y computadora menú lateral.
9. **Sin modo sin conexión** por ahora: los datos de salud viven en el servidor. Se reconsidera más adelante, si hace falta.
10. **Accesibilidad básica:** todo se puede usar con teclado, con textos claros y tamaños táctiles cómodos para iPad.

## 5. Escala: muchas clínicas, muchas personas

- **Multiempresa:** cada persona entra con el código de su clínica; la API y PostgreSQL (Row Level Security) garantizan que solo vea su clínica. El frontend no filtra por empresa. Más adelante se puede dar un subdominio por clínica (`clinica.kennadent.mx`) sin cambiar esta estructura.
- **Rendimiento:** cada sección se descarga solo cuando se abre (carga por rutas); los datos se guardan en caché unos segundos y se refrescan al volver a la pantalla.
- **Varias personas a la vez:** la agenda se refresca sola cada poco tiempo y al regresar a la pestaña. La base rechaza los choques (dos citas en el mismo sillón) aunque dos personas guarden al mismo tiempo.
- **Versiones:** el frontend y la API se publican juntos; los tipos generados avisan si la API cambió algo que el frontend usa.

## 6. Fases (un pull request cada una)

| Fase | Qué incluye | Necesita de la API |
|---|---|---|
| **F0. Base** | Proyecto en `frontend/`, Docker y nginx (`/app/`), tokens y diseño general (menú Principal/Gestión, modo día y noche), entrada con clínica + usuario + contraseña, cambio de contraseña inicial, cierre por inactividad, tipos generados, primeras pruebas y GitHub Actions | `drf-spectacular` para publicar el esquema OpenAPI |
| **F1. Pacientes** | Buscar, dar de alta, ficha con datos generales, alerta de alergias, baja con motivo | Ya existe |
| **F2. Agenda** | Día por sillón y semana, nueva cita paso a paso, mover y estirar, aviso del doctor ocupado, cancelar y eliminar con motivo | Ya existe (v0.6.0) |
| **F3 en adelante** | Consulta y odontograma, presupuestos, caja, inventario, reportes, personal, empresa | Se hace primero la parte de la API de cada módulo y luego sus pantallas |

- **Al terminar F1 y F2**, ya se puede probar con datos compartidos: varias personas en distintos dispositivos sobre la misma base. Puede ser con el entorno local expuesto de forma privada (Tailscale) o con un QA en la nube.
- **Cada PR** pasa por la revisión de los agentes (`/revision`). En la F0 se agrega `qa-pantallas`, que corre las pruebas del frontend en computadora, iPad y celular. Desde la F1 se agrega `paridad-prototipo`, que compara cada pantalla nueva con el prototipo para no perder reglas ni flujos.
