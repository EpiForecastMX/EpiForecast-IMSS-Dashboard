// Pruebas de la maquetación pura del SVG exportable (assets/dashboard/svg_export.mjs).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPORT_LAYOUT, estimateTextWidth, wrapText, layoutSvgExport,
} from '../assets/dashboard/svg_export.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 960;
const PAD = EXPORT_LAYOUT.pad;
const SIZE_WEIGHT = { title: [EXPORT_LAYOUT.title.size, EXPORT_LAYOUT.title.weight], meta: [12, 400], legend: [12, 400], foot: [11, 400] };

const CONTROL = 'Estado: Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos';
const ORIGIN = 'Origen: semana 26 de 2026 · Emisión registrada: 25 jul 2026, 04:55 UTC · Última semana observada: semana 42 de 2026';
// Renglón de procedencia tal como lo arma la UI cuando junta origen, emisión, corte y estado de control.
const LONG = `${CONTROL} · ${ORIGIN}`;
const SHA ='e9728d49fe146fb679d6a360d9374b7d0fe6fe7b314b4edde02e10b073af9a04e9728d49fe146fb679d6a360d9374b7d0fe6fe7b314b4edde02e10b073af9a04';
const SOURCE = `Fuente: publication/cancer_cuello_utero_c53/vista.json · cancer_cuello_utero_c53_release_a2dd2900a980 · SHA-256 ${SHA}`;
const NOTE = 'Fechas comunes del índice del 2 ene 2023 al 19 oct 2027; sin relleno de huecos ni suma de territorios. Fechas del índice de la serie, no calendario del boletín. Pronóstico puntual sin intervalos. Conteos absolutos. EpiForecast-MX.';
const TITLE = 'Cáncer de cuello del útero (C53) · Región Sur-Sureste vulnerable · General · comparación territorial entre entidades';
const LEGEND4 = [
  { cls: 'cl c0', label: 'Región Sur-Sureste vulnerable' },
  { cls: 'cl c1', label: 'Región Metropolitana alta' },
  { cls: 'cl c2', label: 'San Luis Potosí' },
  { cls: 'cl c3', label: 'Baja California Sur' },
  { cls: 'key-fut', label: 'Pronóstico (discontinua)' },
];

const strip = (s) => s.replace(/\s+/g, '');

function assertInside(lay) {
  for (const t of lay.texts) {
    const [size, weight] = SIZE_WEIGHT[t.role];
    const right = t.x + estimateTextWidth(t.text, size, weight);
    assert.ok(t.x >= PAD, `${t.role} empieza dentro: ${t.text}`);
    assert.ok(right <= W - PAD + 1e-9, `${t.role} se sale (${right.toFixed(1)} > ${W - PAD}): ${t.text}`);
    assert.ok(t.y > 0 && t.y <= lay.total, `${t.role} y=${t.y} fuera de 0..${lay.total}`);
  }
  for (const s of lay.swatches) assert.ok(s.x1 >= PAD && s.x2 <= W - PAD, 'muestra de leyenda dentro');
}

describe('estimador y envoltura', () => {
  test('el diseño anterior (una línea por renglón) se salía del ancho', () => {
    assert.ok(estimateTextWidth(LONG, 12) + PAD > W - PAD, 'la procedencia con etiqueta de control no cabe en una línea');
    assert.ok(estimateTextWidth(SOURCE, 11) + PAD > W - PAD, 'la fuente con SHA no cabe en una línea');
    assert.ok(estimateTextWidth(TITLE, 18, 650) + PAD > W - PAD, 'el título largo no cabe en una línea');
  });

  test('el estimador es conservador frente a anchos típicos de la sans del sistema', () => {
    // Minúsculas ≈0.5 em y mayúsculas ≈0.68 em en system-ui; el estimador debe quedar por encima.
    const text = 'Validación prospectiva en curso';
    assert.ok(estimateTextWidth(text, 12) >= text.length * 12 * 0.5);
    assert.ok(estimateTextWidth('MMMM', 10) >= 4 * 10 * 0.9);
    assert.equal(estimateTextWidth('', 12), 0);
  });

  test('wrapText no pierde caracteres y respeta el ancho', () => {
    for (const text of [CONTROL, LONG, SOURCE, NOTE, TITLE]) {
      const lines = wrapText(text, W - 2 * PAD, 12);
      assert.ok(lines.length >= 1);
      assert.equal(strip(lines.join('')), strip(text), 'contenido íntegro');
      for (const l of lines) assert.ok(estimateTextWidth(l, 12) <= W - 2 * PAD, l);
    }
  });

  test('parte tokens sin espacios (rutas, hashes) sin inventar caracteres', () => {
    const token = `publication/${'x'.repeat(80)}_release_${SHA}`;
    const lines = wrapText(token, 300, 11);
    assert.ok(lines.length > 1);
    assert.equal(lines.join(''), token);
    for (const l of lines) assert.ok(estimateTextWidth(l, 11) <= 300, l);
  });

  test('acepta un medidor inyectado (p. ej. canvas)', () => {
    const measure = (s) => s.length * 10;
    const lines = wrapText('aaaa bbbb cccc dddd', 95, 12, { measure });
    assert.deepEqual(lines, ['aaaa bbbb', 'cccc dddd']);
  });
});

describe('layoutSvgExport', () => {
  const big = () => layoutSvgExport({
    width: W, chartHeight: 380, title: TITLE,
    meta: [ORIGIN, LONG, 'Base 100 en 2 ene 2023: Región Sur-Sureste vulnerable = 1.234; Región Metropolitana alta = 2.345; San Luis Potosí = 345; Baja California Sur = 120'],
    legend: LEGEND4, foot: [SOURCE, NOTE],
  });

  test('ningún texto ni muestra sale del viewBox de 960', () => assertInside(big()));

  test('alturas calculadas con las líneas reales; el gráfico no se encima', () => {
    const lay = big();
    const head = lay.texts.filter((t) => t.role !== 'foot');
    const foot = lay.texts.filter((t) => t.role === 'foot');
    assert.ok(head.length > 1 + 3 + 1, 'título, metadatos y leyenda envueltos en varias líneas');
    assert.ok(Math.max(...head.map((t) => t.y)) < lay.headH, 'cabecera termina antes del gráfico');
    assert.ok(Math.min(...foot.map((t) => t.y - t.size)) >= lay.headH + 380, 'pie empieza después del gráfico');
    assert.ok(Math.max(...foot.map((t) => t.y)) < lay.total, 'pie dentro del total');
    assert.equal(lay.headH + 380 + lay.footH, lay.total);
    assert.equal(lay.chartY, lay.headH);
    // La versión anterior reservaba 34 + 17·n + 26 en la cabecera y 14 + 15·n en el pie.
    assert.ok(lay.headH > 34 + 3 * 17 + 26, 'cabecera crece con las líneas envueltas');
    assert.ok(lay.footH > 14 + 2 * 15, 'pie crece con las líneas envueltas');
  });

  test('las líneas de texto no se solapan verticalmente dentro de cada bloque', () => {
    const lay = big();
    const ys = (role) => lay.texts.filter((t) => t.role === role).map((t) => t.y);
    for (const role of ['title', 'meta', 'foot']) {
      const v = ys(role);
      for (let i = 1; i < v.length; i += 1) assert.ok(v[i] - v[i - 1] >= SIZE_WEIGHT[role][0], `${role} sin solape`);
    }
  });

  test('leyenda de cuatro territorios: filas sin solape horizontal y contenido íntegro', () => {
    const lay = big();
    const legendTexts = lay.texts.filter((t) => t.role === 'legend');
    assert.equal(strip(legendTexts.map((t) => t.text).join('')), strip(LEGEND4.map((l) => l.label).join('')));
    assert.equal(lay.swatches.length, LEGEND4.length);
    const rows = new Map();
    for (const s of lay.swatches) rows.set(s.y, [...(rows.get(s.y) ?? []), s]);
    for (const row of rows.values()) {
      row.sort((a, b) => a.x1 - b.x1);
      for (let i = 1; i < row.length; i += 1) assert.ok(row[i].x1 > row[i - 1].x2, 'muestras sin solape');
    }
  });

  test('etiqueta de leyenda más ancha que la fila se envuelve dentro', () => {
    const lay = layoutSvgExport({ width: W, chartHeight: 300, title: 'T', meta: [], legend: [{ cls: 'c0', label: LONG }], foot: [] });
    assertInside(lay);
    assert.ok(lay.texts.filter((t) => t.role === 'legend').length > 1);
  });

  test('textos cortos: una línea por bloque y sin leyenda no reserva espacio extra', () => {
    const lay = layoutSvgExport({ width: W, chartHeight: 360, title: 'Dengue · Nacional · General', meta: ['Estado: Serie histórica'], legend: [], foot: ['Fuente: Reports/zoom_data_dengue.json'] });
    assertInside(lay);
    assert.equal(lay.texts.length, 3);
    assert.equal(lay.swatches.length, 0);
  });
});

describe('integración con el controlador', () => {
  test('exportSvg usa layoutSvgExport y ya no posiciona textos con alturas fijas', async () => {
    const js = await readFile(join(ROOT, 'assets/dashboard/dashboard.mjs'), 'utf8');
    assert.match(js, /import \{ layoutSvgExport \} from '\.\/svg_export\.mjs';/);
    assert.match(js, /layoutSvgExport\(\{ width: w, chartHeight: h, title, meta, legend, foot \}\)/);
    assert.doesNotMatch(js, /item\.label\.length \* 6\.6/, 'sin estimación fija de la leyenda anterior');
  });
});
