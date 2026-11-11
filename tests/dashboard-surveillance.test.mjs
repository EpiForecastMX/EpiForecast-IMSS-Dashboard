import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sv from '../assets/dashboard/surveillance.mjs';
import { numero } from '../assets/boletin/celdas.mjs';

const root = process.env.DASHBOARD_SOURCE || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));

// ── Fixtures ────────────────────────────────────────────────────────────────
const META = Object.freeze({
  year: 2026, week: 43,
  symbols: { simbolos: { '-': 'no se presentaron casos', 'n.d.': 'información no disponible' }, paginas: [9, 10] },
});
const STATES = n => Array.from({ length: n }, (_, i) => ({ state: `Entidad ${i + 1}`, values: [i, '-', 'n.d.', null] }));
function fixture() {
  return {
    meta: { ...META },
    diseases: [
      { id: 'a', name: 'Enteritis por rotavirus', code: 'A08.0', page: 11, group: 'Prevenibles por vacunación',
        columns: ['Sem.', 'H', 'M', 'Acum. 2025'], totals: [496, '-', 'n.d.', null], states: STATES(32),
        weekly: 13, cumulative: 503, previous: 985, aggregate: false, platform_id: null, status: 'Por incorporar',
        observed_week: 42, cut_text: 'CUADRO 3', score: 77, score_parts: { carga: 9 }, priority: 'Alta' },
      { id: 'b', name: 'Sarampión', code: 'B05', page: 12, group: 'Prevenibles por vacunación',
        columns: ['Sem.', 'Acum. 2025'], totals: ['-', '-'], states: [], weekly: '-', cumulative: '-', previous: '-',
        aggregate: false, platform_id: null, status: 'Por incorporar', observed_week: 43,
        guion: { semantica: 'no_publicado', desde: 2025, nota: 'Cifra no publicada.', evidencia: [] } },
      { id: 'c', name: 'Dengue no grave', code: 'A97.0', page: 30, group: 'Transmitidas por vector',
        columns: ['Sem.'], totals: [5], states: [], weekly: 5, cumulative: 'n.d.', previous: null,
        aggregate: false, platform_id: 'dengue', status: 'Publicada', observed_week: 43 },
      { id: 'd', name: 'Infección respiratoria aguda', code: 'J00', page: 20, group: 'Respiratorias',
        columns: ['Sem.'], totals: [1], states: [], weekly: 1, cumulative: 2, previous: 3,
        aggregate: false, platform_id: 'ira_j00', status: 'Control publicado', observed_week: 43 },
      { id: 'e', name: 'Rechazada X', code: 'X1', page: 21, group: 'Respiratorias',
        columns: ['Sem.'], totals: [1], states: [], weekly: 1, cumulative: 1, previous: 1,
        aggregate: false, platform_id: null, status: 'Rechazada', observed_week: 43 },
      { id: 'agg', name: 'Infecciones intestinales (agregado)', code: 'A00-A09', page: 10, group: 'Intestinales',
        columns: ['Sem.'], totals: [9], states: [], weekly: 9, cumulative: 9, previous: 9,
        aggregate: true, platform_id: null, status: 'Agregado', observed_week: 42 },
    ],
  };
}

// ── Celdas: semántica oficial de celdas.mjs, sin ceros manuales ───────────────
test('cellValue follows celdas.mjs: printed dash is 0 only under default symbology', () => {
  const cats = sv.buildCategories(fixture());
  const a = cats.find(c => c.id === 'a'), b = cats.find(c => c.id === 'b');
  assert.equal(sv.cellValue('-', a, META), 0);
  assert.equal(sv.cellValue('-', b, META), null, 'guion no_publicado no es cero');
  assert.equal(sv.cellValue('n.d.', a, META), null);
  assert.equal(sv.cellValue('s.n.', a, META), null);
  assert.equal(sv.cellValue(null, a, META), null);
  assert.equal(sv.cellValue(undefined, a, META), null);
  assert.equal(sv.cellValue(0, a, META), 0, 'cero impreso es válido');
  assert.equal(sv.cellValue(-3, a, META), -3, 'negativos no se truncan');
  assert.equal(sv.cellValue(Number.NaN, a, META), null);
});

test('cellView keeps the printed text and explains markers', () => {
  const cats = sv.buildCategories(fixture());
  const a = cats.find(c => c.id === 'a'), b = cats.find(c => c.id === 'b');
  const dash = sv.cellView('-', a, META);
  assert.equal(dash.text, '–');
  assert.equal(dash.cls, 'marcador');
  assert.match(dash.meaning, /no se presentaron casos/);
  assert.match(dash.meaning, /p\. 9 y 10/);
  const np = sv.cellView('-', b, META);
  assert.equal(np.cls, 'marcador no-publicado');
  assert.equal(np.value, null);
  assert.match(np.meaning, /no publicada/);
  const blank = sv.cellView(null, a, META);
  assert.equal(blank.text, 'Sin dato');
  assert.equal(blank.value, null);
  const num = sv.cellView(1234, a, META);
  assert.equal(num.cls, '');
  assert.equal(num.meaning, '');
  assert.equal(num.value, 1234);
});

test('category year follows its own cut, not the cover week', () => {
  const meta = { year: 2026, week: 1 };
  assert.equal(sv.categoryYear({ observedWeek: 52 }, meta), 2025);
  assert.equal(sv.categoryYear({ observedWeek: 1 }, meta), 2026);
  assert.equal(sv.categoryYear({ observedWeek: null }, meta), 2026);
  // Un guion «no publicado desde 2026» en un cuadro con corte de 2025 conserva la simbología normal.
  const cat = { observedWeek: 52, guion: { semantica: 'no_publicado', desde: 2026 } };
  assert.equal(sv.cellValue('-', cat, meta), 0);
  assert.equal(sv.cellValue('-', { ...cat, observedWeek: 1 }, meta), null);
});

test('columnYear and measureYear give each cell the year its column refers to', () => {
  const meta = { year: 2026, week: 43 };
  const cat = { observedWeek: 43 };
  assert.equal(sv.columnYear('Acum. 2025', cat, meta), 2025);
  assert.equal(sv.columnYear('Sem. 2025', cat, meta), 2025);
  assert.equal(sv.columnYear('Mediana 2021–2025', cat, meta), 2025);
  assert.equal(sv.columnYear('Sem.', cat, meta), 2026);
  assert.equal(sv.columnYear('H', { observedWeek: 52 }, meta), 2025, 'sin año explícito: año del corte');
  assert.equal(sv.columnYear('Casos 120250', cat, meta), 2026, 'no confunde números largos con años');
  assert.equal(sv.measureYear('weekly', cat, meta), 2026);
  assert.equal(sv.measureYear('cumulative', cat, meta), 2026);
  assert.equal(sv.measureYear('previous', cat, meta), 2025);
  // API de tres argumentos intacta; el cuarto sólo fija el año.
  const g = { guion: { semantica: 'no_publicado', desde: 2026 }, observedWeek: 43 };
  assert.equal(sv.cellValue('-', g, meta), null);
  assert.equal(sv.cellValue('-', g, meta, 2025), 0);
  assert.equal(sv.cellView('-', g, meta, 2025).cls, 'marcador');
  assert.equal(sv.cellView('-', g, meta).cls, 'marcador no-publicado');
});

test('guion no_publicado desde 2025 with a 2025 cut: Acum. 2024 dash is official 0, current 2025 dash is null', () => {
  // Boletín de la semana 1 de 2026 con un cuadro cortado en la semana 52 de 2025.
  const data = {
    meta: { year: 2026, week: 1, symbols: META.symbols },
    diseases: [{
      id: 'g', name: 'Sintética', code: 'Z00', page: 5, group: 'Prueba',
      columns: ['Sem.', 'H', 'M', 'Acum. 2024'], totals: ['-', '-', '-', '-'],
      states: Array.from({ length: 32 }, (_, i) => ({ state: `E${i + 1}`, values: ['-', '-', i, '-'] })),
      weekly: '-', cumulative: '-', previous: '-', aggregate: false, platform_id: null, status: 'Por incorporar',
      observed_week: 52, guion: { semantica: 'no_publicado', desde: 2025, nota: 'n', evidencia: [] },
    }],
  };
  const [cat] = sv.buildCategories(data);
  const meta = data.meta;
  assert.equal(cat.year, 2025);
  // Medidas: semana y acumulado 2025 no publicados; acumulado 2024 con simbología oficial.
  const [w, cu, pr] = sv.measures(cat, meta);
  assert.equal(w.value, null);
  assert.equal(cu.value, null);
  assert.equal(cu.cls, 'marcador no-publicado');
  assert.equal(pr.label, 'Acumulado 2024 al mismo corte');
  assert.equal(pr.year, 2024);
  assert.equal(pr.value, 0);
  assert.equal(pr.cls, 'marcador');
  assert.match(pr.meaning, /no se presentaron casos/);
  // Tabla estatal y totales por columna.
  const row = sv.stateRows(cat, meta)[0];
  assert.deepEqual(row.cells.map(c => c.value), [null, null, 0, 0]);
  assert.deepEqual(sv.totalCells(cat, meta).map(c => c.value), [null, null, null, 0]);
  // Top estatal en la columna elegida.
  assert.equal(sv.topStates(cat, meta, 0).withoutValue, 32);
  const prev = sv.topStates(cat, meta, 3);
  assert.equal(prev.withoutValue, 0);
  assert.ok(prev.rows.every(r => r.value === 0));
  // Pie: cifra no publicada en el año activo y simbología oficial en la columna 2024.
  const cap = sv.dashCaption(cat, meta);
  assert.match(cap, /para 2025, es una cifra no publicada/);
  assert.match(cap, /«Acum\. 2024» \(años anteriores a 2025\) conserva la simbología oficial/);
  // Las celdas originales no se alteran.
  assert.equal(data.diseases[0].states[0].values[3], '-');
  assert.equal(cat.states[0].values[0], '-');
});

test('dashCaption only claims an unpublished figure when guionNoPublicado says so for the active year', () => {
  const meta = { year: 2026, week: 43, symbols: META.symbols };
  const base = { columns: ['Sem.', 'Acum. 2025'], observedWeek: 43 };
  assert.match(sv.dashCaption({ ...base, guion: null }, meta), /simbología lo define como «no se presentaron casos»/);
  // Guion con semántica distinta de no_publicado: simbología oficial.
  assert.match(sv.dashCaption({ ...base, guion: { semantica: 'otra', desde: 2020 } }, meta), /simbología lo define/);
  // desde posterior al año activo: todavía simbología oficial.
  assert.doesNotMatch(sv.dashCaption({ ...base, guion: { semantica: 'no_publicado', desde: 2027 } }, meta), /no publicada/);
  // Sin desde: no publicado en todos los años, sin aclaración de columnas.
  const sinDesde = sv.dashCaption({ ...base, guion: { semantica: 'no_publicado' } }, meta);
  assert.match(sinDesde, /para 2026, es una cifra no publicada/);
  assert.doesNotMatch(sinDesde, /años anteriores/);
  // desde 2025 con columna 2025: todo no publicado, sin aclaración.
  assert.doesNotMatch(sv.dashCaption({ ...base, guion: { semantica: 'no_publicado', desde: 2025 } }, meta), /años anteriores/);
});

// ── Categorías, cobertura y filtros ────────────────────────────────────────
test('buildCategories excludes the aggregate and drops score/priority', () => {
  const cats = sv.buildCategories(fixture());
  assert.deepEqual(cats.map(c => c.id), ['a', 'b', 'c', 'd', 'e']);
  for (const c of cats) {
    assert.ok(!('score' in c) && !('score_parts' in c) && !('priority' in c));
  }
  const a = cats[0];
  assert.equal(a.observedWeek, 42);
  assert.equal(a.year, 2026);
  assert.equal(a.hasStates, true);
  assert.equal(cats[1].hasStates, false);
  assert.deepEqual(cats[1].states, []);
});

test('coverage only links forecasts declared published and present in the catalog', () => {
  const cats = sv.buildCategories(fixture());
  const by = id => cats.find(c => c.id === id).coverage;
  assert.deepEqual(by('c'), { kind: 'con', forecastId: 'dengue', control: false, mismatch: false });
  assert.equal(by('d').kind, 'con');
  assert.equal(by('d').control, true);
  assert.equal(by('e').kind, 'sin');
  assert.equal(by('a').forecastId, null);
  const restricted = sv.buildCategories(fixture(), { publishedIds: new Set(['ira_j00']) });
  const c = restricted.find(x => x.id === 'c').coverage;
  assert.equal(c.kind, 'sin');
  assert.equal(c.forecastId, null);
  assert.equal(c.mismatch, true);
  assert.equal(sv.coverageOf({ platform_id: 'x', status: 'Rechazada' }).kind, 'sin');
  assert.equal(sv.publishedIdsFromCatalog(null), null);
  assert.deepEqual([...sv.publishedIdsFromCatalog({ diseases: [{ id: 'dengue' }, { id: 'obesidad' }] })], ['dengue', 'obesidad']);
});

test('status notes never present radar status as a prospective verdict', () => {
  for (const s of ['Publicada', 'Control publicado', 'Rechazada', 'Por incorporar', 'Otro']) {
    const note = sv.statusNote(s);
    assert.ok(note.length > 20);
    assert.doesNotMatch(note, /alerta|riesgo alto|semáforo/i);
  }
  assert.match(sv.statusNote('Publicada'), /no es un veredicto/i);
  assert.match(sv.statusNote('Control publicado'), /no es una validación en curso/i);
});

test('filterCategories searches without accents, filters and sorts markers last', () => {
  const cats = sv.buildCategories(fixture());
  assert.deepEqual(sv.filterCategories(cats, { query: 'SARAMPION' }).map(c => c.id), ['b']);
  assert.deepEqual(sv.filterCategories(cats, { query: 'a08' }).map(c => c.id), ['a']);
  assert.deepEqual(sv.filterCategories(cats, { query: 'vacunacion rotavirus' }).map(c => c.id), ['a']);
  assert.deepEqual(sv.filterCategories(cats, { group: 'Respiratorias' }).map(c => c.id), ['d', 'e']);
  assert.deepEqual(sv.filterCategories(cats, { coverage: 'con' }).map(c => c.id), ['d', 'c']);
  assert.deepEqual(sv.filterCategories(cats, { territory: 'estatal' }).map(c => c.id), ['a']);
  assert.equal(sv.filterCategories(cats, { territory: 'nacional' }).length, 4);
  // Orden por acumulado: b ('-' no publicado) y c ('n.d.') no valen cero; van al final.
  const byCum = sv.filterCategories(cats, { sort: 'cumulative' }, META).map(c => c.id);
  assert.deepEqual(byCum.slice(0, 3), ['a', 'd', 'e']);
  assert.deepEqual(new Set(byCum.slice(3)), new Set(['b', 'c']));
  assert.deepEqual(sv.filterCategories(cats, { sort: 'pagina' }).map(c => c.page), [11, 12, 20, 21, 30]);
});

test('resolveSelection drops a category filtered out and never retains it', () => {
  const cats = sv.buildCategories(fixture());
  // Reproduce el hallazgo: seleccionada «a» (como Difteria), se escribe «sarampión».
  let selected = 'a';
  let results = sv.filterCategories(cats, { query: 'sarampión' });
  selected = sv.resolveSelection(results, selected);
  assert.equal(selected, 'b', 'pasa a la primera categoría que queda');
  // Conserva la selección si sigue en los resultados, aunque no sea la primera.
  assert.equal(sv.resolveSelection(sv.filterCategories(cats, { group: 'Respiratorias' }), 'e'), 'e');
  // Grupo, cobertura y territorio aplican la misma regla.
  assert.equal(sv.resolveSelection(sv.filterCategories(cats, { group: 'Respiratorias' }), 'a'), 'd');
  assert.equal(sv.resolveSelection(sv.filterCategories(cats, { coverage: 'con' }), 'a'), 'd');
  assert.equal(sv.resolveSelection(sv.filterCategories(cats, { territory: 'nacional' }), 'a'), 'b');
  assert.equal(sv.resolveSelection(sv.filterCategories(cats, { territory: 'estatal' }), 'a'), 'a');
  // Sin resultados: ninguna selección, no la categoría anterior.
  assert.equal(sv.resolveSelection(sv.filterCategories(cats, { query: 'zzz-no-existe' }), 'a'), null);
  assert.equal(sv.resolveSelection([], null), null);
  // Sin selección previa toma la primera.
  assert.equal(sv.resolveSelection(sv.filterCategories(cats, {}), null), 'a');
});

test('real snapshot: selected Difteria is replaced when searching sarampión', () => {
  const data = read(sv.snapshotPaths(read('assets/boletin/actual.json')).data);
  const cats = sv.buildCategories(data);
  const difteria = cats.find(c => sv.normalizeText(c.name).startsWith('difteria'));
  assert.ok(difteria, 'Difteria existe en la foto vigente');
  const results = sv.filterCategories(cats, { query: 'sarampión' }, data.meta);
  assert.ok(results.length >= 1);
  assert.ok(!results.some(c => c.id === difteria.id));
  const next = sv.resolveSelection(results, difteria.id);
  assert.notEqual(next, difteria.id);
  assert.equal(next, results[0].id);
  assert.match(sv.normalizeText(cats.find(c => c.id === next).name), /sarampion/);
});

test('paginate clamps pages', () => {
  const list = Array.from({ length: 45 }, (_, i) => i);
  assert.deepEqual(sv.paginate(list, 0, 20).items.length, 20);
  const last = sv.paginate(list, 99, 20);
  assert.equal(last.page, 2);
  assert.deepEqual(last.items, [40, 41, 42, 43, 44]);
  assert.equal(last.start, 40);
  assert.equal(last.end, 45);
  assert.equal(sv.paginate([], 3).pages, 1);
});

test('measures label each cut and keep markers', () => {
  const cats = sv.buildCategories(fixture());
  const [w, cu, pr] = sv.measures(cats.find(c => c.id === 'c'), META);
  assert.equal(w.label, 'Semana 43 de 2026');
  assert.equal(cu.label, 'Acumulado 2026 al corte');
  assert.equal(pr.label, 'Acumulado 2025 al mismo corte');
  assert.equal(cu.value, null);
  assert.equal(cu.text, 'n.d.');
  assert.equal(pr.text, 'Sin dato');
  assert.equal(pr.value, null);
});

test('topStates ranks printed counts and never ranks markers as zero', () => {
  const cats = sv.buildCategories(fixture());
  const a = cats.find(c => c.id === 'a');
  const t0 = sv.topStates(a, META, 0, 5);
  assert.equal(t0.column, 'Sem.');
  assert.deepEqual(t0.rows.map(r => r.value), [31, 30, 29, 28, 27]);
  assert.equal(t0.withoutValue, 0);
  const tDash = sv.topStates(a, META, 1);
  assert.equal(tDash.rows.length, 10);
  assert.ok(tDash.rows.every(r => r.value === 0), 'guion con simbología normal vale 0 según celdas.mjs');
  const tNd = sv.topStates(a, META, 2);
  assert.equal(tNd.rows.length, 0);
  assert.equal(tNd.withoutValue, 32);
  assert.equal(sv.topStates(a, META, 3).withoutValue, 32);
  assert.equal(sv.topStates(cats.find(c => c.id === 'b'), META).rows.length, 0, 'sin estados inventados');
  assert.deepEqual(sv.stateRows(cats.find(c => c.id === 'b'), META), []);
});

test('snapshotPaths accepts only safe relative snapshot folders', () => {
  const p = sv.snapshotPaths({ carpeta: 'assets/boletin/2026-w43-r1', pdf: 'sem43.pdf', volumen: 43 });
  assert.deepEqual(p, { carpeta: 'assets/boletin/2026-w43-r1', data: 'assets/boletin/2026-w43-r1/data.json', pdf: 'assets/boletin/2026-w43-r1/sem43.pdf', pdfName: 'sem43.pdf', volumen: 43 });
  assert.equal(sv.snapshotPaths({ carpeta: '/assets/boletin/x/' }).data, 'assets/boletin/x/data.json');
  assert.equal(sv.pdfHref(p, 11), 'assets/boletin/2026-w43-r1/sem43.pdf#page=11');
  assert.equal(sv.pdfHref(p, null), 'assets/boletin/2026-w43-r1/sem43.pdf');
  assert.equal(sv.pdfHref({ pdf: null }, 3), null);
  for (const bad of [null, {}, { carpeta: '../secret' }, { carpeta: 'assets/boletin/../x' }, { carpeta: 'https://evil/x' },
    { carpeta: 'assets/boletin/a/b' }, { carpeta: 'assets/boletin/x', pdf: 'javascript:alert(1)' }]) {
    assert.throws(() => sv.snapshotPaths(bad));
  }
});

test('validateSnapshot fails closed', () => {
  assert.throws(() => sv.validateSnapshot(null));
  assert.throws(() => sv.validateSnapshot({ meta: { year: 2026 }, diseases: [] }));
  const dup = fixture(); dup.diseases.push({ ...dup.diseases[0] });
  assert.throws(() => sv.validateSnapshot(dup), /duplicada/);
  const bad = fixture(); bad.diseases[0].states[3].values = [1];
  assert.throws(() => sv.validateSnapshot(bad), /inconsistente/);
});

test('module import needs no DOM and initSurveillance rejects without root/load', async () => {
  assert.equal(typeof globalThis.document, 'undefined');
  await assert.rejects(sv.initSurveillance({}), /root/);
  await assert.rejects(sv.initSurveillance({ root: { append() {} } }), /load/);
});

// ── Foto vigente real ──────────────────────────────────────────────────────
test('real snapshot: all nonaggregate categories and actual state availability are represented', () => {
  const actual = read('assets/boletin/actual.json');
  const paths = sv.snapshotPaths(actual);
  const data = read(paths.data);
  assert.equal(data.diseases.length, data.meta.categories + data.diseases.filter(d => d.aggregate === true).length);
  const cats = sv.buildCategories(data);
  assert.equal(cats.length, data.diseases.filter(d => !d.aggregate).length);
  assert.equal(cats.length, data.meta.categories);
  const sum = sv.summarizeSurveillance(cats);
  // Denominadores calculados desde la fuente filtrada (sin el agregado), no desde meta.
  const noAgregadas = data.diseases.filter(d => !d.aggregate);
  assert.equal(sum.stateBlocks, noAgregadas.filter(d => d.states.length > 0).length);
  assert.equal(sum.nationalOnly, noAgregadas.filter(d => d.states.length === 0).length);
  // Evidencia del corte vigente (2026-w43-r1): 187 = 180 con 32 entidades + 7 sólo nacionales.
  if (data.meta.pdf_sha256 === 'f24aea9306d95d1489d3a8f373527918db1ae31a9c6a6f6aeab63826842f3c8a') {
    assert.equal(cats.length,187); assert.equal(sum.stateBlocks,180); assert.equal(sum.nationalOnly,7);
  }
  // meta.territorial_blocks (181) cuenta también el agregado intestinal con tabla estatal.
  assert.equal(data.meta.territorial_blocks, data.diseases.filter(d => d.states.length > 0).length);
  assert.equal(sum.total, sum.withForecast + sum.withoutForecast);
  for (const c of cats) {
    assert.ok(c.page > 0, `${c.id} sin página`);
    assert.equal(sv.pdfHref(paths, c.page), `${paths.pdf}#page=${c.page}`);
    if (c.hasStates) {
      assert.equal(c.states.length, 32, c.id);
      assert.equal(sv.stateRows(c, data.meta).length, 32);
    } else {
      assert.equal(c.states.length, 0, c.id);
      assert.equal(sv.topStates(c, data.meta).rows.length, 0);
    }
    const raw = data.diseases.find(d => d.id === c.id);
    assert.equal(c.observedWeek, raw.observed_week ?? null, 'cada categoría conserva su corte');
    for (const m of sv.measures(c, data.meta)) {
      const year = m.key === 'previous' ? c.year - 1 : c.year;
      assert.equal(m.year, year);
      assert.equal(m.value, numero(raw[m.key], raw.guion ?? null, year), `${c.id}.${m.key}`);
    }
  }
  assert.ok(cats.some(c => c.observedWeek !== data.meta.week), 'hay cortes distintos de la portada');
  assert.equal(new Set(sv.groupsOf(cats).map(g => g.group)).size, sum.groups);
});

test('real snapshot: published coverage matches the dashboard publication set', () => {
  const data = read(sv.snapshotPaths(read('assets/boletin/actual.json')).data);
  const pub = read('publication/catalog.json');
  const members = JSON.stringify(pub).match(/"disease_id":"[^"]+"/g) ?? [];
  const ids = new Set(members.map(m => m.slice('"disease_id":"'.length, -1)));
  for (const legacy of ['depresion', 'parkinson', 'alzheimer', 'dengue']) ids.add(legacy);
  const cats = sv.buildCategories(data, { publishedIds: ids });
  const con = cats.filter(c => c.coverage.kind === 'con');
  assert.ok(cats.every(c => !c.coverage.mismatch), 'todo platform_id publicado existe en el catálogo');
  assert.equal(new Set(con.map(c => c.coverage.forecastId)).size, data.meta.platform_published);
  for (const c of cats) {
    if (c.coverage.kind === 'con') assert.ok(sv.PUBLISHED_STATUSES.includes(c.status));
    else assert.equal(c.coverage.forecastId, null, 'sin pronóstico inventado');
  }
  assert.ok(cats.some(c => c.status === 'Rechazada' && c.coverage.kind === 'sin'));
});

test('real snapshot: per-column years leave every value of the 187 categories unchanged', () => {
  const data = read(sv.snapshotPaths(read('assets/boletin/actual.json')).data);
  const meta = data.meta;
  const cats = sv.buildCategories(data);
  assert.equal(cats.length, data.diseases.filter(d => !d.aggregate).length);
  let cells = 0;
  for (const c of cats) {
    const g = c.guion ?? null, y = sv.categoryYear(c, meta);
    const old = v => numero(v, g, y); // comportamiento anterior: año del corte para todo
    for (const m of sv.measures(c, meta)) { assert.equal(m.value, old(c[m.key]), `${c.id}.${m.key}`); cells++; }
    sv.stateRows(c, meta).forEach((r, i) => r.cells.forEach((cell, j) => {
      assert.equal(cell.value, old(c.states[i].values[j]), `${c.id}/${r.state}/${c.columns[j]}`); cells++;
    }));
    sv.totalCells(c, meta).forEach((cell, j) => { assert.equal(cell.value, old(c.totals[j]), `${c.id}/total/${c.columns[j]}`); cells++; });
    for (let k = 0; k < c.columns.length && c.hasStates; k++) {
      const top = sv.topStates(c, meta, k, 32);
      const expected = c.states.map(s => old(s.values[k])).filter(v => v !== null).length;
      assert.equal(top.rows.length, expected, `${c.id}/top/${c.columns[k]}`);
    }
  }
  assert.ok(cells > cats.length * 3);
});

test('real snapshot: guion no_publicado cells are never zero', () => {
  const data = read(sv.snapshotPaths(read('assets/boletin/actual.json')).data);
  const cats = sv.buildCategories(data).filter(c => c.guion?.semantica === 'no_publicado');
  assert.ok(cats.length > 0);
  for (const c of cats) {
    for (const row of sv.stateRows(c, data.meta)) {
      for (const cell of row.cells) if (cell.text === '–') assert.equal(cell.value, null, c.id);
    }
  }
});
