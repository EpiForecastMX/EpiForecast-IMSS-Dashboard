import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { detectEntities, norm } from '../js/entities.js';
import { dn } from '../js/display.js';
import { weeklyV2, tituloSeguimientoMin, periodoBoletin } from '../js/kb.js';

// Ejecutar las funciones reales de la UI sin arrancar el DOM ni el RAG.
// APP_BASE permite comprobar que estas regresiones fallan en el árbol v2.
const app = readFileSync(process.env.APP_BASE || new URL('../js/app.js', import.meta.url), 'utf8');
const knowledge = JSON.parse(readFileSync(new URL('../knowledge.json', import.meta.url)));
const scope = { detectEntities, norm, dn, weeklyV2, tituloSeguimientoMin, periodoBoletin,
  metricasRetiradas: () => true, getData: () => knowledge };
function between(start, end) { return app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start))); }
const suggest = vm.runInNewContext(`(${between('function getSuggestions(', '\n// ---------------------------------------------------------------------------')})`, scope);
const polish = vm.runInNewContext(`${between('const SPANISH_FIXES =', '// Paleta mejorada')}\npolishSpanish`, scope);
const zoom = vm.runInNewContext(`(${between('function buildZoomChart(', '\nfunction buildTrendChart(')})`, scope);

test('zoom con padecimiento, tilde o consulta general ofrece comparar y conserva el padecimiento', () => {
  for (const [q, pad] of [['zoom depresion', 'Depresion'], ['zoom depresión', 'Depresion'],
    ['zoom parkinson', 'Parkinson'], ['zoom alzheimer', 'Alzheimer'], ['zoom dengue', 'Dengue'],
    ['zoom semanal', 'Depresion']]) {
    const buttons = suggest(q).filter(s => s.text === 'Comparar con la ronda anterior');
    assert.equal(buttons.length, 1, q);
    assert.equal(detectEntities(buttons[0].q).padecimiento, pad, q);
  }
});

test('la ortografía visible no cambia el destino canónico del enlace ni depende del valor por defecto', () => {
  for (const pad of Object.keys(knowledge.weekly_comparison)) {
    const md = `[Comparacion ${pad}](../comparacion_rondas.html?pad=${pad})`;
    const shown = polish(md);
    const href = shown.match(/\]\(([^)]+)\)/)[1];
    const parsed = new URL(href, 'https://example.test/epibot/');
    assert.equal(parsed.searchParams.get('pad'), pad);
    assert.ok(knowledge.weekly_comparison[parsed.searchParams.get('pad')]);
    assert.match(shown, /^\[Comparación /);
    if (pad === 'Depresion') assert.match(shown, /^\[Comparación Depresión\]/);
  }
  assert.equal(polish('[Pronostico](../Mexico/Depresion.png "mas")'),
    '[Pronóstico](../Mexico/Depresion.png "mas")');
});

test('el zoom nacional dispone de título legible en tres líneas sin comprimir una frase larga', () => {
  for (const pad of Object.keys(knowledge.weekly_comparison)) {
    const chart = zoom(knowledge, norm(`zoom ${pad}`), { padecimiento: pad });
    const title = chart.options.plugins?.title;
    assert.ok(title && Array.isArray(title.text), pad);
    assert.equal(title.text.length, 3);
    assert.ok(title.text.every(line => line.length <= 30));
    assert.ok(title.font.size >= 13);
    assert.ok(title.text.some(line => line.includes('W37')));
    assert.ok(title.text.some(line => line.includes('2026')));
    // La corrección del título conserva las series y su separación postcorte.
    const rows = knowledge.weekly_comparison[pad].semanas;
    const forecast = chart.datasets.find(s => s.label.startsWith('Pronóstico desde el corte'));
    assert.equal(forecast.data.filter(Number.isFinite).length,
      rows.filter(row => row.fase !== 'observado' && Number.isFinite(row.pronostico)).length);
    for (const [i, row] of rows.entries()) {
      if (row.fase === 'observado') assert.equal(forecast.data[i], null);
    }
  }
});
