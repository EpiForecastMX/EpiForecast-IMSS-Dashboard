// Controlador REAL de la vista previa de la portada (home-preview.js → EpiPreview.init) con DOM
// simulado: limpieza al seleccionar y al fallar, reintento tras HTTP y esquema inválido, leyenda con
// el color de la serie y cohorte original caída sin bloquear los releases.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { FakeDom, okFile, okJson, httpError, tick } from './helpers/fake_dom.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const HOME = leer('index.html');
let dom = null;
afterEach(() => { dom = null; });

/** Carga release_catalog.js + home-preview.js en un contexto con el DOM simulado y llama a init. */
async function boot(routes = []) {
  dom = new FakeDom({ html: HOME, path: '/index.html' });
  dom.route('hero_series.json', () => okFile(root, 'hero_series.json'));
  dom.route((u) => /^publication\/[a-z0-9_]+\/vista\.json$/.test(u), (u) => okFile(root, u));
  for (const [t, r] of routes) dom.route(t, r);
  const win = {
    console: { ...console, warn: (...a) => dom.warnings.push(a.map(String).join(' ')) }, Map, Promise, Math, Number, Date, String, Object, Array, JSON,
    document: null, fetch: (u) => dom.fetch(u), matchMedia: () => ({ matches: true }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }), devicePixelRatio: 1,
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, performance: { now: () => 0 },
    addEventListener() {}, setTimeout, clearTimeout,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(leer('epibot/js/release_catalog.js'), win);
  vm.runInContext(leer('home-preview.js'), win); // sin document: sólo define EpiPreview
  win.EpiPreview.init(dom.document, win);
  await tick(10);
  return win;
}
const $ = (id) => dom.$(id);
const meta = () => ['pvEstado', 'pvCorte', 'pvObs', 'pvCasos', 'pvEmision'].map((id) => $(id).textContent);
async function elegir(value) { $('hfSelect').value = value; $('hfSelect').dispatch('change'); await tick(10); }
const hits = (part) => dom.requests.filter((u) => u.includes(part)).length;

test('carga inicial: sólo hero_series.json, 65 opciones y la serie de Depresión pintada', async () => {
  await boot();
  assert.deepEqual(dom.requests, ['hero_series.json']);
  const opts = $('hfSelect').querySelectorAll('option');
  assert.equal(opts.length, 65);
  assert.match($('pvEstado').textContent, /Cohorte original/);
  assert.match($('pvGaleria').href, /p=depresion/);
  assert.equal($('pvFuente').querySelector('a').textContent, 'Datos de la serie (JSON)', 'sin nombre de archivo crudo');
});

test('al fallar una selección no queda nada de la anterior; «Reintentar» tras HTTP 503 vuelve a pedir', async () => {
  let calls = 0;
  await boot([['publication/asma_j45/vista.json', () => (++calls === 1 ? httpError(503) : okFile(root, 'publication/asma_j45/vista.json'))]]);
  await elegir('release:asma_j45');
  assert.deepEqual(meta(), ['—', '—', '—', '—', '—'], 'metadatos limpios');
  assert.equal($('pvGaleria').href, 'Reports/index.html');
  assert.doesNotMatch($('pvGaleria').textContent, /Depresión/);
  assert.equal($('pvState').hidden, false);
  assert.match($('pvState').textContent, /No se pudo cargar esta serie\./);
  assert.doesNotMatch($('pvState').textContent, /HTTP|503/, 'detalle técnico sólo en consola');
  assert.ok(dom.warnings.some((w) => w.includes('503')));
  $('pvState').querySelector('button').click();
  await tick(10);
  assert.equal(hits('asma_j45'), 2);
  assert.match($('pvGaleria').href, /p=asma_j45/);
  assert.equal($('pvState').hidden, true);
});

test('HTTP 200 con esquema inválido tampoco queda en caché', async () => {
  let calls = 0;
  await boot([['publication/obesidad/vista.json', () => (++calls === 1 ? okJson({ schema: 'x' }) : okFile(root, 'publication/obesidad/vista.json'))]]);
  await elegir('release:obesidad');
  assert.equal($('pvState').hidden, false);
  $('pvState').querySelector('button').click();
  await tick(10);
  assert.equal(hits('obesidad'), 2);
  assert.match($('pvEstado').textContent, /Validación prospectiva superada/);
  await elegir('legacy:dengue');
  await elegir('release:obesidad');
  assert.equal(hits('obesidad'), 2, 'el éxito sí queda en caché');
});

test('la leyenda usa el color de la curva de cada serie', async () => {
  const win = await boot();
  const P = win.EpiPreview;
  const color = (k) => P.PALETTE_FALLBACK[P.slotFor(k) - 1];
  assert.equal($('pvFigure').styleProps['--pv-color'], color('depresion'));
  await elegir('release:cancer_mama_c50');
  assert.equal($('pvFigure').styleProps['--pv-color'], color('cancer_mama_c50'));
  assert.notEqual(color('cancer_mama_c50'), color('depresion'));
  assert.match(leer('home.css'), /\.lg--pron \{ border-top: 3px dashed var\(--pv-color\); \}/);
});

test('rótulos: corte y último observado distintos; total con su periodo; emisión legacy «fecha no documentada»', async () => {
  await boot();
  assert.equal($('pvCorteRot').textContent, 'Corte del modelo');
  assert.equal($('pvCorte').textContent, 'semana 37 de 2026');
  assert.equal($('pvObs').textContent, 'semana 43 de 2026');
  assert.match($('pvCasos').textContent, /casos en 52 semanas desde el corte/);
  assert.equal($('pvEmision').textContent, 'fecha no documentada');
  assert.doesNotMatch(HOME, /<dt>Horizonte<\/dt>/);
  assert.match(HOME, /<dt>Total pronosticado<\/dt>/);
});

test('si falla hero_series.json, los releases siguen disponibles y no se pide ninguna vista al cargar', async () => {
  let calls = 0;
  await boot([['hero_series.json', () => (++calls === 1 ? httpError(500) : okFile(root, 'hero_series.json'))]]);
  assert.equal($('hfSelect').disabled, false);
  assert.equal($('hfSelect').querySelectorAll('option').length, 62, '«Elige un padecimiento» + 61 releases');
  assert.equal(hits('vista.json'), 0);
  assert.match($('pvState').textContent, /Elige un padecimiento/);
  assert.equal($('pvCohortError').hidden, false);
  assert.match(HOME, /id="pvCohortError"[^>]*>Las series de la cohorte original/);
  await elegir('release:diabetes_t1');
  assert.match($('pvGaleria').href, /p=diabetes_t1/);
});

test('cohorte caída: opción «Elige un padecimiento» y un «Reintentar» propio que sobrevive al elegir un release', async () => {
  let calls = 0;
  await boot([['hero_series.json', () => (++calls === 1 ? httpError(500) : okFile(root, 'hero_series.json'))]]);
  const first = $('hfSelect').querySelectorAll('option')[0];
  assert.equal(first.textContent, 'Elige un padecimiento');
  assert.equal($('hfSelect').value, '');
  assert.equal($('pvCohortError').hidden, false);
  await elegir('release:asma_j45');
  assert.match($('pvGaleria').href, /p=asma_j45/);
  assert.equal($('pvCohortError').hidden, false, 'el reintento de la cohorte sigue disponible');
  $('pvCohortRetry').click();
  await tick(10);
  assert.equal($('pvCohortError').hidden, true);
  assert.equal($('hfSelect').value, 'release:asma_j45', 'se conserva la selección');
  assert.equal($('hfSelect').querySelectorAll('option').length, 65);
  assert.equal(hits('asma_j45'), 1);
});
