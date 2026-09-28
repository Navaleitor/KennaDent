// Panel de inicio: resumen del día y del mes.
KD.vistas = KD.vistas || {};

KD.vistas.panel = (main) => {
  const u = KD.usuario();
  const sucIds = KD.sucursalesFiltro();
  const hoy = KD.hoy();
  const inicioMes = hoy.slice(0, 8) + "01";
  const citasHoy = KD.db.citas.filter((c) => c.fecha === hoy && sucIds.includes(c.sucursalId))
    .filter((c) => !KD.puesto(u.puesto).atiende || c.doctorId === u.id) // el doctor ve solo sus citas
    .sort((a, b) => a.hora.localeCompare(b.hora));
  const activas = citasHoy.filter((c) => c.estado !== "cancelada");
  const atendidas = citasHoy.filter((c) => c.estado === "atendida").length;
  const verNegocio = KD.puede("estadisticas");
  const m = verNegocio ? KD.metricas({ desde: inicioMes, sucIds }) : null;
  const ops = KD.puede("presupuestos") ? KD.oportunidades(sucIds) : [];
  const potencial = ops.reduce((s, o) => s + o.total, 0);
  const saludo = new Date().getHours() < 12 ? "Buenos días" : new Date().getHours() < 19 ? "Buenas tardes" : "Buenas noches";
  const sucTxt = sucIds.length > 1 ? "Todas las sucursales" : `Sucursal ${KD.nombreSuc(sucIds[0])}`;

  const top = m ? m.tratamientos.sort((a, b) => b.ingresos - a.ingresos).slice(0, 5) : [];
  const maxTop = top[0]?.ingresos || 0;

  main.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${saludo}, ${KD.esc(u.nombre.replace(/^Dra?\.\s+/, "").split(" ")[0])}</h1>
        <p>${KD.esc(KD.fmtFecha(hoy, { weekday: "long", day: "numeric", month: "long" }))} · ${KD.esc(sucTxt)}</p>
      </div>
      <div class="acciones">
        ${KD.puede("agenda_editar") ? `<a class="btn" href="#/agenda" data-nueva-cita>${KD.icon("mas", 16)} Nueva cita</a>` : ""}
        ${KD.puede("pacientes_editar") ? `<button class="btn btn-ghost" data-nuevo-paciente>${KD.icon("mas", 16)} Nuevo paciente</button>` : ""}
      </div>
    </div>

    <div class="kpis">
      <div class="card kpi"><div class="etq">Citas hoy</div><div class="valor">${activas.length}</div><div class="sub">${atendidas} atendidas</div></div>
      ${m ? `
      <div class="card kpi"><div class="etq">Ventas del mes</div><div class="valor">${KD.fmtDinero(m.ingresos)}</div><div class="sub">${m.consultas} consultas</div></div>
      <div class="card kpi"><div class="etq">Pacientes atendidos</div><div class="valor">${m.pacientesAtendidos}</div><div class="sub">${m.nuevos} de primera vez este mes</div></div>` : ""}
      ${KD.puede("presupuestos") ? `
      <div class="card kpi"><div class="etq">Presupuestos pendientes</div><div class="valor">${KD.fmtDinero(potencial)}</div><div class="sub">${ops.length} pacientes por contactar</div></div>` : ""}
    </div>

    <div class="grid grid-2">
      ${KD.puede("agenda_ver") ? `
      <section class="card">
        <div class="card-head"><div><h2>Agenda de hoy</h2><p>${activas.length} citas programadas</p></div><a href="#/agenda" class="btn btn-ghost btn-sm">Ver agenda</a></div>
        <div class="card-body flush">
          ${citasHoy.length ? `<ul class="lista">${citasHoy.slice(0, 8).map((c) => {
            const p = KD.byId("pacientes", c.pacienteId);
            return `<li>
              <span class="hora">${c.hora}</span>
              <span class="info"><strong>${KD.esc(p?.nombre)}</strong><small>${KD.esc((KD.byId("tiposCita", c.tipoId) || {}).nombre)} · ${KD.esc(KD.nombreUsuario(c.doctorId))}${sucIds.length > 1 ? " · " + KD.esc(KD.nombreSuc(c.sucursalId)) : ""}</small></span>
              ${KD.badgeEstadoCita(c.estado)}
            </li>`;
          }).join("")}</ul>${citasHoy.length > 8 ? `<div class="card-body"><a href="#/agenda">Ver las ${citasHoy.length - 8} restantes</a></div>` : ""}` : KD.vacio("No hay citas para hoy.")}
        </div>
      </section>` : ""}

      ${m ? `
      <section class="card">
        <div class="card-head"><div><h2>Tratamientos más vendidos</h2><p>Este mes, por ingresos</p></div><a href="#/estadisticas" class="btn btn-ghost btn-sm">Estadísticas</a></div>
        <div class="card-body flush">
          ${top.length ? top.map((t, i) => `
            <div class="ranking-fila">
              <span class="pos">${i + 1}</span>
              <span class="nombre">${KD.esc(KD.nombreTrat(t.id))}<small>${t.cantidad} realizados</small></span>
              ${KD.barra(t.ingresos, maxTop, KD.fmtDinero(t.ingresos))}
              <span class="num">${KD.fmtDinero(t.ingresos)}</span>
            </div>`).join("") : KD.vacio("Sin ventas registradas este mes.")}
        </div>
      </section>` : ""}

      ${KD.puede("presupuestos") ? `
      <section class="card ${m ? "span-2" : ""}">
        <div class="card-head"><div><h2>Pacientes con mayor presupuesto pendiente</h2><p>Tratamientos recomendados que aún no se realizan</p></div><a href="#/presupuestos" class="btn btn-ghost btn-sm">Ver todos</a></div>
        <div class="card-body flush tabla-wrap">
          ${ops.length ? `<table class="responsive"><thead><tr><th>Paciente</th><th>Tratamientos</th><th class="num">Monto</th></tr></thead><tbody>
            ${ops.slice(0, 5).map((o) => {
              const p = KD.byId("pacientes", o.pacienteId);
              return `<tr class="clic" data-href="#/pacientes/${p.id}/plan">
                <td class="principal-celda"><strong>${KD.esc(p.nombre)}</strong><span class="sub">${KD.esc(p.expediente)} · ${KD.esc(p.telefono)}</span></td>
                <td data-l="Tratamientos"><div class="chips">${o.items.slice(0, 3).map((it) => KD.badge(KD.nombreTrat(it.tratamientoId))).join("")}${o.items.length > 3 ? KD.badge(`+${o.items.length - 3}`) : ""}</div></td>
                <td data-l="Monto" class="num"><strong>${KD.fmtDinero(o.total)}</strong></td>
              </tr>`;
            }).join("")}</tbody></table>` : KD.vacio("No hay presupuestos pendientes.")}
        </div>
      </section>` : ""}
    </div>`;

  main.querySelectorAll("tr[data-href]").forEach((tr) => tr.addEventListener("click", () => (location.hash = tr.dataset.href)));
  main.querySelector("[data-nuevo-paciente]")?.addEventListener("click", () => KD.formPaciente());
  main.querySelector("[data-nueva-cita]")?.addEventListener("click", (e) => { e.preventDefault(); KD.formCita({}); });
};
