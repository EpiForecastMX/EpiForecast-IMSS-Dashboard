// site-nav.js: el colapso se re-mide cuando crece el TEXTO aunque el header conserve su ancho
// (ampliación sólo de texto), detecta el menú montado sobre la marca y no entra en bucle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(root, 'assets/site/site-nav.js'), 'utf8');

function harness() {
  const S = { fontPx: 16, headerW: 1280, roCallbacks: [], measures: 0, position: 'sticky', barH: 68, rootVars: {} };
  const attrs = {};
  const mk = (extra = {}) => ({ hidden: false, attributes: {}, style: { setProperty() {} },
    setAttribute(k, v) { this.attributes[k] = v; }, removeAttribute(k) { delete this.attributes[k]; },
    getAttribute(k) { return this.attributes[k] ?? null; }, addEventListener() {}, querySelector: () => null,
    querySelectorAll: () => [], classList: { toggle() {} }, contains: () => false, focus() {}, ...extra });
  const link = mk();
  const brand = mk({ getBoundingClientRect: () => ({ right: 60 + 14 * S.fontPx, height: 40 }) });
  // Ancho intrínseco del menú: proporcional a la fuente (7 ítems).
  const menu = mk({ querySelector: () => link, get scrollWidth() { S.measures += 1; return 44 * S.fontPx; },
    getBoundingClientRect: () => ({ left: S.headerW - 40 - 44 * S.fontPx }) });
  const nav = mk({ get clientWidth() { return S.headerW - 80 - 14 * S.fontPx; } });
  const toggleText = mk();
  const toggle = mk({ querySelector: () => toggleText });
  const inner = mk({ getBoundingClientRect: () => ({ height: S.barH }) });
  const header = mk({
    setAttribute(k, v) { attrs[k] = v; }, removeAttribute(k) { delete attrs[k]; }, getAttribute: (k) => attrs[k] ?? null,
    get clientWidth() { return S.headerW; },
    querySelector: (sel) => ({ '.site-nav': nav, '.nav-menu': menu, '.site-nav__toggle': toggle, '.site-header__inner': inner, '.site-brand': brand })[sel] ?? null,
  });
  const mobile = mk();
  const win = {
    getComputedStyle: (el) => ({ fontSize: `${S.fontPx}px`, position: el === header ? S.position : 'static' }),
    ResizeObserver: class { constructor(cb) { S.roCallbacks.push(cb); } observe() {} },
    addEventListener() {},
  };
  const documentElement = { style: { setProperty(k, v) { S.rootVars[k] = v; } } };
  const document = { documentElement, querySelector: (s) => (s === '.site-header' ? header : null), getElementById: () => mobile, addEventListener() {} };
  win.window = win; win.document = document;
  vm.runInNewContext(SRC, win);
  const fire = () => S.roCallbacks.forEach((cb) => cb([]));
  return { S, attrs, fire };
}

test('a 1280 con texto normal no colapsa; al duplicar el texto colapsa aunque el ancho no cambie', () => {
  const h = harness();
  assert.equal('data-collapsed' in h.attrs, false);
  h.S.fontPx = 32; // ampliación sólo de texto: el header sigue midiendo 1280
  h.fire();
  assert.equal('data-collapsed' in h.attrs, true);
  h.S.fontPx = 16;
  h.fire();
  assert.equal('data-collapsed' in h.attrs, false, 'vuelve a la fila al reducir el texto');
});

test('sin cambio de ancho ni de texto, el observador no re-mide (sin bucle expandir/colapsar)', () => {
  const h = harness();
  h.S.fontPx = 32; h.fire();
  const n = h.S.measures;
  for (let i = 0; i < 10; i++) h.fire(); // el colapso altera alturas y vuelve a notificar
  assert.equal(h.S.measures, n);
  assert.equal('data-collapsed' in h.attrs, true);
});

test('publica en :root el alto de la barra fija (las barras pegajosas de cada página van debajo)', () => {
  const h = harness();
  assert.equal(h.S.rootVars['--site-header-h'], '68px');
  h.S.barH = 136; h.S.fontPx = 32; h.fire(); // texto ampliado: la barra crece y se re-publica
  assert.equal(h.S.rootVars['--site-header-h'], '136px');
  const s = harness();
  s.S.position = 'relative'; s.S.headerW = 1000; s.fire(); // variante no fija (micrositios): 0
  assert.equal(s.S.rootVars['--site-header-h'], '0px');
});

test('CSS: el menú no desborda hacia la marca; H1 y tarjetas admiten texto ampliado sin cortar', () => {
  const site = readFileSync(resolve(root, 'assets/site/site.css'), 'utf8');
  assert.doesNotMatch(site, /\.site-nav \{[^}]*justify-content: flex-end/);
  assert.match(site, /\.site-nav > \.nav-menu \{ margin-left: auto; \}/);
  const home = readFileSync(resolve(root, 'home.css'), 'utf8');
  assert.match(home, /\.home-hero__copy, \.preview \{ min-width: 0; \}/);
  assert.match(home, /\.home-hero h1 \{ overflow-wrap: break-word; hyphens: manual;/);
  const gal = readFileSync(resolve(root, 'Reports/gallery.css'), 'utf8');
  assert.match(gal, /minmax\(min\(250px, 100%\), 1fr\)/);
  assert.match(gal, /\.g-diseases > li, \.g-disease, \.g-disease__top > \* \{ min-width: 0; \}/);
  assert.doesNotMatch(gal.match(/\.g-chip \{[^}]*\}/)[0], /nowrap/);
  assert.doesNotMatch(gal, /overflow: hidden[^}]*g-chip|\.g-chip \{[^}]*(display: none|text-overflow)/, 'el estado no se oculta ni se recorta');
});
