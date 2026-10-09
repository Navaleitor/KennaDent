"""Catalogos de la plataforma (iguales para todas las empresas): puestos y
permisos de js/roles.js y hallazgos del odontograma de js/odonto.js."""
from django.db import migrations

CATALOGOS = r"""
INSERT INTO puesto (id, nombre, atiende, requiere_cedula, lleva_titulo) VALUES
  ('admin',        'Administrador(a) general',        false, false, false),
  ('gerente',      'Gerente de sucursal',             false, false, false),
  ('coordinador',  'Coordinador(a) de tratamientos',  false, false, false),
  ('recepcion',    'Recepcionista',                   false, false, false),
  ('caja',         'Caja y cobranza',                 false, false, false),
  ('almacen',      'Almacen e inventario',            false, false, false),
  ('odontologo',   'Odontologo(a) general',           true,  true,  true),
  ('especialista', 'Especialista',                    true,  true,  true),
  ('higienista',   'Higienista dental',               true,  true,  true),
  ('asistente',    'Asistente dental',                false, false, false),
  ('radiologo',    'Tecnico(a) radiologo',            false, true,  false),
  ('pasante',      'Pasante / practicante',           false, false, false);

INSERT INTO permiso (id, nombre, grupo) VALUES
  ('panel','Ver dashboard','General'),
  ('agenda_ver','Ver su propia agenda','Agenda'),
  ('agenda_todas','Ver la agenda de todo el equipo','Agenda'),
  ('agenda_editar','Crear, mover y cancelar citas','Agenda'),
  ('pacientes_ver','Ver pacientes','Pacientes'),
  ('pacientes_editar','Alta y edicion de datos generales','Pacientes'),
  ('clinico_editar','Editar datos clinicos y odontograma','Pacientes'),
  ('historial_ver','Ver resumen e historial clinico','Historial clinico'),
  ('historial_editar','Registrar consultas de sus pacientes','Historial clinico'),
  ('seguimiento','Seguimiento de pacientes','Operacion'),
  ('cobrar','Cobrar a pacientes','Operacion'),
  ('material_solicitar','Solicitar material','Operacion'),
  ('dinero','Ver precios, montos e ingresos','Gestion'),
  ('presupuestos','Presupuestos','Gestion'),
  ('caja','Caja: totales, egresos y corte diario','Gestion'),
  ('reportes','Reportes','Gestion'),
  ('inventario','Inventario','Gestion'),
  ('tratamientos','Catalogo de tratamientos','Gestion'),
  ('personal','Alta y baja de personal','Gestion'),
  ('empresa','Empresa y sucursales','Gestion'),
  ('todas_sucursales','Acceso a todas las sucursales','Gestion');

INSERT INTO puesto_permiso (puesto_id, permiso_id)
SELECT 'admin', id FROM permiso
UNION ALL SELECT 'gerente', id FROM permiso WHERE id NOT IN ('empresa','todas_sucursales')
UNION ALL SELECT 'coordinador', unnest(ARRAY['panel','agenda_ver','agenda_todas','agenda_editar','pacientes_ver','pacientes_editar','historial_ver','seguimiento','dinero','presupuestos'])
UNION ALL SELECT 'recepcion', unnest(ARRAY['panel','agenda_ver','agenda_todas','agenda_editar','pacientes_ver','pacientes_editar','seguimiento','cobrar'])
UNION ALL SELECT 'caja', unnest(ARRAY['panel','agenda_ver','agenda_todas','pacientes_ver','cobrar','caja','dinero'])
UNION ALL SELECT 'almacen', unnest(ARRAY['panel','inventario'])
UNION ALL SELECT p, unnest(ARRAY['panel','agenda_ver','pacientes_ver','clinico_editar','historial_ver','historial_editar','material_solicitar'])
          FROM unnest(ARRAY['odontologo','especialista','higienista']) AS p
UNION ALL SELECT 'asistente', unnest(ARRAY['panel','agenda_ver','agenda_todas','pacientes_ver','historial_ver','material_solicitar'])
UNION ALL SELECT 'radiologo', unnest(ARRAY['agenda_ver','agenda_todas','pacientes_ver','historial_ver'])
UNION ALL SELECT 'pasante', unnest(ARRAY['pacientes_ver','historial_ver']);

INSERT INTO catalogo_hallazgo (codigo, nombre, ambito, color) VALUES
  ('caries',            'Caries',                'cara',   'rojo'),
  ('resina',            'Resina / obturacion',   'cara',   'azul'),
  ('sellador',          'Sellador',              'cara',   'azul'),
  ('extraccion',        'Extraccion indicada',   'diente', 'rojo'),
  ('ausente',           'Ausente / extraido',    'diente', 'azul'),
  ('endodoncia',        'Endodoncia indicada',   'diente', 'rojo'),
  ('endodoncia_hecha',  'Endodoncia realizada',  'diente', 'azul'),
  ('corona',            'Corona indicada',       'diente', 'rojo'),
  ('corona_hecha',      'Corona existente',      'diente', 'azul'),
  ('implante',          'Implante indicado',     'diente', 'rojo'),
  ('implante_hecho',    'Implante existente',    'diente', 'azul'),
  ('fractura',          'Fractura',              'diente', 'rojo');
"""


class Migration(migrations.Migration):
    dependencies = [("nucleo", "0002_base_de_datos")]
    operations = [migrations.RunSQL(CATALOGOS, migrations.RunSQL.noop)]
