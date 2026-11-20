// Panorama de vigilancia del radar (alta_b44, 20-nov-2026): la cuarta tarjeta y la huella de la plataforma
// cuentan la cobertura real de la opción «Pronóstico» (publicado y exploratorio no validado, por separado).
// Con 7553966e fallan: la tarjeta decía «Categorías sin cobertura», el anillo contaba sólo los publicados y el
// titular decía «Una agenda por ampliar».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const json = (rel) => JSON.parse(leer(rel));
const imp = (rel) => import(pathToFileURL(resolve(root, rel)).href);
const actual = json('assets/boletin/actual.json');
const data = json(`${actual.carpeta}/data.json`);
const doc = json(`${actual.carpeta}/pronostico_exploratorio.json`);
const historia = json('assets/boletin/history/index.json');
const cats = data.diseases.filter((e) => !e.aggregate);
const publicadas = cats.filter((e) => e.platform_id && ['Publicada', 'Control publicado'].includes(e.status));
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('coberturaPanorama: 100 % con pronóstico, publicado y exploratorio por separado, desde los datos', async () => {
  const { coberturaPanorama } = await imp('assets/boletin/coverage.mjs');
  const p = coberturaPanorama(data.diseases, doc);
  assert.equal(p.total, cats.length);
  assert.equal(p.publicado, publicadas.length);
  assert.equal(p.publicados, new Set(publicadas.map((e) => e.platform_id)).size);
  assert.equal(p.exploratorio, doc.conteo.con_pronostico);
  assert.equal(p.publicado + p.exploratorio, p.total);
  assert.equal(p.con_pronostico, p.total);
  assert.equal(p.sin_pronostico, 0);
  assert.equal(p.completo, true);
  assert.equal(p.pct_con_pronostico, 100);
  assert.equal(p.pct_publicado, Math.round((publicadas.length / cats.length) * 1000) / 10);
  // Sin el exploratorio sólo cuenta lo publicado: nunca se presenta como completo.
  const sin = coberturaPanorama(data.diseases, null);
  assert.equal(sin.con_pronostico, publicadas.length);
  assert.equal(sin.completo, false);
  assert.equal(sin.sin_pronostico, cats.length - publicadas.length);
});

test('textosPanorama: titular, tarjeta, párrafo y anillo sin decir «publicados» para todas', async () => {
  const { textosPanorama, numeroEnPalabras } = await imp('assets/boletin/textos.mjs');
  const t = textosPanorama(data, doc);
  const P = publicadas.length, E = cats.length - P, N = new Set(publicadas.map((e) => e.platform_id)).size;
  assert.equal(t.con_pronostico, String(cats.length));
  assert.equal(t.con_pronostico_palabras, numeroEnPalabras(cats.length, { mayuscula: true }));
  assert.equal(t.tarjeta_pronostico_detalle, `De ${cats.length}: ${P} con pronóstico publicado; ${E} con pronóstico exploratorio, no validado`);
  assert.ok(t.panorama_resumen.startsWith(`${N} padecimientos publicados cubren ${P} categorías del boletín.`), t.panorama_resumen);
  assert.ok(t.panorama_resumen.includes(`Las ${E} restantes no tienen modelo validado`), t.panorama_resumen);
  assert.ok(t.panorama_resumen.includes('pronóstico exploratorio, no validado, que no es un pronóstico de EpiForecast-MX'), t.panorama_resumen);
  assert.doesNotMatch(t.panorama_resumen, /agenda por ampliar/);
  assert.match(t.anillo_estilo, /^--publicado:[\d.]+%;--con-pronostico:100%$/);
  assert.ok(t.anillo_aria.startsWith(`${cats.length} de ${cats.length} categorías con pronóstico: ${P} con pronóstico publicado`), t.anillo_aria);
  assert.ok(t.anillo_aria.includes(`y ${E} con pronóstico exploratorio, no validado`), t.anillo_aria);
  // Sin exploratorio: el titular baja a lo publicado y el párrafo no promete pronóstico a las restantes.
  const s = textosPanorama(data, null);
  assert.equal(s.con_pronostico, String(P));
  assert.match(s.tarjeta_pronostico_detalle, new RegExp(`; ${E} sin pronóstico$`));
  assert.doesNotMatch(s.panorama_resumen, /exploratorio/);
  assert.match(s.anillo_estilo, /--con-pronostico:[\d.]+%$/);
  assert.doesNotMatch(s.anillo_estilo, /--con-pronostico:100%/);
});

test('boletin.html: el respaldo estático de la huella coincide con lo calculado y el anillo tiene dos segmentos accesibles', async () => {
  const { textosRadar } = await imp('assets/boletin/textos.mjs');
  const t = textosRadar(data, actual, historia, doc);
  const html = leer('boletin.html');
  const panel = html.slice(html.indexOf('HUELLA DE LA PLATAFORMA'), html.indexOf('class="coverage-foot"'));
  assert.doesNotMatch(panel, /Una agenda por ampliar/);
  assert.doesNotMatch(panel, /PUBLICADOS/);
  assert.match(panel, /<h2><span data-radar="con_pronostico_palabras">[^<]+<\/span> categorías con pronóstico\.<\/h2>/);
  assert.match(panel, /<small>CON PRONÓSTICO<\/small>/);
  const ring = panel.match(/<div class="ring"[^>]*>/)?.[0];
  assert.ok(ring, 'anillo');
  assert.match(ring, /role="img"/);
  assert.equal(unesc(ring.match(/aria-label="([^"]*)"/)[1]), t.anillo_aria);
  assert.equal(ring.match(/style="([^"]*)"/)[1], t.anillo_estilo);
  assert.match(panel, /<li class="ring-legend-publicado"><b><span data-radar="categorias_publicadas">\d+<\/span><\/b> con pronóstico publicado<\/li>/);
  assert.match(panel, /<li class="ring-legend-exploratorio"><b><span data-radar="exploratorias">\d+<\/span><\/b> con pronóstico exploratorio, no validado<\/li>/);
  assert.match(panel, /<a href="no_modelables\.html" class="text-link">Ver las categorías sin modelo validado →<\/a>/);
  for (const [, k, v] of panel.matchAll(/<span data-radar="([^"]+)">([^<]*)<\/span>/g)) assert.equal(unesc(v), t[k], k);
  const css = leer('assets/boletin/radar.css');
  assert.match(css, /\.ring\{[^}]*conic-gradient\(var\(--ring-publicado\) 0 var\(--publicado,0%\)[^}]*var\(--ring-exploratorio\) 0 var\(--con-pronostico,0%\)/);
});

test('boletin_semana_activa.py reescribe aria-label y style del anillo desde los datos', () => {
  const py = `
import json, sys
sys.path.insert(0, 'scripts')
import boletin_semana_activa as b
from pathlib import Path
html = open('boletin.html', encoding='utf-8').read()
viejo = html.replace('--con-pronostico:100%', '--con-pronostico:1%').replace('role="img" data-radar-aria="anillo_aria" aria-label="', 'role="img" data-radar-aria="anillo_aria" aria-label="viejo ')
assert viejo != html
v = b.calcular(Path('.').resolve())
nuevo, faltan = b.sincronizar_html(viejo, v['textos'], v['enlaces'])
print(json.dumps({'igual': nuevo == html, 'faltan': faltan}))
`;
  const r = JSON.parse(execFileSync('python3', ['-c', py], { cwd: root, encoding: 'utf8' }));
  assert.deepEqual(r, { igual: true, faltan: [] });
  assert.match(leer('scripts/boletin_semana_activa.py'), /pronostico_exploratorio\.json/);
});

/** DOM mínimo para correr radar.js en node, con fetch servido desde el disco. */
async function bootRadar() {
  const byId = new Map();
  const el = (id) => {
    if (!byId.has(id)) {
      const attrs = {};
      byId.set(id, { id, hidden: false, value: { chartMetric: 'cumulative', sort: 'cumulative' }[id] ?? '', disabled: false, innerHTML: '', textContent: '',
        setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return attrs[k] ?? null; },
        addEventListener() {}, close() {}, showModal() {}, getBoundingClientRect: () => ({}) });
    }
    return byId.get(id);
  };
  const saved = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, err: console.error };
  globalThis.window = { radarHistoria: historia };
  globalThis.document = { getElementById: el, querySelectorAll: () => [], addEventListener() {} };
  globalThis.fetch = async (url) => {
    const rel = String(url).replace(/^\//, '').replace(/\?.*$/, '');
    return { ok: true, json: async () => JSON.parse(leer(rel)) };
  };
  const errores = [];
  console.error = (e) => { if (e instanceof Error) errores.push(e); };
  await import(`${pathToFileURL(resolve(root, 'assets/boletin/radar.js')).href}?t=${Math.random()}`);
  await new Promise((r) => setTimeout(r, 150));
  Object.assign(globalThis, { document: saved.document, window: saved.window, fetch: saved.fetch });
  console.error = saved.err;
  return { el, errores };
}

test('radar.js: la cuarta tarjeta es «Categorías con pronóstico» con su desglose; se conserva «Padecimientos publicados»', async () => {
  const { textosPanorama } = await imp('assets/boletin/textos.mjs');
  const t = textosPanorama(data, doc);
  const { el, errores } = await bootRadar();
  assert.deepEqual(errores, []);
  const m = el('metrics').innerHTML;
  assert.doesNotMatch(m, /sin cobertura/);
  assert.ok(m.includes(`<div class="metric-label">Categorías con pronóstico</div><strong>${Number(t.con_pronostico).toLocaleString('es-MX')}</strong><small>${t.tarjeta_pronostico_detalle}</small>`), m);
  assert.match(m, new RegExp(`<div class="metric-label">Padecimientos publicados</div><strong>${new Set(publicadas.map((e) => e.platform_id)).size}</strong>`));
  assert.equal(el('metrics').getAttribute('aria-busy'), 'false');
});

test('EpiBot: la línea de cobertura dice lo mismo, sin cifras del exploratorio más allá del conteo', async () => {
  const { compactaRadar, resumenRadar } = await imp('epibot/js/radar_boletin.js');
  const P = publicadas.length, E = cats.length - P;
  const r = resumenRadar(compactaRadar(actual, data, doc));
  assert.doesNotMatch(r, /sin cobertura/);
  assert.ok(r.includes(`- Categorías con pronóstico: **${cats.length} de ${cats.length}**: ${P} con pronóstico publicado y ${E} con pronóstico exploratorio, no validado, que no es un pronóstico de EpiForecast-MX.`), r);
  assert.doesNotMatch(r, /referencia estacional|media de la misma semana|valor plano/, 'sin método ni cifras del exploratorio');
  // Sin el exploratorio no presume cobertura total.
  const s = resumenRadar(compactaRadar(actual, data, null));
  assert.ok(s.includes(`- Categorías sin pronóstico publicado: **${E}**`), s);
  assert.doesNotMatch(s, /exploratorio/);
});
