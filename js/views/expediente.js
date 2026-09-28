// Expediente del paciente: datos, historial clínico, plan de tratamiento y citas.
KD.vistas = KD.vistas || {};

KD.vistas.expediente = (main, partes) => {
  const p = KD.byId("pacientes", partes[0]);
  if (!p) { main.innerHTML = KD.vacio("Paciente no encontrado."); return; }
  const verHist = KD.puede("historial_ver");
  const tabs = [
    verHist && ["historial", "Historial clínico"],
    verHist && ["plan", "Plan de tratamiento"],
    ["citas", "Citas"],
  ].filter(Boolean);
  const tab = tabs.some(([k]) => k === partes[1]) ? partes[1] : tabs[0][0];
  const pend = KD.pendientePaciente(p.id);

  main.innerHTML = `
    <p style="margin-bottom:12px"><a href="#/pacientes">← Pacientes</a></p>
    <section class="card card-body" style="margin-bottom:16px">
      <div class="exp-cab">
        <span class="avatar">${KD.esc(p.nombre.split(" ").slice(0, 2).map((x) => x[0]).join(""))}</span>
        <div class="datos">
          <h1>${KD.esc(p.nombre)} ${p.activo ? "" : KD.badge("Dado de baja", "bad")}</h1>
          <div class="meta">
            <span><b>Expediente</b> ${KD.esc(p.expediente)}</span>
            <span><b>Edad</b> ${KD.edad(p.nacimiento)} años</span>
            <span><b>Tel.</b> ${KD.esc(p.telefono)} · <a href="${KD.waLink(p.telefono)}" target="_blank" rel="noopener">WhatsApp</a></span>
            ${p.email ? `<span><b>Correo</b> ${KD.esc(p.email)}</span>` : ""}
            <span><b>Sucursal habitual</b> ${KD.esc(KD.nombreSuc(p.sucursalId))}</span>
            <span><b>Paciente desde</b> ${KD.esc(KD.fmtFecha(p.alta))}</span>
          </div>
          ${p.alergias ? `<div class="alerta-med">${KD.icon("alerta", 16)} Alergias: ${KD.esc(p.alergias)}</div>` : ""}
          ${p.antecedentes && verHist ? `<p class="muted" style="margin:8px 0 0">Antecedentes: ${KD.esc(p.antecedentes)}</p>` : ""}
        </div>
        <div class="page-head" style="margin:0"><div class="acciones">
          ${KD.puede("historial_editar") && p.activo ? `<button class="btn" data-consulta>Registrar consulta</button>` : ""}
          ${KD.puede("agenda_editar") && p.activo ? `<button class="btn btn-ghost" data-cita>Agendar cita</button>` : ""}
          ${KD.puede("pacientes_editar") ? `<button class="btn btn-ghost" data-editar>${KD.icon("editar", 16)} Editar</button>
            <button class="btn btn-ghost" data-baja>${p.activo ? "Dar de baja" : "Reactivar"}</button>` : ""}
        </div></div>
      </div>
    </section>
    <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" data-tab="${k}" class="${k === tab ? "activo" : ""}">${n}${k === "plan" && pend.length ? ` (${pend.length})` : ""}</button>`).join("")}</div>
    <div data-panel></div>`;

  const panel = main.querySelector("[data-panel]");
  ({ historial: tabHistorial, plan: tabPlan, citas: tabCitas })[tab](panel, p);

  main.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => (location.hash = `#/pacientes/${p.id}/${b.dataset.tab}`)));
  main.querySelector("[data-consulta]")?.addEventListener("click", () => KD.formConsulta(p.id));
  main.querySelector("[data-cita]")?.addEventListener("click", () => KD.formCita({ pacienteId: p.id, sucursalId: p.sucursalId }));
  main.querySelector("[data-editar]")?.addEventListener("click", () => KD.formPaciente(p));
  main.querySelector("[data-baja]")?.addEventListener("click", () => {
    if (!p.activo) { p.activo = true; delete p.baja; KD.guardar(); KD.render(); KD.toast("Paciente reactivado"); return; }
    KD.confirmar("Dar de baja al paciente",
      `<strong>${KD.esc(p.nombre)}</strong> ya no aparecerá en las búsquedas ni se le podrán agendar citas. Su expediente clínico se conserva (la norma exige guardarlo al menos 5 años) y se puede reactivar en cualquier momento.`,
      "Dar de baja", () => { p.activo = false; p.baja = KD.hoy(); KD.guardar(); KD.render(); KD.toast("Paciente dado de baja"); });
  });
};

function tabHistorial(panel, p) {
  const consultas = KD.db.consultas.filter((c) => c.pacienteId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (!consultas.length) { panel.innerHTML = `<div class="card">${KD.vacio("Este paciente aún no tiene consultas registradas.")}</div>`; return; }
  panel.innerHTML = `<div class="card card-body"><ul class="timeline">${consultas.map((c) => {
    const recomendados = KD.db.planes.filter((x) => x.consultaId === c.id);
    return `<li>
      <div class="t-cab">
        <strong>${KD.esc(KD.fmtFecha(c.fecha, { weekday: "short", day: "numeric", month: "long", year: "numeric" }))}</strong>
        <span class="t-meta">${KD.esc(KD.nombreUsuario(c.doctorId))} · Sucursal ${KD.esc(KD.nombreSuc(c.sucursalId))}</span>
      </div>
      <div class="t-body"><dl>
        <dt>Motivo</dt><dd>${KD.esc(c.motivo) || "—"}</dd>
        <dt>Diagnóstico</dt><dd>${KD.esc(c.diagnostico) || "—"}</dd>
        <dt>Se realizó</dt><dd>${c.procedimientos.length ? `<ul class="proc-lista">${c.procedimientos.map((x) =>
          `<li>${KD.esc(KD.nombreTrat(x.tratamientoId))}${x.pieza ? ` · pieza ${KD.esc(x.pieza)}` : ""}${KD.puede("presupuestos") ? ` · ${KD.fmtDinero(x.precio)}` : ""}</li>`).join("")}</ul>` : "—"}</dd>
        ${recomendados.length ? `<dt>Recomendado</dt><dd><div class="chips">${recomendados.map((x) =>
          `${KD.badge(`${KD.nombreTrat(x.tratamientoId)}${x.pieza ? " · " + x.pieza : ""}`)} ${KD.badgeEstadoPlan(x.estado)}`).join(" ")}</div></dd>` : ""}
        ${c.notas ? `<dt>Notas</dt><dd>${KD.esc(c.notas)}</dd>` : ""}
      </dl></div>
    </li>`;
  }).join("")}</ul></div>`;
}

function tabPlan(panel, p) {
  const items = KD.db.planes.filter((x) => x.pacienteId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const suma = (est) => items.filter((x) => est.includes(x.estado)).reduce((s, x) => s + x.precio, 0);
  const editar = KD.puede("presupuestos") || KD.puede("historial_editar");
  panel.innerHTML = `<div class="card">
    <div class="card-head"><div><h2>Plan de tratamiento y presupuesto</h2><p>Tratamientos recomendados por los doctores en las consultas.</p></div>
      ${editar ? `<button class="btn btn-ghost btn-sm" data-agregar>${KD.icon("mas", 14)} Agregar tratamiento</button>` : ""}</div>
    <div class="tabla-wrap">${items.length ? `<table class="responsive">
      <thead><tr><th>Tratamiento</th><th>Pieza</th><th>Recomendó</th><th>Fecha</th><th>Estado</th><th class="num">Monto</th>${editar ? "<th></th>" : ""}</tr></thead>
      <tbody>${items.map((x) => `<tr>
        <td class="principal-celda"><strong>${KD.esc(KD.nombreTrat(x.tratamientoId))}</strong></td>
        <td data-l="Pieza">${KD.esc(x.pieza) || "—"}</td>
        <td data-l="Recomendó">${KD.esc(KD.nombreUsuario(x.doctorId))}</td>
        <td data-l="Fecha">${KD.esc(KD.fmtFecha(x.fecha))}</td>
        <td data-l="Estado">${KD.badgeEstadoPlan(x.estado)}</td>
        <td data-l="Monto" class="num">${KD.fmtDinero(x.precio)}</td>
        ${editar ? `<td data-l="">${["pendiente", "aceptado"].includes(x.estado) ? `<select data-plan="${x.id}" aria-label="Cambiar estado" style="width:auto;min-height:30px;padding:3px 6px">
          <option value="">Cambiar…</option>${Object.entries(KD.ESTADOS_PLAN).filter(([k]) => k !== x.estado && k !== "realizado").map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>` : ""}</td>` : ""}
      </tr>`).join("")}</tbody></table>` : KD.vacio("No hay tratamientos recomendados.")}</div>
    <div class="totales">
      <div><small>Pendiente de aceptar</small><strong>${KD.fmtDinero(suma(["pendiente"]))}</strong></div>
      <div><small>Aceptado, por realizar</small><strong>${KD.fmtDinero(suma(["aceptado"]))}</strong></div>
      <div><small>Realizado</small><strong>${KD.fmtDinero(suma(["realizado"]))}</strong></div>
      <div><small>Rechazado</small><strong>${KD.fmtDinero(suma(["rechazado"]))}</strong></div>
    </div>
  </div>`;
  panel.querySelectorAll("[data-plan]").forEach((s) => s.addEventListener("change", () => {
    if (!s.value) return;
    const it = KD.byId("planes", s.dataset.plan);
    it.estado = s.value; it.fechaEstado = KD.hoy();
    KD.guardar(); KD.render(); KD.toast(`Tratamiento marcado como "${KD.ESTADOS_PLAN[it.estado]}"`);
  }));
  panel.querySelector("[data-agregar]")?.addEventListener("click", () => formPlanItem(p));
}

function formPlanItem(p) {
  const u = KD.usuario();
  const docs = KD.doctores();
  const m = KD.modal({
    titulo: "Agregar tratamiento recomendado",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Tratamiento</span><select name="tratamientoId">${KD.opciones(KD.db.tratamientos.filter((t) => t.activo), "")}</select></label>
      <label class="campo"><span>Pieza dental</span><input name="pieza" placeholder="Ej. 36"></label>
      <label class="campo"><span>Monto</span><input type="number" name="precio" min="0" step="50" value="${KD.db.tratamientos[0].precio}"></label>
      <label class="campo full"><span>Recomendado por</span><select name="doctorId">${KD.opciones(docs, docs.some((d) => d.id === u.id) ? u.id : docs[0]?.id)}</select></label>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>Agregar</button>`,
  });
  const f = m.querySelector("form");
  f.tratamientoId.addEventListener("change", () => { f.precio.value = KD.byId("tratamientos", f.tratamientoId.value).precio; });
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    const v = KD.leerForm(f);
    KD.db.planes.push({ id: KD.uid("pl"), pacienteId: p.id, doctorId: v.doctorId, sucursalId: KD.sucursalesFiltro()[0], consultaId: null,
      fecha: KD.hoy(), tratamientoId: v.tratamientoId, pieza: v.pieza, precio: Number(v.precio) || 0, estado: "pendiente", fechaEstado: KD.hoy() });
    KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast("Tratamiento agregado al plan");
  });
}

function tabCitas(panel, p) {
  const citas = KD.db.citas.filter((c) => c.pacienteId === p.id).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  panel.innerHTML = `<div class="card">${citas.length ? `<div class="tabla-wrap"><table class="responsive">
    <thead><tr><th>Fecha</th><th>Tipo</th><th>Doctor</th><th>Sucursal</th><th>Estado</th></tr></thead>
    <tbody>${citas.map((c) => `<tr class="clic" data-cita="${c.id}">
      <td class="principal-celda"><strong>${KD.esc(KD.fmtFecha(c.fecha))}</strong> <span class="muted">${c.hora}</span></td>
      <td data-l="Tipo">${KD.esc((KD.byId("tiposCita", c.tipoId) || {}).nombre)}</td>
      <td data-l="Doctor">${KD.esc(KD.nombreUsuario(c.doctorId))}</td>
      <td data-l="Sucursal">${KD.esc(KD.nombreSuc(c.sucursalId))}</td>
      <td data-l="Estado">${KD.badgeEstadoCita(c.estado)}</td>
    </tr>`).join("")}</tbody></table></div>` : KD.vacio("Sin citas registradas.")}</div>`;
  panel.querySelectorAll("[data-cita]").forEach((tr) => tr.addEventListener("click", () => KD.detalleCita(tr.dataset.cita)));
}

// ---------- Registrar consulta (reporte al final de la sesión) ----------
KD.formConsulta = (pacienteId, cita) => {
  const p = KD.byId("pacientes", pacienteId);
  const u = KD.usuario();
  const docs = KD.doctores();
  const docSel = cita?.doctorId || (docs.some((d) => d.id === u.id) ? u.id : docs[0]?.id);
  const pendientes = KD.pendientePaciente(p.id);
  const trats = KD.db.tratamientos.filter((t) => t.activo);
  const filaItem = (grupo) => `<div class="fila-item" data-fila="${grupo}">
    <select name="${grupo}_trat" aria-label="Tratamiento">${KD.opciones(trats, "")}</select>
    <input name="${grupo}_pieza" placeholder="Pieza" aria-label="Pieza dental">
    <input class="precio" type="number" name="${grupo}_precio" min="0" step="50" value="${trats[0].precio}" aria-label="Monto">
    <button type="button" class="btn-icon" data-quitar aria-label="Quitar">${KD.icon("cerrar", 16)}</button>
  </div>`;

  const m = KD.modal({
    titulo: `Registrar consulta · ${p.nombre}`,
    ancho: "ancho",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${cita?.fecha || KD.hoy()}"></label>
      <label class="campo"><span>Doctor</span><select name="doctorId">${KD.opciones(docs, docSel)}</select></label>
      <label class="campo"><span>Sucursal</span><select name="sucursalId">${KD.opciones(KD.sucursalesUsuario(), cita?.sucursalId || KD.sucursalesFiltro()[0])}</select></label>
      <label class="campo"><span>Motivo de la consulta <em>*</em></span><input name="motivo" required value="${KD.esc(cita?.notas || "")}" placeholder="Ej. dolor en muela inferior derecha"></label>
      <label class="campo full"><span>Diagnóstico / hallazgos</span><textarea name="diagnostico" rows="2" placeholder="Lo que se encontró en la revisión"></textarea></label>

      <div class="seccion-form">¿Qué se le hizo hoy?</div>
      ${pendientes.length ? `<div class="full"><p class="muted" style="margin-bottom:6px">Tratamientos de su plan realizados en esta sesión:</p><div class="checks">
        ${pendientes.map((x) => `<label><input type="checkbox" name="plan_hecho" value="${x.id}"> ${KD.esc(KD.nombreTrat(x.tratamientoId))}${x.pieza ? " · pieza " + KD.esc(x.pieza) : ""} (${KD.fmtDinero(x.precio)})</label>`).join("")}
      </div></div>` : ""}
      <div class="full filas-items" data-grupo="hecho"></div>
      <div class="full"><button type="button" class="btn btn-ghost btn-sm" data-add="hecho">${KD.icon("mas", 14)} Agregar procedimiento realizado</button></div>

      <div class="seccion-form">Tratamientos recomendados (presupuesto)</div>
      <p class="full muted" style="margin:0">Lo que el paciente necesita a futuro. Se agrega a su plan de tratamiento como pendiente.</p>
      <div class="full filas-items" data-grupo="rec"></div>
      <div class="full"><button type="button" class="btn btn-ghost btn-sm" data-add="rec">${KD.icon("mas", 14)} Agregar tratamiento recomendado</button></div>

      <label class="campo full"><span>Notas e indicaciones</span><textarea name="notas" rows="2" placeholder="Medicamentos, cuidados, próxima cita sugerida…"></textarea></label>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>Guardar consulta</button>`,
  });
  const f = m.querySelector("form");
  f.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) f.querySelector(`[data-grupo="${add.dataset.add}"]`).insertAdjacentHTML("beforeend", filaItem(add.dataset.add));
    const q = e.target.closest("[data-quitar]");
    if (q) q.closest(".fila-item").remove();
  });
  f.addEventListener("change", (e) => {
    if (e.target.name?.endsWith("_trat")) e.target.closest(".fila-item").querySelector(".precio").value = KD.byId("tratamientos", e.target.value).precio;
  });
  if (!pendientes.length) f.querySelector('[data-add="hecho"]').click();

  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const filas = (g) => [...f.querySelectorAll(`[data-fila="${g}"]`)].map((row) => ({
      tratamientoId: row.querySelector(`[name="${g}_trat"]`).value,
      pieza: row.querySelector(`[name="${g}_pieza"]`).value.trim(),
      precio: Number(row.querySelector(`[name="${g}_precio"]`).value) || 0,
    }));
    const consultaId = KD.uid("co");
    const procedimientos = filas("hecho");
    const hechos = [].concat(v.plan_hecho || []);
    for (const id of hechos) {
      const it = KD.byId("planes", id);
      it.estado = "realizado"; it.fechaEstado = v.fecha;
      procedimientos.push({ tratamientoId: it.tratamientoId, pieza: it.pieza, precio: it.precio, planId: it.id });
    }
    KD.db.consultas.push({
      id: consultaId, citaId: cita?.id || null, pacienteId: p.id, doctorId: v.doctorId, sucursalId: v.sucursalId,
      fecha: v.fecha, motivo: v.motivo, diagnostico: v.diagnostico, procedimientos, notas: v.notas,
    });
    for (const r of filas("rec")) KD.db.planes.push({
      id: KD.uid("pl"), pacienteId: p.id, doctorId: v.doctorId, sucursalId: v.sucursalId, consultaId,
      fecha: v.fecha, ...r, estado: "pendiente", fechaEstado: v.fecha,
    });
    const citaDelDia = cita || KD.db.citas.find((c) => c.pacienteId === p.id && c.fecha === v.fecha && !["atendida", "cancelada"].includes(c.estado));
    if (citaDelDia) citaDelDia.estado = "atendida";
    KD.guardar();
    KD.cerrarModal();
    location.hash = `#/pacientes/${p.id}/historial`;
    KD.render();
    KD.toast("Consulta registrada en el historial clínico");
  });
};
