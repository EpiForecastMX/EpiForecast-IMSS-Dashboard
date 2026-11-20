// Fichas de padecimiento (31 releases + Dengue) migradas al sistema común: chrome, integridad de los
// scripts científicos (cada id que usan existe), estado coherente con el catálogo y enlaces de
// contexto Galería/Dashboard que el destino acepta sin avisos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
    // El detalle es parte literal de la etiqueta visible: la sellada, salvo un portafolio igual al control (un año de
    // historia), que se presenta como control publicado con la frase común de estado-ficha.js y unified.mjs.
    assert.ok(E.etiqueta(vista).includes(nodos.pubLabel.textContent), `${id}: el detalle es parte literal de la etiqueta`);
    if (vista.portafolio_igual_al_control === true) {
      assert.equal(esperado, 'control', `${id}: portafolio igual al control se presenta como control`);
      assert.equal(E.etiqueta(vista), E.SIN_ALTERNATIVA, id);
    } else assert.equal(E.etiqueta(vista), vista.publication_label, id);
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

// Cronología estática (lo que se ve sin JavaScript y mientras carga): origen, fecha de emisión y
// ventana del gate prospectivo deben salir del manifiesto congelado y de la vista del release, no de la
// plantilla de la que se copió la ficha. Las cinco del 12-nov-2026 heredaban W41, 8-nov y W42-W45.
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre'];
const buscar = (o, k) => {
  if (!o || typeof o !== 'object') return undefined;
  if (k in o) return o[k];
  for (const v of Object.values(o)) { const r = buscar(v, k); if (r !== undefined) return r; }
  return undefined;
};
test('cronología estática de cada ficha = manifiesto congelado y gate prospectivo', () => {
  const pub = JSON.parse(leer('publication/catalog.json')).releases;
  let revisadas = 0;
  for (const r of pub) {
    const ficha = RELEASES.find((f) => f.id === r.disease_id);
    assert.ok(ficha, `sin ficha: ${r.disease_id}`);
    const man = JSON.parse(leer(`publication/${r.disease_id}/${r.release_id}/manifest.json`));
    const vista = JSON.parse(leer(`publication/${r.disease_id}/vista.json`));
    const origen = buscar(man, 'origin');
    const semanas = buscar(man, 'target_weeks');
    assert.deepEqual(vista.origin, origen, `${r.disease_id}: origen de la vista`);
    const f = new Date(vista.forecast_emitted_at);
    const [dia, mes, anio] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'numeric', year: 'numeric' })
      .formatToParts(f).filter((p) => p.type !== 'literal').sort((a, b) => 'daymonthyear'.indexOf(a.type) - 'daymonthyear'.indexOf(b.type)).map((p) => Number(p.value));
    const emision = `${dia} de ${MESES[mes - 1]} de ${anio}`;
    const ventana = `W${semanas[0][1]} a W${semanas.at(-1)[1]} de ${semanas.at(-1)[0]}`;
    const t = leer(ficha.page);
    const o = t.match(/id="originTxt">([^<]*)</);
    const e = t.match(/id="emitTxt">([^<]*)</);
    assert.ok(o && e, `${ficha.page}: sin originTxt/emitTxt`);
    assert.equal(o[1], `W${origen[1]} de ${origen[0]}`, `${ficha.page}: origen estático`);
    assert.equal(e[1], emision, `${ficha.page}: emisión estática`);
    for (const [, w] of t.matchAll(/\((W\d+ a W\d+ de \d{4})\)/g)) assert.equal(w, ventana, `${ficha.page}: ventana del gate`);
    revisadas += 1;
  }
  assert.equal(revisadas, pub.length);
});

// La política que nombra cada ficha es la del registry del backend (fixture generada desde
// `config/padecimientos.yaml`). La de O10-O16 decía «rolling_cv_baja_incidencia_v1, de cinco motores»,
// heredado de su plantilla, cuando su release usó rolling_cv_v1 con siete.
test('la política nombrada en cada ficha coincide con la del registry', () => {
  const pol = JSON.parse(leer('tests/fixtures/politica_por_release.json'));
  const pub = JSON.parse(leer('publication/catalog.json')).releases;
  assert.equal(Object.keys(pol).length, pub.length);
  for (const r of pub) {
    const ficha = RELEASES.find((f) => f.id === r.disease_id);
    const nombradas = [...new Set([...leer(ficha.page).matchAll(/rolling_cv[a-z_0-9]*/g)].map((m) => m[0]))];
    assert.deepEqual(nombradas, [pol[r.disease_id]], `${ficha.page}: política`);
  }
});

test('semanaMas (MMWR) del ayudante de fichas coincide con calendario_boletin y cruza 52/53 → 1', async () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(leer('assets/site/estado-ficha.js'), ctx);
  const E = ctx.EpiEstadoFicha;
  const { semanaSiguiente, semanasDelAnio } = await import('../epibot/js/calendario_boletin.js');
  assert.deepEqual([...E.semanaMas(2025, 53, 1)], [2026, 1]);
  assert.deepEqual([...E.semanaMas(2026, 52, 1)], [2027, 1]);
  assert.deepEqual([...E.semanaMas(2020, 53, 1)], [2021, 1]);
  assert.deepEqual([...E.semanaMas(2026, 43, 0)], [2026, 43]);
  assert.deepEqual([...E.semanaMas(2021, 1, -1)], [2020, 53]);
  assert.throws(() => E.semanaMas(2026, 53, 1), /no válida/);  // otro realm (vm): se compara el mensaje
  for (let y = 2014; y <= 2027; y++) {
    assert.equal(E.semanasDelAnio(y), semanasDelAnio(y), `${y}`);
    for (let w = 1; w <= semanasDelAnio(y); w++) for (const k of [0, 1]) {
      assert.deepEqual([...E.semanaMas(y, w, k)], semanaSiguiente(y, w, k), `${y}-W${w}+${k}`);
    }
  }
});

test('las fichas no hacen aritmética de semana a mano: boletín y primera semana fuera de muestra con semanaMas (MMWR)', () => {
  const malas = [];
  for (const f of readdirSync(root).filter((x) => x.endsWith('.html'))) {
    const t = leer(f);
    if (t.includes('publicada en el boletín de la semana ${w + 1}') || t.includes('${V.origin[1] + 1}')) malas.push(f);
    if (t.includes('EpiEstadoFicha.semanaMas')) assert.match(t, /estado-ficha\.js\?v=([2-9]|\d{2,})"/, `${f}: semanaMas exige estado-ficha v>=2`);
  }
  assert.deepEqual(malas, [], `fichas con semana + 1 a mano: ${malas.length}`);
});

// Lote alta_b44 (19-nov-2026): controles tras rechazo y controles sin alternativa (un año de historia) nunca dicen
// «validación en curso»; los temas sensibles llevan el recuadro visible de la Línea de la Vida y el 911; los avisos
// medidos de la fuente (avisos_fuente.js) se pintan en la ficha con el mismo texto.
const SENSIBLES_B44 = ['envenenamiento_analgesicos_x60', 'envenenamiento_psicotropicos_x61', 'ahorcamiento_x70',
  'disparo_arma_corta_x72', 'objeto_cortante_x78', 'salto_lugar_elevado_x80', 'intento_suicidio_z915', 'ideacion_suicida_r458',
  'violencia_intrafamiliar_y07', 'herida_arma_fuego_w32', 'intox_alcohol_f100', 'vih_b20'];
test('alta_b44: controles sin «validación en curso», sensibles con Línea de la Vida y avisos de la fuente en la ficha', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(leer('epibot/js/avisos_fuente.js'), ctx);
  const A = ctx.EPI_AVISOS_FUENTE;
  let controles = 0, sinAlternativa = 0, lote = 0;
  for (const r of JSON.parse(leer('publication/catalog.json')).releases) {
    const vista = JSON.parse(leer(`publication/${r.disease_id}/vista.json`));
    const t = leer(`${r.disease_id}.html`);
    const visible = t.slice(t.indexOf('<main>'), t.indexOf('</main>')).replace(/<[^>]+>/g, ' ');
    if (vista.portafolio_igual_al_control === true) {
      sinAlternativa += 1;
      assert.match(visible, /Es un control estacional, no validado/, r.disease_id);
      assert.match(visible, /no hubo ningún otro motor que elegir/, r.disease_id);
      assert.match(visible, /Sin validación prospectiva propia/, r.disease_id);
    }
    if (vista.caida_al_control || vista.portafolio_igual_al_control === true) {
      controles += 1;
      assert.doesNotMatch(visible, /validación (prospectiva )?en curso/i, `${r.disease_id}: un control no está «en curso»`);
    }
    // Releases del lote: emitidos el 19-nov-2026 (las fichas anteriores tienen su propia redacción).
    const delLote = String(vista.forecast_emitted_at).startsWith('2026-11-19');
    if (delLote) lote += 1;
    if (vista.caida_al_control && delLote) {
      // Ambas cifras de la prueba (portafolio y control) del ámbito nacional, como en la vista sellada.
      const nac = vista.caida_al_control.comprobaciones.find((c) => c.ambito === 'smape_nacional_general');
      if (!(nac.portafolio === 0 && nac.control === 0)) {
        assert.ok(visible.includes(`${nac.portafolio.toFixed(1)} frente a ${nac.control.toFixed(1)}`), `${r.disease_id}: cifras de la prueba`);
      }
    }
    for (const a of (delLote ? A[r.disease_id]?.avisos || [] : []).filter((x) => x.estado !== 'apoyo')) {
      assert.ok(t.includes(`<p class="aviso-fuente" data-aviso="${a.clave}"><strong>${a.titulo}</strong> ${a.texto}</p>`),
        `${r.disease_id}: aviso ${a.clave} en la ficha`);
    }
  }
  assert.equal(sinAlternativa, 10);
  assert.equal(lote, 59 + 6);  // 59 de alta_b44 y 6 del lote 6 (P. vivax se emitió el 20-nov UTC)
  assert.ok(controles >= 45, `${controles}`);
  for (const id of SENSIBLES_B44) {
    const t = leer(`${id}.html`);
    assert.match(t, /<aside class="callout" role="note" aria-label="Línea de ayuda">[\s\S]*Línea de la Vida[\s\S]*800 911 2000[\s\S]*911/, id);
    assert.ok(A[id]?.avisos.some((x) => x.estado === 'apoyo' && /800 911 2000/.test(x.texto)), `${id}: aviso de apoyo para el bot`);
  }
});

