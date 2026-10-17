"""Convierte las reglas que rechaza PostgreSQL en mensajes claros para la pantalla.

Las reglas viven en la base (llaves compuestas, EXCLUDE, CHECK, triggers). La
API intenta guardar dentro de un punto de guardado (savepoint); si la base
rechaza, se responde 400/403/409 con un mensaje en espanol en lugar de un 500.
"""
from contextlib import contextmanager

from django.db import DatabaseError, IntegrityError, transaction
from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.views import exception_handler

MENSAJES = {
    "cita_sin_empalme_unidad": "La unidad ya tiene una cita en ese horario. Elige otra hora u otra unidad.",
    "cita_emp_trabajador_sucursal_2": "El doctor no está asignado a esa sucursal.",
    "cita_emp_unidad_1": "La unidad no pertenece a esa sucursal.",
    "cita_check": "La hora de fin debe ser posterior a la de inicio.",
    "cita_piezas_check": "Hay una pieza dental que no existe en la numeración FDI.",
    "cita_baja_con_motivo": "Para cancelar o eliminar una cita indica el motivo.",
    "paciente_empresa_expediente_key": "Ya existe un paciente con ese número de expediente.",
    "tratamiento_empresa_nombre_key": "Ya existe un tratamiento con ese nombre.",
}


class Conflicto(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "conflicto"


def _restriccion(error):
    diag = getattr(getattr(error, "__cause__", None), "diag", None)
    return getattr(diag, "constraint_name", None), getattr(diag, "message_primary", None)


@contextmanager
def guardar_con_reglas():
    """Uso: with guardar_con_reglas(): serializer.save()"""
    try:
        with transaction.atomic():
            yield
    except IntegrityError as e:
        nombre, mensaje = _restriccion(e)
        if nombre == "cita_sin_empalme_unidad":
            raise Conflicto(MENSAJES[nombre])
        raise ValidationError({"detail": MENSAJES.get(nombre) or mensaje or "Los datos no cumplen una regla del sistema."})
    except DatabaseError as e:
        nombre, mensaje = _restriccion(e)
        if mensaje and "row-level security" in mensaje:
            raise PermissionDenied("No puedes guardar datos de otra empresa.")
        raise


def manejar_error(exc, context):
    """Respuesta de error de DRF + un "codigo" fijo para que el frontend decida sin leer el texto
    (ej. "not_authenticated", "cambiar_password", "conflicto"). El "detail" sigue siendo el mensaje
    en espanol que se muestra tal cual."""
    respuesta = exception_handler(exc, context)
    if respuesta is None or not isinstance(exc, APIException) or not isinstance(respuesta.data, dict):
        return respuesta
    detalle = str(respuesta.data.get("detail", ""))
    if isinstance(exc, PermissionDenied) and detalle.startswith("CSRF Failed"):
        respuesta.data["detail"] = "La página caducó. Vuelve a cargarla e intenta de nuevo."
        respuesta.data["codigo"] = "csrf"
        return respuesta
    codigos = exc.get_codes()
    if isinstance(codigos, str):
        respuesta.data["codigo"] = codigos
    return respuesta
