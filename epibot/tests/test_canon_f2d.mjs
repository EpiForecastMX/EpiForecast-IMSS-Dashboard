/**
 * Plan canónico del EpiBot, fase 1, fase 2, entrega D (26-nov-2026): 2.2 texto y gráfica con la misma ventana, el
 * mismo orden y las mismas filas; marcador de gráfica en los originales; preguntas de error con el zoom de seguimiento.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const local = s.match(/(knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)\.json/);
  const rel = m ? m[1] : (local ? `epibot/${local[1]}.json` : null);
  if (!rel || !existsSync(new URL(rel, raiz))) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
Math.random = () => 0.42;
const kb = await import('../js/kb.js');
await kb.loadKnowledge();
const pide = async (q) => { kb._resetContext?.(); const r = await kb.answerWithTrace(q); return String(r.response || ''); };
const resumen = JSON.parse(readFileSync(new URL('epibot/resumen_padecimientos.json', raiz), 'utf-8'));
const { graficaObesidad } = await import('../js/obesidad_charts.js');
globalThis.document = undefined;
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf-8');
const src = app.match(/export function graficaEstadosTexto\(m\) \{[\s\S]*?\n\}\n/)[0].replace('export ', '');
const vm = await import('node:vm');
const ctx = vm.createContext({});
vm.runInContext(`${src}; globalThis.g = graficaEstadosTexto;`, ctx);

const filasTexto = (t) => [...t.split('<!--DETALLE-->')[0].matchAll(/^- \*\*([^*]+)\*\*/gm)].map((m) => m[1]);
const marcaRelease = (t) => { const m = t.match(/<!--([A-Z0-9_]+):(\{.*?\})-->/); return m && { marca: m[1], m: JSON.parse(m[2]) }; };
const vistaDe = (marca) => {
  const id = globalThis.EPI_CATALOGO.releases.find((r) => r.marca === marca).id;
  return JSON.parse(readFileSync(new URL(`publication/${id}/vista.json`, raiz), 'utf-8'));
};
const grafRelease = async (q) => {
  const t = await pide(q); const { marca, m } = marcaRelease(t);
  return { t, m, g: graficaObesidad(vistaDe(marca), q, { estado: m.estado, sexo: m.sexo }, m) };
};

test('2.2 releases: el ranking de estados dibuja las próximas 4 semanas, en el orden del texto, con sus valores', async () => {
  const { t, m, g } = await grafRelease('ranking de estados para hepatitis A');
  const nombres = filasTexto(t);
  assert.equal(m.ventana, 'f4');
  assert.deepEqual(g.labels.slice(0, nombres.length), nombres);
  for (const [i, n] of nombres.entries()) {
    const casos = Number(t.match(new RegExp(`\\*\\*${n}\\*\\*: unos ([\\d,]+) casos`))[1].replace(/,/g, ''));
    assert.equal(g.datasets[0].data[i], casos, n);
  }
  assert.match(g.title, /próximas 4 semanas|más casos esperados/);
  assert.ok(g.labels.length <= 10);
});

test('2.2 releases: «dónde sube más rápido» dibuja el cambio porcentual de los mismos estados', async () => {
  const { t, m, g } = await grafRelease('¿dónde sube más rápido la hepatitis A?');
  assert.equal(m.ventana, 'ritmo');
  assert.deepEqual(g.labels, filasTexto(t));
  const pcts = [...t.matchAll(/^- .*\(([+−]\d+) %\)/gm)].map((x) => Number(x[1].replace('−', '-')));
  assert.deepEqual(g.datasets[0].data, pcts);
});

test('2.2 releases: el mapa de un ranking pinta los mismos valores de las próximas 4 semanas', async () => {
  const { t, g } = await grafRelease('mapa de diabetes tipo 2');
  assert.ok(g._mapChart);
  assert.match(g.opts.title, /próximas 4 semanas/);
  const [n] = filasTexto(t);
  const casos = Number(t.match(new RegExp(`\\*\\*${n}\\*\\*: unos ([\\d,]+) casos`))[1].replace(/,/g, ''));
  const clave = (n === 'Estado de México' ? 'México' : n).normalize('NFD').replace(/[̀-ͯ]/g, '');
  assert.equal(g.stateData[clave].value, casos);
});

test('2.2 releases: una pregunta por el error lleva el zoom de seguimiento, sin etiquetas ISO en el título', async () => {
  for (const q of ['¿qué tan atinado fue el pronóstico de asma?', '¿cuál es el sMAPE de hipertensión fuera de muestra?']) {
    const { m, g } = await grafRelease(q);
    assert.equal(m.tipo, 'seguimiento', q);
    assert.doesNotMatch(JSON.stringify(g.options?.plugins?.title ?? g.title), /20\d\d-W\d\d|desde 20\d\d-/);
  }
  assert.equal((await grafRelease('dame un grafico de asma')).m.tipo, 'serie');
});

test('2.2 originales: rankings y comparaciones traen el marcador ESTADOS con las filas del texto', async () => {
  const marcaE = (t) => JSON.parse(t.match(/<!--ESTADOS:(.*?)-->/)[1]);
  const den = await pide('¿qué estados tendrán más casos de dengue el próximo mes?');
  const md = marcaE(den);
  assert.equal(md.modo, 'f4');
  assert.deepEqual(md.filas.slice(0, md.destacados).map(([n]) => n), filasTexto(den));
  const gd = ctx.g(md);
  assert.ok(gd.labels.length <= 10 && gd.labels[0] === filasTexto(den)[0]);
  const rit = await pide('¿en qué estado sube más rápido la depresión?');
  const mr = marcaE(rit);
  assert.equal(mr.modo, 'ritmo');
  assert.deepEqual(mr.filas.map(([n]) => n), filasTexto(rit));
  const cmp = await pide('compara dengue Veracruz vs Yucatán');
  const mc = marcaE(cmp);
  assert.equal(mc.modo, 'comparacion');
  assert.deepEqual(mc.filas.map(([n]) => n), ['Veracruz', 'Yucatán']);
  assert.doesNotMatch(cmp, /SIN_GRAFICA/);
  const gc = ctx.g(mc);
  assert.equal(JSON.stringify(gc.datasets.map((d) => d.label)), JSON.stringify(['Últimas 4 semanas (observado)', 'Próximas 4 semanas (pronóstico)']));
  assert.match(app, /\.replace\(\/<!--ESTADOS:\.\*\?-->\/g, ''\)/, 'el marcador no se ve en el texto');
});
