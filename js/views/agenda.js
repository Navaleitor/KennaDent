// Agenda por unidad (sillón dental): vistas de día, semana y mes.
// Se arrastra una cita para cambiarla de hora o de unidad, y se estira desde abajo para cambiar su duración.
KD.vistas = KD.vistas || {};

const AG_INICIO = 8 * 60, AG_FIN = 20 * 60, AG_PX = 44 / 30; // 44 px por cada 30 minutos
const DIAS_SEM = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const agEstado = { fecha: null, vista: "dia", unidades: [], doctor: "" };
const ESTADOS_VIVOS = ["programada", "confirmada", "en_sala"];

KD.vistas.agenda = (main) => {
  agEstado.fecha = agEstado.fecha || KD.hoy();
  const u = KD.usuario();
  const sucIds = KD.sucursalesFiltro();
  const sucId = KD.sucursalUnica();
  const suc = KD.byId("sucursales", sucId);
  const unidades = KD.unidades(sucId);
  agEstado.unidades = agEstado.unidades.filter((x) => unidades.includes(x));
  const visibles = agEstado.unidades.length ? agEstado.unidades : unidades;
  const soloMias = !KD.puede("agenda_todas");
  const editar = KD.puede("agenda_editar");
  const movil = innerWidth < 760;
  const f = agEstado.fecha;

  // Rango de fechas de la vista
  let desde = f, hasta = f, titulo = "";
  if (agEstado.vista === "semana") { desde = KD.inicioSemana(f); hasta = KD.sumarDias(desde, 6); titulo = `Semana del ${KD.fmtFecha(desde, { day: "numeric", month: "short" })} al ${KD.fmtFecha(hasta, { day: "numeric", month: "short" })}`; }
  else if (agEstado.vista === "mes") { desde = KD.inicioSemana(f.slice(0, 8) + "01"); const finMes = KD.fechaISO(new Date(Number(f.slice(0, 4)), Number(f.slice(5, 7)), 0)); hasta = KD.sumarDias(KD.inicioSemana(finMes), 6); titulo = KD.fmtFecha(f, { month: "long", year: "numeric" }); }
  else titulo = KD.fmtFecha(f, { weekday: "long", day: "numeric", month: "long" });

  const citas = KD.db.citas.filter((c) => c.sucursalId === sucId && c.fecha >= desde && c.fecha <= hasta && c.estado !== "cancelada" &&
    (!soloMias || c.doctorId === u.id) && (!agEstado.doctor || c.doctorId === agEstado.doctor) && visibles.includes(unidadDe(c, unidades)));
  const enVista = agEstado.vista === "mes" ? citas.filter((c) => c.fecha.slice(0, 7) === f.slice(0, 7)) : citas;
  const docsVisibles = [...new Set(enVista.map((c) => c.doctorId))].map((id) => KD.byId("personal", id)).filter(Boolean);

  let cuerpo;
  if (agEstado.vista === "mes") cuerpo = vistaMes(citas, desde, hasta, visibles.length);
  else if (movil) cuerpo = listaAgenda(citas, agEstado.vista === "semana");
  else if (agEstado.vista === "semana") cuerpo = gridAgenda(Array.from({ length: 7 }, (_, i) => {
    const fe = KD.sumarDias(desde, i);
    return { fecha: fe, unidad: visibles[0], cab: `${DIAS_SEM[i]} <span style="font-weight:500">${Number(fe.slice(8))}</span>`, sub: "", hoy: fe === KD.hoy(), citas: citas.filter((c) => c.fecha === fe) };
  }), true, editar);
  else cuerpo = gridAgenda(visibles.map((un) => {
    const cs = citas.filter((c) => unidadDe(c, unidades) === un);
    const docs = [...new Set(cs.map((c) => KD.nombreUsuario(c.doctorId)))];
    return { fecha: f, unidad: un, cab: `Unidad ${un}`, sub: docs.join(" · ") || "Disponible", hoy: false, citas: cs };
  }), false, editar);

  main.innerHTML = `
    ${KD.cabecera("Agenda por unidad", "Agenda", editar ? "Arrastra una cita para moverla · tira inferior para cambiar la duración · clic en un espacio libre para crear." : soloMias ? "Tu agenda personal." : "Agenda de la sucursal.",
      editar ? `<button class="btn" data-nueva>${KD.icon("mas", 16)} Nueva cita</button>` : "")}
    <div class="ag-barra">
      <div class="acciones">
        <div class="segmentado" role="group" aria-label="Vista">${[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]].map(([k, t]) => `<button data-vista="${k}" class="${agEstado.vista === k ? "activo" : ""}">${t}</button>`).join("")}</div>
        <div class="unidades-chips" role="group" aria-label="Unidades">
          <button data-unidad="todas" class="${agEstado.unidades.length ? "" : "activo"}">${KD.icon("unidad", 15)} Todas</button>
          ${unidades.map((un) => `<button data-unidad="${un}" class="${agEstado.unidades.includes(un) ? "activo" : ""}">Unidad ${un}</button>`).join("")}
        </div>
      </div>
      <div class="acciones">
        ${sucIds.length > 1 ? `<select data-suc aria-label="Sucursal de la agenda">${KD.opciones(KD.sucursalesUsuario().filter((s) => sucIds.includes(s.id)), sucId)}</select>` : ""}
        ${!soloMias ? `<select data-doctor aria-label="Doctor"><option value="">Todos los doctores</option>${KD.opciones(KD.doctores([sucId]).map((d) => ({ id: d.id, nombre: KD.nombrePersona(d) })), agEstado.doctor)}</select>` : ""}
      </div>
    </div>
    <div class="card ag-nav">
      <div class="lado"><button class="btn-icon" data-mover="-1" aria-label="Anterior">${KD.icon("izq")}</button></div>
      <div class="centro"><strong class="capital" style="display:block">${KD.esc(titulo)}</strong><small>Sucursal ${KD.esc(suc?.nombre)} · ${visibles.length === unidades.length ? `${unidades.length} unidades` : visibles.map((x) => `Unidad ${x}`).join(", ")} · ${enVista.length} citas</small></div>
      <div class="lado der"><button class="btn btn-ghost btn-sm" data-hoy>Hoy</button><input type="date" value="${f}" aria-label="Elegir fecha" data-fecha><button class="btn-icon" data-mover="1" aria-label="Siguiente">${KD.icon("der")}</button></div>
    </div>
    <div class="ag-leyenda">
      <div class="docs">${docsVisibles.map((d) => `<span><i class="color-punto" style="--c:${KD.color(d.color)}"></i>${KD.esc(KD.nombrePersona(d))}</span>`).join("") || "<span>Sin citas en este periodo</span>"}</div>
      <div class="docs">${["programada", "confirmada", "en_sala", "atendida", "no_asistio"].map((e) => `<span><i class="ag-dot st-${e}"></i>${KD.ESTADOS_CITA[e]}</span>`).join("")}</div>
    </div>
    <div class="card">${cuerpo}</div>`;

  // Controles
  const re = () => KD.vistas.agenda(main);
  main.querySelectorAll("[data-vista]").forEach((b) => b.addEventListener("click", () => { agEstado.vista = b.dataset.vista; re(); }));
  main.querySelectorAll("[data-unidad]").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.unidad;
    if (v === "todas") agEstado.unidades = [];
    else {
      const n = Number(v);
      agEstado.unidades = agEstado.unidades.includes(n) ? agEstado.unidades.filter((x) => x !== n) : [...agEstado.unidades, n].sort();
      if (agEstado.unidades.length === unidades.length) agEstado.unidades = [];
    }
    re();
  }));
  main.querySelector("[data-suc]")?.addEventListener("change", (e) => { KD.db.sesion.sucursalTrabajo = e.target.value; agEstado.unidades = []; KD.guardar(); re(); });
  main.querySelector("[data-doctor]")?.addEventListener("change", (e) => { agEstado.doctor = e.target.value; re(); });
  main.querySelectorAll("[data-mover]").forEach((b) => b.addEventListener("click", () => {
    const n = Number(b.dataset.mover);
    if (agEstado.vista === "mes") { const d = new Date(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1 + n, 1); agEstado.fecha = KD.fechaISO(d); }
    else agEstado.fecha = KD.sumarDias(f, n * (agEstado.vista === "semana" ? 7 : 1));
    re();
  }));
  main.querySelector("[data-hoy]").addEventListener("click", () => { agEstado.fecha = KD.hoy(); re(); });
  main.querySelector("[data-fecha]").addEventListener("change", (e) => { if (e.target.value) { agEstado.fecha = e.target.value; re(); } });
  main.querySelector("[data-nueva]")?.addEventListener("click", () => KD.formCita({ fecha: agEstado.fecha, sucursalId: sucId, unidad: visibles[0] }));
  main.querySelectorAll("[data-dia]").forEach((el) => el.addEventListener("click", () => { agEstado.fecha = el.dataset.dia; agEstado.vista = "dia"; re(); }));
  main.querySelectorAll(".lista-agenda [data-cita]").forEach((el) => el.addEventListener("click", () => KD.detalleCita(el.dataset.cita)));

  // Cambio de estado directo desde la cita
  main.querySelectorAll("[data-estado-cita]").forEach((s) => {
    s.addEventListener("pointerdown", (e) => e.stopPropagation());
    s.addEventListener("click", (e) => e.stopPropagation());
    s.addEventListener("change", () => cambiarEstado(KD.byId("citas", s.dataset.estadoCita), s.value));
  });

  // Crear cita con clic en un espacio libre
  if (editar) main.querySelectorAll(".ag-col").forEach((col) => col.addEventListener("click", (e) => {
    if (e.target !== col) return;
    const min = Math.min(AG_FIN - 15, AG_INICIO + Math.floor(e.offsetY / AG_PX / 15) * 15);
    KD.formCita({ fecha: col.dataset.fecha, sucursalId: sucId, unidad: Number(col.dataset.unidad), hora: KD.aHora(min) });
  }));
  main.querySelectorAll(".ag-cita").forEach((el) => activarCita(el, editar, sucId));

  const grid = main.querySelector(".ag-grid-wrap");
  if (grid) grid.scrollTop = Math.max(0, ((desde <= KD.hoy() && KD.hoy() <= hasta ? KD.ahoraMin() : 9 * 60) - AG_INICIO - 45) * AG_PX);
};

const unidadDe = (c, unidades) => Math.min(c.unidad || 1, unidades.length);

// Reparte en carriles las citas que se enciman (vista semanal con varias unidades)
function carriles(citas) {
  const orden = citas.slice().sort((a, b) => KD.aMinutos(a.hora) - KD.aMinutos(b.hora));
  const out = new Map();
  let grupo = [], finGrupo = -1;
  const cerrar = () => { const n = Math.max(...grupo.map((g) => g.carril)) + 1; grupo.forEach((g) => out.set(g.c.id, { carril: g.carril, total: n })); grupo = []; };
  for (const c of orden) {
    const ini = KD.aMinutos(c.hora);
    if (grupo.length && ini >= finGrupo) cerrar();
    const ocupados = new Set(grupo.filter((g) => KD.finCita(g.c) > ini).map((g) => g.carril));
    let carril = 0;
    while (ocupados.has(carril)) carril++;
    grupo.push({ c, carril });
    finGrupo = Math.max(finGrupo, KD.finCita(c));
  }
  if (grupo.length) cerrar();
  return out;
}

function gridAgenda(columnas, compacta, editar) {
  const horas = [];
  for (let t = AG_INICIO; t < AG_FIN; t += 30) horas.push(t);
  const alto = (AG_FIN - AG_INICIO) * AG_PX;
  const ahora = KD.ahoraMin();
  const ancho = compacta ? "minmax(118px, 1fr)" : "minmax(230px, 1fr)";
  return `<div class="ag-grid-wrap"><div class="ag-grid" style="grid-template-columns: 58px repeat(${columnas.length}, ${ancho})">
    <div class="ag-cab esquina">Hora</div>
    ${columnas.map((c) => `<div class="ag-cab ${c.hoy ? "hoy" : ""}">${c.cab}<small>${KD.esc(c.sub || "")}</small></div>`).join("")}
    <div class="ag-horas">${horas.map((t) => `<div>${KD.aHora(t)}</div>`).join("")}</div>
    ${columnas.map((col) => {
      const lanes = carriles(col.citas);
      const linea = col.fecha === KD.hoy() && ahora >= AG_INICIO && ahora <= AG_FIN ? `<div class="ag-ahora" style="top:${(ahora - AG_INICIO) * AG_PX}px"></div>` : "";
      return `<div class="ag-col ${col.hoy ? "hoy" : ""} ${editar ? "" : "solo-lectura"}" data-fecha="${col.fecha}" data-unidad="${col.unidad}" style="height:${alto}px">
        ${col.citas.map((c) => bloqueCita(c, compacta, editar, lanes.get(c.id))).join("")}${linea}</div>`;
    }).join("")}
  </div></div>`;
}

function bloqueCita(c, compacta, editar, lane = { carril: 0, total: 1 }) {
  const p = KD.byId("pacientes", c.pacienteId);
  const top = (KD.aMinutos(c.hora) - AG_INICIO) * AG_PX;
  const h = Math.max(22, c.duracion * AG_PX - 3);
  const movible = editar && ESTADOS_VIVOS.includes(c.estado);
  const chica = compacta || h < 38;
  const pos = lane.total > 1 ? `left:calc(${(lane.carril / lane.total) * 100}% + 3px);right:auto;width:calc(${100 / lane.total}% - 6px);` : "";
  const estado = editar && c.estado !== "atendida"
    ? `<select data-estado-cita="${c.id}" aria-label="Estado de la cita">${Object.entries(KD.ESTADOS_CITA).filter(([k]) => k !== "atendida" || c.estado === "atendida").map(([k, v]) => `<option value="${k}" ${k === c.estado ? "selected" : ""}>${v}</option>`).join("")}</select>`
    : KD.badgeEstadoCita(c.estado);
  return `<div class="ag-cita st-${c.estado} ${chica ? "compacta" : ""} ${h < 60 ? "baja" : ""} ${movible ? "movible" : ""}" data-cita="${c.id}" data-inicio="${KD.aMinutos(c.hora)}" data-dur="${c.duracion}"
      style="--c:${KD.colorUsuario(c.doctorId)};top:${top + 1}px;height:${h}px;${pos}" title="${KD.esc(`${c.hora} · ${p?.nombre} · ${KD.tratamientoCita(c)} · ${KD.nombreUsuario(c.doctorId)} · ${KD.ESTADOS_CITA[c.estado]}`)}">
    <span class="ag-flag"></span>
    <div class="ag-info">
      <strong>${compacta ? "" : `${c.hora} `}${KD.esc(p?.nombre)}</strong>
      ${h > 34 ? `<small>${KD.esc(KD.tratamientoCita(c))}${c.piezas ? ` · ${KD.esc(c.piezas)}` : ""}</small>` : ""}
      ${h > 50 ? `<small class="doc"><i></i>${KD.esc(KD.nombreUsuario(c.doctorId))}${compacta ? ` · U${c.unidad}` : ""}</small>` : ""}
    </div>
    ${chica ? `<i class="ag-dot st-${c.estado}"></i>` : `<div class="ag-estado"><small>Estado</small>${estado}</div>`}
    ${movible ? '<span class="ag-resize" aria-hidden="true"></span>' : ""}
  </div>`;
}

// Arrastrar para mover y estirar para cambiar duración
function activarCita(el, editar, sucId) {
  const id = el.dataset.cita;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const redimensionar = e.target.classList.contains("ag-resize");
    if (!el.classList.contains("movible")) { if (!redimensionar) el.addEventListener("pointerup", () => KD.detalleCita(id), { once: true }); return; }
    e.preventDefault();
    const c = KD.byId("citas", id);
    const y0 = e.clientY, x0 = e.clientX;
    const ini0 = KD.aMinutos(c.hora), dur0 = c.duracion;
    let colDestino = el.parentElement, nuevoIni = ini0, nuevaDur = dur0, movido = false;
    const snap = (m) => Math.round(m / 15) * 15;
    const mover = (ev) => {
      const dy = ev.clientY - y0;
      if (!movido && Math.abs(dy) < 5 && Math.abs(ev.clientX - x0) < 5) return;
      if (!movido) { movido = true; el.classList.add("arrastrando"); el.style.pointerEvents = "none"; }
      if (redimensionar) {
        nuevaDur = Math.max(15, Math.min(AG_FIN - ini0, snap(dur0 + dy / AG_PX)));
        el.style.height = `${nuevaDur * AG_PX - 3}px`;
      } else {
        nuevoIni = Math.max(AG_INICIO, Math.min(AG_FIN - dur0, snap(ini0 + dy / AG_PX)));
        el.style.top = `${(nuevoIni - AG_INICIO) * AG_PX + 1}px`;
        const bajo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".ag-col");
        if (bajo && bajo !== colDestino) { colDestino = bajo; bajo.appendChild(el); }
        const s = el.querySelector(".ag-info strong");
        if (s && !el.classList.contains("compacta")) s.textContent = `${KD.aHora(nuevoIni)} ${KD.byId("pacientes", c.pacienteId)?.nombre || ""}`;
      }
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      if (!movido) { if (!redimensionar) KD.detalleCita(id); return; }
      const cambios = redimensionar ? { duracion: nuevaDur } : { hora: KD.aHora(nuevoIni), fecha: colDestino.dataset.fecha, unidad: Number(colDestino.dataset.unidad) };
      const prueba = { ...c, ...cambios };
      const choque = choqueCita(prueba);
      if (choque) { KD.toast(choque, "bad"); KD.render(); return; }
      Object.assign(c, cambios);
      KD.guardar();
      KD.render();
      KD.toast(redimensionar ? `Duración: ${c.duracion} min` : `Cita movida a las ${c.hora}${cambios.unidad !== undefined ? ` · Unidad ${c.unidad}` : ""}${c.fecha !== KD.hoy() ? ` · ${KD.fmtFecha(c.fecha, { weekday: "short", day: "numeric", month: "short" })}` : ""}`);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  });
}

// Una unidad no puede tener dos pacientes a la vez; un doctor tampoco puede estar en dos citas
function choqueCita(c, ignorarDoctor = false) {
  const ini = KD.aMinutos(c.hora), fin = ini + Number(c.duracion);
  const activa = (x) => x.id !== c.id && x.fecha === c.fecha && !["cancelada", "no_asistio"].includes(x.estado) && KD.aMinutos(x.hora) < fin && KD.finCita(x) > ini;
  const enUnidad = KD.db.citas.find((x) => activa(x) && x.sucursalId === c.sucursalId && (x.unidad || 1) === (c.unidad || 1));
  if (enUnidad) return `La Unidad ${c.unidad} ya está ocupada a las ${enUnidad.hora} (${KD.byId("pacientes", enUnidad.pacienteId)?.nombre}).`;
  if (ignorarDoctor) return "";
  const doc = KD.db.citas.find((x) => activa(x) && x.doctorId === c.doctorId);
  if (doc) return `${KD.nombreUsuario(c.doctorId)} ya tiene una cita a las ${doc.hora}.`;
  return "";
}

function cambiarEstado(c, estado) {
  const aplicar = () => {
    c.estado = estado;
    KD.guardar(); KD.cerrarModal(); KD.render();
    KD.toast(`Cita marcada como "${KD.ESTADOS_CITA[estado]}"`);
  };
  if (estado === "cancelada") KD.confirmar("Cancelar cita", "El espacio queda libre en la agenda para otro paciente. La cita queda en el historial del paciente como cancelada.", "Cancelar cita", aplicar);
  else aplicar();
}

function vistaMes(citas, desde, hasta, nUnidades) {
  const mes = agEstado.fecha.slice(0, 7);
  const dias = [];
  for (let d = desde; d <= hasta; d = KD.sumarDias(d, 1)) dias.push(d);
  const capacidad = nUnidades * (AG_FIN - AG_INICIO);
  return `<div class="ag-mes">${DIAS_SEM.map((d) => `<div class="dsem">${d}</div>`).join("")}
    ${dias.map((d) => {
      const cs = citas.filter((c) => c.fecha === d).sort((a, b) => a.hora.localeCompare(b.hora));
      const ocup = Math.min(1, cs.reduce((s, c) => s + c.duracion, 0) / capacidad);
      return `<button type="button" class="ag-dia ${d.slice(0, 7) !== mes ? "otro-mes" : ""} ${d === KD.hoy() ? "hoy" : ""}" data-dia="${d}" aria-label="${KD.esc(KD.fmtFecha(d, { weekday: "long", day: "numeric", month: "long" }))}: ${cs.length} citas">
        <span class="dtop"><span class="dnum">${Number(d.slice(8))}</span><span class="dcount">${cs.length ? `${cs.length} citas` : ""}</span></span>
        ${cs.slice(0, 3).map((c) => `<span class="ag-mini" style="--c:${KD.colorUsuario(c.doctorId)}"><b>${c.hora}</b> ${KD.esc(KD.byId("pacientes", c.pacienteId)?.nombre.split(" ").slice(0, 2).join(" "))}</span>`).join("")}
        ${cs.length > 3 ? `<span class="mas">+${cs.length - 3} más</span>` : ""}
        ${cs.length ? `<span class="ag-ocupacion" title="Ocupación ${Math.round(ocup * 100)}%"><span style="width:${ocup * 100}%"></span></span>` : ""}
      </button>`;
    }).join("")}</div>`;
}

function listaAgenda(citas, agrupar) {
  const orden = citas.slice().sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  if (!orden.length) return KD.vacio("No hay citas en este periodo.", "agenda");
  const fechas = [...new Set(orden.map((c) => c.fecha))];
  return `<div class="lista-agenda">${fechas.map((fe) => `${agrupar ? `<h3>${KD.esc(KD.fmtFecha(fe, { weekday: "long", day: "numeric", month: "short" }))}</h3>` : ""}
    <ul class="lista-citas">${orden.filter((c) => c.fecha === fe).map((c) => {
      const p = KD.byId("pacientes", c.pacienteId);
      return `<li data-cita="${c.id}" style="cursor:pointer">
        <span class="hora">${c.hora}<small>${c.duracion} min</small></span>
        <span class="linea" style="--c:${KD.colorUsuario(c.doctorId)}"><i></i></span>
        <span class="info"><strong>${KD.esc(p?.nombre)}</strong><small>${KD.esc(KD.tratamientoCita(c))}${c.piezas ? ` · ${KD.esc(c.piezas)}` : ""} · Unidad ${c.unidad} · ${KD.esc(KD.nombreUsuario(c.doctorId))}</small></span>
        ${KD.badgeEstadoCita(c.estado)}
      </li>`;
    }).join("")}</ul>`).join("")}</div>`;
}

// ---------- Detalle de cita ----------
KD.detalleCita = (id) => {
  const c = KD.byId("citas", id);
  if (!c) return;
  const p = KD.byId("pacientes", c.pacienteId);
  const editar = KD.puede("agenda_editar");
  const cons = KD.consultaDeCita(c.id);
  const verCobro = KD.puede("cobrar") || KD.puede("caja");
  const pendienteCobro = !c.cobro && !c.cobrado && !!cons && KD.totalConsulta(cons) > 0;
  const tipo = KD.byId("tiposCita", c.tipoId);
  const m = KD.modal({
    titulo: "Detalle de la cita",
    subtitulo: `${KD.esc(KD.fmtFecha(c.fecha, { weekday: "long", day: "numeric", month: "long" }))} · ${c.hora} · ${c.duracion} min`,
    cuerpo: `
      ${p.alergias ? `<div class="alerta-med" style="margin:0 0 14px">${KD.icon("alerta", 16)} Alergias: ${KD.esc(p.alergias)}</div>` : ""}
      <dl class="detalle-dl">
        <dt>Paciente</dt><dd>${KD.esc(p.nombre)} <span class="muted">· ${KD.esc(p.expediente)}</span></dd>
        <dt>Teléfono</dt><dd>${KD.esc(p.telefono)} · <a href="${KD.waLink(p.telefono)}" target="_blank" rel="noopener">WhatsApp</a></dd>
        <dt>Unidad</dt><dd>Unidad ${c.unidad || 1} · Sucursal ${KD.esc(KD.nombreSuc(c.sucursalId))}</dd>
        <dt>Doctor</dt><dd><span class="color-punto" style="--c:${KD.colorUsuario(c.doctorId)}"></span> ${KD.esc(KD.nombreUsuario(c.doctorId))}</dd>
        <dt>Tipo de cita</dt><dd>${KD.esc(tipo?.nombre)}</dd>
        ${c.tratamientoId ? `<dt>Tratamiento</dt><dd>${KD.esc(KD.nombreTrat(c.tratamientoId))}${c.piezas ? ` · pieza(s) ${KD.esc(c.piezas)}` : ""}</dd>` : ""}
        <dt>Estado</dt><dd>${KD.badgeEstadoCita(c.estado)}</dd>
        <dt>Registro del doctor</dt><dd>${cons ? KD.badge("Consulta registrada", "ok") : KD.badge(c.estado === "no_asistio" ? "No aplica" : "Pendiente", c.estado === "no_asistio" ? "" : "warn")}</dd>
        ${verCobro && (cons || c.cobro) ? `<dt>Cobro</dt><dd>${c.cobro ? `${KD.badge(`Cobrado · ${KD.METODOS[c.cobro.metodo]}`, "ok")} <span class="mono">${KD.fmtDinero(c.cobro.monto)}</span>` : c.cobrado ? KD.badge("Cobrado", "ok") : pendienteCobro ? `${KD.badge("Pendiente de cobro", "warn")} <span class="mono">${KD.fmtDinero(KD.totalConsulta(cons))}</span>` : "—"}</dd>` : ""}
        ${c.notas ? `<dt>Notas</dt><dd>${KD.esc(c.notas)}</dd>` : ""}
      </dl>
      ${editar && ESTADOS_VIVOS.concat("no_asistio").includes(c.estado) ? `<p class="muted" style="margin-bottom:6px;font-size:12px">Cambiar estado:</p>
      <div class="estado-botones">${["programada", "confirmada", "en_sala", "no_asistio"].filter((k) => k !== c.estado)
        .map((k) => `<button class="btn btn-ghost btn-sm" data-estado="${k}">${KD.ESTADOS_CITA[k]}</button>`).join("")}</div>` : ""}`,
    acciones: `
      ${editar && !cons ? `<button class="btn-icon peligro" data-eliminar title="Eliminar cita" aria-label="Eliminar cita" style="margin-right:auto">${KD.icon("basura", 17)}</button>` : ""}
      ${editar && ESTADOS_VIVOS.includes(c.estado) ? `<button class="btn btn-ghost" data-cancelar>Cancelar cita</button>` : ""}
      ${KD.puede("pacientes_ver") ? `<a class="btn btn-ghost" href="#/pacientes/${p.id}" data-cerrar>Ver paciente</a>` : ""}
      ${editar && ESTADOS_VIVOS.includes(c.estado) ? `<button class="btn btn-ghost" data-editar>${KD.icon("editar", 16)} Editar</button>` : ""}
      ${KD.puede("cobrar") && pendienteCobro ? `<button class="btn" data-cobrar>${KD.icon("caja", 16)} Cobrar</button>` : ""}
      ${KD.puedeRegistrar(c) ? `<button class="btn" data-consulta>${KD.icon("presupuestos", 16)} Registrar consulta</button>` : ""}`,
  });
  m.querySelectorAll("[data-estado]").forEach((b) => b.addEventListener("click", () => cambiarEstado(c, b.dataset.estado)));
  m.querySelector("[data-cancelar]")?.addEventListener("click", () => cambiarEstado(c, "cancelada"));
  m.querySelector("[data-editar]")?.addEventListener("click", () => KD.formCita(c));
  m.querySelector("[data-consulta]")?.addEventListener("click", () => KD.formConsulta(c));
  m.querySelector("[data-cobrar]")?.addEventListener("click", () => KD.formCobro(c));
  m.querySelector("[data-eliminar]")?.addEventListener("click", () => KD.confirmar("Eliminar cita",
    `Se borrará la cita de <strong>${KD.esc(p.nombre)}</strong> (${KD.esc(KD.fmtFecha(c.fecha))}, ${c.hora}) y el espacio queda libre. Si el paciente canceló, es mejor usar "Cancelar cita" para que quede en su historial.`,
    "Eliminar", () => {
      KD.db.citas = KD.db.citas.filter((x) => x.id !== c.id);
      KD.guardar(); KD.render(); KD.toast("Cita eliminada");
    }));
};

// ---------- Alta / edición de cita ----------
KD.formCita = (datos) => {
  const existente = datos.id ? datos : null;
  const sucs = KD.sucursalesUsuario();
  const d = { fecha: KD.hoy(), hora: "10:00", tipoId: "c1", duracion: 30, notas: "", tratamientoId: "", piezas: "", ...datos };
  d.sucursalId = d.sucursalId || KD.sucursalUnica();
  d.unidad = d.unidad || 1;
  const pacientes = KD.db.pacientes.filter((p) => p.activo);
  const etiquetaPac = (p) => `${p.nombre} · ${p.expediente}`;
  const pacSel = d.pacienteId ? KD.byId("pacientes", d.pacienteId) : null;
  const opcionesDoc = (sucId, sel) => KD.opciones(KD.doctores([sucId]).map((x) => ({ id: x.id, nombre: `${KD.nombrePersona(x)}${x.especialidad ? ` (${x.especialidad})` : ""}` })), sel);
  const duraciones = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

  const m = KD.modal({
    titulo: existente ? "Editar cita" : "Nueva cita",
    subtitulo: "La agenda se organiza por unidad (sillón dental): una unidad no puede tener dos pacientes a la vez.",
    ancho: "ancho",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Paciente <em>*</em></span>
        <input name="paciente" list="lista-pacientes" required placeholder="Escribe el nombre o el expediente" value="${pacSel ? KD.esc(etiquetaPac(pacSel)) : ""}" autocomplete="off">
        <datalist id="lista-pacientes">${pacientes.map((p) => `<option value="${KD.esc(etiquetaPac(p))}">`).join("")}</datalist>
        ${KD.puede("pacientes_editar") ? `<span class="ayuda">¿Es nuevo? <button type="button" class="btn-link" data-alta>Dar de alta al paciente</button></span>` : ""}
      </label>
      <label class="campo"><span>Doctor <em>*</em></span><select name="doctorId" required>${opcionesDoc(d.sucursalId, d.doctorId)}</select></label>
      ${sucs.length > 1 ? `<label class="campo"><span>Sucursal</span><select name="sucursalId">${KD.opciones(sucs, d.sucursalId)}</select></label>` : `<input type="hidden" name="sucursalId" value="${d.sucursalId}">`}
      <label class="campo"><span>Unidad (sillón) <em>*</em></span><select name="unidad">${KD.unidades(d.sucursalId).map((x) => `<option value="${x}" ${x === Number(d.unidad) ? "selected" : ""}>Unidad ${x}</option>`).join("")}</select></label>
      <label class="campo"><span>Fecha <em>*</em></span><input type="date" name="fecha" value="${d.fecha}" required></label>
      <label class="campo"><span>Hora <em>*</em></span><select name="hora" required></select></label>
      <label class="campo"><span>Duración</span><select name="duracion">${duraciones.map((x) => `<option value="${x}" ${x === Number(d.duracion) ? "selected" : ""}>${x} minutos</option>`).join("")}</select></label>
      <label class="campo"><span>Tipo de cita</span><select name="tipoId">${KD.opciones(KD.db.tiposCita, d.tipoId)}</select></label>
      <label class="campo" data-trat><span>Tratamiento a realizar <em>*</em></span><select name="tratamiento"></select></label>
      <label class="campo" data-trat><span>Pieza(s) a atender</span><input name="piezas" value="${KD.esc(d.piezas)}" placeholder="Ej. 16, 17"></label>
      <p class="nota-form" data-nota-tipo hidden></p>
      <label class="campo full"><span>Notas</span><textarea name="notas" rows="2" placeholder="Indicaciones para el equipo…">${KD.esc(d.notas)}</textarea></label>
      <p class="full nota-form bad" data-aviso hidden></p>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} ${existente ? "Guardar cambios" : "Crear cita"}</button>`,
  });
  const f = m.querySelector("form");
  const pacActual = () => pacientes.find((p) => etiquetaPac(p) === f.paciente.value) || pacientes.find((p) => p.expediente === f.paciente.value.trim().toUpperCase());

  const pintarHoras = () => {
    const suc = f.sucursalId.value, un = Number(f.unidad.value), fe = f.fecha.value;
    const ocupadas = new Set();
    for (const x of KD.db.citas) {
      if (x.id === existente?.id || x.fecha !== fe || x.sucursalId !== suc || (x.unidad || 1) !== un || ["cancelada", "no_asistio"].includes(x.estado)) continue;
      for (let t = KD.aMinutos(x.hora); t < KD.finCita(x); t += 15) ocupadas.add(KD.aHora(t));
    }
    const sel = f.hora.value || d.hora;
    f.hora.innerHTML = KD.opcionesHora(sel, AG_INICIO, AG_FIN, ocupadas);
  };
  const pintarTratamientos = () => {
    const tipo = KD.byId("tiposCita", f.tipoId.value);
    const conTrat = !!tipo?.tratamiento;
    m.querySelectorAll("[data-trat]").forEach((el) => (el.hidden = !conTrat));
    const nota = m.querySelector("[data-nota-tipo]");
    nota.hidden = !tipo?.diagnostico;
    if (tipo?.diagnostico) nota.innerHTML = `${KD.icon("diente", 16)} <span>Cita de diagnóstico: al registrarla, el doctor llenará el <strong>odontograma</strong> del paciente.</span>`;
    if (!conTrat) return;
    const pac = pacActual();
    const pend = pac ? KD.pendientePaciente(pac.id) : [];
    const selPrevio = f.tratamiento.value || (d.planId ? `plan:${d.planId}` : d.tratamientoId ? `t:${d.tratamientoId}` : "");
    f.tratamiento.innerHTML = `<option value="">Elige el tratamiento…</option>
      ${pend.length ? `<optgroup label="Pendiente en su plan">${pend.map((x) => `<option value="plan:${x.id}" ${selPrevio === `plan:${x.id}` ? "selected" : ""}>${KD.esc(KD.nombreTrat(x.tratamientoId))}${x.pieza ? ` · pieza ${KD.esc(x.pieza)}` : ""}${x.estado === "aceptado" ? " ✓ aceptado" : ""}</option>`).join("")}</optgroup>` : ""}
      <optgroup label="Catálogo">${KD.db.tratamientos.filter((t) => t.activo).map((t) => `<option value="t:${t.id}" ${selPrevio === `t:${t.id}` ? "selected" : ""}>${KD.esc(t.nombre)} · ${t.duracion} min</option>`).join("")}</optgroup>`;
  };
  pintarHoras();
  pintarTratamientos();
  f.sucursalId.addEventListener?.("change", () => {
    f.doctorId.innerHTML = opcionesDoc(f.sucursalId.value);
    f.unidad.innerHTML = KD.unidades(f.sucursalId.value).map((x) => `<option value="${x}">Unidad ${x}</option>`).join("");
    pintarHoras();
  });
  f.unidad.addEventListener("change", pintarHoras);
  f.fecha.addEventListener("change", pintarHoras);
  f.paciente.addEventListener("change", pintarTratamientos);
  f.tipoId.addEventListener("change", () => { f.duracion.value = String(KD.byId("tiposCita", f.tipoId.value).duracion); pintarTratamientos(); });
  f.tratamiento.addEventListener("change", () => {
    const [tipo, idv] = f.tratamiento.value.split(":");
    if (!idv) return;
    const trat = tipo === "plan" ? KD.byId("tratamientos", KD.byId("planes", idv).tratamientoId) : KD.byId("tratamientos", idv);
    if (tipo === "plan") f.piezas.value = KD.byId("planes", idv).pieza || "";
    if (trat && duraciones.includes(trat.duracion)) f.duracion.value = String(trat.duracion);
  });
  m.querySelector("[data-alta]")?.addEventListener("click", () => {
    const actual = { ...d, ...KD.leerForm(f) };
    KD.formPaciente(null, (p) => KD.formCita({ ...actual, id: existente?.id, pacienteId: p.id, unidad: Number(actual.unidad), duracion: Number(actual.duracion) }));
  });

  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const pac = pacActual();
    const aviso = m.querySelector("[data-aviso]");
    const mostrar = (msg) => { aviso.innerHTML = `${KD.icon("alerta", 16)} <span>${msg}</span>`; aviso.hidden = false; };
    if (!pac) { f.paciente.classList.add("invalido"); mostrar("Selecciona un paciente de la lista."); return; }
    const tipo = KD.byId("tiposCita", v.tipoId);
    let tratamientoId = "", planId = null;
    if (tipo?.tratamiento) {
      const [t, idv] = (v.tratamiento || "").split(":");
      if (!idv) { f.tratamiento.classList.add("invalido"); mostrar("Elige qué tratamiento se le va a hacer al paciente."); return; }
      if (t === "plan") { planId = idv; tratamientoId = KD.byId("planes", idv).tratamientoId; } else tratamientoId = idv;
    } else if (v.tipoId === "c4") tratamientoId = "t14";
    const piezas = tipo?.tratamiento ? KD.listaPiezas(v.piezas).join(", ") : "";
    const prueba = { id: existente?.id, pacienteId: pac.id, doctorId: v.doctorId, sucursalId: v.sucursalId, unidad: Number(v.unidad), fecha: v.fecha, hora: v.hora, duracion: Number(v.duracion) || 30 };
    const choqueUnidad = choqueCita(prueba, true);
    if (choqueUnidad) { mostrar(`${choqueUnidad} Elige otra hora u otra unidad.`); return; }
    const choqueDoc = choqueCita(prueba);
    if (choqueDoc && aviso.dataset.ok !== "1") { mostrar(`${choqueDoc} Presiona de nuevo para agendar de todos modos.`); aviso.dataset.ok = "1"; return; }
    const cita = existente || { id: KD.uid("ci"), estado: "programada" };
    Object.assign(cita, { ...prueba, id: cita.id, tipoId: v.tipoId, notas: v.notas, tratamientoId, piezas });
    if (planId) cita.planId = planId; else delete cita.planId;
    if (!tratamientoId) delete cita.tratamientoId;
    if (!piezas) delete cita.piezas;
    if (!existente) KD.db.citas.push(cita);
    KD.guardar();
    KD.cerrarModal();
    agEstado.fecha = cita.fecha;
    if (location.hash.startsWith("#/agenda")) KD.render(); else location.hash = "#/agenda";
    KD.toast(existente ? "Cita actualizada" : `Cita agendada · ${cita.hora} · Unidad ${cita.unidad}`);
  });
};
