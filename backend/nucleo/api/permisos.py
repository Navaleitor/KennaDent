"""Permisos por persona (como js/roles.js): cada trabajador tiene su lista de permisos."""
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from nucleo.models import TrabajadorPermiso, TrabajadorSucursal


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


def sucursales_de(request):
    """Sucursales asignadas a la persona (consulta para usar en filtros __in).
    Sin el permiso "todas_sucursales", agenda, caja, inventario y reportes se
    limitan a estas (requisitos, seccion 6)."""
    return TrabajadorSucursal.objects.filter(trabajador=trabajador_de(request), activo=True).values("sucursal_id")


class TienePermisos(BasePermission):
    """La vista declara `permisos_por_accion = {'list': 'pacientes_ver', ...}`.
    Una tupla significa "cualquiera de estos"; "*" = cualquier persona activa.
    Accion sin entrada = prohibida.
    Con la contrasena inicial (o regenerada) no se puede usar nada: solo
    cambiarla (sesion/password/) y cerrar sesion, que no pasan por aqui."""

    message = "No tienes permiso para esta acción."

    def has_permission(self, request, view):
        if trabajador_de(request) is None:
            return False
        if request.user.debe_cambiar_password:
            raise PermissionDenied("Antes de continuar, cambia tu contraseña inicial.", code="cambiar_password")
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
