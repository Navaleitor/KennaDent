"""Aislamiento entre empresas en cada peticion.

Cada peticion corre dentro de UNA transaccion en la que:
  1. se cambia al rol kd_app (SET LOCAL ROLE), al que si le aplica Row Level Security;
  2. se fija app.empresa_id con la empresa del usuario.
Asi, aunque un programador olvide filtrar por empresa, PostgreSQL solo deja
ver y escribir renglones de la empresa del usuario.

El personal de KennaDent (usuario sin empresa y superusuario) entra en modo
"plataforma" y ve todas las empresas; solo se usa para el admin de Django.
"""
from django.conf import settings
from django.db import DatabaseError, connection, transaction


def fijar_contexto(usuario):
    """Fija rol y empresa en la transaccion actual. Se llama tambien al iniciar sesion."""
    empresa = ""
    plataforma = "off"
    if usuario is not None and usuario.is_authenticated:
        if usuario.empresa_id:
            empresa = str(usuario.empresa_id)
        elif usuario.is_superuser:
            plataforma = "on"
    with connection.cursor() as c:
        c.execute(f'SET LOCAL ROLE "{settings.KD_ROL_APP}"')
        c.execute("SELECT set_config('app.empresa_id', %s, true), set_config('app.plataforma', %s, true)",
                  [empresa, plataforma])


def _limpiar_contexto():
    with connection.cursor() as c:
        c.execute("RESET ROLE")
        c.execute("SELECT set_config('app.empresa_id', '', true), set_config('app.plataforma', 'off', true)")


class EmpresaActualMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        usuario = getattr(request, "user", None)
        if usuario is not None:
            usuario.is_authenticated  # carga al usuario (sesion) antes de cambiar de rol
        with transaction.atomic():
            fijar_contexto(usuario)
            response = self.get_response(request)
            if response.status_code >= 400:
                # Errores y validaciones: no se guarda nada a medias
                transaction.set_rollback(True)
            else:
                try:
                    _limpiar_contexto()
                except DatabaseError:
                    transaction.set_rollback(True)
        return response
