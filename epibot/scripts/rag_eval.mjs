/**
 * rag_eval.mjs — Evaluación de recuperación del RAG (recall@k, MRR).
 *
 * Para cada pregunta de tests/rag_eval.json embebe la consulta, recupera por
 * similitud coseno sobre rag_index.json y mide si alguna de las fuentes
 * esperadas aparece en el top-K. Sirve como guardarraíl de calidad.
 *
 * Uso:  GEMINI_API_KEY=... npm run rag:eval
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { KB_DIR, EMBED_MODEL, EMBED_DIM } from './lib/corpus.mjs';

const K = 6;

function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error('✖ Falta GEMINI_API_KEY para evaluar (embeddings de consulta).'); process.exit(1); }

  const index = JSON.parse(readFileSync(resolve(KB_DIR, 'rag_index.json'), 'utf-8'));
  if (!index.vectors || !index.vectors.some(v => v && v.length)) { console.error('✖ El índice no tiene vectores; corre rag:build.'); process.exit(1); }
  const cases = JSON.parse(readFileSync(resolve(KB_DIR, 'tests/rag_eval.json'), 'utf-8')).cases;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: index.model || EMBED_MODEL });

  let r1 = 0, r3 = 0, rk = 0, mrrSum = 0;
  console.log(`▶ Evaluando ${cases.length} consultas (top-${K})\n`);
  for (const c of cases) {
    const res = await model.embedContent({
      content: { parts: [{ text: c.q }], role: 'user' },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: index.dim || EMBED_DIM,
    });
    const qv = res.embedding.values.slice(0, index.dim || EMBED_DIM);
    const ranked = index.vectors
      .map((v, i) => ({ src: index.chunks[i].source, s: cosine(qv, v) }))
      .sort((a, b) => b.s - a.s);

    const expect = new Set(c.expect);
    let rank = 0;
    for (let i = 0; i < ranked.length; i++) { if (expect.has(ranked[i].src)) { rank = i + 1; break; } }
    const top = ranked.slice(0, K).map(x => x.src);
    const hitK = top.some(s => expect.has(s));
    if (rank === 1) r1++;
    if (rank >= 1 && rank <= 3) r3++;
    if (hitK) rk++;
    if (rank >= 1) mrrSum += 1 / rank;

    const mark = hitK ? '✓' : '✗';
    console.log(`  ${mark} rank=${rank || '>'+ranked.length}  ${c.q.slice(0, 52).padEnd(52)}  top: ${[...new Set(top)].slice(0, 3).join(', ')}`);
  }

  const n = cases.length;
  console.log(`\n  recall@1=${(r1 / n * 100).toFixed(0)}%  recall@3=${(r3 / n * 100).toFixed(0)}%  recall@${K}=${(rk / n * 100).toFixed(0)}%  MRR=${(mrrSum / n).toFixed(3)}`);
  // Umbral de guardarraíl: recall@K >= 75%
  if (rk / n < 0.75) { console.error(`\n✖ recall@${K} por debajo del umbral (75%).`); process.exit(1); }
  console.log('\n✔ Calidad de recuperación OK.');
}

main().catch(err => { console.error('✖ Error:', err.message); process.exit(1); });
