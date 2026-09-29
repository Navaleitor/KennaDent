// Pacientes: directorio clínico compartido entre sucursales, alta y edición.
KD.vistas = KD.vistas || {};

let pacFiltro = { q: "", estado: "activos", suc: "todas", pagina: 0 };
const POR_PAGINA = 25;

KD.vistas.pacientes = (main, partes) => {
  if (partes[0]) return KD.vistas.expediente(main, partes);
  const puedeEditar = KD.puede("pacientes_editar");
  const dinero = KD.verDinero();

  main.innerHTML = `
    ${KD.cabecera("Directorio clínico", "Pacientes", "La historia de cada paciente, conectada con su agenda y operación. Visible desde cualquier sucursal.",
      puedeEditar ? `<button class="btn" data-nuevo>${KD.icon("usuarioMas", 16)} Nuevo paciente</button>` : "")}
    <div class="filtros">
      <label class="buscar">${KD.icon("buscar", 16)}<span class="sr-only">Buscar</span>
        <input type="search" placeholder="Buscar por nombre, expediente o teléfono…" value="${KD.esc(pacFiltro.q)}" data-q></label>
      <select data-suc aria-label="Sucursal habitual"><option value="todas">Todas las sucursales</option>${KD.opciones(KD.db.sucursales, pacFiltro.suc)}</select>
      <div class="segmentado" role="group" aria-label="Estado">
        <button data-estado="activos" class="${pacFiltro.estado === "activos" ? "activo" : ""}">Activos</button>
        <button data-estado="bajas" class="${pacFiltro.estado === "bajas" ? "activo" : ""}">Dados de baja</button>
      </div>
    </div>
    <div class="card"><div data-tabla></div></div>`;

  const pintarTabla = () => {
    const q = KD.buscable(pacFiltro.q);
    const lista = KD.db.pacientes.filter((p) =>
      (pacFiltro.estado === "activos" ? p.activo : !p.activo) &&
      (pacFiltro.suc === "todas" || p.sucursalId === pacFiltro.suc) &&
      (!q || KD.buscable(`${p.nombre} ${p.expediente} ${p.telefono}`).includes(q)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    pacFiltro.pagina = Math.min(pacFiltro.pagina, paginas - 1);
    const visibles = lista.slice(pacFiltro.pagina * POR_PAGINA, (pacFiltro.pagina + 1) * POR_PAGINA);
    main.querySelector("[data-tabla]").innerHTML = lista.length ? `<div class="tabla-wrap">
      <table class="responsive">
        <thead><tr><th>Paciente</th><th>Última cita</th><th>Próxima cita</th><th>Tratamiento actual</th><th>Estado</th>${dinero ? '<th class="num">Saldo</th>' : ""}<th></th></tr></thead>
        <tbody>${visibles.map((p) => {
          const prox = KD.proximaCita(p.id);
          const ultima = KD.ultimaVisita(p.id);
          const pend = KD.pendientePaciente(p.id);
          const actual = pend.find((x) => x.estado === "aceptado") || pend[0];
          const saldo = dinero ? KD.citasPaciente(p.id).filter((c) => !c.cobro && !c.cobrado && KD.consultaDeCita(c.id)).reduce((s, c) => s + KD.montoCita(c), 0) : 0;
          return `<tr class="clic" data-id="${p.id}">
            <td class="principal-celda"><div class="celda-persona">${KD.avatar(p.nombre)}<div><strong>${KD.esc(p.nombre)}</strong><span class="sub">${KD.esc(p.telefono)} · ${KD.esc(p.expediente)}${p.alergias ? ` · ${KD.badge("Alergia", "bad")}` : ""}</span></div></div></td>
            <td data-l="Última cita">${ultima ? KD.esc(KD.fmtFecha(ultima)) : '<span class="muted">Sin visitas</span>'}</td>
            <td data-l="Próxima cita">${prox ? `${KD.esc(KD.fmtFecha(prox.fecha))} <span class="muted">${prox.hora}</span>` : '<span class="rojo-txt">Sin cita</span>'}</td>
            <td data-l="Tratamiento">${actual ? KD.esc(KD.nombreTrat(actual.tratamientoId)) : ultima ? '<span class="muted">Sin tratamiento pendiente</span>' : "Valoración inicial"}</td>
            <td data-l="Estado">${p.activo ? KD.punto("Activo", "activo-pill") : KD.punto("Baja", "cita-no_asistio")}</td>
            ${dinero ? `<td data-l="Saldo" class="num">${saldo ? `<span class="monto-egr">${KD.fmtDinero(saldo)}</span>` : '<span class="muted">Al corriente</span>'}</td>` : ""}
            <td data-l=""><button class="btn-icon sin-borde chico" data-menu="${p.id}" aria-label="Opciones">${KD.icon("puntos", 16)}</button></td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
      <div class="card-pie"><span>Mostrando ${pacFiltro.pagina * POR_PAGINA + 1}–${pacFiltro.pagina * POR_PAGINA + visibles.length} de ${lista.length} pacientes</span>
        <span class="acciones"><button class="btn-icon chico" data-pag="-1" ${pacFiltro.pagina === 0 ? "disabled" : ""} aria-label="Anterior">${KD.icon("izq", 16)}</button>
        <strong>${pacFiltro.pagina + 1} / ${paginas}</strong>
        <button class="btn-icon chico" data-pag="1" ${pacFiltro.pagina >= paginas - 1 ? "disabled" : ""} aria-label="Siguiente">${KD.icon("der", 16)}</button></span></div>`
      : KD.vacio("No se encontraron pacientes.", "pacientes");
    main.querySelectorAll("tr[data-id]").forEach((tr) => tr.addEventListener("click", (e) => {
      if (e.target.closest("[data-menu]")) return;
      location.hash = `#/pacientes/${tr.dataset.id}`;
    }));
    main.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", () => {
      const p = KD.byId("pacientes", b.dataset.menu);
      KD.popover(b, [
        { texto: "Ver ficha", icono: "pacientes", accion: () => (location.hash = `#/pacientes/${p.id}`) },
        KD.puede("agenda_editar") && p.activo && { texto: "Agendar cita", icono: "agenda", accion: () => KD.formCita({ pacienteId: p.id, sucursalId: KD.sucursalUnica() }) },
        { texto: "Escribir por WhatsApp", icono: "whatsapp", accion: () => window.open(KD.waLink(p.telefono), "_blank", "noopener") },
        KD.puede("pacientes_editar") && { texto: "Editar datos", icono: "editar", accion: () => KD.formPaciente(p) },
      ]);
    }));
    main.querySelectorAll("[data-pag]").forEach((b) => b.addEventListener("click", () => { pacFiltro.pagina += Number(b.dataset.pag); pintarTabla(); }));
  };
  pintarTabla();

  main.querySelector("[data-q]").addEventListener("input", (e) => { pacFiltro.q = e.target.value; pacFiltro.pagina = 0; pintarTabla(); });
  main.querySelector("[data-suc]").addEventListener("change", (e) => { pacFiltro.suc = e.target.value; pacFiltro.pagina = 0; pintarTabla(); });
  main.querySelectorAll("[data-estado]").forEach((b) => b.addEventListener("click", () => { pacFiltro.estado = b.dataset.estado; pacFiltro.pagina = 0; KD.vistas.pacientes(main, []); }));
  main.querySelector("[data-nuevo]")?.addEventListener("click", () => KD.formPaciente());
};

// ---------- Alta / edición de paciente ----------
// Recepción solo captura datos generales. Alergias y antecedentes los captura el doctor (Issue #11).
KD.formPaciente = (pac, alGuardar) => {
  const clinico = KD.puede("clinico_editar");
  const d = pac || { nombre: "", nacimiento: "", sexo: "", telefono: "", email: "", sucursalId: KD.sucursalUnica(), alergias: "", antecedentes: "" };
  const m = KD.modal({
    titulo: pac ? "Editar paciente" : "Nuevo paciente",
    subtitulo: pac ? `Expediente ${KD.esc(pac.expediente)}` : `Se asignará el expediente ${KD.siguienteExpediente()}. El nombre se guarda en mayúsculas.`,
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Nombre completo <em>*</em></span><input name="nombre" required value="${KD.esc(d.nombre)}" autocomplete="off" style="text-transform:uppercase" placeholder="Nombre(s) y apellidos"></label>
      <label class="campo"><span>Fecha de nacimiento <em>*</em></span><input type="date" name="nacimiento" required value="${d.nacimiento || ""}" max="${KD.hoy()}"></label>
      <label class="campo"><span>Sexo</span><select name="sexo"><option value="">—</option>${KD.opciones([{ id: "F", nombre: "Femenino" }, { id: "M", nombre: "Masculino" }], d.sexo)}</select></label>
      <label class="campo"><span>Teléfono / WhatsApp <em>*</em></span><input type="tel" name="telefono" required value="${KD.esc(d.telefono)}" placeholder="81 0000 0000"></label>
      <label class="campo"><span>Correo electrónico</span><input type="email" name="email" value="${KD.esc(d.email)}"></label>
      <label class="campo full"><span>Sucursal habitual</span><select name="sucursalId">${KD.opciones(KD.db.sucursales.filter((s) => s.activa), d.sucursalId)}</select>
        <span class="ayuda" data-den></span></label>
      ${clinico ? `<div class="seccion-form">Datos clínicos <small>Solo los edita el personal clínico</small></div>
        <label class="campo full"><span>Alergias</span><input name="alergias" value="${KD.esc(d.alergias)}" placeholder="Ej. penicilina, látex. Déjalo vacío si no tiene."></label>
        <label class="campo full"><span>Antecedentes médicos</span><textarea name="antecedentes" rows="2" placeholder="Enfermedades, medicamentos, embarazo…">${KD.esc(d.antecedentes)}</textarea></label>`
      : `<p class="nota-form">${KD.icon("info", 16)}<span>Las <strong>alergias y antecedentes médicos</strong> los captura el doctor. ${pac ? "" : "Al guardar, al doctor que lo atienda le llegará un aviso para completarlos."}</span></p>`}
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} ${pac ? "Guardar cambios" : "Dar de alta"}</button>`,
  });
  const f = m.querySelector("form");
  const den = () => {
    const el = m.querySelector("[data-den]");
    if (!f.nacimiento.value) { el.textContent = "El expediente es visible desde cualquier sucursal de la empresa."; return; }
    const tipo = KD.denticion({ nacimiento: f.nacimiento.value });
    el.textContent = `${KD.edad(f.nacimiento.value)} años · Odontograma: ${KD.NOMBRE_DENTICION[tipo]}.`;
  };
  den();
  f.nacimiento.addEventListener("change", den);
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    v.nombre = KD.mayus(v.nombre);
    const dup = KD.db.pacientes.find((p) => p.id !== pac?.id && p.nombre === v.nombre && p.nacimiento === v.nacimiento);
    if (dup && !m.dataset.dupOk) { m.dataset.dupOk = "1"; KD.toast(`Ya existe ${dup.nombre} (${dup.expediente}) con la misma fecha de nacimiento. Presiona de nuevo para darlo de alta de todos modos.`, "bad"); return; }
    const obj = pac || { id: KD.uid("p"), expediente: KD.siguienteExpediente(), alta: KD.hoy(), activo: true };
    Object.assign(obj, v);
    if (clinico) delete obj.datosClinicos;
    else if (!pac) obj.datosClinicos = false;
    if (!pac) KD.db.pacientes.push(obj);
    KD.guardar();
    KD.cerrarModal();
    KD.toast(pac ? "Datos del paciente actualizados" : `Paciente dado de alta · ${obj.expediente}`);
    if (alGuardar) alGuardar(obj);
    else if (!pac) location.hash = `#/pacientes/${obj.id}`;
    else KD.render();
  });
};
