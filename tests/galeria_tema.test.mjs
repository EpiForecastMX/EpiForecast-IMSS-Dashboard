/**
 * Tema claro y oscuro de la Galería de pronósticos (24-nov-2026, mesa de expertos). En modo oscuro la galería era
 * ilegible: no tenía tema oscuro y el oscurecimiento forzado del navegador dejaba las gráficas oscuras sobre fondo oscuro.
 * Esta prueba fija el contraste WCAG de ambos temas y el alcance: el oscuro vive sólo en la galería y el resto del sitio
 * se declara «sólo claro».
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const leer = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf-8');
const site = leer('assets/site/site.css');
const galeria = leer('Reports/gallery.css');
const html = leer('Reports/index.html');
const js = leer('Reports/galeria.mjs');

const largo = (h) => (h.length === 4 ? `#${[...h.slice(1)].map((x) => x + x).join('')}` : h).toLowerCase();
const tokens = (bloque) => Object.fromEntries([...bloque.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g)].map((m) => [m[1], largo(m[2])]));
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const claro = { ...tokens(site.slice(site.indexOf(':root'), site.indexOf('}', site.indexOf(':root')))),
  ...tokens(galeria.slice(galeria.indexOf('html.tema-galeria {'), galeria.indexOf('}', galeria.indexOf('html.tema-galeria {')))) };
const ini = galeria.indexOf('@media screen and (prefers-color-scheme: dark)');
const oscuro = { ...claro, ...tokens(galeria.slice(ini, galeria.indexOf('}', ini))) };

for (const [nombre, t] of [['claro', claro], ['oscuro', oscuro]]) {
  test(`tema ${nombre}: texto ≥ 4.5:1 y elementos gráficos ≥ 3:1 sobre el papel y la superficie`, () => {
    for (const fondo of ['paper', 'surface']) {
      for (const k of ['ink', 'body', 'muted']) assert.ok(contraste(t[k], t[fondo]) >= 4.5, `${k} sobre ${fondo}: ${contraste(t[k], t[fondo]).toFixed(2)}`);
      for (const k of ['c-obs', 'control-border', 'focus', 'series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6', 'series-7', 'series-8']) {
        assert.ok(contraste(t[k], t[fondo]) >= 3, `${k} sobre ${fondo}: ${contraste(t[k], t[fondo]).toFixed(2)}`);
      }
    }
    for (const [tx, fo] of [['on-accent', 'green'], ['chip-ink', 'mint'], ['chip-pass-ink', 'chip-pass-bg'], ['chip-legacy-ink', 'chip-legacy-bg'],
      ['gold-ink', 'gold-soft'], ['danger', 'error-bg']]) {
      assert.ok(contraste(t[tx], t[fo]) >= 4.5, `${tx} sobre ${fo}: ${contraste(t[tx], t[fo]).toFixed(2)}`);
    }
  });
}

test('el tema oscuro sólo vive en la galería y el resto del sitio es «sólo claro»', () => {
  assert.match(site, /color-scheme:\s*only light/);
  assert.doesNotMatch(site, /prefers-color-scheme/);
  assert.match(html, /<html lang="es" class="tema-galeria">/);
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
  assert.match(galeria, /html\.tema-galeria \{\s*color-scheme: light dark;/);
  // Sólo en pantalla: al imprimir se usa el claro.
  assert.ok(ini > 0);
});

test('la galería no deja colores fijos fuera de los bloques de tokens', () => {
  const sinTokens = galeria.replace(/\/\*[\s\S]*?\*\//g, '').replace(/html\.tema-galeria \{[\s\S]*?\}/, '').replace(/@media screen and \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}/, '');
  const fijos = (sinTokens.match(/#[0-9a-fA-F]{3,6}\b/g) || []).filter((h) => h.toLowerCase() !== '#fafbf7');
  assert.deepEqual(fijos, [], 'colores fijos fuera de los tokens (sólo se permite el marco claro de las láminas PNG)');
  assert.doesNotMatch(galeria, /color: var\(--white\)|background: var\(--white\)/);
});

test('las gráficas siguen al esquema: mini-gráficas con var() y redibujo al cambiar', () => {
  assert.match(js, /line\.style\.stroke = `var\(--c-obs/);
  assert.match(js, /matchMedia\?\.\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(js, /token\('--band-alpha'/);
  assert.match(js, /token\('--chart-grid'/);
});
