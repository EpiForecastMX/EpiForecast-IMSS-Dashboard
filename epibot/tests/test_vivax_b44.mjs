/**
 * Último id de alta_b44 (19-nov-2026): paludismo por Plasmodium vivax (B51), control estacional tras rechazo sólo por 0 frente a
 * 0 en las series, sin desglose por sexo (32 bases, 37 series). Release, aviso de sexo, guardas frente a P. falciparum y a
 * «paludismo/malaria» a secas, y el texto del rechazo con el cambio relativo indefinido, en el EpiBot y en la función RAG.
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
  assert.doesNotMatch(md, VIVAX, q);
  assert.doesNotMatch(md, /\bcasos\b|pron[oó]stico|ficha|motor|sMAPE|cases|forecast/i, q);
  assert.ok(sinCifras(md.replace('<!--SIN_GRAFICA-->', '')), `${q}: ${md}`);
}


const VIVAX = /<!--PALUDISMO_VIVAX_B51:/;
for (const q of ['paludismo vivax en Jalisco', 'paludismo por plasmodium vivax en Chiapas', 'malaria vivax nacional', 'B51 en Quintana Roo']) {
  test(`vivax: «${q}» responde su release`, async () => {
    const { md } = await conversa(q);
    assert.match(md, VIVAX, q);
  });
}
test('vivax: sin desglose por sexo, el bot lo avisa si se pide un sexo', async () => {
  const { md } = await conversa('paludismo vivax en Chiapas mujeres');
  assert.match(md, /sin desglose por sexo|no (se )?desglosa|no tiene desglose por sexo|sólo publica el total/i);
});
for (const q of ['paludismo en Jalisco', 'malaria en Chiapas', 'casos de paludismo nacional']) {
  test(`vivax: «${q}» pide precisar sin cifras`, async () => {
    const { md } = await conversa(q);
    assert.match(md, /falciparum/i, q);
    assert.doesNotMatch(md, VIVAX, q);
    assert.doesNotMatch(md, /Pronóstico \*\*congelado\*\*/, q);
  });
}
for (const q of ['paludismo por plasmodium falciparum en Jalisco', 'malaria falciparum en Chiapas']) {
  test(`vivax: «${q}» no recibe las cifras de B51`, async () => {
    const { md } = await conversa(q);
    assert.doesNotMatch(md, VIVAX, q);
    assert.match(md, /no modela|falciparum/i, q);
    const r = String((await ragTurno(q)).answer);
    assert.doesNotMatch(r, /Paludismo por Plasmodium vivax \(B51\) ·/, q);
  });
}
test('vivax: el rechazo dice que el cambio relativo frente a cero queda indefinido (KB y RAG)', async () => {
  const q = '¿está validado el pronóstico de paludismo vivax?';
  const k = await conversa(q);
  const r = String((await ragTurno(q)).answer);
  for (const t of [k.md, r]) {
    assert.match(t, /cambio relativo frente a un control de cero queda indefinido/, t.slice(0, 300));
    assert.doesNotMatch(t, /empeoraba[^.;]*0\.0 frente a 0\.0/);
    assert.match(t, /series por estado/);
  }
});
