// Cálculo de métricas a partir de consultas, citas y presupuestos.
window.KD = window.KD || {};

KD.metricas = ({ desde, hasta = KD.hoy(), sucIds }) => {
  const enRango = (f) => f >= desde && f <= hasta;
  const enSuc = (s) => sucIds.includes(s);
  const consultas = KD.db.consultas.filter((c) => enRango(c.fecha) && enSuc(c.sucursalId));
  const citas = KD.db.citas.filter((c) => enRango(c.fecha) && enSuc(c.sucursalId) && c.fecha <= KD.hoy());
  const planes = KD.db.planes.filter((p) => enRango(p.fecha) && enSuc(p.sucursalId));

  // Tratamientos realizados (vendidos)
  const porTrat = {};
  let ingresos = 0;
  for (const c of consultas) for (const p of c.procedimientos) {
    const t = (porTrat[p.tratamientoId] ||= { id: p.tratamientoId, cantidad: 0, ingresos: 0 });
    t.cantidad++; t.ingresos += p.precio || 0; ingresos += p.precio || 0;
  }

  // Doctores
  const porDoc = {};
  const doc = (id) => (porDoc[id] ||= { id, consultas: 0, pacientes: new Set(), ingresos: 0, presupuestado: 0, aceptado: 0, decididos: 0, aceptados: 0 });
  for (const c of consultas) {
    const d = doc(c.doctorId);
    d.consultas++; d.pacientes.add(c.pacienteId); d.ingresos += KD.totalConsulta(c);
  }
  for (const p of planes) {
    const d = doc(p.doctorId);
    d.presupuestado += p.precio;
    if (p.estado !== "pendiente") d.decididos++;
    if (p.estado === "aceptado" || p.estado === "realizado") { d.aceptados++; d.aceptado += p.precio; }
  }
  const doctores = Object.values(porDoc).map((d) => ({
    ...d, pacientes: d.pacientes.size, tasa: d.decididos ? d.aceptados / d.decididos : null,
  }));

  // Sucursales
  const porSuc = {};
  for (const c of consultas) {
    const s = (porSuc[c.sucursalId] ||= { id: c.sucursalId, ingresos: 0, consultas: 0 });
    s.ingresos += KD.totalConsulta(c); s.consultas++;
  }

  const pacientesAtendidos = new Set(consultas.map((c) => c.pacienteId)).size;
  const nuevos = consultas.filter((c) => c.procedimientos.some((p) => p.tratamientoId === "t1")).length;
  const inasist = citas.filter((c) => c.estado === "no_asistio").length;
  const conResultado = citas.filter((c) => ["atendida", "no_asistio"].includes(c.estado)).length;

  return {
    ingresos, consultas: consultas.length, pacientesAtendidos, nuevos,
    tasaInasistencia: conResultado ? inasist / conResultado : 0,
    tratamientos: Object.values(porTrat),
    doctores, sucursales: Object.values(porSuc),
  };
};

// Pacientes con tratamientos recomendados pendientes (oportunidades)
KD.oportunidades = (sucIds) => {
  const porPac = {};
  for (const p of KD.db.planes) {
    if (!(p.estado === "pendiente" || p.estado === "aceptado") || !sucIds.includes(p.sucursalId)) continue;
    const o = (porPac[p.pacienteId] ||= { pacienteId: p.pacienteId, items: [], total: 0, ultima: "" });
    o.items.push(p); o.total += p.precio;
    if (p.fecha > o.ultima) o.ultima = p.fecha;
  }
  return Object.values(porPac).filter((o) => KD.byId("pacientes", o.pacienteId)?.activo).sort((a, b) => b.total - a.total);
};
