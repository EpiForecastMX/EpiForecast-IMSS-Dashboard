/**
 * La hora de generación no puede invalidar el índice; una cifra sí debe hacerlo.
 *
 * `validacion_semanal.html` lleva al pie un sello "Generado: DD/MM/AAAA HH:MM hrs" que
 * cambia en cada corrida aunque los datos sean idénticos. Como el archivo alimenta el
 * corpus, esa hora bastaba para invalidar el índice entero y obligar a reindexar sin que
 * hubiera cambiado un solo dato: regenerar el material y tener un índice válido pasaban
 * a ser objetivos que se perseguían mutuamente.
 *
 * Estas pruebas fijan las dos mitades del contrato. La hora se neutraliza SOLO para el
 * contenido semántico y SOLO en ese documento; el HTML publicado la conserva, y cualquier
 * cambio real de contenido sigue moviendo el hash.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NORMALIZA_SELLO,
  chunkHash,
  normalizaSelloDeGeneracion,
} from '../scripts/lib/corpus.mjs';

const informe = (hora, casos = '1 234') => `<!doctype html>
<html><head><title>Validación semanal</title></head><body>
  <h2>Resultados de la semana</h2>
  <p>Depresión nacional: ${casos} casos observados frente a 1 200 pronosticados.</p>
  <p>Datos: Boletin Epidemiologico SINAVE | Generado: ${hora} hrs</p>
</body></html>`;

test('dos informes idénticos salvo por la hora producen el mismo contenido semántico', () => {
  const a = normalizaSelloDeGeneracion(informe('18/08/2026 19:37'));
  const b = normalizaSelloDeGeneracion(informe('18/08/2026 21:07'));

  assert.equal(a, b, 'la hora debe dejar de distinguirlos');
});

test('dos informes idénticos salvo por la hora producen el mismo hash de chunk', () => {
  const chunkDe = (hora) => ({
    id: 'validacion_semanal#0',
    source: 'Validación semanal',
    text: normalizaSelloDeGeneracion(informe(hora)),
  });

  assert.equal(chunkHash(chunkDe('18/08/2026 19:37')), chunkHash(chunkDe('18/08/2026 21:07')));
});

test('cambiar una cifra SÍ cambia el hash', () => {
  const chunkDe = (casos) => ({
    id: 'validacion_semanal#0',
    source: 'Validación semanal',
    text: normalizaSelloDeGeneracion(informe('18/08/2026 19:37', casos)),
  });

  assert.notEqual(
    chunkHash(chunkDe('1 234')),
    chunkHash(chunkDe('1 999')),
    'una cifra distinta debe reindexarse',
  );
});

test('cambiar una conclusión SÍ cambia el hash', () => {
  const base = normalizaSelloDeGeneracion(informe('18/08/2026 19:37'));
  const otra = base.replace('casos observados', 'casos confirmados por laboratorio');

  assert.notEqual(
    chunkHash({ id: 'v#0', source: 'V', text: base }),
    chunkHash({ id: 'v#0', source: 'V', text: otra }),
  );
});

test('la normalización NO toca el HTML que se publica', () => {
  const original = informe('18/08/2026 19:37');
  const paraCorpus = normalizaSelloDeGeneracion(original);

  assert.match(original, /Generado: 18\/08\/2026 19:37 hrs/, 'el original conserva su sello');
  assert.doesNotMatch(paraCorpus, /19:37/, 'la copia para el índice no lo lleva');
  assert.notEqual(original, paraCorpus, 'son objetos distintos: no se muta la fuente');
});

test('la normalización es estrecha: solo ese patrón y solo ese documento', () => {
  // Fechas que SÍ son contenido: semanas epidemiológicas, cortes, periodos.
  const conFechasReales = `<p>Corte del boletín: 27/07/2026. Semana 31 de 2026.</p>
    <p>Generado: 18/08/2026 19:37 hrs</p>`;
  const salida = normalizaSelloDeGeneracion(conFechasReales);

  assert.match(salida, /Corte del boletín: 27\/07\/2026/, 'no borra fechas de contenido');
  assert.match(salida, /Semana 31 de 2026/, 'no borra la semana epidemiológica');
  assert.doesNotMatch(salida, /19:37/, 'sí neutraliza el sello de generación');

  assert.ok(NORMALIZA_SELLO.has('validacion_semanal.html'));
  assert.equal(NORMALIZA_SELLO.size, 1, 'la excepción es de un solo documento');
});

test('un informe sin sello de generación queda intacto', () => {
  const sinSello = '<p>Depresión nacional: 1 234 casos.</p>';

  assert.equal(normalizaSelloDeGeneracion(sinSello), sinSello);
});
