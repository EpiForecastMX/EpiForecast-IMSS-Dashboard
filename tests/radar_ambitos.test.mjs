// Radar del boletín: buscador de padecimientos, macrorregiones y sexo (orden del autor, 23-nov-2026: «en el combo
// esté sexo, no veo las regiones y quiero que en las enfermedades pueda escribir y buscar el padecimiento»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const json = (rel) => JSON.parse(leer(rel));
const imp = (rel) => import(pathToFileURL(resolve(root, rel)).href);
const indice = json('assets/boletin/history/index.json');

test('las cuatro macrorregiones cubren las 32 entidades una sola vez y en el orden del histórico', async () => {
  const A = await imp('assets/boletin/ambitos.mjs');
  const claves = A.REGIONES.flatMap((r) => r.claves);
  assert.equal(claves.length, 32);
  assert.equal(new Set(claves).size, 32);
  assert.deepEqual(A.REGIONES.map((r) => [r.id, r.claves.length]), [['norte', 9], ['occidente', 8], ['centro', 7], ['sureste', 8]]);
  assert.ok(A.estadosCompatibles(indice.states), 'index.states sigue el orden INEGI');
});

test('cada región de los releases publicados es la suma de sus entidades (mismo catálogo que el backend)', async () => {
  const A = await imp('assets/boletin/ambitos.mjs');
  const vistas = readdirSync(resolve(root, 'publication')).filter((d) => existsSync(resolve(root, `publication/${d}/vista.json`)));
  let comprobadas = 0;
  for (const d of vistas.slice(0, 40)) {
    const v = json(`publication/${d}/vista.json`);
    for (const r of A.REGIONES) {
      const reg = v.series[`region|${r.id}|general`];
      if (!reg) continue;
      const estados = r.claves.map((c) => v.series[`estado|${c}|general`]);
      reg.pronostico.forEach(([ds, y], k) => {
        const s = estados.reduce((t, e) => t + e.pronostico[k][1], 0);
        // Cada semana se publica redondeada a un decimal: la suma admite medio décimo por entidad.
        assert.ok(Math.abs(s - y) <= 0.05 * (estados.length + 1) + 1e-9, `${d} ${r.id} ${ds}: ${s} ≠ ${y}`);
      });
      comprobadas++;
    }
  }
  assert.ok(comprobadas >= 40, `regiones comprobadas: ${comprobadas}`);
});

test('una región sin la cifra de una entidad queda como hueco; el guion cuenta como 0 sólo bajo la simbología', async () => {
  const A = await imp('assets/boletin/ambitos.mjs');
  const C = await imp('assets/boletin/celdas.mjs');
  const celdas = Array(32).fill(1);
  assert.equal(A.sumaRegion(celdas, 'centro', (v) => C.numero(v)).valor, 7);
  celdas[8] = '-';
  assert.equal(A.sumaRegion(celdas, 'centro', (v) => C.numero(v)).valor, 6);
  const noPublicado = { semantica: 'no_publicado', desde: 2025 };
  const r = A.sumaRegion(celdas, 'centro', (v) => C.numero(v, noPublicado, 2026));
  assert.equal(r.valor, null);
  assert.deepEqual(r.faltan, ['Ciudad de México']);
  celdas[8] = null;
  assert.equal(A.sumaRegion(celdas, 'centro', (v) => C.numero(v)).valor, null);
  celdas[8] = -2;
  assert.equal(A.sumaRegion(celdas, 'centro', (v) => C.numero(v)).valor, null, 'negativo impreso: hueco, no resta');
  assert.equal(A.sumaRegion(null, 'norte', (v) => C.numero(v)).valor, null);
});

test('ámbito y sexo de la URL: ida y vuelta, y lo inválido vuelve a nacional y general', async () => {
  const A = await imp('assets/boletin/ambitos.mjs');
  for (const t of ['nacional', 'region:norte', 'region:sureste', 'estado:01', 'estado:32']) assert.equal(A.serializaAmbito(A.parseAmbito(t)), t);
  for (const t of ['', null, 'region:bajio', 'estado:33', 'estado:00', '-1', '5']) assert.equal(A.serializaAmbito(A.parseAmbito(t)), 'nacional');
  assert.equal(A.parseSexo('mujeres'), 'mujeres');
  assert.equal(A.parseSexo('otro'), 'general');
  assert.equal(A.claveVista(A.parseAmbito('estado:09'), 'hombres'), 'estado|09|hombres');
  assert.equal(A.claveVista(A.parseAmbito('region:centro')), 'region|centro|general');
});

test('el buscador encuentra sin tildes, por código con o sin punto, y vacío muestra todo', async () => {
  const { entradas, busca } = await imp('assets/boletin/buscador.mjs');
  const opciones = indice.categories.map((d) => ({ value: d.id, text: `${d.name} · ${d.code}${d.aggregate ? ' (agregado)' : ''}${d.historical ? ' · clasificación histórica' : ''}` }));
  const lista = entradas(opciones, { p70b1: 'Neurológicas y de salud mental' });
  assert.equal(busca(lista, '').length, indice.categories.length);
  assert.equal(busca(lista, 'F32')[0].id, 'p70b1');
  assert.equal(busca(lista, 'depresion')[0].id, 'p70b1');
  assert.ok(busca(lista, 'salud mental').some((e) => e.id === 'p70b1'), 'por grupo');
  assert.ok(busca(lista, 'neumonia').some((e) => /Neumonía/.test(e.nombre)));
  assert.equal(busca(lista, 'a080')[0].codigo, 'A08.0');
  assert.equal(busca(lista, 'zzzz').length, 0);
});

test('archivos de sexo: H + M es el acumulado publicado, el guion se conserva y ninguna serie publicada cambia', () => {
  const man = json('assets/boletin/history/sexo/index.json');
  assert.equal(man.schema, 'boletin_history_sex_index.v1');
  assert.ok(Object.keys(man.series).length >= 200);
  // 723 de 724 PDF releídos (2013 desde el zip oficial); sólo falta una revisión no graficada de 2023.
  assert.deepEqual(man.sources_without_local_pdf, ['2023_sem34_vcaa81398.pdf']);
  assert.ok(json('assets/boletin/history/sexo/p49b1.json').points.some((q) => indice.sources[q.s].year === 2013 && q.x), 'sexo en 2013');
  const num = (v) => (v === '-' ? 0 : v);
  for (const id of ['p70b1', 'p27b1', 'p49b1']) {
    const sx = json(`assets/boletin/history/sexo/${id}.json`);
    const serie = json(`assets/boletin/history/${id}.json`);
    const porClave = new Map(serie.points.map((p) => [`${p.y}-${p.w}-${p.s}`, p]));
    assert.equal(sx.schema, 'boletin_history_sex.v1');
    for (const q of sx.points) {
      const p = porClave.get(`${q.y}-${q.w}-${q.s}`);
      assert.ok(p, `${id} ${q.y}-${q.w}: punto publicado`);
      assert.ok(!('x' in p) && !('ex' in p), 'la serie publicada no lleva sexo');
      if (q.x) assert.equal(num(q.x[0]) + num(q.x[1]), num(p.n[1]), `${id} ${q.y}-W${q.w} nacional`);
      (q.e ?? []).forEach((c, k) => { if (c && p.e[k][1] != null) assert.equal(num(c[0]) + num(c[1]), num(p.e[k][1]), `${id} ${q.y}-W${q.w} ${indice.states[k]}`); });
    }
  }
  const dep = json('assets/boletin/history/sexo/p70b1.json').points[0];
  assert.ok(dep.e.some((c) => c && c.includes('-')), 'guiones impresos conservados');
});

test('pronóstico por ámbito y sexo: release sin sexo usa la general con aviso; legacy por entidad desde la galería', async () => {
  const P = await imp('assets/boletin/pronostico.mjs');
  const c53 = json('publication/cancer_cuello_utero_c53/vista.json');
  const m = P.desdeVista(c53, 'cancer_cuello_utero_c53', 'estado|14|mujeres');
  assert.equal(m.clave, 'estado|14|general');
  assert.match(m.aviso_ambito, /sin desglose por sexo/);
  const hta = json('publication/hipertension_i10/vista.json');
  const n = P.desdeVista(hta, 'hipertension_i10');
  assert.equal(n.clave, 'nacional|mx|general');
  assert.equal(n.aviso_ambito, null);
  const r = P.desdeVista(hta, 'hipertension_i10', 'region|norte|hombres');
  assert.equal(r.titulo_ambito, 'Región Norte · Hombres');
  const zoom = json('Reports/zoom_data_neuro.json');
  const d = P.desdeLegacyZoom(zoom, 'depresion', 'Jalisco', 'mujeres');
  assert.equal(d.titulo_ambito, 'Jalisco · Mujeres');
  assert.ok(d.pronostico.length >= 52);
  // Mesa del 25-nov-2026 (Codex Sol): sólo el horizonte posterior al corte; antes sumaba el ajuste histórico (97 semanas).
  const jal = P.desdeLegacyZoom(zoom, 'depresion', 'Jalisco', 'general');
  const z = zoom['Depresión/Jalisco/Depresión_Jalisco_general.png'];
  assert.equal(jal.pronostico.length, z.d.filter((ds, i) => z.y[i] != null && ds > z.ds_corte).length);
  assert.ok(jal.pronostico.every((p) => p.ds > z.ds_corte));
  assert.ok(jal.pronostico.length <= 53, `${jal.pronostico.length} semanas`);
  assert.ok(P.desdeLegacyZoom(json('Reports/zoom_data_dengue.json'), 'dengue', 'México', 'hombres').pronostico.length > 0);
});

test('boletin.html: buscador accesible, ámbito y sexo visibles también en la pestaña Pronóstico', () => {
  const html = leer('boletin.html');
  assert.match(html, /<input id="curveSearch" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="curveSearchList"/);
  assert.match(html, /<select id="curveDisease" disabled hidden/);
  assert.match(html, /<label class="curve-ctl-pron">Sexo<select id="curveSex"/);
  assert.match(html, /<script type="module" src="\/assets\/boletin\/buscador\.mjs\?v=\d+"><\/script>/);
  assert.match(leer('assets/boletin/radar.css'), /#curvas\.modo-pronostico \.curve-controls label\.curve-ctl-pron\{display:block\}/);
  assert.match(leer('assets/boletin/curves.js'), /import\('\/assets\/boletin\/ambitos\.mjs\?v=1'\)/);
});
