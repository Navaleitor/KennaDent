"""Nombres de puestos y permisos con acentos, como en js/roles.js (v0.7.0).

El frontend nuevo los muestra tal cual en la pagina de inicio. Solo cambia el
texto: los id ('odontologo', 'dinero'...) son los mismos.
"""
from django.db import migrations

CAMBIOS = [
    # (tabla, id, columna, sin acento, con acento)
    ("puesto", "almacen", "nombre", "Almacen e inventario", "Almacén e inventario"),
    ("puesto", "odontologo", "nombre", "Odontologo(a) general", "Odontólogo(a) general"),
    ("puesto", "radiologo", "nombre", "Tecnico(a) radiologo", "Técnico(a) radiólogo"),
    ("permiso", "pacientes_editar", "nombre", "Alta y edicion de datos generales", "Alta y edición de datos generales"),
    ("permiso", "clinico_editar", "nombre", "Editar datos clinicos y odontograma", "Editar datos clínicos y odontograma"),
    ("permiso", "historial_ver", "nombre", "Ver resumen e historial clinico", "Ver resumen e historial clínico"),
    ("permiso", "tratamientos", "nombre", "Catalogo de tratamientos", "Catálogo de tratamientos"),
]
GRUPOS = [("Historial clinico", "Historial clínico"), ("Operacion", "Operación"), ("Gestion", "Gestión")]


def _sql(hacia_acentos):
    lineas = []
    for tabla, id_, columna, viejo, nuevo in CAMBIOS:
        antes, despues = (viejo, nuevo) if hacia_acentos else (nuevo, viejo)
        lineas.append(f"UPDATE {tabla} SET {columna} = '{despues}' WHERE id = '{id_}' AND {columna} = '{antes}';")
    for viejo, nuevo in GRUPOS:
        antes, despues = (viejo, nuevo) if hacia_acentos else (nuevo, viejo)
        lineas.append(f"UPDATE permiso SET grupo = '{despues}' WHERE grupo = '{antes}';")
    return "\n".join(lineas)


class Migration(migrations.Migration):

    dependencies = [
        ("nucleo", "0006_trabajador_atiende"),
    ]

    operations = [
        migrations.RunSQL(_sql(True), _sql(False)),
    ]
