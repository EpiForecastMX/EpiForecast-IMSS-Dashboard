/* home-preview.js — vista previa de la Galería en la portada (serie nacional, ambos sexos).
 *
 * Presupuesto de red (contrato del piloto):
 *   - carga inicial: hero_series.json (las 4 series de la cohorte original) y CERO vista.json;
 *   - cada selección de un release: como máximo UNA publication/<id>/vista.json, cacheada;
 *   - la validación (esquema y serie nacional) corre DENTRO de la promesa cacheada: un HTTP 5xx o un
 *     HTTP 200 inválido se olvidan y «Reintentar» vuelve a pedir el archivo;
 *   - las respuestas de una selección ya superada se descartan (testigo de última petición);
 *   - si hero_series.json falla, los releases siguen disponibles y la cohorte original se reintenta.
 * Al empezar cada selección se limpian gráfica, metadatos y enlace: nunca queda la serie anterior
 * bajo el nombre de la nueva. Los errores se muestran en lenguaje llano; el detalle va a la consola.
 * Bandas: sólo si la serie declara intervalo_disponible === true y trae lo/hi.
 * Colores: presentacionales por clave (tokens --series-* de assets/site/site.css); la leyenda usa el
 * mismo color que la curva (variable --pv-color). El campo `color` de los datos no se usa.
 *
 * window.EpiPreview expone la lógica pura (tests/home.test.mjs) y `init()`, que la conecta al DOM
 * (tests/home_preview_controller.test.mjs).
 */
(function (g) {
  'use strict';

  var VIEW_SCHEMA = 'publication_view.v1';
  var LEGACY_SLOT = { depresion: 1, parkinson: 2, alzheimer: 3, dengue: 4 };
  var PALETTE_FALLBACK = ['#2f5f9e', '#0f6e66', '#a3367a', '#9a5200', '#6a4aa6', '#b0322f', '#3d6b1f', '#1d5f86'];

  /** Ranura 1..8 de la paleta por clave: fija para la cohorte original, estable por hash para releases. */
  function slotFor(key) {
    if (Object.prototype.hasOwnProperty.call(LEGACY_SLOT, key)) return LEGACY_SLOT[key];
    var h = 0;
    for (var i = 0; i < String(key).length; i++) h = (h * 31 + String(key).charCodeAt(i)) >>> 0;
    return (h % PALETTE_FALLBACK.length) + 1;
  }

  /** ¿Se puede dibujar banda? Sólo con bandera explícita y valores presentes. */
  function bandaPermitida(s) {
    if (!s || s.intervalo_disponible !== true) return false;
    var tiene = function (a) { return Array.isArray(a) && a.some(function (v) { return v != null; }); };
    return tiene(s.lo) && tiene(s.hi);
  }

  var semana = function (a) { return a[0] + '-W' + String(a[1]).padStart(2, '0'); };
  function semanaTexto(etq) {
    var m = /^(\d{4})-W(\d{2})$/.exec(etq || '');
    return m ? 'semana ' + Number(m[2]) + ' de ' + m[1] : 'sin dato';
  }

  /** Serie de la cohorte original (hero_series.json) con sus metadatos de presentación. */
  function serieLegacy(s) {
    return {
      key: s.key, label: s.label, cie: s.cie, origen: 'legacy',
      motor: s.motor,
      estado: 'Cohorte original · motor nacional ' + s.motor,
      corte: s.corte, corteRotulo: 'Corte del modelo',
      ultima_observada: s.ultima_observada,
      casos: s.casos, casosTexto: 'en 52 semanas desde el corte (modelo nacional)',
      emitido: null,
      fuente: 'hero_series.json',
      intervalo_disponible: s.intervalo_disponible === true,
      d: s.d, r: s.r, y: s.y,
      lo: s.intervalo_disponible === true ? s.lo : null,
      hi: s.intervalo_disponible === true ? s.hi : null,
    };
  }

  /**
   * Nacional general de un release con la misma forma: 52 semanas observadas hasta el último
   * boletín y el pronóstico congelado desde su origen (puntual, sin banda).
   */
  function serieRelease(v, cfg) {
    var x = v.series && v.series['nacional|mx|general'];
    if (!x || !x.observado.length || !x.pronostico.length) return null;
    var obs = {}, pron = {};
    x.observado.forEach(function (p) { obs[p[0]] = p[1]; });
    x.pronostico.forEach(function (p) { pron[p[0]] = p[1]; });
    var corte = v.observation_cutoff_ds;
    var vistas = x.observado.map(function (p) { return p[0]; }).filter(function (d) { return d <= corte; });
    var fechas = vistas.slice(-52).concat(x.pronostico.map(function (p) { return p[0]; }).filter(function (d) { return d > corte; }));
    return {
      key: cfg.id, label: cfg.label, cie: cfg.cie, origen: 'release',
      motor: 'portafolio de ' + v.models + ' series',
      estado: v.publication_label,
      corte: semana(v.origin), corteRotulo: 'Datos del pronóstico hasta',
      ultima_observada: semana(v.observation_cutoff),
      casos: x.pronostico_52_total == null ? null : Math.round(x.pronostico_52_total),
      casosTexto: 'en ' + v.horizon_weeks + ' semanas desde el corte',
      emitido: v.forecast_emitted_at || null,
      fuente: 'publication/' + cfg.id + '/vista.json',
      intervalo_disponible: false,
      d: fechas,
      r: fechas.map(function (d) { return d <= corte && obs[d] != null ? obs[d] : null; }),
      y: fechas.map(function (d) { return pron[d] != null ? pron[d] : null; }),
      lo: null, hi: null,
    };
  }

  /**
   * Caché por URL del resultado YA VALIDADO: la validación corre dentro de la promesa cacheada y
   * cualquier fallo (HTTP o semántico) se olvida. load(url, validar).
   */
  function crearCargador(fetchJson) {
    var cache = new Map();
    var pedidas = [];
    function load(url, validar) {
      if (!cache.has(url)) {
        pedidas.push(url);
        var p = Promise.resolve().then(function () { return fetchJson(url); })
          .then(function (json) { return validar ? validar(json) : json; });
        cache.set(url, p);
        p.catch(function () { if (cache.get(url) === p) cache.delete(url); });
      }
      return cache.get(url);
    }
    load.pedidas = pedidas;
    return load;
  }

  function validarHero(d) {
    if (!d || !Array.isArray(d.series) || !d.series.length) throw new Error('hero_series.json sin series');
    return d;
  }

  /**
   * Modelo de la vista previa, sin DOM.
   * opts.fetchJson(url) -> Promise<json>; opts.releases: [{id, label, cie}] (release_catalog.js).
   */
  function crearModelo(opts) {
    var load = crearCargador(opts.fetchJson);
    var releases = opts.releases || [];
    var hero = null;
    var heroError = null;
    var seq = 0;

    /** Nunca rechaza: si la cohorte original falla, devuelve igualmente los releases. */
    function iniciar() {
      return load('hero_series.json', validarHero).then(
        function (d) { hero = d; heroError = null; return opciones(); },
        function (e) { hero = null; heroError = e; return opciones(); });
    }

    function opciones() {
      var gr = [];
      if (hero) {
        gr.push({ grupo: 'Cohorte original (corte ' + semanaTexto(hero.corte) + ')',
          items: hero.series.map(function (s) { return { value: 'legacy:' + s.key, label: s.label }; }) });
      }
      gr.push({ grupo: 'Releases publicados',
        items: releases.map(function (r) { return { value: 'release:' + r.id, label: r.label }; }) });
      return gr;
    }

    /** Resuelve {serie} o {error}; `stale` indica que otra selección la superó. */
    function seleccionar(value) {
      var token = ++seq;
      var i = String(value).indexOf(':');
      var kind = String(value).slice(0, i), id = String(value).slice(i + 1);
      var p;
      if (kind === 'legacy') {
        var s = hero && hero.series.filter(function (x) { return x.key === id; })[0];
        p = s ? Promise.resolve(serieLegacy(s)) : Promise.reject(new Error('serie desconocida: ' + id));
      } else {
        var cfg = releases.filter(function (r) { return r.id === id; })[0];
        p = !cfg ? Promise.reject(new Error('release desconocido: ' + id))
          : load('publication/' + cfg.id + '/vista.json', function (v) {
            if (!v || v.schema !== VIEW_SCHEMA) throw new Error('versión de datos no soportada');
            var serie = serieRelease(v, cfg);
            if (!serie) throw new Error('la vista no trae la serie nacional general');
            return serie;
          });
      }
      return p.then(
        function (serie) { return { stale: token !== seq, serie: serie }; },
        function (error) { return { stale: token !== seq, error: error }; });
    }

    return {
      iniciar: iniciar, seleccionar: seleccionar, pedidas: load.pedidas,
      heroFallo: function () { return heroError; },
    };
  }

  /** Enlace a la Galería con los IDs del catálogo del dashboard. */
  function galeriaHref(serie) {
    return 'Reports/index.html?p=' + encodeURIComponent(serie.key) + '&s=general&t=nacional';
  }

  // ── DOM ──────────────────────────────────────────────────────────────────
  function init(doc, win) {
    var canvas = doc.getElementById('hfCanvas');
    var select = doc.getElementById('hfSelect');
    if (!canvas || !select || !canvas.getContext) return null;
    var ctx = canvas.getContext('2d');
    var figure = doc.getElementById('pvFigure');
    var state = doc.getElementById('pvState');
    var legBand = doc.getElementById('pvLegBand');
    var link = doc.getElementById('pvGaleria');
    var cohortBox = doc.getElementById('pvCohortError');
    var cohortRetry = doc.getElementById('pvCohortRetry');
    var meta = {
      estado: doc.getElementById('pvEstado'), corteRot: doc.getElementById('pvCorteRot'), corte: doc.getElementById('pvCorte'),
      obs: doc.getElementById('pvObs'), casos: doc.getElementById('pvCasos'),
      emision: doc.getElementById('pvEmision'), fuente: doc.getElementById('pvFuente'),
    };
    var reduce = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var css = win.getComputedStyle(doc.documentElement);
    var token = function (name, fb) { var v = css.getPropertyValue(name).trim(); return v || fb; };
    var current = null, raf = 0;
    var fmt = function (n) { return Number(n).toLocaleString('es-MX'); };

    var modelo = crearModelo({
      fetchJson: function (url) {
        return win.fetch(url, { cache: 'no-cache' }).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        });
      },
      releases: (win.EPI_CATALOGO ? win.EPI_CATALOGO.releases : []).map(function (r) {
        return { id: r.id, label: r.nombreCorto, cie: r.cie };
      }),
    });

    function setState(text, retry) {
      state.textContent = '';
      state.hidden = !text;
      if (!text) return;
      var p = doc.createElement('p');
      p.textContent = text;
      state.appendChild(p);
      if (retry) {
        var b = doc.createElement('button');
        b.type = 'button'; b.className = 'btn btn--ghost preview__retry'; b.textContent = 'Reintentar';
        b.addEventListener('click', retry);
        state.appendChild(b);
      }
    }

    /** Vacía todo lo que atribuye datos a un padecimiento (antes de cargar otro y al fallar). */
    function limpiar() {
      if (raf) { win.cancelAnimationFrame(raf); raf = 0; }
      current = null;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ['estado', 'corte', 'obs', 'casos', 'emision'].forEach(function (k) { meta[k].textContent = '—'; });
      meta.corteRot.textContent = 'Corte';
      meta.fuente.textContent = '—';
      link.href = 'Reports/index.html';
      link.textContent = 'Ver todos en la Galería →';
      legBand.hidden = true;
      canvas.setAttribute('aria-label', 'Sin serie seleccionada');
    }

    function pintaMeta(s) {
      meta.estado.textContent = s.estado || 'sin dato';
      meta.corteRot.textContent = s.corteRotulo;
      meta.corte.textContent = semanaTexto(s.corte);
      meta.obs.textContent = semanaTexto(s.ultima_observada);
      meta.casos.textContent = s.casos == null ? 'sin dato' : fmt(s.casos) + ' casos ' + s.casosTexto;
      meta.emision.textContent = s.emitido
        ? new Date(s.emitido).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', year: 'numeric' })
        : 'fecha no documentada';
      meta.fuente.textContent = '';
      var a = doc.createElement('a');
      a.href = s.fuente; a.textContent = 'Datos de la serie (JSON)'; a.className = 'text-link';
      meta.fuente.appendChild(a);
      link.href = galeriaHref(s);
      link.textContent = 'Ver ' + s.label + ' en la Galería →';
      var color = token('--series-' + slotFor(s.key), PALETTE_FALLBACK[slotFor(s.key) - 1]);
      if (figure && figure.style) figure.style.setProperty('--pv-color', color);
      legBand.hidden = !bandaPermitida(s);
      canvas.setAttribute('aria-label', s.label + ', total nacional: casos notificados por semana hasta la ' +
        semanaTexto(s.ultima_observada) + ' y pronóstico desde la ' + semanaTexto(s.corte) +
        (s.casos == null ? '' : ' (' + fmt(s.casos) + ' casos ' + s.casosTexto + ')') + '. El detalle está en la Galería.');
    }

    function draw(s, prog) {
      var wrap = canvas.parentElement;
      var W = wrap.clientWidth, H = wrap.clientHeight;
      var dpr = Math.min(win.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var n = s.d.length, padL = 52, padR = 14, padT = 22, padB = 28;
      var last = -1;
      for (var i = 0; i < n; i++) if (s.r[i] != null) last = i;
      var banda = bandaPermitida(s);
      var vals = [];
      for (i = 0; i < n; i++) {
        if (s.r[i] != null) vals.push(s.r[i]);
        if (s.y[i] != null) vals.push(s.y[i]);
        if (banda && s.hi[i] != null) vals.push(s.hi[i]);
        if (banda && s.lo[i] != null) vals.push(s.lo[i]);
      }
      if (!vals.length) return;
      var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
      if (mn === mx) mx = mn + 1;
      var span = mx - mn; mn = Math.max(0, mn - span * 0.08); mx += span * 0.1;
      var X = function (k) { return padL + (k / Math.max(1, n - 1)) * (W - padL - padR); };
      var Y = function (v) { return padT + (1 - (v - mn) / (mx - mn)) * (H - padT - padB); };
      var muted = token('--muted', '#5b6f66'), line = token('--line', '#dbe3dc');
      var color = token('--series-' + slotFor(s.key), PALETTE_FALLBACK[slotFor(s.key) - 1]);
      var obsColor = token('--c-obs', '#173c33');
      ctx.font = '12px ' + token('--sans', 'system-ui');
      ctx.strokeStyle = line; ctx.fillStyle = muted; ctx.lineWidth = 1; ctx.textAlign = 'right';
      for (var t = 0; t <= 3; t++) {
        var yy = padT + t / 3 * (H - padT - padB);
        ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
        ctx.fillText(Math.round(mx - t / 3 * (mx - mn)).toLocaleString('es-MX'), padL - 8, yy + 4);
      }
      var mes = function (iso) { return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-MX', { month: 'short', year: '2-digit', timeZone: 'UTC' }); };
      ctx.textAlign = 'left'; ctx.fillText(mes(s.d[0]), padL, H - 8);
      ctx.textAlign = 'right'; ctx.fillText(mes(s.d[n - 1]), W - padR, H - 8);
      var hasta = Math.floor(prog * (n - 1));
      function path(arr, from, to) {
        ctx.beginPath(); var started = false;
        for (var k = from; k <= to; k++) {
          if (arr[k] == null) { started = false; continue; }
          if (!started) { ctx.moveTo(X(k), Y(arr[k])); started = true; } else ctx.lineTo(X(k), Y(arr[k]));
        }
      }
      if (banda) {
        ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = color; ctx.beginPath();
        var pts = [];
        for (i = 0; i <= hasta; i++) if (s.hi[i] != null && s.lo[i] != null) pts.push(i);
        if (pts.length > 1) {
          ctx.moveTo(X(pts[0]), Y(s.hi[pts[0]]));
          pts.forEach(function (k) { ctx.lineTo(X(k), Y(s.hi[k])); });
          pts.slice().reverse().forEach(function (k) { ctx.lineTo(X(k), Y(s.lo[k])); });
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
      // Línea vertical rotulada: es la ÚLTIMA SEMANA OBSERVADA, no el corte del modelo.
      if (last >= 0 && last <= hasta) {
        ctx.save(); ctx.strokeStyle = muted; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(X(last), padT); ctx.lineTo(X(last), H - padB); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = muted; ctx.textAlign = X(last) > W * 0.7 ? 'right' : 'left';
        ctx.fillText('último observado', X(last) + (ctx.textAlign === 'right' ? -4 : 4), padT - 8);
        ctx.restore();
      }
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.setLineDash([7, 5]); path(s.y, 0, hasta); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.strokeStyle = obsColor; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; path(s.r, 0, Math.min(hasta, last)); ctx.stroke(); ctx.restore();
    }

    function animate(s) {
      if (raf) win.cancelAnimationFrame(raf);
      if (reduce) { draw(s, 1); return; }
      var t0 = win.performance.now();
      var step = function (now) {
        if (current !== s) { raf = 0; return; }
        var p = Math.min(1, (now - t0) / 900);
        draw(s, 1 - Math.pow(1 - p, 3));
        raf = p < 1 ? win.requestAnimationFrame(step) : 0;
      };
      raf = win.requestAnimationFrame(step);
    }

    function elegir(value) {
      limpiar();
      setState('Cargando la serie nacional…');
      return modelo.seleccionar(value).then(function (res) {
        if (res.stale) return;
        if (res.error) {
          win.console && win.console.warn('[vista previa] ' + value + ':', res.error);
          limpiar();
          setState('No se pudo cargar esta serie. Revisa tu conexión e inténtalo de nuevo.', function () { elegir(value); });
          return;
        }
        current = res.serie;
        setState('');
        pintaMeta(current);
        animate(current);
      });
    }

    function poblar(grupos, conPlaceholder) {
      var previo = select.value;
      select.textContent = '';
      if (conPlaceholder) {
        var ph = doc.createElement('option'); ph.value = ''; ph.textContent = 'Elige un padecimiento';
        ph.disabled = true; select.appendChild(ph);
      }
      grupos.forEach(function (gr) {
        var og = doc.createElement('optgroup'); og.label = gr.grupo;
        gr.items.forEach(function (it) { var o = doc.createElement('option'); o.value = it.value; o.textContent = it.label; og.appendChild(o); });
        select.appendChild(og);
      });
      select.disabled = false;
      // Conserva una selección válida previa (p. ej. un release elegido mientras la cohorte fallaba).
      var valores = Array.prototype.map.call(select.querySelectorAll('option'), function (o) { return o.value; });
      select.value = previo && valores.indexOf(previo) !== -1 ? previo : (conPlaceholder ? '' : valores[0]);
    }

    /**
     * Arranque y reintento de la cohorte original. Si hero_series.json falla, los releases quedan
     * disponibles con la opción «Elige un padecimiento» y un «Reintentar» propio de la cohorte, que no
     * desaparece al elegir un release. Al recuperar la cohorte se conserva la selección vigente.
     */
    function arrancar() {
      var habia = select.value && select.value.indexOf('release:') === 0;
      return modelo.iniciar().then(function (grupos) {
        var fallo = modelo.heroFallo();
        poblar(grupos, Boolean(fallo));
        if (cohortBox) cohortBox.hidden = !fallo;
        if (fallo) {
          win.console && win.console.warn('[vista previa] hero_series.json:', fallo);
          if (!habia) {
            limpiar();
            // Sin la cohorte original no se elige un release solo: eso pediría una vista al cargar.
            setState('Elige un padecimiento para ver su serie nacional.');
          }
          return;
        }
        if (!habia) return elegir(select.value);
      });
    }
    if (cohortRetry) cohortRetry.addEventListener('click', arrancar);
    select.addEventListener('change', function () { if (select.value) elegir(select.value); });
    arrancar();

    var rt = 0;
    win.addEventListener('resize', function () {
      win.clearTimeout(rt);
      rt = win.setTimeout(function () { if (current) draw(current, 1); }, 150);
    });
    return modelo;
  }

  g.EpiPreview = {
    slotFor: slotFor, bandaPermitida: bandaPermitida, serieLegacy: serieLegacy, serieRelease: serieRelease,
    crearCargador: crearCargador, crearModelo: crearModelo, galeriaHref: galeriaHref, semanaTexto: semanaTexto,
    PALETTE_FALLBACK: PALETTE_FALLBACK, init: init,
  };
  if (g.document && typeof g.document.getElementById === 'function' && g.document.getElementById('hfCanvas')) init(g.document, g);
})(typeof window !== 'undefined' ? window : globalThis);
