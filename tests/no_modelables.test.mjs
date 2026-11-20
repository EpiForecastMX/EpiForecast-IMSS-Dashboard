// Categorías del boletín 44 sin pronóstico (alta_b44, decisión del autor del 20-nov-2026): el radar las marca «No modelable»
// con su motivo medido, una página las reúne con las cifras impresas, y el sitio las enlaza y las cuenta.
// Con 4a9fdba1 fallan: las 32 seguían «Por incorporar» y no existían ni la página ni el módulo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const actual = JSON.parse(leer('assets/boletin/actual.json'));
const data = JSON.parse(leer(`${actual.carpeta}/data.json`));
const imp = (rel) => import(pathToFileURL(resolve(root, rel)).href);

// Motivo medido por código impreso (EXCLUSIONES.md y docs/C7_19_ALTA_B44.md del backend).
const ESPERADO = {
  solo_nacional: ['A20', 'A36', 'A80', 'A92.2', 'A92.8', 'A95', 'A98.4'],
  sin_casos: ['A00', 'A33', 'A75.0', 'A82.0', 'A82.1', 'A92.3', 'B05', 'B06', 'B50', 'B55.0', 'B60.2', 'B73', 'P35.0', 'U06.9'],
  sem_menos_uno: ['J09-J11', 'U97'],
  sin_pliegues: ['B87', 'E86', 'L55', 'T17.2-T17.3', 'T75.1', 'X00-X09', 'X10-X19', 'X24-X29exceptoX26,X27', 'X40-X49'],
};
const cod = (c) => c.replace(/\s+/g, '');
const nm = data.diseases.filter((e) => e.status === 'No modelable');

test('el radar del boletín 44 marca exactamente las 32 categorías sin release como «No modelable», ninguna «Por incorporar»', () => {
  assert.equal(nm.length, 32);
  assert.deepEqual(data.diseases.filter((e) => e.status === 'Por incorporar').map((e) => e.id), []);
  for (const [g, codigos] of Object.entries(ESPERADO)) {
    assert.deepEqual(nm.filter((e) => e.no_modelable?.grupo === g).map((e) => cod(e.code)).sort(), [...codigos].sort(), g);
  }
  for (const e of nm) {
    assert.equal(e.platform_id, null, e.id);
    assert.equal(e.aggregate, false, e.id);
    assert.equal(e.priority, 'No aplica', e.id);
    assert.equal(e.score, null, e.id);
    assert.ok(e.reason.length > 40 && !/Propuesta exploratoria/.test(e.reason), e.id);
  }
  // P. falciparum (B50, p33b1) es la fila no modelable; P. vivax comparte el código impreso y sigue publicado.
  assert.equal(nm.find((e) => cod(e.code) === 'B50').id, 'p33b1');
  assert.equal(data.diseases.find((e) => e.id === 'p33b2').platform_id, 'paludismo_vivax_b51');
});

test('los motivos citan lo medido y nunca leen como «sin casos» un guion no publicado', () => {
  const por = (c) => nm.find((e) => cod(e.code) === c).reason;
  assert.match(por('B05'), /6,152 casos confirmados/);
  assert.match(por('B50'), /siete casos importados/);
  for (const c of ['B05', 'B50']) assert.doesNotMatch(por(c), /sin casos|no imprime casos/);
  assert.match(por('U97'), /«-1».*Nayarit \(boletín 18\)/);
  assert.match(por('J09-J11'), /«-1».*Jalisco \(boletín 38\) y Guanajuato \(boletín 45\)/);
  assert.match(por('L55'), /boletín 2 de 2026/);
  assert.match(por('T75.1'), /boletín 48 de 2025/);
  assert.match(por('A20'), /sólo la imprime en el resumen nacional/);
  for (const e of nm.filter((x) => x.no_modelable.grupo === 'sin_casos' && !x.guion)) {
    for (const v of [e.cumulative, e.previous]) assert.ok(v === '-' || (Number.isInteger(v) && v <= 3), `${e.id}: ${v}`);
  }
});

test('el catálogo CSV del radar repite el estado de data.json en cada fila', () => {
  const filas = leer(`${actual.carpeta}/catalogo.csv`).replace(/^﻿/, '').trim().split('\n');
  const nModelable = filas.filter((l) => l.includes(',No modelable,No aplica,')).length;
  assert.equal(nModelable, 32);
  assert.equal(filas.filter((l) => l.includes(',Por incorporar,')).length, 0);
});

test('cobertura y textos del radar cuentan las no modelables; el HTML estático las enlaza', async () => {
  const { summarizeCoverage } = await imp('assets/boletin/coverage.mjs');
  const { textosRadar } = await imp('assets/boletin/textos.mjs');
  const c = summarizeCoverage(data.diseases);
  assert.equal(c.unmodelable, 32);
  assert.equal(c.published, 152);
  const t = textosRadar(data, actual, null);
  assert.equal(t.no_modelables, '32');
  assert.equal(t.no_modelables_palabras, 'Treinta y dos');
  const html = leer('boletin.html');
  assert.match(html, /<span data-radar="no_modelables_palabras">Treinta y dos<\/span> categorías no son modelables/);
  assert.match(html, /<option value="No modelable">No modelable<\/option>/);
  assert.match(html, /<option>No aplica<\/option>/);
  assert.ok((html.match(/href="no_modelables\.html"/g) || []).length >= 3, 'cobertura, notas y pie');
  const radar = leer('assets/boletin/radar.js');
  assert.match(radar, /d\.score!==null&&d\.status==='Por incorporar'/, 'la agenda sólo propone categorías por incorporar');
  assert.match(radar, /No quedan categorías por incorporar/);
  assert.match(radar, /s==='No modelable'\?'unmodelable'/);
});

test('no_modelables.html: tablas generadas de la foto vigente, 32 filas con cifras impresas y motivo', async () => {
  const { generar, bloqueNoModelables } = await imp('scripts/no_modelables_pagina.mjs');
  const { previo, nuevo } = generar(root);
  assert.equal(previo, nuevo, 'no_modelables.html desactualizada: node scripts/no_modelables_pagina.mjs');
  const html = leer('no_modelables.html');
  assert.ok(html.includes(bloqueNoModelables(data, actual)));
  const filas = [...html.matchAll(/<tr id="cat-([^"]+)"><th scope="row">([^<]+)<span[\s\S]*?<\/tr>/g)];
  assert.equal(filas.length, 32);
  const fmt = (v) => (v === '-' ? '–' : Number(v).toLocaleString('es-MX'));
  for (const [fila, id] of filas) {
    const e = data.diseases.find((x) => x.id === id);
    assert.ok(e && e.status === 'No modelable', id);
    const celdas = [...fila.matchAll(/<td class="num">(?:<span[^>]*>)?([^<]*)/g)].map((m) => m[1]);
    assert.deepEqual(celdas, [String(e.observed_week), fmt(e.weekly), fmt(e.cumulative), fmt(e.previous)], id);
    assert.ok(fila.includes(e.reason.replace(/&/g, '&amp;')), id);
    assert.ok(fila.includes(`>${e.code}<`), id);
  }
  assert.match(html, /<strong>Treinta y dos categorías<\/strong> del Boletín Epidemiológico 44 de 2026/);
  assert.match(html, /<div class="v">152<\/div><div class="l">Padecimientos con pronóstico publicado/);
  assert.doesNotMatch(html, /\s--\s|—[^<]*—/, 'sin guiones para incisos');
  for (const g of ['solo_nacional', 'sin_casos', 'sem_menos_uno', 'sin_pliegues']) assert.match(html, new RegExp(`id="grupo-${g}"`));
});

test('la página está en el shell, el sitemap, la portada, el pie y las noticias', () => {
  const cfg = JSON.parse(leer('assets/site/shell.config.json'));
  assert.ok(cfg.pages.some((p) => p.path === 'no_modelables.html' && p.family === 'editorial'));
  const ev = cfg.footer.columns.find((c) => c.title === 'Evidencia').links;
  assert.ok(ev.some((l) => l.href === 'no_modelables.html' && l.label === 'Categorías sin pronóstico'));
  assert.match(leer('Reports/index.html'), /href="\.\.\/no_modelables\.html">Categorías sin pronóstico/);
  assert.match(leer('sitemap.xml'), /https:\/\/epiforecast\.mx\/no_modelables\.html/);
  const home = leer('index.html');
  assert.match(home, new RegExp(`href="no_modelables\\.html">Ver las ${nm.length} categorías del boletín sin pronóstico`));
  const news = JSON.parse(leer('news.json')).items[0];
  assert.equal(news.link.href, 'no_modelables.html');
  assert.match(news.title, /Treinta y dos categorías/);
  assert.match(news.body.join(' '), /ciento cincuenta y dos padecimientos con pronóstico/);
  assert.match(home, /novedades\.html#nota-2026-11-19-treinta-y-dos-categorias/);
  assert.ok(existsSync(resolve(root, 'assets/boletin/no_modelables.mjs')));
});
