/**
 * Plan canónico del EpiBot, fase 2, entrega B (26-nov-2026): 2.7 voz y accesibilidad. La voz dice la cifra y el padecimiento,
 * no lee los guiones bajos de las cursivas, salta las notas del principio, nunca omite el 911 y avisa si hay una tabla.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

globalThis.window = globalThis;
const { textoHablado, CIFRA } = await import('../js/voice.js');
const fuente = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf-8');

test('2.7 las cursivas no se leen «guion bajo» y las notas del principio no tapan el veredicto', () => {
  const md = '_Monterrey está en Nuevo León: el boletín da los datos por estado._\n_Por «presión alta» entiendo hipertensión._\n\n**Hipertensión arterial en Nuevo León:** se espera que **aumente**: unos 2,255 casos en las próximas 4 semanas.\n\n- **Ahora:** 1,944 casos.';
  const h = textoHablado(md);
  assert.match(h, /^Hipertensión arterial en Nuevo León: se espera que aumente: unos 2,255 casos/);
  assert.doesNotMatch(h, /_/);
  assert.doesNotMatch(textoHablado(md, true), /_/);
});

test('2.7 un veredicto que es sólo título o termina en «:» se completa con la primera viñeta', () => {
  const h = textoHablado('**Hepatitis vírica A (B15): estados con más casos esperados, ambos sexos**\n\n- **Ciudad de México**: unos 46 casos en las próximas 4 semanas (29 en las 4 anteriores).\n- **Estado de México**: unos 28 casos.');
  assert.match(h, /^Hepatitis vírica A \(B15\): estados con más casos esperados, ambos sexos: Ciudad de México: unos 46 casos/);
  assert.ok(CIFRA.test(h));
  const p = textoHablado('**Panorama nacional** (casos notificados al boletín epidemiológico, datos hasta la semana del 2 de noviembre de 2026).\n\n**Lo que más se espera que suba:**\n- **Asma**: unos 12,854 casos (+22 %) · confiabilidad media.');
  assert.match(p, /^Panorama nacional\. Lo que más se espera que suba: Asma: unos 12,854 casos \(\+22 %\), confiabilidad media\./, 'sin el paréntesis largo de la fuente ni el «·»');
});

test('2.7 la frase del 911 nunca se omite, aunque vaya en una viñeta o se corte el texto', () => {
  const md = 'No puedo diagnosticarte ni recomendarte un tratamiento: soy un asistente de datos epidemiológicos.\n\n- Si hay **fiebre muy alta o sangrado**, acude a urgencias o llama al **911**.\n- Si los síntomas son leves, consulta en tu unidad de salud.';
  assert.match(textoHablado(md), /llama al 911\./);
  const largo = `${'Una oración de relleno para pasar el límite del corte. '.repeat(40)}\n\n- Si alguien está en peligro inmediato, llama al **911**.`;
  assert.match(textoHablado(largo, true), /llama al 911\. El resto está en pantalla\.$/);
  assert.match(textoHablado(largo), /llama al 911\./);
});

test('2.7 avisa que hay una tabla en pantalla y no lee sus celdas', () => {
  const md = '**Rendimiento por motor:** el productivo tiene sMAPE de 21 %.\n\n| Motor | sMAPE |\n|---|---|\n| Prophet | 25 % |';
  const h = textoHablado(md, true);
  assert.match(h, /La tabla y el detalle están en pantalla\.$/);
  assert.doesNotMatch(h, /Prophet/);
});


test('2.7 enlaces legibles al visitarlos sobre la burbuja blanca; 44 px en táctil; comparador apilado; tooltip acotado', () => {
  const css = fuente('../css/style.css');
  assert.doesNotMatch(css, /\.msg-content a:visited \{ color: #BED2FF/i, 'el visitado del tema oscuro no vuelve');
  assert.doesNotMatch(css, /\.msg-content a:hover \{ color: #FFFFFF/i);
  assert.match(css, /\.msg-content a:visited \{ color: #5a3d7a; \}/);
  const shell = fuente('../css/shell.css');
  const fin = shell.slice(shell.lastIndexOf('Objetivos táctiles de 44 px'));
  assert.match(fin, /@media \(pointer: coarse\) \{[\s\S]*\.msg-action-btn[\s\S]*min-height: 44px/, 'al final de shell.css, para ganar a las reglas compactas');
  assert.match(fin, /@media \(max-width: 600px\) \{[\s\S]*\.comparador-split \{ flex-direction: column/);
  assert.match(shell, /\.mexico-map-tooltip \{ max-width: min\(260px, calc\(100vw - 32px\)\); white-space: normal/);
});

test('2.7 timelapse en tema claro y con teclado: rampa del mapa, estados enfocables, botones con nombre', () => {
  const tl = fuente('../js/timelapse.js');
  assert.match(tl, /const RAMPA = \['#e3efe9', '#b6d5c6', '#7fb39b', '#3f8a6a', '#17644d'\];/);
  assert.doesNotMatch(tl, /#E7ECF5|#18223A'\);|interpolateColor\(/, 'sin la paleta oscura');
  assert.match(tl, /path\.setAttribute\('tabindex', '0'\)/);
  assert.match(tl, /path\.addEventListener\('focus'/);
  assert.match(tl, /playBtn\.setAttribute\('aria-label', 'Reproducir'\)/);
  assert.match(tl, /slider\.setAttribute\('aria-label', 'Semana del pronóstico'\)/);
  assert.match(tl, /aria-pressed/);
  assert.match(fuente('../js/mexico-map.js'), /export function ubicaTooltip\(/);
});
