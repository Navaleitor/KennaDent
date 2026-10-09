from django.db import connection
from rest_framework import serializers

from nucleo.models import (Cita, Paciente, PacienteClinico, Sucursal, TipoCita, Trabajador, TrabajadorSucursal,
                           Tratamiento, Unidad)
from nucleo.models.clinico import ESTADOS_CITA

from .permisos import puede, trabajador_de


def mayus(texto):
    """Nombres en MAYUSCULAS, como KD.mayus del frontend."""
    return " ".join(str(texto or "").split()).upper()


class UnidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidad
        fields = ["id", "nombre", "activo"]


class SucursalSerializer(serializers.ModelSerializer):
    unidades = serializers.SerializerMethodField()

    class Meta:
        model = Sucursal
        fields = ["id", "nombre", "direccion", "telefono", "zona_horaria", "activo", "unidades"]

    def get_unidades(self, obj):
        return UnidadSerializer(Unidad.objects.filter(sucursal=obj).order_by("id"), many=True).data


class TrabajadorSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(read_only=True)
    sucursales = serializers.SerializerMethodField()

    class Meta:
        model = Trabajador
        fields = ["id", "nombre", "nombre_completo", "puesto", "especialidad", "color_agenda", "activo", "sucursales"]

    def get_sucursales(self, obj):
        return list(TrabajadorSucursal.objects.filter(trabajador=obj, activo=True)
                    .order_by("-es_base", "sucursal_id").values_list("sucursal_id", flat=True))


class TipoCitaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoCita
        fields = ["id", "nombre", "duracion_min", "pide_tratamiento", "es_diagnostico", "activo"]


class TratamientoSerializer(serializers.ModelSerializer):
    """Sin el permiso "dinero" no se envia el precio (regla de CLAUDE.md)."""

    class Meta:
        model = Tratamiento
        fields = ["id", "nombre", "categoria", "precio_base", "duracion_min", "activo"]

    def validate_nombre(self, valor):
        return mayus(valor)

    def to_representation(self, obj):
        datos = super().to_representation(obj)
        if not puede(self.context["request"], "dinero"):
            datos.pop("precio_base", None)
        return datos

    def create(self, datos):
        return Tratamiento.objects.create(empresa_id=self.context["request"].user.empresa_id, **datos)


class PacienteSerializer(serializers.ModelSerializer):
    # Recepcion VE la alerta de alergias, pero no la captura (requisitos 2.2)
    alergias = serializers.SerializerMethodField()
    datos_clinicos_completos = serializers.SerializerMethodField()

    class Meta:
        model = Paciente
        fields = ["id", "expediente", "nombre", "apellidos", "sexo", "fecha_nacimiento", "telefono", "correo",
                  "sucursal_origen", "activo", "baja_en", "baja_motivo", "creado_en",
                  "alergias", "datos_clinicos_completos"]
        read_only_fields = ["expediente", "activo", "baja_en", "baja_motivo", "creado_en"]

    def get_fields(self):
        campos = super().get_fields()
        campos["sucursal_origen"].queryset = Sucursal.objects.all()   # RLS: solo las de la empresa
        return campos

    def _clinico(self, obj):
        try:
            return obj.clinico
        except PacienteClinico.DoesNotExist:
            return None

    def get_alergias(self, obj):
        c = self._clinico(obj)
        return c.alergias if c else None

    def get_datos_clinicos_completos(self, obj):
        c = self._clinico(obj)
        return bool(c and c.completado)

    def validate_nombre(self, valor):
        return mayus(valor)

    def validate_apellidos(self, valor):
        return mayus(valor)

    def create(self, datos):
        request = self.context["request"]
        empresa_id = request.user.empresa_id
        with connection.cursor() as c:
            # Un candado por empresa: dos altas simultaneas no reciben el mismo expediente
            c.execute("SELECT pg_advisory_xact_lock(42, %s)", [empresa_id])
            c.execute("""SELECT COALESCE(MAX(NULLIF(regexp_replace(expediente, '\\D', '', 'g'), '')::int), 0) + 1
                           FROM paciente WHERE empresa_id = %s""", [empresa_id])
            numero = c.fetchone()[0]
        paciente = Paciente.objects.create(empresa_id=empresa_id, expediente=f"KD-{numero:05d}",
                                           creado_por=trabajador_de(request), **datos)
        # Si lo da de alta recepcion, al doctor le llega el aviso de completar alergias y antecedentes
        PacienteClinico.objects.create(empresa_id=empresa_id, paciente=paciente, completado=False)
        return paciente


class CitaSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.SerializerMethodField()
    doctor_nombre = serializers.SerializerMethodField()
    confirmar_empalme = serializers.BooleanField(write_only=True, required=False, default=False)
    estado = serializers.ChoiceField(choices=ESTADOS_CITA, required=False)

    class Meta:
        model = Cita
        fields = ["id", "sucursal", "unidad", "paciente", "paciente_nombre", "trabajador", "doctor_nombre",
                  "tipo_cita", "tratamiento", "piezas", "inicio", "fin", "estado", "nota", "confirmar_empalme"]

    def get_fields(self):
        campos = super().get_fields()
        # Row Level Security ya limita estas listas a la empresa del usuario
        for nombre, modelo in [("sucursal", Sucursal), ("unidad", Unidad), ("paciente", Paciente),
                               ("trabajador", Trabajador), ("tipo_cita", TipoCita), ("tratamiento", Tratamiento)]:
            campos[nombre].queryset = modelo.objects.all()
        return campos

    def get_paciente_nombre(self, obj):
        return f"{obj.paciente.nombre} {obj.paciente.apellidos}"

    def get_doctor_nombre(self, obj):
        return obj.trabajador.nombre_completo

    def validate(self, datos):
        datos = super().validate(datos)
        inicio = datos.get("inicio", getattr(self.instance, "inicio", None))
        fin = datos.get("fin", getattr(self.instance, "fin", None))
        trabajador = datos.get("trabajador", getattr(self.instance, "trabajador", None))
        confirmar = datos.pop("confirmar_empalme", False)
        if inicio and fin and trabajador and not confirmar:
            # El doctor en dos lugares a la vez: se avisa, no se prohibe (agenda.js)
            choque = (Cita.objects.filter(trabajador=trabajador, inicio__lt=fin, fin__gt=inicio)
                      .exclude(estado__in=["cancelada", "no_asistio"]))
            if self.instance:
                choque = choque.exclude(pk=self.instance.pk)
            if choque.exists():
                from .errores import Conflicto
                raise Conflicto("El doctor ya tiene otra cita en ese horario. "
                                "Envia confirmar_empalme=true para agendar de todos modos.")
        return datos

    def create(self, datos):
        request = self.context["request"]
        return Cita.objects.create(empresa_id=request.user.empresa_id, creado_por=trabajador_de(request), **datos)
