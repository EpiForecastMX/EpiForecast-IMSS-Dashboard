/**
 * vista_turno.mjs — Detección geográfica/demográfica, calendario MMWR y resolución conversacional
 * determinista previa a las guardas clínicas, categorías no modeladas y estado de vista en rag.mjs.
 */

export const strip = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const normEsp = (s) => strip(s).replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const normPal = (s) => strip(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const ESTADOS_NOMBRES = [
  'Baja California Sur', 'Baja California', 'San Luis Potosí', 'Quintana Roo', 'Nuevo León',
  'Aguascalientes', 'Campeche', 'Coahuila', 'Colima', 'Chiapas', 'Chihuahua', 'Durango', 'Guanajuato',
  'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Oaxaca', 'Puebla', 'Querétaro',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
].map((nombre) => [new RegExp(`\\b${strip(nombre)}\\b`, 'g'), nombre]);

const ALIAS_GEO = [
  [/\b(ciudad de mexico|cdmx|distrito federal|d\s*f)\b/g, 'estado', 'Ciudad de México'],
  [/\b(estado de mexico|edomex|edo\s*(?:de\s+)?mex(?:ico)?)\b/g, 'estado', 'México'],
  [/\bregion\s+centro\b/g, 'region', 'Región Centro'],
  [/\bregion\s+norte\b/g, 'region', 'Región Norte'],
  [/\bregion\s+occidente\b/g, 'region', 'Región Occidente'],
  [/\bregion\s+sureste\b/g, 'region', 'Región Sureste'],
];

function inicioMmwr(anio) {
  const d = new Date(Date.UTC(anio, 0, 1));
  const dow = d.getUTCDay();
  return Date.UTC(anio, 0, 1 + (dow <= 3 ? -dow : 7 - dow));
}

function semanasMmwr(anio) {
  return Math.round((inicioMmwr(anio + 1) - inicioMmwr(anio)) / (7 * 864e5));
}

export function semana([anio, sem]) {
  return `${anio}-W${String(sem).padStart(2, '0')}`;
}

export function semanaSig([a, s], pasos) {
  let anio = a;
  let sem = s + pasos;
  while (sem > semanasMmwr(anio)) {
    sem -= semanasMmwr(anio);
    anio += 1;
  }
  return [anio, sem];
}

const NOMBRA_LEGACY_DOC = /\b(depresion|depression|f32|parkinson|g20|alzheimer|alzaimer|g30|dengue|a97|micai|wcp|congreso mundial|world congress|calass|alass|helix|public health futures|skopje|oneplus|plos)\b/;
const PIDE_CALIDAD_ESTADO = /\b(validad\w*|valida|validacion|confiab\w*|fiable|confiar|aceptad\w*|rechaz\w*|calidad|precis\w*|exactitud|que tan (bueno|exacto|preciso)|sirve)\b/;
const PIDE_METRICA_ERROR = /\b(error\w*|smape)\b/;
const PIDE_ESTADO_RE = /\b(validad\w*|valida|validacion|confiab\w*|fiable|confiar|aceptad\w*|rechaz\w*|calidad|precis\w*|exactitud|que tan (bueno|exacto|preciso)|error\w*|smape|sirve)\b/;
const PIDE_CIFRAS_ESTRICTO = /\b(cuantos?|cuantas?|total(es)?|pronostican|pronosticad[oa]s?|esperan|esperad[oa]s?|previst[oa]s?|proyecta\w*|52 semanas|horizonte|observad\w*|fuera de muestra|202\d ?w\d{1,2}|semana \d{1,2}|boletin \d{1,2}|mae|sesgo|bias|how many|forecasted|expected)\b/;
const PIDE_PRONOSTICO_O_SERIE = /\b(pronostico|prediccion|casos|serie|series|hay pronostico|existe pronostico|forecast|prediction|cases)\b/;
const PIDE_NACIONAL = /\b(nacional(es)?|a nivel nacional|total nacional|en mexico|de mexico|todo el pais|en el pais|republica mexicana|nationwide|in mexico)\b/;
const MOD_FAMILIA = /\b(congenit[a-z]*|neonatal\w*|connatal\w*|perinatal\w*|vertical|fetal\w*|mortinat\w*|stillbirth\w*|gestacional|gestational|gestantes?|matern[ao]s?|maternal|embaraz\w*|pregnan\w*|puerper\w*|parto|childbirth|recien nacid[oa]s?|newborns?|bebes?|babies|baby|lactantes?|infants?|nin[oa]s?|children|child|menores?|adolescentes?|pediatric[oa]?s?|tipo (?:1|2|i|ii|uno|dos)|pulmonar)\b/;

export const CONSEJO_CLINICO = /\b(creo que tengo|como se cura|cura para|tratamientos?|medicamentos?|que tomar|antibioticos?|penicilina|receta|sintomas?|como se contagia|como se transmite|prueba de sangre|vdrl|consulta medica|me contagi\w*)\b/;
export const GENERICO_ESTATAL = /\b(por (estado|entidad)|cada (estado|entidad)|ranking|ordenad[oa]s|mayor incidencia|menor error|todos los estados)\b/;

export function detectarGeos(query) {
  let q = normPal(query);
  const out = [];
  for (const [re, nivel, nombre] of ALIAS_GEO) {
    if (re.test(q)) {
      out.push({ nivel, nombre });
      q = q.replace(re, ' ');
    }
  }
  for (const [re, nombre] of ESTADOS_NOMBRES) {
    if (re.test(q)) {
      if (!out.some((x) => x.nivel === 'estado' && x.nombre === nombre)) {
        out.push({ nivel: 'estado', nombre });
      }
      q = q.replace(re, ' ');
    }
  }
  return out;
}

export function detectarSexo(query) {
  const q = normPal(query);
  const h = /\b(hombres?|masculin[oa]s?|varones?|men|man|males?)\b/.test(q);
  const m = /\b(mujeres?|femenin[oa]s?|women|woman|females?)\b/.test(q);
  if (h && m) return 'ambos';
  if (h) return 'hombres';
  if (m) return 'mujeres';
  return /\b(general|ambos sexos|total general)\b/.test(q) ? 'general' : null;
}

function releasesEn(query) {
  const C = globalThis.EPI_CATALOGO;
  if (!C) return [];
  const qn = C.canonClinico(normEsp(query));
  const d = C.diabetesEnConsulta(qn.replace(/[^a-z0-9 ]/g, ' '));
  if (d && !d.generica) {
    return d.pads.map((p) => C.releases.find((r) => r.pad === p)).filter(Boolean);
  }
  const aj = C.subtipoAjeno(strip(query));
  return C.releases.filter((r) => (!aj || r.pad !== aj.pad) && r.alias.some((a) => C.nombraAlias(qn, a)));
}

function esTurnoSeguimiento(raw) {
  const q = normPal(raw);
  if (!q) return false;
  if (/^(y|pero|ademas|entonces|ok|tambien|ahora|que hay de|que tal|and|but|also|what about|how about)\b/.test(q)) {
    return true;
  }
  if (/\b(eso|ese|esa|ahi|alli|el mismo|la misma|este padecimiento|esa serie|su error|su pronostico|esta validad[oa]|es confiable)\b/.test(q)) {
    return true;
  }
  return q.split(' ').length <= 9 && (
    detectarGeos(raw).length > 0 ||
    PIDE_NACIONAL.test(q) ||
    Boolean(detectarSexo(raw)) ||
    PIDE_ESTADO_RE.test(q) ||
    PIDE_CIFRAS_ESTRICTO.test(q) ||
    MOD_FAMILIA.test(q)
  );
}

function analizarTurno(t, prev) {
  const C = globalThis.EPI_CATALOGO;
  let evalTxt = t;
  if (prev?.pad && C) {
    const tn = normPal(t);
    const base = /^(y|pero|tambien|que hay de|ahora|and|what about)\b/.test(tn) ? tn : `y ${tn}`;
    const r1 = C.conDiabetesNombrada(base, prev.pad);
    const r2 = C.conFamiliaNombrada(r1, prev.pad);
    const r3 = C.conHipertensionNombrada(r2, prev.pad);
    if (r3 !== base) evalTxt = r3;
  }
  const qs = strip(evalTxt);
  const qp = normPal(evalTxt);
  if (NOMBRA_LEGACY_DOC.test(qs)) return { tipo: 'legacy', query: evalTxt };
  if (C?.subtipoAjeno(qs)) return { tipo: 'ajeno', query: evalTxt };
  if (C?.aliasAmbiguo(qs)) return { tipo: 'ambiguo', query: evalTxt };
  if (C?.mencionaNoModelada(qs)) {
    return { tipo: 'noModelada', query: evalTxt, termino: C.mencionaNoModelada(qs) };
  }
  const rels = releasesEn(evalTxt);
  if (rels.length > 0) {
    const canon = C.canonClinico(normEsp(evalTxt));
    const geos = detectarGeos(evalTxt);
    const sexo = detectarSexo(evalTxt);
    const estricto = PIDE_CIFRAS_ESTRICTO.test(qp);
    const pronSerie = PIDE_PRONOSTICO_O_SERIE.test(qp);
    const pideCalidad = PIDE_CALIDAD_ESTADO.test(canon);
    const pideError = PIDE_METRICA_ERROR.test(canon);
    const detallarSerie = estricto || (pideError && !pideCalidad && (geos.length > 0 || Boolean(sexo)));
    return {
      tipo: 'release',
      releases: rels,
      pad: rels.length === 1 ? rels[0].pad : null,
      geos,
      nacional: PIDE_NACIONAL.test(qp),
      sexo,
      pideEstado: PIDE_ESTADO_RE.test(canon),
      debeDetallarSerieVista: detallarSerie,
      pideVista: detallarSerie || (!PIDE_ESTADO_RE.test(canon) && (pronSerie || geos.length > 0 || Boolean(sexo))),
    };
  }
  if (!prev || !esTurnoSeguimiento(t)) return null;
  if (prev.tipo !== 'release' || prev.releases.length !== 1) return prev;
  const r = prev.releases[0];
  const comb = `${r.consulta} ${t}`;
  if (C?.subtipoAjeno(strip(comb))) return { tipo: 'ajeno', query: comb };
  if (C?.aliasAmbiguo(strip(comb))) return { tipo: 'ambiguo', query: comb };
  if (C?.mencionaNoModelada(strip(comb))) {
    return { tipo: 'noModelada', query: comb, termino: C.mencionaNoModelada(strip(comb)) };
  }
  const ownGeos = detectarGeos(t);
  const ownNac = PIDE_NACIONAL.test(qp);
  const ownSexo = detectarSexo(t);
  const newGeo = ownGeos.length > 0 || ownNac;
  const canonOwn = C.canonClinico(normEsp(t));
  const ownEst = PIDE_ESTADO_RE.test(canonOwn);
  const ownCal = PIDE_CALIDAD_ESTADO.test(canonOwn);
  const ownErr = PIDE_METRICA_ERROR.test(canonOwn);
  const ownCif = PIDE_CIFRAS_ESTRICTO.test(qp);
  const detallarOwn = ownCif || (ownErr && !ownCal && (newGeo || Boolean(ownSexo) || prev.geos.length > 0));
  return {
    ...prev,
    geos: newGeo ? ownGeos : prev.geos,
    nacional: newGeo ? (ownNac && !ownGeos.length) : prev.nacional,
    sexo: ownSexo || prev.sexo,
    pideEstado: ownEst,
    debeDetallarSerieVista: detallarOwn,
    pideVista: ownEst
      ? detallarOwn
      : (prev.pideVista || ownCif || newGeo || Boolean(ownSexo) || PIDE_PRONOSTICO_O_SERIE.test(qp)),
  };
}

export function resolverConsultaRag(query, history = []) {
  const raw = String(query ?? '').trim();
  if (!raw || !Array.isArray(history) || !history.length) {
    const est = analizarTurno(raw, null);
    return { query: raw, contextualizada: null, estado: est, debeDetallarSerieVista: Boolean(est?.debeDetallarSerieVista) };
  }
  const propio = analizarTurno(raw, null);
  if (propio) {
    return { query: raw, contextualizada: null, estado: propio, debeDetallarSerieVista: Boolean(propio.debeDetallarSerieVista) };
  }
  if (!esTurnoSeguimiento(raw)) {
    return { query: raw, contextualizada: null, estado: null, debeDetallarSerieVista: false };
  }
  let est = null;
  for (const h of history.filter((x) => x && x.role === 'user' && typeof x.text === 'string').slice(-6)) {
    est = analizarTurno(h.text.trim(), est) || est;
  }
  const final = analizarTurno(raw, est);
  if (!final || final.tipo === 'legacy') {
    return { query: raw, contextualizada: null, estado: final, debeDetallarSerieVista: false };
  }
  if (final.tipo !== 'release') {
    return { query: final.query, contextualizada: final.query, estado: final, debeDetallarSerieVista: false };
  }
  const r = final.releases[0];
  const geoTxt = final.geos.length
    ? ` en ${final.geos.map((g) => (g.nombre === 'México' ? 'Estado de México' : g.nombre)).join(' y ')}`
    : (final.nacional ? ' en México' : '');
  const sexTxt = final.sexo && final.sexo !== 'general'
    ? ` (${final.sexo === 'ambos' ? 'hombres y mujeres' : final.sexo})`
    : '';
  const ctx = `${r.consulta}${geoTxt}${sexTxt}: ${raw}`;
  return { query: ctx, contextualizada: ctx, estado: final, debeDetallarSerieVista: Boolean(final.debeDetallarSerieVista) };
}
