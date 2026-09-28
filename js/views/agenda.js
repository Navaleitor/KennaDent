// Agenda por día: columnas por doctor (computadora) o lista (celular).
KD.vistas = KD.vistas || {};

const AG_INICIO = 8 * 60, AG_FIN = 20 * 60, AG_PX = 48 / 30; // 48px por cada 30 minutos
let agFecha = null;

KD.vistas.agenda = (main) => {
  agFecha = agFecha || KD.hoy();
  const sucIds = KD.sucursalesFiltro();
  const sucSel = sucIds.length === 1 ? sucIds[0] : (KD.db.sesion.agendaSuc && sucIds.includes(KD.db.sesion.agendaSuc) ? KD.db.sesion.agendaSuc : sucIds[0]);
  const u = KD.usuario();
  let doctores = KD.doctores([sucSel]);
  const citas = KD.db.citas.filter((c) => c.fecha === agFecha && c.sucursalId === sucSel);
  // Doctores que trabajan en varias sucursales: mostrar solo si tienen citas aquí ese día o si es su sucursal principal
  doctores = doctores.filter((d) => d.sucursales[0] === sucSel || citas.some((c) => c.doctorId === d.id));
  const movil = innerWidth < 760;
  const puedeEditar = KD.puede("agenda_editar");

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Agenda</h1><p>Sucursal ${KD.esc(KD.nombreSuc(sucSel))} · ${citas.filter((c) => c.estado !== "cancelada").length} citas</p></div>
      <div class="acciones">${puedeEditar ? `<button class="btn" data-nueva>${KD.icon("mas", 16)} Nueva cita</button>` : ""}</div>
    </div>
    <div class="agenda-barra">
      <button class="btn-icon" data-dia="-1" aria-label="Día anterior">${KD.icon("izq")}</button>
      <button class="btn btn-ghost btn-sm" data-dia="0">Hoy</button>
      <button class="btn-icon" data-dia="1" aria-label="Día siguiente">${KD.icon("der")}</button>
      <span class="fecha-txt">${KD.esc(KD.fmtFecha(agFecha, { weekday: "long", day: "numeric", month: "long" }))}</span>
      <input type="date" value="${agFecha}" aria-label="Elegir fecha" data-fecha>
      <span class="espacio"></span>
      ${sucIds.length > 1 ? `<select data-suc aria-label="Sucursal de la agenda" style="width:auto">${KD.opciones(KD.db.sucursales.filter((s) => sucIds.includes(s.id)), sucSel)}</select>` : ""}
    </div>
    <div class="card">${movil ? listaAgenda(citas) : gridAgenda(doctores, citas)}</div>
    ${movil ? "" : `<div class="leyenda">
      <span style="--c:var(--primary)">Programada / confirmada</span>
      <span style="--c:var(--warn)">En sala de espera</span>
      <span style="--c:var(--ok)">Atendida</span>
      <span style="--c:var(--muted)">No asistió / cancelada</span>
    </div>`}`;

  main.querySelectorAll("[data-dia]").forEach((b) => b.addEventListener("click", () => {
    const n = Number(b.dataset.dia);
    agFecha = n === 0 ? KD.hoy() : KD.sumarDias(agFecha, n);
    KD.vistas.agenda(main);
  }));
  main.querySelector("[data-fecha]").addEventListener("change", (e) => { if (e.target.value) { agFecha = e.target.value; KD.vistas.agenda(main); } });
  main.querySelector("[data-suc]")?.addEventListener("change", (e) => { KD.db.sesion.agendaSuc = e.target.value; KD.guardar(); KD.vistas.agenda(main); });
  main.querySelector("[data-nueva]")?.addEventListener("click", () => KD.formCita({ fecha: agFecha, sucursalId: sucSel }));
  main.querySelectorAll("[data-cita]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); KD.detalleCita(el.dataset.cita); }));
  if (puedeEditar) main.querySelectorAll("[data-slot]").forEach((el) => el.addEventListener("click", () =>
    KD.formCita({ fecha: agFecha, sucursalId: sucSel, doctorId: el.dataset.doc, hora: el.dataset.slot })));

  const grid = main.querySelector(".agenda-grid-wrap");
  if (grid) {
    const ahora = new Date().getHours() * 60 + new Date().getMinutes();
    grid.scrollTop = Math.max(0, ((agFecha === KD.hoy() ? ahora : 9 * 60) - AG_INICIO - 60) * AG_PX);
  }
};

function gridAgenda(doctores, citas) {
  if (!doctores.length) return KD.vacio("No hay doctores asignados a esta sucursal.");
  const horas = [];
  for (let t = AG_INICIO; t < AG_FIN; t += 30) horas.push(t);
  const ahora = new Date().getHours() * 60 + new Date().getMinutes();
  const lineaAhora = agFecha === KD.hoy() && ahora >= AG_INICIO && ahora <= AG_FIN
    ? `<div class="agenda-ahora" style="top:${(ahora - AG_INICIO) * AG_PX}px"></div>` : "";
  return `<div class="agenda-grid-wrap"><div class="agenda-grid" style="grid-template-columns: 56px repeat(${doctores.length}, minmax(170px, 1fr))">
    <div class="agenda-cab agenda-horas" style="z-index:4"></div>
    ${doctores.map((d) => `<div class="agenda-cab">${KD.esc(d.nombre)}<small>${KD.esc(d.especialidad || KD.puesto(d.puesto).nombre)}</small></div>`).join("")}
    <div class="agenda-horas">${horas.map((t) => `<div>${t % 60 === 0 ? KD.aHora(t) : ""}</div>`).join("")}</div>
    ${doctores.map((d) => `<div class="agenda-col">
      ${horas.map((t) => `<div class="slot" data-slot="${KD.aHora(t)}" data-doc="${d.id}" title="${KD.aHora(t)}"></div>`).join("")}
      ${citas.filter((c) => c.doctorId === d.id).map(bloqueCita).join("")}
      ${lineaAhora}
    </div>`).join("")}
  </div></div>`;
}

function bloqueCita(c) {
  const p = KD.byId("pacientes", c.pacienteId);
  const top = (KD.aMinutos(c.hora) - AG_INICIO) * AG_PX;
  const h = Math.max(22, c.duracion * AG_PX - 3);
  return `<div class="agenda-cita st-${c.estado}" data-cita="${c.id}" style="top:${top + 1}px;height:${h}px" title="${KD.esc(p?.nombre)} · ${c.hora}">
    <strong>${c.hora} ${KD.esc(p?.nombre)}</strong>
    ${h > 40 ? `<small>${KD.esc((KD.byId("tiposCita", c.tipoId) || {}).nombre)}</small>` : ""}
  </div>`;
}

function listaAgenda(citas) {
  const orden = citas.slice().sort((a, b) => a.hora.localeCompare(b.hora));
  if (!orden.length) return KD.vacio("No hay citas este día.");
  return `<ul class="lista">${orden.map((c) => {
    const p = KD.byId("pacientes", c.pacienteId);
    return `<li data-cita="${c.id}" style="cursor:pointer">
      <span class="hora">${c.hora}</span>
      <span class="info"><strong>${KD.esc(p?.nombre)}</strong><small>${KD.esc((KD.byId("tiposCita", c.tipoId) || {}).nombre)} · ${KD.esc(KD.nombreUsuario(c.doctorId))} · ${c.duracion} min</small></span>
      ${KD.badgeEstadoCita(c.estado)}
    </li>`;
  }).join("")}</ul>`;
}

// ---------- Detalle de cita ----------
KD.detalleCita = (id) => {
  const c = KD.byId("citas", id);
  const p = KD.byId("pacientes", c.pacienteId);
  const editar = KD.puede("agenda_editar");
  const m = KD.modal({
    titulo: "Detalle de la cita",
    cuerpo: `
      <dl class="detalle-dl">
        <dt>Paciente</dt><dd><strong>${KD.esc(p.nombre)}</strong> · ${KD.esc(p.expediente)}</dd>
        <dt>Teléfono</dt><dd>${KD.esc(p.telefono)} · <a href="${KD.waLink(p.telefono)}" target="_blank" rel="noopener">WhatsApp</a></dd>
        <dt>Fecha y hora</dt><dd>${KD.esc(KD.fmtFecha(c.fecha, { weekday: "long", day: "numeric", month: "long" }))}, ${c.hora} (${c.duracion} min)</dd>
        <dt>Tipo</dt><dd>${KD.esc((KD.byId("tiposCita", c.tipoId) || {}).nombre)}</dd>
        <dt>Doctor</dt><dd>${KD.esc(KD.nombreUsuario(c.doctorId))}</dd>
        <dt>Sucursal</dt><dd>${KD.esc(KD.nombreSuc(c.sucursalId))}</dd>
        <dt>Estado</dt><dd>${KD.badgeEstadoCita(c.estado)}</dd>
        ${c.notas ? `<dt>Notas</dt><dd>${KD.esc(c.notas)}</dd>` : ""}
        ${p.alergias ? `<dt>Alergias</dt><dd class="badge bad">${KD.esc(p.alergias)}</dd>` : ""}
      </dl>
      ${editar ? `<p class="muted" style="margin-bottom:6px">Cambiar estado:</p>
      <div class="estado-botones">${Object.entries(KD.ESTADOS_CITA).filter(([k]) => k !== c.estado)
        .map(([k, v]) => `<button class="btn btn-ghost btn-sm" data-estado="${k}">${v}</button>`).join("")}</div>` : ""}`,
    acciones: `
      ${KD.puede("pacientes_ver") ? `<a class="btn btn-ghost" href="#/pacientes/${p.id}" data-cerrar>Ver expediente</a>` : ""}
      ${KD.puede("historial_editar") && c.estado !== "atendida" ? `<button class="btn btn-ghost" data-consulta>Registrar consulta</button>` : ""}
      ${editar ? `<button class="btn" data-editar>${KD.icon("editar", 16)} Editar</button>` : ""}`,
  });
  m.querySelectorAll("[data-estado]").forEach((b) => b.addEventListener("click", () => {
    c.estado = b.dataset.estado; KD.guardar(); KD.cerrarModal(); KD.render();
    KD.toast(`Cita marcada como "${KD.ESTADOS_CITA[c.estado]}"`);
  }));
  m.querySelector("[data-editar]")?.addEventListener("click", () => KD.formCita(c));
  m.querySelector("[data-consulta]")?.addEventListener("click", () => KD.formConsulta(p.id, c));
};

// ---------- Alta / edición de cita ----------
KD.formCita = (datos) => {
  const existente = datos.id ? datos : null;
  const d = { fecha: KD.hoy(), hora: "10:00", tipoId: "c1", duracion: 30, estado: "programada", notas: "", ...datos };
  const sucs = KD.sucursalesUsuario();
  d.sucursalId = d.sucursalId || KD.sucursalesFiltro()[0];
  const pacientes = KD.db.pacientes.filter((p) => p.activo);
  const pacSel = d.pacienteId ? KD.byId("pacientes", d.pacienteId) : null;
  const opcionesDoc = (sucId) => KD.opciones(KD.doctores([sucId]).map((x) => ({ id: x.id, nombre: `${x.nombre}${x.especialidad ? " (" + x.especialidad + ")" : ""}` })), d.doctorId);

  const m = KD.modal({
    titulo: existente ? "Editar cita" : "Nueva cita",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Paciente <em>*</em></span>
        <input name="paciente" list="lista-pacientes" required placeholder="Busca por nombre o expediente" value="${pacSel ? KD.esc(`${pacSel.nombre} · ${pacSel.expediente}`) : ""}" autocomplete="off">
        <datalist id="lista-pacientes">${pacientes.map((p) => `<option value="${KD.esc(`${p.nombre} · ${p.expediente}`)}">`).join("")}</datalist>
        ${KD.puede("pacientes_editar") ? `<span class="ayuda">¿Es nuevo? <button type="button" class="btn-link" data-alta>Dar de alta al paciente</button></span>` : ""}
      </label>
      <label class="campo"><span>Sucursal</span><select name="sucursalId">${KD.opciones(sucs, d.sucursalId)}</select></label>
      <label class="campo"><span>Doctor <em>*</em></span><select name="doctorId" required>${opcionesDoc(d.sucursalId)}</select></label>
      <label class="campo"><span>Fecha <em>*</em></span><input type="date" name="fecha" value="${d.fecha}" required></label>
      <label class="campo"><span>Hora <em>*</em></span><input type="time" name="hora" value="${d.hora}" step="900" required></label>
      <label class="campo"><span>Tipo de cita</span><select name="tipoId">${KD.opciones(KD.db.tiposCita, d.tipoId)}</select></label>
      <label class="campo"><span>Duración (min)</span><input type="number" name="duracion" min="15" step="15" value="${d.duracion}"></label>
      <label class="campo full"><span>Notas</span><textarea name="notas" rows="2" placeholder="Motivo, indicaciones para recepción…">${KD.esc(d.notas)}</textarea></label>
      <p class="full muted" data-aviso style="margin:0"></p>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>Guardar cita</button>`,
  });
  const f = m.querySelector("form");
  f.sucursalId.addEventListener("change", () => { f.doctorId.innerHTML = opcionesDoc(f.sucursalId.value); });
  f.tipoId.addEventListener("change", () => { f.duracion.value = KD.byId("tiposCita", f.tipoId.value).duracion; });
  m.querySelector("[data-alta]")?.addEventListener("click", () => KD.formPaciente(null, (p) => KD.formCita({ ...d, ...KD.leerForm(f), pacienteId: p.id })));

  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const pac = pacientes.find((p) => `${p.nombre} · ${p.expediente}` === v.paciente) || pacientes.find((p) => p.expediente === v.paciente.toUpperCase());
    if (!pac) { f.paciente.classList.add("invalido"); KD.toast("Selecciona un paciente de la lista."); return; }
    const ini = KD.aMinutos(v.hora), fin = ini + Number(v.duracion);
    const choque = KD.db.citas.find((c) => c.id !== existente?.id && c.doctorId === v.doctorId && c.fecha === v.fecha &&
      !["cancelada", "no_asistio"].includes(c.estado) && KD.aMinutos(c.hora) < fin && KD.aMinutos(c.hora) + c.duracion > ini);
    const aviso = m.querySelector("[data-aviso]");
    if (choque && aviso.dataset.ok !== "1") {
      aviso.innerHTML = `<span class="badge warn">${KD.icon("alerta", 14)} El doctor ya tiene una cita a las ${choque.hora}.</span> Presiona "Guardar cita" otra vez para agendar de todos modos.`;
      aviso.dataset.ok = "1";
      return;
    }
    const cita = existente || { id: KD.uid("ci"), estado: "programada" };
    Object.assign(cita, {
      pacienteId: pac.id, doctorId: v.doctorId, sucursalId: v.sucursalId, fecha: v.fecha, hora: v.hora,
      duracion: Number(v.duracion) || 30, tipoId: v.tipoId, notas: v.notas,
    });
    if (!existente) KD.db.citas.push(cita);
    KD.guardar();
    KD.cerrarModal();
    agFecha = cita.fecha;
    KD.render();
    KD.toast(existente ? "Cita actualizada" : "Cita agendada");
  });
};
