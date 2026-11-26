/**
 * Corrector ortográfico único del EpiBot (plan canónico 3.2, 26-nov-2026).
 *
 * Antes había dos correctores con reglas distintas: `corrigeErratas` (conversacion.js, sólo nombres publicados, misma letra
 * inicial y una edición) y `fuzzyCorrect` (kb.js, Levenshtein ≤ 2 contra un vocabulario de rutas, sin mirar la primera
 * letra), que convertía «cólera» en «Colima». Los dos usan ahora esta función; cada uno conserva su vocabulario de destino.
 *
 * Reglas, en este orden, por palabra (texto ya normalizado: minúsculas, sin acentos):
 * 1. Nunca se toca una palabra con dígitos.
 * 2. Erratas curadas (tabla fija): las que las reglas generales no alcanzan sin riesgo y las variantes ortográficas que el
 *    vocabulario de consulta admite.
 * 3. Nunca se toca una palabra conocida (vocabulario cerrado del boletín, estados, palabras de consulta) ni una palabra común
 *    de `NUNCA_CORREGIR`.
 * 4. Menos de cuatro letras: no se corrige.
 * 5. Clave fonética del español de México (b/v, s/z/c, h muda, ll/y, qu/k, gue/ge): si la palabra suena igual que un único
 *    destino, se corrige («baricela» → «varicela», «ipertension» → «hipertension», «gastritiz» → «gastritis»).
 * 6. Si no, a una edición de clave (palabra de seis letras o más, destino de siete o más) o a dos (ambas de nueve o más), con
 *    la misma primera letra (o una que suena igual, o sin la h inicial del destino) y un destino único a la distancia mínima
 *    («alzaimer» → «alzheimer», «tlaxcla» → «tlaxcala»). Una diferencia sólo en la terminación es otra palabra o una flexión
 *    («candidiasica» no es «candidiasis», «correo» no es «corea», «reporta» no es «reporte»): no se corrige, y una flexión de
 *    un destino no se lleva a otro destino más lejano («varicelas» no es «varicella»).
 * Ante un empate entre destinos distintos no se corrige. Los umbrales salen del barrido de las 2,344 preguntas de las
 * baterías: con menos letras, las palabras comunes quedan a una edición de algún nombre del boletín («letra»/«lepra»,
 * «feria»/«ferina», «huevos»/«huesos», «hacen»/«hansen»).
 */

/** Distancia de edición con transposiciones (OSA), cortada en 3. */
export function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return Math.min(3, d[a.length][b.length]);
}

/** Clave fonética: dos palabras que en México se pronuncian igual tienen la misma clave. */
export function claveFonetica(w) {
  return String(w)
    .replace(/ch/g, '1')
    .replace(/qu(?=[ei])/g, 'k')
    .replace(/gu(?=[ei])/g, '2')
    .replace(/g(?=[ei])/g, 'j')
    .replace(/2/g, 'g')
    .replace(/c(?=[ei])/g, 's')
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/v/g, 'b')
    .replace(/ll/g, 'y')
    .replace(/h/g, '')
    .replace(/w/g, 'u')
    .replace(/y$/, 'i')
    .replace(/(.)\1+/g, '$1');
}

/** Erratas frecuentes que las reglas generales no alcanzan (palabras cortas o destinos fuera del vocabulario en español). */
export const ERRATAS_CURADAS = Object.freeze({
  sika: 'zika',
  sica: 'zika',
  chicungunya: 'chikungunya',
  chicungunia: 'chikungunya',
  chikungunia: 'chikungunya',
  chicunguna: 'chikungunya',
  chikungunyia: 'chikungunya',
  diabetis: 'diabetes',
  diavetis: 'diabetes',
  diabetiz: 'diabetes',
  diavetiz: 'diabetes',
  // Variantes ortográficas que js/vocab_consulta.js admite como palabras de consulta (por eso cuentan como conocidas) y que
  // los casos funcionales piden corregidas.
  alzeimer: 'alzheimer',
  alzheimr: 'alzheimer',
  chiuahua: 'chihuahua',
  depresoin: 'depresion',
  depreson: 'depresion',
  parkinsn: 'parkinson',
  parkison: 'parkinson',
  puebal: 'puebla',
  veracurz: 'veracruz',
  jalsico: 'jalisco',
  obesdiad: 'obesidad',
  pronositco: 'pronostico',
  tendncia: 'tendencia',
  glovales: 'globales',
  rankin: 'ranking',
});

/**
 * Palabras comunes del español que quedan a una edición de un destino y nunca se corrigen («pueblo» no es «Puebla», «tabaco»
 * no es «Tabasco», «modelos» no es «Morelos», «médico» no es «México»).
 */
export const NUNCA_CORREGIR = new Set(['pueblo', 'pueblos', 'tabaco', 'modelo', 'modelos', 'medico', 'medicos', 'medica', 'medicas',
  'colina', 'colinas', 'sonar', 'sonaras', 'sonoro', 'durante', 'guerreros', 'campesino', 'leones', 'nayar',
  'oaxaqueno', 'jalisciense', 'poblano', 'poblanos', 'regios', 'chilango', 'chilangos', 'jarocho', 'yucateco', 'mexicano', 'mexicana',
  'mexicanos', 'mexicanas', 'baja', 'bajas', 'bajo', 'bajan', 'nuevo', 'nueva', 'estado', 'estados', 'ciudad', 'gente', 'esperas',
  'espera', 'esperan', 'presion', 'tension', 'hipotension', 'prueba', 'pruebas', 'depresivo', 'depresiva', 'deprimido', 'deprimida',
  'genial', 'acceso', 'accesos', 'efectivo', 'efectiva', 'efectivos', 'efectivas', 'recorte', 'recortes', 'entiendes', 'huevos',
  'infeccioso', 'infecciosa', 'infecciosos', 'infecciosas', 'enfermera', 'enfermeras', 'enfermero', 'enfermeros']);

/**
 * Corrige un texto normalizado palabra por palabra.
 * @param {string} texto
 * @param {{ objetivos: Iterable<string>, conocida?: (w: string) => boolean, curadas?: boolean, soloFonetica?: boolean }} opciones
 *   `soloFonetica`: sin la regla 6 (el último recurso de kb.js, cuyo vocabulario de rutas es de palabras comunes).
 * @returns {{ texto: string, cambios: string[] }}
 */
export function corrigeTexto(texto, { objetivos, conocida = () => false, curadas = true, soloFonetica = false }) {
  const lista = [...objetivos];
  const claves = new Map(lista.map((o) => [o, claveFonetica(o)]));
  const cambios = [];
  const salida = String(texto).split(' ').map((tok) => {
    // La puntuación pegada («influenza?», «¿dengue») no forma parte de la palabra.
    const m = tok.match(/^([^a-z0-9ñ]*)([a-z0-9ñ]+)([^a-z0-9ñ]*)$/);
    if (!m) return tok;
    const nueva = corrigePalabra(m[2], lista, claves, conocida, curadas, soloFonetica);
    if (nueva === m[2]) return tok;
    cambios.push(nueva);
    return `${m[1]}${nueva}${m[3]}`;
  }).join(' ');
  return { texto: salida, cambios };
}

function corrigePalabra(w, lista, claves, conocida, curadas, soloFonetica) {
  if (!w || /\d/.test(w)) return w;
  // Las erratas curadas van antes que el vocabulario: algunas figuran en él como variantes admitidas.
  if (curadas && Object.hasOwn(ERRATAS_CURADAS, w)) return ERRATAS_CURADAS[w];
  if (NUNCA_CORREGIR.has(w) || conocida(w)) return w;
  if (w.length < 4) return w;
  const k = claveFonetica(w);
  // Regla 5: suena igual que un único destino.
  const iguales = new Set(lista.filter((o) => o !== w && claves.get(o) === k));
  if (iguales.size === 1) return [...iguales][0];
  if (iguales.size > 1) return w;
  // Regla 6: una o dos ediciones de clave.
  if (soloFonetica || w.length < 6) return w;
  // Una flexión de un destino («varicelas», «infecciosos») no se lleva a otro destino más lejano («varicella»).
  if (lista.some((o) => { const ko = claves.get(o); return ko && soloTerminacion(k, ko) && distancia(k, ko) <= 2; })) return w;
  let mejor = null;
  let dMin = 3;
  let empate = false;
  for (const o of lista) {
    const ko = claves.get(o);
    if (!ko || o.length < 7 || ko[0] !== k[0] || !mismaInicial(w, o)) continue;
    const tope = w.length >= 9 && o.length >= 9 ? 2 : 1;
    const dd = distancia(k, ko);
    if (dd > tope || soloTerminacion(k, ko)) continue;
    if (dd < dMin) { mejor = o; dMin = dd; empate = false; } else if (dd === dMin && o !== mejor) empate = true;
  }
  return mejor && !empate ? mejor : w;
}

/** La errata conserva la primera letra, o la cambia por otra que suena igual (b/v, s/z/c) o se come la h inicial. */
function mismaInicial(w, o) {
  if (w[0] === o[0]) return true;
  const par = (x, y) => [x, y].every((c) => 'bv'.includes(c)) || [x, y].every((c) => 'szc'.includes(c));
  return par(w[0], o[0]) || (o[0] === 'h' && w[0] === o[1]);
}

/** Las dos claves sólo difieren en sus dos últimas letras (contadas sobre la más larga: «tlaxcla» no es una terminación). */
function soloTerminacion(a, b) {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  return pre >= Math.max(a.length, b.length) - 2;
}
