// Presupuestos: pacientes con tratamientos recomendados pendientes, ordenados por monto.
KD.vistas = KD.vistas || {};

let presFiltro = { q: "", estado: "todos" };

KD.vistas.presupuestos = (main) => {
  const sucIds = KD.sucursalesFiltro();
  const todos = KD.oportunidades(sucIds);
  const planesSuc = KD.db.planes.filter((p) => sucIds.includes(p.sucursalId));
  const decididos = planesSuc.filter((p) => p.estado !== "pendiente");
  const aceptados = decididos.filter((p) => ["aceptado", "realizado"].includes(p.estado));
  const sum = (arr) => arr.reduce((s, x) => s + x.precio, 0);
  const pendiente = sum(planesSuc.filter((p) => p.estado === "pendiente"));
  const porRealizar = sum(planesSuc.filter((p) => p.estado === "aceptado"));

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Presupuestos</h1><p>Tratamientos que los doctores recomendaron y que el paciente aún no se ha hecho. Sirve para darles seguimiento.</p></div>
    </div>
    <div class="kpis">
      <div class="card kpi"><div class="etq">Pendiente de aceptar</div><div class="valor">${KD.fmtDinero(pendiente)}</div><div class="sub">Presupuestos sin respuesta</div></div>
      <div class="card kpi"><div class="etq">Aceptado por realizar</div><div class="valor">${KD.fmtDinero(porRealizar)}</div><div class="sub">Falta agendar o terminar</div></div>
      <div class="card kpi"><div class="etq">Pacientes por contactar</div><div class="valor">${todos.length}</div><div class="sub">Con al menos un tratamiento pendiente</div></div>
      <div class="card kpi"><div class="etq">Tasa de aceptación</div><div class="valor">${decididos.length ? Math.round((aceptados.length / decididos.length) * 100) : 0}%</div><div class="sub">De los presupuestos con respuesta</div></div>
    </div>
    <div class="filtros">
      <label class="buscar">${KD.icon("buscar", 16)}<span class="sr-only">Buscar</span>
        <input type="search" placeholder="Buscar paciente" value="${KD.esc(presFiltro.q)}" data-q></label>
      <div class="segmentado" role="group" aria-label="Estado">
        <button data-estado="todos" class="${presFiltro.estado === "todos" ? "activo" : ""}">Todos</button>
        <button data-estado="pendiente" class="${presFiltro.estado === "pendiente" ? "activo" : ""}">Sin respuesta</button>
        <button data-estado="aceptado" class="${presFiltro.estado === "aceptado" ? "activo" : ""}">Aceptados por realizar</button>
      </div>
    </div>
    <div class="card"><div class="tabla-wrap" data-tabla></div></div>`;

  const pintar = () => {
    const q = presFiltro.q.toLowerCase();
    const lista = todos.map((o) => {
      const items = presFiltro.estado === "todos" ? o.items : o.items.filter((i) => i.estado === presFiltro.estado);
      return { ...o, items, total: sum(items) };
    }).filter((o) => o.items.length && (!q || KD.byId("pacientes", o.pacienteId).nombre.toLowerCase().includes(q)))
      .sort((a, b) => b.total - a.total);
    main.querySelector("[data-tabla]").innerHTML = lista.length ? `<table class="responsive">
      <thead><tr><th class="pos">#</th><th>Paciente</th><th>Tratamientos pendientes</th><th>Última recomendación</th><th class="num">Monto</th><th></th></tr></thead>
      <tbody>${lista.slice(0, 100).map((o, i) => {
        const p = KD.byId("pacientes", o.pacienteId);
        return `<tr class="clic" data-id="${p.id}">
          <td class="pos" data-l="">${i + 1}</td>
          <td class="principal-celda"><strong>${KD.esc(p.nombre)}</strong><span class="sub">${KD.esc(p.expediente)} · ${KD.esc(p.telefono)}</span></td>
          <td data-l="Tratamientos"><div class="chips">${o.items.map((it) => KD.badge(`${KD.nombreTrat(it.tratamientoId)}${it.estado === "aceptado" ? " ✓" : ""}`, it.estado === "aceptado" ? "plan-aceptado" : "")).join("")}</div></td>
          <td data-l="Última">${KD.esc(KD.fmtFecha(o.ultima))}<span class="sub">${KD.esc(KD.nombreUsuario(o.items[0].doctorId))}</span></td>
          <td data-l="Monto" class="num"><strong>${KD.fmtDinero(o.total)}</strong></td>
          <td data-l=""><a class="btn btn-ghost btn-sm" href="${KD.waLink(p.telefono)}" target="_blank" rel="noopener" data-wa>${KD.icon("whatsapp", 14)} Contactar</a></td>
        </tr>`;
      }).join("")}</tbody></table>` : KD.vacio("No hay presupuestos pendientes con estos filtros.");
    main.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", (e) => {
      if (e.target.closest("[data-wa]")) return;
      location.hash = `#/pacientes/${tr.dataset.id}/plan`;
    }));
  };
  pintar();
  main.querySelector("[data-q]").addEventListener("input", (e) => { presFiltro.q = e.target.value; pintar(); });
  main.querySelectorAll("[data-estado]").forEach((b) => b.addEventListener("click", () => { presFiltro.estado = b.dataset.estado; KD.vistas.presupuestos(main); }));
};
