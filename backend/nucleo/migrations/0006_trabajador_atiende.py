"""Quién atiende pacientes se decide por persona, no solo por puesto (v0.6.0).

Un administrador que también es dentista puede tener citas a su nombre. Los
trabajadores que ya existen toman el valor de su puesto.
"""
from django.db import migrations, models

DESDE_EL_PUESTO = r"""
UPDATE trabajador t SET atiende = p.atiende FROM puesto p WHERE p.id = t.puesto_id;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("nucleo", "0005_cita_baja"),
    ]

    operations = [
        migrations.AddField(
            model_name="trabajador",
            name="atiende",
            field=models.BooleanField(db_default=False),
        ),
        migrations.RunSQL(DESDE_EL_PUESTO, migrations.RunSQL.noop),
    ]
