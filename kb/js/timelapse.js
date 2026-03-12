// timelapse.js — Animated timelapse choropleth map of Mexico (52 weeks)
// Imports state paths and viewBox from mexico-map.js

import { STATES, VIEWBOX } from './mexico-map.js?v=1';

function interpolateColor(val, vMin, vMax, range, lowColor, highColor, noDataColor) {
  if (val == null) return noDataColor;
  const t = (val - vMin) / range;
  const r = Math.round(lowColor[0] + t * (highColor[0] - lowColor[0]));
  const g = Math.round(lowColor[1] + t * (highColor[1] - lowColor[1]));
  const b = Math.round(lowColor[2] + t * (highColor[2] - lowColor[2]));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

const PLAY_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">'
  + '<path d="M3 1.5L12 7L3 12.5V1.5Z" fill="#EDF3EF"/>'
  + '</svg>';

const PAUSE_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">'
  + '<rect x="2.5" y="1.5" width="3" height="11" rx="0.5" fill="#EDF3EF"/>'
  + '<rect x="8.5" y="1.5" width="3" height="11" rx="0.5" fill="#EDF3EF"/>'
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
    title = 'Timelapse - Pronostico Semanal',
    lowColor = [30, 60, 50],
    highColor = [46, 196, 168],
    noDataColor = '#1A2723',
    metric = 'casos',
  } = opts;

  const frames = timelapseData.frames;
  const totalFrames = frames.length;

  // Compute global min/max across ALL frames for consistent color scale
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (let f = 0; f < totalFrames; f++) {
    const sd = frames[f].stateData;
    for (const key of Object.keys(sd)) {
      const v = sd[key].value;
      if (v != null) {
        if (v < globalMin) globalMin = v;
        if (v > globalMax) globalMax = v;
      }
    }
  }
  if (!isFinite(globalMin)) globalMin = 0;
  if (!isFinite(globalMax)) globalMax = 1;
  const globalRange = globalMax - globalMin || 1;

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
  for (const [name, pathD] of Object.entries(STATES)) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', noDataColor);
    path.setAttribute('stroke', 'rgba(46,196,168,0.25)');
    path.setAttribute('stroke-width', '0.8');
    path.setAttribute('data-state', name);
    path.style.transition = 'fill 0.15s';
    path.style.cursor = 'pointer';

    path.addEventListener('mouseenter', () => {
      path.setAttribute('stroke', '#2EC4A8');
      path.setAttribute('stroke-width', '2.5');
      path.parentNode.appendChild(path);
      const frameData = frames[currentFrame].stateData[name];
      const label = frameData ? frameData.label : 'Sin datos';
      tooltipEl.innerHTML = '<strong>' + name + '</strong><br>' + label;
      tooltipEl.style.display = 'block';
    });
    path.addEventListener('mousemove', (e) => {
      const rect = wrapper.getBoundingClientRect();
      tooltipEl.style.left = (e.clientX - rect.left + 14) + 'px';
      tooltipEl.style.top = (e.clientY - rect.top - 36) + 'px';
    });
    path.addEventListener('mouseleave', () => {
      path.setAttribute('stroke', 'rgba(46,196,168,0.25)');
      path.setAttribute('stroke-width', '0.8');
      tooltipEl.style.display = 'none';
    });

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
  wrapper.appendChild(slider);

  // Controls bar
  const controls = document.createElement('div');
  controls.className = 'timelapse-controls';

  // Play/Pause button
  const playBtn = document.createElement('button');
  playBtn.className = 'timelapse-btn';
  playBtn.innerHTML = PLAY_ICON;
  controls.appendChild(playBtn);

  // Speed buttons
  const speedButtons = [];
  for (let i = 0; i < SPEED_OPTIONS.length; i++) {
    const btn = document.createElement('button');
    btn.className = 'timelapse-speed' + (i === 0 ? ' active' : '');
    btn.textContent = SPEED_OPTIONS[i].label;
    btn.dataset.index = String(i);
    controls.appendChild(btn);
    speedButtons.push(btn);
  }

  wrapper.appendChild(controls);

  // Legend (gradient bar, same style as mexico-map.js)
  const legend = document.createElement('div');
  legend.className = 'mexico-map-legend';

  let barHtml = '<div class="mexico-map-legend-bar">';
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    const v = globalMin + t * globalRange;
    const color = interpolateColor(v, globalMin, globalMax, globalRange, lowColor, highColor, noDataColor);
    barHtml += '<span style="background:' + color + '"></span>';
  }
  barHtml += '</div>';
  barHtml += '<div class="mexico-map-legend-labels">'
    + '<span>' + globalMin.toLocaleString() + '</span>'
    + '<span>' + metric + '</span>'
    + '<span>' + globalMax.toLocaleString() + '</span>'
    + '</div>';
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
      const fill = interpolateColor(val, globalMin, globalMax, globalRange, lowColor, highColor, noDataColor);
      pathEl.setAttribute('fill', fill);
    }

    // Update week display
    weekDisplay.textContent = 'Semana ' + String(weekNum).padStart(2, '0') + ' / ' + totalFrames;

    // Update slider
    slider.value = String(index);
  }

  function startPlayback() {
    if (playing) return;
    playing = true;
    playBtn.innerHTML = PAUSE_ICON;
    intervalId = setInterval(() => {
      let next = currentFrame + 1;
      if (next >= totalFrames) {
        next = 0;
      }
      applyFrame(next);
    }, speedMs);
  }

  function stopPlayback() {
    if (!playing) return;
    playing = false;
    playBtn.innerHTML = PLAY_ICON;
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
    intervalId = setInterval(() => {
      let next = currentFrame + 1;
      if (next >= totalFrames) {
        next = 0;
      }
      applyFrame(next);
    }, speedMs);
  }

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
      }
      btn.classList.add('active');
      restartInterval();
    });
  }

  // Initialize first frame
  applyFrame(0);
}
