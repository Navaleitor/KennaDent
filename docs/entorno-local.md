# Entorno local de pruebas (QA) en tu computadora

Con **un solo comando** levantas en tu laptop:

| Servicio | Dirección | Para qué |
|---|---|---|
| **Base de datos** PostgreSQL 16 | `localhost:5433` | El modelo v0.2 con datos de demostración |
| **pgAdmin** | http://localhost:5050 | Ver y consultar la base desde el navegador |
| **Prototipo web** | http://localhost:8080 | Las pantallas actuales de KennaDent |

> **Importante:** el prototipo web **todavía no usa la base de datos**. Sigue guardando en el navegador hasta que exista el backend (la API). Hoy este entorno sirve para dos cosas: probar el **modelo de datos** con consultas reales y dejar lista la base a la que se conectará el backend.

Todo corre dentro de **Docker**. Docker crea "computadoras miniatura" (contenedores) con todo instalado, de modo que no instalas PostgreSQL ni nada más en tu sistema. Es la misma tecnología con la que después se sube a la nube, así que lo que pruebas aquí se parece mucho a lo que correrá allá.

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

Mientras la rama de este trabajo no esté en `main`, cámbiate a ella:

```
git checkout ccr-588b4f9e-wt1g3f
```

## 3. Poner tus contraseñas (una sola vez)

Copia el archivo de ejemplo:

- Windows: `copy .env.example .env`
- Mac: `cp .env.example .env`

Abre `.env` con cualquier editor y cambia las contraseñas. Este archivo **no se sube a GitHub**.

## 4. Levantar el entorno

```
docker compose up -d
```

- La primera vez tarda unos minutos, porque descarga cerca de 1.5 GB.
- Después, unos segundos.
- La base se crea sola con el esquema `docs/modelo-datos/kennadent_esquema_v0.2.sql` y los datos de `infra/local/db/20_datos_demo.sql`.

Para ver que todo está arriba:

```
docker compose ps
```

Deben aparecer `db` (healthy), `pgadmin` y `web`.

---

## 5. Usarlo

### pgAdmin (en el navegador)

Abre http://localhost:5050. La primera vez tarda **alrededor de 1 minuto** en arrancar; si no carga, espera y recarga. A la izquierda, en el grupo **KennaDent**, hay dos conexiones:

| Conexión | Usuario | Qué ve |
|---|---|---|
| **KennaDent QA (administrador)** | `kennadent` | **Todo**, de todas las empresas. Es el dueño de las tablas y no le aplica el aislamiento |
| **KennaDent QA (como la aplicación)** | `kd_app` | **Nada**, hasta que dices de qué empresa eres. Así se conectará el sistema real |

La primera vez te pide la contraseña (la de tu `.env`). Marca *Save password*.

**Prueba del aislamiento entre empresas.** Abre el *Query Tool* en la conexión "como la aplicación" y corre:

```sql
SELECT count(*) FROM paciente;      -- 0: no dijiste de qué empresa eres

SET app.empresa_id = '1';           -- GRUPO DENTAL DEMO
SELECT count(*) FROM paciente;      -- 120

SET app.empresa_id = '2';           -- CLINICA AISLAMIENTO
SELECT nombre FROM paciente;        -- solo MARIA, PEDRO y ANA
```

### Tu pgAdmin de escritorio (si ya lo tienes instalado)

Crea un servidor nuevo con estos datos:

- Host: `localhost`
- Puerto: **5433** (no 5432, para no chocar con un PostgreSQL que ya tengas)
- Base: `kennadent_qa`
- Usuario: `kennadent` o `kd_app`, con la contraseña de tu `.env`

### Prototipo web

Abre http://localhost:8080. Es el mismo prototipo que se abre con doble clic en `index.html`.

---

## 6. Qué datos trae

Todos los datos son **ficticios** y siguen la demo del prototipo:

- **GRUPO DENTAL DEMO** (empresa 1):
  - sucursales CUMBRES (3 sillones), SAN PEDRO (2) y CENTRO (2);
  - 14 personas del equipo y 120 pacientes;
  - unas 1,300 citas: 30 días atrás y 7 adelante.
- Ya incluye, para que haya algo que revisar:
  - consultas con lo que se hizo y su precio;
  - planes de tratamiento, presupuestos y mensualidades (algunas vencidas);
  - pagos y cobros pendientes de hoy y ayer;
  - gastos y cortes de caja (algunos con faltante);
  - inventario con consumo, un traslado y alertas de stock bajo y crítico;
  - solicitudes de material.
- **CLINICA AISLAMIENTO** (empresa 2): 1 sucursal, 2 personas y 3 pacientes. Existe para comprobar que una empresa no ve los datos de la otra.
- Las fechas se calculan **el día en que se crea la base**. Para "refrescarlas", reinicia desde cero (sección 7).

**Nunca cargues datos reales de pacientes en este entorno.** Son datos de salud protegidos por la LFPDPPP. QA siempre lleva datos inventados.

---

## 7. Comandos del día a día

| Quiero… | Comando |
|---|---|
| Encender | `docker compose up -d` |
| Apagar (los datos **se conservan**) | `docker compose down` |
| **Borrar todo y empezar de cero** (vuelve a crear la base y los datos) | `docker compose down -v` y luego `docker compose up -d` |
| Ver los mensajes de la base | `docker compose logs db` |
| Entrar a la base por terminal | `docker compose exec db psql -U kennadent -d kennadent_qa` |
| Correr las pruebas del modelo (en una base nueva, ver abajo) | `docker compose exec db sh -c "createdb -U kennadent pruebas && psql -U kennadent -d pruebas -q -f /docker-entrypoint-initdb.d/00_esquema.sql && psql -U kennadent -d pruebas -f /kd/pruebas/pruebas_v0.2.sql"` |
| Correr los reportes de la Fase C sobre los datos de demo | `docker compose exec db psql -U kennadent -d kennadent_qa -f /kd/pruebas/fase_c_reportes_v0.2.sql` |

Notas:
- En las pruebas del modelo **deben aparecer 27 líneas `ERROR`**. Son los casos marcados "DEBE FALLAR": la base rechaza bien los datos inválidos. Compáralas con `docs/modelo-datos/pruebas/pruebas_v0.2.salida.txt`.
- Las pruebas del modelo crean datos propios, por eso van en una base aparte llamada `pruebas`. Para repetirlas, primero bórrala: `docker compose exec db dropdb -U kennadent pruebas`.
- **Si cambias el esquema o los datos de demo**, los cambios solo se aplican al crear la base. Usa "Borrar todo y empezar de cero".

---

## 8. Cómo encaja esto en el camino a la nube

```
Tu laptop (este entorno)   →   QA en la nube (opcional)   →   Producción en la nube
 datos inventados              datos inventados               datos reales de clínicas
 docker compose                misma imagen de Docker         misma imagen de Docker
```

Reglas para que el paso a la nube no dé sorpresas:
1. **Mismo PostgreSQL (16) y mismo esquema** en todos los ambientes. El esquema se cambia en el repositorio, nunca a mano en un servidor.
2. **Contraseñas distintas por ambiente**, siempre en `.env` o en el gestor de secretos de la nube, nunca en el código.
3. **La aplicación se conecta con `kd_app`, nunca con el dueño de las tablas.** Así el aislamiento entre empresas aplica también en producción.
4. **Producción tendrá cosas que aquí no hacen falta:** respaldos automáticos, cifrado, conexión segura (SSL) y la bitácora de quién consulta cada expediente.

---

## 9. Si algo falla

| Síntoma | Causa probable y solución |
|---|---|
| `Cannot connect to the Docker daemon` / `docker: command not found` | Docker Desktop no está abierto. Ábrelo y espera a que diga *Engine running* |
| `port is already allocated` (5433, 5050 u 8080) | Otro programa usa ese puerto. En `.env` cambia `KD_DB_PUERTO`, `KD_PGADMIN_PUERTO` o `KD_WEB_PUERTO` y vuelve a hacer `up -d` |
| `db` no queda *healthy* | Revisa `docker compose logs db`. Si dice `ERROR` al cargar el esquema o los datos, corrígelo y luego `down -v` y `up -d` |
| pgAdmin no muestra las dos conexiones | Se registran solo la primera vez. Borra sus datos: `docker compose down`, `docker volume rm kennadent_kd_pgadmin` y `up -d` |
| En Windows: `10_usuario_app.sh: not found` o `\r` en el error | Git convirtió los saltos de línea. Ejecuta `git config core.autocrlf false`, borra la carpeta y clona de nuevo |
| Cambié el esquema y no se nota | El esquema solo se carga con la base vacía: `docker compose down -v` y `up -d` |
