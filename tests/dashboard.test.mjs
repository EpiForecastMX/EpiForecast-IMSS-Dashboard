// Pruebas del tablero: node --test tests/
// Con DASHBOARD_SOURCE=/ruta/al/repo/Dashboard se validan además los JSON reales (sólo lectura).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ESTADOS, PADECIMIENTOS, SEXOS, normName, slugify, entityInfo, parseKey, buildIndex,
  resolveTerritory, normalizeSeries, getSeries, faseDe, buildRows, applyWindow, summarize,
  computeKpis, motorDistribution, rankEstados, quantileThresholds, bucketOf, niceTicks,
  formatInt, formatValue, formatDate, csvField, toCSV, CSV_COLUMNS, csvFilename,
  filterByFase, paginate, PAGE_SIZES, FASE_FILTROS,
  parseState, serializeState, DEFAULT_STATE, isSafePath, normalizeMap, knowledgeLookup,
  createCachedLoader, createLatest, COHORTS,
} from '../assets/dashboard/data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Fixtures ────────────────────────────────────────────────────────────────
// 10 semanas: corte tras la 5.ª (2026-08-31), última observación en la 7.ª (2026-09-14).
const D = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31',
  '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'];
function entry(motor, r, y, extra = {}) {
  return {
    motor, intervalo_disponible: false, intervalo_nivel_nominal: null, d: D, r, y,
    lo: D.map(() => null), hi: D.map(() => null), last_real: '2026-09-14',
    corte_modelo: { anio: 2026, semana: 37 }, ultima_semana_boletin: { anio: 2026, semana: 43 },
    ds_corte: '2026-08-31', ...extra,
  };
}
const R = [5, 0, null, -2, 4, 6, 3, null, null, null];
const Y = [9, 9, 9, 9, 9, 7, 8, 10, null, 12];

const NEURO = {
  'Depresión/Nacional/Depresión_Nacional_general.png': entry('Ensemble', [100, 90, 80, 70, 60, 50, 40, null, null, null], [1, 1, 1, 1, 1, 55, 45, 35, 25, 15]),
  'Depresión/Nacional/Depresión_Nacional_hombres.png': entry('Prophet', R, Y),
  'Depresión/Nacional/Depresión_Nacional_mujeres.png': entry('Stacking', R, Y),
  'Depresión/Jalisco/Depresión_Jalisco_general.png': entry('Stacking', R, Y),
  'Depresión/Jalisco/Depresión_Jalisco_hombres.png': entry('Stacking', R, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]),
  'Depresión/México/Depresión_México_general.png': entry('Prophet', R, [0, 0, 0, 0, 0, 100, 100, 100, 100, 100]),
  'Depresión/Ciudad_de_México/Depresión_Ciudad_de_México_general.png': entry('Ensemble', R, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  'Depresión/Region_Rural_-_dispersa/Depresión_Region_Rural_-_dispersa_general.png': entry('DeepAR', R, Y),
  'Parkinson/Jalisco/Parkinson_Jalisco_general.png': entry('Prophet', R, Y),
  'Depresión/Jalisco/basura.png': entry('X', R, Y),
};
const DENGUE = {
  'dengue/Nacional/Dengue_Nacional_general.png': entry('DeepAR', R, Y),
  'dengue/Estado_de_México/Dengue_Estado_de_México_general.png': entry('Prophet', R, Y),
};

const seriesOf = (raw, pad, slug, sexo) => getSeries(raw, buildIndex(raw, pad), slug, sexo);

// ── Catálogos y nombres ─────────────────────────────────────────────────────
describe('catálogos y normalización', () => {
  test('32 entidades únicas con nombres acentuados', () => {
    assert.equal(ESTADOS.length, 32);
    assert.equal(new Set(ESTADOS.map((e) => e.slug)).size, 32);
    assert.ok(ESTADOS.some((e) => e.label === 'Michoacán'));
    assert.ok(ESTADOS.some((e) => e.label === 'Estado de México' && e.slug === 'mexico'));
  });
  test('variantes del Estado de México convergen; CDMX queda aparte', () => {
    for (const v of ['México', 'Mexico', 'Estado_de_México', 'Estado de Mexico']) assert.equal(normName(v), 'mexico');
    assert.equal(slugify('Ciudad_de_México'), 'ciudad-de-mexico');
    assert.equal(slugify('Region_Rural_-_dispersa'), 'region-rural-dispersa');
  });
  test('entityInfo clasifica nacional, estados y regiones', () => {
    assert.deepEqual(entityInfo('Nacional'), { slug: 'nacional', tipo: 'nacional', label: 'Nacional' });
    assert.equal(entityInfo('Nuevo_León').label, 'Nuevo León');
    assert.equal(entityInfo('Region_Sur-Sureste_vulnerable').label, 'Región Sur-Sureste vulnerable');
    assert.equal(entityInfo('Region_Nueva').tipo, 'region');
    assert.equal(entityInfo('Atlántida').tipo, 'otro');
  });
  test('parseKey acepta sólo general/hombres/mujeres', () => {
    assert.deepEqual(parseKey('Depresión/Jalisco/Depresión_Jalisco_hombres.png'), { folder: 'Depresión', entity: 'Jalisco', sexo: 'hombres' });
    assert.equal(parseKey('Depresión/Jalisco/basura.png'), null);
    assert.equal(parseKey('Depresión/Jalisco_general.png'), null);
    assert.equal(parseKey(42), null);
  });
});

describe('índice por padecimiento', () => {
  test('ordena nacional, estados, regiones y no mezcla padecimientos', () => {
    const idx = buildIndex(NEURO, 'depresion');
    assert.deepEqual([...idx.entities.keys()], ['nacional', 'ciudad-de-mexico', 'jalisco', 'mexico', 'region-rural-dispersa']);
    assert.equal(idx.entities.get('mexico').label, 'Estado de México');
    assert.equal(buildIndex(NEURO, 'parkinson').entities.size, 1);
  });
  test('Dengue: Estado_de_México mapea a la misma entidad y no hay regiones', () => {
    const idx = buildIndex(DENGUE, 'dengue');
    assert.ok(idx.entities.has('mexico'));
    assert.deepEqual(resolveTerritory(idx, 'region-rural-dispersa'), { t: 'nacional', fallback: true });
    assert.deepEqual(resolveTerritory(idx, 'mexico'), { t: 'mexico', fallback: false });
  });
  test('padecimiento desconocido o datos vacíos no truenan', () => {
    assert.equal(buildIndex(NEURO, 'zzz').entities.size, 0);
    assert.equal(buildIndex(null, 'depresion').entities.size, 0);
    assert.deepEqual(resolveTerritory(buildIndex({}, 'dengue'), 'nacional'), { t: null, fallback: true });
  });
});

// ── Series y fases ──────────────────────────────────────────────────────────
describe('series, fases y KPIs', () => {
  test('cada sexo es su propia serie (nunca se suman)', () => {
    const g = seriesOf(NEURO, 'depresion', 'nacional', 'general');
    const h = seriesOf(NEURO, 'depresion', 'nacional', 'hombres');
    const m = seriesOf(NEURO, 'depresion', 'nacional', 'mujeres');
    assert.equal(g.motor, 'Ensemble');
    assert.equal(h.motor, 'Prophet');
    assert.notDeepEqual(g.r, h.r.map((v, i) => (v ?? 0) + (m.r[i] ?? 0)));
    assert.equal(seriesOf(NEURO, 'depresion', 'jalisco', 'mujeres'), null);
  });
  test('normalizeSeries conserva 0 y negativos; no finitos pasan a null', () => {
    const s = normalizeSeries(entry('A', [0, -3, NaN, Infinity, '7', null, 1, 1, 1, 1], Y));
    assert.deepEqual(s.r.slice(0, 6), [0, -3, null, null, null, null]);
    assert.equal(normalizeSeries({ d: 'x' }), null);
    assert.equal(normalizeSeries(entry('', R, Y)).motor, 'Sin dato');
  });
  test('fechas inválidas se descartan alineando r/y', () => {
    const s = normalizeSeries({ ...entry('A', [1, 2, 3], [4, 5, 6]), d: ['2026-01-05', 'mal', '2026-01-19'] });
    assert.deepEqual(s.d, ['2026-01-05', '2026-01-19']);
    assert.deepEqual(s.r, [1, 3]);
    assert.deepEqual(s.y, [4, 6]);
  });
  test('faseDe separa corte, ya observado y futuro', () => {
    assert.equal(faseDe('2026-08-31', '2026-08-31', '2026-09-14'), 'observado');
    assert.equal(faseDe('2026-09-07', '2026-08-31', '2026-09-14'), 'verificable');
    assert.equal(faseDe('2026-09-14', '2026-08-31', '2026-09-14'), 'verificable');
    assert.equal(faseDe('2026-09-21', '2026-08-31', '2026-09-14'), 'futuro');
    assert.equal(faseDe('2026-09-21', null, '2026-09-14'), 'observado');
  });
  test('buildRows no presenta "y" previo al corte como pronóstico', () => {
    const rows = buildRows(seriesOf(NEURO, 'depresion', 'jalisco', 'general'));
    assert.deepEqual(rows.slice(0, 5).map((r) => r.pron), [null, null, null, null, null]);
    assert.deepEqual(rows.slice(5).map((r) => r.pron), [7, 8, 10, null, 12]);
    assert.deepEqual(rows.map((r) => r.fase), ['observado', 'observado', 'observado', 'observado', 'observado',
      'verificable', 'verificable', 'futuro', 'futuro', 'futuro']);
  });
  test('KPIs: total posterior al corte con fechas, pasos y nulls', () => {
    const s = seriesOf(NEURO, 'depresion', 'jalisco', 'general');
    const rows = buildRows(s);
    const k = computeKpis(s, rows, rows);
    assert.equal(k.pronostico.sum, 7 + 8 + 10 + 12);
    assert.equal(k.pronostico.n, 4);
    assert.equal(k.pronostico.nNull, 1);
    assert.equal(k.pronostico.first, '2026-09-07');
    assert.equal(k.pronostico.last, '2026-10-05');
    assert.equal(k.pendiente.sum, 22);
    assert.equal(k.pendiente.first, '2026-09-21');
    assert.deepEqual(k.contraste, { weeks: 2, pares: 2, first: '2026-09-07', last: '2026-09-14', real: 9, pron: 15 });
  });
  test('KPIs: observado con negativos sin recorte y 0 como dato', () => {
    const s = seriesOf(NEURO, 'depresion', 'jalisco', 'general');
    const rows = buildRows(s);
    const o = computeKpis(s, rows, rows).observadoVentana;
    assert.equal(o.sum, 5 + 0 - 2 + 4 + 6 + 3);
    assert.equal(o.n, 6);
    assert.equal(o.nNull, 1);
    assert.equal(o.negatives, 1);
    assert.equal(o.last, '2026-09-14');
  });
  test('summarize devuelve null (no 0) si no hay valores', () => {
    const s = summarize([{ date: 'x', v: null }], 'v');
    assert.equal(s.sum, null);
    assert.equal(s.nNull, 1);
    assert.equal(summarize([], 'v').first, null);
  });
  test('ventanas temporales', () => {
    const s = seriesOf(NEURO, 'depresion', 'jalisco', 'general');
    const rows = buildRows(s);
    assert.equal(applyWindow(rows, 'todo', s).length, 10);
    assert.equal(applyWindow(rows, 'observado', s).at(-1).date, '2026-09-14');
    assert.equal(applyWindow(rows, 'pronostico', s)[0].date, '2026-09-07');
    assert.equal(applyWindow(rows, 'reciente', s).length, 10); // menos de 26 semanas disponibles
    const long = { ...s, lastReal: null };
    assert.equal(applyWindow(rows, 'reciente', long)[0].date, '2026-08-03');
  });
});

// ── Agregados de la selección ───────────────────────────────────────────────
describe('motores y ranking', () => {
  test('distribución de motores por sexo, con desglose por tipo', () => {
    const dist = motorDistribution(NEURO, buildIndex(NEURO, 'depresion'), 'general');
    assert.equal(dist.total, 5);
    assert.deepEqual(dist.byTipo, { nacional: 1, estado: 3, region: 1 });
    assert.deepEqual(dist.items.map((i) => [i.motor, i.n]), [['Ensemble', 2], ['DeepAR', 1], ['Prophet', 1], ['Stacking', 1]]);
  });
  test('ranking: sólo las 32 entidades, sin nacional ni regiones; ceros cuentan, faltantes al final', () => {
    const rk = rankEstados(NEURO, buildIndex(NEURO, 'depresion'), 'general', 'pronostico', 'todo');
    assert.equal(rk.length, 32);
    assert.ok(!rk.some((r) => r.slug === 'nacional' || r.slug.startsWith('region')));
    assert.deepEqual(rk.slice(0, 3).map((r) => [r.slug, r.value, r.rank]),
      [['mexico', 500, 1], ['jalisco', 37, 2], ['ciudad-de-mexico', 0, 3]]);
    assert.equal(rk[3].value, null);
    assert.equal(rk[3].rank, null);
  });
  test('ranking observado respeta la ventana', () => {
    const idx = buildIndex(NEURO, 'depresion');
    const todo = rankEstados(NEURO, idx, 'general', 'observado', 'todo').find((r) => r.slug === 'jalisco');
    const pron = rankEstados(NEURO, idx, 'general', 'observado', 'pronostico').find((r) => r.slug === 'jalisco');
    assert.equal(todo.value, 16);
    assert.equal(pron.value, 9);
  });
});

// ── Tabla ───────────────────────────────────────────────────────────────────
describe('tabla: filtro por fase y paginación', () => {
  const s = seriesOf(NEURO, 'depresion', 'jalisco', 'general');
  const rows = buildRows(s);
  test('filtro por fase; valor desconocido devuelve todo', () => {
    assert.equal(filterByFase(rows, 'observado').length, 5);
    assert.equal(filterByFase(rows, 'verificable').length, 2);
    assert.equal(filterByFase(rows, 'futuro').length, 3);
    assert.equal(filterByFase(rows, 'todas').length, 10);
    assert.equal(filterByFase(rows, '__proto__').length, 10);
    assert.deepEqual(FASE_FILTROS.map((f) => f.id), ['todas', 'observado', 'verificable', 'futuro']);
  });
  test('paginación acotada y tamaños permitidos', () => {
    const many = Array.from({ length: 97 }, (_, i) => ({ i }));
    assert.deepEqual(PAGE_SIZES, [12, 24]);
    const p1 = paginate(many, 1, 12);
    assert.deepEqual([p1.page, p1.pages, p1.start, p1.end, p1.rows.length], [1, 9, 0, 12, 12]);
    const last = paginate(many, Infinity, 12);
    assert.deepEqual([last.page, last.start, last.end, last.rows.length], [9, 96, 97, 1]);
    assert.equal(paginate(many, -3, 24).page, 1);
    assert.equal(paginate(many, 'x', 24).pages, 5);
    assert.equal(paginate(many, 1, 50).size, 12);
    const none = paginate([], 4, 24);
    assert.deepEqual([none.page, none.pages, none.total, none.rows.length], [1, 1, 0, 0]);
  });
});

// ── Escalas y formato ───────────────────────────────────────────────────────
describe('escalas y formato', () => {
  test('cuantiles y clases', () => {
    const t = quantileThresholds([1, 2, 3, 4, 5, null, 6, 7, 8, 9, 10], 5);
    assert.equal(t.length, 4);
    assert.equal(bucketOf(1, t), 0);
    assert.equal(bucketOf(10, t), 4);
    assert.equal(bucketOf(null, t), null);
    assert.deepEqual(quantileThresholds([], 5), []);
    assert.deepEqual(quantileThresholds([0, 0, 0], 5), [0]);
  });
  test('niceTicks incluye negativos y casos degenerados', () => {
    const t = niceTicks(-3, 47, 5);
    assert.ok(t[0] <= -3 && t.at(-1) >= 47);
    assert.ok(t.includes(0));
    assert.deepEqual(niceTicks(0, 0), [0, 1]);
    assert.ok(niceTicks(5, 5).length >= 2);
    assert.deepEqual(niceTicks(NaN, 1), [0, 1]);
  });
  test('formato es-MX y null como "sin dato"', () => {
    assert.equal(formatInt(null), 'sin dato');
    assert.equal(formatValue(undefined), 'sin dato');
    assert.equal(formatInt(0), '0');
    assert.match(formatInt(160999), /^160.999$/);
    assert.match(formatDate('2026-08-31'), /31 ago 2026/);
    assert.equal(formatDate(null), 'sin fecha');
  });
});

// ── CSV ─────────────────────────────────────────────────────────────────────
describe('CSV', () => {
  test('escapa comillas, comas y fórmulas; null vacío; negativos intactos', () => {
    assert.equal(csvField(null), '');
    assert.equal(csvField(-2), '-2');
    assert.equal(csvField(0), '0');
    assert.equal(csvField('a,b'), '"a,b"');
    assert.equal(csvField('di "x"'), '"di ""x"""');
    assert.equal(csvField('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(csvField('-abc'), "'-abc");
  });
  test('exporta la ventana con fase, corte y última observación', () => {
    const s = seriesOf(NEURO, 'depresion', 'jalisco', 'general');
    const rows = applyWindow(buildRows(s), 'pronostico', s);
    const csv = toCSV(rows, {
      padecimiento: 'Depresión', territorio: 'Jalisco', sexo: 'General', motor: s.motor,
      corteModelo: s.corteModelo, dsCorte: s.dsCorte, lastReal: s.lastReal, ultimaSemanaBoletin: s.ultimaSemanaBoletin,
    });
    const lines = csv.trimEnd().split('\r\n');
    assert.equal(lines[0], CSV_COLUMNS.join(','));
    assert.equal(lines.length, 1 + 5);
    assert.equal(lines[1], '2026-09-07,pronostico_con_observacion,6,7,Depresión,Jalisco,General,Stacking,2026-W37,2026-08-31,2026-09-14,2026-W43');
    assert.equal(lines[4], '2026-09-28,pronostico_futuro,,,Depresión,Jalisco,General,Stacking,2026-W37,2026-08-31,2026-09-14,2026-W43');
  });
  test('nombre de archivo seguro', () => {
    assert.equal(csvFilename({ p: 'depresion', t: 'ciudad-de-mexico', s: 'general', v: 'todo' }), 'epiforecast_depresion_ciudad-de-mexico_general_todo.csv');
  });
});

// ── URL ─────────────────────────────────────────────────────────────────────
describe('estado en la URL', () => {
  test('valores por defecto y saneamiento', () => {
    assert.deepEqual(parseState(''), { ...DEFAULT_STATE });
    const s = parseState('?p=dengue&s=mujeres&t=<script>&v=zzz&m=observado');
    assert.deepEqual(s, { p: 'dengue', s: 'mujeres', t: 'nacional', v: 'todo', m: 'observado', archivo: false });
  });
  test('ida y vuelta, archivo sólo con valor exacto', () => {
    const st = { p: 'alzheimer', s: 'hombres', t: 'region-urbana-media', v: 'reciente', m: 'pronostico', archivo: true };
    assert.deepEqual(parseState(serializeState(st)), st);
    assert.equal(parseState('?archivo=1').archivo, false);
    assert.ok(!serializeState(DEFAULT_STATE).includes('archivo'));
  });
});

// ── Mapa y EpiBot ───────────────────────────────────────────────────────────
describe('mapa y referencia EpiBot', () => {
  test('isSafePath rechaza contenido no geométrico', () => {
    assert.ok(isSafePath('M1,2L3.5,-4Z m1 1'));
    assert.ok(!isSafePath('M0 0"/><script>'));
    assert.ok(!isSafePath('javascript:alert(1)'));
    assert.ok(!isSafePath(''));
  });
  test('normalizeMap une nombres sin acentos y descarta lo desconocido', () => {
    const m = normalizeMap({ viewbox: '0 0 980 700', states: { Mexico: 'M0,0L1,1Z', 'Ciudad de Mexico': 'M0,0Z', Atlantis: 'M0,0Z', Jalisco: 'bad<' } });
    assert.equal(m.viewBox, '0 0 980 700');
    assert.deepEqual(m.states.map((s) => [s.slug, s.label]), [['mexico', 'Estado de México'], ['ciudad-de-mexico', 'Ciudad de México']]);
    assert.deepEqual(m.unknown, ['Atlantis', 'Jalisco']);
    assert.equal(normalizeMap({ viewbox: '0 0 1 1;x' }).viewBox, null);
  });
  test('knowledgeLookup empata sin acentos y por sexo exacto', () => {
    const kb = { prod_models: [
      { padecimiento: 'Depresion', entidad: 'Mexico', sexo: 'general', modelo_produccion: 'Ensemble', casos_52_semanas_futuro: 14191 },
      { padecimiento: 'Depresion', entidad: 'Mexico', sexo: 'hombres', casos_52_semanas_futuro: 'x' },
    ] };
    assert.deepEqual(knowledgeLookup(kb, 'Depresión', 'Estado de México', 'general'), { value: 14191, motor: 'Ensemble' });
    assert.equal(knowledgeLookup(kb, 'Depresión', 'Estado de México', 'hombres'), null);
    assert.equal(knowledgeLookup(kb, 'Depresión', 'Estado de México', 'mujeres'), null);
    assert.equal(knowledgeLookup(null, 'x', 'y', 'general'), null);
  });
});

// ── Asincronía ──────────────────────────────────────────────────────────────
describe('carga y carreras', () => {
  test('caché comparte la promesa en curso', async () => {
    let calls = 0;
    const load = createCachedLoader(async () => { calls += 1; return { ok: true, json: async () => ({ n: calls }) }; });
    const [a, b] = await Promise.all([load('x.json'), load('x.json')]);
    assert.equal(calls, 1);
    assert.equal(a, b);
    await load('x.json');
    assert.equal(calls, 1);
  });
  test('un fallo no queda en caché: reintentar vuelve a pedir', async () => {
    let calls = 0;
    const load = createCachedLoader(async () => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ ok: 1 }) };
    });
    await assert.rejects(load('y.json'), /HTTP 503/);
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(await load('y.json'), { ok: 1 });
    assert.equal(calls, 2);
  });
  test('errores de red síncronos se vuelven rechazos', async () => {
    const load = createCachedLoader(() => { throw new Error('offline'); });
    await assert.rejects(load('z.json'), /offline/);
  });
  test('createLatest descarta respuestas superadas', () => {
    const latest = createLatest();
    const a = latest.next();
    const b = latest.next();
    assert.equal(latest.isCurrent(a), false);
    assert.equal(latest.isCurrent(b), true);
  });
});

// ── Entregables estáticos ───────────────────────────────────────────────────
describe('entregables', () => {
  test('la experiencia normal no carga recursos de Tableau', async () => {
    const html = await readFile(join(ROOT, 'EpiDashboard.html'), 'utf8');
    assert.doesNotMatch(html, /tableau\.com|viz_v1\.js|tableauPlaceholder|<iframe/i);
    assert.doesNotMatch(html, /\son[a-z]+=/i, 'sin manejadores en línea');
    assert.match(html, /<html lang="es">/);
    assert.match(html, /<h1 id="titulo">Dashboard <em>epidemiológico<\/em><\/h1>/, 'h1 fijo');
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/, 'sin fuentes externas');
    assert.match(html, /id="dash" hidden/, 'el tablero arranca oculto hasta tener datos');
    for (const href of ['index.html', 'Reports/index.html', 'epibot/index.html', 'boletin.html']) assert.ok(html.includes(`href="${href}"`), href);
  });
  test('el controlador no usa innerHTML, eval ni almacenamiento local', async () => {
    const js = await readFile(join(ROOT, 'assets/dashboard/dashboard.mjs'), 'utf8');
    assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|localStorage|document\.write/);
    assert.match(js, /if \(!state\.archivo\) return;/);
    assert.doesNotMatch(js, /KNOWLEDGE_URL|knowledgeLookup|Coincide con/, 'sin comparación con EpiBot');
  });
  test('la hoja de estilos oculta [hidden] aunque otra regla fije display', async () => {
    const css = await readFile(join(ROOT, 'assets/dashboard/dashboard.css'), 'utf8');
    assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
    assert.doesNotMatch(css, /#0E1424|rgba\(14,\s*20,\s*36/i, 'sin fondos oscuros heredados');
  });
});

// ── Datos reales (opcional) ─────────────────────────────────────────────────
const SRC = process.env.DASHBOARD_SOURCE;
describe('datos reales publicados', { skip: !SRC && 'define DASHBOARD_SOURCE para validar los JSON reales' }, () => {
  const readJson = async (rel) => JSON.parse(await readFile(join(SRC, rel), 'utf8'));

  test('cada padecimiento tiene nacional y las 32 entidades en los 3 sexos', async () => {
    const cohorts = { neuro: await readJson(COHORTS.neuro), dengue: await readJson(COHORTS.dengue) };
    for (const pad of PADECIMIENTOS) {
      const raw = cohorts[pad.cohort];
      const idx = buildIndex(raw, pad.id);
      for (const slug of ['nacional', ...ESTADOS.map((e) => e.slug)]) {
        for (const sexo of SEXOS) {
          const s = getSeries(raw, idx, slug, sexo.id);
          assert.ok(s, `${pad.label}/${slug}/${sexo.id}`);
          const rawEntry = raw[idx.entities.get(slug).keys[sexo.id]];
          assert.equal(rawEntry.d.length, rawEntry.r.length, `r alineado ${pad.id}/${slug}/${sexo.id}`);
          assert.equal(rawEntry.d.length, rawEntry.y.length, `y alineado ${pad.id}/${slug}/${sexo.id}`);
          assert.ok(s.dsCorte && s.lastReal, `fechas de corte ${pad.id}/${slug}/${sexo.id}`);
          const steps = buildRows(s).filter((r) => r.fase !== 'observado').length;
          assert.ok(steps <= 52, `${pad.id}/${slug}/${sexo.id}: ${steps} pasos tras el corte`);
        }
      }
    }
  });

  test('el mapa trae las 32 entidades con rutas válidas', async () => {
    const m = normalizeMap(await readJson('mexico_paths.json'));
    assert.ok(m.viewBox);
    assert.equal(m.states.length, 32, `desconocidas: ${m.unknown.join(', ')}`);
  });

  test('diagnóstico: total tras el corte frente a EpiBot (informativo)', async (t) => {
    const kb = await readJson('epibot/knowledge.json');
    const raw = await readJson(COHORTS.neuro);
    let compared = 0, differ = 0;
    for (const pad of PADECIMIENTOS.filter((p) => p.cohort === 'neuro')) {
      const idx = buildIndex(raw, pad.id);
      for (const e of idx.entities.values()) {
        for (const sexo of SEXOS) {
          const s = getSeries(raw, idx, e.slug, sexo.id);
          const ref = s && knowledgeLookup(kb, pad.label, e.label, sexo.id);
          if (!ref) continue;
          const rows = buildRows(s);
          const ours = computeKpis(s, rows, rows).pronostico.sum ?? 0;
          compared += 1;
          if (Math.abs(Math.round(ours) - ref.value) > 1) differ += 1;
        }
      }
    }
    t.diagnostic(`series comparadas: ${compared}; con diferencia mayor a 1: ${differ}`);
    assert.ok(compared > 0);
  });
});
