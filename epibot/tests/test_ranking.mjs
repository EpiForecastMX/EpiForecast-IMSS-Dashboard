/**
 * test_ranking.mjs — 47.2-B4: el ranking de entidades dice la verdad (R59-P0).
 *
 * Lo que protege: `answerBoletin` servía SIEMPRE `boletin.ranking_entidades` —una tabla sin
 * dimensión de padecimiento— y sólo cambiaba el título. "ranking de depresion", "mas parkinson" y
 * "donde hay mas alzheimer" devolvían las MISMAS cifras. Ni `mustContain` ni la igualdad del
 * handler lo detectan: el texto contenía el padecimiento y el handler era el correcto. Sólo mirar
 * los números lo delata, y eso es lo que se fija aquí.
 *
 * También fija que un subtotal no se presente como total nacional, que CDMX y Distrito Federal
 * cuenten como una entidad, y que la cobertura parcial se declare.
 *
 * Uso: node --test tests/test_ranking.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const kraw = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(kraw) });
Math.random = () => 0.42;
const { answer, loadKnowledge, _resetContext } = await import('../js/kb.js');
const D = await loadKnowledge();

const PADS = ['Depresion', 'Parkinson', 'Alzheimer'];

async function responder(query) {
  _resetContext();
  const r = await answer(query);
  assert.ok(r, `${JSON.stringify(query)} debe responder`);
  return r;
}

/** Filas `| # | Entidad | 1,234 | 5.6% |` → [{entidad, casos}] */
function filas(texto) {
  return [...texto.matchAll(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([\d,]+)\s*\|/gm)]
    .map(m => ({ entidad: m[1], casos: Number(m[2].replace(/,/g, '')) }));
}

/** Suma esperada por entidad canónica, calculada aparte del código que se prueba. */
function esperadoPorEntidad(pad) {
  const acum = new Map();
  for (const [entidad, pads] of Object.entries(D.boletin.anual_por_estado_pad)) {
    if (!pads[pad]) continue;
    const canon = entidad === 'Distrito Federal' ? 'Ciudad de Mexico' : entidad;
    const suma = Object.values(pads[pad]).reduce((a, c) => a + c, 0);
    acum.set(canon, (acum.get(canon) || 0) + suma);
  }
  return acum;
}

const nacional = pad => Object.values(D.boletin.anual_por_pad[pad]).reduce((a, c) => a + c, 0);

test('los rankings de los tres padecimientos NO son intercambiables', async () => {
  const [dep, par, alz] = await Promise.all([
    responder('ranking de depresion'),
    responder('que estados tienen mas parkinson'),
    responder('donde hay mas alzheimer'),
  ]);
  assert.notEqual(filas(dep)[0].casos, filas(par)[0].casos, 'Depresion y Parkinson dan la misma cifra');
  assert.notEqual(filas(par)[0].casos, filas(alz)[0].casos, 'Parkinson y Alzheimer dan la misma cifra');
  assert.notEqual(filas(dep)[0].casos, filas(alz)[0].casos, 'Depresion y Alzheimer dan la misma cifra');
  // Y ninguno puede ser el ranking genérico, que es de otra fuente.
  const generico = await responder('ranking de entidades por incidencia');
  for (const [nombre, r] of [['Depresion', dep], ['Parkinson', par], ['Alzheimer', alz]]) {
    assert.notEqual(filas(r)[0].casos, filas(generico)[0].casos, `${nombre} reusa ranking_entidades`);
  }
});

test('cada cifra sale de anual_por_estado_pad del padecimiento pedido', async () => {
  for (const pad of PADS) {
    const texto = await responder(`ranking de ${pad.toLowerCase()}`);
    const esperado = esperadoPorEntidad(pad);
    for (const f of filas(texto)) {
      assert.equal(f.casos, esperado.get(f.entidad),
        `${pad} · ${f.entidad}: ${f.casos} ≠ ${esperado.get(f.entidad)} del boletín`);
    }
  }
});

test('el denominador es el total nacional de anual_por_pad, y se declara', async () => {
  for (const pad of PADS) {
    const texto = await responder(`ranking de ${pad.toLowerCase()}`);
    const total = nacional(pad);
    assert.ok(texto.includes(total.toLocaleString('en-US')),
      `${pad}: la respuesta debe declarar el total nacional ${total}`);
    // El porcentaje de la primera fila se calcula contra ESE total, no contra el subtotal.
    const primera = filas(texto)[0];
    const pct = [...texto.matchAll(/\|\s*1\s*\|[^|]+\|[^|]+\|\s*([\d.]+)%/g)][0][1];
    assert.equal(pct, ((primera.casos / total) * 100).toFixed(1), `${pad}: % con denominador falso`);
  }
});

test('CDMX aparece una vez y suma las dos grafías históricas', async () => {
  const texto = await responder('ranking de parkinson');
  const cdmx = filas(texto).filter(f => /Ciudad de Mexico|Distrito Federal/.test(f.entidad));
  assert.equal(cdmx.length, 1, 'Ciudad de Mexico y Distrito Federal son la MISMA entidad');
  assert.equal(cdmx[0].entidad, 'Ciudad de Mexico');
  const ape = D.boletin.anual_por_estado_pad;
  const suma = Object.values(ape['Ciudad de Mexico'].Parkinson).reduce((a, c) => a + c, 0)
    + Object.values(ape['Distrito Federal'].Parkinson).reduce((a, c) => a + c, 0);
  assert.equal(cdmx[0].casos, suma, 'debe SUMAR ambas claves, no quedarse con una');
});

test('la cobertura parcial se declara y nunca se llama ranking nacional completo', async () => {
  for (const q of ['ranking de depresion', 'ranking de entidades por incidencia', 'donde hay mas alzheimer']) {
    const texto = await responder(q);
    assert.match(texto, /no las 32/, `${q}: debe declarar que no cubre las 32 entidades`);
    assert.ok(!/nacional completo|ranking nacional\b(?! de)/i.test(texto), `${q}: se presenta como nacional completo`);
  }
});

test('el ranking genérico no llama "total" a su subtotal', async () => {
  const texto = await responder('ranking de entidades por incidencia');
  assert.ok(!/\*\*Total acumulado\*\*/.test(texto), 'el subtotal de las disponibles no es un total');
  const disponibles = D.boletin.ranking_entidades.reduce((a, r) => a + r.casos, 0);
  const nac = PADS.reduce((a, p) => a + nacional(p), 0);
  assert.ok(texto.includes(disponibles.toLocaleString('en-US')), 'declara el subtotal cubierto');
  assert.ok(texto.includes(nac.toLocaleString('en-US')), 'declara el total nacional verdadero');
  assert.ok(disponibles < nac, 'premisa: el subtotal es menor que el nacional');
});

test('"cual sexo tiene mas incidencia" responde por sexo, nunca con entidades', async () => {
  const texto = await responder('cual sexo tiene mas incidencia');
  assert.match(texto, /mujeres/i);
  assert.match(texto, /hombres/i);
  assert.equal(filas(texto).length, 0, 'no puede devolver una tabla numerada de entidades');
  assert.ok(!/Jalisco|Ciudad de Mexico|Chihuahua/.test(texto), 'no menciona entidades');
  // Declara el universo que suma, sin hardcodearlo.
  const pads = Object.keys(D.stats.demo_historica);
  assert.ok(texto.includes(`los ${pads.length} padecimientos`), 'declara cuántos padecimientos suma');
  for (const p of pads) assert.ok(texto.includes(p), `debe nombrar ${p}`);
});

test('la pregunta por sexo respeta el padecimiento nombrado', async () => {
  // Hallazgo de la auditoría de B4: "hombres o mujeres tienen mas depresion" contestaba con el
  // agregado de los cuatro padecimientos (Dengue incluido). La tabla traía el dato, pero el
  // titular respondía otra pregunta — el mismo vicio que R59-P0 (47.2-B4.1).
  const texto = await responder('hombres o mujeres tienen mas depresion');
  const dep = D.stats.demo_historica.Depresion;
  assert.match(texto, /Depresion/);
  assert.ok(!texto.includes('Dengue'), 'no puede sumar padecimientos que nadie pidió');
  assert.ok(texto.includes(dep.mujeres.toLocaleString('en-US')), 'las cifras son las de Depresion');
  assert.ok(texto.includes(`${dep.pct_m}%`), `el % debe ser el de Depresion (${dep.pct_m}%)`);
  // Sin padecimiento nombrado sigue siendo el agregado, declarando su universo.
  const global = await responder('cual sexo tiene mas incidencia');
  assert.ok(global.includes('Dengue'), 'el agregado sí suma todas las claves presentes');
});

test('alterar la fuente de un padecimiento mueve SÓLO su ranking', async () => {
  const antes = { Depresion: await responder('ranking de depresion'),
    Parkinson: await responder('ranking de parkinson'),
    Alzheimer: await responder('donde hay mas alzheimer') };
  const serie = D.boletin.anual_por_estado_pad.Nayarit.Parkinson;
  const anio = Object.keys(serie)[0];
  const original = serie[anio];
  serie[anio] = original + 1_000_000;          // Nayarit debería saltar al primer puesto
  try {
    const despues = { Depresion: await responder('ranking de depresion'),
      Parkinson: await responder('ranking de parkinson'),
      Alzheimer: await responder('donde hay mas alzheimer') };
    assert.notEqual(despues.Parkinson, antes.Parkinson, 'el ranking tocado debe moverse');
    assert.equal(filas(despues.Parkinson)[0].entidad, 'Nayarit');
    assert.equal(despues.Depresion, antes.Depresion, 'Depresion no puede moverse');
    assert.equal(despues.Alzheimer, antes.Alzheimer, 'Alzheimer no puede moverse');
  } finally {
    serie[anio] = original;
  }
});
