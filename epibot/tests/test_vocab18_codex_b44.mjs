/**
 * Decimoséptima auditoría Codex de alta_b44 (19-nov-2026, `codex/REAUDITORIA16_FE.md`, NO_APTO sobre `17ae9b83`): toda la
 * detección de padecimientos (sensibles o no; guardas, crisis, levantamiento, mixtas, entities.js, la función RAG y su
 * vista) delega en el resolutor único `padecimientosEnConsulta`; los subcódigos compactos («X600», «X700», «B200») ya no
 * eluden la detección de sensibles.
 * Prueba de propiedad: para cada id sensible, todas sus formas reconocibles por el resolutor (alias, código, subcódigos con
 * y sin punto, compactos, ancho completo) (a) en consulta mixta con un original, un release no sensible y estado, y (b) en
 * seguimiento tras «me quiero morir», nunca dan cifras en KB ni RAG. Y una prueba estructural que falla si otra función
 * de producción detecta padecimientos sin delegar en el resolutor.
 * Con `17ae9b83` fallan los casos positivos. Contrafactual: KB_MODULE=… RAG_MODULE=… node --test …
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const rel = m ? m[1] : (s.includes('knowledge.json') ? 'epibot/knowledge.json' : null);
  if (!rel || !existsSync(new URL(rel, raiz))) throw new Error(`fetch inesperado: ${s}`);
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
const desde = (env, def) => (process.env[env] ? new URL(process.env[env], `file://${process.cwd()}/`) : new URL(def, import.meta.url)).href;
const kb = await import(desde('KB_MODULE', '../js/kb.js'));
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;
delete process.env.GEMINI_API_KEY;
const rag = (await import(desde('RAG_MODULE', '../netlify/functions/rag.mjs'))).default;
const C = globalThis.EPI_CATALOGO;

async function conversa(...turnos) {
  kb._resetContext();
  let r;
  for (const q of turnos) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}
async function ragTurno(...turnos) {
  const history = turnos.slice(0, -1).flatMap((q) => [{ role: 'user', text: q }, { role: 'model', text: 'respuesta previa' }]);
  const res = await rag(new Request('http://x/.netlify/functions/rag', {
    method: 'POST', body: JSON.stringify({ query: turnos.at(-1), history }) }));
  return { status: res.status, ...(await res.json()) };
}

const LINEA = /800 911 2000/;
const MARCA = /<!--[A-Z0-9_]+:\{/;
/** Ninguna cifra fuera de los teléfonos de ayuda (800 911 2000, 911) y «24 horas». */
const sinCifras = (s) => !/\d/.test(String(s).replace(/800 911 2000/g, '').replace(/\b911\b/g, '').replace(/\b24 (horas|hours)\b/g, ''));
function esApoyo(md, q) {
  assert.match(md, LINEA, q);
  assert.doesNotMatch(md, MARCA, q);
  assert.doesNotMatch(md, /\bcasos\b|pron[oó]stico|ficha|motor|sMAPE|cases|forecast/i, q);
  assert.ok(sinCifras(md.replace('<!--SIN_GRAFICA-->', '')), `${q}: ${md}`);
}


const AYUDA = /Lamento que estés pasando por esto|I am sorry you are going through this|Sigo aquí contigo|I am still here|No reconozco algunos términos|No entendí bien tu mensaje|I do not recognize some terms|I did not quite understand/;


import { readFileSync as leerArchivo } from 'fs';



// Ruta real de la interfaz con pushHistory real: RAG (apoyo) → panorama.
const appSrc = leerArchivo(process.env.APP_JS ? new URL(process.env.APP_JS, `file://${process.cwd()}/`) : new URL('../js/app.js', import.meta.url), 'utf8');
const fuente = (re) => { const m = appSrc.match(re); assert.ok(m, String(re)); return m[0]; };
function rutaReal() {
  const llamadas = { panorama: 0, rag: 0, mensajes: [] };
  const history = [];
  const deps = {
    norm: (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(),
    detectEntities: () => ({}), answer: kb.answer, guardaInicial: kb.guardaInicial,
    estadoDesdeHistorial: kb.estadoDesdeHistorial, registraEstadoAyuda: kb.registraEstadoAyuda, estadoDeRespuesta: kb.estadoDeRespuesta,
    history, MAX_HISTORY: 6, getData: () => ({ ok: true }), appendPanorama: () => { llamadas.panorama++; },
    removeTyping: () => {}, addBotMessage: (md) => { llamadas.mensajes.push(String(md)); },
    extractChartData: () => null, getSuggestions: () => [],
  };
  // callRag de prueba: la función RAG real con el historial, y la respuesta pasa por el pushHistory REAL de app.js.
  deps.callRag = async (text) => {
    llamadas.rag++;
    const r = await ragTurno(...history.filter((h) => h.role === 'user').map((h) => h.text), text);
    llamadas.mensajes.push(String(r.answer));
    deps.pushHistoryReal(text, String(r.answer));
  };
  const nombres = Object.keys(deps);
  const fabrica = new Function(...nombres, `let lastAnswerWasRag = false, lastPad = null, lastEst = null, lastChartQuery = null;
    ${fuente(/function pushHistory\([\s\S]*?\n}\n/)}
    ${fuente(/function isPanoramaQuery\([\s\S]*?\n}\n/)}
    ${fuente(/async function routeQuery\([\s\S]*?\n}\n/)}
    return { routeQuery, pushHistory };`);
  const hecho = fabrica(...nombres.map((k) => deps[k]));
  deps.pushHistoryReal = hecho.pushHistory;
  return { routeQuery: hecho.routeQuery, llamadas };
}



const sinCifrasTxt = (t) => !C.respuestaConDatos(String(t).replace(/800 911 2000|\b911\b|\b24\b/g, ''));
for (const conv of [['me quiero morir', 'X600 en Sonora y asma'], ['me quiero morir', 'X700 en Sonora y asma'], ['me quiero morir', 'B200 en Sonora y asma'],
  ['X600 en Sonora y F32'], ['X700 en Jalisco y dengue'], ['B200 en Sonora y depression']]) {
  test(`subcódigo compacto de un id sensible (KB y RAG): ${conv.join(' → ')} sin cifras`, async () => {
    const k = await conversa(...conv);
    assert.ok(sinCifrasTxt(k.md), `${conv.join(' → ')}: ${k.md.slice(0, 200)}`);
    const r = String((await ragTurno(...conv)).answer);
    assert.ok(sinCifrasTxt(r) && !/GEMINI_API_KEY/.test(r), `${conv.join(' → ')}: ${r.slice(0, 200)}`);
  });
}
test('el resolutor reconoce los subcódigos compactos y con punto de los sensibles', () => {
  for (const [q, id] of [['X600', 'envenenamiento_analgesicos_x60'], ['x60.9', 'envenenamiento_analgesicos_x60'], ['X700', 'ahorcamiento_x70'],
    ['B200', 'vih_b20'], ['Z915', 'intento_suicidio_z915'], ['W340', 'herida_arma_fuego_w32']]) {
    assert.ok(C.idsSensiblesEn(q).some((r) => r.id === id), `${q} → ${id}`);
  }
});
// Prueba estructural: ninguna función de producción compara alias fuera del resolutor único.
test('estructura: la única detección de padecimientos es el resolutor del catálogo', () => {
  // Con KB_MODULE (contrafactual) se inspecciona el árbol de ese módulo; si no, el de esta prueba.
  const base = process.env.KB_MODULE ? new URL('../', new URL(process.env.KB_MODULE, `file://${process.cwd()}/`)) : new URL('../', import.meta.url);
  const archivos = ['js/kb.js', 'js/entities.js', 'js/obesidad_kb.js', 'js/obesidad_charts.js', 'js/app.js', 'js/release_config.js',
    'js/release_catalog.js', 'netlify/functions/rag.mjs', 'netlify/lib/vista_turno.mjs', 'netlify/lib/vista_formato.mjs', 'netlify/lib/vista_grounding.mjs'];
  const malos = [];
  for (const f of archivos) {
    let src = leerArchivo(new URL(f, base), 'utf8');
    if (f === 'js/release_catalog.js') {
      // Se excluyen la definición de la primitiva y el cuerpo del resolutor.
      const ini = src.indexOf('  function padecimientosEnConsulta(');
      const fin = src.indexOf('\n  }\n', ini);
      assert.ok(ini > 0 && fin > ini, 'resolutor localizado');
      src = src.slice(0, ini) + src.slice(fin);
      src = src.replace(/function nombraAlias\(qn, alias\) \{[\s\S]*?\n  \}/, '');
    }
    src.split('\n').forEach((l, i) => {
      if (/^\s*(\/\/|\*)/.test(l)) return;
      // Una comparación de alias contra la consulta: nombraAlias, o some/find/every sobre los alias, o un filter que nombra.
      if (/nombraAlias\(/.test(l) || /\.alias\.(some|find|every)\(/.test(l) || (/\.alias\.filter\(/.test(l) && /nombra|includes\(q|\.test\(q/.test(l)) || /(prefijos|alias)\)?\s*\.some\(\s*\(?\w+\)?\s*=>\s*\w*\.?nombra/.test(l)) {
        malos.push(`${f}:${i + 1}: ${l.trim().slice(0, 100)}`);
      }
    });
  }
  assert.deepEqual(malos, []);
});
const ANCHO = (t) => t.replace(/[A-Za-z0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0));
function formasDe(r) {
  const codigos = String(r.cie).split(/,\s*/).flatMap((tramo) => {
    const m = tramo.match(/^([A-Z])(\d{2})(?:\.(\d))?/); if (!m) return [];
    const [, L, N, D] = m;
    return D != null ? [`${L}${N}.${D}`, `${L}${N}${D}`] : [`${L}${N}`, `${L}${N}.0`, `${L}${N}0`, `${L}${N}.9`, `${L}${N}9`];
  });
  const base = [...new Set([...r.alias, ...codigos])].filter((f) => C.idsSensiblesEn(f).some((x) => x.id === r.id));
  return [...base, ...base.map(ANCHO)];
}
test('propiedad (KB y RAG): toda forma de cada id sensible en consulta mixta o tras una crisis no da cifras', async () => {
  const fallos = [];
  let n = 0;
  for (const id of C.IDS_LISTA_BLANCA) {
    const r = C.releases.find((x) => x.id === id);
    const formas = formasDe(r);
    assert.ok(formas.length >= 2, `${id}: formas`);
    for (const f of formas) {
      for (const conv of [[`${f} en Sonora, asma y F32`], [`depresión, lepra y ${f} en Jalisco`], ['me quiero morir', `${f} en Sonora`], ['me quiero morir', `${f} y asma en Sonora`]]) {
        n++;
        const k = await conversa(...conv);
        if (!sinCifrasTxt(k.md)) fallos.push(`KB ${conv.join(' → ')}`);
        const a = String((await ragTurno(...conv)).answer);
        if (!sinCifrasTxt(a) || /GEMINI_API_KEY/.test(a)) fallos.push(`RAG ${conv.join(' → ')}`);
      }
    }
  }
  assert.ok(n > 200, `${n} combinaciones`);
  assert.deepEqual(fallos.slice(0, 20), [], `${fallos.length} combinaciones con cifras`);
});
