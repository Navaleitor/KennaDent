"""Cancelar o eliminar una cita pide motivo, quien y cuando (requisitos 2.3, #18 y #19).

- Estado nuevo "eliminada": la cita no se borra, sale de la agenda y queda en el
  historial del paciente (decidido en octubre 2026, v0.6.0).
- Columnas baja_motivo, baja_por y baja_en; la base exige motivo y fecha en las
  citas canceladas o eliminadas.
- Las citas canceladas que ya existian reciben un motivo generico antes de
  activar esa regla.
- Las citas ya no se pueden borrar (tg_no_borrar), igual que el expediente.
"""
import django.contrib.postgres.constraints
import django.db.models.deletion
from django.db import migrations, models

import nucleo.models.clinico

CANCELADAS_ANTERIORES = r"""
UPDATE cita SET baja_motivo = 'Sin motivo registrado (cancelada antes de v0.6.0)',
                baja_en = COALESCE(baja_en, creado_en)
 WHERE estado = 'cancelada' AND (baja_motivo IS NULL OR baja_motivo = '');
"""

REGLAS_SQL = r"""
-- Quien cancela o elimina es de la misma empresa que la cita
ALTER TABLE cita ADD CONSTRAINT cita_emp_trabajador_baja
    FOREIGN KEY (empresa_id, baja_por) REFERENCES trabajador (empresa_id, id);

-- El doctor en dos citas a la vez (solo aviso): sin contar las que liberan el sillon
CREATE OR REPLACE VIEW v_cita_doctor_empalmada WITH (security_invoker = true) AS
SELECT a.empresa_id, a.trabajador_id, a.id AS cita_a, b.id AS cita_b, a.inicio, b.inicio AS inicio_b
FROM cita a JOIN cita b ON b.trabajador_id = a.trabajador_id AND b.id > a.id
 AND tstzrange(a.inicio, a.fin) && tstzrange(b.inicio, b.fin)
WHERE a.estado NOT IN ('cancelada','eliminada','no_asistio') AND b.estado NOT IN ('cancelada','eliminada','no_asistio');

-- Eliminar una cita es cambiarla de estado: el renglon nunca se borra
CREATE TRIGGER cita_no_borrar BEFORE DELETE ON cita FOR EACH ROW EXECUTE FUNCTION tg_no_borrar();
"""


class Migration(migrations.Migration):

    dependencies = [
        ("nucleo", "0004_nombres_en_espanol"),
    ]

    operations = [
        migrations.AddField(
            model_name="cita",
            name="baja_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="cita",
            name="baja_motivo",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="cita",
            name="baja_por",
            field=models.ForeignKey(blank=True, db_column="baja_por", null=True,
                                    on_delete=django.db.models.deletion.PROTECT, related_name="+",
                                    to="nucleo.trabajador"),
        ),
        migrations.RunSQL(CANCELADAS_ANTERIORES, migrations.RunSQL.noop),
        migrations.RemoveConstraint(model_name="cita", name="cita_estado_check"),
        migrations.RemoveConstraint(model_name="cita", name="cita_sin_empalme_unidad"),
        migrations.AddConstraint(
            model_name="cita",
            constraint=models.CheckConstraint(
                condition=models.Q(("estado__in", ["programada", "confirmada", "en_sala", "atendida",
                                                   "no_asistio", "cancelada", "eliminada"])),
                name="cita_estado_check"),
        ),
        migrations.AddConstraint(
            model_name="cita",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(("estado__in", ["cancelada", "eliminada"]), _negated=True),
                    models.Q(("baja_motivo__isnull", False), models.Q(("baja_motivo", ""), _negated=True),
                             ("baja_en__isnull", False)),
                    _connector="OR"),
                name="cita_baja_con_motivo"),
        ),
        migrations.AddConstraint(
            model_name="cita",
            constraint=django.contrib.postgres.constraints.ExclusionConstraint(
                condition=models.Q(("estado__in", ["cancelada", "eliminada", "no_asistio"]), _negated=True),
                expressions=[("unidad", "="), (nucleo.models.clinico.TsTzRange("inicio", "fin"), "&&")],
                name="cita_sin_empalme_unidad"),
        ),
        migrations.RunSQL(REGLAS_SQL, migrations.RunSQL.noop),
    ]
