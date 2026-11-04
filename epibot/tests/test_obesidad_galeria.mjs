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
vm.runInNewContext(leer('Reports/obesidad_galeria.js'), ctx);
const G = ctx.window.ObesidadGaleria;
const sel = (f) => G._seleccion(VISTA, { pad: '', sexo: '', q: '', ...f });

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
  assert.match(html, /id="secObesidad"/);
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
  assert.match(portada, /cinco padecimientos/);
  assert.match(portada, /class="disease-card disease-card--obe[^"]*" href="obesidad\.html"/);
});

test('la página de Obesidad acepta la serie pedida desde la galería', () => {
  assert.match(leer('obesidad.html'), /URLSearchParams\(location\.search\)\.get\('serie'\)/);
  assert.match(leer('Reports/obesidad_galeria.js'), /\.\.\/obesidad\.html\?serie=/);
});
