import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const radarUrl = pathToFileURL(resolve(root, 'assets/boletin/radar.js')).href;

const ENTIDADES_32 = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Coahuila', 'Colima',
  'Chiapas', 'Chihuahua', 'Ciudad de México', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo',
  'Jalisco', 'México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
  'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
  'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];

const SHA_W42 = createHash('sha256').update('SYNTHETIC_FROZEN_W42').digest('hex');
const SHA_W43 = createHash('sha256').update('SYNTHETIC_FROZEN_W43').digest('hex');
const SHA_W44 = createHash('sha256').update('SYNTHETIC_W44_PDF').digest('hex');
const SHA_AUTH = createHash('sha256').update('SYNTHETIC_DECLARED_AUTH_PROVENANCE').digest('hex');
const SHA_DISP = createHash('sha256').update('SYNTHETIC_DISP_FILE_BYTES').digest('hex');

const MARCADORES_PRIVADOS = [
  'SYNTHETIC_AUTHOR_PRIVATE_MARKER',
  'SYNTHETIC_CHAT_ACTA_LITERAL',
  '/Users/synthetic_priv/planes/acta_44.md',
  '2026-11-15T21:14:09-06:00',
  'TEST_ONLY',
  '"decision"',
  '"autor"',
  '"texto_literal"',
  '"enlace_evidencia"',
  '"evidencia_sha256"',
  '"solo_pruebas"',
];

const DOM_IDS = [
  'chartMetric', 'bars', 'chartCaption', 'search', 'group', 'status', 'priority', 'sort',
  'rows', 'resultCount', 'pageInfo', 'prev', 'next', 'detail', 'detailContent', 'closeDetail',
  'priorityCards', 'platformCards', 'nationalRows', 'myiasisIntro', 'myiasisHead', 'myiasisRows',
  'metrics', 'hashes', 'loading', 'error', 'catalogueView', 'nationalView', 'myiasisView',
];

function buildFrozenSnapshot({ week, pdfSha, brokenMiasis = false }) {
  const presentes = ENTIDADES_32.filter((e) => !['Baja California', 'Baja California Sur', 'Sonora'].includes(e));
  const mStates = presentes.map((e, idx) => {
    const state = e === 'México' ? 'Estado de México' : e;
    if (e === 'Chihuahua') {
      return { state, values: [0, 0, 0, 2, 0.3, 0, 1, brokenMiasis ? 1 : 2, 0.2, 0] };
    }
    if (idx === 0) {
      return { state, values: [117, 100, 0, 712, 99.7, 9, 10, 829, 99.8, 9] };
    }
    return { state, values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
  });
  return {
    actual: { carpeta: `assets/boletin/2026-w${week}`, pdf: `sem${week}.pdf`, volumen: 43 },
    data: {
      meta: {
        week, year: 2026, period: '2–8 de noviembre de 2026', publication: '9 de noviembre de 2026',
        checked: '16 de noviembre de 2026', source_url: 'https://www.gob.mx/sem.pdf',
        index_url: 'https://www.gob.mx/salud', pdf_sha256: pdfSha, territorial_blocks: 1,
        national_rows: 1, categories: 1, aggregate_rows: 0, platform_published: 0,
        reconciliation: '1/1 bloques; 32 entidades por bloque; tolerancia cero',
        registry_sha256: 'c'.repeat(64),
        symbols: { simbolos: { '-': 'no se presentaron casos' }, paginas: [9, 10] },
      },
      diseases: [{
        id: 'p14b1', name: 'Cólera', code: 'A00', page: 14, group: 'Intestinales',
        columns: ['Sem.', 'H', 'M', 'Acum. 2025'], totals: [1, 5, '-'],
        states: ENTIDADES_32.map((state, i) => ({ state, values: i === 0 ? [1, 5, '-'] : [0, 0, '-'] })),
        reconciled: true, state_count: 32, weekly: 1, cumulative: 5, previous: '-',
        aggregate: false, platform_id: null, status: 'Por incorporar', source_note: '',
        observed_week: week, cut_text: `Semana ${week}`, variables: ['Casos semanales totales'],
        active_states: 1, score_parts: { carga: 10, afinidad: 10, dispersion: 0.78, crecimiento: 0 },
        score: 20.8, reason: 'Sintético', priority: 'Exploración',
      }],
      national: [{ page: 9, name: 'Cólera', code: 'A00', weekly: 1, cumulative: 5, median: 2, weekly_previous: 1, previous: '-' }],
      myiasis: {
        name: 'Miasis humana confirmada por Cochliomyia hominivorax',
        page: 81, cut: '13 de noviembre de 2026',
        columns: [
          'Casos 2025', '% 2025', 'Defunciones 2025', 'Casos 2026', '% 2026',
          'Defunciones 2026', 'Confirmados últimos 7 días', 'Casos 2025–2026',
          '% total', 'Defunciones totales',
        ],
        totals: [117, 100, 0, 714, 100, 9, 11, 831, 100, 9],
        states: mStates, reclassified_to_discarded: null, notes: [],
      },
    },
    verif: {
      schema: 'boletin_radar.v1', source_pdf_sha256: pdfSha, source_period: `2026-W${week}`,
      checked: '2026-11-16', state_blocks: 1, states_per_block: 32, state_columns_reconciled: true,
    },
  };
}

function buildProjectedW44({ filaRota = { estado: 'Chihuahua', col0: 0, col3: 2, col7_impreso: 1 } } = {}) {
  const snap = buildFrozenSnapshot({ week: 44, pdfSha: SHA_W44, brokenMiasis: true });
  const disc = {
    pdf_sha256: SHA_W44, pagina: 81, cuadro: 'miasis', columna: 7,
    nombre_columna: 'Casos 2025–2026', suma_estados: 830, total_impreso: 831, delta: 1,
    filas_con_identidad_rota: [structuredClone(filaRota)],
    estado: 'NO_RECONCILIADO', celdas_modificadas: 0,
    authorization_sha256: SHA_AUTH, disposition_file_sha256: SHA_DISP,
  };
  snap.data.meta.myiasis_status = 'NO_RECONCILIADO';
  snap.data.myiasis.reconciliation = {
    status: 'NO_RECONCILIADO', columnas_ok: [0, 2, 3, 5, 6, 9], discrepancias: [structuredClone(disc)],
  };
  snap.verif.myiasis_reconciled = false;
  snap.verif.source_discrepancies = [structuredClone(disc)];
  return snap;
}

let seq = 0;
async function bootRadar(actualObj, dataObj) {
  const byId = new Map();
  const makeEl = (id) => {
    const attrs = {};
    let inner = '';
    let text = '';
    const el = {
      id, value: id === 'chartMetric' || id === 'sort' ? 'cumulative' : '',
      disabled: false, hidden: id === 'error', dataset: {},
      classList: { toggle() {}, add() {}, remove() {} },
      get innerHTML() { return inner; },
      set innerHTML(v) { inner = String(v); text = inner.replace(/<[^>]+>/g, ' ').trim(); },
      get textContent() { return text; },
      set textContent(v) { text = String(v); inner = text; },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return attrs[k] ?? null; },
      addEventListener() {}, showModal() {}, close() {},
      getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 }),
    };
    byId.set(id, el);
    return el;
  };
  for (const id of DOM_IDS) makeEl(id);

  const saved = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, err: console.error };
  globalThis.document = {
    getElementById: (id) => byId.get(id) ?? makeEl(id),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  globalThis.window = globalThis;
  globalThis.fetch = async (url) => ({ ok: true, json: async () => (url.endsWith('actual.json') ? actualObj : dataObj) });
  console.error = () => {};
  try {
    await import(`${radarUrl}?fable=${++seq}`);
    await new Promise((r) => setTimeout(r, 25));
    return byId;
  } finally {
    globalThis.document = saved.document;
    globalThis.window = saved.window;
    globalThis.fetch = saved.fetch;
    console.error = saved.err;
  }
}

test('JS-F4: radar.js init() exige W42 y W43-r1 archivadas reales sin existsSync silencioso y aborta mala proyección antes del render', async () => {
  const { verificarMiasis } = await import('../assets/boletin/textos.mjs');
  for (const dir of ['assets/boletin/2026-w42', 'assets/boletin/2026-w43-r1']) {
    const p = resolve(root, dir, 'data.json');
    assert.ok(existsSync(p), `Foto histórica archivada obligatoria ausente: ${dir}/data.json`);
    const diskData = JSON.parse(readFileSync(p, 'utf8'));
    verificarMiasis(diskData);
    const domDisk = await bootRadar({ carpeta: dir, pdf: 'sem.pdf', volumen: 43 }, diskData);
    assert.equal(domDisk.get('error').hidden, true, `${dir} en disco debe renderizar intacto`);
    assert.match(domDisk.get('myiasisIntro').innerHTML, /29 entidades listadas/);
    assert.doesNotMatch(domDisk.get('myiasisIntro').innerHTML, /NO RECONCILIADO|NO_RECONCILIADO/);
  }

  const okW44 = buildProjectedW44();
  const domOk = await bootRadar(okW44.actual, okW44.data);
  assert.equal(domOk.get('error').hidden, true);
  assert.match(domOk.get('myiasisIntro').innerHTML, /Estado NO RECONCILIADO/);
  assert.doesNotMatch(domOk.get('myiasisIntro').innerHTML, /NO_RECONCILIADO/);

  const conDecision = buildProjectedW44();
  conDecision.data.myiasis.reconciliation.discrepancias[0].decision = {
    autor: 'TEST_ONLY SYNTHETIC_AUTHOR_PRIVATE_MARKER',
    texto_literal: 'SYNTHETIC_CHAT_ACTA_LITERAL 2026-11-15T21:14:09-06:00 /Users/synthetic_priv/planes/acta_44.md',
  };
  const sinDispRota = buildFrozenSnapshot({ week: 44, pdfSha: SHA_W44, brokenMiasis: true });
  const n1HorizontalRota = buildFrozenSnapshot({ week: 44, pdfSha: SHA_W44, brokenMiasis: true });
  n1HorizontalRota.data.myiasis.totals[7] = 830;
  const malDelta = buildProjectedW44();
  malDelta.data.myiasis.reconciliation.discrepancias[0].delta = 5;

  for (const [nombre, bad] of [
    ['decision_privada', conDecision],
    ['rota_sin_disp', sinDispRota],
    ['n1_horizontal_rota', n1HorizontalRota],
    ['delta_invalido', malDelta],
  ]) {
    const domBad = await bootRadar(bad.actual, bad.data);
    assert.equal(domBad.get('error').hidden, false, `${nombre} debió activar #error antes de renderizar`);
    assert.equal(domBad.get('myiasisIntro').innerHTML, '', `${nombre} no debe renderizar myiasisIntro`);
    assert.equal(domBad.get('myiasisRows').innerHTML, '', `${nombre} no debe renderizar myiasisRows`);
    assert.equal(domBad.get('rows').innerHTML, '', `${nombre} no debe renderizar catálogo`);
    assert.equal(domBad.get('metrics').innerHTML, '', `${nombre} no debe renderizar métricas`);
    for (const [, el] of domBad.entries()) {
      for (const m of MARCADORES_PRIVADOS) assert.ok(!el.innerHTML.includes(m), `${nombre} filtró ${m}`);
    }
  }
});

test('JS-F6: verificarMiasis compara filas_con_identidad_rota estructuralmente sin depender del orden de claves y rechaza negativos', async () => {
  const { verificarMiasis } = await import('../assets/boletin/textos.mjs');
  const reord = buildProjectedW44({ filaRota: { col7_impreso: 1, col0: 0, estado: 'Chihuahua', col3: 2 } });
  reord.verif.source_discrepancies[0].filas_con_identidad_rota = [{ col3: 2, col7_impreso: 1, estado: 'Chihuahua', col0: 0 }];
  assert.equal(verificarMiasis(reord.data, reord.verif), true);

  for (const mala of [
    { col7_impreso: 2, col0: 0, estado: 'Chihuahua', col3: 2 },
    { col7_impreso: 1, col0: 0, estado: 'Sonora', col3: 2 },
    { col7_impreso: 1, col0: 0, estado: 'Chihuahua', col3: 2, extra: 1 },
    { col7_impreso: 1, estado: 'Chihuahua', col3: 2 },
  ]) {
    const neg = buildProjectedW44({ filaRota: mala });
    assert.throws(() => verificarMiasis(neg.data, neg.verif));
  }
});

test('JS-F8b y N4/N5: conteos enteros sin truncar, porcentaje total 99.9% preservado y simbología HEREDADO explícita', async () => {
  const { filasIdentidadRotaMiasis, notaSimbologiaHeredada, verificarMiasis } = await import('../assets/boletin/textos.mjs');
  assert.throws(
    () => filasIdentidadRotaMiasis([{ state: 'Chihuahua', values: [0.4, 0, 0, 1.7, 0, 0, 0, 2, 0, 0] }], 7),
    /entero/i,
  );
  const conDec = buildFrozenSnapshot({ week: 43, pdfSha: SHA_W43, brokenMiasis: false });
  conDec.data.myiasis.states[0].values[0] = 116.5;
  conDec.data.myiasis.states[1].values[0] = 0.5;
  conDec.data.myiasis.states[0].values[7] = 828.5;
  conDec.data.myiasis.states[1].values[7] = 0.5;
  assert.throws(() => verificarMiasis(conDec.data, conDec.verif), /entero/i);

  const pct999 = buildFrozenSnapshot({ week: 43, pdfSha: SHA_W43, brokenMiasis: false });
  pct999.data.myiasis.totals[8] = 99.9;
  pct999.data.meta.symbols = {
    simbolos: { '-': 'no se presentaron casos' }, paginas: [9, 10],
    origen: 'HEREDADO', heredada_de: { periodo: '2026-W42', pdf_sha256: SHA_W42 },
  };
  assert.equal(verificarMiasis(pct999.data, pct999.verif), true);
  assert.match(notaSimbologiaHeredada(pct999.data.meta.symbols), /HEREDADO.*2026-W42/);
  const domHer = await bootRadar(pct999.actual, pct999.data);
  assert.match(domHer.get('myiasisRows').innerHTML, /99\.9%/);
  assert.match(domHer.get('hashes').textContent, /HEREDADO.*2026-W42/);
  assert.match(domHer.get('nationalRows').innerHTML, /\[HEREDADO de foto 2026-W42\]/);
});
