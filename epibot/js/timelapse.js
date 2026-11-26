import { dn } from './display.js?v=1';
// timelapse.js — Animated timelapse choropleth map of Mexico (52 weeks)
// Imports state paths and viewBox from mexico-map.js

import { STATES, VIEWBOX, ubicaTooltip } from './mexico-map.js?v=6';

const PLAY_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
  + '<path d="M3 1.5L12 7L3 12.5V1.5Z" fill="currentColor"/>'
  + '</svg>';

const PAUSE_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
  + '<rect x="2.5" y="1.5" width="3" height="11" rx="0.5" fill="currentColor"/>'
  + '<rect x="8.5" y="1.5" width="3" height="11" rx="0.5" fill="currentColor"/>'
  + '</svg>';

const SPEED_OPTIONS = [
  { label: '1x', ms: 200 },
  { label: '2x', ms: 100 },
  { label: '4x', ms: 50 },
];

/**
 * Render an animated timelapse choropleth map of Mexico.
 * @param {HTMLElement} container - DOM element to append to
 * @param {Object} timelapseData - { frames: [{ week, stateData }, ...] }
 * @param {Object} opts - { title, lowColor, highColor, metric, padecimiento }
 */
export function renderTimelapse(container, timelapseData, opts = {}) {
  const {
    title = 'Timelapse - Pronóstico Semanal',
    lowColor = [30, 60, 50],
    highColor = [91, 141, 239],
    noDataColor = '#18223A',
    metric = 'casos',
  } = opts;

  const frames = timelapseData.frames;
  const totalFrames = frames.length;

  // Plan canónico 2.7 (26-nov-2026): la misma escala del mapa, de un solo tono, de claro (pocos) a oscuro (muchos) sobre el
  // fondo claro, en cinco clases por cuantiles de todos los cuadros (la escala no cambia al avanzar). La anterior era
  // oscura (fondo azul marino y extremo bajo verde oscuro). `lowColor`, `highColor` y `noDataColor` quedan por compatibilidad.
  void lowColor; void highColor; void noDataColor;
  const RAMPA = ['#e3efe9', '#b6d5c6', '#7fb39b', '#3f8a6a', '#17644d'];
  const SIN_DATO = '#f1f2f1';
  const todos = [];
  for (let f = 0; f < totalFrames; f++) {
    for (const d of Object.values(frames[f].stateData)) if (d && d.value != null) todos.push(d.value);
  }
  todos.sort((a, b) => a - b);
  const globalMin = todos.length ? todos[0] : 0;
  const globalMax = todos.length ? todos[todos.length - 1] : 1;
  const clases = Math.min(RAMPA.length, new Set(todos).size || 1);
  const cortes = Array.from({ length: clases }, (_, k) => todos[Math.min(todos.length - 1, Math.ceil(((k + 1) * todos.length) / clases) - 1)]);
  const paso = RAMPA.length / clases;
  const colorClase = (k) => RAMPA[Math.min(RAMPA.length - 1, Math.round((k + 1) * paso) - 1)];
  const colorDe = (val) => {
    if (val == null) return SIN_DATO;
    const k = cortes.findIndex((c) => val <= c);
    return colorClase(k < 0 ? clases - 1 : k);
  };

  // State
  let currentFrame = 0;
  let playing = false;
  let intervalId = null;
  let speedMs = SPEED_OPTIONS[0].ms;

  // --- DOM structure ---

  const wrapper = document.createElement('div');
  wrapper.className = 'timelapse-wrapper';

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'timelapse-title';
  titleEl.textContent = title;
  wrapper.appendChild(titleEl);

  // SVG map
  const svgWrap = document.createElement('div');
  svgWrap.className = 'timelapse-svg-wrap';
  wrapper.appendChild(svgWrap);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', VIEWBOX);
  svg.setAttribute('class', 'timelapse-svg');
  svgWrap.appendChild(svg);

  // Tooltip
  const tooltipEl = document.createElement('div');
  tooltipEl.className = 'mexico-map-tooltip';
  tooltipEl.style.display = 'none';
  wrapper.appendChild(tooltipEl);

  // Build state paths and store references for fast updates
  const pathElements = {};
  const etiqueta = (name) => {
    const fd = frames[currentFrame].stateData[name];
    return dn(name) + ': ' + (fd ? fd.label : 'sin datos');
  };
  for (const [name, pathD] of Object.entries(STATES)) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', SIN_DATO);
    path.setAttribute('stroke', '#ffffff');
    path.setAttribute('stroke-width', '0.8');
    path.setAttribute('data-state', name);
    path.style.transition = 'fill 0.15s';
    path.style.cursor = 'pointer';
    // Como en el mapa: cada estado se alcanza con el teclado y con un toque, y dice su cifra al lector de pantalla.
    path.setAttribute('tabindex', '0');
    path.setAttribute('role', 'button');

    const muestra = () => {
      path.setAttribute('stroke', '#173c33');
      path.setAttribute('stroke-width', '2.5');
      path.parentNode.appendChild(path);
      const frameData = frames[currentFrame].stateData[name];
      tooltipEl.innerHTML = '<strong>' + dn(name) + '</strong><br>' + (frameData ? frameData.label : 'Sin datos');
      tooltipEl.style.display = 'block';
    };
    const oculta = () => {
      path.setAttribute('stroke', '#ffffff');
      path.setAttribute('stroke-width', '0.8');
      tooltipEl.style.display = 'none';
    };
    const enElEstado = () => {
      const r = path.getBoundingClientRect(), rect = wrapper.getBoundingClientRect();
      ubicaTooltip(tooltipEl, wrapper, r.left + r.width / 2 - rect.left, r.top - rect.top);
    };
    path.addEventListener('mouseenter', muestra);
    path.addEventListener('focus', () => { muestra(); enElEstado(); });
    path.addEventListener('click', () => { muestra(); enElEstado(); });
    path.addEventListener('blur', oculta);
    path.addEventListener('mousemove', (e) => {
      const rect = wrapper.getBoundingClientRect();
      ubicaTooltip(tooltipEl, wrapper, e.clientX - rect.left, e.clientY - rect.top);
    });
    path.addEventListener('mouseleave', oculta);

    svg.appendChild(path);
    pathElements[name] = path;
  }

  // Week counter
  const weekDisplay = document.createElement('div');
  weekDisplay.className = 'timelapse-week';
  wrapper.appendChild(weekDisplay);

  // Slider
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'timelapse-slider';
  slider.min = '0';
  slider.max = String(totalFrames - 1);
  slider.value = '0';
  slider.setAttribute('aria-label', 'Semana del pronóstico');
  wrapper.appendChild(slider);

  // Controls bar
  const controls = document.createElement('div');
  controls.className = 'timelapse-controls';

  // Play/Pause button
  const playBtn = document.createElement('button');
  playBtn.className = 'timelapse-btn';
  playBtn.type = 'button';
  playBtn.innerHTML = PLAY_ICON;
  playBtn.setAttribute('aria-label', 'Reproducir');
  controls.appendChild(playBtn);

  // Speed buttons: el CSS espera `.timelapse-speed button`, así que los
  // botones van DENTRO de un contenedor con esa clase (antes la clase caía
  // en cada botón y quedaban sin estilo).
  const speedWrap = document.createElement('div');
  speedWrap.className = 'timelapse-speed';
  const speedButtons = [];
  for (let i = 0; i < SPEED_OPTIONS.length; i++) {
    const btn = document.createElement('button');
    btn.className = i === 0 ? 'active' : '';
    btn.type = 'button';
    btn.textContent = SPEED_OPTIONS[i].label;
    btn.setAttribute('aria-label', 'Velocidad ' + SPEED_OPTIONS[i].label);
    btn.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    btn.dataset.index = String(i);
    speedWrap.appendChild(btn);
    speedButtons.push(btn);
  }
  controls.appendChild(speedWrap);

  wrapper.appendChild(controls);

  // Legend (gradient bar, same style as mexico-map.js)
  const legend = document.createElement('div');
  legend.className = 'mexico-map-legend';

  const fmtN = (x) => Math.round(x).toLocaleString('es-MX');
  let barHtml = '<div class="mexico-map-legend-bar">';
  for (let k = 0; k < clases; k++) barHtml += '<span style="background:' + colorClase(k) + '"></span>';
  barHtml += '</div>';
  barHtml += '<div class="mexico-map-legend-labels">'
    + '<span>' + fmtN(globalMin) + '</span>'
    + '<span>' + metric + '</span>'
    + '<span>' + fmtN(globalMax) + '</span>'
    + '</div>'
    + '<div class="mexico-map-nota">Casos notificados, sin ajustar por población.</div>';
  legend.innerHTML = barHtml;
  wrapper.appendChild(legend);

  container.appendChild(wrapper);

  // --- Update logic ---

  function applyFrame(index) {
    currentFrame = index;
    const frame = frames[index];
    const weekNum = frame.week != null ? frame.week : index + 1;

    // Update paths
    for (const [name, pathEl] of Object.entries(pathElements)) {
      const sd = frame.stateData[name];
      const val = sd ? sd.value : null;
      pathEl.setAttribute('fill', colorDe(val));
      pathEl.setAttribute('aria-label', etiqueta(name));
    }

    // Update week display
    // La semana es la del boletín (p. ej. 38); el avance va aparte: «Semana 38 · 1 de 15».
    weekDisplay.textContent = 'Semana ' + String(weekNum).padStart(2, '0') + ' · ' + (index + 1) + ' de ' + totalFrames;

    // Update slider
    slider.value = String(index);
    slider.setAttribute('aria-valuetext', weekDisplay.textContent);
  }

  function tick() {
    // Anti-leak: si el SVG ya no está en el documento (chat limpiado o
    // mensaje retirado), el intervalo se cancela solo.
    if (!svg.isConnected) {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      playing = false;
      return;
    }
    let next = currentFrame + 1;
    if (next >= totalFrames) {
      next = 0;
    }
    applyFrame(next);
  }

  function startPlayback() {
    if (playing) return;
    playing = true;
    playBtn.innerHTML = PAUSE_ICON;
    playBtn.setAttribute('aria-label', 'Pausar');
    intervalId = setInterval(tick, speedMs);
  }

  function stopPlayback() {
    if (!playing) return;
    playing = false;
    playBtn.innerHTML = PLAY_ICON;
    playBtn.setAttribute('aria-label', 'Reproducir');
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function restartInterval() {
    if (!playing) return;
    if (intervalId != null) {
      clearInterval(intervalId);
    }
    intervalId = setInterval(tick, speedMs);
  }

  // Expone el stop para que resetChat pueda limpiar el intervalo al instante.
  wrapper._tlStop = stopPlayback;

  // --- Event handlers ---

  playBtn.addEventListener('click', () => {
    if (playing) {
      stopPlayback();
    } else {
      startPlayback();
    }
  });

  slider.addEventListener('input', () => {
    const val = parseInt(slider.value, 10);
    applyFrame(val);
  });

  for (const btn of speedButtons) {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      speedMs = SPEED_OPTIONS[idx].ms;
      for (const b of speedButtons) {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      }
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      restartInterval();
    });
  }

  // Initialize first frame
  applyFrame(0);
}
