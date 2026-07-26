/**
 * test_candidate_staging.mjs — Gate de C7.3b/C7.3c.
 *
 * Lo que se protege:
 *  - un shard CANDIDATE se consume en staging y nunca se declara visible en público;
 *  - el vacío de un intervalo NO se convierte en 0 ni en una banda falsa;
 *  - el corpus por defecto NO cambia por la mera existencia de un candidate (el índice publicado
 *    no puede derivar solo);
 *  - el índice publicado no menciona al padecimiento candidate.
 *
 * Los shards se fabrican aquí, en un temporal: la prueba no depende del repo principal.
 * Uso: node --test tests/test_candidate_staging.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import {
  CandidateError,
  SHARD_SCHEMA,
  findShards,
  loadCandidateShard,
  parseCSV,
} from '../scripts/lib/candidate.mjs';
import {
  UNCERTAINTY_LABEL,
  hasInterval,
  isPubliclyVisible,
  toChartSeries,
  toValue,
} from '../js/point_only.js';
import { buildChunks, chunkHash } from '../scripts/lib/corpus.mjs';

const COLUMNAS = ['disease_id', 'geography_level', 'sex', 'epi_year', 'epi_week', 'ds',
  'yhat_cases', 'engine', 'derived', 'interval_method', 'yhat_lower', 'yhat_upper'];

function fabricarShard(opciones = {}) {
  const { lifecycle = 'trained', filas = 2, conLimites = false,
    intervalMethod = 'none', uncertainty = false, filasDeclaradas = null } = opciones;
  const raiz = mkdtempSync(join(tmpdir(), 'stage-'));
  const root = join(raiz, 'padecimiento_x', 'padecimiento_x_release_abc123456789');
  mkdirSync(join(root, 'web'), { recursive: true });
  mkdirSync(join(root, 'epibot', 'corpus'), { recursive: true });

  const cuerpo = [];
  for (let i = 0; i < filas; i++) {
    cuerpo.push(['padecimiento_x', 'nacional', 'general', '2026', String(27 + i),
      `2026-07-0${i + 1}`, String(100 + i), 'portfolio', 'True', intervalMethod,
      conLimites ? '90' : '', conLimites ? '110' : ''].join(','));
  }
  writeFileSync(join(root, 'web', 'series.csv'), [COLUMNAS.join(','), ...cuerpo].join('\n') + '\n');
  const base = {
    schema: opciones.schema === undefined ? SHARD_SCHEMA : opciones.schema,
    release_id: 'padecimiento_x_release_abc123456789',
    disease_id: 'padecimiento_x',
    lifecycle,
    rows: filasDeclaradas === null ? filas : filasDeclaradas,
    interval_method: intervalMethod,
    uncertainty_available: uncertainty,
  };
  writeFileSync(join(root, 'shard_manifest.json'), JSON.stringify(base));
  writeFileSync(join(root, 'web', 'manifest.json'), JSON.stringify(base));
  writeFileSync(join(root, 'epibot', 'corpus', 'padecimiento_x.md'), '# corpus candidate\n');
  return { raiz, root };
}

// ── El vacío es ausencia, nunca cero ──────────────────────────────────────────────────────────
test('toValue trata el vacío como ausencia y jamás como 0', () => {
  for (const vacio of ['', '  ', null, undefined, 'nan', 'NaN', 'None', 'no-es-numero']) {
    assert.equal(toValue(vacio), null, `${JSON.stringify(vacio)} debería ser null`);
  }
  assert.equal(toValue('0'), 0);
  assert.equal(toValue('14930.38'), 14930.38);
});

test('hasInterval es falso si a cualquier fila le falta un límite', () => {
  assert.equal(hasInterval([{ yhat_lower: '1', yhat_upper: '2' }]), true);
  assert.equal(hasInterval([{ yhat_lower: '1', yhat_upper: '2' }, { yhat_lower: '', yhat_upper: '2' }]), false);
  assert.equal(hasInterval([]), false);
});

test('con interval_method=none la banda es null, no ceros ni una copia de la línea', () => {
  const filas = [{ ds: '2026-07-06', epi_year: '2026', epi_week: '27', yhat_cases: '100', yhat_lower: '', yhat_upper: '' }];
  const serie = toChartSeries(filas, { intervalMethod: 'none' });
  assert.equal(serie.band, null);
  assert.equal(serie.uncertaintyLabel, UNCERTAINTY_LABEL);
  assert.equal(serie.points[0].yhat, 100);
  assert.ok(!JSON.stringify(serie).includes('[0,0]'));
});

test('aunque llegaran límites, interval_method=none manda: no se dibuja banda', () => {
  const filas = [{ yhat_cases: '100', yhat_lower: '90', yhat_upper: '110' }];
  assert.equal(toChartSeries(filas, { intervalMethod: 'none' }).band, null);
});

// ── Candidate nunca es público ────────────────────────────────────────────────────────────────
test('un shard trained no es públicamente visible', () => {
  assert.equal(isPubliclyVisible({ lifecycle: 'trained' }), false);
  assert.equal(isPubliclyVisible({ lifecycle: 'configured' }), false);
  assert.equal(isPubliclyVisible(null), false);
  assert.equal(isPubliclyVisible({ lifecycle: 'published' }), true);
});

test('loadCandidateShard marca el shard como candidate y valida sus conteos', () => {
  const { raiz, root } = fabricarShard({ filas: 3 });
  try {
    const shard = loadCandidateShard(root);
    assert.equal(shard.isCandidate, true);
    assert.equal(shard.rows.length, 3);
    assert.equal(shard.manifest.disease_id, 'padecimiento_x');
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('findShards descubre los shards sin adivinar nombres', () => {
  const { raiz } = fabricarShard({});
  try {
    const hallados = findShards(raiz);
    assert.equal(hallados.length, 1);
    assert.equal(hallados[0].diseaseId, 'padecimiento_x');
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

// ── Rechazos ──────────────────────────────────────────────────────────────────────────────────
const RECHAZOS = [
  ['declara incertidumbre', { uncertainty: true }, /point-only/],
  ['declara intervalos', { intervalMethod: 'quantile' }, /point-only/],
  ['trae límites en una fila', { conLimites: true }, /límites de intervalo/],
  ['miente en el conteo de filas', { filasDeclaradas: 99 }, /filas y el manifiesto declara/],
  ['viene de otro schema', { schema: 'publication_shard.v2' }, /no soportado/],
  ['no declara schema', { schema: null }, /no soportado/],
];
for (const [nombre, opciones, patron] of RECHAZOS) {
  test(`se rechaza un shard que ${nombre}`, () => {
    const { raiz, root } = fabricarShard(opciones);
    try {
      assert.throws(() => loadCandidateShard(root), (e) => e instanceof CandidateError && patron.test(e.message));
    } finally { rmSync(raiz, { recursive: true, force: true }); }
  });
}

test('se rechaza un shard sin manifiesto', () => {
  const { raiz, root } = fabricarShard({});
  try {
    rmSync(join(root, 'shard_manifest.json'));
    assert.throws(() => loadCandidateShard(root), CandidateError);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('el schema del shard es un contrato ENTRE REPOS y se verifica', () => {
  const { raiz, root } = fabricarShard({});
  try {
    assert.equal(loadCandidateShard(root).manifest.schema, SHARD_SCHEMA);
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('parseCSV rechaza una fila con distinto número de campos', () => {
  assert.throws(() => parseCSV('a,b\n1,2,3\n', 'x'), CandidateError);
});

// ── El corpus publicado no deriva solo ────────────────────────────────────────────────────────
test('buildChunks sin candidateRoot da EXACTAMENTE el mismo corpus', () => {
  const a = buildChunks().chunks.map(chunkHash).join('|');
  const b = buildChunks({ candidateRoot: null }).chunks.map(chunkHash).join('|');
  const c = buildChunks({ candidateRoot: '/ruta/que/no/existe' }).chunks.map(chunkHash).join('|');
  assert.equal(a, b);
  assert.equal(a, c, 'un candidateRoot inexistente no puede alterar el corpus publicado');
});

test('buildChunks con candidateRoot añade el corpus candidate y sólo ese', () => {
  const { raiz } = fabricarShard({});
  try {
    const base = buildChunks().chunks;
    const ampliado = buildChunks({ candidateRoot: raiz }).chunks;
    assert.equal(ampliado.length, base.length + 1);
    const nuevo = ampliado[ampliado.length - 1];
    assert.match(nuevo.id, /^candidate:padecimiento_x:/);
    assert.equal(nuevo.url, null, 'un candidate no tiene página pública donde enlazarse');
  } finally { rmSync(raiz, { recursive: true, force: true }); }
});

test('el índice RAG PUBLICADO no menciona al padecimiento candidate', () => {
  const ruta = resolve(new URL('../rag_index.json', import.meta.url).pathname);
  if (!existsSync(ruta)) return;
  const idx = JSON.parse(readFileSync(ruta, 'utf-8'));
  const sospechosos = (idx.chunks || []).filter((c) => JSON.stringify(c).toLowerCase().includes('obesidad'));
  assert.equal(sospechosos.length, 0, 'Obesidad sigue trained: no puede estar en el índice publicado');
});
