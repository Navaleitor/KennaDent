// Seguimiento: conversaciones pendientes con pacientes para cuidar su salud y la operación.
KD.vistas = KD.vistas || {};

const segAbiertos = { presupuestos: false, sinCita: false, tratamientos: false };

KD.vistas.seguimiento = (main) => {
  const sucIds = KD.sucursalesFiltro();
  const s = KD.seguimiento(sucIds);
  const dinero = KD.verDinero();
  const hechosHoy = Object.values(KD.db.seguimientoHecho || {}).filter((f) => f === KD.hoy()).length + (KD.db.tareas || []).filter((t) => t.hecho === KD.hoy()).length;
  const pctDia = s.total + hechosHoy ? hechosHoy / (s.total + hechosHoy) : 1;
  const pac = (id) => KD.byId("pacientes", id);

  const bloque = (clave, eyebrow, titulo, lista, fila) => `
    <section class="card" style="margin-bottom:18px">
      <div class="card-head"><div><span class="eyebrow">${eyebrow}</span><h2>${titulo} ${KD.badge(String(lista.length), lista.length ? "warn" : "")}</h2></div>
        ${lista.length > 5 ? `<button class="btn-link" data-ver="${clave}">${segAbiertos[clave] ? "Ver menos" : `Ver todos (${lista.length})`} ${KD.icon(segAbiertos[clave] ? "abajo" : "der", 14)}</button>` : ""}</div>
      <div class="filas">${lista.length ? lista.slice(0, segAbiertos[clave] ? 60 : 5).map(fila).join("") : KD.vacio("Nada pendiente aquí.")}</div>
    </section>`;
  const acciones = (o) => `<div class="acciones">
    <a class="btn btn-ghost btn-sm" href="${KD.waLink(pac(o.pacienteId)?.telefono)}" target="_blank" rel="noopener" title="WhatsApp">${KD.icon("whatsapp", 14)}<span class="sr-only">WhatsApp</span></a>
    <a class="btn btn-ghost btn-sm" href="#/pacientes/${o.pacienteId}">Ver paciente</a>
    ${KD.puede("agenda_editar") && o.tipo !== "presupuesto" ? `<button class="btn btn-ghost btn-sm" data-agendar="${o.pacienteId}">${KD.icon("agenda", 14)} Agendar</button>` : ""}
    <button class="btn btn-ok btn-sm" data-hecho="${o.clave}">${KD.icon("checkCirculo", 14)} Marcar realizado</button></div>`;

  main.innerHTML = `
    ${KD.cabecera("Retención y crecimiento", "Seguimiento", "Prioriza las conversaciones que ayudan a cuidar al paciente y a la clínica.",
      `<button class="btn" data-tarea>${KD.icon("mas", 16)} Nueva tarea</button>`)}
    <div class="banner">
      <div><span class="eyebrow">Centro de oportunidades</span><h2>${s.total ? `Hay ${s.total} seguimientos que merecen tu atención.` : "Todo al día. ¡Buen trabajo!"}</h2>
        <p>El sistema los ordena por urgencia para que ningún tratamiento se quede a medias. Lo marcado como realizado se oculta 30 días.</p></div>
      <div style="min-width:180px"><div class="grande">${Math.round(pctDia * 100)}%</div><small class="muted" style="display:block;text-align:right">de tareas al día</small>${KD.progreso(pctDia)}</div>
    </div>

    ${s.tareas.length ? `<section class="card" style="margin-bottom:18px">
      <div class="card-head"><div><span class="eyebrow">Tareas del equipo</span><h2>Pendientes ${KD.badge(String(s.tareas.length), "info")}</h2></div></div>
      <div class="filas">${s.tareas.map((t) => `<div class="fila"><span class="fila-ico">${KD.icon("checkCirculo", 17)}</span>
        <span class="fila-txt"><strong>${KD.esc(t.titulo)}</strong><small>${t.pacienteId ? `${KD.esc(pac(t.pacienteId)?.nombre)} · ` : ""}Para el ${KD.esc(KD.fmtFecha(t.fecha))} · ${KD.esc(KD.nombreUsuario(t.usuarioId))}</small></span>
        <div class="acciones">${t.pacienteId ? `<a class="btn btn-ghost btn-sm" href="#/pacientes/${t.pacienteId}">Ver paciente</a>` : ""}<button class="btn btn-ok btn-sm" data-tarea-hecha="${t.id}">${KD.icon("checkCirculo", 14)} Marcar realizado</button></div></div>`).join("")}</div>
    </section>` : ""}

    ${bloque("presupuestos", "Prioridad alta", "Presupuestos pendientes", s.presupuestos, (o) => `<div class="fila">
      <span class="fila-ico bad">${KD.icon("alerta", 17)}</span>
      <span class="fila-txt"><strong>${KD.esc(o.titulo)}</strong><small>${KD.esc(pac(o.pacienteId)?.nombre)} · ${o.dias} días sin respuesta · ${KD.esc(o.pres.folio)}</small></span>
      ${dinero ? `<span class="fila-monto">${KD.fmtDinero(o.total)}</span>` : ""}${acciones(o)}</div>`)}

    ${bloque("sinCita", "Retención", "Pacientes sin próxima cita", s.sinCita, (o) => `<div class="fila">
      <span class="fila-ico warn">${KD.icon("reloj", 17)}</span>
      <span class="fila-txt"><strong>${KD.esc(o.titulo)}</strong><small>${KD.esc(pac(o.pacienteId)?.nombre)} · última cita hace ${o.dias} días</small></span>${acciones(o)}</div>`)}

    ${bloque("tratamientos", "Operación clínica", "Tratamientos pendientes", s.tratamientos, (o) => `<div class="fila">
      <span class="fila-ico">${KD.icon("seguimiento", 17)}</span>
      <span class="fila-txt"><strong>${KD.esc(o.titulo)}</strong><small>${KD.esc(pac(o.pacienteId)?.nombre)} · ${o.items.map((i) => KD.nombreTrat(i.tratamientoId) + (i.pieza ? ` (${i.pieza})` : "")).map(KD.esc).join(", ")}</small></span>${acciones(o)}</div>`)}`;

  main.querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => { segAbiertos[b.dataset.ver] = !segAbiertos[b.dataset.ver]; KD.vistas.seguimiento(main); }));
  main.querySelectorAll("[data-hecho]").forEach((b) => b.addEventListener("click", () => { KD.marcarSeguimiento(b.dataset.hecho); KD.render(); KD.toast("Seguimiento marcado como realizado"); }));
  main.querySelectorAll("[data-agendar]").forEach((b) => b.addEventListener("click", () => KD.formCita({ pacienteId: b.dataset.agendar, sucursalId: KD.sucursalUnica(), tipoId: "c3" })));
  main.querySelectorAll("[data-tarea-hecha]").forEach((b) => b.addEventListener("click", () => {
    const t = KD.db.tareas.find((x) => x.id === b.dataset.tareaHecha);
    t.hecho = KD.hoy(); KD.guardar(); KD.render(); KD.toast("Tarea completada");
  }));
  main.querySelector("[data-tarea]").addEventListener("click", formTarea);
};

function formTarea() {
  const pacientes = KD.db.pacientes.filter((p) => p.activo);
  const m = KD.modal({
    titulo: "Nueva tarea de seguimiento",
    subtitulo: "Por ejemplo: llamar a un paciente, confirmar un pago o enviar un presupuesto.",
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>¿Qué hay que hacer? <em>*</em></span><input name="titulo" required placeholder="Ej. Llamar para confirmar tratamiento"></label>
      <label class="campo full"><span>Paciente (opcional)</span><input name="paciente" list="tarea-pacientes" autocomplete="off" placeholder="Nombre o expediente">
        <datalist id="tarea-pacientes">${pacientes.map((p) => `<option value="${KD.esc(`${p.nombre} · ${p.expediente}`)}">`).join("")}</datalist></label>
      <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${KD.hoy()}"></label>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} Crear tarea</button>`,
  });
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    const f = m.querySelector("form");
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const pac = pacientes.find((p) => `${p.nombre} · ${p.expediente}` === v.paciente);
    (KD.db.tareas ||= []).push({ id: KD.uid("ta"), titulo: v.titulo, pacienteId: pac?.id || "", fecha: v.fecha, usuarioId: KD.usuario().id, sucursalId: KD.sucursalUnica(), hecho: "" });
    KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast("Tarea creada");
  });
}
