// El guion impreso por el boletín llega a la página y a las curvas como marcador, nunca como 0.
// Fuentes verificadas: revisión archivada 43/2026 (2026-w43-r1, sha256 f24aea93…) y corte vigente
// 44/2026 (2026-w44, sha256 c6b328e4…). Simbología, p. 9 y 10: «( - ) : no se presentaron casos».
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

test('archivo histórico 2026-w43-r1: revisión corregida, original sellado y guion de Jalisco inmutables', () => {
  const original = leer('assets/boletin/2026-w43/data.json');
  const revision = leer('assets/boletin/2026-w43-r1/data.json');
  const correccion = leer('assets/boletin/2026-w43-r1/correccion.json');
  assert.equal(correccion.foto_original, 'assets/boletin/2026-w43');
  assert.equal(correccion.pdf_fuente.sha256, 'f24aea9306d95d1489d3a8f373527918db1ae31a9c6a6f6aeab63826842f3c8a');
  assert.ok(original.diseases.every(d => d.totals.every(v => typeof v === 'number' || v === null)), 'la foto sellada conserva su representación');
  assert.equal(revision.meta.pdf_sha256, original.meta.pdf_sha256);
  assert.equal(revision.meta.symbols.simbolos['-'], 'no se presentaron casos');
  const revIds = Object.fromEntries(revision.diseases.map(d => [d.id, d]));
  assert.equal(revIds.p10b2.page, 15);
  assert.equal(revIds.p33b1.page, 38);
  assert.deepEqual(revIds.p10b2.totals, ['-', '-', '-', '-']);
  assert.deepEqual(revIds.p33b1.totals, ['-', '-', '-', '-']);
  const tb43 = revIds.p21b1;
  assert.equal(tb43.page, 26);
  const jal43 = tb43.states.find(s => s.state === 'Jalisco');
  assert.deepEqual(jal43.values, ['-', 507, 256, 808]);
  assert.equal(suma(jal43.values.slice(1, 3)), 763);
});

test('foto vigente 2026-w44: digest del PDF, páginas y simbología verificados', () => {
  const w43PdfSha = 'f24aea9306d95d1489d3a8f373527918db1ae31a9c6a6f6aeab63826842f3c8a';
  const heredadaDeW43 = { periodo: '2026-W43', pdf_sha256: w43PdfSha };
  assert.match(actual.carpeta, /^assets\/boletin\/2026-w44$/);
  assert.equal(data.meta.year, 2026);
  assert.equal(data.meta.week, 44);
  assert.equal(data.meta.pdf_sha256, 'c6b328e4a88c293cbd9b912403b14f8e8a27ab54b780566fc51537b03b52d1a3');
  assert.equal(data.meta.platform_published, 152);
  assert.equal(data.meta.symbols.simbolos['-'], 'no se presentaron casos');
  assert.deepEqual(data.meta.symbols.paginas, [9, 10]);
  assert.equal(data.meta.symbols.origen, 'HEREDADO');
  assert.equal(data.meta.symbols.heredada_de?.periodo, '2026-W43');
  assert.equal(data.meta.symbols.heredada_de?.pdf_sha256, w43PdfSha);
  assert.deepEqual(data.meta.symbols.heredada_de, heredadaDeW43);
  const verification = leer(`${actual.carpeta}/verification.json`);
  assert.ok(Array.isArray(verification.warnings), 'verification.json debe listar warnings');
  const warningsSimbologia = verification.warnings.filter(w => w?.tipo === 'simbologia_heredada');
  assert.equal(warningsSimbologia.length, 1);
  assert.deepEqual(warningsSimbologia[0], {
    tipo: 'simbologia_heredada',
    origen: 'HEREDADO',
    paginas: [9, 10],
    heredada_de: heredadaDeW43,
  });
  assert.equal(warningsSimbologia[0].origen, data.meta.symbols.origen);
  assert.deepEqual(warningsSimbologia[0].paginas, data.meta.symbols.paginas);
  assert.deepEqual(warningsSimbologia[0].heredada_de, data.meta.symbols.heredada_de);
  assert.equal(ids.p10b2.page, 10);
  assert.equal(ids.p10b3.page, 10);
  assert.equal(ids.p21b1.page, 21);
  assert.equal(ids.p33b1.page, 33);
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

test('una fila con guion y cifras conserva cada celda impresa y distingue semanas con casos', () => {
  const tb = ids.p21b1;
  const son = tb.states.find(s => s.state === 'Sonora');
  assert.deepEqual(son.values, ['-', 554, 236, 970]);
  assert.equal(suma(son.values.slice(1, 3)), 790);
  const ags = tb.states.find(s => s.state === 'Aguascalientes');
  assert.deepEqual(ags.values, ['-', 41, 24, 92]);
  assert.equal(suma(ags.values.slice(1, 3)), 65);
  const jal = tb.states.find(s => s.state === 'Jalisco');
  assert.deepEqual(jal.values, [8, 513, 258, 821]);
  assert.equal(suma(jal.values.slice(1, 3)), 771);
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
  const jal = index.states.indexOf('Jalisco');
  const son = index.states.indexOf('Sonora');
  const w43 = tb.points.find(p => p.y === 2026 && p.w === 43);
  assert.ok(w43, 'el corte 2026-W43 permanece intacto en el histórico');
  assert.deepEqual(w43.e[jal], ['-', 763]);
  assert.equal(numero(w43.e[jal][0], cat.p21b1.guion, w43.y), 0, 'bajo la simbología, el guion se grafica en 0 y se rotula «–»');
  const ultimo = tb.points.at(-1);
  assert.equal(ultimo.y, 2026);
  assert.equal(ultimo.w, 44);
  assert.deepEqual(ultimo.e[jal], [8, 771]);
  assert.equal(numero(ultimo.e[jal][0], cat.p21b1.guion, ultimo.y), 8);
  assert.deepEqual(ultimo.e[son], ['-', 790]);
  assert.equal(numero(ultimo.e[son][0], cat.p21b1.guion, ultimo.y), 0, 'en 2026-W44 los estados con guion siguen graficándose en 0 con rótulo «–»');
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
