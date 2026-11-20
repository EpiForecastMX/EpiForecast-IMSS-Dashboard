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
    { nombre: 'Picadura de abeja', cie: ['U60.4'] },
    { nombre: 'Absceso hepático amebiano', cie: ['A06.4'] },
    { nombre: 'Lesión autoinfligida intencionalmente por ahorcamiento, estrangulamiento o sofocación', cie: ['X70'] },
    { nombre: 'Intoxicación por picadura de alacrán', cie: ['T63.2', 'X22'] },
    { nombre: 'Enfermedad alcohólica del hígado', cie: ['K70 excepto K70.3'] },
    { nombre: 'Intoxicación alimentaria bacteriana', cie: ['A05'] },
    { nombre: 'Amebiasis intestinal', cie: ['A06.0', 'A06.1', 'A06.2', 'A06.3', 'A06.9'] },
    { nombre: 'Anencefalia', cie: ['Q00'] },
    { nombre: 'Anorexia, bulimia y otros trastornos alimentarios', cie: ['F50'] },
    { nombre: 'Ascariasis', cie: ['B77'] },
    { nombre: 'Asma', cie: ['J45', 'J46'] },
    { nombre: 'Picadura de avispa', cie: ['U60.5'] },
    { nombre: 'Bocio endémico', cie: ['E01'] },
    { nombre: 'Brucelosis', cie: ['A23'] },
    { nombre: 'Efectos del calor y de la luz', cie: ['T67', 'X30'] },
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
    { nombre: 'Candidiasis urogenital', cie: ['B37.3', 'B37.4'] },
    { nombre: 'Enfermedad cerebrovascular', cie: ['I60', 'I61', 'I62', 'I63', 'I64', 'I65', 'I66', 'I67', 'I69'] },
    { nombre: 'Tripanosomiasis americana (enfermedad de Chagas) aguda', cie: ['B57.0', 'B57.1'] },
    { nombre: 'Tripanosomiasis americana (enfermedad de Chagas) crónica', cie: ['B57.2', 'B57.3', 'B57.4', 'B57.5'] },
    { nombre: 'Chancro blando', cie: ['A57'] },
    { nombre: 'Enfermedad por virus Chikungunya', cie: ['A92.0'] },
    { nombre: 'Cirrosis hepática alcohólica', cie: ['K70.3'] },
    { nombre: 'Cisticercosis', cie: ['B69'] },
    { nombre: 'Conjuntivitis', cie: ['H10'] },
    { nombre: 'Conjuntivitis epidémica aguda hemorrágica', cie: ['B30.3'] },
    { nombre: 'Síndrome coqueluchoide', cie: ['U99'] },
    { nombre: 'Desnutrición leve', cie: ['E44.1'] },
    { nombre: 'Desnutrición moderada', cie: ['E44.0'] },
    { nombre: 'Desnutrición severa', cie: ['E40', 'E41', 'E42', 'E43'] },
    { nombre: 'Diabetes mellitus tipo I', cie: ['E10'] },
    { nombre: 'Diabetes mellitus tipo II', cie: ['E11', 'E12', 'E13', 'E14'] },
    { nombre: 'Lesión autoinfligida intencionalmente por disparo de arma corta', cie: ['X72'] },
    { nombre: 'Displasia cervical leve y moderada', cie: ['N87.0', 'N87.1'] },
    { nombre: 'Displasia cervical severa y CaCu in situ', cie: ['N87.2', 'D06'] },
    { nombre: 'Diabetes mellitus en el embarazo', cie: ['O24.4'] },
    { nombre: 'Edema, proteinuria y trastornos hipertensivos en el embarazo, parto y puerperio', cie: ['O10', 'O11', 'O12', 'O13', 'O14', 'O15', 'O16'] },
    { nombre: 'Encefalocele', cie: ['Q01'] },
    { nombre: 'Enterobiasis', cie: ['B80'] },
    { nombre: 'Envenenamiento autoinfligido intencionalmente por analgésicos no narcóticos, antipiréticos y antirreumáticos', cie: ['X60'] },
    { nombre: 'Envenenamiento autoinfligido intencionalmente por drogas antiepilépticas, sedantes, hipnóticas, antiparkinsonianas y psicotrópicas', cie: ['X61'] },
    { nombre: 'Erisipela', cie: ['A46'] },
    { nombre: 'Eventos supuestamente asociados a la vacunación (ESAVI)', cie: ['Y58', 'Y59'] },
    { nombre: 'Escabiosis', cie: ['B86'] },
    { nombre: 'Escarlatina', cie: ['A38'] },
    { nombre: 'Espina bífida', cie: ['Q05'] },
    { nombre: 'Faringitis y amigdalitis estreptocócicas', cie: ['J02.0', 'J03.0'] },
    { nombre: 'Fiebre manchada', cie: ['A77.0'] },
    { nombre: 'Giardiasis', cie: ['A07.1'] },
    { nombre: 'Gingivitis y enfermedad periodontal', cie: ['K05'] },
    { nombre: 'Infección gonocócica del tracto genitourinario', cie: ['A54.0', 'A54.1', 'A54.2'] },
    { nombre: 'Infecciones invasivas por Haemophilus influenzae', cie: ['A41.3', 'G00.0', 'J14'] },
    { nombre: 'Otras helmintiasis', cie: ['B65', 'B66', 'B67', 'B70', 'B71', 'B72', 'B74', 'B76', 'B78', 'B79', 'B81', 'B82', 'B83'] },
    { nombre: 'Hepatitis vírica A', cie: ['B15'] },
    { nombre: 'Hepatitis vírica B', cie: ['B16'] },
    { nombre: 'Hepatitis vírica C', cie: ['B17.1', 'B18.2'] },
    { nombre: 'Herida por arma de fuego', cie: ['W32', 'W33', 'W34'] },
    { nombre: 'Herpes genital', cie: ['A60.0'] },
    { nombre: 'Hiperplasia de la próstata', cie: ['N40'] },
    { nombre: 'Hipertensión arterial', cie: ['I10', 'I11', 'I12', 'I13', 'I14', 'I15'] },
    { nombre: 'Hipotermia', cie: ['T68'] },
    { nombre: 'Infección asociada a la atención de la salud', cie: ['S/C'] },
    { nombre: 'Otros síntomas y signos que involucran el estado emocional (ideación suicida)', cie: ['R45.8'] },
    { nombre: 'Historia personal de lesión autoinfligida intencionalmente (intento de suicidio)', cie: ['Z91.5'] },
    { nombre: 'Infecciones intestinales por otros organismos y las mal definidas', cie: ['A04', 'A08 excepto A08.0', 'A09'] },
    { nombre: 'Intoxicación aguda por alcohol', cie: ['F10.0'] },
    { nombre: 'Infecciones respiratorias agudas', cie: ['J00', 'J01', 'J03 excepto J03.0', 'J04', 'J05', 'J06', 'J20', 'J21'] },
    { nombre: 'Enfermedad isquémica del corazón', cie: ['I20', 'I25'] },
    { nombre: 'Insuficiencia venosa periférica', cie: ['I87.2'] },
    { nombre: 'Infección de vías urinarias', cie: ['N30', 'N34', 'N39.0'] },
    { nombre: 'Labio y paladar hendido', cie: ['Q35', 'Q36', 'Q37'] },
    { nombre: 'Leishmaniasis cutánea', cie: ['B55.1'] },
    { nombre: 'Lepra', cie: ['A30'] },
    { nombre: 'Leptospirosis', cie: ['A27'] },
    { nombre: 'Leucemia', cie: ['C91', 'C92', 'C93', 'C94', 'C95'] },
    { nombre: 'Linfogranuloma venéreo por Clamidias', cie: ['A55'] },
    { nombre: 'Linfoma de Hodgkin', cie: ['C81'] },
    { nombre: 'Linfoma no Hodgkin', cie: ['C82', 'C83', 'C84', 'C85'] },
    { nombre: 'Mal del pinto', cie: ['A67'] },
    { nombre: 'Meningitis tuberculosa', cie: ['A17.0'] },
    { nombre: 'Meningitis meningocócica', cie: ['A39.0'] },
    { nombre: 'Microcefalia', cie: ['Q02'] },
    { nombre: 'Intoxicación por monóxido de carbono', cie: ['T58'] },
    { nombre: 'Mordedura por serpiente de cascabel', cie: ['U60.0'] },
    { nombre: 'Mordedura por serpiente coral', cie: ['U60.1'] },
    { nombre: 'Mordeduras por otros mamíferos', cie: ['W55'] },
    { nombre: 'Mordedura por otras serpientes', cie: ['T63.0', 'X20'] },
    { nombre: 'Mordeduras por perro', cie: ['W54'] },
    { nombre: 'Enfermedad invasiva por neumococo', cie: ['A40.3', 'G00.1', 'J13'] },
    { nombre: 'Neumonías y bronconeumonías', cie: ['J12', 'J15', 'J16', 'J17', 'J18'] },
    { nombre: 'Obesidad', cie: ['E66'] },
    { nombre: 'Lesión autoinfligida intencionalmente por objeto cortante', cie: ['X78'] },
    { nombre: 'Otitis media aguda', cie: ['H65.0', 'H65.1'] },
    { nombre: 'Mordedura de otras arañas', cie: ['T63.3', 'X21'] },
    { nombre: 'Otras hepatitis víricas', cie: ['B17.0', 'B17.2', 'B17.8', 'B17.9', 'B18.0', 'B18.1', 'B18.8', 'B18.9', 'B19'] },
    { nombre: 'Otras rickettsiosis', cie: ['A79'] },
    { nombre: 'Picadura por otros artrópodos', cie: ['T63.4'] },
    { nombre: 'Picadura o intoxicación por otros animales ponzoñosos', cie: ['T63.1', 'T63.5', 'T63.6', 'T63.7', 'T63.8', 'T63.9', 'X27', 'U60.8'] },
    { nombre: 'Parálisis flácida aguda (menores de 15 años)', cie: ['U98'] },
    { nombre: 'Fiebre paratifoidea', cie: ['A01.1', 'A01.2', 'A01.3', 'A01.4'] },
    { nombre: 'Parotiditis infecciosa', cie: ['B26'] },
    { nombre: 'Peatón lesionado en accidente de transporte', cie: ['V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V07', 'V08', 'V09'] },
    { nombre: 'Intoxicación por plaguicidas', cie: ['T60'] },
    { nombre: 'Otras infecciones intestinales debidas a protozoarios', cie: ['A07.0', 'A07.2', 'A07.9'] },
    { nombre: 'Quemaduras', cie: ['T20', 'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T28', 'T29', 'T30', 'T31', 'T32'] },
    { nombre: 'Fiebre reumática aguda', cie: ['I00', 'I01', 'I02'] },
    { nombre: 'Enteritis debida a rotavirus', cie: ['A08.0'] },
    { nombre: 'Otras salmonelosis', cie: ['A02'] },
    { nombre: 'Lesión autoinfligida intencionalmente al saltar desde un lugar elevado', cie: ['X80'] },
    { nombre: 'Shigelosis', cie: ['A03'] },
    { nombre: 'Sífilis adquirida', cie: ['A51', 'A52', 'A53'] },
    { nombre: 'Sífilis congénita', cie: ['A50'] },
    { nombre: 'Síndrome meníngeo', cie: ['G00.2', 'G00.3', 'G00.8', 'G00.9', 'G01', 'G02', 'G03'] },
    { nombre: 'Teniasis', cie: ['B68'] },
    { nombre: 'Tétanos', cie: ['A34', 'A35'] },
    { nombre: 'Tifo murino', cie: ['A75.2'] },
    { nombre: 'Fiebre tifoidea', cie: ['A01.0'] },
    { nombre: 'Tos ferina', cie: ['A37'] },
    { nombre: 'Toxoplasmosis', cie: ['B58'] },
    { nombre: 'Tracoma', cie: ['A71'] },
    { nombre: 'Tricomoniasis urogenital', cie: ['A59.0'] },
    { nombre: 'Triquinosis', cie: ['B75'] },
    { nombre: 'Tuberculosis otras formas', cie: ['A17.1', 'A17.8', 'A17.9', 'A18', 'A19'] },
    { nombre: 'Tuberculosis respiratoria', cie: ['A15', 'A16'] },
    { nombre: 'Úlceras, gastritis y duodenitis', cie: ['K25', 'K26', 'K27', 'K28', 'K29'] },
    { nombre: 'Varicela', cie: ['B01'] },
    { nombre: 'Accidente de transporte en vehículos con motor', cie: ['V20', 'V40'] },
    { nombre: 'Infección por el virus de la inmunodeficiencia humana', cie: ['B20', 'B21', 'B22', 'B23', 'B24', 'Z21'] },
    { nombre: 'Violencia intrafamiliar', cie: ['Y07.0', 'Y07.1', 'Y07.2'] },
    { nombre: 'Mordedura de araña violinista', cie: ['U60.3'] },
    { nombre: 'Viruela símica', cie: ['B04'] },
    { nombre: 'Mordedura de araña viuda negra', cie: ['U60.2'] },
    { nombre: 'Infección por virus de papiloma humano', cie: ['B97.7'] },
    { nombre: 'Vulvovaginitis', cie: ['N76'] },
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

test('las CIFRAS CLAVE nombran los ciento cincuenta y un padecimientos modelados', () => {
  const rel = ctx.releasesDesdeCatalogo(CAT, leerShard);
  const s = ctx.structuredSummary(KB, rel);
  const linea = s.split('\n').find((l) => l.startsWith('Alcance vigente'));
  assert.ok(linea, s);
  assert.match(linea, /modela ciento cincuenta y un padecimientos/);
  for (const p of ['Depresión (F32)', 'Parkinson (G20)', 'Alzheimer (G30)', 'Dengue', 'Obesidad (E66)', 'Anorexia, bulimia y otros trastornos alimentarios (F50)', 'Diabetes mellitus tipo I (E10)', 'Diabetes mellitus tipo II (E11, E12, E13, E14)',
    'Infección de vías urinarias (N30, N34, N39.0)', 'Úlceras, gastritis y duodenitis (K25, K26, K27, K28, K29)',
    'Infecciones respiratorias agudas (J00, J01, J03 excepto J03.0, J04, J05, J06, J20, J21)', 'Gingivitis y enfermedad periodontal (K05)', 'Asma (J45, J46)', 'Tumor maligno de la mama (C50)', 'Tumor maligno del cuello del útero (C53)']) {
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
