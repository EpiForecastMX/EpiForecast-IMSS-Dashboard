import { dn } from './display.js?v=1';
/**
 * semaforo.js — Semaforo epidemiologico de 32 entidades federativas.
 * Renderiza una cuadricula de tarjetas por estado, codificadas por nivel de riesgo.
 */

const RISK_COLORS = {
  verde: '#5B8DEF',
  amarillo: '#2DD4BF',
  naranja: '#E67E22',
  rojo: '#F472B6',
};

const RISK_ORDER = { rojo: 0, naranja: 1, amarillo: 2, verde: 3 };

const TREND_SVGS = {
  up: '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 2L10 8H2Z" fill="#F472B6"/></svg>',
  down: '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M6 10L2 4H10Z" fill="#5B8DEF"/></svg>',
  stable: '<svg viewBox="0 0 12 12" width="12" height="12"><line x1="2" y1="6" x2="10" y2="6" stroke="#6E82A6" stroke-width="2"/></svg>',
};

const WARNING_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" style="flex-shrink:0;margin-right:6px;vertical-align:middle">
  <path d="M8 1L15 14H1Z" fill="none" stroke="#F472B6" stroke-width="1.4" stroke-linejoin="round"/>
  <line x1="8" y1="6" x2="8" y2="10" stroke="#F472B6" stroke-width="1.4" stroke-linecap="round"/>
  <circle cx="8" cy="12.2" r="0.8" fill="#F472B6"/>
</svg>`;

/**
 * Convert a hex color to an rgba string.
 */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Return a color for the SMAPE value.
 */
function smapeColor(smape) {
  if (smape < 20) return '#5B8DEF';
  if (smape <= 40) return '#2DD4BF';
  return '#F472B6';
}

/**
 * Format a number with locale-aware thousand separators.
 */
function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('es-MX');
}

/**
 * Build the inline styles block and inject it into the wrapper.
 */
function injectStyles(wrapper) {
  const style = document.createElement('style');
  style.textContent = `
    .semaforo-wrapper {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      color: #E7ECF5;
      max-width: 1200px;
      margin: 0 auto;
    }

    .semaforo-title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #E7ECF5;
    }

    /* ---- Summary bar ---- */
    .semaforo-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .semaforo-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      background: rgba(255,255,255,0.06);
    }

    .semaforo-badge-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ---- Alerts ---- */
    .semaforo-alerts {
      background: rgba(244,114,182,0.1);
      border-left: 3px solid #F472B6;
      padding: 8px 12px;
      margin-bottom: 16px;
      border-radius: 0 6px 6px 0;
    }

    .semaforo-alert-item {
      display: flex;
      align-items: center;
      font-size: 12px;
      color: #E7ECF5;
      padding: 3px 0;
    }

    /* ---- Grid ---- */
    .semaforo-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    @media (max-width: 768px) {
      .semaforo-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* ---- Card ---- */
    .semaforo-card {
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .semaforo-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }

    .semaforo-card-header {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .semaforo-card-name {
      font-size: 13px;
      font-weight: 700;
      color: #E7ECF5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .semaforo-card-casos {
      font-size: 16px;
      font-weight: 700;
      color: #E7ECF5;
    }

    .semaforo-card-pads {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 10px;
      color: #6E82A6;
    }

    .semaforo-pad-item {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }

    .semaforo-pad-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .semaforo-smape-pill {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: 10px;
      line-height: 16px;
      align-self: flex-start;
    }
  `;
  wrapper.prepend(style);
}

/**
 * Build the summary bar element.
 */
function buildSummary(summary) {
  const bar = document.createElement('div');
  bar.className = 'semaforo-summary';

  const levels = ['verde', 'amarillo', 'naranja', 'rojo'];
  for (const level of levels) {
    const count = summary[level] ?? 0;
    const badge = document.createElement('span');
    badge.className = 'semaforo-badge';
    badge.innerHTML =
      `<span class="semaforo-badge-dot" style="background:${RISK_COLORS[level]}"></span>` +
      `<span>${count}</span>` +
      `<span style="font-weight:400">estados</span>`;
    bar.appendChild(badge);
  }

  return bar;
}

/**
 * Build the alerts section element.
 */
function buildAlerts(alerts) {
  if (!alerts || alerts.length === 0) return null;

  const section = document.createElement('div');
  section.className = 'semaforo-alerts';

  const shown = alerts.slice(0, 5);
  for (const msg of shown) {
    const row = document.createElement('div');
    row.className = 'semaforo-alert-item';
    row.innerHTML = `${WARNING_ICON}<span>${msg}</span>`;
    section.appendChild(row);
  }

  return section;
}

/**
 * Build a single state card element.
 */
function buildCard(state) {
  const riskColor = RISK_COLORS[state.riskLevel] || RISK_COLORS.verde;

  const card = document.createElement('div');
  card.className = 'semaforo-card';
  card.style.borderLeft = `4px solid ${riskColor}`;
  card.style.background = hexToRgba(riskColor, 0.08);

  // Header: name + trend
  const header = document.createElement('div');
  header.className = 'semaforo-card-header';

  const nameEl = document.createElement('span');
  nameEl.className = 'semaforo-card-name';
  nameEl.textContent = dn(state.name);
  header.appendChild(nameEl);

  const trendHtml = TREND_SVGS[state.trend] || TREND_SVGS.stable;
  const trendSpan = document.createElement('span');
  trendSpan.innerHTML = trendHtml;
  trendSpan.style.display = 'inline-flex';
  trendSpan.style.alignItems = 'center';
  header.appendChild(trendSpan);

  card.appendChild(header);

  // Total cases
  const casosEl = document.createElement('div');
  casosEl.className = 'semaforo-card-casos';
  casosEl.textContent = fmtNum(state.casos);
  card.appendChild(casosEl);

  // Padecimiento breakdown
  if (state.pads) {
    const padsRow = document.createElement('div');
    padsRow.className = 'semaforo-card-pads';

    const items = [
      { label: 'Dep', color: '#5B8DEF', value: state.pads.Depresion },
      { label: 'Par', color: '#2DD4BF', value: state.pads.Parkinson },
      { label: 'Alz', color: '#F472B6', value: state.pads.Alzheimer },
    ];

    for (const item of items) {
      const span = document.createElement('span');
      span.className = 'semaforo-pad-item';
      span.innerHTML =
        `<span class="semaforo-pad-dot" style="background:${item.color}"></span>` +
        `<span>${item.label} ${fmtNum(item.value)}</span>`;
      padsRow.appendChild(span);
    }

    card.appendChild(padsRow);
  }

  // SMAPE pill
  if (state.smape != null) {
    const pill = document.createElement('span');
    pill.className = 'semaforo-smape-pill';
    const sc = smapeColor(state.smape);
    pill.style.background = hexToRgba(sc, 0.18);
    pill.style.color = sc;
    pill.textContent = `SMAPE ${state.smape.toFixed(1)}%`;
    card.appendChild(pill);
  }

  return card;
}

/**
 * Sort states: rojo first, then naranja, amarillo, verde.
 * Within the same risk level, sort by cases descending.
 */
function sortStates(states) {
  return [...states].sort((a, b) => {
    const orderA = RISK_ORDER[a.riskLevel] ?? 3;
    const orderB = RISK_ORDER[b.riskLevel] ?? 3;
    if (orderA !== orderB) return orderA - orderB;
    return (b.casos || 0) - (a.casos || 0);
  });
}

/**
 * Render the semaforo epidemiologico.
 *
 * @param {HTMLElement} container  DOM element to append into
 * @param {object}      semaforoData  { states, alerts, summary }
 * @param {object}      opts          { title }
 */
export function renderSemaforo(container, semaforoData, opts = {}) {
  const { states = [], alerts = [], summary = {} } = semaforoData;
  const { title = 'Semáforo epidemiológico' } = opts;

  const wrapper = document.createElement('div');
  wrapper.className = 'semaforo-wrapper';

  // Scoped styles
  injectStyles(wrapper);

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'semaforo-title';
  titleEl.textContent = title;
  wrapper.appendChild(titleEl);

  // Summary bar
  wrapper.appendChild(buildSummary(summary));

  // Alerts
  const alertsEl = buildAlerts(alerts);
  if (alertsEl) {
    wrapper.appendChild(alertsEl);
  }

  // Grid of state cards
  const grid = document.createElement('div');
  grid.className = 'semaforo-grid';

  const sorted = sortStates(states);
  for (const state of sorted) {
    grid.appendChild(buildCard(state));
  }

  wrapper.appendChild(grid);
  container.appendChild(wrapper);
}
