// Dashboard: la operación del día en una vista.
KD.vistas = KD.vistas || {};

KD.vistas.dashboard = (main) => {
  const u = KD.usuario();
  const sucIds = KD.sucursalesFiltro();
  const hoy = KD.hoy();
  const ahora = KD.ahoraMin();
  const soloMias = KD.esDoctor(u) && !KD.puede("agenda_todas");
  const dinero = KD.verDinero();
  const citasHoy = KD.db.citas.filter((c) => c.fecha === hoy && sucIds.includes(c.sucursalId) && c.estado !== "cancelada" && (!soloMias || c.doctorId === u.id))
    .sort((a, b) => a.hora.localeCompare(b.hora));
  const confirmadas = citasHoy.filter((c) => ["confirmada", "en_sala", "atendida"].includes(c.estado)).length;
  const atendidas = citasHoy.filter((c) => c.estado === "atendida").length;
  const saludo = new Date().getHours() < 12 ? "Buenos días" : new Date().getHours() < 19 ? "Buenas tardes" : "Buenas noches";
  const nombreCorto = KD.nombrePersona(u).split(" ").slice(0, u.titulo ? 2 : 1).join(" ");
  const sucTxt = sucIds.length > 1 ? "Todas las sucursales" : `Sucursal ${KD.nombreSuc(sucIds[0])}`;
  const pendReg = KD.esDoctor(u) ? KD.registrosPendientes(u.id) : [];
  const seg = KD.puede("seguimiento") || KD.puede("presupuestos") ? KD.seguimiento(sucIds) : null;

  // Ingresos (cobros) por día de la semana actual
  const lunes = KD.inicioSemana(hoy);
  const semana = Array.from({ length: 7 }, (_, i) => KD.sumarDias(lunes, i));
  const ingresosDia = (f) => sucIds.reduce((s, id) => s + KD.resumenCaja(f, id).totalIngresos, 0);
  const atendidasDia = (f) => KD.db.citas.filter((c) => c.fecha === f && sucIds.includes(c.sucursalId) && c.estado === "atendida" && (!soloMias || c.doctorId === u.id)).length;
  const serieSemana = semana.map((f) => ({ f, v: dinero ? ingresosDia(f) : atendidasDia(f) }));
  const ingHoy = dinero ? ingresosDia(hoy) : 0;
  const ingAyer = dinero ? ingresosDia(KD.sumarDias(hoy, -1)) : 0;

  const kpis = [];
  kpis.push(`<div class="card kpi"><div class="kpi-top"><span class="etq">${soloMias ? "Mis citas de hoy" : "Citas de hoy"}</span><span class="kpi-ico">${KD.icon("agenda", 18)}</span></div>
    <div class="valor">${citasHoy.length}</div>
    <div class="sub"><span>${atendidas} atendidas</span><span>${confirmadas} confirmadas</span></div>${KD.progreso(citasHoy.length ? atendidas / citasHoy.length : 0, "info")}</div>`);
  if (dinero) kpis.push(`<div class="card kpi"><div class="kpi-top"><span class="etq">Ingresos de hoy</span><span class="kpi-ico ok">${KD.icon("dinero", 18)}</span></div>
    <div class="valor">${KD.fmtDinero(ingHoy)}</div>
    <div class="sub"><span>${KD.delta(ingHoy, ingAyer) || "&nbsp;"} vs. ayer</span></div>
    <div class="mini-barras" aria-hidden="true">${serieSemana.map((d) => `<i class="${d.f === hoy ? "hoy" : ""}" style="height:${Math.max(4, (d.v / Math.max(1, ...serieSemana.map((x) => x.v))) * 100)}%"></i>`).join("")}</div></div>`);
  if (KD.esDoctor(u) && KD.puede("historial_editar")) kpis.push(`<div class="card kpi"><div class="kpi-top"><span class="etq">Registros pendientes</span><span class="kpi-ico ${pendReg.length ? "bad" : "ok"}">${KD.icon("presupuestos", 18)}</span></div>
    <div class="valor">${pendReg.length}</div><div class="sub"><span>${pendReg.length ? "Consultas sin llenar" : "Todo registrado"}</span></div></div>`);
  if (KD.puede("cobrar") && !dinero) {
    const pc = KD.porCobrar(sucIds).length;
    kpis.push(`<div class="card kpi"><div class="kpi-top"><span class="etq">Por cobrar</span><span class="kpi-ico warn">${KD.icon("caja", 18)}</span></div>
      <div class="valor">${pc} <small>pacientes</small></div><div class="sub"><a href="#/caja">Ir a caja</a></div></div>`);
  }
  if (KD.puede("presupuestos")) {
    const pend = KD.db.presupuestos.filter((p) => sucIds.includes(p.sucursalId) && KD.estadoPresupuesto(p) === "enviado");
    const monto = pend.reduce((s, p) => s + KD.totalPresupuesto(p), 0);
    kpis.push(`<div class="card kpi"><div class="kpi-top"><span class="etq">Presupuestos pendientes</span><span class="kpi-ico warn">${KD.icon("presupuestos", 18)}</span></div>
      <div class="valor">${pend.length} <small>presupuestos</small></div>
      <div class="sub">${dinero ? `<span style="color:var(--warn);font-weight:700">${KD.fmtDinero(monto)} por decidir</span>` : ""}<span>${seg.presupuestos.length} requieren seguimiento</span></div></div>`);
  }
  if (seg && KD.puede("seguimiento")) kpis.push(`<div class="card kpi"><div class="kpi-top"><span class="etq">Sin próxima cita</span><span class="kpi-ico bad">${KD.icon("pacientes", 18)}</span></div>
    <div class="valor">${seg.sinCita.length + seg.tratamientos.length} <small>pacientes</small></div>
    <div class="sub"><span>${seg.tratamientos.length} con tratamiento aceptado</span></div></div>`);
  if (kpis.length < 4) {
    const enSala = citasHoy.filter((c) => c.estado === "en_sala").length;
    kpis.push(`<div class="card kpi"><div class="kpi-top"><span class="etq">En sala de espera</span><span class="kpi-ico">${KD.icon("reloj", 18)}</span></div>
      <div class="valor">${enSala}</div><div class="sub"><span>Pacientes esperando ahora</span></div></div>`);
  }

  // Disponibilidad del equipo clínico
  const docsHoy = KD.doctores(sucIds).filter((d) => KD.db.citas.some((c) => c.fecha === hoy && c.doctorId === d.id && sucIds.includes(c.sucursalId)));
  const unidadesTot = sucIds.reduce((s, id) => s + KD.unidades(id).length, 0);
  const minutosLibres = unidadesTot * 10 * 60;
  const ocupados = KD.db.citas.filter((c) => c.fecha === hoy && sucIds.includes(c.sucursalId) && !["cancelada", "no_asistio"].includes(c.estado)).reduce((s, c) => s + c.duracion, 0);
  const ocupacion = minutosLibres ? Math.min(1, ocupados / minutosLibres) : 0;
  const estadoDoc = (d) => {
    const ahoraCita = KD.db.citas.find((c) => c.fecha === hoy && c.doctorId === d.id && KD.aMinutos(c.hora) <= ahora && KD.finCita(c) > ahora && !["cancelada", "no_asistio"].includes(c.estado));
    if (ahoraCita) return ["warn", "En consulta"];
    const quedan = KD.db.citas.some((c) => c.fecha === hoy && c.doctorId === d.id && KD.aMinutos(c.hora) > ahora && c.estado !== "cancelada");
    return quedan ? ["ok", "Disponible"] : ["", "Terminó su agenda"];
  };

  main.innerHTML = `
    ${KD.cabecera(KD.fmtFecha(hoy, { weekday: "long", day: "numeric", month: "short", year: "numeric" }),
      `${saludo}, ${KD.esc(nombreCorto)} ${KD.icon("estrella", 20)}`, `${KD.esc(sucTxt)} · Tu operación en una vista.`,
      `${KD.puede("pacientes_editar") ? `<button class="btn btn-ghost" data-nuevo-paciente>${KD.icon("usuarioMas", 16)} Nuevo paciente</button>` : ""}
       ${KD.puede("agenda_editar") ? `<button class="btn" data-nueva-cita>${KD.icon("mas", 16)} Nueva cita</button>` : ""}`)}

    ${pendReg.length ? `<div class="aviso-inline bad">${KD.icon("alerta", 20)}<span><strong>Tienes ${pendReg.length} consulta(s) sin registrar.</strong> Ya pasaron 15 minutos desde el final de la cita: llena el registro para que recepción pueda cobrar.</span>
      <div class="acciones">${pendReg.slice(0, 3).map((c) => `<a class="btn btn-sm" href="#/pacientes/${c.pacienteId}">${KD.esc(KD.byId("pacientes", c.pacienteId)?.nombre.split(" ").slice(0, 2).join(" "))} · ${c.hora}</a>`).join("")}</div></div>` : ""}

    <div class="kpis">${kpis.slice(0, 4).join("")}</div>

    <div class="grid grid-dash">
      ${KD.puede("agenda_ver") ? `<section class="card">
        <div class="card-head"><div><span class="eyebrow">Agenda de hoy</span><h2>Próximas citas</h2></div><a href="#/agenda" class="btn-link">Ver agenda ${KD.icon("der", 14)}</a></div>
        ${citasHoy.length ? `<ul class="lista-citas">${citasHoy.slice(0, 8).map((c) => {
          const p = KD.byId("pacientes", c.pacienteId);
          return `<li>
            <span class="hora">${c.hora}<small>${c.duracion} min</small></span>
            <span class="linea" style="--c:${KD.colorUsuario(c.doctorId)}"><i></i></span>
            <span class="info"><strong>${KD.esc(p?.nombre)}</strong>${KD.badgeEstadoCita(c.estado)}
              <small>${KD.icon("estetoscopio", 13)} ${KD.esc(KD.tratamientoCita(c))}${c.piezas ? ` · ${KD.esc(c.piezas)}` : ""} · ${KD.esc(KD.nombreUsuario(c.doctorId))}${sucIds.length > 1 ? ` · ${KD.esc(KD.nombreSuc(c.sucursalId))}` : ""} · U${c.unidad}</small></span>
            <button class="btn-icon sin-borde chico" data-menu-cita="${c.id}" aria-label="Opciones de la cita">${KD.icon("puntos", 16)}</button>
          </li>`;
        }).join("")}</ul>${citasHoy.length > 8 ? `<div class="card-pie"><span>${citasHoy.length - 8} citas más hoy</span><a href="#/agenda">Ver todas</a></div>` : ""}` : KD.vacio("No hay citas para hoy.", "agenda")}
      </section>` : ""}

      ${seg && KD.puede("seguimiento") ? `<section class="card">
        <div class="card-head"><div><span class="eyebrow">Atención recomendada</span><h2>Oportunidades</h2></div>${KD.badge(`${seg.total} activas`)}</div>
        <div class="filas">
          ${filaOportunidad(seg.presupuestos[0], "bad", "alerta", (o) => `${KD.byId("pacientes", o.pacienteId)?.nombre} · ${o.dias} días`, (o) => (dinero ? `<span class="fila-monto">${KD.fmtDinero(o.total)}</span>` : ""))}
          ${filaOportunidad(seg.sinCita[0], "warn", "reloj", (o) => `${KD.byId("pacientes", o.pacienteId)?.nombre} · última cita hace ${o.dias} días`)}
          ${filaOportunidad(seg.tratamientos[0], "", "seguimiento", (o) => `${KD.byId("pacientes", o.pacienteId)?.nombre} · ${o.items.length} procedimiento(s) aceptado(s)`)}
        </div>
        <div class="card-body"><a class="btn btn-soft" style="width:100%" href="#/seguimiento">Abrir centro de seguimiento ${KD.icon("externo", 15)}</a></div>
      </section>` : `<section class="card">
        <div class="card-head"><div><span class="eyebrow">Pendientes</span><h2>Avisos</h2></div></div>
        <div class="filas">${KD.notificaciones().slice(0, 5).map((a) => `<a class="fila" href="${a.href}" style="color:inherit;text-decoration:none"><span class="fila-ico ${a.tipo}">${KD.icon(a.icono, 16)}</span><span class="fila-txt"><strong>${KD.esc(a.titulo)}</strong><small>${KD.esc(a.texto)}</small></span></a>`).join("") || KD.vacio("Todo al día.")}</div>
      </section>`}

      <section class="card">
        <div class="card-head"><div><span class="eyebrow">Resumen operativo</span><h2>Actividad de la semana</h2><p>${dinero ? "Ingresos cobrados por día" : "Citas atendidas por día"}</p></div></div>
        <div class="card-body">${KD.graficaBarras(serieSemana.map((d, i) => ({ etq: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][i], valor: d.v, destacado: d.f === hoy,
          tip: `${KD.fmtFecha(d.f, { weekday: "long", day: "numeric" })}: ${dinero ? KD.fmtDinero(d.v) : `${d.v} citas`}` })),
          { fmt: dinero ? (v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`) : (v) => KD.fmtNum(v), alto: 200 })}</div>
      </section>

      <section class="card">
        <div class="card-head"><div><span class="eyebrow">Equipo en consultorio</span><h2>Disponibilidad</h2></div>${KD.puede("agenda_ver") ? `<a href="#/agenda" class="btn-link">Agenda ${KD.icon("der", 14)}</a>` : ""}</div>
        <div class="filas">${docsHoy.length ? docsHoy.slice(0, 6).map((d) => {
          const [t, txt] = estadoDoc(d);
          return `<div class="fila" style="padding:10px 20px">${KD.avatar(d.nombre, KD.color(d.color))}<span class="fila-txt"><strong>${KD.esc(KD.nombrePersona(d))}</strong><small>${KD.esc(d.especialidad || KD.puesto(d.puesto).nombre)}</small></span>${KD.punto(txt, t === "ok" ? "cita-atendida" : t === "warn" ? "cita-programada" : "")}</div>`;
        }).join("") : KD.vacio("Nadie del equipo clínico tiene citas hoy.")}</div>
        <div class="card-body" style="border-top:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span class="muted">Ocupación de las unidades</span><strong style="font-size:18px">${Math.round(ocupacion * 100)}%</strong></div>
          ${KD.progreso(ocupacion)}
          <small class="muted">${Math.max(0, Math.floor((minutosLibres - ocupados) / 30))} espacios de 30 min disponibles hoy · ${unidadesTot} unidades</small>
        </div>
      </section>
    </div>`;

  main.querySelector("[data-nuevo-paciente]")?.addEventListener("click", () => KD.formPaciente());
  main.querySelector("[data-nueva-cita]")?.addEventListener("click", () => KD.formCita({}));
  main.querySelectorAll("[data-menu-cita]").forEach((b) => b.addEventListener("click", () => {
    const c = KD.byId("citas", b.dataset.menuCita);
    KD.popover(b, [
      { texto: "Ver detalle de la cita", icono: "agenda", accion: () => KD.detalleCita(c.id) },
      KD.puede("pacientes_ver") && { texto: "Ver paciente", icono: "pacientes", accion: () => (location.hash = `#/pacientes/${c.pacienteId}`) },
      KD.puedeRegistrar(c) && { texto: "Registrar consulta", icono: "presupuestos", accion: () => KD.formConsulta(c) },
    ]);
  }));
  main.querySelectorAll("[data-hecho]").forEach((b) => b.addEventListener("click", () => { KD.marcarSeguimiento(b.dataset.hecho); KD.render(); KD.toast("Marcado como realizado"); }));
};

function filaOportunidad(o, tipo, icono, sub, extra = () => "") {
  if (!o) return "";
  return `<div class="fila"><span class="fila-ico ${tipo}">${KD.icon(icono, 17)}</span>
    <span class="fila-txt"><strong>${KD.esc(o.titulo)}</strong><small>${KD.esc(sub(o))}</small></span>${extra(o)}
    <a class="btn-icon sin-borde chico" href="#/pacientes/${o.pacienteId}" aria-label="Ver paciente">${KD.icon("der", 16)}</a></div>`;
}
