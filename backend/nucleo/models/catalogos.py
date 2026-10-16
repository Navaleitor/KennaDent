"""Catalogos de cada empresa: tratamientos, precios, tipos de cita y material."""
from django.db import models
from django.db.models import Q

from .base import CANTIDAD, DINERO, HOY, DeEmpresa, check, fk, unico
from .estructura import Sucursal


class Tratamiento(DeEmpresa):
    nombre = models.TextField()
    categoria = models.TextField(db_default="Otro")      # reporte "ventas por categoria"
    precio_base = models.DecimalField(**DINERO)
    duracion_min = models.IntegerField(db_default=30)
    activo = models.BooleanField(db_default=True)

    class Meta(DeEmpresa.Meta):
        db_table = "tratamiento"
        constraints = DeEmpresa.Meta.constraints + [
            unico("tratamiento_empresa_nombre_key", "empresa", "nombre"),
            check("tratamiento_precio_check", Q(precio_base__gte=0)),
            check("tratamiento_duracion_check", Q(duracion_min__gt=0)),
        ]

    def __str__(self):
        return self.nombre


class PrecioSucursal(DeEmpresa):
    """Precio especial por sucursal con historial (vigente_desde). Sin renglon aplica precio_base."""

    tratamiento = fk(Tratamiento)
    sucursal = fk(Sucursal)
    precio = models.DecimalField(**DINERO)
    vigente_desde = models.DateField(db_default=HOY)

    class Meta(DeEmpresa.Meta):
        db_table = "precio_sucursal"
        constraints = DeEmpresa.Meta.constraints + [
            unico("precio_sucursal_unico", "tratamiento", "sucursal", "vigente_desde"),
            check("precio_sucursal_precio_check", Q(precio__gte=0)),
        ]


class TipoCita(DeEmpresa):
    nombre = models.TextField()
    duracion_min = models.IntegerField(db_default=30)
    pide_tratamiento = models.BooleanField(db_default=False)
    es_diagnostico = models.BooleanField(db_default=False)
    activo = models.BooleanField(db_default=True)

    class Meta(DeEmpresa.Meta):
        db_table = "tipo_cita"
        constraints = DeEmpresa.Meta.constraints + [
            unico("tipo_cita_empresa_nombre_key", "empresa", "nombre"),
            check("tipo_cita_duracion_check", Q(duracion_min__gt=0)),
        ]

    def __str__(self):
        return self.nombre


class Material(DeEmpresa):
    nombre = models.TextField()
    categoria = models.TextField(null=True, blank=True)
    unidad_medida = models.TextField()
    costo = models.DecimalField(**DINERO, db_default=0)
    proveedor = models.TextField(null=True, blank=True)
    # Lo que gasta CUALQUIER cita atendida (CONSUMO_BASE en js/data.js)
    consumo_por_cita = models.DecimalField(**CANTIDAD, db_default=0)
    activo = models.BooleanField(db_default=True)

    class Meta(DeEmpresa.Meta):
        db_table = "material"
        constraints = DeEmpresa.Meta.constraints + [
            unico("material_empresa_nombre_key", "empresa", "nombre"),
            check("material_costo_check", Q(costo__gte=0)),
            check("material_consumo_check", Q(consumo_por_cita__gte=0)),
        ]

    def __str__(self):
        return self.nombre


class MaterialSucursal(DeEmpresa):
    """Minimo por sucursal (alertas de stock bajo y critico)."""

    material = fk(Material)
    sucursal = fk(Sucursal)
    minimo = models.DecimalField(**CANTIDAD, db_default=0)

    class Meta(DeEmpresa.Meta):
        db_table = "material_sucursal"
        constraints = DeEmpresa.Meta.constraints + [
            unico("material_sucursal_unico", "material", "sucursal"),
            check("material_sucursal_minimo_check", Q(minimo__gte=0)),
        ]


class TratamientoMaterial(DeEmpresa):
    tratamiento = fk(Tratamiento)
    material = fk(Material)
    cantidad = models.DecimalField(**CANTIDAD)   # por pieza

    class Meta(DeEmpresa.Meta):
        db_table = "tratamiento_material"
        constraints = DeEmpresa.Meta.constraints + [
            unico("tratamiento_material_unico", "tratamiento", "material"),
            check("tratamiento_material_cantidad_check", Q(cantidad__gt=0)),
        ]
