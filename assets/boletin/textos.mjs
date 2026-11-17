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

export const COLUMNAS_CONTEO_MIASIS = Object.freeze([0, 2, 3, 5, 6, 7, 9]);
export const CLAVES_PROYECCION_MIASIS = Object.freeze([
  'authorization_sha256', 'celdas_modificadas', 'columna', 'cuadro', 'delta',
  'disposition_file_sha256', 'estado', 'filas_con_identidad_rota', 'nombre_columna',
  'pagina', 'pdf_sha256', 'suma_estados', 'total_impreso',
]);
const CLAVES_RECONCILIACION_MIASIS = Object.freeze(['columnas_ok', 'discrepancias', 'status']);
const SHA256_HEX = /^[a-f0-9]{64}$/;
const CLAVES_PRIVADAS_PROHIBIDAS = new Set([
  'decision', 'autor', 'author', 'fecha', 'texto_literal', 'enlace_evidencia',
  'evidencia_sha256', 'solo_pruebas', 'acta', 'chat', 'chat_id', 'chat_timestamp',
  'ruta', 'rutas', 'path', 'local_path', 'disposition_path', 'authorization_path',
  'tolerancia', 'herencia',
]);
const PATRON_PRIVADO_O_RUTA = /(?:^|[\s"'`(=])(?:\/Users\/|\/home\/|\/private\/|\/var\/folders\/|\/tmp\/|[A-Za-z]:\\|file:\/\/|\.\.\/|planes\/)|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}|TEST_ONLY|\btexto_literal\b|\benlace_evidencia\b|\bsolo_pruebas\b/i;
const esObjetoPlano = v => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const mismasClaves = (obj, esperadas) => esObjetoPlano(obj)
  && JSON.stringify(Object.keys(obj).sort()) === JSON.stringify(esperadas);

function rechazarMetadatosPrivados(nodo, contexto) {
  if (nodo === null || nodo === undefined) return;
  if (typeof nodo === 'string') {
    if (PATRON_PRIVADO_O_RUTA.test(nodo)) throw new Error(`${contexto} contiene ruta local o marcador privado prohibido`);
    return;
  }
  if (Array.isArray(nodo)) {
    for (let i = 0; i < nodo.length; i++) rechazarMetadatosPrivados(nodo[i], `${contexto}[${i}]`);
    return;
  }
  if (typeof nodo === 'object') {
    for (const [k, v] of Object.entries(nodo)) {
      if (CLAVES_PRIVADAS_PROHIBIDAS.has(k) || PATRON_PRIVADO_O_RUTA.test(k)) {
        throw new Error(`${contexto} expone metadato privado o clave prohibida: ${k}`);
      }
      rechazarMetadatosPrivados(v, `${contexto}.${k}`);
    }
  }
}

export function filasIdentidadRotaMiasis(states, col) {
  if ([0, 3, 7].includes(col)) {
    return states
      .filter(s => s.values[0] + s.values[3] !== s.values[7])
      .map(s => ({ estado: s.state, col0: Math.trunc(s.values[0]), col3: Math.trunc(s.values[3]), col7_impreso: Math.trunc(s.values[7]) }));
  }
  if ([2, 5, 9].includes(col)) {
    return states
      .filter(s => s.values[2] + s.values[5] !== s.values[9])
      .map(s => ({ estado: s.state, col2: Math.trunc(s.values[2]), col5: Math.trunc(s.values[5]), col9_impreso: Math.trunc(s.values[9]) }));
  }
  return [];
}

// Aviso explícito cuando miasis lleva disposición nominal NO_RECONCILIADO; vacío si reconcilia.
export function avisoDiscrepanciaMiasis(myiasis, anio = null) {
  const disc = myiasis?.reconciliation?.discrepancias;
  if (!Array.isArray(disc) || !disc.length) return '';
  const fmt = n => Number(n).toLocaleString('es-MX');
  const y = Number.isInteger(anio) ? anio : (() => {
    const m = /(\d{4})$/.exec(myiasis?.columns?.[3] ?? '');
    return m ? Number(m[1]) : null;
  })();
  const partes = disc.map(d => {
    const ambito = d.columna === 7 && y ? `como total ${y - 1}–${y}` : `en «${d.nombre_columna}»`;
    const filas = (d.filas_con_identidad_rota ?? []).map(f => {
      if ('col7_impreso' in f && y) return `${f.estado} imprime ${fmt(f.col7_impreso)} en el total con ${fmt(f.col0)} en ${y - 1} y ${fmt(f.col3)} en ${y}`;
      if ('col9_impreso' in f && y) return `${f.estado} imprime ${fmt(f.col9_impreso)} en defunciones totales con ${fmt(f.col2)} en ${y - 1} y ${fmt(f.col5)} en ${y}`;
      return f.estado;
    }).join('; ');
    return `La fuente imprime ${fmt(d.total_impreso)} ${ambito}, pero sus entidades suman ${fmt(d.suma_estados)}${filas ? `: ${filas}` : ''}.`;
  });
  return `${partes.join(' ')} Se muestran las cifras tal como se imprimieron; tabla no reconciliada.`;
}

// Comprueba que cada columna de conteo de miasis reconcilia o tiene proyección técnica pública exacta.
export function verificarMiasis(data, verification = null) {
  const m = data?.myiasis;
  if (!m || !Array.isArray(m.states) || m.states.length === 0 || m.states.length > 32) throw new Error('estructura de miasis inválida');
  if (m.states.length + entidadesAusentesMiasis(data).length !== 32) throw new Error('entidades de miasis desconocidas o duplicadas');
  if (m.columns?.length !== 10 || m.totals?.length !== 10) throw new Error('columnas/totales de miasis incompletos');
  if (!SHA256_HEX.test(data?.meta?.pdf_sha256 ?? '')) throw new Error('meta.pdf_sha256 debe ser SHA-256 de 64 hex');
  rechazarMetadatosPrivados(data?.meta, 'data.meta');
  rechazarMetadatosPrivados(m, 'data.myiasis');
  if (verification !== null) {
    if (!esObjetoPlano(verification)) throw new Error('verification debe ser objeto');
    rechazarMetadatosPrivados(verification, 'verification');
    if (!SHA256_HEX.test(verification.source_pdf_sha256 ?? '') || verification.source_pdf_sha256 !== data.meta.pdf_sha256) {
      throw new Error('verification.source_pdf_sha256 debe coincidir con meta.pdf_sha256');
    }
  }
  for (const d of data?.diseases ?? []) {
    if (d?.reconciliation !== undefined || d?.decision !== undefined || (d?.states?.length && d.reconciled !== true)) {
      throw new Error('ninguna otra categoría admite disposición ni reconciliación excepcional');
    }
  }
  for (const n of data?.national ?? []) {
    if (n?.reconciliation !== undefined || n?.decision !== undefined) {
      throw new Error('el resumen nacional no admite disposición excepcional');
    }
  }
  const rec = m.reconciliation ?? null;
  if (rec === null) {
    if (data?.meta?.myiasis_status !== undefined) throw new Error('meta.myiasis_status presente sin myiasis.reconciliation');
    if (verification && (verification.myiasis_reconciled === false || verification.source_discrepancies !== undefined)) {
      throw new Error('verification declara discrepancias de miasis sin myiasis.reconciliation');
    }
    for (const i of COLUMNAS_CONTEO_MIASIS) {
      const sum = m.states.reduce((acc, s) => acc + s.values[i], 0);
      if (sum !== m.totals[i]) throw new Error(`miasis columna ${i} no reconcilia: suma ${sum} !== total ${m.totals[i]}`);
    }
    if (filasIdentidadRotaMiasis(m.states, 7).length || filasIdentidadRotaMiasis(m.states, 9).length) {
      throw new Error('identidad horizontal rota en miasis sin disposición');
    }
    return true;
  }
  if (!mismasClaves(rec, CLAVES_RECONCILIACION_MIASIS)) throw new Error('myiasis.reconciliation tiene claves inválidas o no permitidas');
  if (rec.status !== 'NO_RECONCILIADO') throw new Error(`myiasis.reconciliation.status inválido: ${rec.status}`);
  if (data?.meta?.myiasis_status !== 'NO_RECONCILIADO') throw new Error('meta.myiasis_status debe ser NO_RECONCILIADO');
  if (!Array.isArray(rec.discrepancias) || rec.discrepancias.length === 0) throw new Error('discrepancias vacías en NO_RECONCILIADO');
  const colsDeclaradas = new Set();
  for (const d of rec.discrepancias) {
    if (!mismasClaves(d, CLAVES_PROYECCION_MIASIS)) throw new Error('discrepancia pública de miasis debe proyectar sólo campos técnicos exactos y hashes SHA-256');
    if (!SHA256_HEX.test(d.pdf_sha256 ?? '') || d.pdf_sha256 !== data.meta.pdf_sha256) throw new Error('pdf_sha256 de disposición distinto de meta.pdf_sha256');
    if (!SHA256_HEX.test(d.authorization_sha256 ?? '') || !SHA256_HEX.test(d.disposition_file_sha256 ?? '')) {
      throw new Error('authorization_sha256 y disposition_file_sha256 deben ser SHA-256 de 64 hex');
    }
    if (d.pagina !== m.page || d.cuadro !== 'miasis') throw new Error('página o cuadro de disposición no coincide');
    if (!Number.isInteger(d.columna) || !COLUMNAS_CONTEO_MIASIS.includes(d.columna) || colsDeclaradas.has(d.columna)) throw new Error('columna de disposición inválida o duplicada');
    if (d.nombre_columna !== m.columns[d.columna]) throw new Error('nombre_columna no coincide con miasis');
    if (d.estado !== 'NO_RECONCILIADO' || d.celdas_modificadas !== 0) throw new Error('se exige NO_RECONCILIADO y celdas_modificadas=0');
    const sum = m.states.reduce((acc, s) => acc + s.values[d.columna], 0);
    const total = m.totals[d.columna];
    if (sum === total || d.delta === 0) throw new Error(`disposición sobrante en columna ${d.columna}: ${sum} === ${total}`);
    if (!Number.isInteger(d.suma_estados) || !Number.isInteger(d.total_impreso) || !Number.isInteger(d.delta)) throw new Error('cifras de disposición deben ser enteras');
    if (sum !== d.suma_estados || total !== d.total_impreso || total - sum !== d.delta) {
      throw new Error(`disposición no coincide con celdas impresas: suma=${sum}, total=${total}, delta=${d.delta}`);
    }
    const rotas = filasIdentidadRotaMiasis(m.states, d.columna);
    if (JSON.stringify(d.filas_con_identidad_rota) !== JSON.stringify(rotas)) throw new Error('filas_con_identidad_rota no coincide con celdas impresas');
    colsDeclaradas.add(d.columna);
  }
  const okEsperadas = COLUMNAS_CONTEO_MIASIS.filter(i => !colsDeclaradas.has(i));
  if (JSON.stringify(rec.columnas_ok) !== JSON.stringify(okEsperadas)) throw new Error('columnas_ok no coincide');
  for (const i of okEsperadas) {
    const sum = m.states.reduce((acc, s) => acc + s.values[i], 0);
    if (sum !== m.totals[i]) throw new Error(`miasis columna ${i} no reconcilia: suma ${sum} !== total ${m.totals[i]}`);
  }
  if (![0, 3, 7].some(i => colsDeclaradas.has(i)) && filasIdentidadRotaMiasis(m.states, 7).length) {
    throw new Error('identidad horizontal rota en casos de miasis sin disposición');
  }
  if (![2, 5, 9].some(i => colsDeclaradas.has(i)) && filasIdentidadRotaMiasis(m.states, 9).length) {
    throw new Error('identidad horizontal rota en defunciones de miasis sin disposición');
  }
  if (verification !== null) {
    if (verification.myiasis_reconciled !== false) throw new Error('verification.myiasis_reconciled debe ser false');
    if (!Array.isArray(verification.source_discrepancies) || verification.source_discrepancies.length !== rec.discrepancias.length) {
      throw new Error('verification.source_discrepancies ausente o incompleto');
    }
    for (let i = 0; i < rec.discrepancias.length; i++) {
      const vd = verification.source_discrepancies[i];
      if (!mismasClaves(vd, CLAVES_PROYECCION_MIASIS)) throw new Error('source_discrepancies debe tener la misma proyección técnica exacta');
      for (const k of CLAVES_PROYECCION_MIASIS) {
        if (JSON.stringify(vd[k]) !== JSON.stringify(rec.discrepancias[i][k])) {
          throw new Error(`source_discrepancies difiere de myiasis.reconciliation en ${k}`);
        }
      }
    }
  }
  return true;
}

export function textosRadar(data, actual, historia) {
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
    miasis_resumen: avisoMiasis ? `${baseMiasis} ${avisoMiasis}` : baseMiasis,
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
