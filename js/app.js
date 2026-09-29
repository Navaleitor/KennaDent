// Estructura principal: menú lateral, barra superior, tema, avisos y navegación.
window.KD = window.KD || {};
KD.vistas = KD.vistas || {};

// "Principal" es la operación diaria; "Gestión" es para perfiles administrativos y gerenciales.
const NAV = [
  { grupo: "Principal", ruta: "dashboard", nombre: "Dashboard", icono: "panel", puede: () => KD.puede("panel") },
  { grupo: "Principal", ruta: "agenda", nombre: "Agenda", icono: "agenda", puede: () => KD.puede("agenda_ver") },
  { grupo: "Principal", ruta: "pacientes", nombre: "Pacientes", icono: "pacientes", puede: () => KD.puede("pacientes_ver") },
  { grupo: "Principal", ruta: "seguimiento", nombre: "Seguimiento", icono: "seguimiento", puede: () => KD.puede("seguimiento"),
    badge: () => KD.seguimiento(KD.sucursalesFiltro()).presupuestos.length },
  { grupo: "Principal", ruta: "caja", nombre: "Caja", icono: "caja", puede: () => KD.puede("cobrar") || KD.puede("caja"),
    badge: () => KD.porCobrar(KD.sucursalesFiltro()).length },
  { grupo: "Principal", ruta: "material", nombre: "Solicitar material", icono: "material", puede: () => KD.puede("material_solicitar") && !KD.puede("inventario") },
  { grupo: "Gestión", ruta: "presupuestos", nombre: "Presupuestos", icono: "presupuestos", puede: () => KD.puede("presupuestos") },
  { grupo: "Gestión", ruta: "reportes", nombre: "Reportes", icono: "reportes", puede: () => KD.puede("reportes") },
  { grupo: "Gestión", ruta: "inventario", nombre: "Inventario", icono: "inventario", puede: () => KD.puede("inventario"),
    badge: () => KD.db.solicitudes.filter((s) => s.estado === "pendiente" && KD.sucursalesFiltro().includes(s.sucursalId)).length },
  { grupo: "Gestión", ruta: "tratamientos", nombre: "Tratamientos", icono: "tratamientos", puede: () => KD.puede("tratamientos") },
  { grupo: "Gestión", ruta: "personal", nombre: "Personal", icono: "personal", puede: () => KD.puede("personal") },
  { grupo: "Gestión", ruta: "empresa", nombre: "Empresa", icono: "empresa", puede: () => KD.puede("empresa") },
];
const ALIAS = { panel: "dashboard", inicio: "dashboard", estadisticas: "reportes" };

// ---------- Tema claro / oscuro ----------
const temaActual = () => document.documentElement.dataset.theme ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
KD.alternarTema = () => {
  const nuevo = temaActual() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem("kennadent-tema", nuevo); } catch (e) { /* ignorar */ }
  pintarBarra();
};

// ---------- Menú lateral ----------
function pintarMenu(ruta) {
  let grupo = "";
  const items = NAV.filter((n) => n.puede());
  document.getElementById("nav").innerHTML = items.map((n) => {
    const cab = n.grupo !== grupo ? `<span class="nav-grupo">${(grupo = n.grupo)}</span>` : "";
    const b = n.badge ? n.badge() : 0;
    return `${cab}<a href="#/${n.ruta}" class="${ruta === n.ruta ? "activo" : ""}">${KD.icon(n.icono)}<span>${n.nombre}</span>${b ? `<em class="nav-badge">${b > 99 ? "99+" : b}</em>` : ""}</a>`;
  }).join("");
  const sucs = KD.sucursalesUsuario();
  const sel = KD.db.sesion.sucursalId;
  document.getElementById("sucursal-card").innerHTML = `
    <span class="suc-ico">${KD.icon("empresa", 18)}</span>
    <label><small>Sucursal</small>
      ${sucs.length > 1 ? `<select id="sel-sucursal" aria-label="Sucursal">
        <option value="todas" ${sel === "todas" ? "selected" : ""}>Todas las sucursales</option>${KD.opciones(sucs, sel)}</select>`
        : `<strong>${KD.esc(sucs[0]?.nombre || "—")}</strong>`}
    </label>`;
  document.getElementById("sel-sucursal")?.addEventListener("change", (e) => {
    KD.db.sesion.sucursalId = e.target.value;
    if (e.target.value !== "todas") KD.db.sesion.sucursalTrabajo = e.target.value;
    KD.guardar();
    render();
  });
  document.getElementById("empresa-nombre").textContent = KD.db.empresa.nombre;
}

// ---------- Barra superior ----------
function pintarBarra() {
  const u = KD.usuario();
  const avisos = KD.notificaciones();
  document.getElementById("barra-acciones").innerHTML = `
    ${KD.puede("pacientes_ver") ? `<div class="buscador">
      ${KD.icon("buscar", 16)}
      <input type="search" id="busqueda" placeholder="Buscar pacientes por nombre, expediente o teléfono…" autocomplete="off" aria-label="Buscar pacientes">
      <kbd>Ctrl K</kbd>
      <div class="buscador-res" id="busqueda-res" hidden></div>
    </div>` : '<span class="espacio"></span>'}
    <button class="btn-icon sin-borde" id="btn-tema" aria-label="Cambiar a modo ${temaActual() === "dark" ? "día" : "noche"}" title="Modo ${temaActual() === "dark" ? "día" : "noche"}">${KD.icon(temaActual() === "dark" ? "sol" : "luna")}</button>
    <button class="btn-icon sin-borde campana" id="btn-avisos" aria-label="Avisos (${avisos.length})">${KD.icon("campana")}${avisos.length ? `<em>${avisos.length}</em>` : ""}</button>
    <button class="usuario-btn" id="btn-usuario" aria-haspopup="true">
      ${KD.avatar(u.nombre, KD.color(u.color))}
      <span class="usuario-txt"><strong>${KD.esc(KD.nombrePersona(u))}</strong><small>${KD.esc(KD.puesto(u.puesto).nombre)}</small></span>
      ${KD.icon("abajo", 16)}
    </button>`;
  document.getElementById("btn-tema").addEventListener("click", KD.alternarTema);
  document.getElementById("btn-usuario").addEventListener("click", abrirCambioUsuario);
  document.getElementById("btn-avisos").addEventListener("click", (e) => abrirAvisos(e.currentTarget, avisos));
  const inp = document.getElementById("busqueda");
  if (inp) {
    const res = document.getElementById("busqueda-res");
    const buscar = () => {
      const q = KD.buscable(inp.value.trim());
      if (q.length < 2) { res.hidden = true; return; }
      const lista = KD.db.pacientes.filter((p) => KD.buscable(`${p.nombre} ${p.expediente} ${p.telefono}`).includes(q)).slice(0, 8);
      res.innerHTML = lista.length ? lista.map((p) => `<a href="#/pacientes/${p.id}">${KD.avatar(p.nombre)}<span><strong>${KD.esc(p.nombre)}</strong><small>${KD.esc(p.expediente)} · ${KD.esc(p.telefono)}${p.activo ? "" : " · dado de baja"}</small></span></a>`).join("")
        : `<p class="muted">Sin resultados para "${KD.esc(inp.value)}"</p>`;
      res.hidden = false;
    };
    inp.addEventListener("input", buscar);
    inp.addEventListener("focus", buscar);
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const a = res.querySelector("a"); if (a) location.hash = a.getAttribute("href"); }
      if (e.key === "Escape") { res.hidden = true; inp.blur(); }
    });
    inp.addEventListener("blur", () => setTimeout(() => { res.hidden = true; }, 200));
  }
}
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); document.getElementById("busqueda")?.focus(); }
});

function abrirAvisos(ancla, avisos) {
  KD.cerrarPopover();
  const pop = document.createElement("div");
  pop.className = "popover avisos";
  pop.innerHTML = `<div class="avisos-head"><strong>Avisos</strong><small>${avisos.length ? `${avisos.length} pendiente(s)` : "Todo al día"}</small></div>
    ${avisos.length ? avisos.map((a) => `<a href="${a.href}" class="aviso ${a.tipo}"><span class="aviso-ico">${KD.icon(a.icono, 16)}</span><span><strong>${KD.esc(a.titulo)}</strong><small>${KD.esc(a.texto)}</small></span></a>`).join("")
      : KD.vacio("No tienes avisos pendientes.")}`;
  document.body.appendChild(pop);
  const r = ancla.getBoundingClientRect();
  pop.style.top = `${r.bottom + 6}px`;
  pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth))}px`;
  pop.addEventListener("click", (e) => { if (e.target.closest("a")) KD.cerrarPopover(); });
  setTimeout(() => document.addEventListener("click", function fuera(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener("click", fuera); }
  }), 0);
}

// En el prototipo no hay inicio de sesión: se puede "entrar" como cualquier empleado para probar sus permisos.
function abrirCambioUsuario() {
  const activos = KD.db.personal.filter((p) => p.activo);
  const m = KD.modal({
    titulo: "Cambiar de usuario (demostración)",
    subtitulo: "En el sistema real cada persona entra con su usuario y contraseña. Aquí puedes cambiar de usuario para ver qué tiene habilitado según su puesto.",
    cuerpo: `
      <div class="lista-usuarios">
        ${activos.map((p) => `
          <button class="fila-usuario ${p.id === KD.db.sesion.usuarioId ? "activo" : ""}" data-id="${p.id}">
            ${KD.avatar(p.nombre, KD.color(p.color))}
            <span><strong>${KD.esc(KD.nombrePersona(p))}</strong><small>${KD.esc(KD.puesto(p.puesto).nombre)}${p.especialidad ? " · " + KD.esc(p.especialidad) : ""} · ${p.sucursales.map(KD.nombreSuc).map(KD.esc).join(", ")}</small></span>
          </button>`).join("")}
      </div>`,
    acciones: `<button class="btn btn-ghost btn-sm" data-reiniciar style="margin-right:auto">${KD.icon("salir", 16)} Restablecer datos de demostración</button>
      <button class="btn btn-ghost" data-cerrar>Cerrar</button>`,
  });
  m.querySelectorAll(".fila-usuario").forEach((b) => b.addEventListener("click", () => {
    KD.db.sesion.usuarioId = b.dataset.id;
    KD.db.sesion.sucursalId = "todas";
    delete KD.db.sesion.sucursalTrabajo;
    KD.guardar();
    KD.cerrarModal();
    const primera = NAV.find((n) => n.puede());
    location.hash = `#/${primera ? primera.ruta : "dashboard"}`;
    render();
    KD.toast(`Sesión como ${KD.nombrePersona(KD.usuario())}`);
  }));
  m.querySelector("[data-reiniciar]").addEventListener("click", () =>
    KD.confirmar("Restablecer datos", "Se borrarán todos los cambios y se regenerarán los datos de ejemplo.", "Restablecer", () => {
      KD.reiniciarDemo(); render(); KD.toast("Datos de demostración restablecidos");
    }));
}

// ---------- Enrutador ----------
function render() {
  let partes = (location.hash.slice(2) || "dashboard").split("/");
  if (ALIAS[partes[0]]) { location.replace(`#/${[ALIAS[partes[0]], ...partes.slice(1)].join("/")}`); return; }
  const ruta = partes[0];
  const nav = NAV.find((n) => n.ruta === ruta);
  const main = document.getElementById("contenido");
  KD.cerrarPopover();
  pintarMenu(ruta);
  pintarBarra();
  document.body.classList.remove("menu-abierto");
  if (!nav || !KD.vistas[ruta]) { main.innerHTML = KD.vacio("Página no encontrada.", "alerta"); return; }
  if (!nav.puede()) {
    main.innerHTML = `<div class="sin-permiso">${KD.icon("alerta", 28)}<h2>Sin acceso</h2><p>Tu usuario no tiene permiso para ver <strong>${KD.esc(nav.nombre)}</strong>. Pídele al administrador que lo habilite.</p></div>`;
    return;
  }
  KD.vistas[ruta](main, partes.slice(1));
  main.focus({ preventScroll: true });
}
KD.render = render;

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
let anchoPrevio = innerWidth < 760;
window.addEventListener("resize", () => {
  const ahora = innerWidth < 760;
  if (ahora !== anchoPrevio) { anchoPrevio = ahora; if (location.hash.startsWith("#/agenda")) render(); }
});

document.addEventListener("DOMContentLoaded", () => {
  KD.cargar();
  document.getElementById("btn-menu").addEventListener("click", () => document.body.classList.toggle("menu-abierto"));
  document.getElementById("velo").addEventListener("click", () => document.body.classList.remove("menu-abierto"));
  if (!location.hash) location.hash = "#/dashboard";
  render();
  // Las alertas de "falta registro" dependen de la hora: se revisan cada minuto
  setInterval(() => { if (!document.querySelector(".modal-backdrop, .popover") && document.activeElement?.id !== "busqueda") pintarBarra(); }, 60000);
});
