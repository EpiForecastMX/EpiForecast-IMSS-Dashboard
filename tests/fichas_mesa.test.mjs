/**
 * Mesa de la plataforma (25-nov-2026, ocho asientos; acta en planes/mesa_plataforma_2026-11-25/).
 * Fichas del runner: un control nunca se dibuja ni se nombra como pronóstico, el error con 0 frente a 0 no es «0 %»,
 * la tabla no se ordena por un sMAPE de una semana, teclado y lector de pantalla, migas a la galería y sin jerga interna.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const RELEASES = [...leer('epibot/js/release_catalog.js').matchAll(/id: '([a-z0-9_]+)'[\s\S]*?pagina: '([^']+)'/g)].map((m) => ({ id: m[1], page: m[2] }));
const ctx = vm.createContext({});
vm.runInContext(leer('assets/site/estado-ficha.js'), ctx);
const E = ctx.EpiEstadoFicha;
const vista = (id) => JSON.parse(leer(`publication/${id}/vista.json`));
const pct = (v) => `${v.toFixed(1)} %`;

test('las 148 fichas toman color y nombre de la línea del estado, sin suavizado, con teclado y resumen accesible', () => {
  assert.equal(RELEASES.length, 148);
  for (const { page } of RELEASES) {
    const t = leer(page);
    assert.match(t, /\{ label: T\.etiqueta, data: fc, borderColor: T\.color/, page);
    assert.doesNotMatch(t, /label: '(Control estacional congelado|Pronóstico congelado)', data: fc/, page);
    assert.doesNotMatch(t, /tension: 0\.15/, page);
    assert.match(t, /EpiEstadoFicha\.filaTeclado\(tr, s\.nombre\)/, page);
    assert.match(t, /<canvas id="chartObesidad" role="img"/, page);
    assert.match(t, /EpiEstadoFicha\.resumenGrafica\(s, V, nf0\)/, page);
    assert.match(t, /maxTicksLimit: window\.innerWidth < 600 \? 5 : 9/, page);
    assert.doesNotMatch(t, /a\.oos\.smape \?\? 1e9/, `${page}: la tabla no se ordena por el error`);
    assert.match(t, /<a href="Reports\/index\.html">Padecimientos<\/a>/, `${page}: la miga sube a la galería`);
    assert.doesNotMatch(t, /este release/, page);
    assert.doesNotMatch(t, /pct\((o|s\.oos|nac\.oos)\.smape\)/, `${page}: el error pasa por errorOos`);
  }
});

test('trazo: un control es gris «Control, no validado»; un aceptado conserva «Pronóstico congelado»', () => {
  let controles = 0;
  for (const { id } of RELEASES) {
    const v = vista(id), t = E.trazo(v);
    if (E.tipo(v) === 'control') {
      controles++;
      assert.deepEqual([t.etiqueta, t.color, t.control], ['Control, no validado', '#6b6f73', true], id);
      assert.match(E.agregado(v), /^Suma de las series estatales del control/, id);
    } else {
      assert.equal(t.etiqueta, 'Pronóstico congelado', id);
      assert.equal(E.agregado(v), null, id);
    }
  }
  assert.equal(controles, 97);
});

test('error fuera de muestra: 0 frente a 0 es «sin casos», sin semanas es «—» y si no, el sMAPE', () => {
  assert.equal(E.errorOos({ semanas: 1, observado_total: 0, pronostico_total: 0, smape: 0 }, pct), 'sin casos');
  assert.equal(E.errorOos({ semanas: 0 }, pct), '—');
  assert.equal(E.errorOos({ semanas: 2, observado_total: 5402, pronostico_total: 6128.5, smape: 12.51 }, pct), '12.5 %');
  // Tracoma y triquinosis tenían «0.0 %» por 0 frente a 0 en el nacional (dictamen de Fable).
  for (const id of ['tracoma_a71', 'triquinosis_b75']) {
    const nac = vista(id).series['nacional|mx|general'];
    if (nac?.oos?.semanas) assert.equal(E.errorOos(nac.oos, pct), 'sin casos', id);
  }
});

test('rótulos: el sMAPE nacional dice con cuántas semanas; en un control, título, leyenda y método dejan de decir pronóstico', () => {
  const nodos = {};
  const nodo = (t = '') => ({ textContent: t, style: {}, parentNode: null, lastChild: null });
  const mk = (sel, t) => { nodos[sel] = nodo(t); return nodos[sel]; };
  const st = mk('#stOos', '14.7 %'); const lab = mk('.lstOos', 'sMAPE nacional fuera de muestra');
  st.parentNode = { querySelector: () => lab };
  mk('#explorador h2', 'Pronóstico congelado frente a lo observado');
  mk('#explorador > .wrap > p', '');
  for (const [k, txt] of [['.legend .sw-fc', 'Pronóstico congelado'], ['.legend .sw-band', 'Semanas ya observadas del pronóstico']]) {
    const sw = mk(k); const txtNodo = { textContent: txt }; sw.parentNode = { lastChild: txtNodo }; nodos[`${k}:txt`] = txtNodo;
  }
  mk('.legend .sw-obs');
  mk('#metodologia .step:nth-child(2) h4', '64 modelos, uno por serie base');
  const d = { getElementById: (x) => nodos[`#${x}`], querySelector: (s) => nodos[s] || null };
  E.rotulos(d, vista('varicela_b01'));
  // Decisión del autor (25-nov-2026): el sMAPE va junto a observados y esperados, con aviso si hay pocas semanas o casos.
  const nac = vista('varicela_b01').series['nacional|mx|general'].oos;
  assert.equal(lab.textContent, `sMAPE nacional fuera de muestra · 1 semana: ${new Intl.NumberFormat('es-MX').format(nac.observado_total)} observados frente a ${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(nac.pronostico_total)} esperados (pocas semanas o pocos casos: varía mucho)`);
  assert.equal(nodos['#explorador h2'].textContent, 'Control estacional frente a lo observado');
  assert.equal(nodos['.legend .sw-fc:txt'].textContent, 'Control, no validado');
  assert.equal(nodos['.legend .sw-band:txt'].textContent, 'Semanas ya observadas del control');
  assert.equal(nodos['#metodologia .step:nth-child(2) h4'].textContent, 'Una serie base por entidad y sexo');
  assert.match(nodos['#explorador > .wrap > p'].textContent, /gris discontinua, el control estacional/);
});

test('rótulo del error: sin semanas, con pocas y con cuatro o más; las 148 fichas lo usan', () => {
  assert.equal(E.rotuloOos({ semanas: 0 }, 'sMAPE'), 'sMAPE (sin semanas aún)');
  assert.equal(E.rotuloOos({ semanas: 2, observado_total: 5402, pronostico_total: 6128.5 }, 'sMAPE'), 'sMAPE · 2 semanas: 5,402 observados frente a 6,129 esperados (pocas semanas o pocos casos: varía mucho)');
  assert.equal(E.rotuloOos({ semanas: 4, observado_total: 9, pronostico_total: 8 }, 'sMAPE'), 'sMAPE · 4 semanas: 9 observados frente a 8 esperados (pocas semanas o pocos casos: varía mucho)');
  assert.equal(E.rotuloOos({ semanas: 17, observado_total: 253617, pronostico_total: 282612 }, 'sMAPE'), 'sMAPE · 17 semanas: 253,617 observados frente a 282,612 esperados');
  for (const { page } of RELEASES) assert.match(leer(page), /EpiEstadoFicha\.rotuloOos\(o, 'sMAPE fuera de muestra', s, V\)/, page);
});

test('resumen accesible de la gráfica: serie, último observado y total del control o del pronóstico', () => {
  const nf = new Intl.NumberFormat('es-MX');
  const v = vista('varicela_b01'), s = v.series['nacional|mx|general'];
  const r = E.resumenGrafica(s, v, nf);
  assert.match(r, /^Nacional, General\. Último observado: [\d,]+ casos/);
  assert.match(r, /Control estacional, no validado: [\d,]+ casos en 52 semanas\./);
});

test('semanas no prospectivas: la ficha y el catálogo del EpiBot declaran las mismas; el rótulo las separa y mide sólo las prospectivas', async () => {
  await import('../epibot/js/release_catalog.js');
  const cat = globalThis.EPI_CATALOGO.releases;
  let con = 0;
  for (const r of cat) {
    const t = leer(r.pagina);
    const attr = (t.match(/id="statusCard" data-no-prospectivas="([^"]+)"/) || [])[1] ?? null;
    assert.equal(attr, r.no_prospectivas ? r.no_prospectivas.join(',') : null, r.id);
    if (r.no_prospectivas) {
      con++;
      assert.match(r.cronologia || '', /prospectiv|público antes de emitir/i, `${r.id}: la cronología lo explica`);
    }
  }
  assert.equal(con, 9);
  const v = vista('asma_j45'), s = v.series['nacional|mx|general'];
  E.aplica({ getAttribute: () => '2026-W42', setAttribute() {}, removeAttribute() {} }, v, { getElementById: () => null });
  assert.deepEqual([...E.noProspectivas()], ['2026-W42']);
  const p = E.soloProspectivas(s, v);
  assert.deepEqual([p.semanas, p.observado_total, p.pronostico_total, Math.round(p.smape * 10) / 10], [1, 2702, 3191, 16.6]);
  assert.match(E.rotuloOos(s.oos, 'sMAPE', s, v), /2026-W42 ya era pública al emitir, no es prospectiva; sólo las prospectivas \(1\): sMAPE 16\.6 %$/);
  E.aplica({ getAttribute: () => null, setAttribute() {}, removeAttribute() {} }, v, { getElementById: () => null });
  assert.doesNotMatch(E.rotuloOos(s.oos, 'sMAPE', s, v), /prospectiva/);
});
