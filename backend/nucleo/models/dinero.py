"""Cuotas, pagos y caja. Los libros de dinero son de solo-agregar."""
from django.db import models
from django.db.models import F, Q

from .base import AHORA, DINERO, METODOS_PAGO, DeEmpresa, check, en, fk, unico
from .clinico import Cita, Consulta, Paciente, Presupuesto
from .estructura import Sucursal, Trabajador


class Cuota(DeEmpresa):
    presupuesto = fk(Presupuesto)
    numero = models.IntegerField()
    vence = models.DateField()
    monto = models.DecimalField(**DINERO)

    class Meta(DeEmpresa.Meta):
        db_table = "cuota"
        constraints = DeEmpresa.Meta.constraints + [
            unico("cuota_presupuesto_numero_key", "presupuesto", "numero"),
            unico("cuota_empresa_id_presupuesto_key", "empresa", "id", "presupuesto"),
            check("cuota_numero_check", Q(numero__gt=0)),
            check("cuota_monto_check", Q(monto__gt=0)),
        ]


class Pago(DeEmpresa):
    """Dinero que entrega el paciente. No se edita ni se borra."""

    paciente = fk(Paciente)
    sucursal = fk(Sucursal)                  # donde entro el dinero (caja)
    monto = models.DecimalField(**DINERO)
    metodo = models.TextField()
    concepto = models.TextField(null=True, blank=True)
    cita = fk(Cita, null=True)
    registrado_por = fk(Trabajador, "registrado_por")
    registrado_en = models.DateTimeField(db_default=AHORA)

    class Meta(DeEmpresa.Meta):
        db_table = "pago"
        constraints = DeEmpresa.Meta.constraints + [
            unico("pago_empresa_id_paciente_key", "empresa", "id", "paciente"),
            check("pago_monto_check", Q(monto__gt=0)),
            check("pago_metodo_check", en("metodo", METODOS_PAGO)),
        ]
        indexes = [
            models.Index(fields=["paciente"], name="ix_pago_paciente"),
            models.Index(fields=["sucursal", "registrado_en"], name="ix_pago_sucursal_fecha"),
        ]


class PagoAplicacion(DeEmpresa):
    """A que se aplica el dinero: a un presupuesto (y quiza una cuota) O a una consulta suelta."""

    pago = fk(Pago)
    paciente = fk(Paciente)
    presupuesto = fk(Presupuesto, null=True)
    cuota = fk(Cuota, null=True)
    consulta = fk(Consulta, null=True)
    monto = models.DecimalField(**DINERO)

    class Meta(DeEmpresa.Meta):
        db_table = "pago_aplicacion"
        constraints = DeEmpresa.Meta.constraints + [
            check("pago_aplicacion_monto_check", Q(monto__gt=0)),
            check("pago_aplicacion_destino_check",
                  Q(presupuesto__isnull=False, consulta__isnull=True) | Q(presupuesto__isnull=True, consulta__isnull=False)),
            check("pago_aplicacion_cuota_check", Q(cuota__isnull=True) | Q(presupuesto__isnull=False)),
        ]
        indexes = [
            models.Index(fields=["pago"], name="ix_aplicacion_pago"),
            models.Index(fields=["presupuesto"], name="ix_aplicacion_presupuesto"),
            models.Index(fields=["consulta"], name="ix_aplicacion_consulta"),
        ]


class CajaMovimiento(DeEmpresa):
    """Movimientos de caja que NO son pagos de pacientes (gastos, otros ingresos)."""

    sucursal = fk(Sucursal)
    tipo = models.TextField()
    concepto = models.TextField()
    monto = models.DecimalField(**DINERO)
    metodo = models.TextField()
    registrado_por = fk(Trabajador, "registrado_por")
    registrado_en = models.DateTimeField(db_default=AHORA)

    class Meta(DeEmpresa.Meta):
        db_table = "caja_movimiento"
        constraints = DeEmpresa.Meta.constraints + [
            check("caja_movimiento_tipo_check", en("tipo", ["ingreso", "egreso"])),
            check("caja_movimiento_monto_check", Q(monto__gt=0)),
            check("caja_movimiento_metodo_check", en("metodo", METODOS_PAGO)),
        ]
        indexes = [models.Index(fields=["sucursal", "registrado_en"], name="ix_caja_sucursal_fecha")]


class CorteCaja(DeEmpresa):
    """Corte diario: foto oficial al cerrar. Con el corte hecho, el dia ya no admite movimientos."""

    sucursal = fk(Sucursal)
    fecha = models.DateField()                     # dia local de la sucursal
    fondo = models.DecimalField(**DINERO)
    efectivo_esperado = models.DecimalField(**DINERO)
    efectivo_contado = models.DecimalField(**DINERO)
    diferencia = models.GeneratedField(
        expression=F("efectivo_contado") - F("efectivo_esperado"),
        output_field=models.DecimalField(**DINERO), db_persist=True,
    )
    notas = models.TextField(null=True, blank=True)
    cerrado_por = fk(Trabajador, "cerrado_por")
    cerrado_en = models.DateTimeField(db_default=AHORA)

    class Meta(DeEmpresa.Meta):
        db_table = "corte_caja"
        constraints = DeEmpresa.Meta.constraints + [
            unico("corte_caja_sucursal_fecha_key", "sucursal", "fecha"),
            check("corte_caja_fondo_check", Q(fondo__gte=0)),
            check("corte_caja_contado_check", Q(efectivo_contado__gte=0)),
        ]
