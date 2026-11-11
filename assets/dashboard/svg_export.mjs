// svg_export.mjs: maquetación pura del SVG exportable (sin DOM ni red; probada con node:test).
// Problema que resuelve: título, metadatos, leyenda y pies largos (etiquetas de control, rutas de fuente,
// releases, hashes, cuatro territorios) se salían del ancho del viewBox al dibujarse en una sola línea.
// Aquí se envuelve cada texto con un estimador CONSERVADOR de ancho (sobrestima la sans del sistema),
// se parten tokens sin espacios (rutas, hashes) y las alturas salen de las líneas reales.

export const EXPORT_LAYOUT = Object.freeze({
  pad: 16,
  title: { size: 18, lineH: 23, weight: 650 },
  meta: { size: 12, lineH: 17 },
  legend: { size: 12, lineH: 17, swatch: 22, gap: 6, itemGap: 18 },
  foot: { size: 11, lineH: 15 },
});

const NARROW = new Set([...' il.,:;|!\'`()[]{}/\\-·ıjtfr']);
const WIDE = new Set([...'mwMWÑ@%&—']);

/**
 * Ancho estimado de un texto en unidades del viewBox. Coeficientes por encima de los reales de
 * system-ui/Segoe/SF/Roboto (≈0.5 em promedio en minúsculas) para no subestimar en ningún visor.
 * `weight` ≥ 600 añade 6 %.
 */
export function estimateTextWidth(text, fontSize, weight = 400) {
  let em = 0;
  for (const ch of String(text ?? '')) {
    if (WIDE.has(ch)) em += 0.95;
    else if (NARROW.has(ch)) em += 0.36;
    else if (/[A-ZÁÉÍÓÚÜ]/.test(ch)) em += 0.74;
    else if (/[0-9]/.test(ch)) em += 0.62;
    else em += 0.6;
  }
  return em * fontSize * (weight >= 600 ? 1.06 : 1);
}

/** Parte un token sin espacios en trozos que caben, prefiriendo cortar tras / _ - · . */
function splitToken(token, maxWidth, measure) {
  const out = [];
  let rest = token;
  while (rest && measure(rest) > maxWidth) {
    // Mayor prefijo que cabe.
    let fit = 1;
    while (fit < rest.length && measure(rest.slice(0, fit + 1)) <= maxWidth) fit += 1;
    // Retroceder hasta un separador natural si queda razonablemente lejos del inicio.
    let cut = fit;
    for (let i = fit; i > Math.floor(fit * 0.5); i -= 1) {
      if ('/_-·.|'.includes(rest[i - 1])) { cut = i; break; }
    }
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Envuelve `text` en líneas cuyo ancho estimado ≤ maxWidth. Nunca pierde caracteres:
 * las palabras se reúnen con un espacio y los tokens largos se parten sin insertar nada.
 * `measure(text)` opcional (p. ej. canvas); por omisión el estimador conservador.
 */
export function wrapText(text, maxWidth, fontSize, { weight = 400, measure = null } = {}) {
  const m = measure ?? ((s) => estimateTextWidth(s, fontSize, weight));
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (m(candidate) <= maxWidth) { line = candidate; continue; }
    if (line) lines.push(line);
    if (m(word) <= maxWidth) { line = word; continue; }
    const parts = splitToken(word, maxWidth, m);
    lines.push(...parts.slice(0, -1));
    line = parts[parts.length - 1];
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Calcula la maqueta completa. Entrada:
 *   { width, chartHeight, title, meta: [string], legend: [{cls, label}], foot: [string], measure? }
 * Salida:
 *   { width, total, headH, footH, chartY,
 *     texts: [{role:'title'|'meta'|'legend'|'foot', x, y, size, text}],
 *     swatches: [{cls, x1, x2, y}] }
 * Todas las coordenadas x + ancho estimado de cada texto quedan dentro de [pad, width - pad].
 */
export function layoutSvgExport({ width = 960, chartHeight, title = '', meta = [], legend = [], foot = [], measure = null }) {
  const L = EXPORT_LAYOUT;
  const maxW = width - 2 * L.pad;
  const texts = [];
  const swatches = [];
  const wrapOpts = (size, weight) => ({ weight, measure: measure ? (s) => measure(s, size, weight) : null });
  let y = L.pad;

  for (const line of wrapText(title, maxW, L.title.size, wrapOpts(L.title.size, L.title.weight))) {
    texts.push({ role: 'title', x: L.pad, y: y + L.title.size, size: L.title.size, text: line });
    y += L.title.lineH;
  }
  y += 2;
  for (const block of meta) {
    for (const line of wrapText(block, maxW, L.meta.size, wrapOpts(L.meta.size, 400))) {
      texts.push({ role: 'meta', x: L.pad, y: y + L.meta.size, size: L.meta.size, text: line });
      y += L.meta.lineH;
    }
  }

  if (legend.length) {
    y += 6;
    const lg = L.legend;
    const textMax = maxW - lg.swatch - lg.gap;
    const measureL = measure ? (s) => measure(s, lg.size, 400) : (s) => estimateTextWidth(s, lg.size);
    let x = L.pad;
    let rowLines = 1;
    for (const item of legend) {
      const lines = wrapText(item.label, textMax, lg.size, wrapOpts(lg.size, 400));
      const textW = Math.max(...lines.map(measureL), 0);
      const itemW = lg.swatch + lg.gap + textW;
      if (x > L.pad && x + itemW > width - L.pad) { // no cabe en la fila: nueva fila
        y += rowLines * lg.lineH;
        x = L.pad;
        rowLines = 1;
      }
      swatches.push({ cls: item.cls, x1: x, x2: x + lg.swatch, y: y + lg.size - 4 });
      lines.forEach((t, i) => texts.push({ role: 'legend', x: x + lg.swatch + lg.gap, y: y + lg.size + i * lg.lineH, size: lg.size, text: t }));
      rowLines = Math.max(rowLines, lines.length);
      x += itemW + lg.itemGap;
    }
    y += rowLines * lg.lineH;
  }
  const headH = Math.ceil(y + 8);

  let fy = headH + chartHeight + 10;
  for (const block of foot) {
    for (const line of wrapText(block, maxW, L.foot.size, wrapOpts(L.foot.size, 400))) {
      texts.push({ role: 'foot', x: L.pad, y: fy + L.foot.size, size: L.foot.size, text: line });
      fy += L.foot.lineH;
    }
  }
  const total = Math.ceil(fy + L.pad);
  return { width, total, headH, footH: total - headH - chartHeight, chartY: headH, texts, swatches };
}
