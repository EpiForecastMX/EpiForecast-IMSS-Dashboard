// Opción «Pronóstico» del radar del boletín (orden del autor, alta_b44, 20-nov-2026).
// Lógica pura, sin DOM: la usan el radar en el navegador (pronostico_vista.mjs, radar.js), el generador
// scripts/radar_pronostico_exploratorio.mjs y las pruebas. No calcula ni corrige cifras publicadas: sólo
// decide qué fuente tiene cada categoría y lee la vista publicada, los datos legacy o el exploratorio.

export const ROTULO_EXPLORATORIO = 'Pronóstico exploratorio, no validado';
export const ADVERTENCIA_EXPLORATORIO = 'Referencia estacional nacional simple: cada semana es la media de la misma ' +
  'semana epidemiológica en los años anteriores disponibles (hasta tres). No tiene prueba de desempeño ni ' +
  'intervalos de incertidumbre y no es un pronóstico de EpiForecast-MX.';

export const ROTULO_NIVEL_RECIENTE = 'Pronóstico exploratorio, no validado: nivel reciente sin estacionalidad';
export const ADVERTENCIA_NIVEL_RECIENTE = 'Respaldo cuando la referencia estacional no tiene base: un valor plano igual a la ' +
  'media de las últimas semanas con cifra impresa (hasta ocho). No tiene estacionalidad, prueba de desempeño ni ' +
  'intervalos de incertidumbre y no es un pronóstico de EpiForecast-MX.';

export const ROTULO_NOTAS = 'Pronóstico exploratorio, no validado: nacional, derivado del acumulado publicado en las notas del boletín (no del cuadro estatal)';
export const ADVERTENCIA_NOTAS = 'El cuadro estatal no publica esta cifra; las notas del boletín imprimen un acumulado nacional. ' +
  'Los casos semanales se obtienen por diferencia de acumulados en el tramo consistente más reciente y el pronóstico es un ' +
  'valor plano igual a su media de las últimas semanas (hasta ocho). Sin estacionalidad, prueba de desempeño ni intervalos; ' +
  'no es un pronóstico de EpiForecast-MX.';

export const ESTADOS_PUBLICADOS = Object.freeze(['Publicada', 'Control publicado']);
export const LEGACY = Object.freeze({
  depresion: { pagina: 'Reports/index.html', nombre: 'Depresión' },
  parkinson: { pagina: 'Reports/index.html', nombre: 'Parkinson' },
  alzheimer: { pagina: 'Reports/index.html', nombre: 'Alzheimer' },
  dengue: { pagina: 'dengue.html', nombre: 'Dengue (suma de las tres formas clínicas)' },
});

/** Misma frase que assets/site/estado-ficha.js (SIN_ALTERNATIVA) y assets/dashboard/unified.mjs. */
export const SIN_ALTERNATIVA = 'Control estacional publicado: con un año de historia no hubo alternativa que elegir, no validado y sin validación prospectiva propia · pronóstico puntual sin intervalos';
const CONTROL_RE = /control estacional/i;

/** Qué pronóstico muestra la opción para una fila del radar, o null si es un agregado. */
export function fuentePronostico(e) {
  if (!e || e.aggregate) return null;
  if (e.platform_id && ESTADOS_PUBLICADOS.includes(e.status)) {
    return { tipo: 'publicado', id: e.platform_id, legacy: Object.hasOwn(LEGACY, e.platform_id) };
  }
  return { tipo: 'exploratorio', id: e.id };
}

/** Etiqueta literal de la vista (como estado-ficha.js). */
export function etiquetaVista(v) {
  if (v && v.portafolio_igual_al_control === true) return SIN_ALTERNATIVA;
  return v && typeof v.publication_label === 'string' ? v.publication_label : '';
}

/** pass | pending | control | null, con la semántica de estado-ficha.js tipo(). */
export function tipoVista(v) {
  const verdict = v && v.verdict;
  if (verdict === 'PASS') return 'pass';
  if (verdict === 'CONTROL_ONLY') return 'control';
  if (verdict === 'INCOMPLETE') return CONTROL_RE.test(etiquetaVista(v)) ? 'control' : 'pending';
  return null;
}

/** Rótulo corto y fiel de un release del runner, desde su vista. */
export function rotuloPublicado(v) {
  const wa = v.weeks_available ?? 0, wr = v.weeks_required ?? 4, k = tipoVista(v);
  if (v.caida_al_control) {
    return `Control estacional, no validado: portafolio rechazado en su prueba única; ${wa}/${wr} semanas registradas como contador técnico, no validación`;
  }
  if (v.portafolio_igual_al_control === true) {
    return `Control estacional, no validado: sin alternativa con un año de historia; ${wa}/${wr} semanas registradas como contador técnico, no validación`;
  }
  if (k === 'control') return `Control estacional, no validado; ${wa}/${wr} semanas registradas como contador técnico`;
  if (k === 'pass') return `Aceptado en su prueba única; validación prospectiva superada (${wa}/${wr} semanas)`;
  if (k === 'pending') return `Aceptado en su prueba única; validación prospectiva en curso (${wa}/${wr} semanas), aún no validado`;
  return etiquetaVista(v) || `Veredicto ${v.verdict ?? 'sin dato'}`;
}

/** Serie nacional de la vista: general, o la nacional que exista. */
export function serieNacional(v) {
  const s = v?.series ?? {};
  if (s['nacional|mx|general']) return { clave: 'nacional|mx|general', serie: s['nacional|mx|general'] };
  const k = Object.keys(s).find((x) => x.startsWith('nacional|'));
  return k ? { clave: k, serie: s[k] } : null;
}

const semanaTxt = (yw) => (Array.isArray(yw) ? `${yw[0]}-W${String(yw[1]).padStart(2, '0')}` : '');

/** Modelo de gráfica de un release del runner. Lanza si la vista no trae la serie nacional de 52 semanas. */
export function desdeVista(v, id) {
  const n = serieNacional(v);
  if (!n || !Array.isArray(n.serie.pronostico) || !n.serie.pronostico.length) throw new Error(`vista sin serie nacional: ${id}`);
  return {
    tipo: 'publicado', fuente: `publication/${id}/vista.json`, pagina: `${id}.html`,
    nombre: v.nombre_completo || v.display_name || id,
    rotulo: rotuloPublicado(v), etiqueta: etiquetaVista(v), incertidumbre: v.uncertainty_label || '',
    origen: semanaTxt(v.origin), serie_nombre: `${n.serie.nombre} · ${n.serie.sexo_nombre ?? 'General'}`,
    observado: (n.serie.observado ?? []).map(([ds, y]) => ({ ds, y })),
    pronostico: n.serie.pronostico.map(([ds, y]) => ({ ds, y })),
    total: n.serie.pronostico_52_total ?? null,
  };
}

/** Modelo de gráfica de un legacy desde hero_series.json (los datos de la Figura 1 de la portada). */
export function desdeLegacy(hero, id) {
  const s = hero?.series?.find((x) => x.key === id);
  if (!s) throw new Error(`hero_series.json sin la serie legacy: ${id}`);
  const observado = [], pronostico = [];
  s.d.forEach((ds, i) => {
    if (s.r[i] != null) observado.push({ ds, y: s.r[i] });
    if (s.y[i] != null) pronostico.push({ ds, y: s.y[i] });
  });
  return {
    tipo: 'publicado', legacy: true, fuente: 'hero_series.json', pagina: LEGACY[id].pagina, nombre: LEGACY[id].nombre,
    rotulo: `Pronóstico publicado del carril original · motor nacional ${s.motor} · corte ${s.corte}`,
    etiqueta: '', detalle: `Definición publicada: ${s.casos_definicion}. Son los mismos datos de la Figura 1 de la portada.`,
    incertidumbre: s.intervalo_disponible ? 'Pronóstico puntual; su intervalo se consulta en la ficha' : 'Pronóstico puntual; sin intervalo de incertidumbre',
    origen: s.corte, serie_nombre: 'Nacional · General', observado, pronostico, total: s.casos ?? null,
  };
}

/** Modelo de gráfica de una categoría sin release, desde pronostico_exploratorio.json y su serie impresa. */
export function desdeExploratorio(doc, id, observado = []) {
  const c = doc?.categorias?.[id];
  if (!c) throw new Error(`pronóstico exploratorio sin la categoría: ${id}`);
  return {
    tipo: 'exploratorio', fuente: 'pronostico_exploratorio.json', nombre: c.nombre,
    metodo: c.metodo ?? null, nivel_reciente: c.metodo === 'nivel_reciente_sin_estacionalidad',
    notas: c.metodo === 'nivel_reciente_acumulado_de_notas', fuente_notas: c.fuente_notas ?? null,
    rotulo: c.rotulo ?? ROTULO_EXPLORATORIO,
    advertencia: { nivel_reciente_sin_estacionalidad: ADVERTENCIA_NIVEL_RECIENTE, nivel_reciente_acumulado_de_notas: ADVERTENCIA_NOTAS }[c.metodo] ?? ADVERTENCIA_EXPLORATORIO,
    motivo: c.motivo_sin_modelo, motivo_respaldo: c.motivo_respaldo ?? null,
    base: c.semanas_base ? { n: c.n_semanas_base, periodo: c.periodo_base, nivel: c.nivel, nota: c.nota_base } : null,
    enlace: c.estado_radar === 'Rechazada' ? { href: 'rechazados.html', texto: 'Evidencia en analizados y rechazados' }
      : { href: `no_modelables.html#cat-${id}`, texto: 'Motivo y cifras de las categorías sin pronóstico' },
    sin_pronostico: c.sin_pronostico ?? null, origen: semanaTxt(c.origen), anios: c.anios_usados ?? [],
    serie_nombre: c.fuente_notas ? 'Nacional · casos semanales derivados del acumulado de las notas del boletín' : 'Nacional · serie semanal impresa del boletín',
    observado: c.fuente_notas ? c.fuente_notas.semanales_derivadas.map((x) => ({ ds: x.ds, y: x.valor })) : observado,
    pronostico: (c.pronostico ?? []).map((s) => ({ ds: s.ds, y: s.valor, anios: s.anios })),
    total: c.pronostico ? Math.round(c.pronostico.reduce((a, s) => a + s.valor, 0)) : null,
  };
}

/** Cobertura de la opción Pronóstico sobre las categorías no agregadas de la foto. */
export function coberturaPronostico(diseases, doc) {
  const cats = diseases.filter((e) => !e.aggregate);
  let publicado = 0, exploratorio = 0, nivel = 0, notas = 0, sinHistoria = 0, sinOpcion = 0;
  for (const e of cats) {
    const f = fuentePronostico(e);
    if (f.tipo === 'publicado') publicado++;
    else if (doc?.categorias?.[e.id]?.pronostico) {
      const met = doc.categorias[e.id].metodo;
      if (met === 'nivel_reciente_sin_estacionalidad') nivel++; else if (met === 'nivel_reciente_acumulado_de_notas') notas++; else exploratorio++;
    }
    else if (doc?.categorias?.[e.id]) sinHistoria++;
    else sinOpcion++;
  }
  const total = cats.length, con = total - sinOpcion, conPronostico = publicado + exploratorio + nivel + notas;
  // exploratorio = referencia estacional; nivel_reciente = respaldo plano; sin_historia = sin ningún pronóstico.
  return { total, publicado, exploratorio, nivel_reciente: nivel, notas, sin_historia: sinHistoria, sin_opcion: sinOpcion,
    con_opcion: con, con_pronostico: conPronostico,
    pct: total ? Math.round((con / total) * 1000) / 10 : 0,
    pct_pronostico: total ? Math.round((conPronostico / total) * 1000) / 10 : 0 };
}
