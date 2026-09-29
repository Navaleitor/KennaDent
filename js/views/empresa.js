// Empresa: datos generales, sucursales con sus unidades (sillones) y tipos de cita.
// El catálogo de tratamientos está en su propia sección (Gestión → Tratamientos).
KD.vistas = KD.vistas || {};

KD.vistas.empresa = (main, partes) => {
  const tabs = [["datos", "Datos de la empresa"], ["sucursales", "Sucursales y unidades"], ["citas", "Tipos de cita"]];
  const tab = tabs.some(([k]) => k === partes[0]) ? partes[0] : "sucursales";
  const activas = KD.db.sucursales.filter((s) => s.activa);
  main.innerHTML = `
    ${KD.cabecera("Administración", "Empresa", `${KD.esc(KD.db.empresa.nombre)} · ${activas.length} sucursales activas · ${activas.reduce((s, x) => s + KD.unidades(x.id).length, 0)} unidades dentales`)}
    <div class="tabs" role="tablist">${tabs.map(([k, n]) => `<a role="tab" href="#/empresa/${k}" class="${k === tab ? "activo" : ""}">${n}</a>`).join("")}${KD.puede("tratamientos") ? `<a href="#/tratamientos">Tratamientos y precios ${KD.icon("externo", 13)}</a>` : ""}</div>
    <div data-panel></div>`;
  ({ datos: tabDatos, sucursales: tabSucursales, citas: tabTiposCita })[tab](main.querySelector("[data-panel]"));
};

function tabDatos(panel) {
  const e = KD.db.empresa;
  panel.innerHTML = `<div class="card card-body" style="max-width:720px"><form class="form-grid" novalidate>
    <label class="campo"><span>Nombre comercial <em>*</em></span><input name="nombre" required value="${KD.esc(e.nombre)}" style="text-transform:uppercase"></label>
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
    KD.db.empresa.nombre = KD.mayus(KD.db.empresa.nombre);
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
        <div class="unidades-lista">${KD.unidades(s.id).map((u) => `<span class="badge info">${KD.icon("unidad", 13)} Unidad ${u}</span>`).join("")}</div>
        <p class="muted">${KD.unidades(s.id).length} unidades (sillones) · ${personal} trabajadores · ${pacientes} pacientes habituales</p>
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
  const d = s || { nombre: "", direccion: "", telefono: "", horario: "Lun–Vie 9:00–19:00", unidades: 1 };
  const m = KD.modal({
    titulo: s ? `Editar sucursal ${s.nombre}` : "Nueva sucursal",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Nombre <em>*</em></span><input name="nombre" required value="${KD.esc(d.nombre)}" placeholder="Ej. Valle Oriente" style="text-transform:uppercase"></label>
      <label class="campo full"><span>Dirección <em>*</em></span><input name="direccion" required value="${KD.esc(d.direccion)}"></label>
      <label class="campo"><span>Teléfono</span><input name="telefono" value="${KD.esc(d.telefono)}"></label>
      <label class="campo"><span>Horario</span><input name="horario" value="${KD.esc(d.horario)}"></label>
      <label class="campo"><span>Unidades dentales (sillones) <em>*</em></span><input type="number" name="unidades" min="1" max="20" required value="${d.unidades || 1}">
        <span class="ayuda">La agenda tendrá una columna por unidad: no se pueden atender más pacientes a la vez que sillones.</span></label>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>Guardar</button>`,
  });
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    const f = m.querySelector("form");
    if (!KD.validar(f)) return;
    const obj = s || { id: KD.uid("s"), activa: true };
    const v = KD.leerForm(f);
    const unidades = Math.max(1, Math.min(20, Number(v.unidades) || 1));
    if (s) {
      const futuras = KD.db.citas.filter((c) => c.sucursalId === s.id && c.fecha >= KD.hoy() && (c.unidad || 1) > unidades && ["programada", "confirmada", "en_sala"].includes(c.estado));
      if (futuras.length) { KD.toast(`Hay ${futuras.length} cita(s) próximas en unidades que quitarías. Muévelas antes de reducir unidades.`, "bad"); return; }
    }
    Object.assign(obj, { ...v, nombre: KD.mayus(v.nombre), unidades });
    if (!s) {
      KD.db.sucursales.push(obj);
      const yo = KD.usuario();
      if (!yo.sucursales.includes(obj.id)) yo.sucursales.push(obj.id);
    }
    KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast(s ? "Sucursal actualizada" : "Sucursal creada");
  });
}

function tabTiposCita(panel) {
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <p class="muted" style="margin:0">La duración se usa como valor inicial al agendar y se puede ajustar en cada cita.</p>
      <button class="btn" data-nuevo>${KD.icon("mas", 16)} Nuevo tipo de cita</button>
    </div>
    <div class="card" style="max-width:640px"><table class="responsive">
      <thead><tr><th>Tipo de cita</th><th>Al agendar</th><th class="num">Duración</th></tr></thead>
      <tbody>${KD.db.tiposCita.map((t) => `<tr class="clic" data-id="${t.id}"><td class="principal-celda"><strong>${KD.esc(t.nombre)}</strong></td>
        <td data-l="Al agendar">${t.tratamiento ? KD.badge("Pide tratamiento y piezas", "info") : ""}${t.diagnostico ? KD.badge("Diagnóstico: llena odontograma", "ok") : ""}${!t.tratamiento && !t.diagnostico ? '<span class="muted">—</span>' : ""}</td>
        <td data-l="Duración" class="num">${t.duracion} min</td></tr>`).join("")}</tbody>
    </table></div>`;
  const form = (t) => {
    const m = KD.modal({
      titulo: t ? "Editar tipo de cita" : "Nuevo tipo de cita",
      cuerpo: `<form class="form-grid" novalidate>
        <label class="campo"><span>Nombre <em>*</em></span><input name="nombre" required value="${KD.esc(t?.nombre || "")}" placeholder="Ej. Colocación de brackets"></label>
        <label class="campo"><span>Duración (min)</span><input type="number" name="duracion" min="15" step="15" value="${t?.duracion || 30}"></label>
        <label class="checks full" style="display:flex"><input type="checkbox" name="tratamiento" ${t?.tratamiento ? "checked" : ""}> Al agendar se elige el tratamiento y las piezas (ej. extracción, resina)</label>
        <label class="checks full" style="display:flex"><input type="checkbox" name="diagnostico" ${t?.diagnostico ? "checked" : ""}> Es cita de diagnóstico o primera vez (el doctor llena el odontograma)</label>
      </form>`,
      acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>Guardar</button>`,
    });
    m.querySelector("[data-guardar]").addEventListener("click", () => {
      const f = m.querySelector("form");
      if (!KD.validar(f)) return;
      const v = KD.leerForm(f);
      const obj = t || { id: KD.uid("c") };
      Object.assign(obj, { nombre: v.nombre, duracion: Number(v.duracion) || 30, tratamiento: !!v.tratamiento, diagnostico: !!v.diagnostico });
      if (!t) KD.db.tiposCita.push(obj);
      KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast("Tipos de cita actualizados");
    });
  };
  panel.querySelector("[data-nuevo]").addEventListener("click", () => form(null));
  panel.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => form(KD.byId("tiposCita", tr.dataset.id))));
}
