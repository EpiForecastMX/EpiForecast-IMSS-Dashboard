// Plan canónico del EpiBot 3.3 (26-nov-2026): influenza, COVID-19 y enfermedad febril exantemática muestran en el radar sólo
// los casos impresos en el boletín, en gris y con la leyenda «Casos impresos en el boletín, sin modelo», sin la referencia
// exploratoria (una media de años anteriores podría leerse como un pronóstico de brotes que cambian mucho de un año a otro).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const leer = (r) => readFileSync(resolve(root, r), 'utf8');
const json = (r) => JSON.parse(leer(r));
const imp = (r) => import(pathToFileURL(resolve(root, r)).href);
const actual = json('assets/boletin/actual.json');
const data = json(`${actual.carpeta}/data.json`);
const doc = json(`${actual.carpeta}/pronostico_exploratorio.json`);
const ROTULO = 'Casos impresos en el boletín, sin modelo';

test('las tres categorías, y sólo ellas, quedan con los casos impresos y sin referencia exploratoria', async () => {
  const { esSoloObservado, ROTULO_SOLO_OBSERVADO, desdeExploratorio } = await imp('assets/boletin/pronostico.mjs');
  assert.equal(ROTULO_SOLO_OBSERVADO, ROTULO);
  const solo = data.diseases.filter((e) => !e.aggregate && esSoloObservado(e)).map((e) => e.name).sort();
  assert.deepEqual(solo, ['Covid 19', 'Enfermedad febril  exantemática', 'Influenza']);
  for (const e of data.diseases.filter((x) => !x.aggregate && esSoloObservado(x))) {
    const c = doc.categorias[e.id];
    assert.equal(c.metodo, 'solo_observado', e.name);
    assert.equal(c.pronostico, null, e.name);
    const m = desdeExploratorio(doc, e.id, [{ ds: '2026-10-25', y: 10 }]);
    assert.equal(m.solo_observado, true);
    assert.deepEqual(m.pronostico, []);
    assert.equal(m.observado.length, 1, 'la serie impresa sí se muestra');
  }
  // Ninguna otra categoría pierde su referencia por esta regla.
  const otras = Object.values(doc.categorias).filter((c) => c.metodo === 'solo_observado');
  assert.equal(otras.length, 3);
});

test('gráfica en gris con la leyenda dentro, rótulo del panel y nota de la ficha', () => {
  const vista = leer('assets/boletin/pronostico_vista.mjs');
  assert.match(vista, /class="curve-line \$\{m\.solo_observado \? 'curve-line--sin-modelo' : 'curve-year-2025'\}"/);
  assert.match(vista, /class="forecast-watermark forecast-watermark--sin-modelo">\$\{esc\(ROTULO_SOLO_OBSERVADO\)\}<\/text>/);
  assert.match(vista, /if \(m\.tipo === 'exploratorio' && m\.solo_observado\) \{\n\s+return `<p class="forecast-label forecast-label--sin" role="note"><b>\$\{esc\(ROTULO_SOLO_OBSERVADO\)\}\.<\/b>/);
  assert.match(leer('assets/boletin/radar.css'), /\.curve-line--sin-modelo\{stroke:#6b7280\}/);
  const radar = leer('assets/boletin/radar.js');
  assert.match(radar, /if\(c\.metodo===METODO_SOLO_OBSERVADO\)return `<p class="detail-note forecast-note"><b>\$\{esc\(ROTULO_SOLO_OBSERVADO\)\}\.<\/b>/);
  assert.match(leer('boletin.html'), /3 muestran sólo los casos impresos en el boletín, sin modelo\./);
});

test('EpiBot y función RAG: influenza dice que el radar muestra sólo los casos impresos, sin cifras de una referencia', async () => {
  const { referenciaExploratoria } = await imp('assets/boletin/pronostico.mjs');
  const flu = Object.values(doc.categorias).find((c) => c.nombre === 'Influenza');
  assert.equal(referenciaExploratoria(flu, 'radar'), 'En su opción «Pronóstico», el radar muestra sólo los casos impresos en el boletín, sin modelo ni referencia exploratoria.');
  const { respuestaNoModelableRag } = await imp('epibot/netlify/lib/radar_no_modelable.mjs');
  // COVID-19 es «Rechazada»: la función la contesta con su evidencia de rechazados, no con esta ruta.
  for (const q of ['influenza J09-J11', 'enfermedad febril exantemática']) {
    const r = respuestaNoModelableRag(q, data, { exploratorio: doc });
    assert.ok(r && r.includes('sólo los casos impresos en el boletín, sin modelo'), `${q}: ${r}`);
    assert.doesNotMatch(r, /Pronóstico exploratorio, no validado/, q);
  }
});
