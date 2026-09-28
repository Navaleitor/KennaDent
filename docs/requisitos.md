# KennaDent: requisitos del sistema

> Nombre sujeto a cambio. Documento vivo: complétenlo con Kenia conforme se definan los puntos marcados como **Por definir**.

## 1. Qué es KennaDent

Un **software de gestión para clínicas dentales**, vendido por **suscripción mensual**. Lo usa el personal de la clínica; los pacientes no entran al sistema.

### Niveles de acceso

| Nivel | Quién | Qué hace |
|---|---|---|
| **Plataforma** | KennaDent (Kenia) | Da de alta a las empresas que contratan y crea la cuenta del administrador de cada una |
| **Empresa** | Dueño o administrador de la clínica | Administra sus sucursales, su personal, sus permisos y ve las métricas globales |
| **Personal** | Recepción, doctores, asistentes, etc. | Ven únicamente lo que su administrador les habilitó |

### Organización de la información

```
KennaDent
└── Empresa (cliente que paga la suscripción)
    ├── Sucursales (1, 2, 3…)
    ├── Personal → cada persona con un puesto, sucursales asignadas y permisos
    ├── Catálogo de tratamientos y precios · Tipos de cita
    └── Pacientes → pertenecen a la empresa, no a una sucursal
        ├── Historial clínico (consultas)
        ├── Plan de tratamiento / presupuesto
        └── Citas
```

Un paciente atendido en la sucursal 1 puede ir a la sucursal 2 y ahí ya está todo su expediente: no se vuelve a dar de alta ni hay que pedir reportes.

## 2. Fase 1: lo esencial (prototipo en este repositorio)

### 2.1 Empresa y sucursales
- Datos de la empresa: nombre comercial, razón social, RFC, teléfono, correo.
- Alta, edición y desactivación de sucursales: nombre, dirección, teléfono, horario.
- Catálogo de tratamientos: nombre, área, duración y precio de lista.
- Tipos de cita con duración predeterminada.

### 2.2 Personal (alta y baja)
Puestos incluidos:

| Área | Puestos |
|---|---|
| Dirección y administración | Administrador(a) general · Gerente de sucursal · Coordinador(a) de tratamientos · Recepcionista · Caja y cobranza · Almacén e inventario |
| Personal clínico | Odontólogo(a) general · Especialista (Ortodoncia, Endodoncia, Periodoncia, Odontopediatría, Cirugía maxilofacial, Prostodoncia/Rehabilitación, Implantología) · Higienista dental · Asistente dental · Técnico(a) radiólogo · Pasante / practicante |

- Datos: nombre, puesto, especialidad, cédula profesional (personal clínico), teléfono, correo (usuario para entrar), sucursales donde trabaja.
- **Permisos por casilla.** Cada puesto trae permisos sugeridos, que el administrador puede ajustar persona por persona.
- **Baja** con fecha y motivo. La persona ya no puede entrar, pero su historial se conserva para las estadísticas. Se puede reactivar.

Permisos disponibles: ver panel · ver agenda · crear/modificar citas · ver pacientes · alta/baja/edición de pacientes · ver historial clínico · registrar consultas · presupuestos · estadísticas · alta/baja de personal · empresa y sucursales · acceso a todas las sucursales.

Permisos sugeridos por puesto (ejemplos):

| Puesto | Acceso sugerido |
|---|---|
| Recepcionista | Agenda (ver y agendar), pacientes (alta y búsqueda) |
| Pasante | Solo pacientes e historial clínico (lectura) |
| Odontólogo(a) / Especialista | Agenda, pacientes, historial (lectura y registro), presupuestos |
| Coordinador(a) de tratamientos | Agenda, pacientes, historial (lectura), presupuestos |
| Gerente de sucursal | Todo, excepto datos de la empresa y otras sucursales |
| Administrador(a) general | Todo |

### 2.3 Agenda
- Vista por día con una columna por doctor en computadora y tablet; en celular, lista.
- Filtro por sucursal. Se agenda al hacer clic en un horario libre o con el botón "Nueva cita".
- Aviso si el doctor ya tiene otra cita a esa hora.
- Estados: programada → confirmada → en sala de espera → atendida · no asistió · cancelada.

### 2.4 Pacientes e historial clínico
- Alta con número de expediente automático (KD-00001…), datos de contacto, sucursal habitual, **alergias** (se muestran como alerta) y antecedentes médicos.
- Búsqueda por nombre, expediente o teléfono desde cualquier sucursal.
- **Baja lógica.** El expediente nunca se borra, porque la NOM-004-SSA3-2012 obliga a conservarlo al menos 5 años.
- **Registro de consulta** al final de cada sesión: fecha, doctor, sucursal, motivo, diagnóstico, **qué se le hizo** (tratamiento, pieza dental y monto), notas e indicaciones, y **tratamientos recomendados**.
- El historial muestra todas las consultas en línea de tiempo: cuándo, quién, dónde, qué se hizo y qué se recomendó.

### 2.5 Presupuestos (plan de tratamiento)
Lo que el doctor recomienda en una consulta queda como **presupuesto pendiente** del paciente. Ejemplo: 3 caries y una extracción suman $X de ingreso potencial.
- Estados: pendiente → aceptado → realizado · rechazado.
- Página con los **pacientes ordenados por monto pendiente**, para llamar primero a los de mayor valor, con botón para contactarlos por WhatsApp.
- Indicadores: monto pendiente, monto aceptado por realizar y tasa de aceptación.

### 2.6 Estadísticas
Periodo de 7, 30 o 90 días, global o por sucursal:
- Ventas, consultas, pacientes atendidos, pacientes nuevos, % de inasistencia.
- **Ranking de tratamientos** más vendidos (por ingresos o por cantidad).
- **Ventas por sucursal**, que es el ranking de unidades.
- **Ventas por área** (ortodoncia, estética, endodoncia…).
- **Ranking de doctores**: pacientes atendidos, consultas, ventas, monto presupuestado y **% de aceptación**. Este último mide qué doctor logra que los pacientes acepten sus tratamientos.

### 2.7 Diseño
- Estilo sobrio y empresarial, con **modo día y modo noche**.
- En celular todo va en una columna; en tablet y computadora se acomoda a lo ancho con menú lateral.

## 3. Fases siguientes

**Fase 2**
- Recordatorios por **WhatsApp** (API oficial de WhatsApp Business):
  - Al paciente, 24 h antes, pidiendo confirmar o cancelar.
  - A la recepcionista y al doctor, 15 min antes.
- **Cobros y pagos** (efectivo, tarjeta, transferencia, abonos), para que las ventas reflejen lo pagado.
- Métricas de cobranza.

**Fase 3**
- Historial clínico completo: odontograma, radiografías y archivos, recetas, consentimientos firmados.
- Inventario y consumo de material.
- Portal de KennaDent para dar de alta empresas.
- Cobro automático de la suscripción (Stripe o Mercado Pago).

## 4. Por definir con Kenia

- [ ] Nombre final del producto y dominio.
- [ ] Lista definitiva de **tipos de cita** y su duración.
- [ ] Qué debe incluir exactamente el **reporte de consulta** y el historial clínico.
- [ ] Nombre que usan en la clínica para los "presupuestos" (¿plan de tratamiento, cotización, presupuesto?).
- [ ] Qué métricas adicionales quieren ver y cómo se define a un "mejor doctor".
- [ ] Permisos exactos por puesto.
- [ ] ¿El doctor ve solo a sus pacientes o a todos los de la empresa?
- [ ] ¿La mensualidad se cobra por sucursal, por doctor o con un precio fijo?

## 5. Notas técnicas

- **Prototipo actual:** HTML, CSS y JavaScript sin dependencias. Los datos son de ejemplo y se guardan en el navegador (`localStorage`), así que cada persona que lo abre ve su propia copia.
- **Producción (recomendado):** Next.js y Supabase (PostgreSQL con *Row Level Security*, para que ninguna empresa pueda ver datos de otra), con autenticación real y respaldos.
- **Datos de salud:** cumplir con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, NOM-004-SSA3-2012 (expediente clínico) y NOM-024-SSA3-2012 (sistemas de información de registro electrónico para la salud). Esto incluye aviso de privacidad, cifrado y bitácora de quién consulta cada expediente.
