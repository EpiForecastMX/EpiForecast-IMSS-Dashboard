// Noticias (novedades.html, hito 3): archivo estático desde news.json, legible sin JavaScript, con
// las anclas estables de nota-ancla.js (las mismas que escribe el backend en build_news_weekly.py);
// el JS de la página lo vuelve a pintar con el mismo marcado y los mismos id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const PAGINA = leer('novedades.html');
const HOME = leer('index.html');
const NEWS = JSON.parse(leer('news.json'));
const ctx = {};
vm.createContext(ctx);
vm.runInContext(leer('assets/site/nota-ancla.js'), ctx);
const IDS = ctx.EpiNotas.anclas(NEWS.items);

const bloque = () => {
  const m = /<!-- noticias:archivo:start -->([\s\S]*?)<!-- noticias:archivo:end -->/.exec(PAGINA);
  assert.ok(m, 'novedades.html sin el bloque noticias:archivo');
  return m[1];
};
// El respaldo estático pone una nota por línea; el JS las une sin separador.
const decode = (s) => s.replace(/&rarr;/g, '→').replace(/<\/article>\n<article/g, '</article><article');

test('archivo estático: una nota por item de news.json, en orden, con id estable y título', () => {
  assert.equal((PAGINA.match(/<!-- noticias:archivo:start -->/g) || []).length, 1);
  const arts = [...bloque().matchAll(/<article class="arch-item[^"]*" id="([^"]+)" tabindex="-1">[\s\S]*?<h2 class="arch-title"><a href="([^"]*)">([\s\S]*?)<\/a><\/h2>/g)];
  assert.ok(NEWS.items.length > 0);
  assert.equal(arts.length, NEWS.items.length);
  arts.forEach((a, i) => {
    assert.equal(a[1], IDS[i]);
    assert.equal(a[2], (NEWS.items[i].link && NEWS.items[i].link.href) || '#');
    assert.equal(a[3], NEWS.items[i].title);
  });
  assert.equal(new Set(IDS).size, IDS.length, 'anclas repetidas');
});

test('el JS de la página repinta el mismo marcado (mismos id) y enfoca el ancla pedida', async () => {
  const scripts = [...PAGINA.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const fuente = scripts.find((s) => s.includes("fetch('news.json'"));
  assert.ok(fuente, 'sin el script del archivo');
  const enfocado = [];
  const grid = { innerHTML: bloque(), contains: () => true };
  const env = {
    window: { EpiNotas: ctx.EpiNotas },
    location: { hash: '#' + IDS[2] },
    document: {
      getElementById: (id) => (id === 'newsGrid' ? grid
        : IDS.includes(id) ? { scrollIntoView() {}, focus() { enfocado.push(id); } } : null),
    },
    fetch: async () => ({ ok: true, json: async () => NEWS }),
  };
  vm.createContext(env);
  vm.runInContext(fuente, env);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(decode(grid.innerHTML).trim(), decode(bloque()).trim());
  assert.deepEqual(enfocado, [IDS[2]]);
  assert.match(PAGINA, /<script src="assets\/site\/nota-ancla\.js\?v=\d+"><\/script>\s*<script>\s*\(function\(\)\{function esc/);
});

test('portada: los 3 destacados estáticos apuntan a notas que existen en el archivo', () => {
  const enlaces = [...HOME.matchAll(/href="novedades\.html#([^"]+)"/g)].map((m) => m[1]);
  assert.equal(enlaces.length, 3);
  assert.deepEqual(enlaces, IDS.slice(0, 3));
  for (const id of enlaces) assert.ok(bloque().includes(`id="${id}"`), id);
});

test('Noticias usa la familia explícita noticias (aria-current=page) y no deja el pie viejo', () => {
  assert.match(PAGINA, /<a href="novedades\.html" aria-current="page">Noticias<\/a>/);
  assert.doesNotMatch(PAGINA, /<nav class="nav" id="nav">/);
  assert.doesNotMatch(PAGINA, /href="#hero"/);
});

test('#hero: alias semántico de la ruta antigua hacia la cabecera real del archivo, sin perder #archivo', () => {
  assert.equal((PAGINA.match(/id="hero"/g) || []).length, 1);
  assert.match(PAGINA, /<section class="edl-hero" id="archivo">\s*<div id="hero" class="edl-wrap edl-article-col">/);
  const cabecera = PAGINA.slice(PAGINA.indexOf('id="hero"'), PAGINA.indexOf('id="newsGrid"'));
  assert.match(cabecera, /<h1 class="edl-headline">Novedades<\/h1>/, 'el alias apunta a la cabecera con título, no a una lista vacía');
});

test('fallo de red (503) o sin EpiNotas: queda el archivo estático, no se vacía', async () => {
  const scripts = [...PAGINA.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const fuente = scripts.find((s) => s.includes("fetch('news.json'"));
  for (const caso of [
    { fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }), EpiNotas: ctx.EpiNotas },
    { fetch: async () => { throw new Error('offline'); }, EpiNotas: ctx.EpiNotas },
    { fetch: async () => ({ ok: true, json: async () => NEWS }), EpiNotas: undefined },
  ]) {
    const grid = { innerHTML: bloque(), contains: () => true };
    const env = {
      window: { EpiNotas: caso.EpiNotas },
      location: { hash: '' },
      document: { getElementById: (id) => (id === 'newsGrid' ? grid : null) },
      fetch: caso.fetch,
    };
    vm.createContext(env);
    vm.runInContext(fuente, env);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(grid.innerHTML, bloque());
    assert.equal((grid.innerHTML.match(/<article /g) || []).length, NEWS.items.length);
  }
});
