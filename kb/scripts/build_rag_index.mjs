/**
 * build_rag_index.mjs — Construye el índice RAG de EpiForecast-MX.
 *
 * Pipeline:
 *   1. Ingiere el corpus: paper MICAI (rag_sources/micai.txt), notas/reportes
 *      HTML del proyecto y tarjetas estructuradas derivadas de knowledge.json.
 *   2. Trocea (chunking) en pasajes de ~200 palabras con solapamiento.
 *   3. Genera embeddings con Gemini text-embedding-004 (si hay GEMINI_API_KEY).
 *   4. Escribe kb/rag_index.json { model, dim, built, chunks, vectors }.
 *
 * Si NO hay GEMINI_API_KEY, igual escribe el índice con los chunks (sin
 * vectores): la función /rag funcionará en modo léxico (BM25) hasta que se
 * generen los embeddings.
 *
 * Uso:   GEMINI_API_KEY=... npm run rag:build
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = resolve(__dirname, '..');        // kb/
const ROOT_DIR = resolve(KB_DIR, '..');         // repo root (donde viven las notas HTML)

const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIM = 768;   // gemini-embedding-001 usa MRL → truncable a 768 dims
const TARGET_WORDS = 210;     // tamaño objetivo de chunk
const OVERLAP_WORDS = 40;     // solapamiento entre chunks
const MIN_WORDS = 25;         // descarta fragmentos triviales

// --- Notas / reportes HTML del proyecto (en la raíz del repo) ---
const HTML_NOTES = [
  { file: 'bitacora_modelado.html', title: 'Bitácora de modelado' },
  { file: 'ficha_tecnica_prophet.html', title: 'Ficha técnica — Prophet' },
  { file: 'hiperparametros_modelos.html', title: 'Hiperparámetros de los modelos' },
  { file: 'conclusiones.html', title: 'Conclusiones del proyecto' },
  { file: 'reporte_resultados.html', title: 'Reporte de resultados' },
  { file: 'validacion_semanal.html', title: 'Validación semanal' },
  { file: 'comparacion_modelos.html', title: 'Comparación de modelos' },
  { file: 'referencias.html', title: 'Referencias bibliográficas' },
  { file: 'construccion_dashboard.html', title: 'Construcción del dashboard' },
  { file: 'auditoria_remediacion_2026.html', title: 'Auditoría y remediación 2026' },
  { file: 'pipeline_diagramEDA.html', title: 'Pipeline y EDA' },
  { file: 'Avance1.Equipo01.html', title: 'Avance 1 (Equipo 01)' },
  { file: 'Avance2_Equipo01.html', title: 'Avance 2 (Equipo 01)' },
];

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

function stripHtml(html) {
  let t = html;
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  t = t.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  t = t.replace(/<!--[\s\S]*?-->/g, ' ');
  // Conserva saltos en bloques para respetar párrafos
  t = t.replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '\n');
  t = t.replace(/<[^>]+>/g, ' ');
  // Entidades comunes
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
       .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
       .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ');
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n\n').replace(/ *\n */g, '\n');
  return t.trim();
}

function htmlTitle(html, fallback) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  return fallback;
}

const wordCount = (s) => (s.trim().match(/\S+/g) || []).length;

/**
 * Trocea texto en pasajes de ~TARGET_WORDS, agrupando párrafos y aplicando
 * solapamiento entre chunks consecutivos para preservar contexto.
 */
function chunkText(text, meta) {
  const paras = text.split(/\n{2,}|\n(?=[A-ZÁÉÍÓÚ0-9])/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = [];
  let bufWords = 0;

  const flush = () => {
    if (!buf.length) return;
    const body = buf.join('\n').trim();
    if (wordCount(body) >= MIN_WORDS) chunks.push(body);
    buf = [];
    bufWords = 0;
  };

  for (const para of paras) {
    const w = wordCount(para);
    if (w > TARGET_WORDS * 1.6) {
      // Párrafo largo: trocea por oraciones
      flush();
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sb = [], sw = 0;
      for (const sen of sentences) {
        sb.push(sen);
        sw += wordCount(sen);
        if (sw >= TARGET_WORDS) {
          if (wordCount(sb.join(' ')) >= MIN_WORDS) chunks.push(sb.join(' ').trim());
          // overlap: conserva la última oración
          sb = sb.slice(-1);
          sw = wordCount(sb.join(' '));
        }
      }
      if (sb.length && wordCount(sb.join(' ')) >= MIN_WORDS) chunks.push(sb.join(' ').trim());
      continue;
    }
    if (bufWords + w > TARGET_WORDS && bufWords > 0) flush();
    buf.push(para);
    bufWords += w;
  }
  flush();

  // Aplica solapamiento textual entre chunks consecutivos
  const withOverlap = chunks.map((c, i) => {
    if (i === 0) return c;
    const prevWords = chunks[i - 1].split(/\s+/);
    const tail = prevWords.slice(-OVERLAP_WORDS).join(' ');
    return `${tail} ${c}`;
  });

  return withOverlap.map((body, i) => ({
    id: `${meta.id}#${i}`,
    source: meta.source,
    title: meta.title,
    text: body,
  }));
}

// ---------------------------------------------------------------------------
// Tarjetas estructuradas desde knowledge.json
// ---------------------------------------------------------------------------

function structuredCards(kb) {
  const cards = [];
  const s = kb.stats || {};
  const push = (title, text) => { if (text && text.trim()) cards.push({ source: 'Datos del proyecto (knowledge.json)', title, text: text.trim() }); };

  // Resumen global
  push('Resumen global del sistema',
    `EpiForecast-MX opera ${s.total_modelos || 333} modelos de producción con horizonte de ${s.horizonte || 52} semanas y ` +
    `${s.evaluaciones_totales || 1332} evaluaciones totales. Modelo activo: ${s.modelo_activo || 'stacking'}. ` +
    `SMAPE de producción: media ${s.smape_prod_mean}%, mediana ${s.smape_prod_median}%. ` +
    `MASE media ${s.mase_prod_mean}. Pronóstico total a 52 semanas: ${s.pronostico_total} casos. ` +
    `Precisión histórica: media ${s.precision_historica_mean}%, mediana ${s.precision_historica_median}%.`);

  // Distribución de motores
  if (s.dist_motor) {
    const dist = Object.entries(s.dist_motor).map(([m, n]) => `${m}: ${n} modelos`).join(', ');
    push('Distribución de motores ganadores',
      `Reparto de los ${s.total_modelos || 333} modelos por motor ganador tras la validación: ${dist}. ` +
      `Motor líder: ${s.motor_ganador} (${s.motor_ganador_pct}%).`);
  }

  // Por motor (métricas)
  if (s.por_motor) {
    for (const [motor, m] of Object.entries(s.por_motor)) {
      push(`Métricas del motor ${motor}`,
        `El motor ${motor} registra SMAPE media ${m.smape_mean}% (mediana ${m.smape_median}%), ` +
        `MASE media ${m.mase_mean} (mediana ${m.mase_median}), RMSE media ${m.rmse_mean}, MAE media ${m.mae_mean}. ` +
        `MASE < 1 indica que supera al pronóstico ingenuo.`);
    }
  }

  // Por padecimiento
  if (s.por_pad) {
    for (const [pad, p] of Object.entries(s.por_pad)) {
      push(`Padecimiento ${pad}: desempeño`,
        `${pad}: ${p.n} modelos, SMAPE media ${p.smape_prod_mean}% (mediana ${p.smape_prod_median}%), ` +
        `motor ganador ${p.motor_ganador} (${p.motor_ganador_n} modelos), ` +
        `pronóstico a 52 semanas ${p.casos_futuro_total} casos.`);
    }
  }

  // Diagnósticos de calidad
  push('Diagnósticos de calidad (overfitting y leakage)',
    `Control de overfitting: OK ${s.overfitting_ok}, moderado ${s.overfitting_moderado}, alto ${s.overfitting_alto}, N/D ${s.overfitting_nd}. ` +
    `Control de fuga de datos (leakage): OK ${s.leakage_ok}, sospechoso ${s.leakage_sospechoso}. ` +
    `Fallback regional aplicado a ${s.fallback_n} series. La amplia mayoría de modelos pasa ambos controles.`);

  // Definiciones
  if (kb.definiciones) {
    for (const [term, def] of Object.entries(kb.definiciones)) {
      if (typeof def === 'string') push(`Definición: ${term}`, `${term}: ${def}`);
    }
  }

  // Info de padecimientos
  if (kb.padecimiento_info) {
    for (const [pad, info] of Object.entries(kb.padecimiento_info)) {
      const parts = [];
      if (typeof info === 'string') parts.push(info);
      else if (info && typeof info === 'object') {
        for (const [k, v] of Object.entries(info)) {
          if (typeof v === 'string') parts.push(`${k}: ${v}`);
        }
      }
      if (parts.length) push(`Información clínica: ${pad}`, `${pad}. ${parts.join('. ')}`);
    }
  }

  // Configuración de entrenamiento
  if (kb.training_config) {
    const tc = kb.training_config;
    const parts = Object.entries(tc).filter(([, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => `${k}: ${v}`);
    if (parts.length) push('Configuración de entrenamiento', parts.join('. '));
  }

  // Equipo
  if (kb.equipo) {
    const eq = Array.isArray(kb.equipo) ? kb.equipo : Object.values(kb.equipo);
    const names = eq.map(p => typeof p === 'string' ? p : (p.nombre || p.name || JSON.stringify(p))).join(', ');
    push('Equipo del proyecto', `El proyecto EpiForecast-MX fue desarrollado por el Equipo 01 de la Maestría en Inteligencia Artificial Aplicada (Tecnológico de Monterrey): ${names}.`);
  }

  return cards.map((c, i) => ({ id: `kb-card#${i}`, ...c }));
}

// ---------------------------------------------------------------------------
// Embeddings (Gemini)
// ---------------------------------------------------------------------------

async function embedAll(texts, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });

  async function embedOne(text) {
    const res = await model.embedContent({
      content: { parts: [{ text }], role: 'user' },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: EMBED_DIM,
    });
    // MRL: truncamos a EMBED_DIM por si el modelo devuelve más, y redondeamos.
    return res.embedding.values.slice(0, EMBED_DIM).map(v => +v.toFixed(6));
  }

  const vectors = new Array(texts.length);
  const CONCURRENCY = 8;
  let next = 0, done = 0;
  async function worker() {
    while (next < texts.length) {
      const i = next++;
      let attempt = 0;
      while (true) {
        try { vectors[i] = await embedOne(texts[i]); break; }
        catch (err) {
          attempt++;
          if (attempt >= 4) throw err;
          await new Promise(r => setTimeout(r, 500 * attempt)); // backoff ante 429/5xx
        }
      }
      done++;
      if (done % 10 === 0 || done === texts.length) process.stdout.write(`  embeddings ${done}/${texts.length}\r`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n');
  return vectors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('▶ Construyendo índice RAG de EpiForecast-MX\n');
  const chunks = [];

  // 1. Paper MICAI
  const micaiPath = resolve(KB_DIR, 'rag_sources/micai.txt');
  if (existsSync(micaiPath)) {
    const txt = readFileSync(micaiPath, 'utf-8');
    const c = chunkText(txt, { id: 'micai', source: 'Paper MICAI 2026', title: 'EpiForecast — Paper MICAI 2026' });
    chunks.push(...c);
    console.log(`  MICAI: ${c.length} chunks`);
  } else {
    console.warn('  ⚠ rag_sources/micai.txt no encontrado (omitiendo paper MICAI)');
  }

  // 2. Notas / reportes HTML
  for (const note of HTML_NOTES) {
    const p = resolve(ROOT_DIR, note.file);
    if (!existsSync(p)) { console.warn(`  ⚠ ${note.file} no encontrado`); continue; }
    const html = readFileSync(p, 'utf-8');
    const text = stripHtml(html);
    const c = chunkText(text, { id: note.file.replace(/\.html$/, ''), source: note.title, title: htmlTitle(html, note.title) });
    chunks.push(...c);
    console.log(`  ${note.file}: ${c.length} chunks`);
  }

  // 3. Tarjetas estructuradas
  const kbPath = resolve(KB_DIR, 'knowledge.json');
  if (existsSync(kbPath)) {
    const kb = JSON.parse(readFileSync(kbPath, 'utf-8'));
    const cards = structuredCards(kb);
    chunks.push(...cards);
    console.log(`  knowledge.json: ${cards.length} tarjetas`);
  }

  console.log(`\n  Total: ${chunks.length} chunks`);

  // 4. Embeddings
  const apiKey = process.env.GEMINI_API_KEY;
  let vectors = [];
  if (apiKey) {
    console.log(`\n▶ Generando embeddings (${EMBED_MODEL})...`);
    vectors = await embedAll(chunks.map(c => `${c.title}\n${c.text}`), apiKey);
  } else {
    console.warn('\n⚠ GEMINI_API_KEY no definida: el índice se escribe SIN vectores.');
    console.warn('  La función /rag funcionará en modo léxico (BM25) hasta regenerar con la key.');
  }

  // 5. Escribe índice
  const index = {
    model: EMBED_MODEL,
    dim: vectors.length ? vectors[0].length : EMBED_DIM,
    built: new Date().toISOString(),
    count: chunks.length,
    chunks,
    vectors,
  };
  const outPath = resolve(KB_DIR, 'rag_index.json');
  writeFileSync(outPath, JSON.stringify(index));
  const mb = (Buffer.byteLength(JSON.stringify(index)) / 1e6).toFixed(2);
  console.log(`\n✔ Escrito rag_index.json — ${chunks.length} chunks, ${vectors.length} vectores, ${mb} MB`);
}

main().catch(err => { console.error('\n✖ Error:', err); process.exit(1); });
