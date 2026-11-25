/**
 * cifras_verificadas.mjs — ninguna cifra generada llega a la persona sin respaldo (mesa agéntica, 25-nov-2026).
 *
 * Hallazgo de la mesa (seguridad): la ruta generativa de la función RAG transmitía el texto del modelo conforme llegaba,
 * antes de comprobar sus cifras. Ahora la respuesta se genera completa, se extraen sus números y cada uno debe aparecer en
 * el contexto que se le dio al modelo (hechos de las vistas, pasajes citados, resumen estructurado) o en la pregunta. Una
 * oración con una cifra sin respaldo se retira; si no queda nada, la función lo dice en lugar de inventar.
 *
 * Se permiten sin respaldo: enteros del 0 al 12 («4 semanas», «3 estados»), años de 1990 a 2035, números pegados a letras
 * (códigos CIE como J45.0, semanas como W43) y los números de cita entre corchetes.
 */

const NUM = /(?<![\p{L}\d.,])\d{1,3}(?:[,  ]\d{3})+(?:\.\d+)?(?![\p{L}\d])|(?<![\p{L}\d.,])\d+(?:[.,]\d+)?(?![\p{L}\d])/gu;

/** Forma canónica de un número escrito: sin separador de miles y con punto decimal. */
export function canonico(s) {
  const t = String(s).trim();
  if (/^\d{1,3}(?:[,  ]\d{3})+(?:\.\d+)?$/.test(t)) return String(Number(t.replace(/[,  ]/g, '')));
  return String(Number(t.replace(',', '.')));
}

/** Números de un texto (sin citas [n], enlaces ni códigos pegados a letras). */
export function numerosDe(texto) {
  const limpio = String(texto || '')
    .replace(/\]\([^)]*\)/g, ']')           // destinos de enlaces markdown
    .replace(/\[\d+(?:\s*,\s*\d+)*\]/g, ' ') // citas [1], [2, 3]
    .replace(/<!--[\s\S]*?-->/g, ' ');
  return [...limpio.matchAll(NUM)].map((m) => m[0]);
}

/** Conjunto de respaldo: cada número del contexto con sus redondeos habituales. */
export function respaldo(...fuentes) {
  const set = new Set();
  for (const f of fuentes) {
    for (const n of numerosDe(f)) {
      const v = Number(canonico(n));
      if (!Number.isFinite(v)) continue;
      set.add(String(v));
      set.add(String(Math.round(v)));
      set.add(String(Math.round(v * 10) / 10));
    }
  }
  return set;
}

function permitido(n, set) {
  const v = Number(canonico(n));
  if (!Number.isFinite(v)) return true;
  if (Number.isInteger(v) && v >= 0 && v <= 12) return true;
  if (Number.isInteger(v) && v >= 1990 && v <= 2035 && !/[,  .]/.test(n)) return true;
  return set.has(String(v));
}

/** Cifras del texto generado que no aparecen en las fuentes. */
export function cifrasSinRespaldo(generado, ...fuentes) {
  const set = respaldo(...fuentes);
  return numerosDe(generado).filter((n) => !permitido(n, set));
}

/**
 * Retira las oraciones con cifras sin respaldo. Devuelve el texto depurado (o null si no queda contenido) y las cifras
 * retiradas, para registrar sólo su conteo.
 */
export function depuraCifras(generado, ...fuentes) {
  const set = respaldo(...fuentes);
  const retiradas = [];
  const lineas = String(generado || '').split('\n').map((linea) => {
    const partes = linea.split(/(?<=[.!?])\s+/);
    const quedan = partes.filter((p) => {
      const malas = numerosDe(p).filter((n) => !permitido(n, set));
      retiradas.push(...malas);
      return malas.length === 0;
    });
    // Una viñeta o encabezado que pierde su contenido se va entero.
    return quedan.length ? quedan.join(' ') : (partes.some((p) => p.trim()) ? null : linea);
  }).filter((l) => l !== null);
  const texto = lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const contenido = texto.replace(/[#*_>\-\s]/g, '');
  return { texto: contenido ? texto : null, retiradas };
}

export const NOTA_RETIRADA = '\n\n_Omití una cifra que no pude verificar con los datos publicados._';
export const SIN_CIFRAS_VERIFICABLES = 'No encontré datos publicados que respalden una respuesta con cifras a esa pregunta. ' +
  'Pregúntame por un padecimiento y un lugar (por ejemplo, «¿cómo va la varicela en Jalisco?») y te respondo con los datos de la plataforma.';
