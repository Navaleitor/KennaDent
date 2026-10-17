"""Deja listo el usuario de demostracion con el que Playwright prueba la contrasena inicial.

La prueba "un usuario con contrasena inicial es obligado a cambiarla" cambia la
contrasena de aislamiento/bruno.salas; este comando la regresa a la de la demo
(KD_DEMO_PASSWORD) y vuelve a marcarla como inicial, para poder repetir la prueba
sin borrar nada. Lo corre el servicio "preparar-pruebas" de docker-compose.yml.

Solo funciona con la demo cargada (KD_CARGAR_DEMO=1): nunca en produccion.
"""
import os

from django.core.management.base import BaseCommand, CommandError

from nucleo.models import Usuario

LOGIN_PRUEBA = "aislamiento/bruno.salas"


class Command(BaseCommand):
    help = "Pone a aislamiento/bruno.salas con contrasena inicial para las pruebas de pantallas."

    def handle(self, *args, **opts):
        if os.environ.get("KD_CARGAR_DEMO") != "1":
            raise CommandError("Solo con la demo (KD_CARGAR_DEMO=1).")
        password = os.environ.get("KD_DEMO_PASSWORD") or "kennadent2026"
        u = Usuario.objects.filter(login=LOGIN_PRUEBA).first()
        if u is None:
            raise CommandError(f"No existe {LOGIN_PRUEBA}: carga la demo primero.")
        u.set_password(password)
        u.debe_cambiar_password = True
        u.save(update_fields=["password", "debe_cambiar_password"])
        self.stdout.write(f"{LOGIN_PRUEBA}: contrasena de la demo, marcada como inicial.")
