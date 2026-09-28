// Estadísticas: rankings de tratamientos, doctores y sucursales.
KD.vistas = KD.vistas || {};

let estFiltro = { dias: 30, metricaTrat: "ingresos" };

KD.vistas.estadisticas = (main) => {
  const sucIds = KD.sucursalesFiltro();
  const desde = KD.sumarDias(KD.hoy(), -estFiltro.dias + 1);
  const m = KD.metricas({ desde, sucIds });
  const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);

  const trats = m.tratamientos.slice().sort((a, b) => b[estFiltro.metricaTrat] - a[estFiltro.metricaTrat]);
  const maxT = trats[0]?.[estFiltro.metricaTrat] || 0;
  const docs = m.doctores.filter((d) => d.consultas > 0).sort((a, b) => b.ingresos - a.ingresos);
  const maxD = docs[0]?.ingresos || 0;
  const sucs = m.sucursales.slice().sort((a, b) => b.ingresos - a.ingresos);
  const maxS = sucs[0]?.ingresos || 0;
  const fmtT = (t) => (estFiltro.metricaTrat === "ingresos" ? KD.fmtDinero(t.ingresos) : `${t.cantidad}`);

  // Ranking por categoría
  const porCat = {};
  for (const t of m.tratamientos) {
    const cat = (KD.byId("tratamientos", t.id) || {}).categoria || "Otro";
    porCat[cat] = (porCat[cat] || 0) + t.ingresos;
  }
  const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Estadísticas</h1><p>${sucIds.length > 1 ? "Todas las sucursales" : "Sucursal " + KD.esc(KD.nombreSuc(sucIds[0]))} · del ${KD.esc(KD.fmtFecha(desde))} a hoy</p></div>
      <div class="segmentado" role="group" aria-label="Periodo">
        ${[[7, "7 días"], [30, "30 días"], [90, "90 días"]].map(([d, t]) => `<button data-dias="${d}" class="${estFiltro.dias === d ? "activo" : ""}">${t}</button>`).join("")}
      </div>
    </div>

    <div class="kpis">
      <div class="card kpi"><div class="etq">Ventas</div><div class="valor">${KD.fmtDinero(m.ingresos)}</div><div class="sub">Tratamientos realizados</div></div>
      <div class="card kpi"><div class="etq">Consultas</div><div class="valor">${m.consultas}</div><div class="sub">${m.consultas ? KD.fmtDinero(m.ingresos / m.consultas) : "—"} promedio por consulta</div></div>
      <div class="card kpi"><div class="etq">Pacientes atendidos</div><div class="valor">${m.pacientesAtendidos}</div><div class="sub">${m.nuevos} de primera vez</div></div>
      <div class="card kpi"><div class="etq">Inasistencia</div><div class="valor">${pct(m.tasaInasistencia)}</div><div class="sub">Citas en las que el paciente no llegó</div></div>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head">
          <div><h2>Ranking de tratamientos</h2><p>Los más vendidos en el periodo</p></div>
          <div class="segmentado" role="group" aria-label="Ordenar por">
            <button data-mt="ingresos" class="${estFiltro.metricaTrat === "ingresos" ? "activo" : ""}">Ingresos</button>
            <button data-mt="cantidad" class="${estFiltro.metricaTrat === "cantidad" ? "activo" : ""}">Cantidad</button>
          </div>
        </div>
        <div class="card-body flush">${trats.length ? trats.map((t, i) => `
          <div class="ranking-fila">
            <span class="pos">${i + 1}</span>
            <span class="nombre">${KD.esc(KD.nombreTrat(t.id))}<small>${t.cantidad} realizados · ${KD.fmtDinero(t.ingresos)}</small></span>
            ${KD.barra(t[estFiltro.metricaTrat], maxT, `${KD.nombreTrat(t.id)}: ${fmtT(t)}`)}
            <span class="num">${fmtT(t)}</span>
          </div>`).join("") : KD.vacio("Sin datos en este periodo.")}
        </div>
      </section>

      <div class="grid" style="align-content:start">
        ${sucIds.length > 1 ? `<section class="card">
          <div class="card-head"><div><h2>Ventas por sucursal</h2><p>Ranking de unidades</p></div></div>
          <div class="card-body flush">${sucs.map((s, i) => `
            <div class="ranking-fila">
              <span class="pos">${i + 1}</span>
              <span class="nombre">${KD.esc(KD.nombreSuc(s.id))}<small>${s.consultas} consultas</small></span>
              ${KD.barra(s.ingresos, maxS, `${KD.nombreSuc(s.id)}: ${KD.fmtDinero(s.ingresos)}`)}
              <span class="num">${KD.fmtDinero(s.ingresos)}</span>
            </div>`).join("")}</div>
        </section>` : ""}
        <section class="card">
          <div class="card-head"><div><h2>Ventas por área</h2><p>Categorías de tratamiento</p></div></div>
          <div class="card-body flush">${cats.length ? cats.map(([c, v], i) => `
            <div class="ranking-fila">
              <span class="pos">${i + 1}</span>
              <span class="nombre">${KD.esc(c)}</span>
              ${KD.barra(v, cats[0][1], `${c}: ${KD.fmtDinero(v)}`)}
              <span class="num">${KD.fmtDinero(v)}</span>
            </div>`).join("") : KD.vacio("Sin datos en este periodo.")}</div>
        </section>
      </div>

      <section class="card span-2">
        <div class="card-head"><div><h2>Ranking de doctores</h2><p>Quién atiende más pacientes, quién vende más y quién convence más a los pacientes de hacerse sus tratamientos</p></div></div>
        <div class="tabla-wrap">${docs.length ? `<table class="responsive">
          <thead><tr><th class="pos">#</th><th>Doctor</th><th class="num">Pacientes</th><th class="num">Consultas</th><th>Ventas</th><th class="num">Presupuestado</th><th class="num" title="De los presupuestos con respuesta, cuántos aceptó el paciente">Aceptación</th></tr></thead>
          <tbody>${docs.map((d, i) => {
            const u = KD.byId("personal", d.id);
            return `<tr>
              <td class="pos" data-l="">${i + 1}</td>
              <td class="principal-celda"><strong>${KD.esc(u?.nombre)}</strong><span class="sub">${KD.esc(u?.especialidad || KD.puesto(u?.puesto).nombre)}</span></td>
              <td data-l="Pacientes" class="num">${d.pacientes}</td>
              <td data-l="Consultas" class="num">${d.consultas}</td>
              <td data-l="Ventas"><div style="display:flex;gap:10px;align-items:center;justify-content:flex-end"><span style="flex:1;max-width:160px">${KD.barra(d.ingresos, maxD, KD.fmtDinero(d.ingresos))}</span><span class="num" style="min-width:90px">${KD.fmtDinero(d.ingresos)}</span></div></td>
              <td data-l="Presupuestado" class="num">${KD.fmtDinero(d.presupuestado)}</td>
              <td data-l="Aceptación" class="num">${pct(d.tasa)}</td>
            </tr>`;
          }).join("")}</tbody></table>` : KD.vacio("Sin datos en este periodo.")}</div>
      </section>
    </div>
    <p class="muted" style="margin-top:16px;font-size:12px">"Ventas" = suma de los tratamientos registrados como realizados en las consultas. En la fase 2 se conectará con el módulo de cobros para reflejar lo efectivamente pagado.</p>`;

  main.querySelectorAll("[data-dias]").forEach((b) => b.addEventListener("click", () => { estFiltro.dias = Number(b.dataset.dias); KD.vistas.estadisticas(main); }));
  main.querySelectorAll("[data-mt]").forEach((b) => b.addEventListener("click", () => { estFiltro.metricaTrat = b.dataset.mt; KD.vistas.estadisticas(main); }));
};
