// Nombres visibles del radar (orden del autor, 24-nov-2026: «corrige también las erratas de los nombres del
// boletín»). Sólo presentación: los datos y las descargas conservan el nombre impreso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const imp = (rel) => import(pathToFileURL(resolve(root, rel)).href);
const actual = JSON.parse(leer('assets/boletin/actual.json'));
const data = JSON.parse(leer(`${actual.carpeta}/data.json`));
const indice = JSON.parse(leer('assets/boletin/history/index.json'));

test('erratas y marcas corregidas en pantalla', async () => {
  const { nombreVisible, corregido } = await imp('assets/boletin/nombres.mjs');
  const casos = {
    p65b2: 'Linfoma de Hodgkin', p65b3: 'Linfoma no Hodgkin', p38b3: 'Lepra', p43b3: 'Miasis', p23b2: 'COVID-19',
    p46b1: 'Enfermedad febril exantemática', p64b1: 'Tumor maligno de tráquea, bronquios y pulmón',
    p52b2: 'Edema, proteinuria y trastornos hipertensivos en el embarazo, parto y puerperio',
    'historical-dengue-a91-grave': 'Dengue grave', 'historical-6a8ae1adc74a': 'Infección asociada a la atención de la salud',
  };
  const impresos = Object.fromEntries([...indice.categories, ...data.diseases].map((c) => [c.id, c.name]));
  for (const [id, esperado] of Object.entries(casos)) {
    assert.ok(impresos[id], `${id} existe`);
    assert.equal(nombreVisible(id, impresos[id]), esperado, id);
    // Un espacio doble se limpia sin anunciarlo; una errata real muestra el nombre impreso en la ficha.
    assert.equal(corregido(id, impresos[id]), id !== 'p46b1', id);
  }
  assert.equal(nombreVisible('p70b1', 'Depresión'), 'Depresión');
  assert.equal(corregido('p70b1', 'Depresión'), false);
});

test('ningún nombre visible conserva erratas conocidas, marcas de nota, espacios dobles ni rótulos revueltos', async () => {
  const { nombreVisible } = await imp('assets/boletin/nombres.mjs');
  for (const c of [...indice.categories, ...data.diseases]) {
    const v = nombreVisible(c.id, c.name);
    assert.doesNotMatch(v, /Hodking|transtorno|traquea\b|[°*^•]|\s{2}|Asociada a la a|Mordeduras por Serpiente Mordeduras/, `${c.id}: ${v}`);
    assert.doesNotMatch(v, /\b(Por|Del|Las|Grave|Signos|Alarma)\b/, `${c.id}: mayúscula de título en «${v}»`);
  }
});

test('las correcciones no tocan los datos: data.json y el histórico conservan el nombre impreso', () => {
  assert.equal(data.diseases.find((d) => d.id === 'p65b2').name, 'Linfoma Hodking');
  assert.equal(indice.categories.find((c) => c.id === 'p38b3').name, 'Lepra°');
  assert.match(leer('assets/boletin/radar.js'), /d\.nombre_impreso=d\.name;d\.name=nombreVisible\(d\.id,d\.name\)/);
  assert.match(leer('assets/boletin/radar.js'), /Nombre impreso en el boletín: «/);
  assert.match(leer('assets/boletin/curves.js'), /rows\.push\(\[d\.impreso\?\?d\.name,/);
});
