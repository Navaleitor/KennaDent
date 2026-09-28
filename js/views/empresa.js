// Empresa: datos generales, sucursales, catálogo de tratamientos y tipos de cita.
KD.vistas = KD.vistas || {};

KD.vistas.empresa = (main, partes) => {
  const tabs = [["datos", "Datos de la empresa"], ["sucursales", "Sucursales"], ["catalogo", "Tratamientos y precios"], ["citas", "Tipos de cita"]];
  const tab = tabs.some(([k]) => k === partes[0]) ? partes[0] : "sucursales";
  main.innerHTML = `
    <div class="page-head"><div><h1>Empresa</h1><p>${KD.esc(KD.db.empresa.nombre)} · ${KD.db.sucursales.filter((s) => s.activa).length} sucursales activas</p></div></div>
    <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button role="tab" data-tab="${k}" class="${k === tab ? "activo" : ""}">${n}</button>`).join("")}</div>
    <div data-panel></div>`;
  main.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => (location.hash = `#/empresa/${b.dataset.tab}`)));
  ({ datos: tabDatos, sucursales: tabSucursales, catalogo: tabCatalogo, citas: tabTiposCita })[tab](main.querySelector("[data-panel]"));
};

function tabDatos(panel) {
  const e = KD.db.empresa;
  panel.innerHTML = `<div class="card card-body" style="max-width:720px"><form class="form-grid" novalidate>
    <label class="campo"><span>Nombre comercial <em>*</em></span><input name="nombre" required value="${KD.esc(e.nombre)}"></label>
    <label class="campo"><span>Razón social</span><input name="razonSocial" value="${KD.esc(e.razonSocial)}"></label>
    <label class="campo"><span>RFC</span><input name="rfc" value="${KD.esc(e.rfc)}"></label>
    <label class="campo"><span>Teléfono</span><input name="telefono" value="${KD.esc(e.telefono)}"></label>
    <label class="campo full"><span>Correo de contacto</span><input type="email" name="email" value="${KD.esc(e.email)}"></label>
    <div class="full"><button type="button" class="btn" data-guardar>Guardar</button></div>
  </form></div>`;
  panel.querySelector("[data-guardar]").addEventListener("click", () => {
    const f = panel.querySelector("form");
    if (!KD.validar(f)) return;
    Object.assign(KD.db.empresa, KD.leerForm(f));
    KD.guardar(); KD.render(); KD.toast("Datos de la empresa guardados");
  });
}

function tabSucursales(panel) {
  panel.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn" data-nueva>${KD.icon("mas", 16)} Nueva sucursal</button></div>
    <div class="grid grid-3">${KD.db.sucursales.map((s) => {
      const personal = KD.db.personal.filter((p) => p.activo && p.sucursales.includes(s.id)).length;
      const pacientes = KD.db.pacientes.filter((p) => p.activo && p.sucursalId === s.id).length;
      return `<article class="card suc-card">
        <h3>${KD.esc(s.nombre)} ${s.activa ? KD.badge("Activa", "ok") : KD.badge("Inactiva", "bad")}</h3>
        <p>${KD.esc(s.direccion)}</p>
        <p>${KD.esc(s.telefono)} · ${KD.esc(s.horario)}</p>
        <p class="muted">${personal} trabajadores · ${pacientes} pacientes habituales</p>
        <div class="acciones">
          <button class="btn btn-ghost btn-sm" data-editar="${s.id}">${KD.icon("editar", 14)} Editar</button>
          <button class="btn btn-ghost btn-sm" data-toggle="${s.id}">${s.activa ? "Desactivar" : "Activar"}</button>
        </div>
      </article>`;
    }).join("")}</div>`;
  panel.querySelector("[data-nueva]").addEventListener("click", () => formSucursal(null));
  panel.querySelectorAll("[data-editar]").forEach((b) => b.addEventListener("click", () => formSucursal(KD.byId("sucursales", b.dataset.editar))));
  panel.querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => {
    const s = KD.byId("sucursales", b.dataset.toggle);
    if (s.activa && KD.db.sucursales.filter((x) => x.activa).length === 1) { KD.toast("Debe quedar al menos una sucursal activa."); return; }
    const aplicar = () => { s.activa = !s.activa; KD.guardar(); KD.render(); KD.toast(`Sucursal ${s.nombre} ${s.activa ? "activada" : "desactivada"}`); };
    if (s.activa) KD.confirmar("Desactivar sucursal", `La sucursal <strong>${KD.esc(s.nombre)}</strong> dejará de aparecer en la agenda. Sus datos e historial se conservan.`, "Desactivar", aplicar);
    else aplicar();
  }));
}

function formSucursal(s) {
  const d = s || { nombre: "", direccion: "", telefono: "", horario: "Lun–Vie 9:00–19:00" };
  const m = KD.modal({
    titulo: s ? `Editar sucursal ${s.nombre}` : "Nueva sucursal",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Nombre <em>*</em></span><input name="nombre" required value="${KD.esc(d.nombre)}" placeholder="Ej. Valle Oriente"></label>
      <label class="campo full"><span>Dirección <em>*</em></span><input name="direccion" required value="${KD.esc(d.direccion)}"></label>
      <label class="campo"><span>Teléfono</span><input name="telefono" value="${KD.esc(d.telefono)}"></label>
      <label class="campo"><span>Horario</span><input name="horario" value="${KD.esc(d.horario)}"></label>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>Guardar</button>`,
  });
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    const f = m.querySelector("form");
    if (!KD.validar(f)) return;
    const obj = s || { id: KD.uid("s"), activa: true };
    Object.assign(obj, KD.leerForm(f));
    if (!s) {
      KD.db.sucursales.push(obj);
      const yo = KD.usuario();
      if (!yo.sucursales.includes(obj.id)) yo.sucursales.push(obj.id);
    }
    KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast(s ? "Sucursal actualizada" : "Sucursal creada");
  });
}

function tabCatalogo(panel) {
  const cats = [...new Set(KD.db.tratamientos.map((t) => t.categoria))];
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <p class="muted" style="margin:0">Precios de lista. El doctor puede ajustar el monto en cada consulta o presupuesto.</p>
      <button class="btn" data-nuevo>${KD.icon("mas", 16)} Nuevo tratamiento</button>
    </div>
    <div class="card"><div class="tabla-wrap"><table class="responsive">
      <thead><tr><th>Tratamiento</th><th>Área</th><th class="num">Duración</th><th class="num">Precio</th><th>Estado</th></tr></thead>
      <tbody>${cats.map((c) => KD.db.tratamientos.filter((t) => t.categoria === c).map((t) => `<tr class="clic" data-id="${t.id}">
        <td class="principal-celda"><strong>${KD.esc(t.nombre)}</strong></td>
        <td data-l="Área">${KD.esc(t.categoria)}</td>
        <td data-l="Duración" class="num">${t.duracion} min</td>
        <td data-l="Precio" class="num">${KD.fmtDinero(t.precio)}</td>
        <td data-l="Estado">${t.activo ? KD.badge("Activo", "ok") : KD.badge("Inactivo")}</td>
      </tr>`).join("")).join("")}</tbody>
    </table></div></div>`;
  panel.querySelector("[data-nuevo]").addEventListener("click", () => formTratamiento(null, cats));
  panel.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => formTratamiento(KD.byId("tratamientos", tr.dataset.id), cats)));
}

function formTratamiento(t, cats) {
  const d = t || { nombre: "", categoria: cats[0], precio: 0, duracion: 30, activo: true };
  const m = KD.modal({
    titulo: t ? "Editar tratamiento" : "Nuevo tratamiento",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Nombre <em>*</em></span><input name="nombre" required value="${KD.esc(d.nombre)}"></label>
      <label class="campo"><span>Área <em>*</em></span><input name="categoria" required list="lista-cats" value="${KD.esc(d.categoria)}">
        <datalist id="lista-cats">${cats.map((c) => `<option value="${KD.esc(c)}">`).join("")}</datalist></label>
      <label class="campo"><span>Duración (min)</span><input type="number" name="duracion" min="5" step="5" value="${d.duracion}"></label>
      <label class="campo"><span>Precio de lista (MXN)</span><input type="number" name="precio" min="0" step="50" value="${d.precio}"></label>
      <label class="campo"><span>Estado</span><select name="activo"><option value="1" ${d.activo ? "selected" : ""}>Activo</option><option value="0" ${d.activo ? "" : "selected"}>Inactivo</option></select></label>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>Guardar</button>`,
  });
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    const f = m.querySelector("form");
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const obj = t || { id: KD.uid("t") };
    Object.assign(obj, { nombre: v.nombre, categoria: v.categoria, duracion: Number(v.duracion) || 30, precio: Number(v.precio) || 0, activo: v.activo === "1" });
    if (!t) KD.db.tratamientos.push(obj);
    KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast("Catálogo actualizado");
  });
}

function tabTiposCita(panel) {
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <p class="muted" style="margin:0">La duración se usa como valor inicial al agendar y se puede ajustar en cada cita.</p>
      <button class="btn" data-nuevo>${KD.icon("mas", 16)} Nuevo tipo de cita</button>
    </div>
    <div class="card" style="max-width:640px"><table class="responsive">
      <thead><tr><th>Tipo de cita</th><th class="num">Duración</th></tr></thead>
      <tbody>${KD.db.tiposCita.map((t) => `<tr class="clic" data-id="${t.id}"><td class="principal-celda"><strong>${KD.esc(t.nombre)}</strong></td><td data-l="Duración" class="num">${t.duracion} min</td></tr>`).join("")}</tbody>
    </table></div>`;
  const form = (t) => {
    const m = KD.modal({
      titulo: t ? "Editar tipo de cita" : "Nuevo tipo de cita",
      cuerpo: `<form class="form-grid" novalidate>
        <label class="campo"><span>Nombre <em>*</em></span><input name="nombre" required value="${KD.esc(t?.nombre || "")}" placeholder="Ej. Colocación de brackets"></label>
        <label class="campo"><span>Duración (min)</span><input type="number" name="duracion" min="15" step="15" value="${t?.duracion || 30}"></label>
      </form>`,
      acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>Guardar</button>`,
    });
    m.querySelector("[data-guardar]").addEventListener("click", () => {
      const f = m.querySelector("form");
      if (!KD.validar(f)) return;
      const v = KD.leerForm(f);
      const obj = t || { id: KD.uid("c") };
      Object.assign(obj, { nombre: v.nombre, duracion: Number(v.duracion) || 30 });
      if (!t) KD.db.tiposCita.push(obj);
      KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast("Tipos de cita actualizados");
    });
  };
  panel.querySelector("[data-nuevo]").addEventListener("click", () => form(null));
  panel.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => form(KD.byId("tiposCita", tr.dataset.id))));
}
