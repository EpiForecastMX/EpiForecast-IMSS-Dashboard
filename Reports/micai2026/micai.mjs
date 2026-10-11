// MICAI 2026 · paper #12 companion site. No external libraries; the static HTML is readable without JS.
import { I18N, VERSION } from './i18n.mjs?v=1928e175e4';

const $ = (id) => document.getElementById(id);
const COLORS = { observed: '#c2186b', ensemble: '#7c5cbf', naive: '#64748b', prophet: '#0f8076', deepar: '#235fe8', stacking: '#475569' };
const ENGINES = ['prophet', 'deepar', 'ensemble', 'stacking'];
const NAMES = { prophet: 'Prophet', deepar: 'DeepAR', ensemble: 'Ensemble', stacking: 'Stacking' };
let lang = 'en', data = null, target = null, showAll = false, week = 33;

const t = (k) => (I18N[lang] && I18N[lang][k]) ?? I18N.en[k] ?? k;
const nf = (v, d = 1) => v == null ? '—' : v.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 2) => v == null ? '—' : nf(v, d) + (lang === 'es' ? ' %' : '%');
const stratumName = (s) => t('stratum_' + s);
const entityName = (e) => e === 'Nacional' ? t('national') : e;

function setLang(next) {
  lang = next === 'es' ? 'es' : 'en';
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-pct]').forEach((el) => { el.textContent = pct(Number(el.dataset.pct), Number(el.dataset.d || 2)); });
  document.querySelectorAll('[data-num]').forEach((el) => { el.textContent = nf(Number(el.dataset.num), Number(el.dataset.d || 1)); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  try { localStorage.setItem('micai2026-lang', lang); } catch (e) { /* storage unavailable */ }
  const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(null, '', url);
  if (data) { fillTargets(); render(); }
}

function fillTargets() {
  const sel = $('target'), keep = sel.value || 'Nacional';
  const ents = [...new Set(data.targets.map((x) => x.entity))];
  ents.sort((a, b) => (a === 'Nacional' ? -1 : b === 'Nacional' ? 1 : a.localeCompare(b, 'es')));
  sel.replaceChildren(...ents.map((e) => { const o = document.createElement('option'); o.value = e; o.textContent = entityName(e); return o; }));
  sel.value = keep;
}

function current() {
  const ent = $('target').value, st = document.querySelector('#stratum [aria-pressed=true]')?.dataset.stratum || 'general';
  return data.targets.find((x) => x.entity === ent && x.stratum === st);
}

function visibleKeys(tg) {
  const keys = ['observed', 'naive'];
  if (showAll) keys.push(...ENGINES); else keys.push(tg.archived);
  return keys;
}

function draw() {
  const tg = target, cv = $('chart'), dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const m = { l: 56, r: 12, t: 10, b: 30 }, pw = W - m.l - m.r, ph = H - m.t - m.b, n = 52;
  const keys = visibleKeys(tg), vals = keys.flatMap((k) => tg.series[k]).filter((v) => v != null);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.08 || 1; lo = Math.max(0, lo - pad); hi += pad;
  const x = (i) => m.l + pw * (i + 0.5) / n, y = (v) => m.t + ph * (1 - (v - lo) / (hi - lo));
  const edge = (i) => m.l + pw * i / n, last = data.meta.last_observed_period;
  c.fillStyle = '#eef1f7'; c.fillRect(edge(0), m.t, edge(17) - edge(0), ph);
  c.fillStyle = '#f5f6f9'; c.fillRect(edge(last), m.t, edge(n) - edge(last), ph);
  c.strokeStyle = '#e3e6ee'; c.lineWidth = 1;
  for (let k = edge(last); k < edge(n) + ph; k += 9) { c.beginPath(); c.moveTo(Math.max(k - ph, edge(last)), m.t + Math.min(ph, k - edge(last))); c.lineTo(Math.min(k, edge(n)), m.t + Math.max(0, k - edge(n))); c.stroke(); }
  // y grid and labels
  c.fillStyle = '#4b5563'; c.font = '12px Arial'; c.textAlign = 'right'; c.textBaseline = 'middle';
  const step = niceStep((hi - lo) / 5);
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { c.strokeStyle = '#e9edf3'; c.beginPath(); c.moveTo(m.l, y(v)); c.lineTo(m.l + pw, y(v)); c.stroke(); c.fillText(nf(v, 0), m.l - 8, y(v)); }
  // month ticks: all twelve on wide charts, quarterly plus December when the plot is narrow
  c.textAlign = 'center'; c.textBaseline = 'top'; let prev = -1;
  const months = t('months').split(','), narrow = pw < 600, keep = narrow ? [0, 3, 6, 9, 11] : null;
  data.periods.forEach((p, i) => { const d = new Date(Date.parse(p.start) + 3 * 864e5).getUTCMonth(); if (d !== prev) { prev = d; if (keep && !keep.includes(d)) return; c.fillText(i === 0 && !narrow ? months[d] + ' 2026' : months[d], x(i), m.t + ph + 8); } });
  // series
  const order = ['naive', ...ENGINES.filter((k) => keys.includes(k) && k !== tg.archived), tg.archived, 'observed'];
  order.forEach((k) => {
    const s = tg.series[k]; c.strokeStyle = COLORS[k]; c.setLineDash(k === 'naive' ? [6, 5] : []);
    c.lineWidth = k === 'observed' ? 2.5 : k === tg.archived ? 3.2 : k === 'naive' ? 2 : 1.4; c.beginPath(); let open = false;
    s.forEach((v, i) => { if (v == null) { open = false; return; } if (!open) { c.moveTo(x(i), y(v)); open = true; } else c.lineTo(x(i), y(v)); });
    c.stroke(); c.setLineDash([]);
    if (k === 'observed') { c.fillStyle = COLORS[k]; s.forEach((v, i) => { if (v != null) { c.beginPath(); c.arc(x(i), y(v), 2.6, 0, 7); c.fill(); } }); }
  });
  c.strokeStyle = '#101935'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(edge(last), m.t - 2); c.lineTo(edge(last), m.t + ph); c.stroke();
  c.strokeStyle = '#2b318b'; c.lineWidth = 1; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(x(week - 1), m.t); c.lineTo(x(week - 1), m.t + ph); c.stroke(); c.setLineDash([]);
}

function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw)); const f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }

function legend() {
  const keys = visibleKeys(target), box = $('legend');
  box.replaceChildren(...['observed', target.archived, 'naive', ...ENGINES.filter((k) => keys.includes(k) && k !== target.archived)].map((k) => {
    const s = document.createElement('span'), i = document.createElement('i');
    i.style.borderTopColor = COLORS[k]; if (k === 'naive') i.style.borderTopStyle = 'dashed';
    s.append(i, k === 'observed' ? t('observed') : k === 'naive' ? t('naive') : NAMES[k] + (k === target.archived ? ' (' + t('assigned') + ')' : ''));
    return s;
  }));
}

function weekText() {
  const p = data.periods[week - 1], s = target.series;
  const wk = (n) => (lang === 'es' ? 'S' : 'W') + String(n).padStart(2, '0');
  const [ey, ew] = p.edition.split('-W');
  const parts = [t('period') + ' ' + wk(week) + ' (' + t('edition') + ' ' + (ey === '2026' ? '' : ey + '-') + wk(Number(ew)) + ', ' + p.start + ')'];
  parts.push(t('observed') + ' ' + (s.observed[week - 1] == null ? t('not_in_snapshot') : nf(s.observed[week - 1], 0)));
  const keys = visibleKeys(target);
  [target.archived, ...ENGINES.filter((k) => keys.includes(k) && k !== target.archived)].forEach((k) => parts.push(NAMES[k] + (k === target.archived ? ' (' + t('assigned') + ')' : '') + ' ' + nf(s[k][week - 1], 0)));
  parts.push(t('naive') + ' ' + nf(s.naive[week - 1], 0));
  $('week-out').textContent = parts.join(' · ');
}

function cards() {
  const mt = target.metrics, a = target.archived;
  const card = (win, label) => {
    const el = document.createElement('article'); el.className = 'card';
    const e = document.createElement('p'); e.className = 'eyebrow'; e.textContent = label;
    const row = (name, v) => { const r = document.createElement('div'); r.className = 'row'; const s = document.createElement('span'); s.textContent = name; const st = document.createElement('strong'); st.textContent = pct(v); r.append(s, st); return r; };
    const nt = document.createElement('p'); nt.className = 'note'; nt.textContent = 'sMAPE (%) · n = ' + (mt[win][a]?.n ?? '—');
    el.append(e, row(NAMES[a] + ' (' + t('assigned') + ')', mt[win][a]?.smape), row(t('naive'), mt[win].naive?.smape), nt);
    return el;
  };
  $('cards').replaceChildren(card('A', t('card_A')), card('B', t('card_B')));
  $('national-note').hidden = !(target.entity === 'Nacional' && target.stratum === 'general');
}

function table() {
  const rows = [['archived', t('archived_row') + ' (' + NAMES[target.archived] + ')'], ...ENGINES.map((k) => [k, NAMES[k]]), ['naive', t('naive')]];
  const head = document.createElement('tr'); [t('estimator'), 'A', 'B', 'B-sens', 'C'].forEach((h, i) => { const th = document.createElement('th'); th.textContent = h; if (i) th.className = 'num'; head.append(th); });
  $('metrics-table').tHead.replaceChildren(head);
  $('metrics-table').tBodies[0].replaceChildren(...rows.map(([k, label]) => {
    const tr = document.createElement('tr'), th = document.createElement('th'); th.textContent = label; tr.append(th);
    ['A', 'B', 'B-sens', 'C'].forEach((w) => { const td = document.createElement('td'); td.className = 'num'; td.textContent = pct(target.metrics[w][k]?.smape); tr.append(td); });
    return tr;
  }));
  $('metrics-caption').textContent = entityName(target.entity) + ' · ' + stratumName(target.stratum) + ' · ' + t('table_caption');
}

function ariaLabel() {
  const keys = visibleKeys(target), eng = [target.archived, ...ENGINES.filter((k) => keys.includes(k) && k !== target.archived)].map((k) => NAMES[k]);
  const list = eng.length > 1 ? eng.slice(0, -1).join(', ') + (lang === 'es' ? ' y ' : ' and ') + eng.at(-1) : eng[0];
  $('chart').setAttribute('aria-label', t('aria_tpl').replace('{target}', entityName(target.entity) + ', ' + stratumName(target.stratum).toLowerCase()).replace('{engines}', list));
}

function render() { target = current(); legend(); draw(); weekText(); cards(); table(); ariaLabel(); }

async function init() {
  const qp = new URL(location.href).searchParams.get('lang');
  let stored = null; try { stored = localStorage.getItem('micai2026-lang'); } catch (e) { /* ignore */ }
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  setLang(qp || stored || 'en');
  try {
    const r = await fetch('Reports/micai2026/data/tracker.json?v=' + VERSION); if (!r.ok) throw new Error(r.status);
    data = await r.json();
  } catch (e) { $('data-status').hidden = false; $('data-status').textContent = t('data_error'); return; }
  $('explorer').hidden = false;
  fillTargets();
  $('target').addEventListener('change', render);
  document.querySelectorAll('#stratum button').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('#stratum button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); }));
  $('all-engines').addEventListener('change', (e) => { showAll = e.target.checked; render(); });
  const slider = $('week'); slider.max = String(data.periods.length); slider.value = String(week);
  slider.addEventListener('input', () => { week = Number(slider.value); draw(); weekText(); });
  let raf = 0; window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); });
  render();
}
init();
