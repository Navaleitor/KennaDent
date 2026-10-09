"""Piezas comunes a todos los modelos.

Cada tabla de un cliente lleva `empresa` y la restriccion UNIQUE (empresa_id, id):
asi otras tablas pueden apuntarle con una llave foranea compuesta
(empresa_id, x_id) que impide mezclar datos de dos empresas. Esas llaves
compuestas, los triggers y Row Level Security estan en la migracion
0003_base_de_datos (el ORM de Django no sabe declararlos).
"""
from django.db import models
from django.db.models import Q
from django.db.models.functions import Cast, Now

AHORA = Now()
HOY = Cast(Now(), models.DateField())

DINERO = {"max_digits": 12, "decimal_places": 2}
CANTIDAD = {"max_digits": 12, "decimal_places": 3}

METODOS_PAGO = ["efectivo", "tarjeta", "transferencia", "otro"]


def en(campo, valores):
    """Q(campo IN valores), para las CHECK de estados."""
    return Q(**{f"{campo}__in": valores})


def check(nombre, condicion):
    return models.CheckConstraint(condition=condicion, name=nombre)


def unico(nombre, *campos, condicion=None):
    return models.UniqueConstraint(fields=list(campos), name=nombre, condition=condicion)


def fk(modelo, columna=None, null=False, **kw):
    """Llave foranea sin relacion inversa (evita choques de nombres) y PROTECT:
    en este sistema no se borra nada en cascada."""
    return models.ForeignKey(
        modelo, on_delete=models.PROTECT, related_name="+", null=null, blank=null,
        db_column=columna, **kw,
    )


class DeEmpresa(models.Model):
    """Tabla de datos de un cliente (empresa)."""

    empresa = fk("Empresa")

    class Meta:
        abstract = True
        constraints = [unico("%(class)s_empresa_id_id_key", "empresa", "id")]
