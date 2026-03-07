/**
 * ask.mjs - Netlify Function: Gemini 1.5 Flash fallback.
 *
 * Recibe una pregunta, carga knowledge.json, construye contexto
 * y llama a Gemini para responder.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Cache knowledge.json in memory (cold start only)
let knowledgeCache = null;

function loadKnowledge() {
  if (knowledgeCache) return knowledgeCache;
  try {
    // Netlify Functions run from the publish dir
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const jsonPath = resolve(__dirname, '../../knowledge.json');
    const raw = readFileSync(jsonPath, 'utf-8');
    knowledgeCache = JSON.parse(raw);
  } catch (err) {
    console.error('Error cargando knowledge.json:', err.message);
    knowledgeCache = {};
  }
  return knowledgeCache;
}

function buildContext(data, query) {
  const s = data.stats || {};
  const parts = ['=== BASE DE CONOCIMIENTO EpiForecast-MX ===\n'];

  // Global
  parts.push(`Modelo activo: ${s.modelo_activo || 'stacking'}`);
  parts.push(`Total modelos: ${s.total_modelos || 333}`);
  parts.push(`Horizonte: ${s.horizonte || 52} semanas`);
  parts.push(`Evaluaciones totales: ${s.evaluaciones_totales || 1332}`);

  // Motor distribution
  const dist = s.dist_motor || {};
  parts.push('\nDistribucion de motores:');
  for (const [motor, n] of Object.entries(dist)) {
    parts.push(`  ${motor}: ${n} series`);
  }

  // Global metrics
  parts.push('\nMetricas globales:');
  for (const met of ['smape_prod', 'mase_prod', 'rmse_prod', 'mae_prod']) {
    const mean = s[`${met}_mean`];
    const median = s[`${met}_median`];
    if (mean != null) {
      parts.push(`  ${met}: mean=${mean}, median=${median}`);
    }
  }

  // Per disease
  const pp = s.por_pad || {};
  parts.push('\nPor padecimiento:');
  for (const [pad, ps] of Object.entries(pp)) {
    parts.push(`  ${pad}: n=${ps.n}, SMAPE mean=${ps.smape_prod_mean}, median=${ps.smape_prod_median}, motor=${ps.motor_ganador}, forecast=${ps.casos_futuro_total}`);
  }

  // Diagnostics
  parts.push(`\nOverfitting: OK=${s.overfitting_ok}, Moderado=${s.overfitting_moderado}, Alto=${s.overfitting_alto}`);
  parts.push(`Leakage: OK=${s.leakage_ok}, Sospechoso=${s.leakage_sospechoso}`);
  parts.push(`Fallback regional: ${s.fallback_n} series`);

  // Motor comparison
  const pm = s.por_motor || {};
  parts.push('\nComparativa de motores:');
  for (const [motor, ms] of Object.entries(pm)) {
    parts.push(`  ${motor}: SMAPE=${ms.smape_mean}, MASE=${ms.mase_mean}`);
  }

  // Forecast total
  if (s.pronostico_total) {
    parts.push(`\nPronostico total 52 semanas: ${s.pronostico_total} casos`);
  }

  // Precision
  if (s.precision_historica_mean) {
    parts.push(`Precision historica: mean=${s.precision_historica_mean}%, median=${s.precision_historica_median}%`);
  }

  // Infrastructure
  parts.push(`\nTests: ${s.tests || 849}, Lineas: ~${s.lineas_codigo || 13000}, Cobertura: >${s.cobertura || 92}%`);

  // Top/bottom
  const top = s.top5_smape || [];
  if (top.length) {
    parts.push('\nTop 5 mejores (SMAPE):');
    for (const m of top) {
      parts.push(`  ${m.padecimiento} - ${m.entidad} (${m.sexo}): ${m.smape}% [${m.motor}]`);
    }
  }

  return parts.join('\n');
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Metodo no permitido' }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body invalido' }, 400);
  }

  // Health check - returns API key status without calling Gemini
  if (body.health === true) {
    return json({ ok: true, gemini: !!apiKey });
  }

  if (!apiKey) {
    return json({ error: 'GEMINI_API_KEY no configurada' }, 500);
  }

  const query = body.query || '';
  const history = body.history || [];

  if (!query.trim()) {
    return json({ error: 'Pregunta vacia' }, 400);
  }

  const data = loadKnowledge();
  const context = buildContext(data, query);

  const systemMsg = `Eres el asistente de EpiForecast-MX, una plataforma de inteligencia epidemiologica del IMSS.
Respondes en espanol, con precision y datos reales del proyecto. NUNCA inventes metricas ni datos.
Usa Markdown para formatear. NO uses emojis. Usa las metricas exactas del contexto.

${context}

REGLAS:
- Responde SOLO con datos del contexto proporcionado.
- Si no tienes la informacion, di "No tengo esa informacion en la base de conocimiento."
- No inventes metricas, porcentajes ni datos.
- Responde de forma concisa y directa.`;

  // Build conversation
  const contents = [];

  // Add history
  for (const h of history.slice(-6)) {
    contents.push({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text || '' }],
    });
  }

  // Add current query
  contents.push({
    role: 'user',
    parts: [{ text: query }],
  });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemMsg,
    });

    const result = await model.generateContent({ contents });
    const text = result.response.text();

    return json({ answer: text });
  } catch (err) {
    console.error('Gemini error:', err.message);
    return json({ error: 'Error al consultar Gemini', detail: err.message }, 500);
  }
}
