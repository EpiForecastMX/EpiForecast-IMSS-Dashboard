/**
 * corpus.mjs — Ingesta y chunking del corpus RAG de EpiForecast-MX.
 *
 * Compartido por build_rag_index.mjs (indexado), rag_eval.mjs (evaluación) y
 * rag_verify.mjs (guardarraíl de reindexado). Devuelve chunks con metadatos
 * de fuente (source, title/section, url) para citas verificables.
 *
 * Chunking consciente de secciones: respeta encabezados (h1-h4 en HTML;
 * encabezados numerados / títulos conocidos en el texto del paper).
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const KB_DIR = resolve(__dirname, '..', '..');   // kb/
const ROOT_DIR = resolve(KB_DIR, '..');                  // repo root (notas HTML)

export const EMBED_MODEL = 'gemini-embedding-001';
export const EMBED_DIM = 768;
const TARGET_WORDS = 210;
const OVERLAP_WORDS = 40;
const MIN_WORDS = 25;

// Notas / reportes HTML (en la raíz del repo). url relativa al sitio kb/.
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

const MICAI_URL = '../MICAI/EpiForecast_MICAI2026.pdf';

const wordCount = (s) => (s.trim().match(/\S+/g) || []).length;

function decodeEntities(t) {
  return t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ')
    .replace(/&rarr;/g, '→').replace(/&times;/g, '×').replace(/&mdash;/g, '—');
}

function stripTags(html) {
  let t = html.replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '\n');
  t = t.replace(/<[^>]+>/g, ' ');
  t = decodeEntities(t);
  return t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n\n').replace(/ *\n */g, '\n').trim();
}

function htmlTitle(html, fallback) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : fallback;
}

/** Divide un HTML en secciones {section, text} usando los encabezados h1-h4. */
function htmlToSections(html, fallbackTitle) {
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const headingRe = /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const marks = [];
  let m;
  while ((m = headingRe.exec(t))) {
    const title = stripTags(m[2]).replace(/\s+/g, ' ').trim();
    if (title) marks.push({ end: headingRe.lastIndex, pos: m.index, title });
  }
  if (!marks.length) return [{ section: fallbackTitle, text: stripTags(t) }];

  const sections = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].end;
    const stop = i + 1 < marks.length ? marks[i + 1].pos : t.length;
    const body = stripTags(t.slice(start, stop));
    if (body && wordCount(body) >= MIN_WORDS) {
      sections.push({ section: marks[i].title.slice(0, 90), text: body });
    }
  }
  return sections.length ? sections : [{ section: fallbackTitle, text: stripTags(t) }];
}

/** Divide el texto del paper en secciones por encabezados típicos de LNCS. */
function paperToSections(txt, fallbackTitle) {
  const lines = txt.split('\n');
  const isHeading = (ln) => {
    const s = ln.trim();
    if (!s || s.length > 70) return false;
    if (/^(abstract|keywords|references|acknowledge?ments?|appendix)\b/i.test(s)) return true;
    if (/^\d+(\.\d+)?\.?\s+[A-Z][A-Za-z]/.test(s)) return true; // "1 Introduction", "3.2 Model"
    return false;
  };
  const sections = [];
  let cur = { section: fallbackTitle, lines: [] };
  for (const ln of lines) {
    if (isHeading(ln)) {
      if (cur.lines.join(' ').trim()) sections.push({ section: cur.section, text: cur.lines.join('\n').trim() });
      cur = { section: ln.trim().slice(0, 90), lines: [] };
    } else {
      cur.lines.push(ln);
    }
  }
  if (cur.lines.join(' ').trim()) sections.push({ section: cur.section, text: cur.lines.join('\n').trim() });
  return sections.filter(s => wordCount(s.text) >= MIN_WORDS);
}

/** Trocea el texto de una sección en pasajes de ~TARGET_WORDS con solapamiento. */
function chunkSection(text) {
  const paras = text.split(/\n{2,}|\n(?=[A-ZÁÉÍÓÚ0-9])/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = [], bufW = 0;
  const flush = () => { if (buf.length) { const b = buf.join('\n').trim(); if (wordCount(b) >= MIN_WORDS) chunks.push(b); buf = []; bufW = 0; } };
  for (const para of paras) {
    const w = wordCount(para);
    if (w > TARGET_WORDS * 1.6) {
      flush();
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sb = [], sw = 0;
      for (const sen of sentences) {
        sb.push(sen); sw += wordCount(sen);
        if (sw >= TARGET_WORDS) { if (wordCount(sb.join(' ')) >= MIN_WORDS) chunks.push(sb.join(' ').trim()); sb = sb.slice(-1); sw = wordCount(sb.join(' ')); }
      }
      if (sb.length && wordCount(sb.join(' ')) >= MIN_WORDS) chunks.push(sb.join(' ').trim());
      continue;
    }
    if (bufW + w > TARGET_WORDS && bufW > 0) flush();
    buf.push(para); bufW += w;
  }
  flush();
  // Solapamiento textual entre chunks consecutivos de la misma sección
  return chunks.map((c, i) => {
    if (i === 0) return c;
    const tail = chunks[i - 1].split(/\s+/).slice(-OVERLAP_WORDS).join(' ');
    return `${tail} ${c}`;
  });
}

function sectionsToChunks(sections, meta) {
  const out = [];
  for (const sec of sections) {
    const bodies = chunkSection(sec.text);
    bodies.forEach((body, i) => {
      out.push({
        id: `${meta.id}#${out.length}`,
        source: meta.source,
        section: sec.section,
        title: sec.section,
        url: meta.url || null,
        text: body,
      });
    });
  }
  return out;
}

// --- Tarjetas estructuradas desde knowledge.json ---
function structuredCards(kb) {
  const cards = [];
  const s = kb.stats || {};
  const push = (title, text) => { if (text && text.trim()) cards.push({ source: 'Datos del proyecto', section: title, title, url: '../EpiDashboard.html', text: text.trim() }); };

  push('Resumen global del sistema',
    `EpiForecast-MX opera ${s.total_modelos || 333} modelos de producción con horizonte de ${s.horizonte || 52} semanas y ${s.evaluaciones_totales || 1332} evaluaciones totales. Modelo activo: ${s.modelo_activo || 'stacking'}. SMAPE de producción: media ${s.smape_prod_mean}%, mediana ${s.smape_prod_median}%. MASE media ${s.mase_prod_mean}. Pronóstico total a 52 semanas: ${s.pronostico_total} casos. Precisión histórica: media ${s.precision_historica_mean}%, mediana ${s.precision_historica_median}%.`);
  if (s.dist_motor) push('Distribución de motores ganadores',
    `Reparto de los ${s.total_modelos || 333} modelos por motor ganador: ${Object.entries(s.dist_motor).map(([m, n]) => `${m}: ${n}`).join(', ')}. Motor líder: ${s.motor_ganador} (${s.motor_ganador_pct}%).`);
  if (s.por_motor) for (const [motor, m] of Object.entries(s.por_motor)) push(`Métricas del motor ${motor}`,
    `El motor ${motor} registra SMAPE media ${m.smape_mean}% (mediana ${m.smape_median}%), MASE media ${m.mase_mean} (mediana ${m.mase_median}), RMSE media ${m.rmse_mean}, MAE media ${m.mae_mean}. MASE < 1 indica que supera al pronóstico ingenuo.`);
  if (s.por_pad) for (const [pad, p] of Object.entries(s.por_pad)) push(`Padecimiento ${pad}: desempeño`,
    `${pad}: ${p.n} modelos, SMAPE media ${p.smape_prod_mean}% (mediana ${p.smape_prod_median}%), motor ganador ${p.motor_ganador} (${p.motor_ganador_n} modelos), pronóstico a 52 semanas ${p.casos_futuro_total} casos.`);
  push('Diagnósticos de calidad (overfitting y leakage)',
    `Overfitting: OK ${s.overfitting_ok}, moderado ${s.overfitting_moderado}, alto ${s.overfitting_alto}, N/D ${s.overfitting_nd}. Leakage: OK ${s.leakage_ok}, sospechoso ${s.leakage_sospechoso}. Fallback regional en ${s.fallback_n} series.`);

  // Macrorregiones (agrupación de las 32 entidades para el respaldo regional)
  if (kb.regiones && Object.keys(kb.regiones).length) {
    const parts = Object.entries(kb.regiones).map(([r, sts]) => `${r}: ${Array.isArray(sts) ? sts.join(', ') : sts}`);
    push('Macrorregiones del proyecto (agrupación de entidades)',
      `El sistema agrupa las 32 entidades federativas en macrorregiones para el respaldo regional (fallback) de series de baja incidencia. ${parts.join('. ')}.`);
  }

  // Top entidades por incidencia (Boletín SINAVE)
  if (kb.boletin && Array.isArray(kb.boletin.ranking_entidades) && kb.boletin.ranking_entidades.length) {
    const top = kb.boletin.ranking_entidades.slice(0, 10).map(r => `${r.entidad} (${(r.casos || 0).toLocaleString('es-MX')} casos)`);
    push('Entidades con mayor incidencia (Boletín SINAVE)',
      `Ranking de entidades federativas por incidencia anual registrada en el Boletín SINAVE (mayor a menor): ${top.join(', ')}.`);
  }

  // Desempeño por sexo
  if (s.por_sexo && Object.keys(s.por_sexo).length) {
    const parts = Object.entries(s.por_sexo).map(([k, v]) => `${k}: ${v.n} modelos, SMAPE media ${v.smape_mean}% (mediana ${v.smape_median}%), MASE media ${v.mase_mean}`);
    push('Desempeño por sexo (hombres, mujeres, general)',
      `Comparativa de desempeño del modelado por sexo. ${parts.join('; ')}. El modelo agregado 'general' (ambos sexos) suele lograr menor SMAPE por su mayor volumen de casos; hombres y mujeres se modelan por separado para la desagregación.`);
  }
  if (kb.definiciones) for (const [term, def] of Object.entries(kb.definiciones)) if (typeof def === 'string') push(`Definición: ${term}`, `${term}: ${def}`);
  if (kb.padecimiento_info) for (const [pad, info] of Object.entries(kb.padecimiento_info)) {
    const parts = typeof info === 'string' ? [info] : (info && typeof info === 'object' ? Object.entries(info).filter(([, v]) => typeof v === 'string').map(([k, v]) => `${k}: ${v}`) : []);
    if (parts.length) push(`Información clínica: ${pad}`, `${pad}. ${parts.join('. ')}`);
  }
  if (kb.training_config) { const parts = Object.entries(kb.training_config).filter(([, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => `${k}: ${v}`); if (parts.length) push('Configuración de entrenamiento', parts.join('. ')); }
  if (kb.equipo) { const eq = Array.isArray(kb.equipo) ? kb.equipo : Object.values(kb.equipo); const names = eq.map(p => typeof p === 'string' ? p : (p.nombre || p.name || '')).filter(Boolean).join(', '); push('Equipo del proyecto', `Desarrollado por el Equipo 01 de la Maestría en Inteligencia Artificial Aplicada (Tecnológico de Monterrey): ${names}.`); }

  return cards.map((c, i) => ({ id: `kb-card#${i}`, ...c }));
}

/**
 * Tarjetas en ESPAÑOL que resumen el paper MICAI (que está en inglés). Mejoran
 * el recall cross-lingüe: garantizan que preguntas conceptuales en español sobre
 * el artículo recuperen y citen la fuente correcta.
 */
function paperCardsES() {
  const cards = [
    ['Paper MICAI — Contribución principal (resumen ES)',
      'El artículo propone un marco (framework) determinista y auditable que selecciona, para CADA serie, el modelo mejor sustentado por su propia evidencia, en lugar de imponer un único algoritmo a todo el sistema de vigilancia. Su aporte central es la SELECCIÓN DE MODELO POR SERIE, transparente y reproducible, con un registro justificado de cada decisión. Título: "Forecasting Weekly Depression Incidence in Mexico: A Multi-Model Framework with Auditable Per-Series Model Selection".'],
    ['Paper MICAI — Método de selección por serie (resumen ES)',
      'Una regla transparente elige un modelo por serie según la exactitud en validación cruzada (menor error; usa SMAPE con MASE como desempate y un margen relativo del 5%). Las series de baja incidencia se reasignan a un modelo regional de respaldo (fallback). Cada elección se guarda en un log de selección justificado. La selección es REVISABLE: vuelve a elegirse cuando llegan nuevos boletines, por lo que el sistema se mantiene auditable y responsable en producción, no un ganador congelado de tabla.'],
    ['Paper MICAI — Librería de modelos (resumen ES)',
      'El conjunto de candidatos reúne pronosticadores con suposiciones inductivas deliberadamente distintas para cubrir representaciones temporales diversas: una descomposición aditiva estructural (Prophet), una red recurrente probabilística (DeepAR) y dos híbridos basados en árboles (Ensemble y Stacking). Esta diversidad mejora la cobertura ante la heterogeneidad entre regiones, sexos y tiempo.'],
    ['Paper MICAI — Datos y alcance (resumen ES)',
      'Se instancia para la incidencia semanal de depresión (CIE-10 F32) en las 32 entidades federativas de México, usando los boletines públicos del Sistema Nacional de Vigilancia Epidemiológica (SINAVE). En México la depresión afecta a unos 8 a 10 millones de personas y SINAVE registra más de 150,000 casos nuevos de episodio depresivo por año, con ventanas de saturación recurrentes en el periodo febrero-mayo. El objetivo es habilitar planeación proactiva con trayectorias a 52 semanas por entidad.'],
    ['Paper MICAI — Validación y resultados (resumen ES)',
      'El marco se valida dos veces: (1) validación cruzada de origen móvil (rolling-origin) sobre una década de observaciones semanales, y (2) evaluación prospectiva fuera de muestra contra los boletines de 2026 posteriores al corte de entrenamiento. La asignación resultante se concentra en el modelo recurrente (DeepAR) para la mayoría de las series por entidad, conservando modelos más simples donde la agregación los favorece; el pronóstico nacional, bloqueado por separado, sigue de cerca los boletines de inicio de 2026.'],
    ['Paper MICAI — Aportaciones e impacto (resumen ES)',
      'Frente a la planeación reactiva (ajustar capacidad solo después de ver el aumento en el boletín), pronósticos semanales confiables por entidad permiten una planeación PROACTIVA: anticipar personal y recursos. El enfoque es reproducible, auditable y extensible a otros padecimientos con comportamiento heterogéneo.'],
    ['Paper MICAI — Desagregación por sexo y entidad federativa (resumen ES)',
      'La desagregación por SEXO y por ENTIDAD FEDERATIVA es central en el diseño modular del sistema. En lugar de un modelo nacional único, se modela cada serie (entidad × sexo) por separado, lo que aporta granularidad y permite capturar la heterogeneidad regional y por sexo en la incidencia. Qué aporta la desagregación: pronósticos específicos por estado y por sexo, mejor cobertura de patrones locales, y selección de modelo adaptada a cada serie. Las series de muy baja incidencia se respaldan con un modelo regional.'],
  ];
  return cards.map(([section, text], i) => ({
    id: `micai-es#${i}`,
    source: 'Paper MICAI 2026',
    section,
    title: section,
    url: MICAI_URL,
    text,
  }));
}

/** Construye TODOS los chunks del corpus (sin embeddings). */
export function buildChunks() {
  const chunks = [];
  const log = [];

  // 1. Paper MICAI
  const micaiPath = resolve(KB_DIR, 'rag_sources/micai.txt');
  if (existsSync(micaiPath)) {
    const txt = readFileSync(micaiPath, 'utf-8');
    const secs = paperToSections(txt, 'Paper MICAI 2026');
    const c = sectionsToChunks(secs, { id: 'micai', source: 'Paper MICAI 2026', url: MICAI_URL });
    chunks.push(...c); log.push(['MICAI', c.length]);
  }
  // Tarjetas en español del paper (recall cross-lingüe)
  const esCards = paperCardsES();
  chunks.push(...esCards); log.push(['MICAI (resumen ES)', esCards.length]);

  // 2. Notas / reportes HTML
  for (const note of HTML_NOTES) {
    const p = resolve(ROOT_DIR, note.file);
    if (!existsSync(p)) continue;
    const html = readFileSync(p, 'utf-8');
    const secs = htmlToSections(html, htmlTitle(html, note.title));
    const c = sectionsToChunks(secs, { id: note.file.replace(/\.html$/, ''), source: note.title, url: `../${note.file}` });
    chunks.push(...c); log.push([note.file, c.length]);
  }

  // 3. Tarjetas estructuradas
  const kbPath = resolve(KB_DIR, 'knowledge.json');
  if (existsSync(kbPath)) {
    const cards = structuredCards(JSON.parse(readFileSync(kbPath, 'utf-8')));
    chunks.push(...cards); log.push(['knowledge.json (tarjetas)', cards.length]);
  }

  return { chunks, log };
}

/** Texto que se embebe por chunk (incluye fuente y sección como contexto). */
export function embedInput(c) {
  return `${c.source} — ${c.title}\n${c.text}`;
}

/** Hash estable del contenido de un chunk (para caché incremental). */
export function chunkHash(c) {
  return createHash('sha1').update(embedInput(c)).digest('hex');
}
