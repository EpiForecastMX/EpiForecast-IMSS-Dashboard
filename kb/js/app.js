/**
 * app.js - UI conversacional EpiForecast-MX con graficas en vivo.
 *
 * Carga knowledge.json, renderiza stats cards, maneja chat con kb.js local,
 * detecta datos tabulares para renderizar Chart.js inline,
 * y fallback a Gemini via Netlify Function.
 */

import { loadKnowledge, getStats, getData, answer } from './kb.js?v=64';
import { detectEntities, norm } from './entities.js?v=25';

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

// Paleta mejorada basada en el logo
const CHART_COLORS = [
  '#2EC4A8', // teal
  '#D4A84B', // gold
  '#C83A5A', // burgundy
  '#6DD6C2', // teal claro
  '#E8C56D', // gold claro
  '#E06080', // burgundy claro
  '#1DA88E', // teal oscuro
  '#8FA99D', // sage
  '#A8D8C8', // mint
  '#F0D090', // cream gold
];

// ---------------------------------------------------------------------------
// Gemini connectivity check
// ---------------------------------------------------------------------------

async function checkGemini() {
  const indicator = document.getElementById('geminiStatus');
  if (!indicator) return;
  try {
    const resp = await fetch('/.netlify/functions/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ health: true }),
    });
    if (resp.ok) {
      const data = await resp.json();
      geminiConnected = data.gemini === true;
    }
  } catch (err) {
    console.warn('Gemini health check failed:', err);
    geminiConnected = false;
  }
  if (geminiConnected) {
    indicator.className = 'gemini-status gemini-ok';
    indicator.innerHTML = `
      <span class="gemini-dot"></span>
      <span>Powered by AI</span>`;
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
      chatEl.innerHTML = `<div style="padding:24px;color:#9F2241;font-weight:600;">
        Error al cargar la base de conocimiento: ${err.message}</div>`;
    }
  }

  checkGemini();

  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.q;
      if (q) { inputField.value = q; handleSend(); }
    });
  });

  sendBtn.addEventListener('click', handleSend);
  inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetChat);
  }
}

function resetChat() {
  history.length = 0;
  chartCounter = 0;
  while (chatArea.firstChild) chatArea.removeChild(chatArea.firstChild);
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

function addWelcome(data) {
  const s = data.stats || {};
  const total = s.total_modelos || 333;
  const motor = s.motor_ganador || 'DeepAR';

  const md =
    `¡Hola! Soy el asistente de la **Base de Conocimiento EpiForecast-MX**. ` +
    `Tengo acceso a los datos de **${total} modelos** de producción.\n\n` +
    `Pregúntame sobre métricas, padecimientos, pronósticos, el equipo o datos históricos del boletín epidemiológico.`;

  const suggestions = [
    { text: 'Métricas globales', q: 'metricas globales' },
    { text: '¿Qué es la depresión?', q: 'que es la depresion' },
    { text: 'Ranking de modelos', q: 'ranking mejores modelos' },
    { text: 'Equipo del proyecto', q: 'equipo del proyecto' },
  ];

  addBotMessage(md, 'local', suggestions);
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

let lastChartQuery = '';

async function handleSend() {
  const text = inputField.value.trim();
  if (!text) return;
  inputField.value = '';
  addUserMessage(text);

  let result = null;
  try { result = await answer(text); } catch (err) { console.error('KB error:', err); }

  if (result) {
    let chartData = null;
    try {
      chartData = extractChartData(result, text);
      // If no chart but we had a previous chart query, try merging context
      if (!chartData && lastChartQuery) {
        const ent = detectEntities(text);
        if (ent._years && ent._years.length) {
          const merged = lastChartQuery.replace(/\b20[0-3]\d\b/g, '') + ' ' + text;
          chartData = extractChartData(result, merged);
        }
      }
    } catch (err) {
      console.error('extractChartData error:', err);
    }
    if (chartData) lastChartQuery = text;
    const suggestions = getSuggestions(text);
    addBotMessage(result, 'local', suggestions, chartData);
    pushHistory(text, result);
    return;
  }

  const typingEl = addTypingIndicator();
  try {
    const resp = await fetch('/.netlify/functions/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, history: history.slice(-MAX_HISTORY) }),
    });
    removeTyping(typingEl);
    if (resp.ok) {
      const data = await resp.json();
      addBotMessage(data.answer || 'Sin respuesta.', 'ai');
      pushHistory(text, data.answer || '');
    } else {
      const errData = await resp.json().catch(() => ({}));
      console.warn('Gemini response error:', resp.status, errData);
      if (resp.status === 500 && errData.detail) {
        addBotMessage(
          `No pude consultar la IA en este momento.\n\n**Error:** ${errData.detail}\n\n` +
          'Mientras tanto, prueba con preguntas sobre el proyecto como "metricas globales" o "equipo del proyecto".',
          'error'
        );
      } else {
        addBotMessage(noMatchMessage(), 'local');
      }
    }
  } catch (err) {
    removeTyping(typingEl);
    console.warn('Gemini fetch error:', err);
    addBotMessage(
      'No pude conectar con el servicio de IA.\n\n' +
      'Puedo responder preguntas sobre datos del proyecto. Prueba: "metricas globales", "equipo" o "depresion en Jalisco".',
      'error'
    );
  }
}

// ---------------------------------------------------------------------------
// Message rendering
// ---------------------------------------------------------------------------

function addUserMessage(text) {
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
  scrollToBottom();
}

function addBotMessage(markdown, source, suggestions, chartData) {
  const div = document.createElement('div');
  div.className = 'msg msg-bot';

  let badgeClass = 'badge-local';
  let badgeText = 'Datos reales';
  if (source === 'ai') { badgeClass = 'badge-ai'; badgeText = 'IA'; }
  else if (source === 'error') { badgeClass = 'badge-ai'; badgeText = 'Error'; }

  const cleanMarkdown = markdown.replace(/<!--COMPARE:.*?-->/g, '').replace(/<!--DISTRIB:.*?-->/g, '').replace(/<!--GENCHART:.*?-->/g, '');
  const html = marked.parse(cleanMarkdown, { breaks: true });
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  let suggestionsHtml = '';
  if (suggestions && suggestions.length) {
    suggestionsHtml = '<div class="msg-suggestions">' +
      suggestions.map(s => `<button data-q="${escapeAttr(s.q)}">${escapeHtml(s.text)}</button>`).join('') +
      '</div>';
  }

  let chartHtml = '';
  const chartList = chartData ? (Array.isArray(chartData) ? chartData : [chartData]) : [];
  if (chartList.length) {
    const ids = chartList.map(() => `chart-${++chartCounter}`);
    if (chartList.length > 1) {
      chartHtml = `<div class="msg-chart-grid">` +
        ids.map(id => `<div class="msg-chart-container"><canvas id="${id}"></canvas></div>`).join('') +
        `</div>`;
    } else {
      chartHtml = `<div class="msg-chart-container"><canvas id="${ids[0]}"></canvas></div>`;
    }
  }

  div.innerHTML = `
    <div class="msg-avatar">
      <img src="EPI.jpg" alt="EpiForecast-MX" />
    </div>
    <div class="msg-body">
      <div class="msg-meta">
        <span class="msg-name">EpiForecast-MX</span>
        <span class="msg-source ${badgeClass}">${badgeText}</span>
        <span class="msg-time">${timeStr}</span>
      </div>
      <div class="msg-bubble-bot">
        <div class="msg-content">${html}</div>
        ${chartHtml}
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

  // Render charts
  if (chartList.length) {
    requestAnimationFrame(() => {
      chartList.forEach((cd, i) => {
        const id = chartCounter - chartList.length + 1 + i;
        renderChart(`chart-${id}`, cd);
      });
    });
  }

  scrollToBottom();
}

function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'msg msg-bot';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar">
      <img src="EPI.jpg" alt="EpiForecast-MX" />
    </div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">EpiForecast-MX</span></div>
      <div class="msg-bubble-bot"><div class="typing"><span></span><span></span><span></span></div></div>
    </div>`;
  chatArea.appendChild(div);
  scrollToBottom();
  return div;
}

function removeTyping(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

// ---------------------------------------------------------------------------
// Chart.js integration
// ---------------------------------------------------------------------------

/**
 * Genera grafico de tendencia historica.
 * Para el ultimo anio (2026) separa dato real parcial vs proyectado (real + pronostico restante).
 * El tramo proyectado se muestra como linea punteada.
 */
function buildTrendChart(data, qn) {
  const anual = data.boletin?.anual_por_pad;
  if (!anual) return null;

  const wc = data.weekly_comparison || {};
  const pads = Object.keys(anual);
  let allYears = new Set();
  pads.forEach(pad => Object.keys(anual[pad]).forEach(y => allYears.add(y)));
  allYears = [...allYears].sort();

  // Calcular proyeccion 2026 por padecimiento: real parcial + pronostico restante
  const projected2026 = {};
  for (const pad of pads) {
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
        label: pad + ' (real)',
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
        label: pad + ' (pronostico)',
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

  return { type: 'line', title: 'Evolución histórica de incidencia', labels, datasets };
}

function extractChartData(markdown, query) {
  const data = getData();
  if (!data) return null;
  const s = data.stats || {};
  const qn = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
          title: `${dn(wk.pad)} ${wk.anio}: Real vs Pronostico`,
          labels,
          datasets: [
            {
              label: 'Real',
              data: realData,
              backgroundColor: '#2EC4A8CC',
              borderColor: '#2EC4A8',
              borderWidth: 2,
              borderRadius: 4,
              order: 1,
            },
            {
              label: `Pronostico (${wk.modelo})`,
              data: pronData,
              backgroundColor: '#D4A84BCC',
              borderColor: '#D4A84B',
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
        title: `Distribucion de ${dist.metric} por padecimiento`,
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
      if (cmp.length >= 2) {
        // Check if all states have per-padecimiento breakdown
        const hasPadBreakdown = cmp.some(c => c.models && c.models.length > 1);
        if (hasPadBreakdown) {
          // Grouped bar: each state, one bar per padecimiento
          const pads = [...new Set(cmp.flatMap(c => c.models.map(m => m.pad)))];
          return {
            type: 'bar',
            title: `Comparativa: ${cmp.map(c => c.estado).join(' vs ')}`,
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
        } else {
          // Simple bar: total per state
          return {
            type: 'bar',
            title: `Comparativa: ${cmp.map(c => c.estado).join(' vs ')}`,
            labels: cmp.map(c => c.estado),
            datasets: [{
              label: 'Casos pronosticados (52 sem)',
              data: cmp.map(c => c.total),
              backgroundColor: CHART_COLORS.slice(0, cmp.length).map(c => c + 'CC'),
              borderColor: CHART_COLORS.slice(0, cmp.length),
              borderWidth: 1,
              borderRadius: 4,
            }],
          };
        }
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
          { label: 'SMAPE medio', data: Object.values(pm).map(v => v.smape_mean), backgroundColor: '#2EC4A8CC', borderRadius: 6 },
          { label: 'SMAPE mediano', data: Object.values(pm).map(v => v.smape_median), backgroundColor: '#D4A84BCC', borderRadius: 6 },
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
          backgroundColor: ['#2EC4A8', '#D4A84B', '#C83A5A'],
          borderWidth: 0,
        }],
      };
    }
  }

  // Tendencia historica -> line
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
            backgroundColor: ['#2EC4A8', '#D4A84B', '#C83A5A'],
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
      const padColors = { Depresion: '#2EC4A8', Parkinson: '#D4A84B', Alzheimer: '#C83A5A' };
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
          title: `${pad} - pronóstico semanal (${info.modelo_productivo || ''})`,
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
            pointBackgroundColor: allYears.map(y => ent._years.includes(Number(y)) ? '#C83A5A' : CHART_COLORS[i]),
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
            backgroundColor: ['#2EC4A8', '#D4A84B', '#C83A5A'], borderRadius: 6 }],
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
            backgroundColor: ['#2EC4A8', '#D4A84B'],
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
            backgroundColor: ['#2EC4A8', '#D4A84B'],
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

  const isHorizontal = chartData.horizontal;
  const config = {
    type: chartData.type,
    data: { labels: chartData.labels, datasets: chartData.datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: isHorizontal ? 'y' : 'x',
      plugins: {
        title: {
          display: true,
          text: chartData.title,
          font: { size: 14, weight: '700', family: 'Outfit' },
          color: '#E8F0EC',
          padding: { bottom: 16 }
        },
        legend: {
          display: chartData.datasets.length > 1 || chartData.type === 'doughnut',
          position: chartData.type === 'doughnut' ? 'right' : 'top',
          labels: {
            font: { size: 12, family: 'Outfit' },
            color: '#8FA99D',
            usePointStyle: true,
            padding: 16,
            boxWidth: 8,
            filter: () => true,
          },
        },
      },
      scales: chartData.type === 'doughnut' ? {} : {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11, family: 'Outfit' }, color: '#8FA99D' },
          border: { display: false }
        },
        y: {
          grid: { color: 'rgba(46, 196, 168, 0.1)', drawBorder: false },
          ticks: { font: { size: 11, family: 'Outfit' }, color: '#8FA99D' },
          border: { display: false }
        },
      },
    },
  };

  // Merge custom options (e.g. axis titles from distribution charts)
  if (chartData.options?.scales) {
    for (const [axis, opts] of Object.entries(chartData.options.scales)) {
      if (config.options.scales[axis]) {
        Object.assign(config.options.scales[axis], opts);
        // Style axis titles
        if (opts.title) {
          config.options.scales[axis].title = {
            ...opts.title,
            font: { size: 12, family: 'Outfit' },
            color: '#8FA99D',
          };
        }
      }
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
    return [{ text: 'Tendencia histórica', q: 'tendencia historica de depresion' }, { text: 'Pronóstico', q: 'pronostico depresion' }];
  if (q.includes('parkinson'))
    return [{ text: 'Tendencia histórica', q: 'tendencia historica de parkinson' }, { text: 'Pronóstico', q: 'pronostico parkinson' }];
  if (q.includes('alzheimer'))
    return [{ text: 'Tendencia histórica', q: 'tendencia historica de alzheimer' }, { text: 'Pronóstico', q: 'pronostico alzheimer' }];
  if (q.includes('ranking'))
    return [{ text: 'Métricas globales', q: 'metricas globales' }, { text: 'Comparativa motores', q: 'comparativa de motores' }];
  if (q.includes('equipo'))
    return [{ text: 'Infraestructura', q: 'infraestructura del proyecto' }, { text: 'Alcance', q: 'que padecimientos modela' }];
  if (q.includes('tendencia'))
    return [{ text: 'Resumen 2024', q: 'resumen epidemiologico 2024' }, { text: 'Ranking entidades', q: 'ranking entidades por incidencia' }];
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noMatchMessage() {
  return (
    'No encontré una respuesta para esa pregunta en la base de conocimiento.\n\n' +
    'Prueba con preguntas como:\n' +
    '- "métricas globales" o "ranking mejores modelos"\n' +
    '- "qué es la depresión" o "depresión en Jalisco"\n' +
    '- "equipo del proyecto" o "infraestructura"\n' +
    '- "tendencia histórica de parkinson"\n' +
    '- "configuración de DeepAR"\n\n' +
    'También puedes usar los botones de acceso rápido de arriba.'
  );
}

function pushHistory(userText, botText) {
  history.push({ role: 'user', text: userText });
  history.push({ role: 'assistant', text: botText.substring(0, 300) });
  while (history.length > MAX_HISTORY * 2) history.shift();
}

function scrollToBottom() {
  requestAnimationFrame(() => { chatArea.scrollTop = chatArea.scrollHeight; });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
