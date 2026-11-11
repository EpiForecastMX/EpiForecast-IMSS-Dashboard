// El guion impreso por el boletín llega a la página y a las curvas como marcador, nunca como 0.
// Fuente: boletín 43/2026 (sha256 f24aea93…). Simbología, p. 9: «( - ) : no se presentaron casos».
// Sarampión y paludismo por P. falciparum imprimen guiones mientras la propia fuente registra
// casos (2025-SE53: 6,152 y siete): ahí el guion es una cifra no publicada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { numero, suma, compararDesc, muestra, significado, clase, guionNoPublicado } from '../assets/boletin/celdas.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const leer = r => JSON.parse(readFileSync(resolve(root, r), 'utf8'));
const actual = leer('assets/boletin/actual.json');
const data = leer(`${actual.carpeta}/data.json`);
const ids = Object.fromEntries(data.diseases.map(d => [d.id, d]));
const NO_PUB = { semantica: 'no_publicado', desde: 2025 };

test('celdas: cero impreso, guion bajo simbología y cifra no publicada son distintos', () => {
  assert.equal(numero(0), 0);
  assert.equal(numero('-'), 0);
  assert.equal(numero('-', NO_PUB, 2026), null);
  assert.equal(numero('-', NO_PUB, 2013), 0, 'la excepción sólo rige desde el año con evidencia');
  assert.equal(numero('n.d.'), null);
  assert.equal(numero(null), null);
  assert.equal(suma(['-', '-']), '-');
  assert.equal(suma(['-', 7]), 7);
  assert.equal(suma(['-', 7], NO_PUB, 2026), null);
  assert.deepEqual([3, null, 0, 9].sort(compararDesc), [9, 3, 0, null]);
  assert.equal(muestra('-'), '–');
  assert.equal(muestra(0), '0');
  assert.equal(muestra(null), 'Sin dato');
  assert.match(significado('-', { simbolos: data.meta.symbols }), /no se presentaron casos.*p\. 9 y 10/);
  assert.match(significado('-', { guion: NO_PUB, anio: 2026 }), /no publicada/);
  assert.equal(clase(5), '');
  assert.equal(clase('-'), 'marcador');
  assert.equal(clase('-', NO_PUB, 2026), 'marcador no-publicado');
});

test('foto vigente: revisión corregida enlazada, original sellado intacto', () => {
  assert.match(actual.carpeta, /^assets\/boletin\/2026-w43-r1$/);
  const original = leer('assets/boletin/2026-w43/data.json');
  assert.ok(original.diseases.every(d => d.totals.every(v => typeof v === 'number' || v === null)), 'la foto sellada conserva su representación');
  assert.equal(data.meta.pdf_sha256, original.meta.pdf_sha256);
  assert.equal(data.meta.symbols.simbolos['-'], 'no se presentaron casos');
});

test('sarampión y falciparum: guiones conservados y sin valor numérico', () => {
  for (const id of ['p10b2', 'p33b1']) {
    const d = ids[id];
    assert.equal(d.guion.semantica, 'no_publicado', id);
    assert.ok(d.guion.evidencia.every(e => /^[0-9a-f]{64}$/.test(e.sha256) && e.pagina && e.cita), id);
    assert.deepEqual(d.totals, ['-', '-', '-', '-'], id);
    assert.equal(numero(d.cumulative, d.guion, data.meta.year), null, id);
  }
  const rub = ids.p10b3;
  assert.equal(rub.guion, undefined);
  assert.equal(numero(rub.cumulative, rub.guion, data.meta.year), 0, 'rubéola sigue la simbología');
});

test('una fila con guion y cifras conserva cada celda impresa', () => {
  const tb = ids.p21b1;
  const jal = tb.states.find(s => s.state === 'Jalisco');
  assert.deepEqual(jal.values, ['-', 507, 256, 808]);
  assert.equal(suma(jal.values.slice(1, 3)), 763);
});

test('ordenar y graficar no producen NaN ni ceros inventados', () => {
  for (const metric of ['weekly', 'cumulative']) {
    const ns = data.diseases.filter(d => !d.aggregate).map(d => numero(d[metric], d.guion, data.meta.year));
    assert.ok(ns.every(n => n === null || Number.isFinite(n)), metric);
    const orden = data.diseases.filter(d => !d.aggregate)
      .sort((a, b) => compararDesc(numero(a[metric], a.guion, 2026), numero(b[metric], b.guion, 2026)));
    const ultimos = orden.slice(-2).map(d => d.id).sort();
    assert.deepEqual(ultimos, ['p10b2', 'p33b1'], `${metric}: las cifras no publicadas van al final`);
  }
});

test('curvas: los puntos migrados son guiones y el sarampión no dibuja ceros', () => {
  const index = leer('assets/boletin/history/index.json');
  const cat = Object.fromEntries(index.categories.map(c => [c.id, c]));
  assert.equal(cat.p10b2.guion.semantica, 'no_publicado');
  const sar = leer('assets/boletin/history/p10b2.json');
  const valores = sar.points.flatMap(p => [p.n[0], p.n[1]]);
  assert.ok(valores.every(v => v === '-' || v === null), 'sarampión 2025-2026: todo guion impreso');
  assert.ok(sar.points.every(p => numero(p.n[0], cat.p10b2.guion, p.y) === null), 'ningún punto graficado');
  const tb = leer('assets/boletin/history/p21b1.json');
  const ultimo = tb.points.at(-1);
  const jal = index.states.indexOf('Jalisco');
  assert.deepEqual(ultimo.e[jal], ['-', 763]);
  assert.equal(numero(ultimo.e[jal][0], cat.p21b1.guion, ultimo.y), 0, 'bajo la simbología, el guion se grafica en 0 y se rotula «–»');
  for (const id of Object.keys(index.series)) {
    const sh = leer(`assets/boletin/history/${id}.json`);
    for (const p of [...sh.points, ...sh.revisions, ...sh.unplaced]) {
      for (const v of [...p.n, p.prev, ...(p.e || []).flat()]) {
        assert.ok(v === null || v === undefined || v === '-' || Number.isFinite(v), `${id} ${p.y}-${p.w}: ${v}`);
      }
    }
  }
});

test('el radar y las curvas usan el módulo de celdas, no fmt sobre cifras', () => {
  const radar = readFileSync(resolve(root, 'assets/boletin/radar.js'), 'utf8');
  assert.match(radar, /from '\.\/celdas\.mjs\?v=1'/);
  assert.doesNotMatch(radar, /fmt\(d(\[metric\]|\.weekly|\.cumulative|\.previous)\)|fmt\(ds\.reduce/);
  assert.doesNotMatch(radar, /b\[metric\]-a\[metric\]|\(b\[sort\]\?\?-1\)/);
  const curvas = readFileSync(resolve(root, 'assets/boletin/curves.js'), 'utf8');
  assert.match(curvas, /import\('\/assets\/boletin\/celdas\.mjs\?v=1'\)/);
  assert.match(curvas, /lectura_del_simbolo/);
  assert.equal(guionNoPublicado(NO_PUB, 2024), false);
});
