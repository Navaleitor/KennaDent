// Utilidades de interfaz: escape de HTML, íconos, ventanas, avisos, menús y gráficas.
window.KD = window.KD || {};

KD.esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ICONOS = {
  panel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  agenda: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pacientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  presupuestos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  caja: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/><path d="M6 6V4h12v2"/>',
  seguimiento: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  reportes: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  inventario: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  tratamientos: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v2h6V3M9 13l2 2 4-4"/>',
  personal: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  empresa: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1"/>',
  material: '<path d="M9 3h6v4H9zM7 7h10l1 14H6z"/><path d="M10 12h4M12 10v4"/>',
  campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  izq: '<path d="m15 18-6-6 6-6"/>',
  der: '<path d="m9 18 6-6-6-6"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/>',
  telefono: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  basura: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  imprimir: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCirculo: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
  reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  filtro: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  estrella: '<path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.3L12 16.5 5.8 21l2.4-7.3L2 9.2h7.6z"/>',
  chispa: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>',
  subir: '<path d="m7 17 10-10M7 7h10v10"/>',
  bajar: '<path d="M7 7l10 10M17 7v10H7"/>',
  puntos: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  ojo: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  diente: '<path d="M12 5.5C10 3.5 6.5 3 5 5.5c-1.6 2.6-.4 6 .6 8.3.7 1.7.9 6.2 2.4 6.2 1.6 0 1.4-4.5 4-4.5s2.4 4.5 4 4.5c1.5 0 1.7-4.5 2.4-6.2 1-2.3 2.2-5.7.6-8.3C17.5 3 14 3.5 12 5.5z"/>',
  estetoscopio: '<path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
  usuarioMas: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  externo: '<path d="M7 17 17 7M8 7h9v9"/>',
  regresar: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  dinero: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  unidad: '<path d="M4 18h16M6 18v-5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v5M9 10V6a3 3 0 0 1 6 0v4M8 21v-3M16 21v-3"/>',
};
KD.icon = (n, size = 18) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ""}</svg>`;

// ---------- Ventanas (modal) ----------
KD.modal = ({ titulo, subtitulo = "", cuerpo, acciones = "", ancho = "", onMount }) => {
  KD.cerrarModal();
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `
    <div class="modal ${ancho}" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <header class="modal-head">
        <div><h2 id="modal-titulo">${KD.esc(titulo)}</h2>${subtitulo ? `<p>${subtitulo}</p>` : ""}</div>
        <button class="btn-icon sin-borde" data-cerrar aria-label="Cerrar">${KD.icon("cerrar")}</button>
      </header>
      <div class="modal-body">${cuerpo}</div>
      ${acciones ? `<footer class="modal-foot">${acciones}</footer>` : ""}
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("sin-scroll");
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest("[data-cerrar]")) KD.cerrarModal();
  });
  const primero = wrap.querySelector(".modal-body input:not([type=hidden]):not([readonly]), .modal-body select, .modal-body textarea");
  if (primero && innerWidth > 760) primero.focus();
  if (onMount) onMount(wrap.querySelector(".modal"));
  return wrap.querySelector(".modal");
};
KD.cerrarModal = () => {
  document.querySelectorAll(".modal-backdrop").forEach((m) => m.remove());
  document.body.classList.remove("sin-scroll");
};
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { KD.cerrarModal(); KD.cerrarPopover(); } });

KD.confirmar = (titulo, mensaje, textoBoton, onOk, peligro = true) => {
  const m = KD.modal({
    titulo,
    cuerpo: `<p style="margin:0">${mensaje}</p>`,
    acciones: `<button class="btn btn-ghost" data-cerrar>Cancelar</button><button class="btn ${peligro ? "btn-danger" : ""}" data-ok>${KD.esc(textoBoton)}</button>`,
  });
  m.querySelector("[data-ok]").addEventListener("click", () => { KD.cerrarModal(); onOk(); });
};

// ---------- Menú contextual "⋯" ----------
KD.cerrarPopover = () => document.querySelectorAll(".popover").forEach((p) => p.remove());
KD.popover = (ancla, opciones) => {
  KD.cerrarPopover();
  const pop = document.createElement("div");
  pop.className = "popover";
  pop.setAttribute("role", "menu");
  pop.innerHTML = opciones.filter(Boolean).map((o, i) => o === "-" ? '<hr>' :
    `<button role="menuitem" data-i="${i}" class="${o.peligro ? "peligro" : ""}">${o.icono ? KD.icon(o.icono, 16) : ""}<span>${KD.esc(o.texto)}</span></button>`).join("");
  document.body.appendChild(pop);
  const r = ancla.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.right - w))}px`;
  pop.style.top = `${r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
  pop.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    KD.cerrarPopover();
    opciones.filter(Boolean)[Number(b.dataset.i)].accion();
  });
  setTimeout(() => document.addEventListener("click", function fuera(e) {
    if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener("click", fuera); }
  }), 0);
  pop.querySelector("button")?.focus();
};

// ---------- Avisos ----------
KD.toast = (msg, tipo = "") => {
  let cont = document.querySelector(".toasts");
  if (!cont) { cont = document.createElement("div"); cont.className = "toasts"; cont.setAttribute("role", "status"); document.body.appendChild(cont); }
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.textContent = msg;
  cont.appendChild(t);
  setTimeout(() => t.classList.add("salir"), 3200);
  setTimeout(() => t.remove(), 3600);
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
  if (!ok) KD.toast("Completa los campos obligatorios.", "bad");
  return ok;
};
KD.opciones = (lista, sel, valor = "id", texto = "nombre") =>
  lista.map((x) => `<option value="${KD.esc(x[valor])}" ${String(x[valor]) === String(sel) ? "selected" : ""}>${KD.esc(x[texto])}</option>`).join("");
// Horarios cada 15 minutos para elegir la hora de una cita (corrige los Issues #3 y #9)
KD.opcionesHora = (sel, desde = 8 * 60, hasta = 20 * 60, ocupadas = new Set()) => {
  const out = [];
  for (let t = desde; t < hasta; t += 15) {
    const h = KD.aHora(t);
    const txt = new Date(2000, 0, 1, Math.floor(t / 60), t % 60).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
    out.push(`<option value="${h}" ${h === sel ? "selected" : ""}>${txt}${ocupadas.has(h) ? " · ocupado" : ""}</option>`);
  }
  return out.join("");
};

// ---------- Piezas visuales ----------
KD.badge = (texto, tipo = "") => `<span class="badge ${tipo}">${KD.esc(texto)}</span>`;
KD.punto = (texto, tipo = "") => `<span class="estado-pill ${tipo}"><i></i>${KD.esc(texto)}</span>`;
KD.badgeEstadoCita = (e) => KD.punto(KD.ESTADOS_CITA[e] || e, `cita-${e}`);
KD.badgeEstadoPlan = (e) => KD.punto(KD.ESTADOS_PLAN[e] || e, `plan-${e}`);
KD.badgeEstadoPres = (e) => KD.punto(KD.ESTADOS_PRES[e] || e, `pres-${e}`);
KD.waLink = (tel) => `https://wa.me/52${String(tel || "").replace(/\D/g, "")}`;
KD.vacio = (msg, icono = "checkCirculo") => `<div class="vacio">${KD.icon(icono, 22)}<p>${KD.esc(msg)}</p></div>`;
KD.avatar = (nombre, color, grande = false) =>
  `<span class="avatar ${grande ? "grande" : ""}" style="--c:${color || "var(--primary)"}">${KD.esc(KD.iniciales(nombre))}</span>`;
KD.cabecera = (eyebrow, titulo, sub = "", acciones = "") => `<div class="page-head">
  <div><span class="eyebrow">${KD.esc(eyebrow)}</span><h1>${titulo}</h1>${sub ? `<p>${sub}</p>` : ""}</div>
  ${acciones ? `<div class="acciones">${acciones}</div>` : ""}</div>`;
KD.seccion = (eyebrow, titulo, extra = "") => `<div class="sec-head"><div><span class="eyebrow">${KD.esc(eyebrow)}</span><h2>${titulo}</h2></div>${extra}</div>`;
KD.progreso = (pct, tipo = "") => `<div class="progreso ${tipo}" role="progressbar" aria-valuenow="${Math.round(pct * 100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(0, Math.min(100, pct * 100))}%"></span></div>`;
// Barra horizontal para rankings
KD.barra = (valor, max, etiqueta) =>
  `<div class="bar-rank" title="${KD.esc(etiqueta)}"><span style="width:${max ? Math.max(2, (valor / max) * 100) : 0}%"></span></div>`;
KD.delta = (actual, previo) => {
  if (!previo) return "";
  const d = (actual - previo) / previo;
  return `<span class="delta ${d >= 0 ? "sube" : "baja"}">${KD.icon(d >= 0 ? "subir" : "bajar", 13)} ${Math.abs(Math.round(d * 1000) / 10)}%</span>`;
};

// ---------- Gráficas ----------
// Paleta categórica validada (daltonismo y contraste) para modo día y noche: ver css --serie-1…5
KD.SERIES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)", "var(--serie-4)", "var(--serie-5)"];

// Barras verticales de una sola serie. datos: [{etq, valor, tip, destacado}]
KD.graficaBarras = (datos, { fmt = (v) => KD.fmtNum(v), alto = 220 } = {}) => {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const paso = Math.pow(10, Math.floor(Math.log10(max)));
  const tope = Math.ceil(max / paso) * paso;
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => tope * f);
  const mostrarEtq = datos.length <= 16 ? 1 : Math.ceil(datos.length / 12);
  return `<div class="grafica-barras" style="--alto:${alto}px">
    <div class="gb-eje">${marcas.slice().reverse().map((m) => `<span>${KD.esc(fmt(m))}</span>`).join("")}</div>
    <div class="gb-area">
      ${marcas.map((m) => `<i class="gb-linea" style="bottom:${(m / tope) * 100}%"></i>`).join("")}
      <div class="gb-barras">${datos.map((d, i) => `<div class="gb-col" tabindex="0" data-tip="${KD.esc(d.tip || `${d.etq}: ${fmt(d.valor)}`)}">
        <span class="gb-barra ${d.destacado ? "destacada" : ""}" style="height:${(d.valor / tope) * 100}%"></span>
        <small>${i % mostrarEtq === 0 ? KD.esc(d.etq) : "&nbsp;"}</small></div>`).join("")}</div>
    </div>
  </div>`;
};

// Dona con leyenda. segs: [{nombre, valor}] (máximo 5 + "Otras")
KD.graficaDona = (segs, { centro = "", sub = "", fmt = (v) => KD.fmtNum(v) } = {}) => {
  const total = segs.reduce((s, x) => s + x.valor, 0);
  const R = 42, C = 2 * Math.PI * R;
  let acum = 0;
  const arcos = total ? segs.map((s, i) => {
    const largo = (s.valor / total) * C;
    const gap = segs.length > 1 ? Math.min(2, largo / 2) : 0;
    const arc = `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${s.color || KD.SERIES[i] || "var(--serie-otras)"}" stroke-width="13"
      stroke-dasharray="${Math.max(0, largo - gap)} ${C}" stroke-dashoffset="${-acum}" transform="rotate(-90 50 50)"><title>${KD.esc(s.nombre)}: ${KD.esc(fmt(s.valor))} (${Math.round((s.valor / total) * 100)}%)</title></circle>`;
    acum += largo;
    return arc;
  }).join("") : `<circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="13"/>`;
  return `<div class="dona">
    <div class="dona-svg"><svg viewBox="0 0 100 100" role="img" aria-label="Gráfica de dona">${arcos}</svg>
      <div class="dona-centro"><strong>${KD.esc(centro)}</strong><small>${KD.esc(sub)}</small></div></div>
    <ul class="leyenda-lista">${segs.map((s, i) => `<li><i style="background:${s.color || KD.SERIES[i] || "var(--serie-otras)"}"></i><span>${KD.esc(s.nombre)}</span><b>${total ? Math.round((s.valor / total) * 100) : 0}%</b></li>`).join("")}</ul>
  </div>`;
};

// Barras horizontales etiquetadas (pocas categorías)
KD.graficaHorizontal = (datos, { fmt = (v) => KD.fmtNum(v) } = {}) => {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return `<div class="grafica-h">${datos.map((d, i) => `<div class="gh-fila" tabindex="0" data-tip="${KD.esc(d.tip || `${d.nombre}: ${fmt(d.valor)}`)}">
    <span class="gh-nombre">${KD.esc(d.nombre)}${d.sub ? `<small>${KD.esc(d.sub)}</small>` : ""}</span>
    <span class="gh-barra"><span style="width:${(d.valor / max) * 100}%;background:${d.color || KD.SERIES[i]}"></span></span>
    <b>${KD.esc(fmt(d.valor))}</b></div>`).join("")}</div>`;
};

// ---------- Exportar ----------
KD.descargarCSV = (nombre, filas) => {
  const csv = filas.map((f) => f.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};
KD.imprimirHTML = (titulo, html) => {
  const w = window.open("", "_blank");
  if (!w) { KD.toast("Permite las ventanas emergentes para imprimir.", "bad"); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${KD.esc(titulo)}</title>
    <style>body{font-family:system-ui,sans-serif;color:#1d2a33;margin:32px;font-size:13px}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}td.n,th.n{text-align:right}.muted{color:#667}.total{font-size:18px;font-weight:700;text-align:right}</style>
    </head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
};
