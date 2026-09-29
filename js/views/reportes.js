// Reportes (gestión): ventas, pacientes, ticket promedio, proyección y estado de los tratamientos.
KD.vistas = KD.vistas || {};

let repFiltro = { tipo: "mes", doctor: "", metricaTrat: "ingresos" };
const PERIODOS = [["semana", "Semanal"], ["mes", "Mensual"], ["trimestre", "Trimestral"], ["anio", "Anual"]];
const NOMBRE_PER = { semana: "esta semana", mes: "este mes", trimestre: "este trimestre", anio: "este año" };
const PREV_PER = { semana: "semana anterior", mes: "mes anterior", trimestre: "trimestre anterior", anio: "año anterior" };

KD.vistas.reportes = (main) => {
  const sucIds = KD.sucursalesFiltro();
  const r = KD.reporte(repFiltro.tipo, sucIds, repFiltro.doctor);
  const m = KD.metricas({ desde: r.per.desde, sucIds });
  const pctAvance = r.proyeccion ? r.ventas / r.proyeccion : 0;
  const e = r.estados;
  const totalTrat = e.terminados + e.activos + e.nuevos + e.diagnosticados;
  const fmtK = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`);
  const etiquetaCubeta = { semana: "Ingresos por día", mes: "Ingresos por semana", trimestre: "Ingresos por semana", anio: "Ingresos por mes" }[repFiltro.tipo];
  const potencial = KD.db.planes.filter((x) => x.estado === "pendiente" && sucIds.includes(x.sucursalId) && x.fecha >= r.per.desde).reduce((s, x) => s + x.precio, 0);

  const trats = m.tratamientos.slice().sort((a, b) => b[repFiltro.metricaTrat] - a[repFiltro.metricaTrat]).slice(0, 8);
  const maxT = trats[0]?.[repFiltro.metricaTrat] || 0;
  const docs = m.doctores.filter((d) => d.consultas > 0).sort((a, b) => b.ingresos - a.ingresos);
  const maxD = docs[0]?.ingresos || 0;

  main.innerHTML = `
    ${KD.cabecera("Inteligencia operativa", "Reportes", "Entiende la salud de la clínica con métricas que ayudan a decidir.",
      `<button class="btn btn-ghost" data-exportar>${KD.icon("descargar", 16)} Exportar reporte</button>`)}
    <div class="filtros" style="justify-content:space-between">
      <div class="segmentado" role="group" aria-label="Periodo">${PERIODOS.map(([k, t]) => `<button data-tipo="${k}" class="${repFiltro.tipo === k ? "activo" : ""}">${t}</button>`).join("")}</div>
      <select data-doctor aria-label="Doctor" style="width:auto"><option value="">Todos los doctores</option>${KD.opciones(KD.doctores(sucIds).map((d) => ({ id: d.id, nombre: KD.nombrePersona(d) })), repFiltro.doctor)}</select>
    </div>
    <p class="muted" style="margin:-6px 0 14px;font-size:13px">Del ${KD.esc(KD.fmtFecha(r.per.desde))} a hoy · comparado con el mismo tramo del ${PREV_PER[repFiltro.tipo]} · ${sucIds.length > 1 ? "todas las sucursales" : `sucursal ${KD.esc(KD.nombreSuc(sucIds[0]))}`}</p>

    <div class="kpis">
      <div class="card kpi"><span class="etq">Ventas ${NOMBRE_PER[repFiltro.tipo]}</span><div class="valor">${KD.fmtDinero(r.ventas)}</div><div class="sub"><span>${KD.delta(r.ventas, r.ventasPrev) || "Sin datos previos"}</span><span>${r.consultas} consultas</span></div></div>
      <div class="card kpi"><span class="etq">Pacientes atendidos</span><div class="valor">${KD.fmtNum(r.pacientes)}</div><div class="sub"><span>${KD.delta(r.pacientes, r.pacPrev) || "Sin datos previos"}</span><span>${r.nuevos} de primera vez</span></div></div>
      <div class="card kpi"><span class="etq">Ticket promedio</span><div class="valor">${KD.fmtDinero(r.ticket)}</div><div class="sub"><span>${r.ticketPrev ? `${r.ticket >= r.ticketPrev ? "+" : "−"}${KD.fmtDinero(Math.abs(r.ticket - r.ticketPrev))} vs. ${PREV_PER[repFiltro.tipo]}` : "Por consulta con venta"}</span></div></div>
      <div class="card kpi destacado"><span class="etq">Proyección de venta al cierre</span><div class="valor">${KD.fmtDinero(r.proyeccion)}</div><div class="sub"><span>Llevas ${Math.round(pctAvance * 100)}% · día ${r.per.transcurridos} de ${r.per.totalDias}</span></div>${KD.progreso(pctAvance, "info")}</div>
    </div>

    <div class="grid grid-dash" style="margin-bottom:18px">
      <section class="card">
        <div class="card-head"><div><span class="eyebrow">Ventas</span><h2>${etiquetaCubeta}</h2><p>Tratamientos registrados como realizados. La barra oscura es el periodo actual.</p></div>${KD.badge(r.per.desde.slice(0, 4), "info")}</div>
        <div class="card-body">${KD.graficaBarras(r.cubetas.map((b) => ({ etq: b.etq, valor: b.valor, destacado: b.destacado, tip: `${b.tip || b.etq}: ${KD.fmtDinero(b.valor)}` })), { fmt: fmtK, alto: 470 })}</div>
      </section>
      <div class="apilado">
        <section class="card">
          <div class="card-head"><div><span class="eyebrow">Mezcla de tratamientos</span><h2>Ventas por categoría</h2></div></div>
          <div class="card-body">${KD.graficaDona(r.categorias, { centro: fmtK(r.ventas), sub: "ventas", fmt: KD.fmtDinero })}</div>
        </section>
        <section class="card">
          <div class="card-head"><div><span class="eyebrow">Tratamientos diagnosticados ${NOMBRE_PER[repFiltro.tipo]}</span><h2>Estado de los tratamientos</h2><p>${totalTrat} tratamientos presupuestados en el periodo.</p></div></div>
          <div class="card-body">${KD.graficaHorizontal([
            { nombre: "Terminados", sub: "Ya realizados", valor: e.terminados },
            { nombre: "Activos en proceso", sub: "Aceptados y en curso", valor: e.activos },
            { nombre: "Nuevos", sub: "Aceptados sin iniciar", valor: e.nuevos },
            { nombre: "Diagnosticados", sub: "Presupuestados sin atender", valor: e.diagnosticados },
          ].map((x, i) => ({ ...x, color: ["var(--serie-3)", "var(--serie-1)", "var(--serie-2)", "var(--serie-4)"][i], tip: `${x.nombre}: ${x.valor} (${totalTrat ? Math.round((x.valor / totalTrat) * 100) : 0}%)` })))}</div>
        </section>
      </div>
    </div>

    <div class="banner warn">
      <div style="display:flex;gap:14px;align-items:center"><span class="kpi-ico warn">${KD.icon("chispa", 18)}</span>
        <div><span class="eyebrow">Lectura del periodo</span><h2 style="font-size:16px">${e.diagnosticados ? `Tu mayor oportunidad está en ${e.diagnosticados} tratamientos diagnosticados sin atender.` : "Todos los tratamientos diagnosticados ya tienen respuesta."}</h2>
        <p>${e.diagnosticados ? `Representan ${KD.fmtDinero(potencial)} en presupuestos pendientes de respuesta. ` : ""}${e.nuevos ? `${e.nuevos} tratamientos aceptados aún no inician: agéndalos.` : ""}</p></div></div>
      <a class="btn btn-ghost btn-sm" href="#/seguimiento">Ver seguimiento ${KD.icon("der", 14)}</a>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><div><span class="eyebrow">Ranking</span><h2>Tratamientos más vendidos</h2></div>
          <div class="segmentado" role="group" aria-label="Ordenar por"><button data-mt="ingresos" class="${repFiltro.metricaTrat === "ingresos" ? "activo" : ""}">Ingresos</button><button data-mt="cantidad" class="${repFiltro.metricaTrat === "cantidad" ? "activo" : ""}">Cantidad</button></div></div>
        <div class="card-body flush">${trats.length ? trats.map((t, i) => `<div class="ranking-fila"><span class="pos">${i + 1}</span>
          <span class="nombre">${KD.esc(KD.nombreTrat(t.id))}<small>${t.cantidad} realizados · ${KD.fmtDinero(t.ingresos)}</small></span>
          ${KD.barra(t[repFiltro.metricaTrat], maxT, KD.nombreTrat(t.id))}<span class="num">${repFiltro.metricaTrat === "ingresos" ? KD.fmtDinero(t.ingresos) : t.cantidad}</span></div>`).join("") : KD.vacio("Sin ventas en este periodo.")}</div>
      </section>
      <section class="card">
        <div class="card-head"><div><span class="eyebrow">Ranking</span><h2>Doctores</h2><p>Ventas y % de aceptación de sus presupuestos.</p></div></div>
        <div class="card-body flush">${docs.length ? docs.map((d, i) => { const u = KD.byId("personal", d.id); return `<div class="ranking-fila"><span class="pos">${i + 1}</span>
          <span class="nombre">${KD.esc(KD.nombrePersona(u))}<small>${d.pacientes} pacientes · aceptación ${d.tasa == null ? "—" : `${Math.round(d.tasa * 100)}%`}</small></span>
          ${KD.barra(d.ingresos, maxD, KD.fmtDinero(d.ingresos))}<span class="num">${KD.fmtDinero(d.ingresos)}</span></div>`; }).join("") : KD.vacio("Sin datos en este periodo.")}</div>
      </section>
      ${sucIds.length > 1 ? `<section class="card span-2">
        <div class="card-head"><div><span class="eyebrow">Ranking</span><h2>Ventas por sucursal</h2></div></div>
        <div class="card-body flush">${m.sucursales.sort((a, b) => b.ingresos - a.ingresos).map((s, i, arr) => `<div class="ranking-fila"><span class="pos">${i + 1}</span>
          <span class="nombre">${KD.esc(KD.nombreSuc(s.id))}<small>${s.consultas} consultas</small></span>${KD.barra(s.ingresos, arr[0].ingresos, KD.fmtDinero(s.ingresos))}<span class="num">${KD.fmtDinero(s.ingresos)}</span></div>`).join("")}</div>
      </section>` : ""}
    </div>`;

  const re = () => KD.vistas.reportes(main);
  main.querySelectorAll("[data-tipo]").forEach((b) => b.addEventListener("click", () => { repFiltro.tipo = b.dataset.tipo; re(); }));
  main.querySelectorAll("[data-mt]").forEach((b) => b.addEventListener("click", () => { repFiltro.metricaTrat = b.dataset.mt; re(); }));
  main.querySelector("[data-doctor]").addEventListener("change", (ev) => { repFiltro.doctor = ev.target.value; re(); });
  main.querySelector("[data-exportar]").addEventListener("click", () => {
    KD.descargarCSV(`reporte-${repFiltro.tipo}-${KD.hoy()}.csv`, [
      ["Reporte", PERIODOS.find(([k]) => k === repFiltro.tipo)[1], "Desde", r.per.desde, "Hasta", r.per.hasta],
      [], ["Indicador", "Valor"], ["Ventas", r.ventas], ["Pacientes atendidos", r.pacientes], ["Pacientes de primera vez", r.nuevos], ["Ticket promedio", Math.round(r.ticket)], ["Proyección de venta", r.proyeccion],
      [], ["Periodo", "Ventas"], ...r.cubetas.map((b) => [b.tip || b.etq, b.valor]),
      [], ["Categoría", "Ventas"], ...r.categorias.map((c) => [c.nombre, c.valor]),
      [], ["Estado de tratamientos", "Cantidad"], ["Terminados", e.terminados], ["Activos en proceso", e.activos], ["Nuevos", e.nuevos], ["Diagnosticados", e.diagnosticados],
    ]);
    KD.toast("Reporte exportado");
  });
};
