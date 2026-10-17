from django.urls import path
from drf_spectacular.views import SpectacularAPIView
from rest_framework.routers import DefaultRouter

from . import vistas

router = DefaultRouter()
router.register("sucursales", vistas.SucursalViewSet, basename="sucursal")
router.register("personal", vistas.TrabajadorViewSet, basename="personal")
router.register("tipos-cita", vistas.TipoCitaViewSet, basename="tipo-cita")
router.register("tratamientos", vistas.TratamientoViewSet, basename="tratamiento")
router.register("pacientes", vistas.PacienteViewSet, basename="paciente")
router.register("citas", vistas.CitaViewSet, basename="cita")

urlpatterns = [
    path("sesion/", vistas.SesionView.as_view(), name="sesion"),
    path("sesion/password/", vistas.CambiarPasswordView.as_view(), name="cambiar-password"),
    path("esquema/", SpectacularAPIView.as_view(), name="esquema"),   # OpenAPI, solo con sesion
] + router.urls
