// Estructura principal: menú lateral, barra superior, tema y navegación.
window.KD = window.KD || {};
KD.vistas = KD.vistas || {};

const NAV = [
  { ruta: "panel", nombre: "Inicio", icono: "panel", permiso: "panel" },
  { ruta: "agenda", nombre: "Agenda", icono: "agenda", permiso: "agenda_ver" },
  { ruta: "pacientes", nombre: "Pacientes", icono: "pacientes", permiso: "pacientes_ver" },
  { ruta: "presupuestos", nombre: "Presupuestos", icono: "presupuestos", permiso: "presupuestos" },
  { ruta: "estadisticas", nombre: "Estadísticas", icono: "estadisticas", permiso: "estadisticas" },
  { ruta: "personal", nombre: "Personal", icono: "personal", permiso: "personal" },
  { ruta: "empresa", nombre: "Empresa", icono: "empresa", permiso: "empresa" },
];

// ---------- Tema claro / oscuro ----------
const temaGuardado = () => { try { return localStorage.getItem("kennadent-tema"); } catch (e) { return null; } };
const temaActual = () => document.documentElement.dataset.theme ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
KD.alternarTema = () => {
  const nuevo = temaActual() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem("kennadent-tema", nuevo); } catch (e) { /* ignorar */ }
  pintarBarra();
};
if (temaGuardado()) document.documentElement.dataset.theme = temaGuardado();

// ---------- Estructura ----------
function pintarMenu() {
  const ruta = (location.hash.slice(2) || "panel").split("/")[0];
  document.getElementById("nav").innerHTML = NAV.filter((n) => KD.puede(n.permiso))
    .map((n) => `<a href="#/${n.ruta}" class="${ruta === n.ruta ? "activo" : ""}">${KD.icon(n.icono)}<span>${n.nombre}</span></a>`).join("");
  document.getElementById("empresa-nombre").textContent = KD.db.empresa.nombre;
}

function pintarBarra() {
  const u = KD.usuario();
  const sucs = KD.sucursalesUsuario();
  const sel = KD.db.sesion.sucursalId;
  const opcionTodas = sucs.length > 1 ? `<option value="todas" ${sel === "todas" ? "selected" : ""}>Todas las sucursales</option>` : "";
  document.getElementById("barra-acciones").innerHTML = `
    <label class="select-suc">
      <span class="sr-only">Sucursal</span>
      <select id="sel-sucursal">${opcionTodas}${KD.opciones(sucs, sel)}</select>
    </label>
    <button class="btn-icon" id="btn-tema" aria-label="Cambiar tema" title="Modo ${temaActual() === "dark" ? "día" : "noche"}">${KD.icon(temaActual() === "dark" ? "sol" : "luna")}</button>
    <button class="usuario-btn" id="btn-usuario" aria-haspopup="true">
      <span class="avatar">${KD.esc(iniciales(u.nombre))}</span>
      <span class="usuario-txt"><strong>${KD.esc(u.nombre)}</strong><small>${KD.esc(KD.puesto(u.puesto).nombre)}</small></span>
    </button>`;
  document.getElementById("sel-sucursal").addEventListener("change", (e) => {
    KD.db.sesion.sucursalId = e.target.value;
    KD.guardar();
    render();
  });
  document.getElementById("btn-tema").addEventListener("click", KD.alternarTema);
  document.getElementById("btn-usuario").addEventListener("click", abrirCambioUsuario);
}

const iniciales = (n) => n.replace(/^(Dra?\.)\s+/, "").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

// En el prototipo no hay contraseñas: se puede "entrar" como cualquier empleado para probar sus permisos.
function abrirCambioUsuario() {
  const activos = KD.db.personal.filter((p) => p.activo);
  const m = KD.modal({
    titulo: "Cambiar de usuario (demostración)",
    cuerpo: `
      <p class="muted">En el sistema real cada persona entra con su correo y contraseña. Aquí puedes cambiar de usuario para ver qué secciones tiene habilitadas según su puesto.</p>
      <div class="lista-usuarios">
        ${activos.map((p) => `
          <button class="fila-usuario ${p.id === KD.db.sesion.usuarioId ? "activo" : ""}" data-id="${p.id}">
            <span class="avatar">${KD.esc(iniciales(p.nombre))}</span>
            <span><strong>${KD.esc(p.nombre)}</strong><small>${KD.esc(KD.puesto(p.puesto).nombre)}${p.especialidad ? " · " + KD.esc(p.especialidad) : ""} · ${p.sucursales.map(KD.nombreSuc).map(KD.esc).join(", ")}</small></span>
          </button>`).join("")}
      </div>
      <hr>
      <button class="btn btn-ghost btn-sm" data-reiniciar>${KD.icon("salir", 16)} Restablecer datos de demostración</button>`,
  });
  m.querySelectorAll(".fila-usuario").forEach((b) => b.addEventListener("click", () => {
    KD.db.sesion.usuarioId = b.dataset.id;
    KD.db.sesion.sucursalId = "todas";
    KD.guardar();
    KD.cerrarModal();
    const primera = NAV.find((n) => KD.puede(n.permiso));
    location.hash = `#/${primera ? primera.ruta : "panel"}`;
    render();
    KD.toast(`Sesión como ${KD.usuario().nombre}`);
  }));
  m.querySelector("[data-reiniciar]").addEventListener("click", () =>
    KD.confirmar("Restablecer datos", "Se borrarán todos los cambios y se regenerarán los datos de ejemplo.", "Restablecer", () => {
      KD.reiniciarDemo(); render(); KD.toast("Datos de demostración restablecidos");
    }));
}

// ---------- Enrutador ----------
function render() {
  const partes = (location.hash.slice(2) || "panel").split("/");
  const ruta = partes[0];
  const nav = NAV.find((n) => n.ruta === ruta);
  const main = document.getElementById("contenido");
  pintarMenu();
  pintarBarra();
  document.body.classList.remove("menu-abierto");
  if (!nav || !KD.vistas[ruta]) {
    main.innerHTML = KD.vacio("Página no encontrada.");
    return;
  }
  if (!KD.puede(nav.permiso)) {
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
  if (!location.hash) location.hash = "#/panel";
  render();
});
