#!/usr/bin/env node
// Estampa la cabecera y el pie comunes del sitio entre marcadores, desde assets/site/shell.config.json.
// Determinista: sin reloj, sin red, sin entorno. Sólo reescribe lo que está entre sus marcadores.
//
// Uso:
//   node scripts/site_shell.mjs [--root DIR] [--check]          todas las páginas del manifiesto
//   node scripts/site_shell.mjs [--root DIR] --page RUTA [--check]  sólo esa página (alta de una ficha)
//   --check no escribe; rc=1 si alguna página o assets/site/shell.fragments.json difiere de lo generado.
//
// Manifiesto (shell.config.json):
//   families: plantilla por familia {variant, current, currentKind}. variant «default» = cabecera +
//     pie; «app» = barra compacta sin pie (EpiBot: la app ocupa el alto de la ventana).
//     currentKind «page» marca aria-current="page"; «section» marca aria-current="true" (una ficha
//     pertenece a la sección Galería sin ser la Galería).
//   pages: [{path, family}] explícitas.
//   autoEnroll: páginas que entran solas, p. ej. las fichas de release_catalog.js (`pagina`): una
//     ficha nueva copiada de otra ya trae los marcadores y queda cubierta por --check sin tocar el
//     manifiesto. Una ficha del catálogo SIN marcadores hace fallar --check con un mensaje claro.
//
// Marcadores (una sola pareja de cada uno por página; si faltan o se repiten, falla cerrado):
//   <!-- site:header:start --> … <!-- site:header:end -->
//   <!-- site:footer:start --> … <!-- site:footer:end -->   (no en la variante app)
// «Volver arriba» apunta a #nav, el id que la cabecera generada lleva en todas las páginas.
//
// Los <link>/<script> de cada página NO viven en el shell: así ni este generador ni el bump-cache
// semanal se pisan las versiones (?v=) entre sí.
//
// Fragmentos para generadores del backend: assets/site/shell.fragments.json guarda, por familia, la
// cabecera y el pie ya renderizados para una página de la raíz. EpiForecast-MX los estampa con
// src/epiforecast/publication/site_shell.py sin reimplementar el renderizado (una sola fuente).
//
// El marcado no lleva scripts, `on*=` ni `style=`: compatible con la CSP del dashboard.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CONFIG = 'assets/site/shell.config.json';
export const FRAGMENTS = 'assets/site/shell.fragments.json';
export const SCHEMA = 'epiforecast.site_shell.v2';
export const FRAGMENTS_SCHEMA = 'epiforecast.site_shell_fragments.v1';
// micrositio: cabecera y pie como default, pero la cabecera no se fija (la barra local del micrositio sí).
export const VARIANTS = Object.freeze({ default: ['header', 'footer'], app: ['header'], micrositio: ['header', 'footer'] });
const SAFE_HREF = /^(?:https:\/\/[A-Za-z0-9.-]+(?:\/[A-Za-z0-9_./#?=&%-]*)?|[A-Za-z0-9_][A-Za-z0-9_./-]*(?:#[A-Za-z0-9_-]+)?)$/;
const SAFE_PATH = /^[A-Za-z0-9_][A-Za-z0-9_./-]*\.html$/;
const ORDER = ['galeria', 'epibot', 'dashboard', 'radar', 'noticias', 'congresos', 'mas'];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fail = (msg) => { throw new Error(`[site_shell] ${msg}`); };

/** Valida la configuración (forma, orden contractual, hrefs seguros, familias). Devuelve la config. */
export function validateConfig(cfg) {
  if (!cfg || cfg.schema !== SCHEMA) fail(`esquema de configuración inválido (se esperaba ${SCHEMA})`);
  const ids = (cfg.primary || []).map((i) => i.id);
  if (JSON.stringify(ids) !== JSON.stringify(ORDER)) fail(`orden de navegación ${ids.join(',')} ≠ ${ORDER.join(',')}`);
  const walk = (items) => items.forEach((it) => {
    if (typeof it.label !== 'string' || !it.label.trim()) fail('entrada sin label');
    if (it.children) { if (!Array.isArray(it.children) || !it.children.length) fail(`${it.label}: grupo vacío`); walk(it.children); return; }
    if (typeof it.href !== 'string' || !SAFE_HREF.test(it.href) || it.href.includes('..')) fail(`${it.label}: href inseguro ${it.href}`);
    if (/^https:/.test(it.href) && !it.external) fail(`${it.label}: href externo sin external:true`);
  });
  walk(cfg.primary);
  for (const col of cfg.footer?.columns ?? []) walk(col.links);
  const fams = cfg.families ?? {};
  for (const [name, f] of Object.entries(fams)) {
    if (!Object.hasOwn(VARIANTS, f.variant)) fail(`familia ${name}: variante desconocida ${f.variant}`);
    if (f.current !== null && f.current !== 'inicio' && !ORDER.includes(f.current)) fail(`familia ${name}: current desconocido ${f.current}`);
    if (!['page', 'section'].includes(f.currentKind ?? 'page')) fail(`familia ${name}: currentKind inválido`);
  }
  if (!Array.isArray(cfg.pages) || !cfg.pages.length) fail('sin páginas');
  const seen = new Set();
  for (const p of cfg.pages) {
    if (typeof p.path !== 'string' || !SAFE_PATH.test(p.path) || p.path.includes('..')) fail(`página inválida ${p.path}`);
    if (seen.has(p.path)) fail(`página repetida ${p.path}`);
    seen.add(p.path);
    if (!Object.hasOwn(fams, p.family)) fail(`página ${p.path}: familia desconocida ${p.family}`);
    // Un override de current por página haría que el fragmento de su familia (backend) y --check
    // estampen cabeceras distintas: el «actual» se declara en la familia, no en la página.
    if ('current' in p || 'currentKind' in p) fail(`página ${p.path}: current/currentKind se declaran en la familia, no por página`);
    if (p.productor !== undefined) {
      const pr = p.productor;
      if (!pr || typeof pr.script !== 'string' || !pr.script.trim() || typeof pr.chrome !== 'boolean') fail(`página ${p.path}: productor inválido (se espera {script, chrome})`);
      if (pr.chrome && p.path.includes('/')) fail(`página ${p.path}: un productor que estampa el fragmento de la raíz sólo puede escribir páginas de la raíz`);
    }
  }
  for (const [ruta, v] of Object.entries(cfg.assets ?? {})) {
    if (!/^[A-Za-z0-9_./-]+\.(css|js)$/.test(ruta) || !/^[A-Za-z0-9._-]+$/.test(String(v))) fail(`assets: entrada inválida ${ruta}=${v}`);
  }
  for (const a of cfg.autoEnroll ?? []) {
    if (!Object.hasOwn(fams, a.family)) fail(`autoEnroll: familia desconocida ${a.family}`);
    if (a.source !== 'release_catalog') fail(`autoEnroll: fuente desconocida ${a.source}`);
  }
  return cfg;
}

/** href de la config (relativo a la raíz) visto desde pagePath. Enlaces a la propia página quedan como #ancla. */
export function hrefFrom(pagePath, href) {
  if (/^https:/.test(href)) return href;
  const [file, frag] = href.split('#');
  if (file === pagePath) return frag ? `#${frag}` : path.posix.basename(file);
  return path.posix.relative(path.posix.dirname(pagePath), file) + (frag ? `#${frag}` : '');
}

/** Página completa a partir de su familia: {path, family, variant, current, currentKind}. */
export function resolvePage(cfg, page) {
  const fam = cfg.families[page.family];
  return { ...page, variant: fam.variant, current: fam.current, currentKind: fam.currentKind ?? 'page' };
}

function curAttr(page, id) {
  if (!page.current || page.current !== id) return '';
  return page.currentKind === 'section' ? ' aria-current="true"' : ' aria-current="page"';
}

// Enlace de un grupo (Congresos, Más) a la propia página: es la página actual, sin override por página.
const selfAttr = (page, it) => (it.href === page.path ? ' aria-current="page"' : '');

function link(page, it, cls = '', withCurrent = false, inGroup = false) {
  const ext = it.external ? ' rel="noopener" target="_blank"' : '';
  const cur = withCurrent ? curAttr(page, it.id) : inGroup ? selfAttr(page, it) : '';
  return `<a${cls ? ` class="${cls}"` : ''} href="${esc(hrefFrom(page.path, it.href))}"${cur}${ext}>${esc(it.label)}</a>`;
}

/** Cabecera común para una página (ya resuelta con resolvePage). */
export function renderHeader(cfg, page) {
  const brandCur = page.current === 'inicio' ? ' aria-current="page"' : '';
  const desktop = cfg.primary.map((it) => {
    if (!it.children) return `        <li>${link(page, it, '', true)}</li>`;
    const id = `navGroup-${it.id}`;
    const items = it.children.map((c) => `            <li>${link(page, c, '', false, true)}</li>`).join('\n');
    const cur = curAttr(page, it.id);
    return [
      `        <li class="nav-group">`,
      `          <button type="button" class="nav-group__toggle" aria-expanded="false" aria-controls="${id}"${cur ? ' data-current=""' : ''}>${esc(it.label)}</button>`,
      `          <ul class="nav-group__list" id="${id}">`,
      items,
      `          </ul>`,
      `        </li>`,
    ].join('\n');
  }).join('\n');
  const mobile = cfg.primary.map((it) => {
    if (!it.children) return `      ${link(page, it, 'nav-mobile-link', true)}`;
    return [`      <p class="nav-mobile-group"${curAttr(page, it.id) ? ' data-current=""' : ''}>${esc(it.label)}</p>`,
      ...it.children.map((c) => `      ${link(page, c, 'nav-mobile-link nav-mobile-link--sub', false, true)}`)].join('\n');
  }).join('\n');
  const cls = { app: 'site-header site-header--app', micrositio: 'site-header site-header--static' }[page.variant] ?? 'site-header';
  return [
    `<header class="${cls}" id="nav" lang="es">`,
    '  <div class="site-header__inner">',
    `    <a class="site-brand" href="${esc(hrefFrom(page.path, cfg.brand.href))}" aria-label="${esc(cfg.brand.label)}"${brandCur}><span class="site-brand__symbol" aria-hidden="true">E<span>+</span></span><span class="site-brand__name"><span class="site-brand__word">EpiForecast<span class="site-brand__mx">MX</span></span><small>${esc(cfg.brand.tagline)}</small></span></a>`,
    '    <nav class="site-nav" aria-label="Navegación principal">',
    '      <ul class="nav-menu">',
    desktop,
    '      </ul>',
    '    </nav>',
    '    <button type="button" class="site-nav__toggle" aria-controls="navMobile" aria-expanded="false"><span class="site-nav__toggle-icon" aria-hidden="true"></span><span class="site-nav__toggle-text">Menú</span></button>',
    '  </div>',
    '  <div id="navMobile" class="site-nav__mobile">',
    '    <div class="nav-mobile-items">',
    mobile,
    '    </div>',
    '  </div>',
    '</header>',
  ].join('\n');
}

/** Pie común para una página (sólo variante default). */
export function renderFooter(cfg, page) {
  const cols = cfg.footer.columns.map((col) => [
    '    <div class="site-footer__col">',
    `      <p class="site-footer__title">${esc(col.title)}</p>`,
    ...col.links.map((it) => `      ${link(page, it)}`),
    '    </div>',
  ].join('\n')).join('\n');
  return [
    '<footer class="site-footer" lang="es">',
    '  <div class="site-footer__inner">',
    '    <div class="site-footer__brand">',
    `      <a class="site-brand" href="${esc(hrefFrom(page.path, cfg.brand.href))}" aria-label="${esc(cfg.brand.label)}"><span class="site-brand__name"><span class="site-brand__word">EpiForecast<span class="site-brand__mx">MX</span></span></span></a>`,
    `      <p>${esc(cfg.footer.tagline)}</p>`,
    '    </div>',
    cols,
    '  </div>',
    `  <div class="site-footer__legal"><span>${esc(cfg.footer.legal)}</span><a href="#nav">Volver arriba ↑</a></div>`,
    '</footer>',
  ].join('\n');
}

const RENDER = { header: renderHeader, footer: renderFooter };

/** Reemplaza el contenido entre los marcadores de `name`. Falla si no hay exactamente una pareja. */
export function stamp(html, name, block, where = '') {
  const start = `<!-- site:${name}:start -->`;
  const end = `<!-- site:${name}:end -->`;
  const nStart = html.split(start).length - 1;
  const nEnd = html.split(end).length - 1;
  if (nStart !== 1 || nEnd !== 1) fail(`${where ? `${where}: ` : ''}marcadores site:${name} ${nStart}/${nEnd} (se esperaba 1/1)`);
  const i = html.indexOf(start) + start.length;
  const j = html.indexOf(end);
  if (j < i) fail(`${where ? `${where}: ` : ''}marcadores site:${name} invertidos`);
  return `${html.slice(0, i)}\n${block}\n${html.slice(j)}`;
}

/** Estampa todos los bloques de la variante de la página. */
export function stampPage(cfg, page, html) {
  const p = resolvePage(cfg, page);
  let out = html;
  for (const b of VARIANTS[p.variant]) out = stamp(out, b, RENDER[b](cfg, p), p.path);
  if (p.variant === 'app' && out.includes('<!-- site:footer:start -->')) fail(`${p.path}: la variante app no lleva pie`);
  return out;
}

/**
 * Fichas del catálogo de releases (release_catalog.js, campo `pagina`, comillas simples o dobles).
 * Falla cerrado: si el autoEnroll lo declara y el archivo falta o no da ninguna página, el gate no
 * puede quedar «al día» vigilando cero fichas.
 */
export function releasePages(root) {
  const file = path.join(root, 'epibot/js/release_catalog.js');
  if (!fs.existsSync(file)) fail('autoEnroll release_catalog: falta epibot/js/release_catalog.js');
  const pages = [...fs.readFileSync(file, 'utf8').matchAll(/\bpagina\s*:\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
  if (!pages.length) fail('autoEnroll release_catalog: release_catalog.js no declara ninguna `pagina`; el formato cambió');
  for (const p of pages) if (!SAFE_PATH.test(p) || p.includes('/')) fail(`release_catalog.js: página inválida ${p}`);
  if (new Set(pages).size !== pages.length) fail('release_catalog.js: páginas repetidas');
  return pages;
}

/** Manifiesto completo: páginas explícitas + autoinscritas (sin duplicados; la explícita gana). */
export function manifest(root = process.cwd()) {
  const cfg = validateConfig(JSON.parse(fs.readFileSync(path.join(root, CONFIG), 'utf8')));
  const pages = cfg.pages.map((p) => ({ ...p, auto: false }));
  const seen = new Set(pages.map((p) => p.path));
  for (const a of cfg.autoEnroll ?? []) {
    for (const p of releasePages(root)) {
      if (seen.has(p)) continue;
      seen.add(p);
      pages.push({ path: p, family: a.family, auto: true });
    }
  }
  return { cfg, pages };
}

/** Fragmentos por familia para una página de la raíz (consumidos por el helper del backend). */
export function renderFragments(cfg) {
  const families = {};
  for (const name of Object.keys(cfg.families).sort()) {
    const page = resolvePage(cfg, { path: '__raiz__.html', family: name });
    const blocks = {};
    for (const b of VARIANTS[page.variant]) blocks[b] = RENDER[b](cfg, page);
    families[name] = { variant: page.variant, ...blocks };
  }
  return `${JSON.stringify({ schema: FRAGMENTS_SCHEMA, note: 'Generado por scripts/site_shell.mjs; no editar a mano.', assets: cfg.assets ?? {}, families }, null, 1)}\n`;
}

/** Devuelve [{path, before, after}] sin escribir (incluye el archivo de fragmentos). */
export function buildPages(root = process.cwd(), { only = null } = {}) {
  const { cfg, pages } = manifest(root);
  const sel = only ? pages.filter((p) => p.path === only) : pages;
  if (only && !sel.length) fail(`${only} no está en el manifiesto ni en release_catalog.js; añádela a shell.config.json`);
  // Páginas que un generador del backend estampa con el fragmento de su familia (site_shell.py):
  // su render propio tiene que ser idéntico al fragmento, o una regeneración cambiaría la cabecera
  // (p. ej. la portada, cuyas anclas propias quedan como «#…»).
  for (const page of pages.filter((p) => p.productor?.chrome).map((p) => resolvePage(cfg, p))) {
    const proxy = resolvePage(cfg, { path: '__raiz__.html', family: page.family });
    for (const b of VARIANTS[page.variant]) {
      if (RENDER[b](cfg, page) !== RENDER[b](cfg, proxy)) fail(`${page.path}: su ${b} difiere del fragmento de la familia ${page.family}, que es el que estampa ${page.productor.script}`);
    }
  }
  const out = sel.map((page) => {
    const file = path.join(root, page.path);
    if (!fs.existsSync(file)) fail(`${page.path} no existe`);
    const before = fs.readFileSync(file, 'utf8');
    return { path: page.path, family: page.family, auto: page.auto, before, after: stampPage(cfg, page, before) };
  });
  if (!only) {
    const frag = path.join(root, FRAGMENTS);
    out.push({ path: FRAGMENTS, family: null, auto: false, before: fs.existsSync(frag) ? fs.readFileSync(frag, 'utf8') : '', after: renderFragments(cfg) });
  }
  return out;
}

function main(argv) {
  let root = process.cwd();
  let check = false;
  let only = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--check') check = true;
    else if (argv[i] === '--root') root = path.resolve(argv[++i] ?? '');
    else if (argv[i] === '--page') only = argv[++i] ?? '';
    else fail(`argumento desconocido: ${argv[i]}`);
  }
  const pages = buildPages(root, { only });
  const stale = pages.filter((p) => p.before !== p.after);
  if (check) {
    if (stale.length) {
      process.stderr.write(`[site_shell] --check: desactualizado en ${stale.map((p) => p.path).join(', ')}. Ejecute node scripts/site_shell.mjs\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`[site_shell] ${pages.length} archivos al día\n`);
    return;
  }
  for (const p of stale) fs.writeFileSync(path.join(root, p.path), p.after);
  process.stdout.write(`[site_shell] ${stale.length} de ${pages.length} archivos reescritos\n`);
}

// realpath: en macOS /var es un enlace a /private/var y import.meta.url llega ya resuelto.
const real = (p) => { try { return fs.realpathSync(p); } catch { return p; } };
const invoked = process.argv[1] && import.meta.url === pathToFileURL(real(path.resolve(process.argv[1]))).href;
if (invoked) {
  try { main(process.argv.slice(2)); } catch (err) { process.stderr.write(`${err.message}\n`); process.exitCode = 1; }
}
