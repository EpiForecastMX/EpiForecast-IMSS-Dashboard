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
  // Orden del autor (24-nov-2026): el titular destaca lo publicado; lo exploratorio va aparte y rotulado.
  assert.match(panel, /<h2><span data-radar="categorias_publicadas_palabras">[^<]+<\/span> categorías con pronóstico publicado\.<\/h2>/);
  assert.match(panel, /<p class="ring-sub">Más <span data-radar="exploratorias">\d+<\/span> con pronóstico exploratorio, no validado: <span data-radar="con_pronostico">\d+<\/span> de <span data-radar="categorias_total">\d+<\/span> tienen la opción «Pronóstico»\.<\/p>/);
  assert.match(panel, /<span data-radar="categorias_publicadas">\d+<\/span><small>PRONÓSTICO PUBLICADO<\/small>/);
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

/** Elementos del respaldo estático de boletin.html (data-radar, data-radar-aria, data-radar-estilo). */
function estaticos() {
  const html = leer('boletin.html');
  const mk = (attrs, text = '') => ({ dataset: attrs.dataset, textContent: unesc(text), _a: attrs.a,
    getAttribute(k) { return this._a[k] ?? null; }, setAttribute(k, v) { this._a[k] = String(v); } });
  const spans = [...html.matchAll(/<span data-radar="([^"]+)">([^<]*)<\/span>/g)].map(([, k, v]) => mk({ dataset: { radar: k }, a: {} }, v));
  const tag = (attr, prop) => [...html.matchAll(new RegExp(`<\\w+\\b[^>]*\\b${attr}="([^"]+)"[^>]*>`, 'g'))].map(([t, k]) => mk({
    dataset: { [prop]: k }, a: { 'aria-label': unesc(t.match(/aria-label="([^"]*)"/)?.[1] ?? ''), style: t.match(/style="([^"]*)"/)?.[1] ?? '' } }));
  return { '[data-radar]': spans, '[data-radar-aria]': tag('data-radar-aria', 'radarAria'), '[data-radar-estilo]': tag('data-radar-estilo', 'radarEstilo') };
}

/** DOM mínimo para correr radar.js en node; `exploratorio(rel)` decide la respuesta de pronostico_exploratorio.json. */
async function bootRadar({ exploratorio = null, conEstatico = false, mutar = () => {} } = {}) {
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
  const controles = [{ disabled: false }, { disabled: false }];
  const est = conEstatico ? estaticos() : {};
  if (conEstatico) mutar(est);
  const saved = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, err: console.error };
  globalThis.window = { radarHistoria: historia };
  globalThis.document = {
    getElementById: el, addEventListener() {},
    querySelectorAll: (sel) => (sel.startsWith('.filters') ? controles : est[sel] ?? []),
  };
  globalThis.fetch = async (url) => {
    const rel = String(url).replace(/^\//, '').replace(/\?.*$/, '');
    if (rel.endsWith('pronostico_exploratorio.json') && exploratorio) return exploratorio(rel);
    return { ok: true, json: async () => JSON.parse(leer(rel)) };
  };
  const errores = [];
  console.error = (e) => { if (e instanceof Error) errores.push(e); };
  await import(`${pathToFileURL(resolve(root, 'assets/boletin/radar.js')).href}?t=${Math.random()}`);
  await new Promise((r) => setTimeout(r, 150));
  const restaura = () => { Object.assign(globalThis, { document: saved.document, window: saved.window, fetch: saved.fetch }); console.error = saved.err; };
  return { el, errores, controles, est, restaura };
}

test('radar.js: la cuarta tarjeta es «Pronóstico publicado» con lo exploratorio aparte; se conserva «Padecimientos publicados»', async () => {
  const { textosPanorama } = await imp('assets/boletin/textos.mjs');
  const t = textosPanorama(data, doc);
  const { el, errores, restaura } = await bootRadar();
  restaura();
  assert.deepEqual(errores, []);
  const m = el('metrics').innerHTML;
  assert.doesNotMatch(m, /sin cobertura/);
  assert.ok(m.includes(`<div class="metric-label">Pronóstico publicado</div><strong>${Number(t.categorias_publicadas).toLocaleString('es-MX')}</strong><small>${t.tarjeta_publicado_detalle}</small>`), m);
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

// Auditoría Codex (AUDITORIA_PANORAMA.md, media): con e16f974b el radar esperaba al exploratorio antes de pintar nada.
test('exploratorio pendiente: métricas, tabla y controles disponibles; tarjeta y anillo con el respaldo estático', async () => {
  const { textosPanorama } = await imp('assets/boletin/textos.mjs');
  const t = textosPanorama(data, doc);
  const v = await bootRadar({ conEstatico: true, exploratorio: () => new Promise(() => {}) });
  try {
    assert.deepEqual(v.errores, []);
    assert.equal(v.el('loading').hidden, true, 'sin «Cargando…» permanente');
    assert.equal(v.el('metrics').getAttribute('aria-busy'), 'false');
    assert.ok(v.el('rows').innerHTML.includes('<tr>'), 'tabla del catálogo pintada');
    assert.ok(v.controles.every((c) => c.disabled === false), 'controles habilitados');
    const m = v.el('metrics').innerHTML;
    assert.ok(m.includes(`<div class="metric-label">Pronóstico publicado</div><strong>${t.categorias_publicadas}</strong><small>${t.tarjeta_publicado_detalle}</small>`), m);
    const anillo = v.est['[data-radar-aria]'][0];
    assert.equal(anillo.getAttribute('aria-label'), t.anillo_aria);
    assert.equal(v.est['[data-radar-estilo]'][0].getAttribute('style'), t.anillo_estilo);
  } finally { v.restaura(); }
  assert.match(leer('assets/boletin/radar.js'), /new AbortController\(\),t=setTimeout\(\(\)=>ctl\.abort\(\),EXPL_TIMEOUT_MS\)/);
  assert.match(leer('assets/boletin/radar.js'), /const EXPL_TIMEOUT_MS=8000;/);
});

test('exploratorio fallido: queda el respaldo estático coherente, nunca «sin pronóstico» inventado', async () => {
  const { textosPanorama } = await imp('assets/boletin/textos.mjs');
  const t = textosPanorama(data, doc);
  const v = await bootRadar({ conEstatico: true, exploratorio: async () => ({ ok: false, json: async () => null }) });
  try {
    assert.ok(v.el('metrics').innerHTML.includes(`<strong>${t.categorias_publicadas}</strong><small>${t.tarjeta_publicado_detalle}</small>`));
    assert.doesNotMatch(v.el('metrics').innerHTML, /sin pronóstico/);
    assert.match(v.el('forecastCoverage').innerHTML, /No se pudo cargar el pronóstico exploratorio/);
  } finally { v.restaura(); }
});

test('respaldo ausente o incoherente: sólo lo que se sabe sin el exploratorio, y se actualiza al llegar', async () => {
  const { panoramaDesdeRespaldo, textosPanorama } = await imp('assets/boletin/textos.mjs');
  const vacio = { querySelectorAll: () => [] };
  assert.equal(panoramaDesdeRespaldo(vacio, data), null);
  const est = estaticos();
  est['[data-radar]'].find((e) => e.dataset.radar === 'categorias_publicadas').textContent = '999';
  assert.equal(panoramaDesdeRespaldo({ querySelectorAll: (s) => est[s] ?? [] }, data), null, 'no cuadra con la foto');
  const bien = panoramaDesdeRespaldo({ querySelectorAll: (s) => estaticos()[s] ?? [] }, data);
  assert.deepEqual(bien, textosPanorama(data, doc));
  let suelta;
  const v = await bootRadar({ exploratorio: () => new Promise((r) => { suelta = r; }) });
  try {
    const sin = textosPanorama(data, null);
    assert.ok(v.el('metrics').innerHTML.includes(`<strong>${sin.categorias_publicadas}</strong><small>${sin.tarjeta_publicado_detalle}</small>`));
    suelta({ ok: true, json: async () => doc });
    await new Promise((r) => setTimeout(r, 50));
    const con = textosPanorama(data, doc);
    assert.ok(v.el('metrics').innerHTML.includes(`<strong>${con.categorias_publicadas}</strong><small>${con.tarjeta_publicado_detalle}</small>`));
  } finally { v.restaura(); }
});

// Reauditoría Codex (REAUDITORIA_PANORAMA.md, media): con 31983e9a se copiaban del HTML el anillo y su etiqueta.
const estropea = (est) => {
  est['[data-radar-estilo]'][0].setAttribute('style', '--publicado:1%;--con-pronostico:1%');
  est['[data-radar-aria]'][0].setAttribute('aria-label', '0 de 187 categorías con pronóstico.');
  for (const e of est['[data-radar]']) if (e.dataset.radar === 'panorama_resumen') e.textContent = 'texto viejo';
};

test('respaldo: sólo se aceptan los conteos; anillo, etiqueta y textos se recalculan siempre', async () => {
  const { panoramaDesdeRespaldo, textosPanorama } = await imp('assets/boletin/textos.mjs');
  const esperado = textosPanorama(data, doc);
  const est = estaticos();
  estropea(est);
  assert.deepEqual(panoramaDesdeRespaldo({ querySelectorAll: (s) => est[s] ?? [] }, data), esperado);
  // Conteos que no cuadran entre sí: 187 con pronóstico con 0 exploratorias, o un conteo repetido con dos valores.
  for (const [k, v] of [['exploratorias', '0'], ['con_pronostico', '186'], ['exploratorias', '34']]) {
    const e = estaticos();
    e['[data-radar]'].find((x) => x.dataset.radar === k).textContent = v;
    assert.equal(panoramaDesdeRespaldo({ querySelectorAll: (s) => e[s] ?? [] }, data), null, `${k}=${v}`);
  }
  const dup = estaticos();
  dup['[data-radar]'].push({ ...dup['[data-radar]'].find((x) => x.dataset.radar === 'con_pronostico'), textContent: '1' });
  assert.equal(panoramaDesdeRespaldo({ querySelectorAll: (s) => dup[s] ?? [] }, data), null, 'conteo repetido con otro valor');
  // En el radar, con el exploratorio fallido, el anillo estropeado queda corregido desde los conteos.
  const v = await bootRadar({ conEstatico: true, mutar: estropea, exploratorio: async () => ({ ok: false, json: async () => null }) });
  try {
    assert.equal(v.est['[data-radar-estilo]'][0].getAttribute('style'), esperado.anillo_estilo);
    assert.equal(v.est['[data-radar-aria]'][0].getAttribute('aria-label'), esperado.anillo_aria);
    assert.ok(v.el('metrics').innerHTML.includes(`<strong>${esperado.categorias_publicadas}</strong><small>${esperado.tarjeta_publicado_detalle}</small>`));
  } finally { v.restaura(); }
});
