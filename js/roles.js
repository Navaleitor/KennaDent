// Puestos de trabajo y permisos del sistema.
window.KD = window.KD || {};

KD.PERMISOS = [
  { id: "panel", nombre: "Ver panel de inicio", grupo: "General" },
  { id: "agenda_ver", nombre: "Ver agenda", grupo: "Agenda" },
  { id: "agenda_editar", nombre: "Crear y modificar citas", grupo: "Agenda" },
  { id: "pacientes_ver", nombre: "Ver pacientes", grupo: "Pacientes" },
  { id: "pacientes_editar", nombre: "Alta, baja y edición de pacientes", grupo: "Pacientes" },
  { id: "historial_ver", nombre: "Ver historial clínico", grupo: "Historial clínico" },
  { id: "historial_editar", nombre: "Registrar consultas", grupo: "Historial clínico" },
  { id: "presupuestos", nombre: "Presupuestos y seguimiento", grupo: "Negocio" },
  { id: "estadisticas", nombre: "Estadísticas y rankings", grupo: "Negocio" },
  { id: "personal", nombre: "Alta y baja de personal", grupo: "Administración" },
  { id: "empresa", nombre: "Empresa, sucursales y catálogo", grupo: "Administración" },
  { id: "todas_sucursales", nombre: "Acceso a todas las sucursales", grupo: "Administración" },
];

const TODOS = KD.PERMISOS.map((p) => p.id);

// Puestos habituales en una clínica dental. `atiende`: aparece como columna en la agenda.
KD.PUESTOS = [
  { id: "admin", nombre: "Administrador(a) general", grupo: "Dirección y administración", permisos: TODOS },
  { id: "gerente", nombre: "Gerente de sucursal", grupo: "Dirección y administración",
    permisos: TODOS.filter((p) => !["empresa", "todas_sucursales"].includes(p)) },
  { id: "coordinador", nombre: "Coordinador(a) de tratamientos", grupo: "Dirección y administración",
    permisos: ["panel", "agenda_ver", "agenda_editar", "pacientes_ver", "historial_ver", "presupuestos"] },
  { id: "recepcion", nombre: "Recepcionista", grupo: "Dirección y administración",
    permisos: ["panel", "agenda_ver", "agenda_editar", "pacientes_ver", "pacientes_editar"] },
  { id: "caja", nombre: "Caja y cobranza", grupo: "Dirección y administración",
    permisos: ["panel", "agenda_ver", "pacientes_ver", "presupuestos"] },
  { id: "almacen", nombre: "Almacén e inventario", grupo: "Dirección y administración", permisos: ["panel"] },

  { id: "odontologo", nombre: "Odontólogo(a) general", grupo: "Personal clínico", atiende: true, cedula: true,
    permisos: ["panel", "agenda_ver", "pacientes_ver", "pacientes_editar", "historial_ver", "historial_editar", "presupuestos"] },
  { id: "especialista", nombre: "Especialista", grupo: "Personal clínico", atiende: true, cedula: true,
    permisos: ["panel", "agenda_ver", "pacientes_ver", "pacientes_editar", "historial_ver", "historial_editar", "presupuestos"] },
  { id: "higienista", nombre: "Higienista dental", grupo: "Personal clínico", atiende: true, cedula: true,
    permisos: ["panel", "agenda_ver", "pacientes_ver", "historial_ver", "historial_editar"] },
  { id: "asistente", nombre: "Asistente dental", grupo: "Personal clínico",
    permisos: ["panel", "agenda_ver", "pacientes_ver", "historial_ver"] },
  { id: "radiologo", nombre: "Técnico(a) radiólogo", grupo: "Personal clínico", cedula: true,
    permisos: ["agenda_ver", "pacientes_ver", "historial_ver"] },
  { id: "pasante", nombre: "Pasante / practicante", grupo: "Personal clínico",
    permisos: ["pacientes_ver", "historial_ver"] },
];

KD.ESPECIALIDADES = [
  "Ortodoncia", "Endodoncia", "Periodoncia", "Odontopediatría",
  "Cirugía maxilofacial", "Prostodoncia / Rehabilitación", "Implantología",
];

KD.puesto = (id) => KD.PUESTOS.find((p) => p.id === id) || { nombre: id, permisos: [] };
