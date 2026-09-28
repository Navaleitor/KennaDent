// Utilidades de interfaz: escape de HTML, modales, avisos e íconos.
window.KD = window.KD || {};

KD.esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ICONOS = {
  panel: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  agenda: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pacientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  presupuestos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  estadisticas: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  personal: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  empresa: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  izq: '<path d="m15 18-6-6 6-6"/>',
  der: '<path d="m9 18 6-6-6-6"/>',
  whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/>',
  alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
KD.icon = (n, size = 18) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ""}</svg>`;

// ---------- Modal ----------
KD.modal = ({ titulo, cuerpo, acciones = "", ancho = "" , onMount }) => {
  KD.cerrarModal();
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `
    <div class="modal ${ancho}" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <header class="modal-head">
        <h2 id="modal-titulo">${KD.esc(titulo)}</h2>
        <button class="btn-icon" data-cerrar aria-label="Cerrar">${KD.icon("cerrar")}</button>
      </header>
      <div class="modal-body">${cuerpo}</div>
      ${acciones ? `<footer class="modal-foot">${acciones}</footer>` : ""}
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("sin-scroll");
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest("[data-cerrar]")) KD.cerrarModal();
  });
  const primero = wrap.querySelector("input, select, textarea");
  if (primero) primero.focus();
  if (onMount) onMount(wrap.querySelector(".modal"));
  return wrap.querySelector(".modal");
};
KD.cerrarModal = () => {
  document.querySelectorAll(".modal-backdrop").forEach((m) => m.remove());
  document.body.classList.remove("sin-scroll");
};
document.addEventListener("keydown", (e) => { if (e.key === "Escape") KD.cerrarModal(); });

KD.confirmar = (titulo, mensaje, textoBoton, onOk, peligro = true) => {
  const m = KD.modal({
    titulo,
    cuerpo: `<p>${mensaje}</p>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn ${peligro ? "btn-danger" : "btn-primary"}" data-ok>${KD.esc(textoBoton)}</button>`,
  });
  m.querySelector("[data-ok]").addEventListener("click", () => { KD.cerrarModal(); onOk(); });
};

// ---------- Avisos ----------
KD.toast = (msg) => {
  let cont = document.querySelector(".toasts");
  if (!cont) { cont = document.createElement("div"); cont.className = "toasts"; cont.setAttribute("role", "status"); document.body.appendChild(cont); }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  cont.appendChild(t);
  setTimeout(() => t.classList.add("salir"), 2600);
  setTimeout(() => t.remove(), 3000);
};

// ---------- Formularios ----------
KD.leerForm = (form) => {
  const d = {};
  new FormData(form).forEach((v, k) => {
    if (k in d) d[k] = [].concat(d[k], v); else d[k] = typeof v === "string" ? v.trim() : v;
  });
  return d;
};
KD.validar = (form) => {
  let ok = true;
  form.querySelectorAll("[required]").forEach((f) => {
    const vacio = !String(f.value).trim();
    f.classList.toggle("invalido", vacio);
    if (vacio) ok = false;
  });
  if (!ok) KD.toast("Completa los campos obligatorios.");
  return ok;
};
KD.opciones = (lista, sel, valor = "id", texto = "nombre") =>
  lista.map((x) => `<option value="${KD.esc(x[valor])}" ${String(x[valor]) === String(sel) ? "selected" : ""}>${KD.esc(x[texto])}</option>`).join("");

KD.badge = (texto, tipo = "") => `<span class="badge ${tipo}">${KD.esc(texto)}</span>`;
KD.badgeEstadoCita = (e) => KD.badge(KD.ESTADOS_CITA[e] || e, `estado-${e}`);
KD.badgeEstadoPlan = (e) => KD.badge(KD.ESTADOS_PLAN[e] || e, `plan-${e}`);
KD.waLink = (tel) => `https://wa.me/52${String(tel || "").replace(/\D/g, "")}`;
KD.vacio = (msg) => `<div class="vacio">${KD.esc(msg)}</div>`;

// Barra horizontal para rankings (una sola serie, color de acento)
KD.barra = (valor, max, etiqueta) =>
  `<div class="bar-rank" title="${KD.esc(etiqueta)}"><span style="width:${max ? Math.max(2, (valor / max) * 100) : 0}%"></span></div>`;
