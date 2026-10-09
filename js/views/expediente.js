// Ficha del paciente: resumen, resumen clínico, historial clínico (odontograma), presupuestos, pagos y citas.
KD.vistas = KD.vistas || {};

const odoSel = { paciente: null, piezas: new Set(), multiple: false };

KD.vistas.expediente = (main, partes) => {
  const p = KD.byId("pacientes", partes[0]);
  if (!p) { main.innerHTML = KD.vacio("Paciente no encontrado.", "alerta"); return; }
  const verHist = KD.puede("historial_ver");
  const dinero = KD.verDinero();
  const tabs = [
    ["resumen", "Resumen"],
    verHist && ["clinico", "Resumen clínico"],
    verHist && ["historial", "Historial clínico"],
    (verHist || KD.puede("presupuestos")) && ["presupuestos", dinero ? "Presupuestos" : "Plan de tratamiento"],
    dinero && ["pagos", "Pagos"],
    ["citas", "Citas"],
  ].filter(Boolean);
  const tab = tabs.some(([k]) => k === partes[1]) ? partes[1] : "resumen";
  const pend = KD.pendientePaciente(p.id);
  const citaHoy = KD.citaParaRegistrar(p.id);
  const clinico = KD.puede("clinico_editar");
  if (odoSel.paciente !== p.id) { odoSel.paciente = p.id; odoSel.piezas = new Set(); odoSel.multiple = false; }

  main.innerHTML = `
    <div class="ficha-top">
      <button class="btn btn-ghost btn-sm" data-regresar>${KD.icon("regresar", 16)} Regresar</button>
      <div class="acciones">
        ${KD.puede("pacientes_editar") || clinico ? `<button class="btn-icon" data-editar title="Editar datos" aria-label="Editar datos">${KD.icon("editar", 17)}</button>` : ""}
        ${KD.puede("pacientes_editar") ? `<button class="btn-icon ${p.activo ? "peligro" : ""}" data-baja title="${p.activo ? "Dar de baja" : "Reactivar"}" aria-label="${p.activo ? "Dar de baja" : "Reactivar"}">${KD.icon(p.activo ? "basura" : "check", 17)}</button>` : ""}
      </div>
    </div>
    <div class="ficha-cab">
      ${KD.avatar(p.nombre, undefined, true)}
      <div class="datos">
        <span class="eyebrow">Paciente · ${KD.esc(p.expediente)}</span>
        <h1>${KD.esc(p.nombre)}</h1>
        <div class="meta"><span>${KD.edad(p.nacimiento)} años</span><span>${KD.esc(p.telefono)}</span><span>Sucursal ${KD.esc(KD.nombreSuc(p.sucursalId))}</span><span>Paciente desde ${KD.esc(KD.fmtFecha(p.alta))}</span></div>
        ${p.alergias ? `<div class="alerta-med">${KD.icon("alerta", 16)} Alergias: ${KD.esc(p.alergias)}</div>` : ""}
      </div>
      ${p.activo ? KD.punto("Activo", "activo-pill") : KD.punto(`Dado de baja ${KD.fmtFecha(p.baja)}`, "cita-no_asistio")}
    </div>
    ${p.datosClinicos === false ? `<div class="aviso-inline">${KD.icon("alerta", 20)}<span><strong>Faltan los datos clínicos.</strong> ${clinico ? "Captura alergias y antecedentes médicos antes de atenderlo." : "Recepción ya avisó al doctor: él capturará alergias y antecedentes."}</span>
      ${clinico ? `<button class="btn btn-sm" data-editar>Completar datos clínicos</button>` : ""}</div>` : ""}
    ${citaHoy ? `<div class="aviso-inline" style="background:var(--info-soft)">${KD.icon("agenda", 20)}<span>Tienes una cita con este paciente hoy a las <strong>${citaHoy.hora}</strong> (Unidad ${citaHoy.unidad}). Al terminar, llena el registro de la consulta.</span>
      <button class="btn btn-sm" data-consulta>${KD.icon("presupuestos", 15)} Registrar consulta</button></div>` : ""}
    <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<a role="tab" href="#/pacientes/${p.id}/${k}" class="${k === tab ? "activo" : ""}" aria-selected="${k === tab}">${n}${k === "presupuestos" && pend.length ? `<em>${pend.length}</em>` : ""}</a>`).join("")}</div>
    <div data-panel></div>`;

  const panel = main.querySelector("[data-panel]");
  ({ resumen: tabResumen, clinico: tabClinico, historial: tabOdontograma, presupuestos: tabPresupuestos, pagos: tabPagos, citas: tabCitas })[tab](panel, p);

  main.querySelector("[data-regresar]").addEventListener("click", () => {
    if (history.length > 1 && document.referrer !== location.href) history.back(); else location.hash = "#/pacientes";
  });
  main.querySelectorAll("[data-consulta]").forEach((b) => b.addEventListener("click", () => KD.formConsulta(citaHoy)));
  main.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", () => KD.formPaciente(p)));
  main.querySelector("[data-baja]")?.addEventListener("click", () => {
    if (!p.activo) { p.activo = true; delete p.baja; KD.guardar(); KD.render(); KD.toast("Paciente reactivado"); return; }
    KD.confirmar("Dar de baja al paciente",
      `<strong>${KD.esc(p.nombre)}</strong> ya no aparecerá en las búsquedas ni se le podrán agendar citas. Su expediente clínico se conserva (la NOM-004-SSA3-2012 exige guardarlo al menos 5 años) y se puede reactivar en cualquier momento.`,
      "Dar de baja", () => { p.activo = false; p.baja = KD.hoy(); KD.guardar(); KD.render(); KD.toast("Paciente dado de baja"); });
  });
};

// ---------- Resumen ----------
function tabResumen(panel, p) {
  const dinero = KD.verDinero();
  const items = KD.planesPaciente(p.id).filter((x) => x.estado === "pendiente" || x.estado === "aceptado");
  const prog = KD.progresoPaciente(p.id);
  const ultima = KD.consultasPaciente(p.id).slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const prox = KD.proximaCita(p.id);
  const citaHoy = KD.citaParaRegistrar(p.id);
  panel.innerHTML = `
    <div class="acciones" style="margin-bottom:18px">
      <a class="btn btn-soft" href="${KD.waLink(p.telefono)}" target="_blank" rel="noopener">${KD.icon("telefono", 16)} Contactar</a>
      ${KD.puede("agenda_editar") && p.activo ? `<button class="btn" data-cita>${KD.icon("agenda", 16)} Agendar cita</button>` : ""}
      ${citaHoy ? `<button class="btn" data-consulta2>${KD.icon("presupuestos", 16)} Registrar consulta</button>` : ""}
    </div>
    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><div><span class="eyebrow">Plan activo</span><h2>Progreso del tratamiento</h2></div></div>
        ${prog.total ? `<div class="progreso-plan">
          <div class="pp-top"><strong>${prog.hechos} de ${prog.total} tratamientos realizados</strong><b>${Math.round(prog.pct * 100)}%</b></div>
          ${KD.progreso(prog.pct)}
          <div class="pp-pasos"><span>${KD.icon("check", 13)} Realizados: ${prog.hechos}</span><span>Por realizar: ${prog.total - prog.hechos}</span>
            ${dinero ? `<span>${KD.fmtDinero(prog.montoHecho)} de ${KD.fmtDinero(prog.montoTotal)} presupuestado</span>` : ""}</div>
        </div>` : KD.vacio("Sin tratamientos presupuestados todavía.", "tratamientos")}
        <div class="card-head" style="border-top:1px solid var(--border)"><div><span class="eyebrow">Plan pendiente</span><h2>Tratamientos por realizar</h2></div></div>
        ${items.length ? items.map((x) => `<div class="plan-item"><div><strong>${KD.esc(KD.nombreTrat(x.tratamientoId))}</strong><small>${x.pieza ? `Pieza ${KD.esc(x.pieza)} · ` : ""}Recomendó ${KD.esc(KD.nombreUsuario(x.doctorId))} · ${KD.esc(KD.fmtFecha(x.fecha))}</small></div>
          <div class="acciones">${dinero ? `<span class="mono">${KD.fmtDinero(x.precio)}</span>` : ""}${KD.badgeEstadoPlan(x.estado)}</div></div>`).join("")
          : KD.vacio("No hay tratamientos pendientes registrados.", "tratamientos")}
      </section>
      <div class="apilado">
        <section class="card">
          <div class="card-head"><div><span class="eyebrow">Datos generales</span><h2>Contacto y datos médicos</h2></div></div>
          <div class="card-body"><div class="datos-grid">
            <div><small>Teléfono / WhatsApp</small><b>${KD.esc(p.telefono)}</b></div>
            <div><small>Correo</small><b>${KD.esc(p.email) || "—"}</b></div>
            <div><small>Nacimiento</small><b>${KD.esc(KD.fmtFecha(p.nacimiento))} · ${KD.edad(p.nacimiento)} años</b></div>
            <div><small>Sexo</small><b>${p.sexo === "F" ? "Femenino" : p.sexo === "M" ? "Masculino" : "—"}</b></div>
            <div><small>Sucursal habitual</small><b>${KD.esc(KD.nombreSuc(p.sucursalId))}</b></div>
            <div><small>Dentición</small><b>${KD.esc(KD.NOMBRE_DENTICION[KD.denticion(p)].split(" · ")[0])}</b></div>
            <div><small>Alergias</small><b ${p.alergias ? 'style="color:var(--bad)"' : ""}>${KD.esc(p.alergias) || (p.datosClinicos === false ? "Por capturar" : "Ninguna")}</b></div>
            ${KD.puede("historial_ver") ? `<div><small>Antecedentes médicos</small><b>${KD.esc(p.antecedentes) || (p.datosClinicos === false ? "Por capturar" : "Ninguno")}</b></div>` : ""}
          </div></div>
        </section>
        <section class="card">
          <div class="card-head"><div><span class="eyebrow">Agenda</span><h2>Próxima cita</h2></div></div>
          <div class="card-body">${prox ? `<div class="evolucion" style="padding:0;border:0">${cuadroFecha(prox.fecha)}<div class="ev-txt"><strong>${KD.esc(KD.tratamientoCita(prox))}</strong>
            <div class="ev-meta">${prox.hora} · Unidad ${prox.unidad} · ${KD.esc(KD.nombreSuc(prox.sucursalId))} · <span class="color-punto" style="--c:${KD.colorUsuario(prox.doctorId)}"></span>${KD.esc(KD.nombreUsuario(prox.doctorId))} ${KD.badgeEstadoCita(prox.estado)}</div></div></div>`
            : `<p class="rojo-txt" style="margin:0">Sin próxima cita agendada.</p>`}</div>
        </section>
      </div>
      ${KD.puede("historial_ver") ? `<section class="card span-2">
        <div class="card-head"><div><span class="eyebrow">Estado clínico</span><h2>Última evolución</h2></div><a class="btn-link" href="#/pacientes/${p.id}/clinico">Ver resumen clínico ${KD.icon("der", 14)}</a></div>
        ${ultima ? bloqueEvolucion(ultima, false) : KD.vacio("Aún no hay consultas registradas.", "presupuestos")}
      </section>` : ""}
    </div>`;
  panel.querySelector("[data-cita]")?.addEventListener("click", () => KD.formCita({ pacienteId: p.id, sucursalId: KD.sucursalUnica() }));
  panel.querySelector("[data-consulta2]")?.addEventListener("click", () => KD.formConsulta(citaHoy));
}

const cuadroFecha = (f) => `<div class="fecha-cuadro"><strong>${Number(f.slice(8))}</strong><small>${KD.esc(KD.fmtFecha(f, { month: "short" }).replace(".", ""))}</small><small>${f.slice(0, 4)}</small></div>`;

// Motivo, diagnóstico, lo que se hizo, lo recomendado y la nota del doctor
function detalleConsulta(c) {
  const dinero = KD.verDinero();
  const recomendados = KD.db.planes.filter((x) => x.consultaId === c.id);
  const hechos = c.procedimientos.map((x) => `${KD.nombreTrat(x.tratamientoId)}${x.pieza ? ` · pieza ${x.pieza}` : ""}${dinero ? ` · ${KD.fmtDinero(x.precio)}` : ""}`);
  return `<dl>
    ${c.motivo ? `<dt>Motivo</dt><dd>${KD.esc(c.motivo)}</dd>` : ""}
    ${c.diagnostico ? `<dt>Diagnóstico</dt><dd>${KD.esc(c.diagnostico)}</dd>` : ""}
    <dt>Se realizó</dt><dd>${hechos.length ? hechos.map(KD.esc).join("<br>") : "Revisión sin procedimientos"}</dd>
    ${recomendados.length ? `<dt>Recomendado</dt><dd><div class="chips">${recomendados.map((x) => KD.badge(`${KD.nombreTrat(x.tratamientoId)}${x.pieza ? " · " + x.pieza : ""}`)).join("")}</div></dd>` : ""}
    ${c.notas ? `<dt>Nota del doctor</dt><dd>${KD.esc(c.notas)}</dd>` : ""}
  </dl>`;
}

function bloqueEvolucion(c, detalle = true) {
  const titulo = c.motivo || (c.procedimientos[0] ? KD.nombreTrat(c.procedimientos[0].tratamientoId) : "Consulta");
  const resumen = c.procedimientos.map((x) => `${KD.nombreTrat(x.tratamientoId)}${x.pieza ? ` · pieza ${x.pieza}` : ""}`).join(" · ");
  return `<div class="evolucion">${cuadroFecha(c.fecha)}<div class="ev-txt">
    <strong>${KD.esc(titulo)}</strong>
    ${detalle ? detalleConsulta(c) : `<p>${KD.esc([c.diagnostico, resumen].filter(Boolean).join(" · ") || "Revisión")}</p>`}
    <div class="ev-meta">${KD.avatar(KD.nombreUsuario(c.doctorId), KD.colorUsuario(c.doctorId))}<span>${KD.esc(KD.nombreUsuario(c.doctorId))} · Sucursal ${KD.esc(KD.nombreSuc(c.sucursalId))}</span></div>
  </div></div>`;
}

// ---------- Resumen clínico: citas y registros del doctor en línea de tiempo (Issue #8) ----------
let clinFiltro = "todo";
function tabClinico(panel, p) {
  const citas = KD.citasPaciente(p.id).slice().sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  const sueltas = KD.consultasPaciente(p.id).filter((c) => !c.citaId);
  const n = (e) => citas.filter((c) => c.estado === e).length;
  const hoy = KD.hoy();
  const lista = citas.filter((c) => clinFiltro === "todo" || (clinFiltro === "atendidas" ? c.estado === "atendida" : c.fecha >= hoy && ["programada", "confirmada", "en_sala"].includes(c.estado)));
  panel.innerHTML = `
    <div class="kpis">
      <div class="card kpi"><span class="etq">Citas agendadas</span><div class="valor">${citas.length}</div></div>
      <div class="card kpi"><span class="etq">Asistió</span><div class="valor">${n("atendida")}</div></div>
      <div class="card kpi"><span class="etq">No asistió</span><div class="valor">${n("no_asistio")}</div></div>
      <div class="card kpi"><span class="etq">Canceladas</span><div class="valor">${n("cancelada")}</div></div>
    </div>
    <section class="card">
      <div class="card-head"><div><span class="eyebrow">Datos clínicos</span><h2>Resumen clínico</h2><p>Cada cita con su estado y la nota del doctor que atendió.</p></div>
        <div class="segmentado">${[["todo", "Todo"], ["atendidas", "Atendidas"], ["proximas", "Próximas"]].map(([k, t]) => `<button data-f="${k}" class="${clinFiltro === k ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      ${lista.length || sueltas.length ? lista.map((c) => {
        const cons = KD.consultaDeCita(c.id);
        const sinReg = !cons && c.estado !== "no_asistio" && c.estado !== "cancelada" && (c.fecha < hoy || (c.fecha === hoy && KD.finCita(c) <= KD.ahoraMin()));
        return `<div class="evolucion">${cuadroFecha(c.fecha)}<div class="ev-txt">
          <strong>${KD.esc(KD.tratamientoCita(c))}${c.piezas ? ` · pieza(s) ${KD.esc(c.piezas)}` : ""}</strong> ${KD.badgeEstadoCita(c.estado)} ${sinReg ? KD.badge("Falta registro del doctor", "bad") : ""}
          <div class="ev-meta">${c.hora} · Unidad ${c.unidad || 1} · Sucursal ${KD.esc(KD.nombreSuc(c.sucursalId))} · <span class="color-punto" style="--c:${KD.colorUsuario(c.doctorId)}"></span>${KD.esc(KD.nombreUsuario(c.doctorId))}</div>
          ${c.cancelacion ? `<div class="ev-meta">Motivo: ${KD.textoBaja(c.cancelacion)}</div>` : ""}
          ${cons ? detalleConsulta(cons) : ""}
          ${KD.puedeRegistrar(c) ? `<button class="btn btn-sm" style="margin-top:10px" data-registrar="${c.id}">${KD.icon("presupuestos", 15)} Registrar consulta</button>` : ""}
        </div></div>`;
      }).join("") + (clinFiltro === "todo" ? sueltas.map((c) => bloqueEvolucion(c)).join("") : "") : KD.vacio("Sin registros con este filtro.", "presupuestos")}
    </section>`;
  panel.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { clinFiltro = b.dataset.f; tabClinico(panel, p); }));
  panel.querySelectorAll("[data-registrar]").forEach((b) => b.addEventListener("click", () => KD.formConsulta(KD.byId("citas", b.dataset.registrar))));
}

// ---------- Historial clínico: odontograma mexicano ----------
function tabOdontograma(panel, p) {
  const editar = KD.puede("clinico_editar");
  const den = KD.denticion(p);
  const hallazgos = KD.odontoHallazgos(p);
  const planes = KD.planesPaciente(p.id);
  const log = KD.odonto(p).log.slice().reverse();
  const sinPres = planes.filter((x) => x.estado === "pendiente" && !x.presupuestoId);
  const enPlan = (pieza, trat) => planes.find((x) => x.pieza && KD.listaPiezas(x.pieza).includes(pieza) && x.tratamientoId === trat && ["pendiente", "aceptado"].includes(x.estado));

  panel.innerHTML = `
    <section class="card odo-card">
      <div class="sec-head" style="margin-top:0"><div><span class="eyebrow">Mapa dental</span><h2>Odontograma</h2>
        <p class="muted" style="margin:4px 0 0;font-size:13px">Dentición ${KD.esc(KD.NOMBRE_DENTICION[den])} · detectada con la fecha de nacimiento (${KD.edad(p.nacimiento)} años).</p></div>
        ${editar ? `<label class="checks" style="display:flex"><input type="checkbox" data-multiple ${odoSel.multiple ? "checked" : ""}> Seleccionar varias piezas</label>` : ""}</div>
      ${KD.odontogramaHTML(p, odoSel.piezas)}
      ${KD.leyendaOdontograma()}
      <div data-pieza-panel></div>
    </section>

    ${KD.seccion("Diagnósticos registrados", `${hallazgos.length} pieza${hallazgos.length === 1 ? "" : "s"} con hallazgos`,
      `<div class="acciones">${KD.puede("presupuestos") && sinPres.length ? `<button class="btn" data-generar>${KD.icon("presupuestos", 16)} Generar presupuesto (${sinPres.length})</button>` : ""}</div>`)}
    <section class="card">${hallazgos.length ? hallazgos.map((h) => {
      const plan = h.sugerido ? enPlan(h.pieza, h.sugerido) : null;
      return `<div class="hallazgo-fila">
        <span class="pieza-cuadro ${h.rojo ? "" : "azul"}">${h.pieza}</span>
        <div><strong>${h.textos.map((t) => `<span class="${t.color === "rojo" ? "h-rojo" : "h-azul"}">${KD.esc(t.texto)}</span>`).join(" · ")}</strong>
          <small class="muted" style="display:block">${KD.esc(KD.nombrePieza(h.pieza))}${h.nota ? ` · ${KD.esc(h.nota)}` : ""}</small></div>
        <div>${h.sugerido ? `<small class="muted" style="display:block">Tratamiento sugerido</small><strong>${KD.esc(KD.nombreTrat(h.sugerido))}</strong>${KD.verDinero() ? ` <span class="mono muted">${KD.fmtDinero(KD.byId("tratamientos", h.sugerido)?.precio)}</span>` : ""}` : '<span class="muted">Sin tratamiento pendiente</span>'}</div>
        <div class="acciones">${plan ? KD.badgeEstadoPlan(plan.estado) : h.sugerido && editar ? `<button class="btn btn-ghost btn-sm" data-al-plan="${h.pieza}">${KD.icon("mas", 14)} Agregar al plan</button>` : ""}
          ${plan && KD.puede("agenda_editar") ? `<button class="btn-icon chico" data-agendar="${plan.id}" title="Agendar tratamiento" aria-label="Agendar tratamiento">${KD.icon("agenda", 15)}</button>` : ""}</div>
      </div>`;
    }).join("") : KD.vacio("No hay diagnósticos en este odontograma. Selecciona una pieza para registrar su estado.", "diente")}</section>

    ${KD.seccion("Historial de atención", "Cambios en el odontograma")}
    <section class="card">${log.length ? log.slice(0, 40).map((e) => `<div class="plan-item"><div><strong>Pieza ${KD.esc(e.pieza)} · ${KD.esc(e.texto)}</strong><small>${KD.esc(KD.fmtFecha(e.fecha))} · ${KD.esc(KD.nombreUsuario(e.usuarioId))}</small></div>
      <span class="pieza-cuadro ${/Tratamiento|Resina|colocad|realizad/.test(e.texto) ? "azul" : ""}">${KD.esc(e.pieza)}</span></div>`).join("")
      : KD.vacio("Aún no hay tratamientos registrados en el odontograma.")}</section>`;

  const pintarPanel = () => panelPieza(panel.querySelector("[data-pieza-panel]"), p, editar, () => tabOdontograma(panel, p));
  pintarPanel();
  panel.querySelectorAll(".odontograma .diente").forEach((b) => b.addEventListener("click", () => {
    const pz = b.dataset.pieza;
    if (odoSel.multiple) { odoSel.piezas.has(pz) ? odoSel.piezas.delete(pz) : odoSel.piezas.add(pz); }
    else odoSel.piezas = odoSel.piezas.has(pz) && odoSel.piezas.size === 1 ? new Set() : new Set([pz]);
    panel.querySelectorAll(".odontograma .diente").forEach((x) => { x.classList.toggle("sel", odoSel.piezas.has(x.dataset.pieza)); x.setAttribute("aria-pressed", odoSel.piezas.has(x.dataset.pieza)); });
    pintarPanel();
  }));
  panel.querySelector("[data-multiple]")?.addEventListener("change", (e) => { odoSel.multiple = e.target.checked; if (!odoSel.multiple && odoSel.piezas.size > 1) odoSel.piezas = new Set(); tabOdontograma(panel, p); });
  panel.querySelectorAll("[data-al-plan]").forEach((b) => b.addEventListener("click", () => {
    agregarAlPlan(p, [b.dataset.alPlan]);
    tabOdontograma(panel, p);
  }));
  panel.querySelectorAll("[data-agendar]").forEach((b) => b.addEventListener("click", () => {
    const it = KD.byId("planes", b.dataset.agendar);
    KD.formCita({ pacienteId: p.id, sucursalId: KD.sucursalUnica(), tipoId: "c3", planId: it.id, tratamientoId: it.tratamientoId, piezas: it.pieza, duracion: KD.byId("tratamientos", it.tratamientoId)?.duracion || 60 });
  }));
  panel.querySelector("[data-generar]")?.addEventListener("click", () => KD.formPresupuesto({ pacienteId: p.id, planIds: sinPres.map((x) => x.id) }));
}

// Crea en el plan de tratamiento lo sugerido por el odontograma para esas piezas
function agregarAlPlan(p, piezas) {
  const u = KD.usuario();
  const od = KD.odonto(p).piezas;
  let n = 0;
  for (const pz of piezas) {
    const t = KD.tratamientoSugerido(pz, od[pz]);
    if (!t) continue;
    const ya = KD.planesPaciente(p.id).some((x) => x.tratamientoId === t && KD.listaPiezas(x.pieza).includes(pz) && ["pendiente", "aceptado"].includes(x.estado));
    if (ya) continue;
    const trat = KD.byId("tratamientos", t);
    KD.db.planes.push({ id: KD.uid("pl"), pacienteId: p.id, doctorId: KD.esDoctor(u) ? u.id : (KD.doctores()[0]?.id || u.id), sucursalId: KD.sucursalUnica(), consultaId: null,
      fecha: KD.hoy(), tratamientoId: t, pieza: pz, precio: trat?.precio || 0, estado: "pendiente", fechaEstado: KD.hoy() });
    n++;
  }
  KD.guardar();
  KD.toast(n ? `${n} tratamiento(s) agregados al plan del paciente` : "Esas piezas ya están en el plan o no tienen tratamiento sugerido.", n ? "" : "bad");
}

function panelPieza(cont, p, editar, refrescar) {
  const sel = [...odoSel.piezas];
  if (!sel.length) { cont.innerHTML = `<div class="panel-pieza"><span class="eyebrow">Pieza seleccionada</span><p class="muted" style="margin:0">${editar ? "Haz clic en cualquier pieza para registrar su condición. Activa \"Seleccionar varias piezas\" para marcar un tratamiento en un conjunto de dientes." : "Haz clic en una pieza para ver su detalle."}</p></div>`; return; }
  const od = KD.odonto(p).piezas;
  const opcDiente = `<option value="">Sin hallazgo en el diente completo</option>${Object.entries(KD.HALLAZGOS_DIENTE).map(([k, h]) => `<option value="${k}">${h.color === "rojo" ? "🔴" : "🔵"} ${h.nombre}</option>`).join("")}`;
  const opcCara = (v) => `<option value="">Sana</option>${Object.entries(KD.HALLAZGOS_CARA).map(([k, h]) => `<option value="${k}" ${v === k ? "selected" : ""}>${h.color === "rojo" ? "🔴" : "🔵"} ${h.nombre}</option>`).join("")}`;

  if (sel.length > 1) {
    cont.innerHTML = `<div class="panel-pieza">
      <span class="eyebrow">${sel.length} piezas seleccionadas</span><h3 style="margin-bottom:12px">${sel.sort().join(", ")}</h3>
      ${editar ? `<div class="form-grid">
        <label class="campo"><span>Aplicar al diente completo</span><select data-multi-diente>${opcDiente}</select></label>
        <label class="campo"><span>Aplicar caries en la cara</span><select data-multi-cara><option value="">—</option>${Object.entries(KD.CARAS).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select></label>
        <div class="full acciones"><button class="btn" data-aplicar>${KD.icon("check", 15)} Aplicar a las ${sel.length} piezas</button><button class="btn btn-ghost" data-plan-multi>${KD.icon("mas", 15)} Agregar sugeridos al plan</button><button class="btn-link" data-limpiar-sel>Quitar selección</button></div>
      </div>` : ""}</div>`;
    cont.querySelector("[data-aplicar]")?.addEventListener("click", () => {
      const dh = cont.querySelector("[data-multi-diente]").value, cara = cont.querySelector("[data-multi-cara]").value;
      if (!dh && !cara) { KD.toast("Elige qué aplicar.", "bad"); return; }
      for (const pz of sel) {
        const d = (od[pz] ||= { caras: {}, diente: "" });
        if (dh) { d.diente = dh; if (dh === "ausente") d.caras = {}; KD.odontoLog(p, pz, `${KD.HALLAZGOS_DIENTE[dh].color === "rojo" ? "Diagnóstico" : "Registro"}: ${KD.HALLAZGOS_DIENTE[dh].nombre}`); }
        if (cara) { d.caras[cara] = "caries"; KD.odontoLog(p, pz, `Diagnóstico: Caries (${cara})`); }
      }
      KD.guardar(); refrescar(); KD.toast(`Odontograma actualizado en ${sel.length} piezas`);
    });
    cont.querySelector("[data-plan-multi]")?.addEventListener("click", () => { agregarAlPlan(p, sel); refrescar(); });
    cont.querySelector("[data-limpiar-sel]")?.addEventListener("click", () => { odoSel.piezas = new Set(); refrescar(); });
    return;
  }

  const pz = sel[0];
  const d = od[pz] || { caras: {}, diente: "" };
  const sug = KD.tratamientoSugerido(pz, d);
  cont.innerHTML = `<div class="panel-pieza">
    <div class="odo-editor">
      <div class="odo-grande">${KD.dienteSVG(pz, d, 120)}<small>${editar ? "Toca una cara: sana → caries → resina" : "Vista de la pieza"}</small></div>
      <div>
        <span class="eyebrow">Pieza seleccionada</span>
        <h2 style="margin-bottom:2px">Pieza ${pz}</h2>
        <p class="muted" style="font-size:13px">${KD.esc(KD.nombrePieza(pz))}</p>
        ${editar ? `<div class="odo-caras">${Object.entries(KD.CARAS).map(([k, n]) => `<label class="campo"><span>${n} (${k})</span><select data-cara="${k}">${opcCara(d.caras[k])}</select></label>`).join("")}</div>
        <div class="form-grid" style="margin-top:12px">
          <label class="campo"><span>Diente completo</span><select data-diente>${opcDiente.replace(`value="${d.diente}"`, `value="${d.diente}" selected`)}</select></label>
          <label class="campo"><span>Observaciones</span><input data-nota value="${KD.esc(d.nota || "")}" placeholder="Ej. requiere seguimiento"></label>
        </div>
        <div class="acciones" style="margin-top:12px">
          <span class="muted" style="font-size:13px">Tratamiento sugerido: <strong style="color:var(--text)">${sug ? KD.esc(KD.nombreTrat(sug)) : "ninguno"}</strong></span>
          ${sug ? `<button class="btn btn-ghost btn-sm" data-plan-uno>${KD.icon("mas", 14)} Agregar al plan</button>` : ""}
        </div>` : `<div class="datos-grid">${KD.odontoHallazgos(p).filter((h) => h.pieza === pz).flatMap((h) => h.textos).map((t) => `<div><b class="${t.color === "rojo" ? "h-rojo" : "h-azul"}">${KD.esc(t.texto)}</b></div>`).join("") || '<div class="muted">Sin hallazgos registrados.</div>'}</div>`}
      </div>
    </div></div>`;
  if (!editar) return;
  const guardarPieza = (texto) => {
    const nuevo = od[pz] || (od[pz] = { caras: {}, diente: "" });
    Object.assign(nuevo, { caras: d.caras, diente: d.diente, nota: d.nota });
    if (!nuevo.diente && !Object.keys(nuevo.caras).length && !nuevo.nota) delete od[pz];
    if (texto) KD.odontoLog(p, pz, texto);
    KD.guardar(); refrescar();
  };
  const ciclo = ["", "caries", "resina"];
  cont.querySelectorAll(".odo-grande polygon").forEach((pg) => pg.addEventListener("click", () => {
    const cara = pg.dataset.cara;
    const sig = ciclo[(ciclo.indexOf(d.caras[cara] || "") + 1) % ciclo.length];
    if (sig) d.caras[cara] = sig; else delete d.caras[cara];
    guardarPieza(sig ? `${sig === "caries" ? "Diagnóstico" : "Registro"}: ${KD.HALLAZGOS_CARA[sig].nombre} (${cara})` : `Cara ${cara} marcada como sana`);
  }));
  cont.querySelectorAll("[data-cara]").forEach((s) => s.addEventListener("change", () => {
    if (s.value) d.caras[s.dataset.cara] = s.value; else delete d.caras[s.dataset.cara];
    guardarPieza(s.value ? `${KD.HALLAZGOS_CARA[s.value].color === "rojo" ? "Diagnóstico" : "Registro"}: ${KD.HALLAZGOS_CARA[s.value].nombre} (${s.dataset.cara})` : `Cara ${s.dataset.cara} marcada como sana`);
  }));
  cont.querySelector("[data-diente]").addEventListener("change", (e) => {
    d.diente = e.target.value;
    if (d.diente === "ausente") d.caras = {};
    guardarPieza(d.diente ? `${KD.HALLAZGOS_DIENTE[d.diente].color === "rojo" ? "Diagnóstico" : "Registro"}: ${KD.HALLAZGOS_DIENTE[d.diente].nombre}` : "Diente sin hallazgos");
  });
  cont.querySelector("[data-nota]").addEventListener("change", (e) => { d.nota = e.target.value.trim(); guardarPieza(""); });
  cont.querySelector("[data-plan-uno]")?.addEventListener("click", () => { agregarAlPlan(p, [pz]); refrescar(); });
}

// ---------- Presupuestos / plan de tratamiento ----------
function tabPresupuestos(panel, p) {
  const dinero = KD.verDinero();
  const gestion = KD.puede("presupuestos");
  const press = KD.db.presupuestos.filter((x) => x.pacienteId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const items = KD.planesPaciente(p.id).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const sinPres = items.filter((x) => x.estado === "pendiente" && !x.presupuestoId);
  const prog = KD.progresoPaciente(p.id);
  panel.innerHTML = `
    <section class="card" style="margin-bottom:18px"><div class="progreso-plan">
      <div class="pp-top"><strong>Tratamientos realizados vs. presupuestados</strong><b>${Math.round(prog.pct * 100)}%</b></div>
      ${KD.progreso(prog.pct)}
      <div class="pp-pasos"><span>${prog.hechos} realizados de ${prog.total}</span>${dinero ? `<span>${KD.fmtDinero(prog.montoHecho)} de ${KD.fmtDinero(prog.montoTotal)}</span>` : ""}</div>
    </div></section>
    ${gestion ? `${KD.seccion("Documentos", "Presupuestos", `<button class="btn" data-nuevo>${KD.icon("mas", 16)} Nuevo presupuesto</button>`)}
    <section class="card" style="margin-bottom:18px">${press.length ? `<div class="tabla-wrap"><table class="responsive">
      <thead><tr><th>Folio</th><th>Tratamientos</th><th>Fecha</th><th>Estado</th>${dinero ? '<th class="num">Total</th>' : ""}<th></th></tr></thead>
      <tbody>${press.map((x) => `<tr class="clic" data-pres="${x.id}">
        <td class="principal-celda"><strong class="mono">${KD.esc(x.folio)}</strong><span class="sub">${KD.esc(KD.nombreUsuario(x.doctorId))}</span></td>
        <td data-l="Tratamientos">${KD.itemsPresupuesto(x).map((i) => KD.esc(`${KD.nombreTrat(i.tratamientoId)}${i.pieza ? ` (${i.pieza})` : ""}`)).join(" + ")}</td>
        <td data-l="Fecha">${KD.esc(KD.fmtFecha(x.fecha))}</td>
        <td data-l="Estado">${KD.badgeEstadoPres(KD.estadoPresupuesto(x))}</td>
        ${dinero ? `<td data-l="Total" class="num"><strong>${KD.fmtDinero(KD.totalPresupuesto(x))}</strong></td>` : ""}
        <td data-l="">${KD.icon("der", 16)}</td></tr>`).join("")}</tbody></table></div>` : KD.vacio("Este paciente no tiene presupuestos.", "presupuestos")}</section>` : ""}
    ${KD.seccion("Plan de tratamiento", "Tratamientos recomendados", gestion && sinPres.length ? `<button class="btn btn-ghost" data-generar>${KD.icon("presupuestos", 16)} Generar presupuesto con ${sinPres.length} pendiente(s)</button>` : "")}
    <section class="card">${items.length ? `<div class="tabla-wrap"><table class="responsive">
      <thead><tr><th>Tratamiento</th><th>Pieza</th><th>Recomendó</th><th>Fecha</th><th>Estado</th>${dinero ? '<th class="num">Monto</th>' : ""}</tr></thead>
      <tbody>${items.map((x) => `<tr>
        <td class="principal-celda"><strong>${KD.esc(KD.nombreTrat(x.tratamientoId))}</strong>${x.presupuestoId ? `<span class="sub">${KD.esc(KD.byId("presupuestos", x.presupuestoId)?.folio || "")}</span>` : '<span class="sub">Sin presupuesto</span>'}</td>
        <td data-l="Pieza">${KD.esc(x.pieza) || "—"}</td>
        <td data-l="Recomendó">${KD.esc(KD.nombreUsuario(x.doctorId))}</td>
        <td data-l="Fecha">${KD.esc(KD.fmtFecha(x.fecha))}</td>
        <td data-l="Estado">${KD.badgeEstadoPlan(x.estado)}</td>
        ${dinero ? `<td data-l="Monto" class="num">${KD.fmtDinero(x.precio)}</td>` : ""}
      </tr>`).join("")}</tbody></table></div>` : KD.vacio("No hay tratamientos recomendados. Se agregan desde el odontograma o al registrar una consulta.", "tratamientos")}</section>`;
  panel.querySelector("[data-nuevo]")?.addEventListener("click", () => KD.formPresupuesto({ pacienteId: p.id, planIds: sinPres.map((x) => x.id) }));
  panel.querySelector("[data-generar]")?.addEventListener("click", () => KD.formPresupuesto({ pacienteId: p.id, planIds: sinPres.map((x) => x.id) }));
  panel.querySelectorAll("[data-pres]").forEach((tr) => tr.addEventListener("click", () => KD.detallePresupuesto(tr.dataset.pres)));
}

// ---------- Pagos ----------
function tabPagos(panel, p) {
  const citas = KD.citasPaciente(p.id);
  const pagos = citas.filter((c) => c.cobro).sort((a, b) => b.cobro.fecha.localeCompare(a.cobro.fecha));
  const porCobrar = citas.filter((c) => !c.cobro && !c.cobrado && KD.consultaDeCita(c.id) && KD.montoCita(c) > 0);
  const total = pagos.reduce((s, c) => s + c.cobro.monto, 0);
  const deuda = porCobrar.reduce((s, c) => s + KD.montoCita(c), 0);
  panel.innerHTML = `
    <div class="kpis">
      <div class="card kpi"><span class="etq">Pagado (últimos 45 días)</span><div class="valor">${KD.fmtDinero(total)}</div><div class="sub">${pagos.length} pagos</div></div>
      <div class="card kpi"><span class="etq">Saldo pendiente</span><div class="valor" style="color:${deuda ? "var(--bad)" : "inherit"}">${KD.fmtDinero(deuda)}</div><div class="sub">${deuda ? `${porCobrar.length} cita(s) por cobrar` : "Al corriente"}</div></div>
    </div>
    <section class="card">${pagos.length || porCobrar.length ? `<div class="tabla-wrap"><table class="responsive">
      <thead><tr><th>Fecha</th><th>Concepto</th><th>Método</th><th>Estado</th><th class="num">Monto</th></tr></thead>
      <tbody>${porCobrar.map((c) => `<tr><td class="principal-celda"><strong>${KD.esc(KD.fmtFecha(c.fecha))}</strong></td><td data-l="Concepto">${KD.esc(KD.tratamientoCita(c))}</td><td data-l="Método">—</td><td data-l="Estado">${KD.badge("Por cobrar", "warn")}</td><td data-l="Monto" class="num monto-egr">${KD.fmtDinero(KD.montoCita(c))}</td></tr>`).join("")}
      ${pagos.map((c) => `<tr><td class="principal-celda"><strong>${KD.esc(KD.fmtFecha(c.cobro.fecha))}</strong> <span class="muted">${c.cobro.hora}</span></td><td data-l="Concepto">${KD.esc(KD.tratamientoCita(c))}</td><td data-l="Método">${KD.METODOS[c.cobro.metodo]}</td><td data-l="Estado">${KD.badge("Pagado", "ok")}</td><td data-l="Monto" class="num monto-ing">${KD.fmtDinero(c.cobro.monto)}</td></tr>`).join("")}</tbody>
    </table></div>` : KD.vacio("Sin pagos registrados en los últimos 45 días.", "caja")}</section>`;
}

// ---------- Citas ----------
// Incluye las citas eliminadas de la agenda con su motivo (#19)
function tabCitas(panel, p) {
  const eliminadas = KD.citasEliminadasPaciente(p.id);
  const citas = KD.citasPaciente(p.id).concat(eliminadas).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  const n = (e) => citas.filter((c) => !c.eliminacion && c.estado === e).length;
  panel.innerHTML = `
    ${KD.seccion("Historial de citas", `${citas.length - eliminadas.length} citas agendadas · ${n("atendida")} asistió · ${n("no_asistio")} no asistió · ${n("cancelada")} ${n("cancelada") === 1 ? "cancelada" : "canceladas"} · ${eliminadas.length} ${eliminadas.length === 1 ? "eliminada" : "eliminadas"}`,
      KD.puede("agenda_editar") && p.activo ? `<button class="btn" data-cita>${KD.icon("agenda", 16)} Agendar cita</button>` : "")}
    <section class="card">${citas.length ? `<div class="tabla-wrap"><table class="responsive">
      <thead><tr><th>Fecha</th><th>Tipo / tratamiento</th><th>Doctor</th><th>Unidad</th><th>Estado</th></tr></thead>
      <tbody>${citas.map((c) => `<tr ${c.eliminacion ? 'class="eliminada"' : `class="clic" data-cita-id="${c.id}"`}>
        <td class="principal-celda"><strong>${KD.esc(KD.fmtFecha(c.fecha))}</strong> <span class="muted">${c.hora}</span></td>
        <td data-l="Tipo">${KD.esc(KD.tratamientoCita(c))}${c.piezas ? ` <span class="muted">· ${KD.esc(c.piezas)}</span>` : ""}</td>
        <td data-l="Doctor"><span class="color-punto" style="--c:${KD.colorUsuario(c.doctorId)}"></span> ${KD.esc(KD.nombreUsuario(c.doctorId))}</td>
        <td data-l="Unidad">U${c.unidad || 1} · ${KD.esc(KD.nombreSuc(c.sucursalId))}</td>
        <td data-l="Estado">${c.eliminacion ? KD.punto("Eliminada", "cita-eliminada") : KD.badgeEstadoCita(c.estado)}
          ${c.eliminacion || c.cancelacion ? `<small class="motivo-baja">${KD.textoBaja(c.eliminacion || c.cancelacion)}</small>` : ""}</td>
      </tr>`).join("")}</tbody></table></div>` : KD.vacio("Sin citas registradas.", "agenda")}</section>`;
  panel.querySelectorAll("[data-cita-id]").forEach((tr) => tr.addEventListener("click", () => KD.detalleCita(tr.dataset.citaId)));
  panel.querySelector("[data-cita]")?.addEventListener("click", () => KD.formCita({ pacienteId: p.id, sucursalId: KD.sucursalUnica() }));
}

// ---------- Registrar consulta ----------
// Solo desde una cita del día, y solo el doctor que atiende (Issues #8 y #10).
KD.formConsulta = (cita) => {
  if (!cita || !KD.puedeRegistrar(cita)) { KD.toast("Solo el doctor que atiende la cita puede registrar la consulta, y solo si el paciente tiene cita.", "bad"); return; }
  const p = KD.byId("pacientes", cita.pacienteId);
  const tipo = KD.byId("tiposCita", cita.tipoId);
  const dinero = KD.verDinero();
  const pendientes = KD.pendientePaciente(p.id);
  const trats = KD.db.tratamientos.filter((t) => t.activo);
  const filaItem = (grupo, tid = "", piezas = "") => {
    const t = KD.byId("tratamientos", tid) || trats[0];
    return `<div class="fila-item ${dinero ? "" : "sin-precio"}" data-fila="${grupo}">
      <select name="${grupo}_trat" aria-label="Tratamiento">${KD.opciones(trats, t.id)}</select>
      <input name="${grupo}_pieza" placeholder="Pieza(s): 16, 17" value="${KD.esc(piezas)}" aria-label="Piezas dentales">
      ${dinero ? `<input class="precio" type="number" name="${grupo}_precio" min="0" step="50" value="${t.precio}" aria-label="Monto">` : ""}
      <button type="button" class="btn-icon chico" data-quitar aria-label="Quitar">${KD.icon("cerrar", 15)}</button>
    </div>`;
  };

  const m = KD.modal({
    titulo: `Registrar consulta · ${p.nombre}`,
    subtitulo: `Cita de ${cita.fecha === KD.hoy() ? "hoy" : KD.esc(KD.fmtFecha(cita.fecha))} a las ${cita.hora} · Unidad ${cita.unidad} · ${KD.esc(KD.nombreUsuario(cita.doctorId))} · ${KD.esc(tipo?.nombre)}`,
    ancho: "ancho",
    cuerpo: `<form class="form-grid" novalidate>
      ${p.alergias ? `<p class="nota-form bad">${KD.icon("alerta", 16)}<span><strong>Alergias:</strong> ${KD.esc(p.alergias)}</span></p>` : ""}
      ${p.datosClinicos === false ? `<div class="seccion-form">Datos clínicos del paciente <small>Recepción lo dio de alta sin ellos</small></div>
        <label class="campo full"><span>Alergias</span><input name="alergias" placeholder="Déjalo vacío si no tiene"></label>
        <label class="campo full"><span>Antecedentes médicos</span><textarea name="antecedentes" rows="2" placeholder="Enfermedades, medicamentos, embarazo…"></textarea></label>` : ""}
      <label class="campo full"><span>Motivo de la consulta <em>*</em></span><input name="motivo" required value="${KD.esc(cita.notas || (cita.tratamientoId ? KD.nombreTrat(cita.tratamientoId) : ""))}" placeholder="Ej. dolor en muela inferior derecha"></label>
      <label class="campo full"><span>Diagnóstico / hallazgos</span><textarea name="diagnostico" rows="2" placeholder="Lo que se encontró en la revisión"></textarea></label>

      <div class="seccion-form">¿Qué se le hizo hoy? <small>Las piezas se actualizan en el odontograma (rojo → azul)</small></div>
      ${pendientes.length ? `<div class="full"><p class="muted" style="margin-bottom:6px;font-size:13px">Tratamientos de su plan realizados en esta cita:</p><div class="checks">
        ${pendientes.map((x) => `<label><input type="checkbox" name="plan_hecho" value="${x.id}" ${cita.planId === x.id ? "checked" : ""}> ${KD.esc(KD.nombreTrat(x.tratamientoId))}${x.pieza ? " · pieza " + KD.esc(x.pieza) : ""}${dinero ? ` (${KD.fmtDinero(x.precio)})` : ""}</label>`).join("")}
      </div></div>` : ""}
      <div class="full filas-items" data-grupo="hecho"></div>
      <div class="full"><button type="button" class="btn btn-ghost btn-sm" data-add="hecho">${KD.icon("mas", 14)} Agregar procedimiento realizado</button></div>

      <div class="seccion-form">Tratamientos recomendados <small>Se agregan al plan como pendientes y se marcan en rojo en el odontograma</small></div>
      <div class="full filas-items" data-grupo="rec"></div>
      <div class="full"><button type="button" class="btn btn-ghost btn-sm" data-add="rec">${KD.icon("mas", 14)} Agregar tratamiento recomendado</button></div>

      <label class="campo full"><span>Notas e indicaciones</span><textarea name="notas" rows="2" placeholder="Medicamentos, cuidados, próxima cita sugerida…"></textarea></label>
      ${tipo?.diagnostico ? `<p class="nota-form">${KD.icon("diente", 16)}<span>Es una cita de diagnóstico: al guardar se abrirá el <strong>odontograma</strong> para registrar el estado de cada pieza.</span></p>` : ""}
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} Guardar consulta</button>`,
  });
  const f = m.querySelector("form");
  const grupo = (g) => f.querySelector(`[data-grupo="${g}"]`);
  f.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) grupo(add.dataset.add).insertAdjacentHTML("beforeend", filaItem(add.dataset.add));
    const q = e.target.closest("[data-quitar]");
    if (q) q.closest(".fila-item").remove();
  });
  f.addEventListener("change", (e) => {
    if (dinero && e.target.name?.endsWith("_trat")) e.target.closest(".fila-item").querySelector(".precio").value = KD.byId("tratamientos", e.target.value).precio;
  });
  if (cita.tratamientoId && !cita.planId && cita.tratamientoId !== "t14") grupo("hecho").insertAdjacentHTML("beforeend", filaItem("hecho", cita.tratamientoId, cita.piezas || ""));
  else if (cita.tratamientoId === "t14") grupo("hecho").insertAdjacentHTML("beforeend", filaItem("hecho", "t14"));
  else if (tipo?.diagnostico) grupo("hecho").insertAdjacentHTML("beforeend", filaItem("hecho", "t1"));

  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const filas = (g) => [...f.querySelectorAll(`[data-fila="${g}"]`)].map((row) => {
      const tid = row.querySelector(`[name="${g}_trat"]`).value;
      const pieza = KD.listaPiezas(row.querySelector(`[name="${g}_pieza"]`).value).join(", ");
      const precio = dinero ? Number(row.querySelector(`[name="${g}_precio"]`).value) || 0 : KD.byId("tratamientos", tid).precio;
      return pieza ? { tratamientoId: tid, pieza, precio } : { tratamientoId: tid, precio };
    });
    const consultaId = KD.uid("co");
    const procedimientos = filas("hecho");
    for (const id of [].concat(v.plan_hecho || [])) {
      const it = KD.byId("planes", id);
      it.estado = "realizado"; it.fechaEstado = cita.fecha;
      procedimientos.push({ tratamientoId: it.tratamientoId, pieza: it.pieza, precio: it.precio, planId: it.id });
    }
    for (const pr of procedimientos) if (pr.pieza) KD.odontoRealizado(p, pr.tratamientoId, pr.pieza, cita.fecha, cita.doctorId);
    const cons = { id: consultaId, citaId: cita.id, pacienteId: p.id, doctorId: cita.doctorId, sucursalId: cita.sucursalId, fecha: cita.fecha,
      motivo: v.motivo, diagnostico: v.diagnostico, procedimientos, notas: v.notas };
    KD.db.consultas.push(cons);
    for (const r of filas("rec")) {
      KD.db.planes.push({ id: KD.uid("pl"), pacienteId: p.id, doctorId: cita.doctorId, sucursalId: cita.sucursalId, consultaId, fecha: cita.fecha, ...r, pieza: r.pieza || "", estado: "pendiente", fechaEstado: cita.fecha });
      if (r.pieza) KD.odontoIndicado(p, r.tratamientoId, r.pieza, cita.fecha, cita.doctorId);
    }
    if (p.datosClinicos === false) { p.alergias = v.alergias || ""; p.antecedentes = v.antecedentes || ""; delete p.datosClinicos; }
    cita.estado = "atendida";
    KD.descontarConsulta(cons);
    KD.guardar();
    KD.cerrarModal();
    odoSel.paciente = null;
    location.hash = `#/pacientes/${p.id}/${tipo?.diagnostico ? "historial" : "clinico"}`;
    KD.render();
    KD.toast(tipo?.diagnostico ? "Consulta registrada. Ahora registra el diagnóstico en el odontograma." : "Consulta registrada · recepción ya puede cobrar");
  });
};
