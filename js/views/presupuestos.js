// Presupuestos (gestión): planes de tratamiento con precio, su flujo y su seguimiento.
KD.vistas = KD.vistas || {};

let presFiltro = { q: "", periodo: "90", estado: "", pagina: 0 };
const ETAPAS = ["borrador", "enviado", "aceptado", "en_tratamiento", "completado", "rechazado"];

KD.vistas.presupuestos = (main) => {
  const sucIds = KD.sucursalesFiltro();
  const hoy = KD.hoy();
  const dinero = KD.verDinero();
  const todos = KD.db.presupuestos.filter((p) => sucIds.includes(p.sucursalId));
  const desdePeriodo = presFiltro.periodo === "mes" ? hoy.slice(0, 8) + "01" : presFiltro.periodo === "todo" ? "0000" : KD.sumarDias(hoy, -Number(presFiltro.periodo));
  const enPeriodo = todos.filter((p) => p.fecha >= desdePeriodo);
  const conEstado = enPeriodo.map((p) => ({ p, e: KD.estadoPresupuesto(p), total: KD.totalPresupuesto(p) }));

  const mesIni = hoy.slice(0, 8) + "01";
  const mesPrevIni = KD.fechaISO(new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 2, 1));
  const mesPrevFin = KD.sumarDias(mesPrevIni, KD.diasEntre(mesIni, hoy));
  const emitido = (a, b) => todos.filter((p) => p.fecha >= a && p.fecha <= b && p.estado !== "borrador").reduce((s, p) => s + KD.totalPresupuesto(p), 0);
  const valorMes = emitido(mesIni, hoy), valorPrev = emitido(mesPrevIni, mesPrevFin);
  const decididos = conEstado.filter((x) => !["borrador", "enviado"].includes(x.e));
  const aceptados = decididos.filter((x) => x.e !== "rechazado");
  const seguimiento = todos.map((p) => ({ p, e: KD.estadoPresupuesto(p) })).filter((x) => x.e === "enviado");

  const q = KD.buscable(presFiltro.q);
  const lista = conEstado.filter((x) => x.e !== "completado" && (!presFiltro.estado || x.e === presFiltro.estado) &&
    (!q || KD.buscable(`${KD.byId("pacientes", x.p.pacienteId)?.nombre} ${x.p.folio}`).includes(q)))
    .sort((a, b) => a.p.fecha.localeCompare(b.p.fecha) || a.p.folio.localeCompare(b.p.folio));
  const paginas = Math.max(1, Math.ceil(lista.length / 25));
  presFiltro.pagina = Math.min(presFiltro.pagina, paginas - 1);
  const pagina = lista.slice(presFiltro.pagina * 25, presFiltro.pagina * 25 + 25);
  const maxEtapa = Math.max(1, ...ETAPAS.map((e) => conEstado.filter((x) => x.e === e).length));

  main.innerHTML = `
    ${KD.cabecera("Conversión clínica", "Presupuestos", "Convierte diagnósticos en planes claros y da seguimiento a cada decisión.",
      `<button class="btn btn-ghost" data-exportar>${KD.icon("descargar", 16)} Exportar</button><button class="btn" data-nuevo>${KD.icon("mas", 16)} Nuevo presupuesto</button>`)}
    <div class="kpis">
      <div class="card kpi"><span class="etq">Valor emitido este mes</span><div class="valor">${KD.fmtDinero(valorMes)}</div><div class="sub"><span>${KD.delta(valorMes, valorPrev)} vs. mes anterior</span></div></div>
      <div class="card kpi"><span class="etq">Tasa de aceptación</span><div class="valor">${decididos.length ? Math.round((aceptados.length / decididos.length) * 100) : 0}%</div><div class="sub"><span>${aceptados.length} de ${decididos.length} presupuestos con respuesta</span></div></div>
      <div class="card kpi"><span class="etq">Por dar seguimiento</span><div class="valor">${seguimiento.length}</div><div class="sub"><span style="color:var(--warn);font-weight:700">${KD.fmtDinero(seguimiento.reduce((s, x) => s + KD.totalPresupuesto(x.p), 0))} en oportunidad</span></div></div>
    </div>
    <section class="card" style="margin-bottom:18px">
      <div class="card-head"><div><span class="eyebrow">Flujo del presupuesto</span><h2>Pipeline comercial</h2></div>
        <div class="segmentado" role="group" aria-label="Periodo">${[["mes", "Este mes"], ["90", "90 días"], ["365", "12 meses"], ["todo", "Todo"]].map(([k, t]) => `<button data-periodo="${k}" class="${presFiltro.periodo === k ? "activo" : ""}">${t}</button>`).join("")}</div></div>
      <div class="card-body"><div class="pipeline">${ETAPAS.map((e) => {
        const xs = conEstado.filter((x) => x.e === e);
        return `<div class="${e === "enviado" ? "foco" : ""}"><span class="pl-top">${KD.ESTADOS_PRES[e]} <b>${xs.length}</b></span>${KD.progreso(xs.length / maxEtapa)}<small>${KD.fmtDinero(xs.reduce((s, x) => s + x.total, 0))}</small></div>`;
      }).join("")}</div></div>
    </section>
    <section class="card">
      <div class="card-head"><div><span class="eyebrow">Todos los presupuestos · del más antiguo al más reciente · sin completados</span><h2>Actividad reciente</h2></div>
        <div class="acciones"><label class="buscar" style="min-width:200px">${KD.icon("buscar", 16)}<input type="search" placeholder="Paciente o folio" value="${KD.esc(presFiltro.q)}" data-q aria-label="Buscar"></label>
        <select data-estado style="width:auto" aria-label="Estado"><option value="">Todos los estados</option>${ETAPAS.filter((e) => e !== "completado").map((e) => `<option value="${e}" ${presFiltro.estado === e ? "selected" : ""}>${KD.ESTADOS_PRES[e]}</option>`).join("")}</select></div></div>
      ${pagina.length ? `<div class="tabla-wrap"><table class="responsive">
        <thead><tr><th>Presupuesto</th><th>Paciente</th><th>Tratamiento</th><th>Fecha</th><th>Estado</th><th class="num">Total</th><th></th></tr></thead>
        <tbody>${pagina.map(({ p: x, e, total }) => {
          const pac = KD.byId("pacientes", x.pacienteId);
          const items = KD.itemsPresupuesto(x);
          return `<tr class="clic" data-id="${x.id}">
            <td class="principal-celda"><span class="mono">${KD.esc(x.folio)}</span></td>
            <td data-l="Paciente"><div class="celda-persona">${KD.avatar(pac?.nombre)}<strong>${KD.esc(pac?.nombre)}</strong></div></td>
            <td data-l="Tratamiento"><strong style="font-size:12px">${KD.esc(items.map((i) => KD.nombreTrat(i.tratamientoId)).join(" + "))}</strong><span class="sub">${KD.esc(items.filter((i) => i.pieza).map((i) => `Pieza ${i.pieza}`).join(" · ") || "General")}</span></td>
            <td data-l="Fecha">${KD.esc(KD.fmtFecha(x.fecha))}</td>
            <td data-l="Estado">${KD.badgeEstadoPres(e)}</td>
            <td data-l="Total" class="num"><strong style="font-size:15px">${KD.fmtDinero(total)}</strong></td>
            <td data-l=""><button class="btn-icon sin-borde chico" data-menu="${x.id}" aria-label="Opciones">${KD.icon("puntos", 16)}</button></td>
          </tr>`;
        }).join("")}</tbody></table></div>
        <div class="card-pie"><span>${lista.length} presupuestos</span><span class="acciones">
          <button class="btn-icon chico" data-pag="-1" ${presFiltro.pagina === 0 ? "disabled" : ""} aria-label="Anterior">${KD.icon("izq", 16)}</button><strong>${presFiltro.pagina + 1} / ${paginas}</strong>
          <button class="btn-icon chico" data-pag="1" ${presFiltro.pagina >= paginas - 1 ? "disabled" : ""} aria-label="Siguiente">${KD.icon("der", 16)}</button></span></div>` : KD.vacio("No hay presupuestos con estos filtros.", "presupuestos")}
    </section>
    ${dinero ? "" : ""}`;

  const re = () => KD.vistas.presupuestos(main);
  main.querySelectorAll("[data-periodo]").forEach((b) => b.addEventListener("click", () => { presFiltro.periodo = b.dataset.periodo; presFiltro.pagina = 0; re(); }));
  main.querySelector("[data-q]").addEventListener("change", (e) => { presFiltro.q = e.target.value; presFiltro.pagina = 0; re(); });
  main.querySelector("[data-estado]").addEventListener("change", (e) => { presFiltro.estado = e.target.value; presFiltro.pagina = 0; re(); });
  main.querySelectorAll("[data-pag]").forEach((b) => b.addEventListener("click", () => { presFiltro.pagina += Number(b.dataset.pag); re(); }));
  main.querySelector("[data-nuevo]").addEventListener("click", () => KD.formPresupuesto({}));
  main.querySelector("[data-exportar]").addEventListener("click", () => {
    KD.descargarCSV(`presupuestos-${hoy}.csv`, [["Folio", "Fecha", "Paciente", "Expediente", "Doctor", "Sucursal", "Tratamientos", "Estado", "Descuento %", "Forma de pago", "Total"],
      ...lista.map(({ p: x, e, total }) => { const pac = KD.byId("pacientes", x.pacienteId); return [x.folio, x.fecha, pac?.nombre, pac?.expediente, KD.nombreUsuario(x.doctorId), KD.nombreSuc(x.sucursalId),
        KD.itemsPresupuesto(x).map((i) => `${KD.nombreTrat(i.tratamientoId)}${i.pieza ? ` (${i.pieza})` : ""}`).join(" + "), KD.ESTADOS_PRES[e], x.descuento || 0, x.formaPago === "mensualidades" ? `${x.pagos} mensualidades` : "Contado", total]; })]);
    KD.toast(`Se exportaron ${lista.length} presupuestos`);
  });
  main.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", (e) => { if (!e.target.closest("[data-menu]")) KD.detallePresupuesto(tr.dataset.id); }));
  main.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", () => menuPresupuesto(b, KD.byId("presupuestos", b.dataset.menu))));
};

function menuPresupuesto(ancla, x) {
  const e = KD.estadoPresupuesto(x);
  KD.popover(ancla, [
    { texto: "Ver presupuesto", icono: "ojo", accion: () => KD.detallePresupuesto(x.id) },
    ["borrador", "enviado"].includes(e) && { texto: "Editar", icono: "editar", accion: () => KD.formPresupuesto({ pres: x }) },
    e === "borrador" && { texto: "Marcar como enviado", icono: "externo", accion: () => cambiarEstadoPres(x, "enviado") },
    ["borrador", "enviado"].includes(e) && { texto: "El paciente aceptó", icono: "checkCirculo", accion: () => cambiarEstadoPres(x, "aceptado") },
    ["borrador", "enviado", "aceptado"].includes(e) && { texto: "El paciente rechazó", icono: "cerrar", accion: () => cambiarEstadoPres(x, "rechazado") },
    { texto: "Imprimir", icono: "imprimir", accion: () => imprimirPresupuesto(x) },
    "-",
    { texto: "Eliminar", icono: "basura", peligro: true, accion: () => eliminarPresupuesto(x) },
  ]);
}

function cambiarEstadoPres(x, estado) {
  x.estado = estado; x.fechaEstado = KD.hoy();
  for (const it of KD.itemsPresupuesto(x)) {
    if (it.estado === "realizado") continue;
    it.estado = estado === "aceptado" ? "aceptado" : estado === "rechazado" ? "rechazado" : "pendiente";
    it.fechaEstado = KD.hoy();
  }
  KD.guardar(); KD.cerrarModal(); KD.render();
  KD.toast(`Presupuesto ${x.folio}: ${KD.ESTADOS_PRES[estado].toLowerCase()}`);
}

function eliminarPresupuesto(x) {
  KD.confirmar("Eliminar presupuesto", `Se eliminará el presupuesto <strong>${KD.esc(x.folio)}</strong>. Los tratamientos recomendados por el doctor siguen en el plan del paciente (sin presupuesto) y los ya realizados se conservan en su historial.`, "Eliminar", () => {
    for (const it of KD.itemsPresupuesto(x)) { delete it.presupuestoId; if (it.estado !== "realizado") it.estado = "pendiente"; }
    KD.db.presupuestos = KD.db.presupuestos.filter((p) => p.id !== x.id);
    KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast("Presupuesto eliminado");
  });
}

function imprimirPresupuesto(x) {
  const pac = KD.byId("pacientes", x.pacienteId);
  const items = KD.itemsPresupuesto(x);
  const sub = KD.subtotalPresupuesto(x), total = KD.totalPresupuesto(x);
  KD.imprimirHTML(`Presupuesto ${x.folio}`, `
    <h1>${KD.esc(KD.db.empresa.nombre)}</h1><p class="muted">Sucursal ${KD.esc(KD.nombreSuc(x.sucursalId))} · ${KD.esc(KD.byId("sucursales", x.sucursalId)?.telefono || "")}</p>
    <h2>Presupuesto ${KD.esc(x.folio)}</h2>
    <p><b>Paciente:</b> ${KD.esc(pac?.nombre)} (${KD.esc(pac?.expediente)})<br><b>Doctor:</b> ${KD.esc(KD.nombreUsuario(x.doctorId))}<br><b>Fecha:</b> ${KD.esc(KD.fmtFecha(x.fecha, { day: "numeric", month: "long", year: "numeric" }))}</p>
    <table><thead><tr><th>Tratamiento</th><th>Pieza</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Importe</th></tr></thead><tbody>
    ${items.map((i) => `<tr><td>${KD.esc(KD.nombreTrat(i.tratamientoId))}</td><td>${KD.esc(i.pieza || "—")}</td><td class="n">${i.cantidad || 1}</td><td class="n">${KD.fmtDinero(i.precio)}</td><td class="n">${KD.fmtDinero(i.precio * (i.cantidad || 1))}</td></tr>`).join("")}
    </tbody></table>
    <p class="total">Subtotal ${KD.fmtDinero(sub)}${x.descuento ? ` · Descuento ${x.descuento}%` : ""}<br>Total ${KD.fmtDinero(total)}</p>
    <p>Forma de pago: ${x.formaPago === "mensualidades" ? `${x.pagos} mensualidades de ${KD.fmtDinero(Math.ceil(total / x.pagos))}` : "Contado"}</p>
    ${x.notas ? `<p><b>Notas:</b> ${KD.esc(x.notas)}</p>` : ""}
    <p class="muted" style="margin-top:32px">Presupuesto válido por 30 días. Los montos pueden cambiar si el diagnóstico cambia durante el tratamiento.</p>`);
}

KD.detallePresupuesto = (id) => {
  const x = KD.byId("presupuestos", id);
  if (!x) return;
  const pac = KD.byId("pacientes", x.pacienteId);
  const e = KD.estadoPresupuesto(x);
  const items = KD.itemsPresupuesto(x);
  const dinero = KD.verDinero();
  const total = KD.totalPresupuesto(x);
  const gestion = KD.puede("presupuestos");
  const m = KD.modal({
    titulo: `Presupuesto ${x.folio}`,
    subtitulo: `${KD.esc(pac?.nombre)} · ${KD.esc(KD.nombreUsuario(x.doctorId))} · ${KD.esc(KD.fmtFecha(x.fecha))}`,
    ancho: "ancho",
    cuerpo: `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">${KD.badgeEstadoPres(e)}<span class="muted">${items.filter((i) => i.estado === "realizado").length} de ${items.length} realizados</span></div>
      ${KD.progreso(items.length ? items.filter((i) => i.estado === "realizado").length / items.length : 0)}
      <div class="card" style="box-shadow:none;margin:14px 0">${items.map((i) => `<div class="plan-item"><div><strong>${KD.esc(KD.nombreTrat(i.tratamientoId))}${(i.cantidad || 1) > 1 ? ` × ${i.cantidad}` : ""}</strong><small>${i.pieza ? `Pieza ${KD.esc(i.pieza)} · ` : ""}${KD.ESTADOS_PLAN[i.estado]}</small></div>
        <div class="acciones">${dinero ? `<span class="mono">${KD.fmtDinero(i.precio * (i.cantidad || 1))}</span>` : ""}${KD.badgeEstadoPlan(i.estado)}</div></div>`).join("")}</div>
      ${dinero ? `<div class="totales-pres"><div><small>Subtotal ${KD.fmtDinero(KD.subtotalPresupuesto(x))}${x.descuento ? ` · descuento ${x.descuento}%` : ""}</small><small>${x.formaPago === "mensualidades" ? `${x.pagos} mensualidades de ${KD.fmtDinero(Math.ceil(total / x.pagos))}` : "Pago de contado"}</small></div><strong>${KD.fmtDinero(total)}</strong></div>` : ""}
      ${x.notas ? `<p class="muted" style="margin:12px 0 0">Notas para el paciente: ${KD.esc(x.notas)}</p>` : ""}`,
    acciones: `${gestion ? `<button class="btn-icon peligro" data-eliminar aria-label="Eliminar" title="Eliminar" style="margin-right:auto">${KD.icon("basura", 17)}</button>
      <button class="btn btn-ghost" data-imprimir>${KD.icon("imprimir", 16)} Imprimir</button>
      ${["borrador", "enviado"].includes(e) ? `<button class="btn btn-ghost" data-editar>${KD.icon("editar", 16)} Editar</button>` : ""}
      ${["borrador", "enviado", "aceptado"].includes(e) ? `<button class="btn btn-ghost" data-est="rechazado">Rechazó</button>` : ""}
      ${e === "borrador" ? `<button class="btn btn-ghost" data-est="enviado">Marcar enviado</button>` : ""}
      ${["borrador", "enviado"].includes(e) ? `<button class="btn" data-est="aceptado">${KD.icon("checkCirculo", 16)} Aceptó</button>` : ""}` : ""}
      <a class="btn btn-ghost" href="#/pacientes/${x.pacienteId}/presupuestos" data-cerrar>Ver paciente</a>`,
  });
  m.querySelector("[data-eliminar]")?.addEventListener("click", () => eliminarPresupuesto(x));
  m.querySelector("[data-imprimir]")?.addEventListener("click", () => imprimirPresupuesto(x));
  m.querySelector("[data-editar]")?.addEventListener("click", () => KD.formPresupuesto({ pres: x }));
  m.querySelectorAll("[data-est]").forEach((b) => b.addEventListener("click", () => cambiarEstadoPres(x, b.dataset.est)));
};

// ---------- Nuevo / editar presupuesto ----------
KD.formPresupuesto = ({ pacienteId, planIds = [], pres = null }) => {
  const pacientes = KD.db.pacientes.filter((p) => p.activo);
  const etq = (p) => `${p.nombre} · ${p.expediente}`;
  const pac0 = KD.byId("pacientes", pres?.pacienteId || pacienteId);
  const trats = KD.db.tratamientos.filter((t) => t.activo);
  const items0 = pres ? KD.itemsPresupuesto(pres) : planIds.map((id) => KD.byId("planes", id)).filter(Boolean);
  const docs = KD.doctores();
  const u = KD.usuario();
  const doc0 = pres?.doctorId || items0[0]?.doctorId || (docs.some((d) => d.id === u.id) ? u.id : docs[0]?.id);
  const fila = (it = {}) => {
    const t = KD.byId("tratamientos", it.tratamientoId) || trats[0];
    return `<div class="fila-item" data-fila data-plan="${it.id || ""}" style="grid-template-columns:minmax(0,1fr) 90px 70px 110px 36px">
      <select name="trat" aria-label="Tratamiento">${trats.map((x) => `<option value="${x.id}" ${x.id === t.id ? "selected" : ""}>${KD.esc(x.nombre)} · ${KD.fmtDinero(x.precio)}</option>`).join("")}</select>
      <input name="pieza" value="${KD.esc(it.pieza || "")}" placeholder="Pieza" aria-label="Pieza">
      <input name="cant" type="number" min="1" value="${it.cantidad || 1}" aria-label="Cantidad">
      <input name="precio" type="number" min="0" step="50" value="${it.precio ?? t.precio}" aria-label="Precio">
      <button type="button" class="btn-icon chico peligro" data-quitar aria-label="Quitar">${KD.icon("basura", 15)}</button>
    </div>`;
  };
  const m = KD.modal({
    titulo: pres ? `Editar presupuesto ${pres.folio}` : "Nuevo presupuesto",
    subtitulo: "Selecciona los tratamientos aplicados y el total se calculará automáticamente.",
    ancho: "extra",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo"><span>Paciente <em>*</em></span><input name="paciente" required list="pres-pacientes" value="${pac0 ? KD.esc(etq(pac0)) : ""}" autocomplete="off" placeholder="Nombre o expediente">
        <datalist id="pres-pacientes">${pacientes.map((p) => `<option value="${KD.esc(etq(p))}">`).join("")}</datalist></label>
      <label class="campo"><span>Doctor</span><select name="doctorId">${KD.opciones(docs.map((d) => ({ id: d.id, nombre: KD.nombrePersona(d) })), doc0)}</select></label>
      <div class="seccion-form">Tratamientos aplicados <button type="button" class="btn-link" data-add>${KD.icon("mas", 14)} Agregar tratamiento</button></div>
      <div class="full" style="display:grid;grid-template-columns:minmax(0,1fr) 90px 70px 110px 36px;gap:8px;padding:0 11px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em"><span>Tratamiento</span><span>Pieza</span><span>Cant.</span><span>Precio</span><span></span></div>
      <div class="full filas-items" data-filas>${(items0.length ? items0 : [{}]).map(fila).join("")}</div>
      <label class="campo"><span>Descuento (%)</span><input type="number" name="descuento" min="0" max="100" value="${pres?.descuento || 0}"></label>
      <label class="campo"><span>Forma de pago</span><select name="formaPago"><option value="contado">Contado</option><option value="mensualidades" ${pres?.formaPago === "mensualidades" ? "selected" : ""}>Mensualidades</option></select></label>
      <label class="campo"><span>Número de pagos</span><select name="pagos">${[1, 3, 6, 12].map((n) => `<option value="${n}" ${Number(pres?.pagos || 1) === n ? "selected" : ""}>${n} pago${n > 1 ? "s" : ""}</option>`).join("")}</select></label>
      <label class="campo"><span>Estado</span><select name="estado"><option value="borrador">Borrador</option><option value="enviado" ${!pres || pres.estado === "enviado" ? "selected" : ""}>Enviado al paciente</option></select></label>
      <label class="campo full"><span>Notas para el paciente</span><textarea name="notas" rows="2" placeholder="Incluye recomendaciones y próximos pasos…">${KD.esc(pres?.notas || "")}</textarea></label>
      <div class="full totales-pres" data-totales></div>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("presupuestos", 16)} Guardar presupuesto</button>`,
  });
  const f = m.querySelector("form");
  const cont = m.querySelector("[data-filas]");
  const recalcular = () => {
    const filas = [...cont.querySelectorAll("[data-fila]")];
    const sub = filas.reduce((s, r) => s + (Number(r.querySelector('[name="precio"]').value) || 0) * (Number(r.querySelector('[name="cant"]').value) || 1), 0);
    const total = Math.round(sub * (1 - (Number(f.descuento.value) || 0) / 100));
    const pagos = f.formaPago.value === "mensualidades" ? Number(f.pagos.value) : 1;
    f.pagos.disabled = f.formaPago.value !== "mensualidades";
    m.querySelector("[data-totales]").innerHTML = `<div><small>Subtotal ${KD.fmtDinero(sub)}${Number(f.descuento.value) ? ` · descuento ${f.descuento.value}%` : ""}</small><small>Total estimado${pagos > 1 ? ` · ${pagos} pagos de ${KD.fmtDinero(Math.ceil(total / pagos))}` : ""}</small></div><strong>${KD.fmtDinero(total)}</strong>`;
  };
  recalcular();
  f.addEventListener("input", recalcular);
  f.addEventListener("change", (e) => {
    if (e.target.name === "trat") e.target.closest("[data-fila]").querySelector('[name="precio"]').value = KD.byId("tratamientos", e.target.value).precio;
    recalcular();
  });
  f.addEventListener("click", (e) => {
    if (e.target.closest("[data-add]")) { cont.insertAdjacentHTML("beforeend", fila()); recalcular(); }
    const q = e.target.closest("[data-quitar]");
    if (q) { q.closest("[data-fila]").remove(); recalcular(); }
  });
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const pac = pacientes.find((p) => etq(p) === v.paciente);
    if (!pac) { f.paciente.classList.add("invalido"); KD.toast("Selecciona un paciente de la lista.", "bad"); return; }
    const filas = [...cont.querySelectorAll("[data-fila]")];
    if (!filas.length) { KD.toast("Agrega al menos un tratamiento.", "bad"); return; }
    const obj = pres || { id: KD.uid("pr"), folio: `P-${String(KD.db.presupuestos.reduce((mx, p) => Math.max(mx, Number(p.folio.split("-")[1]) || 0), 0) + 1).padStart(5, "0")}`, fecha: KD.hoy() };
    const ids = [];
    for (const r of filas) {
      const tid = r.querySelector('[name="trat"]').value;
      const datos = { tratamientoId: tid, pieza: KD.listaPiezas(r.querySelector('[name="pieza"]').value).join(", "), cantidad: Number(r.querySelector('[name="cant"]').value) || 1, precio: Number(r.querySelector('[name="precio"]').value) || 0 };
      let it = r.dataset.plan ? KD.byId("planes", r.dataset.plan) : null;
      if (it) Object.assign(it, datos);
      else {
        it = { id: KD.uid("pl"), pacienteId: pac.id, doctorId: v.doctorId, sucursalId: KD.sucursalUnica(), consultaId: null, fecha: KD.hoy(), ...datos, estado: "pendiente", fechaEstado: KD.hoy() };
        KD.db.planes.push(it);
      }
      it.presupuestoId = obj.id;
      ids.push(it.id);
    }
    if (pres) for (const it of KD.itemsPresupuesto(pres)) if (!ids.includes(it.id)) delete it.presupuestoId;
    Object.assign(obj, { pacienteId: pac.id, doctorId: v.doctorId, sucursalId: pres?.sucursalId || KD.sucursalUnica(), items: ids, descuento: Number(v.descuento) || 0,
      formaPago: v.formaPago, pagos: v.formaPago === "mensualidades" ? Number(v.pagos) || 1 : 1, notas: v.notas, estado: v.estado, fechaEstado: KD.hoy() });
    if (!pres) KD.db.presupuestos.push(obj);
    KD.guardar(); KD.cerrarModal(); KD.render();
    KD.toast(`Presupuesto ${obj.folio} guardado · ${KD.fmtDinero(KD.totalPresupuesto(obj))}`);
  });
};
