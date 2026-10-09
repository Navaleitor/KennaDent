"""Plataforma (catalogos comunes), empresa, sucursales y personal."""
from django.conf import settings
from django.db import models
from django.db.models import F, Q

from .base import AHORA, HOY, DeEmpresa, check, en, fk, unico


# ---------- Catalogos de la plataforma (sin empresa) ----------

class Puesto(models.Model):
    id = models.TextField(primary_key=True)  # 'odontologo', 'recepcion'...
    nombre = models.TextField()
    atiende = models.BooleanField(db_default=False)          # puede tener citas a su nombre
    requiere_cedula = models.BooleanField(db_default=False)
    lleva_titulo = models.BooleanField(db_default=False)     # DR. / DRA.

    class Meta:
        db_table = "puesto"

    def __str__(self):
        return self.nombre


class Permiso(models.Model):
    id = models.TextField(primary_key=True)  # 'dinero', 'agenda_todas'...
    nombre = models.TextField()
    grupo = models.TextField()

    class Meta:
        db_table = "permiso"

    def __str__(self):
        return self.nombre


class PuestoPermiso(models.Model):
    """Permisos sugeridos de cada puesto (plantilla al dar de alta a alguien)."""

    puesto = fk(Puesto)
    permiso = fk(Permiso)

    class Meta:
        db_table = "puesto_permiso"
        constraints = [unico("puesto_permiso_unico", "puesto", "permiso")]


class CatalogoHallazgo(models.Model):
    """Hallazgos del odontograma. color: rojo = por tratar, azul = realizado."""

    codigo = models.TextField(unique=True)
    nombre = models.TextField()
    ambito = models.TextField()   # 'cara' o 'diente'
    color = models.TextField()    # 'rojo' o 'azul'

    class Meta:
        db_table = "catalogo_hallazgo"
        constraints = [
            check("catalogo_hallazgo_ambito_check", en("ambito", ["cara", "diente"])),
            check("catalogo_hallazgo_color_check", en("color", ["rojo", "azul"])),
        ]

    def __str__(self):
        return self.nombre


# ---------- Empresa (cliente que paga la suscripcion) ----------

class Empresa(models.Model):
    # Codigo corto para iniciar sesion: "clinica + usuario" (ej. demo / andrea.garza)
    codigo = models.TextField(unique=True)
    nombre_comercial = models.TextField()
    razon_social = models.TextField(null=True, blank=True)
    rfc = models.TextField(null=True, blank=True)
    telefono = models.TextField(null=True, blank=True)
    correo = models.TextField(null=True, blank=True)
    activo = models.BooleanField(db_default=True)   # suscripcion vigente
    creado_en = models.DateTimeField(db_default=AHORA)

    class Meta:
        db_table = "empresa"
        constraints = [check("empresa_codigo_check", Q(codigo__regex=r"^[a-z0-9][a-z0-9-]*$"))]

    def __str__(self):
        return self.nombre_comercial


class Sucursal(DeEmpresa):
    nombre = models.TextField()
    direccion = models.TextField(null=True, blank=True)
    telefono = models.TextField(null=True, blank=True)
    # Define que es "hoy" para la caja y la agenda de ESA sucursal
    zona_horaria = models.TextField(db_default="America/Mexico_City")
    activo = models.BooleanField(db_default=True)

    class Meta(DeEmpresa.Meta):
        db_table = "sucursal"
        verbose_name, verbose_name_plural = "sucursal", "sucursales"
        constraints = DeEmpresa.Meta.constraints + [unico("sucursal_empresa_nombre_key", "empresa", "nombre")]

    def __str__(self):
        return self.nombre


class SucursalHorario(DeEmpresa):
    sucursal = fk(Sucursal)
    dia_semana = models.SmallIntegerField()   # 1 = lunes
    abre = models.TimeField()
    cierra = models.TimeField()

    class Meta(DeEmpresa.Meta):
        db_table = "sucursal_horario"
        constraints = DeEmpresa.Meta.constraints + [
            unico("sucursal_horario_unico", "sucursal", "dia_semana", "abre"),
            check("sucursal_horario_dia_check", Q(dia_semana__gte=1, dia_semana__lte=7)),
            check("sucursal_horario_check", Q(cierra__gt=F("abre"))),
        ]


class Unidad(DeEmpresa):
    """Unidad = sillon dental. La agenda cuelga de la unidad."""

    sucursal = fk(Sucursal)
    nombre = models.TextField()
    activo = models.BooleanField(db_default=True)

    class Meta(DeEmpresa.Meta):
        db_table = "unidad"
        verbose_name, verbose_name_plural = "unidad", "unidades"
        constraints = DeEmpresa.Meta.constraints + [
            unico("unidad_sucursal_nombre_key", "sucursal", "nombre"),
            unico("unidad_empresa_sucursal_id_key", "empresa", "sucursal", "id"),
        ]

    def __str__(self):
        return self.nombre


class Trabajador(DeEmpresa):
    puesto = fk(Puesto)                      # UN solo puesto
    nombre = models.TextField()              # en MAYUSCULAS
    sexo = models.CharField(max_length=1, null=True, blank=True)
    lleva_titulo = models.BooleanField(db_default=False)
    especialidad = models.TextField(null=True, blank=True)
    cedula = models.TextField(null=True, blank=True)
    telefono = models.TextField(null=True, blank=True)
    correo = models.TextField(null=True, blank=True)
    color_agenda = models.TextField(null=True, blank=True)
    # Inicio de sesion: tabla usuario (sistema de usuarios de Django)
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   null=True, blank=True, related_name="trabajador")
    activo = models.BooleanField(db_default=True)
    alta_en = models.DateField(db_default=HOY)
    baja_en = models.DateField(null=True, blank=True)
    baja_motivo = models.TextField(null=True, blank=True)

    class Meta(DeEmpresa.Meta):
        db_table = "trabajador"
        verbose_name, verbose_name_plural = "trabajador", "trabajadores"
        constraints = DeEmpresa.Meta.constraints + [
            check("trabajador_sexo_check", en("sexo", ["F", "M"])),
            check("trabajador_baja_check", Q(activo=True) | Q(baja_en__isnull=False)),
        ]

    def __str__(self):
        return self.nombre_completo

    @property
    def nombre_completo(self):
        """Con DR. / DRA. si lleva titulo (KD.nombrePersona)."""
        if not self.lleva_titulo:
            return self.nombre
        return f"{'DR.' if self.sexo == 'M' else 'DRA.'} {self.nombre}"


class TrabajadorPermiso(DeEmpresa):
    """Permisos EFECTIVOS de cada persona: se copian del puesto y el administrador los ajusta."""

    trabajador = fk(Trabajador)
    permiso = fk(Permiso)

    class Meta(DeEmpresa.Meta):
        db_table = "trabajador_permiso"
        constraints = DeEmpresa.Meta.constraints + [unico("trabajador_permiso_unico", "trabajador", "permiso")]


class TrabajadorSucursal(DeEmpresa):
    """En que sucursales trabaja o puede cubrir cada persona."""

    trabajador = fk(Trabajador)
    sucursal = fk(Sucursal)
    es_base = models.BooleanField(db_default=False)
    activo = models.BooleanField(db_default=True)   # no se borra: lo usan citas pasadas

    class Meta(DeEmpresa.Meta):
        db_table = "trabajador_sucursal"
        constraints = DeEmpresa.Meta.constraints + [
            unico("trabajador_sucursal_unico", "trabajador", "sucursal"),
            unico("trabajador_sucursal_empresa_key", "empresa", "trabajador", "sucursal"),
            unico("ux_trabajador_una_base", "trabajador", condicion=Q(es_base=True)),
        ]
