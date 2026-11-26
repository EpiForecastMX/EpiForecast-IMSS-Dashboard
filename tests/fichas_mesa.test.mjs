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
  assert.equal(lab.textContent, 'sMAPE nacional fuera de muestra (1 semana)');
  assert.equal(nodos['#explorador h2'].textContent, 'Control estacional frente a lo observado');
  assert.equal(nodos['.legend .sw-fc:txt'].textContent, 'Control, no validado');
  assert.equal(nodos['.legend .sw-band:txt'].textContent, 'Semanas ya observadas del control');
  assert.equal(nodos['#metodologia .step:nth-child(2) h4'].textContent, 'Una serie base por entidad y sexo');
  assert.match(nodos['#explorador > .wrap > p'].textContent, /gris discontinua, el control estacional/);
});

test('resumen accesible de la gráfica: serie, último observado y total del control o del pronóstico', () => {
  const nf = new Intl.NumberFormat('es-MX');
  const v = vista('varicela_b01'), s = v.series['nacional|mx|general'];
  const r = E.resumenGrafica(s, v, nf);
  assert.match(r, /^Nacional, General\. Último observado: [\d,]+ casos/);
  assert.match(r, /Control estacional, no validado: [\d,]+ casos en 52 semanas\./);
});
