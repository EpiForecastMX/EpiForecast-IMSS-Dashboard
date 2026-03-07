/**
 * app.js - UI conversacional EpiForecast-MX con graficas en vivo.
 *
 * Carga knowledge.json, renderiza stats cards, maneja chat con kb.js local,
 * detecta datos tabulares para renderizar Chart.js inline,
 * y fallback a Gemini via Netlify Function.
 */

import { loadKnowledge, getStats, getData, answer } from './kb.js?v=6';

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

// Paleta mejorada basada en el logo
const CHART_COLORS = [
  '#4A5D23', // verde olivo
  '#BC955C', // dorado
  '#C07850', // terracota
  '#5B8A8A', // teal
  '#7D9A4C', // verde claro
  '#9A7A4A', // dorado oscuro
  '#8B6E5A', // marron
  '#6B8E8E', // teal claro
  '#5C7A2A', // verde medio
  '#D4A574', // dorado claro
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
      <span>Gemini activo</span>`;
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
    `Hola! Soy el asistente de la **Base de Conocimiento EpiForecast-MX**. ` +
    `Tengo acceso a los datos de **${total} modelos** de producción.\n\n` +
    `Pregúntame sobre métricas, padecimientos, pronósticos, el equipo o datos históricos del boletín epidemiológico.`;

  const suggestions = [
    { text: 'Métricas globales', q: 'metricas globales' },
    { text: 'Qué es la depresión?', q: 'que es la depresion' },
    { text: 'Ranking de modelos', q: 'ranking mejores modelos' },
    { text: 'Equipo del proyecto', q: 'equipo del proyecto' },
  ];

  addBotMessage(md, 'local', suggestions);
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

async function handleSend() {
  const text = inputField.value.trim();
  if (!text) return;
  inputField.value = '';
  addUserMessage(text);

  let result = null;
  try { result = await answer(text); } catch (err) { console.error('KB error:', err); }

  if (result) {
    const chartData = extractChartData(result, text);
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
        <span class="msg-name">Tu</span>
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

  const html = marked.parse(markdown, { breaks: true });
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  let suggestionsHtml = '';
  if (suggestions && suggestions.length) {
    suggestionsHtml = '<div class="msg-suggestions">' +
      suggestions.map(s => `<button data-q="${escapeAttr(s.q)}">${escapeHtml(s.text)}</button>`).join('') +
      '</div>';
  }

  let chartHtml = '';
  if (chartData) {
    const canvasId = `chart-${++chartCounter}`;
    chartHtml = `<div class="msg-chart-container"><canvas id="${canvasId}"></canvas></div>`;
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

  // Render chart
  if (chartData) {
    const canvasId = `chart-${chartCounter}`;
    requestAnimationFrame(() => renderChart(canvasId, chartData));
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

function extractChartData(markdown, query) {
  const data = getData();
  if (!data) return null;
  const s = data.stats || {};
  const qn = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
        title: 'SMAPE por motor de prediccion',
        labels: Object.keys(pm),
        datasets: [
          { label: 'SMAPE medio', data: Object.values(pm).map(v => v.smape_mean), backgroundColor: '#4A5D23CC', borderRadius: 6 },
          { label: 'SMAPE mediano', data: Object.values(pm).map(v => v.smape_median), backgroundColor: '#BC955CCC', borderRadius: 6 },
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
        title: 'Diagnostico de overfitting',
        labels: ['OK', 'Moderado', 'Alto'],
        datasets: [{
          data: [s.overfitting_ok || 0, s.overfitting_moderado || 0, s.overfitting_alto || 0],
          backgroundColor: ['#4A5D23', '#BC955C', '#C07850'],
          borderWidth: 0,
        }],
      };
    }
  }

  // Tendencia historica -> line
  if (qn.includes('tendencia') || qn.includes('historica') || qn.includes('evolucion')) {
    const anual = data.boletin?.anual_por_pad;
    if (anual) {
      // Find which pad
      const pads = Object.keys(anual);
      const datasets = [];
      let allYears = new Set();
      pads.forEach((pad, i) => {
        const years = Object.keys(anual[pad]).sort();
        years.forEach(y => allYears.add(y));
        // Only include the detected pad or all if none specific
        const padInQuery = qn.includes(pad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
        if (padInQuery || !pads.some(p => qn.includes(p.toLowerCase()))) {
          datasets.push({
            label: pad,
            data: years.map(y => anual[pad][y]),
            borderColor: CHART_COLORS[i],
            backgroundColor: CHART_COLORS[i] + '22',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: CHART_COLORS[i],
          });
        }
      });
      allYears = [...allYears].sort();
      if (datasets.length) {
        // Re-align data to allYears
        datasets.forEach(ds => {
          const padData = anual[ds.label];
          ds.data = allYears.map(y => padData[y] || 0);
        });
        return {
          type: 'line',
          title: 'Evolucion historica de incidencia',
          labels: allYears,
          datasets,
        };
      }
    }
  }

  // Pronostico por padecimiento -> donut
  if (qn.includes('pronostico') && !qn.includes('semana')) {
    const pp = s.por_pad;
    if (pp) {
      const entries = Object.entries(pp).filter(([, v]) => v.casos_futuro_total);
      if (entries.length) {
        return {
          type: 'doughnut',
          title: 'Pronostico 52 semanas por padecimiento',
          labels: entries.map(([k]) => k),
          datasets: [{
            data: entries.map(([, v]) => v.casos_futuro_total),
            backgroundColor: CHART_COLORS.slice(0, entries.length),
            borderWidth: 0,
          }],
        };
      }
    }
  }

  // Distribucion de motores -> donut
  if (s.dist_motor && (qn.includes('distribucion') || qn.includes('conteo') || qn.includes('cuantos modelo'))) {
    return {
      type: 'doughnut',
      title: 'Distribucion de motores',
      labels: Object.keys(s.dist_motor),
      datasets: [{
        data: Object.values(s.dist_motor),
        backgroundColor: CHART_COLORS.slice(0, Object.keys(s.dist_motor).length),
        borderWidth: 0,
      }],
    };
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
          font: { size: 14, weight: '700', family: 'Inter' }, 
          color: '#2D2A26',
          padding: { bottom: 16 }
        },
        legend: {
          display: chartData.datasets.length > 1 || chartData.type === 'doughnut',
          position: chartData.type === 'doughnut' ? 'right' : 'top',
          labels: { 
            font: { size: 12, family: 'Inter' }, 
            usePointStyle: true, 
            padding: 16,
            boxWidth: 8,
          },
        },
      },
      scales: chartData.type === 'doughnut' ? {} : {
        x: { 
          grid: { display: false }, 
          ticks: { font: { size: 11, family: 'Inter' }, color: '#5C5650' },
          border: { display: false }
        },
        y: { 
          grid: { color: '#E5E2DA', drawBorder: false }, 
          ticks: { font: { size: 11, family: 'Inter' }, color: '#5C5650' },
          border: { display: false }
        },
      },
    },
  };

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
