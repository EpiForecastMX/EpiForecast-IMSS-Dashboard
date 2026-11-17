// Verificación aritmética/estructural y textos de estado para el cuadro complementario de miasis.
// La garantía primaria de privacidad es la proyección cerrada de 13 claves del generador Python.
// La lista negra aquí es sólo defensa heurística secundaria ante claves de disposición y rutas conocidas,
// no un detector universal de nombres o metadatos arbitrarios fuera de los esquemas cerrados.

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

const igualdadEstructural = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => igualdadEstructural(v, b[i]));
  }
  if (!esObjetoPlano(a) || !esObjetoPlano(b)) return false;
  const ka = Object.keys(a).sort();
  return mismasClaves(b, ka) && ka.every(k => igualdadEstructural(a[k], b[k]));
};

const asegurarConteoEntero = v => {
  if (!Number.isInteger(v)) throw new Error('conteos de miasis deben ser enteros');
  return v;
};

// Entidades del cuadro de miasis que no aparecen, con los nombres de los cuadros estatales.
export function entidadesAusentesMiasis(data) {
  const todas = data.diseases.find(d => d.states.length)?.states.map(s => s.state) ?? [];
  const canon = s => { const t = s.replace(/\*+$/, '').trim(); return t === 'Estado de México' ? 'México' : t; };
  const listadas = new Set(data.myiasis.states.map(s => canon(s.state)));
  return todas.filter(s => !listadas.has(s));
}

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
        throw new Error(`${contexto} expone metadato privado o clave prohibida`);
      }
      rechazarMetadatosPrivados(v, `${contexto}.${k}`);
    }
  }
}

export function filasIdentidadRotaMiasis(states, col) {
  const cols = [0, 3, 7].includes(col) ? [0, 3, 7] : [2, 5, 9].includes(col) ? [2, 5, 9] : null;
  if (!cols) return [];
  const [ia, ib, it] = cols, [ka, kb, kt] = [`col${ia}`, `col${ib}`, `col${it}_impreso`];
  return states.flatMap(s => {
    const a = asegurarConteoEntero(s?.values?.[ia]), b = asegurarConteoEntero(s?.values?.[ib]), tot = asegurarConteoEntero(s?.values?.[it]);
    return a + b !== tot ? [{ estado: s.state, [ka]: a, [kb]: b, [kt]: tot }] : [];
  });
}

// Nota honesta cuando meta.symbols declara origen HEREDADO desde la foto inmediata anterior.
export function notaSimbologiaHeredada(symbols) {
  if (!symbols || symbols.origen !== 'HEREDADO') return '';
  const per = symbols.heredada_de?.periodo ?? 'foto previa';
  const sha = symbols.heredada_de?.pdf_sha256 ? `${symbols.heredada_de.pdf_sha256.slice(0, 12)}…` : 'n.d.';
  const pags = Array.isArray(symbols.paginas) && symbols.paginas.length ? `, p. ${symbols.paginas.join(' y ')} en esa foto previa` : '';
  return `Simbología en estado HEREDADO: reutilizada de la foto inmediata anterior ${per} (PDF ${sha}${pags}), sin asegurar lectura directa en este PDF.`;
}

// Aviso explícito cuando miasis lleva disposición nominal; vacío si reconcilia.
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

// Comprueba conteos enteros y reconciliación exacta o esquema cerrado de 13 claves públicas en miasis.
export function verificarMiasis(data, verification = null) {
  const m = data?.myiasis;
  if (!m || !Array.isArray(m.states) || m.states.length === 0 || m.states.length > 32) throw new Error('estructura de miasis inválida');
  if (m.states.length + entidadesAusentesMiasis(data).length !== 32) throw new Error('entidades de miasis desconocidas o duplicadas');
  if (m.columns?.length !== 10 || m.totals?.length !== 10) throw new Error('columnas/totales de miasis incompletos');
  for (const s of m.states) if (!Array.isArray(s?.values) || s.values.length !== 10) throw new Error('valores de entidad en miasis incompletos');
  for (const i of COLUMNAS_CONTEO_MIASIS) {
    asegurarConteoEntero(m.totals[i]);
    for (const s of m.states) asegurarConteoEntero(s.values[i]);
  }
  if (!SHA256_HEX.test(data?.meta?.pdf_sha256 ?? '')) throw new Error('meta.pdf_sha256 debe ser SHA-256 de 64 hex');
  const simb = data?.meta?.symbols;
  if (simb?.origen !== undefined) {
    if (simb.origen !== 'HEREDADO' || !esObjetoPlano(simb.heredada_de)
        || typeof simb.heredada_de.periodo !== 'string' || !/^\d{4}-W\d{2}$/.test(simb.heredada_de.periodo)
        || !SHA256_HEX.test(simb.heredada_de.pdf_sha256 ?? '')) {
      throw new Error('meta.symbols heredada requiere origen HEREDADO con periodo y pdf_sha256 válidos');
    }
  }
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
  if (rec.status !== 'NO_RECONCILIADO') throw new Error('myiasis.reconciliation.status inválido');
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
    if (!igualdadEstructural(d.filas_con_identidad_rota, rotas)) throw new Error('filas_con_identidad_rota no coincide con celdas impresas');
    colsDeclaradas.add(d.columna);
  }
  const okEsperadas = COLUMNAS_CONTEO_MIASIS.filter(i => !colsDeclaradas.has(i));
  if (!igualdadEstructural(rec.columnas_ok, okEsperadas)) throw new Error('columnas_ok no coincide');
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
        if (!igualdadEstructural(vd[k], rec.discrepancias[i][k])) {
          throw new Error(`source_discrepancies difiere de myiasis.reconciliation en ${k}`);
        }
      }
    }
  }
  return true;
}
