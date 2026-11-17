import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const actual = JSON.parse(readFileSync(resolve(root, 'assets/boletin/actual.json'), 'utf8'));
const w43Data = JSON.parse(readFileSync(resolve(root, actual.carpeta, 'data.json'), 'utf8'));
const w43Verif = JSON.parse(readFileSync(resolve(root, actual.carpeta, 'verification.json'), 'utf8'));
const html = readFileSync(resolve(root, 'boletin.html'), 'utf8');
const radarUrl = pathToFileURL(resolve(root, 'assets/boletin/radar.js')).href;

const PDF44_SHA = 'c6b328e4a88c293cbd9b912403b14f8e8a27ab54b780566fc51537b03b52d1a3';
const TEST_EVIDENCE_SHA = createHash('sha256').update('TEST_ONLY_SYNTHETIC_RADAR_UI_FIXTURE').digest('hex');
const DISP_FILE_SHA = createHash('sha256').update('TEST_ONLY_DISPOSITION_FILE_BYTES').digest('hex');

const SYNTHETIC_PRIVATE_MARKERS = [
  'SYNTHETIC_AUTHOR_PRIVATE_MARKER',
  'SYNTHETIC_CHAT_ACTA_LITERAL',
  '/Users/synthetic_priv/planes/acta_44.md',
  '/Users/synthetic_priv/planes/control_privado/ACTA_SYNTHETIC_NO_PUBLICABLE.md',
  '2026-11-15T21:14:09-06:00',
  '2026-11-15',
  'TEST_ONLY',
  '"decision"',
  '"autor"',
  '"texto_literal"',
  '"enlace_evidencia"',
  '"evidencia_sha256"',
  '"solo_pruebas"',
];

const W44_MIASIS_STATES = [
  ['Aguascalientes', [0, 0, 0, 4, 0.6, 0, 0, 4, 0.5, 0]],
  ['Campeche', [4, 3.4, 0, 11, 1.5, 0, 0, 15, 1.8, 0]],
  ['Chiapas', [90, 76.9, 0, 84, 11.8, 0, 1, 174, 20.9, 0]],
  ['Chihuahua', [0, 0, 0, 2, 0.3, 0, 1, 1, 0.1, 0]],
  ['Ciudad de México', [0, 0, 0, 12, 1.7, 0, 0, 12, 1.4, 0]],
  ['Coahuila', [0, 0, 0, 6, 0.8, 0, 0, 6, 0.7, 0]],
  ['Colima', [0, 0, 0, 5, 0.7, 0, 0, 5, 0.6, 0]],
  ['Durango', [0, 0, 0, 2, 0.3, 0, 0, 2, 0.2, 0]],
  ['Guanajuato', [0, 0, 0, 19, 2.7, 0, 0, 19, 2.3, 0]],
  ['Guerrero', [0, 0, 0, 46, 6.4, 0, 3, 46, 5.5, 0]],
  ['Hidalgo', [0, 0, 0, 31, 4.3, 0, 0, 31, 3.7, 0]],
  ['Jalisco', [0, 0, 0, 8, 1.1, 0, 0, 8, 1.0, 0]],
  ['Estado de México', [0, 0, 0, 15, 2.1, 0, 0, 15, 1.8, 0]],
  ['Michoacán', [0, 0, 0, 7, 1.0, 0, 0, 7, 0.8, 0]],
  ['Morelos', [0, 0, 0, 11, 1.5, 0, 2, 11, 1.3, 0]],
  ['Nayarit', [0, 0, 0, 7, 1.0, 1, 0, 7, 0.8, 1]],
  ['Nuevo León', [0, 0, 0, 5, 0.7, 0, 1, 5, 0.6, 0]],
  ['Oaxaca', [4, 3.4, 0, 70, 9.8, 2, 0, 74, 8.9, 2]],
  ['Puebla', [0, 0, 0, 78, 10.9, 1, 0, 78, 9.4, 1]],
  ['Querétaro', [0, 0, 0, 10, 1.4, 1, 1, 10, 1.2, 1]],
  ['Quintana Roo', [6, 5.1, 0, 26, 3.6, 1, 0, 32, 3.9, 1]],
  ['San Luis Potosí', [0, 0, 0, 40, 5.6, 0, 0, 40, 4.8, 0]],
  ['Sinaloa', [0, 0, 0, 7, 1.0, 0, 1, 7, 0.8, 0]],
  ['Tabasco', [2, 1.7, 0, 12, 1.7, 0, 0, 14, 1.7, 0]],
  ['Tamaulipas', [0, 0, 0, 4, 0.6, 0, 0, 4, 0.5, 0]],
  ['Tlaxcala', [0, 0, 0, 3, 0.4, 0, 0, 3, 0.4, 0]],
  ['Veracruz', [1, 0.9, 0, 127, 17.8, 2, 0, 128, 15.4, 2]],
  ['Yucatán', [10, 8.5, 0, 50, 7.0, 1, 0, 60, 7.2, 1]],
  ['Zacatecas', [0, 0, 0, 12, 1.7, 0, 1, 12, 1.4, 0]],
].map(([state, values]) => ({ state, values }));

function buildPrivateLocalInput() {
  return {
    pdf_sha256: PDF44_SHA,
    pagina: 81,
    cuadro: 'miasis',
    columna: 7,
    nombre_columna: 'Casos 2025–2026',
    suma_estados: 830,
    total_impreso: 831,
    delta: 1,
    filas_con_identidad_rota: [{ estado: 'Chihuahua', col0: 0, col3: 2, col7_impreso: 1 }],
    estado: 'NO_RECONCILIADO',
    celdas_modificadas: 0,
    decision: {
      autor: 'TEST_ONLY SYNTHETIC_AUTHOR_PRIVATE_MARKER',
      fecha: '2026-11-15',
      texto_literal: 'TEST_ONLY SYNTHETIC_CHAT_ACTA_LITERAL 2026-11-15T21:14:09-06:00 /Users/synthetic_priv/planes/acta_44.md',
      enlace_evidencia: '/Users/synthetic_priv/planes/control_privado/ACTA_SYNTHETIC_NO_PUBLICABLE.md',
      evidencia_sha256: TEST_EVIDENCE_SHA,
      solo_pruebas: true,
    },
  };
}

function projectToPublic(privateInput, dispositionFileSha256 = DISP_FILE_SHA) {
  const { decision, ...technical } = structuredClone(privateInput);
  return {
    ...technical,
    authorization_sha256: decision.evidencia_sha256,
    disposition_file_sha256: dispositionFileSha256,
  };
}

function buildSyntheticW44({ withDisposition = true, legacyUnprojected = false } = {}) {
  const privateInput = buildPrivateLocalInput();
  const disp = legacyUnprojected ? structuredClone(privateInput) : projectToPublic(privateInput);
  const data = structuredClone(w43Data);
  data.meta.week = 44;
  data.meta.pdf_sha256 = PDF44_SHA;
  data.myiasis = {
    ...data.myiasis,
    page: 81,
    cut: '13 de noviembre de 2026',
    totals: [117, 100, 0, 714, 100, 9, 11, 831, 100, 9],
    states: structuredClone(W44_MIASIS_STATES),
  };
  const verif = { ...structuredClone(w43Verif), source_pdf_sha256: PDF44_SHA, source_period: '2026-W44' };
  if (withDisposition) {
    data.meta.myiasis_status = 'NO_RECONCILIADO';
    data.myiasis.reconciliation = {
      status: 'NO_RECONCILIADO',
      columnas_ok: [0, 2, 3, 5, 6, 9],
      discrepancias: [structuredClone(disp)],
    };
    verif.myiasis_reconciled = false;
    verif.source_discrepancies = [
      legacyUnprojected ? { ...structuredClone(disp), disposition_file_sha256: DISP_FILE_SHA } : structuredClone(disp),
    ];
  }
  return { data, verif, disp, privateInput };
}

function assertNoPrivateMarkers(text, context) {
  for (const marker of SYNTHETIC_PRIVATE_MARKERS) {
    assert.ok(!text.includes(marker), `${context} filtró marcador privado prohibido: ${marker}`);
  }
}

let bootSeq = 0;
async function runRadarDom(dataFixture) {
  const byId = new Map();
  const makeEl = (id = '') => {
    const attrs = {};
    let inner = '';
    let text = '';
    const el = {
      id,
      value: id === 'chartMetric' || id === 'sort' ? 'cumulative' : '',
      disabled: false,
      hidden: false,
      dataset: {},
      classList: { toggle() {}, add() {}, remove() {} },
      get innerHTML() { return inner; },
      set innerHTML(v) { inner = String(v); text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); },
      get textContent() { return text; },
      set textContent(v) { text = String(v); inner = text; },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return attrs[k] ?? null; },
      addEventListener() {},
      showModal() {},
      close() {},
      getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 }),
    };
    if (id) byId.set(id, el);
    return el;
  };
  for (const [, id] of html.matchAll(/\sid="([^"]+)"/g)) if (!byId.has(id)) makeEl(id);

  const saved = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch };
  globalThis.document = {
    getElementById: (id) => byId.get(id) ?? makeEl(id),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  globalThis.window = globalThis;
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => (url.endsWith('actual.json') ? actual : dataFixture),
  });
  try {
    await import(`${radarUrl}?caso=${++bootSeq}`);
    await new Promise((r) => setTimeout(r, 20));
    return byId;
  } finally {
    for (const [k, v] of Object.entries(saved)) globalThis[k] = v;
  }
}

test('JS-1: verificarMiasis exige proyección técnica exacta + SHA64 y rechaza metadatos privados, rutas, tolerancia, sobrantes y otras categorías', async () => {
  const mod = await import('../assets/boletin/textos.mjs');
  assert.equal(typeof mod.verificarMiasis, 'function', 'textos.mjs debe exportar verificarMiasis');

  // Fotos vigentes sin opt-in (W43-r1 y W42 si está presente): reconcilian intactas.
  mod.verificarMiasis(w43Data, w43Verif);
  const w42Dir = resolve(root, 'assets/boletin/2026-w42');
  if (existsSync(resolve(w42Dir, 'data.json'))) {
    const w42Data = JSON.parse(readFileSync(resolve(w42Dir, 'data.json'), 'utf8'));
    const w42Verif = JSON.parse(readFileSync(resolve(w42Dir, 'verification.json'), 'utf8'));
    mod.verificarMiasis(w42Data, w42Verif);
  }

  // W44 sin disposición: 830 != 831 falla cerrado.
  const sinDisp = buildSyntheticW44({ withDisposition: false });
  assert.throws(() => mod.verificarMiasis(sinDisp.data, sinDisp.verif), /830|831|reconcil/i);

  // Formato antiguo "antes" (con decision/autor/fecha/texto_literal/enlace_evidencia públicos): RECHAZADO.
  const antes = buildSyntheticW44({ withDisposition: true, legacyUnprojected: true });
  assert.throws(() => mod.verificarMiasis(antes.data, antes.verif), /privad|prohibid|claves/i);
  assert.throws(() => mod.verificarMiasis(antes.data), /privad|prohibid|claves/i);

  // W44 con proyección pública exacta (sólo campos técnicos + hashes SHA-256): PASA.
  const conDisp = buildSyntheticW44({ withDisposition: true });
  mod.verificarMiasis(conDisp.data, conDisp.verif);
  assertNoPrivateMarkers(JSON.stringify(conDisp.data), 'data proyectado');
  assertNoPrivateMarkers(JSON.stringify(conDisp.verif), 'verification proyectado');

  // Negativos técnicos, de gobernanza y de privacidad (decision/autor/chat/rutas/tolerancia/herencia/otras categorías).
  const mutaciones = [
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].pdf_sha256 = 'a'.repeat(64); },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].pdf_sha256 = PDF44_SHA.slice(0, 40); },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].authorization_sha256 = 'bad'; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].disposition_file_sha256 = DISP_FILE_SHA.slice(0, 40); },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].delta = 2; },
    (x) => { x.data.myiasis.states.find((s) => s.state === 'Chihuahua').values[7] = 2; },
    (x) => { x.data.myiasis.totals[7] = 830; },
    (x) => { x.data.myiasis.reconciliation.status = 'PASS'; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].celdas_modificadas = 1; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].cuadro = 'estatal'; },
    (x) => { x.data.myiasis.reconciliation.tolerancia = 1; },
    (x) => { x.data.myiasis.reconciliation.herencia = true; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].decision = x.privateInput.decision; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].autor = 'SYNTHETIC_AUTHOR_PRIVATE_MARKER'; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].fecha = '2026-11-15'; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].texto_literal = 'SYNTHETIC_CHAT_ACTA_LITERAL'; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].enlace_evidencia = 'planes/acta.md'; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].evidencia_sha256 = TEST_EVIDENCE_SHA; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].solo_pruebas = true; },
    (x) => { x.data.myiasis.reconciliation.discrepancias[0].chat = '2026-11-15T21:14:09-06:00'; },
    (x) => { x.data.meta.disposition_path = '/Users/synthetic_priv/planes/disp.json'; },
    (x) => { x.data.myiasis.notes = ['*Corte tomado de /Users/synthetic_priv/planes/acta_44.md']; },
    (x) => { x.verif.source_discrepancies[0].decision = x.privateInput.decision; },
    (x) => { x.verif.acta = 'SYNTHETIC_CHAT_ACTA_LITERAL'; },
    (x) => { x.verif.warnings = [{ tipo: 'nota', detalle: 'sesión 2026-11-15T21:14:09-06:00' }]; },
    (x) => { x.verif.myiasis_reconciled = true; },
    (x) => { x.verif.source_pdf_sha256 = 'b'.repeat(64); },
    (x) => { x.data.diseases[0].reconciliation = { status: 'NO_RECONCILIADO' }; },
    (x) => { x.data.national[0].decision = { autor: 'x' }; },
  ];
  for (const mutar of mutaciones) {
    const copia = buildSyntheticW44({ withDisposition: true });
    mutar(copia);
    assert.throws(() => mod.verificarMiasis(copia.data, copia.verif));
  }

  // Disposición sobrante aplicada sobre W43-r1 (donde 820 == 820 sí reconcilia) falla cerrado.
  const sobranteW43 = structuredClone(w43Data);
  sobranteW43.meta.myiasis_status = 'NO_RECONCILIADO';
  sobranteW43.myiasis.reconciliation = {
    status: 'NO_RECONCILIADO',
    columnas_ok: [0, 2, 3, 5, 6, 9],
    discrepancias: [{ ...conDisp.disp, pdf_sha256: w43Data.meta.pdf_sha256, pagina: w43Data.myiasis.page }],
  };
  assert.throws(() => mod.verificarMiasis(sobranteW43));
});

test('JS-2: radar.js y textos.mjs conservan aviso UI y cifras originales sin exponer ningún marcador privado en HTML/DOM', async () => {
  const mod = await import('../assets/boletin/textos.mjs');
  assert.equal(typeof mod.avisoDiscrepanciaMiasis, 'function', 'textos.mjs debe exportar avisoDiscrepanciaMiasis');

  assert.equal(mod.avisoDiscrepanciaMiasis(w43Data.myiasis, w43Data.meta.year), '');
  const txtW43 = mod.textosRadar(w43Data, actual, null);
  assert.equal(txtW43.miasis_resumen, 'Miasis: 29 entidades listadas, sin rellenar las tres ausentes.');

  const { data: w44, verif: w44Verif } = buildSyntheticW44({ withDisposition: true });
  const aviso = mod.avisoDiscrepanciaMiasis(w44.myiasis, w44.meta.year);
  assert.match(aviso, /La fuente imprime 831 como total 2025–2026, pero sus entidades suman 830/);
  assert.match(aviso, /Chihuahua imprime 1 en el total con 0 en 2025 y 2 en 2026/);
  assert.match(aviso, /Se muestran las cifras tal como se imprimieron; tabla no reconciliada\./);
  assert.doesNotMatch(aviso, /\bPASS\b|tolerancia cero/i);
  assertNoPrivateMarkers(aviso, 'avisoDiscrepanciaMiasis');

  const txtW44 = mod.textosRadar(w44, actual, null);
  assertNoPrivateMarkers(JSON.stringify(txtW44), 'textosRadar W44');

  const domW43 = await runRadarDom(w43Data);
  assert.doesNotMatch(domW43.get('myiasisIntro').innerHTML, /NO_RECONCILIADO|no reconciliada/i);

  const domW44 = await runRadarDom(w44);
  const introHtml = domW44.get('myiasisIntro').innerHTML;
  const rowsHtml = domW44.get('myiasisRows').innerHTML;
  const headHtml = domW44.get('myiasisHead').innerHTML;
  const hashesText = domW44.get('hashes').textContent;
  assert.match(introHtml, /NO_RECONCILIADO/);
  assert.match(introHtml, /831/);
  assert.match(introHtml, /830/);
  assert.match(introHtml, /Chihuahua imprime 1 en el total con 0 en 2025 y 2 en 2026/);
  assert.match(introHtml, /tabla no reconciliada/);
  assert.doesNotMatch(introHtml, /\bPASS\b/i);
  assert.equal((headHtml.match(/<th/g) || []).length, 11, 'Estado notificante + 10 columnas intactas');
  assert.match(rowsHtml, /<tr><td>Chihuahua<\/td><td class="number">0<\/td><td class="number">0%<\/td><td class="number">0<\/td><td class="number">2<\/td><td class="number">0\.3%<\/td><td class="number">0<\/td><td class="number">1<\/td><td class="number">1<\/td><td class="number">0\.1%<\/td><td class="number">0<\/td><\/tr>/);
  assert.match(rowsHtml, /<tr class="state-total"><td>Total<\/td>.*<td class="number">831<\/td><td class="number">100%<\/td><td class="number">9<\/td><\/tr>/);

  for (const [id, el] of domW44.entries()) {
    assertNoPrivateMarkers(el.innerHTML, `DOM #${id}`);
  }
  assertNoPrivateMarkers(hashesText, 'DOM #hashes');
  assertNoPrivateMarkers(JSON.stringify(w44Verif), 'w44Verif');
});
