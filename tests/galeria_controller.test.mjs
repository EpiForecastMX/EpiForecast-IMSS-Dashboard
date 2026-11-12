// Controlador REAL de la Galería (Reports/galeria.mjs) con DOM simulado (tests/helpers/fake_dom.mjs).
// Reproduce los hallazgos de la auditoría del piloto: carrera de «Todas las series» (A1), caché con
// esquema inválido (A2), catálogo inválido con reintento, error ≠ «0 resultados» (M3), lámina PNG
// que falla (M1) y enlaces de detalle.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FakeDom, okFile, okJson, httpError, deferred, tick } from './helpers/fake_dom.mjs';
import { buildCatalog } from '../scripts/build_dashboard_catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = readFileSync(resolve(root, 'Reports/index.html'), 'utf8');
const DATA = JSON.parse(PAGE.match(/^const DATA = (\[.*\]);$/m)[1]);
const { catalog: CATALOG } = buildCatalog(root);
const CTRL = pathToFileURL(resolve(root, 'Reports/galeria.mjs')).href;
let dom = null;
let n = 0;

/** Arranca una instancia nueva del controlador con las rutas dadas. */
async function boot({ search = '', routes = [] } = {}) {
  dom = new FakeDom({ html: PAGE, search }).install({ GALERIA_LEGACY: [...DATA], REGION_META: {} });
  dom.route('catalog.json', () => okJson(CATALOG));
  dom.route((u) => /publication\/[a-z0-9_]+\/vista\.json$/.test(u), (u) => okFile(root, u.replace(/^\.\.\//, '')));
  dom.route('zoom_data_', (u) => okFile(root, u.replace(/^\.\.\//, '')));
  for (const [t, r] of routes) dom.route(t, r);
  await import(`${CTRL}?caso=${++n}`);
  await tick();
  return dom;
}
afterEach(() => { dom?.uninstall(); dom = null; });

const diseaseButton = (id) => dom.$('gDiseases').querySelectorAll('button').find((b) => b.dataset.p === id);
const vistaHits = (id) => dom.requests.filter((u) => u.endsWith(`publication/${id}/vista.json`)).length;
const label = (id) => CATALOG.diseases.find((d) => d.id === id).label;

test('inicio: sólo el catálogo, 55 padecimientos y ninguna vista', async () => {
  await boot();
  assert.deepEqual(dom.requests, ['../assets/dashboard/catalog.json']);
  assert.equal(dom.$('gDiseases').children.length, 55);
  assert.match(dom.$('gSummary').textContent, /^55 padecimientos · 5,501 series$/);
});

test('A1: elegir un padecimiento mientras carga «Todas las series» no deja que la carga pise la selección', async () => {
  const pend = [];
  await boot({ routes: [[(u) => u.includes('vista.json'), (u) => { const d = deferred(); pend.push([u, d]); return d.promise; }]] });
  dom.$('gAllLoad').click();
  await tick();
  assert.ok(pend.length > 0, 'la lista completa empezó a pedir vistas');
  diseaseButton('asma_j45').click();
  await tick();
  // Llegan todas las respuestas pendientes (de la corrida abandonada y de la selección).
  for (let i = 0; i < 55 && pend.length; i++) { const [u, d] = pend.shift(); d.resolve(okFile(root, u.replace(/^\.\.\//, ''))); await tick(); }
  await tick(20);
  assert.match(dom.location.search, /p=asma_j45/);
  assert.equal(dom.$('gDetailTitle').textContent, label('asma_j45'));
  assert.equal(dom.$('gCatalog').hidden, true);
  assert.equal(dom.$('gAllLoad').disabled, false);
  assert.equal(dom.$('gAllProgress').hidden, true);
  assert.equal(dom.$('gCards').children.length, 1, 'la tarjeta nacional de asma');
});

test('A1: «Atrás» durante la carga tampoco promueve la lista parcial', async () => {
  const pend = [];
  await boot({ search: '?p=obesidad', routes: [[(u) => u.includes('vista.json') && !u.includes('obesidad'), (u) => { const d = deferred(); pend.push([u, d]); return d.promise; }]] });
  dom.$('gBack').click();
  await tick();
  dom.$('gAllLoad').click();
  await tick();
  dom.popstate('?p=obesidad');
  await tick();
  while (pend.length) { const [u, d] = pend.shift(); d.resolve(okFile(root, u.replace(/^\.\.\//, ''))); await tick(); }
  await tick(20);
  assert.equal(dom.$('gDetailTitle').textContent, label('obesidad'));
  assert.notEqual(dom.$('gDetailKicker').textContent, 'Todos los padecimientos');
});

test('A1: «Cancelar» sí conserva lo cargado y lo declara parcial', async () => {
  const pend = [];
  await boot({ routes: [[(u) => u.includes('vista.json'), (u) => { const d = deferred(); pend.push([u, d]); return d.promise; }]] });
  dom.$('gAllLoad').click();
  await tick();
  for (let i = 0; i < 2; i++) { const [u, d] = pend.shift(); d.resolve(okFile(root, u.replace(/^\.\.\//, ''))); await tick(); }
  dom.$('gAllCancel').click();
  while (pend.length) { const [u, d] = pend.shift(); d.resolve(okFile(root, u.replace(/^\.\.\//, ''))); await tick(); }
  await tick(20);
  assert.equal(dom.$('gDetailTitle').textContent, 'Todas las series');
  assert.match(dom.$('gAllStatus').textContent, /^Cancelado: lista parcial\..*sin cargar por cancelación/);
  assert.ok(dom.$('gCards').children.length > 0);
});

test('A2: HTTP 200 con esquema inválido no queda en caché: «Reintentar» vuelve a pedir y muestra la fuente', async () => {
  let calls = 0;
  await boot({ routes: [['publication/obesidad/vista.json', () => (++calls === 1 ? okJson({ schema: 'otra.v9' }) : okFile(root, 'publication/obesidad/vista.json'))]] });
  diseaseButton('obesidad').click();
  await tick(10);
  assert.equal(dom.$('gDetailError').hidden, false);
  assert.doesNotMatch(dom.$('gDetailErrorMsg').textContent, /schema|esquema|HTTP|unified/i, 'mensaje humano');
  dom.$('gDetailRetry').click();
  await tick(10);
  assert.equal(vistaHits('obesidad'), 2);
  assert.equal(dom.$('gDetailError').hidden, true);
  assert.equal(dom.$('gCards').children.length, 1);
});

test('A2: HTTP 503 seguido de éxito, y reintento por padecimiento en la lista completa', async () => {
  let calls = 0;
  await boot({ routes: [['publication/asma_j45/vista.json', () => (++calls === 1 ? httpError(503) : okFile(root, 'publication/asma_j45/vista.json'))]] });
  dom.$('gAllLoad').click();
  await tick(60);
  const li = dom.$('gAllErrors').children.find((x) => x.dataset.p === 'asma_j45');
  assert.ok(li, 'error visible para asma');
  assert.match(dom.$('gAllStatus').textContent, /54 de 55 padecimientos cargados · 1 con error/);
  li.querySelector('button').click();
  await tick(10);
  assert.equal(vistaHits('asma_j45'), 2);
  assert.equal(dom.$('gAllErrors').children.length, 0);
});

test('catálogo inválido con HTTP 200: error humano y «Reintentar» lo vuelve a pedir', async () => {
  let calls = 0;
  dom = null;
  await boot({ routes: [['catalog.json', () => (++calls === 1 ? okJson({ schema: 'roto' }) : okJson(CATALOG))]] });
  assert.equal(dom.$('gCatalogError').hidden, false);
  assert.equal(dom.$('gDiseases').children.length, 0);
  dom.$('gCatalogRetry').click();
  await tick(10);
  assert.equal(calls, 2);
  assert.equal(dom.$('gDiseases').children.length, 55);
});

test('M3: con la fuente fallida no aparece «0 resultados» y los filtros quedan deshabilitados', async () => {
  await boot({ routes: [['publication/obesidad/vista.json', () => httpError(500)]] });
  diseaseButton('obesidad').click();
  await tick(10);
  assert.equal(dom.$('gDetailError').hidden, false);
  assert.equal(dom.$('gCardsEmpty').hidden, true);
  assert.equal(dom.$('gNivel').disabled, true);
  assert.equal(dom.$('gSexo').disabled, true);
  dom.$('gNivel').value = 'estatal';
  dom.$('gNivel').dispatch('change');
  assert.equal(dom.$('gCardsEmpty').hidden, true);
  assert.equal(dom.$('gResultCount').textContent, '');
});

test('M3: si fallan todas las fuentes de la lista completa se informa el error, no un vacío', async () => {
  await boot({ routes: [[(u) => u.includes('vista.json'), () => httpError(503)]] });
  // La cohorte original no usa red: para que «todo falle» se vacía su lista DATA.
  globalThis.GALERIA_LEGACY.length = 0;
  dom.$('gAllLoad').click();
  await tick(80);
  assert.equal(dom.$('gDetailError').hidden, false);
  assert.equal(dom.$('gCardsEmpty').hidden, true);
  assert.match(dom.$('gAllStatus').textContent, /0 de 55 padecimientos cargados · 55 con error/);
});

test('M1: si falla la lámina de Zoom no se sustituye en silencio por el histórico', async () => {
  await boot({ search: '?p=depresion&s=general&t=nacional&grafica=zoom' });
  dom.imgFails.add('Depresión_Nacional_general_zoom.png');
  dom.$('gViews').children.find((b) => b.dataset.view === 'full').click();
  dom.$('gViews').children.find((b) => b.dataset.view === 'zoom').click();
  await tick(10);
  const art = dom.$('gCards').querySelector('article');
  const img = art.querySelector('img');
  assert.match(decodeURI(img.src), /_zoom\.png$/, 'no se cambió a la base');
  assert.equal(img.hidden, true);
  const err = art.querySelector('.g-card__imgerr');
  assert.ok(err, 'aviso visible');
  assert.match(err.textContent, /No se pudo cargar la lámina «Zoom 52 semanas»/);
  const ver = err.querySelectorAll('button').find((b) => b.textContent === 'Ver el histórico');
  ver.click();
  assert.match(decodeURI(img.src), /_general\.png$/);
  assert.match(err.textContent, /Se muestra el histórico en lugar de/);
});

test('enlaces del detalle: todos con href válido, incluida la ficha con caracteres que se codifican', async () => {
  await boot({ search: '?p=obesidad' });
  await tick(10);
  const links = [...dom.$('gDetailLinks').querySelectorAll('a'), ...dom.$('gCards').querySelectorAll('a')];
  assert.ok(links.length >= 4);
  for (const a of links) assert.ok(a.getAttribute('href') && !a.hasAttribute('aria-disabled'), a.textContent);
  const C = await import(pathToFileURL(resolve(root, 'Reports/galeria_core.mjs')).href);
  const href = C.fichaHref({ page: 'obesidad.html' }, "estado|o'higgins (sur)|general");
  assert.equal(href, '../obesidad.html?serie=estado%7Co%27higgins%20%28sur%29%7Cgeneral');
  assert.deepEqual(dom.warnings.filter((w) => w.includes('enlace descartado')), []);
});

test('visor: al navegar se limpia el escenario y la gráfica usa fechas ISO, tooltip exacto y tensión 0', async () => {
  await boot({ search: '?p=obesidad&nivel=estatal' });
  await tick(10);
  dom.$('gCards').querySelector('button').click();
  await tick(10);
  assert.equal(dom.$('gViewer').open, true);
  const chart = dom.charts.at(-1);
  assert.match(chart.cfg.data.labels[0], /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(chart.cfg.data.datasets.every((d) => d.tension === 0));
  const title = chart.cfg.options.plugins.tooltip.callbacks.title([{ label: '2026-11-08' }]);
  assert.match(title, /^semana del 8 nov 2026$/);
  const lbl = chart.cfg.options.plugins.tooltip.callbacks.label({ dataset: { label: 'Pronóstico' }, parsed: { y: 0.4 } });
  assert.equal(lbl, 'Pronóstico: 0.4 casos', 'no se redondea a 0');
  dom.$('gViewerNext').click();
  assert.equal(chart.destroyed, true, 'la gráfica anterior se liberó');
  dom.$('gViewerClose').click();
  assert.equal(dom.$('gViewer').open, false);
  assert.equal(dom.$('gViewerImg').hasAttribute('src'), false);
});

test('catálogo: filtro «Validación» inequívoco y mini-gráficas con el color de lo observado', async () => {
  await boot();
  assert.match(PAGE, /<label for="gStatus">Validación/);
  assert.match(PAGE, /<option value="">Todos los estados de validación<\/option>/);
  assert.match(PAGE, /Mini-gráfica: casos observados, últimas 26 semanas/);
  const lines = dom.$('gDiseases').querySelectorAll('polyline');
  assert.equal(lines.length, 55);
  assert.ok(lines.every((l) => l.getAttribute('stroke') === '#173c33'), 'color de observado, no de pronóstico');
  const chip = dom.$('gDiseases').querySelector('.g-chip');
  assert.ok(chip.textContent.length < 40, 'chip corto');
});

test('detalle: el estado no se duplica', async () => {
  await boot({ search: '?p=obesidad' });
  await tick(10);
  const txt = dom.$('gDetailStatus').textContent;
  assert.equal((txt.match(/Validación prospectiva superada/g) || []).length, 1, txt);
});

test('guarda: un error rezagado de un padecimiento no aparece sobre «Todas las series»', async () => {
  const slow = deferred();
  await boot({ routes: [['publication/obesidad/vista.json', () => slow.promise]] });
  diseaseButton('obesidad').click();
  await tick();
  dom.$('gBack').click();
  await tick();
  dom.$('gAllLoad').click();
  await tick(80);
  slow.resolve(httpError(500)); // la fuente de obesidad falla DESPUÉS
  await tick(20);
  assert.equal(dom.$('gDetailTitle').textContent, 'Todas las series');
  assert.equal(dom.$('gDetailError').hidden, true, 'el error de obesidad no pisa la lista');
});

test('«Atrás» con el visor abierto en «Todas» cierra el visor antes de cambiar de fuente', async () => {
  await boot();
  dom.$('gAllLoad').click();
  await tick(80);
  dom.$('gCards').querySelector('button').click();
  await tick(10);
  assert.equal(dom.$('gViewer').open, true);
  dom.popstate('?p=obesidad');
  await tick(20);
  assert.equal(dom.$('gViewer').open, false);
  assert.equal(dom.$('gDetailTitle').textContent, label('obesidad'));
  // Las flechas del visor ya no operan sobre una lista vaciada.
  assert.doesNotThrow(() => dom.$('gViewerNext').click());
});
