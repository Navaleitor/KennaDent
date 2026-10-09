"""Admin de Django: SOLO para el personal de KennaDent (plataforma).

El personal de las clinicas usa la aplicacion, no este admin. Los usuarios de
plataforma (sin empresa, superusuarios) ven todas las empresas.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from . import models as m


@admin.register(m.Usuario)
class UsuarioAdmin(UserAdmin):
    ordering = ["login"]
    list_display = ["login", "empresa", "email", "is_active", "is_staff", "debe_cambiar_password", "last_login"]
    list_filter = ["empresa", "is_active", "is_staff"]
    search_fields = ["login", "email"]
    readonly_fields = ["login", "last_login", "creado_en"]
    fieldsets = [
        (None, {"fields": ["login", "empresa", "usuario", "email", "password"]}),
        ("Estado", {"fields": ["is_active", "debe_cambiar_password", "is_staff", "is_superuser", "last_login", "creado_en"]}),
    ]
    add_fieldsets = [(None, {"classes": ["wide"], "fields": ["empresa", "usuario", "password1", "password2"]})]


@admin.register(m.Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ["codigo", "nombre_comercial", "rfc", "activo", "creado_en"]
    search_fields = ["codigo", "nombre_comercial", "rfc"]


@admin.register(m.Sucursal)
class SucursalAdmin(admin.ModelAdmin):
    list_display = ["nombre", "empresa", "zona_horaria", "activo"]
    list_filter = ["empresa"]


@admin.register(m.Trabajador)
class TrabajadorAdmin(admin.ModelAdmin):
    list_display = ["nombre", "empresa", "puesto", "activo"]
    list_filter = ["empresa", "puesto", "activo"]
    search_fields = ["nombre"]


@admin.register(m.Paciente)
class PacienteAdmin(admin.ModelAdmin):
    list_display = ["expediente", "nombre", "apellidos", "empresa", "activo"]
    list_filter = ["empresa", "activo"]
    search_fields = ["expediente", "nombre", "apellidos"]


@admin.register(m.Cita)
class CitaAdmin(admin.ModelAdmin):
    list_display = ["inicio", "sucursal", "unidad", "trabajador", "paciente", "estado"]
    list_filter = ["empresa", "estado", "sucursal"]
    date_hierarchy = "inicio"


@admin.register(m.Tratamiento)
class TratamientoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "empresa", "categoria", "precio_base", "activo"]
    list_filter = ["empresa", "categoria"]
