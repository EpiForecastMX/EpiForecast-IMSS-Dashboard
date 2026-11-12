// Cabecera y pie comunes (assets/site/shell.config.json + scripts/site_shell.mjs) sobre el manifiesto
// completo: familias, variante app, autoinscripción de fichas, alta y regeneración de una ficha.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, cpSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import {
  validateConfig, renderHeader, renderFooter, stamp, buildPages, hrefFrom, manifest, resolvePage, renderFragments, releasePages,
  CONFIG, FRAGMENTS,
} from '../scripts/site_shell.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const cfg = JSON.parse(leer(CONFIG));
const { pages } = manifest(root);
const block = (html, name) => html.slice(html.indexOf(`<!-- site:${name}:start -->`), html.indexOf(`<!-- site:${name}:end -->`));
// El catálogo real, cargado como lo cargan la portada y EPI (no un recuento fijo: el alta 32 no rompe).
const ctxCat = { console };
vm.createContext(ctxCat);
vm.runInContext(leer('epibot/js/release_catalog.js'), ctxCat);
const RELEASES = ctxCat.EPI_CATALOGO.releases.map((r) => r.pagina);
const SHELL_JS = 'scripts/site_shell.mjs';

test('el manifiesto cubre portada, galería, dashboard, radar, EpiBot, Dengue y las 31 fichas (autoinscritas)', () => {
  const byPath = Object.fromEntries(pages.map((p) => [p.path, p]));
  for (const [p, fam] of [['index.html', 'home'], ['Reports/index.html', 'galeria'], ['EpiDashboard.html', 'dashboard'],
    ['boletin.html', 'radar'], ['epibot/index.html', 'epibot'], ['dengue.html', 'ficha-legacy']]) assert.equal(byPath[p]?.family, fam, p);
  assert.ok(RELEASES.length > 0);
  // El parser del generador ve EXACTAMENTE las páginas del catálogo que cargan portada y EPI.
  assert.deepEqual([...releasePages(root)].sort(), [...RELEASES].sort());
  for (const r of RELEASES) assert.ok(byPath[r]?.auto && byPath[r].family === 'ficha-release', r);
});

test('autoinscripción falla cerrada: catálogo ausente o sin páginas; acepta comillas dobles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cat-'));
  try {
    assert.throws(() => releasePages(dir), /falta epibot\/js\/release_catalog\.js/);
    mkdirSync(join(dir, 'epibot/js'), { recursive: true });
    writeFileSync(join(dir, 'epibot/js/release_catalog.js'), "(function(g){ g.EPI_CATALOGO = { releases: [] }; })(globalThis);");
    assert.throws(() => releasePages(dir), /no declara ninguna `pagina`/);
    writeFileSync(join(dir, 'epibot/js/release_catalog.js'), '[{ pagina: "uno.html" }, { pagina : \'dos.html\' }]');
    assert.deepEqual(releasePages(dir), ['uno.html', 'dos.html']);
    writeFileSync(join(dir, 'epibot/js/release_catalog.js'), "[{ pagina: '../fuera.html' }]");
    assert.throws(() => releasePages(dir), /página inválida/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el generador está al día en todo el manifiesto y en los fragmentos (idempotente)', () => {
  const out = buildPages(root);
  assert.equal(out.length, pages.length + 1);
  for (const p of out) assert.equal(p.after, p.before, `${p.path} difiere de lo generado`);
  const frag = JSON.parse(leer(FRAGMENTS));
  assert.deepEqual(Object.keys(frag.families).sort(), Object.keys(cfg.families).sort());
  assert.equal(frag.families.epibot.footer, undefined, 'la variante app no lleva pie');
});

test('orden contractual, hrefs seguros y familias válidas; la config inválida falla cerrada', () => {
  assert.deepEqual(cfg.primary.map((i) => i.label), ['Galería', 'EpiBot', 'Dashboard', 'Radar del boletín', 'Noticias', 'Congresos', 'Más']);
  const swap = structuredClone(cfg);
  [swap.primary[0], swap.primary[1]] = [swap.primary[1], swap.primary[0]];
  assert.throws(() => validateConfig(swap), /orden de navegación/);
  for (const bad of ['javascript:alert(1)', '../fuera.html', '//evil.example', 'http://inseguro.example']) {
    const c = structuredClone(cfg);
    c.primary[0].href = bad;
    assert.throws(() => validateConfig(c), /inseguro/, bad);
  }
  const fam = structuredClone(cfg);
  fam.pages.push({ path: 'x.html', family: 'inexistente' });
  assert.throws(() => validateConfig(fam), /familia desconocida/);
});

test('stamp: exige exactamente una pareja de marcadores y sólo toca lo de dentro', () => {
  const html = 'antes\n<!-- site:header:start -->\nviejo\n<!-- site:header:end -->\ndespués';
  assert.equal(stamp(html, 'header', 'NUEVO'), 'antes\n<!-- site:header:start -->\nNUEVO\n<!-- site:header:end -->\ndespués');
  assert.throws(() => stamp('sin marcadores', 'header', 'x'), /0\/0/);
  assert.throws(() => stamp(html + html, 'header', 'x'), /2\/2/);
});

/** Copia mínima del sitio para ejecutar el generador real sin tocar el clon. */
function sitioTemporal() {
  const dir = mkdtempSync(join(tmpdir(), 'shell-'));
  cpSync(resolve(root, 'assets/site'), join(dir, 'assets/site'), { recursive: true });
  cpSync(resolve(root, 'scripts'), join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'epibot/js'), { recursive: true });
  cpSync(resolve(root, 'epibot/js/release_catalog.js'), join(dir, 'epibot/js/release_catalog.js'));
  for (const p of pages) { mkdirSync(dirname(join(dir, p.path)), { recursive: true }); cpSync(resolve(root, p.path), join(dir, p.path)); }
  return dir;
}
const run = (dir, ...args) => execFileSync(process.execPath, [join(dir, SHELL_JS), '--root', dir, ...args], { encoding: 'utf8', stdio: 'pipe' });

test('--check detecta una cabecera editada a mano y la escritura la repara (generador real)', () => {
  const dir = sitioTemporal();
  try {
    const f = join(dir, 'cancer_prostata_c61.html');
    writeFileSync(f, readFileSync(f, 'utf8').replace('>Galería</a>', '>Galeria editada</a>'));
    assert.throws(() => run(dir, '--check'), /cancer_prostata_c61\.html/);
    run(dir);
    assert.match(run(dir, '--check'), /archivos al día/);
    assert.equal(readFileSync(f, 'utf8'), leer('cancer_prostata_c61.html'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('alta de una ficha nueva: copiada de una base, se inscribe sola y --page la estampa sin editar el manifiesto', () => {
  const dir = sitioTemporal();
  try {
    // Simula el alta del skill: release_catalog.js gana una entrada y la página se copia de una base.
    const catPath = join(dir, 'epibot/js/release_catalog.js');
    writeFileSync(catPath, readFileSync(catPath, 'utf8').replace("\n  ]);\n", `\n    { id: 'sintetico_x', pad: 'Sintetitis', nombre: 'Sintetitis', nombreCorto: 'Sintetitis', pagina: 'sintetico_x.html', cie: 'Z99', alias: [], prefijos: [] },\n  ]);\n`));
    const base = leer('asma_j45.html');
    const vacia = base.replace(/<!-- site:header:start -->[\s\S]*?<!-- site:header:end -->/, '<!-- site:header:start -->\n<!-- site:header:end -->')
      .replace(/<!-- site:footer:start -->[\s\S]*?<!-- site:footer:end -->/, '<!-- site:footer:start -->\n<!-- site:footer:end -->');
    writeFileSync(join(dir, 'sintetico_x.html'), vacia);
    assert.throws(() => run(dir, '--check'), /sintetico_x\.html/, 'una ficha sin estampar hace fallar el build');
    run(dir, '--page', 'sintetico_x.html');
    const nueva = readFileSync(join(dir, 'sintetico_x.html'), 'utf8');
    assert.ok(block(nueva, 'header').includes('<a href="Reports/index.html" aria-current="true">Galería</a>'));
    assert.ok(block(nueva, 'footer').includes('<footer class="site-footer" lang="es">'));
    assert.match(run(dir, '--check'), /archivos al día/);
    // Sólo se escribió el archivo pedido.
    for (const p of pages) assert.equal(readFileSync(join(dir, p.path), 'utf8'), leer(p.path), p.path);
    // Una ficha del catálogo SIN marcadores falla con un mensaje claro.
    writeFileSync(join(dir, 'sintetico_x.html'), base.replace(/<!-- site:header:start -->[\s\S]*?<!-- site:header:end -->/, ''));
    assert.throws(() => run(dir, '--page', 'sintetico_x.html'), /sintetico_x\.html: marcadores site:header 0\/0/);
    assert.throws(() => run(dir, '--page', 'otra.html'), /no está en el manifiesto/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('rutas relativas según la profundidad y anclas de la propia página', () => {
  assert.equal(hrefFrom('index.html', 'Reports/index.html'), 'Reports/index.html');
  assert.equal(hrefFrom('Reports/index.html', 'boletin.html'), '../boletin.html');
  assert.equal(hrefFrom('index.html', 'index.html#congresos'), '#congresos');
  assert.equal(hrefFrom('Reports/index.html', 'index.html#congresos'), '../index.html#congresos');
  assert.equal(hrefFrom('Reports/index.html', 'Reports/index.html'), 'index.html');
  assert.equal(hrefFrom('epibot/index.html', 'epibot/index.html'), 'index.html');
});

test('en cada página: enlaces existentes, mismo orden escritorio/móvil, CSP, script de navegación y current correcto', () => {
  for (const page of pages) {
    const p = resolvePage(cfg, page);
    const html = leer(p.path);
    const head = block(html, 'header');
    const foot = p.variant === 'app' ? '' : block(html, 'footer');
    for (const m of (head + foot).matchAll(/href="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https:|#)/.test(u)) continue;
      assert.ok(existsSync(resolve(root, dirname(p.path), u.split('#')[0])), `${p.path}: ${u}`);
    }
    const desk = head.slice(head.indexOf('<ul class="nav-menu">'), head.indexOf('</nav>'));
    const mob = head.slice(head.indexOf('id="navMobile"'));
    const hrefs = (s) => [...s.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs(mob), hrefs(desk), `${p.path}: mismo orden`);
    assert.doesNotMatch(head + foot, /<script|\son[a-z]+=|style="/, `${p.path}: compatible con CSP`);
    assert.match(html, /<script (?:defer )?src="(?:\.\.\/)?assets\/site\/site-nav\.js(?:\?v=\d+)?"(?: defer)?><\/script>/, p.path);
    assert.match(head, /<header class="site-header(?: site-header--app| site-header--static)?" id="nav" lang="es">/);
    if (p.variant === 'app') assert.ok(!html.includes('<!-- site:footer:start -->'), `${p.path}: sin pie`);
    else assert.match(foot, /<a href="#nav">Volver arriba ↑<\/a>/);
    const cur = [...head.matchAll(/aria-current="(page|true)"/g)].map((m) => m[1]);
    const grupo = cfg.primary.find((it) => it.id === p.current && it.children);
    const propia = cfg.primary.flatMap((it) => it.children ?? []).some((c) => c.href === p.path);
    if (p.current === 'inicio') assert.deepEqual(cur, ['page']);
    else if (grupo) {
      // Sección de un grupo: el botón y el rótulo móvil lo marcan; si la página está en el grupo, su enlace es la página actual.
      assert.match(head, new RegExp(`aria-controls="navGroup-${grupo.id}" data-current="">`), p.path);
      assert.match(head, new RegExp(`<p class="nav-mobile-group" data-current="">${grupo.label}</p>`), p.path);
      assert.deepEqual(cur, propia ? ['page', 'page'] : [], p.path);
    } else if (p.current) assert.deepEqual(cur, p.currentKind === 'section' ? ['true', 'true'] : ['page', 'page'], p.path);
    else assert.deepEqual(cur, propia ? ['page', 'page'] : [], p.path);
  }
});

test('la cabecera de la portada conserva los contratos de WCP y Radar', () => {
  const home = leer('index.html');
  assert.match(home, /<ul class="nav-menu">[\s\S]*?href="wcp2026.html"/);
  assert.match(home, /<div class="nav-mobile-items\b[^"]*">[\s\S]*?href="wcp2026.html"/);
  assert.match(home.slice(home.indexOf('id="navMobile"'), home.indexOf('<main')), /href="boletin.html"/);
});

test('disclosures accesibles, menú móvil con aria-expanded y fragmentos para el backend', () => {
  const page = resolvePage(cfg, { path: 'index.html', family: 'home' });
  const head = renderHeader(cfg, page);
  for (const g of ['congresos', 'mas']) {
    assert.match(head, new RegExp(`<button type="button" class="nav-group__toggle" aria-expanded="false" aria-controls="navGroup-${g}">`));
  }
  assert.match(head, /class="site-nav__toggle" aria-controls="navMobile" aria-expanded="false"/);
  assert.match(renderFooter(cfg, resolvePage(cfg, { path: 'Reports/index.html', family: 'galeria' })), /href="\.\.\/EpiDashboard-tableau\.html">Archivo Tableau \(corte W31\)</);
  const frag = JSON.parse(renderFragments(cfg));
  assert.match(frag.families['ficha-release'].header, /<a href="Reports\/index\.html" aria-current="true">Galería<\/a>/);
  assert.doesNotMatch(frag.families.editorial.header, /aria-current/);
});

test('CSS del shell: menú móvil con altura máxima, header estático sin JS y marca aislada de --gold', () => {
  const css = leer('assets/site/site.css');
  assert.match(css, /\.site-header \{ position: static;/);
  assert.match(css, /\.site-header\[data-enhanced\] \.site-nav__mobile \{ max-height: calc\(100vh - var\(--site-header-h, 68px\)\);[^}]*overflow-y: auto;/);
  assert.match(css, /\.site-brand__symbol span \{[^}]*color: var\(--brand-gold\)/);
  // La sección actual (aria-current="true", p. ej. «Galería» en una ficha) se ve como la página actual.
  assert.match(css, /\.nav-menu > li > a:is\(\[aria-current="page"\], \[aria-current="true"\]\), \.nav-group__toggle\[data-current\] \{/);
  assert.match(css, /\.nav-mobile-link:is\(\[aria-current="page"\], \[aria-current="true"\]\) \{/);
  assert.match(css, /\.site-header--app\[data-enhanced\] \.site-nav__mobile:not\(\[hidden\]\) \{ position: absolute;/);
});

test('Netlify: test:site tras construir el catálogo, epibot npm test antes del deploy y revalidación de assets', () => {
  const toml = leer('netlify.toml');
  const cmd = toml.match(/^command = "([^"]+)"/m)[1];
  assert.ok(cmd.indexOf('npm run test:dashboard') < cmd.indexOf('npm run test:site'), 'catálogo antes de las pruebas de la galería');
  assert.ok(cmd.indexOf('npm install') < cmd.indexOf('npm test') && cmd.indexOf('npm test') < cmd.indexOf('deploy:verify'), 'epibot npm test con sus dependencias, antes del deploy');
  for (const pat of ['/Reports/*.mjs', '/assets/site/*']) {
    assert.match(toml, new RegExp(`for = "${pat.replace(/[*/.]/g, (c) => `\\${c}`)}"\\s*\\n\\s*\\[headers\\.values\\]\\s*\\n\\s*Cache-Control = "public, max-age=0, must-revalidate"`), pat);
  }
});

// --- Hito 3: productores del backend, recursos versionados y familias editoriales -------------

const FRAG = JSON.parse(leer(FRAGMENTS));
const conProductor = cfg.pages.filter((p) => p.productor);

test('cada página con productor que estampa reproduce el fragmento de su familia (render real = proxy de raíz)', () => {
  const estampan = conProductor.filter((p) => p.productor.chrome).map((p) => p.path).sort();
  assert.deepEqual(estampan, ['bitacora_modelado.html', 'comparacion_modelos.html', 'reporte_resultados.html', 'validacion_semanal.html']);
  for (const p of conProductor.filter((x) => x.productor.chrome)) {
    const page = resolvePage(cfg, p);
    const html = leer(p.path);
    const fam = FRAG.families[p.family];
    assert.equal(renderHeader(cfg, page), fam.header, p.path);
    assert.equal(renderFooter(cfg, page), fam.footer, p.path);
    assert.ok(html.includes(`<!-- site:header:start -->\n${fam.header}\n<!-- site:header:end -->`), p.path);
    assert.ok(html.includes(`<!-- site:footer:start -->\n${fam.footer}\n<!-- site:footer:end -->`), p.path);
  }
});

test('la portada no es el proxy de su familia (anclas propias): por eso su productor no estampa chrome', () => {
  const home = resolvePage(cfg, cfg.pages.find((p) => p.path === 'index.html'));
  assert.notEqual(renderHeader(cfg, home), FRAG.families.home.header);
  assert.match(renderHeader(cfg, home), /href="#congresos"/);
  assert.equal(cfg.pages.find((p) => p.path === 'index.html').productor.chrome, false);
  // Si alguien la declarara como estampada por el backend, el generador falla cerrado.
  const tmp = mkdtempSync(join(tmpdir(), 'shell-prod-'));
  try {
    cpSync(root, tmp, { recursive: true, filter: (s) => !/node_modules|\.git$|\/\.git\//.test(s) });
    const c = JSON.parse(readFileSync(join(tmp, CONFIG), 'utf8'));
    c.pages.find((p) => p.path === 'index.html').productor.chrome = true;
    writeFileSync(join(tmp, CONFIG), JSON.stringify(c));
    assert.throws(() => buildPages(tmp), /index\.html: su header difiere del fragmento de la familia home/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  const malo = structuredClone(cfg);
  malo.pages.find((p) => p.path === 'reporte_resultados.html').productor = { script: 'x' };
  assert.throws(() => validateConfig(malo), /productor inválido/);
  const anida = structuredClone(cfg);
  anida.pages.push({ path: 'Reports/x.html', family: 'editorial', productor: { script: 'x', chrome: true } });
  assert.throws(() => validateConfig(anida), /sólo puede escribir páginas de la raíz/);
});

test('familias explícitas: Noticias page, Congresos section; un current por página se rechaza', () => {
  assert.deepEqual([cfg.families.noticias.current, cfg.families.noticias.currentKind], ['noticias', 'page']);
  assert.deepEqual([cfg.families.congresos.current, cfg.families.congresos.currentKind], ['congresos', 'section']);
  assert.equal(cfg.families.editorial.current, null);
  for (const extra of [{ current: 'galeria' }, { currentKind: 'section' }]) {
    const c = structuredClone(cfg);
    Object.assign(c.pages.find((p) => p.path === 'novedades.html'), extra);
    assert.throws(() => validateConfig(c), /se declaran en la familia/);
  }
  const k = structuredClone(cfg);
  k.families.congresos.currentKind = 'otra';
  assert.throws(() => validateConfig(k), /currentKind inválido/);
  const d = structuredClone(cfg);
  d.families.congresos.current = 'inexistente';
  assert.throws(() => validateConfig(d), /current desconocido/);
  assert.match(leer('calass.html'), /<button type="button" class="nav-group__toggle"[^>]*data-current=""[^>]*>Congresos<\/button>/);
  assert.doesNotMatch(block(leer('validacion_semanal.html'), 'header'), /aria-current/);
});

test('recursos comunes: una sola versión por recurso (la del manifiesto) en todas las páginas de la raíz y de Reports', () => {
  const ver = cfg.assets;
  assert.deepEqual(FRAG.assets, ver);
  for (const p of pages.filter((x) => !x.path.startsWith('epibot/'))) {
    const html = leer(p.path);
    for (const [ruta, v] of Object.entries(ver)) {
      const rel = hrefFrom(p.path, ruta).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const m of html.matchAll(new RegExp(`(?:href|src)="${rel}(\\?v=[^"]*)?"`, 'g'))) {
        assert.equal(m[1], `?v=${v}`, `${p.path}: ${ruta}${m[1] ?? ''}`);
      }
    }
  }
  // EpiBot: los compartidos sin ?v (la cadena de caché sólo versiona epibot/; Netlify revalida /assets/site/*).
  const epi = leer('epibot/index.html');
  assert.match(epi, /href="\.\.\/assets\/site\/site\.css"/);
  assert.doesNotMatch(epi, /\.\.\/assets\/site\/[^"]+\?v=/);
  assert.match(leer('netlify.toml'), /for = "\/assets\/site\/\*"[\s\S]*?must-revalidate/);
});

test('páginas editoriales/noticias/congresos/archivo: sin barra ni tema viejos, sistema común en orden', () => {
  const corpus = new Set([...leer('epibot/scripts/lib/corpus.mjs').split('HTML_NOTES = [')[1].split('];')[0].matchAll(/file: '([^']+)'/g)].map((m) => m[1]));
  const fams = new Set(['editorial', 'noticias', 'congresos', 'archivo']);
  const sel = cfg.pages.filter((p) => fams.has(p.family));
  assert.equal(sel.length, 22);
  for (const p of sel) {
    const html = leer(p.path);
    assert.doesNotMatch(html, /<nav class="nav" id="nav">|id="navMobile" class="nav-mobile"|fonts\.googleapis|editorial\.css\?v=1"/, p.path);
    assert.match(html, /<body[^>]*class="[^"]*editorial-page/, p.path);
    const iSite = html.indexOf('assets/site/site.css?v='), iEd = html.indexOf('editorial.css?v=');
    assert.ok(iSite > 0 && iEd > iSite, `${p.path}: site.css antes que editorial.css`);
    assert.ok(html.lastIndexOf('</style>', html.indexOf('</head>')) < iSite, `${p.path}: tras el <style> en línea`);
    assert.match(html, /<a class="skip" href="#[\w-]+">Saltar al contenido<\/a>/, p.path);
    const destino = /<a class="skip" href="#([\w-]+)">/.exec(html)[1];
    assert.match(html, new RegExp(`id="${destino}"`), p.path);
    if (html.includes('class="legacy-colophon')) assert.ok(corpus.has(p.path), `${p.path}: colofón sólo en páginas del corpus`);
    assert.match(html, /<html lang="es"/, p.path);
  }
  const css = leer('editorial.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /background:\s*#0|#0e1424|#131c30/i);
  assert.match(css, /min-width: 0/);
  assert.match(css, /overflow-x: auto/);
});

test('editoriales: el CSS propio no alcanza el chrome, barras locales bajo la cabecera y sin restos del template', () => {
  const fams = new Set(['editorial', 'noticias', 'congresos', 'archivo']);
  for (const p of cfg.pages.filter((x) => fams.has(x.family))) {
    const html = leer(p.path);
    const estilos = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
    // Selectores sólo de tipo (a, p, *…) acotados fuera del chrome; ninguno contradictorio o muerto.
    for (const m of estilos.matchAll(/(?:^|[}{;])\s*((?:a|p|\*)(?::hover)?)\s*\{/gm)) assert.fail(`${p.path}: «${m[1]}» sin acotar alcanza cabecera/pie`);
    assert.doesNotMatch(estilos, /(nav|header|footer):not\(\.site-\1\)(?:\.[\w-]+)*\.site-\1\b/, p.path);
    assert.doesNotMatch(html, /class="legacy-colophon[^"]*\b(site-footer|footer)\b/, `${p.path}: el colofón no es un pie`);
    assert.doesNotMatch(html, /<a\b[^>]*class="skip-link"/, `${p.path}: un solo enlace de salto`);
    assert.doesNotMatch(estilos, /padding-top:\s*64px/, `${p.path}: sin el hueco de la barra fija vieja`);
    // Barras pegajosas propias (no cabeceras de tabla): debajo de la cabecera común en capa y posición.
    for (const m of estilos.matchAll(/([^{}]+)\{([^{}]*position:\s*sticky[^{}]*)\}/g)) {
      const z = /z-index:\s*(\d+)/.exec(m[2]);
      if (z) assert.ok(+z[1] < 30, `${p.path}: ${m[1].trim()} z-index ${z[1]} ≥ cabecera`);
      if (!/\b(th|thead|td|tr)\b/.test(m[1])) assert.match(m[2], /top:\s*(var|calc)\(/, `${p.path}: ${m[1].trim()} no considera la cabecera`);
    }
  }
  const site = leer('assets/site/site.css');
  assert.match(site, /footer\.site-footer a, footer\.site-footer a:visited, footer\.site-footer a:hover \{ color: #fff; \}/);
  assert.match(site, /footer\.site-footer \.site-brand__mx \{ color: var\(--brand-gold\); \}/);
  const ed = leer('editorial.css');
  assert.match(ed, /:where\(\.editorial-page\) a \{/, 'los enlaces del contenido no ganan a los del chrome por especificidad');
  assert.doesNotMatch(ed, /^\.editorial-page a\b/m);
  // Visores PDF: la barra del visor (página/zoom) queda fija justo bajo la cabecera común; la del
  // documento se desplaza (antes se solapaban con el desplazamiento heredado de 54 px).
  assert.match(ed, /\.editorial-page #toolbar\.toolbar \{ top: var\(--site-header-h, 0px\); \}/);
  assert.match(ed, /\.editorial-page header:not\(\.site-header\):has\(> \.head-row\) \{ position: relative; \}/);
  assert.match(leer('assets/site/site-nav.js'), /setProperty\('--site-header-h'/);
});

test('micrositios: excepción de identidad acotada (cuerpo, idioma y hoja propios) con chrome común', () => {
  const fam = cfg.families['micrositio-congreso'];
  assert.equal(fam.variant, 'micrositio');
  assert.ok(fam.excepcion && fam.excepcion.length > 20);
  const micro = cfg.pages.filter((p) => p.family === 'micrositio-congreso').map((p) => p.path).sort();
  assert.deepEqual(micro, ['micai2026-guion.html', 'micai2026.html', 'wcp2026.html']);
  for (const p of micro) {
    const html = leer(p);
    assert.match(html, /<html lang="en"/, p);
    assert.match(html, /<header class="site-header site-header--static" id="nav" lang="es">/, p);
    assert.match(html, /<footer class="site-footer" lang="es">/, p);
    // La hoja propia (archivo sellado o <style> en línea del guion) va después: gana por orden.
    const propia = html.search(/(wcp|micai)\.css|<style>/);
    assert.ok(propia > 0 && html.indexOf('assets/site/site.css?v=') < propia, `${p}: la hoja propia gana por orden`);
    assert.match(html, /<script src="assets\/site\/site-nav\.js\?v=\d+"><\/script>\s*<\/body>/, p);
  }
});

test('scripts viejos conservados en las páginas no pueden enganchar el chrome común', () => {
  // Las páginas migradas conservan su JS (contadores, revelado, toc) con restos de la barra vieja:
  // .nav-group-toggle (guion simple), .nav-hamburger, clase «show» en #navMobile y «scrolled» en #nav.
  // El shell usa .nav-group__toggle (BEM) y atributos, y ni site.css ni site-nav.js leen esas clases.
  const shell = JSON.stringify(FRAG.families);
  assert.doesNotMatch(shell, /nav-group-toggle|nav-hamburger|class=\\"[^"]*\b(show|scrolled)\b/);
  for (const f of ['assets/site/site.css', 'assets/site/site-nav.js']) assert.doesNotMatch(leer(f), /\.scrolled\b|\.show\b|'scrolled'|'show'/, f);
  const viejas = cfg.pages.filter((p) => /toggleMobileNav|nav-group-toggle/.test(leer(p.path))).map((p) => p.path);
  assert.ok(viejas.length > 0);
  for (const p of viejas) assert.doesNotMatch(leer(p), /onclick="toggleMobileNav/, `${p}: sin botón viejo que lo invoque`);
});
