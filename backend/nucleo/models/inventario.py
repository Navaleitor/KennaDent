"""Inventario por sucursal (libro de movimientos), traslados, solicitudes y seguimiento."""
from django.db import models
from django.db.models import F, Q

from .base import AHORA, CANTIDAD, HOY, DeEmpresa, check, en, fk, unico
from .catalogos import Material
from .clinico import Consulta, Paciente
from .estructura import Sucursal, Trabajador

MOTIVOS = ["compra", "consumo", "entrega", "traslado", "ajuste", "merma"]


class InventarioTraslado(DeEmpresa):
    """Un traslado es UN documento; sus dos movimientos (salida y entrada) apuntan a el."""

    material = fk(Material)
    origen = fk(Sucursal)
    destino = fk(Sucursal)
    cantidad = models.DecimalField(**CANTIDAD)
    nota = models.TextField(null=True, blank=True)
    registrado_por = fk(Trabajador, "registrado_por")
    registrado_en = models.DateTimeField(db_default=AHORA)

    class Meta(DeEmpresa.Meta):
        db_table = "inventario_traslado"
        constraints = DeEmpresa.Meta.constraints + [
            check("inventario_traslado_cantidad_check", Q(cantidad__gt=0)),
            check("inventario_traslado_check", ~Q(origen=F("destino"))),
        ]


class InventarioMovimiento(DeEmpresa):
    sucursal = fk(Sucursal)
    material = fk(Material)
    tipo = models.TextField()
    motivo = models.TextField()
    cantidad = models.DecimalField(**CANTIDAD)
    nota = models.TextField(null=True, blank=True)
    consulta = fk(Consulta, null=True)          # consumo generado al registrar una consulta
    traslado = fk(InventarioTraslado, null=True)
    registrado_por = fk(Trabajador, "registrado_por")
    registrado_en = models.DateTimeField(db_default=AHORA)

    class Meta(DeEmpresa.Meta):
        db_table = "inventario_movimiento"
        constraints = DeEmpresa.Meta.constraints + [
            check("inventario_movimiento_tipo_check", en("tipo", ["entrada", "salida"])),
            check("inventario_movimiento_motivo_check", en("motivo", MOTIVOS)),
            check("inventario_movimiento_cantidad_check", Q(cantidad__gt=0)),
            check("inventario_movimiento_check",
                  Q(motivo="traslado", traslado__isnull=False) | (~Q(motivo="traslado") & Q(traslado__isnull=True))),
            unico("ux_inv_traslado_tipo", "traslado", "tipo", condicion=Q(traslado__isnull=False)),
        ]
        indexes = [models.Index(fields=["sucursal", "material"], name="ix_inv_sucursal_material")]


class SolicitudMaterial(DeEmpresa):
    sucursal = fk(Sucursal)
    material = fk(Material)
    cantidad = models.DecimalField(**CANTIDAD)
    nota = models.TextField(null=True, blank=True)
    solicitado_por = fk(Trabajador, "solicitado_por")
    solicitado_en = models.DateTimeField(db_default=AHORA)
    estado = models.TextField(db_default="pendiente")
    atendido_por = fk(Trabajador, "atendido_por", null=True)
    atendido_en = models.DateTimeField(null=True, blank=True)

    class Meta(DeEmpresa.Meta):
        db_table = "solicitud_material"
        constraints = DeEmpresa.Meta.constraints + [
            check("solicitud_material_cantidad_check", Q(cantidad__gt=0)),
            check("solicitud_material_estado_check", en("estado", ["pendiente", "entregada", "rechazada"])),
            check("solicitud_material_check",
                  Q(estado="pendiente", atendido_por__isnull=True) | (~Q(estado="pendiente") & Q(atendido_por__isnull=False))),
        ]


class Tarea(DeEmpresa):
    sucursal = fk(Sucursal, null=True)
    paciente = fk(Paciente, null=True)
    titulo = models.TextField()
    hecho = models.BooleanField(db_default=False)
    creado_por = fk(Trabajador, "creado_por")
    creado_en = models.DateTimeField(db_default=AHORA)

    class Meta(DeEmpresa.Meta):
        db_table = "tarea"


class SeguimientoMarca(DeEmpresa):
    """'Marcar realizado' en seguimiento lo oculta 30 dias. clave = 'pres:<id>', 'pac:<id>'..."""

    clave = models.TextField()
    marcado_en = models.DateField(db_default=HOY)
    marcado_por = fk(Trabajador, "marcado_por")

    class Meta(DeEmpresa.Meta):
        db_table = "seguimiento_marca"
        constraints = DeEmpresa.Meta.constraints + [unico("seguimiento_marca_unico", "empresa", "clave")]


class Bitacora(DeEmpresa):
    """Quien vio o cambio que expediente (NOM-024 / LFPDPPP). La escribe la aplicacion."""

    trabajador_id = models.BigIntegerField(null=True, blank=True)
    accion = models.TextField()          # 'ver', 'crear', 'editar', 'baja'
    entidad = models.TextField()         # 'paciente', 'consulta'...
    entidad_id = models.BigIntegerField(null=True, blank=True)
    paciente_id = models.BigIntegerField(null=True, blank=True)
    detalle = models.JSONField(null=True, blank=True)
    en = models.DateTimeField(db_default=AHORA)

    class Meta(DeEmpresa.Meta):
        db_table = "bitacora"
        indexes = [models.Index(fields=["paciente_id", "en"], name="ix_bitacora_paciente")]
