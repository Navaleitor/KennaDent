# Entorno local de pruebas (QA) en tu computadora

Con **un solo comando** levantas en tu laptop:

| Servicio | Dirección | Para qué |
|---|---|---|
| **Prototipo web** | http://localhost:8080 | Las pantallas de la demo (datos en el navegador) |
| **Sistema nuevo** (frontend React) | http://localhost:8080/app/ | Las pantallas reales, conectadas a la API: hoy entrada, cambio de contraseña y página de inicio (fase F0) |
| **API (backend Django)** | http://localhost:8080/api/v1/ | El servidor real: inicio de sesión, pacientes, agenda… |
| **Admin de plataforma** | http://localhost:8080/admin/ | Para el equipo de KennaDent: ve todas las empresas |
| **pgAdmin** | http://localhost:5050 | Ver y consultar la base de datos |
| **Base de datos** PostgreSQL 16 | `localhost:5433` | Para conectar tu propio pgAdmin |

> **Importante:** el prototipo web **no usa la API**: guarda en el navegador y se queda como demo. Las pantallas que sí usan la API son las del **sistema nuevo** en `/app/` (React, `docs/frontend.md`), que se construye por fases: la F0 (entrada, contraseña inicial, menú y página de inicio) ya está; pacientes (F1) y agenda (F2) siguen.

Todo corre dentro de **Docker**. Docker crea "computadoras miniatura" (contenedores) con todo instalado: no instalas PostgreSQL ni Python en tu sistema. Es la misma tecnología con la que después se sube a la nube.

### Cómo están conectadas las piezas

```
Navegador ──> web (nginx, puerto 8080) ──┬──> /           prototipo (archivos)
                                         ├──> /app/        frontend (Vite, recarga en vivo)
                                         └──> /api /admin  api (Django + Gunicorn)
                                                              │  usuario kd_app
                                                              ▼
                                                           db (PostgreSQL 16)
```

---

## 1. Instalar lo necesario (una sola vez)

1. **Docker Desktop**: https://www.docker.com/products/docker-desktop/
   - **Windows:** durante la instalación acepta usar **WSL 2**. Si lo pide, reinicia.
   - **Mac:** elige la versión de tu procesador (Apple o Intel).
   - Ábrelo y espera a que diga *Engine running*.
2. **Git**: https://git-scm.com/downloads (en Mac ya viene).

Para comprobar, abre una terminal (Windows: *PowerShell*; Mac: *Terminal*) y escribe:

```
docker --version
docker compose version
git --version
```

Si los tres responden con un número de versión, está listo.

## 2. Descargar el proyecto (una sola vez)

```
git clone https://github.com/Navaleitor/KennaDent.git
cd KennaDent
```

## 3. Poner tus contraseñas (una sola vez)

Copia el archivo de ejemplo:

- Windows: `copy .env.example .env`
- Mac: `cp .env.example .env`

Abre `.env` con cualquier editor y cambia las contraseñas y `KD_SECRET_KEY` (cualquier texto largo y aleatorio). Este archivo **no se sube a GitHub**.

## 4. Levantar el entorno

```
docker compose up -d --build
```

- La primera vez tarda unos minutos: descarga cerca de 2 GB y arma la imagen del backend.
- Al arrancar, el backend crea las tablas (migraciones de Django) y, si la base está vacía, carga los datos de demostración.
- pgAdmin tarda **alrededor de 1 minuto** la primera vez.
- El frontend instala sus librerías la primera vez (1 a 2 minutos) dentro de Docker: **no necesitas instalar Node** en tu computadora.

Para ver que todo está arriba:

```
docker compose ps
```

Deben aparecer `db` (healthy), `api` (healthy), `frontend` (healthy), `pgadmin` y `web`.

---

## 5. Usarlo

### Usuarios de demostración

Todas las personas del equipo de la demo tienen usuario. La contraseña de todos es la de `KD_DEMO_PASSWORD` en tu `.env` (por omisión `kennadent2026`).

| Clínica (código) | Usuario | Quién es | Qué puede |
|---|---|---|---|
| `demo` | `kenia.navarro` | Administradora general | Todo |
| `demo` | `carlos.martinez` | Gerente (CUMBRES) | Todo menos empresa y otras sucursales |
| `demo` | `daniela.flores` | Recepción (CUMBRES) | Agenda de todos, pacientes, cobrar. **No ve precios** |
| `demo` | `andrea.garza` | Odontóloga (CUMBRES) | **Solo su agenda**, historial clínico |
| `aislamiento` | `laura.perez` | Recepción de la otra clínica | Solo ve a sus 3 pacientes |

El usuario se forma igual que en el prototipo: `nombre.apellido`, sin acentos.

**Admin de plataforma** (http://localhost:8080/admin/): usuario `admin` y la contraseña de `KD_ADMIN_PASSWORD`. Es para el equipo de KennaDent y ve todas las empresas. El personal de las clínicas no puede entrar ahí.

### El sistema nuevo (http://localhost:8080/app/)

1. Abre http://localhost:8080/app/ y entra con clínica `demo`, un usuario de la tabla de arriba y la contraseña de la demo.
2. Verás la página de inicio con **quién eres, tus sucursales y tus permisos**, y el menú con solo lo que tu usuario puede ver. Las secciones dicen "Próximamente" hasta su fase.
3. Prueba con otro usuario (menú de tu nombre, arriba a la derecha → **Salir**): `andrea.garza` no ve Caja; `daniela.flores` no ve el bloque Gestión.
4. **Contraseña inicial:** el usuario `bruno.salas` de la clínica `aislamiento` sirve para probar el cambio obligatorio. Para dejarlo otra vez con la contraseña inicial: `docker compose run --rm preparar-pruebas`.
5. **Cierre por inactividad:** a los 30 minutos sin tocar la pantalla regresa sola a la entrada.
6. El botón de luna o sol cambia entre modo día y noche (se recuerda igual que en el prototipo).

Los cambios que se hagan en `frontend/src/` se ven al instante (recarga en vivo).

### Probar desde el iPad o el celular (opcional, con Tailscale)

El entorno solo escucha en tu computadora. Para abrirlo desde tu iPad **sin abrirlo a toda tu red**, usa [Tailscale](https://tailscale.com/) (ya lo tienes instalado), con la misma cuenta en la laptop y en el iPad:

1. En la página de administración de Tailscale activa **MagicDNS** y **HTTPS Certificates** (una sola vez).
2. En la laptop, en PowerShell: `tailscale serve --bg 8080`. Te dirá una dirección como `https://mi-laptop.tu-red.ts.net`.
3. En `.env`, pon ese nombre sin `https://`: `KD_DIRECCION_EXTRA=mi-laptop.tu-red.ts.net`, y luego `docker compose up -d` (el backend lo acepta como dirección permitida).
4. En el iPad, con Tailscale encendido, abre `https://mi-laptop.tu-red.ts.net/app/`. Para tenerlo como app: botón **Compartir → Agregar a pantalla de inicio**.
5. Para dejar de compartirlo: `tailscale serve --https=443 off`.

Solo tus dispositivos de Tailscale lo pueden abrir, y siguen siendo datos ficticios.

### Probar la API desde el navegador

Django REST Framework trae páginas para probar la API sin programar:

1. Abre http://localhost:8080/api/v1/sesion/
2. Abajo, en el recuadro *Content*, pega lo siguiente y presiona **POST**:
   ```json
   {"empresa": "demo", "usuario": "daniela.flores", "password": "kennadent2026"}
   ```
3. Ya con la sesión iniciada, abre por ejemplo:

| Dirección | Qué devuelve |
|---|---|
| http://localhost:8080/api/v1/sesion/ | Quién eres, tus permisos y tus sucursales |
| http://localhost:8080/api/v1/pacientes/?q=garcia | Búsqueda de pacientes (sin importar acentos) |
| http://localhost:8080/api/v1/sucursales/ | Sucursales con sus sillones |
| http://localhost:8080/api/v1/tratamientos/ | Catálogo; el precio solo aparece con el permiso "dinero" |
| http://localhost:8080/api/v1/citas/?desde=2026-10-08T00:00:00-06:00&hasta=2026-10-08T23:59:00-06:00 | Agenda del día (cambia la fecha) |

Prueba lo mismo con `andrea.garza` (solo verá sus citas) y con la clínica `aislamiento` (no verá nada de la demo). Para cerrar sesión: botón **DELETE** en `/api/v1/sesion/`.

### pgAdmin

Abre http://localhost:5050. En el grupo **KennaDent** hay dos conexiones:

| Conexión | Usuario | Qué ve |
|---|---|---|
| **KennaDent QA (administrador)** | `kennadent` | **Todo**, de todas las empresas (es el dueño de las tablas) |
| **KennaDent QA (como la aplicación)** | `kd_app` | **Nada**, hasta que dices de qué empresa eres. Así se conecta el backend |

Prueba del aislamiento en el *Query Tool* de "como la aplicación":

```sql
SELECT count(*) FROM paciente;      -- 0: no dijiste de qué empresa eres
SET app.empresa_id = '1';           -- GRUPO DENTAL DEMO
SELECT count(*) FROM paciente;      -- 120
SET app.empresa_id = '2';           -- CLINICA AISLAMIENTO
SELECT nombre FROM paciente;        -- solo MARIA, PEDRO y ANA
```

**Tu pgAdmin de escritorio:** host `localhost`, puerto **5433**, base `kennadent_qa`, usuario `kennadent` o `kd_app`, con la contraseña de tu `.env`.

---

## 6. Qué datos trae

Todos son **ficticios** y siguen la demo del prototipo:

- **GRUPO DENTAL DEMO** (`demo`):
  - CUMBRES (3 sillones), SAN PEDRO (2) y CENTRO (2);
  - 14 personas del equipo y 120 pacientes;
  - unas 1,300 citas: 30 días atrás y 7 adelante.
- Incluye consultas, planes de tratamiento, presupuestos, mensualidades (algunas vencidas), cobros pendientes, cortes de caja (algunos con faltante), inventario con alertas y solicitudes de material.
- **CLINICA AISLAMIENTO** (`aislamiento`): 1 sucursal, 2 personas y 3 pacientes. Sirve para comprobar que una empresa no ve los datos de la otra.
- Las fechas se calculan el día en que se crea la base. Para "refrescarlas", reinicia desde cero (sección 7).

**Nunca cargues datos reales de pacientes en este entorno.** Son datos de salud protegidos por la LFPDPPP.

---

## 7. Comandos del día a día

| Quiero… | Comando |
|---|---|
| Encender | `docker compose up -d` |
| Encender después de cambiar el backend | `docker compose up -d --build` |
| Apagar (los datos **se conservan**) | `docker compose down` |
| **Borrar todo y empezar de cero** | `docker compose down -v` y luego `docker compose up -d --build` |
| Ver los mensajes del backend | `docker compose logs api` |
| **Correr las pruebas automáticas** | `docker compose exec -e KD_DB_ROL=admin api python manage.py test nucleo` |
| Ver los mensajes del frontend | `docker compose logs frontend` |
| **Pruebas del frontend** (tipos, ESLint y Prettier) | `docker compose exec frontend npm run revisar` |
| **Pruebas del frontend** (Vitest) | `docker compose exec frontend npm test` |
| **Pruebas de pantallas** (Playwright) | `docker compose run --rm pruebas-pantallas` |
| Entrar a la base por terminal | `docker compose exec db psql -U kennadent -d kennadent_qa` |
| Reportes de la Fase C sobre la demo | `docker compose exec db psql -U kennadent -d kennadent_qa -f /kd/pruebas/fase_c_reportes_v0.2.sql` |

Las pruebas automáticas crean una base temporal, cargan la demo y comprueban:
- el inicio de sesión;
- el aislamiento entre clínicas;
- los permisos (precios, agenda propia, gerente solo en su sucursal);
- la sesión de 30 minutos, que no se entra con correo y que la contraseña inicial bloquea todo hasta cambiarla;
- las reglas de la agenda (sillón ocupado, doctor de otra sucursal, aviso de empalme con el detalle de la cita, solo a las :00 y :30, nada en el pasado, cancelar y eliminar con motivo);
- el alta y la baja de pacientes y la bitácora.

Al final deben decir `OK`.

**Pruebas SQL del modelo** (opcional; las mismas de la validación, contra las tablas que crea Django):

```
docker compose exec db createdb -U kennadent pruebas
docker compose exec -e KD_DB_ROL=admin -e KD_DB_NOMBRE=pruebas api python manage.py migrate -v0
docker compose exec db psql -U kennadent -d pruebas -f /kd/pruebas/pruebas_django.sql
```

Deben aparecer **29 líneas `ERROR`**: son los casos "DEBE FALLAR", es decir, la base rechaza bien los datos inválidos. Para repetirlas, primero borra esa base: `docker compose exec db dropdb -U kennadent pruebas`.

### Pruebas del frontend nuevo

```
docker compose exec frontend npm run revisar
docker compose exec frontend npm test
docker compose run --rm pruebas-pantallas
```

- `revisar`: TypeScript estricto, ESLint y Prettier. Si Prettier se queja del formato: `docker compose exec frontend npm run formato`.
- `npm test`: 21 pruebas de Vitest (cliente de la API, permisos, menú y cierre por inactividad). Deben decir `21 passed`.
- `pruebas-pantallas`: 20 pruebas de Playwright (Chromium) contra el entorno levantado: entrar y salir, contraseña equivocada, contraseña inicial, cierre por inactividad, permisos del menú, y la entrada y la página de inicio en computadora (1366 px), iPad (1024 px) y celular (390 px), en modo día y noche, sin errores de JavaScript ni scroll horizontal. Deben decir `20 passed`.
  - La primera vez descarga la imagen de Playwright (unos 2 GB) e instala librerías.
  - Antes de empezar, `preparar-pruebas` deja a `aislamiento/bruno.salas` con la contraseña inicial de la demo (la prueba la cambia).
  - Las capturas quedan en `frontend/pruebas/capturas/` y, si algo falla, el detalle en `frontend/playwright-report/` (ninguna de las dos se sube a GitHub).
  - Correr solo una prueba: `docker compose run --rm pruebas-pantallas -g "contraseña equivocada"`.
  - La API acepta **10 inicios de sesión por minuto**; una corrida usa unos 7. Si repites enseguida y falla al entrar, espera un minuto.

Las mismas pruebas (y las de la API) corren solas en GitHub en cada pull request (`.github/workflows/pruebas.yml`).

### Tipos de la API (cuando cambia el backend)

El frontend no escribe a mano cómo son los datos de la API: los toma del esquema que publica Django. Si cambias vistas o serializadores del backend, regenera los tipos y súbelos junto con el cambio:

```
docker compose up -d --build api
docker compose exec api python manage.py spectacular --format openapi-json --file /kd/openapi/esquema.json
docker compose exec frontend npm run tipos
```

- El primero toma tu cambio del backend; el segundo escribe `frontend/openapi/esquema.json`; el tercero genera `frontend/src/api/esquema.d.ts`.
- En Git Bash, antepón `MSYS_NO_PATHCONV=1 ` al segundo comando (en PowerShell no hace falta).
- Si se te olvida, GitHub Actions lo detecta y el PR sale en rojo.

---

## 8. Cómo encaja esto en el camino a la nube

```
Tu laptop (este entorno)   →   QA en la nube (opcional)   →   Producción en la nube
 datos inventados              datos inventados               datos reales de clínicas
 docker compose                misma imagen del backend       misma imagen del backend
```

Reglas para que el paso a la nube no dé sorpresas:
1. **El esquema lo definen las migraciones de Django** (`backend/nucleo/migrations/`). Nunca se cambian tablas a mano en un servidor.
2. **Contraseñas y `KD_SECRET_KEY` distintas por ambiente**, en `.env` o en el gestor de secretos de la nube, nunca en el código.
3. **La aplicación se conecta con `kd_app`, nunca con el dueño de las tablas.** Así el aislamiento entre empresas también aplica en producción.
4. **Producción tendrá cosas que aquí no hacen falta:**
   - HTTPS (`KD_COOKIES_SEGURAS=1`) y respaldos automáticos;
   - migraciones como un paso aparte del despliegue (`KD_MIGRAR=0` en el servidor web);
   - `KD_CARGAR_DEMO` apagado.

---

## 9. Si algo falla

| Síntoma | Causa probable y solución |
|---|---|
| `Cannot connect to the Docker daemon` / `docker: command not found` | Docker Desktop no está abierto. Ábrelo y espera a que diga *Engine running* |
| `port is already allocated` (5433, 5050 u 8080) | Otro programa usa ese puerto. En `.env` cambia `KD_DB_PUERTO`, `KD_PGADMIN_PUERTO` o `KD_WEB_PUERTO` y vuelve a hacer `up -d` |
| `api` no queda *healthy* | Revisa `docker compose logs api`: el error de la migración o de la demo aparece ahí |
| `429 Too Many Requests` al descargar imágenes | Docker Hub limita las descargas anónimas. Espera unos minutos o inicia sesión con `docker login` (cuenta gratuita) |
| En `/api/` sale "CSRF Failed" | Abre primero http://localhost:8080/api/v1/sesion/ (te entrega la cookie) y entra siempre por el puerto 8080 |
| "Usuario o contraseña incorrectos" con los datos de demo | La contraseña es la que había en `.env` **cuando se creó la base**. Si la cambiaste después: `down -v` y `up -d --build` |
| pgAdmin no muestra las dos conexiones | Se registran solo la primera vez: `docker compose down`, `docker volume rm kennadent_kd_pgadmin` y `up -d` |
| http://localhost:8080/app/ dice `502 Bad Gateway` | El frontend todavía está instalando sus librerías o no arrancó: `docker compose logs frontend` y espera a que diga `ready` |
| El disco C: se llena / Docker falla con "read-only file system" | Docker guarda sus imágenes y la base en su propio disco. En esta laptop ya vive en `D:\Docker\wsl` (Docker Desktop → Settings → Resources → Advanced → *Disk image location*). Revisa con `docker system df` y libera espacio en C: |
| Docker Desktop no arranca: "initializing Secrets Engine … engine.sock" | Quedó trabado un archivo de conexión. Cierra Docker Desktop, renombra la carpeta `%LOCALAPPDATA%\docker-secrets-engine` (p. ej. a `docker-secrets-engine.danado`) y vuelve a abrirlo. **No uses "Reset to factory defaults"**: borra los datos de QA |
| En Windows: `entrypoint.sh: not found` o `\r` en un error | Git convirtió los saltos de línea: `git config core.autocrlf false`, borra la carpeta y clona de nuevo |
| Tenías el entorno de la versión anterior (sin backend) | Las tablas ahora las crea Django: `docker compose down -v` y `up -d --build` |
