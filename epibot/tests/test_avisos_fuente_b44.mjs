/**
 * Lote alta_b44 (19-nov-2026): avisos de la fuente, medidos, de los 59 releases nuevos en epibot/js/avisos_fuente.js
 * (los leen el EpiBot, la función RAG y el corpus del índice) y en cada ficha. Los genera
 * planes/alta_b44_2026-11-19/frontend/scripts/avisos_b44.py desde el dataset, el raw y el QA del lote.
 *
 * Aquí se comprueba: que cada aviso medido está (y falla sin las entradas nuevas), que las cifras que se pueden recalcular
 * con lo publicado en el sitio (la vista de cada release) coinciden, y que el corpus y el bot los llevan. Con
 * AVISOS_B44_BE=<backend del lote> (y AVISOS_B44_PY=<python con yaml>) se recalculan además contra el dataset y el raw del backend (avisos_b44.py --check).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'node:child_process';
import '../js/avisos_fuente.js';

const raiz = new URL('../../', import.meta.url);
const vista = (id) => JSON.parse(readFileSync(new URL(`publication/${id}/vista.json`, raiz), 'utf-8'));
const A = globalThis.EPI_AVISOS_FUENTE;
const miles = (n) => Number(n).toLocaleString('en-US');

const SENSIBLES = ['envenenamiento_analgesicos_x60', 'envenenamiento_psicotropicos_x61', 'ahorcamiento_x70', 'disparo_arma_corta_x72',
  'objeto_cortante_x78', 'salto_lugar_elevado_x80', 'intento_suicidio_z915', 'ideacion_suicida_r458', 'violencia_intrafamiliar_y07',
  'herida_arma_fuego_w32', 'intox_alcohol_f100', 'vih_b20'];
const ESPERADOS = {
  alacran_t63: ['reparacion-2024'],
  mordedura_perro_w54: ['salto-nivel'], mordedura_mamiferos_w55: ['salto-nivel'], gonococica_a54: ['salto-nivel'],
  herpes_genital_a600: ['salto-nivel'], tricomoniasis_a590: ['salto-nivel'], iaas_sc: ['salto-nivel'], chikungunya_a920: ['salto-nivel'],
  intox_alcohol_f100: ['apoyo', 'salto-nivel'],
  esavi_y58: ['salto-nivel', 'hueco-rezago'],
  vih_b20: ['apoyo', 'definicion-vih', 'salto-nivel'],
  chagas_cronica_b572: ['salto-nivel', 'hueco-rezago', 'menos-uno-2025'],
  tuberculosis_otras_formas_a171: ['hueco-rezago'], chagas_aguda_b570: ['hueco-rezago'], tifo_murino_a752: ['hueco-rezago'],
  sifilis_congenita_a50: ['hueco-rezago'],
  meningococica_a39: ['hueco-rezago', 'guion-2025'], neumococo_a40: ['hueco-rezago', 'guion-2025'], haemophilus_a41: ['hueco-rezago', 'guion-2025'],
  herida_arma_fuego_w32: ['apoyo', 'rotulo-2025'],
  encefalocele_q01: ['picos-conservados'],
  tetanos_a34: ['alcance-a33'],
  abeja_u604: ['Tamaulipas|2026-W33'], conjuntivitis_hemorragica_b303: ['Ciudad de México|2026-W36'],
};
for (const id of SENSIBLES) ESPERADOS[id] ??= ['apoyo'];

test('cada release del lote con un aviso medido lo lleva en avisos_fuente.js, y nada más', () => {
  for (const [id, claves] of Object.entries(ESPERADOS)) {
    assert.ok(A[id], `${id}: sin avisos en avisos_fuente.js`);
    assert.deepEqual(A[id].avisos.map((x) => x.clave), claves, id);
    assert.equal(A[id].nota, null, `${id}: la nota general de bajas es sólo de alta20c`);
  }
  // Los que no tienen nada que avisar no reciben un objeto vacío (el bot imprimiría un encabezado sin avisos).
  for (const [id, a] of Object.entries(A)) assert.ok(a.avisos.length || a.nota, id);
  assert.match(readFileSync(new URL('epibot/js/avisos_fuente.js', raiz), 'utf-8'), /Entradas de alta_b44 \(19-nov-2026\): generadas por planes\/alta_b44_2026-11-19\/frontend\/scripts\/avisos_b44\.py/);
});

test('sensibles: el aviso lleva la Línea de la Vida y el 911, sin métodos', () => {
  for (const id of SENSIBLES) {
    const a = A[id].avisos.find((x) => x.clave === 'apoyo');
    assert.match(a.texto, /Línea de la Vida[^.]*800 911 2000/, id);
    assert.match(a.texto, /\b911\b/, id);
    assert.match(a.texto, /no describe métodos/, id);
  }
});

// Semana MMWR de un lunes (ds) de la vista: el domingo anterior abre la semana y el año es el de su miércoles.
function semanaMmwr(ds) {
  const lunes = Date.parse(`${ds}T00:00:00Z`);
  const miercoles = new Date(lunes + 2 * 864e5);
  const y = miercoles.getUTCFullYear();
  const j4 = Date.UTC(y, 0, 4);
  const inicio = j4 - new Date(j4).getUTCDay() * 864e5;
  return [y, Math.floor((lunes - 864e5 - inicio) / (7 * 864e5)) + 1];
}

test('cambio de nivel: los años completos que publica la vista coinciden con la tabla del aviso', () => {
  let cotejados = 0;
  for (const [id, a] of Object.entries(A)) {
    const s = a.avisos.find((x) => x.clave === 'salto-nivel');
    if (!s) continue;
    const obs = vista(id).series['nacional|mx|general'].observado;
    const anual = {};
    const semanas = {};
    for (const [ds, y] of obs) {
      const [anio] = semanaMmwr(ds);
      anual[anio] = (anual[anio] || 0) + y;
      semanas[anio] = (semanas[anio] || 0) + 1;
    }
    for (const anio of Object.keys(anual)) {
      if (semanas[anio] < 52 || !obs.some(([ds]) => semanaMmwr(ds).join() === `${anio},1`)) continue;
      assert.ok(s.texto.includes(`${anio}: ${miles(Math.round(anual[anio]))};`), `${id} ${anio}: ${miles(Math.round(anual[anio]))}`);
      cotejados += 1;
    }
    assert.doesNotMatch(s.texto, /\b(debido a|por causa de|se explica por)\b/, `${id}: sin atribuir causa`);
  }
  assert.ok(cotejados >= 25, `${cotejados} años cotejados`);
});

test('valores que la fuente retiró: el pronóstico y el total nacional del aviso son los de la vista', () => {
  for (const [id, clave] of [['abeja_u604', 'Tamaulipas|2026-W33'], ['conjuntivitis_hemorragica_b303', 'Ciudad de México|2026-W36']]) {
    const a = A[id].avisos.find((x) => x.clave === clave);
    assert.equal(a.estado, 'retirado');
    const v = vista(id);
    const est = Object.values(v.series).find((s) => s.nivel === 'estado' && s.nombre === a.entidad && s.sexo === 'general');
    const [ds] = est.pronostico.find(([, y]) => y === a.casos);
    const nac = Object.fromEntries(v.series['nacional|mx|general'].pronostico)[ds];
    assert.ok(a.texto.includes(`trae esos ${miles(a.casos)} casos de ${a.entidad}, de ${miles(Math.round(nac))} nacionales`), id);
    assert.ok(a.retiro_neto > 0 && a.retiro_neto <= a.casos + 13, id);
    // La nota de pico heredado de la ficha remite a este aviso y no dice «causa no establecida».
    const html = readFileSync(new URL(`${id}.html`, raiz), 'utf-8');
    const esc = clave.replace(/[|.*+?^${}()[\]\\]/g, '\\$&');
    const pico = html.match(new RegExp(`<p class="pico-heredado" data-pico="${esc}">[^\\n]*</p>`));
    assert.ok(pico, `${id}: sin nota de pico heredado`);
    assert.match(pico[0], /la fuente retiró después/);
    assert.doesNotMatch(pico[0], /causa no está establecida/);
  }
});

test('picos conservados de encefalocele: fuera de las 52 semanas que repite el control', () => {
  const v = vista('encefalocele_q01');
  const a = A.encefalocele_q01.avisos[0];
  const [y, w] = v.origin;
  assert.ok(a.texto.includes(`a ${y}-W${String(w).padStart(2, '0')})`), a.texto);
  for (const b of ['2016_sem24', '2017_sem30', '2020_sem22', '2024_sem06']) assert.ok(a.texto.includes(b), b);
});

test('supuestos del autor dichos como supuestos, no como mediciones', () => {
  for (const id of ['meningococica_a39', 'neumococo_a40', 'haemophilus_a41']) {
    const a = A[id].avisos.find((x) => x.clave === 'guion-2025');
    assert.equal(a.estado, 'supuesto');
    assert.match(a.texto, /supuesto del autor, no verificable con la fuente/);
    assert.match(a.texto, /no distingue un cero real de una falta de registro/);
  }
  const m = A.chagas_cronica_b572.avisos.find((x) => x.clave === 'menos-uno-2025');
  assert.match(m.texto, /2025_sem17[\s\S]*Nuevo León[\s\S]*supuesto del autor/);
});

test('ningún aviso del lote dice «1 casos» ni repite el patrón de ventana del gate', () => {
  for (const id of Object.keys(ESPERADOS)) {
    for (const x of A[id].avisos) {
      assert.doesNotMatch(x.texto, /\b1 casos\b/, id);
      assert.doesNotMatch(x.texto, /\(W\d+ a W\d+ de \d{4}\)/, id);
    }
  }
});

test('corpus RAG: un fragmento de avisos de la fuente por cada release del lote con avisos', async () => {
  const { buildChunks } = await import('../scripts/lib/corpus.mjs');
  const { chunks } = buildChunks({});
  for (const id of Object.keys(ESPERADOS)) {
    const c = chunks.find((x) => x.id.startsWith(`release:${id}:`) && x.id.endsWith(':avisos-fuente'));
    assert.ok(c, id);
    for (const a of A[id].avisos) assert.ok(c.text.includes(a.titulo), `${id}: ${a.titulo}`);
  }
});

const BE = process.env.AVISOS_B44_BE;
test('con el backend del lote, las cifras se recalculan desde el dataset, el raw y el QA', { skip: !BE && 'sin AVISOS_B44_BE' }, () => {
  const script = `${BE}/../frontend/scripts/avisos_b44.py`;
  assert.ok(existsSync(script), script);
  const r = spawnSync(process.env.AVISOS_B44_PY || 'python3',
    [script, '--write-js', new URL('epibot/js/avisos_fuente.js', raiz).pathname, '--check'], { encoding: 'utf-8' });
  assert.equal(r.status, 0, r.stderr);
});
