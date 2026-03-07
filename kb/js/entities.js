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
  'ciudad de mexico': 'Ciudad de Mexico',
  'edomex': 'Mexico',
  'estado de mexico': 'Mexico',
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
  'depresion': 'Depresion',
  'depression': 'Depresion',
  'f32': 'Depresion',
  'parkinson': 'Parkinson',
  'g20': 'Parkinson',
  'alzheimer': 'Alzheimer',
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
  return [...new Set(matches.map(Number))]
    .filter(y => y >= 2010 && y <= 2030)
    .sort((a, b) => a - b);
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
  };

  // Padecimiento
  for (const [alias, canon] of Object.entries(PADECIMIENTO_ALIAS)) {
    if (qn.includes(alias)) {
      result.padecimiento = canon;
      break;
    }
  }

  // Estado (sorted by length desc)
  for (const [alias, canon] of ESTADOS_SORTED) {
    if (qn.includes(alias)) {
      result.estado = canon;
      break;
    }
  }
  if (!result.estado) {
    for (const est of ESTADOS_32) {
      if (qn.includes(est)) {
        result.estado = est.replace(/\b\w/g, c => c.toUpperCase());
        break;
      }
    }
  }
  if (!result.estado && qn.includes('nacional')) {
    result.estado = 'Nacional';
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
