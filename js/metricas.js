// Cálculo de métricas: reportes, rankings y centro de seguimiento.
window.KD = window.KD || {};

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Periodo actual (hasta hoy) y el mismo tramo del periodo anterior, para comparar
KD.periodoReporte = (tipo, hoy = KD.hoy()) => {
  const [y, m] = hoy.split("-").map(Number);
  let desde, fin, prevDesde;
  if (tipo === "semana") { desde = KD.inicioSemana(hoy); fin = KD.sumarDias(desde, 6); prevDesde = KD.sumarDias(desde, -7); }
  else if (tipo === "mes") {
    desde = `${y}-${pad2(m)}-01`; fin = KD.fechaISO(new Date(y, m, 0));
    prevDesde = KD.fechaISO(new Date(y, m - 2, 1));
  } else if (tipo === "trimestre") {
    const q = Math.floor((m - 1) / 3);
    desde = `${y}-${pad2(q * 3 + 1)}-01`; fin = KD.fechaISO(new Date(y, q * 3 + 3, 0));
    prevDesde = KD.fechaISO(new Date(y, q * 3 - 3, 1));
  } else { desde = `${y}-01-01`; fin = `${y}-12-31`; prevDesde = `${y - 1}-01-01`; }
  const transcurridos = KD.diasEntre(desde, hoy) + 1;
  return { tipo, desde, hasta: hoy, fin, transcurridos, totalDias: KD.diasEntre(desde, fin) + 1,
    prevDesde, prevHasta: KD.sumarDias(prevDesde, transcurridos - 1) };
};
function pad2(n) { return String(n).padStart(2, "0"); }

// Cubetas para la gráfica de ingresos
KD.cubetasPeriodo = (per) => {
  const out = [];
  if (per.tipo === "semana") {
    for (let i = 0; i < 7; i++) { const f = KD.sumarDias(per.desde, i); out.push({ etq: DIAS_CORTOS[i], desde: f, hasta: f }); }
  } else if (per.tipo === "anio") {
    const y = per.desde.slice(0, 4);
    for (let i = 0; i < 12; i++) out.push({ etq: MESES_CORTOS[i], desde: `${y}-${pad2(i + 1)}-01`, hasta: KD.fechaISO(new Date(Number(y), i + 1, 0)) });
  } else {
    let f = per.desde, n = 1;
    while (f <= per.fin) {
      const h = KD.sumarDias(f, 6) > per.fin ? per.fin : KD.sumarDias(f, 6);
      out.push({ etq: `S${n}`, desde: f, hasta: h, tip: `Semana del ${KD.fmtFecha(f, { day: "numeric", month: "short" })} al ${KD.fmtFecha(h, { day: "numeric", month: "short" })}` });
      f = KD.sumarDias(h, 1); n++;
    }
  }
  return out;
};

const consultasEn = (desde, hasta, sucIds) => KD.db.consultas.filter((c) => c.fecha >= desde && c.fecha <= hasta && sucIds.includes(c.sucursalId));

KD.reporte = (tipo, sucIds, doctorId = "") => {
  const per = KD.periodoReporte(tipo);
  const filtro = (arr) => (doctorId ? arr.filter((c) => c.doctorId === doctorId) : arr);
  const cons = filtro(consultasEn(per.desde, per.hasta, sucIds));
  const prev = filtro(consultasEn(per.prevDesde, per.prevHasta, sucIds));
  const ventas = (arr) => arr.reduce((s, c) => s + KD.totalConsulta(c), 0);
  const conVenta = (arr) => arr.filter((c) => KD.totalConsulta(c) > 0).length;
  const v = ventas(cons), vp = ventas(prev);
  const pacientes = new Set(cons.map((c) => c.pacienteId)).size;
  const pacPrev = new Set(prev.map((c) => c.pacienteId)).size;
  const nuevos = cons.filter((c) => c.procedimientos.some((p) => p.tratamientoId === "t1")).length;
  const ticket = conVenta(cons) ? v / conVenta(cons) : 0;
  const ticketPrev = conVenta(prev) ? vp / conVenta(prev) : 0;
  // Proyección: ritmo diario actual por los días que faltan del periodo
  const proyeccion = per.transcurridos ? Math.round((v / per.transcurridos) * per.totalDias) : 0;

  const cubetas = KD.cubetasPeriodo(per).map((b) => {
    const val = ventas(cons.filter((c) => c.fecha >= b.desde && c.fecha <= b.hasta));
    return { ...b, valor: val, destacado: KD.hoy() >= b.desde && KD.hoy() <= b.hasta };
  });

  const porCat = {};
  for (const c of cons) for (const p of c.procedimientos) {
    const cat = (KD.byId("tratamientos", p.tratamientoId) || {}).categoria || "Otro";
    porCat[cat] = (porCat[cat] || 0) + (p.precio || 0);
  }
  const cats = Object.entries(porCat).map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor);
  const categorias = cats.length > 5 ? [...cats.slice(0, 4), { nombre: "Otras", valor: cats.slice(4).reduce((s, x) => s + x.valor, 0), color: "var(--serie-otras)" }] : cats;

  // Estado de los tratamientos diagnosticados en el periodo
  const hoy = KD.hoy();
  const items = KD.db.planes.filter((x) => x.fecha >= per.desde && x.fecha <= per.hasta && sucIds.includes(x.sucursalId) && (!doctorId || x.doctorId === doctorId));
  const conCita = new Set(KD.db.citas.filter((c) => c.planId && c.fecha >= hoy && ["programada", "confirmada", "en_sala"].includes(c.estado)).map((c) => c.planId));
  const estados = { terminados: 0, activos: 0, nuevos: 0, diagnosticados: 0 };
  for (const x of items) {
    if (x.estado === "realizado") estados.terminados++;
    else if (x.estado === "aceptado") {
      const pr = x.presupuestoId ? KD.byId("presupuestos", x.presupuestoId) : null;
      if (conCita.has(x.id) || (pr && KD.estadoPresupuesto(pr) === "en_tratamiento")) estados.activos++; else estados.nuevos++;
    } else if (x.estado === "pendiente") estados.diagnosticados++;
  }

  return { per, ventas: v, ventasPrev: vp, pacientes, pacPrev, nuevos, ticket, ticketPrev, proyeccion, consultas: cons.length, cubetas, categorias, estados };
};

// Rankings de tratamientos, doctores y sucursales en un rango de fechas
KD.metricas = ({ desde, hasta = KD.hoy(), sucIds }) => {
  const consultas = consultasEn(desde, hasta, sucIds);
  const planes = KD.db.planes.filter((p) => p.fecha >= desde && p.fecha <= hasta && sucIds.includes(p.sucursalId));
  const porTrat = {};
  let ingresos = 0;
  for (const c of consultas) for (const p of c.procedimientos) {
    const t = (porTrat[p.tratamientoId] ||= { id: p.tratamientoId, cantidad: 0, ingresos: 0 });
    t.cantidad++; t.ingresos += p.precio || 0; ingresos += p.precio || 0;
  }
  const porDoc = {};
  const doc = (id) => (porDoc[id] ||= { id, consultas: 0, pacientes: new Set(), ingresos: 0, presupuestado: 0, decididos: 0, aceptados: 0 });
  for (const c of consultas) { const d = doc(c.doctorId); d.consultas++; d.pacientes.add(c.pacienteId); d.ingresos += KD.totalConsulta(c); }
  for (const p of planes) {
    const d = doc(p.doctorId);
    d.presupuestado += p.precio;
    if (p.estado !== "pendiente") d.decididos++;
    if (p.estado === "aceptado" || p.estado === "realizado") d.aceptados++;
  }
  const porSuc = {};
  for (const c of consultas) { const s = (porSuc[c.sucursalId] ||= { id: c.sucursalId, ingresos: 0, consultas: 0 }); s.ingresos += KD.totalConsulta(c); s.consultas++; }
  return {
    ingresos, consultas: consultas.length,
    tratamientos: Object.values(porTrat),
    doctores: Object.values(porDoc).map((d) => ({ ...d, pacientes: d.pacientes.size, tasa: d.decididos ? d.aceptados / d.decididos : null })),
    sucursales: Object.values(porSuc),
  };
};

// ---------- Centro de seguimiento ----------
const hechoReciente = (clave) => {
  const f = KD.db.seguimientoHecho?.[clave];
  return f && KD.diasEntre(f, KD.hoy()) < 30;
};
KD.seguimiento = (sucIds) => {
  const hoy = KD.hoy();
  // Presupuestos enviados que el paciente no ha respondido en una semana o más
  const presupuestos = KD.db.presupuestos.filter((p) => sucIds.includes(p.sucursalId) && KD.estadoPresupuesto(p) === "enviado" &&
    KD.diasEntre(p.fecha, hoy) >= 7 && KD.byId("pacientes", p.pacienteId)?.activo && !hechoReciente(`pres:${p.id}`))
    .map((p) => ({ clave: `pres:${p.id}`, tipo: "presupuesto", pacienteId: p.pacienteId, pres: p, dias: KD.diasEntre(p.fecha, hoy), total: KD.totalPresupuesto(p),
      titulo: KD.diasEntre(p.fecha, hoy) > 30 ? "Presupuesto por revisar" : "Presupuesto sin respuesta" }))
    .sort((a, b) => b.total - a.total);

  const sinCita = [], tratamientos = [];
  for (const p of KD.db.pacientes) {
    if (!p.activo) continue;
    const citas = KD.citasPaciente(p.id);
    if (!citas.length || !citas.some((c) => sucIds.includes(c.sucursalId))) continue;
    if (KD.proximaCita(p.id)) continue;
    const ultima = KD.ultimaVisita(p.id);
    if (!ultima) continue;
    const dias = KD.diasEntre(ultima, hoy);
    const pend = KD.pendientePaciente(p.id);
    const aceptados = pend.filter((x) => x.estado === "aceptado");
    if (aceptados.length && !hechoReciente(`trat:${p.id}`)) {
      tratamientos.push({ clave: `trat:${p.id}`, tipo: "tratamiento", pacienteId: p.id, dias, items: aceptados,
        titulo: KD.progresoPaciente(p.id).hechos ? "Continuar plan de tratamiento" : "Siguiente procedimiento" });
      continue;
    }
    if (hechoReciente(`pac:${p.id}`)) continue;
    if (pend.length && dias >= 14) sinCita.push({ clave: `pac:${p.id}`, tipo: "sin_cita", pacienteId: p.id, dias, titulo: "Agendar próxima visita" });
    else if (dias >= 150 && dias <= 400) sinCita.push({ clave: `pac:${p.id}`, tipo: "sin_cita", pacienteId: p.id, dias, titulo: "Revisión preventiva" });
  }
  sinCita.sort((a, b) => a.dias - b.dias);
  tratamientos.sort((a, b) => b.items.length - a.items.length || a.dias - b.dias);
  const tareas = (KD.db.tareas || []).filter((t) => !t.hecho && (!t.sucursalId || sucIds.includes(t.sucursalId)));
  return { presupuestos, sinCita, tratamientos, tareas, total: presupuestos.length + sinCita.length + tratamientos.length + tareas.length };
};
KD.marcarSeguimiento = (clave) => {
  KD.db.seguimientoHecho ||= {};
  KD.db.seguimientoHecho[clave] = KD.hoy();
  KD.guardar();
};
