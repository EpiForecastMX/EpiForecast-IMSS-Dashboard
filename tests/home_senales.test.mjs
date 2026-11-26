/**
 * Portada: proporción de lo publicado y señales del boletín con su estado (decisión del autor, 25-nov-2026;
 * scripts/home_senales.mjs; acta en planes/mesa_plataforma_2026-11-25/).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const { bloques, proporcion } = await import('../scripts/home_senales.mjs');
const html = leer('index.html');

test('la portada está al día con la foto vigente del radar', () => {
  execFileSync('node', [resolve(root, 'scripts/home_senales.mjs'), '--check'], { cwd: root });
});

test('proporción: originales + con modelo + controles = publicados, y el control nunca se cuenta como modelo', () => {
  const p = proporcion();
  assert.equal(p.originales + p.modelo + p.control, p.total);
  assert.equal(p.control, 97);
  assert.match(html, new RegExp(`${p.modelo} con un modelo que superó su prueba de 2025 y <strong>${p.control} controles estacionales, no validados</strong>`));
});

test('señales: mismas cifras que el radar, estado explícito, enlace a su ficha y línea de ayuda si hay un tema sensible', () => {
  const b = bloques();
  assert.equal(b.senales.suben.length, 5);
  assert.equal(b.senales.bajan.length, 5);
  const filas = [...html.matchAll(/<li><a class="home-senales__nombre" href="([^"]+)">([^<]+)<\/a>[\s\S]*?home-senales__estado--([a-z-]+)">([^<]+)<\/span><\/li>/g)];
  assert.equal(filas.length, 10);
  for (const [, href, , kind, texto] of filas) {
    assert.ok(['pronostico', 'control', 'sin-modelo'].includes(kind), kind);
    if (kind === 'control') assert.equal(texto, 'Control estacional, no validado');
    if (kind === 'sin-modelo') assert.doesNotMatch(texto, /pronóstico publicado/i);
    assert.match(href, /^(no_modelables\.html#cat-|rechazados\.html|boletin\.html|[a-z0-9_]+\.html)/, href);
  }
  // Ideación suicida (R45.8) está entre las alzas del boletín 44: la portada lleva la Línea de la Vida.
  if (/ideación suicida/i.test(html.match(/<!-- home:radar:start -->[\s\S]*<!-- home:radar:end -->/)[0])) {
    assert.match(html, /home-senales__ayuda[\s\S]*800 911 2000/);
  }
  assert.match(html, /Son casos notificados, no tasas\./);
  assert.doesNotMatch(html, /Linfoma Hodking|Covid 19|Enfermedad febril  exantemática/);
});

test('el paso semanal regenera la portada al activar cada foto', () => {
  assert.match(leer('scripts/boletin_semana_activa.py'), /scripts\/home_senales\.mjs'\), '--root', str\(raiz\)\]/);
});
