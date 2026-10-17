"""Pruebas de la API con los datos de demostracion.

Las peticiones corren como el rol kd_app (Row Level Security activo); el
codigo de las pruebas fuera de las peticiones corre como dueno de las tablas.
"""
from datetime import timedelta

from django.core.cache import cache
from django.core.management import call_command
from django.db import transaction
from django.utils import timezone
from rest_framework.test import APITestCase

from nucleo.models import Bitacora, Cita, Paciente, Sucursal, Trabajador, Unidad, Usuario

CLAVE = "ClaveDemo2026!"


class ApiTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("cargar_demo", password=CLAVE, stdout=open("/dev/null", "w"))
        cls.cumbres = Sucursal.objects.get(nombre="CUMBRES")
        cls.unidad1, cls.unidad2 = Unidad.objects.filter(sucursal=cls.cumbres).order_by("id")[:2]
        cls.andrea = Trabajador.objects.get(nombre="ANDREA GARZA LEAL")
        cls.luis = Trabajador.objects.get(nombre="LUIS TREVINO CHAPA")
        cls.paola = Trabajador.objects.get(nombre="PAOLA RIOS GUERRA")       # base CENTRO
        cls.paciente_demo = Paciente.objects.filter(empresa__codigo="demo").order_by("id").first()
        cls.paciente_otra = Paciente.objects.filter(empresa__codigo="aislamiento").order_by("id").first()
        # Hora libre: dentro de 60 dias a las 7:00 (la demo agenda de 9 a 19)
        dia = timezone.localdate() + timedelta(days=60)
        cls.libre = timezone.make_aware(timezone.datetime(dia.year, dia.month, dia.day, 7, 0))

    def setUp(self):
        cache.clear()   # el limite de 10 intentos por minuto se probaria contra si mismo

    def entrar(self, empresa, usuario):
        r = self.client.post("/api/v1/sesion/", {"empresa": empresa, "usuario": usuario, "password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def cita(self, unidad=None, trabajador=None, minutos=0, **extra):
        inicio = self.libre + timedelta(minutes=minutos)
        datos = {"sucursal": self.cumbres.id, "unidad": (unidad or self.unidad1).id, "paciente": self.paciente_demo.id,
                 "trabajador": (trabajador or self.andrea).id, "inicio": inicio.isoformat(),
                 "fin": (inicio + timedelta(minutes=30)).isoformat(), **extra}
        return self.client.post("/api/v1/citas/", datos, format="json")

    # ---------- Inicio de sesion ----------
    def test_inicio_de_sesion(self):
        datos = self.entrar("demo", "andrea.garza")
        self.assertEqual(datos["empresa"]["codigo"], "demo")
        self.assertEqual(datos["trabajador"]["nombre"], "DRA. ANDREA GARZA LEAL")
        self.assertIn("historial_editar", datos["permisos"])
        self.assertNotIn("dinero", datos["permisos"])

    def test_contrasena_o_clinica_equivocada(self):
        r = self.client.post("/api/v1/sesion/", {"empresa": "demo", "usuario": "andrea.garza", "password": "mal"}, format="json")
        self.assertEqual(r.status_code, 400)
        # Mismo usuario, otra clinica: no existe alli
        r = self.client.post("/api/v1/sesion/", {"empresa": "aislamiento", "usuario": "andrea.garza", "password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_sin_entrada_por_correo(self):
        Usuario.objects.filter(login="demo/andrea.garza").update(email="andrea@ejemplo.mx")
        r = self.client.post("/api/v1/sesion/", {"email": "andrea@ejemplo.mx", "password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_sesion_se_cierra_tras_30_minutos_sin_uso(self):
        self.entrar("demo", "andrea.garza")
        self.assertEqual(self.client.cookies["sessionid"]["max-age"], 30 * 60)
        # Cada peticion vuelve a contar los 30 minutos (la cookie se renueva)
        r = self.client.get("/api/v1/sesion/")
        self.assertEqual(r.cookies["sessionid"]["max-age"], 30 * 60)

    def test_contrasena_inicial_bloquea_todo_hasta_cambiarla(self):
        Usuario.objects.filter(login="demo/daniela.flores").update(debe_cambiar_password=True)
        self.assertTrue(self.entrar("demo", "daniela.flores")["debe_cambiar_password"])
        r = self.client.get("/api/v1/pacientes/")
        self.assertEqual(r.status_code, 403)
        self.assertIn("cambia tu contrasena", r.json()["detail"])
        r = self.client.post("/api/v1/sesion/password/", {"actual": CLAVE, "nueva": "NuevaClaveQA-2026"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self.client.get("/api/v1/pacientes/").status_code, 200)

    def test_sin_sesion_no_hay_datos(self):
        self.assertEqual(self.client.get("/api/v1/pacientes/").status_code, 403)

    def test_baja_de_personal_no_entra(self):
        Trabajador.objects.filter(pk=self.luis.pk).update(activo=False, baja_en=timezone.localdate())
        r = self.client.post("/api/v1/sesion/", {"empresa": "demo", "usuario": "luis.trevino", "password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 403)

    # ---------- Aislamiento entre empresas ----------
    def test_cada_empresa_ve_solo_sus_pacientes(self):
        self.entrar("demo", "daniela.flores")
        self.assertEqual(self.client.get("/api/v1/pacientes/").json()["count"], 120)
        self.assertEqual(self.client.get(f"/api/v1/pacientes/{self.paciente_otra.id}/").status_code, 404)
        self.client.delete("/api/v1/sesion/")
        self.entrar("aislamiento", "laura.perez")
        nombres = {p["nombre"] for p in self.client.get("/api/v1/pacientes/").json()["results"]}
        self.assertEqual(nombres, {"MARIA", "PEDRO", "ANA"})

    def test_no_puede_agendar_con_paciente_de_otra_empresa(self):
        self.entrar("aislamiento", "laura.perez")
        matriz = Sucursal.objects.get(nombre="MATRIZ")
        r = self.client.post("/api/v1/citas/", {
            "sucursal": matriz.id, "unidad": Unidad.objects.get(sucursal=matriz).id,
            "paciente": self.paciente_demo.id, "trabajador": Trabajador.objects.get(nombre="BRUNO SALAS ORTEGA").id,
            "inicio": self.libre.isoformat(), "fin": (self.libre + timedelta(minutes=30)).isoformat()}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("paciente", r.json())

    # ---------- Permisos ----------
    def test_precios_solo_con_permiso_dinero(self):
        self.entrar("demo", "daniela.flores")            # recepcion
        self.assertNotIn("precio_base", self.client.get("/api/v1/tratamientos/").json()[0])
        self.assertEqual(self.client.post("/api/v1/tratamientos/", {"nombre": "x", "precio_base": 1}, format="json").status_code, 403)
        self.client.delete("/api/v1/sesion/")
        self.entrar("demo", "carlos.martinez")           # gerente
        self.assertIn("precio_base", self.client.get("/api/v1/tratamientos/").json()[0])

    def test_doctor_ve_solo_su_agenda(self):
        hoy = timezone.localdate()
        rango = f"desde={hoy - timedelta(days=7)}T00:00:00-06:00&hasta={hoy}T23:59:00-06:00"
        self.entrar("demo", "andrea.garza")
        doctores = {c["trabajador"] for c in self.client.get(f"/api/v1/citas/?{rango}").json()}
        self.assertEqual(doctores, {self.andrea.id})
        self.client.delete("/api/v1/sesion/")
        self.entrar("demo", "daniela.flores")
        doctores = {c["trabajador"] for c in self.client.get(f"/api/v1/citas/?{rango}&sucursal={self.cumbres.id}").json()}
        self.assertGreater(len(doctores), 1)

    # ---------- Reglas de la agenda (las aplica PostgreSQL) ----------
    def test_reglas_de_la_agenda(self):
        self.entrar("demo", "daniela.flores")
        self.assertEqual(self.cita().status_code, 201)
        # Mismo sillon, mismo horario: rechazado
        r = self.cita(trabajador=self.luis)
        self.assertEqual(r.status_code, 409)
        self.assertIn("unidad ya tiene una cita", r.json()["detail"])
        # Doctor de otra sucursal: rechazado por la base
        r = self.cita(unidad=self.unidad2, trabajador=self.paola, minutos=120)
        self.assertEqual(r.status_code, 400)
        self.assertIn("no esta asignado", r.json()["detail"])
        # Mismo doctor en otro sillon: se avisa diciendo cual cita es, y se permite si se confirma
        r = self.cita(unidad=self.unidad2)
        self.assertEqual(r.status_code, 409)
        self.assertIn("DRA. ANDREA GARZA LEAL ya tiene una cita de 07:00 a 07:30", r.json()["detail"])
        self.assertIn(self.unidad1.nombre, r.json()["detail"])
        empalmada = self.cita(unidad=self.unidad2, confirmar_empalme=True)
        self.assertEqual(empalmada.status_code, 201)
        # Ya aceptada, cambiar solo la nota no vuelve a avisar
        r = self.client.patch(f"/api/v1/citas/{empalmada.json()['id']}/", {"nota": "Confirmado"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        # Lo rechazado no dejo nada guardado
        self.assertEqual(Cita.objects.filter(inicio__gte=self.libre, inicio__lt=self.libre + timedelta(hours=3)).count(), 2)

    def test_doctor_sin_agenda_editar_no_agenda(self):
        self.entrar("demo", "andrea.garza")
        self.assertEqual(self.cita().status_code, 403)

    def test_solo_a_las_00_y_30_y_nunca_en_el_pasado(self):
        self.entrar("demo", "daniela.flores")
        r = self.cita(minutos=15)
        self.assertEqual(r.status_code, 400)
        self.assertIn(":00 o a las :30", r.json()["inicio"][0])
        ayer = (timezone.localtime() - timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
        r = self.client.post("/api/v1/citas/", {
            "sucursal": self.cumbres.id, "unidad": self.unidad1.id, "paciente": self.paciente_demo.id,
            "trabajador": self.andrea.id, "inicio": ayer.isoformat(),
            "fin": (ayer + timedelta(minutes=30)).isoformat()}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("ya paso", r.json()["inicio"][0])
        # Mover una cita al pasado tampoco; pero una cita pasada si se puede actualizar (estado, nota)
        nueva = self.cita().json()
        self.assertEqual(self.client.patch(f"/api/v1/citas/{nueva['id']}/", {"inicio": ayer.isoformat(),
                         "fin": (ayer + timedelta(minutes=30)).isoformat()}, format="json").status_code, 400)
        pasada = Cita.objects.filter(sucursal=self.cumbres, estado="atendida").first()
        r = self.client.patch(f"/api/v1/citas/{pasada.id}/", {"nota": "Revisado"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)

    def test_cancelar_y_eliminar_piden_motivo(self):
        self.entrar("demo", "daniela.flores")
        cita = self.cita().json()
        # Sin motivo, o por la via normal de edicion: no
        self.assertEqual(self.client.post(f"/api/v1/citas/{cita['id']}/cancelar/", {}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(f"/api/v1/citas/{cita['id']}/", {"estado": "cancelada"},
                                           format="json").status_code, 400)
        r = self.client.post(f"/api/v1/citas/{cita['id']}/cancelar/", {"motivo": "El paciente cancelo"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        datos = r.json()
        self.assertEqual((datos["estado"], datos["baja_motivo"]), ("cancelada", "El paciente cancelo"))
        self.assertEqual(datos["baja_por"], Trabajador.objects.get(usuario__login="demo/daniela.flores").id)
        self.assertIsNotNone(datos["baja_en"])
        # Libera el sillon, sale de la agenda y queda en el historial del paciente
        otra = self.cita().json()
        rango = f"desde={self.libre.date()}T00:00:00-06:00&hasta={self.libre.date()}T23:59:00-06:00"
        ids = {c["id"] for c in self.client.get(f"/api/v1/citas/?{rango}").json()}
        self.assertEqual(ids & {cita["id"], otra["id"]}, {otra["id"]})
        historial = self.client.get(f"/api/v1/citas/?paciente={self.paciente_demo.id}&bajas=1").json()   # sin fechas
        self.assertIn(cita["id"], {c["id"] for c in historial})
        self.assertEqual(self.client.get(f"/api/v1/citas/?paciente={self.paciente_demo.id}").status_code, 200)
        # Una cancelada ya no se modifica
        self.assertEqual(self.client.patch(f"/api/v1/citas/{cita['id']}/", {"nota": "x"}, format="json").status_code, 400)
        # Eliminar = estado "eliminada" con motivo; el renglon nunca se borra
        r = self.client.post(f"/api/v1/citas/{otra['id']}/eliminar/", {"motivo": "Error de captura"}, format="json")
        self.assertEqual(r.json()["estado"], "eliminada")
        with self.assertRaises(Exception), transaction.atomic():
            Cita.objects.filter(pk=otra["id"]).delete()
        self.assertTrue(Cita.objects.filter(pk=otra["id"]).exists())

    def test_gerente_ve_y_agenda_solo_en_su_sucursal(self):
        hoy = timezone.localdate()
        rango = f"desde={hoy - timedelta(days=7)}T00:00:00-06:00&hasta={hoy}T23:59:00-06:00"
        self.entrar("demo", "carlos.martinez")           # gerente de CUMBRES
        sucursales = {c["sucursal"] for c in self.client.get(f"/api/v1/citas/?{rango}").json()}
        self.assertEqual(sucursales, {self.cumbres.id})
        centro = Sucursal.objects.get(nombre="CENTRO")
        r = self.cita(unidad=Unidad.objects.filter(sucursal=centro).first(), trabajador=self.paola, sucursal=centro.id)
        self.assertEqual(r.status_code, 403)
        self.client.delete("/api/v1/sesion/")
        self.entrar("demo", "kenia.navarro")             # administradora: todas las sucursales
        sucursales = {c["sucursal"] for c in self.client.get(f"/api/v1/citas/?{rango}").json()}
        self.assertGreater(len(sucursales), 1)

    # ---------- Pacientes ----------
    def test_alta_baja_y_bitacora_de_pacientes(self):
        self.entrar("demo", "daniela.flores")
        r = self.client.post("/api/v1/pacientes/", {"nombre": "  ana  maria ", "apellidos": "lópez díaz",
                                                    "sucursal_origen": self.cumbres.id}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        p = r.json()
        self.assertEqual((p["nombre"], p["apellidos"], p["expediente"]), ("ANA MARIA", "LÓPEZ DÍAZ", "KD-00121"))
        self.assertFalse(p["datos_clinicos_completos"])      # aviso al doctor
        # Busqueda sin acentos
        self.assertEqual(self.client.get("/api/v1/pacientes/?q=lopez diaz").json()["count"], 1)
        # Consultar el expediente queda en la bitacora
        self.client.get(f"/api/v1/pacientes/{p['id']}/")
        self.assertTrue(Bitacora.objects.filter(entidad="paciente", entidad_id=p["id"], accion="ver").exists())
        # No se borra: se da de baja
        self.assertEqual(self.client.delete(f"/api/v1/pacientes/{p['id']}/").status_code, 405)
        r = self.client.post(f"/api/v1/pacientes/{p['id']}/baja/", {"motivo": "Se mudo de ciudad"}, format="json")
        self.assertFalse(r.json()["activo"])

    # ---------- Plataforma (admin de Django) ----------
    def test_admin_de_plataforma_ve_todas_las_empresas(self):
        admin = Usuario.objects.create_superuser("soporte", "PlataformaQA2026!")
        self.client.force_login(admin)
        r = self.client.get("/admin/nucleo/empresa/")
        self.assertContains(r, "GRUPO DENTAL DEMO")
        self.assertContains(r, "CLINICA AISLAMIENTO")
        # Las citas en el admin son solo de consulta: las reglas de la agenda viven en la API
        cita = Cita.objects.order_by("id").first()
        self.assertEqual(self.client.get(f"/admin/nucleo/cita/{cita.id}/change/").status_code, 200)
        self.assertEqual(self.client.post(f"/admin/nucleo/cita/{cita.id}/change/", {"estado": "cancelada"}).status_code, 403)

    def test_personal_de_clinica_no_entra_al_admin(self):
        self.entrar("demo", "kenia.navarro")
        self.assertEqual(self.client.get("/admin/nucleo/empresa/").status_code, 302)
