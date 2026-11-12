// Galería por padecimiento (piloto nov-2026): selección, URL, capacidades, fuentes, caché/reintento,
// carga progresiva, pool de gráficas y seguridad del DOM. Usa el catálogo y las vistas reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../Reports/galeria_core.mjs';
import { buildCatalog } from '../scripts/build_dashboard_catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const { catalog } = buildCatalog(root); // determinista, sin escribir
const byId = (id) => catalog.diseases.find((d) => d.id === id);
const PAGE = leer('Reports/index.html');
const DATA = JSON.parse(PAGE.match(/^const DATA = (\[.*\]);$/m)[1]);
const vista = (id) => JSON.parse(leer(`publication/${id}/vista.json`));

// Fixture con un padecimiento de cada clase: validación superada (release), en curso, control,
// cohorte original (legacy) y sin desglose por sexo.
const FIX = {
  pass: catalog.diseases.find((d) => d.status.kind === 'pass'),
  pending: catalog.diseases.find((d) => d.status.kind === 'pending' && d.sexes.length === 3),
  control: catalog.diseases.find((d) => d.status.kind === 'control'),
  legacy: byId('depresion'),
  sinSexo: catalog.diseases.find((d) => d.kind === 'release' && d.sexes.length === 1),
};

test('el fixture cubre pass, pending, control, legacy y un release sin desglose por sexo', () => {
  for (const [k, d] of Object.entries(FIX)) assert.ok(d, k);
  assert.equal(FIX.sinSexo.sexes.join(), 'general');
  assert.equal(catalog.diseases.length, 4 + catalog.diseases.filter((d) => d.kind === 'release').length);
});

test('URL: ida y vuelta con los IDs del dashboard; sin padecimiento no hay parámetros; nunca q', () => {
  const st = { p: FIX.pending.id, s: 'mujeres', t: 'jalisco', nivel: 'nacional', grafica: 'zoom' };
  const url = C.serializeGalleryState(st);
  assert.equal(url, `?p=${FIX.pending.id}&s=mujeres&t=jalisco&grafica=zoom`);
  assert.deepEqual(C.parseGalleryState(url, catalog), { state: st, problems: [] });
  assert.equal(C.serializeGalleryState({ p: null }), '');
  const conQ = C.parseGalleryState(`?p=${FIX.pending.id}&q=jalisco`, catalog);
  assert.equal(conQ.problems.length, 0);
  assert.ok(!C.serializeGalleryState(conQ.state).includes('q='));
  const nivel = C.parseGalleryState(`?p=depresion&nivel=estatal`, catalog).state;
  assert.equal(C.serializeGalleryState(nivel), '?p=depresion&s=general&nivel=estatal');
  // El dashboard recibe la misma selección (p, s, t).
  assert.equal(C.dashboardHref({ p: 'depresion', s: 'hombres', t: 'jalisco' }), '../EpiDashboard.html?vista=explorar&p=depresion&s=hombres&t=jalisco');
});

test('URL inválida: cada parámetro descartado se explica y el estado vuelve a uno válido', () => {
  const desconocido = C.parseGalleryState('?p=covid_19&s=general', catalog);
  assert.equal(desconocido.state.p, null);
  assert.match(desconocido.problems[0].message, /no está en el catálogo publicado/);
  const malo = C.parseGalleryState(`?p=${FIX.sinSexo.id}&s=mujeres&t=<script>&grafica=compare`, catalog);
  assert.equal(malo.state.p, FIX.sinSexo.id);
  assert.equal(malo.state.s, 'general');
  assert.equal(malo.state.t, 'nacional');
  assert.equal(malo.state.grafica, 'full');
  assert.deepEqual(malo.problems.map((p) => p.param).sort(), ['grafica', 's', 't']);
  assert.match(malo.problems.find((p) => p.param === 'grafica').message, /no está disponible/);
  const raro = C.parseGalleryState('?p=depresion&grafica=3d', catalog);
  assert.match(raro.problems[0].message, /no existe/);
});

test('capacidades por origen: legacy 4 vistas; release 2 y las otras deshabilitadas con motivo; sin sexo explicado', () => {
  const lg = C.capabilities(FIX.legacy);
  assert.deepEqual(lg.graficas.filter((g) => g.enabled).map((g) => g.id), ['full', 'zoom', 'zoom5', 'compare']);
  assert.equal(lg.tarjeta, 'png');
  for (const d of [FIX.pass, FIX.pending, FIX.control]) {
    const c = C.capabilities(d);
    assert.deepEqual(c.graficas.filter((g) => g.enabled).map((g) => g.id), ['full', 'zoom']);
    for (const g of c.graficas.filter((x) => !x.enabled)) assert.ok(g.reason && g.reason.length > 20, g.id);
    assert.match(c.intervalo, /sin intervalos/);
  }
  const ss = C.capabilities(FIX.sinSexo);
  assert.equal(ss.sexo.enabled, false);
  assert.match(ss.sexo.reason, /no desglosa/);
  assert.deepEqual(C.capabilities(FIX.pending).sexo.options, ['general', 'hombres', 'mujeres', 'todos']);
});

test('las capacidades no agregan campos: vistas y zoom publicados se leen sin cambios', () => {
  const v = vista(FIX.pending.id);
  const antes = JSON.stringify(v);
  C.releaseSource(FIX.pending, v);
  assert.equal(JSON.stringify(v), antes);
  assert.ok(!('capabilities' in v) && !('graficas' in v));
});

test('cohorte original: todas sus láminas salen de DATA, sin red, y cuadran con el catálogo', () => {
  for (const id of ['depresion', 'parkinson', 'alzheimer', 'dengue']) {
    const src = C.legacySource(byId(id), DATA);
    const n = [...src.entities.values()].reduce((a, e) => a + Object.keys(e.keys).length, 0);
    assert.equal(n, byId(id).nSeries, id);
    assert.ok(src.entities.has('nacional'));
  }
  // Las cuatro vistas de cada lámina existen en disco: ninguna opción habilitada lleva a un PNG roto.
  for (const d of DATA) for (const g of ['full', 'zoom', 'zoom5', 'compare']) assert.ok(existsSync(resolve(root, 'Reports', C.pngFor(d, g))), C.pngFor(d, g));
});

test('release: la vista real da todas sus series con los territorios del dashboard', () => {
  const src = C.releaseSource(FIX.pass, vista(FIX.pass.id));
  const todas = C.listSeries(src, { t: '', nivel: 'todos', s: 'todos' });
  assert.equal(todas.length, FIX.pass.nSeries);
  assert.equal(new Set(todas.map((s) => s.key)).size, todas.length);
  // Por defecto: nacional general, una tarjeta.
  assert.deepEqual(C.listSeries(src).map((s) => [s.slug, s.sexo]), [['nacional', 'general']]);
  // Los 32 estados comparten slug con la cohorte original (mismo territorio, misma URL t).
  const legacy = C.legacySource(byId('depresion'), DATA);
  const est = (s) => new Set([...s.entities.values()].filter((e) => e.tipo === 'estado').map((e) => e.slug));
  assert.deepEqual([...est(src)].sort(), [...est(legacy)].sort());
  assert.equal(est(src).size, 32);
  // Orden: nacional → estados → regiones; General → Hombres → Mujeres.
  const tipos = todas.map((s) => s.tipo);
  assert.equal(tipos.indexOf('estado') > tipos.lastIndexOf('nacional'), true);
  assert.equal(tipos.indexOf('region') > tipos.lastIndexOf('estado'), true);
  assert.deepEqual(todas.slice(0, 3).map((s) => s.sexo), ['general', 'hombres', 'mujeres']);
});

test('sin desglose por sexo: sólo General y ninguna serie se pierde', () => {
  const src = C.releaseSource(FIX.sinSexo, vista(FIX.sinSexo.id));
  const todas = C.listSeries(src, { t: '', nivel: 'todos', s: 'todos' });
  assert.equal(todas.length, FIX.sinSexo.nSeries);
  assert.ok(todas.every((s) => s.sexo === 'general'));
});

test('filtros: nivel, territorio inexistente y búsqueda con tildes igual en ambos carriles', () => {
  const rel = C.releaseSource(FIX.pending, vista(FIX.pending.id));
  const leg = C.legacySource(byId('dengue'), DATA);
  assert.equal(C.listSeries(rel, { t: '', nivel: 'estatal', s: 'general' }).length, 32);
  assert.equal(C.listSeries(leg, { t: '', nivel: 'regional', s: 'general' }).length, 0); // Dengue no tiene regiones
  assert.deepEqual(C.resolveTerritory(rel, 'atlantida'), { t: 'nacional', fallback: true });
  assert.deepEqual(C.resolveTerritory(rel, 'queretaro'), { t: 'queretaro', fallback: false });
  for (const src of [rel, leg]) {
    const a = C.listSeries(src, { t: '', nivel: 'todos', s: 'general', q: 'Querétaro' });
    const b = C.listSeries(src, { t: '', nivel: 'todos', s: 'general', q: 'QUERETARO' });
    assert.equal(a.length, 1);
    assert.deepEqual(a, b);
  }
  assert.ok(C.matchesQuery('Tumor maligno de la próstata (C61)', 'prostata c61'));
  assert.ok(!C.matchesQuery('Diabetes tipo II', 'diabetes tipo i x'));
});

test('caché por URL: dos padecimientos de la misma cohorte comparten un archivo; un fallo se olvida y se reintenta', async () => {
  assert.equal(C.sourceUrl(byId('depresion')), C.sourceUrl(byId('parkinson')));
  assert.notEqual(C.sourceUrl(byId('depresion')), C.sourceUrl(byId('dengue')));
  assert.equal(C.sourceUrl(FIX.pass), `../publication/${FIX.pass.id}/vista.json`);
  let calls = 0;
  let fallar = true;
  const load = C.createCachedLoader(async () => {
    calls += 1;
    if (fallar) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ ok: 1 }) };
  });
  await assert.rejects(load('a.json'), /HTTP 503/);
  fallar = false;
  assert.deepEqual(await load('a.json'), { ok: 1 });
  await load('a.json');
  assert.equal(calls, 2); // el fallo no quedó en caché; el éxito sí
});

test('respuestas viejas: el testigo descarta la selección superada', () => {
  const latest = C.createLatest();
  const a = latest.next();
  const b = latest.next();
  assert.equal(latest.isCurrent(a), false);
  assert.equal(latest.isCurrent(b), true);
});

test('lista completa: progreso por origen, errores sin detener a los demás y cancelación', async () => {
  const entries = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
  const seen = [];
  const r = await C.loadAll(entries, async (e) => { if (e.id === 'c') throw new Error('HTTP 500'); return e.id; },
    { concurrency: 2, onProgress: (p) => seen.push(p) });
  assert.equal(r.ok.size, 4);
  assert.match(r.errors.get('c').message, /500/);
  assert.equal(seen.at(-1).done, 5);
  assert.equal(r.cancelled, false);
  const ac = new AbortController();
  const r2 = await C.loadAll(entries, async (e) => { if (e.id === 'b') ac.abort(); return e.id; }, { concurrency: 1, signal: ac.signal });
  assert.equal(r2.cancelled, true);
  assert.deepEqual([...r2.ok.keys()], ['a', 'b']);
});

test('paginación y pool: nunca más gráficas vivas que el límite; las de lienzos retirados se liberan', () => {
  const pg = C.pageOf(Array.from({ length: 50 }, (_, i) => i), 9);
  assert.deepEqual([pg.page, pg.pages, pg.items.length, pg.items[0]], [3, 3, 2, 48]);
  const destroyed = [];
  const pool = C.createChartPool({ limit: 3, create: (c) => ({ id: c.id }), destroy: (ch) => destroyed.push(ch.id) });
  const cv = Array.from({ length: 5 }, (_, i) => ({ id: i, isConnected: true }));
  cv.slice(0, 3).forEach((c) => pool.request(c));
  pool.request(cv[0]); // uso reciente
  pool.request(cv[3]);
  assert.equal(pool.size, 3);
  assert.deepEqual(destroyed, [1]); // se libera la usada hace más tiempo
  cv[2].isConnected = false;
  pool.sync();
  assert.deepEqual(destroyed, [1, 2]);
  pool.clear();
  assert.equal(pool.size, 0);
});

test('ventanas y bandas: zoom = 52 observadas + horizonte; banda sólo con bandera', () => {
  const src = C.releaseSource(FIX.pass, vista(FIX.pass.id));
  const s = src.item(src.entities.get('nacional').keys.general);
  const z = C.ventana(s, 'zoom');
  const nPron = z.y.filter((v, i) => v != null && z.d[i] > s.ds_corte).length;
  assert.equal(z.d.length, 52 + nPron);
  assert.equal(C.ventana(s, 'full').d.length, s.d.length);
  assert.equal(C.bandaPermitida(s), false); // release: puntual
  const zoomNeuro = JSON.parse(leer('Reports/zoom_data_neuro.json'));
  const conBanda = Object.values(zoomNeuro).find((x) => x.intervalo_disponible === true);
  const sinBanda = Object.values(zoomNeuro).find((x) => x.intervalo_disponible === false);
  assert.equal(C.bandaPermitida(conBanda), true);
  assert.equal(C.bandaPermitida(sinBanda), false);
  assert.equal(C.bandaPermitida({ ...conBanda, intervalo_disponible: false }), false);
});

test('textos: estado literal, emisión nula de la cohorte original sin inventar fecha', () => {
  const f = C.entryFacts(FIX.legacy);
  assert.equal(f.estadoCorto, 'Cohorte original');
  assert.match(f.emision, /no documentada/);
  const p = C.entryFacts(FIX.pending);
  assert.equal(p.estado, FIX.pending.status.label);
  assert.equal(p.estadoCorto, 'Validación prospectiva en curso');
  assert.ok(!/validad[oa]/i.test(C.STATUS_SHORT.control), 'control no se presenta como validado');
  const sum = C.catalogSummary(catalog);
  assert.equal(sum.series, catalog.summary.series);
  assert.equal(sum.legacy.n + sum.release.n, catalog.diseases.length);
});

test('seguridad del DOM: el controlador no interpreta datos como marcado y los href se filtran', () => {
  const ctl = leer('Reports/galeria.mjs');
  assert.doesNotMatch(ctl, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
  assert.doesNotMatch(ctl, /\.oos\b|smape|mase/i);
  assert.match(ctl, /C\.safeHref\(v\)/);
  for (const bad of ['javascript:alert(1)', '//evil.example/x', '../../etc/passwd', 'data:text/html,x']) assert.equal(C.safeHref(bad), null, bad);
  assert.equal(C.safeHref('../obesidad.html?serie=estado%7Cjal%7Cgeneral'), '../obesidad.html?serie=estado%7Cjal%7Cgeneral');
  assert.equal(C.safeHref('../../x.html'), null);
  assert.equal(C.safeHref('../a/../b.html'), null);
  assert.ok(C.safeHref(encodeURI(C.pngFor(DATA.find((d) => d.p === 'Depresión'), 'zoom'))), 'PNG con tilde, codificado');
  // Cada enlace que arma el controlador pasa el filtro (si no, el ancla se quedaría sin href).
  for (const d of catalog.diseases) {
    for (const h of [`../${d.page}`, C.sourceUrl(d), C.dashboardHref({ p: d.id, s: 'general', t: 'nacional' })]) assert.ok(C.safeHref(h), h);
  }
  assert.doesNotMatch(PAGE, /\son[a-z]+="/, 'sin manejadores en línea');
  assert.doesNotMatch(PAGE, /<img[^>]*\ssrc=""/, 'nunca <img src="">');
});

test('contratos conservados: DATA en una línea con 432 láminas, meta-bar y regiones', () => {
  assert.equal((PAGE.match(/^const DATA = \[.*\];$/gm) || []).length, 1);
  assert.equal(DATA.length, 432);
  for (const s of ['Página actualizada: <strong>', 'Datos reales hasta: <strong>semana', 'Período pronosticado: <strong>sem']) assert.ok(PAGE.includes(s), s);
  assert.match(PAGE, /const REGION_META = \{/);
  assert.match(PAGE, /<noscript>[\s\S]*Depresión_Nacional_general\.png[\s\S]*<\/noscript>/);
  for (const href of [...PAGE.matchAll(/<noscript>[\s\S]*?<\/noscript>/g)][0][0].matchAll(/href="([^"#]+)/g)) {
    assert.ok(existsSync(resolve(root, 'Reports', href[1])), href[1]);
  }
});

test('caché: la página precarga exactamente la versión del núcleo que importa el controlador', () => {
  const imp = leer('Reports/galeria.mjs').match(/import \* as C from '\.\/(galeria_core\.mjs\?v=\d+)';/)[1];
  assert.ok(PAGE.includes(`<link rel="modulepreload" href="${imp}">`), imp);
  assert.match(PAGE, /<script type="module" src="galeria\.mjs\?v=\d+"><\/script>/);
});

test('cada id que usa el controlador existe en la página', () => {
  const ids = new Set([...leer('Reports/galeria.mjs').matchAll(/\$\('([A-Za-z]+)'\)/g)].map((m) => m[1]));
  assert.ok(ids.size > 30);
  for (const id of ids) assert.ok(PAGE.includes(`id="${id}"`), id);
});

test('intención de test_obesidad_galeria sobre el código vivo: 111 series, 37 de mujeres, Jalisco en 3 sexos', () => {
  const src = C.releaseSource(byId('obesidad'), vista('obesidad'));
  assert.equal(C.listSeries(src, { t: '', nivel: 'todos', s: 'todos' }).length, 111);
  assert.equal(C.listSeries(src, { t: '', nivel: 'todos', s: 'mujeres' }).length, 37);
  assert.deepEqual(C.listSeries(src, { t: 'jalisco', s: 'todos' }).map((s) => s.sexo), ['general', 'hombres', 'mujeres']);
  assert.equal(C.listSeries(src, { t: '', nivel: 'todos', s: 'todos', q: 'Querétaro' }).length, 3);
});
