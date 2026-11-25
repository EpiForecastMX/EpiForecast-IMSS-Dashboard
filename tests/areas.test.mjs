/**
 * Áreas clínicas e iconografía (24-nov-2026, mesa de expertos sobre UX e iconos dibujados con Gemini).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { AREAS, areaDe, idsDeArea } from '../assets/site/areas.mjs';

const leer = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf-8');
const catalogo = JSON.parse(leer('assets/dashboard/catalog.json')).diseases;
const sprite = leer('assets/site/icons.svg');
const simbolos = new Map([...sprite.matchAll(/<symbol id="([^"]+)"([^>]*)>([\s\S]*?)<\/symbol>/g)].map((m) => [m[1], { attrs: m[2], cuerpo: m[3] }]));

test('cada padecimiento del catálogo tiene exactamente un área clínica y no sobran ids', () => {
  const ids = catalogo.map((d) => d.id);
  for (const id of ids) assert.ok(areaDe(id), `sin área: ${id}`);
  const asignados = AREAS.flatMap((a) => idsDeArea(a.id));
  assert.equal(asignados.length, new Set(asignados).size, 'id repetido entre áreas');
  assert.deepEqual([...asignados].sort(), [...ids].sort());
  assert.ok(AREAS.length >= 12 && AREAS.length <= 20);
});

test('los temas de autolesión y violencia sólo llevan el icono neutro de su área', () => {
  const apoyo = idsDeArea('apoyo');
  for (const id of apoyo) assert.match(id, /^(ahorcamiento|disparo|objeto_cortante|salto_lugar|envenenamiento_|ideacion_suicida|intento_suicidio|violencia_intrafamiliar|herida_arma_fuego)/);
  assert.equal(areaDe('vih_b20').id, 'sexual');
});

test('el sprite: cada icono de área existe, viewBox 24, sólo primitivas, color heredado y origen declarado', () => {
  for (const a of AREAS) assert.ok(simbolos.has(a.icono), `falta ${a.icono}`);
  for (const id of ['i-estado-validado', 'i-estado-en-validacion', 'i-estado-control', 'i-estado-previo', 'i-estado-rechazado', 'i-tendencia-sube', 'i-tendencia-baja', 'i-tendencia-estable']) assert.ok(simbolos.has(id), id);
  assert.doesNotMatch(sprite, /<(script|style|text|image|foreignObject)\b|on[a-z]+=|href="http/i);
  for (const [id, s] of simbolos) {
    assert.match(s.attrs, /viewBox="0 0 24 24"/, id);
    assert.match(s.attrs, /stroke="currentColor"/, id);
    assert.match(s.attrs, /data-origen="(gemini|provisional)"/, id);
    assert.doesNotMatch(s.cuerpo, /#[0-9a-fA-F]{3,6}|rgb\(/, id);
    assert.doesNotMatch(s.cuerpo, /<(?!\/?(path|circle|ellipse|line|polyline|polygon|rect)\b)/, id);
  }
  assert.ok(sprite.length < 40000, 'sprite de menos de 40 KB');
});

test('un solo mapa de iconos de estado (galería, Dashboard y fichas) y el control nunca con icono de validado', async () => {
  const { ICONO_ESTADO } = await import('../assets/site/estado.mjs');
  assert.equal(ICONO_ESTADO.control, 'i-estado-control');
  for (const k of Object.keys(ICONO_ESTADO)) assert.ok(simbolos.has(ICONO_ESTADO[k]), k);
  assert.match(leer('Reports/galeria.mjs'), /from '\.\.\/assets\/site\/estado\.mjs/);
  assert.match(leer('assets/dashboard/dashboard.mjs'), /from '\.\.\/site\/estado\.mjs'/);
  // La ficha (script clásico) repite la tabla: debe coincidir con el módulo.
  const ficha = leer('assets/site/estado-ficha.js');
  for (const k of ['pass', 'pending', 'control']) assert.match(ficha, new RegExp(`${k}: '${ICONO_ESTADO[k]}'`), k);
  assert.doesNotMatch(ficha, /control: 'i-estado-(validado|en-validacion)'/);
});

test('fichas: los controles dicen su método y no «Modelos finales»; microdefiniciones; Línea de la Vida arriba en las sensibles', () => {
  const ficha = leer('assets/site/estado-ficha.js');
  assert.match(ficha, /Método: repite los casos de 52 semanas antes/);
  const v = leer('varicela_b01.html');
  assert.match(v, /EpiEstadoFicha\.cifras\?\.\(document, V\)/);
  assert.match(v, /class="metric-help"/);
  for (const id of idsDeArea('apoyo')) {
    const h = leer(`${id}.html`);
    assert.ok(h.indexOf('aria-label="Línea de ayuda"') < h.indexOf('id="statusCard"'), `${id}: la Línea va antes del estado`);
    assert.ok(h.indexOf('aria-label="Línea de ayuda"') > h.indexOf('<h1>'), id);
  }
});

test('la portada usa las mismas áreas clínicas en su filtro y en cada tarjeta', () => {
  const home = leer('index.html');
  const sel = home.slice(home.indexOf('<select id="conditionGroup">'), home.indexOf('</select>', home.indexOf('<select id="conditionGroup">')));
  assert.deepEqual([...sel.matchAll(/<option>([^<]+)<\/option>/g)].map((m) => m[1]), AREAS.map((a) => a.nombre));
  for (const m of home.matchAll(/data-p="([a-z0-9_]+)" data-group="([^"]+)"/g)) assert.equal(m[2], areaDe(m[1])?.nombre, m[1]);
});
