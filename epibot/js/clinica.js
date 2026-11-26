/**
 * clinica.js — plan canónico 2.5, escalón 1 (acta de la mesa de expertos del 26-nov-2026,
 * planes/mesa_fichas_clinicas_2026-11-26/ACTA.md).
 *
 * Contagio, prevención, signos de alarma y «cuándo acudir» no los redacta ningún modelo generativo: reciben un texto fijo que
 * remite a la página oficial, con la lista genérica de alarma (no completa), el 911 y la oferta de cifras. Lo usan el cliente
 * (kb.js) y la función de Netlify (netlify/functions/rag.mjs), que corre la misma guarda antes de Gemini, DeepSeek, el
 * planificador y el modo «nlu». Sin dependencias: el navegador y Node lo importan tal cual.
 *
 * Nadie ha validado clínicamente estos textos. Las fichas de cita (escalón 2) y los signos de alarma propios de cada
 * padecimiento (escalón 3, sólo con la firma de un profesional con cédula) son entregas aparte.
 */

/** Lista genérica de signos de alarma: la única del EpiBot. Se presenta siempre como no completa y con el 911. */
export const SIGNOS_ALARMA_GENERALES = 'fiebre muy alta, dificultad para respirar, sangrado, somnolencia o confusión, dolor intenso, vómito persistente o deshidratación';
export const LINEA_ALARMA = `Si hay signos de alarma, como ${SIGNOS_ALARMA_GENERALES} (la lista no es completa), llama al **911** o acude a urgencias.`;

/** Texto en minúsculas, sin tildes ni signos, como lo ven las guardas. */
export function normalizaClinica(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[¿?¡!.,;:()«»"]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Una pregunta de cifras («¿cuántos contagios de dengue hay?») no es clínica: la contestan los datos.
const DATOS = /\b(cuant\w*|casos|pronostic\w*|tendencia|sube|subiendo|baja|bajando|estadistic\w*|incidencia|notificad\w*|brotes?|mapa|grafic\w*|ranking|compar\w*|confiab\w*|campanas?|escuelas)\b/;
const TEMAS = [
  ['alarma', /\b(signos? de (alarma|peligro)|sintomas? de alarma|senales? de (alarma|peligro)|datos de alarma)\b/],
  ['acudir', /\bcuando (debo |debe |debemos |tengo que |hay que |se debe |deberia |conviene )?(ir|acudir|llevar\w*|buscar atencion|ver a un medico)\b.*\b(medico|doctor\w*|hospital|urgencias|clinica|centro de salud|unidad de salud)\b|\bcuando (es|se considera) (una )?urgencia\b|\bcuando acudir\b/],
  ['contagio', /\b(como se (contagia|contagian|transmite|transmiten|propaga|propagan|pega|pegan|adquiere|contrae|agarra)|como (me|te|nos|lo|la|se lo|se la) (contagio|contagie|contagia|contagian|pega|pegan|pegaron)|(es|son) contagios[oa]s?|se contagia|se transmite|se propaga|transmision|vias? de (transmision|contagio)|(me|nos) (puedo|puede|podemos|pueden) (contagiar|pegar)|contagiarme|contagiarse|contagiarnos)\b/],
  ['prevencion', /\b(como (se )?(previene|prevenir|prevengo|prevenimos|evito|evita|evitar|evitamos|me protejo|nos protegemos|protegerme|protegernos)|se puede (prevenir|evitar)|prevenir\w*|prevencion|preventiv\w*|medidas para evitar)\b/],
];

/** Tema clínico de la consulta («contagio», «prevencion», «alarma» o «acudir»), o null. */
export function temaClinico(consulta) {
  const q = normalizaClinica(consulta);
  if (!q || DATOS.test(q)) return null;
  for (const [tema, re] of TEMAS) if (re.test(q)) return tema;
  return null;
}

// Páginas oficiales en español, comprobadas con HTTP 200 y su título el 26-nov-2026. Orden del acta: Secretaría de Salud,
// luego OPS/OMS. Sin página propia comprobada, el enlace es la búsqueda de MedlinePlus en español.
export const ENLACES_OFICIALES = Object.freeze([
  [/\bdengue\b/, 'Dengue, Secretaría de Salud', 'https://www.gob.mx/salud/acciones-y-programas/dengue'],
  [/\btuberculosis\b/, 'Tuberculosis, OPS/OMS', 'https://www.paho.org/es/temas/tuberculosis'],
  [/\bhepatitis (viral |virica )?a\b/, 'Hepatitis A, OMS', 'https://www.who.int/es/news-room/fact-sheets/detail/hepatitis-a'],
  [/\bhepatitis\b/, 'Hepatitis, OPS/OMS', 'https://www.paho.org/es/temas/hepatitis'],
  [/\b(paludismo|malaria)\b/, 'Malaria, OPS/OMS', 'https://www.paho.org/es/temas/malaria'],
  [/\bchikungu?nya\b/, 'Chikungunya, OPS/OMS', 'https://www.paho.org/es/temas/chikungunya'],
  [/\bzika\b/, 'Zika, OPS/OMS', 'https://www.paho.org/es/temas/zika'],
  [/\bsifilis\b/, 'Sífilis, OPS/OMS', 'https://www.paho.org/es/temas/sifilis-sifilis-congenita'],
  [/\brabia\b/, 'Rabia, OPS/OMS', 'https://www.paho.org/es/temas/rabia'],
  [/\bleptospir\w*/, 'Leptospirosis, OPS/OMS', 'https://www.paho.org/es/temas/leptospirosis'],
  [/\bcolera\b/, 'Cólera, OPS/OMS', 'https://www.paho.org/es/temas/colera'],
  [/\b(influenza|gripe|gripa)\b/, 'Influenza y otros virus respiratorios, OPS/OMS', 'https://www.paho.org/es/temas/influenza-sars-cov-2-vsr-otros-virus-respiratorios'],
  [/\b(diarrea\w*|diarreic\w*|gastroenteritis|infecciones intestinales)\b/, 'Enfermedades diarreicas, OMS', 'https://www.who.int/es/news-room/fact-sheets/detail/diarrhoeal-disease'],
  [/\btifoidea\b/, 'Fiebre tifoidea, OMS', 'https://www.who.int/es/news-room/fact-sheets/detail/typhoid'],
  [/\b(escabiosis|sarna)\b/, 'Sarna, OMS', 'https://www.who.int/es/news-room/fact-sheets/detail/scabies'],
]);
export const FUENTES_GENERALES = '[Secretaría de Salud](https://www.gob.mx/salud) o [MedlinePlus en español](https://medlineplus.gov/spanish/)';
// Búsqueda de MedlinePlus en español con el término sin tildes ni signos (la URL no lleva «%», que el saneador de cifras marca).
const medlineplus = (nombre) => `https://vsearch.nlm.nih.gov/vivisimo/cgi-bin/query-meta?v:project=medlineplus-spanish&query=${normalizaClinica(nombre).replace(/[^a-z0-9 ]/g, '').trim().replace(/ +/g, '+')}`;

/** Enlace de la fuente: página oficial comprobada, búsqueda en MedlinePlus con el nombre, o las fuentes generales. */
export function enlaceClinico(consulta, nombre = null, busqueda = nombre) {
  const q = normalizaClinica(`${consulta} ${nombre || ''} ${busqueda || ''}`);
  const hit = ENLACES_OFICIALES.find(([re]) => re.test(q));
  if (hit) return `[${hit[1]}](${hit[2]})`;
  if (nombre) return `[${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} en MedlinePlus en español](${medlineplus(busqueda || nombre)})`;
  return FUENTES_GENERALES;
}

const INICIO = {
  contagio: 'Para saber cómo se contagia',
  prevencion: 'Para saber cómo se previene',
  alarma: 'Para conocer sus signos de alarma',
  acudir: 'Para saber cuándo acudir al médico',
};
const SALUD_MENTAL = /\b(depresi\w*|ansiedad|salud mental|trastornos? (mental\w*|alimentari\w*|de la conducta)|anorexia|bulimia|adicci\w*)\b/;

/**
 * Respuesta fija a una pregunta clínica, o null si la consulta no lo es. `nombre` es el padecimiento detectado por el cliente
 * (como se escribe en una frase) y `busqueda`, el término corto para MedlinePlus; la función de Netlify no los pasa.
 */
export function respuestaClinica(consulta, nombre = null, busqueda = nombre) {
  const tema = temaClinico(consulta);
  if (!tema) return null;
  const q = normalizaClinica(consulta);
  const lineas = [
    `**${INICIO[tema]}, consulta la fuente oficial: ${enlaceClinico(consulta, nombre, busqueda)}.** No doy información clínica (cómo se contagia o se previene, signos de alarma ni cuándo acudir): sólo cifras de casos notificados.`,
    '',
    LINEA_ALARMA,
  ];
  if (SALUD_MENTAL.test(`${q} ${normalizaClinica(nombre)}`)) {
    lineas.push('', 'Para orientación en salud mental, la **Línea de la Vida** atiende gratis, las 24 horas: **800 911 2000**.');
  }
  lineas.push('', nombre
    ? `Si quieres, te digo cómo van los casos de ${nombre} en tu estado.`
    : 'Si quieres, te digo cómo van los casos de un padecimiento en tu estado.');
  return lineas.join('\n');
}
