"""Carga los datos FICTICIOS de demostracion y crea un usuario por trabajador.

    python manage.py cargar_demo [--si-vacia] [--password XXXX]

Se corre con el usuario dueno de las tablas (KD_DB_ROL=admin), porque escribe
en varias empresas a la vez. Nunca usar con datos reales.
"""
import os
import re
import unicodedata
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from nucleo.models import Empresa, Trabajador, Usuario

SQL = Path(__file__).resolve().parents[2] / "sql" / "datos_demo.sql"


def _tokens(nombre):
    texto = unicodedata.normalize("NFD", nombre).encode("ascii", "ignore").decode().lower()
    return [t for t in re.sub(r"[^a-z ]", "", texto).split() if t]


def sugerir_usuario(nombre, existentes):
    """La misma regla que KD.sugerirUsuario (js/data.js): nombre.apellido; si ya
    existe, nombre.segundo_apellido; si tambien, nombre.apellido2, 3..."""
    t = _tokens(nombre)
    if len(t) >= 4:
        n, ap1, ap2 = t[0], t[-2], t[-1]
    else:
        n, ap1, ap2 = (t + ["usuario", "", ""])[0], (t + ["", ""])[1] if len(t) > 1 else "", t[2] if len(t) > 2 else ""
    base = ".".join(x for x in (n, ap1) if x)
    if base not in existentes:
        return base
    if ap2 and f"{n}.{ap2}" not in existentes:
        return f"{n}.{ap2}"
    i = 2
    while f"{base}{i}" in existentes:
        i += 1
    return f"{base}{i}"


class Command(BaseCommand):
    help = "Carga datos ficticios de demostracion (dos empresas) y sus usuarios."

    def add_arguments(self, parser):
        parser.add_argument("--si-vacia", action="store_true", help="No hacer nada si ya hay empresas.")
        parser.add_argument("--password", default=os.environ.get("KD_DEMO_PASSWORD", "kennadent2026"),
                            help="Contrasena de todos los usuarios de demo.")

    def handle(self, *args, si_vacia=False, password=None, **opts):
        if si_vacia and Empresa.objects.exists():
            self.stdout.write("Ya hay datos; no se cargo la demo.")
            return
        with transaction.atomic():
            with connection.cursor() as c:
                c.execute(SQL.read_text(encoding="utf-8"))
            creados = 0
            for empresa in Empresa.objects.order_by("id"):
                existentes = set(Usuario.objects.filter(empresa=empresa).values_list("usuario", flat=True))
                for t in Trabajador.objects.filter(empresa=empresa, usuario__isnull=True).order_by("id"):
                    nombre_usuario = sugerir_usuario(t.nombre, existentes)
                    existentes.add(nombre_usuario)
                    u = Usuario.objects.create_user(nombre_usuario, password, empresa=empresa,
                                                    debe_cambiar_password=False)
                    t.usuario = u
                    t.save(update_fields=["usuario"])
                    creados += 1
            admin_usuario = os.environ.get("KD_ADMIN_USUARIO", "admin")
            admin_password = os.environ.get("KD_ADMIN_PASSWORD")
            if admin_password and not Usuario.objects.filter(login=admin_usuario).exists():
                Usuario.objects.create_superuser(admin_usuario, admin_password)
        self.stdout.write(self.style.SUCCESS(
            f"Demo cargada: {Empresa.objects.count()} empresas y {creados} usuarios "
            f"(contrasena de todos: la de --password / KD_DEMO_PASSWORD)."))
        for e in Empresa.objects.order_by("id"):
            ejemplos = list(Usuario.objects.filter(empresa=e).order_by("id").values_list("usuario", flat=True)[:3])
            self.stdout.write(f"  {e.codigo}: {', '.join(ejemplos)} ...")
