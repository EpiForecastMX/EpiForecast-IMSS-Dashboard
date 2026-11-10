/**
 * C7.7 — Obesidad (E66) en la galería y en la portada.
 *
 * La galería dibuja Obesidad desde su vista publicada, fuera de la lista contractual DATA (432
 * gráficos del carril semanal); la portada la anuncia y su noticia encabeza novedades.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import vm from 'node:vm';

const raiz = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, raiz), 'utf8');
const VISTA = JSON.parse(leer('publication/obesidad/vista.json'));

// El módulo real de la galería, sin DOM: sólo sus funciones puras.
const ctx = { window: {}, document: {}, console };
vm.runInNewContext(`${leer('epibot/js/release_catalog.js')}\n${leer('Reports/obesidad_galeria.js')}`, ctx);
const G = ctx.window.ObesidadGaleria;
G._usa(VISTA);
const sel = (f) => G.seleccion({ pad: '', sexo: '', q: '', ...f });

test('la galería ofrece las 111 series de Obesidad y respeta los filtros', () => {
  assert.equal(sel({}).length, 111);
  assert.equal(sel({ pad: 'Obesidad' }).length, 111);
  assert.equal(sel({ pad: 'Dengue' }).length, 0);
  assert.equal(sel({ sexo: 'Mujeres' }).length, 37);
  assert.equal(sel({ q: 'jalisco' }).map((s) => s.sexo).sort().join(','), 'general,hombres,mujeres');
  assert.equal(sel({ q: 'Querétaro' }).length, 3);
  assert.equal(sel({ q: 'obesidad' }).length, 111);
});

test('las ventanas son las de la vista: histórico completo y zoom de 52 + 52', () => {
  const s = VISTA.series['nacional|mx|general'];
  const full = G._ventana(s, 'full');
  assert.equal(full.fechas[0], s.observado[0][0]);
  assert.equal(full.fechas.at(-1), s.pronostico.at(-1)[0]);
  const zoom = G._ventana(s, 'zoom');
  assert.equal(zoom.fechas.length, 104);
  assert.equal(zoom.pron.filter((y) => y != null).length, VISTA.horizon_weeks);
  const obs = new Map(s.observado);
  zoom.fechas.forEach((d, i) => assert.equal(zoom.obs[i], obs.get(d) ?? null, d));
});

test('Obesidad no entra en la lista contractual DATA ni pinta métricas en la galería', () => {
  const html = leer('Reports/index.html');
  const data = JSON.parse(html.match(/^const DATA = (\[.*\]);$/m)[1]);
  assert.equal(data.length, 432);
  assert.ok(!data.some((d) => /obesidad/i.test(d.p)));
  // Integrada en los niveles existentes, no como sección aparte.
  assert.doesNotMatch(html, /id="secObesidad"/);
  for (const f of ['renderNacional(nac, obeNac)', 'renderRegional(reg, obeReg)', 'renderEstatal(est, obeEst)']) assert.ok(html.includes(f), f);
  assert.match(html, /<script src="obesidad_galeria\.js\?v=\d+"><\/script>/);
  assert.doesNotMatch(leer('Reports/obesidad_galeria.js'), /\.oos\b|smape|mase/i);
});

test('la noticia de Obesidad encabeza novedades y la portada la anuncia', () => {
  const news = JSON.parse(leer('news.json'));
  const nota = news.items.find((it) => it.type === 'obesidad');
  assert.ok(nota, 'falta la nota de Obesidad');
  assert.equal(nota.link.href, 'obesidad.html');
  const portada = leer('index.html');
  assert.match(portada, /\.news-tag--obesidad/);
  assert.match(leer('novedades.html'), /\.news-tag--obesidad/);
  assert.match(portada, /treinta y cinco padecimientos/);
  assert.match(portada, /class="disease-card disease-card--obe[^"]*" href="obesidad\.html"/);
});

test('la página de Obesidad acepta la serie pedida desde la galería', () => {
  assert.match(leer('obesidad.html'), /URLSearchParams\(location\.search\)\.get\('serie'\)/);
  assert.match(leer('Reports/obesidad_galeria.js'), /\.\.\/\$\{pagina\}\?serie=/);
  assert.match(G.tarjeta(sel({})[0]), /\.\.\/obesidad\.html\?serie=/);
});

test('cada estado de Obesidad cae en el acordeón de la galería con el mismo nombre', () => {
  const html = leer('Reports/index.html');
  const data = JSON.parse(html.match(/^const DATA = (\[.*\]);$/m)[1]);
  const estados = new Set(data.filter((d) => d.c === 'Estatal').map((d) => d.n));
  const obe = sel({}).filter((s) => s.nivel === 'estado').map(G.estadoGaleria);
  assert.equal(new Set(obe).size, 32);
  for (const n of obe) assert.ok(estados.has(n), n);
});

test('la Figura 1 de la portada añade Obesidad desde su vista sin tocar hero_series.json', () => {
  const portada = leer('index.html');
  assert.match(portada, /fetch\('publication\/' \+ cfg\.id \+ '\/vista\.json'/);
  assert.match(portada, /function serieRelease\(v, cfg\)/);
  assert.equal(JSON.parse(leer('hero_series.json')).series.length, 4);
});

test('la cabecera de un release da su propio corte y periodo', () => {
  const c = G.cabecera();
  assert.match(c.datos, /^semana \d+ de 2026$/);
  assert.match(c.periodo, /→/);
  assert.match(c.nota, /datos hasta la semana 26 de 2026/);
});
