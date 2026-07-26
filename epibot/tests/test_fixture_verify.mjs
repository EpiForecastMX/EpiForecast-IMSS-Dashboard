/**
 * test_fixture_verify.mjs — 47.3: `test:cases:verify` es fail-closed y no mutante.
 *
 * `test_cases.json` es un ARTEFACTO de `generate_tests.js`, no una fuente. Si alguien lo edita a
 * mano —o si el generador cambia y nadie regenera— la suite pasa a validar un contrato que ya no
 * existe (fue exactamente R45-P0: 565 generados contra 618 commiteados). `--check` es la guardia:
 * tiene que poner rojo y, sobre todo, **no debe arreglar el fixture por su cuenta**, porque
 * entonces borraría la evidencia del desvío en vez de denunciarlo.
 *
 * Todo ocurre sobre copias en un temporal: el fixture oficial no se toca jamás.
 *
 * Uso: node --test tests/test_fixture_verify.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

/** Árbol mínimo que el generador necesita, copiado a un temporal. → dir */
function arbol() {
  const dir = mkdtempSync(join(tmpdir(), 'epibot-fixture-'));
  mkdirSync(join(dir, 'js'));
  mkdirSync(join(dir, 'tests'));
  copyFileSync(join(RAIZ, 'js/entities.js'), join(dir, 'js/entities.js'));
  copyFileSync(join(RAIZ, 'knowledge.json'), join(dir, 'knowledge.json'));
  copyFileSync(join(RAIZ, 'tests/generate_tests.js'), join(dir, 'tests/generate_tests.js'));
  copyFileSync(join(RAIZ, 'tests/test_cases.json'), join(dir, 'tests/test_cases.json'));
  return dir;
}

function check(dir) {
  try {
    return { code: 0, salida: execFileSync('node', [join(dir, 'tests/generate_tests.js'), '--check'], { encoding: 'utf-8' }) };
  } catch (err) {
    return { code: err.status ?? 1, salida: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

const fixture = dir => join(dir, 'tests/test_cases.json');
const digest = ruta => createHash('sha256').update(readFileSync(ruta)).digest('hex');

/** Ejecuta `fn` sobre un árbol temporal y limpia siempre. */
function conArbol(fn) {
  const dir = arbol();
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('fixture intacto: rc=0 y NO lo reescribe', () => {
  conArbol(dir => {
    const antes = digest(fixture(dir));
    const primera = check(dir);
    assert.equal(primera.code, 0, primera.salida);
    assert.match(primera.salida, /fixture reproducible: 616 casos/);
    assert.equal(digest(fixture(dir)), antes, '--check no puede escribir el fixture');
    // Idempotente: dos pasadas seguidas dan lo mismo y siguen sin tocarlo.
    assert.equal(check(dir).code, 0);
    assert.equal(digest(fixture(dir)), antes);
  });
});

test('fixture alterado a mano: rc≠0 y lo deja alterado (no lo "arregla")', () => {
  conArbol(dir => {
    const casos = JSON.parse(readFileSync(fixture(dir), 'utf-8'));
    casos[0].expectedHandler = 'answerInventado';
    writeFileSync(fixture(dir), JSON.stringify(casos, null, 2) + '\n');
    const alterado = digest(fixture(dir));
    const r = check(dir);
    assert.notEqual(r.code, 0, 'un fixture editado a mano debe poner rojo');
    assert.match(r.salida, /no es reproducible desde generate_tests\.js/);
    assert.equal(digest(fixture(dir)), alterado, 'no debe regenerarlo: eso borraría la evidencia');
  });
});

test('fixture ausente: rc≠0 y no lo crea', () => {
  conArbol(dir => {
    unlinkSync(fixture(dir));
    const r = check(dir);
    assert.notEqual(r.code, 0);
    assert.match(r.salida, /no existe tests\/test_cases\.json/);
    assert.throws(() => readFileSync(fixture(dir)), 'no debe materializar el fixture en --check');
  });
});

test('fixture con un caso duplicado: rc≠0', () => {
  conArbol(dir => {
    const casos = JSON.parse(readFileSync(fixture(dir), 'utf-8'));
    casos.push({ ...casos[10], id: casos.length + 1 });
    writeFileSync(fixture(dir), JSON.stringify(casos, null, 2) + '\n');
    const r = check(dir);
    assert.notEqual(r.code, 0, 'un caso de más debe poner rojo');
    assert.match(r.salida, /617 en disco vs 616 generados/);
  });
});

test('la telemetría cuenta el fixture COMPLETO, no una construcción a medias', () => {
  conArbol(dir => {
    const { salida } = check(dir);
    const m = salida.match(/Total tests generated: (\d+)/);
    assert.ok(m, 'debe reportar el total');
    assert.equal(Number(m[1]), JSON.parse(readFileSync(fixture(dir), 'utf-8')).length);
  });
});
