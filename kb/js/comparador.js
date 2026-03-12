/**
 * comparador.js
 * Renders a side-by-side comparison of two Mexican states
 * for the EpiForecast epidemiological dashboard.
 */

const PAD_COLORS = {
  Depresion: '#2EC4A8',
  Parkinson: '#D4A84B',
  Alzheimer: '#C83A5A',
};

const CROWN_SVG =
  '<svg viewBox="0 0 14 14" width="14" height="14"><polygon points="7,1 9,5 13,5.5 10,8.5 11,12.5 7,10.5 3,12.5 4,8.5 1,5.5 5,5" fill="#D4A84B"/></svg>';

/**
 * Build the inline <style> block for the comparador component.
 */
function buildStyles() {
  return `
    .comparador-wrapper {
      max-width: 700px;
      margin: 0 auto;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      color: #EDF3EF;
    }

    .comparador-title {
      text-align: center;
      font-size: 16px;
      font-weight: 600;
      color: #EDF3EF;
      margin-bottom: 20px;
      letter-spacing: 0.3px;
    }

    .comparador-split {
      display: flex;
      flex-direction: row;
      gap: 0;
    }

    .comparador-col {
      flex: 1;
      padding: 16px;
      border-radius: 8px;
      transition: box-shadow 0.3s ease;
    }

    .comparador-col--winner {
      box-shadow: 0 0 12px rgba(46, 196, 168, 0.2);
    }

    .comparador-divider {
      width: 1px;
      background: rgba(46, 196, 168, 0.15);
      align-self: stretch;
      flex-shrink: 0;
    }

    .comparador-header {
      margin-bottom: 14px;
    }

    .comparador-header__name {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 18px;
      font-weight: 700;
      color: #EDF3EF;
      line-height: 1.3;
    }

    .comparador-header__crown {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }

    .comparador-header__cases {
      font-size: 22px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-weight: 600;
      color: #2EC4A8;
      margin-top: 4px;
    }

    .comparador-metrics {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12px;
    }

    .comparador-metrics td {
      padding: 5px 8px;
    }

    .comparador-metrics tr:nth-child(odd) td {
      background: rgba(46, 196, 168, 0.04);
    }

    .comparador-metrics__label {
      color: #7A9A8D;
      white-space: nowrap;
    }

    .comparador-metrics__value {
      color: #EDF3EF;
      text-align: right;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }

    .comparador-pads {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .comparador-pad__label {
      font-size: 11px;
      color: #7A9A8D;
      margin-bottom: 3px;
    }

    .comparador-pad__bar-track {
      width: 100%;
      height: 18px;
      background: rgba(46, 196, 168, 0.06);
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }

    .comparador-pad__bar-fill {
      height: 100%;
      border-radius: 4px;
      min-width: 2px;
      transition: width 0.4s ease;
    }

    .comparador-pad__bar-value {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 11px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      color: #EDF3EF;
    }

    .comparador-pad__smape {
      font-size: 10px;
      color: #7A9A8D;
      margin-top: 2px;
    }

    .comparador-versus {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(46, 196, 168, 0.1);
    }

    .comparador-versus__title {
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      color: #7A9A8D;
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .comparador-versus__row {
      margin-bottom: 14px;
    }

    .comparador-versus__labels {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #7A9A8D;
      margin-bottom: 4px;
    }

    .comparador-versus__pad-name {
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: #EDF3EF;
      margin-bottom: 4px;
    }

    .comparador-versus__dual-track {
      display: flex;
      height: 16px;
      border-radius: 4px;
      overflow: hidden;
      background: rgba(46, 196, 168, 0.04);
    }

    .comparador-versus__bar-left {
      display: flex;
      justify-content: flex-end;
      height: 100%;
      flex-basis: 50%;
    }

    .comparador-versus__bar-right {
      display: flex;
      justify-content: flex-start;
      height: 100%;
      flex-basis: 50%;
    }

    .comparador-versus__bar-fill-left {
      height: 100%;
      border-radius: 4px 0 0 4px;
      transition: width 0.4s ease;
      min-width: 1px;
    }

    .comparador-versus__bar-fill-right {
      height: 100%;
      border-radius: 0 4px 4px 0;
      transition: width 0.4s ease;
      min-width: 1px;
    }

    .comparador-versus__center-line {
      width: 2px;
      background: rgba(237, 243, 239, 0.2);
      flex-shrink: 0;
    }

    .comparador-versus__values {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      color: #7A9A8D;
      margin-top: 3px;
    }
  `;
}

/**
 * Compute the maximum cases per padecimiento across both states,
 * used to normalise bar widths.
 */
function getMaxPerPad(stateA, stateB) {
  const maxes = {};
  for (const pad of Object.keys(PAD_COLORS)) {
    const a = stateA.pads[pad] ? stateA.pads[pad].casos : 0;
    const b = stateB.pads[pad] ? stateB.pads[pad].casos : 0;
    maxes[pad] = Math.max(a, b, 1);
  }
  return maxes;
}

/**
 * Render one state column.
 */
function buildColumn(state, isWinner, maxPerPad) {
  const winnerClass = isWinner ? ' comparador-col--winner' : '';

  const crownHtml = isWinner
    ? `<span class="comparador-header__crown">${CROWN_SVG}</span>`
    : '';

  const padsHtml = Object.keys(PAD_COLORS)
    .map((pad) => {
      const data = state.pads[pad];
      if (!data) return '';

      const pct = Math.max((data.casos / maxPerPad[pad]) * 100, 0);
      const color = PAD_COLORS[pad];

      return `
        <div>
          <div class="comparador-pad__label">${pad} &middot; ${data.motor}</div>
          <div class="comparador-pad__bar-track">
            <div class="comparador-pad__bar-fill"
                 style="width:${pct.toFixed(1)}%;background:${color}"></div>
            <span class="comparador-pad__bar-value">${data.casos.toLocaleString()}</span>
          </div>
          <div class="comparador-pad__smape">SMAPE ${data.smape.toFixed(1)}%</div>
        </div>`;
    })
    .join('');

  return `
    <div class="comparador-col${winnerClass}">
      <div class="comparador-header">
        <div class="comparador-header__name">
          ${crownHtml}
          <span>${state.name}</span>
        </div>
        <div class="comparador-header__cases">${state.casos.toLocaleString()}</div>
      </div>

      <table class="comparador-metrics">
        <tr>
          <td class="comparador-metrics__label">SMAPE promedio</td>
          <td class="comparador-metrics__value">${state.smape.toFixed(1)}%</td>
        </tr>
        <tr>
          <td class="comparador-metrics__label">Motor principal</td>
          <td class="comparador-metrics__value">${state.motor}</td>
        </tr>
      </table>

      <div class="comparador-pads">
        ${padsHtml}
      </div>
    </div>`;
}

/**
 * Build the head-to-head versus section below the split.
 */
function buildVersus(stateA, stateB) {
  const pads = Object.keys(PAD_COLORS);

  const rowsHtml = pads
    .map((pad) => {
      const a = stateA.pads[pad] ? stateA.pads[pad].casos : 0;
      const b = stateB.pads[pad] ? stateB.pads[pad].casos : 0;
      const total = Math.max(a + b, 1);
      const pctA = (a / total) * 100;
      const pctB = (b / total) * 100;
      const color = PAD_COLORS[pad];

      return `
        <div class="comparador-versus__row">
          <div class="comparador-versus__pad-name">${pad}</div>
          <div class="comparador-versus__labels">
            <span>${stateA.name}</span>
            <span>${stateB.name}</span>
          </div>
          <div class="comparador-versus__dual-track">
            <div class="comparador-versus__bar-left">
              <div class="comparador-versus__bar-fill-left"
                   style="width:${pctA.toFixed(1)}%;background:${color};opacity:0.85"></div>
            </div>
            <div class="comparador-versus__center-line"></div>
            <div class="comparador-versus__bar-right">
              <div class="comparador-versus__bar-fill-right"
                   style="width:${pctB.toFixed(1)}%;background:${color};opacity:0.65"></div>
            </div>
          </div>
          <div class="comparador-versus__values">
            <span>${a.toLocaleString()}</span>
            <span>${b.toLocaleString()}</span>
          </div>
        </div>`;
    })
    .join('');

  return `
    <div class="comparador-versus">
      <div class="comparador-versus__title">Comparativa por padecimiento</div>
      ${rowsHtml}
    </div>`;
}

/**
 * Render the full comparador component into a container element.
 *
 * @param {HTMLElement} container - DOM element to append the comparador to
 * @param {Object} comparadorData - { stateA, stateB, winner }
 * @param {Object} opts - { title }
 */
export function renderComparador(container, comparadorData, opts) {
  const { stateA, stateB, winner } = comparadorData;
  const title = (opts && opts.title) || '';

  const maxPerPad = getMaxPerPad(stateA, stateB);

  const isWinnerA = winner === 'A';
  const isWinnerB = winner === 'B';

  const titleHtml = title
    ? `<div class="comparador-title">${title}</div>`
    : '';

  const html = `
    <style>${buildStyles()}</style>
    <div class="comparador-wrapper">
      ${titleHtml}
      <div class="comparador-split">
        ${buildColumn(stateA, isWinnerA, maxPerPad)}
        <div class="comparador-divider"></div>
        ${buildColumn(stateB, isWinnerB, maxPerPad)}
      </div>
      ${buildVersus(stateA, stateB)}
    </div>`;

  const fragment = document.createElement('div');
  fragment.innerHTML = html;
  container.appendChild(fragment);
}
