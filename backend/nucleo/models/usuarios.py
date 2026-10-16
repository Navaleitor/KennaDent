"""Usuario para iniciar sesion.

Se separa de Trabajador porque el equipo de KennaDent (plataforma) no es
trabajador de ninguna clinica. Esta tabla NO tiene Row Level Security: el
inicio de sesion ocurre antes de saber de que empresa es la persona.
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models import Q

from .base import AHORA, check


def clave_login(empresa, usuario):
    """'demo/andrea.garza' para personal de una clinica; 'admin' para la plataforma."""
    return f"{empresa.codigo}/{usuario}" if empresa else usuario


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, usuario, password=None, empresa=None, **extra):
        u = self.model(usuario=usuario, empresa=empresa, **extra)
        u.set_password(password)
        u.save(using=self._db)
        return u

    def create_superuser(self, login, password=None, **extra):
        # createsuperuser pide el campo USERNAME_FIELD: para la plataforma login = usuario
        extra.update(is_staff=True, is_superuser=True, debe_cambiar_password=False)
        return self.create_user(login, password, empresa=None, **extra)


class Usuario(AbstractBaseUser, PermissionsMixin):
    login = models.TextField(unique=True)
    usuario = models.TextField()               # nombre.apellido
    empresa = models.ForeignKey("Empresa", on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    email = models.TextField(unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True, db_default=True)
    is_staff = models.BooleanField(default=False, db_default=False)   # entra al admin de Django (plataforma)
    debe_cambiar_password = models.BooleanField(default=True, db_default=True)
    creado_en = models.DateTimeField(db_default=AHORA)

    objects = UsuarioManager()

    USERNAME_FIELD = "login"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "usuario"
        constraints = [
            check("usuario_usuario_check", Q(usuario__regex=r"^[a-z0-9][a-z0-9._-]*$")),
            # El personal de plataforma (sin empresa) es staff; el de clinicas no
            check("usuario_staff_check", Q(empresa__isnull=True) | Q(is_staff=False)),
        ]

    def save(self, *args, **kwargs):
        self.login = clave_login(self.empresa, self.usuario)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.login
