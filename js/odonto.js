// Odontograma mexicano: numeración FDI (la oficial en México), 5 caras por diente,
// rojo = lo que falta por tratar y azul = lo que ya está hecho.
window.KD = window.KD || {};

KD.ODONTO_ROJO = "#d33a3a";
KD.ODONTO_AZUL = "#2d6fd2";

// Tipo de dentición según la edad: temporal (≤5 años), mixta (6 a 12) o permanente (13+)
KD.denticion = (pac) => {
  const e = KD.edad(pac?.nacimiento);
  if (e === "" || e >= 13) return "permanente";
  return e <= 5 ? "temporal" : "mixta";
};
KD.NOMBRE_DENTICION = {
  permanente: "Permanente (adulto) · 32 piezas",
  mixta: "Mixta (infantil de 6 a 12 años) · temporales y permanentes",
  temporal: "Temporal (infantil) · 20 piezas",
};
const FILAS = {
  permSup: ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"],
  permInf: ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"],
  tempSup: ["55", "54", "53", "52", "51", "61", "62", "63", "64", "65"],
  tempInf: ["85", "84", "83", "82", "81", "71", "72", "73", "74", "75"],
};
KD.filasOdontograma = (den) => den === "temporal" ? [["Superior", FILAS.tempSup], ["Inferior", FILAS.tempInf]]
  : den === "mixta" ? [["Superior permanente", FILAS.permSup], ["Superior temporal", FILAS.tempSup], ["Inferior temporal", FILAS.tempInf], ["Inferior permanente", FILAS.permInf]]
  : [["Superior", FILAS.permSup], ["Inferior", FILAS.permInf]];

const esSuperior = (p) => ["1", "2", "5", "6"].includes(String(p)[0]);
const mesialDerecha = (p) => ["1", "4", "5", "8"].includes(String(p)[0]);
const esAnterior = (p) => Number(String(p)[1]) <= 3;
KD.nombrePieza = (p) => {
  const q = String(p)[0], n = Number(String(p)[1]);
  const temporal = Number(q) >= 5;
  const nombres = temporal ? ["", "Incisivo central", "Incisivo lateral", "Canino", "Primer molar", "Segundo molar"]
    : ["", "Incisivo central", "Incisivo lateral", "Canino", "Primer premolar", "Segundo premolar", "Primer molar", "Segundo molar", "Tercer molar"];
  const lado = { 1: "superior derecho", 2: "superior izquierdo", 3: "inferior izquierdo", 4: "inferior derecho" }[((Number(q) - 1) % 4) + 1];
  return `${nombres[n] || "Pieza"} ${lado}${temporal ? " (temporal)" : ""}`;
};
KD.CARAS = { V: "Vestibular", L: "Lingual / palatina", M: "Mesial", D: "Distal", O: "Oclusal / incisal" };

// Hallazgos por cara y por diente completo. `trat`: tratamiento sugerido del catálogo.
KD.HALLAZGOS_CARA = {
  caries: { nombre: "Caries", color: "rojo", trat: "t5" },
  resina: { nombre: "Resina / obturación", color: "azul" },
  sellador: { nombre: "Sellador", color: "azul" },
};
KD.HALLAZGOS_DIENTE = {
  extraccion: { nombre: "Extracción indicada", color: "rojo", trat: "t6", simbolo: "x" },
  ausente: { nombre: "Ausente / extraído", color: "azul", simbolo: "x" },
  endodoncia: { nombre: "Endodoncia indicada", color: "rojo", trat: "t8", simbolo: "endo" },
  endodoncia_hecha: { nombre: "Endodoncia realizada", color: "azul", simbolo: "endo" },
  corona: { nombre: "Corona indicada", color: "rojo", trat: "t9", simbolo: "corona" },
  corona_hecha: { nombre: "Corona existente", color: "azul", simbolo: "corona" },
  implante: { nombre: "Implante indicado", color: "rojo", trat: "t10", simbolo: "imp" },
  implante_hecho: { nombre: "Implante existente", color: "azul", simbolo: "imp" },
  fractura: { nombre: "Fractura", color: "rojo", trat: "t5", simbolo: "fractura" },
};

KD.odonto = (pac) => (pac.odonto ||= { piezas: {}, log: [] });
const dato = (pac, p) => (KD.odonto(pac).piezas[p] ||= { caras: {}, diente: "" });
const limpiar = (pac, p) => {
  const d = KD.odonto(pac).piezas[p];
  if (d && !d.diente && !Object.keys(d.caras).length && !d.nota) delete KD.odonto(pac).piezas[p];
};
KD.odontoLog = (pac, pieza, texto, fecha = KD.hoy(), usuarioId = KD.db?.sesion?.usuarioId) => {
  KD.odonto(pac).log.push({ fecha, usuarioId, pieza: String(pieza), texto });
};
const listaPiezas = (s) => String(s || "").split(/[,\s]+/).map((x) => x.trim()).filter((x) => /^[1-8][1-8]$/.test(x));
KD.listaPiezas = listaPiezas;

// Caras que suelen afectarse con caries según la pieza (para la demo y cuando no se indica la cara)
const carasTipicas = (p) => (esAnterior(p) ? ["V", "M"] : ["O", Number(p) % 2 ? "M" : "D"]).slice(0, 1 + (Number(p) % 2));

// El doctor diagnostica: marca en rojo lo que hay que tratar
KD.odontoIndicado = (pac, tratId, piezas, fecha, usuarioId, caras) => {
  for (const p of listaPiezas(piezas)) {
    const d = dato(pac, p);
    let texto = "";
    if (tratId === "t5") { for (const c of caras || carasTipicas(p)) d.caras[c] = "caries"; texto = `Caries (${(caras || carasTipicas(p)).join(", ")})`; }
    else if (tratId === "t6" || tratId === "t7") { d.diente = "extraccion"; texto = "Extracción indicada"; }
    else if (tratId === "t8") { d.diente = "endodoncia"; texto = "Endodoncia indicada"; }
    else if (tratId === "t9") { d.diente = "corona"; texto = "Corona indicada"; }
    else if (tratId === "t10") { d.diente = "implante"; texto = "Implante indicado"; }
    else { limpiar(pac, p); continue; }
    KD.odontoLog(pac, p, `Diagnóstico: ${texto}`, fecha, usuarioId);
  }
};
// Se hizo el tratamiento: lo rojo pasa a azul
KD.odontoRealizado = (pac, tratId, piezas, fecha, usuarioId) => {
  for (const p of listaPiezas(piezas)) {
    const d = dato(pac, p);
    let texto = "";
    if (tratId === "t5") {
      const conCaries = Object.keys(d.caras).filter((c) => d.caras[c] === "caries");
      (conCaries.length ? conCaries : [esAnterior(p) ? "V" : "O"]).forEach((c) => (d.caras[c] = "resina"));
      if (d.diente === "fractura") d.diente = "";
      texto = "Resina colocada";
    } else if (tratId === "t4") { d.caras.O = "sellador"; texto = "Sellador colocado"; }
    else if (tratId === "t6" || tratId === "t7") { d.diente = "ausente"; d.caras = {}; texto = "Extracción realizada"; }
    else if (tratId === "t8") { d.diente = "endodoncia_hecha"; texto = "Endodoncia realizada"; }
    else if (tratId === "t9") { d.diente = "corona_hecha"; texto = "Corona colocada"; }
    else if (tratId === "t10") { d.diente = "implante_hecho"; texto = "Implante colocado"; }
    else { limpiar(pac, p); continue; }
    KD.odontoLog(pac, p, `Tratamiento: ${texto}`, fecha, usuarioId);
  }
};

// Resumen: piezas con algo registrado
KD.odontoHallazgos = (pac) => Object.entries(KD.odonto(pac).piezas).map(([pieza, d]) => {
  const textos = [];
  let rojo = false;
  const porHallazgo = {};
  for (const [c, h] of Object.entries(d.caras)) (porHallazgo[h] ||= []).push(c);
  for (const [h, cs] of Object.entries(porHallazgo)) {
    const inf = KD.HALLAZGOS_CARA[h];
    if (!inf) continue;
    textos.push({ texto: `${inf.nombre} (${cs.join(", ")})`, color: inf.color });
    if (inf.color === "rojo") rojo = true;
  }
  if (d.diente && KD.HALLAZGOS_DIENTE[d.diente]) {
    const inf = KD.HALLAZGOS_DIENTE[d.diente];
    textos.push({ texto: inf.nombre, color: inf.color });
    if (inf.color === "rojo") rojo = true;
  }
  return { pieza, textos, rojo, nota: d.nota || "", sugerido: KD.tratamientoSugerido(pieza, d) };
}).filter((h) => h.textos.length || h.nota).sort((a, b) => a.pieza.localeCompare(b.pieza));

KD.tratamientoSugerido = (pieza, d) => {
  if (!d) return "";
  if (d.diente && KD.HALLAZGOS_DIENTE[d.diente]?.trat) {
    const t = KD.HALLAZGOS_DIENTE[d.diente].trat;
    return t === "t6" && ["18", "28", "38", "48"].includes(pieza) ? "t7" : t;
  }
  return Object.values(d.caras).includes("caries") ? "t5" : "";
};

// ---------- Dibujo ----------
// Un diente = cuadro con 5 caras. Arriba/abajo = vestibular/lingual según la arcada; izquierda/derecha = mesial/distal según el cuadrante.
KD.dienteSVG = (pieza, d = { caras: {}, diente: "" }, size = 34) => {
  const sup = esSuperior(pieza), mesDer = mesialDerecha(pieza);
  const pos = { top: sup ? "V" : "L", bottom: sup ? "L" : "V", left: mesDer ? "D" : "M", right: mesDer ? "M" : "D", center: "O" };
  const polys = {
    top: "3,3 37,3 28,12 12,12", bottom: "12,28 28,28 37,37 3,37",
    left: "3,3 12,12 12,28 3,37", right: "37,3 37,37 28,28 28,12", center: "12,12 28,12 28,28 12,28",
  };
  const fill = (cara) => {
    const h = d.caras?.[cara];
    if (!h || !KD.HALLAZGOS_CARA[h]) return "var(--surface)";
    return h === "sellador" ? "#9dbcf0" : KD.HALLAZGOS_CARA[h].color === "rojo" ? KD.ODONTO_ROJO : KD.ODONTO_AZUL;
  };
  const inf = KD.HALLAZGOS_DIENTE[d.diente];
  const col = inf ? (inf.color === "rojo" ? KD.ODONTO_ROJO : KD.ODONTO_AZUL) : "";
  const simbolo = !inf ? "" : {
    x: `<path d="M5 5 35 35M35 5 5 35" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`,
    corona: `<circle cx="20" cy="20" r="18.2" fill="none" stroke="${col}" stroke-width="2.6"/>`,
    endo: `<path d="M20 1v38" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`,
    imp: `<rect x="11" y="14" width="18" height="12" rx="2" fill="${col}"/><text x="20" y="23.2" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="system-ui">IMP</text>`,
    fractura: `<path d="M6 8 16 18 12 22 24 30 34 34" fill="none" stroke="${col}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  }[inf.simbolo];
  return `<svg class="diente-svg" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">
    ${Object.entries(polys).map(([k, pts]) => `<polygon points="${pts}" data-cara="${pos[k]}" fill="${fill(pos[k])}" stroke="var(--odo-borde)" stroke-width="1.2"/>`).join("")}
    ${simbolo}</svg>`;
};

// Odontograma completo. `sel`: piezas seleccionadas.
KD.odontogramaHTML = (pac, sel = new Set()) => {
  const den = KD.denticion(pac);
  const od = KD.odonto(pac).piezas;
  const fila = ([titulo, piezas]) => {
    const sup = esSuperior(piezas[0]);
    const mitad = piezas.length / 2;
    return `<div class="odo-fila ${sup ? "sup" : "inf"}">
      <span class="odo-etq">${KD.esc(titulo)}</span>
      <div class="odo-dientes">${piezas.map((p, i) => `${i === mitad ? '<span class="odo-linea-media"></span>' : ""}<button type="button" class="diente ${sel.has(p) ? "sel" : ""} ${od[p] ? "con-dato" : ""}" data-pieza="${p}" aria-label="Pieza ${p}: ${KD.esc(KD.nombrePieza(p))}" aria-pressed="${sel.has(p)}">
          <span class="num">${p}</span>${KD.dienteSVG(p, od[p])}</button>`).join("")}</div>
    </div>`;
  };
  const filas = KD.filasOdontograma(den);
  const mitad = filas.length / 2;
  return `<div class="odontograma" data-den="${den}">
    ${filas.slice(0, mitad).map(fila).join("")}
    <div class="odo-separador"></div>
    ${filas.slice(mitad).map(fila).join("")}
  </div>`;
};
KD.leyendaOdontograma = () => `<div class="odo-leyenda">
  <span><i style="background:${KD.ODONTO_ROJO}"></i>Rojo: por tratar</span>
  <span><i style="background:${KD.ODONTO_AZUL}"></i>Azul: realizado / existente</span>
  <span><svg width="14" height="14" viewBox="0 0 40 40"><path d="M5 5 35 35M35 5 5 35" stroke="currentColor" stroke-width="5"/></svg>Extracción / ausente</span>
  <span><svg width="14" height="14" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="5"/></svg>Corona</span>
  <span><svg width="14" height="14" viewBox="0 0 40 40"><path d="M20 2v36" stroke="currentColor" stroke-width="6"/></svg>Endodoncia</span>
</div>`;
