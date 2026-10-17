"""Sesion con cookie (como SessionAuthentication de DRF), pero sin sesion responde 401.

DRF responde 403 cuando no hay sesion si la autenticacion no declara un
encabezado WWW-Authenticate. El frontend necesita distinguir:
  401 = no hay sesion (nunca entro o se cerro tras 30 minutos sin uso) -> pantalla de entrada;
  403 = si hay sesion, pero no tiene permiso (o debe cambiar su contrasena inicial).
"""
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import SessionAuthentication


class SesionAutenticacion(SessionAuthentication):
    def authenticate_header(self, request):
        # Un esquema propio (no "Basic") para que el navegador no abra su ventana de usuario y contrasena
        return 'Session realm="kennadent"'


class EsquemaSesion(OpenApiAuthenticationExtension):
    """Para el esquema OpenAPI: la API se usa con la cookie de sesion (mismo dominio)."""

    target_class = SesionAutenticacion
    name = "cookieSesion"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "cookie", "name": "sessionid"}
