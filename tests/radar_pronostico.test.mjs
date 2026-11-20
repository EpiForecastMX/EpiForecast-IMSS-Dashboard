// Opción «Pronóstico» del radar del boletín (orden del autor, alta_b44, 20-nov-2026: «que aquí … haya una opción
// además de ver cómo va la serie que pueda darme el forecast»). Con 2d2c3ffe fallan: no existían la opción, el
// módulo pronostico.mjs, el generador del exploratorio ni pronostico_exploratorio.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const json = (rel) => JSON.parse(leer(rel));
const imp = (rel) => import(pathToFileURL(resolve(root, rel)).href);
const actual = json('assets/boletin/actual.json');
const data = json(`${actual.carpeta}/data.json`);
const indice = json('assets/boletin/history/index.json');
const cats = data.diseases.filter((e) => !e.aggregate);
const LEGACY = new Set(['depresion', 'parkinson', 'alzheimer', 'dengue']);
const ROTULO = 'Pronóstico exploratorio, no validado';
const ROTULO_NIVEL = 'Pronóstico exploratorio, no validado: nivel reciente sin estacionalidad';
const ROTULO_NOTAS = 'Pronóstico exploratorio, no validado: nacional, derivado del acumulado publicado en las notas del boletín (no del cuadro estatal)';

function estadoFicha() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(leer('assets/site/estado-ficha.js'), ctx);
  return ctx.EpiEstadoFicha;
}

test('la opción «Pronóstico» existe para cada categoría no agregada de la foto vigente, y no para el agregado', async () => {
  const { fuentePronostico } = await imp('assets/boletin/pronostico.mjs');
  assert.equal(cats.length, data.meta.categories, 'categorías no agregadas = meta.categories');
  for (const e of cats) assert.ok(fuentePronostico(e), e.id);
  for (const e of data.diseases.filter((x) => x.aggregate)) assert.equal(fuentePronostico(e), null, e.id);
  const html = leer('boletin.html');
  assert.match(html, /<button type="button" id="tabPronostico" role="tab"[^>]*>Pronóstico<\/button>/);
  assert.match(html, /<button type="button" id="tabSerie" role="tab"[^>]*>Serie observada<\/button>/);
  assert.match(html, /id="forecastPanel" role="tabpanel"/);
  assert.match(html, /<script type="module" src="\/assets\/boletin\/pronostico_vista\.mjs\?v=\d+"><\/script>/);
  const radar = leer('assets/boletin/radar.js');
  assert.match(radar, /fuentePronostico\(d\)\?`<button class="button secondary" data-forecast="\$\{d\.id\}">Ver pronóstico<\/button>`/,
    'la ficha ofrece «Ver pronóstico» junto a «Ver curva histórica»');
  assert.match(leer('assets/boletin/curves.js'), /new CustomEvent\('radar:curva',\{detail:\{id\}\}\)/, 'la curva avisa la categoría elegida');
  // Cada categoría de la foto se puede elegir en el selector de la curva (histórico con su serie).
  for (const e of cats) assert.ok(indice.series[e.id], `sin serie histórica: ${e.id}`);
});

test('publicados del runner: la gráfica lee la serie nacional de su vista tal cual, con etiqueta fiel', async () => {
  const { desdeVista, tipoVista, etiquetaVista, fuentePronostico, SIN_ALTERNATIVA } = await imp('assets/boletin/pronostico.mjs');
  const E = estadoFicha();
  assert.equal(SIN_ALTERNATIVA, E.SIN_ALTERNATIVA);
  const ids = new Set();
  for (const e of cats) {
    const f = fuentePronostico(e);
    if (f.tipo !== 'publicado' || f.legacy) continue;
    ids.add(f.id);
    const v = json(`publication/${f.id}/vista.json`);
    const m = desdeVista(v, f.id);
    const nac = v.series['nacional|mx|general'];
    assert.ok(nac, `${f.id}: serie nacional general`);
    assert.deepEqual(m.pronostico, nac.pronostico.map(([ds, y]) => ({ ds, y })), f.id);
    assert.equal(m.pronostico.length, v.horizon_weeks, f.id);
    assert.equal(m.total, nac.pronostico_52_total, f.id);
    assert.equal(m.origen, `${v.origin[0]}-W${String(v.origin[1]).padStart(2, '0')}`, f.id);
    assert.equal(m.pagina, `${f.id}.html`);
    assert.ok(existsSync(resolve(root, m.pagina)), m.pagina);
    assert.equal(tipoVista(v), E.tipo(v), `${f.id}: misma semántica que estado-ficha.js`);
    assert.equal(m.etiqueta, etiquetaVista(v));
    assert.equal(m.etiqueta, E.etiqueta(v));
    if (e.status === 'Control publicado') {
      assert.match(m.rotulo, /^Control estacional, no validado/, f.id);
      assert.doesNotMatch(m.rotulo, /validación prospectiva (en curso|superada)/, f.id);
    } else {
      assert.equal(e.status, 'Publicada');
      assert.match(m.rotulo, /^Aceptado en su prueba única; validación prospectiva (superada|en curso)/, f.id);
      assert.ok(m.rotulo.includes(`(${v.weeks_available}/${v.weeks_required} semanas)`), f.id);
    }
    if (v.caida_al_control) assert.match(m.rotulo, /portafolio rechazado en su prueba única/, f.id);
    if (v.portafolio_igual_al_control === true) assert.match(m.rotulo, /sin alternativa con un año de historia/, f.id);
  }
  assert.equal(ids.size, data.meta.platform_published - LEGACY.size);
});

test('legacy: la gráfica lee los datos publicados de la portada (hero_series.json), 52 semanas con su motor', async () => {
  const { desdeLegacy } = await imp('assets/boletin/pronostico.mjs');
  const hero = json('hero_series.json');
  for (const id of LEGACY) {
    assert.ok(cats.some((e) => e.platform_id === id), id);
    const s = hero.series.find((x) => x.key === id);
    const m = desdeLegacy(hero, id);
    assert.deepEqual(m.pronostico, s.d.flatMap((ds, i) => (s.y[i] == null ? [] : [{ ds, y: s.y[i] }])), id);
    assert.equal(m.pronostico.length, 52, id);
    assert.ok(m.rotulo.includes(`motor nacional ${s.motor}`) && m.rotulo.includes(`corte ${s.corte}`), id);
    assert.ok(existsSync(resolve(root, m.pagina)), m.pagina);
  }
});

// Cálculo independiente del método declarado (no reutiliza el generador).
function independiente(e) {
  const v = new Map();
  for (const p of json(indice.series[e.id].path.slice(1)).points) {
    const x = p.n?.[0];
    const g = e.guion && e.guion.semantica === 'no_publicado' && (e.guion.desde == null || p.y >= e.guion.desde);
    v.set(`${p.y}-${p.w}`, typeof x === 'number' ? x : x === '-' && !g ? 0 : null);
  }
  return v;
}

test('exploratorio: archivo al día, método declarado, 52 semanas consecutivas y cada cifra recalculada', async () => {
  const { generar } = await imp('scripts/radar_pronostico_exploratorio.mjs');
  const ruta = `${actual.carpeta}/pronostico_exploratorio.json`;
  assert.ok(existsSync(resolve(root, ruta)), ruta);
  const { texto } = generar(root);
  assert.equal(leer(ruta), texto, 'pronostico_exploratorio.json desactualizado: node scripts/radar_pronostico_exploratorio.mjs');
  const doc = JSON.parse(texto);
  assert.equal(doc.rotulo, ROTULO);
  assert.equal(doc.metodo.nombre, 'media_estacional_misma_semana');
  assert.equal(doc.metodo.horizonte_semanas, 52);
  assert.equal(doc.metodo.max_anios, 3);
  assert.equal(doc.metodo.intervalos, false);
  assert.equal(doc.metodo.prueba_de_desempeno, false);
  assert.match(doc.advertencia, /sin prueba de desempeño|No tiene prueba de desempeño/);
  assert.equal(doc.fuente.foto, `${data.meta.year}-W${String(data.meta.week).padStart(2, '0')}`);
  const sinRelease = cats.filter((e) => !e.platform_id);
  assert.deepEqual(Object.keys(doc.categorias).sort(), sinRelease.map((e) => e.id).sort());
  assert.ok(sinRelease.some((e) => e.status === 'Rechazada' && /covid/i.test(e.name)), 'Covid-19 rechazada está incluida');
  const E = estadoFicha();
  for (const e of sinRelease) {
    const c = doc.categorias[e.id];
    assert.ok(c.motivo_sin_modelo.length > 30, e.id);
    if (e.status === 'No modelable') assert.ok(c.motivo_sin_modelo.endsWith(`: ${e.reason.charAt(0).toLowerCase()}${e.reason.slice(1)}`), e.id);
    if (e.status === 'Rechazada') assert.match(c.motivo_sin_modelo, /^Rechazada/, e.id);
    const v = independiente(e);
    const puntos = json(indice.series[e.id].path.slice(1)).points;
    const conCifra = puntos.filter((p) => v.get(`${p.y}-${p.w}`) != null);
    if (!c.pronostico) {
      // Sólo sin pronóstico si nunca hubo una cifra semanal en toda la historia del radar.
      assert.equal(conCifra.length, 0, `${e.id}: tiene cifras y quedó sin pronóstico`);
      assert.match(c.sin_pronostico, /^Nunca se imprimió una cifra semanal de esta categoría en ninguna foto del radar/, e.id);
      continue;
    }
    assert.equal(c.pronostico.length, 52, e.id);
    const ultimo = puntos.at(-1);
    assert.deepEqual(c.origen, [ultimo.y, ultimo.w], `${e.id}: origen = último periodo impreso`);
    c.pronostico.forEach((s, k) => assert.deepEqual([s.y, s.w], [...E.semanaMas(c.origen[0], c.origen[1], k + 1)], `${e.id} semana ${k + 1}`));
    if (c.metodo === 'nivel_reciente_acumulado_de_notas') {
      // Sólo cuando el cuadro nunca publicó una cifra semanal reciente; se verifica aparte con las notas.
      assert.equal(v.get(`${ultimo.y}-${ultimo.w}`), null, `${e.id}: el cuadro sí tiene cifra en el último periodo`);
      assert.equal(c.rotulo, ROTULO_NOTAS);
      continue;
    }
    // ¿Tenía base la referencia estacional? (origen con cifra y las 52 semanas con al menos un año base)
    const estacionalPosible = v.get(`${c.origen[0]}-${c.origen[1]}`) != null &&
      c.pronostico.every((s) => [1, 2, 3].some((d) => v.get(`${s.y - d}-${s.w}`) != null));
    if (c.metodo === 'nivel_reciente_sin_estacionalidad') {
      assert.equal(estacionalPosible, false, `${e.id}: respaldo sólo si la estacional no tiene base`);
      assert.equal(c.rotulo, ROTULO_NIVEL);
      assert.ok(c.motivo_respaldo.length > 40, e.id);
      const usadas = conCifra.slice(-8);
      assert.equal(c.n_semanas_base, usadas.length, e.id);
      assert.deepEqual(c.semanas_base.map((b) => [b.y, b.w, b.valor]), usadas.map((p) => [p.y, p.w, v.get(`${p.y}-${p.w}`)]), e.id);
      const nivel = Math.round((usadas.reduce((t, p) => t + v.get(`${p.y}-${p.w}`), 0) / usadas.length) * 10) / 10;
      assert.equal(c.nivel, nivel, e.id);
      for (const s of c.pronostico) assert.equal(s.valor, nivel, `${e.id}: plano`);
      const yw = (p) => `${p.y}-W${String(p.w).padStart(2, '0')}`;
      assert.equal(c.periodo_base, `${yw(usadas[0])} a ${yw(usadas.at(-1))}`, e.id);
      if (usadas.some((p) => p.n?.[0] === '-')) assert.match(c.nota_base, /(guiones impresos|un guion impreso) que la simbología/, e.id);
      continue;
    }
    assert.equal(c.metodo, 'media_estacional_misma_semana', e.id);
    assert.equal(c.rotulo, ROTULO);
    assert.equal(estacionalPosible, true, e.id);
    c.pronostico.forEach((s) => {
      const base = [1, 2, 3].map((d) => [s.y - d, v.get(`${s.y - d}-${s.w}`)]).filter(([, x]) => x != null);
      assert.ok(base.length >= 1, `${e.id} ${s.y}-W${s.w}: sin base no hay cifra`);
      assert.deepEqual(s.anios, base.map(([a]) => a), `${e.id} ${s.y}-W${s.w}`);
      const media = base.reduce((t, [, x]) => t + x, 0) / base.length;
      assert.equal(s.valor, Math.round(media * 10) / 10, `${e.id} ${s.y}-W${s.w}`);
    });
  }
  // Respaldo de nivel reciente para todas las que no tenían base estacional; sarampión nunca imprimió una cifra
  // semanal (guion de cifra no publicada desde que existe su cuadro, 2025): no recibe un cero inventado.
  assert.equal(doc.respaldo.nombre, 'nivel_reciente_sin_estacionalidad');
  assert.equal(doc.respaldo.rotulo, ROTULO_NIVEL);
  assert.equal(doc.respaldo.max_semanas, 8);
  assert.deepEqual(Object.entries(doc.categorias).filter(([, c]) => !c.pronostico).map(([k]) => k), []);
  assert.deepEqual(Object.entries(doc.categorias).filter(([, c]) => c.metodo === 'nivel_reciente_sin_estacionalidad').map(([k]) => k).sort(),
    ['p80b1', 'p80b2', 'p80b3']);
  assert.deepEqual(Object.entries(doc.categorias).filter(([, c]) => c.metodo === 'nivel_reciente_acumulado_de_notas').map(([k]) => k).sort(),
    ['p10b2', 'p33b1']);
  assert.equal(doc.conteo.con_pronostico, doc.conteo.estacional + doc.conteo.nivel_reciente + doc.conteo.notas);
  assert.equal(doc.conteo.sin_pronostico, 0);
});

test('exploratorio: el rótulo obligatorio aparece en la gráfica, la ficha, la cobertura y la página', async () => {
  const { ROTULO_EXPLORATORIO, ADVERTENCIA_EXPLORATORIO, desdeExploratorio } = await imp('assets/boletin/pronostico.mjs');
  assert.equal(ROTULO_EXPLORATORIO, ROTULO);
  assert.match(ADVERTENCIA_EXPLORATORIO, /sin prueba de desempeño|No tiene prueba de desempeño/);
  assert.match(ADVERTENCIA_EXPLORATORIO, /intervalos/);
  const vista = leer('assets/boletin/pronostico_vista.mjs');
  assert.match(vista, /class="forecast-watermark" aria-label="\$\{esc\(m\.rotulo\)\}">\$\{esc\(l1\)\}\$\{l2 \? `<tspan[^`]*>\$\{esc\(l2\)\}<\/tspan>` : ''\}/, 'rótulo completo dentro de la gráfica');
  assert.match(vista, /<b>\$\{esc\(m\.rotulo\)\}\.<\/b> \$\{esc\(m\.motivo\)\} \$\{esc\(m\.advertencia\)\}\$\{base\}/, 'rótulo, motivo, advertencia y semanas base');
  const radar = leer('assets/boletin/radar.js');
  assert.match(radar, /<b>\$\{esc\(ROTULO_EXPLORATORIO\)\}\.<\/b> «Ver pronóstico» muestra una referencia estacional nacional simple/);
  assert.match(leer('boletin.html'), /«Pronóstico exploratorio, no validado»/);
  const doc = json(`${actual.carpeta}/pronostico_exploratorio.json`);
  const id = Object.keys(doc.categorias).find((k) => doc.categorias[k].pronostico);
  const m = desdeExploratorio(doc, id);
  assert.equal(m.rotulo, ROTULO);
  assert.equal(m.pronostico.length, 52);
  assert.ok(m.motivo && m.advertencia && m.enlace.href);
  const { ROTULO_NIVEL_RECIENTE, ADVERTENCIA_NIVEL_RECIENTE } = await imp('assets/boletin/pronostico.mjs');
  assert.equal(ROTULO_NIVEL_RECIENTE, ROTULO_NIVEL);
  assert.match(ADVERTENCIA_NIVEL_RECIENTE, /No tiene estacionalidad, prueba de desempeño ni intervalos/);
  for (const k of ['p80b1', 'p80b2', 'p80b3']) {
    const n = desdeExploratorio(doc, k);
    assert.equal(n.rotulo, ROTULO_NIVEL, k);
    assert.equal(n.advertencia, ADVERTENCIA_NIVEL_RECIENTE, k);
    assert.ok(n.base && n.base.n >= 1 && n.base.periodo && n.motivo_respaldo, k);
    assert.equal(n.pronostico.length, 52, k);
  }
  assert.match(radar, /<b>\$\{esc\(ROTULO_NIVEL_RECIENTE\)\}\.<\/b> «Ver pronóstico» muestra un valor plano de 52 semanas/);
  assert.match(leer('boletin.html'), /«Pronóstico exploratorio, no validado: nivel reciente sin estacionalidad»/);
});

test('cobertura: 100 % de las categorías con opción «Pronóstico», desglosada en publicado, exploratorio y sin historia', async () => {
  const { coberturaPronostico, textoCoberturaPronostico, summarizeCoverage } = await imp('assets/boletin/coverage.mjs');
  const doc = json(`${actual.carpeta}/pronostico_exploratorio.json`);
  const c = coberturaPronostico(data.diseases, doc);
  assert.equal(c.total, cats.length);
  assert.equal(c.con_opcion, c.total);
  assert.equal(c.sin_opcion, 0);
  assert.equal(c.pct, 100);
  assert.equal(c.publicado, summarizeCoverage(data.diseases).covered);
  assert.equal(c.exploratorio, doc.conteo.estacional);
  assert.equal(c.nivel_reciente, doc.conteo.nivel_reciente);
  assert.equal(c.sin_historia, doc.conteo.sin_pronostico);
  assert.equal(c.notas, doc.conteo.notas);
  assert.equal(c.publicado + c.exploratorio + c.nivel_reciente + c.notas + c.sin_historia, c.total);
  assert.equal(c.con_pronostico, c.total, 'todas las categorías con pronóstico');
  assert.equal(c.pct_pronostico, 100);
  assert.equal(c.sin_historia, 0);
  const t = textoCoberturaPronostico(c);
  assert.ok(t.startsWith(`${c.total} de ${c.total} categorías (100 %) tienen la opción «Pronóstico»`), t);
  assert.ok(t.includes(`${c.publicado} con pronóstico publicado`), t);
  assert.ok(t.includes(`${c.exploratorio} con pronóstico exploratorio estacional, no validado`), t);
  assert.ok(t.includes(`${c.nivel_reciente} con pronóstico exploratorio de nivel reciente sin estacionalidad, no validado`), t);
  assert.ok(t.includes(`${c.notas} con pronóstico exploratorio nacional derivado del acumulado publicado en las notas del boletín, no validado`), t);
  assert.ok(!t.includes('sin ningún pronóstico'), t);
  assert.match(leer('assets/boletin/radar.js'), /c\.pct_pronostico\.toLocaleString\('es-MX'\)\)\} %<\/strong> de las categorías con pronóstico/);
  assert.match(leer('assets/boletin/radar.js'), /renderForecastCoverage\(\)/);
  assert.match(leer('boletin.html'), /<div id="forecastCoverage" class="forecast-coverage"/);
  // Sin el exploratorio, la cobertura lo dice: las categorías sin release no cuentan como cubiertas.
  const sin = coberturaPronostico(data.diseases, null);
  assert.equal(sin.sin_opcion, cats.length - c.publicado);
});

test('el generador semanal regenera el exploratorio al activar cada foto', () => {
  const py = leer('scripts/boletin_semana_activa.py');
  assert.match(py, /scripts\/radar_pronostico_exploratorio\.mjs'\), '--root', str\(raiz\)\]/);
  assert.match(leer('assets/boletin/textos.mjs'), /pronostico: rutaFoto\(actual, 'pronostico_exploratorio\.json'\)/);
});

test('EpiBot: menciona la referencia exploratoria de una no modelable sin dar sus cifras', async () => {
  const { respuestaNoModelableRag } = await imp('epibot/netlify/lib/radar_no_modelable.mjs');
  const doc = json(`${actual.carpeta}/pronostico_exploratorio.json`);
  const e = data.diseases.find((x) => x.id === 'p12b2');
  const r = respuestaNoModelableRag('influenza J09-J11', data);
  assert.ok(r && r.includes(`«${ROTULO}»`), r);
  assert.match(r, /no tiene pronóstico ni control estacional/);
  const total = Math.round(doc.categorias[e.id].pronostico.reduce((t, s) => t + s.valor, 0)).toLocaleString('es-MX');
  assert.ok(!r.includes(total), 'sin cifras del exploratorio');
  const bot = leer('epibot/js/radar_boletin.js');
  assert.match(bot, /'\[Categorías sin pronóstico\]\(\.\.\/no_modelables\.html\)\. ' \+ REFERENCIA_EXPLORATORIA/);
});

test('notas del boletín: acumulados nacionales con evidencia, tramo consistente y casos semanales por diferencia', async () => {
  const notas = json('assets/boletin/history/notas_acumulados.json');
  const { leerBoletin, agregar } = await imp('scripts/radar_notas_acumulados.mjs');
  const { tramoNotas } = await imp('scripts/radar_pronostico_exploratorio.mjs');
  assert.equal(notas.schema, 'radar_notas_acumulados.v1');
  assert.deepEqual(Object.values(notas.series).map((s) => s.categoria).sort(), ['p10b2', 'p33b1']);
  for (const s of Object.values(notas.series)) {
    assert.ok(s.puntos.length >= 20, s.nombre);
    for (const p of s.puntos) {
      assert.match(p.boletin, /^\d{4}_sem\d{2}$/);
      assert.equal(p.archivo, `${p.boletin}.txt`);
      assert.ok(Number.isInteger(p.pagina) && p.pagina > 0, p.boletin);
      assert.ok(Number.isInteger(p.acumulado) && p.acumulado >= 0, p.boletin);
      assert.ok(p.frase.length > 30, p.boletin);
    }
  }
  // La foto vigente trae su boletin.txt: reagregarlo reproduce el mismo documento (idempotente).
  const txt = leer(`${actual.carpeta}/boletin.txt`);
  assert.deepEqual(agregar(notas, txt, '2026_sem44'), notas);
  const f44 = leerBoletin(txt, '2026_sem44').falciparum;
  assert.equal(f44.acumulado, 6);
  assert.match(f44.frase, /en seis la especie Plasmodium falciparum/);
  // Tramo: corta en el cambio de año, en un boletín faltante y si el acumulado baja (falla cerrado).
  const P = (anio, semana, acumulado) => ({ boletin: `${anio}_sem${String(semana).padStart(2, '0')}`, anio, semana, acumulado, se_impresa: semana });
  assert.deepEqual(tramoNotas([P(2025, 52, 7), P(2026, 1, 1), P(2026, 2, 3)]).semanales, [{ y: 2026, w: 2, valor: 2 }]);
  assert.match(tramoNotas([P(2026, 1, 1), P(2026, 3, 3), P(2026, 4, 5)]).corte, /falta el boletín entre 2026_sem01 y 2026_sem03/);
  assert.deepEqual(tramoNotas([P(2026, 1, 1), P(2026, 3, 3), P(2026, 4, 5)]).semanales, [{ y: 2026, w: 4, valor: 2 }]);
  const baja = tramoNotas([P(2026, 1, 4), P(2026, 2, 6), P(2026, 3, 5), P(2026, 4, 7)]);
  assert.match(baja.corte, /el acumulado baja de 6 \(2026_sem02\) a 5 \(2026_sem03\)/);
  assert.deepEqual(baja.semanales, [{ y: 2026, w: 4, valor: 2 }]);
  // Recalculo independiente de los dos pronósticos derivados de las notas.
  const doc = json(`${actual.carpeta}/pronostico_exploratorio.json`);
  for (const s of Object.values(notas.series)) {
    const c = doc.categorias[s.categoria];
    const ps = s.puntos;
    let i = ps.length - 1;
    while (i > 0 && ps[i - 1].anio === ps[i].anio && ps[i - 1].semana === ps[i].semana - 1 && ps[i].acumulado >= ps[i - 1].acumulado) i--;
    const tramo = ps.slice(i);
    const sem = tramo.slice(1).map((b, k) => b.acumulado - tramo[k].acumulado).slice(-8);
    const nivel = Math.round((sem.reduce((a, b) => a + b, 0) / sem.length) * 10) / 10;
    assert.equal(c.metodo, 'nivel_reciente_acumulado_de_notas', s.nombre);
    assert.equal(c.rotulo, ROTULO_NOTAS);
    assert.equal(c.nivel, nivel, s.nombre);
    assert.deepEqual(c.semanas_base.map((b) => b.valor), sem, s.nombre);
    assert.equal(c.fuente_notas.tramo.length, tramo.length, s.nombre);
    assert.ok(c.pronostico.every((x) => x.valor === nivel) && c.pronostico.length === 52, s.nombre);
  }
  // Sarampión: el tramo termina en 2025-W53 (las notas no imprimen el acumulado en 2026) y se declara.
  assert.match(doc.categorias.p10b2.nota_base, /por última vez en el boletín 2025_sem53/);
  assert.match(doc.categorias.p10b2.nota_base, /2025_sem36 la frase dice semana 35/);
  // P. falciparum: tramo 2026-W25..W44 (cambio de año antes) en lugar del nivel 0 de los guiones de 2024.
  assert.equal(doc.categorias.p33b1.fuente_notas.tramo[0].boletin, '2026_sem25');
  assert.ok(doc.categorias.p33b1.nivel > 0);
  // La activación semanal agrega el boletín de la foto antes de generar el exploratorio.
  assert.match(leer('scripts/boletin_semana_activa.py'), /radar_notas_acumulados\.mjs'\), '--root', str\(raiz\),\s*'--agrega', str\(txt\)/);
  const { ROTULO_NOTAS: R } = await imp('assets/boletin/pronostico.mjs');
  assert.equal(R, ROTULO_NOTAS);
  assert.match(leer('assets/boletin/radar.js'), /<b>\$\{esc\(ROTULO_NOTAS\)\}\.<\/b> «Ver pronóstico» muestra un valor plano de 52 semanas/);
});
