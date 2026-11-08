/**
 * Un release nuevo entra por release_catalog.js: esta prueba añade uno sintético a una copia y
 * comprueba que marcador, alias, detector del RAG, galería, filtro y Figura 1 lo recogen solos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const raiz = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, raiz), 'utf8');

const SINTETICO = `{
  id: 'sintetico_x', pad: 'Sintetitis', nombre: 'Sintetitis', nombreCorto: 'Sintetitis',
  etiqueta: 'Sintetitis (Z99)', dataKey: 'sintetico_x', marca: 'SINTETICO_X',
  pagina: 'sintetico_x.html', consulta: 'sintetitis', cie: 'Z99', color: '#123456',
  alias: ['sintetitis', 'z99'], prefijos: ['sintet'],
},`;

const CATALOGO = leer('epibot/js/release_catalog.js');
assert.match(CATALOGO, /\n {2}\]\);\n/, 'el cierre de la lista cambió: actualiza esta prueba');
const conSintetico = CATALOGO.replace('\n  ]);\n', `\n${SINTETICO}\n  ]);\n`);

const dir = mkdtempSync(join(tmpdir(), 'catalogo-'));
cpSync(new URL('epibot/js/', raiz), join(dir, 'js'), { recursive: true });
writeFileSync(join(dir, 'js/release_catalog.js'), conSintetico);
writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
const url = (f) => pathToFileURL(join(dir, 'js', f)).href;

// El módulo guarda el catálogo en globalThis: se restaura para no afectar a otros archivos.
const previo = globalThis.EPI_CATALOGO;
const rc = await import(url('release_config.js'));
const { detectEntities } = await import(url('entities.js'));
if (previo) globalThis.EPI_CATALOGO = previo;
rmSync(dir, { recursive: true, force: true });

test('el marcador de gráfica se deriva del catálogo', () => {
  const m = '<!--SINTETICO_X:{"tipo":"zoom"}-->'.match(rc.MARCADOR_RELEASE);
  assert.equal(m?.[1], 'SINTETICO_X');
  assert.equal(rc.releaseDeMarca(m[1]).id, 'sintetico_x');
  for (const r of rc.RELEASES) assert.ok(`<!--${r.marca}:{}-->`.match(rc.MARCADOR_RELEASE), r.id);
});

test('alias, vocabulario y detector de entidades reconocen el release', () => {
  assert.equal(rc.releaseConAlias('zoom de Sintetitis en Jalisco')?.id, 'sintetico_x');
  assert.equal(rc.ALIAS_RELEASES.z99, 'Sintetitis');
  assert.ok(rc.VOCAB_RELEASES.includes('sintetitis'));
  assert.ok(!rc.VOCAB_RELEASES.includes('z99'), 'los códigos CIE no se corrigen');
  assert.equal(detectEntities('sintetitis en Jalisco').padecimiento, 'Sintetitis');
});

test('el detector del RAG recoge alias y prefijos', () => {
  const RAG = leer('epibot/netlify/functions/rag.mjs');
  assert.match(RAG, /import '\.\.\/\.\.\/js\/release_catalog\.js';/);
  const ini = RAG.indexOf('function stripAccents(');
  const fin = RAG.indexOf('// Multi-turno');
  const rag = vm.runInNewContext(
    `${conSintetico}\n${RAG.slice(ini, fin)}\n({ detectEntities })`, { console });
  assert.equal(rag.detectEntities('sintetitis en jalisco').padecimiento, 'Sintetitis');
  assert.equal(rag.detectEntities('sintetica en jalisco').padecimiento, 'Sintetitis');
  assert.equal(rag.detectEntities('obesidad en jalisco').padecimiento, 'Obesidad');
});

test('la galería crea una instancia por release', () => {
  const ctx = { window: {}, document: {}, console };
  vm.runInNewContext(`${conSintetico}\n${leer('Reports/obesidad_galeria.js')}`, ctx);
  assert.deepEqual([...ctx.window.GaleriasRelease].map((g) => g.id),
    ['obesidad', 'anorexia_f50', 'diabetes_t1', 'diabetes_t2', 'hipertension_i10', 'isquemica_i20',
      'cerebrovascular_i60', 'intestinales_a04', 'ira_j00', 'ivu_n39', 'gingivitis_k05', 'ulceras_k25',
      'cancer_mama_c50', 'cancer_cuello_utero_c53', 'sintetico_x']);
  assert.equal(ctx.window.GaleriasRelease.at(-1).color, '#123456');
});

test('galería y portada no conservan listas propias de releases', () => {
  const galeria = leer('Reports/index.html');
  assert.doesNotMatch(galeria, /<option value="Diabetes/);
  assert.match(galeria, /release_catalog\.js\?v=\d+"><\/script>\n<script src="obesidad_galeria/);
  assert.match(galeria, /GaleriasRelease\.forEach\(g => document\.getElementById\('filterPad'\)/);
  const portada = leer('index.html');
  assert.match(portada, /var RELEASES_FIGURA = window\.EPI_CATALOGO\.releases\.map/);
  assert.match(portada, /release_catalog\.js\?v=\d+"><\/script>\n<\/head>/);
});
