/**
 * Calendario MMWR en las superficies del EpiBot: la primera semana fuera de muestra es la SIGUIENTE
 * al origen en el calendario (años de 52 y 53 semanas), no `origin[1] + 1`.
 *
 * Regresión: obesidad_charts.js construía `[origin[0], origin[1] + 1]`; con un origen 2026-W52 (año
 * de 52 semanas) rotulaba «2026-W53», que no existe, y con 2025-W53 rotulaba «2025-W54». Un
 * padecimiento con rezago impreso 0 tiene el origen una semana más tarde que los de rezago 1, así
 * que llega antes a esos cruces.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const { semanaSiguiente, semanasDelAnio } = await import('../js/calendario_boletin.js?v=2');
const oc = await import('../js/obesidad_charts.js?v=3');
const VISTA = JSON.parse(readFileSync(new URL('../../publication/obesidad/vista.json', import.meta.url), 'utf-8'));

test('semanas por año con la regla del 4 de enero (igual que epi_calendar.py)', () => {
  const esperado = { 2014: 53, 2015: 52, 2020: 53, 2021: 52, 2024: 52, 2025: 53, 2026: 52, 2027: 52 };
  for (const [y, n] of Object.entries(esperado)) assert.equal(semanasDelAnio(Number(y)), n, y);
});

test('semanaSiguiente cruza 52/53 → 01 con el calendario', () => {
  const casos = [
    [[2014, 53, 1], [2015, 1]],
    [[2020, 52, 1], [2020, 53]],
    [[2020, 53, 1], [2021, 1]],
    [[2025, 52, 1], [2025, 53]],
    [[2025, 53, 1], [2026, 1]],
    [[2026, 52, 1], [2027, 1]],
    [[2026, 43, 1], [2026, 44]],
    [[2026, 1, -1], [2025, 53]],
    [[2021, 1, -1], [2020, 53]],
    [[2026, 49, 4], [2027, 1]],
    [[2025, 50, 4], [2026, 1]],
  ];
  for (const [[y, w, k], esperado] of casos) {
    assert.deepEqual(semanaSiguiente(y, w, k), esperado, `${y}-W${w} ${k >= 0 ? '+' : ''}${k}`);
  }
});

test('una semana inexistente falla ruidosamente', () => {
  assert.throws(() => semanaSiguiente(2026, 53, 1), RangeError);
  assert.throws(() => semanaSiguiente(2026, 0, 1), RangeError);
  assert.throws(() => semanaSiguiente(2026, 1.5, 1), RangeError);
});

function conOrigen(origen, corte) {
  return { ...VISTA, origin: origen, observation_cutoff: corte };
}

test('el rótulo «fuera de muestra» de las gráficas arranca en la semana MMWR siguiente al origen', () => {
  const casos = [
    [[2026, 52], [2027, 2], '2027-W01–2027-W02'],
    [[2025, 53], [2026, 2], '2026-W01–2026-W02'],
    [[2025, 52], [2026, 1], '2025-W53–2026-W01'],
    [[2026, 43], [2026, 44], '2026-W44–2026-W44'],
  ];
  for (const [origen, corte, rango] of casos) {
    const v = conOrigen(origen, corte);
    const ranking = oc.graficaObesidad(v, 'ranking de obesidad', {}, { tipo: 'ranking' });
    assert.ok(ranking, `ranking con origen ${origen}`);
    assert.ok(ranking.title.includes(`fuera de muestra, ${rango}`), `${origen}: ${ranking.title}`);
    const mapa = oc.graficaObesidad(v, 'mapa de obesidad por error', {}, { tipo: 'mapa' });
    assert.ok(mapa, `mapa con origen ${origen}`);
    const titulo = mapa.title || mapa.mapData?.title || JSON.stringify(mapa);
    assert.ok(titulo.includes(`fuera de muestra, ${rango}`), `${origen}: ${titulo}`);
  }
});
