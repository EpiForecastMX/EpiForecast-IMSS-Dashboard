// Textos de la página del radar que dependen de la foto semanal vigente.
// Única implementación: radar.js los aplica en el navegador y scripts/boletin_semana_activa.py
// los escribe en el HTML estático (sin JavaScript y para buscadores) llamando a este módulo.
import { summarizeCoverage } from './coverage.mjs';

const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete',
  'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

// Número cardinal en palabras (0 a 99); fuera de ese rango se devuelven las cifras.
export function numeroEnPalabras(n, { mayuscula = false } = {}) {
  let t;
  if (!Number.isInteger(n) || n < 0 || n > 99) t = String(n);
  else if (n < 30) t = UNIDADES[n];
  else t = DECENAS[Math.floor(n / 10)] + (n % 10 ? ` y ${UNIDADES[n % 10]}` : '');
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

// Entidades del cuadro de miasis que no aparecen, con los nombres de los cuadros estatales.
export function entidadesAusentesMiasis(data) {
  const todas = data.diseases.find(d => d.states.length)?.states.map(s => s.state) ?? [];
  const canon = s => { const t = s.replace(/\*+$/, '').trim(); return t === 'Estado de México' ? 'México' : t; };
  const listadas = new Set(data.myiasis.states.map(s => canon(s.state)));
  return todas.filter(s => !listadas.has(s));
}

export function listaConY(xs) {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`;
}

export function textosRadar(data, actual, historia) {
  const m = data.meta;
  const cobertura = summarizeCoverage(data.diseases);
  const estatales = data.diseases.filter(d => d.states.length);
  const ultima = historia ? historia.sources.reduce((a, s) => (s.year * 100 + s.week > a.year * 100 + a.week ? s : a)) : null;
  const paginasNacionales = [...new Set(data.national.map(d => d.page))].sort((a, b) => a - b);
  const mediana = data.diseases.find(d => !d.states.length)?.columns.find(c => c.startsWith('Mediana '));
  const listadas = data.myiasis.states.length, ausentes = 32 - listadas;
  const t = {
    semana: String(m.week),
    anio: String(m.year),
    anio_previo: String(m.year - 1),
    mediana_nacional: mediana ? mediana.slice('Mediana '.length) : '',
    paginas_nacionales_y: listaConY(paginasNacionales.map(String)),
    miasis_resumen: `Miasis: ${listadas} entidades listadas${ausentes > 0 ? `, sin rellenar ${ausentes === 1 ? 'la ausente' : `las ${numeroEnPalabras(ausentes)} ausentes`}` : ''}.`,
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
    paginas_estatales: rango(estatales.map(d => d.page)),
    paginas_nacionales: rango(data.national.map(d => d.page)),
    pagina_miasis: String(data.myiasis.page),
    miasis_entidades: String(listadas)
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
    ocr: rutaFoto(actual, 'encabezados-ocr.json')
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
  doc.querySelectorAll('[data-radar-content]').forEach(el => el.setAttribute('content', rellenar(el.dataset.radarContent, textos)));
  if (enlaces) doc.querySelectorAll('[data-radar-enlace]').forEach(el => {
    const v = enlaces[el.dataset.radarEnlace];
    if (v) el.setAttribute('href', v);
  });
}
