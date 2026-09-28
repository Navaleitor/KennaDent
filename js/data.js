// Capa de datos del prototipo: guarda todo en localStorage del navegador.
// En producción esto se reemplaza por una base de datos (ver docs/requisitos.md).
window.KD = window.KD || {};

const STORAGE_KEY = "kennadent-demo-v1";

// ---------- Utilidades de fecha ----------
const pad = (n) => String(n).padStart(2, "0");
KD.fechaISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
KD.hoy = () => KD.fechaISO(new Date());
KD.sumarDias = (iso, n) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return KD.fechaISO(d);
};
KD.aMinutos = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
KD.aHora = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
KD.edad = (nac) => {
  if (!nac) return "";
  const n = new Date(nac + "T12:00:00"), h = new Date();
  let e = h.getFullYear() - n.getFullYear();
  if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) e--;
  return e;
};
KD.fmtFecha = (iso, opts = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-MX", opts) : "";
KD.fmtDinero = (n) => (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
KD.uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------- Datos de demostración ----------
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generarDemo() {
  const r = rng(20260928);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const entre = (a, b) => a + Math.floor(r() * (b - a + 1));
  const hoy = KD.hoy();

  const empresa = {
    nombre: "Grupo Dental Demo", razonSocial: "Grupo Dental Demo S.A. de C.V.", rfc: "GDD000000XX0",
    telefono: "81 0000 0000", email: "contacto@grupodentaldemo.mx",
  };

  const sucursales = [
    { id: "s1", nombre: "Cumbres", direccion: "Av. Ejemplo 100, Cumbres, Monterrey, N.L.", telefono: "81 0000 0001", horario: "Lun–Vie 9:00–19:00 · Sáb 9:00–14:00", activa: true },
    { id: "s2", nombre: "San Pedro", direccion: "Calzada Ejemplo 200, San Pedro Garza García, N.L.", telefono: "81 0000 0002", horario: "Lun–Vie 9:00–19:00 · Sáb 9:00–14:00", activa: true },
    { id: "s3", nombre: "Centro", direccion: "Calle Ejemplo 300, Centro, Monterrey, N.L.", telefono: "81 0000 0003", horario: "Lun–Vie 9:00–19:00", activa: true },
  ];

  const tratamientos = [
    ["t1", "Valoración de primera vez", "Diagnóstico", 400, 30],
    ["t2", "Radiografía panorámica", "Diagnóstico", 500, 15],
    ["t3", "Limpieza dental (profilaxis)", "Prevención", 700, 45],
    ["t4", "Sellador de fosetas", "Prevención", 450, 30],
    ["t5", "Resina (curación)", "Restauración", 900, 45],
    ["t6", "Extracción simple", "Cirugía", 900, 45],
    ["t7", "Extracción de tercer molar", "Cirugía", 3500, 90],
    ["t8", "Endodoncia (tratamiento de conducto)", "Endodoncia", 4500, 90],
    ["t9", "Corona de zirconia", "Prótesis", 7500, 60],
    ["t10", "Implante dental", "Implantología", 18000, 120],
    ["t11", "Blanqueamiento", "Estética", 4000, 60],
    ["t12", "Carilla de porcelana", "Estética", 6500, 60],
    ["t13", "Colocación de brackets", "Ortodoncia", 15000, 120],
    ["t14", "Control de ortodoncia", "Ortodoncia", 800, 30],
    ["t15", "Raspado y alisado radicular", "Periodoncia", 2500, 60],
  ].map(([id, nombre, categoria, precio, duracion]) => ({ id, nombre, categoria, precio, duracion, activo: true }));

  const tiposCita = [
    { id: "c1", nombre: "Primera vez / valoración", duracion: 30 },
    { id: "c2", nombre: "Seguimiento", duracion: 30 },
    { id: "c3", nombre: "Procedimiento", duracion: 60 },
    { id: "c4", nombre: "Control de ortodoncia", duracion: 30 },
    { id: "c5", nombre: "Urgencia", duracion: 45 },
  ];

  const P = (id, nombre, puesto, sucs, extra = {}) => ({
    id, nombre, puesto, sucursales: sucs, activo: true, alta: KD.sumarDias(hoy, -entre(200, 900)),
    telefono: `81 ${entre(1000, 9999)} ${entre(1000, 9999)}`,
    email: nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(dra?\.) /, "").split(" ").slice(0, 2).join(".") + "@grupodentaldemo.mx",
    permisos: [...KD.puesto(puesto).permisos], especialidad: "", cedula: KD.puesto(puesto).cedula ? String(entre(1000000, 9999999)) : "",
    ...extra,
  });
  const personal = [
    P("u1", "Kenia Navarro", "admin", ["s1", "s2", "s3"]),
    P("u2", "Dra. Andrea Garza", "odontologo", ["s1"]),
    P("u3", "Dr. Luis Treviño", "odontologo", ["s1"]),
    P("u4", "Dra. Mariana Cantú", "especialista", ["s1", "s2"], { especialidad: "Ortodoncia" }),
    P("u5", "Dr. Jorge Salinas", "odontologo", ["s2"]),
    P("u6", "Dr. Ricardo Elizondo", "especialista", ["s2", "s3"], { especialidad: "Endodoncia" }),
    P("u7", "Sofía Villarreal", "higienista", ["s2"]),
    P("u8", "Dra. Paola Ríos", "odontologo", ["s3"]),
    P("u9", "Dr. Héctor Montemayor", "odontologo", ["s3"]),
    P("u10", "Daniela Flores", "recepcion", ["s1"]),
    P("u11", "Valeria Guerra", "recepcion", ["s2"]),
    P("u12", "Fernanda Leal", "recepcion", ["s3"]),
    P("u13", "Carlos Martínez", "gerente", ["s1"]),
    P("u14", "Lucía Hernández", "coordinador", ["s1", "s2", "s3"], { permisos: [...KD.puesto("coordinador").permisos, "todas_sucursales"] }),
    P("u15", "Brenda Sánchez", "asistente", ["s1"]),
    P("u16", "Miguel Castillo", "asistente", ["s3"]),
    P("u17", "Ana Lozano", "pasante", ["s2"]),
    P("u18", "Roberto Garza", "caja", ["s1"]),
  ];

  const nombres = ["José", "María", "Juan", "Guadalupe", "Luis", "Fernanda", "Carlos", "Ximena", "Jorge", "Sofía", "Miguel", "Valeria", "Diego", "Camila", "Alejandro", "Regina", "Eduardo", "Renata", "Roberto", "Paulina", "Óscar", "Daniela", "Arturo", "Natalia", "Raúl", "Andrea", "Emilio", "Lorena", "Sergio", "Mónica"];
  const apellidos = ["García", "Martínez", "López", "González", "Rodríguez", "Pérez", "Sánchez", "Ramírez", "Cruz", "Flores", "Gómez", "Morales", "Reyes", "Jiménez", "Treviño", "Garza", "Cantú", "Villarreal", "Salinas", "Elizondo", "Leal", "Guerra", "Montemayor", "Chapa", "Zambrano"];
  const alergiasOpc = ["", "", "", "", "", "Penicilina", "Látex", "Ibuprofeno", "Anestesia con epinefrina (precaución)"];
  const pacientes = [];
  for (let i = 1; i <= 1100; i++) {
    const suc = pick(sucursales).id;
    pacientes.push({
      id: `p${i}`, expediente: `KD-${String(i).padStart(5, "0")}`,
      nombre: `${pick(nombres)} ${pick(apellidos)} ${pick(apellidos)}`,
      nacimiento: `${entre(1955, 2018)}-${pad(entre(1, 12))}-${pad(entre(1, 28))}`,
      sexo: r() < 0.55 ? "F" : "M",
      telefono: `81 ${entre(1000, 9999)} ${entre(1000, 9999)}`, email: "",
      sucursalId: suc, alergias: pick(alergiasOpc), antecedentes: r() < 0.15 ? pick(["Diabetes tipo 2", "Hipertensión", "Embarazo", "Asma"]) : "",
      alta: KD.sumarDias(hoy, -entre(0, 700)), activo: true,
    });
  }

  const doctores = personal.filter((u) => KD.puesto(u.puesto).atiende);
  const citas = [], consultas = [], planes = [];
  const trat = (id) => tratamientos.find((t) => t.id === id);
  const precio = (id) => Math.round(trat(id).precio * (0.9 + r() * 0.2) / 50) * 50;
  const piezas = ["11", "12", "14", "16", "21", "24", "26", "36", "37", "38", "46", "47", "48"];
  const planPendiente = (pid) => planes.filter((p) => p.pacienteId === pid && (p.estado === "pendiente" || p.estado === "aceptado"));

  const pacPorSuc = Object.fromEntries(sucursales.map((s) => [s.id, pacientes.filter((p) => p.sucursalId === s.id)]));
  for (let d = -90; d <= 14; d++) {
    const fecha = KD.sumarDias(hoy, d);
    const dow = new Date(fecha + "T12:00:00").getDay();
    if (dow === 0) continue;
    for (const doc of doctores) {
      const sucId = doc.sucursales[dow % doc.sucursales.length];
      if (dow === 6 && sucId === "s3") continue;
      let t = 9 * 60 + entre(0, 2) * 30;
      const fin = dow === 6 ? 14 * 60 : 19 * 60;
      while (t < fin - 30) {
        const esOrto = doc.especialidad === "Ortodoncia", esEndo = doc.especialidad === "Endodoncia";
        const tipo = esOrto ? (r() < 0.75 ? "c4" : pick(["c1", "c3"])) : doc.puesto === "higienista" ? pick(["c2", "c3"]) : pick(["c1", "c1", "c2", "c3", "c3", "c5"]);
        const dur = tipo === "c3" ? (esEndo || r() < 0.3 ? 90 : 60) : tiposCita.find((x) => x.id === tipo).duracion;
        if (t + dur > fin) break;
        const pac = r() < 0.85 ? pick(pacPorSuc[sucId]) : pick(pacientes);
        let estado;
        if (d < 0) estado = r() < 0.86 ? "atendida" : r() < 0.55 ? "no_asistio" : "cancelada";
        else if (d === 0) estado = t < new Date().getHours() * 60 ? "atendida" : r() < 0.6 ? "confirmada" : "programada";
        else estado = r() < 0.3 ? "confirmada" : "programada";
        const cita = { id: `ci${citas.length + 1}`, pacienteId: pac.id, doctorId: doc.id, sucursalId: sucId, fecha, hora: KD.aHora(t), duracion: dur, tipoId: tipo, estado, notas: "" };
        citas.push(cita);

        if (estado === "atendida") {
          const procs = [];
          let motivo = "", diagnostico = "";
          const recomendados = [];
          if (tipo === "c1") {
            motivo = pick(["Revisión general", "Dolor en muela", "Sensibilidad dental", "Quiere blanqueamiento", "Sangrado de encías"]);
            procs.push({ tratamientoId: "t1", pieza: "", precio: precio("t1") });
            if (r() < 0.5) procs.push({ tratamientoId: "t2", pieza: "", precio: precio("t2") });
            const n = entre(esOrto ? 1 : 0, 3);
            for (let k = 0; k < n; k++) {
              const tr = esOrto ? "t13" : pick(["t3", "t5", "t5", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12", "t13", "t15"]);
              recomendados.push(tr);
            }
            diagnostico = recomendados.length ? `Se detectan ${recomendados.length} tratamiento(s) necesario(s).` : "Sin hallazgos relevantes.";
          } else if (tipo === "c4") {
            motivo = "Control mensual de ortodoncia";
            procs.push({ tratamientoId: "t14", pieza: "", precio: precio("t14") });
            diagnostico = "Evolución favorable.";
          } else {
            // Cada quien realiza lo que le corresponde: higienista nada del plan, endodoncista solo conductos, brackets solo ortodoncia
            const pend = planPendiente(pac.id).filter((x) => doc.puesto !== "higienista" && (esEndo ? x.tratamientoId === "t8" : esOrto ? x.tratamientoId === "t13" : x.tratamientoId !== "t13"));
            if (pend.length && r() < 0.8) {
              const it = pend[0];
              it.estado = "realizado"; it.fechaEstado = fecha;
              procs.push({ tratamientoId: it.tratamientoId, pieza: it.pieza, precio: it.precio, planId: it.id });
              motivo = `Tratamiento programado: ${trat(it.tratamientoId).nombre}`;
            } else {
              const tr = tipo === "c5" ? pick(["t5", "t6", "t8"]) : esEndo ? "t8" : doc.puesto === "higienista" ? pick(["t3", "t15", "t4"]) : pick(["t3", "t5", "t6", "t11"]);
              procs.push({ tratamientoId: tr, pieza: ["t3", "t11", "t4"].includes(tr) ? "" : pick(piezas), precio: precio(tr) });
              motivo = tipo === "c5" ? "Urgencia: dolor agudo" : trat(tr).nombre;
            }
            diagnostico = "Procedimiento sin complicaciones.";
          }
          const cid = `co${consultas.length + 1}`;
          consultas.push({
            id: cid, citaId: cita.id, pacienteId: pac.id, doctorId: doc.id, sucursalId: sucId, fecha,
            motivo, diagnostico, procedimientos: procs,
            notas: pick(["", "Se dan indicaciones de higiene.", "Paciente tolera bien el procedimiento.", "Se receta analgésico por 3 días.", "Cita de seguimiento sugerida."]),
          });
          for (const tr of recomendados) {
            const yaTiene = planPendiente(pac.id);
            if (yaTiene.length >= 4 || (["t3", "t11", "t13", "t15"].includes(tr) && yaTiene.some((x) => x.tratamientoId === tr))) continue;
            const roll = r();
            planes.push({
              id: `pl${planes.length + 1}`, pacienteId: pac.id, doctorId: doc.id, sucursalId: sucId, consultaId: cid, fecha,
              tratamientoId: tr, pieza: ["t3", "t11", "t13", "t15"].includes(tr) ? "" : pick(piezas), precio: precio(tr),
              estado: roll < 0.12 ? "rechazado" : roll < 0.3 ? "aceptado" : "pendiente", fechaEstado: fecha,
            });
          }
        }
        t += dur + pick([0, 0, 15, 30, 30, 60]);
      }
    }
  }

  return { version: 1, creado: hoy, empresa, sucursales, tratamientos, tiposCita, personal, pacientes, citas, consultas, planes, sesion: { usuarioId: "u1", sucursalId: "todas" } };
}

// ---------- Almacenamiento ----------
KD.cargar = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { KD.db = JSON.parse(raw); return; }
  } catch (e) { /* sin almacenamiento disponible */ }
  KD.db = generarDemo();
  KD.guardar();
};
KD.guardar = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(KD.db)); } catch (e) { /* ignorar */ }
};
KD.reiniciarDemo = () => {
  KD.db = generarDemo();
  KD.guardar();
};

// ---------- Consultas de datos ----------
KD.byId = (col, id) => KD.db[col].find((x) => x.id === id);
KD.nombreSuc = (id) => (KD.byId("sucursales", id) || {}).nombre || "—";
KD.nombreTrat = (id) => (KD.byId("tratamientos", id) || {}).nombre || "—";
KD.nombreUsuario = (id) => (KD.byId("personal", id) || {}).nombre || "—";
KD.usuario = () => KD.byId("personal", KD.db.sesion.usuarioId);
KD.puede = (permiso) => (KD.usuario()?.permisos || []).includes(permiso);

// Sucursales visibles para el usuario actual
KD.sucursalesUsuario = () => {
  const u = KD.usuario();
  const activas = KD.db.sucursales.filter((s) => s.activa);
  return KD.puede("todas_sucursales") ? activas : activas.filter((s) => u.sucursales.includes(s.id));
};
// Filtro actual de sucursal: devuelve lista de ids
KD.sucursalesFiltro = () => {
  const sel = KD.db.sesion.sucursalId;
  const visibles = KD.sucursalesUsuario().map((s) => s.id);
  if (sel !== "todas" && visibles.includes(sel)) return [sel];
  return visibles;
};
KD.doctores = (sucIds) => KD.db.personal.filter((u) => u.activo && KD.puesto(u.puesto).atiende && (!sucIds || u.sucursales.some((s) => sucIds.includes(s))));

KD.totalConsulta = (c) => c.procedimientos.reduce((s, p) => s + (p.precio || 0), 0);
KD.pendientePaciente = (pid) => KD.db.planes.filter((p) => p.pacienteId === pid && (p.estado === "pendiente" || p.estado === "aceptado"));
KD.ultimaVisita = (pid) => {
  let u = "";
  for (const c of KD.db.consultas) if (c.pacienteId === pid && c.fecha > u) u = c.fecha;
  return u;
};
KD.siguienteExpediente = () => {
  const max = KD.db.pacientes.reduce((m, p) => Math.max(m, Number(p.expediente.split("-")[1]) || 0), 0);
  return `KD-${String(max + 1).padStart(5, "0")}`;
};

KD.ESTADOS_CITA = {
  programada: "Programada", confirmada: "Confirmada", en_sala: "En sala de espera",
  atendida: "Atendida", no_asistio: "No asistió", cancelada: "Cancelada",
};
KD.ESTADOS_PLAN = { pendiente: "Pendiente", aceptado: "Aceptado", realizado: "Realizado", rechazado: "Rechazado" };
