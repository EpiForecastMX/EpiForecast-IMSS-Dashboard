/**
 * eval/compara_agente.mjs — evaluación pareada del bot de reglas frente al modo agéntico (mesa agéntica, fase 5).
 *
 * Misma batería, mismas preguntas, mismo calificador (calificaUna de califica_s.mjs). El modo agéntico reproduce el flujo de
 * la página con la bandera ?agente=1: si el KB no responde o la frase pide varias cosas, pide el plan a la función RAG
 * (modo «plan») y arma la respuesta con js/agente.js. Reporta aciertos de cada uno y la tabla pareada (ganadas, perdidas).
 * El modelo del plan es el de la función: Gemini o, si falla, EPI_LLM_RESPALDO.
 *
 * Uso: EPI_LLM_RESPALDO="http://localhost:11434|qwen2.5:14b" node eval/compara_agente.mjs BATERIA.jsonl [salida.json]
 * La batería *test* se abre una sola vez (ver planes/…/bateria_s/SELLO.md).
 */
import { readFileSync, writeFileSync } from 'fs';
const { calificaUna } = await import('./califica_s.mjs');
const kb = await import('../js/kb.js');
const { pareceVariosPedidos, respuestaDePlan } = await import('../js/agente.js');
const rag = (await import('../netlify/functions/rag.mjs')).default;
console.warn = () => {};
const log0 = console.log; console.log = () => {};

async function plan(text) {
  const r = await rag(new Request('http://x/.netlify/functions/rag', { method: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': `e${Math.random()}` }, body: JSON.stringify({ query: text, modo: 'plan' }) }));
  const j = await r.json().catch(() => ({}));
  return { consultas: Array.isArray(j.consultas) ? j.consultas.slice(0, 3) : [], descartados: Number(j.descartados) || 0 };
}

const items = readFileSync(process.argv[2], 'utf-8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const res = { n: 0, reglas: 0, agente: 0, ganadas: [], perdidas: [], planes: 0 };
for (const it of items) {
  kb._resetContext();
  let base = null;
  for (const t of it.turnos) base = await kb.answer(t);
  kb._resetContext();
  for (const t of it.turnos.slice(0, -1)) await kb.answer(t);
  const ultimo = it.turnos.at(-1);
  let agente = await kb.answer(ultimo);
  if (!agente || pareceVariosPedidos(ultimo)) {
    res.planes++;
    const compuesta = await respuestaDePlan(await plan(ultimo), ultimo, !!agente, kb.answer);
    if (compuesta) agente = compuesta;
  }
  kb._resetContext();
  const a = calificaUna(it, base), b = calificaUna(it, agente);
  res.n++; if (a.ok) res.reglas++; if (b.ok) res.agente++;
  if (!a.ok && b.ok) res.ganadas.push(it.id);
  if (a.ok && !b.ok) res.perdidas.push(it.id);
}
log0(`n=${res.n} · reglas ${res.reglas} (${(100 * res.reglas / res.n).toFixed(1)} %) · agente ${res.agente} (${(100 * res.agente / res.n).toFixed(1)} %) · ` +
  `planes pedidos ${res.planes} · ganadas ${res.ganadas.length} ${JSON.stringify(res.ganadas)} · perdidas ${res.perdidas.length} ${JSON.stringify(res.perdidas)}`);
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(res, null, 1));
