/**
 * app.js - UI conversacional EpiForecast-MX con graficas en vivo.
 *
 * Carga knowledge.json, renderiza stats cards, maneja chat con kb.js local,
 * detecta datos tabulares para renderizar Chart.js inline,
 * y fallback a Gemini via Netlify Function.
 */

import { loadKnowledge, getStats, getData, answer } from './kb.js?v=98';
import { detectEntities, norm } from './entities.js?v=28';
import { renderMexicoMap } from './mexico-map.js?v=2';
import { renderTimelapse } from './timelapse.js?v=2';
import { renderSemaforo } from './semaforo.js?v=2';
import { renderComparador } from './comparador.js?v=2';
import { initSTT, TTS_SUPPORTED, setVoiceQuery, wasVoiceQuery, speak, stopSpeaking, toggleMute, isTTSEnabled, onSpeakingStateChange } from './voice.js?v=3';

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const chatArea = document.getElementById('chatArea');
const inputField = document.getElementById('inputField');
const sendBtn = document.getElementById('sendBtn');

const history = [];
const MAX_HISTORY = 6;
let chartCounter = 0;
let geminiConnected = false;

// Mapa de corrección ortográfica para nombres de entidades/padecimientos en títulos
const DISPLAY_NAMES = {
  'Depresion': 'Depresión', 'Ciudad de Mexico': 'Ciudad de México',
  'Nuevo Leon': 'Nuevo León', 'San Luis Potosi': 'San Luis Potosí',
  'Mexico': 'México', 'Leon': 'León', 'Michoacan': 'Michoacán',
  'Queretaro': 'Querétaro', 'Yucatan': 'Yucatán',
};
function dn(s) { return s ? (DISPLAY_NAMES[s] || s) : s; }

// ---------------------------------------------------------------------------
// polishSpanish: normaliza ortografía en texto de salida del bot.
// Solo se aplica al markdown que va a chat o TTS, NO a claves internas.
// Word boundaries \b protegen contra matches dentro de palabras compuestas.
// ---------------------------------------------------------------------------
const SPANISH_FIXES = [
  // Padecimientos
  [/\bDepresion\b/g, 'Depresión'], [/\bdepresion\b/g, 'depresión'],
  [/\bdepresivos\b/g, 'depresivos'], [/\bDepresivos\b/g, 'Depresivos'],
  // País / estados
  [/\bMexico\b/g, 'México'], [/\bmexico\b/g, 'méxico'],
  [/\bMichoacan\b/g, 'Michoacán'], [/\bYucatan\b/g, 'Yucatán'],
  [/\bQueretaro\b/g, 'Querétaro'], [/\bSan Luis Potosi\b/g, 'San Luis Potosí'],
  [/\bNuevo Leon\b/g, 'Nuevo León'], [/\bLeon\b/g, 'León'],
  // Términos del proyecto
  [/\bPronostico\b/g, 'Pronóstico'], [/\bpronostico\b/g, 'pronóstico'],
  [/\bPronosticos\b/g, 'Pronósticos'], [/\bpronosticos\b/g, 'pronósticos'],
  [/\bComparacion\b/g, 'Comparación'], [/\bcomparacion\b/g, 'comparación'],
  [/\bValidacion\b/g, 'Validación'], [/\bvalidacion\b/g, 'validación'],
  [/\bConfiguracion\b/g, 'Configuración'], [/\bconfiguracion\b/g, 'configuración'],
  [/\bComposicion\b/g, 'Composición'], [/\bcomposicion\b/g, 'composición'],
  [/\bInformacion\b/g, 'Información'], [/\binformacion\b/g, 'información'],
  [/\bIntroduccion\b/g, 'Introducción'], [/\bintroduccion\b/g, 'introducción'],
  [/\bRegion\b/g, 'Región'], [/\bregion\b/g, 'región'],
  [/\bRegiones\b/g, 'Regiones'], [/\bregiones\b/g, 'regiones'],
  [/\bFuncion\b/g, 'Función'], [/\bfuncion\b/g, 'función'],
  [/\bEstacion\b/g, 'Estación'], [/\bestacion\b/g, 'estación'],
  [/\bAplicacion\b/g, 'Aplicación'], [/\baplicacion\b/g, 'aplicación'],
  [/\bSolucion\b/g, 'Solución'], [/\bsolucion\b/g, 'solución'],
  [/\bAtencion\b/g, 'Atención'], [/\batencion\b/g, 'atención'],
  [/\bPrevencion\b/g, 'Prevención'], [/\bprevencion\b/g, 'prevención'],
  [/\bGeneracion\b/g, 'Generación'], [/\bgeneracion\b/g, 'generación'],
  [/\bFederacion\b/g, 'Federación'], [/\bfederacion\b/g, 'federación'],
  [/\bConclusion\b/g, 'Conclusión'], [/\bconclusion\b/g, 'conclusión'],
  // Adjetivos comunes en el dominio
  [/\bepidemiologic([oa]s?)\b/g, 'epidemiológic$1'],
  [/\bEpidemiologic([oa]s?)\b/g, 'Epidemiológic$1'],
  [/\bestadistic([oa]s?)\b/g, 'estadístic$1'],
  [/\bEstadistic([oa]s?)\b/g, 'Estadístic$1'],
  [/\bhistoric([oa]s?)\b/g, 'históric$1'],
  [/\bHistoric([oa]s?)\b/g, 'Históric$1'],
  [/\bteoric([oa]s?)\b/g, 'teóric$1'],
  [/\beconomic([oa]s?)\b/g, 'económic$1'],
  [/\bEconomic([oa]s?)\b/g, 'Económic$1'],
  [/\bgeografic([oa]s?)\b/g, 'geográfic$1'],
  [/\bdemografic([oa]s?)\b/g, 'demográfic$1'],
  [/\bsintomatic([oa]s?)\b/g, 'sintomátic$1'],
  [/\bdiagnostic([oa]s?)\b/g, 'diagnóstic$1'],
  [/\bDiagnostic([oa]s?)\b/g, 'Diagnóstic$1'],
  [/\btecnic([oa]s?)\b/g, 'técnic$1'],
  [/\bTecnic([oa]s?)\b/g, 'Técnic$1'],
  [/\bpractic([oa]s?)\b/g, 'práctic$1'],
  [/\blogic([oa]s?)\b/g, 'lógic$1'],
  [/\bsimetric([oa]s?)\b/g, 'simétric$1'],
  [/\bmetric([oa]s?)\b/g, 'métric$1'],
  [/\bMetric([oa]s?)\b/g, 'Métric$1'],
  [/\bpublic([oa]s?)\b/g, 'públic$1'],
  [/\bPublic([oa]s?)\b/g, 'Públic$1'],
  // Sustantivos
  [/\bSintoma\b/g, 'Síntoma'], [/\bsintoma\b/g, 'síntoma'],
  [/\bSintomas\b/g, 'Síntomas'], [/\bsintomas\b/g, 'síntomas'],
  [/\bNumero\b/g, 'Número'], [/\bnumero\b/g, 'número'],
  [/\bBoletin\b/g, 'Boletín'], [/\bboletin\b/g, 'boletín'],
  [/\bPais\b/g, 'País'], [/\bpais\b/g, 'país'],
  [/\bpaises\b/g, 'países'], [/\bPaises\b/g, 'Países'],
  [/\bSecretaria\b/g, 'Secretaría'], [/\bsecretaria\b/g, 'secretaría'],
  [/\bUltimo\b/g, 'Último'], [/\bultimo\b/g, 'último'],
  [/\bUltima\b/g, 'Última'], [/\bultima\b/g, 'última'],
  [/\bunicament(e)\b/g, 'únicament$1'], [/\bUnicament(e)\b/g, 'Únicament$1'],
  [/\bsemanalmente\b/g, 'semanalmente'],
  [/\bperiodicament(e)\b/g, 'periódicament$1'],
  // Conectores y adverbios frecuentes
  [/\btambien\b/g, 'también'], [/\bTambien\b/g, 'También'],
  [/\bademas\b/g, 'además'], [/\bAdemas\b/g, 'Además'],
  [/\basi\b/g, 'así'], [/\bAsi\b/g, 'Así'],
  [/\bdespues\b/g, 'después'], [/\bDespues\b/g, 'Después'],
  [/\brapid([oa]s?)\b/g, 'rápid$1'],
  // "más" (more) — en español moderno casi siempre lleva tilde
  // Solo cuando está rodeado de espacios para evitar romper compuestos
  [/ mas /g, ' más '],
  [/^mas /g, 'más '],
  [/ mas$/g, ' más'],
  [/ mas([,.;:!?\)])/g, ' más$1'],
  // Markdown bold: **mas** (raro pero por si acaso)
  [/\*\*mas\*\*/g, '**más**'],
];

function polishSpanish(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const [re, repl] of SPANISH_FIXES) out = out.replace(re, repl);
  return out;
}

// Paleta mejorada basada en el logo - más vibrante y diferenciada
const CHART_COLORS = [
  '#5B8DEF', // teal IMSS
  '#2DD4BF', // gold IMSS
  '#F472B6', // burgundy IMSS
  '#8FB4FF', // teal electric (highlights)
  '#5EEAD4', // gold electric
  '#F9A8D4', // burgundy electric
  '#A78BFA', // morado complementario
  '#3B9AE8', // azul claro complementario
  '#3A6FD8', // teal oscuro
  '#FF8F4F', // naranja accent
  '#A9C2F0', // mint
  '#BFE9E0', // cream gold
];

// ---------------------------------------------------------------------------
// Chart visual enhancements — gradientes, glow, crosshair, formato numérico.
// Se aplican de forma central en renderChart(), así que TODOS los gráficos
// (líneas, barras, áreas, doughnut, radar) heredan el acabado sin tocar cada
// generador individual.
// ---------------------------------------------------------------------------

// Parsea '#RGB', '#RRGGBB', '#RRGGBBAA' o 'rgb()/rgba()' a [r,g,b].
function parseRGB(c) {
  if (typeof c !== 'string') return null;
  c = c.trim();
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    if (h.length >= 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return null;
  }
  const m = c.match(/rgba?\(([^)]+)\)/i);
  if (m) { const p = m[1].split(',').map(s => parseFloat(s)); return [p[0], p[1], p[2]]; }
  return null;
}
const rgbaStr = (rgb, a) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

// Formato compacto para ejes (1.2k, 3.4M); respeta strings/categorías.
function fmtAxis(v) {
  if (typeof v !== 'number' || !isFinite(v)) return v;
  const a = Math.abs(v);
  if (a >= 1e6) return +(v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return +(v / 1e3).toFixed(1) + 'k';
  return v.toLocaleString('es-MX');
}
// Formato completo para tooltips (con separadores de miles es-MX).
function fmtFull(v) {
  if (typeof v !== 'number' || !isFinite(v)) return v;
  return (Number.isInteger(v) ? v : +v.toFixed(2)).toLocaleString('es-MX');
}

// Gradiente vertical/horizontal por dataset, generado con el ctx del canvas.
const epiGradientPlugin = {
  id: 'epiGradient',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    for (const ds of chart.data.datasets) {
      if (!ds._grad) continue;
      const rgb = parseRGB(ds._grad.base);
      if (!rgb) continue;
      let g;
      if (ds._grad.kind === 'barH') {
        g = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
        g.addColorStop(0, rgbaStr(rgb, 0.5));
        g.addColorStop(1, rgbaStr(rgb, 1));
      } else if (ds._grad.kind === 'bar') {
        g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, rgbaStr(rgb, 1));
        g.addColorStop(1, rgbaStr(rgb, 0.45));
      } else { // area
        g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, rgbaStr(rgb, 0.42));
        g.addColorStop(0.85, rgbaStr(rgb, 0.03));
        g.addColorStop(1, rgbaStr(rgb, 0));
      }
      ds.backgroundColor = g;
    }
  },
};

// Resplandor suave bajo las líneas (no aplica a áreas ni bandas).
const epiGlowPlugin = {
  id: 'epiGlow',
  beforeDatasetDraw(chart, args) {
    const ds = chart.data.datasets[args.index];
    const t = ds.type || chart.config.type;
    if (t !== 'line' || !ds.borderWidth) return;
    if (ds._grad && ds._grad.kind === 'area') return;
    const rgb = parseRGB(ds.borderColor) || [91, 141, 239];
    chart.ctx.save();
    chart.ctx.shadowColor = rgbaStr(rgb, 0.45);
    chart.ctx.shadowBlur = 9;
    chart.ctx.shadowOffsetY = 3;
  },
  afterDatasetDraw(chart, args) {
    const ds = chart.data.datasets[args.index];
    const t = ds.type || chart.config.type;
    if (t === 'line' && ds.borderWidth && !(ds._grad && ds._grad.kind === 'area')) chart.ctx.restore();
  },
};

// Guía vertical punteada al pasar el cursor sobre gráficos de línea.
const epiCrosshairPlugin = {
  id: 'epiCrosshair',
  afterDraw(chart) {
    if (chart.config.type !== 'line') return;
    const act = chart.getActiveElements();
    if (!act || !act.length) return;
    const { ctx, chartArea } = chart;
    const x = act[0].element.x;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(91, 141, 239, 0.4)';
    ctx.stroke();
    ctx.restore();
  },
};

// Total al centro del doughnut.
const epiDoughnutCenterPlugin = {
  id: 'epiDoughnutCenter',
  afterDraw(chart) {
    if (chart.config.type !== 'doughnut') return;
    const ds = chart.data.datasets[0];
    if (!ds) return;
    // Gauge: texto central personalizado (ej. "98.5%" + subtítulo)
    const big = ds._centerText != null ? ds._centerText : fmtAxis(ds.data.reduce((a, b) => a + (+b || 0), 0));
    const sub = ds._centerSub != null ? ds._centerSub : 'TOTAL';
    const { ctx, chartArea } = chart;
    const cx = (chartArea.left + chartArea.right) / 2;
    // En gauge (semicírculo) el centro visual baja un poco
    const half = chart.options.circumference && chart.options.circumference <= 180;
    const cy = half ? chartArea.bottom - 18 : (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#E7ECF5';
    ctx.font = '800 30px Outfit, sans-serif';
    ctx.fillText(String(big), cx, cy - 8);
    ctx.fillStyle = '#6E82A6';
    ctx.font = '600 10px Outfit, sans-serif';
    ctx.fillText(String(sub).toUpperCase(), cx, cy + 16);
    ctx.restore();
  },
};

// Box-plot: dibuja bigotes (mín–máx) y marcador de mediana sobre barras
// horizontales flotantes cuyo dataset trae `_box` = [{min,p25,med,p75,max}].
const epiBoxPlotPlugin = {
  id: 'epiBoxPlot',
  afterDatasetsDraw(chart) {
    const ds = chart.data.datasets[0];
    if (!ds || !ds._box) return;
    const xs = chart.scales.x;
    const meta = chart.getDatasetMeta(0);
    const { ctx } = chart;
    ctx.save();
    for (let i = 0; i < ds._box.length; i++) {
      const b = ds._box[i];
      const el = meta.data[i];
      if (!b || !el) continue;
      const y = el.y;
      const half = (el.height || 22) / 2;
      const xMin = xs.getPixelForValue(b.min);
      const xMax = xs.getPixelForValue(b.max);
      const xMed = xs.getPixelForValue(b.med);
      // Bigote mín–máx con tapas
      ctx.strokeStyle = 'rgba(231, 236, 245, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xMin, y); ctx.lineTo(xMax, y);
      ctx.moveTo(xMin, y - half * 0.55); ctx.lineTo(xMin, y + half * 0.55);
      ctx.moveTo(xMax, y - half * 0.55); ctx.lineTo(xMax, y + half * 0.55);
      ctx.stroke();
      // Marcador de mediana
      ctx.strokeStyle = '#E7ECF5';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(xMed, y - half); ctx.lineTo(xMed, y + half);
      ctx.stroke();
    }
    ctx.restore();
  },
};

// ---------------------------------------------------------------------------
// Gemini connectivity check
// ---------------------------------------------------------------------------

async function checkGemini(attempt = 0) {
  const indicator = document.getElementById('geminiStatus');
  if (!indicator) return;
  let ragReady = false;
  try {
    const resp = await fetch('/.netlify/functions/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ health: true }),
    });
    if (resp.ok) {
      const data = await resp.json();
      geminiConnected = data.gemini === true;
      ragReady = data.rag === true && data.hasVectors === true;
    }
  } catch (err) {
    console.warn('RAG health check failed:', err);
    geminiConnected = false;
  }
  if (geminiConnected) {
    indicator.className = 'gemini-status gemini-ok';
    indicator.innerHTML = `
      <span class="gemini-dot"></span>
      <span>${ragReady ? 'RAG activo' : 'Powered by AI'}</span>`;
  } else if (attempt < 1) {
    // Cold start de la función serverless: reintenta una vez a los 6 s antes
    // de declarar «Solo datos locales». Mientras tanto se queda en "Conectando...".
    setTimeout(() => { checkGemini(attempt + 1); }, 6000);
  } else {
    indicator.className = 'gemini-status gemini-off';
    indicator.innerHTML = `
      <span class="gemini-dot"></span>
      <span>Solo datos locales</span>`;
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  try {
    const data = await loadKnowledge();
    renderStats(data);
    renderBuildBadge(data);
    addWelcome(data);
  } catch (err) {
    console.error('Error cargando knowledge.json:', err);
    const chatEl = document.getElementById('chatArea');
    if (chatEl) {
      chatEl.innerHTML = `<div style="padding:24px;color:#F472B6;font-weight:600;">
        Error al cargar la base de conocimiento: ${err.message}</div>`;
    }
  }

  checkGemini();

  // Lightbox: clic en una imagen de una respuesta (p.ej. la grafica de pronostico El Nino)
  // la abre en grande; clic de nuevo la cierra.
  chatArea.addEventListener('click', (e) => {
    const img = e.target.closest('.msg-content img');
    if (!img) return;
    const ov = document.createElement('div');
    ov.className = 'img-lightbox';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', img.alt || 'Imagen ampliada');
    ov.tabIndex = -1;
    const big = document.createElement('img');
    big.src = img.src;
    big.alt = img.alt || '';
    ov.appendChild(big);
    const closeLightbox = () => {
      ov.remove();
      document.removeEventListener('keydown', onLightboxKey);
    };
    const onLightboxKey = (ev) => { if (ev.key === 'Escape') closeLightbox(); };
    ov.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', onLightboxKey);
    document.body.appendChild(ov);
    ov.focus();
  });

  sendBtn.addEventListener('click', handleSend);
  inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  // Voice input (STT)
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    initSTT(micBtn, inputField, (transcript) => {
      inputField.value = transcript;
      setVoiceQuery(true);
      handleSend();
    });
  }

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetChat);
  }

  // TTS stop & mute buttons
  const ttsStopBtn = document.getElementById('ttsStopBtn');
  const ttsMuteBtn = document.getElementById('ttsMuteBtn');

  if (ttsStopBtn) {
    ttsStopBtn.addEventListener('click', () => {
      stopSpeaking();
    });
  }

  if (ttsMuteBtn) {
    // Hide if TTS not supported
    if (!TTS_SUPPORTED) { ttsMuteBtn.style.display = 'none'; }
    else {
      const syncMuteUI = (enabled) => {
        ttsMuteBtn.classList.toggle('muted', !enabled);
        ttsMuteBtn.title = enabled ? 'Silenciar respuestas de voz' : 'Activar respuestas de voz';
        const label = ttsMuteBtn.querySelector('.voice-btn-label');
        if (label) label.textContent = enabled ? 'Voz' : 'Silencio';
        // Update SVG
        ttsMuteBtn.querySelector('svg').innerHTML = enabled
          ? '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/>'
          : '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
      };
      // Restaura la preferencia de silencio persistida (localStorage, voice.js)
      syncMuteUI(isTTSEnabled());
      ttsMuteBtn.addEventListener('click', () => { syncMuteUI(toggleMute()); });
    }
  }

  // Show/hide stop button when TTS starts/stops
  onSpeakingStateChange((speaking) => {
    if (ttsStopBtn) ttsStopBtn.style.display = speaking ? '' : 'none';
  });

  // Prompt menu (burger)
  const promptToggle = document.getElementById('promptToggle');
  const promptMenu = document.getElementById('promptMenu');
  const promptMenuClose = document.getElementById('promptMenuClose');

  if (promptToggle && promptMenu) {
    // Pool of entity/data prompts — 6 random picks shown each time
    // OJO: `q` es la consulta que se manda al matcher (sin tildes, NO tocar);
    // `text` es la etiqueta visible (con ortografía correcta).
    const ENTITY_PROMPTS = [
      { text: 'Depresión en Jalisco', q: 'depresion en Jalisco' },
      { text: 'Depresión en CDMX', q: 'depresion en Ciudad de Mexico' },
      { text: 'Depresión en Nuevo León', q: 'depresion en Nuevo Leon' },
      { text: 'Parkinson en Sonora', q: 'parkinson en Sonora' },
      { text: 'Parkinson en Veracruz', q: 'parkinson en Veracruz' },
      { text: 'Parkinson en Chihuahua', q: 'parkinson en Chihuahua' },
      { text: 'Alzheimer en Puebla', q: 'alzheimer en Puebla' },
      { text: 'Alzheimer en Guanajuato', q: 'alzheimer en Guanajuato' },
      { text: 'Alzheimer en Yucatán', q: 'alzheimer en Yucatan' },
      { text: 'Top entidades', q: 'ranking entidades por incidencia' },
      { text: 'Resumen 2024', q: 'resumen epidemiologico 2024' },
      { text: 'Resumen 2023', q: 'resumen epidemiologico 2023' },
      { text: 'Hombres vs Mujeres', q: 'depresion hombres vs mujeres' },
      { text: 'Parkinson por sexo', q: 'parkinson hombres vs mujeres' },
      { text: 'Jalisco vs Nuevo León', q: 'compara Jalisco y Nuevo Leon' },
      { text: 'CDMX vs Estado de México', q: 'compara Ciudad de Mexico y Mexico' },
      { text: 'Sonora vs Chihuahua', q: 'compara Sonora y Chihuahua' },
      { text: 'Oaxaca vs Guerrero', q: 'compara Oaxaca y Guerrero' },
      { text: 'Baja California', q: 'pronostico Baja California' },
      { text: 'Tabasco', q: 'pronostico Tabasco' },
      { text: 'Michoacán', q: 'pronostico Michoacan' },
      { text: 'Quintana Roo', q: 'pronostico Quintana Roo' },
      { text: 'Sinaloa', q: 'pronostico Sinaloa' },
      { text: 'Coahuila', q: 'pronostico Coahuila' },
      { text: 'Tamaulipas', q: 'pronostico Tamaulipas' },
      { text: 'Chiapas', q: 'pronostico Chiapas' },
      { text: 'Región Norte', q: 'region norte' },
      { text: 'Región Sur', q: 'region sur' },
      { text: 'Pronóstico Dengue', q: 'pronostico dengue' },
      { text: 'Mapa de Dengue', q: 'mapa de mexico de dengue' },
      { text: 'Próximo brote Dengue', q: 'proximo brote de dengue' },
      { text: 'Dengue: dónde golpea', q: 'donde golpea el dengue' },
    ];

    const entidadesContainer = document.getElementById('promptEntidades');

    function fillRandomEntidades() {
      if (!entidadesContainer) return;
      // Keep the label, remove old buttons
      const label = entidadesContainer.querySelector('.prompt-cat-label');
      entidadesContainer.innerHTML = '';
      if (label) entidadesContainer.appendChild(label);
      // Pick 6 random
      const shuffled = [...ENTITY_PROMPTS].sort(() => Math.random() - 0.5);
      const picks = shuffled.slice(0, 6);
      for (const p of picks) {
        const btn = document.createElement('button');
        btn.className = 'prompt-item';
        btn.dataset.q = p.q;
        btn.textContent = p.text;
        btn.addEventListener('click', () => {
          closePromptMenu();
          inputField.value = p.q;
          handleSend();
        });
        entidadesContainer.appendChild(btn);
      }
    }

    function togglePromptMenu() {
      const isOpen = promptMenu.classList.toggle('open');
      promptToggle.classList.toggle('active', isOpen);
      promptMenu.setAttribute('aria-hidden', String(!isOpen));
      promptToggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) fillRandomEntidades();
    }
    function closePromptMenu() {
      promptMenu.classList.remove('open');
      promptToggle.classList.remove('active');
      promptMenu.setAttribute('aria-hidden', 'true');
      promptToggle.setAttribute('aria-expanded', 'false');
    }

    promptToggle.addEventListener('click', togglePromptMenu);
    if (promptMenuClose) promptMenuClose.addEventListener('click', closePromptMenu);

    // Click a prompt item → send it (for static items)
    promptMenu.querySelectorAll('.prompt-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.q;
        if (q) {
          closePromptMenu();
          inputField.value = q;
          handleSend();
        }
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (promptMenu.classList.contains('open') &&
          !promptMenu.contains(e.target) &&
          !promptToggle.contains(e.target)) {
        closePromptMenu();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && promptMenu.classList.contains('open')) closePromptMenu();
    });
  }
}

function resetChat() {
  history.length = 0;
  chartCounter = 0;
  lastChartQuery = '';
  lastAnswerWasRag = false;
  lastPad = null;
  lastEst = null;
  // Libera recursos antes de vaciar el DOM: instancias Chart.js (leak de
  // canvas/listeners), lectura TTS en curso e intervalos del timelapse.
  if (typeof Chart !== 'undefined' && Chart.getChart) {
    document.querySelectorAll('#chatArea canvas').forEach((c) => {
      const ch = Chart.getChart(c);
      if (ch) ch.destroy();
    });
  }
  document.querySelectorAll('#chatArea .timelapse-wrapper').forEach((w) => {
    if (typeof w._tlStop === 'function') w._tlStop();
  });
  stopSpeaking();
  while (chatArea.firstChild) chatArea.removeChild(chatArea.firstChild);
  stickToBottom = true;
  hideScrollDownBtn();
  const data = getData();
  if (data) addWelcome(data);
  inputField.focus();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ---------------------------------------------------------------------------
// Stats cards
// ---------------------------------------------------------------------------

function renderStats(data) {
  const s = data.stats || {};
  const el = (id) => document.getElementById(id);

  el('statModelos').textContent = s.total_modelos || 333;
  el('statSmape').textContent = s.smape_prod_median != null ? `${s.smape_prod_median}%` : '--';

  if (s.motor_ganador) {
    el('statMotor').innerHTML =
      `${s.motor_ganador} <span style="font-size:11px;opacity:0.5;font-weight:500">${s.motor_ganador_pct || ''}%</span>`;
  }

  if (s.pronostico_total != null) {
    el('statForecast').textContent = Number(s.pronostico_total).toLocaleString('es-MX');
  }
}

function renderBuildBadge(data) {
  const badge = document.getElementById('buildBadge');
  const gen = data._generated;
  if (gen) {
    const d = new Date(gen);
    badge.textContent = `Build ${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  } else {
    badge.textContent = 'v1.0';
  }
}

// ---------------------------------------------------------------------------
// Welcome message
// ---------------------------------------------------------------------------

// Padecimientos del hero: orden, etiqueta, color de marca y código CIE-10.
const HERO_PADS = [
  { pad: 'Depresion', label: 'Depresión', color: '#5B8DEF', cie: 'F32' },
  { pad: 'Parkinson', label: 'Parkinson', color: '#2DD4BF', cie: 'G20' },
  { pad: 'Alzheimer', label: 'Alzheimer', color: '#F472B6', cie: 'G30' },
  { pad: 'Dengue', label: 'Dengue', color: '#F59E0B', cie: 'A97' },
];

// Conteo animado (easeOutCubic). Respeta prefers-reduced-motion.
function animateCount(el, target, fmt) {
  fmt = fmt || ((v) => String(Math.round(v)));
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !target) { el.textContent = fmt(target || 0); return; }
  const dur = 1100;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(target * eased);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = fmt(target);
  }
  requestAnimationFrame(tick);
}

// Pie de pronóstico por padecimiento: motor productivo, SMAPE y casos a 52 sem.
function heroCaption(data, padObj) {
  const fmtInt = (n) => Math.round(n).toLocaleString('es-MX');
  if (padObj.pad === 'Dengue' && data.dengue) {
    const d = data.dengue;
    const motor = d.motor_nacional || 'DeepAR';
    const sm = d.smape_nacional != null ? `${Math.round(d.smape_nacional)}%` : '—';
    const casos = d.casos_futuro_nacional_52sem != null ? fmtInt(d.casos_futuro_nacional_52sem) : '—';
    return { motor, sm, casos };
  }
  const p = (data.stats && data.stats.por_pad && data.stats.por_pad[padObj.pad]) || {};
  return {
    motor: p.motor_ganador || '—',
    sm: p.smape_prod_median != null ? `${Math.round(p.smape_prod_median)}%` : '—',
    casos: p.casos_futuro_total != null ? fmtInt(p.casos_futuro_total) : '—',
  };
}

// Espera a que zoom_series.json (carga diferida en kb.js) esté disponible.
function whenZoomReady(data, cb, tries) {
  tries = tries == null ? 60 : tries;
  if (data.zoom_series) { cb(data.zoom_series); return; }
  if (tries <= 0) { cb(null); return; }
  setTimeout(() => whenZoomReady(data, cb, tries - 1), 120);
}

function addWelcome(data) {
  const s = data.stats || {};
  // Total de modelos en producción de los 4 padecimientos del hero (neuro 333 +
  // Dengue 102 = 435). Se suma por_pad para no depender de total_modelos, que la
  // corrección de cohorte deja en 333 (solo neuro).
  const porPad = s.por_pad || {};
  const total = HERO_PADS.reduce((acc, p) => acc + ((porPad[p.pad] && porPad[p.pad].n) || 0), 0)
    || s.total_modelos || 435;

  const kpis = [
    { key: 'pad', val: HERO_PADS.length, label: 'padecimientos', icon: '<path d="M3 12h4l2 6 4-14 2 8h6"/>' },
    { key: 'ent', val: 32, label: 'entidades + Nacional', icon: '<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>' },
    { key: 'hz', val: 52, label: 'semanas de horizonte', icon: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>' },
    { key: 'mod', val: total, label: 'modelos en producción', icon: '<path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 7v6l8 4 8-4V7"/>' },
  ];

  const cid = `chart-${++chartCounter}`;
  const kpisHtml = kpis.map((k) =>
    `<div class="hero-kpi">
       <svg class="hero-kpi-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${k.icon}</svg>
       <div class="hero-kpi-txt"><span class="hero-kpi-val" data-val="${k.val}">0</span><span class="hero-kpi-lbl">${k.label}</span></div>
     </div>`).join('');

  const pillsHtml = HERO_PADS.map((p, i) =>
    `<button class="hero-pill${i === 0 ? ' is-active' : ''}" data-pad="${p.pad}" style="--pill:${p.color}" aria-pressed="${i === 0 ? 'true' : 'false'}">
       <span class="hero-pill-dot"></span>${p.label}<span class="hero-pill-cie">${p.cie}</span>
     </button>`).join('');

  const hero =
    `<div class="welcome-hero">
       <div class="welcome-hero-title">Hola, soy <span class="welcome-brand">EPI</span></div>
       <div class="welcome-hero-sub">Copiloto epidemiológico para la salud pública en México. Esto es lo que vigilamos en tiempo real:</div>
       <div class="hero-kpis">${kpisHtml}</div>
       <div class="hero-pills" role="group" aria-label="Padecimiento del pronóstico nacional">${pillsHtml}</div>
       <div class="hero-chart-wrap">
         <div class="msg-chart-container"><canvas id="${cid}"></canvas></div>
         <div class="hero-caption" id="${cid}-cap"></div>
       </div>
     </div>`;

  const suggestions = [
    { text: 'Métricas globales', q: 'metricas globales' },
    { text: 'Mapa de México', q: 'mapa de mexico por casos' },
    { text: '¿Cómo va el dengue?', q: 'pronostico de dengue' },
    { text: 'Equipo', q: 'equipo del proyecto' },
  ];
  const suggestionsHtml =
    '<div class="msg-suggestions">' +
    suggestions.map((sg) => `<button data-q="${escapeAttr(sg.q)}">${escapeHtml(polishSpanish(sg.text))}</button>`).join('') +
    '</div>';

  // El hero es contenido propio (canvas/svg/botones/estilos) que el sanitizador
  // de respuestas eliminaría; por eso se construye el nodo directamente y NO se
  // enruta por addBotMessage/marked/DOMPurify.
  const msg = document.createElement('div');
  msg.className = 'msg msg-bot msg-welcome';
  msg.innerHTML =
    `<div class="msg-avatar"><img src="EpiBot_v2_avatar.png" alt="EpiForecast-MX" /></div>
     <div class="msg-body">
       <div class="msg-meta">
         <span class="msg-name">EpiForecast-MX</span>
         <span class="msg-source badge-local">Datos reales</span>
       </div>
       <div class="msg-bubble-bot">
         <div class="msg-content">${hero}</div>
         ${suggestionsHtml}
       </div>
     </div>`;
  chatArea.appendChild(msg);
  msg.querySelectorAll('.msg-suggestions button').forEach((btn) => {
    btn.addEventListener('click', () => { inputField.value = btn.dataset.q; handleSend(); });
  });

  // KPIs con conteo animado.
  msg.querySelectorAll('.hero-kpi-val').forEach((el) => {
    const target = parseInt(el.dataset.val, 10) || 0;
    animateCount(el, target, (v) => Math.round(v).toLocaleString('es-MX'));
  });

  // Gráfico nacional real (historia + pronóstico + banda) por padecimiento.
  const capEl = msg.querySelector(`#${cid}-cap`);
  function drawHero(padObj) {
    const z = data.zoom_series;
    const cap = heroCaption(data, padObj);
    if (capEl) {
      capEl.innerHTML =
        `<span class="hero-cap-chip" style="--pill:${padObj.color}">Motor: <b>${cap.motor}</b></span>` +
        `<span class="hero-cap-chip">SMAPE <b>${cap.sm}</b></span>` +
        `<span class="hero-cap-chip">${cap.casos} casos pronosticados · 52 sem</span>`;
    }
    if (!z) return;
    const serie = z[`${norm(padObj.pad)}|nacional|general`];
    if (serie && serie.d && serie.d.length) {
      renderChart(cid, buildSeriesZoom(serie, padObj.pad, 'Nacional', 'general'));
    }
  }

  whenZoomReady(data, () => drawHero(HERO_PADS[0]));

  // Pills: alternan el padecimiento del gráfico en vivo.
  msg.querySelectorAll('.hero-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      msg.querySelectorAll('.hero-pill').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      const padObj = HERO_PADS.find((p) => p.pad === btn.dataset.pad) || HERO_PADS[0];
      drawHero(padObj);
    });
  });

  scrollToBottom(true);
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

let lastChartQuery = '';
let lastAnswerWasRag = false;   // si la última respuesta vino del RAG (para seguimientos)
let lastPad = null;             // padecimiento del contexto conversacional (para gráficos)
let lastEst = null;             // estado/entidad del contexto conversacional
let busy = false;               // consulta en vuelo: bloquea envíos concurrentes

function setSendBusy(value) {
  busy = value;
  if (sendBtn) {
    sendBtn.disabled = value;
    sendBtn.setAttribute('aria-disabled', String(value));
  }
}

async function handleSend() {
  const text = inputField.value.trim();
  if (!text || busy) return;
  setSendBusy(true);
  inputField.value = '';
  addUserMessage(text);
  // Indicador de «pensando» también en el camino local (callRag crea el suyo).
  const typingEl = addTypingIndicator();
  try {
    await routeQuery(text, typingEl);
  } finally {
    removeTyping(typingEl);
    setSendBusy(false);
  }
}

async function routeQuery(text, typingEl) {
  // Seguimiento corto tras una respuesta del RAG → continúa en el RAG (que
  // contextualiza con el historial e inyecta datos exactos). Evita que «¿y X?»
  // pierda la intención al caer en un handler local distinto.
  // EXCEPCIÓN: si la consulta corta trae entidades del dominio (estado,
  // padecimiento, métrica…) y el KB local la resuelve, gana el KB; así
  // «métricas globales» responde con datos reales aunque venga tras el RAG.
  const tnorm = norm(text);
  const isShortFollowUp = text.trim().split(/\s+/).length <= 5 || /^¿?\s*(y|pero|ademas|entonces|tambien|ok)\b/.test(tnorm);

  let result = null;
  let triedLocal = false;
  if (lastAnswerWasRag && isShortFollowUp) {
    const entFu = detectEntities(text);
    const hasDomainEntity = !!(entFu.padecimiento || entFu.estado) ||
      /(metric|smape|mase|rmse|motor|modelo|pronostic|mapa|ranking|validacion|semaforo|zoom|equipo)/.test(tnorm);
    if (hasDomainEntity) {
      triedLocal = true;
      try { result = await answer(text); } catch (err) { console.error('KB error:', err); }
    }
    if (!result) { removeTyping(typingEl); await callRag(text); return; }
  }

  if (!result && !triedLocal) {
    try { result = await answer(text); } catch (err) { console.error('KB error:', err); }
  }

  if (result) {
    // Hereda el padecimiento/estado del contexto para que el GR\u00c1FICO de un
    // seguimiento coincida con el texto (ej. \u00ab\u00bfy en Sonora?\u00bb tras Parkinson \u2192
    // gr\u00e1fico de Parkinson en Sonora; \u00abevoluci\u00f3n hist\u00f3rica en Sonora\u00bb \u2192
    // tendencia SOLO de Parkinson, no de los 3 padecimientos).
    const ent = detectEntities(text);
    let chartQuery = text;
    // En seguimientos, completa el padecimiento/estado faltante desde el contexto
    // (ej. «¿y en Puebla?» o «por sexo» heredan «Depresión» y/o «Puebla»).
    const needsCtx = isShortFollowUp || (ent.estado && !ent.padecimiento) || (ent.padecimiento && !ent.estado);
    if (needsCtx) {
      const parts = [];
      if (!ent.padecimiento && lastPad) parts.push(lastPad);
      if (!ent.estado && lastEst && (isShortFollowUp || ent.padecimiento)) parts.push(`en ${lastEst}`);
      if (parts.length) chartQuery = `${parts.join(' ')} ${text}`;
    }
    if (ent.padecimiento) lastPad = ent.padecimiento;
    if (ent.estado) lastEst = ent.estado;

    let chartData = null;
    try {
      chartData = extractChartData(result, chartQuery);
      // Fallback: seguimiento por a\u00f1o (ej. \u00ab\u00bfy en 2024?\u00bb) usando la \u00faltima consulta con gr\u00e1fico
      if (!chartData && lastChartQuery) {
        const tn = norm(text);
        const isNewTopic = /(resumen|que es|explicam|como funciona|cuantos modelo|alcance|equipo|infraestructura)/.test(tn);
        if (isShortFollowUp && !isNewTopic && ent._years && ent._years.length) {
          const merged = lastChartQuery.replace(/\b20[0-3]\d\b/g, '') + ' ' + chartQuery;
          chartData = extractChartData(result, merged);
        }
      }
    } catch (err) {
      console.error('extractChartData error:', err);
    }
    if (chartData) lastChartQuery = chartQuery;
    lastAnswerWasRag = false;
    const suggestions = getSuggestions(text);
    removeTyping(typingEl);
    addBotMessage(result, 'local', suggestions, chartData);
    pushHistory(text, result);
    return;
  }

  removeTyping(typingEl);
  await callRag(text);
}

// ---------------------------------------------------------------------------
// RAG: consulta a la base de conocimiento (función serverless /rag).
// Reutilizable por el fallback de handleSend y por los chips de fuentes.
// ---------------------------------------------------------------------------
const STRIP_CIFRAS = /\s*\[\s*(cifras?\s*clave|datos del proyecto)\s*\]/gi;

async function callRag(text) {
  const typingEl = addTypingIndicator('EPI está consultando la base de conocimiento');
  let shell = null, acc = '', sources = null, gotMeta = false, streamErr = null, rafPending = false;
  const render = () => {
    if (!shell) return;
    shell.content.innerHTML = sanitizeHtml(marked.parse(polishSpanish(acc), { breaks: true }));
    scrollToBottom();
  };
  try {
    const resp = await fetch('/.netlify/functions/rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, history: history.slice(-MAX_HISTORY), stream: true }),
    });
    if (!resp.ok) {
      removeTyping(typingEl);
      const errData = await resp.json().catch(() => ({}));
      console.warn('RAG response error:', resp.status, errData);
      addBotMessage(`${errData.error || 'No pude consultar la IA en este momento.'}\n\nMientras tanto, prueba «métricas globales» o «equipo del proyecto».`, 'error');
      return;
    }
    if (!resp.body || !resp.body.getReader) { removeTyping(typingEl); return await ragNonStream(text, resp); }

    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let streamed = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.type === 'meta') { gotMeta = true; sources = o.sources || []; removeTyping(typingEl); shell = createBotShell(); }
        else if (o.type === 'delta') { streamed = true; acc += o.text || ''; if (!rafPending) { rafPending = true; requestAnimationFrame(() => { rafPending = false; render(); }); } }
        else if (o.type === 'error') { streamErr = o.error; }
        else if (o.type === 'done') { /* finalize abajo */ }
        else if (o.answer !== undefined) { gotMeta = true; sources = o.sources || []; acc = o.answer || ''; } // respuesta no-stream en una línea
      }
    }
    removeTyping(typingEl);

    if (streamErr && !acc.trim()) { if (shell) shell.div.remove(); addBotMessage(`${streamErr}\n\nPrueba «métricas globales» o «equipo del proyecto».`, 'error'); return; }
    if (!gotMeta && !acc.trim()) { if (shell) shell.div.remove(); return await ragNonStream(text); } // no fue streaming → fallback

    const finalText = (acc.replace(STRIP_CIFRAS, '').trim()) || 'Sin respuesta.';
    if (shell) shell.div.remove();
    addBotMessage(finalText, 'ai', null, null, sources);   // mensaje final con copy/tts/chips
    pushHistory(text, finalText);
    lastAnswerWasRag = true;
    void streamed;
  } catch (err) {
    removeTyping(typingEl);
    if (shell) { try { shell.div.remove(); } catch {} }
    console.warn('RAG stream error, fallback:', err);
    await ragNonStream(text);
  }
}

// Fallback sin streaming (función antigua, error de stream, o red intermitente).
async function ragNonStream(text, existing) {
  try {
    const resp = existing || await fetch('/.netlify/functions/rag', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, history: history.slice(-MAX_HISTORY) }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const answer = (data.answer || 'Sin respuesta.').replace(STRIP_CIFRAS, '');
      addBotMessage(answer, 'ai', null, null, data.sources);
      pushHistory(text, answer);
      lastAnswerWasRag = true;
    } else {
      const errData = await resp.json().catch(() => ({}));
      addBotMessage(`${errData.error || 'No pude consultar la IA en este momento.'}\n\nPrueba «métricas globales» o «equipo del proyecto».`, 'error');
    }
  } catch (err) {
    console.warn('RAG fetch error:', err);
    addBotMessage('No pude conectar con el servicio de IA. Verifica tu conexión.\n\nMientras tanto, prueba: «métricas globales», «equipo» o «depresión en Jalisco».', 'error');
  }
}

// Reformula y consulta directamente al RAG sobre una fuente (chip clicable).
async function askAboutSource(sourceName) {
  if (busy) return;
  const q = `Cuéntame más sobre la respuesta anterior, con base en «${sourceName}».`;
  setSendBusy(true);
  addUserMessage(q);
  try {
    await callRag(q);
  } finally {
    setSendBusy(false);
  }
}

const DOC_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const ASK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

// Chips de fuentes (RAG): deduplica por documento; abre el documento real y
// muestra el EXTRACTO citado al pasar el cursor; sub-botón para profundizar.
function sourceChipsHtml(sources) {
  if (!sources || !sources.length) return '';
  const seen = new Set();
  const docs = [];
  for (const s of sources) {
    const name = s.source || s.title || '';
    if (!name || seen.has(name)) continue;
    seen.add(name);
    docs.push({ n: s.n, name, url: safeUrl(s.url || ''), snippet: s.snippet || '' });
  }
  if (!docs.length) return '';
  return '<div class="msg-sources">' + docs.map(d => {
    const label = `${DOC_ICON}<span class="src-n">[${d.n}]</span>${escapeHtml(polishSpanish(d.name))}`;
    const tip = escapeAttr(d.snippet ? `«${polishSpanish(d.snippet)}…»` : 'Abrir fuente');
    const open = d.url
      ? `<a class="src-open" href="${escapeAttr(d.url)}" target="_blank" rel="noopener" title="${tip}">${label}</a>`
      : `<span class="src-open src-open--static" title="${tip}">${label}</span>`;
    return `<span class="msg-source-chip">${open}<button class="src-ask" data-src="${escapeAttr(d.name)}" title="Profundizar con base en esta fuente" aria-label="Profundizar con base en ${escapeAttr(d.name)}">${ASK_ICON}</button></span>`;
  }).join('') + '</div>';
}

function bindSourceChips(div) {
  div.querySelectorAll('.msg-source-chip .src-ask').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); askAboutSource(btn.dataset.src); });
  });
}

// Shell efímero para renderizar la respuesta en streaming (token a token).
function createBotShell() {
  const div = document.createElement('div');
  div.className = 'msg msg-bot';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="msg-avatar"><img src="EpiBot_v2_avatar.png" alt="EpiForecast-MX" /></div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name">EpiForecast-MX</span>
        <span class="msg-source badge-ai">IA</span>
        <span class="msg-time">${timeStr}</span>
      </div>
      <div class="msg-bubble-bot"><div class="msg-content msg-streaming"></div></div>
    </div>`;
  chatArea.appendChild(div);
  scrollToBottom();
  return { div, content: div.querySelector('.msg-content') };
}

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

function addUserMessage(text) {
  // El saludo de bienvenida desaparece en cuanto el usuario hace su 1ª pregunta.
  const welcome = chatArea.querySelector('.msg-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = 'msg msg-user';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="msg-avatar-user">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name">Tú</span>
        <span class="msg-time">${timeStr}</span>
      </div>
      <div class="msg-bubble"><div class="msg-content">${escapeHtml(text)}</div></div>
    </div>`;
  chatArea.appendChild(div);
  scrollToBottom(true);   // al enviar, el usuario siempre quiere ver su mensaje
}

function addBotMessage(markdown, source, suggestions, chartData, sources) {
  const div = document.createElement('div');
  div.className = 'msg msg-bot';

  let badgeClass = 'badge-local';
  let badgeText = 'Datos reales';
  if (source === 'ai') { badgeClass = 'badge-ai'; badgeText = 'IA'; }
  else if (source === 'error') { badgeClass = 'badge-error'; badgeText = 'Error'; }

  // Normalizar acentos antes de comentarios y render
  const polished = polishSpanish(markdown);
  const cleanMarkdown = polished.replace(/<!--COMPARE:.*?-->/g, '').replace(/<!--DISTRIB:.*?-->/g, '').replace(/<!--GENCHART:.*?-->/g, '');
  const html = sanitizeHtml(marked.parse(cleanMarkdown, { breaks: true }));
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  let suggestionsHtml = '';
  if (suggestions && suggestions.length) {
    suggestionsHtml = '<div class="msg-suggestions">' +
      suggestions.map(s => `<button data-q="${escapeAttr(s.q)}">${escapeHtml(polishSpanish(s.text))}</button>`).join('') +
      '</div>';
  }

  // Chips de fuentes (RAG): documento + extracto + sub-botón "profundizar".
  const sourcesHtml = sourceChipsHtml(sources);

  let chartHtml = '';
  let customChartType = null; // 'map' | 'timelapse' | 'semaforo' | 'comparador' | 'pdf'
  const chartList = chartData ? (Array.isArray(chartData) ? chartData : [chartData]) : [];

  // Detect special chart types
  const mapCharts = chartList.filter(c => c._mapChart);
  const isTimelapse = chartList.length === 1 && chartList[0]._timelapseChart;
  const isSemaforo = chartList.length === 1 && chartList[0]._semaforoChart;
  const isComparador = chartList.length === 1 && chartList[0]._comparadorChart;
  const isPDF = chartList.length === 1 && chartList[0]._pdfReport;

  if (isTimelapse) {
    customChartType = 'timelapse';
    chartHtml = `<div class="msg-chart-container" id="tl-${++chartCounter}"></div>`;
  } else if (isSemaforo) {
    customChartType = 'semaforo';
    chartHtml = `<div class="msg-chart-container" id="sem-${++chartCounter}"></div>`;
  } else if (isComparador) {
    customChartType = 'comparador';
    chartHtml = `<div class="msg-chart-container" id="cmp-${++chartCounter}"></div>`;
  } else if (isPDF) {
    customChartType = 'pdf';
    chartHtml = `<div class="pdf-btn-wrap"><button class="pdf-btn" id="pdf-${++chartCounter}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>Generar reporte PDF</button></div>`;
  } else if (mapCharts.length && mapCharts.length === chartList.length) {
    customChartType = 'map';
    if (mapCharts.length === 1) {
      chartHtml = `<div class="msg-chart-container" id="map-${++chartCounter}"></div>`;
    } else {
      chartHtml = '<div class="msg-chart-stack">' +
        mapCharts.map(() => `<div class="msg-chart-container" id="map-${++chartCounter}"></div>`).join('') +
        '</div>';
    }
  } else if (chartList.length) {
    const ids = chartList.map(() => `chart-${++chartCounter}`);
    if (chartList.length > 1) {
      const isVertical = chartList.some(c => c.title && c.title.includes('corredor'));
      const gridClass = isVertical ? 'msg-chart-stack' : 'msg-chart-grid';
      chartHtml = `<div class="${gridClass}">` +
        ids.map(id => `<div class="msg-chart-container"><canvas id="${id}"></canvas></div>`).join('') +
        `</div>`;
    } else {
      chartHtml = `<div class="msg-chart-container"><canvas id="${ids[0]}"></canvas></div>`;
    }
  }

  div.innerHTML = `
    <div class="msg-avatar">
      <img src="EpiBot_v2_avatar.png" alt="EpiForecast-MX" />
    </div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name">EpiForecast-MX</span>
        <span class="msg-source ${badgeClass}">${badgeText}</span>
        <span class="msg-time">${timeStr}</span>
        <button class="msg-action-btn copy-btn" title="Copiar respuesta" aria-label="Copiar respuesta al portapapeles"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        ${TTS_SUPPORTED ? '<button class="msg-action-btn tts-btn" title="Escuchar respuesta" aria-label="Escuchar respuesta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg></button>' : ''}
      </div>
      <div class="msg-bubble-bot">
        <div class="msg-content">${html}</div>
        ${chartHtml}
        ${sourcesHtml}
        ${suggestionsHtml}
      </div>
    </div>`;

  chatArea.appendChild(div);

  // Bind suggestion buttons
  div.querySelectorAll('.msg-suggestions button').forEach(btn => {
    btn.addEventListener('click', () => {
      inputField.value = btn.dataset.q;
      handleSend();
    });
  });

  // Bind source chips (RAG): "profundizar" consulta al RAG; el enlace abre el doc.
  bindSourceChips(div);

  // Bind copy button
  const copyBtn = div.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        // Texto plano (markdown sin marcas) para portapapeles cómodo
        const plain = cleanMarkdown
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .replace(/\[(.*?)\]\(.*?\)/g, '$1')
          .replace(/<!--.*?-->/g, '')
          .trim();
        await navigator.clipboard.writeText(plain);
        copyBtn.classList.add('copied');
        copyBtn.setAttribute('title', 'Copiado');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.setAttribute('title', 'Copiar respuesta');
        }, 1500);
      } catch (err) {
        console.warn('Copy falló:', err);
      }
    });
  }

  // TTS: bind speaker button + auto-speak if query was by voice
  const ttsBtn = div.querySelector('.tts-btn');
  if (ttsBtn) {
    ttsBtn.addEventListener('click', () => {
      speak(cleanMarkdown, ttsBtn);
    });
    // Auto-speak when the user asked by voice
    if (wasVoiceQuery()) {
      setVoiceQuery(false);
      requestAnimationFrame(() => speak(cleanMarkdown, ttsBtn));
    }
  }

  // Render charts
  if (customChartType === 'timelapse') {
    requestAnimationFrame(() => {
      const container = div.querySelector('.msg-chart-container');
      if (container) renderTimelapse(container, { frames: chartList[0].frames }, chartList[0].opts);
    });
  } else if (customChartType === 'semaforo') {
    requestAnimationFrame(() => {
      const container = div.querySelector('.msg-chart-container');
      if (container) renderSemaforo(container, chartList[0].semaforoData, chartList[0].opts);
    });
  } else if (customChartType === 'comparador') {
    requestAnimationFrame(() => {
      const container = div.querySelector('.msg-chart-container');
      if (container) renderComparador(container, chartList[0].comparadorData, chartList[0].opts);
    });
  } else if (customChartType === 'pdf') {
    requestAnimationFrame(() => {
      const btn = div.querySelector('.pdf-btn');
      if (btn) btn.addEventListener('click', () => generatePDFReport(chartList[0].data));
    });
  } else if (customChartType === 'map') {
    requestAnimationFrame(() => {
      const containers = div.querySelectorAll('.msg-chart-container');
      const maps = chartList.filter(c => c._mapChart);
      containers.forEach((container, i) => {
        if (maps[i]) renderMexicoMap(container, maps[i].stateData, maps[i].opts);
      });
    });
  } else if (chartList.length) {
    requestAnimationFrame(() => {
      chartList.forEach((cd, i) => {
        const id = chartCounter - chartList.length + 1 + i;
        renderChart(`chart-${id}`, cd);
      });
    });
  }

  scrollToBottom();
}

function addTypingIndicator(label) {
  // Robustez: el id es fijo; si quedó un indicador previo, se retira antes.
  const prev = document.getElementById('typing-indicator');
  if (prev) prev.remove();
  const div = document.createElement('div');
  div.className = 'msg msg-bot';
  div.id = 'typing-indicator';
  const txt = label || 'EPI está pensando';
  div.innerHTML = `
    <div class="msg-avatar">
      <img src="EpiBot_v2_avatar.png" alt="EpiForecast-MX" />
    </div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">EpiForecast-MX</span></div>
      <div class="msg-bubble-bot">
        <div class="typing-row">
          <div class="typing"><span></span><span></span><span></span></div>
          <span class="typing-label">${txt}…</span>
        </div>
      </div>
    </div>`;
  chatArea.appendChild(div);
  scrollToBottom();
  return div;
}

function removeTyping(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

// Atajo de teclado: "/" enfoca el input (estilo Slack/GitHub)
document.addEventListener('keydown', (e) => {
  // Solo si no estás escribiendo en otro input/textarea
  const tgt = e.target;
  const isTyping = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable);
  if (e.key === '/' && !isTyping && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    if (inputField) {
      inputField.focus();
      inputField.select?.();
    }
  }
});

// ---------------------------------------------------------------------------
// Chart.js integration
// ---------------------------------------------------------------------------

/**
 * Genera grafico de tendencia historica.
 * Para el ultimo anio (2026) separa dato real parcial vs proyectado (real + pronostico restante).
 * El tramo proyectado se muestra como linea punteada.
 */
/**
 * Corredor de confianza: banda min-max de 4 modelos + linea productiva + real.
 * 1 chart por padecimiento filtrado.
 */
function buildCorridorChart(data, qn) {
  const wc = data.weekly_comparison;
  if (!wc) return null;

  const MODELS = ['prophet', 'deepar', 'ensemble', 'stacking'];
  const pads = Object.keys(wc);
  const filtered = pads.filter(pad => {
    if (!qn) return true;
    const pn = pad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const inQ = qn.includes(pn);
    return inQ || !pads.some(p => qn.includes(p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  });
  if (!filtered.length) return null;

  const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };
  const charts = [];

  for (const pad of filtered) {
    const info = wc[pad];
    const sems = info.semanas || [];
    if (!sems.length) continue;
    const color = padColors[pad] || '#5B8DEF';

    const labels = sems.map(s => `S${String(s.semana).padStart(2, '0')}`);
    const minData = sems.map(s => Math.min(...MODELS.map(m => s[m] || 0)));
    const maxData = sems.map(s => Math.max(...MODELS.map(m => s[m] || 0)));
    const prodData = sems.map(s => s.pronostico);
    const realData = sems.map(s => s.real != null ? s.real : null);

    const datasets = [
      // Banda superior (max)
      {
        label: 'Max modelos',
        data: maxData,
        borderColor: 'transparent',
        backgroundColor: color + '20',
        fill: false,
        pointRadius: 0,
        borderWidth: 0,
        tension: 0.3,
        order: 4,
      },
      // Banda inferior (min) con fill hasta max
      {
        label: 'Min modelos',
        data: minData,
        borderColor: 'transparent',
        backgroundColor: color + '20',
        fill: '-1',
        pointRadius: 0,
        borderWidth: 0,
        tension: 0.3,
        order: 3,
      },
      // Pronostico productivo (linea central)
      {
        label: `Productivo (${info.modelo_productivo || pad})`,
        data: prodData,
        borderColor: color,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        borderWidth: 2.5,
        pointRadius: 0,
        order: 2,
      },
      // Real
      {
        label: 'Real',
        data: realData,
        borderColor: '#ffffff',
        backgroundColor: '#ffffffCC',
        fill: false,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: realData.map(v => v != null ? 4 : 0),
        pointBackgroundColor: '#ffffff',
        pointBorderColor: color,
        pointBorderWidth: 2,
        spanGaps: false,
        order: 1,
      },
    ];

    // Dispersion (max - min) promedio
    const spreads = sems.map(s => {
      const vals = MODELS.map(m => s[m] || 0);
      return Math.max(...vals) - Math.min(...vals);
    });
    const avgSpread = (spreads.reduce((a, v) => a + v, 0) / spreads.length).toFixed(0);

    // Calcular rango Y con padding para que los datos llenen el grafico
    const allVals = [...minData, ...maxData, ...prodData, ...realData.filter(v => v != null)];
    const yMin = Math.min(...allVals);
    const yMax = Math.max(...allVals);
    const yPad = Math.max(1, Math.round((yMax - yMin) * 0.15));

    charts.push({
      type: 'line',
      title: `${dn(pad)} — corredor de confianza (4 modelos, dispersión prom: ${avgSpread})`,
      labels,
      datasets,
      options: {
        scales: {
          x: { ticks: { maxRotation: 90, font: { size: 9 }, autoSkip: true, maxTicksLimit: 20 } },
          y: { min: Math.max(0, yMin - yPad), max: yMax + yPad },
        },
      },
    });
  }

  if (!charts.length) return null;
  return charts.length === 1 ? charts[0] : charts;
}

/**
 * Treemap (simulado con barras horizontales): casos por entidad, color segun SMAPE.
 */
function buildTreemap(data) {
  const models = data.prod_models || [];
  if (!models.length) return null;

  // Agregar por entidad (solo estados reales, general)
  const byEnt = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    const e = m.entidad || '';
    if (e === 'Nacional' || e.startsWith('region_')) continue;
    if (!byEnt[e]) byEnt[e] = { casos: 0, smapes: [] };
    byEnt[e].casos += m.casos_52_semanas_futuro || 0;
    if (m.smape_prod != null) byEnt[e].smapes.push(m.smape_prod);
  }

  const entries = Object.entries(byEnt)
    .map(([ent, d]) => ({
      ent,
      casos: d.casos,
      smape: d.smapes.length ? d.smapes.reduce((a, v) => a + v, 0) / d.smapes.length : 100,
    }))
    .sort((a, b) => b.casos - a.casos);

  if (!entries.length) return null;

  // Color por SMAPE: verde (<30%), amarillo (30-60%), rojo (>60%)
  const smapeColor = (s) => {
    if (s <= 30) return '#5B8DEF';
    if (s <= 60) return '#2DD4BF';
    return '#F472B6';
  };

  return {
    type: 'bar',
    horizontal: true,
    title: 'Casos pronosticados por entidad (color = SMAPE)',
    labels: entries.map(e => e.ent),
    datasets: [{
      label: 'Casos (52 sem)',
      data: entries.map(e => e.casos),
      backgroundColor: entries.map(e => smapeColor(e.smape) + 'CC'),
      borderColor: entries.map(e => smapeColor(e.smape)),
      borderWidth: 1,
      borderRadius: 3,
    }],
    options: {
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true },
        y: { ticks: { font: { size: 9 } } },
      },
    },
  };
}

/**
 * Radar comparativo de motores: poligono por motor con metricas normalizadas.
 */
function buildRadarChart(data) {
  const pm = data.stats?.por_motor;
  const dist = data.stats?.dist_motor;
  if (!pm || !dist) return null;

  const motors = Object.keys(pm);
  if (motors.length < 2) return null;

  const totalSeries = Object.values(dist).reduce((a, v) => a + v, 0);

  // Ejes: SMAPE (invertido), MASE (invertido), Series ganadas %, RMSE (invertido), MAE (invertido)
  // Normalizar a 0-100 donde 100 = mejor
  const maxSmape = Math.max(...motors.map(m => pm[m].smape_mean));
  const maxMase = Math.max(...motors.map(m => pm[m].mase_mean));
  const maxRmse = Math.max(...motors.map(m => pm[m].rmse_mean));
  const maxMae = Math.max(...motors.map(m => pm[m].mae_mean));

  const labels = ['Precisión (SMAPE)', 'MASE', 'Series ganadas', 'RMSE', 'MAE'];
  const motorColors = { Prophet: '#5B8DEF', DeepAR: '#F472B6', Ensemble: '#2DD4BF', Stacking: '#9DB6FF' };

  const datasets = motors.map(m => {
    const color = motorColors[m] || '#7E92B6';
    return {
      label: m,
      data: [
        Math.round((1 - pm[m].smape_mean / maxSmape) * 100),
        Math.round((1 - pm[m].mase_mean / maxMase) * 100),
        Math.round(((dist[m] || 0) / totalSeries) * 100),
        Math.round((1 - pm[m].rmse_mean / maxRmse) * 100),
        Math.round((1 - pm[m].mae_mean / maxMae) * 100),
      ],
      borderColor: color,
      backgroundColor: color + '33',
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: color,
    };
  });

  return {
    type: 'radar',
    title: 'Comparativa de motores (mayor = mejor)',
    labels,
    datasets,
  };
}

/**
 * Sparklines grid: mini-barras por entidad (top 16).
 * Cada chart muestra Dep/Park/Alz para un estado.
 */
function buildSparklineGrid(data, qn) {
  const models = data.prod_models || [];
  if (!models.length) return null;
  const wantAll = qn && /\btodos\b|\btodas\b|cada estado|cada entidad|32 estad|32 entidad|completa|completo/.test(qn);

  const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };
  const pads = ['Depresion', 'Parkinson', 'Alzheimer'];

  // Agregar por entidad (general, sin regiones)
  const byEnt = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    const e = m.entidad || '';
    if (e === 'Nacional' || e.startsWith('region_')) continue;
    if (!byEnt[e]) byEnt[e] = {};
    byEnt[e][m.padecimiento] = m.casos_52_semanas_futuro || 0;
  }

  const sorted = Object.entries(byEnt)
    .map(([ent, d]) => ({ ent, total: pads.reduce((a, p) => a + (d[p] || 0), 0), data: d }))
    .sort((a, b) => b.total - a.total)
    .slice(0, wantAll ? 32 : 16);

  if (!sorted.length) return null;

  return sorted.map(({ ent, data: d }) => ({
    type: 'bar',
    title: ent,
    labels: pads.map(p => p.substring(0, 3)),
    datasets: [{
      data: pads.map(p => d[p] || 0),
      backgroundColor: pads.map(p => padColors[p] + 'CC'),
      borderColor: pads.map(p => padColors[p]),
      borderWidth: 1,
      borderRadius: 4,
    }],
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 9 } } },
        y: { beginAtZero: true, ticks: { font: { size: 8 }, maxTicksLimit: 3 } },
      },
    },
  }));
}

/**
 * Stacked area: 3 padecimientos apilados por semana.
 */
function buildStackedArea(data) {
  const wc = data.weekly_comparison;
  if (!wc) return null;

  const padOrder = ['Depresion', 'Parkinson', 'Alzheimer'];
  const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };

  // Usar semanas del primer padecimiento como referencia
  const refSems = wc[padOrder[0]]?.semanas;
  if (!refSems || !refSems.length) return null;

  const labels = refSems.map(s => `S${String(s.semana).padStart(2, '0')}`);

  const datasets = padOrder.filter(p => wc[p]).map(pad => {
    const sems = wc[pad].semanas || [];
    const color = padColors[pad];
    return {
      label: pad,
      data: sems.map(s => s.pronostico),
      borderColor: color,
      backgroundColor: color + '88',
      fill: true,
      tension: 0.3,
      borderWidth: 1.5,
      pointRadius: 0,
    };
  });

  return {
    type: 'line',
    title: 'Composición semanal: pronóstico apilado por padecimiento',
    labels,
    datasets,
    options: {
      scales: {
        x: { ticks: { maxRotation: 90, font: { size: 9 }, autoSkip: true, maxTicksLimit: 20 } },
        y: {
          stacked: true,
          beginAtZero: true,
          title: { display: true, text: 'Casos', font: { size: 11, family: 'Outfit' }, color: '#7E92B6' },
        },
      },
      plugins: {
        filler: { propagate: true },
      },
    },
  };
}

/**
 * Mapa coropletico de la Republica Mexicana.
 * Retorna un objeto especial { type: 'mexico-map', stateData, opts } que
 * se renderiza con renderMexicoMap() en vez de Chart.js.
 */
function buildMexicoMap(data, qn) {
  const models = data.prod_models || [];
  if (!models.length) return null;

  const q = (qn || '').toLowerCase();
  let mode = 'casos';
  if (q.includes('smape') || q.includes('error') || q.includes('precision')) mode = 'smape';

  // Detectar padecimiento
  const padNames = ['Depresion', 'Parkinson', 'Alzheimer'];
  const padAliases = { depresion: 'Depresion', depression: 'Depresion', f32: 'Depresion',
    parkinson: 'Parkinson', g20: 'Parkinson', alzheimer: 'Alzheimer', g30: 'Alzheimer',
    dengue: 'Dengue', a97: 'Dengue' };
  let filterPad = null;
  for (const [alias, pad] of Object.entries(padAliases)) {
    if (q.includes(alias)) { filterPad = pad; break; }
  }

  // Mapa de Dengue: sus casos por entidad NO viven en prod_models (neuro) sino en
  // data.dengue.por_entidad (total confirmado 2018-2026). Solo aplica al modo 'casos'.
  function buildDengueMap() {
    const pe = data.dengue && data.dengue.por_entidad;
    if (!pe || mode === 'smape') return null;
    // renderMexicoMap empareja por nombre EXACTO del SVG (sin acentos). Los nombres de Dengue
    // traen acentos y 'Estado de Mexico'; normalizamos a las claves del mapa.
    const strip = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const fix = { 'Estado de Mexico': 'Mexico' };
    const stateData = {};
    for (const [ent, c] of Object.entries(pe)) {
      const key = fix[strip(ent)] || strip(ent);
      stateData[key] = { value: c, label: Number(c).toLocaleString() + ' casos (52 sem)' };
    }
    if (!Object.keys(stateData).length) return null;
    return { _mapChart: true, stateData, opts: {
      title: 'Dengue (ambos sexos) - casos 52 sem',
      lowColor: [30, 60, 50], highColor: [244, 114, 182], metric: 'casos' } };
  }

  // Detectar sexo
  const sexoAliases = { hombres: 'hombres', hombre: 'hombres', masculino: 'hombres',
    mujeres: 'mujeres', mujer: 'mujeres', femenino: 'mujeres' };
  let filterSexo = 'general';
  for (const [alias, sexo] of Object.entries(sexoAliases)) {
    if (q.includes(alias)) { filterSexo = sexo; break; }
  }

  const sexoLabel = { general: 'ambos sexos', hombres: 'hombres', mujeres: 'mujeres' };

  // Funcion para construir un mapa individual
  function buildSingleMap(padFilter, sexFilter) {
    const byEnt = {};
    for (const m of models) {
      if (m.sexo !== sexFilter) continue;
      if (padFilter && m.padecimiento !== padFilter) continue;
      const ent = m.entidad;
      if (!ent || ent === 'Nacional' || ent.startsWith('Region') || ent.startsWith('region_')) continue;
      if (!byEnt[ent]) byEnt[ent] = { casos: 0, smapeSum: 0, count: 0 };
      byEnt[ent].casos += (m.casos_52_semanas_futuro || 0);
      byEnt[ent].smapeSum += (m.smape_prod || 0);
      byEnt[ent].count += 1;
    }
    if (!Object.keys(byEnt).length) return null;

    const stateData = {};
    for (const [ent, d] of Object.entries(byEnt)) {
      if (mode === 'smape') {
        const avg = d.count ? (d.smapeSum / d.count) : 0;
        stateData[ent] = { value: Math.round(avg * 10) / 10, label: 'SMAPE prom: ' + avg.toFixed(1) + '%' };
      } else {
        stateData[ent] = { value: d.casos, label: d.casos.toLocaleString() + ' casos (52 sem)' };
      }
    }

    const padLabel = padFilter ? dn(padFilter) : 'todos los padecimientos';
    const sexLabel = sexoLabel[sexFilter] || sexFilter;
    const colorOpts = mode === 'smape'
      ? { lowColor: [91, 141, 239], highColor: [244, 114, 182], metric: 'SMAPE %' }
      : { lowColor: [30, 60, 50], highColor: [91, 141, 239], metric: 'casos' };
    const titleMode = mode === 'smape'
      ? 'SMAPE: ' + padLabel + ' (' + sexLabel + ')'
      : padLabel + ' (' + sexLabel + ') - casos 52 sem';

    return { _mapChart: true, stateData, opts: { title: titleMode, ...colorOpts } };
  }

  // Si hay padecimiento especifico, un solo mapa
  if (filterPad === 'Dengue') {
    return buildDengueMap();
  }
  if (filterPad) {
    return buildSingleMap(filterPad, filterSexo);
  }

  // Sin padecimiento especifico: 3 mapas neuro + Dengue (modo casos), 4 en total.
  const maps = padNames.map(pad => buildSingleMap(pad, filterSexo)).filter(Boolean);
  const dengueMap = buildDengueMap();
  if (dengueMap) maps.push(dengueMap);
  if (maps.length === 1) return maps[0];
  if (maps.length > 1) return maps;
  return null;
}

/**
 * Timelapse: animacion semanal del mapa de Mexico.
 * Distribuye el pronostico por estado proporcionalmente usando el patron nacional semanal.
 */
function buildTimelapse(data) {
  const models = data.prod_models || [];
  const wc = data.weekly_comparison;
  if (!models.length || !wc) return null;

  const pads = Object.keys(wc);

  // National weekly pattern (proportion per week)
  const weeklyTotals = [];
  const nWeeks = wc[pads[0]]?.semanas?.length || 52;
  for (let i = 0; i < nWeeks; i++) {
    let weekSum = 0;
    for (const p of pads) { weekSum += (wc[p]?.semanas?.[i]?.pronostico || 0); }
    weeklyTotals.push(weekSum);
  }
  const natTotal = weeklyTotals.reduce((a, v) => a + v, 0) || 1;
  const weeklyProp = weeklyTotals.map(w => w / natTotal);

  // Per-state totals (sexo=general)
  const byEnt = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    const e = m.entidad;
    if (!e || e === 'Nacional' || e.startsWith('Region') || e.startsWith('region_')) continue;
    byEnt[e] = (byEnt[e] || 0) + (m.casos_52_semanas_futuro || 0);
  }

  // Build cumulative frames
  const frames = [];
  const cumulative = {};
  for (const e of Object.keys(byEnt)) cumulative[e] = 0;

  for (let w = 0; w < nWeeks; w++) {
    const prop = weeklyProp[w] || (1 / nWeeks);
    const stateData = {};
    for (const [ent, total] of Object.entries(byEnt)) {
      cumulative[ent] += Math.round(total * prop);
      stateData[ent] = { value: cumulative[ent], label: cumulative[ent].toLocaleString() + ' casos acum.' };
    }
    frames.push({ week: w + 1, stateData: JSON.parse(JSON.stringify(stateData)) });
  }

  return {
    _timelapseChart: true,
    frames,
    opts: { title: 'Timelapse: pronóstico acumulado por semana', lowColor: [30, 60, 50], highColor: [91, 141, 239], metric: 'casos acum.' },
  };
}

/**
 * Semaforo epidemiologico: grid de 32 estados clasificados por riesgo.
 */
function buildSemaforo(data) {
  const models = data.prod_models || [];
  if (!models.length) return null;

  const wc = data.weekly_comparison || {};
  const byEnt = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    const e = m.entidad || '';
    if (e === 'Nacional' || e.startsWith('region_') || e.startsWith('Region')) continue;
    if (!byEnt[e]) byEnt[e] = { casos: 0, smapes: [], pads: {} };
    byEnt[e].casos += m.casos_52_semanas_futuro || 0;
    if (m.smape_prod != null) byEnt[e].smapes.push(m.smape_prod);
    byEnt[e].pads[m.padecimiento] = (byEnt[e].pads[m.padecimiento] || 0) + (m.casos_52_semanas_futuro || 0);
  }

  const casosArr = Object.values(byEnt).map(e => e.casos).sort((a, b) => a - b);
  const p25 = casosArr[Math.floor(casosArr.length * 0.25)] || 0;
  const p50 = casosArr[Math.floor(casosArr.length * 0.50)] || 0;
  const p75 = casosArr[Math.floor(casosArr.length * 0.75)] || 0;

  function riskLevel(casos) {
    if (casos >= p75) return 'rojo';
    if (casos >= p50) return 'naranja';
    if (casos >= p25) return 'amarillo';
    return 'verde';
  }

  const states = Object.entries(byEnt).map(([name, d]) => {
    const avgSmape = d.smapes.length ? d.smapes.reduce((a, v) => a + v, 0) / d.smapes.length : null;
    return {
      name, casos: d.casos, smape: avgSmape != null ? Math.round(avgSmape * 10) / 10 : null,
      trend: 'stable', pads: d.pads, riskLevel: riskLevel(d.casos),
    };
  });

  // Detect trends from weekly_comparison (very basic: is last week > average?)
  // This is national-level only, but gives a flavor
  for (const st of states) {
    const topPad = Object.entries(st.pads).sort((a, b) => b[1] - a[1])[0];
    if (topPad && wc[topPad[0]]) {
      const sems = wc[topPad[0]].semanas || [];
      const realSems = sems.filter(s => s.real != null);
      if (realSems.length >= 4) {
        const last = realSems[realSems.length - 1].real;
        const avg = realSems.slice(0, -1).reduce((a, s) => a + s.real, 0) / (realSems.length - 1);
        if (last > avg * 1.15) st.trend = 'up';
        else if (last < avg * 0.85) st.trend = 'down';
      }
    }
  }

  const summary = { verde: 0, amarillo: 0, naranja: 0, rojo: 0 };
  states.forEach(s => summary[s.riskLevel]++);

  const alerts = states
    .filter(s => s.riskLevel === 'rojo')
    .sort((a, b) => b.casos - a.casos)
    .slice(0, 5)
    .map(s => {
      const topPad = Object.entries(s.pads).sort((a, b) => b[1] - a[1])[0];
      return s.name + ': ' + s.casos.toLocaleString() + ' casos (principal: ' + (topPad ? topPad[0] : '?') + ')';
    });

  return {
    _semaforoChart: true,
    semaforoData: { states, alerts, summary },
    opts: { title: 'Semáforo epidemiológico: riesgo por entidad federativa' },
  };
}

/**
 * Comparador de estados: datos para renderizar side-by-side.
 * Se construye a partir de los datos embebidos en <!--COMPARE:...-->
 */
function buildComparador(data, compareData) {
  if (!compareData || compareData.length !== 2) return null;
  const [a, b] = compareData;

  function buildState(c) {
    const smapes = c.models.filter(m => m.smape != null).map(m => m.smape);
    const avgSmape = smapes.length ? Math.round(smapes.reduce((a, v) => a + v, 0) / smapes.length * 10) / 10 : null;
    const motors = {};
    c.models.forEach(m => { const mot = m.motor || m.modelo || '?'; motors[mot] = (motors[mot] || 0) + 1; });
    const topMotor = Object.entries(motors).sort((a, b) => b[1] - a[1])[0];
    const pads = {};
    c.models.forEach(m => {
      if (!pads[m.pad]) pads[m.pad] = { casos: 0, smape: null, motor: '?' };
      pads[m.pad].casos += m.casos || 0;
      if (m.smape != null) pads[m.pad].smape = m.smape;
    });
    return { name: c.estado, casos: c.total, smape: avgSmape, motor: topMotor ? topMotor[0] : '?', pads };
  }

  const stateA = buildState(a);
  const stateB = buildState(b);
  const winner = stateA.casos > stateB.casos ? 'A' : stateA.casos < stateB.casos ? 'B' : 'tie';

  return {
    _comparadorChart: true,
    comparadorData: { stateA, stateB, winner },
    opts: { title: 'Comparativa: ' + stateA.name + ' vs ' + stateB.name },
  };
}

/**
 * PDF Report: returns a special flag to trigger report generation.
 */
function buildPDFReport(data) {
  return { _pdfReport: true, data };
}

/**
 * Heatmap de error semanal: matriz padecimiento x semanas.
 * Usa barras coloreadas por intensidad de error.
 */
function buildErrorHeatmap(data, qn) {
  const wc = data.weekly_comparison;
  if (!wc) return null;

  const pads = Object.keys(wc);
  const filtered = pads.filter(pad => {
    if (!qn) return true;
    const pn = pad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const inQ = qn.includes(pn);
    return inQ || !pads.some(p => qn.includes(p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  });

  // Solo semanas con datos reales
  const refPad = wc[filtered[0] || pads[0]];
  const realWeeks = (refPad?.semanas || []).filter(s => s.real != null);
  if (!realWeeks.length) return null;

  const labels = realWeeks.map(s => `S${String(s.semana).padStart(2, '0')}`);
  const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };

  const datasets = [];
  for (const pad of filtered) {
    const sems = (wc[pad]?.semanas || []).filter(s => s.real != null);
    const errors = sems.map(s => {
      if (s.real === 0) return s.pronostico > 0 ? 100 : 0;
      return Math.abs(((s.pronostico - s.real) / s.real) * 100);
    });
    const color = padColors[pad] || '#5B8DEF';
    // Color del padecimiento, opacidad segun error: alta (>40%), media (15-40%), baja (<15%)
    const bgColors = errors.map(e => {
      if (e > 40) return color + 'FF';  // solido = error alto
      if (e > 15) return color + '99';  // semi = error medio
      return color + '55';              // tenue = error bajo (bueno)
    });
    datasets.push({
      label: pad,
      data: errors.map(e => Math.round(e * 10) / 10),
      backgroundColor: bgColors,
      borderColor: color,
      borderWidth: 1.5,
      borderRadius: 3,
    });
  }

  return {
    type: 'bar',
    title: 'Error semanal (% |real - pronóstico| / real)',
    labels,
    datasets,
    options: {
      scales: {
        x: { ticks: { font: { size: 10 } } },
        y: { beginAtZero: true, title: { display: true, text: 'Error %', font: { size: 11, family: 'Outfit' }, color: '#7E92B6' } },
      },
    },
  };
}

/**
 * Genera graficos de zoom semanal (2025-2027): real vs pronostico.
 * Devuelve un array de charts (1 por padecimiento filtrado).
 */
function zoomIsoWeekApp(iso) {
  const dt = new Date(iso + 'T00:00:00'); dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
  const w1 = new Date(dt.getFullYear(), 0, 4);
  return 1 + Math.round(((dt - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

// Chart de zoom para UNA serie (estado × sexo) desde data.zoom_series: real vs pronostico
// solapados hasta la semana vigente + pronostico al futuro.
function buildSeriesZoom(s, pad, estado, sexo) {
  const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };
  const color = padColors[pad] || '#5B8DEF';
  const estadoLbl = norm(estado) === 'mexico' ? 'Estado de México' : dn(estado);
  const sexoLbl = sexo === 'general' ? 'ambos sexos' : sexo;
  const labels = s.d.map(iso => { const p = iso.split('-'); return `${p[1]}/${p[2].slice(0, 2)} ${p[0].slice(2)}`; });
  const lastRealIdx = s.r.reduce((acc, v, i) => (v != null ? i : acc), -1);
  const wk = s.last_real ? zoomIsoWeekApp(s.last_real) : null;
  const hasBand = Array.isArray(s.hi) && s.hi.some(v => v != null);
  const datasets = [];
  if (hasBand) {
    // Banda de confianza: dataset superior rellena hacia el inferior (_lo). Ambos ocultos
    // de leyenda/tooltip (prefijo '_'); muestran la incertidumbre del motor productivo.
    datasets.push(
      { label: '_hi', data: s.hi, borderColor: 'transparent', backgroundColor: color + '22', pointRadius: 0, fill: '+1', tension: 0.3, order: 4 },
      { label: '_lo', data: s.lo, borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0, fill: false, tension: 0.3, order: 4 },
    );
  }
  datasets.push(
    {
      label: `Pronóstico (${s.motor || pad})`, data: s.y,
      borderColor: color + 'CC', backgroundColor: 'transparent', fill: false, tension: 0.3,
      borderWidth: 2, borderDash: [8, 5], pointRadius: 0, order: 2,
    },
    {
      label: 'Real', data: s.r,
      borderColor: color, backgroundColor: color + '22', fill: false, tension: 0.3,
      borderWidth: 3, spanGaps: false, order: 1,
      pointRadius: s.r.map((v, i) => (i === lastRealIdx ? 6 : v != null ? 2.5 : 0)),
      pointBackgroundColor: s.r.map((v, i) => (i === lastRealIdx ? '#fff' : color)),
      pointBorderColor: color, pointBorderWidth: s.r.map((v, i) => (i === lastRealIdx ? 3 : 1)),
    },
  );
  return {
    type: 'line',
    title: `${dn(pad)} — ${estadoLbl} (${sexoLbl})  ·  real vs pronóstico${wk != null ? ' (sem ' + wk + ')' : ''}`,
    labels, datasets,
    options: { scales: { x: { ticks: { maxRotation: 90, font: { size: 9 }, autoSkip: true, maxTicksLimit: 18 } }, y: { beginAtZero: true } } },
  };
}

function buildZoomChart(data, qn, ent) {
  const padResolved = ent && ent.padecimiento;
  // Si hay estado detectado y el indice por serie ya cargo: zoom especifico estado×sexo.
  if (ent && ent.estado && padResolved && data.zoom_series) {
    const sexo = ent.sexo || 'general';
    const serie = data.zoom_series[`${norm(padResolved)}|${norm(ent.estado)}|${sexo}`];
    if (serie && serie.d && serie.d.length) return buildSeriesZoom(serie, padResolved, ent.estado, sexo);
  }
  const wc = data.weekly_comparison;
  if (!wc) return null;

  const pads = Object.keys(wc);
  // Si el detector de entidades resolvio UN padecimiento (incluye typos/fuzzy),
  // ese manda: el grafico debe coincidir con el texto (answerZoom filtra por
  // ent.padecimiento). Solo si no se resolvio ninguno caemos al match por query.
  let filtered;
  if (padResolved && pads.includes(padResolved)) {
    filtered = [padResolved];
  } else {
    filtered = pads.filter(pad => {
      if (!qn) return true;
      const pn = pad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const inQ = qn.includes(pn);
      return inQ || !pads.some(p => qn.includes(p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
    });
  }
  if (!filtered.length) return null;

  const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };
  const charts = [];

  for (const pad of filtered) {
    const info = wc[pad];
    const sems = info.semanas || [];
    if (!sems.length) continue;

    const labels = sems.map(s => {
      if (s.fecha) {
        const parts = s.fecha.split('-');
        return `${parts[1]}/${parts[2]}`;
      }
      return `S${String(s.semana).padStart(2, '0')}`;
    });

    const realData = sems.map(s => s.real != null ? s.real : null);
    const pronData = sems.map(s => s.pronostico);
    const lastRealIdx = realData.reduce((acc, v, i) => v != null ? i : acc, -1);
    const color = padColors[pad] || '#5B8DEF';

    // Pronostico: linea punteada completa
    const datasets = [
      {
        label: 'Pronóstico (' + (info.modelo_productivo || pad) + ')',
        data: pronData,
        borderColor: color + '88',
        backgroundColor: color + '0A',
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        borderDash: [8, 5],
        pointRadius: 0,
        order: 2,
      },
      {
        label: 'Real',
        data: realData,
        borderColor: color,
        backgroundColor: color + '22',
        fill: false,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: realData.map((v, i) => i === lastRealIdx ? 6 : v != null ? 3 : 0),
        pointBackgroundColor: realData.map((v, i) => i === lastRealIdx ? '#fff' : color),
        pointBorderColor: color,
        pointBorderWidth: realData.map((v, i) => i === lastRealIdx ? 3 : 1),
        spanGaps: false,
        order: 1,
      },
    ];

    charts.push({
      type: 'line',
      title: `${dn(pad)} — zoom semanal (${sems[0].fecha || ''} a ${sems[sems.length - 1].fecha || ''})`,
      labels,
      datasets,
      options: {
        scales: {
          x: { ticks: { maxRotation: 90, font: { size: 9 }, autoSkip: true, maxTicksLimit: 20 } },
          y: { beginAtZero: true },
        },
      },
    });
  }

  if (!charts.length) return null;
  return charts.length === 1 ? charts[0] : charts;
}

function buildTrendChart(data, qn) {
  // Estado-aware: si la consulta menciona un estado con histórico propio, usa
  // sus datos (anual_por_estado_pad); si no, el nacional (anual_por_pad).
  const perState = data.boletin?.anual_por_estado_pad || {};
  let estadoKey = null;
  if (qn) {
    const knorm = (k) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const k of Object.keys(perState)) { if (qn.includes(knorm(k))) { estadoKey = k; break; } }
    if (!estadoKey && /\bcdmx\b/.test(qn) && perState['Ciudad de Mexico']) estadoKey = 'Ciudad de Mexico';
  }
  const anual = estadoKey ? perState[estadoKey] : data.boletin?.anual_por_pad;
  if (!anual) return null;
  const estadoLabel = estadoKey ? dn(estadoKey) : null;

  const wc = data.weekly_comparison || {};
  const pads = Object.keys(anual);
  let allYears = new Set();
  pads.forEach(pad => Object.keys(anual[pad]).forEach(y => allYears.add(y)));
  allYears = [...allYears].sort();

  // Proyección 2026 solo a nivel nacional (no hay weekly_comparison por estado)
  const projected2026 = {};
  if (!estadoKey) for (const pad of pads) {
    const info = wc[pad];
    if (info && info.semanas) {
      const realSum = info.semanas.filter(s => s.real != null).reduce((a, s) => a + s.real, 0);
      const pronRest = info.semanas.filter(s => s.real == null).reduce((a, s) => a + s.pronostico, 0);
      projected2026[pad] = realSum + pronRest;
    }
  }

  // Filtrar pads segun query
  const filteredPads = pads.filter((pad, i) => {
    if (!qn) return true;
    const padNorm = pad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const padInQuery = qn.includes(padNorm);
    return padInQuery || !pads.some(p => qn.includes(p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  });

  if (!filteredPads.length) return null;

  const lastYear = allYears[allYears.length - 1];
  const hasProjection = Object.keys(projected2026).length > 0 && lastYear === '2026';

  // Semanas reales disponibles en 2026
  const semsReales = Object.values(wc)[0]?.semanas?.filter(s => s.real != null).length || 0;

  // Labels: 2014...2025, "2026 (proy.)", "Ene 2027"
  const yearsComplete = hasProjection ? allYears.slice(0, -1) : [...allYears];
  const labels = hasProjection
    ? [...yearsComplete, `2026 (vamos S${String(semsReales).padStart(2,'0')})`, 'Ene 2027']
    : [...allYears];
  const iProj26 = yearsComplete.length;     // "2026 (vamos S08)"
  const iEnd27  = yearsComplete.length + 1; // "Ene 2027"
  const nLabels = labels.length;

  const datasets = [];
  filteredPads.forEach((pad, idx) => {
    const i = pads.indexOf(pad);
    const color = CHART_COLORS[i];
    const padData = anual[pad];

    if (hasProjection) {
      const proj2026 = projected2026[pad] || 0;
      const last2025Val = padData[yearsComplete[yearsComplete.length - 1]] || 0;

      // Dataset 1: linea solida "Real" — 2014 a 2025
      const solidData = new Array(nLabels).fill(null);
      yearsComplete.forEach((y, j) => { solidData[j] = padData[y] || 0; });

      datasets.push({
        label: dn(pad) + ' (real)',
        data: solidData,
        borderColor: color,
        backgroundColor: color + '22',
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: color,
        spanGaps: false,
      });

      // Dataset 2: linea punteada "Pronostico" — continua desde 2025
      const dashedData = new Array(nLabels).fill(null);
      dashedData[yearsComplete.length - 1] = last2025Val; // empalma con 2025
      dashedData[iProj26] = proj2026;
      dashedData[iEnd27] = proj2026;

      datasets.push({
        label: dn(pad) + ' (pronóstico)',
        data: dashedData,
        borderColor: color,
        backgroundColor: color + '0A',
        fill: '-1',
        tension: 0.3,
        borderWidth: 3,
        borderDash: [10, 6],
        pointRadius: dashedData.map((v, j) => {
          if (j === iProj26) return 6;
          if (j === iEnd27) return 5;
          return 0;
        }),
        pointBackgroundColor: color + '88',
        pointBorderColor: color,
        pointBorderWidth: 2,
        spanGaps: true,
      });
    } else {
      datasets.push({
        label: pad,
        data: allYears.map(y => padData[y] || 0),
        borderColor: color,
        backgroundColor: color + '22',
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: color,
      });
    }
  });

  return { type: 'line', title: `Evolución histórica de incidencia${estadoLabel ? ' — ' + estadoLabel : ''}`, labels, datasets };
}

/**
 * Matriz de rendimiento (bubble): precisión histórica (x) vs SMAPE (y) vs
 * volumen de casos (tamaño), coloreado por padecimiento. Revela el balance
 * entre acierto y error de cada modelo estatal.
 */
function buildPerformanceMatrix(data) {
  const models = data.prod_models || [];
  if (!models.length) return null;
  const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };
  const isState = (m) => {
    const e = m.entidad || '';
    return e && e !== 'Nacional' && !e.startsWith('Region') && !e.startsWith('region_');
  };
  const parsePct = (v) => {
    if (v == null) return null;
    const n = parseFloat(String(v).replace('%', ''));
    return isFinite(n) ? n : null;
  };

  const byPad = {};
  let maxCasos = 0;
  for (const m of models) {
    if (m.sexo !== 'general' || !isState(m)) continue;
    if (m.smape_prod == null) continue;
    const prec = parsePct(m.precision_historica);
    if (prec == null) continue;
    const casos = m.casos_52_semanas_futuro || 0;
    maxCasos = Math.max(maxCasos, casos);
    (byPad[m.padecimiento] = byPad[m.padecimiento] || []).push({ prec, smape: m.smape_prod, casos, ent: m.entidad });
  }

  const pads = Object.keys(byPad);
  if (!pads.length) return null;

  const datasets = pads.map(pad => ({
    label: dn(pad),
    data: byPad[pad].map(p => ({
      x: p.prec,
      y: p.smape,
      r: 5 + 16 * Math.sqrt(p.casos / (maxCasos || 1)),
      label: dn(p.ent),
      casos: p.casos,
    })),
    backgroundColor: (padColors[pad] || '#5B8DEF') + 'B0',
    borderColor: padColors[pad] || '#5B8DEF',
    borderWidth: 1.5,
    hoverBorderWidth: 2.5,
  }));

  return {
    type: 'bubble',
    title: 'Matriz de rendimiento — precisión vs error vs volumen',
    datasets,
    options: {
      scales: {
        x: { title: { display: true, text: 'Precisión histórica (%)' }, min: 0, max: 100, grid: { color: 'rgba(91, 141, 239, 0.08)' } },
        y: { title: { display: true, text: 'SMAPE (%) — menor es mejor' }, beginAtZero: true },
      },
    },
  };
}

/**
 * Arsenal de modelos (polarArea): distribución de los 333 modelos de
 * producción por motor ganador, en formato radial.
 */
function buildMotorPolar(data) {
  const dm = (data.stats || {}).dist_motor;
  if (!dm || !Object.keys(dm).length) return null;
  const labels = Object.keys(dm);
  const total = Object.values(dm).reduce((a, b) => a + b, 0);
  const colorMap = { Prophet: '#5B8DEF', DeepAR: '#3B9AE8', Ensemble: '#2DD4BF', Stacking: '#F472B6' };
  return {
    type: 'polarArea',
    title: `Arsenal de modelos — ${total} en producción por motor`,
    labels,
    datasets: [{
      data: Object.values(dm),
      backgroundColor: labels.map(l => (colorMap[l] || '#A78BFA') + 'C0'),
      borderColor: labels.map(l => colorMap[l] || '#A78BFA'),
      borderWidth: 1.5,
    }],
  };
}

/**
 * Composición de motores por padecimiento (barras apiladas): cuántos modelos
 * de cada motor se eligieron en cada enfermedad.
 */
function buildMotorByPad(data) {
  const pp = (data.stats || {}).por_pad;
  if (!pp || !Object.keys(pp).length) return null;
  const pads = Object.keys(pp);
  const motors = ['Prophet', 'DeepAR', 'Ensemble', 'Stacking'];
  const colorMap = { Prophet: '#5B8DEF', DeepAR: '#3B9AE8', Ensemble: '#2DD4BF', Stacking: '#F472B6' };
  const datasets = motors.map(mt => ({
    label: mt,
    data: pads.map(p => (pp[p].dist_motor || {})[mt] || 0),
    backgroundColor: colorMap[mt],
    stack: 'motores',
    borderRadius: 4,
    maxBarThickness: 90,
  }));
  return {
    type: 'bar',
    title: 'Composición de motores por padecimiento',
    labels: pads.map(dn),
    datasets,
    options: {
      scales: {
        x: { stacked: true },
        y: { stacked: true, title: { display: true, text: 'Modelos' } },
      },
    },
  };
}

/**
 * Mejores y peores modelos por SMAPE (barras horizontales divergentes):
 * top y bottom combinados, verde para aciertos, guinda para errores.
 */
function buildBestWorst(data) {
  const s = data.stats || {};
  const top = s.top5_smape || [];
  const bot = s.bottom5_smape || [];
  if (!top.length && !bot.length) return null;
  const best = top.slice(0, 6);
  const worst = bot.slice(0, 6);
  const rows = [
    ...best.map(r => ({ ...r, kind: 'best' })),
    ...worst.map(r => ({ ...r, kind: 'worst' })),
  ];
  const labels = rows.map(r => `${dn(r.entidad)} · ${dn(r.padecimiento)} (${r.sexo})`);
  const colors = rows.map(r => r.kind === 'best' ? '#5B8DEF' : '#F472B6');
  return {
    type: 'bar',
    horizontal: true,
    title: 'Mejores y peores modelos por SMAPE (%)',
    labels,
    datasets: [{
      label: 'SMAPE (%)',
      data: rows.map(r => r.smape),
      backgroundColor: colors,
      borderColor: colors,
      borderWidth: 1,
      borderRadius: 6,
      maxBarThickness: 26,
    }],
  };
}

/**
 * Volumen vs error (combo doble eje): top 10 estados por casos (barras) con su
 * SMAPE promedio superpuesto como línea en eje secundario.
 */
function buildVolumeError(data) {
  const models = data.prod_models || [];
  if (!models.length) return null;
  const byEnt = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    const e = m.entidad || '';
    if (e === 'Nacional' || e.startsWith('Region') || e.startsWith('region_')) continue;
    if (!byEnt[e]) byEnt[e] = { casos: 0, smapes: [] };
    byEnt[e].casos += m.casos_52_semanas_futuro || 0;
    if (m.smape_prod != null) byEnt[e].smapes.push(m.smape_prod);
  }
  const entries = Object.entries(byEnt)
    .map(([name, o]) => ({ name, casos: o.casos, smape: o.smapes.length ? o.smapes.reduce((a, v) => a + v, 0) / o.smapes.length : null }))
    .sort((a, b) => b.casos - a.casos).slice(0, 10);
  if (!entries.length) return null;
  return {
    type: 'bar',
    title: 'Top 10 estados — volumen vs error (SMAPE)',
    labels: entries.map(e => dn(e.name)),
    datasets: [
      { label: 'Casos (52 sem)', data: entries.map(e => e.casos), backgroundColor: '#5B8DEF', yAxisID: 'y', order: 2 },
      { label: 'SMAPE (%)', type: 'line', data: entries.map(e => e.smape != null ? +e.smape.toFixed(1) : null), borderColor: '#2DD4BF', backgroundColor: 'transparent', yAxisID: 'y1', order: 1, fill: false, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#2DD4BF', borderWidth: 2.5 },
    ],
    options: {
      scales: {
        y: { title: { display: true, text: 'Casos' }, position: 'left' },
        y1: { title: { display: true, text: 'SMAPE (%)' }, position: 'right', grid: { display: false }, ticks: { callback: (v) => v + '%' } },
        x: { ticks: { maxRotation: 45, minRotation: 30, font: { size: 10 } } },
      },
    },
  };
}

/**
 * Calibración (scatter): pronóstico vs realidad de la última semana por modelo,
 * coloreado por padecimiento, con línea de predicción perfecta (y = x).
 */
function buildCalibration(data) {
  const models = data.prod_models || [];
  if (!models.length) return null;
  const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };
  const byPad = {};
  let maxV = 0;
  for (const m of models) {
    if (m.pron_sem_previa == null || m.realidad_sem_previa == null) continue;
    const x = m.pron_sem_previa, y = m.realidad_sem_previa;
    maxV = Math.max(maxV, x, y);
    (byPad[m.padecimiento] = byPad[m.padecimiento] || []).push({ x, y, label: `${dn(m.entidad)} · ${m.sexo}` });
  }
  const pads = Object.keys(byPad);
  if (!pads.length) return null;
  const lim = Math.max(5, Math.ceil(maxV * 1.05));
  const datasets = pads.map(pad => ({
    label: dn(pad),
    type: 'scatter',
    data: byPad[pad],
    backgroundColor: (padColors[pad] || '#5B8DEF') + 'C0',
    borderColor: padColors[pad] || '#5B8DEF',
    pointRadius: 4,
    pointHoverRadius: 7,
  }));
  datasets.push({
    label: 'Predicción perfecta',
    type: 'line',
    data: [{ x: 0, y: 0 }, { x: lim, y: lim }],
    borderColor: 'rgba(226, 232, 245, 0.5)',
    borderDash: [6, 6],
    borderWidth: 1.5,
    pointRadius: 0,
    showLine: true,
    fill: false,
  });
  return {
    type: 'scatter',
    title: 'Calibración — pronóstico vs realidad (última semana)',
    datasets,
    options: {
      scales: {
        x: { title: { display: true, text: 'Pronosticado' }, min: 0, max: lim },
        y: { title: { display: true, text: 'Real' }, min: 0, max: lim },
      },
    },
  };
}

/**
 * MASE mediano por motor (barras horizontales): valores < 1 (verde) superan al
 * modelo ingenuo; >= 1 (guinda) no lo logran.
 */
function buildMaseByMotor(data) {
  const pm = (data.stats || {}).por_motor;
  if (!pm || !Object.keys(pm).length) return null;
  const motors = Object.keys(pm);
  const vals = motors.map(m => pm[m].mase_median != null ? pm[m].mase_median : pm[m].mase_mean);
  const colors = vals.map(v => v < 1 ? '#5B8DEF' : '#F472B6');
  return {
    type: 'bar',
    horizontal: true,
    title: 'MASE mediano por motor — < 1 supera al modelo ingenuo',
    labels: motors,
    datasets: [{
      label: 'MASE',
      data: vals,
      backgroundColor: colors,
      borderColor: colors,
      borderWidth: 1,
      borderRadius: 6,
      maxBarThickness: 34,
    }],
    options: { scales: { x: { title: { display: true, text: 'MASE (menor es mejor)' }, suggestedMax: 1.1 } } },
  };
}

/**
 * Pronóstico nacional acumulado (área): suma acumulada semana a semana de los
 * 3 padecimientos a lo largo del horizonte de 52 semanas.
 */
function buildCumulative(data) {
  const wc = data.weekly_comparison;
  if (!wc) return null;
  const pads = Object.keys(wc);
  if (!pads.length) return null;
  const nSem = (wc[pads[0]].semanas || []).length;
  if (!nSem) return null;
  const labels = [], cum = [];
  let acc = 0;
  for (let i = 0; i < nSem; i++) {
    let wk = 0;
    for (const p of pads) {
      const sem = (wc[p].semanas || [])[i];
      if (sem) wk += sem.pronostico || 0;
    }
    acc += wk;
    cum.push(acc);
    const sObj = (wc[pads[0]].semanas || [])[i];
    labels.push('S' + String(sObj ? sObj.semana : i + 1).padStart(2, '0'));
  }
  return {
    type: 'line',
    title: 'Pronóstico nacional acumulado (52 semanas)',
    labels,
    datasets: [{
      label: 'Casos acumulados',
      data: cum,
      borderColor: '#5B8DEF',
      backgroundColor: '#5B8DEF',
      fill: true,
      tension: 0.25,
      pointRadius: 0,
      borderWidth: 3,
    }],
    options: {
      scales: {
        x: { ticks: { maxRotation: 90, autoSkip: true, maxTicksLimit: 18, font: { size: 9 } } },
        y: { title: { display: true, text: 'Casos acumulados' } },
      },
    },
  };
}

/**
 * Salud de los modelos (barras apiladas horizontales): conteo de modelos por
 * estado de overfitting y de fuga de datos (leakage).
 */
function buildModelHealth(data) {
  const s = data.stats || {};
  if (s.overfitting_ok == null && s.leakage_ok == null) return null;
  return {
    type: 'bar',
    horizontal: true,
    title: 'Salud de los modelos — overfitting y fuga de datos',
    labels: ['Overfitting', 'Fuga de datos'],
    datasets: [
      { label: 'OK', data: [s.overfitting_ok || 0, s.leakage_ok || 0], backgroundColor: '#5B8DEF', stack: 'h', borderRadius: 4 },
      { label: 'Moderado', data: [s.overfitting_moderado || 0, 0], backgroundColor: '#2DD4BF', stack: 'h', borderRadius: 4 },
      { label: 'Alto / Sospechoso', data: [s.overfitting_alto || 0, s.leakage_sospechoso || 0], backgroundColor: '#F472B6', stack: 'h', borderRadius: 4 },
      { label: 'N/D', data: [s.overfitting_nd || 0, 0], backgroundColor: '#6E82A6', stack: 'h', borderRadius: 4 },
    ],
    options: {
      scales: {
        x: { stacked: true, title: { display: true, text: 'Modelos' } },
        y: { stacked: true },
      },
    },
  };
}

/**
 * Medidor (gauge semicircular): % de modelos sanos (sin overfitting).
 */
function buildQualityGauge(data) {
  const s = data.stats || {};
  const total = s.total_modelos || 333;
  const ok = s.overfitting_ok != null ? s.overfitting_ok : total;
  const pct = total ? Math.round(ok / total * 100) : 0;
  return {
    type: 'doughnut',
    title: 'Salud global de los modelos (sin overfitting)',
    labels: ['Sanos', 'Con observaciones'],
    datasets: [{
      data: [ok, Math.max(0, total - ok)],
      backgroundColor: ['#5B8DEF', 'rgba(159, 176, 206, 0.10)'],
      borderColor: 'transparent',
      borderWidth: 0,
      _centerText: pct + '%',
      _centerSub: `${ok} de ${total} sanos`,
    }],
    options: { circumference: 180, rotation: -90, cutout: '72%' },
  };
}

/**
 * Rango de SMAPE por padecimiento (caja intercuartil p25–p75, barras flotantes).
 */
function buildSmapeBox(data) {
  const models = data.prod_models || [];
  if (!models.length) return null;
  const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };
  const byPad = {};
  for (const m of models) {
    if (m.sexo !== 'general' || m.smape_prod == null) continue;
    (byPad[m.padecimiento] = byPad[m.padecimiento] || []).push(m.smape_prod);
  }
  const pads = Object.keys(byPad);
  if (!pads.length) return null;
  const quant = (arr, p) => { const a = [...arr].sort((x, y) => x - y); const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
  const rows = pads.map(p => {
    const a = byPad[p];
    return { p, min: Math.min(...a), p25: quant(a, 0.25), med: quant(a, 0.5), p75: quant(a, 0.75), max: Math.max(...a) };
  });
  const maxAll = Math.max(...rows.map(r => r.max));
  return {
    type: 'bar',
    horizontal: true,
    title: 'Distribución de SMAPE por padecimiento (caja y bigotes)',
    labels: pads.map(dn),
    datasets: [{
      label: 'SMAPE: caja p25–p75, bigotes mín–máx, línea = mediana',
      data: rows.map(r => [r.p25, r.p75]),
      backgroundColor: pads.map(p => (padColors[p] || '#5B8DEF') + 'D0'),
      borderColor: pads.map(p => padColors[p] || '#5B8DEF'),
      borderWidth: 1,
      borderRadius: 4,
      maxBarThickness: 30,
      _box: rows.map(r => ({ min: r.min, p25: r.p25, med: r.med, p75: r.p75, max: r.max })),
    }],
    options: { scales: { x: { title: { display: true, text: 'SMAPE (%)' }, beginAtZero: true, suggestedMax: Math.ceil(maxAll * 1.05) } } },
  };
}

/**
 * Cascada (waterfall): aporte acumulado de cada padecimiento al total nacional.
 */
function buildWaterfall(data) {
  const models = data.prod_models || [];
  if (!models.length) return null;
  const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };
  const byPad = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    const e = m.entidad || '';
    if (e === 'Nacional' || e.startsWith('Region') || e.startsWith('region_')) continue;
    byPad[m.padecimiento] = (byPad[m.padecimiento] || 0) + (m.casos_52_semanas_futuro || 0);
  }
  const pads = Object.keys(byPad);
  if (!pads.length) return null;
  let run = 0;
  const labels = [], dataPairs = [], colors = [];
  for (const p of pads) { const v = byPad[p]; dataPairs.push([run, run + v]); colors.push(padColors[p] || '#5B8DEF'); labels.push(dn(p)); run += v; }
  labels.push('Total nacional'); dataPairs.push([0, run]); colors.push('#A78BFA');
  return {
    type: 'bar',
    title: 'Aporte acumulado al total nacional (pronóstico 52 sem)',
    labels,
    datasets: [{
      label: 'Casos',
      data: dataPairs,
      backgroundColor: colors,
      borderColor: colors,
      borderWidth: 1,
      borderRadius: 5,
      maxBarThickness: 80,
    }],
    options: { scales: { y: { title: { display: true, text: 'Casos acumulados' }, beginAtZero: true } } },
  };
}

// Evolución histórica anual de Dengue (chart interactivo, equivalente a la tendencia neuro).
// Datos: data.dengue.anual (2014-2026). Años de gran brote (El Niño) resaltados en rosa.
function buildDengueAnual(data) {
  const anual = data.dengue && data.dengue.anual;
  if (!anual) return null;
  const years = Object.keys(anual).sort();
  if (!years.length) return null;
  const peak = new Set(['2014', '2019', '2024']);
  const colors = years.map((y) => (peak.has(y) ? '#F472B6' : '#2DD4BF'));
  return {
    type: 'bar',
    title: 'Dengue confirmado por año en México (2014-2026)',
    labels: years,
    datasets: [{
      label: 'Casos confirmados en el año',
      data: years.map((y) => anual[y]),
      backgroundColor: colors,
      borderColor: colors,
      borderRadius: 5,
      maxBarThickness: 64,
    }],
    options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Casos confirmados' } } } },
  };
}

function extractChartData(markdown, query) {
  const data = getData();
  if (!data) return null;
  // Si la respuesta YA incrusta una imagen propia (p.ej. la grafica de pronostico de Dengue
  // al ritmo de El Nino), no generamos ademas un canvas: seria un grafico extra irrelevante.
  if (/!\[[^\]]*\]\([^)]+\.png/i.test(markdown)) return null;
  const s = data.stats || {};
  const qn = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Dengue NO vive en prod_models/stats (esos son neuro: 333 modelos). Casi todo canvas
  // generico saldria con datos neuro. Excepciones con datos de Dengue: el zoom semanal
  // (weekly_comparison) y la evolucion historica anual (dengue.anual). El resto, sin canvas.
  if (detectEntities(query).padecimiento === 'Dengue' && !qn.includes('zoom')) {
    const evolKw = ['evolucion', 'historic', 'tendencia', 'anual', 'ciclo', 'ola',
      'pico', 'brote', 'epidemia', 'por ano', 'por anio', 'caso', 'cuanto'];
    if (evolKw.some((k) => qn.includes(k))) {
      const ch = buildDengueAnual(data);
      if (ch) return ch;
    }
    return null;
  }

  // Comparacion semanal Real vs Pronostico (embedded from answerComparacionSemanal)
  // Collect ALL weekly matches (one per padecimiento) and return as array
  const weeklyMatches = [...markdown.matchAll(/<!--WEEKLY:(.*?)-->/g)];
  if (weeklyMatches.length) {
    const charts = [];
    for (const match of weeklyMatches) {
      try {
        const wk = JSON.parse(match[1]);
        const semanas = wk.semanas || [];
        const labels = semanas.map(w => `Sem ${w.s}`);
        const realData = semanas.map(w => w.r);
        const pronData = semanas.map(w => w.p);
        charts.push({
          type: 'bar',
          title: `${dn(wk.pad)} ${wk.anio}: Real vs Pronóstico`,
          labels,
          datasets: [
            {
              label: 'Real',
              data: realData,
              backgroundColor: '#5B8DEFCC',
              borderColor: '#5B8DEF',
              borderWidth: 2,
              borderRadius: 4,
              order: 1,
            },
            {
              label: `Pronóstico (${wk.modelo})`,
              data: pronData,
              backgroundColor: '#2DD4BFCC',
              borderColor: '#2DD4BF',
              borderWidth: 2,
              borderRadius: 4,
              order: 2,
            },
          ],
        });
      } catch (e) { console.warn('Weekly parse error:', e); }
    }
    if (charts.length === 1) return charts[0];
    if (charts.length > 1) return charts;
  }

  // Distribucion de metricas (embedded from answerDistribucion)
  const distribMatch = markdown.match(/<!--DISTRIB:(.*?)-->/);
  if (distribMatch) {
    try {
      const dist = JSON.parse(distribMatch[1]);
      const datasets = (dist.datasets || []).map((ds, i) => ({
        label: dn(ds.pad),
        data: ds.counts,
        backgroundColor: CHART_COLORS[i] + '99',
        borderColor: CHART_COLORS[i],
        borderWidth: 2,
        borderRadius: 3,
      }));
      return {
        type: 'bar',
        title: `Distribución de ${dist.metric} por padecimiento`,
        labels: dist.bins,
        datasets,
        options: {
          scales: {
            x: { title: { display: true, text: dist.metric } },
            y: { title: { display: true, text: 'Modelos' } },
          },
        },
      };
    } catch (e) { console.warn('Distrib parse error:', e); }
  }

  // Grafico generico embebido (from answerGraficoAleatorio)
  const genChartMatch = markdown.match(/<!--GENCHART:(.*?)-->/);
  if (genChartMatch) {
    try {
      return JSON.parse(genChartMatch[1]);
    } catch (e) { console.warn('GenChart parse error:', e); }
  }

  // Comparativa de estados (embedded data from handler)
  const compareMatch = markdown.match(/<!--COMPARE:(.*?)-->/);
  if (compareMatch) {
    try {
      const cmp = JSON.parse(compareMatch[1]);
      // 2 estados: usar comparador visual interactivo
      if (cmp.length === 2) {
        const comp = buildComparador(data, cmp);
        if (comp) return comp;
      }
      if (cmp.length >= 2) {
        const pads = [...new Set(cmp.flatMap(c => c.models.map(m => m.pad)))];
        return {
          type: 'bar',
          title: 'Comparativa: ' + cmp.map(c => c.estado).join(' vs '),
          labels: cmp.map(c => c.estado),
          datasets: pads.map((pad, i) => ({
            label: dn(pad),
            data: cmp.map(c => { const m = c.models.find(x => x.pad === pad); return m ? m.casos : 0; }),
            backgroundColor: CHART_COLORS[i] + 'CC',
            borderColor: CHART_COLORS[i],
            borderWidth: 1,
            borderRadius: 4,
          })),
        };
      }
    } catch (e) { console.warn('Compare parse error:', e); }
  }

  // Comparativa de motores -> bar chart
  if (qn.includes('comparativa') || qn.includes('motor') && (qn.includes('gana') || qn.includes('comparar'))) {
    const pm = s.por_motor;
    if (pm && Object.keys(pm).length) {
      return {
        type: 'bar',
        title: 'SMAPE promedio por motor',
        labels: Object.keys(pm),
        datasets: [{
          label: 'SMAPE (%)',
          data: Object.values(pm).map(v => v.smape_mean),
          backgroundColor: CHART_COLORS.slice(0, Object.keys(pm).length),
          borderRadius: 6,
        }],
      };
    }
  }

  // Metricas globales -> radar or bar
  if (qn.includes('metrica') && qn.includes('global')) {
    const pm = s.por_motor;
    if (pm && Object.keys(pm).length) {
      return {
        type: 'bar',
        title: 'SMAPE por motor de predicción',
        labels: Object.keys(pm),
        datasets: [
          { label: 'SMAPE medio', data: Object.values(pm).map(v => v.smape_mean), backgroundColor: '#5B8DEFCC', borderRadius: 6 },
          { label: 'SMAPE mediano', data: Object.values(pm).map(v => v.smape_median), backgroundColor: '#2DD4BFCC', borderRadius: 6 },
        ],
      };
    }
  }

  // Ranking -> horizontal bar
  if (qn.includes('ranking') && (qn.includes('entidad') || qn.includes('incidencia'))) {
    const ranking = data.boletin?.ranking_entidades;
    if (ranking && ranking.length) {
      const top10 = ranking.slice(0, 10);
      return {
        type: 'bar',
        horizontal: true,
        title: 'Top 10 entidades por incidencia',
        labels: top10.map(r => r.entidad),
        datasets: [{
          label: 'Casos',
          data: top10.map(r => r.casos),
          backgroundColor: CHART_COLORS.slice(0, 10),
          borderRadius: 6,
        }],
      };
    }
  }

  // Diagnosticos -> donut
  if (qn.includes('diagnostico') || qn.includes('overfitting') || qn.includes('leakage')) {
    if (s.overfitting_ok != null) {
      return {
        type: 'doughnut',
        title: 'Diagnóstico de overfitting',
        labels: ['OK', 'Moderado', 'Alto'],
        datasets: [{
          data: [s.overfitting_ok || 0, s.overfitting_moderado || 0, s.overfitting_alto || 0],
          backgroundColor: ['#5B8DEF', '#2DD4BF', '#F472B6'],
          borderWidth: 0,
        }],
      };
    }
  }

  // Timelapse animado
  if (qn.includes('timelapse') || qn.includes('mapa animado') || qn.includes('animacion') || (qn.includes('anima') && qn.includes('mapa'))) {
    const chart = buildTimelapse(data);
    if (chart) return chart;
  }

  // Semaforo epidemiologico
  if (qn.includes('semaforo') || qn.includes('nivel de riesgo') || (qn.includes('alerta') && qn.includes('epidemiolog'))) {
    const chart = buildSemaforo(data);
    if (chart) return chart;
  }

  // Reporte PDF
  if (qn.includes('reporte') && (qn.includes('pdf') || qn.includes('ejecutivo') || qn.includes('exportar') || qn.includes('generar') || qn.includes('descargar') || qn.includes('imprimir'))) {
    return buildPDFReport(data);
  }

  // Mapa coropletico de Mexico
  if (qn.includes('mapa') && (qn.includes('mexico') || qn.includes('republica') || qn.includes('entidad') || qn.includes('estado') || qn.includes('nacional') || qn.includes('coropletico') || qn.includes('geografico'))) {
    const chart = buildMexicoMap(data, qn);
    if (chart) return chart;
  }

  // Treemap (barras horizontales) por entidad
  if (qn.includes('treemap') || qn.includes('mapa de entidad') ||
      (qn.includes('caso') && qn.includes('entidad') && qn.includes('grafico')) ||
      (qn.includes('panorama') && qn.includes('entidad'))) {
    const chart = buildTreemap(data);
    if (chart) return chart;
  }

  // Radar comparativo de motores
  if (qn.includes('radar') || qn.includes('spider') ||
      (qn.includes('comparar') && qn.includes('motor')) ||
      (qn.includes('mejor motor') || qn.includes('cual motor'))) {
    const chart = buildRadarChart(data);
    if (chart) return chart;
  }

  // Matriz de rendimiento (bubble)
  if (qn.includes('matriz') || qn.includes('burbuja') || qn.includes('scatter') ||
      (qn.includes('rendimiento') && qn.includes('modelo')) ||
      (qn.includes('precision') && qn.includes('error'))) {
    const chart = buildPerformanceMatrix(data);
    if (chart) return chart;
  }

  // Arsenal de motores (polar area)
  if (qn.includes('arsenal') || qn.includes('polar') || qn.includes('rosa de motores')) {
    const chart = buildMotorPolar(data);
    if (chart) return chart;
  }

  // Composición de motores por padecimiento (barras apiladas)
  if (qn.includes('motores por padecimiento') || qn.includes('motor por padecimiento') ||
      qn.includes('motor dominante') || qn.includes('motores por enfermedad') ||
      qn.includes('mix de motores') || (qn.includes('motor') && qn.includes('gana cada'))) {
    const chart = buildMotorByPad(data);
    if (chart) return chart;
  }

  // Mejores y peores modelos por SMAPE (barras divergentes)
  if (qn.includes('mejores y peores') || qn.includes('peores y mejores') ||
      qn.includes('aciertos y errores') || (qn.includes('ranking') && qn.includes('precision'))) {
    const chart = buildBestWorst(data);
    if (chart) return chart;
  }

  // Volumen vs error (combo doble eje)
  if (qn.includes('volumen vs error') || (qn.includes('volumen') && qn.includes('error')) ||
      qn.includes('doble eje') || (qn.includes('casos') && qn.includes('smape') && qn.includes('estado'))) {
    const chart = buildVolumeError(data);
    if (chart) return chart;
  }

  // Calibración (scatter pronóstico vs realidad)
  if (qn.includes('calibracion') || qn.includes('calibrado') ||
      (qn.includes('pronostico') && qn.includes('vs') && qn.includes('realidad'))) {
    const chart = buildCalibration(data);
    if (chart) return chart;
  }

  // MASE por motor (barras horizontales)
  if (qn.includes('mase por motor') || qn.includes('mase de los motores') ||
      qn.includes('skill') || (qn.includes('mase') && qn.includes('motor'))) {
    const chart = buildMaseByMotor(data);
    if (chart) return chart;
  }

  // Pronóstico acumulado nacional (área)
  if (qn.includes('acumulad')) {
    const chart = buildCumulative(data);
    if (chart) return chart;
  }

  // Salud de los modelos (overfitting + leakage)
  if (qn.includes('salud de los modelos') || qn.includes('salud de modelos') ||
      qn.includes('integridad de') || (qn.includes('overfitting') && qn.includes('leakage'))) {
    const chart = buildModelHealth(data);
    if (chart) return chart;
  }

  // Medidor (gauge) de salud global
  if (qn.includes('medidor') || qn.includes('gauge') || qn.includes('velocimetro') ||
      qn.includes('salud global') || (qn.includes('porcentaje') && qn.includes('sanos'))) {
    const chart = buildQualityGauge(data);
    if (chart) return chart;
  }

  // Rango de SMAPE por padecimiento (caja y bigotes / intercuartil)
  if (qn.includes('caja y bigotes') || qn.includes('boxplot') || qn.includes('box plot') ||
      qn.includes('rango de smape') || qn.includes('intercuartil') || qn.includes('cuartil')) {
    const chart = buildSmapeBox(data);
    if (chart) return chart;
  }

  // Cascada (waterfall) de aporte por padecimiento
  if (qn.includes('cascada') || qn.includes('waterfall') || qn.includes('aporte acumulado') ||
      (qn.includes('contribucion') && qn.includes('padecimiento')) ||
      (qn.includes('aporte') && qn.includes('total'))) {
    const chart = buildWaterfall(data);
    if (chart) return chart;
  }

  // Sparklines grid (32 estados)
  if (qn.includes('sparkline') || qn.includes('mini grafico') ||
      qn.includes('panorama') || qn.includes('vista general') ||
      (qn.includes('todos los estado') || qn.includes('32 estado') || qn.includes('cada estado'))) {
    const chart = buildSparklineGrid(data, qn);
    if (chart) return chart;
  }

  // Stacked area (composicion semanal)
  if (qn.includes('apilad') || qn.includes('stacked') || qn.includes('composicion') ||
      (qn.includes('proporcion') && qn.includes('semanal')) ||
      (qn.includes('area') && qn.includes('padecimiento'))) {
    const chart = buildStackedArea(data);
    if (chart) return chart;
  }

  // Corredor de confianza (4 modelos)
  if (qn.includes('corredor') || qn.includes('confianza') || qn.includes('banda') ||
      qn.includes('incertidumbre') || qn.includes('consenso') ||
      (qn.includes('4 modelo') || qn.includes('cuatro modelo')) ||
      (qn.includes('dispersion') && qn.includes('modelo'))) {
    const chart = buildCorridorChart(data, qn);
    if (chart) return chart;
  }

  // Heatmap de error semanal
  if (qn.includes('heatmap') || qn.includes('mapa de calor') ||
      (qn.includes('error') && qn.includes('semanal')) ||
      (qn.includes('error') && qn.includes('semana')) ||
      (qn.includes('donde falla') || qn.includes('donde aciert'))) {
    const chart = buildErrorHeatmap(data, qn);
    if (chart) return chart;
  }

  // Zoom semanal (2025-2027) -> line charts
  if (qn.includes('zoom') || qn.includes('detalle semanal') || qn.includes('cercano') ||
      (qn.includes('semanal') && (qn.includes('pronostico') || qn.includes('forecast'))) ||
      (qn.includes('real vs') && qn.includes('pronostico'))) {
    const entZoom = detectEntities(query);
    const chart = buildZoomChart(data, qn, entZoom);
    if (chart) return chart;
  }

  // Resumen epidemiologico con año → bar chart por padecimiento
  if (qn.includes('resumen') && qn.includes('epidemiolog')) {
    const anual = data.boletin?.anual_por_pad;
    if (anual) {
      const ent = detectEntities(query);
      const years = ent._years && ent._years.length ? ent._years : [];
      if (years.length) {
        const pads = Object.keys(anual);
        const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };
        const labels = years.map(String);
        const datasets = pads.map(pad => ({
          label: pad,
          data: years.map(y => anual[pad]?.[String(y)] || 0),
          backgroundColor: (padColors[pad] || '#5B8DEF') + 'CC',
          borderColor: padColors[pad] || '#5B8DEF',
          borderWidth: 2,
          borderRadius: 4,
        }));
        if (datasets.some(ds => ds.data.some(v => v > 0))) {
          return {
            type: 'bar',
            title: `Resumen epidemiológico ${years.join(', ')}`,
            labels,
            datasets,
          };
        }
      }
    }
  }

  // Tendencia historica -> line
  // Padecimiento + Estado: por defecto la EVOLUCIÓN HISTÓRICA del estado (si hay
  // histórico para esa entidad); «por sexo» → barras por sexo; si no hay histórico
  // del estado, el pronóstico del estado por sexo (específico, nunca nacional).
  {
    const entPE = detectEntities(query);
    if (entPE.padecimiento && entPE.estado) {
      const sexoIntent = /\b(sexo|genero|generos|hombres?|mujeres?|masculino|femenino)\b/.test(qn);
      const otherIntent = /pronostic|forecast|predicci|mapa|compar|semanal|por semana|heatmap|corredor|zoom/.test(qn) || (qn.includes('caso') && /52|futuro|siguientes|esperan/.test(qn));
      const perStateKeys = Object.keys(data.boletin?.anual_por_estado_pad || {});
      const hasStateHist = perStateKeys.some(k => norm(k) === norm(entPE.estado));
      const sexBar = () => {
        const matches = (data.prod_models || []).filter(m => m.padecimiento === entPE.padecimiento && norm(m.entidad || '') === norm(entPE.estado));
        if (!matches.length) return null;
        const order = { hombres: 0, mujeres: 1, general: 2 };
        matches.sort((a, b) => (order[a.sexo] ?? 9) - (order[b.sexo] ?? 9));
        return {
          type: 'bar',
          title: `${dn(entPE.padecimiento)} en ${dn(entPE.estado)}: pronóstico por sexo (52 sem)`,
          labels: matches.map(m => m.sexo.charAt(0).toUpperCase() + m.sexo.slice(1)),
          datasets: [{ label: 'Casos pronosticados', data: matches.map(m => m.casos_52_semanas_futuro || 0), backgroundColor: ['#5B8DEF', '#F472B6', '#2DD4BF'], borderColor: ['#5B8DEF', '#F472B6', '#2DD4BF'], borderRadius: 6 }],
        };
      };
      if (sexoIntent) { const b = sexBar(); if (b) return b; }
      else if (!otherIntent) {
        if (hasStateHist) { const tr = buildTrendChart(data, qn); if (tr) return tr; }
        const b = sexBar(); if (b) return b;   // sin histórico del estado → pronóstico del estado
      }
    }
  }

  if (qn.includes('tendencia') || qn.includes('historica') || qn.includes('evolucion')) {
    const chart = buildTrendChart(data, qn);
    if (chart) return chart;
  }

  // Pronostico / forecast -> contextual chart
  // Skip if user is asking for historical/weekly data with a specific year
  const entPre = detectEntities(query);
  const hasHistYear = entPre._years && entPre._years.length > 0;
  const isWeeklyReq = qn.includes('por semana') || qn.includes('semanal');
  if (qn.includes('pronostic') || qn.includes('forecast') || qn.includes('predicci') ||
      (qn.includes('caso') && (qn.includes('52 semana') || qn.includes('futuro') || qn.includes('esperan') || qn.includes('siguientes'))) ||
      (qn.includes('grafico') && (qn.includes('caso') || qn.includes('semana')) && !hasHistYear && !isWeeklyReq)) {

    const ent = detectEntities(query);
    const models = data.prod_models || [];

    // Pad + Estado -> bar por sexo de esa combinación
    if (ent.padecimiento && ent.estado) {
      const matches = models.filter(m =>
        m.padecimiento === ent.padecimiento && norm(m.entidad || '') === norm(ent.estado)
      );
      if (matches.length) {
        const labels = matches.map(m => m.sexo.charAt(0).toUpperCase() + m.sexo.slice(1));
        return {
          type: 'bar',
          title: `${dn(ent.padecimiento)} en ${dn(ent.estado)}: pronóstico 52 sem`,
          labels,
          datasets: [{
            label: 'Casos pronosticados',
            data: matches.map(m => m.casos_52_semanas_futuro || 0),
            backgroundColor: ['#5B8DEF', '#2DD4BF', '#F472B6'],
            borderRadius: 6,
          }],
        };
      }
    }

    // Solo Estado -> bar por padecimiento en esa entidad
    if (ent.estado && !ent.padecimiento) {
      const estModels = models
        .filter(m => norm(m.entidad || '') === norm(ent.estado) && m.sexo === 'general')
        .sort((a, b) => (b.casos_52_semanas_futuro || 0) - (a.casos_52_semanas_futuro || 0));
      if (estModels.length) {
        return {
          type: 'bar',
          title: `Pronóstico 52 semanas: ${dn(ent.estado)}`,
          labels: estModels.map(m => m.padecimiento),
          datasets: [{
            label: 'Casos pronosticados',
            data: estModels.map(m => m.casos_52_semanas_futuro || 0),
            backgroundColor: CHART_COLORS.slice(0, estModels.length),
            borderRadius: 6,
          }],
        };
      }
    }

    // Solo Padecimiento -> bar top 12 entidades
    if (ent.padecimiento) {
      const padModels = models
        .filter(m => m.padecimiento === ent.padecimiento && m.sexo === 'general' && m.casos_52_semanas_futuro > 0)
        .sort((a, b) => b.casos_52_semanas_futuro - a.casos_52_semanas_futuro);
      if (padModels.length) {
        const top = padModels.slice(0, 12);
        return {
          type: 'bar',
          title: `Pronóstico 52 semanas: ${dn(ent.padecimiento)} por entidad`,
          labels: top.map(m => m.entidad),
          datasets: [{
            label: 'Casos pronosticados',
            data: top.map(m => m.casos_52_semanas_futuro),
            backgroundColor: CHART_COLORS.slice(0, top.length),
            borderRadius: 6,
          }],
        };
      }
    }

    // General -> 3 bar charts semanales (uno por padecimiento)
    const wc = data.weekly_comparison;
    if (wc) {
      const padColors = { Depresion: '#5B8DEF', Parkinson: '#2DD4BF', Alzheimer: '#F472B6', Dengue: '#F59E0B' };
      const charts = [];
      for (const [pad, info] of Object.entries(wc)) {
        const sems = info.semanas || [];
        if (!sems.length) continue;
        const labels = sems.map(s => `S${String(s.semana).padStart(2, '0')}`);
        const datasets = [{
          label: 'Pronóstico',
          data: sems.map(s => s.pronostico),
          backgroundColor: sems.map(s => s.real != null ? padColors[pad] + 'AA' : padColors[pad] + '55'),
          borderRadius: 2,
        }];
        // Superponer datos reales donde existan
        const realData = sems.map(s => s.real != null ? s.real : null);
        if (realData.some(v => v != null)) {
          datasets.push({
            label: 'Real',
            data: realData,
            backgroundColor: '#ffffffCC',
            borderColor: padColors[pad],
            borderWidth: 1.5,
            borderRadius: 2,
          });
        }
        charts.push({
          type: 'bar',
          title: `${dn(pad)} - pronóstico semanal (${info.modelo_productivo || ''})`,
          labels,
          datasets,
          options: {
            scales: {
              x: { ticks: { maxRotation: 90, font: { size: 9 } } },
              y: { beginAtZero: true },
            },
          },
        });
      }
      if (charts.length) return charts;
    }
  }

  // General "grafico" trigger — user explicitly asks for a chart
  const wantsChart = (qn.includes('grafico') || qn.includes('grafica') || qn.includes('chart') ||
                      qn.includes('visualiza') || qn.includes('graficame') || qn.includes('dibuja') ||
                      qn.includes('mostrar en un') || qn.includes('como se ve') ||
                      qn.includes('muestra') && qn.includes('grafico'));
  if (wantsChart) {
    const ent = detectEntities(query);
    const models = data.prod_models || [];
    const anual = data.boletin?.anual_por_pad;

    // COVID / pandemia → inject years 2019-2023 for context
    const covidQuery = (qn.includes('covid') || qn.includes('pandemia') || qn.includes('confinamiento'));
    if (covidQuery && !(ent._years && ent._years.length)) {
      ent._years = [2019, 2020, 2021, 2022, 2023];
    }

    // Weekly chart from boletin semanal (current year only)
    const weeklyTrigger = qn.includes('por semana') || qn.includes('semanal') || qn.includes('semana a semana');
    const semData = data.boletin?.semanal;
    const metaBol = data.boletin?.meta;
    if (weeklyTrigger && semData && semData.length) {
      const currentYear = metaBol?.max_anio || new Date().getFullYear();
      const requestedYear = ent._years && ent._years.length ? ent._years[0] : currentYear;
      if (requestedYear === currentYear) {
        const labels = semData.map(s => `Sem ${s.semana}`);
        const datasets = [];
        const pads = ['Depresion', 'Parkinson', 'Alzheimer'];
        pads.forEach((pad, i) => {
          if (ent.padecimiento && norm(ent.padecimiento) !== norm(pad)) return;
          const vals = semData.map(s => s[pad] || 0);
          if (vals.some(v => v > 0)) {
            datasets.push({
              label: dn(pad),
              data: vals,
              borderColor: CHART_COLORS[i],
              backgroundColor: CHART_COLORS[i] + '22',
              fill: true, tension: 0.3, borderWidth: 2.5,
              pointRadius: 4, pointBackgroundColor: CHART_COLORS[i],
            });
          }
        });
        if (datasets.length) {
          const padLabel = ent.padecimiento ? dn(ent.padecimiento) : 'Todos los padecimientos';
          return {
            type: 'line',
            title: `${padLabel} — semanas ${currentYear} (sem 1–${semData.length})`,
            labels, datasets,
          };
        }
      }
    }

    // Historical year(s) → line chart from boletin
    if (ent._years && ent._years.length) {
      const anualEstPad = data.boletin?.anual_por_estado_pad;
      // Use state-level data if estado detected, else national
      let source = null;
      let lugar = 'Nacional';
      let fallbackNacional = false;
      if (ent.estado && anualEstPad) {
        const estKey = Object.keys(anualEstPad).find(k => norm(k) === norm(ent.estado));
        if (estKey) { source = anualEstPad[estKey]; lugar = estKey; }
        else { fallbackNacional = true; }
      }
      if (!source && anual) { source = anual; }

      if (source) {
        const pads = Object.keys(source);
        const datasets = [];
        let allYears = new Set();
        pads.forEach(p => { Object.keys(source[p]).forEach(yr => allYears.add(yr)); });
        allYears = [...allYears].sort();
        pads.forEach((pad, i) => {
          const padNorm = pad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (ent.padecimiento && norm(ent.padecimiento) !== padNorm) return;
          datasets.push({
            label: pad,
            data: allYears.map(y => source[pad][y] || 0),
            borderColor: CHART_COLORS[i],
            backgroundColor: CHART_COLORS[i] + '22',
            fill: true, tension: 0.4, borderWidth: 3,
            pointRadius: allYears.map(y => ent._years.includes(Number(y)) ? 7 : 3),
            pointBackgroundColor: allYears.map(y => ent._years.includes(Number(y)) ? '#F472B6' : CHART_COLORS[i]),
          });
        });
        if (datasets.length) {
          const yrLabel = ent._years.filter(y => allYears.includes(String(y)));
          const lugarLabel = fallbackNacional ? `Nacional (sin datos históricos para ${dn(ent.estado)})` : lugar;
          let suffix = '';
          if (covidQuery) suffix = ' — impacto COVID-19';
          else if (yrLabel.length) suffix = ` (${yrLabel.join(', ')} destacado)`;
          const titulo = ent.padecimiento
            ? `${dn(ent.padecimiento)} — ${lugarLabel}${suffix}`
            : `Incidencia histórica — ${lugarLabel}${suffix}`;
          return { type: 'line', title: titulo, labels: allYears, datasets };
        }
      }
    }

    // Pad + Estado → bar por sexo
    if (ent.padecimiento && ent.estado) {
      const matches = models.filter(m =>
        m.padecimiento === ent.padecimiento && norm(m.entidad || '') === norm(ent.estado));
      if (matches.length) {
        return {
          type: 'bar',
          title: `${dn(ent.padecimiento)} en ${dn(ent.estado)}: pronóstico 52 sem`,
          labels: matches.map(m => m.sexo.charAt(0).toUpperCase() + m.sexo.slice(1)),
          datasets: [{ label: 'Casos pronosticados', data: matches.map(m => m.casos_52_semanas_futuro || 0),
            backgroundColor: ['#5B8DEF', '#2DD4BF', '#F472B6'], borderRadius: 6 }],
        };
      }
    }

    // Solo Padecimiento → bar top 12 entidades
    if (ent.padecimiento) {
      const padModels = models
        .filter(m => m.padecimiento === ent.padecimiento && m.sexo === 'general' && m.casos_52_semanas_futuro > 0)
        .sort((a, b) => b.casos_52_semanas_futuro - a.casos_52_semanas_futuro);
      if (padModels.length) {
        const top = padModels.slice(0, 12);
        return {
          type: 'bar', title: `Pronóstico 52 sem: ${dn(ent.padecimiento)} por entidad`,
          labels: top.map(m => m.entidad),
          datasets: [{ label: 'Casos pronosticados', data: top.map(m => m.casos_52_semanas_futuro),
            backgroundColor: CHART_COLORS.slice(0, top.length), borderRadius: 6 }],
        };
      }
    }

    // Solo Estado → bar por padecimiento
    if (ent.estado) {
      const estModels = models
        .filter(m => norm(m.entidad || '') === norm(ent.estado) && m.sexo === 'general')
        .sort((a, b) => (b.casos_52_semanas_futuro || 0) - (a.casos_52_semanas_futuro || 0));
      if (estModels.length) {
        return {
          type: 'bar', title: `Pronóstico 52 semanas: ${dn(ent.estado)}`,
          labels: estModels.map(m => m.padecimiento),
          datasets: [{ label: 'Casos pronosticados', data: estModels.map(m => m.casos_52_semanas_futuro || 0),
            backgroundColor: CHART_COLORS.slice(0, estModels.length), borderRadius: 6 }],
        };
      }
    }

    // General sin entidades → tendencia historica completa
    if (anual) {
      const chart = buildTrendChart(data, '');
      if (chart) return chart;
    }
  }

  // Distribucion por sexo -> bar (cuando hay padecimiento + "sexo"/"genero"/"distribucion")
  const sexTrigger = qn.includes('sexo') || qn.includes('genero') || qn.includes('hombre') || qn.includes('mujer');
  if (sexTrigger) {
    const ent = detectEntities(query);
    const pad = ent.padecimiento;
    const psx = pad && s.por_pad?.[pad]?.por_sexo;
    if (psx) {
      const labels = []; const vals = [];
      for (const [sx, info] of Object.entries(psx)) {
        if (sx === 'general') continue;
        labels.push(sx === 'hombres' ? 'Hombres' : 'Mujeres');
        vals.push(info.casos_total || 0);
      }
      if (labels.length) {
        return {
          type: 'bar',
          title: `${dn(pad)}: casos pronosticados por sexo (52 sem)`,
          labels,
          datasets: [{
            label: 'Casos pronosticados',
            data: vals,
            backgroundColor: ['#5B8DEF', '#2DD4BF'],
            borderRadius: 6,
          }],
        };
      }
    }
    // Global sex distribution (sin padecimiento)
    const globalSex = s.por_sexo;
    if (globalSex) {
      const labels = []; const vals = [];
      for (const [sx, info] of Object.entries(globalSex)) {
        if (sx === 'general') continue;
        labels.push(sx === 'hombres' ? 'Hombres' : 'Mujeres');
        vals.push(info.n || 0);
      }
      if (labels.length) {
        return {
          type: 'bar',
          title: 'Modelos de producción por sexo',
          labels,
          datasets: [{
            label: 'Modelos',
            data: vals,
            backgroundColor: ['#5B8DEF', '#2DD4BF'],
            borderRadius: 6,
          }],
        };
      }
    }
  }

  // Distribución de motores -> donut (excluir si pregunta por sexo)
  if (s.dist_motor && !sexTrigger && (qn.includes('distribucion') || qn.includes('conteo') || qn.includes('cuantos modelo'))) {
    return {
      type: 'doughnut',
      title: 'Distribución de motores',
      labels: Object.keys(s.dist_motor),
      datasets: [{
        data: Object.values(s.dist_motor),
        backgroundColor: CHART_COLORS.slice(0, Object.keys(s.dist_motor).length),
        borderWidth: 0,
      }],
    };
  }

  // Fallback: si se detecto un padecimiento, mostrar tendencia historica
  {
    const entFb = detectEntities(query);
    if (entFb.padecimiento) {
      const chart = buildTrendChart(data, qn);
      if (chart) return chart;
    }
  }

  return null;
}

function renderChart(canvasId, chartData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Anti-leak: si el canvas ya tiene una instancia Chart.js, destruirla antes
  // de crear otra (libera listeners, rAF y memoria del contexto).
  const prevChart = typeof Chart !== 'undefined' && Chart.getChart ? Chart.getChart(canvas) : null;
  if (prevChart) prevChart.destroy();

  const isHorizontal = chartData.horizontal;
  const config = {
    type: chartData.type,
    data: { labels: chartData.labels, datasets: chartData.datasets },
    plugins: [epiGradientPlugin, epiGlowPlugin, epiCrosshairPlugin, epiDoughnutCenterPlugin, epiBoxPlotPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,  // Llenan el contenedor; canvas controla el tamaño vía CSS
      indexAxis: isHorizontal ? 'y' : 'x',
      interaction: (chartData.type === 'bubble' || chartData.type === 'scatter')
        ? { mode: 'nearest', intersect: true }
        : { mode: 'index', intersect: false },
      animation: { duration: 850, easing: 'easeOutQuart' },
      plugins: {
        title: {
          display: true,
          text: chartData.title,
          font: { size: 16, weight: '800', family: 'Outfit' },
          color: '#E7ECF5',
          padding: { bottom: 20, top: 4 },
          align: 'start',
        },
        legend: {
          display: chartData.datasets.length > 1 || chartData.type === 'doughnut' || chartData.type === 'polarArea',
          position: (chartData.type === 'doughnut' || chartData.type === 'polarArea') ? 'right' : 'top',
          align: 'end',
          labels: {
            font: { size: 12, family: 'Outfit', weight: '600' },
            color: '#9FB0CE',
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 18,
            boxWidth: 8,
            filter: (item) => !String(item.text || '').startsWith('_'),
          },
        },
        tooltip: {
          filter: (item) => !String((item.dataset && item.dataset.label) || '').startsWith('_'),
          backgroundColor: 'rgba(14, 20, 36, 0.96)',
          titleColor: '#8FB4FF',
          titleFont: { size: 13, weight: '700', family: 'Outfit' },
          bodyColor: '#E7ECF5',
          bodyFont: { size: 12, family: 'Outfit' },
          borderColor: 'rgba(91, 141, 239, 0.45)',
          borderWidth: 1,
          cornerRadius: 10,
          padding: 12,
          displayColors: true,
          boxPadding: 6,
          usePointStyle: true,
          caretSize: 7,
          callbacks: {
            label(ctx) {
              const type = ctx.chart.config.type;
              if (type === 'doughnut' || type === 'pie' || type === 'polarArea') {
                const arr = ctx.dataset.data || [];
                const total = arr.reduce((a, b) => a + (+b || 0), 0);
                const v = type === 'polarArea' ? (+ctx.parsed.r || +ctx.parsed || 0) : (+ctx.parsed || 0);
                const pct = total ? (v / total * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${fmtFull(v)} (${pct}%)`;
              }
              if (type === 'bubble' || type === 'scatter') {
                const sc = ctx.chart.options.scales || {};
                const xLab = (sc.x && sc.x.title && sc.x.title.text) || 'X';
                const yLab = (sc.y && sc.y.title && sc.y.title.text) || 'Y';
                const raw = ctx.raw || {};
                const head = (raw.label ? raw.label + ' · ' : '') + (ctx.dataset.label || '');
                const lines = [` ${head}`, `   ${xLab}: ${fmtFull(ctx.parsed.x)}`, `   ${yLab}: ${fmtFull(ctx.parsed.y)}`];
                if (raw.casos != null) lines.push(`   Volumen: ${fmtFull(raw.casos)} casos`);
                return lines;
              }
              let val = ctx.parsed;
              if (val && typeof val === 'object') {
                val = val.r != null ? val.r : (ctx.chart.options.indexAxis === 'y' ? val.x : val.y);
              }
              const lbl = ctx.dataset.label ? `${ctx.dataset.label}: ` : '';
              return ` ${lbl}${fmtFull(val)}`;
            },
          },
        },
      },
      scales: chartData.type === 'doughnut' ? {} : chartData.type === 'radar' ? {
        r: {
          angleLines: { color: 'rgba(91, 141, 239, 0.18)' },
          grid: { color: 'rgba(91, 141, 239, 0.12)' },
          pointLabels: { font: { size: 12, family: 'Outfit', weight: '600' }, color: '#9FB0CE' },
          ticks: { font: { size: 10 }, color: '#6E82A6', backdropColor: 'transparent' },
          beginAtZero: true,
          max: 100,
        },
      } : chartData.type === 'polarArea' ? {
        r: {
          angleLines: { color: 'rgba(91, 141, 239, 0.12)' },
          grid: { color: 'rgba(91, 141, 239, 0.12)' },
          pointLabels: { display: false },
          ticks: { font: { size: 10 }, color: '#6E82A6', backdropColor: 'transparent', callback: (v) => fmtAxis(v) },
          beginAtZero: true,
        },
      } : {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11, family: 'Outfit', weight: '500' }, color: '#9FB0CE', padding: 6 },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(91, 141, 239, 0.08)', drawBorder: false, lineWidth: 1 },
          ticks: { font: { size: 11, family: 'Outfit', weight: '500' }, color: '#9FB0CE', padding: 8 },
          border: { display: false },
        },
      },
    },
  };

  // Número formateado (1.2k, 3.4M) en el eje de valores.
  if (chartData.type !== 'doughnut' && chartData.type !== 'radar' && chartData.type !== 'polarArea') {
    const valueAxes = (chartData.type === 'bubble' || chartData.type === 'scatter')
      ? ['x', 'y']
      : [isHorizontal ? 'x' : 'y'];
    for (const ax of valueAxes) {
      if (config.options.scales[ax]) {
        config.options.scales[ax].ticks = config.options.scales[ax].ticks || {};
        config.options.scales[ax].ticks.callback = (v) => fmtAxis(v);
      }
    }
  }

  // Acabado por dataset: gradientes (barras/áreas), barras redondeadas,
  // líneas más presentes y puntos con realce al hover.
  for (const ds of chartData.datasets) {
    const t = ds.type || chartData.type;

    if (t === 'bar' && typeof ds.backgroundColor === 'string') {
      // Solo color único → gradiente; arrays de color por barra se respetan.
      ds._grad = { base: ds.backgroundColor, kind: isHorizontal ? 'barH' : 'bar' };
      if (ds.borderRadius == null) ds.borderRadius = 6;
      if (ds.borderSkipped == null) ds.borderSkipped = false;
      if (ds.maxBarThickness == null) ds.maxBarThickness = isHorizontal ? 30 : 52;
    } else if (t === 'line') {
      if (ds.borderWidth == null) ds.borderWidth = 2.5;
      if (ds.pointRadius == null) ds.pointRadius = 0;
      if (ds.pointHoverRadius == null) ds.pointHoverRadius = 6;
      if (ds.tension == null) ds.tension = 0.32;
      if (ds.borderCapStyle == null) ds.borderCapStyle = 'round';
      if (ds.borderJoinStyle == null) ds.borderJoinStyle = 'round';
      if (ds.pointHoverBackgroundColor == null) ds.pointHoverBackgroundColor = ds.borderColor;
      if (ds.pointHoverBorderColor == null) ds.pointHoverBorderColor = '#0E1424';
      if (ds.pointHoverBorderWidth == null) ds.pointHoverBorderWidth = 2;
      // Área rellena (no bandas de confianza) → gradiente vertical.
      const fillOn = ds.fill === true || ds.fill === 'origin' || ds.fill === 'start' || ds.fill === 'end';
      if (fillOn && typeof ds.borderColor === 'string') {
        ds._grad = { base: ds.borderColor, kind: 'area' };
      }
    }
  }

  // Merge custom options (e.g. axis titles, stacked, indexAxis) — merge profundo
  // en ticks/grid/border/title para no pisar callbacks ni estilos base.
  if (chartData.options) {
    if (chartData.options.scales) {
      for (const [axis, opts] of Object.entries(chartData.options.scales)) {
        if (!config.options.scales[axis]) config.options.scales[axis] = {};
        const target = config.options.scales[axis];
        for (const [k, val] of Object.entries(opts)) {
          if ((k === 'ticks' || k === 'grid' || k === 'border') && target[k] && val && typeof val === 'object') {
            Object.assign(target[k], val);
          } else if (k !== 'title') {
            target[k] = val;
          }
        }
        if (opts.title) {
          target.title = {
            ...opts.title,
            font: { size: 12, family: 'Outfit' },
            color: '#7E92B6',
          };
        }
      }
    }
    if (chartData.options.indexAxis) config.options.indexAxis = chartData.options.indexAxis;
    // Opciones top-level para gauge/doughnut
    for (const k of ['circumference', 'rotation', 'cutout']) {
      if (chartData.options[k] != null) config.options[k] = chartData.options[k];
    }
    if (chartData.options.plugins) {
      Object.assign(config.options.plugins, chartData.options.plugins);
    }
  }

  new Chart(canvas, config);
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

function getSuggestions(query) {
  const q = query.toLowerCase();
  if (q.includes('metrica') || q.includes('smape'))
    return [{ text: 'Ranking mejores', q: 'ranking mejores modelos' }, { text: 'Diagnósticos', q: 'diagnosticos de calidad' }];
  if (q.includes('depresion'))
    return [{ text: 'Tendencia histórica', q: 'tendencia historica de depresion' }, { text: 'Zoom semanal', q: 'zoom depresion' }, { text: 'Pronóstico', q: 'pronostico depresion' }];
  if (q.includes('parkinson'))
    return [{ text: 'Tendencia histórica', q: 'tendencia historica de parkinson' }, { text: 'Zoom semanal', q: 'zoom parkinson' }, { text: 'Pronóstico', q: 'pronostico parkinson' }];
  if (q.includes('alzheimer'))
    return [{ text: 'Tendencia histórica', q: 'tendencia historica de alzheimer' }, { text: 'Zoom semanal', q: 'zoom alzheimer' }, { text: 'Pronóstico', q: 'pronostico alzheimer' }];
  if (q.includes('ranking'))
    return [{ text: 'Métricas globales', q: 'metricas globales' }, { text: 'Comparativa motores', q: 'comparativa de motores' }];
  if (q.includes('equipo'))
    return [{ text: 'Infraestructura', q: 'infraestructura del proyecto' }, { text: 'Alcance', q: 'que padecimientos modela' }];
  if (q.includes('corredor') || q.includes('confianza') || q.includes('consenso'))
    return [{ text: 'Heatmap de error', q: 'heatmap error semanal' }, { text: 'Zoom semanal', q: 'zoom semanal' }];
  if (q.includes('heatmap') || q.includes('error semanal'))
    return [{ text: 'Corredor de confianza', q: 'corredor de confianza' }, { text: 'Zoom semanal', q: 'zoom semanal' }];
  if (q.includes('zoom'))
    return [{ text: 'Corredor de confianza', q: 'corredor de confianza' }, { text: 'Heatmap de error', q: 'heatmap error semanal' }];
  if (q.includes('tendencia'))
    return [{ text: 'Zoom semanal', q: 'zoom semanal' }, { text: 'Corredor de confianza', q: 'corredor de confianza' }];
  if (q.includes('mapa') && (q.includes('mexico') || q.includes('republica')))
    return [{ text: 'Mapa Depresion', q: 'mapa de mexico depresion' }, { text: 'Mapa Parkinson', q: 'mapa de mexico parkinson' }, { text: 'Mapa por SMAPE', q: 'mapa de mexico por smape' }];
  if (q.includes('treemap'))
    return [{ text: 'Mapa de Mexico', q: 'mapa de mexico por casos' }, { text: 'Radar motores', q: 'radar comparativo de motores' }];
  if (q.includes('timelapse') || q.includes('animacion'))
    return [{ text: 'Semaforo', q: 'semaforo epidemiologico' }, { text: 'Mapa de Mexico', q: 'mapa de mexico por casos' }];
  if (q.includes('semaforo') || q.includes('riesgo'))
    return [{ text: 'Timelapse', q: 'timelapse mapa animado' }, { text: 'Reporte PDF', q: 'generar reporte pdf' }];
  if (q.includes('compara') || q.includes('vs'))
    return [{ text: 'Semaforo', q: 'semaforo epidemiologico' }, { text: 'Timelapse', q: 'timelapse mapa animado' }];
  if (q.includes('reporte') || q.includes('pdf'))
    return [{ text: 'Semaforo', q: 'semaforo epidemiologico' }, { text: 'Metricas', q: 'metricas globales' }];
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pushHistory(userText, botText) {
  history.push({ role: 'user', text: userText });
  history.push({ role: 'assistant', text: botText.substring(0, 300) });
  while (history.length > MAX_HISTORY * 2) history.shift();
}

// ---------------------------------------------------------------------------
// Auto-scroll condicional: sigue el flujo solo si el usuario está pegado al
// fondo (<120 px). Si subió a releer, NO se le secuestra el scroll: aparece
// el botón flotante «Bajar» con el contenido nuevo esperando abajo.
// ---------------------------------------------------------------------------
const SCROLL_NEAR_PX = 120;
let stickToBottom = true;   // el usuario sigue la conversación al fondo
let scrollDownBtn = null;

function isNearBottom() {
  return chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight < SCROLL_NEAR_PX;
}

function hideScrollDownBtn() {
  if (scrollDownBtn) scrollDownBtn.classList.remove('visible');
}

function ensureScrollDownBtn() {
  if (scrollDownBtn) return scrollDownBtn;
  scrollDownBtn = document.createElement('button');
  scrollDownBtn.type = 'button';
  scrollDownBtn.className = 'scroll-down-btn';
  scrollDownBtn.title = 'Bajar al final de la conversación';
  scrollDownBtn.setAttribute('aria-label', 'Bajar al final de la conversación');
  scrollDownBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><line x1="12" y1="4" x2="12" y2="20"/><polyline points="5 13 12 20 19 13"/></svg><span>Bajar</span>';
  scrollDownBtn.addEventListener('click', () => {
    stickToBottom = true;
    chatArea.scrollTop = chatArea.scrollHeight;
    hideScrollDownBtn();
  });
  const inputBar = document.querySelector('.input-bar');
  (inputBar || document.body).appendChild(scrollDownBtn);
  return scrollDownBtn;
}

// Detecta la intención del usuario: scroll hacia arriba desactiva el
// seguimiento; volver al fondo lo reactiva (el scroll programático solo
// se mueve hacia abajo, así que no se auto-desactiva).
let lastScrollTop = 0;
chatArea.addEventListener('scroll', () => {
  const st = chatArea.scrollTop;
  if (st < lastScrollTop - 2) {
    stickToBottom = false;
  } else if (isNearBottom()) {
    stickToBottom = true;
    hideScrollDownBtn();
  }
  lastScrollTop = st;
}, { passive: true });

function scrollToBottom(force = false) {
  if (force) stickToBottom = true;
  if (!stickToBottom) {
    ensureScrollDownBtn().classList.add('visible');
    return;
  }
  requestAnimationFrame(() => { chatArea.scrollTop = chatArea.scrollHeight; });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Saneado anti-XSS del HTML que genera marked (DOMPurify, CDN con defer).
// Permite solo las etiquetas/atributos que el bot usa (markdown: tablas,
// listas, code, énfasis, enlaces, imágenes) y la política de URI por defecto
// de DOMPurify, que ya bloquea javascript:/data: en href y src.
// ---------------------------------------------------------------------------
function sanitizeHtml(html) {
  if (typeof DOMPurify === 'undefined') return html;   // CDN caído: degradación
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'p', 'br', 'hr',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
      'code', 'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'img', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'title', 'src', 'alt', 'class', 'align'],
  });
}

// Valida el esquema de un href de fuente RAG: solo http(s) o rutas relativas.
// Cualquier otro esquema (javascript:, data:, vbscript:, //host) se descarta.
function safeUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';
  if (u.startsWith('//')) return '';
  return u;
}

// ---------------------------------------------------------------------------
// PDF Report Generator
// ---------------------------------------------------------------------------

function generatePDFReport(data) {
  const s = data.stats || {};
  const models = data.prod_models || [];
  const wc = data.weekly_comparison || {};
  const tc = data.training_config || {};
  const bol = data.boletin || {};

  function isState(m) {
    const e = m.entidad || '';
    return e && e !== 'Nacional' && !e.startsWith('Region') && !e.startsWith('region_');
  }

  const totalCasos = models.filter(m => m.sexo === 'general' && isState(m))
    .reduce((a, m) => a + (m.casos_52_semanas_futuro || 0), 0);

  // Per-padecimiento stats (solo 32 estados)
  const padStats = {};
  for (const m of models) {
    if (m.sexo !== 'general' || !isState(m)) continue;
    if (!padStats[m.padecimiento]) padStats[m.padecimiento] = { casos: 0, smapes: [], models: 0 };
    padStats[m.padecimiento].casos += m.casos_52_semanas_futuro || 0;
    padStats[m.padecimiento].models++;
    if (m.smape_prod != null) padStats[m.padecimiento].smapes.push(m.smape_prod);
  }

  // Per-state totals
  const byEnt = {};
  for (const m of models) {
    if (m.sexo !== 'general') continue;
    const e = m.entidad || '';
    if (e === 'Nacional' || e.startsWith('region_') || e.startsWith('Region')) continue;
    byEnt[e] = (byEnt[e] || 0) + (m.casos_52_semanas_futuro || 0);
  }
  const topStates = Object.entries(byEnt).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Motor distribution
  const motorDist = {};
  models.filter(m => m.sexo === 'general').forEach(m => {
    motorDist[m.modelo_produccion] = (motorDist[m.modelo_produccion] || 0) + 1;
  });

  const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const horizonte = tc.horizonte_inicio && tc.horizonte_fin
    ? tc.horizonte_inicio + ' a ' + tc.horizonte_fin : '52 semanas';

  // Semaforo data
  const casosArr = Object.values(byEnt).sort((a, b) => a - b);
  const p75 = casosArr[Math.floor(casosArr.length * 0.75)] || 0;
  const p50 = casosArr[Math.floor(casosArr.length * 0.50)] || 0;
  const p25 = casosArr[Math.floor(casosArr.length * 0.25)] || 0;

  function riskColor(casos) {
    if (casos >= p75) return '#F472B6';
    if (casos >= p50) return '#E67E22';
    if (casos >= p25) return '#2DD4BF';
    return '#5B8DEF';
  }

  const padRows = Object.entries(padStats).map(([pad, ps]) => {
    const avgSmape = ps.smapes.length ? (ps.smapes.reduce((a, v) => a + v, 0) / ps.smapes.length).toFixed(1) : '?';
    return '<tr><td style="padding:6px 10px;border-bottom:1px solid #e0e0e0">' + dn(pad) + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #e0e0e0;text-align:right">' + ps.casos.toLocaleString() + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #e0e0e0;text-align:center">' + ps.models + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #e0e0e0;text-align:center">' + avgSmape + '%</td></tr>';
  }).join('');

  const stateRows = topStates.map(([ent, casos]) =>
    '<tr><td style="padding:4px 10px;border-bottom:1px solid #f0f0f0">' + ent + '</td>' +
    '<td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:right">' + casos.toLocaleString() + '</td>' +
    '<td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:center">' +
    '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + riskColor(casos) + '"></span></td></tr>'
  ).join('');

  const motorRows = Object.entries(motorDist).sort((a, b) => b[1] - a[1]).map(([m, n]) =>
    '<tr><td style="padding:4px 10px;border-bottom:1px solid #f0f0f0">' + m + '</td>' +
    '<td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:right">' + n + ' modelos</td>' +
    '<td style="padding:4px 10px;border-bottom:1px solid #f0f0f0;text-align:right">' + (n / models.filter(m2 => m2.sexo === 'general').length * 100).toFixed(0) + '%</td></tr>'
  ).join('');

  const reportHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte Ejecutivo - EpiForecast-MX</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; color: #1a1a1a; padding: 40px; max-width: 900px; margin: 0 auto; line-height: 1.5; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
  .header { border-bottom: 3px solid #3A6FD8; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header h1 { font-size: 22px; color: #3A6FD8; }
  .header .subtitle { font-size: 13px; color: #666; }
  .header .date { font-size: 12px; color: #888; text-align: right; }
  .header .logo { font-size: 11px; color: #3A6FD8; font-weight: 700; letter-spacing: 1px; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 16px; color: #3A6FD8; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; margin-bottom: 12px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .kpi { background: #f5f7fc; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi .val { font-size: 24px; font-weight: 700; color: #3A6FD8; }
  .kpi .lbl { font-size: 11px; color: #666; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #3A6FD8; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
  .semaforo-mini { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; }
  .sem-cell { text-align: center; padding: 6px 2px; border-radius: 4px; font-size: 9px; color: #fff; font-weight: 600; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid #3A6FD8; font-size: 10px; color: #888; text-align: center; }
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 24px; background: #3A6FD8; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
  .print-btn:hover { background: #2A52A8; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>

<div class="header">
  <div>
    <div class="logo">EpiForecast-MX · Centro de Inteligencia Epidemiológica</div>
    <h1>Reporte Ejecutivo de Pronóstico Epidemiológico</h1>
    <div class="subtitle">EpiForecast-MX: Plataforma multi-modelo de inteligencia epidemiológica</div>
  </div>
  <div class="date">
    <div>${today}</div>
    <div>Horizonte: ${horizonte}</div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi"><div class="val">${totalCasos.toLocaleString()}</div><div class="lbl">Casos pronosticados (52 sem)</div></div>
  <div class="kpi"><div class="val">${s.total_modelos || 333}</div><div class="lbl">Modelos de producción</div></div>
  <div class="kpi"><div class="val">${s.smape_prod_median != null ? s.smape_prod_median + '%' : '?'}</div><div class="lbl">SMAPE mediano</div></div>
  <div class="kpi"><div class="val">4</div><div class="lbl">Motores de IA</div></div>
</div>

<div class="section">
  <h2>Pronóstico por padecimiento</h2>
  <table>
    <tr><th>Padecimiento</th><th style="text-align:right">Casos (52 sem)</th><th style="text-align:center">Modelos</th><th style="text-align:center">SMAPE prom</th></tr>
    ${padRows}
  </table>
</div>

<div class="section">
  <h2>Top 10 entidades por incidencia pronosticada</h2>
  <table>
    <tr><th>Entidad</th><th style="text-align:right">Casos (52 sem)</th><th style="text-align:center">Riesgo</th></tr>
    ${stateRows}
  </table>
</div>

<div class="section">
  <h2>Semáforo epidemiológico (32 entidades)</h2>
  <div class="semaforo-mini">
    ${Object.entries(byEnt).sort((a, b) => b[1] - a[1]).map(([ent, casos]) =>
      '<div class="sem-cell" style="background:' + riskColor(casos) + '">' + ent.substring(0, 5) + '</div>'
    ).join('')}
  </div>
</div>

<div class="section">
  <h2>Distribución de motores de IA</h2>
  <table>
    <tr><th>Motor</th><th style="text-align:right">Modelos</th><th style="text-align:right">Participación</th></tr>
    ${motorRows}
  </table>
</div>

<div class="footer">
  <strong>EpiForecast-MX</strong> - Proyecto integrador, Maestría en Inteligencia Artificial Aplicada, Tecnológico de Monterrey<br>
  Pronóstico multi-modelo (Prophet, DeepAR, Ensemble, Stacking) para la salud pública en México<br>
  Generado automáticamente el ${today}
</div>

</body></html>`;

  const reportWindow = window.open('', '_blank');
  if (reportWindow) {
    reportWindow.document.write(reportHtml);
    reportWindow.document.close();
  }
}
