// Personal: alta, baja y permisos de los trabajadores.
KD.vistas = KD.vistas || {};

let perFiltro = { q: "", estado: "activos", puesto: "" };

KD.vistas.personal = (main) => {
  main.innerHTML = `
    <div class="page-head">
      <div><h1>Personal</h1><p>Alta y baja de trabajadores y permisos de acceso de cada uno.</p></div>
      <div class="acciones"><button class="btn" data-nuevo>${KD.icon("mas", 16)} Dar de alta</button></div>
    </div>
    <div class="filtros">
      <label class="buscar">${KD.icon("buscar", 16)}<span class="sr-only">Buscar</span>
        <input type="search" placeholder="Buscar por nombre" value="${KD.esc(perFiltro.q)}" data-q></label>
      <select data-puesto aria-label="Puesto"><option value="">Todos los puestos</option>${KD.opciones(KD.PUESTOS, perFiltro.puesto)}</select>
      <div class="segmentado" role="group" aria-label="Estado">
        <button data-estado="activos" class="${perFiltro.estado === "activos" ? "activo" : ""}">Activos</button>
        <button data-estado="bajas" class="${perFiltro.estado === "bajas" ? "activo" : ""}">Bajas</button>
      </div>
    </div>
    <div class="card"><div class="tabla-wrap" data-tabla></div></div>`;

  const pintar = () => {
    const sucIds = KD.sucursalesFiltro();
    const q = perFiltro.q.toLowerCase();
    const lista = KD.db.personal.filter((p) =>
      (perFiltro.estado === "activos" ? p.activo : !p.activo) &&
      (!perFiltro.puesto || p.puesto === perFiltro.puesto) &&
      p.sucursales.some((s) => sucIds.includes(s)) &&
      (!q || p.nombre.toLowerCase().includes(q)));
    main.querySelector("[data-tabla]").innerHTML = lista.length ? `<table class="responsive">
      <thead><tr><th>Nombre</th><th>Puesto</th><th>Sucursales</th><th>Contacto</th><th>${perFiltro.estado === "activos" ? "Alta" : "Baja"}</th><th class="num">Permisos</th></tr></thead>
      <tbody>${lista.map((p) => `<tr class="clic" data-id="${p.id}">
        <td class="principal-celda"><strong>${KD.esc(p.nombre)}</strong>${p.cedula ? `<span class="sub">Cédula ${KD.esc(p.cedula)}</span>` : ""}</td>
        <td data-l="Puesto">${KD.esc(KD.puesto(p.puesto).nombre)}${p.especialidad ? `<span class="sub">${KD.esc(p.especialidad)}</span>` : ""}</td>
        <td data-l="Sucursales"><div class="chips">${p.sucursales.map((s) => KD.badge(KD.nombreSuc(s))).join("")}</div></td>
        <td data-l="Contacto">${KD.esc(p.telefono)}<span class="sub">${KD.esc(p.email)}</span></td>
        <td data-l="${p.activo ? "Alta" : "Baja"}">${KD.esc(KD.fmtFecha(p.activo ? p.alta : p.baja))}${!p.activo && p.motivoBaja ? `<span class="sub">${KD.esc(p.motivoBaja)}</span>` : ""}</td>
        <td data-l="Permisos" class="num">${p.permisos.length} de ${KD.PERMISOS.length}</td>
      </tr>`).join("")}</tbody></table>` : KD.vacio("No hay personal con estos filtros.");
    main.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => formPersonal(KD.byId("personal", tr.dataset.id))));
  };
  pintar();
  main.querySelector("[data-q]").addEventListener("input", (e) => { perFiltro.q = e.target.value; pintar(); });
  main.querySelector("[data-puesto]").addEventListener("change", (e) => { perFiltro.puesto = e.target.value; pintar(); });
  main.querySelectorAll("[data-estado]").forEach((b) => b.addEventListener("click", () => { perFiltro.estado = b.dataset.estado; KD.vistas.personal(main); }));
  main.querySelector("[data-nuevo]").addEventListener("click", () => formPersonal(null));
};

function formPersonal(per) {
  const yo = KD.usuario();
  const d = per || { nombre: "", puesto: "recepcion", especialidad: "", cedula: "", telefono: "", email: "", sucursales: KD.sucursalesFiltro().slice(0, 1), permisos: [...KD.puesto("recepcion").permisos] };
  const grupos = [...new Set(KD.PUESTOS.map((p) => p.grupo))];
  const gruposPermisos = [...new Set(KD.PERMISOS.map((p) => p.grupo))];
  const checksPermisos = (lista) => gruposPermisos.map((g) => `<div class="grupo">${KD.esc(g)}</div>` +
    KD.PERMISOS.filter((p) => p.grupo === g).map((p) => `<label><input type="checkbox" name="permisos" value="${p.id}" ${lista.includes(p.id) ? "checked" : ""}> ${KD.esc(p.nombre)}</label>`).join("")).join("");

  const m = KD.modal({
    titulo: per ? per.nombre : "Alta de personal",
    ancho: "ancho",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Nombre completo <em>*</em></span><input name="nombre" required value="${KD.esc(d.nombre)}" placeholder="Ej. Dra. Ana López"></label>
      <label class="campo"><span>Puesto <em>*</em></span><select name="puesto" required>
        ${grupos.map((g) => `<optgroup label="${KD.esc(g)}">${KD.opciones(KD.PUESTOS.filter((p) => p.grupo === g), d.puesto)}</optgroup>`).join("")}
      </select></label>
      <label class="campo" data-esp><span>Especialidad</span><select name="especialidad"><option value="">—</option>${KD.opciones(KD.ESPECIALIDADES.map((e) => ({ id: e, nombre: e })), d.especialidad)}</select></label>
      <label class="campo" data-ced><span>Cédula profesional</span><input name="cedula" value="${KD.esc(d.cedula)}" inputmode="numeric"></label>
      <label class="campo"><span>Teléfono / WhatsApp <em>*</em></span><input type="tel" name="telefono" required value="${KD.esc(d.telefono)}"></label>
      <label class="campo full"><span>Correo (usuario para entrar al sistema) <em>*</em></span><input type="email" name="email" required value="${KD.esc(d.email)}"></label>
      <div class="campo full"><span>Sucursales donde trabaja <em>*</em></span>
        <div class="checks">${KD.db.sucursales.filter((s) => s.activa).map((s) => `<label><input type="checkbox" name="sucursales" value="${s.id}" ${d.sucursales.includes(s.id) ? "checked" : ""}> ${KD.esc(s.nombre)}</label>`).join("")}</div>
      </div>
      <div class="seccion-form">Permisos de acceso <button type="button" class="btn-link" data-reset>Restablecer según el puesto</button></div>
      <div class="full checks" data-permisos>${checksPermisos(d.permisos)}</div>
      ${per && !per.activo ? `<p class="full badge bad" style="justify-self:start">Dado de baja el ${KD.esc(KD.fmtFecha(per.baja))}${per.motivoBaja ? " · " + KD.esc(per.motivoBaja) : ""}</p>` : ""}
    </form>`,
    acciones: `
      ${per && per.id !== yo.id ? `<button class="btn ${per.activo ? "btn-danger" : "btn-ghost"}" data-baja style="margin-right:auto">${per.activo ? "Dar de baja" : "Reactivar"}</button>` : ""}
      <button class="btn btn-ghost" data-cerrar>Cancelar</button>
      <button class="btn" data-guardar>${per ? "Guardar cambios" : "Dar de alta"}</button>`,
  });
  const f = m.querySelector("form");
  const actualizarCampos = () => {
    const p = KD.puesto(f.puesto.value);
    m.querySelector("[data-esp]").style.display = f.puesto.value === "especialista" ? "" : "none";
    m.querySelector("[data-ced]").style.display = p.cedula ? "" : "none";
  };
  actualizarCampos();
  f.puesto.addEventListener("change", () => {
    actualizarCampos();
    m.querySelector("[data-permisos]").innerHTML = checksPermisos(KD.puesto(f.puesto.value).permisos);
  });
  m.querySelector("[data-reset]").addEventListener("click", () => {
    m.querySelector("[data-permisos]").innerHTML = checksPermisos(KD.puesto(f.puesto.value).permisos);
  });

  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const sucursales = [].concat(v.sucursales || []);
    if (!sucursales.length) { KD.toast("Selecciona al menos una sucursal."); return; }
    const obj = per || { id: KD.uid("u"), activo: true, alta: KD.hoy() };
    Object.assign(obj, {
      nombre: v.nombre, puesto: v.puesto, especialidad: v.puesto === "especialista" ? v.especialidad : "",
      cedula: KD.puesto(v.puesto).cedula ? v.cedula : "", telefono: v.telefono, email: v.email,
      sucursales, permisos: [].concat(v.permisos || []),
    });
    if (!per) KD.db.personal.push(obj);
    KD.guardar(); KD.cerrarModal(); KD.render();
    KD.toast(per ? "Datos actualizados" : `${obj.nombre} dado(a) de alta`);
  });

  m.querySelector("[data-baja]")?.addEventListener("click", () => {
    if (!per.activo) {
      per.activo = true; per.alta = KD.hoy(); delete per.baja; delete per.motivoBaja;
      KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast("Trabajador reactivado");
      return;
    }
    const mb = KD.modal({
      titulo: `Dar de baja a ${per.nombre}`,
      cuerpo: `<form class="form-grid" novalidate>
        <p class="full" style="margin:0">Ya no podrá entrar al sistema. Su historial (consultas, citas y ventas) se conserva para las estadísticas.</p>
        <label class="campo"><span>Fecha de baja</span><input type="date" name="fecha" value="${KD.hoy()}"></label>
        <label class="campo"><span>Motivo</span><select name="motivo"><option>Renuncia voluntaria</option><option>Término de contrato</option><option>Despido</option><option>Fin de servicio social / prácticas</option><option>Otro</option></select></label>
      </form>`,
      acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn btn-danger" data-ok>Confirmar baja</button>`,
    });
    mb.querySelector("[data-ok]").addEventListener("click", () => {
      const v = KD.leerForm(mb.querySelector("form"));
      per.activo = false; per.baja = v.fecha; per.motivoBaja = v.motivo;
      KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast(`${per.nombre} dado(a) de baja`);
    });
  });
}
