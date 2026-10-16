"""Permisos por persona (como js/roles.js): cada trabajador tiene su lista de permisos."""
from rest_framework.permissions import BasePermission

from nucleo.models import TrabajadorPermiso


def trabajador_de(request):
    usuario = request.user
    if not usuario.is_authenticated or not usuario.empresa_id:
        return None
    return getattr(usuario, "trabajador", None)


def permisos_de(request):
    """Lista de permisos del usuario, una consulta por peticion."""
    if not hasattr(request, "_kd_permisos"):
        t = trabajador_de(request)
        request._kd_permisos = set(
            TrabajadorPermiso.objects.filter(trabajador=t).values_list("permiso_id", flat=True)
        ) if t and t.activo else set()
    return request._kd_permisos


def puede(request, permiso):
    return permiso in permisos_de(request)


class TienePermisos(BasePermission):
    """La vista declara `permisos_por_accion = {'list': 'pacientes_ver', ...}`.
    Una tupla significa "cualquiera de estos"; "*" = cualquier persona activa.
    Accion sin entrada = prohibida."""

    message = "No tienes permiso para esta accion."

    def has_permission(self, request, view):
        if trabajador_de(request) is None:
            return False
        accion = getattr(view, "action", None)
        if accion is None:
            return True   # metodo sin accion (ej. DELETE de pacientes): DRF responde 405
        requerido = getattr(view, "permisos_por_accion", {}).get(accion)
        if requerido is None:
            return False
        if requerido == "*":
            return trabajador_de(request).activo
        opciones = requerido if isinstance(requerido, tuple) else (requerido,)
        return any(puede(request, p) for p in opciones)
