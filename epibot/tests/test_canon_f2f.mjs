/**
 * Plan canónico del EpiBot, fase 2, entrega F (26-nov-2026): 2.5, escalón 1 del acta de la mesa de fichas clínicas
 * (planes/mesa_fichas_clinicas_2026-11-26/ACTA.md). Contagio, prevención, signos de alarma y «cuándo acudir» reciben un texto
 * fijo con la fuente oficial, en el cliente y en la función de Netlify, sin llamar a ningún modelo; y ningún texto afirma una
 * revisión médica que no ocurrió.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const raiz = new URL('../../', import.meta.url);
const fetchDatos = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const local = s.match(/(knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)\.json/);
  const rel = m ? m[1] : (local ? `epibot/${local[1]}.json` : null);
  if (!rel || !existsSync(new URL(rel, raiz))) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
globalThis.fetch = fetchDatos;
Math.random = () => 0.42;
const kb = await import('../js/kb.js');
await kb.loadKnowledge();
const traza = async (q) => { kb._resetContext?.(); return kb.answerWithTrace(q); };
const clinica = await import('../js/clinica.js');
const { _reiniciaProveedor } = await import('../netlify/lib/proveedor.mjs');
const rag = (await import('../netlify/functions/rag.mjs')).default;

// Treinta preguntas clínicas (criterio 6 del acta): contagio, prevención, signos de alarma y cuándo acudir.
const CLINICAS = [
  '¿cómo se contagia la varicela?', '¿cómo se transmite la tuberculosis?', '¿es contagiosa la hepatitis A?',
  '¿cómo se contagia el dengue?', '¿la escabiosis es contagiosa?', '¿cómo se propaga la influenza?',
  '¿me puedo contagiar de sarna en la escuela de mi hijo?', 'vías de transmisión de la leptospirosis',
  '¿cómo prevengo el dengue?', '¿cómo se previene la hepatitis A?', 'como evito la escabiosis',
  '¿se puede prevenir la diabetes tipo 2?', 'prevención de la obesidad', '¿cómo me protejo del zika?',
  '¿cómo se previene la depresión?', 'medidas para evitar la fiebre tifoidea', '¿cómo evitar las infecciones intestinales?',
  '¿qué signos de alarma tiene la neumonía?', 'signos de alarma del dengue', '¿cuáles son los síntomas de alarma de la hipertensión?',
  'señales de alarma del asma', 'datos de alarma de la diarrea', '¿cuáles son los signos de peligro del paludismo?',
  '¿cuándo debo ir al médico por diarrea?', '¿cuándo hay que llevar a un niño al hospital por varicela?',
  '¿cuándo acudir a urgencias por dengue?', '¿cuándo es una urgencia el asma?', '¿cuándo se debe ir al doctor por conjuntivitis?',
  '¿cómo se contagia?', '¿qué signos de alarma hay que vigilar?',
];

test('2.5 escalón 1: treinta preguntas clínicas se responden en local, con el texto fijo, la fuente y el 911', async () => {
  for (const q of CLINICAS) {
    const r = await traza(q);
    assert.equal(r.handler, 'answerClinica', `${q} → ${r.handler}`);
    const t = String(r.response);
    // Escalón 1 (texto fijo con la fuente) o escalón 2 (ficha de cita auditada, con su rótulo y su fuente).
    assert.match(t, /consulta la fuente oficial: \[[^\]]+\]\(https:\/\/|^\*\*Cita textual de [^\n]+No la ha revisado personal de salud[\s\S]+Fuente: \[[^\]]+\]\(https:\/\//, q);
    assert.match(t, /\(la lista no es completa\), llama al \*\*911\*\*/, q);
    assert.match(t, /No doy información clínica|^\*\*Cita textual/, q);
    assert.match(t, /<!--SIN_GRAFICA-->/, q);
    assert.doesNotMatch(t, /\d+ casos|casos notificados en/, `${q}: no lleva cifras`);
  }
});

test('2.5 escalón 1: enlaces oficiales comprobados, MedlinePlus sólo como búsqueda y nombre del padecimiento', async () => {
  for (const [, , url] of clinica.ENLACES_OFICIALES) assert.match(url, /^https:\/\/www\.(gob\.mx\/salud|paho\.org\/es|who\.int\/es)\//);
  assert.match(String((await traza('¿cómo prevengo el dengue?')).response), /\[Información General sobre el Dengue\]\(https:\/\/www\.gob\.mx\/salud\//);
  assert.match(String((await traza('¿es contagiosa la hepatitis A?')).response), /\[Hepatitis A, OMS\]/);
  const varicela = String((await traza('¿cómo se contagia la varicela?')).response);
  assert.match(varicela, /\[Varicela en MedlinePlus en español\]\(https:\/\/vsearch\.nlm\.nih\.gov\//);
  assert.match(varicela, /los casos de varicela en tu estado/);
  assert.match(varicela, /<!--SIGUE:\[\{"t":"¿Cómo va varicela\?"/);
  assert.match(String((await traza('¿cómo se contagia?')).response), /\[Secretaría de Salud\]\(https:\/\/www\.gob\.mx\/salud\)/);
  assert.match(String((await traza('¿cómo se previene la depresión?')).response), /Línea de la Vida/);
});

test('2.5 escalón 1: las cifras, los síntomas personales, el consejo médico, la crisis y los sensibles conservan su ruta', async () => {
  assert.notEqual((await traza('¿cuántos contagios de dengue hay en Veracruz?')).handler, 'answerClinica');
  assert.notEqual((await traza('campañas de prevención en las escuelas')).handler, 'answerClinica');
  assert.equal((await traza('tengo fiebre, ¿cuándo debo ir al médico?')).handler, 'answerSintomas');
  assert.equal((await traza('¿puedo tomar paracetamol para el dengue?')).handler, 'answerConsejoMedico');
  const crisis = await traza('me quiero morir, ¿cómo se previene?');
  assert.notEqual(crisis.handler, 'answerClinica');
  assert.match(String(crisis.response), /800 911 2000/);
  assert.notEqual((await traza('¿cómo se previene el suicidio?')).handler, 'answerClinica');
  assert.equal(clinica.temaClinico('¿cómo va el dengue en Yucatán?'), null);
});

test('2.5 escalón 1: la lista genérica de alarma vive en una sola constante', () => {
  const js = join(fileURLToPath(raiz), 'epibot', 'js');
  const lista = /dificultad para respirar, sangrado/;
  const con = readdirSync(js).filter((f) => f.endsWith('.js') && lista.test(readFileSync(join(js, f), 'utf-8')));
  assert.deepEqual(con, ['clinica.js']);
  assert.match(clinica.LINEA_ALARMA, /\(la lista no es completa\), llama al \*\*911\*\*/);
});

// Función de Netlify: la guarda corre antes de cualquier modelo, también en «nlu» y «plan» y con la clave puesta.
async function sinModelos(fn) {
  const previa = globalThis.fetch;
  const env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY };
  let llamadas = 0;
  process.env.GEMINI_API_KEY = 'clave-gemini-prueba';
  process.env.DEEPSEEK_API_KEY = 'sk-prueba-no-real';
  globalThis.fetch = async (u) => { llamadas++; throw new Error(`fetch inesperado: ${String(u?.url ?? u)}`); };
  _reiniciaProveedor();
  try { await fn(); } finally {
    globalThis.fetch = previa;
    for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    _reiniciaProveedor();
  }
  return llamadas;
}
const post = async (body) => (await rag(new Request('http://x/.netlify/functions/rag', { method: 'POST',
  headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `c-${Math.random()}` }, body: JSON.stringify(body) }))).json();

test('2.5 escalón 1: la función de Netlify contesta las treinta sin llamar a Gemini ni a DeepSeek, en los tres modos', async () => {
  const llamadas = await sinModelos(async () => {
    for (const q of CLINICAS) {
      const r = await post({ query: q });
      assert.equal(r.guarda, 'clinica', q);
      assert.match(String(r.answer), /consulta la fuente oficial|^\*\*Cita textual de/, q);
      assert.match(String(r.answer), /\(la lista no es completa\), llama al \*\*911\*\*/, q);
      assert.deepEqual(r.sources, []);
      const nlu = await post({ query: q, modo: 'nlu' });
      assert.equal(nlu.guarda, 'clinica', `nlu: ${q}`);
      assert.equal(nlu.consulta, null);
      const plan = await post({ query: q, modo: 'plan' });
      assert.equal(plan.guarda, 'clinica', `plan: ${q}`);
      assert.deepEqual(plan.consultas, []);
    }
    const crisis = await post({ query: 'me quiero morir, ¿cómo se previene?' });
    assert.match(String(crisis.answer), /800 911 2000/);
    assert.notEqual(crisis.guarda, 'clinica');
  });
  assert.equal(llamadas, 0, 'ninguna pregunta clínica llega a un modelo');
});

// Corrección obligatoria del acta: los redactores y el revisor de las definiciones fueron asientos de IA.
test('2.5: ningún texto afirma una revisión médica que no ocurrió', () => {
  const PROHIBIDO = /m[eé]dico revisor|redactores m[eé]dicos|revisad[ao]s? por (un )?m[eé]dico|y revisada en \[?MedlinePlus/i;
  const base = fileURLToPath(raiz);
  const fuera = new Set(['node_modules', '.git', 'Reports', 'assets', 'publication', 'tests']);
  const hallados = [];
  const recorre = (dir) => {
    for (const f of readdirSync(dir)) {
      if (fuera.has(f)) continue;
      const p = join(dir, f);
      const st = statSync(p);
      if (st.isDirectory()) recorre(p);
      else if (/\.(js|mjs|html|md|json)$/.test(f) && st.size < 5e6 && PROHIBIDO.test(readFileSync(p, 'utf-8'))) hallados.push(p.slice(base.length));
    }
  };
  recorre(base);
  assert.deepEqual(hallados, []);
  assert.match(readFileSync(new URL('epibot/js/definiciones.js', raiz), 'utf-8'), /Ningún profesional de la salud las ha revisado/);
});

test('2.5: el pie visible de una definición dice que no la revisó personal de salud', async () => {
  const t = String((await traza('¿qué es la escabiosis?')).response);
  assert.match(t, /Redactada con ayuda de IA; no revisada por personal de salud\./);
});

test('aviso de privacidad: nombra a Gemini y a DeepSeek', async () => {
  const t = String((await traza('¿qué pasa con mis datos personales?')).response);
  assert.match(t, /Google Gemini/);
  assert.match(t, /DeepSeek/);
});
