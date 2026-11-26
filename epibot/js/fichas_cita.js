/**
 * fichas_cita.js — plan canónico 2.5, escalón 2: fichas de cita (acta de la mesa de fichas clínicas del 26-nov-2026,
 * planes/mesa_fichas_clinicas_2026-11-26/ACTA.md). Piloto de diez fichas con fuente mexicana.
 *
 * Reglas del acta que cumple cada ficha:
 * - Sólo transmisión y prevención poblacional; nunca signos de alarma ni «cuándo acudir» (escalón 3, firma humana).
 * - Pasaje textual íntegro de una sola página, entre comillas, con su encabezado y su población; sin recortar ni unir frases;
 *   listas completas o ninguna; sin fármacos, dosis, plazos, vacunación ni frases tranquilizadoras.
 * - Cada oración es subcadena de la copia archivada (fichas/archivo/<fuente>.txt, con URL, fecha de consulta y sha256).
 * - Auditoría de fidelidad a ciegas por tres asientos de proveedores distintos, con unanimidad; sin ella la ficha no se muestra.
 *   Piloto auditado el 26-nov-2026 por Codex (gpt-6.2-sol), Gemini (Neon) y DeepSeek (v4-pro): ocho fichas con unanimidad;
 *   hepatitis_ae_contagio y escabiosis_prevencion quedan rechazadas por un voto (Codex) y no se muestran
 *   (planes/mesa_fichas_clinicas_2026-11-26/auditoria_piloto/).
 * - Caduca a los 12 meses o en cuanto cambie la fuente (`npm run fichas:verifica`); `activa: false` la retira.
 *
 * Licencia: gob.mx, «Términos y condiciones», apartado «Propiedad intelectual»: la información del portal es pública salvo
 * indicación contraria, y quien la reproduzca debe referir la localización electrónica y la fecha de consulta. OMS y OPS
 * quedan fuera del piloto: la OMS sólo autoriza extractos de su sitio para investigación o estudio privado, y la OPS no publica
 * una licencia del contenido de su sitio (comprobado el 26-nov-2026).
 *
 * Sin dependencias: lo importan el navegador (clinica.js), la función de Netlify y los scripts de Node.
 */

const LICENCIA_GOBMX = 'gob.mx, «Términos y condiciones», apartado «Propiedad intelectual»: información pública reproducible ' +
  'refiriendo la localización electrónica y la fecha de consulta.';

/** Fuentes: una página por ficha; el texto archivado y su sha256 están en fichas/archivo/. */
export const FUENTES_CITA = Object.freeze({
  ssa_dengue: { url: 'https://www.gob.mx/salud/acciones-y-programas/dengue', institucion: 'la Secretaría de Salud',
    titulo: 'Información General sobre el Dengue', publicada: '3 de marzo de 2016', consultada: '2026-11-26', licencia: LICENCIA_GOBMX,
    sha256: 'f54f074f7a8fe4f4ff5a92bd3242db33625b5aede99b8065204ae1a2267346e4' },
  ssa_tuberculosis: { url: 'https://www.gob.mx/salud/acciones-y-programas/tuberculosis', institucion: 'la Secretaría de Salud',
    titulo: 'Tuberculosis', publicada: '7 de marzo de 2016', consultada: '2026-11-26', licencia: LICENCIA_GOBMX, sha256: '05e7ab635ce6e2c52d222918dc19ca1ab50bd096cebd24218f44b8586fc3a76d' },
  censida_hepatitis_ae: { url: 'https://www.gob.mx/censida/es/articulos/reduce-el-riesgo-de-contraer-hepatitis-a-y-e',
    institucion: 'el Centro Nacional para la Prevención y Control del VIH/Sida y Hepatitis (Censida) de la Secretaría de Salud',
    titulo: 'Conoce acerca de este tipo de hepatitis y qué puedes hacer para prevenirlas.', publicada: '21 de agosto de 2020',
    consultada: '2026-11-26', licencia: LICENCIA_GOBMX, sha256: '84985fa6261487f81300408d3a1763a8b0fa0231d4c427fc82bd0bf1243ca5bb' },
  ssa_piel_manos: { url: 'https://www.gob.mx/salud/prensa/460-lavarse-las-manos-previene-enfermedades-de-la-piel',
    institucion: 'la Secretaría de Salud', titulo: '460. Lavarse las manos previene enfermedades de la piel',
    publicada: '18 de noviembre de 2017', consultada: '2026-11-26', licencia: LICENCIA_GOBMX, sha256: '467a150dddcb0e5579d18733d1269dc74c2620b482b0365b582ec1f33f00c6a1' },
  ssa_diarreicas: { url: 'https://www.gob.mx/salud/articulos/como-prevenir-enfermedades-diarreicas-y-deshidratacion',
    institucion: 'la Secretaría de Salud', titulo: 'Cómo prevenir enfermedades diarreicas y deshidratación',
    publicada: '24 de julio de 2015', consultada: '2026-11-26', licencia: LICENCIA_GOBMX, sha256: '74ec87ff788a0dc7c1d7a7df507a2d108065da28d26af63d03bdb4fc4a53c00b' },
  ssa_respiratorias: { url: 'https://www.gob.mx/salud/articulos/infecciones-respiratorias-e-influenza-14016',
    institucion: 'la Secretaría de Salud', titulo: 'Infecciones respiratorias e influenza', publicada: '24 de octubre de 2015',
    consultada: '2026-11-26', licencia: LICENCIA_GOBMX, sha256: '394b34fd7eae1de3dc70ca48c7f80dbe0a614571618519512985b2e5caaa5f20' },
});

// Patrones sobre el texto normalizado (minúsculas, sin tildes) de la consulta más el nombre del padecimiento detectado.
const DENGUE = /\bdengue\b/;
const TB = /\btuberculosis\b/;
const HEPATITIS_AE = /\bhepatitis (viral |virica )?(a|e)\b/;
const ESCABIOSIS = /\b(escabiosis|sarna)\b/;
const DIARREAS = /\b(diarrea\w*|diarreic\w*|gastroenteritis|infecciones intestinales)\b/;
const RESPIRATORIAS = /\b(infecciones? respiratorias?|enfermedades respiratorias)\b/;

/**
 * Fichas. `pasaje`: párrafos o elementos de lista, textuales; `encabezado`: el título de sección de la página que los precede
 * (null si el pasaje no tiene uno); `auditoria`: resultado de la auditoría ciega (sin «unanime», la ficha no se muestra).
 */
export const FICHAS_CITA = Object.freeze([
  { id: 'dengue_contagio', tema: 'contagio', patron: DENGUE, fuente: 'ssa_dengue', encabezado: '¿Cómo se transmite el dengue?',
    poblacion: 'población general', lista: false,
    pasaje: ['El dengue, al igual que la fiebre chikungunya y zika, se transmite a través de la picadura de los mosquitos hembras pertenecientes a las especies Aedes, particularmente A. aegypti y A. albopictus infectados.'],
    caduca: '2027-11-26', activa: true, auditoria: 'unanime' },
  { id: 'dengue_prevencion', tema: 'prevencion', patron: DENGUE, fuente: 'ssa_dengue', encabezado: '¿Es posible prevenir el dengue?',
    poblacion: 'población general', lista: false,
    pasaje: ['Es posible prevenir el dengue, evitando la reproducción del vector y la exposición a éste.'],
    caduca: '2027-11-26', activa: true, auditoria: 'unanime' },
  { id: 'tuberculosis_contagio', tema: 'contagio', patron: TB, fuente: 'ssa_tuberculosis', encabezado: '¿Cómo se transmite la TB?',
    poblacion: 'población general', lista: false,
    pasaje: ['La transmisión de la tuberculosis pulmonar (TBP) es por vía aérea cuando un enfermo expulsa micro gotas de saliva con bacilos de la tuberculosis (aerosoles) al toser, hablar, cantar o estornudar cerca de otras personas sanas. Una medida para reducir el riesgo de contagio es que las personas se cubran la boca y la nariz al toser o estornudar.'],
    caduca: '2027-11-26', activa: true, auditoria: 'unanime' },
  { id: 'tuberculosis_prevencion', tema: 'prevencion', patron: TB, fuente: 'ssa_tuberculosis', encabezado: '¿Es posible prevenir la TB?',
    poblacion: 'población general', lista: false,
    pasaje: ['Es importante que se fomente la ventilación en los lugares donde se encuentren los afectados y optimizar la ventilación natural abriendo las ventanas y las personas se cubran la boca con un papel, pañuelo y/o servilleta al momento de toser o estornudar.'],
    caduca: '2027-11-26', activa: true, auditoria: 'unanime' },
  { id: 'hepatitis_ae_contagio', tema: 'contagio', patron: HEPATITIS_AE, fuente: 'censida_hepatitis_ae', encabezado: null,
    poblacion: 'población general', lista: true,
    pasaje: ['Los virus de Hepatitis A y E se reproducen en las células del hígado y se liberan a través de la bilis, llegando al intestino. Es por ello que se transmiten principalmente mediante la ingesta del virus mediante:',
      'Agua o alimentos contaminados.', 'Prácticas sexuales orales en la región anogenital.'],
    caduca: '2027-11-26', activa: false, auditoria: 'rechazada' },
  { id: 'escabiosis_contagio', tema: 'contagio', patron: ESCABIOSIS, fuente: 'ssa_piel_manos', encabezado: null,
    poblacion: 'población general', lista: false,
    pasaje: ['La escabiosis es una enfermedad parasitaria común producida por un ácaro que se hospeda y crece en la primera capa de la piel y se trasmite de persona a persona con cualquier tipo de contacto. Se caracteriza por causar erupciones rojizas acompañadas de fuerte comezón.'],
    caduca: '2027-11-26', activa: true, auditoria: 'unanime' },
  { id: 'escabiosis_prevencion', tema: 'prevencion', patron: ESCABIOSIS, fuente: 'ssa_piel_manos', encabezado: null,
    poblacion: 'población general', lista: true,
    pasaje: ['Algunas recomendaciones para prevenir la escabiosis son:', 'Lavar la ropa con agua caliente.',
      'Exponer prendas a altas temperaturas (secado al Sol).',
      'Para ropa de cama y colchones es recomendable planchar las sábanas, almohadas y cobijas.', 'El parásito no resiste el calor.'],
    caduca: '2027-11-26', activa: false, auditoria: 'rechazada' },
  { id: 'diarreicas_contagio', tema: 'contagio', patron: DIARREAS, fuente: 'ssa_diarreicas', encabezado: null,
    poblacion: 'población general', lista: false,
    pasaje: ['La diarrea suele ser un síntoma de infección del tracto digestivo ocasionada por virus, bacterias o parásitos que se adquieren al consumir agua o alimentos contaminados, o bien, de una persona a otra por una higiene inadecuada, por vía fecal-oral (ano-mano-boca).'],
    caduca: '2027-11-26', activa: true, auditoria: 'unanime' },
  { id: 'diarreicas_prevencion', tema: 'prevencion', patron: DIARREAS, fuente: 'ssa_diarreicas', encabezado: null,
    poblacion: 'población general', lista: false,
    pasaje: ['La medida de higiene más efectiva es el lavado de manos frecuente con agua y jabón: al llegar de la calle, antes de preparar alimentos, antes de consumirlos, después de tocar alimentos crudos, después de ir al baño y después de cambiar pañales.'],
    caduca: '2027-11-26', activa: true, auditoria: 'unanime' },
  { id: 'respiratorias_prevencion', tema: 'prevencion', patron: RESPIRATORIAS, fuente: 'ssa_respiratorias', encabezado: null,
    poblacion: 'personal de salud (así lo dirige la página)', lista: false,
    pasaje: ['Como personal de salud, es importante contar con las herramientas e información sobre las infecciones respiratorias agudas e influenza, identificación de síntomas, lineamientos de vigilancia epidemiológica, así como de las medidas de promoción y prevención pertinentes: lavado de manos frecuente, estornudo de etiqueta, higiene personal y del entorno, filtro familiar y resguardo en casa ante la presencia de síntomas de infección respiratoria. Estas medidas permitirán reducir la probabilidad de exposición y de transmisión del virus de estas enfermedades.'],
    caduca: '2027-11-26', activa: true, auditoria: 'unanime' },
]);

// ── Texto de la fuente ────────────────────────────────────────────────────────────────────────────────────────────────
const ENTIDADES = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', aacute: 'á', eacute: 'é', iacute: 'í',
  oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', ntilde: 'ñ', Ntilde: 'Ñ',
  uuml: 'ü', Uuml: 'Ü', iquest: '¿', iexcl: '¡', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  hellip: '…', ndash: '–', mdash: '—', ordm: 'º', ordf: 'ª', deg: '°', middot: '·' };
/** Texto visible de una página HTML: sin scripts ni estilos, sin etiquetas, con las entidades resueltas. */
export function textoDeHtml(html) {
  return normalizaFuente(String(html)
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? m));
}
/** Normalización para comparar: NFC, sin caracteres de ancho cero, espacios colapsados. */
export function normalizaFuente(t) {
  return String(t).normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/[\s ]+/g, ' ').trim();
}
/** Oraciones de una ficha (cada una debe ser subcadena de la fuente archivada). */
export function oracionesDe(ficha) {
  return [ficha.encabezado, ...ficha.pasaje].filter(Boolean).flatMap((p) => p.split(/(?<=[.:?])\s+(?=[A-ZÁÉÍÓÚÑ¿])/));
}

// ── Selección y presentación ─────────────────────────────────────────────────────────────────────────────────────────
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaLarga = (iso) => { const [a, m, d] = iso.split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${a}`; };

/** Ficha publicable para un tema y un texto normalizado, o null. `hoy` en formato AAAA-MM-DD. */
export function fichaPara(tema, textoNormalizado, hoy = new Date().toISOString().slice(0, 10)) {
  return FICHAS_CITA.find((f) => f.tema === tema && f.activa && f.auditoria === 'unanime' && f.caduca > hoy &&
    f.patron.test(textoNormalizado)) || null;
}

/** Rótulo del acta, primero en la respuesta (también lo lee la voz). */
export function rotuloFicha(ficha) {
  const f = FUENTES_CITA[ficha.fuente];
  return `**Cita textual de ${f.institucion}, «${f.titulo}», consultada el ${fechaLarga(f.consultada)}.** La eligió y la cotejó ` +
    'con la fuente un proceso asistido por inteligencia artificial. No la ha revisado personal de salud. Es información general ' +
    'y no sustituye la consulta médica; ante signos de alarma, llama al **911**.';
}

/** Cita con su encabezado, entre comillas, y la línea de población y fuente. */
export function citaFicha(ficha) {
  const f = FUENTES_CITA[ficha.fuente];
  const lineas = [];
  if (ficha.encabezado) lineas.push(`> **${ficha.encabezado}**`, '>');
  ficha.pasaje.forEach((p, i) => {
    const elemento = ficha.lista && i > 0;
    lineas.push(`> ${elemento ? '- ' : ''}«${p}»`);
    if (!elemento && i < ficha.pasaje.length - 1) lineas.push('>');
  });
  lineas.push('', `_Dirigida a: ${ficha.poblacion}. Fuente: [${f.titulo}](${f.url}), publicada el ${f.publicada}._`);
  return lineas.join('\n');
}
