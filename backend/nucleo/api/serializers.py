from django.db import connection
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from nucleo.models import (Cita, Paciente, PacienteClinico, Sucursal, TipoCita, Trabajador, TrabajadorSucursal,
                           Tratamiento, Unidad)
from nucleo.models.clinico import ESTADOS_BAJA_CITA, ESTADOS_CITA, ESTADOS_LIBERAN_SILLON

from .errores import Conflicto
from .permisos import puede, sucursales_de, trabajador_de


# Sesion: solo describen la entrada y la respuesta para el esquema OpenAPI (tipos del frontend)
class EmpresaSesionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    codigo = serializers.CharField()
    nombre = serializers.CharField()


class TrabajadorSesionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()
    puesto = serializers.CharField()
    puesto_nombre = serializers.CharField()


class PermisoSesionSerializer(serializers.Serializer):
    id = serializers.CharField()
    nombre = serializers.CharField()
    grupo = serializers.CharField()


class SucursalSesionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()
    zona_horaria = serializers.CharField()


class SesionSerializer(serializers.Serializer):
    """Sin sesion solo viene "autenticado": false."""

    autenticado = serializers.BooleanField()
    login = serializers.CharField(required=False)
    debe_cambiar_password = serializers.BooleanField(required=False)
    empresa = EmpresaSesionSerializer(required=False, allow_null=True)
    trabajador = TrabajadorSesionSerializer(required=False, allow_null=True)
    permisos = serializers.ListField(child=serializers.CharField(), required=False)
    permisos_detalle = PermisoSesionSerializer(many=True, required=False)
    sucursales = SucursalSesionSerializer(many=True, required=False)


class EntradaSerializer(serializers.Serializer):
    empresa = serializers.CharField(help_text="Codigo de la clinica, ej. demo")
    usuario = serializers.CharField(help_text="nombre.apellido")
    password = serializers.CharField()


class CambiarPasswordSerializer(serializers.Serializer):
    actual = serializers.CharField()
    nueva = serializers.CharField()


class MensajeSerializer(serializers.Serializer):
    detail = serializers.CharField()
    codigo = serializers.CharField(required=False)


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

    @extend_schema_field(UnidadSerializer(many=True))
    def get_unidades(self, obj):
        return UnidadSerializer(Unidad.objects.filter(sucursal=obj).order_by("id"), many=True).data


class TrabajadorSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(read_only=True)
    sucursales = serializers.SerializerMethodField()

    class Meta:
        model = Trabajador
        fields = ["id", "nombre", "nombre_completo", "puesto", "atiende", "especialidad", "color_agenda", "activo", "sucursales"]

    def get_sucursales(self, obj) -> list[int]:
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

    def get_alergias(self, obj) -> str | None:
        c = self._clinico(obj)
        return c.alergias if c else None

    def get_datos_clinicos_completos(self, obj) -> bool:
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


def hora_local(momento):
    return timezone.localtime(momento).strftime("%H:%M")


class CitaSerializer(serializers.ModelSerializer):
    paciente_nombre = serializers.SerializerMethodField()
    doctor_nombre = serializers.SerializerMethodField()
    confirmar_empalme = serializers.BooleanField(write_only=True, required=False, default=False)
    # Cancelar y eliminar tienen su propia accion (piden motivo): aqui no se ofrecen
    estado = serializers.ChoiceField(choices=[e for e in ESTADOS_CITA if e not in ESTADOS_BAJA_CITA], required=False)

    class Meta:
        model = Cita
        fields = ["id", "sucursal", "unidad", "paciente", "paciente_nombre", "trabajador", "doctor_nombre",
                  "tipo_cita", "tratamiento", "piezas", "inicio", "fin", "estado", "nota", "confirmar_empalme",
                  "baja_motivo", "baja_por", "baja_en"]
        read_only_fields = ["baja_motivo", "baja_por", "baja_en"]

    def get_fields(self):
        campos = super().get_fields()
        # Row Level Security ya limita estas listas a la empresa del usuario
        for nombre, modelo in [("sucursal", Sucursal), ("unidad", Unidad), ("paciente", Paciente),
                               ("trabajador", Trabajador), ("tipo_cita", TipoCita), ("tratamiento", Tratamiento)]:
            campos[nombre].queryset = modelo.objects.all()
        return campos

    def get_paciente_nombre(self, obj) -> str:
        return f"{obj.paciente.nombre} {obj.paciente.apellidos}"

    def get_doctor_nombre(self, obj) -> str:
        return obj.trabajador.nombre_completo

    def validate(self, datos):
        datos = super().validate(datos)
        request = self.context["request"]
        cita = self.instance
        if cita and cita.estado in ESTADOS_BAJA_CITA:
            raise serializers.ValidationError({"detail": f"La cita está {cita.estado}: ya no se modifica."})
        inicio = datos.get("inicio", getattr(cita, "inicio", None))
        fin = datos.get("fin", getattr(cita, "fin", None))
        trabajador = datos.get("trabajador", getattr(cita, "trabajador", None))
        sucursal = datos.get("sucursal", getattr(cita, "sucursal", None))
        confirmar = datos.pop("confirmar_empalme", False)

        # La cita es con alguien que atiende pacientes (por persona, no por puesto)
        if trabajador and (cita is None or trabajador != cita.trabajador) and not trabajador.atiende:
            raise serializers.ValidationError({"trabajador": f"{trabajador.nombre_completo} no atiende pacientes."})

        # Sin "todas_sucursales" solo se agenda en las sucursales asignadas
        if (sucursal and not puede(request, "todas_sucursales")
                and not sucursales_de(request).filter(sucursal_id=sucursal.id).exists()):
            raise PermissionDenied("No tienes acceso a esa sucursal.")

        # Horario: solo a las :00 y :30 y nunca en el pasado, al crear o al mover (requisitos 2.3)
        nueva_hora = cita is None or ("inicio" in datos and datos["inicio"] != cita.inicio)
        if inicio and nueva_hora:
            local = timezone.localtime(inicio)
            if local.minute not in (0, 30) or local.second or local.microsecond:
                raise serializers.ValidationError({"inicio": "Las citas empiezan solo a las :00 o a las :30."})
        # Cambiar solo el sillón de una cita pasada sí se permite (corregir dónde se atendió)
        if inicio and nueva_hora and inicio <= timezone.now():
            raise serializers.ValidationError({"inicio": "No se puede agendar ni mover una cita a un día u hora que ya pasó."})

        cambia_agenda = cita is None or any(k in datos and datos[k] != getattr(cita, k) for k in ("inicio", "fin", "trabajador"))
        if inicio and fin and trabajador and cambia_agenda and not confirmar:
            # El doctor en dos lugares a la vez: se avisa diciendo cual cita es y quien agenda decide
            # (solo al crear o al cambiar hora, duracion o doctor; no al cambiar la nota o el estado)
            choque = (Cita.objects.filter(trabajador=trabajador, inicio__lt=fin, fin__gt=inicio)
                      .exclude(estado__in=ESTADOS_LIBERAN_SILLON)
                      .select_related("paciente", "tratamiento", "tipo_cita", "unidad", "sucursal").order_by("inicio"))
            if cita:
                choque = choque.exclude(pk=cita.pk)
            otra = choque.first()
            if otra:
                horario = f"{trabajador.nombre_completo} ya tiene una cita de {hora_local(otra.inicio)} a {hora_local(otra.fin)}"
                ve_sucursal = (puede(request, "todas_sucursales")
                               or sucursales_de(request).filter(sucursal_id=otra.sucursal_id).exists())
                if ve_sucursal:
                    que = otra.tratamiento or otra.tipo_cita
                    detalle = (f"({que.nombre + ', ' if que else ''}{otra.paciente.nombre} {otra.paciente.apellidos}) "
                               f"en {otra.unidad.nombre}")
                else:
                    # Cita de una sucursal que esta persona no ve: solo horario y sucursal (decidido en v0.6.0)
                    detalle = f"en la sucursal {otra.sucursal.nombre}"
                raise Conflicto(f"{horario} {detalle}. Envía confirmar_empalme=true para agendar de todos modos.")
        return datos

    def create(self, datos):
        request = self.context["request"]
        return Cita.objects.create(empresa_id=request.user.empresa_id, creado_por=trabajador_de(request), **datos)
