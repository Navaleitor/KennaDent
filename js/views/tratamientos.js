// Tratamientos (gestión): catálogo con precio, duración y material que consume.
KD.vistas = KD.vistas || {};

let tratFiltro = { q: "", cat: "", estado: "activos" };

KD.vistas.tratamientos = (main) => {
  const dinero = KD.verDinero();
  const cats = [...new Set(KD.db.tratamientos.map((t) => t.categoria))].sort();
  const activos = KD.db.tratamientos.filter((t) => t.activo).length;
  // Pacientes con ese tratamiento pendiente o aceptado
  const pacActivos = {};
  for (const x of KD.db.planes) if (x.estado === "pendiente" || x.estado === "aceptado") (pacActivos[x.tratamientoId] ||= new Set()).add(x.pacienteId);

  main.innerHTML = `
    ${KD.cabecera("Catálogo clínico", "Tratamientos", "Administra el catálogo que alimenta presupuestos, citas, expedientes e inventario.",
      `<button class="btn" data-nuevo>${KD.icon("mas", 16)} Nuevo tratamiento</button>`)}
    <div class="banner">
      <div style="display:flex;gap:14px;align-items:center"><span class="kpi-ico ok">${KD.icon("tratamientos", 18)}</span>
        <div><h2 style="font-size:15px">Catálogo siempre ordenado</h2><p>Los nombres se guardan automáticamente en mayúsculas y se ordenan alfabéticamente.</p></div></div>
      <span class="muted"><strong style="color:var(--text)">${activos}</strong> activos</span>
    </div>
    <div class="filtros">
      <label class="buscar">${KD.icon("buscar", 16)}<input type="search" placeholder="Buscar tratamiento o categoría…" value="${KD.esc(tratFiltro.q)}" data-q aria-label="Buscar"></label>
      <select data-cat aria-label="Categoría"><option value="">Todas las categorías</option>${cats.map((c) => `<option ${tratFiltro.cat === c ? "selected" : ""}>${KD.esc(c)}</option>`).join("")}</select>
      <div class="segmentado"><button data-est="activos" class="${tratFiltro.estado === "activos" ? "activo" : ""}">Activos</button><button data-est="inactivos" class="${tratFiltro.estado === "inactivos" ? "activo" : ""}">Inactivos</button></div>
    </div>
    <section class="card"><div data-tabla></div></section>`;

  const pintar = () => {
    const q = KD.buscable(tratFiltro.q);
    const lista = KD.db.tratamientos.filter((t) => (tratFiltro.estado === "activos" ? t.activo : !t.activo) && (!tratFiltro.cat || t.categoria === tratFiltro.cat) && (!q || KD.buscable(`${t.nombre} ${t.categoria}`).includes(q)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    main.querySelector("[data-tabla]").innerHTML = lista.length ? `<div class="tabla-wrap"><table class="responsive">
      <thead><tr><th>Tratamiento</th><th>Categoría</th>${dinero ? '<th class="num">Precio base</th>' : ""}<th>Duración</th><th>Pacientes activos</th><th>Material</th><th></th></tr></thead>
      <tbody>${lista.map((t) => `<tr>
        <td class="principal-celda"><div class="celda-persona"><span class="kpi-ico">${KD.icon("tratamientos", 16)}</span><strong>${KD.esc(t.nombre)}</strong></div></td>
        <td data-l="Categoría">${KD.badge(t.categoria, "cat")}</td>
        ${dinero ? `<td data-l="Precio" class="num mono"><strong>${KD.fmtDinero(t.precio)}</strong></td>` : ""}
        <td data-l="Duración">${t.duracion} min</td>
        <td data-l="Pacientes">${KD.icon("pacientes", 14)} ${pacActivos[t.id]?.size || 0}</td>
        <td data-l="Material">${Object.keys(t.materiales || {}).length ? `${Object.keys(t.materiales).length} productos` : '<span class="muted">—</span>'}</td>
        <td data-l=""><div class="acciones" style="flex-wrap:nowrap">
          <button class="btn-icon sin-borde chico" data-editar="${t.id}" title="Editar" aria-label="Editar ${KD.esc(t.nombre)}">${KD.icon("editar", 16)}</button>
          <button class="btn-icon sin-borde chico peligro" data-borrar="${t.id}" title="Eliminar" aria-label="Eliminar ${KD.esc(t.nombre)}">${KD.icon("basura", 16)}</button></div></td>
      </tr>`).join("")}</tbody></table></div>` : KD.vacio("No hay tratamientos con estos filtros.", "tratamientos");
    main.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", () => formTratamiento(KD.byId("tratamientos", b.dataset.editar))));
    main.querySelectorAll("[data-borrar]").forEach((b) => b.addEventListener("click", () => borrarTratamiento(KD.byId("tratamientos", b.dataset.borrar))));
  };
  pintar();
  main.querySelector("[data-q]").addEventListener("input", (e) => { tratFiltro.q = e.target.value; pintar(); });
  main.querySelector("[data-cat]").addEventListener("change", (e) => { tratFiltro.cat = e.target.value; pintar(); });
  main.querySelectorAll("[data-est]").forEach((b) => b.addEventListener("click", () => { tratFiltro.estado = b.dataset.est; KD.vistas.tratamientos(main); }));
  main.querySelector("[data-nuevo]").addEventListener("click", () => formTratamiento(null));
};

// Si ya se usó en consultas o presupuestos no se borra: se desactiva para conservar el historial
function borrarTratamiento(t) {
  const usado = KD.db.planes.some((x) => x.tratamientoId === t.id) || KD.db.citas.some((c) => c.tratamientoId === t.id) || KD.db.consultas.some((c) => c.procedimientos.some((x) => x.tratamientoId === t.id));
  if (usado) {
    if (!t.activo) { KD.toast("Este tratamiento ya está inactivo y tiene historial, por eso no se puede borrar.", "bad"); return; }
    KD.confirmar("Desactivar tratamiento", `<strong>${KD.esc(t.nombre)}</strong> ya aparece en expedientes o presupuestos, así que no se puede borrar. Se <strong>desactivará</strong>: dejará de ofrecerse, pero el historial se conserva.`, "Desactivar", () => {
      t.activo = false; KD.guardar(); KD.render(); KD.toast("Tratamiento desactivado");
    });
    return;
  }
  KD.confirmar("Eliminar tratamiento", `Se eliminará <strong>${KD.esc(t.nombre)}</strong> del catálogo.`, "Eliminar", () => {
    KD.db.tratamientos = KD.db.tratamientos.filter((x) => x.id !== t.id);
    KD.guardar(); KD.render(); KD.toast("Tratamiento eliminado");
  });
}

function formTratamiento(t) {
  const cats = [...new Set(KD.db.tratamientos.map((x) => x.categoria))].sort();
  const prods = KD.db.productos.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const d = t || { nombre: "", categoria: cats[0], precio: 0, duracion: 45, activo: true, materiales: {} };
  const filaMat = (pid = "", q = 1) => `<div class="fila-item sin-precio" data-mat style="grid-template-columns:minmax(0,1fr) 110px 36px">
    <select name="mat_prod" aria-label="Producto">${KD.opciones(prods.map((p) => ({ id: p.id, nombre: `${p.nombre} (${p.unidad})` })), pid)}</select>
    <input type="number" name="mat_q" min="0" step="any" value="${q}" aria-label="Cantidad por pieza">
    <button type="button" class="btn-icon chico" data-quitar aria-label="Quitar">${KD.icon("cerrar", 15)}</button></div>`;
  const m = KD.modal({
    titulo: t ? "Editar tratamiento" : "Nuevo tratamiento",
    subtitulo: "El nombre se guardará automáticamente en mayúsculas y el catálogo se ordenará solo.",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Nombre del tratamiento <em>*</em></span><input name="nombre" required value="${KD.esc(d.nombre)}" placeholder="Ej. Limpieza dental">
        <span class="ayuda">Vista previa: <strong data-preview>${KD.esc(d.nombre) || "—"}</strong></span></label>
      <label class="campo"><span>Categoría <em>*</em></span><input name="categoria" required list="cats-trat" value="${KD.esc(d.categoria)}"><datalist id="cats-trat">${cats.map((c) => `<option value="${KD.esc(c)}">`).join("")}</datalist></label>
      <label class="campo"><span>Precio base (MXN)</span><input type="number" name="precio" min="0" step="50" value="${d.precio}"></label>
      <label class="campo"><span>Duración</span><select name="duracion">${[15, 30, 45, 60, 75, 90, 120, 150, 180, 240].map((x) => `<option value="${x}" ${x === d.duracion ? "selected" : ""}>${x} min</option>`).join("")}</select></label>
      <label class="campo"><span>Estado</span><select name="activo"><option value="1" ${d.activo ? "selected" : ""}>Activo</option><option value="0" ${d.activo ? "" : "selected"}>Inactivo</option></select></label>
      <div class="seccion-form">Material que usa <small>Por pieza tratada; sirve para la proyección del inventario</small></div>
      <div class="full filas-items" data-mats>${Object.entries(d.materiales || {}).map(([pid, q]) => filaMat(pid, q)).join("")}</div>
      <div class="full"><button type="button" class="btn btn-ghost btn-sm" data-add>${KD.icon("mas", 14)} Agregar material</button></div>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} ${t ? "Guardar cambios" : "Agregar tratamiento"}</button>`,
  });
  const f = m.querySelector("form");
  f.nombre.addEventListener("input", () => { m.querySelector("[data-preview]").textContent = KD.mayus(f.nombre.value) || "—"; });
  f.addEventListener("click", (e) => {
    if (e.target.closest("[data-add]")) m.querySelector("[data-mats]").insertAdjacentHTML("beforeend", filaMat());
    const q = e.target.closest("[data-quitar]");
    if (q) q.closest("[data-mat]").remove();
  });
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const nombre = KD.mayus(v.nombre);
    if (KD.db.tratamientos.some((x) => x.id !== t?.id && x.nombre === nombre)) { KD.toast(`Ya existe ${nombre} en el catálogo.`, "bad"); return; }
    const materiales = {};
    m.querySelectorAll("[data-mat]").forEach((r) => { const pid = r.querySelector('[name="mat_prod"]').value, q = Number(r.querySelector('[name="mat_q"]').value); if (pid && q > 0) materiales[pid] = (materiales[pid] || 0) + q; });
    const obj = t || { id: KD.uid("t") };
    Object.assign(obj, { nombre, categoria: v.categoria.trim(), duracion: Number(v.duracion) || 30, precio: Number(v.precio) || 0, activo: v.activo === "1", materiales });
    if (!t) KD.db.tratamientos.push(obj);
    KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast(t ? "Tratamiento actualizado" : `${nombre} agregado al catálogo`);
  });
}
