// Portada (piloto nov-2026): presupuesto de red de la vista previa, caché/reintento, bandas,
// paleta accesible, anclas de noticias, orden de secciones, enlaces y contratos conservados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { seriesSlot } from '../Reports/galeria_core.mjs';
import { buildCatalog } from '../scripts/build_dashboard_catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const HOME = leer('index.html');
const HERO = JSON.parse(leer('hero_series.json'));
const { catalog } = buildCatalog(root);

const ctx = { console, Map, Promise };
vm.createContext(ctx);
vm.runInContext(`${leer('epibot/js/release_catalog.js')}\n${leer('assets/site/nota-ancla.js')}\n${leer('home-preview.js')}`, ctx);
const P = ctx.EpiPreview;
const RELEASES = ctx.EPI_CATALOGO.releases.map((r) => ({ id: r.id, label: r.nombreCorto, cie: r.cie }));

function fakeFetch({ fallos = new Set() } = {}) {
  const pedidas = [];
  const fn = async (url) => {
    pedidas.push(url);
    if (url === 'hero_series.json') return HERO;
    const m = /^publication\/([a-z0-9_]+)\/vista\.json$/.exec(url);
    if (!m) throw new Error(`URL inesperada ${url}`);
    if (fallos.has(m[1])) { fallos.delete(m[1]); throw new Error('HTTP 503'); }
    return JSON.parse(leer(url));
  };
  fn.pedidas = pedidas;
  return fn;
}

test('presupuesto: al cargar, sólo hero_series.json y CERO vista.json; 40 opciones', async () => {
  const f = fakeFetch();
  const m = P.crearModelo({ fetchJson: f, releases: RELEASES });
  const grupos = await m.iniciar();
  assert.deepEqual(f.pedidas, ['hero_series.json']);
  assert.equal(grupos[0].items.length + grupos[1].items.length, catalog.diseases.length);
  const legacy = await m.seleccionar(grupos[0].items[0].value);
  assert.equal(legacy.serie.key, 'depresion');
  assert.deepEqual(f.pedidas, ['hero_series.json'], 'la cohorte original no pide vistas');
});

test('presupuesto: una vista por release elegido, cacheada; un fallo se olvida y «Reintentar» la pide otra vez', async () => {
  const f = fakeFetch({ fallos: new Set(['asma_j45']) });
  const m = P.crearModelo({ fetchJson: f, releases: RELEASES });
  await m.iniciar();
  const ok = await m.seleccionar('release:obesidad');
  assert.equal(ok.serie.fuente, 'publication/obesidad/vista.json');
  await m.seleccionar('release:obesidad');
  assert.equal(f.pedidas.filter((u) => u.includes('obesidad')).length, 1, 'segunda vez desde caché');
  const err = await m.seleccionar('release:asma_j45');
  assert.match(err.error.message, /503/);
  const retry = await m.seleccionar('release:asma_j45');
  assert.equal(retry.serie.key, 'asma_j45');
  assert.equal(f.pedidas.filter((u) => u.includes('asma')).length, 2, 'el fallo no quedó en caché');
});

test('respuestas viejas: una selección superada llega marcada como stale', async () => {
  const f = fakeFetch();
  const m = P.crearModelo({ fetchJson: f, releases: RELEASES });
  await m.iniciar();
  const lenta = m.seleccionar('release:diabetes_t2');
  const rapida = m.seleccionar('legacy:dengue');
  const [a, b] = await Promise.all([lenta, rapida]);
  assert.equal(a.stale, true);
  assert.equal(b.stale, false);
});

test('bandas: sólo con intervalo_disponible === true; los releases nunca llevan banda', async () => {
  for (const s of HERO.series) {
    const x = P.serieLegacy(s);
    if (s.intervalo_disponible !== true) { assert.equal(x.lo, null); assert.equal(P.bandaPermitida(x), false); }
  }
  const forzada = P.serieLegacy({ ...HERO.series[1], intervalo_disponible: false, lo: [1, 2], hi: [3, 4] });
  assert.equal(P.bandaPermitida(forzada), false, 'lo/hi se ignoran sin bandera');
  const rel = P.serieRelease(JSON.parse(leer('publication/obesidad/vista.json')), { id: 'obesidad', label: 'Obesidad', cie: 'E66' });
  assert.equal(P.bandaPermitida(rel), false);
  assert.equal(rel.emitido, '2026-07-25T04:55:28.423845+00:00');
  assert.equal(P.serieLegacy(HERO.series[0]).emitido, null, 'emisión no documentada: null, no inventada');
});

test('paleta presentacional: tokens con contraste ≥ 3:1 sobre el fondo y misma clave → mismo color en portada y galería', () => {
  const css = leer('assets/site/site.css');
  const tok = (n) => {
    const h = css.match(new RegExp(`--${n}:\\s*(#[0-9a-f]{6}|#[0-9a-f]{3})\\b`, 'i'))[1];
    return h.length === 4 ? `#${[...h.slice(1)].map((c) => c + c).join('')}` : h;
  };
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const palette = Array.from({ length: 8 }, (_, i) => tok(`series-${i + 1}`));
  assert.deepEqual(palette, [...P.PALETTE_FALLBACK], 'el respaldo del canvas es la misma paleta');
  for (const c of palette) for (const bg of [tok('paper'), tok('white')]) assert.ok(ratio(c, bg) >= 3, `${c} sobre ${bg}: ${ratio(c, bg).toFixed(2)}`);
  for (const n of ['ink', 'body', 'muted', 'green']) assert.ok(ratio(tok(n), tok('paper')) >= 4.5, `texto --${n}`);
  for (const d of catalog.diseases) assert.equal(P.slotFor(d.id), seriesSlot(d.id), d.id);
  assert.doesNotMatch(leer('home-preview.js'), /s\.color\b/, 'el color de los datos no se usa');
});

test('enlaces de la vista previa a la Galería: IDs del catálogo del dashboard', () => {
  const ids = new Set(catalog.diseases.map((d) => d.id));
  for (const s of HERO.series) assert.ok(ids.has(s.key), s.key);
  for (const r of RELEASES) assert.ok(ids.has(r.id), r.id);
  assert.equal(P.galeriaHref({ key: 'cancer_mama_c50' }), 'Reports/index.html?p=cancer_mama_c50&s=general&t=nacional');
});

test('anclas de noticias: mismos vectores que el backend y el banner estático apunta a ellas', () => {
  const N = ctx.EpiNotas;
  const V = [
    [{ iso: '2026-11-10', title: 'Las neumonías y bronconeumonías se publican con el control estacional' }, 'nota-2026-11-10-las-neumonias-y-bronconeumonias-se-publican-con'],
    [{ iso: '2026-09-03', title: 'EpiForecast-MX va al Congreso Mundial de Psiquiatría, en Estocolmo' }, 'nota-2026-09-03-epiforecast-mx-va-al-congreso-mundial-de-psiquia'],
    [{ iso: '2026-05-21', title: '¿Qué es «EPI»? Ñandú — 100 % año' }, 'nota-2026-05-21-que-es-epi-nandu-100-ano'],
    [{ iso: 'x', title: '***' }, 'nota-sin-fecha-sin-titulo'],
  ];
  for (const [it, esperado] of V) assert.equal(N.notaAncla(it), esperado);
  assert.deepEqual(N.anclas([V[0][0], V[0][0]]), [V[0][1], `${V[0][1]}-2`]);
  const news = JSON.parse(leer('news.json')).items;
  const ids = N.anclas(news);
  const bloque = HOME.match(/<div class="news-banner-row" id="newsBannerRow">([\s\S]*?)\n {8}<\/div>/)[1];
  assert.deepEqual([...bloque.matchAll(/href="novedades\.html#([^"]+)"/g)].map((m) => m[1]), ids.slice(0, 3));
  assert.match(leer('novedades.html'), /assets\/site\/nota-ancla\.js/);
  assert.match(leer('novedades.html'), /window\.EpiNotas\.anclas\(d\.items\)/);
});

test('orden de la portada: Galería, EPI, Dashboard, Noticias, Congresos y después el catálogo', () => {
  const pos = ['id="hero"', 'id="epi"', 'id="dashboard"', 'id="novedades"', 'id="congresos"', 'id="diseases"', 'id="metodologia"', 'id="about"', 'id="team"'].map((s) => HOME.indexOf(s));
  assert.ok(pos.every((p) => p > 0));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos);
  const hero = HOME.slice(HOME.indexOf('id="hero"'), HOME.indexOf('<!-- home:hero:end -->'));
  assert.match(hero, /class="btn btn--primary btn--lg" href="Reports\/index\.html">Explorar pronósticos/);
  assert.match(hero, /<canvas id="hfCanvas" role="img"/);
  assert.doesNotMatch(HOME, /Tableau<\/a>|>Tableau</, 'el dashboard no se llama Tableau');
  assert.match(HOME, /href="EpiDashboard-tableau\.html">Abre el archivo histórico/);
});

test('EPI: los dos ejemplos son preguntas de prueba reales del bot, sin prellenado', () => {
  const cases = JSON.parse(leer('epibot/tests/test_cases.json'));
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const ejemplos = [...HOME.matchAll(/<p class="epi-q">«([^»]+)»<\/p>/g)].map((m) => m[1]);
  assert.equal(ejemplos.length, 2);
  for (const q of ejemplos) {
    const c = cases.find((x) => x.query === norm(q));
    assert.ok(c && c.expectedHandler !== '*', `«${q}» es un caso con handler esperado`);
  }
  const epi = HOME.slice(HOME.indexOf('id="epi"'), HOME.indexOf('<!-- home:epi:end -->'));
  assert.doesNotMatch(epi, /\?q=|data-q=|prefill/i);
});

test('congresos: WCP, MICAI y CALASS destacados, todos listados, enlaces reales y alias MICAI intacto', () => {
  const sec = HOME.slice(HOME.indexOf('id="congresos"'), HOME.indexOf('<!-- home:congresos:end -->'));
  for (const f of ['wcp2026.html', 'micai2026.html', 'calass.html', 'future_health.html', 'helix.html']) {
    assert.ok(sec.includes(`href="${f}"`), f);
    assert.ok(existsSync(resolve(root, f)), f);
  }
  assert.doesNotMatch(sec, /presentado[^<]*(WCP|MICAI|Skopje)|(WCP|MICAI|Skopje)[^<]*presentado/i, 'sin «presentado» no documentado');
  assert.ok(existsSync(resolve(root, 'micai.html')));
  assert.match(leer('netlify.toml'), /from = "\/micai\.html"\s*\n\s*to = "\/micai2026\.html"/);
});

test('catálogo: 40 tarjetas con id del catálogo, enlace a la galería, grupos en HTML válido y cifra estática al día', () => {
  const ids = new Set(catalog.diseases.map((d) => d.id));
  const cards = [...HOME.matchAll(/<article class="condition-card" data-p="([a-z0-9_]+)"/g)].map((m) => m[1]);
  assert.equal(cards.length, 40);
  assert.deepEqual(new Set(cards), ids);
  for (const id of cards) assert.ok(HOME.includes(`href="Reports/index.html?p=${id}">Ver en la galería`), id);
  const select = HOME.match(/<select id="conditionGroup">([\s\S]*?)<\/select>/)[1];
  assert.doesNotMatch(select.replace(/<option[^>]*>[^<]*<\/option>/g, ''), /\S/, 'sólo <option> cerradas, sin texto suelto');
  assert.equal(Number(HOME.match(/<b id="countPadecimientos">(\d+)<\/b>/)[1]), 4 + RELEASES.length);
});

test('enlaces relativos de la portada: todos llevan a un archivo existente', () => {
  const rotos = [];
  for (const m of HOME.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:|mailto:|#)/.test(u)) continue;
    const file = decodeURIComponent(u.split('#')[0].split('?')[0]).replace(/^\//, '');
    if (!existsSync(resolve(root, file))) rotos.push(u);
  }
  assert.deepEqual(rotos, []);
});

test('contratos conservados: banner, dateline, motor líder, knowledge sin caché y fuera bento', () => {
  assert.match(HOME, /Edición de la semana \d+, \d{4}/);
  assert.match(HOME, /id="b-motor-pct">([^<]*)<\/span>%<\/b><span>[^<]*<span id="b-motor">([^<]*)</);
  assert.match(HOME, /fetch\(\s*['"]epibot\/knowledge\.json['"]\s*,\s*\{\s*cache\s*:\s*['"]no-store['"]/);
  assert.doesNotMatch(HOME, /fetch\(['"]bento\.json['"]/);
  assert.doesNotMatch(HOME, /\son[a-z]+="/, 'sin manejadores en línea');
});

test('cada id que usan la vista previa y home.js existe en la portada', () => {
  const src = leer('home-preview.js') + leer('home.js');
  const ids = new Set([...src.matchAll(/getElementById\('([A-Za-z]+)'\)/g)].map((m) => m[1]));
  assert.ok(ids.size > 15);
  for (const id of ids) assert.ok(HOME.includes(`id="${id}"`), id);
});

test('hito 1b: textos de implementación fuera, Congresos sin duplicar y metadatos secundarios plegados', () => {
  assert.doesNotMatch(HOME, /preguntas de prueba|Escríbelas tú|Cada tarjeta resume/i);
  const sec = HOME.slice(HOME.indexOf('id="congresos"'), HOME.indexOf('<!-- home:congresos:end -->'));
  const lista = sec.slice(sec.indexOf('<ul class="congress-list">'));
  for (const f of ['wcp2026.html', 'micai2026.html', 'calass.html']) assert.ok(!lista.includes(`href="${f}"`), `la lista no repite ${f}`);
  for (const f of ['future_health.html', 'helix.html']) assert.ok(lista.includes(`href="${f}"`), f);
  const facts = [...HOME.matchAll(/<li><b[^>]*>(\d+)<\/b><span>([^<]+)<\/span><\/li>/g)].map((m) => m[2]);
  assert.deepEqual(facts, ['padecimientos', 'entidades', 'semanas']);
  const more = HOME.slice(HOME.indexOf('<details class="preview__more">'), HOME.indexOf('</details>', HOME.indexOf('<details class="preview__more">')));
  for (const id of ['pvCasos', 'pvEmision', 'pvFuente']) assert.ok(more.includes(`id="${id}"`), id);
  for (const id of ['pvEstado', 'pvCorte', 'pvObs']) assert.ok(!more.includes(`id="${id}"`), `${id} visible`);
  assert.match(HOME, /<section class="home-radar"[\s\S]*?id="acceso-radar-boletin"/, 'Radar en fila propia');
});

test('hito 1b: knowledge.json sólo al abrir el detalle de la cohorte (no-store conservado) y scripts diferidos en orden', () => {
  const ks = HOME.slice(HOME.indexOf('(function hydrateKpis()'), HOME.indexOf('</script>', HOME.indexOf('(function hydrateKpis()')));
  assert.match(ks, /fetch\('epibot\/knowledge\.json', \{ cache: 'no-store' \}\)/);
  assert.match(ks, /addEventListener\('toggle'/);
  assert.ok(ks.indexOf("addEventListener('toggle'") > ks.indexOf('function cargar()'), 'la petición vive dentro de cargar()');
  const srcs = [...HOME.matchAll(/<script defer src="([^"?]+)\?v=\d+"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(srcs, ['epibot/js/release_catalog.js', 'assets/site/nota-ancla.js', 'assets/site/site-nav.js', 'home-preview.js', 'home.js']);
});

test('bordes de controles ≥ 3:1 sobre los fondos donde se usan; separadores aparte', () => {
  const css = leer('assets/site/site.css');
  const hex = (n) => css.match(new RegExp(`--${n}:\\s*(#[0-9a-f]{6})`, 'i'))[1];
  const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const bg of ['#ffffff', hex('paper'), hex('tint'), hex('mint')]) assert.ok(ratio(hex('control-border'), bg) >= 3, bg);
  for (const f of ['assets/site/site.css', 'home.css', 'Reports/gallery.css']) {
    const t = leer(f);
    for (const m of t.matchAll(/(input|select|\.btn--ghost|\.g-view|site-nav__toggle)[^{]*\{[^}]*border[^;]*var\(--line-strong\)/g)) assert.fail(`${f}: control con borde de separador: ${m[0].slice(0, 60)}`);
  }
});

test('anclas antiguas de la portada: #reportes y #pipeline vuelven a existir (enlaces entrantes vivos)', () => {
  for (const id of ['hero', 'diseases', 'metodologia', 'about', 'team', 'mundial', 'novedades', 'congresos', 'reportes', 'pipeline']) {
    assert.ok(HOME.includes(`id="${id}"`), id);
  }
  // Todo enlace del sitio a una sección de la portada apunta a un id que existe (la barra vieja del
  // archivo Tableau, que enlazaba #pipeline, se retiró en el hito 3; el alias sigue vivo).
  const paginas = JSON.parse(leer('assets/site/shell.config.json')).pages.map((p) => p.path);
  let vistos = 0;
  for (const pg of paginas) {
    const prefijo = pg.includes('/') ? '../'.repeat(pg.split('/').length - 1) : '';
    for (const m of leer(pg).matchAll(new RegExp(`href="${prefijo.replace(/\./g, '\\.')}index\\.html#([\\w-]+)"`, 'g'))) {
      vistos += 1;
      assert.ok(HOME.includes(`id="${m[1]}"`), `${pg}: index.html#${m[1]}`);
    }
  }
  assert.ok(vistos > 0);
});
