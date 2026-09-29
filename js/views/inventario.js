// Inventario (gestión) y solicitud de material (personal clínico).
KD.vistas = KD.vistas || {};

let invFiltro = { q: "", cat: "", estado: "", semana: null };

KD.vistas.inventario = (main, partes) => {
  const tab = ["productos", "proyeccion", "solicitudes"].includes(partes[0]) ? partes[0] : "productos";
  const sucIds = KD.sucursalesFiltro();
  const sucId = KD.sucursalUnica();
  const dinero = KD.verDinero();
  const prods = KD.db.productos.filter((p) => p.activo);
  const est = (p) => KD.estadoStock(p, sucId);
  const crit = prods.filter((p) => est(p) === "critico"), bajos = prods.filter((p) => est(p) === "bajo");
  const solPend = KD.db.solicitudes.filter((s) => s.estado === "pendiente" && s.sucursalId === sucId);

  main.innerHTML = `
    ${KD.cabecera("Abastecimiento", "Inventario", `Sucursal ${KD.esc(KD.nombreSuc(sucId))} · Controla existencias y evita quedarte sin material en plena consulta.`,
      `${sucIds.length > 1 ? `<select data-suc aria-label="Sucursal" style="width:auto">${KD.opciones(KD.sucursalesUsuario().filter((s) => sucIds.includes(s.id)), sucId)}</select>` : ""}
       <button class="btn btn-ghost" data-nuevo-prod>${KD.icon("mas", 16)} Nuevo producto</button>
       <button class="btn" data-mov>${KD.icon("inventario", 16)} Registrar movimiento</button>`)}
    <div class="tiles">
      <div class="tile bad">${KD.icon("alerta", 20)}<div><strong>${crit.length} producto${crit.length === 1 ? "" : "s"} en stock crítico</strong><small>${KD.esc(crit.slice(0, 3).map((p) => `${p.nombre} · ${KD.fmtNum(p.existencias[sucId])} ${p.unidad}`).join(", ") || "Ninguno")}</small></div></div>
      <div class="tile warn">${KD.icon("reloj", 20)}<div><strong>${bajos.length} producto${bajos.length === 1 ? "" : "s"} con stock bajo</strong><small>Revisa los mínimos esta semana</small></div></div>
      <div class="tile ok">${KD.icon("checkCirculo", 20)}<div><strong>${prods.length - crit.length - bajos.length} productos en buen nivel</strong><small>Sin acciones necesarias</small></div></div>
    </div>
    <div class="tabs" role="tablist">
      <a href="#/inventario/productos" class="${tab === "productos" ? "activo" : ""}">Productos</a>
      <a href="#/inventario/proyeccion" class="${tab === "proyeccion" ? "activo" : ""}">Proyección semanal</a>
      <a href="#/inventario/solicitudes" class="${tab === "solicitudes" ? "activo" : ""}">Solicitudes del personal${solPend.length ? `<em>${solPend.length}</em>` : ""}</a>
    </div>
    <div data-panel></div>`;

  const panel = main.querySelector("[data-panel]");
  if (tab === "productos") tabProductos(panel, sucId, dinero);
  else if (tab === "proyeccion") tabProyeccion(panel, sucId, dinero);
  else tabSolicitudes(panel, sucId);

  main.querySelector("[data-suc]")?.addEventListener("change", (e) => { KD.db.sesion.sucursalTrabajo = e.target.value; KD.guardar(); KD.render(); });
  main.querySelector("[data-nuevo-prod]").addEventListener("click", () => formProducto(null, sucId));
  main.querySelector("[data-mov]").addEventListener("click", () => formMovInventario(sucId));
};

const stockTxt = (p, sucId) => `<span class="stock-num"><b>${KD.fmtNum(p.existencias[sucId] || 0, 2)}</b><small>${KD.esc(p.unidad)}</small></span>`;
const pillStock = (e) => e === "critico" ? KD.punto("Crítico", "cita-no_asistio") : e === "bajo" ? KD.punto("Bajo", "cita-programada") : KD.punto("Suficiente", "cita-atendida");

function tabProductos(panel, sucId, dinero) {
  const cats = [...new Set(KD.db.productos.map((p) => p.categoria))].sort();
  const pintar = () => {
    const q = KD.buscable(invFiltro.q);
    const lista = KD.db.productos.filter((p) => p.activo && (!invFiltro.cat || p.categoria === invFiltro.cat) && (!invFiltro.estado || KD.estadoStock(p, sucId) === invFiltro.estado) && (!q || KD.buscable(`${p.nombre} ${p.proveedor}`).includes(q)))
      .sort((a, b) => ["critico", "bajo", "ok"].indexOf(KD.estadoStock(a, sucId)) - ["critico", "bajo", "ok"].indexOf(KD.estadoStock(b, sucId)) || a.nombre.localeCompare(b.nombre));
    panel.querySelector("[data-tabla]").innerHTML = lista.length ? `<div class="tabla-wrap"><table class="responsive">
      <thead><tr><th>Producto</th><th>Categoría</th><th>Existencias</th><th>Mínimo</th>${dinero ? '<th class="num">Costo</th>' : ""}<th>Proveedor</th><th>Estado</th><th></th></tr></thead>
      <tbody>${lista.map((p) => `<tr>
        <td class="principal-celda"><div class="celda-persona"><span class="kpi-ico">${KD.icon("inventario", 16)}</span><strong>${KD.esc(p.nombre)}</strong></div></td>
        <td data-l="Categoría">${KD.esc(p.categoria)}</td>
        <td data-l="Existencias">${stockTxt(p, sucId)}</td>
        <td data-l="Mínimo">${KD.fmtNum(p.minimo[sucId] || 0)} <span class="muted">${KD.esc(p.unidad)}</span></td>
        ${dinero ? `<td data-l="Costo" class="num mono">${KD.fmtDinero(p.costo)}</td>` : ""}
        <td data-l="Proveedor">${KD.esc(p.proveedor)}</td>
        <td data-l="Estado">${pillStock(KD.estadoStock(p, sucId))}</td>
        <td data-l=""><button class="btn-icon sin-borde chico" data-menu="${p.id}" aria-label="Opciones">${KD.icon("puntos", 16)}</button></td>
      </tr>`).join("")}</tbody></table></div>` : KD.vacio("No hay productos con estos filtros.", "inventario");
    panel.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", () => {
      const p = KD.byId("productos", b.dataset.menu);
      KD.popover(b, [
        { texto: "Registrar entrada", icono: "bajar", accion: () => formMovInventario(sucId, p.id, "entrada") },
        { texto: "Registrar salida", icono: "subir", accion: () => formMovInventario(sucId, p.id, "salida") },
        { texto: "Editar producto", icono: "editar", accion: () => formProducto(p, sucId) },
      ]);
    }));
  };
  panel.innerHTML = `<section class="card">
    <div class="card-head" style="padding-bottom:12px"><div class="filtros" style="margin:0;width:100%">
      <label class="buscar">${KD.icon("buscar", 16)}<input type="search" placeholder="Buscar producto o proveedor…" value="${KD.esc(invFiltro.q)}" data-q aria-label="Buscar"></label>
      <select data-cat aria-label="Categoría"><option value="">Todas las categorías</option>${cats.map((c) => `<option ${invFiltro.cat === c ? "selected" : ""}>${KD.esc(c)}</option>`).join("")}</select>
      <select data-est aria-label="Estado"><option value="">Todos los estados</option>${[["critico", "Crítico"], ["bajo", "Bajo"], ["ok", "Suficiente"]].map(([k, t]) => `<option value="${k}" ${invFiltro.estado === k ? "selected" : ""}>${t}</option>`).join("")}</select>
    </div></div>
    <div data-tabla></div></section>`;
  pintar();
  panel.querySelector("[data-q]").addEventListener("input", (e) => { invFiltro.q = e.target.value; pintar(); });
  panel.querySelector("[data-cat]").addEventListener("change", (e) => { invFiltro.cat = e.target.value; pintar(); });
  panel.querySelector("[data-est]").addEventListener("change", (e) => { invFiltro.estado = e.target.value; pintar(); });
}

// Proyección: material que consumirán las citas de la semana (miércoles a martes). Nunca más de una semana.
function tabProyeccion(panel, sucId, dinero) {
  const ciclo = KD.cicloInventario();
  const semana = invFiltro.semana || (ciclo.esMiercoles ? "actual" : "siguiente");
  const actual = KD.proyeccionInventario(sucId, ciclo.actual);
  const siguiente = KD.proyeccionInventario(sucId, ciclo.siguiente);
  const usar = semana === "actual" ? actual : siguiente;
  const filas = KD.db.productos.filter((p) => p.activo).map((p) => {
    const ex = p.existencias[sucId] || 0, mi = p.minimo[sucId] || 0;
    const consumo = usar.porProducto[p.id] || 0;
    // Para la próxima semana se descuenta lo que todavía se va a usar en la semana en curso
    const disponible = semana === "actual" ? ex : Math.max(0, ex - (actual.porProducto[p.id] || 0));
    const comprar = Math.max(0, Math.ceil(consumo + mi - disponible));
    return { p, consumo, disponible, mi, comprar, costo: comprar * p.costo };
  }).sort((a, b) => b.comprar - a.comprar || b.consumo - a.consumo);
  const aComprar = filas.filter((f) => f.comprar > 0);
  const f = (d) => KD.fmtFecha(d, { weekday: "short", day: "numeric", month: "short" });
  panel.innerHTML = `
    <div class="banner ${ciclo.esMiercoles ? "warn" : "info"}">
      <div><span class="eyebrow">Revisión semanal · cada miércoles</span>
        <h2>${ciclo.esMiercoles ? "Hoy toca revisar el material de la semana." : `Próxima revisión: ${KD.esc(f(ciclo.siguiente.desde))}.`}</h2>
        <p>Se calcula con las citas agendadas y el material que usa cada tratamiento. Solo se proyecta una semana porque las citas más lejanas se pueden cancelar.</p></div>
      <div class="segmentado" role="group" aria-label="Semana">
        <button data-sem="actual" class="${semana === "actual" ? "activo" : ""}">Semana en curso · ${KD.esc(f(ciclo.actual.desde))} – ${KD.esc(f(ciclo.actual.hasta))}</button>
        <button data-sem="siguiente" class="${semana === "siguiente" ? "activo" : ""}">Compra del miércoles · ${KD.esc(f(ciclo.siguiente.desde))} – ${KD.esc(f(ciclo.siguiente.hasta))}</button>
      </div>
    </div>
    <div class="kpis">
      <div class="card kpi"><span class="etq">Citas consideradas</span><div class="valor">${usar.citas}</div><div class="sub"><span>Agendadas y por confirmar${semana === "actual" ? ", de hoy en adelante" : ""}</span></div></div>
      <div class="card kpi"><span class="etq">Productos por comprar</span><div class="valor">${aComprar.length}</div><div class="sub"><span>Para cubrir consumo + mínimo</span></div></div>
      ${dinero ? `<div class="card kpi"><span class="etq">Costo estimado de la compra</span><div class="valor">${KD.fmtDinero(aComprar.reduce((s, x) => s + x.costo, 0))}</div><div class="sub"><span>Con el costo de cada producto</span></div></div>` : ""}
    </div>
    <section class="card">
      <div class="card-head"><div><span class="eyebrow">Lista de compra</span><h2>Material necesario para la semana</h2></div>
        <button class="btn btn-ghost btn-sm" data-exportar>${KD.icon("descargar", 15)} Exportar lista</button></div>
      <div class="tabla-wrap"><table class="responsive"><thead><tr><th>Producto</th><th class="num">Consumo proyectado</th><th class="num">${semana === "actual" ? "Existencias" : "Quedarán el miércoles"}</th><th class="num">Mínimo</th><th class="num">A comprar</th>${dinero ? '<th class="num">Costo</th>' : ""}</tr></thead>
      <tbody>${filas.map((x) => `<tr>
        <td class="principal-celda"><strong>${KD.esc(x.p.nombre)}</strong><span class="sub">${KD.esc(x.p.proveedor)}</span></td>
        <td data-l="Consumo" class="num">${KD.fmtNum(x.consumo, 2)} <span class="muted">${KD.esc(x.p.unidad)}</span></td>
        <td data-l="${semana === "actual" ? "Existencias" : "Quedarán"}" class="num">${KD.fmtNum(x.disponible, 2)}</td>
        <td data-l="Mínimo" class="num">${KD.fmtNum(x.mi)}</td>
        <td data-l="A comprar" class="num">${x.comprar ? `<strong style="color:var(--bad)">${KD.fmtNum(x.comprar)} ${KD.esc(x.p.unidad)}</strong>` : KD.badge("Alcanza", "ok")}</td>
        ${dinero ? `<td data-l="Costo" class="num mono">${x.comprar ? KD.fmtDinero(x.costo) : "—"}</td>` : ""}
      </tr>`).join("")}</tbody></table></div>
    </section>`;
  panel.querySelectorAll("[data-sem]").forEach((b) => b.addEventListener("click", () => { invFiltro.semana = b.dataset.sem; tabProyeccion(panel, sucId, dinero); }));
  panel.querySelector("[data-exportar]").addEventListener("click", () => {
    KD.descargarCSV(`compra-${KD.nombreSuc(sucId)}-${usar.desde}.csv`, [["Producto", "Proveedor", "Unidad", "Consumo proyectado", "Disponible", "Mínimo", "A comprar", "Costo estimado"],
      ...aComprar.map((x) => [x.p.nombre, x.p.proveedor, x.p.unidad, KD.fmtNum(x.consumo, 2), KD.fmtNum(x.disponible, 2), x.mi, x.comprar, dinero ? x.costo : ""])]);
    KD.toast("Lista de compra exportada");
  });
}

function tabSolicitudes(panel, sucId) {
  const sols = KD.db.solicitudes.filter((s) => s.sucursalId === sucId).sort((a, b) => (a.estado === "pendiente" ? 0 : 1) - (b.estado === "pendiente" ? 0 : 1) || b.fecha.localeCompare(a.fecha));
  panel.innerHTML = `<section class="card">${sols.length ? `<div class="filas">${sols.map((s) => {
    const p = KD.byId("productos", s.productoId);
    return `<div class="fila"><span class="fila-ico ${s.estado === "pendiente" ? "warn" : s.estado === "entregada" ? "ok" : "bad"}">${KD.icon("material", 17)}</span>
      <span class="fila-txt"><strong>${KD.fmtNum(s.cantidad)} ${KD.esc(p?.unidad)} · ${KD.esc(p?.nombre)}</strong><small>${KD.esc(KD.nombreUsuario(s.usuarioId))} · ${KD.esc(KD.fmtFecha(s.fecha))}${s.nota ? ` · "${KD.esc(s.nota)}"` : ""} · Hay ${KD.fmtNum(p?.existencias[sucId] || 0, 2)} ${KD.esc(p?.unidad)}</small></span>
      ${s.estado === "pendiente" ? `<div class="acciones"><button class="btn btn-ghost btn-sm" data-rechazar="${s.id}">Rechazar</button><button class="btn btn-sm" data-entregar="${s.id}">${KD.icon("check", 14)} Entregar</button></div>`
        : KD.punto(s.estado === "entregada" ? "Entregada" : "Rechazada", s.estado === "entregada" ? "cita-atendida" : "cita-no_asistio")}</div>`;
  }).join("")}</div>` : KD.vacio("No hay solicitudes de material.", "material")}</section>`;
  panel.querySelectorAll("[data-entregar]").forEach((b) => b.addEventListener("click", () => {
    const s = KD.db.solicitudes.find((x) => x.id === b.dataset.entregar);
    const p = KD.byId("productos", s.productoId);
    if ((p.existencias[sucId] || 0) < s.cantidad) { KD.toast(`No hay suficiente ${p.nombre}. Registra primero la compra (entrada).`, "bad"); return; }
    p.existencias[sucId] -= s.cantidad;
    s.estado = "entregada"; s.atendio = KD.usuario().id;
    KD.db.movInventario.push({ id: KD.uid("mi"), productoId: p.id, sucursalId: sucId, tipo: "salida", cantidad: s.cantidad, nota: `Entrega a ${KD.nombreUsuario(s.usuarioId)}`, fecha: KD.hoy(), usuarioId: KD.usuario().id });
    KD.guardar(); KD.render(); KD.toast("Material entregado");
  }));
  panel.querySelectorAll("[data-rechazar]").forEach((b) => b.addEventListener("click", () => {
    const s = KD.db.solicitudes.find((x) => x.id === b.dataset.rechazar);
    s.estado = "rechazada"; KD.guardar(); KD.render(); KD.toast("Solicitud rechazada");
  }));
}

function formProducto(p, sucId) {
  const cats = [...new Set(KD.db.productos.map((x) => x.categoria))];
  const m = KD.modal({
    titulo: p ? "Editar producto" : "Nuevo producto",
    subtitulo: `Existencias y mínimo de la sucursal ${KD.esc(KD.nombreSuc(sucId))}.`,
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Nombre <em>*</em></span><input name="nombre" required value="${KD.esc(p?.nombre || "")}" style="text-transform:uppercase"></label>
      <label class="campo"><span>Categoría</span><input name="categoria" list="cats-prod" value="${KD.esc(p?.categoria || "")}"><datalist id="cats-prod">${cats.map((c) => `<option value="${KD.esc(c)}">`).join("")}</datalist></label>
      <label class="campo"><span>Unidad</span><input name="unidad" value="${KD.esc(p?.unidad || "piezas")}" placeholder="piezas, cajas, jeringas…"></label>
      <label class="campo"><span>Existencias</span><input type="number" name="existencias" min="0" step="any" value="${p?.existencias[sucId] ?? 0}"></label>
      <label class="campo"><span>Mínimo</span><input type="number" name="minimo" min="0" value="${p?.minimo[sucId] ?? 0}"></label>
      <label class="campo"><span>Costo por unidad</span><input type="number" name="costo" min="0" step="any" value="${p?.costo ?? 0}"></label>
      <label class="campo"><span>Proveedor</span><input name="proveedor" value="${KD.esc(p?.proveedor || "")}" style="text-transform:uppercase"></label>
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} Guardar</button>`,
  });
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    const f = m.querySelector("form");
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const obj = p || { id: KD.uid("m"), existencias: {}, minimo: {}, activo: true };
    Object.assign(obj, { nombre: KD.mayus(v.nombre), categoria: v.categoria || "General", unidad: v.unidad || "piezas", costo: Number(v.costo) || 0, proveedor: KD.mayus(v.proveedor) });
    obj.existencias[sucId] = Number(v.existencias) || 0;
    obj.minimo[sucId] = Number(v.minimo) || 0;
    if (!p) KD.db.productos.push(obj);
    KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast("Producto guardado");
  });
}

function formMovInventario(sucId, productoId = "", tipo = "entrada") {
  const prods = KD.db.productos.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const dinero = KD.puede("caja");
  const m = KD.modal({
    titulo: "Registrar movimiento de inventario",
    subtitulo: `Sucursal ${KD.esc(KD.nombreSuc(sucId))}`,
    cuerpo: `<form class="form-grid" novalidate>
      <label class="campo full"><span>Producto</span><select name="productoId">${KD.opciones(prods, productoId)}</select></label>
      <label class="campo"><span>Tipo</span><select name="tipo"><option value="entrada" ${tipo === "entrada" ? "selected" : ""}>Entrada (compra)</option><option value="salida" ${tipo === "salida" ? "selected" : ""}>Salida (merma, uso, caducado)</option></select></label>
      <label class="campo"><span>Cantidad <em>*</em></span><input type="number" name="cantidad" required min="0.01" step="any"></label>
      <label class="campo full"><span>Nota</span><input name="nota" placeholder="Ej. factura 1234, caducado…"></label>
      ${dinero ? `<label class="checks full" data-gasto style="display:flex"><input type="checkbox" name="gasto" checked> Registrar la compra como gasto en caja (transferencia)</label>` : ""}
    </form>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} Guardar</button>`,
  });
  const f = m.querySelector("form");
  const act = () => { const g = m.querySelector("[data-gasto]"); if (g) g.hidden = f.tipo.value !== "entrada"; };
  act(); f.tipo.addEventListener("change", act);
  m.querySelector("[data-guardar]").addEventListener("click", () => {
    if (!KD.validar(f)) return;
    const v = KD.leerForm(f);
    const p = KD.byId("productos", v.productoId);
    const q = Number(v.cantidad);
    const actual = p.existencias[sucId] || 0;
    if (v.tipo === "salida" && q > actual) { KD.toast(`Solo hay ${KD.fmtNum(actual, 2)} ${p.unidad}.`, "bad"); return; }
    p.existencias[sucId] = Math.round((actual + (v.tipo === "entrada" ? q : -q)) * 100) / 100;
    KD.db.movInventario.push({ id: KD.uid("mi"), productoId: p.id, sucursalId: sucId, tipo: v.tipo, cantidad: q, nota: v.nota, fecha: KD.hoy(), usuarioId: KD.usuario().id });
    if (v.tipo === "entrada" && v.gasto && p.costo) KD.db.movimientos.push({ id: KD.uid("mv"), tipo: "egreso", fecha: KD.hoy(), hora: KD.aHora(KD.ahoraMin()), concepto: `COMPRA: ${p.nombre}`, monto: Math.round(q * p.costo), metodo: "transferencia", sucursalId: sucId, usuarioId: KD.usuario().id });
    KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast(`${v.tipo === "entrada" ? "Entrada" : "Salida"} registrada · ${p.nombre}`);
  });
}

// ---------- Solicitar material (personal clínico sin acceso a inventario) ----------
KD.vistas.material = (main) => {
  const u = KD.usuario();
  const sucId = KD.sucursalUnica();
  const mias = KD.db.solicitudes.filter((s) => s.usuarioId === u.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const prods = KD.db.productos.filter((p) => p.activo).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
  main.innerHTML = `
    ${KD.cabecera("Material", "Solicitar material", `Pide al almacén lo que necesitas para tus consultas en la sucursal ${KD.esc(KD.nombreSuc(sucId))}. Las existencias y los costos los administra gerencia.`)}
    <div class="grid grid-2">
      <section class="card"><div class="card-head"><div><span class="eyebrow">Catálogo</span><h2>Productos</h2></div></div>
        <div class="filas">${prods.map((p) => `<div class="fila" style="padding:10px 20px"><span class="fila-ico">${KD.icon("inventario", 16)}</span><span class="fila-txt"><strong>${KD.esc(p.nombre)}</strong><small>${KD.esc(p.categoria)} · por ${KD.esc(p.unidad)}</small></span>
          <button class="btn btn-ghost btn-sm" data-pedir="${p.id}">Solicitar</button></div>`).join("")}</div></section>
      <section class="card"><div class="card-head"><div><span class="eyebrow">Historial</span><h2>Mis solicitudes</h2></div></div>
        <div class="filas">${mias.length ? mias.map((s) => { const p = KD.byId("productos", s.productoId); return `<div class="fila"><span class="fila-ico">${KD.icon("material", 16)}</span>
          <span class="fila-txt"><strong>${KD.fmtNum(s.cantidad)} ${KD.esc(p?.unidad)} · ${KD.esc(p?.nombre)}</strong><small>${KD.esc(KD.fmtFecha(s.fecha))}${s.nota ? ` · ${KD.esc(s.nota)}` : ""}</small></span>
          ${KD.punto(s.estado === "pendiente" ? "Pendiente" : s.estado === "entregada" ? "Entregada" : "Rechazada", s.estado === "pendiente" ? "cita-programada" : s.estado === "entregada" ? "cita-atendida" : "cita-no_asistio")}</div>`; }).join("") : KD.vacio("Todavía no has pedido material.", "material")}</div></section>
    </div>`;
  main.querySelectorAll("[data-pedir]").forEach((b) => b.addEventListener("click", () => {
    const p = KD.byId("productos", b.dataset.pedir);
    const m = KD.modal({
      titulo: `Solicitar ${p.nombre}`,
      cuerpo: `<form class="form-grid" novalidate>
        <label class="campo"><span>Cantidad (${KD.esc(p.unidad)}) <em>*</em></span><input type="number" name="cantidad" required min="1" value="1"></label>
        <label class="campo full"><span>Nota para el almacén</span><input name="nota" placeholder="Ej. para la unidad 2, color A2…"></label></form>`,
      acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn" data-guardar>${KD.icon("check", 16)} Enviar solicitud</button>`,
    });
    m.querySelector("[data-guardar]").addEventListener("click", () => {
      const f = m.querySelector("form");
      if (!KD.validar(f)) return;
      const v = KD.leerForm(f);
      KD.db.solicitudes.push({ id: KD.uid("so"), productoId: p.id, cantidad: Number(v.cantidad), nota: v.nota, usuarioId: u.id, sucursalId: sucId, fecha: KD.hoy(), estado: "pendiente" });
      KD.guardar(); KD.cerrarModal(); KD.render(); KD.toast("Solicitud enviada al administrador");
    });
  }));
};
