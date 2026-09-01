import test from 'node:test';
import assert from 'node:assert/strict';

import { buildComparadorState } from '../js/comparador_data.js';

test('el comparador conserva el motor de cada padecimiento', () => {
  const state = buildComparadorState({
    estado: 'Nuevo Leon',
    total: 300,
    models: [
      { pad: 'Depresion', casos: 240, smape: 12.4, motor: 'DeepAR' },
      { pad: 'Alzheimer', casos: 60, smape: 18.6, motor: 'Prophet' },
    ],
  });

  assert.equal(state.pads.Depresion.motor, 'DeepAR');
  assert.equal(state.pads.Alzheimer.motor, 'Prophet');
  assert.equal(state.pads.Depresion.casos, 240);
  assert.equal(state.smape, 15.5);
  assert.notEqual(state.pads.Depresion.motor, '?');
});

test('el motor principal sigue siendo el más frecuente', () => {
  const state = buildComparadorState({
    estado: 'Jalisco',
    total: 10,
    models: [
      { pad: 'Depresion', casos: 5, smape: 10, motor: 'DeepAR' },
      { pad: 'Alzheimer', casos: 3, smape: 20, motor: 'DeepAR' },
      { pad: 'Parkinson', casos: 2, smape: 30, motor: 'Prophet' },
    ],
  });

  assert.equal(state.motor, 'DeepAR');
});
