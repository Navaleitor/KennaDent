"""Pacientes, agenda, consulta, plan de tratamiento y odontograma."""
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import ArrayField, DateTimeRangeField, RangeOperators
from django.db import models
from django.db.models import F, Func, Q

from .base import AHORA, DINERO, DeEmpresa, check, en, fk, unico
from .catalogos import TipoCita, Tratamiento
from .estructura import CatalogoHallazgo, Sucursal, Trabajador, Unidad

ESTADOS_CITA = ["programada", "confirmada", "en_sala", "atendida", "no_asistio", "cancelada"]
ESTADOS_LIBERAN_SILLON = ["cancelada", "no_asistio"]
ESTADOS_PRESUPUESTO = ["borrador", "enviado", "aceptado", "rechazado"]
ESTADOS_PLAN = ["pendiente", "aceptado", "realizado", "rechazado"]
CARAS = ["V", "L", "M", "D", "O"]   # vestibular, lingual/palatina, mesial, distal, oclusal/incisal


class TsTzRange(Func):
    function = "TSTZRANGE"
    output_field = DateTimeRangeField()


def piezas():
    """Piezas dentales FDI. La validacion exacta (son_piezas_fdi) esta en la migracion 0002."""
    return ArrayField(models.SmallIntegerField(), null=True, blank=True)


class Paciente(DeEmpresa):
    """Paciente de la EMPRESA: lo comparten sus sucursales, no otras empresas."""

    expediente = models.TextField()                     # 'KD-00001'
    nombre = models.TextField()
    apellidos = models.TextField()
    sexo = models.CharField(max_length=1, null=True, blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)   # define la denticion
    telefono = models.TextField(null=True, blank=True)
    correo = models.TextField(null=True, blank=True)
    sucursal_origen = fk(Sucursal, null=True)
    activo = models.BooleanField(db_default=True)
    baja_en = models.DateField(null=True, blank=True)
    baja_motivo = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField(db_default=AHORA)
    creado_por = fk(Trabajador, "creado_por", null=True)

    class Meta(DeEmpresa.Meta):
        db_table = "paciente"
        constraints = DeEmpresa.Meta.constraints + [
            unico("paciente_empresa_expediente_key", "empresa", "expediente"),
            check("paciente_sexo_check", en("sexo", ["F", "M"])),
        ]
        indexes = [models.Index(fields=["empresa", "apellidos", "nombre"], name="ix_paciente_nombre")]

    def __str__(self):
        return f"{self.expediente} {self.nombre} {self.apellidos}"


class PacienteClinico(models.Model):
    """Alergias y antecedentes, aparte de los datos de contacto (datos sensibles)."""

    empresa = fk("Empresa")
    paciente = models.OneToOneField(Paciente, on_delete=models.PROTECT, primary_key=True, related_name="clinico")
    alergias = models.TextField(null=True, blank=True)
    antecedentes = models.TextField(null=True, blank=True)
    completado = models.BooleanField(db_default=False)    # false = aviso al doctor
    actualizado_en = models.DateTimeField(db_default=AHORA)
    actualizado_por = fk(Trabajador, "actualizado_por", null=True)

    class Meta:
        db_table = "paciente_clinico"


class Cita(DeEmpresa):
    sucursal = fk(Sucursal)
    unidad = fk(Unidad)
    paciente = fk(Paciente)
    trabajador = fk(Trabajador)            # doctor que atiende
    tipo_cita = fk(TipoCita, null=True)
    tratamiento = fk(Tratamiento, null=True)
    piezas = piezas()
    plan_item = fk("PlanItem", null=True)
    inicio = models.DateTimeField()
    fin = models.DateTimeField()
    estado = models.TextField(db_default="programada")
    nota = models.TextField(null=True, blank=True)
    creado_por = fk(Trabajador, "creado_por", null=True)
    creado_en = models.DateTimeField(db_default=AHORA)

    class Meta(DeEmpresa.Meta):
        db_table = "cita"
        constraints = DeEmpresa.Meta.constraints + [
            unico("cita_empresa_id_paciente_doctor_sucursal_key", "empresa", "id", "paciente", "trabajador", "sucursal"),
            check("cita_estado_check", en("estado", ESTADOS_CITA)),
            check("cita_check", Q(fin__gt=F("inicio"))),
            # Un sillon no puede tener dos citas a la vez. El empalme del DOCTOR
            # no se prohibe: el frontend solo avisa (v_cita_doctor_empalmada).
            ExclusionConstraint(
                name="cita_sin_empalme_unidad",
                expressions=[("unidad", RangeOperators.EQUAL), (TsTzRange("inicio", "fin"), RangeOperators.OVERLAPS)],
                condition=~Q(estado__in=ESTADOS_LIBERAN_SILLON),
            ),
        ]
        indexes = [
            models.Index(fields=["paciente"], name="ix_cita_paciente"),
            models.Index(fields=["sucursal", "inicio"], name="ix_cita_sucursal_inicio"),
            models.Index(fields=["trabajador", "inicio"], name="ix_cita_doctor_inicio"),
        ]


class Consulta(DeEmpresa):
    """Registro de consulta: una por cita, a nombre del doctor de esa cita."""

    cita = models.OneToOneField(Cita, on_delete=models.PROTECT, related_name="consulta")
    paciente = fk(Paciente)
    trabajador = fk(Trabajador)
    sucursal = fk(Sucursal)
    registrado_en = models.DateTimeField(db_default=AHORA)
    motivo = models.TextField(null=True, blank=True)
    diagnostico = models.TextField(null=True, blank=True)
    notas = models.TextField(null=True, blank=True)

    class Meta(DeEmpresa.Meta):
        db_table = "consulta"
        constraints = DeEmpresa.Meta.constraints + [unico("consulta_empresa_id_paciente_key", "empresa", "id", "paciente")]
        indexes = [
            models.Index(fields=["paciente", "registrado_en"], name="ix_consulta_paciente"),
            models.Index(fields=["trabajador", "registrado_en"], name="ix_consulta_doctor"),
        ]


class Presupuesto(DeEmpresa):
    folio = models.TextField()                    # 'P-00001'
    paciente = fk(Paciente)
    sucursal = fk(Sucursal)                       # donde se vendio
    trabajador = fk(Trabajador)                   # a quien se atribuye la venta
    # "en tratamiento" y "completado" se calculan (vista v_presupuesto)
    estado = models.TextField(db_default="borrador")
    descuento_pct = models.DecimalField(max_digits=5, decimal_places=2, db_default=0)
    forma_pago = models.TextField(db_default="contado")
    num_pagos = models.IntegerField(db_default=1)
    nota = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField(db_default=AHORA)
    estado_en = models.DateTimeField(db_default=AHORA)

    class Meta(DeEmpresa.Meta):
        db_table = "presupuesto"
        constraints = DeEmpresa.Meta.constraints + [
            unico("presupuesto_empresa_folio_key", "empresa", "folio"),
            unico("presupuesto_empresa_id_paciente_key", "empresa", "id", "paciente"),
            check("presupuesto_estado_check", en("estado", ESTADOS_PRESUPUESTO)),
            check("presupuesto_descuento_check", Q(descuento_pct__gte=0, descuento_pct__lte=100)),
            check("presupuesto_forma_pago_check", en("forma_pago", ["contado", "mensualidades"])),
            check("presupuesto_num_pagos_check", Q(num_pagos__gt=0)),
            check("presupuesto_check", Q(forma_pago="mensualidades") | Q(num_pagos=1)),
        ]
        indexes = [models.Index(fields=["paciente"], name="ix_presupuesto_paciente")]


class PlanItem(DeEmpresa):
    """Plan de tratamiento: lo que el doctor recomienda. Existe aunque aun no haya presupuesto."""

    paciente = fk(Paciente)
    tratamiento = fk(Tratamiento)
    piezas = piezas()
    cantidad = models.IntegerField(db_default=1)
    precio_unitario = models.DecimalField(**DINERO)
    estado = models.TextField(db_default="pendiente")
    estado_en = models.DateTimeField(db_default=AHORA)
    diagnosticado_por = fk(Trabajador, "diagnosticado_por")
    sucursal = fk(Sucursal)
    consulta_origen = fk(Consulta, null=True)
    presupuesto = fk(Presupuesto, null=True)
    creado_en = models.DateTimeField(db_default=AHORA)

    class Meta(DeEmpresa.Meta):
        db_table = "plan_item"
        constraints = DeEmpresa.Meta.constraints + [
            unico("plan_item_empresa_id_paciente_key", "empresa", "id", "paciente"),
            check("plan_item_estado_check", en("estado", ESTADOS_PLAN)),
            check("plan_item_cantidad_check", Q(cantidad__gt=0)),
            check("plan_item_precio_check", Q(precio_unitario__gte=0)),
        ]
        indexes = [
            models.Index(fields=["paciente"], name="ix_plan_paciente"),
            models.Index(fields=["presupuesto"], name="ix_plan_presupuesto"),
        ]


class ConsultaProcedimiento(DeEmpresa):
    """Lo que el doctor REALMENTE hizo y su precio: base de ventas y reportes."""

    consulta = fk(Consulta)
    paciente = fk(Paciente)
    tratamiento = fk(Tratamiento)
    piezas = piezas()
    cantidad = models.IntegerField(db_default=1)
    precio = models.DecimalField(**DINERO)        # total del renglon
    plan_item = fk(PlanItem, null=True)

    class Meta(DeEmpresa.Meta):
        db_table = "consulta_procedimiento"
        constraints = DeEmpresa.Meta.constraints + [
            unico("ux_proc_plan_una_vez", "plan_item", condicion=Q(plan_item__isnull=False)),
            check("consulta_procedimiento_cantidad_check", Q(cantidad__gt=0)),
            check("consulta_procedimiento_precio_check", Q(precio__gte=0)),
        ]
        indexes = [models.Index(fields=["consulta"], name="ix_proc_consulta")]


class OdontogramaHallazgo(DeEmpresa):
    """Odontograma con historial: lo rojo que se resuelve se marca resuelto_en y se agrega el azul."""

    paciente = fk(Paciente)
    pieza = models.SmallIntegerField()
    cara = models.CharField(max_length=1, null=True, blank=True)   # nulo = diente completo
    hallazgo = fk(CatalogoHallazgo)
    registrado_en = models.DateTimeField(db_default=AHORA)
    resuelto_en = models.DateTimeField(null=True, blank=True)
    trabajador = fk(Trabajador)
    consulta = fk(Consulta, null=True)
    nota = models.TextField(null=True, blank=True)

    class Meta(DeEmpresa.Meta):
        db_table = "odontograma_hallazgo"
        constraints = DeEmpresa.Meta.constraints + [
            check("odontograma_hallazgo_cara_check", en("cara", CARAS)),
            check("odontograma_hallazgo_resuelto_check",
                  Q(resuelto_en__isnull=True) | Q(resuelto_en__gte=F("registrado_en"))),
        ]
        indexes = [models.Index(fields=["paciente", "pieza"], name="ix_odonto_paciente")]
