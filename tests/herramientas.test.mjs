// Herramientas migradas al sistema común (hito 2): Dashboard bajo su CSP, Radar del boletín y EpiBot
// con la variante app. Se comprueba el chrome y que las funciones locales y sus enganches siguen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const block = (html, name) => html.slice(html.indexOf(`<!-- site:${name}:start -->`), html.indexOf(`<!-- site:${name}:end -->`));

test('Dashboard: shell bajo la CSP estricta (sólo recursos propios, sin estilos ni scripts en línea)', () => {
  const html = leer('EpiDashboard.html');
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self'/);
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)) {
    assert.doesNotMatch(m[1], /^(https?:)?\/\//, `recurso externo ${m[1]}`);
    assert.ok(existsSync(resolve(root, m[1].split('?')[0])), m[1]);
  }
  assert.doesNotMatch(html, /<script>(?!\s*<\/script>)|<style>|\sstyle="/, 'nada en línea');
  assert.ok(html.indexOf('assets/site/site.css') < html.indexOf('assets/dashboard/dashboard.css'));
  assert.match(block(html, 'header'), /<a href="EpiDashboard\.html" aria-current="page">Dashboard<\/a>/);
  assert.doesNotMatch(html, /class="sitenav"|class="colophon"/, 'sin la barra ni el colofón viejos');
  // El tablero conserva su cabecera propia de herramienta y su arranque oculto.
  assert.match(html, /<h1 id="titulo">Dashboard <em>epidemiológico<\/em><\/h1>/);
  assert.match(html, /id="dash" hidden/);
  const css = leer('assets/dashboard/dashboard.css');
  assert.doesNotMatch(css, /\.site-header__inner \{|\.sitenav|\.colophon|\.brand-symbol/, 'sin reglas de chrome que peleen con el shell');
  assert.doesNotMatch(css, /border: 1px solid var\(--line-strong\);\s*border-radius: 6px;\s*\n?\s*background-color: var\(--white\)/, 'campos con borde AA');
});

test('Radar: shell común; el pie de cobertura dinámico y los enganches del radar siguen', () => {
  const html = leer('boletin.html');
  assert.match(block(html, 'header'), /<a href="boletin\.html" aria-current="page">Radar del boletín<\/a>/);
  assert.doesNotMatch(html, /class="radar-main-nav"|class="radar-brand"/);
  assert.match(html, /<footer class="radar-footer">[\s\S]*data-radar="semana"[\s\S]*<\/footer>\n<\/main>\n<!-- site:footer:start -->/);
  for (const id of ['detail', 'closeDetail', 'detailContent', 'error', 'metrics', 'search', 'group', 'status', 'priority', 'sort', 'prev', 'next', 'chartMetric']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.ok(html.indexOf('assets/site/site.css') < html.indexOf('/assets/boletin/radar.css'));
  assert.doesNotMatch(leer('assets/boletin/radar.css'), /\.radar-main-nav|\.nav-inner|\.radar-brand/);
});

test('EpiBot: barra compacta (variante app) sin pie; chat, panel, compositor y atajos intactos', () => {
  const html = leer('epibot/index.html');
  const head = block(html, 'header');
  assert.match(head, /<header class="site-header site-header--app" id="nav" lang="es">/);
  assert.match(head, /<a href="index\.html" aria-current="page">EpiBot<\/a>/);
  assert.ok(!html.includes('<!-- site:footer:start -->'));
  // La barra va ANTES de la app (columna flex de alto completo): el compositor sigue a la vista.
  assert.ok(html.indexOf('<!-- site:header:end -->') < html.indexOf('<div class="cc">'));
  for (const id of ['ccSidebar', 'ccMenuBtn', 'chatArea', 'inputField', 'resetBtn', 'ttsMuteBtn', 'startupStatus', 'sidebarClose']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  // Los recursos compartidos van SIN ?v=: bump-cache sólo versiona recursos de epibot/ y un «../»
  // con ?v= le exigiría subidas espurias; /assets/site/* se sirve con must-revalidate.
  assert.match(html, /<link rel="stylesheet" href="\.\.\/assets\/site\/site\.css">/);
  assert.match(html, /<script src="\.\.\/assets\/site\/site-nav\.js" defer><\/script>/);
  assert.doesNotMatch(html, /\.\.\/assets\/site\/[^"]+\?v=/);
  assert.ok(html.indexOf('../assets/site/site.css') < html.indexOf('css/style.css'), 'las reglas de EPI ganan a las comunes');
  // B1: el overlay del cajón vive DENTRO de .cc (antes del panel) y .cc sube de capa con el cajón
  // abierto; así el cajón (z 1001) queda sobre su overlay y sobre la barra común (z 60).
  const cc = html.slice(html.indexOf('<div class="cc">'), html.indexOf('<aside class="cc-sidebar"'));
  assert.match(cc, /<div class="cc-overlay" id="ccOverlay"><\/div>/);
  assert.equal((html.match(/id="ccOverlay"/g) || []).length, 1);
  assert.match(leer('epibot/js/ux.js'), /classList\.toggle\('cc--drawer-open', open\)/);
  const shell = leer('epibot/css/shell.css');
  assert.match(shell, /@media \(max-width: 1024px\) \{ \.cc:has\(\.cc-sidebar\.open\), \.cc\.cc--drawer-open \{ z-index: 70; \} \}/);
  const base = shell.slice(0, shell.indexOf('/* ═══════════ PROMPT MENU'));
  assert.doesNotMatch(base, /rgba\(24, 34, 58|rgba\(14, 20, 36|hairline aurora/, 'chrome de la app sin la capa oscura heredada');
  assert.doesNotMatch(shell, /#61756c/i, 'texto atenuado con contraste AA sobre el panel');
  assert.match(shell, /\.site-header--app ~ \.cc \.cc-brand \{ display: none; \}/);
  assert.match(shell, /body\.keyboard-open \.site-header--app \{ display: none; \}/);
});

test('EPI a 360: «Herramientas» (panel) se distingue de «Menú» (plataforma) y un solo manejador del cajón', () => {
  const html = leer('epibot/index.html');
  const boton = /<button[^>]*id="ccMenuBtn"[^>]*>([\s\S]*?)<\/button>/.exec(html);
  assert.ok(boton, 'botón del panel');
  assert.match(boton[1], /<span class="cc-menu-btn__text">Herramientas<\/span>/, 'rótulo visible');
  assert.doesNotMatch(boton[0], /aria-label=/, 'el nombre accesible es el rótulo visible');
  assert.match(boton[0], /aria-controls="ccSidebar" aria-expanded="false"/);
  // Ni el panel ni las consultas sugeridas usan el icono de hamburguesa del menú de la plataforma.
  const hamburguesa = /<line x1="\d+" y1="6" x2="\d+" y2="6"\/>\s*<line x1="\d+" y1="12"/;
  assert.doesNotMatch(boton[1], hamburguesa);
  assert.doesNotMatch(/<button class="prompt-toggle"[\s\S]*?<\/button>/.exec(html)[0], hamburguesa);
  // El cajón se maneja sólo en ux.js (antes había otro manejador en línea en index.html).
  const enLinea = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(enLinea, /ccMenuBtn|ccSidebar|ccOverlay/);
  const ux = leer('epibot/js/ux.js');
  assert.equal((ux.match(/menu\.addEventListener\('click'/g) || []).length, 1);
  assert.match(ux, /if \(e\.key === 'Escape' && isOpen\(\)\) \{ setSidebar\(false, true\); return; \}/);
  assert.match(ux, /sidebar\.querySelectorAll\('\[data-q\]'\)/, 'acciones rápidas del panel');
  assert.match(html, /<script defer src="js\/ux\.js\?v=3"><\/script>/);
});

test('EPI: la promesa de fuentes es condicional y exacta (las respuestas locales no llevan citas)', () => {
  // Las citas sólo existen en la ruta de documentos (RAG): la UI de citas la prueba
  // epibot/tests/test_source_citations_ui.mjs (en `npm test`, dentro del build) y Root con un fixture
  // NDJSON en navegador. Un handler local (p. ej. «pronóstico de depresión en Jalisco») responde sin
  // fuentes, así que ningún texto puede prometerlas sin condición.
  const home = leer('index.html');
  assert.match(home, /<p>Responde con los pronósticos y datos publicados en este sitio\. Cuando responde desde los documentos del estudio, cita sus fuentes\. No es consejo médico\.<\/p>/);
  // Sin distinguir mayúsculas: el saludo de EPI (app.js) usaba «PRONÓSTICOS CON FUENTES».
  for (const f of ['index.html', 'epibot/index.html', 'epibot/js/app.js']) {
    assert.doesNotMatch(leer(f), /muestra sus fuentes|consulta las fuentes|pronósticos con fuentes|siempre cita/i, f);
  }
  assert.match(leer('epibot/js/app.js'), /DATOS DEL SINAVE · PRONÓSTICOS PUBLICADOS/);
  // app.js cambió: su ?v= en epibot/index.html debe ser el subido (cadena de caché del EpiBot).
  assert.match(leer('epibot/index.html'), /<script type="module" src="js\/app\.js\?v=191"><\/script>/);
});
