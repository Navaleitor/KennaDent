from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as ErrorDjango
from django.db.models import Q
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from nucleo.empresa_actual import fijar_contexto
from nucleo.models import (Bitacora, Cita, Paciente, Permiso, Sucursal, TipoCita, Trabajador, TrabajadorSucursal,
                           Tratamiento)
from nucleo.models.clinico import ESTADOS_BAJA_CITA

from .errores import guardar_con_reglas
from .permisos import TienePermisos, permisos_de, puede, sucursales_de, trabajador_de
from .serializers import (CambiarPasswordSerializer, CitaSerializer, EntradaSerializer, MensajeSerializer,
                          PacienteSerializer, SesionSerializer, SucursalSerializer, TipoCitaSerializer,
                          TrabajadorSerializer, TratamientoSerializer)


def datos_sesion(request):
    u = request.user
    if not u.is_authenticated:
        return {"autenticado": False}
    t = trabajador_de(request)
    empresa = u.empresa
    permisos = sorted(permisos_de(request))
    # Con nombres, para que la pantalla no los invente (sucursales asignadas, no "todas")
    sucursales = (TrabajadorSucursal.objects.filter(trabajador=t, activo=True, sucursal__activo=True)
                  .select_related("sucursal").order_by("sucursal_id")) if t else []
    return {
        "autenticado": True,
        "login": u.login,
        "debe_cambiar_password": u.debe_cambiar_password,
        "empresa": {"id": empresa.id, "codigo": empresa.codigo, "nombre": empresa.nombre_comercial} if empresa else None,
        "trabajador": {"id": t.id, "nombre": t.nombre_completo, "puesto": t.puesto_id,
                       "puesto_nombre": t.puesto.nombre} if t else None,
        "permisos": permisos,
        "permisos_detalle": list(Permiso.objects.filter(id__in=permisos).order_by("grupo", "id")
                                 .values("id", "nombre", "grupo")),
        "sucursales": [{"id": ts.sucursal_id, "nombre": ts.sucursal.nombre, "zona_horaria": ts.sucursal.zona_horaria}
                       for ts in sucursales],
    }


class SesionView(APIView):
    """GET: quien soy (y entrega la cookie CSRF). POST: iniciar sesion. DELETE: salir.

    Inicio de sesion con {empresa, usuario, password} (ej. demo / andrea.garza).
    Sin correos (requisitos, seccion 6). La sesion se cierra tras 30 minutos sin uso.
    """

    permission_classes = [AllowAny]
    throttle_scope = "login"

    def get_throttles(self):
        return [ScopedRateThrottle()] if self.request.method == "POST" else []

    @extend_schema(responses=SesionSerializer, summary="Quien soy (entrega la cookie CSRF)")
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response(datos_sesion(request))

    @extend_schema(request=EntradaSerializer, responses={200: SesionSerializer, 400: MensajeSerializer,
                                                          403: MensajeSerializer}, summary="Iniciar sesion")
    @method_decorator(csrf_protect)
    def post(self, request):
        datos = request.data
        password = datos.get("password") or ""
        login_clave = None
        if datos.get("usuario"):
            # La empresa no se consulta aqui: antes de iniciar sesion RLS no deja verla.
            # La clave de acceso ya incluye el codigo: 'demo/andrea.garza'.
            codigo = str(datos.get("empresa") or "").strip().lower()
            usuario_txt = str(datos["usuario"]).strip().lower()
            login_clave = f"{codigo}/{usuario_txt}" if codigo else usuario_txt
        usuario = authenticate(request, login=login_clave, password=password) if login_clave else None
        if usuario is None or not usuario.is_active:
            return Response({"detail": "Usuario o contraseña incorrectos."}, status=status.HTTP_400_BAD_REQUEST)
        fijar_contexto(usuario)   # ya dentro de la transaccion: ahora si ve los datos de su empresa
        if usuario.empresa_id and not usuario.empresa.activo:
            return Response({"detail": "La suscripción de esta clínica no está activa."}, status=status.HTTP_403_FORBIDDEN)
        t = getattr(usuario, "trabajador", None) if usuario.empresa_id else None
        if usuario.empresa_id and (t is None or not t.activo):
            return Response({"detail": "Esta persona está dada de baja."}, status=status.HTTP_403_FORBIDDEN)
        login(request, usuario)
        return Response(datos_sesion(request))

    @extend_schema(responses={204: None}, summary="Cerrar sesion")
    def delete(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CambiarPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=CambiarPasswordSerializer, responses={200: MensajeSerializer, 400: MensajeSerializer},
                   summary="Cambiar mi contrasena (tambien la inicial)")
    def post(self, request):
        u = request.user
        if not u.check_password(request.data.get("actual") or ""):
            return Response({"detail": "La contraseña actual no es correcta."}, status=status.HTTP_400_BAD_REQUEST)
        nueva = request.data.get("nueva") or ""
        try:
            validate_password(nueva, u)
        except ErrorDjango as e:
            return Response({"detail": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
        u.set_password(nueva)
        u.debe_cambiar_password = False
        u.save(update_fields=["password", "debe_cambiar_password"])
        update_session_auth_hash(request, u)
        return Response({"detail": "Contraseña actualizada."})


class BaseEmpresa:
    """Todas las vistas de datos: requieren trabajador activo y permiso por accion.
    El filtro por empresa NO se escribe aqui: lo aplica PostgreSQL (RLS)."""

    permission_classes = [IsAuthenticated, TienePermisos]

    def perform_create(self, serializer):
        with guardar_con_reglas():
            serializer.save()

    def perform_update(self, serializer):
        with guardar_con_reglas():
            serializer.save()


class SucursalViewSet(BaseEmpresa, viewsets.ReadOnlyModelViewSet):
    serializer_class = SucursalSerializer
    permisos_por_accion = {"list": "*", "retrieve": "*"}   # cualquier persona activa
    pagination_class = None

    def get_queryset(self):
        qs = Sucursal.objects.filter(activo=True).order_by("id")
        if not puede(self.request, "todas_sucursales"):
            qs = qs.filter(id__in=sucursales_de(self.request))
        return qs


class TrabajadorViewSet(BaseEmpresa, viewsets.ReadOnlyModelViewSet):
    """Directorio del equipo (para elegir doctor en la agenda)."""

    serializer_class = TrabajadorSerializer
    permisos_por_accion = {"list": ("agenda_ver", "personal"), "retrieve": ("agenda_ver", "personal")}
    pagination_class = None

    def get_queryset(self):
        qs = Trabajador.objects.filter(activo=True).order_by("nombre")
        if self.request.query_params.get("atiende") == "1":
            qs = qs.filter(atiende=True)   # por persona (un administrador dentista también)
        return qs


class TipoCitaViewSet(BaseEmpresa, viewsets.ReadOnlyModelViewSet):
    serializer_class = TipoCitaSerializer
    permisos_por_accion = {"list": "agenda_ver", "retrieve": "agenda_ver"}
    pagination_class = None
    queryset = TipoCita.objects.filter(activo=True).order_by("id")


class TratamientoViewSet(BaseEmpresa, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = TratamientoSerializer
    pagination_class = None
    permisos_por_accion = {
        "list": ("agenda_ver", "pacientes_ver", "tratamientos"),
        "retrieve": ("agenda_ver", "pacientes_ver", "tratamientos"),
        "create": "tratamientos", "update": "tratamientos", "partial_update": "tratamientos",
    }

    def get_queryset(self):
        return Tratamiento.objects.order_by("categoria", "nombre")


class PacienteViewSet(BaseEmpresa, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet):
    """Directorio de pacientes de la empresa. No se borran: se dan de baja (NOM-004)."""

    serializer_class = PacienteSerializer
    permisos_por_accion = {
        "list": "pacientes_ver", "retrieve": "pacientes_ver",
        "create": "pacientes_editar", "update": "pacientes_editar", "partial_update": "pacientes_editar",
        "baja": "pacientes_editar",
    }

    def get_queryset(self):
        qs = Paciente.objects.select_related("clinico").order_by("apellidos", "nombre")
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            for palabra in q.split():
                qs = qs.filter(Q(nombre__unaccent__icontains=palabra) | Q(apellidos__unaccent__icontains=palabra)
                               | Q(expediente__icontains=palabra) | Q(telefono__icontains=palabra))
        if self.request.query_params.get("activos", "1") == "1":
            qs = qs.filter(activo=True)
        return qs

    def retrieve(self, request, *args, **kwargs):
        respuesta = super().retrieve(request, *args, **kwargs)
        # Bitacora de quien consulta cada expediente (NOM-024)
        t = trabajador_de(request)
        Bitacora.objects.create(empresa_id=request.user.empresa_id, trabajador_id=t.id if t else None,
                                accion="ver", entidad="paciente", entidad_id=kwargs.get("pk"),
                                paciente_id=kwargs.get("pk"))
        return respuesta

    @action(detail=True, methods=["post"])
    def baja(self, request, pk=None):
        p = self.get_object()
        motivo = (request.data.get("motivo") or "").strip()
        if not motivo:
            return Response({"detail": "Indica el motivo de la baja."}, status=status.HTTP_400_BAD_REQUEST)
        p.activo, p.baja_en, p.baja_motivo = False, timezone.localdate(), motivo
        p.save(update_fields=["activo", "baja_en", "baja_motivo"])
        return Response(self.get_serializer(p).data)


class CitaViewSet(BaseEmpresa, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet):
    """Agenda. ?desde=&hasta= (fechas ISO), ?sucursal=, ?trabajador=, ?unidad=, ?paciente=.
    Sin "agenda_todas" cada persona ve solo sus citas; sin "todas_sucursales",
    solo las de sus sucursales (y siempre las suyas). Las canceladas y eliminadas
    no salen en la agenda; historial completo del paciente: ?paciente=&bajas=1 (sin fechas).
    Cancelar o eliminar: POST /citas/{id}/cancelar/ o /eliminar/ con {motivo}."""

    serializer_class = CitaSerializer
    pagination_class = None
    permisos_por_accion = {
        "list": "agenda_ver", "retrieve": "agenda_ver",
        "create": "agenda_editar", "update": "agenda_editar", "partial_update": "agenda_editar",
        "cancelar": "agenda_editar", "eliminar": "agenda_editar",
    }

    def get_queryset(self):
        qp = self.request.query_params
        yo = trabajador_de(self.request)
        qs = Cita.objects.select_related("paciente", "trabajador").order_by("inicio", "unidad_id")
        if not puede(self.request, "agenda_todas"):
            qs = qs.filter(trabajador=yo)
        if not puede(self.request, "todas_sucursales"):
            qs = qs.filter(Q(sucursal_id__in=sucursales_de(self.request)) | Q(trabajador=yo))
        if self.action == "list":
            if qp.get("bajas") != "1":
                qs = qs.exclude(estado__in=ESTADOS_BAJA_CITA)
            desde, hasta = parse_datetime(qp.get("desde", "") or ""), parse_datetime(qp.get("hasta", "") or "")
            # El historial de UN paciente se puede pedir completo, sin fechas
            if not (qp.get("paciente") and not qp.get("desde") and not qp.get("hasta")):
                if not desde or not hasta:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({"detail": "Indica desde y hasta (fecha y hora ISO, ej. 2026-10-08T00:00:00-06:00), "
                                                     "o solo ?paciente= para su historial completo."})
                if (hasta - desde).days > 62:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError({"detail": "El rango máximo es de 62 días."})
                qs = qs.filter(inicio__lt=hasta, fin__gt=desde)
            for campo in ("sucursal", "trabajador", "unidad", "paciente"):
                if qp.get(campo):
                    qs = qs.filter(**{f"{campo}_id": qp[campo]})
        return qs

    def _dar_de_baja(self, request, estado):
        cita = self.get_object()
        motivo = (request.data.get("motivo") or "").strip()
        if not motivo:
            return Response({"detail": "Indica el motivo."}, status=status.HTTP_400_BAD_REQUEST)
        if cita.estado in ESTADOS_BAJA_CITA:
            return Response({"detail": f"Esta cita ya está {cita.estado}."}, status=status.HTTP_400_BAD_REQUEST)
        cita.estado, cita.baja_motivo = estado, motivo
        cita.baja_por, cita.baja_en = trabajador_de(request), timezone.now()
        with guardar_con_reglas():
            cita.save(update_fields=["estado", "baja_motivo", "baja_por", "baja_en"])
        return Response(self.get_serializer(cita).data)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        """Sale de la agenda y libera el sillon; queda en el historial del paciente."""
        return self._dar_de_baja(request, "cancelada")

    @action(detail=True, methods=["post"])
    def eliminar(self, request, pk=None):
        """Igual que cancelar, pero marcada como eliminada (p. ej. error de captura). Nunca se borra."""
        return self._dar_de_baja(request, "eliminada")
