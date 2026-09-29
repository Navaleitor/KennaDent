// Personal: alta, baja, usuario de acceso, color en la agenda y permisos de cada trabajador.
KD.vistas = KD.vistas || {};

let perFiltro = { q: "", estado: "activos", puesto: "" };

KD.vistas.personal = (main) => {
  main.innerHTML = `
    ${KD.cabecera("Administración", "Personal", "Alta y baja del equipo, su usuario de acceso, su color en la agenda y sus permisos.",
      `<button class="btn" data-nuevo>${KD.icon("usuarioMas", 16)} Agregar integrante</button>`)}
    <div class="filtros">
      <label class="buscar">${KD.icon("buscar", 16)}<span class="sr-only">Buscar</span><input type="search" placeholder="Buscar por nombre o usuario" value="${KD.esc(perFiltro.q)}" data-q></label>
      <select data-puesto aria-label="Puesto"><option value="">Todos los puestos</option>${KD.opciones(KD.PUESTOS, perFiltro.puesto)}</select>
      <div class="segmentado" role="group" aria-label="Estado">
        <button data-estado="activos" class="${perFiltro.estado === "activos" ? "activo" : ""}">Activos</button>
        <button data-estado="bajas" class="${perFiltro.estado === "bajas" ? "activo" : ""}">Bajas</button>
      </div>
    </div>
    <div class="card"><div class="tabla-wrap" data-tabla></div></div>`;

  const pintar = () => {
    const sucIds = KD.sucursalesFiltro();
    const q = KD.buscable(perFiltro.q);
    const lista = KD.db.personal.filter((p) =>
      (perFiltro.estado === "activos" ? p.activo : !p.activo) && (!perFiltro.puesto || p.puesto === perFiltro.puesto) &&
      p.sucursales.some((s) => sucIds.includes(s)) && (!q || KD.buscable(`${p.nombre} ${p.usuario}`).includes(q)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    main.querySelector("[data-tabla]").innerHTML = lista.length ? `<table class="responsive">
      <thead><tr><th>Integrante</th><th>Puesto</th><th>Sucursales</th><th>Usuario</th><th>${perFiltro.estado === "activos" ? "Alta" : "Baja"}</th><th class="num">Permisos</th></tr></thead>
      <tbody>${lista.map((p) => `<tr class="clic" data-id="${p.id}">
        <td class="principal-celda"><div class="celda-persona">${KD.avatar(p.nombre, KD.color(p.color))}<div><strong>${KD.esc(KD.nombrePersona(p))}</strong><span class="sub">${KD.esc(p.telefono)}${p.cedula ? ` · Cédula ${KD.esc(p.cedula)}` : ""}</span></div></div></td>
        <td data-l="Puesto">${KD.esc(KD.puesto(p.puesto).nombre)}${p.especialidad ? `<span class="sub">${KD.esc(p.especialidad)}</span>` : ""}</td>
        <td data-l="Sucursales"><div class="chips">${p.sucursales.map((s) => KD.badge(KD.nombreSuc(s))).join("")}</div></td>
        <td data-l="Usuario"><span class="mono">${KD.esc(p.usuario)}</span></td>
        <td data-l="${p.activo ? "Alta" : "Baja"}">${KD.esc(KD.fmtFecha(p.activo ? p.alta : p.baja))}${!p.activo && p.motivoBaja ? `<span class="sub">${KD.esc(p.motivoBaja)}</span>` : ""}</td>
        <td data-l="Permisos" class="num">${p.permisos.length} de ${KD.PERMISOS.length}</td>
      </tr>`).join("")}</tbody></table>` : KD.vacio("No hay personal con estos filtros.", "personal");
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
  const usados = KD.db.personal.filter((p) => p.id !== per?.id).map((p) => p.usuario);
  const colorLibre = KD.COLORES.find((c) => !KD.db.personal.some((p) => p.activo && p.color === c.id))?.id || KD.COLORES[0].id;
  const d = per || { nombre: "", sexo: "", puesto: "recepcion", especialidad: "", cedula: "", telefono: "", email: "", color: colorLibre, titulo: false,
    sucursales: KD.sucursalesFiltro().slice(0, 1), permisos: [...KD.puesto("recepcion").permisos] };
  const grupos = [...new Set(KD.PUESTOS.map((p) => p.grupo))];
  const gruposPermisos = [...new Set(KD.PERMISOS.map((p) => p.grupo))];
  const checksPermisos = (lista) => gruposPermisos.map((g) => `<div class="grupo">${KD.esc(g)}</div>` +
    KD.PERMISOS.filter((p) => p.grupo === g).map((p) => `<label><input type="checkbox" name="permisos" value="${p.id}" ${lista.includes(p.id) ? "checked" : ""}> ${KD.esc(p.nombre)}</label>`).join("")).join("");

  const m = KD.modal({
    titulo: per ? KD.nombrePersona(per) : "Agregar integrante",
    subtitulo: "Administra quién puede operar KennaDent. El nombre se guarda en mayúsculas; el usuario y la contraseña se generan solos.",
    ancho: "ancho",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Nombre completo <em>*</em></span><input name="nombre" required value="${KD.esc(d.nombre)}" placeholder="Nombre y dos apellidos, sin Dr. / Dra." style="text-transform:uppercase" autocomplete="off">
        <span class="ayuda">Se mostrará como: <strong data-preview></strong></span></label>
      <label class="campo"><span>Sexo <em>*</em></span><select name="sexo" required><option value="">—</option>${KD.opciones([{ id: "F", nombre: "Femenino" }, { id: "M", nombre: "Masculino" }], d.sexo)}</select></label>
      <label class="campo"><span>Puesto <em>*</em></span><select name="puesto" required>
        ${grupos.map((g) => `<optgroup label="${KD.esc(g)}">${KD.opciones(KD.PUESTOS.filter((p) => p.grupo === g), d.puesto)}</optgroup>`).join("")}
      </select></label>
      <label class="campo" data-esp><span>Especialidad</span><select name="especialidad"><option value="">—</option>${KD.opciones(KD.ESPECIALIDADES.map((e) => ({ id: e, nombre: e })), d.especialidad)}</select></label>
      <label class="campo" data-ced><span>Cédula profesional</span><input name="cedula" value="${KD.esc(d.cedula)}" inputmode="numeric"></label>
      <label class="checks full" style="display:flex"><input type="checkbox" name="titulo" ${d.titulo ? "checked" : ""}> Usar prefijo Dr. / Dra. (según el sexo)</label>
      <label class="campo"><span>Teléfono / WhatsApp <em>*</em></span><input type="tel" name="telefono" required value="${KD.esc(d.telefono)}"></label>
      <label class="campo"><span>Correo (opcional)</span><input type="email" name="email" value="${KD.esc(d.email)}" placeholder="Si la clínica tiene correos propios"></label>
      <div class="campo full"><span>Color en la agenda</span>
        <div class="colores" role="radiogroup" aria-label="Color">${KD.COLORES.map((c) => `<label title="${KD.esc(c.nombre)}"><input type="radio" name="color" value="${c.id}" ${d.color === c.id ? "checked" : ""} aria-label="${KD.esc(c.nombre)}"><span style="--c:${c.hex}"></span></label>`).join("")}</div>
        <span class="ayuda">Identifica sus citas en la agenda (bandera de color) y su avatar.</span></div>
      <div class="campo full"><span>Sucursales donde trabaja <em>*</em></span>
        <div class="checks">${KD.db.sucursales.filter((s) => s.activa).map((s) => `<label><input type="checkbox" name="sucursales" value="${s.id}" ${d.sucursales.includes(s.id) ? "checked" : ""}> ${KD.esc(s.nombre)}</label>`).join("")}</div>
      </div>

      <div class="seccion-form">Acceso al sistema <small>Solo el administrador ve estos datos</small></div>
      <div class="credenciales">
        <label class="campo"><span>Usuario</span><input name="usuario" readonly value="${KD.esc(per?.usuario || "")}" placeholder="Se genera con el nombre"></label>
        <label class="campo"><span>Contraseña</span><div class="pass-wrap"><input name="password" readonly value="${KD.esc(per?.password || "")}" placeholder="Se genera al guardar">
          ${per ? `<button type="button" class="btn-icon" data-copiar title="Copiar usuario y contraseña" aria-label="Copiar">${KD.icon("copiar", 16)}</button><button type="button" class="btn-icon" data-regenerar title="Generar nueva contraseña" aria-label="Generar nueva contraseña">${KD.icon("chispa", 16)}</button>` : ""}</div></label>
        <p class="full muted" style="margin:0;font-size:12px" data-aviso-usuario>Formato: nombre.apellido y contraseña nombreapellido + 3 números al azar. Si ya existe el usuario, se usa el segundo apellido.</p>
      </div>

      <div class="seccion-form">Permisos de acceso <button type="button" class="btn-link" data-reset>Restablecer según el puesto</button></div>
      <div class="full checks" data-permisos>${checksPermisos(d.permisos)}</div>
      ${per && !per.activo ? `<p class="full badge bad" style="justify-self:start">Dado de baja el ${KD.esc(KD.fmtFecha(per.baja))}${per.motivoBaja ? " · " + KD.esc(per.motivoBaja) : ""}</p>` : ""}
    </form>`,
    acciones: `
      ${per && per.id !== yo.id ? `<button class="btn ${per.activo ? "btn-danger" : "btn-ghost"}" data-baja style="margin-right:auto">${per.activo ? "Dar de baja" : "Reactivar"}</button>` : ""}
      <button class="btn btn-ghost" data-cerrar>Cancelar</button>
      <button class="btn" data-guardar>${KD.icon("check", 16)} ${per ? "Guardar cambios" : "Agregar integrante"}</button>`,
  });
  const f = m.querySelector("form");
  const limpiarNombre = (n) => KD.mayus(n).replace(/^(DRA?\.?)\s+/, "");
  const actualizar = () => {
    const pu = KD.puesto(f.puesto.value);
    m.querySelector("[data-esp]").hidden = f.puesto.value !== "especialista";
    m.querySelector("[data-ced]").hidden = !pu.cedula;
    const nombre = limpiarNombre(f.nombre.value);
    m.querySelector("[data-preview]").textContent = nombre ? KD.nombrePersona({ nombre, titulo: f.titulo.checked, sexo: f.sexo.value || "F" }) : "—";
    if (!per && nombre) {
      const s = KD.sugerirUsuario(nombre, usados);
      f.usuario.value = s.usuario;
      m.querySelector("[data-aviso-usuario]").innerHTML = s.aviso ? `${KD.icon("alerta", 14)} ${KD.esc(s.aviso)}` : "Formato: nombre.apellido. La contraseña se genera al guardar (nombreapellido + 3 números al azar).";
      m.querySelector("[data-aviso-usuario]").style.color = s.aviso ? "var(--warn)" : "";
    }
  };
  actualizar();
  f.addEventListener("input", actualizar);
  f.puesto.addEventListener("change", () => {
    m.querySelector("[data-permisos]").innerHTML = checksPermisos(KD.puesto(f.puesto.value).permisos);
    f.titulo.checked = !!KD.puesto(f.puesto.value).titulo;
    actualizar();
  });
  f.sexo.addEventListener("change", actualizar);
  f.titulo.addEventListener("change", actualizar);
  m.querySelector("[data-reset]").addEventListener("click", () => { m.querySelector("[data-permisos]").innerHTML = checksPermisos(KD.puesto(f.puesto.value).permisos); });
  m.querySelector("[data-regenerar]")?.addEventListener("click", () => { f.password.value = KD.generarPassword(per.nombre); KD.toast("Nueva contraseña generada. Guarda los cambios para aplicarla."); });
  m.querySelector("[data-copiar]")?.addEventListener("click", () => {
    const txt = `Usuario: ${f.usuario.value}\nContraseña: ${f.password.value}`;
    (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => KD.toast("Usuario y contraseña copiados"), () => KD.toast(txt));
  });

  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const sucursales = [].concat(v.sucursales || []);
    if (!sucursales.length) { KD.toast("Selecciona al menos una sucursal.", "bad"); return; }
    const nombre = limpiarNombre(v.nombre);
    const obj = per || { id: KD.uid("u"), activo: true, alta: KD.hoy() };
    let aviso = "";
    if (!per) {
      const s = KD.sugerirUsuario(nombre, usados);
      obj.usuario = s.usuario; obj.password = KD.generarPassword(nombre); aviso = s.aviso;
    } else obj.password = f.password.value;
    Object.assign(obj, {
      nombre, sexo: v.sexo, puesto: v.puesto, especialidad: v.puesto === "especialista" ? v.especialidad : "", titulo: !!v.titulo,
      cedula: KD.puesto(v.puesto).cedula ? v.cedula : "", telefono: v.telefono, email: v.email, color: v.color || colorLibre,
      sucursales, permisos: [].concat(v.permisos || []),
    });
    if (!per) KD.db.personal.push(obj);
    KD.guardar(); KD.cerrarModal(); KD.render();
    if (per) { KD.toast("Datos actualizados"); return; }
    // Al dar de alta se muestran las credenciales para entregarlas al empleado
    KD.modal({
      titulo: `${KD.nombrePersona(obj)} ya tiene acceso`,
      subtitulo: "Entrega estos datos al empleado. Puedes volver a verlos en Personal.",
      cuerpo: `${aviso ? `<p class="nota-form warn" style="margin-bottom:14px">${KD.icon("alerta", 16)}<span>${KD.esc(aviso)}</span></p>` : ""}
        <div class="corte-resumen"><div><span>Usuario</span><b>${KD.esc(obj.usuario)}</b></div><div><span>Contraseña</span><b>${KD.esc(obj.password)}</b></div></div>
        <p class="muted" style="margin:12px 0 0;font-size:12px">En el sistema real se le pedirá cambiar la contraseña la primera vez que entre.</p>`,
      acciones: `<button class="btn" data-cerrar>Listo</button>`,
    });
  });

  m.querySelector("[data-baja]")?.addEventListener("click", () => {
    if (!per.activo) {
      per.activo = true; per.alta = KD.hoy(); delete per.baja; delete per.motivoBaja;
      KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast("Integrante reactivado");
      return;
    }
    const mb = KD.modal({
      titulo: `Dar de baja a ${KD.nombrePersona(per)}`,
      cuerpo: `<form class="form-grid" novalidate>
        <p class="full" style="margin:0">Ya no podrá entrar al sistema. Su historial (consultas, citas y ventas) se conserva para los reportes.</p>
        <label class="campo"><span>Fecha de baja</span><input type="date" name="fecha" value="${KD.hoy()}"></label>
        <label class="campo"><span>Motivo</span><select name="motivo"><option>Renuncia voluntaria</option><option>Término de contrato</option><option>Despido</option><option>Fin de servicio social / prácticas</option><option>Otro</option></select></label>
      </form>`,
      acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn btn-danger" data-ok>Confirmar baja</button>`,
    });
    mb.querySelector("[data-ok]").addEventListener("click", () => {
      const v = KD.leerForm(mb.querySelector("form"));
      per.activo = false; per.baja = v.fecha; per.motivoBaja = v.motivo;
      KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast(`${KD.nombrePersona(per)} dado(a) de baja`);
    });
  });
}
