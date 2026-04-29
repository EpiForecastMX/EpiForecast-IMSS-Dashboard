/**
 * entities.js - Deteccion de entidades en preguntas.
 *
 * Port directo de knowledge_base.py: _norm(), _detect_entities(),
 * alias maps para estados, padecimientos, sexo y modelos.
 */

// ---------------------------------------------------------------------------
// Normalizacion
// ---------------------------------------------------------------------------

const ACCENT_MAP = {
  '\u00e1': 'a', '\u00e9': 'e', '\u00ed': 'i', '\u00f3': 'o', '\u00fa': 'u',
  '\u00c1': 'A', '\u00c9': 'E', '\u00cd': 'I', '\u00d3': 'O', '\u00da': 'U',
  '\u00f1': 'n', '\u00d1': 'N',
};

export function norm(text) {
  let t = text.toLowerCase();
  for (const [k, v] of Object.entries(ACCENT_MAP)) {
    t = t.replaceAll(k, v);
  }
  t = t.replace(/[^a-z0-9 ]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Alias maps
// ---------------------------------------------------------------------------

const ESTADOS_ALIAS = {
  'cdmx': 'Ciudad de Mexico',
  'df': 'Ciudad de Mexico',
  'ciudad de mexico': 'Ciudad de Mexico',
  'distrito federal': 'Ciudad de Mexico',
  'edomex': 'Mexico',
  'edo mex': 'Mexico',
  'edo de mex': 'Mexico',
  'edo mexico': 'Mexico',
  'estado de mexico': 'Mexico',
  'edo. mex': 'Mexico',
  'edo.mex': 'Mexico',
  'mexico': 'Mexico',
  'nuevo leon': 'Nuevo Leon',
  'san luis potosi': 'San Luis Potosi',
  'baja california sur': 'Baja California Sur',
  'baja california': 'Baja California',
  'quintana roo': 'Quintana Roo',
  // Regiones
  'region metropolitana alta': 'Region Metropolitana alta',
  'metropolitana alta': 'Region Metropolitana alta',
  'metropolitana': 'Region Metropolitana alta',
  'region rural dispersa': 'Region Rural - dispersa',
  'region rural': 'Region Rural - dispersa',
  'rural dispersa': 'Region Rural - dispersa',
  'region sur sureste vulnerable': 'Region Sur-Sureste vulnerable',
  'region sur sureste': 'Region Sur-Sureste vulnerable',
  'region sur': 'Region Sur-Sureste vulnerable',
  'sur sureste': 'Region Sur-Sureste vulnerable',
  'sureste vulnerable': 'Region Sur-Sureste vulnerable',
  'region urbana media': 'Region Urbana media',
  'urbana media': 'Region Urbana media',
};

// Sorted by key length descending to avoid collisions
const ESTADOS_SORTED = Object.entries(ESTADOS_ALIAS)
  .sort((a, b) => b[0].length - a[0].length);

const ESTADOS_32 = [
  'aguascalientes', 'baja california', 'campeche', 'chiapas', 'chihuahua',
  'coahuila', 'colima', 'durango', 'guanajuato', 'guerrero', 'hidalgo',
  'jalisco', 'michoacan', 'morelos', 'nayarit', 'oaxaca', 'puebla',
  'queretaro', 'sinaloa', 'sonora', 'tabasco', 'tamaulipas', 'tlaxcala',
  'veracruz', 'yucatan', 'zacatecas',
];

const PADECIMIENTO_ALIAS = {
  // Depresión + variantes y typos comunes
  'depresion': 'Depresion',
  'depression': 'Depresion',
  'depre': 'Depresion',
  'deprecion': 'Depresion',
  'depresiva': 'Depresion',
  'depresivo': 'Depresion',
  'trastorno depresivo': 'Depresion',
  'f32': 'Depresion',
  // Parkinson + typos
  'parkinson': 'Parkinson',
  'parkinsons': 'Parkinson',
  'parquinson': 'Parkinson',
  'parkison': 'Parkinson',
  'enfermedad de parkinson': 'Parkinson',
  'g20': 'Parkinson',
  // Alzheimer + typos
  'alzheimer': 'Alzheimer',
  'alzaimer': 'Alzheimer',
  'arzheimer': 'Alzheimer',
  'alzheimers': 'Alzheimer',
  'alzhaimer': 'Alzheimer',
  'enfermedad de alzheimer': 'Alzheimer',
  'demencia': 'Alzheimer',
  'g30': 'Alzheimer',
};

const SEXO_ALIAS = {
  'hombres': 'hombres',
  'hombre': 'hombres',
  'masculino': 'hombres',
  'mujeres': 'mujeres',
  'mujer': 'mujeres',
  'femenino': 'mujeres',
  'general': 'general',
};

const MODELO_ALIAS = {
  'prophet': 'Prophet',
  'deepar': 'DeepAR',
  'deep ar': 'DeepAR',
  'ensemble': 'Ensemble',
  'stacking': 'Stacking',
  'xgboost': 'Ensemble',
  'lightgbm': 'Stacking',
};

// ---------------------------------------------------------------------------
// Extractores
// ---------------------------------------------------------------------------

function extractYears(q) {
  const matches = q.match(/\b(20[0-3]\d)\b/g) || [];
  let years = [...new Set(matches.map(Number))]
    .filter(y => y >= 2010 && y <= 2030)
    .sort((a, b) => a - b);

  // Expandir rangos: "entre 2014 y 2019", "de 2014 a 2019", "del 2014 al 2019"
  if (years.length === 2) {
    const rangeRe = /(?:entre\s+(20[0-3]\d)\s+y\s+(20[0-3]\d)|de[l]?\s+(20[0-3]\d)\s+a[l]?\s+(20[0-3]\d))/;
    const rm = q.match(rangeRe);
    if (rm) {
      const lo = Math.min(Number(rm[1] || rm[3]), Number(rm[2] || rm[4]));
      const hi = Math.max(Number(rm[1] || rm[3]), Number(rm[2] || rm[4]));
      if (hi - lo <= 20) {
        years = [];
        for (let y = lo; y <= hi; y++) years.push(y);
      }
    }
  }

  return years;
}

function extractWeeks(q) {
  const weeks = [];
  const re = /semana\s+(\d{1,2})/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    const w = parseInt(m[1], 10);
    if (w >= 1 && w <= 53) weeks.push(w);
  }
  return [...new Set(weeks)].sort((a, b) => a - b);
}

const MESES = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
  'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
  'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

function extractMonths(q) {
  const months = [];
  for (const [name, num] of Object.entries(MESES)) {
    if (q.includes(name)) months.push(num);
  }
  return [...new Set(months)].sort((a, b) => a - b);
}

/** Detecta "ultimos N anos" o "ultimo N anos". */
function extractLastNYears(q) {
  const m = q.match(/ultimos?\s+(\d{1,2})\s+a[n~]os?/);
  if (m) return parseInt(m[1], 10);
  // "de los 10 anos"
  const m2 = q.match(/(?:de los|los)\s+(\d{1,2})\s+a[n~]os?\s+(?:reciente|anterior|pasado|ultimo)/);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

/** Detecta filtros de edad: "entre X y Y anos", "mujeres de 30 anos", "mayores de X". */
function extractAgeFilter(q) {
  // "entre 40 y 45 anos", "de 40 a 45 anos"
  let m = q.match(/(?:entre|de)\s+(\d{1,3})\s+(?:y|a)\s+(\d{1,3})\s+a[n~]os?/);
  if (m) {
    const lo = parseInt(m[1], 10), hi = parseInt(m[2], 10);
    if (lo >= 0 && lo <= 120 && hi >= 0 && hi <= 120) return `${lo}-${hi}`;
  }
  // "mayores de 60 anos", "menores de 18"
  m = q.match(/(mayores?|menores?)\s+de\s+(\d{1,3})\s*a[n~]os?/);
  if (m) return `${m[1]} de ${m[2]}`;
  // "mujeres de 30 anos", "hombres de 50 anos", "personas de 40 anos"
  m = q.match(/(?:hombres?|mujeres?|personas?|adultos?|ninos?|jovenes?|pacientes?)\s+de\s+(\d{1,3})\s+a[n~]os?/);
  if (m) { const age = parseInt(m[1], 10); if (age >= 1 && age <= 120) return String(age); }
  // "de X anos de edad"
  m = q.match(/de\s+(\d{1,3})\s+a[n~]os?\s+de\s+edad/);
  if (m) return m[1];
  return null;
}

// ---------------------------------------------------------------------------
// Deteccion principal
// ---------------------------------------------------------------------------

export function detectEntities(query) {
  const qn = norm(query);
  const result = {
    padecimiento: null,
    estado: null,
    sexo: null,
    modelo: null,
    _years: extractYears(qn),
    _weeks: extractWeeks(qn),
    _months: extractMonths(qn),
    _lastNYears: extractLastNYears(qn),
    _ageFilter: extractAgeFilter(qn),
  };

  // Padecimiento
  for (const [alias, canon] of Object.entries(PADECIMIENTO_ALIAS)) {
    if (qn.includes(alias)) {
      result.padecimiento = canon;
      break;
    }
  }

  // Estado (sorted by length desc) — detectar TODOS los estados mencionados
  const allEstados = [];
  let qnTemp = qn;
  for (const [alias, canon] of ESTADOS_SORTED) {
    if (qnTemp.includes(alias)) {
      if (!allEstados.includes(canon)) allEstados.push(canon);
      qnTemp = qnTemp.replace(alias, '___');
    }
  }
  for (const est of ESTADOS_32) {
    if (qnTemp.includes(est)) {
      const cap = est.replace(/\b\w/g, c => c.toUpperCase());
      if (!allEstados.includes(cap)) allEstados.push(cap);
      qnTemp = qnTemp.replace(est, '___');
    }
  }
  if (!allEstados.length && qn.includes('nacional')) {
    allEstados.push('Nacional');
  }
  result.estado = allEstados.length ? allEstados[0] : null;
  if (allEstados.length > 1) result._estados = allEstados;

  // Detectar lugar no reconocido: "en [lugar]" que no matcheó ningún estado
  if (!result.estado) {
    // Patron 1: "en [lugar]" directo
    const enMatch = qn.match(/\ben\s+([a-z][a-z ]{2,20}?)(?:\s+en|\s+el|\s+la|\s+del|\s+de|\s+los|\s+las|\s*$|\s*\?)/);
    // Patron 2: "en el estado de [lugar]" / "en la ciudad de [lugar]"
    const enDeMatch = qn.match(/\ben\s+(?:el\s+estado|la\s+ciudad|la\s+region)\s+de\s+([a-z][a-z ]{2,20}?)(?:\s|,|$)/);
    const matched = enDeMatch || enMatch;
    if (matched) {
      const lugar = matched[1].trim();
      // Excluir palabras comunes y padecimientos que no son lugares
      const noLugar = ['el', 'la', 'los', 'las', 'un', 'una', 'que', 'general', 'total',
        'produccion', 'promedio', 'detalle', 'mexico', 'cuenta', 'salud',
        'depresion', 'parkinson', 'alzheimer', 'este ano', 'el ano',
        'hombres', 'mujeres', 'masculino', 'femenino',
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const alsoNoLugar = ['personas', 'mayores', 'menores', 'adultos', 'jovenes',
        'pacientes', 'ninos', 'ancianos', 'edad', 'anos', 'semanas'];
      // Excluir si empieza con pronombre posesivo o palabra no-lugar
      const lugarStart = lugar.split(' ')[0];
      const noStart = ['tu', 'mi', 'su', 'sus', 'mis', 'tus', 'nuestro', 'nuestra',
        'este', 'esta', 'ese', 'esa', 'aquel', 'donde', 'como', 'cual', 'todo'];
      if (!noLugar.includes(lugar) && !alsoNoLugar.includes(lugar) &&
          !noLugar.includes(lugarStart) && !noStart.includes(lugarStart) && lugar.length > 2) {
        result._lugarDesconocido = lugar;
      }
    }

    // Lugares comunes no mexicanos que se confunden (sin "baja" = no es Baja California)
    const confusionPlaces = ['california', 'texas', 'florida', 'nueva york', 'los angeles',
      'colombia', 'argentina', 'peru', 'chile', 'espana', 'pakistan', 'india', 'china',
      'brasil', 'canada', 'estados unidos', 'eeuu'];
    for (const place of confusionPlaces) {
      if (!result._lugarDesconocido && new RegExp(`\\b${place}\\b`).test(qn)) {
        // "california" solo si no es "baja california"
        if (place === 'california' && qn.includes('baja california')) continue;
        result._lugarDesconocido = place;
      }
    }
  }

  // Sexo
  for (const [alias, canon] of Object.entries(SEXO_ALIAS)) {
    if (qn.includes(alias)) {
      result.sexo = canon;
      break;
    }
  }

  // Modelo
  for (const [alias, canon] of Object.entries(MODELO_ALIAS)) {
    if (qn.includes(alias)) {
      result.modelo = canon;
      break;
    }
  }

  return result;
}
