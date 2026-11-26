/**
 * Plan canónico del EpiBot, 3.2 (26-nov-2026): corrector ortográfico único y batería coloquial ampliada.
 *
 * - Un solo corrector (js/corrector.js) para la reescritura y para el último recurso; ninguna deformación de palabras del
 *   boletín, estados ni palabras comunes que antes se deformaban («cólera» → «Colima», «letra» → «lepra»).
 * - Erratas reales de teclado de celular (b/v, s/z/c, h muda, letra de más) en padecimientos y estados.
 * - `coloquial.json` con 100 casos o más, calificados con el calificador del repositorio.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const local = s.match(/(knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)\.json/);
  const rel = m ? m[1] : (local ? `epibot/${local[1]}.json` : null);
  if (!rel || !existsSync(new URL(rel, raiz))) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
Math.random = () => 0.42;
const kb = await import('../js/kb.js');
await kb.loadKnowledge();
const { reescribeConsulta, ESTADOS_NOMBRE } = await import('../js/conversacion.js');
const { corrigeTexto, claveFonetica, distancia } = await import('../js/corrector.js');
const { RELEASES } = await import('../js/release_config.js');
const { califica } = await import('../eval/califica.mjs');

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();
const entendi = (q) => (reescribeConsulta(q).notas.find((n) => n.startsWith('Entendí')) || '');
const visible = (t) => String(t ?? '').split('<!--DETALLE-->')[0].replace(/<!--[\s\S]*?-->/g, '');

test('un solo corrector: kb.js y conversacion.js usan js/corrector.js y no conservan otra distancia de edición', () => {
  const kbSrc = readFileSync(new URL('../js/kb.js', import.meta.url), 'utf8');
  const convSrc = readFileSync(new URL('../js/conversacion.js', import.meta.url), 'utf8');
  assert.match(kbSrc, /from '\.\/corrector\.js\?v=\d+'/);
  assert.match(convSrc, /from '\.\/corrector\.js\?v=\d+'/);
  assert.doesNotMatch(kbSrc, /function levenshtein\b/);
  assert.doesNotMatch(convSrc, /function distancia\b/);
});

test('clave fonética del español de México y distancia con transposiciones', () => {
  assert.equal(claveFonetica('varicela'), claveFonetica('baricela'));
  assert.equal(claveFonetica('hipertension'), claveFonetica('ipertencion'));
  assert.equal(claveFonetica('gastritis'), claveFonetica('gastritiz'));
  assert.equal(claveFonetica('chiapas'), claveFonetica('chiapaz'));
  assert.notEqual(claveFonetica('colera'), claveFonetica('colima'));
  assert.equal(distancia('vaircela', 'varicela'), 1);
  assert.equal(distancia('abc', 'abcdef'), 3);
});

const ERRATAS = [
  ['diavetis en jalisco', 'diabetes'], ['diabetis en sonora', 'diabetes'], ['baricela en puebla', 'varicela'],
  ['varisela en nl', 'varicela'], ['vaircela en jalisco', 'varicela'],
  ['chicungunya en guerrero', 'chikungunya'], ['sika en chiapas', 'zika'], ['ipertension en sonora', 'hipertensión'],
  ['hipertencion en yucatan', 'hipertensión'], ['tuverculosis en baja california', 'tuberculosis'],
  ['conjuntivitiz en oaxaca', 'conjuntivitis'], ['escabiosiss en tabasco', 'escabiosis'], ['obecidad en coahuila', 'obesidad'],
  ['parkinzon en queretaro', 'parkinson'], ['alsheimer en jalisco', 'alzheimer'], ['gastritiz en michoacan', 'gastritis'],
  ['intoxicasion por alacran en morelos', 'intoxicación'], ['quemadurass en guanajuato', 'quemaduras'],
  ['vulvobaginitis en puebla', 'vulvovaginitis'], ['diabetes gestasional en veracruz', 'gestacional'],
  ['dime casos de insufiencia venosa periferica en colima', 'insuficiencia'],
  ['veracrus dengue', 'Veracruz'], ['dengue en chiapaz', 'Chiapas'], ['diabetes en michuacan', 'Michoacán'],
  ['diabetes en tamaulipaz', 'Tamaulipas'], ['y en tlaxcla?', 'Tlaxcala'],
];
// «azma» y «denge» no pasan por el corrector: son alias del catálogo (release_catalog.js) y la batería coloquial los cubre.
test(`erratas reales de celular (${ERRATAS.length}): se corrigen y se dicen con su ortografía`, () => {
  for (const [q, esperado] of ERRATAS) assert.ok(entendi(q).includes(`«${esperado}»`), `${q} → ${entendi(q) || 'sin corrección'}`);
});

// Palabras comunes que el corrector anterior (o una versión intermedia de éste) deformaba en el barrido de las baterías.
const COMUNES = ['letra', 'temporada', 'manos', 'huevos', 'resto', 'correo', 'feria', 'hacen', 'acceso', 'genial', 'quincena',
  'pueblo', 'tabaco', 'modelos', 'colina', 'cantidad', 'junto', 'corregir', 'efectivo', 'clima', 'digas', 'dejar', 'entiendes',
  'comienzo', 'reporta', 'pronostica', 'acumulada', 'enfermera', 'varicelas', 'infecciosos', 'epidemia', 'debido', 'medio',
  'patrones', 'machismo', 'punto', 'afectacion', 'convence', 'recorte', 'haces', 'influenza?'];
test('cero deformaciones: palabras comunes que antes se deformaban quedan intactas en los dos correctores', () => {
  for (const w of COMUNES) {
    assert.equal(entendi(`${w} en jalisco`), '', `reescritura deforma «${w}»: ${entendi(`${w} en jalisco`)}`);
    assert.equal(kb._fuzzyCorrect(`${w} en jalisco`), null, `último recurso deforma «${w}»`);
  }
});

test('cero deformaciones: ninguna palabra del vocabulario cerrado del boletín, de un estado o de un nombre publicado cambia', () => {
  const palabras = new Set();
  for (const f of globalThis.EPI_FRAGMENTOS || []) for (const w of f.split(' ')) if (/^[a-zñ]{4,}$/.test(w)) palabras.add(w);
  for (const e of Object.keys(ESTADOS_NOMBRE)) for (const w of e.split(' ')) palabras.add(w);
  for (const r of RELEASES) for (const t of [r.nombre, r.consultaVisible || r.consulta, ...(r.alias || [])]) for (const w of norm(t).split(' ')) if (/^[a-zñ]{4,}$/.test(w)) palabras.add(w);
  assert.ok(palabras.size > 500, `vocabulario de ${palabras.size} palabras`);
  const malas = [];
  for (const w of palabras) {
    if (entendi(w)) malas.push(`${w}: ${entendi(w)}`);
    else if (kb._fuzzyCorrect(w)) malas.push(`${w} → ${kb._fuzzyCorrect(w)} (último recurso)`);
  }
  assert.deepEqual(malas, []);
});

test('«cólera» no es «Colima», «chagas» no es «Chiapas» y «tifo» no es «tifoidea»', async () => {
  for (const [q, inicio] of [['colera en chiapas', /^\*\*C[oó]lera/], ['el colera en colima', /^\*\*C[oó]lera/],
    ['chagas en veracruz', /^«Chagas»/], ['tifo en chihuahua', /^«Tifo»/]]) {
    kb._resetContext();
    const r = await kb.answerWithTrace(q);
    assert.match(visible(r.response).trim(), inicio, `${q} [${r.handler}]`);
  }
  kb._resetContext();
});

test('un destino único: ante dos destinos igual de cerca no se corrige', () => {
  const r = corrigeTexto('cata', { objetivos: ['casa', 'cama'] });
  assert.deepEqual(r.cambios, []);
});

test('«tipo 2» o «la tipo 1» tras «diabetes en Puebla» cambia de tipo y conserva el estado', async () => {
  for (const [segundo, tipo] of [['tipo 2', /tipo II/], ['la tipo 1', /tipo I\b|tipo 1/]]) {
    kb._resetContext();
    await kb.answerWithTrace('diabetes en puebla');
    const r = await kb.answerWithTrace(segundo);
    const t = visible(r.response);
    assert.match(t, tipo, `${segundo}: ${t.slice(0, 120)}`);
    assert.match(t, /Puebla/, `${segundo} pierde el estado`);
  }
  kb._resetContext();
});

test('jerga de ranking, «eres un bot», «una peli» y «cómo hacen el pronóstico» tienen ruta local', async () => {
  for (const [q, handler] of [['q enfermedad pega mas ahorita', 'answerRankingPadecimientos'],
    ['cual es la enfermedad q mas da en mexico', 'answerRankingPadecimientos'], ['top 10 enfermedades', 'answerRankingPadecimientos'],
    ['que va subiendo', 'answerRankingPadecimientos'], ['eres un bot?', 'answerFAQ'], ['recomiendame una peli', 'answerFueraDeTema'],
    ['como hacen el pronostico', 'answerProyectoMeta']]) {
    kb._resetContext();
    const r = await kb.answerWithTrace(q);
    assert.equal(r.handler, handler, `${q}: ${r.handler}`);
  }
  kb._resetContext();
});

test('batería coloquial: 100 casos o más, con erratas, jerga, seguimientos y aclaraciones, y todos aciertan', async () => {
  const items = JSON.parse(readFileSync(new URL('./fixtures/estres/coloquial.json', import.meta.url), 'utf8'));
  assert.ok(items.length >= 100, `${items.length} casos`);
  assert.ok(items.filter((x) => x.turnos.length > 1).length >= 15, 'seguimientos de dos o tres turnos');
  assert.ok(items.filter((x) => x.espera === 'aclaracion').length >= 3, 'aclaraciones');
  const r = await califica(items);
  assert.deepEqual(r.fallos.map((f) => `${f.q} [${f.handler}] ${f.motivo}`), []);
});
