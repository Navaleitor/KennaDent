// Caja: cobros de pacientes atendidos, entradas y salidas de dinero y corte diario.
// Recepción (permiso "cobrar") solo ve el monto a cobrar de cada paciente; los totales son de gestión (permiso "caja").
KD.vistas = KD.vistas || {};

let cajaFecha = null;

KD.vistas.caja = (main) => {
  const gestion = KD.puede("caja");
  const cobrar = KD.puede("cobrar");
  const sucId = KD.sucursalUnica();
  const sucIds = KD.sucursalesFiltro();
  const hoy = KD.hoy();
  cajaFecha = gestion ? cajaFecha || hoy : hoy;
  const rc = KD.resumenCaja(cajaFecha, sucId);
  const cerrada = !!rc.corte;
  const corteHoy = KD.db.cortes.find((c) => c.fecha === hoy && c.sucursalId === sucId);
  const porCobrar = KD.porCobrar([sucId]);
  const esperando = KD.esperandoRegistro([sucId]);
  const cobradosHoy = KD.db.citas.filter((c) => c.cobro && c.cobro.fecha === hoy && c.sucursalId === sucId).sort((a, b) => b.cobro.hora.localeCompare(a.cobro.hora));
  const pac = (id) => KD.byId("pacientes", id);
  const saldoPend = porCobrar.reduce((s, c) => s + KD.montoCita(c), 0);

  const tarjetaPorCobrar = `<section class="card">
    <div class="card-head"><div><span class="eyebrow">Pacientes atendidos</span><h2>Por cobrar ${KD.badge(String(porCobrar.length), porCobrar.length ? "warn" : "ok")}</h2>
      <p>Revisa en la cita lo que hizo el doctor, cobra al paciente y listo.</p></div></div>
    <div class="filas">${porCobrar.length ? porCobrar.map((c) => {
      const cons = KD.consultaDeCita(c.id);
      return `<div class="fila"><span class="fila-ico warn">${KD.icon("caja", 17)}</span>
        <span class="fila-txt"><strong>${KD.esc(pac(c.pacienteId)?.nombre)}</strong><small>${c.fecha === hoy ? `Hoy ${c.hora}` : KD.esc(KD.fmtFecha(c.fecha))} · ${KD.esc(cons.procedimientos.map((x) => KD.nombreTrat(x.tratamientoId) + (x.pieza ? ` (${x.pieza})` : "")).join(", ") || KD.tratamientoCita(c))} · ${KD.esc(KD.nombreUsuario(c.doctorId))}</small></span>
        <span class="mono" style="font-weight:700">${KD.fmtDinero(KD.montoCita(c))}</span>
        <div class="acciones"><button class="btn-icon chico" data-ver-cita="${c.id}" title="Ver cita" aria-label="Ver cita">${KD.icon("ojo", 15)}</button>
        ${cobrar ? `<button class="btn btn-sm" data-cobrar="${c.id}" ${corteHoy ? "disabled title='La caja de hoy ya está cerrada'" : ""}>Cobrar</button>` : ""}</div></div>`;
    }).join("") : KD.vacio("No hay pacientes pendientes de cobro.")}</div>
    ${esperando.length ? `<div class="card-head" style="border-top:1px solid var(--border)"><div><span class="eyebrow">Aún no se puede cobrar</span><h2>Esperando el registro del doctor ${KD.badge(String(esperando.length))}</h2><p>La cita terminó pero el doctor no ha llenado lo que se hizo.</p></div></div>
      <div class="filas">${esperando.map((c) => `<div class="fila"><span class="fila-ico">${KD.icon("reloj", 17)}</span><span class="fila-txt"><strong>${KD.esc(pac(c.pacienteId)?.nombre)}</strong><small>Cita ${c.hora} · ${KD.esc(KD.tratamientoCita(c))} · ${KD.esc(KD.nombreUsuario(c.doctorId))}</small></span>${KD.badge("Falta registro", "bad")}</div>`).join("")}</div>` : ""}
  </section>`;

  if (!gestion) {
    // Vista de recepción: sin totales, sin balance
    main.innerHTML = `
      ${KD.cabecera("Operación del día", "Caja", `Sucursal ${KD.esc(KD.nombreSuc(sucId))} · Cobra a los pacientes atendidos.`)}
      ${corteHoy ? `<div class="aviso-inline">${KD.icon("info", 20)}<span>La caja de hoy ya se cerró con el corte diario. Los cobros nuevos se registran mañana o pide a gerencia que la reabra.</span></div>` : ""}
      <div class="grid grid-2">${tarjetaPorCobrar}
        <section class="card"><div class="card-head"><div><span class="eyebrow">Hoy</span><h2>Cobros registrados</h2></div></div>
          <div class="filas">${cobradosHoy.length ? cobradosHoy.map((c) => `<div class="fila"><span class="fila-ico ok">${KD.icon("check", 17)}</span><span class="fila-txt"><strong>${KD.esc(pac(c.pacienteId)?.nombre)}</strong><small>${c.cobro.hora} · ${KD.METODOS[c.cobro.metodo]} · ${KD.esc(KD.nombreUsuario(c.cobro.usuarioId))}</small></span><span class="monto-ing">${KD.fmtDinero(c.cobro.monto)}</span></div>`).join("") : KD.vacio("Todavía no hay cobros hoy.")}</div>
        </section></div>`;
    enlazar(main);
    return;
  }

  main.innerHTML = `
    ${KD.cabecera("Operación financiera", "Caja", `Sucursal ${KD.esc(KD.nombreSuc(sucId))} · Registra entradas y salidas y mantén el balance al día.`,
      `${sucIds.length > 1 ? `<select data-suc aria-label="Sucursal" style="width:auto">${KD.opciones(KD.sucursalesUsuario().filter((s) => sucIds.includes(s.id)), sucId)}</select>` : ""}
       <input type="date" value="${cajaFecha}" max="${hoy}" min="${KD.sumarDias(hoy, -45)}" data-fecha style="width:auto" aria-label="Día">
       <button class="btn btn-ghost" data-corte ${cerrada ? "" : ""}>${KD.icon("presupuestos", 16)} ${cerrada ? "Ver corte" : "Corte diario"}</button>
       <button class="btn" data-mov ${cerrada ? "disabled" : ""}>${KD.icon("mas", 16)} Registrar movimiento</button>`)}
    ${cerrada ? `<div class="aviso-inline" style="background:var(--ok-soft)">${KD.icon("checkCirculo", 20)}<span><strong>Caja cerrada.</strong> Corte hecho por ${KD.esc(KD.nombreUsuario(rc.corte.usuarioId))} a las ${rc.corte.hora}. ${rc.corte.diferencia ? `Diferencia: <strong>${KD.fmtDinero(rc.corte.diferencia)}</strong> (${rc.corte.diferencia > 0 ? "sobrante" : "faltante"}).` : "Sin diferencias."}</span></div>` : ""}
    <div class="kpis">
      <div class="card kpi"><div class="kpi-top"><span class="etq">Ingresos del día</span><span class="kpi-ico ok">${KD.icon("bajar", 18)}</span></div><div class="valor">${KD.fmtDinero(rc.totalIngresos)}</div><div class="sub">${rc.ingresos.length} movimientos</div></div>
      <div class="card kpi"><div class="kpi-top"><span class="etq">Egresos del día</span><span class="kpi-ico bad">${KD.icon("subir", 18)}</span></div><div class="valor">${KD.fmtDinero(rc.totalEgresos)}</div><div class="sub">${rc.egresos.length} movimientos</div></div>
      <div class="card kpi destacado"><div class="kpi-top"><span class="etq">Balance del día</span><span class="kpi-ico">${KD.icon("caja", 18)}</span></div><div class="valor">${KD.fmtDinero(rc.totalIngresos - rc.totalEgresos)}</div><div class="sub">Saldo pendiente de pacientes: ${KD.fmtDinero(saldoPend)}</div></div>
    </div>
    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><div><span class="eyebrow">Ingresos por método</span><h2>Distribución del día</h2></div></div>
        ${Object.entries(KD.METODOS).map(([k, n]) => {
          const cuantos = rc.ingresos.filter((i) => i.metodo === k).length;
          return `<div class="metodo-fila"><span class="fila-ico">${KD.icon(k === "efectivo" ? "dinero" : k === "tarjeta" ? "caja" : "bajar", 16)}</span><span>${n}<small>${cuantos} pago${cuantos === 1 ? "" : "s"}</small></span><b>${KD.fmtDinero(rc.porMetodo[k])}</b></div>`;
        }).join("")}
        <div class="card-pie"><span>Total ingresos</span><strong class="mono" style="color:var(--text)">${KD.fmtDinero(rc.totalIngresos)}</strong></div>
      </section>
      <section class="card">
        <div class="card-head"><div><span class="eyebrow">Movimientos del día</span><h2>Actividad de caja</h2></div></div>
        <div class="filas" style="max-height:330px;overflow:auto">${rc.movimientos.length ? rc.movimientos.map((m) => `<div class="fila" style="padding:10px 20px">
          <span class="fila-ico ${m.tipo === "ingreso" ? "ok" : "bad"}">${KD.icon(m.tipo === "ingreso" ? "bajar" : "subir", 16)}</span>
          <span class="fila-txt"><strong>${KD.esc(m.pacienteId ? `${m.concepto} · ${pac(m.pacienteId)?.nombre}` : m.concepto)}</strong><small>${m.hora} · ${KD.METODOS[m.metodo]} · ${KD.esc(KD.nombreUsuario(m.usuarioId))}</small></span>
          <span class="${m.tipo === "ingreso" ? "monto-ing" : "monto-egr"}">${m.tipo === "ingreso" ? "+" : "−"}${KD.fmtDinero(m.monto)}</span></div>`).join("") : KD.vacio("Sin movimientos este día.", "caja")}</div>
        <div class="card-body"><button class="btn btn-soft" style="width:100%" data-corte>${KD.icon("presupuestos", 16)} ${cerrada ? "Ver corte del día" : "Preparar corte diario"}</button></div>
      </section>
      <div class="span-2">${tarjetaPorCobrar}</div>
      <section class="card span-2">
        <div class="card-head"><div><span class="eyebrow">Historial</span><h2>Cortes anteriores</h2></div></div>
        <div class="tabla-wrap"><table class="responsive"><thead><tr><th>Fecha</th><th>Hizo el corte</th><th class="num">Ingresos</th><th class="num">Egresos</th><th class="num">Efectivo esperado</th><th class="num">Contado</th><th class="num">Diferencia</th></tr></thead>
          <tbody>${KD.db.cortes.filter((c) => c.sucursalId === sucId).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10).map((c) => `<tr class="clic" data-ver-corte="${c.fecha}">
            <td class="principal-celda"><strong>${KD.esc(KD.fmtFecha(c.fecha, { weekday: "short", day: "numeric", month: "short" }))}</strong></td>
            <td data-l="Hizo el corte">${KD.esc(KD.nombreUsuario(c.usuarioId))} · ${c.hora}</td>
            <td data-l="Ingresos" class="num">${KD.fmtDinero(c.totalIngresos)}</td><td data-l="Egresos" class="num">${KD.fmtDinero(c.totalEgresos)}</td>
            <td data-l="Esperado" class="num">${KD.fmtDinero(c.esperado)}</td><td data-l="Contado" class="num">${KD.fmtDinero(c.contado)}</td>
            <td data-l="Diferencia" class="num">${c.diferencia ? `<span class="${c.diferencia > 0 ? "monto-ing" : "monto-egr"}">${KD.fmtDinero(c.diferencia)}</span>` : KD.badge("Cuadra", "ok")}</td></tr>`).join("")}</tbody></table></div>
      </section>
    </div>`;
  enlazar(main);
  main.querySelector("[data-suc]")?.addEventListener("change", (e) => { KD.db.sesion.sucursalTrabajo = e.target.value; KD.guardar(); KD.render(); });
  main.querySelector("[data-fecha]").addEventListener("change", (e) => { if (e.target.value) { cajaFecha = e.target.value; KD.render(); } });
  main.querySelectorAll("[data-corte]").forEach((b) => b.addEventListener("click", () => formCorte(cajaFecha, sucId)));
  main.querySelector("[data-mov]").addEventListener("click", () => formMovimiento(cajaFecha, sucId));
  main.querySelectorAll("[data-ver-corte]").forEach((tr) => tr.addEventListener("click", () => formCorte(tr.dataset.verCorte, sucId)));
};

function enlazar(main) {
  main.querySelectorAll("[data-cobrar]").forEach((b) => b.addEventListener("click", () => KD.formCobro(KD.byId("citas", b.dataset.cobrar))));
  main.querySelectorAll("[data-ver-cita]").forEach((b) => b.addEventListener("click", () => KD.detalleCita(b.dataset.verCita)));
}

// ---------- Cobro de una cita atendida ----------
KD.formCobro = (c) => {
  const cons = KD.consultaDeCita(c.id);
  if (!cons) { KD.toast("El doctor todavía no registra lo que se hizo en la cita.", "bad"); return; }
  if (KD.db.cortes.some((x) => x.fecha === KD.hoy() && x.sucursalId === c.sucursalId)) { KD.toast("La caja de hoy ya está cerrada.", "bad"); return; }
  const p = KD.byId("pacientes", c.pacienteId);
  const total = KD.totalConsulta(cons);
  const editable = KD.puede("caja");
  const m = KD.modal({
    titulo: `Cobrar a ${p.nombre}`,
    subtitulo: `Cita del ${KD.esc(KD.fmtFecha(c.fecha))} a las ${c.hora} · ${KD.esc(KD.nombreUsuario(c.doctorId))}`,
    cuerpo: `<form class="form-grid" novalidate>
      <div class="full card" style="box-shadow:none">
        ${cons.procedimientos.map((x) => `<div class="plan-item"><div><strong>${KD.esc(KD.nombreTrat(x.tratamientoId))}</strong><small>${x.pieza ? `Pieza ${KD.esc(x.pieza)}` : "Registrado por el doctor"}</small></div><span class="mono">${KD.fmtDinero(x.precio)}</span></div>`).join("")}
      </div>
      <label class="campo"><span>Monto a cobrar</span><input type="number" name="monto" value="${total}" min="0" step="10" ${editable ? "" : "readonly"}></label>
      <label class="campo"><span>Método de pago</span><select name="metodo">${KD.opciones(Object.entries(KD.METODOS).map(([id, nombre]) => ({ id, nombre })), "efectivo")}</select></label>
      <label class="campo" data-recibe><span>Recibe en efectivo</span><input type="number" name="recibe" min="0" step="10" placeholder="${total}"></label>
      <label class="campo" data-cambio><span>Cambio</span><input readonly name="cambio" value="—"></label>
      <label class="campo full" data-ref hidden><span>Referencia / últimos 4 dígitos</span><input name="referencia" placeholder="Opcional"></label>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} Registrar cobro</button>`,
  });
  const f = m.querySelector("form");
  const act = () => {
    const ef = f.metodo.value === "efectivo";
    m.querySelector("[data-recibe]").hidden = !ef; m.querySelector("[data-cambio]").hidden = !ef; m.querySelector("[data-ref]").hidden = ef;
    const rec = Number(f.recibe.value), mon = Number(f.monto.value);
    f.cambio.value = rec ? (rec >= mon ? KD.fmtDinero(rec - mon) : "Falta dinero") : "—";
  };
  act();
  f.addEventListener("input", act); f.addEventListener("change", act);
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    const v = KD.leerForm(f);
    const monto = Number(v.monto) || 0;
    if (v.metodo === "efectivo" && v.recibe && Number(v.recibe) < monto) { KD.toast("Lo recibido es menor al monto a cobrar.", "bad"); return; }
    c.cobro = { monto, metodo: v.metodo, fecha: KD.hoy(), hora: KD.aHora(KD.ahoraMin()), usuarioId: KD.usuario().id };
    if (v.referencia) c.cobro.referencia = v.referencia;
    KD.guardar(); KD.cerrarModal(); KD.render();
    KD.toast(`Cobro registrado · ${KD.fmtDinero(monto)} en ${KD.METODOS[v.metodo].toLowerCase()}`);
  });
};

// ---------- Entrada o salida de dinero ----------
function formMovimiento(fecha, sucId) {
  const m = KD.modal({
    titulo: "Registrar movimiento",
    subtitulo: `Caja de ${KD.esc(KD.nombreSuc(sucId))} · ${KD.esc(KD.fmtFecha(fecha))}`,
    cuerpo: `<form class="form-grid" novalidate>
      <div class="campo full"><span>Tipo</span><div class="segmentado" data-tipo><button type="button" class="activo" data-t="egreso">Salida (gasto)</button><button type="button" data-t="ingreso">Entrada</button></div></div>
      <label class="campo full"><span>Concepto <em>*</em></span><input name="concepto" required list="conceptos" placeholder="Ej. Compra de guantes"><datalist id="conceptos">
        ${["COMPRA DE MATERIAL", "PAGO DE LABORATORIO", "SERVICIO DE LIMPIEZA", "PAPELERÍA", "MANTENIMIENTO DE EQUIPO", "ABONO DE PACIENTE", "FONDO DE CAJA"].map((x) => `<option value="${x}">`).join("")}</datalist></label>
      <label class="campo"><span>Monto <em>*</em></span><input type="number" name="monto" required min="1" step="10"></label>
      <label class="campo"><span>Método</span><select name="metodo">${KD.opciones(Object.entries(KD.METODOS).map(([id, nombre]) => ({ id, nombre })), "efectivo")}</select></label>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} Guardar</button>`,
  });
  let tipo = "egreso";
  m.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { tipo = b.dataset.t; m.querySelectorAll("[data-t]").forEach((x) => x.classList.toggle("activo", x === b)); }));
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    const f = m.querySelector("form");
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    KD.db.movimientos.push({ id: KD.uid("mv"), tipo, fecha, hora: fecha === KD.hoy() ? KD.aHora(KD.ahoraMin()) : "18:00", concepto: KD.mayus(v.concepto), monto: Number(v.monto), metodo: v.metodo, sucursalId: sucId, usuarioId: KD.usuario().id });
    KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast(tipo === "egreso" ? "Salida registrada" : "Entrada registrada");
  });
}

// ---------- Corte diario ----------
// Cierre de caja: fondo inicial + cobros en efectivo − gastos en efectivo = efectivo que debe haber.
// Se compara con el efectivo contado (arqueo); tarjeta y transferencia se concilian con el banco.
function formCorte(fecha, sucId) {
  const rc = KD.resumenCaja(fecha, sucId);
  const corte = rc.corte;
  const pendientes = KD.porCobrar([sucId]).filter((c) => c.fecha === fecha);
  const fondo0 = corte ? corte.fondo : 1000;
  const resumen = (fondo, contado) => {
    const esperado = fondo + rc.porMetodo.efectivo - rc.egresosEfectivo;
    const dif = contado === "" || contado == null ? null : Number(contado) - esperado;
    return `<div class="corte-resumen">
      <div><span>Fondo inicial</span><b>${KD.fmtDinero(fondo)}</b></div>
      <div><span>Cobros en efectivo</span><b>+${KD.fmtDinero(rc.porMetodo.efectivo)}</b></div>
      <div><span>Gastos en efectivo</span><b>−${KD.fmtDinero(rc.egresosEfectivo)}</b></div>
      <div><span>Tarjeta (conciliar con terminal)</span><b>${KD.fmtDinero(rc.porMetodo.tarjeta)}</b></div>
      <div><span>Transferencias (conciliar con banco)</span><b>${KD.fmtDinero(rc.porMetodo.transferencia)}</b></div>
      <div><span>Total ingresos / egresos</span><b>${KD.fmtDinero(rc.totalIngresos)} / ${KD.fmtDinero(rc.totalEgresos)}</b></div>
      <div class="total"><span>Efectivo que debe haber</span><b>${KD.fmtDinero(esperado)}</b></div>
      ${dif === null ? "" : `<div class="total"><span>Diferencia</span><b class="${dif === 0 ? "" : dif > 0 ? "monto-ing" : "monto-egr"}">${dif === 0 ? "Cuadra ✓" : `${KD.fmtDinero(dif)} ${dif > 0 ? "sobrante" : "faltante"}`}</b></div>`}
    </div>`;
  };
  const m = KD.modal({
    titulo: corte ? "Corte de caja" : "Corte diario",
    subtitulo: `${KD.esc(KD.nombreSuc(sucId))} · ${KD.esc(KD.fmtFecha(fecha, { weekday: "long", day: "numeric", month: "long" }))}${corte ? ` · cerrado por ${KD.esc(KD.nombreUsuario(corte.usuarioId))} a las ${corte.hora}` : ""}`,
    cuerpo: `<form class="form-grid" novalidate>
      ${!corte && pendientes.length ? `<p class="nota-form warn">${KD.icon("alerta", 16)}<span>Hay <strong>${pendientes.length} paciente(s) atendidos sin cobrar</strong> este día. Cóbralos antes de cerrar la caja.</span></p>` : ""}
      ${corte ? "" : `<label class="campo"><span>Fondo inicial de caja</span><input type="number" name="fondo" value="${fondo0}" min="0" step="50"></label>
        <label class="campo"><span>Efectivo contado <em>*</em></span><input type="number" name="contado" required min="0" step="10" placeholder="Cuenta billetes y monedas"></label>`}
      <div class="full" data-resumen>${resumen(fondo0, corte ? corte.contado : null)}</div>
      ${corte ? (corte.notas ? `<p class="full muted">Notas: ${KD.esc(corte.notas)}</p>` : "") : `<label class="campo full"><span>Notas</span><textarea name="notas" rows="2" placeholder="Explica cualquier diferencia"></textarea></label>
        <p class="nota-form">${KD.icon("info", 16)}<span>Al cerrar, ya no se pueden registrar cobros ni movimientos en este día.</span></p>`}
    </form>`,
    acciones: corte ? `<button class="btn btn-ghost" data-imprimir>${KD.icon("imprimir", 16)} Imprimir</button><button class="btn" data-cerrar>Listo</button>`
      : `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} Cerrar caja</button>`,
  });
  const f = m.querySelector("form");
  if (!corte) f.addEventListener("input", () => { m.querySelector("[data-resumen]").innerHTML = resumen(Number(f.fondo.value) || 0, f.contado.value); });
  m.querySelector("[data-guardar]")?.addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const fondo = Number(v.fondo) || 0;
    const esperado = fondo + rc.porMetodo.efectivo - rc.egresosEfectivo;
    const contado = Number(v.contado);
    KD.db.cortes.push({ id: KD.uid("ct"), fecha, sucursalId: sucId, usuarioId: KD.usuario().id, hora: KD.aHora(KD.ahoraMin()), fondo,
      porMetodo: rc.porMetodo, totalIngresos: rc.totalIngresos, totalEgresos: rc.totalEgresos, egresosEfectivo: rc.egresosEfectivo,
      esperado, contado, diferencia: contado - esperado, notas: v.notas || "" });
    KD.guardar(); KD.cerrarModal(); KD.render();
    KD.toast(contado === esperado ? "Caja cerrada · el efectivo cuadra" : `Caja cerrada con diferencia de ${KD.fmtDinero(contado - esperado)}`);
  });
  m.querySelector("[data-imprimir]")?.addEventListener("click", () => KD.imprimirHTML(`Corte ${fecha}`, `
    <h1>Corte de caja · ${KD.esc(KD.nombreSuc(sucId))}</h1><p class="muted">${KD.esc(KD.fmtFecha(fecha, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))} · ${KD.esc(KD.nombreUsuario(corte.usuarioId))} · ${corte.hora}</p>
    <table><tbody>
      <tr><td>Fondo inicial</td><td class="n">${KD.fmtDinero(corte.fondo)}</td></tr>
      ${Object.entries(KD.METODOS).map(([k, n]) => `<tr><td>Ingresos · ${n}</td><td class="n">${KD.fmtDinero(corte.porMetodo[k])}</td></tr>`).join("")}
      <tr><td>Egresos (total)</td><td class="n">${KD.fmtDinero(corte.totalEgresos)}</td></tr>
      <tr><td>Egresos en efectivo</td><td class="n">${KD.fmtDinero(corte.egresosEfectivo)}</td></tr>
      <tr><td><b>Efectivo esperado</b></td><td class="n"><b>${KD.fmtDinero(corte.esperado)}</b></td></tr>
      <tr><td><b>Efectivo contado</b></td><td class="n"><b>${KD.fmtDinero(corte.contado)}</b></td></tr>
      <tr><td><b>Diferencia</b></td><td class="n"><b>${KD.fmtDinero(corte.diferencia)}</b></td></tr>
    </tbody></table>
    <h3>Movimientos</h3><table><thead><tr><th>Hora</th><th>Concepto</th><th>Método</th><th class="n">Monto</th></tr></thead><tbody>
    ${rc.movimientos.map((x) => `<tr><td>${x.hora}</td><td>${KD.esc(x.pacienteId ? `${x.concepto} · ${KD.byId("pacientes", x.pacienteId)?.nombre}` : x.concepto)}</td><td>${KD.METODOS[x.metodo]}</td><td class="n">${x.tipo === "egreso" ? "−" : ""}${KD.fmtDinero(x.monto)}</td></tr>`).join("")}</tbody></table>
    <p style="margin-top:48px">_____________________________<br>Firma de quien entrega</p>`));
}
