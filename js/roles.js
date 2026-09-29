// Puestos de trabajo, permisos y paleta de colores del equipo.
window.KD = window.KD || {};

KD.PERMISOS = [
  { id: "panel", nombre: "Ver dashboard", grupo: "General" },
  { id: "agenda_ver", nombre: "Ver su propia agenda", grupo: "Agenda" },
  { id: "agenda_todas", nombre: "Ver la agenda de todo el equipo", grupo: "Agenda" },
  { id: "agenda_editar", nombre: "Crear, mover y cancelar citas", grupo: "Agenda" },
  { id: "pacientes_ver", nombre: "Ver pacientes", grupo: "Pacientes" },
  { id: "pacientes_editar", nombre: "Alta y edición de datos generales", grupo: "Pacientes" },
  { id: "clinico_editar", nombre: "Editar datos clínicos y odontograma", grupo: "Pacientes" },
  { id: "historial_ver", nombre: "Ver resumen e historial clínico", grupo: "Historial clínico" },
  { id: "historial_editar", nombre: "Registrar consultas de sus pacientes", grupo: "Historial clínico" },
  { id: "seguimiento", nombre: "Seguimiento de pacientes", grupo: "Operación" },
  { id: "cobrar", nombre: "Cobrar a pacientes (solo ve el monto a cobrar)", grupo: "Operación" },
  { id: "material_solicitar", nombre: "Solicitar material", grupo: "Operación" },
  { id: "dinero", nombre: "Ver precios, montos e ingresos", grupo: "Gestión" },
  { id: "presupuestos", nombre: "Presupuestos", grupo: "Gestión" },
  { id: "caja", nombre: "Caja: totales, egresos y corte diario", grupo: "Gestión" },
  { id: "reportes", nombre: "Reportes", grupo: "Gestión" },
  { id: "inventario", nombre: "Inventario", grupo: "Gestión" },
  { id: "tratamientos", nombre: "Catálogo de tratamientos", grupo: "Gestión" },
  { id: "personal", nombre: "Alta y baja de personal", grupo: "Gestión" },
  { id: "empresa", nombre: "Empresa y sucursales", grupo: "Gestión" },
  { id: "todas_sucursales", nombre: "Acceso a todas las sucursales", grupo: "Gestión" },
];

const TODOS = KD.PERMISOS.map((p) => p.id);
const CLINICO = ["panel", "agenda_ver", "pacientes_ver", "clinico_editar", "historial_ver", "historial_editar", "material_solicitar"];

// Puestos habituales en una clínica dental.
// `atiende`: puede tener citas a su nombre. `titulo`: lleva Dr. / Dra. antes del nombre.
KD.PUESTOS = [
  { id: "admin", nombre: "Administrador(a) general", grupo: "Dirección y administración", permisos: TODOS },
  { id: "gerente", nombre: "Gerente de sucursal", grupo: "Dirección y administración",
    permisos: TODOS.filter((p) => !["empresa", "todas_sucursales"].includes(p)) },
  { id: "coordinador", nombre: "Coordinador(a) de tratamientos", grupo: "Dirección y administración",
    permisos: ["panel", "agenda_ver", "agenda_todas", "agenda_editar", "pacientes_ver", "pacientes_editar", "historial_ver", "seguimiento", "dinero", "presupuestos"] },
  { id: "recepcion", nombre: "Recepcionista", grupo: "Dirección y administración",
    permisos: ["panel", "agenda_ver", "agenda_todas", "agenda_editar", "pacientes_ver", "pacientes_editar", "seguimiento", "cobrar"] },
  { id: "caja", nombre: "Caja y cobranza", grupo: "Dirección y administración",
    permisos: ["panel", "agenda_ver", "agenda_todas", "pacientes_ver", "cobrar", "caja", "dinero"] },
  { id: "almacen", nombre: "Almacén e inventario", grupo: "Dirección y administración", permisos: ["panel", "inventario"] },

  { id: "odontologo", nombre: "Odontólogo(a) general", grupo: "Personal clínico", atiende: true, cedula: true, titulo: true, permisos: CLINICO },
  { id: "especialista", nombre: "Especialista", grupo: "Personal clínico", atiende: true, cedula: true, titulo: true, permisos: CLINICO },
  { id: "higienista", nombre: "Higienista dental", grupo: "Personal clínico", atiende: true, cedula: true, titulo: true, permisos: CLINICO },
  { id: "asistente", nombre: "Asistente dental", grupo: "Personal clínico",
    permisos: ["panel", "agenda_ver", "agenda_todas", "pacientes_ver", "historial_ver", "material_solicitar"] },
  { id: "radiologo", nombre: "Técnico(a) radiólogo", grupo: "Personal clínico", cedula: true,
    permisos: ["agenda_ver", "agenda_todas", "pacientes_ver", "historial_ver"] },
  { id: "pasante", nombre: "Pasante / practicante", grupo: "Personal clínico",
    permisos: ["pacientes_ver", "historial_ver"] },
];

KD.ESPECIALIDADES = [
  "Ortodoncia", "Endodoncia", "Periodoncia", "Odontopediatría",
  "Cirugía maxilofacial", "Prostodoncia / Rehabilitación", "Implantología",
];

KD.puesto = (id) => KD.PUESTOS.find((p) => p.id === id) || { nombre: id, permisos: [] };

// Paleta del equipo (tonos del prototipo de Kenia). Cada integrante tiene uno asignado:
// se usa en la bandera de sus citas en la agenda y en su avatar.
KD.COLORES = [
  { id: "petroleo", nombre: "Petróleo", hex: "#3d6b7d" },
  { id: "ocre", nombre: "Ocre", hex: "#b0793a" },
  { id: "salvia", nombre: "Salvia", hex: "#5f8a6c" },
  { id: "lavanda", nombre: "Lavanda", hex: "#7d6fb0" },
  { id: "terracota", nombre: "Terracota", hex: "#b4614b" },
  { id: "azul", nombre: "Azul grisáceo", hex: "#5b7fa6" },
  { id: "oliva", nombre: "Oliva", hex: "#7f8440" },
  { id: "rosa", nombre: "Palo de rosa", hex: "#a8677a" },
  { id: "arena", nombre: "Arena", hex: "#9c8457" },
  { id: "grafito", nombre: "Grafito", hex: "#5d6873" },
];
KD.color = (id) => (KD.COLORES.find((c) => c.id === id) || KD.COLORES[KD.COLORES.length - 1]).hex;
