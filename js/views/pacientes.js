// Pacientes: lista global (compartida entre sucursales), alta y baja.
KD.vistas = KD.vistas || {};

let pacFiltro = { q: "", estado: "activos", suc: "todas" };

KD.vistas.pacientes = (main, partes) => {
  if (partes[0]) return KD.vistas.expediente(main, partes);
  const puedeEditar = KD.puede("pacientes_editar");
  const verPres = KD.puede("presupuestos");

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Pacientes</h1><p>Expedientes compartidos entre todas las sucursales de la empresa.</p></div>
      <div class="acciones">${puedeEditar ? `<button class="btn" data-nuevo>${KD.icon("mas", 16)} Nuevo paciente</button>` : ""}</div>
    </div>
    <div class="filtros">
      <label class="buscar">${KD.icon("buscar", 16)}<span class="sr-only">Buscar</span>
        <input type="search" placeholder="Buscar por nombre, expediente o teléfono" value="${KD.esc(pacFiltro.q)}" data-q></label>
      <select data-suc aria-label="Sucursal habitual">
        <option value="todas">Todas las sucursales</option>${KD.opciones(KD.db.sucursales, pacFiltro.suc)}
      </select>
      <div class="segmentado" role="group" aria-label="Estado">
        <button data-estado="activos" class="${pacFiltro.estado === "activos" ? "activo" : ""}">Activos</button>
        <button data-estado="bajas" class="${pacFiltro.estado === "bajas" ? "activo" : ""}">Dados de baja</button>
      </div>
    </div>
    <div class="card"><div class="tabla-wrap" data-tabla></div></div>`;

  const pintarTabla = () => {
    const q = pacFiltro.q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const lista = KD.db.pacientes.filter((p) =>
      (pacFiltro.estado === "activos" ? p.activo : !p.activo) &&
      (pacFiltro.suc === "todas" || p.sucursalId === pacFiltro.suc) &&
      (!q || `${p.nombre} ${p.expediente} ${p.telefono}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    const visibles = lista.slice(0, 100);
    main.querySelector("[data-tabla]").innerHTML = lista.length ? `
      <table class="responsive">
        <thead><tr><th>Paciente</th><th>Edad</th><th>Teléfono</th><th>Sucursal habitual</th><th>Última visita</th>${verPres ? '<th class="num">Pendiente</th>' : ""}</tr></thead>
        <tbody>${visibles.map((p) => {
          const pend = verPres ? KD.pendientePaciente(p.id).reduce((s, x) => s + x.precio, 0) : 0;
          return `<tr class="clic" data-id="${p.id}">
            <td class="principal-celda"><strong>${KD.esc(p.nombre)}</strong><span class="sub">${KD.esc(p.expediente)}${p.alergias ? " · " + KD.badge("Alergia", "bad") : ""}</span></td>
            <td data-l="Edad">${KD.edad(p.nacimiento)} años</td>
            <td data-l="Teléfono">${KD.esc(p.telefono)}</td>
            <td data-l="Sucursal">${KD.esc(KD.nombreSuc(p.sucursalId))}</td>
            <td data-l="Última visita">${KD.esc(KD.fmtFecha(KD.ultimaVisita(p.id))) || "—"}</td>
            ${verPres ? `<td data-l="Pendiente" class="num">${pend ? KD.fmtDinero(pend) : "—"}</td>` : ""}
          </tr>`;
        }).join("")}</tbody>
      </table>
      <div class="card-body muted">${lista.length > 100 ? `Mostrando 100 de ${lista.length}. Usa la búsqueda para encontrar a un paciente.` : `${lista.length} pacientes`}</div>`
      : KD.vacio("No se encontraron pacientes.");
    main.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", () => (location.hash = `#/pacientes/${tr.dataset.id}`)));
  };
  pintarTabla();

  main.querySelector("[data-q]").addEventListener("input", (e) => { pacFiltro.q = e.target.value; pintarTabla(); });
  main.querySelector("[data-suc]").addEventListener("change", (e) => { pacFiltro.suc = e.target.value; pintarTabla(); });
  main.querySelectorAll("[data-estado]").forEach((b) => b.addEventListener("click", () => { pacFiltro.estado = b.dataset.estado; KD.vistas.pacientes(main, []); }));
  main.querySelector("[data-nuevo]")?.addEventListener("click", () => KD.formPaciente());
};

// ---------- Alta / edición de paciente ----------
KD.formPaciente = (pac, alGuardar) => {
  const d = pac || { nombre: "", nacimiento: "", sexo: "", telefono: "", email: "", sucursalId: KD.sucursalesFiltro()[0], alergias: "", antecedentes: "" };
  const m = KD.modal({
    titulo: pac ? "Editar paciente" : "Nuevo paciente",
    cuerpo: `<form class="form-grid" novalidate>
      ${pac ? `<p class="full muted" style="margin:0">Expediente <strong>${KD.esc(pac.expediente)}</strong></p>` : `<p class="full muted" style="margin:0">Se asignará el expediente <strong>${KD.siguienteExpediente()}</strong>.</p>`}
      <label class="campo full"><span>Nombre completo <em>*</em></span><input name="nombre" required value="${KD.esc(d.nombre)}" autocomplete="off"></label>
      <label class="campo"><span>Fecha de nacimiento <em>*</em></span><input type="date" name="nacimiento" required value="${d.nacimiento}"></label>
      <label class="campo"><span>Sexo</span><select name="sexo"><option value="">—</option>${KD.opciones([{ id: "F", nombre: "Femenino" }, { id: "M", nombre: "Masculino" }], d.sexo)}</select></label>
      <label class="campo"><span>Teléfono / WhatsApp <em>*</em></span><input type="tel" name="telefono" required value="${KD.esc(d.telefono)}"></label>
      <label class="campo"><span>Correo electrónico</span><input type="email" name="email" value="${KD.esc(d.email)}"></label>
      <label class="campo full"><span>Sucursal habitual</span><select name="sucursalId">${KD.opciones(KD.db.sucursales.filter((s) => s.activa), d.sucursalId)}</select>
        <span class="ayuda">El expediente es visible desde cualquier sucursal de la empresa.</span></label>
      <div class="seccion-form">Datos médicos</div>
      <label class="campo full"><span>Alergias</span><input name="alergias" value="${KD.esc(d.alergias)}" placeholder="Ej. penicilina, látex. Déjalo vacío si no tiene."></label>
      <label class="campo full"><span>Antecedentes médicos</span><textarea name="antecedentes" rows="2" placeholder="Enfermedades, medicamentos, embarazo…">${KD.esc(d.antecedentes)}</textarea></label>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${pac ? "Guardar cambios" : "Dar de alta"}</button>`,
  });
  const f = m.querySelector("form");
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const obj = pac || { id: KD.uid("p"), expediente: KD.siguienteExpediente(), alta: KD.hoy(), activo: true };
    Object.assign(obj, v);
    if (!pac) KD.db.pacientes.push(obj);
    KD.guardar();
    KD.cerrarModal();
    KD.toast(pac ? "Datos del paciente actualizados" : `Paciente dado de alta · ${obj.expediente}`);
    if (alGuardar) alGuardar(obj);
    else if (!pac) location.hash = `#/pacientes/${obj.id}`;
    else KD.render();
  });
};
