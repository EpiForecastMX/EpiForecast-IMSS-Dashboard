/**
 * cierres.js — plan canónico 3.4 (26-nov-2026): tres cierres por perfil sobre los mismos hechos de la última respuesta de datos.
 *
 *   «en corto»    tres líneas: lo que se espera, la confiabilidad y hasta qué semana llegan los datos.
 *   «para nota»   un párrafo citable con fecha y fuente, y lo que la cifra no dice (para prensa).
 *   «para junta»  qué mirar, qué tan firme es y qué no decidir con esto (para directivos).
 *
 * Regla: ninguna cifra nueva. Todo número del cierre sale del texto de la respuesta de origen (una prueba lo comprueba), el
 * motor no se menciona y la nota queda como copia en el chat: no se publica en ninguna parte (decisión 7 del plan, tomada el
 * 26-nov-2026 por delegación del autor: copia para el usuario; publicarla exigiría guardar preguntas, que el sitio no hace). Sin dependencias: sólo transforma el markdown.
 */

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PATRONES = [
  ['nota', /\b(para (una |la |un )?(nota|prensa|periodico|reportaje|articulo|boletin de prensa|comunicado)|como nota|redactalo como nota|en formato de nota)\b/],
  ['junta', /\b(para (una |la |mi |el )?(junta|reunion|jefe|jefa|director|directora|directivos?|presentar|presentacion|comite)|en formato de junta)\b/],
  ['corto', /^(dame |dilo |dimelo |ponlo |hazlo |explicalo |y )?(lo )?(en corto|mas corto|mas breve|resumido|resumelo|en pocas palabras|en una linea|en tres lineas)$|\b(en corto|en pocas palabras|resumido|mas corto)\b/],
];

/** Tipo de cierre que pide la consulta («corto», «nota» o «junta»), o null. */
export function tipoCierre(consulta) {
  const q = sinTildes(consulta).replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [tipo, re] of PATRONES) if (re.test(q)) return tipo;
  return null;
}

/** La consulta sin la petición de cierre («dengue en Veracruz para nota» → «dengue en Veracruz»). */
export function quitaCierre(consulta) {
  return String(consulta ?? '')
    .replace(/\b(dame|dilo|dímelo|dimelo|ponlo|hazlo|redáctalo|redactalo|explícalo|explicalo)\b/gi, ' ')
    .replace(/\b(lo )?(en corto|más corto|mas corto|más breve|mas breve|resumido|resúmelo|resumelo|en pocas palabras|en una línea|en una linea|en tres líneas|en tres lineas)\b/gi, ' ')
    .replace(/\b(para|como|en formato de) (una |la |un |mi |el )?(nota|prensa|periódico|periodico|reportaje|artículo|articulo|boletín de prensa|comunicado|junta|reunión|reunion|jefe|jefa|director|directora|directivos?|presentar|presentación|comité|comite)\b/gi, ' ')
    .replace(/[¿?¡!,;:.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Una respuesta de datos que admite cierre: trae su veredicto «**X en Y:**» y su línea de confiabilidad. */
export function esFichaDeDatos(md) {
  const t = String(md ?? '').split('<!--DETALLE-->')[0];
  return /\*\*Confiabilidad[^*]*\*\*/.test(t) && /^\*\*[^*\n]+:\*\*/m.test(t);
}

const limpia = (t) => String(t ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:])/g, '$1$2').trim();
const primeraOracion = (t) => (String(t).match(/^.*?[.!?](?=\s|$)/) || [String(t)])[0];

/** Hechos de una respuesta de datos, todos tomados de su texto. */
export function hechos(md) {
  const [llana, detalle = ''] = String(md ?? '').replace(/<!--(?!DETALLE)[\s\S]*?-->/g, '').split('<!--DETALLE-->');
  const lineas = llana.split('\n');
  const iTit = lineas.findIndex((l) => /^\*\*[^*\n]+:\*\*/.test(l));
  const titulo = iTit >= 0 ? lineas[iTit] : '';
  const sujeto = (titulo.match(/^\*\*([^*\n]+):\*\*/) || [])[1] || '';
  const veredicto = limpia(titulo.replace(/^\*\*[^*\n]+:\*\*\s*/, ''));
  const vinetas = Object.fromEntries(lineas.map((l) => l.match(/^- \*\*([^*:]+):\*\*\s*(.+)$/)).filter(Boolean).map((m) => [m[1], limpia(m[2])]));
  const lConf = lineas.find((l) => /^\*\*Confiabilidad/.test(l)) || '';
  const nivel = (lConf.match(/^\*\*Confiabilidad:?\s*([^.*]+)\.?\*\*/) || [])[1]?.trim() || '';
  const motivo = limpia(lConf.replace(/^\*\*Confiabilidad[^*]*\*\*\s*/, ''));
  const todo = `${llana}\n${detalle}`;
  const fecha = (vinetas['Datos hasta'] && vinetas['Datos hasta'].replace(/\.$/, ''))
    || (todo.match(/observadas? hasta la (semana \d+ \([^)]+\))/) || [])[1]
    || (todo.match(/datos hasta la (semana \d+ \([^)]+\))/i) || [])[1] || '';
  const control = /no es un modelo validado|control estacional/i.test(`${motivo} ${todo}`);
  const sinIntervalo = /sin intervalo/i.test(todo);
  return { sujeto, veredicto, vinetas, nivel, motivo, fecha: fecha.replace(/^la /, ''), control, sinIntervalo };
}

const NO_DICE = (h) => [
  'son casos notificados al sistema de vigilancia, no todas las personas enfermas',
  'no es una cifra oficial ni una alerta',
  h.control ? 'es el control estacional (repite el año anterior), no un modelo validado' : '',
  h.sinIntervalo ? 'es un pronóstico puntual, sin intervalo de incertidumbre' : '',
  'no es consejo médico',
].filter(Boolean);
const listaConY = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join('; ')} y ${xs.at(-1)}` : xs[0] || '');
const capital = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** El cierre pedido sobre la respuesta de datos `md`, o null si no es una respuesta de datos. */
export function cierreDe(md, tipo) {
  if (!esFichaDeDatos(md)) return null;
  const h = hechos(md);
  const semana = h.fecha ? `la ${h.fecha}` : '';
  const pie = '\n<!--SIN_GRAFICA-->\n<!--SIGUE:' + JSON.stringify([
    tipo !== 'corto' && { t: 'En corto', q: 'en corto' }, tipo !== 'nota' && { t: 'Para nota', q: 'para nota' },
    tipo !== 'junta' && { t: 'Para junta', q: 'para junta' }].filter(Boolean)) + '-->';
  if (tipo === 'corto') {
    return [`**${h.sujeto}:** ${primeraOracion(h.veredicto)}`, '',
      `Confiabilidad ${h.nivel}. ${primeraOracion(h.motivo)}`.trim(), '',
      `${semana ? `Datos hasta ${semana}; ` : ''}casos notificados al boletín.`].join('\n') + pie;
  }
  if (tipo === 'nota') {
    return ['**Para nota** (texto para citar; revisa la fecha antes de publicar):', '',
      `> ${h.sujeto}: ${h.veredicto} Así lo estima EpiForecast-MX, un proyecto académico, con los casos notificados al Boletín ` +
      `Epidemiológico de la Secretaría de Salud${semana ? ` hasta ${semana}` : ''}. Confiabilidad ${h.nivel}. ${h.motivo}`, '',
      `**Qué no dice:** ${listaConY(NO_DICE(h))}.`, '',
      '**Fuente:** EpiForecast-MX (https://epiforecast.mx), con datos del Boletín Epidemiológico de la Secretaría de Salud.'].join('\n') + pie;
  }
  const mirar = ['Frente a 2025', 'Ahora', 'Dónde se esperan más', 'Lugar en el país', 'En lo que va de 2026']
    .filter((k) => h.vinetas[k]).slice(0, 2).map((k) => `  - ${k}: ${h.vinetas[k]}`);
  return [`**Para junta: ${h.sujeto}**`, '',
    `- **Qué mirar:** ${h.veredicto}`, ...mirar,
    `- **Qué tan firme es:** confiabilidad ${h.nivel}. ${h.motivo}`,
    `- **Qué no decidir con esto:** ${capital(listaConY(NO_DICE(h).slice(0, -1)))}. Contrástalo con la información de tu ` +
      'jurisdicción antes de asignar recursos o cambiar servicios.',
    ...(semana ? ['', `_Datos hasta ${semana}._`] : [])].join('\n') + pie;
}

export const SIN_BASE_CIERRE = 'Para darte el resumen necesito primero la consulta: dime el padecimiento y el lugar, por ejemplo ' +
  '«dengue en Veracruz para nota» o «diabetes en Nuevo León para junta».\n<!--SIN_GRAFICA-->';
