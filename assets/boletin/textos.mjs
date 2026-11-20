// Textos de la página del radar que dependen de la foto semanal vigente.
// Única implementación: radar.js los aplica en el navegador y scripts/boletin_semana_activa.py
// los escribe en el HTML estático (sin JavaScript y para buscadores) llamando a este módulo.
import { summarizeCoverage, coberturaPanorama } from './coverage.mjs';
import {
  CLAVES_PROYECCION_MIASIS,
  COLUMNAS_CONTEO_MIASIS,
  avisoDiscrepanciaMiasis,
  entidadesAusentesMiasis,
  filasIdentidadRotaMiasis,
  notaSimbologiaHeredada,
  verificarMiasis,
} from './miasis_verificacion.mjs';

export {
  CLAVES_PROYECCION_MIASIS,
  COLUMNAS_CONTEO_MIASIS,
  avisoDiscrepanciaMiasis,
  entidadesAusentesMiasis,
  filasIdentidadRotaMiasis,
  notaSimbologiaHeredada,
  verificarMiasis,
};

const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete',
  'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos',
  'ochocientos', 'novecientos'];
const menorQueCien = n => (n < 30 ? UNIDADES[n] : DECENAS[Math.floor(n / 10)] + (n % 10 ? ` y ${UNIDADES[n % 10]}` : ''));

// Número cardinal en palabras (0 a 999: «cien», «ciento cuarenta y cinco»); fuera de ese rango se devuelven las cifras.
export function numeroEnPalabras(n, { mayuscula = false } = {}) {
  let t;
  if (!Number.isInteger(n) || n < 0 || n > 999) t = String(n);
  else if (n < 100) t = menorQueCien(n);
  else if (n === 100) t = 'cien';
  else t = CENTENAS[Math.floor(n / 100)] + (n % 100 ? ` ${menorQueCien(n % 100)}` : '');
  return mayuscula ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

const sinAnio = fecha => fecha.replace(/ de \d{4}$/, '');
const rango = paginas => {
  const ps = [...new Set(paginas)].sort((a, b) => a - b);
  return ps.length ? (ps[0] === ps.at(-1) ? String(ps[0]) : `${ps[0]}–${ps.at(-1)}`) : '';
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre'];
const fechaIso = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}`; };

export function rutaFoto(actual, archivo) {
  return `/${actual.carpeta.replace(/^\/+|\/+$/g, '')}/${archivo}`;
}

export function listaConY(xs) {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;
}

const n = v => v.toLocaleString('es-MX');
const pctTxt = v => `${v.toLocaleString('es-MX')} %`;

/**
 * Textos de la huella de la plataforma y de la cuarta tarjeta del panorama, desde los datos: publicado y
 * exploratorio no validado siempre por separado. `pronostico` es pronostico_exploratorio.json (o null).
 */
export function textosPanorama(data, pronostico) {
  const p = coberturaPanorama(data.diseases, pronostico);
  const sinRelease = data.diseases.filter(d => !d.aggregate && !(d.platform_id && ['Publicada', 'Control publicado'].includes(d.status)));
  const noModelables = sinRelease.filter(d => d.status === 'No modelable').length;
  const rechazadas = sinRelease.filter(d => d.status === 'Rechazada').length;
  const motivos = [
    noModelables ? `${n(noModelables)} no ${noModelables === 1 ? 'es modelable' : 'son modelables'} con el método actual` : '',
    rechazadas ? `${n(rechazadas)} ${rechazadas === 1 ? 'fue rechazada' : 'fueron rechazadas'} en su prueba` : '',
  ].filter(Boolean);
  const otras = sinRelease.length - noModelables - rechazadas;
  if (otras > 0) motivos.push(`${n(otras)} ${otras === 1 ? 'está' : 'están'} por incorporar`);
  const porque = motivos.length ? ` (${listaConY(motivos)})` : '';
  const partes = [`${n(p.publicado)} con pronóstico publicado`];
  if (p.exploratorio) partes.push(`${n(p.exploratorio)} con pronóstico exploratorio, no validado`);
  if (p.sin_pronostico) partes.push(`${n(p.sin_pronostico)} sin pronóstico`);
  const formasDengue = data.diseases.filter(d => !d.aggregate && d.platform_id === 'dengue' && ['Publicada', 'Control publicado'].includes(d.status)).length;
  const dengue = formasDengue > 1 ? ` Dengue se reporta en ${numeroEnPalabras(formasDengue)} formas clínicas.` : '';
  const pctExpl = Math.round((p.pct_con_pronostico - p.pct_publicado) * 10) / 10;
  let restantes = '';
  if (sinRelease.length) {
    const sujeto = `${sinRelease.length === 1 ? 'La restante no tiene' : `Las ${n(sinRelease.length)} restantes no tienen`} modelo validado${porque}`;
    if (p.exploratorio === sinRelease.length) {
      restantes = ` ${sujeto}: ${sinRelease.length === 1 ? 'muestra' : 'muestran'} un pronóstico exploratorio, no validado, que no es un pronóstico de EpiForecast-MX.`;
    } else if (p.exploratorio) {
      restantes = ` ${sujeto}: ${n(p.exploratorio)} ${p.exploratorio === 1 ? 'muestra' : 'muestran'} un pronóstico exploratorio, no validado, que no es un pronóstico de EpiForecast-MX, y ${n(p.sin_pronostico)} ${p.sin_pronostico === 1 ? 'sigue' : 'siguen'} sin pronóstico.`;
    } else {
      restantes = ` ${sujeto} ni pronóstico.`;
    }
  }
  return {
    con_pronostico: String(p.con_pronostico),
    con_pronostico_palabras: numeroEnPalabras(p.con_pronostico, { mayuscula: true }),
    categorias_total: String(p.total),
    categorias_publicadas: String(p.publicado),
    exploratorias: String(p.exploratorio),
    sin_pronostico: String(p.sin_pronostico),
    tarjeta_pronostico_detalle: `De ${n(p.total)}: ${partes.join('; ')}`,
    panorama_resumen: `${n(p.publicados)} padecimientos publicados cubren ${n(p.publicado)} categorías del boletín.${dengue}${restantes}`,
    anillo_estilo: `--publicado:${p.pct_publicado}%;--con-pronostico:${p.pct_con_pronostico}%`,
    anillo_aria: `${n(p.con_pronostico)} de ${n(p.total)} categorías con pronóstico: ${n(p.publicado)} con pronóstico publicado (${pctTxt(p.pct_publicado)})` +
      (p.exploratorio ? ` y ${n(p.exploratorio)} con pronóstico exploratorio, no validado (${pctTxt(pctExpl)})` : '') +
      (p.sin_pronostico ? `; ${n(p.sin_pronostico)} sin pronóstico` : '') + '.',
  };
}

export function textosRadar(data, actual, historia, pronostico = null) {
  const m = data.meta;
  const cobertura = summarizeCoverage(data.diseases);
  const estatales = data.diseases.filter(d => d.states.length);
  const ultima = historia ? historia.sources.reduce((a, s) => (s.year * 100 + s.week > a.year * 100 + a.week ? s : a)) : null;
  const paginasNacionales = [...new Set(data.national.map(d => d.page))].sort((a, b) => a - b);
  const mediana = data.diseases.find(d => !d.states.length)?.columns.find(c => c.startsWith('Mediana '));
  const listadas = data.myiasis.states.length, ausentes = 32 - listadas;
  const baseMiasis = `Miasis: ${listadas} entidades listadas${ausentes > 0 ? `, sin rellenar ${ausentes === 1 ? 'la ausente' : `las ${numeroEnPalabras(ausentes)} ausentes`}` : ''}.`;
  const avisoMiasis = avisoDiscrepanciaMiasis(data.myiasis, m.year);
  const t = {
    semana: String(m.week),
    anio: String(m.year),
    anio_previo: String(m.year - 1),
    mediana_nacional: mediana ? mediana.slice('Mediana '.length) : '',
    paginas_nacionales_y: listaConY(paginasNacionales.map(String)),
    miasis_resumen: avisoMiasis ? `${baseMiasis} Estado NO RECONCILIADO: ${avisoMiasis}` : baseMiasis,
    periodo_corto: sinAnio(m.period).replaceAll(' de ', ' ').toUpperCase(),
    publicado: sinAnio(m.publication),
    comprobado: sinAnio(m.checked),
    comprobado_largo: m.checked,
    volumen: String(actual.volumen ?? ''),
    categorias: String(m.categories),
    bloques: String(m.territorial_blocks),
    filas_nacionales: String(m.national_rows),
    agregados: String(m.aggregate_rows),
    solo_nacionales: String(data.diseases.filter(d => !d.states.length).length),
    publicados: String(cobertura.published),
    publicados_palabras: numeroEnPalabras(cobertura.published, { mayuscula: true }),
    cubiertas: String(cobertura.covered),
    no_modelables: String(cobertura.unmodelable),
    no_modelables_palabras: numeroEnPalabras(cobertura.unmodelable, { mayuscula: true }),
    paginas_estatales: rango(estatales.map(d => d.page)),
    paginas_nacionales: rango(data.national.map(d => d.page)),
    pagina_miasis: String(data.myiasis.page),
    miasis_entidades: String(listadas),
    ...textosPanorama(data, pronostico)
  };
  if (ultima) {
    t.historia_corte = `${ultima.week} de ${ultima.year}`;
    t.historia_comprobado = sinAnio(fechaIso(historia.checked));
  }
  for (const d of data.diseases) t[`pagina:${d.id}`] = String(d.page);
  for (const n of data.national) t[`pagina-nacional:${n.code}`] ??= String(n.page);
  return t;
}

// Enlaces a los archivos de la foto vigente.
export function enlacesRadar(actual) {
  return {
    pdf: rutaFoto(actual, actual.pdf),
    datos: rutaFoto(actual, 'data.json'),
    catalogo: rutaFoto(actual, 'catalogo.csv'),
    texto: rutaFoto(actual, 'boletin.txt'),
    ocr: rutaFoto(actual, 'encabezados-ocr.json'),
    pronostico: rutaFoto(actual, 'pronostico_exploratorio.json')
  };
}

// Sustituye {clave} en una plantilla; una clave desconocida se deja visible para que las pruebas la detecten.
export function rellenar(plantilla, textos) {
  return plantilla.replace(/\{([\w:.-]+)\}/g, (s, k) => textos[k] ?? s);
}

// Aplica textos y enlaces a los elementos marcados de la página (navegador).
export function aplicarTextos(doc, textos, enlaces) {
  doc.querySelectorAll('[data-radar]').forEach(el => {
    const v = textos[el.dataset.radar];
    if (v !== undefined) el.textContent = v;
  });
  doc.querySelectorAll('[data-radar-plantilla]').forEach(el => { el.textContent = rellenar(el.dataset.radarPlantilla, textos); });
  doc.querySelectorAll('[data-radar-aria]').forEach(el => {
    const v = textos[el.dataset.radarAria];
    if (v !== undefined) el.setAttribute('aria-label', v);
  });
  doc.querySelectorAll('[data-radar-estilo]').forEach(el => {
    const v = textos[el.dataset.radarEstilo];
    if (v !== undefined) el.setAttribute('style', v);
  });
  doc.querySelectorAll('[data-radar-content]').forEach(el => el.setAttribute('content', rellenar(el.dataset.radarContent, textos)));
  if (enlaces) doc.querySelectorAll('[data-radar-enlace]').forEach(el => {
    const v = enlaces[el.dataset.radarEnlace];
    if (v) el.setAttribute('href', v);
  });
}
