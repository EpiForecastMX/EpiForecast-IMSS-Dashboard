/**
 * obesidad_galeria.js — C7.7: Obesidad (E66) en la galería de pronósticos.
 *
 * Obesidad se publica desde su release sellado, sin PNG: sus 111 series (nacional, 4
 * macrorregiones y 32 estados, cada una por sexo) se dibujan con Chart.js desde la vista publicada
 * (../publication/obesidad/vista.json) y se integran en los mismos niveles de la galería
 * (Nacional, Estatal y Regional) junto a los demás padecimientos. No entran en la lista DATA, que
 * es el inventario contractual de las 432 series del carril semanal.
 *
 * Cada tarjeta muestra lo observado y el pronóstico congelado, sin métricas de error (la galería
 * no las publica; el desempeño está en obesidad.html) y sin intervalos (el release es puntual).
 * Las gráficas se crean sólo cuando la tarjeta es visible.
 *
 * API (window.ObesidadGaleria):
 *   cargar()                 -> Promise de la vista; al cargar, dispara el evento 'obesidad-galeria'
 *   seleccion({pad,sexo,q})  -> series visibles con esos filtros ([] mientras no carga)
 *   tarjeta(s)               -> HTML de la tarjeta de una serie
 *   estadoGaleria(s)         -> nombre del estado como lo usa la galería ('México' -> 'Estado de México')
 *   meta()                   -> rótulo del release (origen, horizonte, último observado)
 *   pinta(view)              -> crea las gráficas de las tarjetas visibles
 */
(function () {
  const VISTA_URL = '../publication/obesidad/vista.json';
  const SEXOS = ['general', 'hombres', 'mujeres'];
  const SEXO_FILTRO = { General: 'general', Hombres: 'hombres', Mujeres: 'mujeres' };
  const NOMBRE_GALERIA = { México: 'Estado de México' };
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  let V = null;
  let cargando = null;
  let vista = 'full';
  const charts = new Map();

  const strip = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const semana = ([a, w]) => `${a}-W${String(w).padStart(2, '0')}`;
  const fmtMes = (iso) => { const p = iso.split('-'); return `${MES[+p[1] - 1]} ${p[0].slice(2)}`; };
  const porSexo = (a, b) => SEXOS.indexOf(a.sexo) - SEXOS.indexOf(b.sexo);

  function cargar() {
    if (V) return Promise.resolve(V);
    if (!cargando) {
      cargando = fetch(VISTA_URL, { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((v) => {
          if (v.schema !== 'publication_view.v1') throw new Error('versión de datos no soportada');
          V = v;
          if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('obesidad-galeria'));
          return v;
        });
    }
    return cargando;
  }

  const estadoGaleria = (s) => NOMBRE_GALERIA[s.nombre] || s.nombre;

  function seleccion({ pad, sexo, q } = {}) {
    if (!V || (pad && pad !== 'Obesidad')) return [];
    const sx = sexo ? SEXO_FILTRO[sexo] : null;
    const texto = strip(q || '').trim();
    const pideObesidad = texto && 'obesidad'.startsWith(texto);
    return Object.values(V.series).filter((s) => {
      if (sx && s.sexo !== sx) return false;
      if (texto && !pideObesidad && !strip(estadoGaleria(s)).includes(texto) && !strip(s.nombre).includes(texto)) return false;
      return true;
    }).sort(porSexo);
  }

  /** Ventana: histórico desde 2023, o las 52 semanas observadas previas al pronóstico (zoom). */
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
    const s = V && V.series[canvas.dataset.serie];
    if (!s || charts.has(canvas)) return;
    const { fechas, obs, pron } = ventana(s, vista);
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

  const observador = typeof window.IntersectionObserver === 'function'
    ? new window.IntersectionObserver((entradas) => entradas.forEach((e) => {
      if (e.isIntersecting) { observador.unobserve(e.target); dibuja(e.target); }
    }), { rootMargin: '200px' })
    : null;

  function tarjeta(s) {
    const clave = `${s.nivel}|${s.id}|${s.sexo}`;
    const lugar = s.nivel === 'nacional' ? 'Nacional' : s.nombre;
    const nivel = s.nivel === 'estado' ? 'Estatal' : s.nivel === 'region' ? 'Regional' : 'Nacional';
    return `<a class="obe-card" href="../obesidad.html?serie=${encodeURIComponent(clave)}" aria-label="Obesidad · ${esc(lugar)} · ${esc(s.sexo_nombre)}: abrir en la página de Obesidad">
      <div class="obe-card-chart"><canvas data-serie="${esc(clave)}" role="img" aria-label="Obesidad, ${esc(lugar)}, ${esc(s.sexo_nombre)}: observado y pronóstico congelado"></canvas></div>
      <div class="info"><span class="title">Obesidad · ${esc(s.sexo_nombre)}</span><div class="tags"><span class="tag tag-${nivel.toLowerCase()}">${nivel}</span><span class="tag tag-${s.sexo}">${esc(s.sexo_nombre)}</span></div></div>
    </a>`;
  }

  const meta = () => (V
    ? `Pronóstico congelado en ${semana(V.origin)} a ${V.horizon_weeks} semanas, sin reentrenar · observado hasta ${semana(V.observation_cutoff)} · ${V.publication_label}.`
    : '');

  /** Las gráficas viven mientras su canvas siga en el documento; al re-render se liberan. */
  function pinta(view) {
    if (view && view !== vista) { vista = view; charts.forEach((ch) => ch.destroy()); charts.clear(); }
    charts.forEach((ch, c) => { if (!c.isConnected) { ch.destroy(); charts.delete(c); } });
    if (!V || typeof document.querySelectorAll !== 'function') return;
    document.querySelectorAll('canvas[data-serie]').forEach((c) => {
      if (charts.has(c) || c.offsetParent === null) return;
      if (observador) observador.observe(c); else dibuja(c);
    });
  }

  window.ObesidadGaleria = { cargar, seleccion, tarjeta, estadoGaleria, meta, pinta, _ventana: ventana, _usa: (v) => { V = v; } };
})();
