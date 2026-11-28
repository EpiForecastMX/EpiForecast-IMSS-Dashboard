/**
 * vista_turno.mjs — Detección geográfica/demográfica, intención metodológica vs numérica/estado,
 * calendario MMWR y resolución conversacional determinista previa a guardas y vista en rag.mjs.
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
const CORTESIA_O_CIERRE = /^(?:ok|okay|vale|bien|bueno|gracias|muchas gracias|perfecto|entendido|claro|listo|de acuerdo|excelente|genial|hola|buenos dias|buenas tardes|buenas noches|thank you|thanks|got it)(?:\s+(?:gracias|muchas gracias|por la informacion|entendido|perfecto|claro|listo|epi))*\s*$/;
const CAMBIO_TEMA_PROYECTO = /\b(padecimientos?|enfermedades|catalogo|epiforecast|epibot|dashboard|plataforma|proyecto|sitio web|cuantos modelos tiene|que modela\w*|cuales modela\w*)\b/;
const PIDE_CALIDAD_ESTADO = /\b(validad\w*|valida|validacion|confiab\w*|fiable|confiar|aceptad\w*|rechaz\w*|calidad|precis\w*|exactitud|que tan (bueno|exacto|preciso)|sirve)\b/;
const PIDE_METRICA_ERROR = /\b(error\w*|smape)\b/;
const PIDE_ESTADO_RE = /\b(validad\w*|valida|validacion|confiab\w*|fiable|confiar|aceptad\w*|rechaz\w*|calidad|precis\w*|exactitud|que tan (bueno|exacto|preciso)|error\w*|smape|sirve)\b/;
const PIDE_CIFRAS_ESTRICTO = /\b(cuantos?|cuantas?|total(es)?|pronostican|pronosticad[oa]s?|esperan|esperad[oa]s?|previst[oa]s?|proyecta\w*|52 semanas|horizonte|observad\w*|fuera de muestra|202\d ?w\d{1,2}|semana \d{1,2}|boletin \d{1,2}|mae|sesgo|bias|how many|forecasted|expected)\b/;
const PIDE_PRONOSTICO_DIRECTO = /^(?:el |un |ver |dame |deme |mostrar |muestrame |consultar )?(?:pronostico|prediccion|forecast)\b|\b(?:cual es|cuales son|dame|deme|ver|mostrar|muestrame|consultar|hay|existe|is there|what is)\s+(?:el\s+|un\s+|la\s+|a\s+|the\s+)?(?:pronostico|prediccion|forecast|prediction)\b|\bcasos\s+(?:de|en|para|del)\b/;
// Deuda del detector, ronda 18 (Codex Sol): «todo México» también es el ámbito nacional, como en el KB.
const PIDE_NACIONAL = /\b(nacional(es)?|a nivel nacional|total nacional|en mexico|de mexico|todo el pais|todo mexico|en el pais|republica mexicana|nationwide|in mexico)\b/;
const MOD_FAMILIA = /\b(congenit[a-z]*|neonatal\w*|connatal\w*|perinatal\w*|vertical|fetal\w*|mortinat\w*|stillbirth\w*|gestacional|gestational|gestantes?|matern[ao]s?|maternal|embaraz\w*|pregnan\w*|puerper\w*|parto|childbirth|recien nacid[oa]s?|newborns?|bebes?|babies|baby|lactantes?|infants?|nin[oa]s?|children|child|menores?|adolescentes?|pediatric[oa]?s?|tipo (?:1|2|i|ii|uno|dos)|pulmonar)\b/;
const SUMA_SEGUIMIENTO = /\b(sum\w*|junt[oa]s?|combinad[oa]s?|mas el|mas la)\b/;

const PREGUNTA_METODO = /\b(por que|a que se debe\w*|de que manera|en que medida|en que consiste\w*|como (?:se )?(?:influy\w*|afect\w*|impact\w*|incid\w*|alter\w*|distorsion\w*|sesg\w*|repercut\w*|explic\w*|interpreta\w*|lee\w*|entiend\w*|funcion\w*|oper\w*|construy\w*|calcul\w*|estim\w*|reconstruy\w*|reconcili\w*|seleccion\w*|elig\w*|evalua\w*|entren\w*|model\w*|manej\w*|corrig\w*|imput\w*|obtien\w*|deriv\w*|agreg\w*)|que (?:efecto\w*|impacto\w*|influencia\w*|consecuencia\w*|problema\w*|limitacion\w*|implicacion\w*|alcance|significa\w*|papel|rol|discrepancia\w*|diferencia\w*|motores?|modelos?|algoritmos?|candidatos?|metodos?|politica\w*|ocurri\w*|paso|sucedi\w*)|why (?:did|was|were|is|are|do|does)|how (?:does|do|did|is|was|were) [\w ]{1,30} (?:affect\w*|influenc\w*|impact\w*|select\w*|buil\w*|reconstruct\w*|imput\w*)|what (?:effect\w*|impact\w*|problem\w*|limitation\w*|engines?|models?))\b/;
const TEMA_METODO_FUENTE = /\b(metodologi\w*|imputad[oa]s?|imputacion\w*|imputed|imputation|raster|encabezados?|subregistro|cambio de nivel|ruptura de nivel|picos? heredados?|rolling|validacion cruzada|cross validation|pliegues?|folds?|reentren\w*|hiperparametro\w*|motores? candidatos?|seleccion de (?:motores|modelos)|compitieron|se evaluaron|mase|modelo\w* ets|motor\w* ets|candidato\w* ets|ets amortiguad\w*|ets y ridge|ridge y ets|sin ets|ridge|prophet|sex distribution|sex reconstruction|source quality|data quality)\b/;
const TEMA_SEXO_O_FUENTE = /\b(reparto|reconstruccion|reconciliacion|redistribucion|discrepancia|desajuste|inconsistencia|problema\w*)s?(?:\s+\w+){0,4}\s+sexo\b|\bsexo(?:\s+\w+){0,4}\s+(reparto|reconstruccion|reconciliacion|discrepancia|desajuste|inconsistencia)\b|\b(?:bajas?|correccion\w*|reconciliacion|discrepancia\w*|ajuste\w*|reconstruccion) (?:de |del |con el |a partir de )?(?:los )?acumulad[oa]s?\b|\bacumulad[oa]s? del boletin\b|\bcalidad de (?:la |los |las )?(?:fuente\w*|dato\w*|registro\w*|boletin\w*|captura)\b|\bproblemas? de(?:l| la| los| las)? (?:fuente\w*|dato\w*|boletin\w*|captura|registro|notificacion)\b/;

export const CONSEJO_CLINICO = /\b(creo que tengo|tengo sintomas|como se (?:cura\w*|trata\w*|previene\w*|diagnostica\w*|contagia\w*|transmite\w*)|cura para|tratar\b|tratamientos?|prevencion|prevenir|diagnostico|diagnosticar|medicamentos?|que tomar|antibioticos?|penicilina|receta|vacuna\w*|sintomas?|prueba de sangre|vdrl|consulta medica|me contagi\w*)\b/;
export const GENERICO_ESTATAL = /\b(por (?:estado|entidad)|cada (?:estado|entidad)|ranking|ordenad[oa]s|(?:que|cual|cuales) (?:estado|entidad)\w*|(?:estados?|entidades) (?:con )?(?:mas|menos|mayor\w*|menor\w*|peor\w*|mejor\w*)|mayor incidencia|menor incidencia|menor error|mayor error|mas casos|menos casos|todos los estados|comparar estados)\b/;
export const PIDE_ESTRATO_EDAD = /\b(adultos? mayores?|ancian[oa]s?|tercera edad|vejez|geriatric[oa]s?|senescentes?|(?:por|segun) (?:grupo\w* de )?edad(?:es)?|estratificad[oa]\w* por edad|desglose por edad|grupo\w* etario\w*|grupos? de edad|\d{1,2}\s*a\s*\d{1,2}\s*anos|(?:mayores|menores) de \d{1,3}\s*anos)\b/;

export function esIntencionMetodologica(query) {
  const qp = normPal(query);
  if (!qp || CONSEJO_CLINICO.test(qp)) return false;
  return PREGUNTA_METODO.test(qp) || TEMA_METODO_FUENTE.test(qp) || TEMA_SEXO_O_FUENTE.test(qp);
}

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
      if (!out.some((x) => x.nivel === 'estado' && x.nombre === nombre)) out.push({ nivel: 'estado', nombre });
      q = q.replace(re, ' ');
    }
  }
  return out;
}

export function detectarSexo(query) {
  const q = normPal(query);
  const h = /\b(hombres?|masculin[oa]s?|varones?|men|man|males?)\b/.test(q);
  const m = /\b(mujeres?|femenin[oa]s?|women|woman|females?)\b/.test(q);
  // Deuda del detector, rondas 17 y 21 (Codex Sol): «por sexo» pide ambas series, salvo que se nombre un solo sexo.
  if (h && m) return 'ambos';
  if (h) return 'hombres';
  if (m) return 'mujeres';
  if (/\b(por (sexo|sexos|genero|generos)|by (sex|gender))\b/.test(q)) return 'ambos';
  return /\b(general|ambos sexos|total general)\b/.test(q) ? 'general' : null;
}

function releasesEn(query) {
  const C = globalThis.EPI_CATALOGO;
  if (!C) return [];
  const qn = C.canonClinico(normEsp(query));
  const d = C.diabetesEnConsulta(qn.replace(/[^a-z0-9 ]/g, ' '));
  if (d && !d.generica) return d.pads.map((p) => C.releases.find((r) => r.pad === p)).filter(Boolean);
  const aj = C.subtipoAjeno(strip(query));
  // Decimoséptima auditoría: delega en el resolutor único del catálogo.
  return C.releasesEnConsulta(qn, { parcial: false }).filter((r) => !aj || r.pad !== aj.pad);
}

function esTurnoSeguimiento(raw) {
  const q = normPal(raw);
  if (!q || CORTESIA_O_CIERRE.test(q) || CAMBIO_TEMA_PROYECTO.test(q)) return false;
  if (/^(y|pero|ademas|tambien|que hay de|que tal|and|but|also|what about|how about)\b/.test(q)) return true;
  if (/\b(eso|ese|esa|ahi|alli|el mismo|la misma|este padecimiento|este pronostico|ese pronostico|ese modelo|esa serie|su error|su pronostico|su fuente|su reparto|su metodologia|esta validad[oa]|es confiable)\b/.test(q)) {
    return true;
  }
  return q.split(' ').length <= 8 && (
    detectarGeos(raw).length > 0 ||
    PIDE_NACIONAL.test(q) ||
    Boolean(detectarSexo(raw)) ||
    MOD_FAMILIA.test(q) ||
    PIDE_ESTRATO_EDAD.test(q) ||
    /^(?:esta |es |fue )?(?:validad[oa]|confiable|fiable|precis[oa]|aceptad[oa])\b/.test(q)
  );
}

function analizarTurno(t, prev) {
  const C = globalThis.EPI_CATALOGO;
  let evalTxt = t;
  if (prev?.pad && C && !CAMBIO_TEMA_PROYECTO.test(normPal(t)) && !CORTESIA_O_CIERRE.test(normPal(t))) {
    const tn = normPal(t);
    const base = /^(y|pero|tambien|que hay de|ahora|and|what about)\b/.test(tn) ? tn : `y ${tn}`;
    const r3 = C.conHipertensionNombrada(C.conFamiliaNombrada(C.conDiabetesNombrada(base, prev.pad), prev.pad), prev.pad);
    if (r3 !== base) evalTxt = r3;
  }
  const qs = strip(evalTxt);
  const qp = normPal(evalTxt);
  if (CORTESIA_O_CIERRE.test(qp)) return { tipo: 'cortesia', query: t };
  // Deuda del detector, ronda 21 (Fable): los alias de los cuatro originales que reconoce el KB («depre») también cuentan, para
  // no heredar un padecimiento anterior que el KB ya no usa.
  if (NOMBRA_LEGACY_DOC.test(qs) || (C && !releasesEn(evalTxt).length && (C.padecimientosEnConsulta(evalTxt, { parcial: false }).legacy || []).length)) return { tipo: 'legacy', query: evalTxt };
  if (C?.subtipoAjeno(qs)) return { tipo: 'ajeno', query: evalTxt };
  if (C?.aliasAmbiguo(qs)) return { tipo: 'ambiguo', query: evalTxt };
  if (C?.mencionaNoModelada(qs)) return { tipo: 'noModelada', query: evalTxt, termino: C.mencionaNoModelada(qs) };
  const rels = releasesEn(evalTxt);
  if (rels.length > 0) {
    const canon = C.canonClinico(normEsp(evalTxt));
    const geos = detectarGeos(evalTxt);
    const sexo = detectarSexo(evalTxt);
    const estratoEdad = PIDE_ESTRATO_EDAD.test(qp);
    const esMetodologica = esIntencionMetodologica(evalTxt);
    const estricto = PIDE_CIFRAS_ESTRICTO.test(qp);
    const pronDirecto = PIDE_PRONOSTICO_DIRECTO.test(qp);
    const pideCalidad = PIDE_CALIDAD_ESTADO.test(canon);
    const pideError = PIDE_METRICA_ERROR.test(canon);
    const detallarSerie = !esMetodologica && (estricto || (pideError && !pideCalidad && (geos.length > 0 || Boolean(sexo))));
    return {
      tipo: 'release',
      releases: rels,
      pad: rels.length === 1 ? rels[0].pad : null,
      geos,
      nacional: PIDE_NACIONAL.test(qp),
      sexo,
      estratoEdad,
      pideEstado: !esMetodologica && PIDE_ESTADO_RE.test(canon),
      esMetodologica,
      debeDetallarSerieVista: detallarSerie,
      pideVista: !esMetodologica && (detallarSerie || (!PIDE_ESTADO_RE.test(canon) && (pronDirecto || geos.length > 0 || Boolean(sexo) || estratoEdad))),
    };
  }
  if (CAMBIO_TEMA_PROYECTO.test(qp)) return { tipo: 'alcance_proyecto', query: t };
  if (!prev || !esTurnoSeguimiento(t)) return null;
  if (prev.tipo !== 'release' || prev.releases.length !== 1) return prev;
  const r = prev.releases[0];
  const comb = `${r.consulta} ${t}`;
  if (C?.subtipoAjeno(strip(comb))) return { tipo: 'ajeno', query: comb };
  if (C?.aliasAmbiguo(strip(comb))) return { tipo: 'ambiguo', query: comb };
  if (C?.mencionaNoModelada(strip(comb))) return { tipo: 'noModelada', query: comb, termino: C.mencionaNoModelada(strip(comb)) };
  const ownGeos = detectarGeos(t);
  const ownNac = PIDE_NACIONAL.test(qp);
  const ownSexo = detectarSexo(t);
  const ownEdad = PIDE_ESTRATO_EDAD.test(qp);
  const newGeo = ownGeos.length > 0 || ownNac;
  const canonOwn = C.canonClinico(normEsp(t));
  const ownEst = PIDE_ESTADO_RE.test(canonOwn);
  const ownCal = PIDE_CALIDAD_ESTADO.test(canonOwn);
  const ownErr = PIDE_METRICA_ERROR.test(canonOwn);
  const ownCif = PIDE_CIFRAS_ESTRICTO.test(qp);
  const ownMetodo = esIntencionMetodologica(t);
  const detallarOwn = !ownMetodo && (ownCif || (ownErr && !ownCal && (newGeo || Boolean(ownSexo) || prev.geos.length > 0)));
  return {
    ...prev,
    geos: newGeo ? ownGeos : prev.geos,
    nacional: newGeo ? (ownNac && !ownGeos.length) : prev.nacional,
    sexo: ownSexo || prev.sexo,
    estratoEdad: ownEdad,
    pideEstado: !ownMetodo && ownEst,
    esMetodologica: ownMetodo,
    debeDetallarSerieVista: detallarOwn,
    pideVista: ownMetodo
      ? false
      : (ownEst ? detallarOwn : (ownCif || newGeo || Boolean(ownSexo) || ownEdad || PIDE_PRONOSTICO_DIRECTO.test(qp))),
  };
}

/**
 * Auditoría Codex de alta_b44 (19-nov-2026): el turno nombra por sí mismo un padecimiento que no es sensible (legacy,
 * release o no modelado). Sólo eso levanta el estado de crisis de la conversación.
 */
export function nombraPadecimientoNoSensible(raw) {
  const C = globalThis.EPI_CATALOGO;
  if (!C) return false;
  const qs = strip(raw);
  if (/\b(depresion|depression|f32|parkinson|g20|alzheimer|alzaimer|g30|dengue|a97)\b/.test(normPal(raw))) return true;
  const rels = releasesEn(raw);
  if (rels.length) return rels.every((r) => !r.sensible);
  return Boolean(C.subtipoAjeno(qs) || C.aliasAmbiguo(qs) || C.mencionaNoModelada(qs));
}

/** Crisis activa según los turnos previos del usuario en el historial. */
export function crisisEnHistorial(history = []) {
  const C = globalThis.EPI_CATALOGO;
  if (!C || !Array.isArray(history)) return false;
  const turnos = history.filter((x) => x && x.role === 'user' && typeof x.text === 'string').map((x) => x.text);
  return C.crisisEnTurnos(turnos, nombraPadecimientoNoSensible);
}

function estadoHistorial(history) {
  let est = null;
  for (const h of history.filter((x) => x && x.role === 'user' && typeof x.text === 'string').slice(-6)) {
    est = analizarTurno(h.text.trim(), est) || est;
  }
  return est;
}

export function resolverConsultaRag(query, history = []) {
  const raw = String(query ?? '').trim();
  const armar = (q, ctx, est) => ({
    query: q,
    contextualizada: ctx,
    estado: est,
    esMetodologica: Boolean(est?.esMetodologica),
    debeDetallarSerieVista: Boolean(est?.debeDetallarSerieVista),
  });
  if (!raw || !Array.isArray(history) || !history.length) return armar(raw, null, analizarTurno(raw, null));
  const propio = analizarTurno(raw, null);
  if (propio) {
    const qp = normPal(raw);
    if (propio.tipo === 'release' && propio.releases.length === 1 && SUMA_SEGUIMIENTO.test(qp) && (/^(?:y|pero|tambien|sum\w*|mas)\b/.test(qp) || /\b(?:con|mas)\b/.test(qp))) {
      const prev = estadoHistorial(history);
      if (prev?.tipo === 'release' && prev.releases.length === 1 && prev.releases[0].id !== propio.releases[0].id) {
        const ctxSuma = `${prev.releases[0].consulta} + ${raw}`;
        return armar(ctxSuma, ctxSuma, { tipo: 'release', releases: [prev.releases[0], propio.releases[0]] });
      }
    }
    return armar(raw, null, propio);
  }
  if (!esTurnoSeguimiento(raw)) return armar(raw, null, null);
  const final = analizarTurno(raw, estadoHistorial(history));
  if (!final || final.tipo === 'legacy' || final.tipo === 'cortesia' || final.tipo === 'alcance_proyecto') {
    return armar(raw, null, final);
  }
  if (final.tipo !== 'release') return armar(final.query, final.query, final);
  const r = final.releases[0];
  const geoTxt = final.geos.length
    ? ` en ${final.geos.map((g) => (g.nombre === 'México' ? 'Estado de México' : g.nombre)).join(' y ')}`
    : (final.nacional ? ' en México' : '');
  const sexTxt = final.sexo && final.sexo !== 'general'
    ? ` (${final.sexo === 'ambos' ? 'hombres y mujeres' : final.sexo})`
    : '';
  const ctx = `${r.consulta}${geoTxt}${sexTxt}: ${raw}`;
  return armar(ctx, ctx, final);
}
