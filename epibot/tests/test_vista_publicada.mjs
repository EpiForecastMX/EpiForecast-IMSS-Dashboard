/**
 * test_vista_publicada.mjs — Un FAIL no se instala y el corpus sellado no se queda en 0/4.
 *
 * Uso:  node --test tests/test_vista_publicada.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { CandidateError, VERDICTS, VERDICTS_PUBLICABLES } from '../scripts/lib/candidate.mjs';
import { conEstadoVigente } from '../scripts/lib/corpus.mjs';
import { installPublication } from '../scripts/install_publication.mjs';

const CONGELADA = 'Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos';
const VIGENTE = 'Validación prospectiva en curso (1/4 semanas) · pronóstico puntual sin intervalos';
const SELLADO =
  `IMPORTANTE — validación prospectiva: ${CONGELADA}. El veredicto del gate congelado es ` +
  'INCOMPLETE con 0 de 4 semanas objetivo observadas (gate abc).';

function temporal(t) {
  const raiz = mkdtempSync(join(tmpdir(), 'vista-'));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  return raiz;
}

function vista(raiz, datos) {
  mkdirSync(join(raiz, 'publication', 'x'), { recursive: true });
  writeFileSync(join(raiz, 'publication', 'x', 'vista.json'), JSON.stringify(datos));
}

test('FAIL es el único veredicto no publicable, igual que en el backend', () => {
  assert.deepEqual(VERDICTS.filter((v) => !VERDICTS_PUBLICABLES.includes(v)), ['FAIL']);
});

test('el corpus sellado toma el avance de la vista', (t) => {
  const raiz = temporal(t);
  vista(raiz, { publication_label: VIGENTE, verdict: 'INCOMPLETE', weeks_available: 1, weeks_required: 4 });
  const texto = conEstadoVigente(SELLADO, { disease_id: 'x', publication_label: CONGELADA }, raiz, true);
  assert.match(texto, /en curso \(1\/4 semanas\)/);
  assert.match(texto, /es INCOMPLETE con 1 de 4 semanas objetivo observadas \(gate abc\)/);
  assert.doesNotMatch(texto, /0\/4|0 de 4/);
});

test('sin vista, o sin publicar, el texto sellado no cambia', (t) => {
  const raiz = temporal(t);
  const r = { disease_id: 'x', publication_label: CONGELADA };
  assert.equal(conEstadoVigente(SELLADO, r, raiz, true), SELLADO);
  vista(raiz, { publication_label: VIGENTE, verdict: 'INCOMPLETE', weeks_available: 1, weeks_required: 4 });
  assert.equal(conEstadoVigente(SELLADO, r, raiz, false), SELLADO);
});

test('el instalador rechaza una vista con FAIL antes de escribir nada', (t) => {
  const raiz = temporal(t);
  const shard = join(raiz, 'shard');
  mkdirSync(shard);
  writeFileSync(join(shard, 'shard_manifest.json'), JSON.stringify({ files: {} }));
  const pointer = join(raiz, 'puntero.json');
  writeFileSync(pointer, JSON.stringify({ schema: 'public_release_pointer.v1', active: true, disease_id: 'x', release_id: 'r' }));
  const rutaVista = join(raiz, 'v.json');
  writeFileSync(rutaVista, JSON.stringify({
    schema: 'publication_view.v1', disease_id: 'x', release_id: 'r', shard_manifest_files: {},
    verdict: 'FAIL', weeks_available: 4, weeks_required: 4,
    publication_label: 'Validación prospectiva superada (4/4 semanas)',
  }));
  assert.throws(
    () => installPublication({ shard, pointer, vista: rutaVista, root: raiz }),
    (e) => e instanceof CandidateError && /FAIL no es publicable/.test(e.message),
  );
});
