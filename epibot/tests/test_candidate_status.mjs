/**
 * test_candidate_status.mjs — C7.6-STATUS-B: el dashboard valida y transporta el estado prospectivo.
 *
 * Lo que protege: que la cifra candidate nunca viaje sin la condición bajo la que se autorizó
 * publicarla. El backend evalúa el gate; aquí se comprueba el CONTRATO que cruza los dos repos —el
 * bloque `publication_status` del shard— y que su etiqueta llegue intacta al view-model.
 *
 * Los fixtures se fabrican en un temporal. El gate contra el shard REAL del backend se ejecuta sólo
 * si se inyecta su ruta por `C7_SHARD_ROOT`; nunca se codifica la ubicación del otro repo.
 *
 * Uso:  node --test tests/test_candidate_status.mjs
 *       C7_SHARD_ROOT=<staging> node --test tests/test_candidate_status.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { CandidateError, checkPublicationStatus, findShards, loadCandidateShard } from '../scripts/lib/candidate.mjs';
import { buildCandidateView, UNCERTAINTY_LABEL } from '../scripts/lib/candidate_view.mjs';

const HEX = 'a'.repeat(64);
const ETIQUETA_0_4 = 'Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos';

const OBJETIVO = [
  [2026, 27],
  [2026, 28],
  [2026, 29],
  [2026, 30],
];

function estado({ verdict = 'INCOMPLETE', completed = [], label = ETIQUETA_0_4, ...extra } = {}) {
  return {
    schema: 'prospective_status.v2',
    gate_digest: HEX,
    evaluation_digest: 'b'.repeat(64),
    status_digest: 'c'.repeat(64),
    observation_dataset_id: 'obs_dataset',
    verdict,
    weeks_required: OBJETIVO.length,
    weeks_available: completed.length,
    completed_weeks: completed,
    target_weeks: OBJETIVO,
    label,
    ...extra,
  };
}

/** Escribe un shard candidate mínimo pero VÁLIDO, con el estado que se le pase. */
function fabricarShard(status, { label = status.label, statusWeb = status, labelWeb = label } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'shard-'));
  const root = join(dir, 'obesidad', 'obesidad_release_2517e7858901');
  mkdirSync(join(root, 'web'), { recursive: true });
  const comun = {
    schema: 'publication_shard.v1',
    disease_id: 'obesidad',
    release_id: 'obesidad_release_2517e7858901',
    lifecycle: 'trained',
    interval_method: 'none',
    uncertainty_available: false,
    rows: 2,
  };
  writeFileSync(
    join(root, 'shard_manifest.json'),
    JSON.stringify({ ...comun, publication_status: status, publication_label: label }),
  );
  writeFileSync(
    join(root, 'web', 'manifest.json'),
    JSON.stringify({ ...comun, publication_status: statusWeb, publication_label: labelWeb }),
  );
  writeFileSync(
    join(root, 'web', 'series.csv'),
    'ds,epi_year,epi_week,yhat_cases,yhat_lower,yhat_upper\n' +
      '2026-07-05,2026,27,10,,\n2026-07-12,2026,28,11,,\n',
  );
  return { dir, root };
}

const conShard = (status, opciones, fn) => {
  const { dir, root } = fabricarShard(status, opciones);
  try {
    return fn(root);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// ── Los cuatro estados ────────────────────────────────────────────────────────────────────────
test('INCOMPLETE 0/4: el view-model lleva etiqueta, point-only y no público', () => {
  conShard(estado(), {}, (root) => {
    const vista = buildCandidateView(loadCandidateShard(root));
    assert.equal(vista.validationLabel, ETIQUETA_0_4);
    assert.equal(vista.uncertaintyLabel, UNCERTAINTY_LABEL);
    assert.equal(vista.band, null);
    assert.equal(vista.isPubliclyVisible, false);
    assert.deepEqual([vista.weeksAvailable, vista.weeksRequired], [0, 4]);
    assert.equal(vista.verdict, 'INCOMPLETE');
  });
});

test('INCOMPLETE 1/4: el contador viaja tal cual lo emitió el backend', () => {
  const label = 'Validación prospectiva en curso (1/4 semanas) · pronóstico puntual sin intervalos';
  conShard(estado({ completed: [[2026, 27]], label }), {}, (root) => {
    const vista = buildCandidateView(loadCandidateShard(root));
    assert.equal(vista.validationLabel, label);
    assert.equal(vista.weeksAvailable, 1);
    assert.equal(vista.isPubliclyVisible, false);
  });
});

test('PASS 4/4 y FAIL 4/4 se transportan sin reinterpretarse', () => {
  for (const [verdict, texto] of [
    ['PASS', 'Validación prospectiva superada (4/4 semanas) · pronóstico puntual sin intervalos'],
    ['FAIL', 'Validación prospectiva NO superada (4/4 semanas) · pronóstico puntual sin intervalos'],
  ]) {
    conShard(estado({ verdict, completed: OBJETIVO, label: texto }), {}, (root) => {
      const vista = buildCandidateView(loadCandidateShard(root));
      assert.equal(vista.verdict, verdict);
      assert.equal(vista.validationLabel, texto);
      // Ni siquiera un PASS convierte un candidate en público: eso lo decide el lifecycle.
      assert.equal(vista.isPubliclyVisible, false);
    });
  }
});

// ── Rechazos ──────────────────────────────────────────────────────────────────────────────────
test('sin publication_status no hay view-model', () => {
  const { dir, root } = fabricarShard(estado());
  try {
    const manifiesto = JSON.parse(readFileSync(join(root, 'shard_manifest.json'), 'utf-8'));
    delete manifiesto.publication_status;
    writeFileSync(join(root, 'shard_manifest.json'), JSON.stringify(manifiesto));
    assert.throws(() => loadCandidateShard(root), /falta el bloque publication_status/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('un estado distinto entre los dos manifiestos se rechaza', () => {
  conShard(estado(), { statusWeb: estado({ completed: [[2026, 27]] }) }, (root) => {
    assert.throws(() => loadCandidateShard(root), /difiere entre shard_manifest\.json y web/);
  });
});

test('una etiqueta que no coincide con la del estado se rechaza', () => {
  conShard(estado(), { label: 'otra cosa', labelWeb: 'otra cosa' }, (root) => {
    assert.throws(() => loadCandidateShard(root), /publication_label no coincide/);
  });
  conShard(estado(), { labelWeb: 'sólo en web' }, (root) => {
    assert.throws(() => loadCandidateShard(root), /publication_label no coincide|difiere entre/);
  });
});

test('forma cerrada del bloque de estado', () => {
  const casos = [
    [{ schema: 'prospective_status.v1' }, /schema .* no soportado/],
    [{ gate_digest: 'ABC' }, /gate_digest no es un SHA256/],
    [{ evaluation_digest: 'B'.repeat(64) }, /evaluation_digest no es un SHA256/],
    [{ observation_dataset_id: '' }, /observation_dataset_id ausente o vacío/],
    [{ label: '   ' }, /label ausente o vacío/],
    [{ verdict: 'CASI' }, /verdict .* desconocido/],
    [{ weeks_available: true }, /weeks_available debe ser un entero/],
    [{ weeks_available: 1.5 }, /weeks_available debe ser un entero/],
    [{ weeks_available: 9 }, /conteo fuera de rango/],
    [{ weeks_available: -1 }, /conteo fuera de rango/],
    [{ completed_weeks: [[2026, 27]] }, /completed_weeks tiene 1 y declara 0/],
    [{ target_weeks: [[2026, 27]] }, /target_weeks tiene 1 y declara 4/],
    [{ target_weeks: [[2026, 60], [2026, 28], [2026, 29], [2026, 30]] }, /fuera de rango/],
    [{ target_weeks: [[2026, 27], [2026, 27], [2026, 29], [2026, 30]] }, /periodos repetidos/],
  ];
  for (const [cambio, patron] of casos) {
    assert.throws(() => checkPublicationStatus({ ...estado(), ...cambio }, 'fixture'), patron, JSON.stringify(cambio));
  }
});

test('veredicto y conteos no pueden contradecirse', () => {
  assert.throws(
    () => checkPublicationStatus(estado({ verdict: 'INCOMPLETE', completed: OBJETIVO }), 'fixture'),
    /INCOMPLETE con todas las semanas/,
  );
  assert.throws(
    () => checkPublicationStatus(estado({ verdict: 'PASS' }), 'fixture'),
    /PASS exige las 4 semanas/,
  );
});

test('las semanas completadas van ordenadas y dentro de la ventana declarada', () => {
  assert.throws(
    () =>
      checkPublicationStatus(
        estado({ completed: [[2026, 29], [2026, 27]] }),
        'fixture',
      ),
    /orden cronológico/,
  );
  assert.throws(
    () => checkPublicationStatus(estado({ completed: [[2026, 1]] }), 'fixture'),
    /anteriores a la primera semana objetivo/,
  );
});

test('el shard sigue rechazando intervalos, aunque el estado sea válido', () => {
  const { dir, root } = fabricarShard(estado());
  try {
    writeFileSync(
      join(root, 'web', 'series.csv'),
      'ds,epi_year,epi_week,yhat_cases,yhat_lower,yhat_upper\n' +
        '2026-07-05,2026,27,10,9,11\n2026-07-12,2026,28,11,,\n',
    );
    assert.throws(() => loadCandidateShard(root), /límites de intervalo|point-only/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Gate contra el shard REAL del backend ─────────────────────────────────────────────────────
const RAIZ_REAL = process.env.C7_SHARD_ROOT;

test('shard real del backend: 5,772 filas, 0/4 y point-only', { skip: !RAIZ_REAL }, () => {
  const shards = findShards(RAIZ_REAL);
  assert.equal(shards.length, 1, 'se esperaba exactamente un shard candidate');
  assert.equal(shards[0].diseaseId, 'obesidad');
  assert.equal(shards[0].releaseId, 'obesidad_release_2517e7858901');

  const shard = loadCandidateShard(shards[0].root);
  const vista = buildCandidateView(shard);
  assert.equal(shard.manifest.rows, 5772);
  assert.equal(shard.rows.length, 5772);
  assert.equal(vista.lifecycle, 'trained');
  assert.equal(vista.validationLabel, ETIQUETA_0_4);
  assert.equal(vista.uncertaintyLabel, UNCERTAINTY_LABEL);
  assert.equal(vista.band, null);
  assert.equal(vista.isPubliclyVisible, false);
  assert.deepEqual([vista.verdict, vista.weeksAvailable, vista.weeksRequired], ['INCOMPLETE', 0, 4]);
  assert.deepEqual(shard.manifest.channels_emitted.sort(), ['epibot', 'reports', 'tableau', 'web']);
  assert.deepEqual(shard.manifest.channels_without_bridge, []);
});

test('el índice y el knowledge PÚBLICOS siguen sin Obesidad', () => {
  for (const archivo of ['../rag_index.json', '../knowledge.json']) {
    const ruta = new URL(archivo, import.meta.url);
    if (!existsSync(ruta)) continue;
    const texto = readFileSync(ruta, 'utf-8').toLowerCase();
    assert.ok(!texto.includes('obesidad'), `${archivo} menciona Obesidad`);
  }
});
