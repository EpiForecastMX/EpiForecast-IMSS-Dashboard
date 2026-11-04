/**
 * obesidad_galeria.js — C7.7: Obesidad (E66) en la galería de pronósticos.
 *
 * Obesidad se publica desde su release sellado, sin PNG: sus 111 series (nacional, 4 regiones y
 * 32 estados, cada una por sexo) se dibujan aquí con Chart.js desde la vista publicada
 * (../publication/obesidad/vista.json). No entran en la lista DATA de la galería, que es el
 * inventario contractual de las 432 series del carril semanal.
 *
 * Cada tarjeta muestra lo observado y el pronóstico congelado, sin métricas de error (la galería
 * no las publica; el desempeño está en obesidad.html) y sin intervalos (el release es puntual).
 * Las gráficas se crean sólo cuando la tarjeta entra en pantalla.
 *
 * API: ObesidadGaleria.render({ pad, sexo, q, view }) -> número de tarjetas visibles.
 */
(function () {
  const VISTA_URL = '../publication/obesidad/vista.json';
  const SEXOS = ['general', 'hombres', 'mujeres'];
  const SEXO_FILTRO = { General: 'general', Hombres: 'hombres', Mujeres: 'mujeres' };
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  let V = null;
  let cargando = null;
  let ultimo = null;
  const charts = new Map();
  const sec = () => document.getElementById('secObesidad');

  const strip = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const semana = ([a, w]) => `${a}-W${String(w).padStart(2, '0')}`;
  const fmtMes = (iso) => { const p = iso.split('-'); return `${MES[+p[1] - 1]} ${p[0].slice(2)}`; };

  function cargar() {
    if (V) return Promise.resolve(V);
    if (!cargando) {
      cargando = fetch(VISTA_URL, { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((v) => { if (v.schema !== 'publication_view.v1') throw new Error('versión de datos no soportada'); V = v; return v; });
    }
    return cargando;
  }

  /** Ventana de la vista: histórico desde 2023, o las 52 semanas observadas previas al pronóstico. */
  function ventana(s, view) {
    const obs = new Map(s.observado);
    const pron = new Map(s.pronostico);
    let fechas = [...new Set([...obs.keys(), ...pron.keys()])].sort();
    if (view === 'zoom') {
      const ini = new Date(Date.parse(s.pronostico[0][0]) - 52 * 7 * 864e5).toISOString().slice(0, 10);
      fechas = fechas.filter((d) => d >= ini);
    }
    return { fechas, obs: fechas.map((d) => obs.get(d) ?? null), pron: fechas.map((d) => pron.get(d) ?? null) };
  }

  function dibuja(canvas) {
    const s = V.series[canvas.dataset.serie];
    if (!s || charts.has(canvas)) return;
    const { fechas, obs, pron } = ventana(s, ultimo.view);
    const color = V.color || '#D97706';
    charts.set(canvas, new Chart(canvas, {
      type: 'line',
      data: {
        labels: fechas,
        datasets: [
          { label: 'Observado', data: obs, borderColor: '#C9D3E6', borderWidth: 1.6, pointRadius: 0, tension: 0.2, spanGaps: false },
          { label: `Pronóstico congelado (origen ${semana(V.origin)})`, data: pron, borderColor: color, borderDash: [6, 4], borderWidth: 1.8, pointRadius: 0, tension: 0.2, spanGaps: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (it) => `Semana del ${it[0].label}`, label: (it) => (it.raw == null ? null : `${it.dataset.label}: ${Math.round(it.raw).toLocaleString('es-MX')} casos`) } },
        },
        scales: {
          x: { ticks: { color: '#8A97B1', maxTicksLimit: 6, callback(v) { return fmtMes(this.getLabelForValue(v)); } }, grid: { display: false } },
          y: { ticks: { color: '#8A97B1', maxTicksLimit: 5 }, grid: { color: 'rgba(138,151,177,0.12)' }, beginAtZero: true },
        },
      },
    }));
  }

  const observador = 'IntersectionObserver' in window
    ? new IntersectionObserver((entradas) => entradas.forEach((e) => { if (e.isIntersecting) { observador.unobserve(e.target); dibuja(e.target); } }), { rootMargin: '200px' })
    : null;

  function tarjeta(s) {
    const clave = `${s.nivel}|${s.id}|${s.sexo}`;
    const lugar = s.nivel === 'nacional' ? 'Nacional' : s.nombre;
    return `<a class="obe-card" href="../obesidad.html?serie=${encodeURIComponent(clave)}" aria-label="Obesidad · ${esc(lugar)} · ${esc(s.sexo_nombre)}: abrir en la página de Obesidad">
      <div class="obe-card-chart"><canvas data-serie="${esc(clave)}" role="img" aria-label="Obesidad, ${esc(lugar)}, ${esc(s.sexo_nombre)}: observado y pronóstico congelado"></canvas></div>
      <div class="info"><span class="title">Obesidad · ${esc(s.sexo_nombre)}</span><div class="tags"><span class="tag tag-${s.nivel === 'estado' ? 'estatal' : s.nivel === 'region' ? 'regional' : 'nacional'}">${s.nivel === 'estado' ? 'Estatal' : s.nivel === 'region' ? 'Regional' : 'Nacional'}</span><span class="tag tag-${s.sexo === 'general' ? 'general' : s.sexo}">${esc(s.sexo_nombre)}</span></div></div>
    </a>`;
  }

  function grupo(nombre, series, abierto) {
    return `<div class="state-item${abierto ? ' open' : ''}" data-state="${esc(nombre)}">
      <div class="state-header" role="button" tabindex="0" aria-expanded="${abierto}" onclick="toggleState(this); ObesidadGaleria.pinta()" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleState(this); ObesidadGaleria.pinta(); }">
        <span class="state-dot"></span>
        <span class="state-name">${esc(nombre)}</span>
        <span class="state-count">${series.length} gráfico${series.length !== 1 ? 's' : ''}</span>
        <svg class="chevron" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 1l4 4 4-4"/></svg>
      </div>
      <div class="state-body"><div class="state-cards">${series.map(tarjeta).join('')}</div></div>
    </div>`;
  }

  function seleccion({ pad, sexo, q }) {
    if (pad && pad !== 'Obesidad') return [];
    const sx = sexo ? SEXO_FILTRO[sexo] : null;
    const texto = strip(q || '');
    const pideObesidad = texto && 'obesidad'.includes(texto);
    return Object.values(V.series).filter((s) => {
      if (sx && s.sexo !== sx) return false;
      if (texto && !pideObesidad && !strip(s.nombre).includes(texto)) return false;
      return true;
    });
  }

  /** Crea las gráficas de las tarjetas visibles (al abrir un acordeón, por ejemplo). */
  function pinta() {
    const s = sec();
    if (!s || !V) return;
    s.querySelectorAll('canvas[data-serie]').forEach((c) => {
      if (charts.has(c) || c.offsetParent === null) return;
      if (observador) observador.observe(c); else dibuja(c);
    });
  }

  function limpia() {
    charts.forEach((ch) => ch.destroy());
    charts.clear();
    if (observador) observador.disconnect();
  }

  function pintaSeccion(lista) {
    const s = sec();
    const orden = (a, b) => SEXOS.indexOf(a.sexo) - SEXOS.indexOf(b.sexo);
    const nac = lista.filter((x) => x.nivel === 'nacional').sort(orden);
    const agrupa = (nivel) => {
      const g = {};
      lista.filter((x) => x.nivel === nivel).forEach((x) => { (g[x.nombre] = g[x.nombre] || []).push(x); });
      return Object.keys(g).sort((a, b) => a.localeCompare(b, 'es')).map((k) => [k, g[k].sort(orden)]);
    };
    const abiertos = new Set([...s.querySelectorAll('.state-item.open')].map((el) => el.dataset.state));
    const reg = agrupa('region');
    const est = agrupa('estado');
    document.getElementById('obeMeta').textContent =
      `Pronóstico congelado en ${semana(V.origin)} a ${V.horizon_weeks} semanas, sin reentrenar · observado hasta ${semana(V.observation_cutoff)} · ${V.publication_label}.`;
    document.getElementById('bodyObesidad').innerHTML =
      (nac.length ? `<h3 class="obe-sub">Nacional</h3><div class="obe-grid">${nac.map(tarjeta).join('')}</div>` : '') +
      (reg.length ? `<h3 class="obe-sub">Regiones</h3><div class="accordion">${reg.map(([n, xs]) => grupo(n, xs, abiertos.has(n))).join('')}</div>` : '') +
      (est.length ? `<h3 class="obe-sub">Estados</h3><div class="accordion">${est.map(([n, xs]) => grupo(n, xs, abiertos.has(n))).join('')}</div>` : '');
    pinta();
  }

  function render(filtros) {
    ultimo = filtros;
    const s = sec();
    if (!s) return 0;
    if (filtros.pad && filtros.pad !== 'Obesidad') { s.style.display = 'none'; limpia(); return 0; }
    if (!V) {
      cargar().then(() => { if (ultimo === filtros) render(filtros); window.dispatchEvent(new Event('obesidad-galeria')); })
        .catch((e) => { document.getElementById('bodyObesidad').innerHTML = `<p class="obe-err">No se pudieron cargar los datos de Obesidad (${esc(e.message)}).</p>`; });
      return 0;
    }
    limpia();
    const lista = seleccion(filtros);
    s.style.display = lista.length ? '' : 'none';
    const n = document.getElementById('navCountObe'); if (n) n.textContent = lista.length;
    if (lista.length) pintaSeccion(lista);
    return lista.length;
  }

  window.ObesidadGaleria = { render, pinta, _ventana: ventana, _seleccion: (v, f) => { V = v; return seleccion(f); } };
})();
