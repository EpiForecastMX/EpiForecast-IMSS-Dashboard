/**
 * rag_eval_quality.mjs — Evaluación de CALIDAD de respuesta (LLM-as-judge).
 *
 * Corre un set de preguntas por el handler /rag real y pide a un modelo juez
 * que puntúe FIDELIDAD (¿la respuesta se apoya en las fuentes, sin inventar?) y
 * RELEVANCIA (¿responde la pregunta?) en escala 1-5. Complementa a rag:eval, que
 * mide recuperación (recall@k). Requiere GEMINI_API_KEY.
 *
 * Uso:  GEMINI_API_KEY=... npm run rag:eval:quality
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import handler from '../netlify/functions/rag.mjs';

const QS = [
  'que dice el paper de MICAI sobre la seleccion por serie',
  'cuales son las limitaciones del estudio',
  'que aporta la desagregacion por sexo y entidad',
  'que hiperparametros usa prophet y por que',
  'como se valida fuera de muestra contra los boletines 2026',
  'cuantos casos de depresion se pronostican en Jalisco',
  'que trabajo futuro propone el proyecto',
  'como se controla el overfitting',
];

const mockReq = (body) => new Request('http://x/rag', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error('✖ Falta GEMINI_API_KEY'); process.exit(1); }
  const judge = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

  let fSum = 0, rSum = 0, n = 0;
  console.log(`▶ Evaluando calidad de ${QS.length} respuestas (juez LLM)\n`);
  for (const q of QS) {
    const res = await handler(mockReq({ query: q }));
    const j = await res.json();
    const answer = j.answer || '';
    const srcs = (j.sources || []).map(s => `[${s.n}] ${s.source}: ${s.snippet || ''}`).join('\n');
    const prompt = `Pregunta: "${q}"\n\nFUENTES:\n${srcs}\n\nRESPUESTA DE EPI:\n${answer}\n\nEvalúa en JSON {"fidelidad":1-5,"relevancia":1-5}. Fidelidad: ¿la respuesta se apoya en las fuentes/cifras sin inventar? Relevancia: ¿responde la pregunta? Devuelve SOLO el JSON.`;
    let f = 0, r = 0;
    try {
      const jr = await judge.generateContent(prompt);
      const m = (jr.response.text() || '').match(/\{[^}]*\}/);
      if (m) { const o = JSON.parse(m[0]); f = +o.fidelidad || 0; r = +o.relevancia || 0; }
    } catch (e) { /* 0 */ }
    fSum += f; rSum += r; n++;
    console.log(`  fid=${f} rel=${r}  ${q.slice(0, 52)}`);
  }
  console.log(`\n  Promedio — fidelidad: ${(fSum / n).toFixed(2)}/5 · relevancia: ${(rSum / n).toFixed(2)}/5`);
  if (fSum / n < 4 || rSum / n < 4) { console.error('\n⚠ Calidad por debajo del umbral (4/5).'); process.exit(1); }
  console.log('\n✔ Calidad de respuesta OK.');
}

main().catch(err => { console.error('✖ Error:', err.message); process.exit(1); });
