// Fichas de padecimiento (31 releases + Dengue) migradas al sistema común: chrome, integridad de los
// scripts científicos (cada id que usan existe), estado coherente con el catálogo y enlaces de
// contexto Galería/Dashboard que el destino acepta sin avisos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../scripts/build_dashboard_catalog.mjs';
import { parseGalleryState } from '../Reports/galeria_core.mjs';
import { parseState } from '../assets/dashboard/data.mjs';
import { statusFromView } from '../assets/dashboard/unified.mjs';
import { STATUS_SHORT } from '../Reports/galeria_core.mjs';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const { catalog } = buildCatalog(root);
const byId = new Map(catalog.diseases.map((d) => [d.id, d]));
const RELEASES = [...leer('epibot/js/release_catalog.js').matchAll(/id: '([a-z0-9_]+)'[\s\S]*?pagina: '([^']+)'/g)].map((m) => ({ id: m[1], page: m[2] }));
const FICHAS = [...RELEASES, { id: 'dengue', page: 'dengue.html' }];

// Una ficha de cada clase pedida por la auditoría.
const FIXTURE = { obesidad: 'pass', asma_j45: 'pending', anorexia_f50: 'control', cancer_prostata_c61: 'general-only', dengue: 'legacy', cancer_pulmon_c33: 'onco' };

test('el fixture cubre PASS, PENDING, CONTROL, sólo General, LEGACY y otra oncológica', () => {
  assert.equal(byId.get('obesidad').status.kind, 'pass');
  assert.equal(byId.get('asma_j45').status.kind, 'pending');
  assert.equal(byId.get('anorexia_f50').status.kind, 'control');
  assert.deepEqual(byId.get('cancer_prostata_c61').sexes, ['general']);
  assert.equal(byId.get('dengue').kind, 'legacy');
  assert.match(byId.get('cancer_pulmon_c33').cie, /^C/);
  for (const id of Object.keys(FIXTURE)) assert.ok(FICHAS.some((f) => f.id === id), id);
});

test('chrome: shell común + site.css antes de disease.css; nada del chrome viejo ni fuentes/temas externos', () => {
  for (const { page } of FICHAS) {
    const t = leer(page);
    const head = t.slice(0, t.indexOf('</head>'));
    const site = head.indexOf('href="assets/site/site.css?v=');
    const dis = head.indexOf('href="disease.css?v=');
    assert.ok(site > 0 && dis > site, `${page}: site.css antes de disease.css`);
    assert.doesNotMatch(head, /editorial\.css|fonts\.googleapis|fonts\.gstatic/, page);
    assert.doesNotMatch(t, /class="disease-nav"|<nav class="nav" id="nav">/, page);
    assert.equal((t.match(/<footer\b/g) || []).length, 1, `${page}: un solo pie (el común)`);
    assert.match(t, /<body class="disease-page[^"]*">/, page);
    assert.ok(t.includes('<!-- site:header:start -->') && t.includes('<!-- site:footer:start -->'), page);
  }
});

// Ids que el script busca con guarda (`if (!el) return`) y que ya no existían antes de la migración:
// la gráfica de proyección de Dengue se retiró en la ronda W37 (ENMIENDA_DENGUE_NBGLM_W37).
const AUSENTES_PREVIOS = { 'dengue.html': new Set(['chart-forecast', 'fc-cap', 'heroStats']) };

test('integridad: cada id que usan los scripts de la ficha existe en la página', () => {
  for (const { page } of FICHAS) {
    const t = leer(page);
    const scripts = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    const ids = new Set([...scripts.matchAll(/(?:getElementById\(|\$\()'([A-Za-z][\w-]*)'\)/g)].map((m) => m[1]));
    for (const id of ids) if (!AUSENTES_PREVIOS[page]?.has(id)) assert.ok(t.includes(`id="${id}"`), `${page}: falta #${id}`);
  }
});

test('estado: el script lo toma de la vista actual (misma regla que Dashboard/Galería) y lo refleja en data-*', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(leer('assets/site/estado-ficha.js'), ctx);
  const E = ctx.EpiEstadoFicha;
  const visto = {};
  for (const { id, page } of RELEASES) {
    const t = leer(page);
    // Sin clase estática de estado: el color sale del atributo que pone el script.
    assert.match(t, /<body class="disease-page">/, page);
    assert.match(t, /<script src="assets\/site\/estado-ficha\.js\?v=\d+"><\/script>\s*<script>/, page);
    assert.match(t, /EpiEstadoFicha\.aplica\(\$\('statusCard'\), V\);/, page);
    assert.doesNotMatch(t, /\$\('pubLabel'\)\.textContent = V\.publication_label/, page);
    assert.match(t, /<strong id="pubKind" class="status-kind" hidden><\/strong> <span id="pubLabel">/, page);
    const vista = JSON.parse(leer(`publication/${id}/vista.json`));
    const esperado = statusFromView(vista).kind;
    assert.equal(byId.get(id).status.kind, esperado, `${id}: catálogo`);
    // DOM mínimo: la tarjeta recibe veredicto literal y tipo; el texto es explícito y no se repite.
    const attrs = {};
    const nodos = { pubKind: { textContent: '', hidden: true }, pubLabel: { textContent: '' } };
    const card = { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } };
    assert.equal(E.aplica(card, vista, { getElementById: (x) => nodos[x] }), esperado, id);
    assert.deepEqual(attrs, { 'data-verdict': vista.verdict, 'data-publication-kind': esperado }, id);
    assert.equal(nodos.pubKind.textContent, STATUS_SHORT[esperado], id);
    assert.equal(nodos.pubKind.hidden, false, id);
    assert.equal(`${nodos.pubKind.textContent} ${nodos.pubLabel.textContent}`.replace(/\s+/g, ' ').trim().length > 0, true);
    assert.ok(vista.publication_label.includes(nodos.pubLabel.textContent), `${id}: el detalle es parte literal de la etiqueta`);
    visto[id] = esperado;
  }
  // Casos de la auditoría: control por caída al control (veredicto INCOMPLETE) ≠ PENDING genuino.
  assert.deepEqual([visto.anorexia_f50, visto.cancer_prostata_c61, visto.obesidad, visto.asma_j45], ['control', 'control', 'pass', 'pending']);
  assert.equal(JSON.parse(leer('publication/anorexia_f50/vista.json')).verdict, 'INCOMPLETE');
  // Veredicto desconocido / FAIL: neutro, etiqueta literal, sin color.
  const attrs = { 'data-publication-kind': 'pass' };
  const nodos = { pubKind: { textContent: 'x', hidden: false }, pubLabel: { textContent: '' } };
  const card = { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } };
  assert.equal(E.aplica(card, { verdict: 'FAIL', publication_label: 'Etiqueta literal' }, { getElementById: (x) => nodos[x] }), null);
  assert.deepEqual(attrs, { 'data-verdict': 'FAIL' });
  assert.deepEqual([nodos.pubKind.hidden, nodos.pubLabel.textContent], [true, 'Etiqueta literal']);
  // CSS: PENDING azul neutro ≠ PASS verde ≠ control ocre; sin datos (cargando/error) neutro.
  const css = leer('disease.css');
  const regla = (k) => css.match(new RegExp(`\\.status-card\\[data-publication-kind="${k}"\\] \\{([^}]*)\\}`))[1];
  assert.match(regla('pass'), /--estado-bg: var\(--mint\)/);
  assert.match(regla('pending'), /--estado-bg: #eef3fa; --estado-ink: #24497a/);
  assert.match(regla('control'), /--estado-bg: var\(--gold-soft\)/);
  assert.doesNotMatch(css, /disease-control/);
  assert.match(css, /\.disease-page \{[^}]*--estado-bg: var\(--tint\)/);
});

test('contexto: los enlaces a Galería y Dashboard llevan el id del catálogo y el destino los acepta sin avisos', () => {
  for (const { id, page } of FICHAS) {
    const t = leer(page).replace(/&amp;/g, '&');
    const gal = t.match(/href="Reports\/index\.html(\?[^"]+)">Ver en la Galería</);
    const dash = t.match(/href="EpiDashboard\.html(\?[^"]+)">Abrir en el Dashboard</);
    assert.ok(gal && dash, page);
    const g = parseGalleryState(gal[1], catalog);
    assert.deepEqual(g.problems, [], page);
    assert.equal(g.state.p, id);
    const q = new URLSearchParams(dash[1]);
    assert.equal(q.get('p'), id);
    assert.ok(byId.has(q.get('p')), page);
    assert.equal(parseState(dash[1]).t, 'nacional');
  }
  for (const { page } of RELEASES) assert.match(leer(page), /get\('serie'\)/, `${page}: acepta ?serie= desde la galería`);
});

test('tokens del template antiguo apuntan al sistema claro en :root (los leen estilos en línea y gráficas)', () => {
  const css = leer('disease.css');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  for (const k of ['--text-muted', '--text-secondary', '--cream', '--bg-card-hover', '--bg-deep', '--amber', '--teal']) assert.ok(root.includes(`${k}:`), k);
  assert.doesNotMatch(root, /#0E1424|#131C30|#E7ECF5/i, 'sin la paleta oscura');
});
