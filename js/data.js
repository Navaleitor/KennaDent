// Capa de datos del prototipo: guarda todo en localStorage del navegador.
// En producción esto se reemplaza por una base de datos (ver docs/requisitos.md).
window.KD = window.KD || {};

const STORAGE_KEY = "kennadent-demo-v5";
const LLAVES_VIEJAS = ["kennadent-demo-v1", "kennadent-demo-v2", "kennadent-demo-v3", "kennadent-demo-v4"];

// ---------- Utilidades de fecha y texto ----------
const pad = (n) => String(n).padStart(2, "0");
KD.fechaISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
KD.hoy = () => KD.fechaISO(new Date());
KD.ahoraMin = () => new Date().getHours() * 60 + new Date().getMinutes();
KD.sumarDias = (iso, n) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return KD.fechaISO(d);
};
KD.diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
KD.diaSemana = (iso) => new Date(iso + "T12:00:00").getDay(); // 0 = domingo
KD.inicioSemana = (iso) => KD.sumarDias(iso, -((KD.diaSemana(iso) + 6) % 7)); // lunes
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
KD.fmtNum = (n, dec = 0) => (n || 0).toLocaleString("es-MX", { maximumFractionDigits: dec });
KD.uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
KD.sinAcentos = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
// Todos los nombres (pacientes, personal, tratamientos) se guardan en mayúsculas.
KD.mayus = (s) => String(s || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("es-MX");
KD.buscable = (s) => KD.sinAcentos(s).toLowerCase();
KD.iniciales = (n) => String(n || "").replace(/^(DRA?\.)\s+/i, "").split(" ").slice(0, 2).map((p) => p[0] || "").join("").toUpperCase();

// ---------- Usuario y contraseña predeterminados del personal ----------
// Usuario: nombre.apellido (sin acentos). Si ya existe, se usa el segundo apellido.
function partesNombre(nombre) {
  const t = KD.buscable(nombre).replace(/[^a-zñ ]/g, "").split(" ").filter(Boolean);
  if (t.length >= 4) return { nombre: t[0], ap1: t[t.length - 2], ap2: t[t.length - 1] };
  return { nombre: t[0] || "usuario", ap1: t[1] || "", ap2: t[2] || "" };
}
KD.sugerirUsuario = (nombre, existentes) => {
  const p = partesNombre(nombre);
  const base = [p.nombre, p.ap1].filter(Boolean).join(".");
  if (!existentes.includes(base)) return { usuario: base, aviso: "" };
  if (p.ap2) {
    const alt = `${p.nombre}.${p.ap2}`;
    if (!existentes.includes(alt)) return { usuario: alt, aviso: `Ya existe el usuario "${base}", así que se tomó el segundo apellido: "${alt}".` };
  }
  let n = 2;
  while (existentes.includes(`${base}${n}`)) n++;
  return { usuario: `${base}${n}`, aviso: `Ya existe el usuario "${base}" y no hay segundo apellido distinto; se usará "${base}${n}".` };
};
KD.generarPassword = (nombre, azar = Math.random) => {
  const p = partesNombre(nombre);
  return `${p.nombre}${p.ap1}${100 + Math.floor(azar() * 900)}`;
};

// ---------- Datos de demostración ----------
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Materiales que consume cualquier cita atendida (guantes, cubrebocas…)
const CONSUMO_BASE = { m1: 2, m2: 2, m3: 1, m4: 2 };

function generarDemo() {
  const r = rng(20260929);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const entre = (a, b) => a + Math.floor(r() * (b - a + 1));
  const hoy = KD.hoy();
  const ahora = KD.ahoraMin();
  const inicioHist = `${hoy.slice(0, 4)}-01-01`;
  const diasHist = Math.max(120, KD.diasEntre(inicioHist, hoy));

  const empresa = {
    nombre: "GRUPO DENTAL DEMO", razonSocial: "Grupo Dental Demo S.A. de C.V.", rfc: "GDD000000XX0",
    telefono: "81 0000 0000", email: "contacto@grupodentaldemo.mx",
  };

  const sucursales = [
    { id: "s1", nombre: "CUMBRES", direccion: "Av. Ejemplo 100, Cumbres, Monterrey, N.L.", telefono: "81 0000 0001", horario: "Lun–Vie 9:00–19:00 · Sáb 9:00–14:00", unidades: 3, activa: true },
    { id: "s2", nombre: "SAN PEDRO", direccion: "Calzada Ejemplo 200, San Pedro Garza García, N.L.", telefono: "81 0000 0002", horario: "Lun–Vie 9:00–19:00 · Sáb 9:00–14:00", unidades: 2, activa: true },
    { id: "s3", nombre: "CENTRO", direccion: "Calle Ejemplo 300, Centro, Monterrey, N.L.", telefono: "81 0000 0003", horario: "Lun–Vie 9:00–19:00", unidades: 2, activa: true },
  ];

  const tratamientos = [
    ["t1", "VALORACIÓN DE PRIMERA VEZ", "Diagnóstico", 400, 30, {}],
    ["t2", "RADIOGRAFÍA PANORÁMICA", "Diagnóstico", 500, 15, {}],
    ["t3", "LIMPIEZA DENTAL", "Preventiva", 850, 45, { m11: 0.05 }],
    ["t4", "SELLADOR DE FOSETAS", "Preventiva", 450, 30, { m9: 0.05, m10: 0.02 }],
    ["t5", "RESINA ESTÉTICA", "Operatoria", 1200, 45, { m6: 1, m7: 1, m8: 0.1, m9: 0.05, m10: 0.03 }],
    ["t6", "EXTRACCIÓN SIMPLE", "Cirugía", 850, 45, { m6: 2, m7: 1, m5: 1, m14: 1 }],
    ["t7", "EXTRACCIÓN DE TERCER MOLAR", "Cirugía", 3500, 90, { m6: 3, m7: 2, m5: 2, m14: 2 }],
    ["t8", "ENDODONCIA", "Endodoncia", 4800, 90, { m6: 2, m7: 1, m12: 0.5, m13: 0.2 }],
    ["t9", "CORONA DE ZIRCONIA", "Rehabilitación", 5400, 60, { m6: 1, m7: 1 }],
    ["t10", "IMPLANTE UNITARIO", "Implantología", 13200, 120, { m6: 3, m7: 2, m5: 2, m14: 2 }],
    ["t11", "BLANQUEAMIENTO DENTAL", "Estética", 2800, 60, { m15: 1 }],
    ["t12", "CARILLA DE PORCELANA", "Estética", 6500, 90, { m6: 1, m9: 0.1, m10: 0.05 }],
    ["t13", "COLOCACIÓN DE BRACKETS", "Ortodoncia", 15000, 120, { m16: 1, m9: 0.2, m10: 0.1 }],
    ["t14", "CONTROL DE ORTODONCIA", "Ortodoncia", 800, 30, {}],
    ["t15", "RASPADO Y ALISADO RADICULAR", "Periodoncia", 2500, 60, { m6: 2, m7: 2, m5: 1 }],
  ].map(([id, nombre, categoria, precio, duracion, materiales]) => ({ id, nombre, categoria, precio, duracion, materiales, activo: true }));

  // tratamiento: el tipo pide elegir qué se le va a hacer al paciente (y en qué piezas)
  const tiposCita = [
    { id: "c1", nombre: "Primera vez / valoración", duracion: 30, diagnostico: true },
    { id: "c2", nombre: "Seguimiento", duracion: 30 },
    { id: "c3", nombre: "Tratamiento", duracion: 60, tratamiento: true },
    { id: "c4", nombre: "Control de ortodoncia", duracion: 30 },
    { id: "c5", nombre: "Urgencia", duracion: 45, tratamiento: true },
  ];

  const productos = [
    ["m1", "GUANTES DE NITRILO", "Consumibles", "pares", 6, "DENTAL SUPPLY"],
    ["m2", "CUBREBOCAS", "Consumibles", "piezas", 2, "DENTAL SUPPLY"],
    ["m3", "EYECTORES DE SALIVA", "Consumibles", "piezas", 1.5, "DENTAL SUPPLY"],
    ["m4", "BOLSAS DE ESTERILIZACIÓN", "Consumibles", "piezas", 1.2, "DENTAL SUPPLY"],
    ["m5", "GASAS ESTÉRILES", "Consumibles", "paquetes", 35, "DENTAL SUPPLY"],
    ["m6", "ANESTESIA LIDOCAÍNA", "Farmacia", "cartuchos", 14, "DENTSPLY"],
    ["m7", "AGUJAS DENTALES", "Farmacia", "piezas", 5, "DENTSPLY"],
    ["m8", "RESINA FILTEK Z350", "Operatoria", "jeringas", 680, "3M MÉXICO"],
    ["m9", "ÁCIDO GRABADOR 37%", "Operatoria", "jeringas", 330, "ULTRADENT"],
    ["m10", "ADHESIVO DENTAL", "Operatoria", "frascos", 950, "3M MÉXICO"],
    ["m11", "PASTA PROFILÁCTICA", "Preventiva", "frascos", 160, "DENTSPLY"],
    ["m12", "LIMAS ENDODÓNTICAS", "Endodoncia", "juegos", 420, "KOMET"],
    ["m13", "HIPOCLORITO DE SODIO", "Endodoncia", "frascos", 90, "DENTSPLY"],
    ["m14", "SUTURA SEDA 3-0", "Cirugía", "sobres", 45, "DENTAL SUPPLY"],
    ["m15", "GEL BLANQUEADOR", "Estética", "kits", 1100, "ULTRADENT"],
    ["m16", "BRACKETS METÁLICOS", "Ortodoncia", "juegos", 1800, "3M MÉXICO"],
  ].map(([id, nombre, categoria, unidad, costo, proveedor]) => ({ id, nombre, categoria, unidad, costo, proveedor, existencias: {}, minimo: {}, activo: true }));

  const usados = [];
  const P = (id, nombre, sexo, puesto, sucs, color, extra = {}) => {
    const pu = KD.puesto(puesto);
    const { usuario } = KD.sugerirUsuario(nombre, usados);
    usados.push(usuario);
    return {
      id, nombre, sexo, puesto, sucursales: sucs, color, activo: true, alta: KD.sumarDias(hoy, -entre(300, 1200)),
      titulo: !!pu.titulo, usuario, password: KD.generarPassword(nombre, r),
      telefono: `81 ${entre(1000, 9999)} ${entre(1000, 9999)}`, email: "",
      permisos: [...pu.permisos], especialidad: "", cedula: pu.cedula ? String(entre(1000000, 9999999)) : "",
      ...extra,
    };
  };
  const personal = [
    P("u1", "KENIA NAVARRO", "F", "admin", ["s1", "s2", "s3"], "ocre", { titulo: true, cedula: String(entre(1000000, 9999999)) }),
    P("u2", "ANDREA GARZA LEAL", "F", "odontologo", ["s1"], "petroleo"),
    P("u3", "LUIS TREVIÑO CHAPA", "M", "odontologo", ["s1"], "salvia"),
    P("u4", "MARIANA CANTÚ RÍOS", "F", "especialista", ["s1", "s2"], "lavanda", { especialidad: "Ortodoncia" }),
    P("u5", "JORGE SALINAS MORA", "M", "odontologo", ["s2"], "terracota"),
    P("u6", "RICARDO ELIZONDO PEÑA", "M", "especialista", ["s2", "s3"], "azul", { especialidad: "Endodoncia" }),
    P("u7", "SOFÍA VILLARREAL CRUZ", "F", "higienista", ["s2"], "rosa"),
    P("u8", "PAOLA RÍOS GUERRA", "F", "odontologo", ["s3"], "oliva"),
    P("u9", "HÉCTOR MONTEMAYOR SADA", "M", "odontologo", ["s3"], "arena"),
    P("u10", "DANIELA FLORES ROJAS", "F", "recepcion", ["s1"], "grafito"),
    P("u11", "VALERIA GUERRA LÓPEZ", "F", "recepcion", ["s2"], "grafito"),
    P("u12", "FERNANDA LEAL SOTO", "F", "recepcion", ["s3"], "grafito"),
    P("u13", "CARLOS MARTÍNEZ VEGA", "M", "gerente", ["s1"], "azul"),
    P("u14", "LUCÍA HERNÁNDEZ PAZ", "F", "coordinador", ["s1", "s2", "s3"], "rosa", { permisos: [...KD.puesto("coordinador").permisos, "todas_sucursales"] }),
    P("u15", "BRENDA SÁNCHEZ ORTA", "F", "asistente", ["s1"], "salvia"),
    P("u16", "MIGUEL CASTILLO RUIZ", "M", "asistente", ["s3"], "oliva"),
    P("u17", "ANA LOZANO MEJÍA", "F", "pasante", ["s2"], "lavanda"),
    P("u18", "ROBERTO GARZA LEAL", "M", "caja", ["s1"], "terracota"),
    P("u19", "JAVIER ORTIZ LUNA", "M", "almacen", ["s1", "s2", "s3"], "arena"),
  ];
  const recepcionDe = { s1: "u10", s2: "u11", s3: "u12" };

  const nombres = ["JOSÉ", "MARÍA", "JUAN", "GUADALUPE", "LUIS", "FERNANDA", "CARLOS", "XIMENA", "JORGE", "SOFÍA", "MIGUEL", "VALERIA", "DIEGO", "CAMILA", "ALEJANDRO", "REGINA", "EDUARDO", "RENATA", "ROBERTO", "PAULINA", "ÓSCAR", "DANIELA", "ARTURO", "NATALIA", "RAÚL", "ANDREA", "EMILIO", "LORENA", "SERGIO", "MÓNICA"];
  const apellidos = ["GARCÍA", "MARTÍNEZ", "LÓPEZ", "GONZÁLEZ", "RODRÍGUEZ", "PÉREZ", "SÁNCHEZ", "RAMÍREZ", "CRUZ", "FLORES", "GÓMEZ", "MORALES", "REYES", "JIMÉNEZ", "TREVIÑO", "GARZA", "CANTÚ", "VILLARREAL", "SALINAS", "ELIZONDO", "LEAL", "GUERRA", "MONTEMAYOR", "CHAPA", "ZAMBRANO"];
  const alergiasOpc = ["", "", "", "", "", "Penicilina", "Látex", "Ibuprofeno", "Anestesia con epinefrina (precaución)"];
  const pacientes = [];
  for (let i = 1; i <= 1100; i++) {
    pacientes.push({
      id: `p${i}`, expediente: `KD-${String(i).padStart(5, "0")}`,
      nombre: `${pick(nombres)} ${pick(apellidos)} ${pick(apellidos)}`,
      nacimiento: `${r() < 0.12 ? entre(2014, 2022) : entre(1950, 2008)}-${pad(entre(1, 12))}-${pad(entre(1, 28))}`,
      sexo: r() < 0.55 ? "F" : "M",
      telefono: `81 ${entre(1000, 9999)} ${entre(1000, 9999)}`, email: "",
      sucursalId: pick(sucursales).id, alergias: pick(alergiasOpc),
      antecedentes: r() < 0.15 ? pick(["Diabetes tipo 2", "Hipertensión", "Embarazo", "Asma"]) : "",
      alta: KD.sumarDias(hoy, -entre(0, 900)), activo: true,
    });
  }

  const doctores = personal.filter((u) => KD.puesto(u.puesto).atiende);
  const citas = [], consultas = [], planes = [], presupuestos = [], citasEliminadas = [];
  const trat = (id) => tratamientos.find((t) => t.id === id);
  const precio = (id) => Math.round(trat(id).precio * (0.95 + r() * 0.1) / 50) * 50;
  const PIEZA = ["t5", "t6", "t7", "t8", "t9", "t10", "t12"];
  const pendientesDe = (pid) => planes.filter((p) => p.pacienteId === pid && (p.estado === "pendiente" || p.estado === "aceptado"));
  const pacPorSuc = Object.fromEntries(sucursales.map((s) => [s.id, pacientes.filter((p) => p.sucursalId === s.id)]));

  // Pieza dental adecuada según el tratamiento y la dentición del paciente
  const piezaPara = (pac, tr) => {
    const den = KD.denticion(pac);
    if (den === "temporal") return pick(["54", "55", "64", "65", "74", "75", "84", "85"]);
    if (tr === "t7") return pick(["18", "28", "38", "48"]);
    if (tr === "t12") return pick(["11", "12", "21", "22"]);
    return pick(["14", "15", "16", "17", "24", "25", "26", "27", "34", "35", "36", "37", "44", "45", "46", "47"]);
  };
  const recomendarPara = (pac, doc) => {
    const den = KD.denticion(pac);
    if (doc.especialidad === "Ortodoncia") return ["t13"];
    if (den !== "permanente") return [pick(["t3", "t4", "t5", "t5", "t6"])];
    return [pick(["t3", "t5", "t5", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12", "t15"])];
  };

  for (let d = -diasHist; d <= 21; d++) {
    const fecha = KD.sumarDias(hoy, d);
    const dow = KD.diaSemana(fecha);
    if (dow === 0) continue;
    for (const suc of sucursales) {
      if (dow === 6 && suc.id === "s3") continue;
      const fin = dow === 6 ? 14 * 60 : 19 * 60;
      const presentes = doctores.filter((doc) => doc.sucursales.includes(suc.id) && doc.sucursales[dow % doc.sucursales.length] === suc.id);
      if (!presentes.length) continue;
      // Cada unidad (silla) se reparte entre los doctores del día; si hay más doctores que sillas, turno de mañana y de tarde
      const tramos = [];
      for (let u = 1; u <= suc.unidades; u++) {
        if (u > presentes.length) break;
        if (presentes.length > suc.unidades && dow !== 6) {
          tramos.push({ unidad: u, doc: presentes[u - 1], ini: 9 * 60, fin: 14 * 60 });
          tramos.push({ unidad: u, doc: presentes[(u - 1 + suc.unidades) % presentes.length], ini: 14 * 60, fin });
        } else tramos.push({ unidad: u, doc: presentes[u - 1], ini: 9 * 60, fin });
      }
      for (const tramo of tramos) {
        const doc = tramo.doc;
        let t = tramo.ini + entre(0, 2) * 30;
        while (t < tramo.fin - 30) {
          const esOrto = doc.especialidad === "Ortodoncia", esEndo = doc.especialidad === "Endodoncia";
          const tipo = esOrto ? (r() < 0.75 ? "c4" : pick(["c1", "c3"])) : doc.puesto === "higienista" ? pick(["c2", "c3"]) : pick(["c1", "c1", "c2", "c3", "c3", "c3", "c5"]);
          // Los meses más viejos tienen menos citas registradas (la clínica fue creciendo)
          if (d < -120 && r() < 0.7) { t += 60; continue; }
          const pac = r() < 0.85 ? pick(pacPorSuc[suc.id]) : pick(pacientes);
          // Qué se le va a hacer: del plan pendiente del paciente o un tratamiento acorde al doctor
          let tratamientoId = "", piezas = "", planId = null;
          if (tipo === "c3" || tipo === "c5") {
            const pend = pendientesDe(pac.id).filter((x) => doc.puesto !== "higienista" && (esEndo ? x.tratamientoId === "t8" : esOrto ? x.tratamientoId === "t13" : x.tratamientoId !== "t13"));
            const acept = pend.find((x) => x.estado === "aceptado") || (r() < 0.5 ? pend[0] : null);
            if (acept && tipo === "c3") { tratamientoId = acept.tratamientoId; piezas = acept.pieza; planId = acept.id; }
            else {
              tratamientoId = tipo === "c5" ? pick(["t5", "t6", "t8"]) : esEndo ? "t8" : doc.puesto === "higienista" ? pick(["t3", "t15", "t4"]) : pick(["t3", "t5", "t6", "t11"]);
              if (KD.denticion(pac) !== "permanente" && !["t3", "t4", "t5", "t6"].includes(tratamientoId)) tratamientoId = "t5";
              piezas = PIEZA.includes(tratamientoId) ? piezaPara(pac, tratamientoId) : "";
            }
          } else if (tipo === "c4") tratamientoId = "t14";
          const dur = tratamientoId && tipo === "c3" ? trat(tratamientoId).duracion : tiposCita.find((x) => x.id === tipo).duracion;
          if (t + dur > tramo.fin) break;
          const fin = t + dur;
          let estado;
          if (d < 0) estado = r() < 0.86 ? "atendida" : r() < 0.55 ? "no_asistio" : "cancelada";
          else if (d === 0) estado = fin <= ahora ? (r() < 0.9 ? "atendida" : "no_asistio") : t <= ahora ? "en_sala" : r() < 0.6 ? "confirmada" : "programada";
          else estado = r() < 0.3 ? "confirmada" : "programada";
          // Algunas citas de hoy ya terminaron y el doctor no ha llenado el registro (para las alertas)
          const sinRegistro = d === 0 && estado === "atendida" && fin + 15 <= ahora && r() < 0.18;
          if (sinRegistro) estado = "en_sala";
          const cita = { id: `ci${citas.length + 1}`, pacienteId: pac.id, doctorId: doc.id, sucursalId: suc.id, unidad: tramo.unidad, fecha, hora: KD.aHora(t), duracion: dur, tipoId: tipo, estado };
          if (tratamientoId) cita.tratamientoId = tratamientoId;
          if (piezas) cita.piezas = piezas;
          if (planId) cita.planId = planId;
          // Las canceladas llevan motivo; algunas se eliminaron de la agenda y solo quedan en el historial (#18, #19)
          if (estado === "cancelada") {
            const baja = { motivo: pick(KD.MOTIVOS_BAJA_CITA.slice(0, -1)), usuarioId: recepcionDe[suc.id], fecha: KD.sumarDias(fecha, -entre(0, 3)), hora: KD.aHora(entre(9, 18) * 60) };
            if (r() < 0.2) { citasEliminadas.push({ ...cita, id: `ce${citasEliminadas.length + 1}`, eliminacion: baja }); t = Math.ceil((t + dur) / 30) * 30; continue; }
            cita.cancelacion = baja;
          }
          citas.push(cita);

          if (estado === "atendida") {
            const procs = [];
            let motivo = "", diagnostico = "";
            const recomendados = [];
            if (tipo === "c1") {
              motivo = pick(["Revisión general", "Dolor en muela", "Sensibilidad dental", "Quiere blanqueamiento", "Sangrado de encías"]);
              procs.push({ tratamientoId: "t1", precio: precio("t1") });
              if (r() < 0.4) procs.push({ tratamientoId: "t2", precio: precio("t2") });
              const n = entre(esOrto ? 1 : 0, 3);
              for (let k = 0; k < n; k++) recomendados.push(...recomendarPara(pac, doc));
              diagnostico = recomendados.length ? `Se detectan ${recomendados.length} tratamiento(s) necesario(s).` : "Sin hallazgos relevantes.";
            } else if (tipo === "c4") {
              procs.push({ tratamientoId: "t14", precio: precio("t14") });
            } else if (tipo === "c2") {
              diagnostico = "Evolución favorable.";
            } else {
              const it = planId ? planes.find((x) => x.id === planId) : null;
              if (it) { it.estado = "realizado"; it.fechaEstado = fecha; procs.push({ tratamientoId: it.tratamientoId, pieza: it.pieza, precio: it.precio, planId: it.id }); }
              else procs.push(piezas ? { tratamientoId, pieza: piezas, precio: precio(tratamientoId) } : { tratamientoId, precio: precio(tratamientoId) });
              if (tipo === "c5") motivo = "Urgencia: dolor agudo";
              if (piezas) KD.odontoRealizado(pac, tratamientoId, piezas, fecha, doc.id);
            }
            const cid = `co${consultas.length + 1}`;
            const cons = { id: cid, citaId: cita.id, pacienteId: pac.id, doctorId: doc.id, sucursalId: suc.id, fecha, procedimientos: procs };
            if (motivo) cons.motivo = motivo;
            if (diagnostico) cons.diagnostico = diagnostico;
            const nota = pick(["", "", "Se dan indicaciones de higiene.", "Paciente tolera bien el procedimiento.", "Se receta analgésico por 3 días."]);
            if (nota) cons.notas = nota;
            consultas.push(cons);
            // Cobro en caja: el detalle se guarda para los últimos 45 días; lo anterior queda como cobrado
            const monto = procs.reduce((s, p) => s + p.precio, 0);
            if (d < -45) cita.cobrado = true;
            else if (d < 0 || r() < 0.7) cita.cobro = { monto, metodo: pick(["efectivo", "efectivo", "tarjeta", "tarjeta", "transferencia"]), fecha, hora: KD.aHora(Math.min(fin + 5, 20 * 60)), usuarioId: recepcionDe[suc.id] };

            const nuevos = [];
            for (const tr of recomendados) {
              const yaTiene = pendientesDe(pac.id);
              if (yaTiene.length >= 4 || (!PIEZA.includes(tr) && yaTiene.some((x) => x.tratamientoId === tr))) continue;
              const pieza = PIEZA.includes(tr) ? piezaPara(pac, tr) : "";
              if (pieza && yaTiene.some((x) => x.pieza === pieza)) continue;
              const item = { id: `pl${planes.length + 1}`, pacienteId: pac.id, doctorId: doc.id, sucursalId: suc.id, consultaId: cid, fecha, tratamientoId: tr, pieza, precio: precio(tr), estado: "pendiente", fechaEstado: fecha };
              planes.push(item); nuevos.push(item);
              if (pieza) KD.odontoIndicado(pac, tr, pieza, fecha, doc.id);
            }
            if (nuevos.length) {
              const roll = r();
              const edadDias = -d;
              const est = edadDias > 30 ? (roll < 0.1 ? "enviado" : roll < 0.38 ? "rechazado" : "aceptado")
                : roll < 0.12 && edadDias > 5 ? "rechazado" : roll < 0.55 && edadDias > 2 ? "aceptado" : edadDias < 3 && roll > 0.8 ? "borrador" : "enviado";
              const pres = {
                id: `pr${presupuestos.length + 1}`, folio: `P-${String(presupuestos.length + 1).padStart(5, "0")}`,
                pacienteId: pac.id, doctorId: doc.id, sucursalId: suc.id, fecha, items: nuevos.map((x) => x.id),
                descuento: pick([0, 0, 0, 5, 10]), formaPago: nuevos.reduce((s, x) => s + x.precio, 0) > 5000 && r() < 0.6 ? "mensualidades" : "contado",
                pagos: 1, notas: "", estado: est, fechaEstado: fecha,
              };
              if (pres.formaPago === "mensualidades") pres.pagos = pick([3, 6]);
              for (const it of nuevos) {
                it.presupuestoId = pres.id;
                if (est === "rechazado") it.estado = "rechazado";
                if (est === "aceptado") it.estado = "aceptado";
              }
              presupuestos.push(pres);
            }
          }
          t = Math.ceil((t + dur) / 30) * 30 + pick([0, 0, 30, 30, 60, 90]); // siempre empiezan a las :00 o :30
        }
      }
    }
  }

  // La bitácora del odontograma de la demo conserva solo los últimos 4 meses (espacio de almacenamiento)
  const corteLog = KD.sumarDias(hoy, -120);
  for (const p of pacientes) if (p.odonto) p.odonto.log = p.odonto.log.filter((e) => e.fecha >= corteLog);

  // Movimientos de caja distintos a los cobros de citas (gastos, otros ingresos)
  const movimientos = [];
  for (let d = -45; d <= 0; d++) {
    const fecha = KD.sumarDias(hoy, d);
    if (KD.diaSemana(fecha) === 0) continue;
    for (const s of sucursales) {
      const n = entre(0, 2);
      for (let k = 0; k < n; k++) {
        const [concepto, a, b] = pick([["COMPRA DE MATERIAL", 300, 2500], ["SERVICIO DE LIMPIEZA", 400, 600], ["PAPELERÍA", 80, 400], ["MANTENIMIENTO DE EQUIPO", 800, 3500], ["PAGO DE LABORATORIO", 900, 3000]]);
        movimientos.push({ id: `mv${movimientos.length + 1}`, tipo: "egreso", fecha, hora: KD.aHora(entre(10, 18) * 60), concepto, monto: Math.round(entre(a, b) / 10) * 10, metodo: pick(["efectivo", "transferencia"]), sucursalId: s.id, usuarioId: recepcionDe[s.id] });
      }
    }
  }
  const db = {
    version: 3, creado: hoy, empresa, sucursales, tratamientos, tiposCita, personal, pacientes, citas, citasEliminadas, consultas, planes, presupuestos,
    movimientos, cortes: [], productos, solicitudes: [], movInventario: [], tareas: [], seguimientoHecho: {},
    sesion: { usuarioId: "u1", sucursalId: "todas" },
  };

  // Cortes de caja de los días anteriores (el de hoy queda abierto)
  KD.db = db;
  KD.invalidar();
  for (let d = -45; d <= -1; d++) {
    const fecha = KD.sumarDias(hoy, d);
    for (const s of sucursales) {
      const rc = KD.resumenCaja(fecha, s.id);
      if (!rc.ingresos.length && !rc.egresos.length) continue;
      const fondo = 1000;
      const esperado = fondo + rc.porMetodo.efectivo - rc.egresosEfectivo;
      const dif = r() < 0.85 ? 0 : pick([-100, -50, 50, 20]);
      db.cortes.push({ id: `ct${db.cortes.length + 1}`, fecha, sucursalId: s.id, usuarioId: recepcionDe[s.id], hora: "19:10", fondo,
        porMetodo: rc.porMetodo, totalIngresos: rc.totalIngresos, totalEgresos: rc.totalEgresos, egresosEfectivo: rc.egresosEfectivo,
        esperado, contado: esperado + dif, diferencia: dif, notas: dif ? "Diferencia por redondeo en cambio." : "" });
    }
  }

  // Existencias: suficientes para la semana en unos productos, bajas o críticas en otros
  for (const s of sucursales) {
    const proy = KD.proyeccionInventario(s.id);
    for (const pr of productos) {
      const semanal = Math.max(1, Math.ceil((proy.porProducto[pr.id] || 0) * 1.3));
      pr.minimo[s.id] = Math.max(1, Math.ceil(semanal * 0.5));
      const f = pick([0.4, 0.8, 1.6, 2, 2.5, 3, 3.5]);
      pr.existencias[s.id] = Math.max(0, Math.round(semanal * f + (pr.minimo[s.id] * (f > 1 ? 1 : 0))));
    }
  }
  db.solicitudes.push(
    { id: "so1", productoId: "m8", cantidad: 2, nota: "Se terminó la resina A2 en la unidad 2.", usuarioId: "u2", sucursalId: "s1", fecha: KD.sumarDias(hoy, -1), estado: "pendiente" },
    { id: "so2", productoId: "m12", cantidad: 1, nota: "Limas del 15 al 40.", usuarioId: "u6", sucursalId: "s2", fecha: hoy, estado: "pendiente" },
  );
  return db;
}

// ---------- Almacenamiento ----------
// Las colecciones grandes se guardan en columnas (nombres de campo una sola vez) para caber
// en el límite de ~2.5 MB de Safari en iPad.
const COLUMNARES = ["pacientes", "citas", "consultas", "planes", "presupuestos"];
const PROC = ["tratamientoId", "precio", "pieza", "planId"];
function empacar(db) {
  const out = { ...db, consultas: db.consultas.map((c) => ({ ...c, procedimientos: c.procedimientos.map((x) => PROC.map((k) => x[k] ?? null)) })) };
  for (const k of COLUMNARES) {
    const cols = [...new Set(out[k].flatMap((o) => Object.keys(o)))];
    out[k] = { cols, filas: out[k].map((o) => {
      const f = cols.map((c) => (o[c] === undefined || o[c] === "" ? null : o[c]));
      while (f.length && f[f.length - 1] === null) f.pop();
      return f;
    }) };
  }
  return out;
}
function desempacar(obj) {
  for (const k of COLUMNARES) {
    const t = obj[k];
    if (!t || !t.cols) continue;
    obj[k] = t.filas.map((f) => { const o = {}; t.cols.forEach((c, i) => { if (f[i] != null) o[c] = f[i]; }); return o; });
  }
  for (const c of obj.consultas) c.procedimientos = (c.procedimientos || []).map((x) => {
    if (!Array.isArray(x)) return x;
    const o = {}; PROC.forEach((k, i) => { if (x[i] != null) o[k] = x[i]; }); return o;
  });
  return obj;
}
KD.cargar = () => {
  try {
    LLAVES_VIEJAS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { KD.db = desempacar(JSON.parse(raw)); KD.db.citasEliminadas ||= []; KD.invalidar(); return; }
  } catch (e) { /* sin almacenamiento disponible */ }
  KD.db = generarDemo();
  KD.guardar();
};
KD.guardar = () => {
  KD.invalidar();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(empacar(KD.db))); } catch (e) { /* ignorar: el prototipo sigue funcionando en memoria */ }
};
KD.tamanoGuardado = () => { try { return (localStorage.getItem(STORAGE_KEY) || "").length; } catch (e) { return 0; } };
KD.reiniciarDemo = () => {
  KD.db = generarDemo();
  KD.guardar();
};

// ---------- Índices en memoria (se reconstruyen al guardar) ----------
let IDX = null;
KD.invalidar = () => { IDX = null; };
function indices() {
  if (IDX) return IDX;
  IDX = { mapas: {}, consultaPorCita: new Map(), citasPorPac: new Map(), consultasPorPac: new Map(), planesPorPac: new Map() };
  const agrupar = (mapa, clave, x) => { if (!mapa.has(clave)) mapa.set(clave, []); mapa.get(clave).push(x); };
  for (const c of KD.db.consultas) { if (c.citaId) IDX.consultaPorCita.set(c.citaId, c); agrupar(IDX.consultasPorPac, c.pacienteId, c); }
  for (const c of KD.db.citas) agrupar(IDX.citasPorPac, c.pacienteId, c);
  for (const p of KD.db.planes) agrupar(IDX.planesPorPac, p.pacienteId, p);
  return IDX;
}

// ---------- Consultas de datos ----------
KD.byId = (col, id) => {
  const ix = indices();
  if (!ix.mapas[col]) ix.mapas[col] = new Map(KD.db[col].map((x) => [x.id, x]));
  return ix.mapas[col].get(id) || KD.db[col].find((x) => x.id === id);
};
KD.nombreSuc = (id) => (KD.byId("sucursales", id) || {}).nombre || "—";
KD.nombreTrat = (id) => (KD.byId("tratamientos", id) || {}).nombre || "—";
KD.nombrePersona = (u) => (u ? `${u.titulo ? (u.sexo === "M" ? "DR. " : "DRA. ") : ""}${u.nombre}` : "—");
KD.nombreUsuario = (id) => KD.nombrePersona(KD.byId("personal", id));
KD.colorUsuario = (id) => KD.color((KD.byId("personal", id) || {}).color);
KD.usuario = () => KD.byId("personal", KD.db.sesion.usuarioId);
KD.puede = (permiso) => (KD.usuario()?.permisos || []).includes(permiso);
KD.verDinero = () => KD.puede("dinero");
KD.esDoctor = (u = KD.usuario()) => !!KD.puesto(u?.puesto).atiende;

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
// Para pantallas que trabajan con una sola sucursal (agenda, caja, inventario)
KD.sucursalUnica = () => {
  const ids = KD.sucursalesFiltro();
  const pref = KD.db.sesion.sucursalTrabajo;
  return ids.length === 1 ? ids[0] : ids.includes(pref) ? pref : ids[0];
};
KD.unidades = (sucId) => {
  const n = Math.max(1, Number((KD.byId("sucursales", sucId) || {}).unidades) || 1);
  return Array.from({ length: n }, (_, i) => i + 1);
};
KD.doctores = (sucIds) => KD.db.personal.filter((u) => u.activo && KD.puesto(u.puesto).atiende && (!sucIds || u.sucursales.some((s) => sucIds.includes(s))));

KD.consultaDeCita = (citaId) => indices().consultaPorCita.get(citaId);
KD.citasPaciente = (pid) => indices().citasPorPac.get(pid) || [];
KD.citasEliminadasPaciente = (pid) => (KD.db.citasEliminadas || []).filter((c) => c.pacienteId === pid);
KD.consultasPaciente = (pid) => indices().consultasPorPac.get(pid) || [];
KD.planesPaciente = (pid) => indices().planesPorPac.get(pid) || [];
KD.totalConsulta = (c) => c.procedimientos.reduce((s, p) => s + (p.precio || 0), 0);
KD.pendientePaciente = (pid) => KD.planesPaciente(pid).filter((p) => p.estado === "pendiente" || p.estado === "aceptado");
KD.ultimaVisita = (pid) => KD.citasPaciente(pid).reduce((u, c) => (c.estado === "atendida" && c.fecha > u ? c.fecha : u), "");
KD.proximaCita = (pid) => {
  const hoy = KD.hoy();
  return KD.citasPaciente(pid).filter((c) => c.fecha >= hoy && ["programada", "confirmada", "en_sala"].includes(c.estado))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0];
};
KD.siguienteExpediente = () => {
  const max = KD.db.pacientes.reduce((m, p) => Math.max(m, Number(p.expediente.split("-")[1]) || 0), 0);
  return `KD-${String(max + 1).padStart(5, "0")}`;
};
KD.tratamientoCita = (c) => c.tratamientoId ? KD.nombreTrat(c.tratamientoId) : (KD.byId("tiposCita", c.tipoId) || {}).nombre || "";
KD.finCita = (c) => KD.aMinutos(c.hora) + c.duracion;

// Progreso del plan: tratamientos realizados contra presupuestados (sin contar los rechazados)
KD.progresoPaciente = (pid) => {
  const items = KD.planesPaciente(pid).filter((x) => x.estado !== "rechazado");
  const hechos = items.filter((x) => x.estado === "realizado");
  return { total: items.length, hechos: hechos.length, pct: items.length ? hechos.length / items.length : 0,
    montoTotal: items.reduce((s, x) => s + x.precio, 0), montoHecho: hechos.reduce((s, x) => s + x.precio, 0) };
};

// ---------- Presupuestos ----------
KD.ESTADOS_PRES = { borrador: "Borrador", enviado: "Enviado", aceptado: "Aceptado", en_tratamiento: "En tratamiento", completado: "Completado", rechazado: "Rechazado" };
KD.itemsPresupuesto = (pr) => pr.items.map((id) => KD.byId("planes", id)).filter(Boolean);
KD.estadoPresupuesto = (pr) => {
  if (pr.estado === "rechazado" || pr.estado === "borrador") return pr.estado;
  const items = KD.itemsPresupuesto(pr).filter((x) => x.estado !== "rechazado");
  if (items.length && items.every((x) => x.estado === "realizado")) return "completado";
  if (items.some((x) => x.estado === "realizado")) return "en_tratamiento";
  return pr.estado;
};
KD.subtotalPresupuesto = (pr) => KD.itemsPresupuesto(pr).reduce((s, x) => s + x.precio * (x.cantidad || 1), 0);
KD.totalPresupuesto = (pr) => Math.round(KD.subtotalPresupuesto(pr) * (1 - (pr.descuento || 0) / 100));

// ---------- Registro de consulta (reglas del Issue #8 y #10) ----------
const ESTADOS_ACTIVOS = ["programada", "confirmada", "en_sala", "atendida"];
// Cita de hoy del usuario con ese paciente que todavía no tiene registro: solo quien atiende puede registrar.
KD.citaParaRegistrar = (pacienteId, u = KD.usuario()) => {
  if (!u?.permisos.includes("historial_editar")) return null;
  const hoy = KD.hoy();
  return KD.citasPaciente(pacienteId).find((c) => c.fecha === hoy && c.doctorId === u.id && ESTADOS_ACTIVOS.includes(c.estado) && !KD.consultaDeCita(c.id)) || null;
};
KD.puedeRegistrar = (cita, u = KD.usuario()) =>
  !!u?.permisos.includes("historial_editar") && cita.doctorId === u.id && cita.fecha <= KD.hoy() && ESTADOS_ACTIVOS.includes(cita.estado) && !KD.consultaDeCita(cita.id);
// Citas ya terminadas (+15 min) sin registro del doctor
KD.registrosPendientes = (doctorId) => {
  const hoy = KD.hoy(), ahora = KD.ahoraMin(), desde = KD.sumarDias(hoy, -7);
  return KD.db.citas.filter((c) => c.doctorId === doctorId && c.fecha >= desde && c.fecha <= hoy &&
    ESTADOS_ACTIVOS.includes(c.estado) && (c.fecha < hoy || KD.finCita(c) + 15 <= ahora) && !KD.consultaDeCita(c.id))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
};

// ---------- Caja ----------
KD.METODOS = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };
KD.montoCita = (c) => { const co = KD.consultaDeCita(c.id); return co ? KD.totalConsulta(co) : 0; };
// Citas atendidas con registro del doctor que aún no se cobran
KD.porCobrar = (sucIds) => KD.db.citas.filter((c) => sucIds.includes(c.sucursalId) && !c.cobro && !c.cobrado &&
  c.fecha >= KD.sumarDias(KD.hoy(), -45) && c.fecha <= KD.hoy() && (c.estado === "atendida" || KD.consultaDeCita(c.id)) && KD.montoCita(c) > 0)
  .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
// Citas que ya terminaron pero el doctor no ha registrado: la recepción no puede cobrar todavía
KD.esperandoRegistro = (sucIds) => {
  const hoy = KD.hoy(), ahora = KD.ahoraMin();
  return KD.db.citas.filter((c) => sucIds.includes(c.sucursalId) && c.fecha === hoy && ["en_sala", "atendida", "confirmada"].includes(c.estado) &&
    KD.finCita(c) <= ahora && !KD.consultaDeCita(c.id));
};
KD.resumenCaja = (fecha, sucId) => {
  const cobros = KD.db.citas.filter((c) => c.cobro && c.cobro.fecha === fecha && c.sucursalId === sucId).map((c) => ({
    id: c.id, tipo: "ingreso", fecha, hora: c.cobro.hora, concepto: KD.tratamientoCita(c), pacienteId: c.pacienteId,
    monto: c.cobro.monto, metodo: c.cobro.metodo, usuarioId: c.cobro.usuarioId, citaId: c.id,
  }));
  const movs = KD.db.movimientos.filter((m) => m.fecha === fecha && m.sucursalId === sucId);
  const ingresos = [...cobros, ...movs.filter((m) => m.tipo === "ingreso")];
  const egresos = movs.filter((m) => m.tipo === "egreso");
  const porMetodo = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const i of ingresos) porMetodo[i.metodo] = (porMetodo[i.metodo] || 0) + i.monto;
  const suma = (arr) => arr.reduce((s, x) => s + x.monto, 0);
  return {
    ingresos, egresos, porMetodo, totalIngresos: suma(ingresos), totalEgresos: suma(egresos),
    egresosEfectivo: suma(egresos.filter((e) => e.metodo === "efectivo")),
    corte: KD.db.cortes.find((c) => c.fecha === fecha && c.sucursalId === sucId),
    movimientos: [...ingresos, ...egresos].sort((a, b) => b.hora.localeCompare(a.hora)),
  };
};

// ---------- Inventario ----------
KD.consumoCita = (c) => {
  const out = { ...CONSUMO_BASE };
  const t = c.tratamientoId ? KD.byId("tratamientos", c.tratamientoId) : null;
  const n = c.piezas ? String(c.piezas).split(",").filter((x) => x.trim()).length || 1 : 1;
  if (t) for (const [m, q] of Object.entries(t.materiales || {})) out[m] = (out[m] || 0) + q * n;
  return out;
};
// Ciclo de revisión: de miércoles a martes. Nunca se proyecta más de una semana,
// porque las citas más lejanas se pueden cancelar.
KD.cicloInventario = (hoy = KD.hoy()) => {
  const desde = KD.sumarDias(hoy, -((KD.diaSemana(hoy) + 4) % 7)); // miércoles más reciente
  return {
    actual: { desde, hasta: KD.sumarDias(desde, 6) },
    siguiente: { desde: KD.sumarDias(desde, 7), hasta: KD.sumarDias(desde, 13) },
    esMiercoles: KD.diaSemana(hoy) === 3,
  };
};
// Material que consumirán las citas pendientes de una semana
KD.proyeccionInventario = (sucId, semana) => {
  const hoy = KD.hoy(), ahora = KD.ahoraMin();
  const { desde, hasta } = semana || { desde: KD.sumarDias(hoy, 1), hasta: KD.sumarDias(hoy, 7) };
  const citas = KD.db.citas.filter((c) => c.sucursalId === sucId && c.fecha >= desde && c.fecha <= hasta && c.fecha >= hoy &&
    ["programada", "confirmada", "en_sala"].includes(c.estado) && (c.fecha > hoy || KD.aMinutos(c.hora) >= ahora - 60));
  const porProducto = {};
  for (const c of citas) for (const [m, q] of Object.entries(KD.consumoCita(c))) porProducto[m] = (porProducto[m] || 0) + q;
  return { desde, hasta, citas: citas.length, porProducto };
};
KD.estadoStock = (pr, sucId) => {
  const ex = pr.existencias[sucId] || 0, mi = pr.minimo[sucId] || 0;
  return ex <= mi * 0.6 ? "critico" : ex <= mi ? "bajo" : "ok";
};
// Al registrar una consulta se descuenta del inventario el material usado
KD.descontarConsulta = (co) => {
  const total = { ...CONSUMO_BASE };
  for (const pr of co.procedimientos) {
    const t = KD.byId("tratamientos", pr.tratamientoId);
    const n = Math.max(1, KD.listaPiezas ? KD.listaPiezas(pr.pieza).length : 1);
    for (const [m, q] of Object.entries(t?.materiales || {})) total[m] = (total[m] || 0) + q * n;
  }
  for (const [m, q] of Object.entries(total)) {
    const prod = KD.byId("productos", m);
    if (prod) prod.existencias[co.sucursalId] = Math.max(0, Math.round(((prod.existencias[co.sucursalId] || 0) - q) * 100) / 100);
  }
};

// ---------- Avisos (campana) ----------
KD.notificaciones = () => {
  const u = KD.usuario();
  const sucIds = KD.sucursalesFiltro();
  const out = [];
  if (KD.esDoctor(u) && KD.puede("historial_editar")) {
    for (const c of KD.registrosPendientes(u.id)) {
      const p = KD.byId("pacientes", c.pacienteId);
      out.push({ tipo: "bad", icono: "alerta", titulo: `Falta el registro de ${p?.nombre}`, texto: `Cita ${c.fecha === KD.hoy() ? "de hoy" : KD.fmtFecha(c.fecha)} a las ${c.hora}. Llénalo o marca que no asistió.`, href: `#/pacientes/${c.pacienteId}` });
    }
    const hoy = KD.hoy();
    const nuevos = new Set(KD.db.citas.filter((c) => c.doctorId === u.id && c.fecha >= hoy && ESTADOS_ACTIVOS.includes(c.estado)).map((c) => c.pacienteId));
    for (const pid of nuevos) {
      const p = KD.byId("pacientes", pid);
      if (p && p.datosClinicos === false) out.push({ tipo: "warn", icono: "pacientes", titulo: `Paciente nuevo: ${p.nombre}`, texto: "Recepción lo dio de alta. Completa alergias y antecedentes médicos.", href: `#/pacientes/${pid}` });
    }
  }
  if (KD.puede("cobrar")) {
    const pend = KD.porCobrar(sucIds).filter((c) => c.fecha === KD.hoy());
    if (pend.length) out.push({ tipo: "warn", icono: "caja", titulo: `${pend.length} paciente(s) por cobrar hoy`, texto: "Citas atendidas con el registro del doctor listo.", href: "#/caja" });
  }
  if (KD.puede("inventario")) {
    const sol = KD.db.solicitudes.filter((s) => s.estado === "pendiente" && sucIds.includes(s.sucursalId));
    if (sol.length) out.push({ tipo: "info", icono: "inventario", titulo: `${sol.length} solicitud(es) de material`, texto: "Pedidas por el personal clínico.", href: "#/inventario/solicitudes" });
    const crit = KD.db.productos.filter((p) => p.activo && sucIds.some((s) => KD.estadoStock(p, s) === "critico"));
    if (crit.length) out.push({ tipo: "bad", icono: "inventario", titulo: `${crit.length} producto(s) en stock crítico`, texto: crit.slice(0, 3).map((p) => p.nombre).join(", "), href: "#/inventario" });
  }
  return out;
};

// Motivos para cancelar o eliminar una cita (#18). "Otro" pide escribirlo.
KD.MOTIVOS_BAJA_CITA = ["El paciente canceló", "El paciente reagendará", "Reagendada por la clínica", "El doctor no está disponible", "Error de captura", "Otro"];
KD.ESTADOS_CITA = {
  programada: "Por confirmar", confirmada: "Confirmada", en_sala: "En sala de espera",
  atendida: "Atendida", no_asistio: "No asistió", cancelada: "Cancelada",
};
KD.ESTADOS_PLAN = { pendiente: "Pendiente", aceptado: "Aceptado", realizado: "Realizado", rechazado: "Rechazado" };
