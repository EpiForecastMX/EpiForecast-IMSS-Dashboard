/**
 * El contexto que rag.mjs entrega a Gemini declara el alcance VIGENTE de padecimientos modelados.
 *
 * Regresión (5-nov-2026): «que se sabe de la diabetes en jalisco» contestaba que el proyecto «se
 * centra exclusivamente en tres padecimientos». Los pasajes históricos del corpus (conclusiones,
 * construcción del dashboard, ficha técnica de Prophet) hablan de tres, y las CIFRAS CLAVE no
 * nombraban la lista vigente: cuatro legacy de knowledge.json más los releases publicados del
 * runner (publication/catalog.json).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import vm from 'node:vm';

const raiz = new URL('../../', import.meta.url);
const KB = JSON.parse(readFileSync(new URL('epibot/knowledge.json', raiz), 'utf8'));
const CAT = JSON.parse(readFileSync(new URL('publication/catalog.json', raiz), 'utf8'));
const RAG = readFileSync(
  process.env.RAG_BASE || new URL('epibot/netlify/functions/rag.mjs', raiz), 'utf8');

const ini = RAG.indexOf('function stripAccents(');
const fin = RAG.indexOf('// Rate limit + CORS');
const ctx = vm.runInNewContext(
  `${readFileSync(new URL('epibot/js/release_catalog.js', raiz), 'utf8')}\n${RAG.slice(ini, fin)}\n({ structuredSummary,
     releasesDesdeCatalogo: typeof releasesDesdeCatalogo === 'function' ? releasesDesdeCatalogo : null })`,
  { console });
const SYS = RAG.slice(RAG.indexOf('function buildSystem('));

const leerShard = (p) => JSON.parse(readFileSync(new URL(`publication/${p}`, raiz), 'utf8'));

test('rag.mjs deriva los releases publicados del catálogo y de su shard', () => {
  assert.ok(ctx.releasesDesdeCatalogo, 'rag.mjs define releasesDesdeCatalogo');
  const r = JSON.parse(JSON.stringify(ctx.releasesDesdeCatalogo(CAT, leerShard)));
  assert.deepEqual(r, [
    { nombre: 'Anorexia, bulimia y otros trastornos alimentarios', cie: ['F50'] },
    { nombre: 'Asma', cie: ['J45', 'J46'] },
    { nombre: 'Tumor maligno del colon y recto', cie: ['C18', 'C19', 'C20', 'C21'] },
    { nombre: 'Tumor maligno del cuello del útero', cie: ['C53'] },
    { nombre: 'Tumor maligno del cuerpo del útero', cie: ['C54'] },
    { nombre: 'Tumores malignos del encéfalo y otras partes del sistema nervioso central', cie: ['C70', 'C71', 'C72'] },
    { nombre: 'Tumor maligno del esófago', cie: ['C15'] },
    { nombre: 'Tumor maligno del estómago', cie: ['C16'] },
    { nombre: 'Tumor maligno del hígado y de las vías biliares intrahepáticas', cie: ['C22'] },
    { nombre: 'Tumores malignos de los huesos y de los cartílagos articulares', cie: ['C40', 'C41'] },
    { nombre: 'Tumor maligno de la mama', cie: ['C50'] },
    { nombre: 'Tumor maligno del ovario', cie: ['C56'] },
    { nombre: 'Tumor maligno del páncreas', cie: ['C26'] },
    { nombre: 'Tumor maligno de la próstata', cie: ['C61'] },
    { nombre: 'Tumor maligno de tráquea, bronquios y pulmón', cie: ['C33', 'C34'] },
    { nombre: 'Tumor maligno del riñón', cie: ['C64'] },
    { nombre: 'Enfermedad cerebrovascular', cie: ['I60', 'I61', 'I62', 'I63', 'I64', 'I65', 'I66', 'I67', 'I69'] },
    { nombre: 'Diabetes mellitus tipo I', cie: ['E10'] },
    { nombre: 'Diabetes mellitus tipo II', cie: ['E11', 'E12', 'E13', 'E14'] },
    { nombre: 'Gingivitis y enfermedad periodontal', cie: ['K05'] },
    { nombre: 'Hipertensión arterial', cie: ['I10', 'I11', 'I12', 'I13', 'I14', 'I15'] },
    { nombre: 'Infecciones intestinales por otros organismos y las mal definidas', cie: ['A04', 'A08', 'A09'] },
    { nombre: 'Infecciones respiratorias agudas', cie: ['J00', 'J01', 'J03', 'J04', 'J05', 'J06', 'J20', 'J21'] },
    { nombre: 'Enfermedad isquémica del corazón', cie: ['I20', 'I25'] },
    { nombre: 'Infección de vías urinarias', cie: ['N30', 'N34', 'N39.0'] },
    { nombre: 'Leucemia', cie: ['C91', 'C92', 'C93', 'C94', 'C95'] },
    { nombre: 'Linfoma de Hodgkin', cie: ['C81'] },
    { nombre: 'Linfoma no Hodgkin', cie: ['C82', 'C83', 'C84', 'C85'] },
    { nombre: 'Neumonías y bronconeumonías', cie: ['J12', 'J15', 'J16', 'J17', 'J18'] },
    { nombre: 'Obesidad', cie: ['E66'] },
    { nombre: 'Úlceras, gastritis y duodenitis', cie: ['K25', 'K26', 'K27', 'K28', 'K29'] },
  ]);
});

test('un release no publicado, oculto o sin canal epibot no entra al alcance', () => {
  const base = CAT.releases[0];
  const cat = { releases: [
    { ...base, lifecycle: 'trained' },
    { ...base, visible: false },
    { ...base, channels: ['web'] },
  ] };
  assert.equal(ctx.releasesDesdeCatalogo(cat, leerShard).length, 0);
});

test('las CIFRAS CLAVE nombran los treinta y cinco padecimientos modelados', () => {
  const rel = ctx.releasesDesdeCatalogo(CAT, leerShard);
  const s = ctx.structuredSummary(KB, rel);
  const linea = s.split('\n').find((l) => l.startsWith('Alcance vigente'));
  assert.ok(linea, s);
  assert.match(linea, /modela treinta y cinco padecimientos/);
  for (const p of ['Depresión (F32)', 'Parkinson (G20)', 'Alzheimer (G30)', 'Dengue', 'Obesidad (E66)', 'Anorexia, bulimia y otros trastornos alimentarios (F50)', 'Diabetes mellitus tipo I (E10)', 'Diabetes mellitus tipo II (E11, E12, E13, E14)',
    'Infección de vías urinarias (N30, N34, N39.0)', 'Úlceras, gastritis y duodenitis (K25, K26, K27, K28, K29)',
    'Infecciones respiratorias agudas (J00, J01, J03, J04, J05, J06, J20, J21)', 'Gingivitis y enfermedad periodontal (K05)', 'Asma (J45, J46)', 'Tumor maligno de la mama (C50)', 'Tumor maligno del cuello del útero (C53)']) {
    assert.ok(linea.includes(p), `${p} en: ${linea}`);
  }
  assert.match(linea, /Ningún otro padecimiento está modelado/);
});

test('las instrucciones mandan usar el alcance vigente sobre pasajes históricos', () => {
  assert.match(SYS, /«Alcance vigente»/);
});

test('Netlify empaqueta el catálogo y el conocimiento de cada shard para la función', () => {
  const toml = readFileSync(new URL('netlify.toml', raiz), 'utf8');
  const inc = toml.match(/included_files = \[([^\]]*)\]/)[1];
  assert.match(inc, /"publication\/catalog\.json"/);
  assert.match(inc, /"publication\/\*\/\*\/knowledge\.json"/);
});
