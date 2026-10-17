"""Configuracion de KennaDent. Todo lo que cambia por ambiente (local, QA, nube)
se lee de variables de entorno; ver .env.example en la raiz del repositorio."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env(nombre, defecto=None):
    return os.environ.get(nombre, defecto)


def env_bool(nombre, defecto=False):
    return env(nombre, str(defecto)).lower() in ("1", "true", "si", "yes", "on")


DEBUG = env_bool("KD_DEBUG", False)
SECRET_KEY = env("KD_SECRET_KEY") or ("solo-para-desarrollo-local" if DEBUG else None)
if not SECRET_KEY:
    raise RuntimeError("Falta KD_SECRET_KEY (obligatoria cuando KD_DEBUG no esta activo)")
ALLOWED_HOSTS = [h.strip() for h in env("KD_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in env("KD_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
# Direccion privada extra (ej. el nombre de Tailscale de la laptop, para probar desde el iPad):
# se acepta como host y como origen https:// (tailscale serve pone el HTTPS)
for _direccion in [d.strip() for d in env("KD_DIRECCION_EXTRA", "").split(",") if d.strip()]:
    ALLOWED_HOSTS.append(_direccion)
    CSRF_TRUSTED_ORIGINS.append(f"https://{_direccion}")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "rest_framework",
    "drf_spectacular",
    "nucleo",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Despues de saber quien es el usuario: abre la transaccion de la peticion,
    # cambia al rol kd_app y fija la empresa para Row Level Security.
    "nucleo.empresa_actual.EmpresaActualMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "kennadent.urls"
WSGI_APPLICATION = "kennadent.wsgi.application"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

# ---------- Base de datos ----------
# Dos usuarios de PostgreSQL:
#   - admin (dueno de las tablas): solo para migraciones y carga de datos de demo.
#   - kd_app: el que usa la aplicacion; Row Level Security SI le aplica.
# KD_DB_ROL elige cual usar en este proceso.
_ROL = env("KD_DB_ROL", "app")
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": env("KD_DB_HOST", "localhost"),
        "PORT": env("KD_DB_PUERTO", "5433"),
        "NAME": env("KD_DB_NOMBRE", "kennadent_qa"),
        "USER": env("KD_DB_ADMIN", "kennadent") if _ROL == "admin" else env("KD_DB_APP", "kd_app"),
        "PASSWORD": env("KD_DB_ADMIN_PASSWORD", "") if _ROL == "admin" else env("KD_APP_PASSWORD", ""),
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
    }
}
# Rol al que se cambia cada peticion (SET LOCAL ROLE). Aunque el proceso se
# conecte con un usuario con mas privilegios, las peticiones respetan RLS.
KD_ROL_APP = env("KD_ROL_APP", "kd_app")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "nucleo.Usuario"
AUTHENTICATION_BACKENDS = ["django.contrib.auth.backends.ModelBackend"]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-mx"
TIME_ZONE = "America/Mexico_City"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

# Detras de nginx (mismo origen que el frontend)
USE_X_FORWARDED_HOST = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env_bool("KD_COOKIES_SEGURAS", False)   # True en la nube (HTTPS)
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
# La sesion se cierra tras 30 minutos sin uso: cada peticion vuelve a contar desde cero (requisitos, seccion 6)
SESSION_COOKIE_AGE = 30 * 60
SESSION_SAVE_EVERY_REQUEST = True

REST_FRAMEWORK = {
    # Como SessionAuthentication, pero sin sesion responde 401 (no 403): ver nucleo/api/autenticacion.py
    "DEFAULT_AUTHENTICATION_CLASSES": ["nucleo.api.autenticacion.SesionAutenticacion"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "nucleo.api.errores.manejar_error",
    "DEFAULT_THROTTLE_RATES": {"login": "10/min"},   # intentos de inicio de sesion por IP
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# Esquema OpenAPI (/api/v1/esquema/, solo con sesion iniciada). De aqui salen los tipos
# del frontend (frontend/src/api/esquema.d.ts); se regeneran con los comandos de docs/entorno-local.md.
SPECTACULAR_SETTINGS = {
    "TITLE": "API de KennaDent",
    "VERSION": "v1",
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAuthenticated"],
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api/v1",
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"consola": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["consola"], "level": env("KD_LOG_NIVEL", "INFO")},
}
