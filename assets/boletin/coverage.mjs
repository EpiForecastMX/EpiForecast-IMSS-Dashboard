const LEGACY_PAGES = Object.freeze({
  depresion: 'Reports/index.html', parkinson: 'Reports/index.html',
  alzheimer: 'Reports/index.html', dengue: 'dengue.html'
});

export function summarizeCoverage(diseases) {
  const categories = diseases.filter(d => !d.aggregate);
  const covered = categories.filter(d => d.platform_id && ['Publicada', 'Control publicado'].includes(d.status));
  return {
    published: new Set(covered.map(d => d.platform_id)).size,
    covered: covered.length,
    uncovered: categories.length - covered.length,
    controls: new Set(covered.filter(d => d.status === 'Control publicado').map(d => d.platform_id)).size,
    // Categorías sin pronóstico por un motivo medido (no_modelables.html); son parte de las no cubiertas.
    unmodelable: categories.filter(d => d.status === 'No modelable' && !d.platform_id).length
  };
}

export function platformPage(id) {
  if (LEGACY_PAGES[id]) return LEGACY_PAGES[id];
  return /^[a-z][a-z0-9_]*$/.test(id ?? '') ? `${id}.html` : '#cobertura';
}

export function publicationNote(disease) {
  const id = disease.platform_id;
  if (disease.status === 'Control publicado') return 'Control estacional no validado con rezago de 52 semanas; sin intervalos ni validación en curso.';
  if (id?.startsWith('diabetes')) return disease.source_note || 'Consulta su validación prospectiva en la ficha.';
  if (id === 'obesidad') return 'Release publicado; prospectiva 4/4.';
  return LEGACY_PAGES[id] ? 'Pronósticos publicados en EpiForecast.' : 'Consulta su evaluación y estado de validación en la ficha.';
}

export function predictorDescription(disease) {
  if (disease.status === 'Control publicado') return 'control estacional: conteos de 52 semanas antes, sin intervalos.';
  if (!LEGACY_PAGES[disease.platform_id]) return 'modelos por entidad y sexo; historia de conteos y calendario. Los predictores efectivos dependen del motor seleccionado. Consulta su evaluación en la ficha del padecimiento.';
  return 'historia temporal, rezagos y calendario según motor. INEGI es externo; ONI/ENSO solo está habilitado en motores específicos de dengue.';
}

// Opción «Pronóstico» del radar (alta_b44, 20-nov-2026): toda categoría no agregada la tiene, con pronóstico
// publicado, con pronóstico exploratorio no validado o, si su historia semanal no alcanza, con la serie y el motivo.
import { coberturaPronostico } from './pronostico.mjs?v=11';
export { coberturaPronostico };

const pct = (n, t) => `${(t ? Math.round((n / t) * 1000) / 10 : 0).toLocaleString('es-MX')} %`;

/** Desglose visible de la cobertura de la opción Pronóstico (sin HTML). */
export function textoCoberturaPronostico(c) {
  const partes = [
    `${c.publicado.toLocaleString('es-MX')} con pronóstico publicado (${pct(c.publicado, c.total)})`,
    `${c.exploratorio.toLocaleString('es-MX')} con pronóstico exploratorio estacional, no validado (${pct(c.exploratorio, c.total)})`,
  ];
  if (c.nivel_reciente) partes.push(`${c.nivel_reciente.toLocaleString('es-MX')} con pronóstico exploratorio de nivel reciente sin estacionalidad, no validado (${pct(c.nivel_reciente, c.total)})`);
  if (c.notas) partes.push(`${c.notas.toLocaleString('es-MX')} con pronóstico exploratorio nacional derivado del acumulado publicado en las notas del boletín, no validado (${pct(c.notas, c.total)})`);
  if (c.sin_historia) partes.push(`${c.sin_historia.toLocaleString('es-MX')} sin ningún pronóstico porque nunca se imprimió una cifra semanal; ${c.sin_historia === 1 ? 'muestra' : 'muestran'} su serie y el motivo (${pct(c.sin_historia, c.total)})`);
  const lista = partes.length > 2 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes.join(' y ');
  const faltan = c.sin_opcion ? ` Faltan ${c.sin_opcion} sin opción.` : '';
  return `${c.con_opcion.toLocaleString('es-MX')} de ${c.total.toLocaleString('es-MX')} categorías (${pct(c.con_opcion, c.total)}) tienen la opción «Pronóstico»: ${lista}.${faltan}`;
}

/**
 * Cobertura de pronóstico del panorama del radar: publicado frente a exploratorio no validado, sin mezclarlos.
 * `doc` es pronostico_exploratorio.json (o null si no se cargó: entonces sólo cuenta lo publicado).
 * Los porcentajes son de categorías no agregadas y sirven para dibujar los dos segmentos del anillo.
 */
export function coberturaPanorama(diseases, doc) {
  const s = summarizeCoverage(diseases);
  const c = coberturaPronostico(diseases, doc);
  const exploratorio = c.exploratorio + c.nivel_reciente + c.notas;
  const p = n => (c.total ? Math.round((n / c.total) * 1000) / 10 : 0);
  return {
    total: c.total,
    con_pronostico: c.con_pronostico,
    publicado: c.publicado,
    publicados: s.published,
    controles: s.controls,
    exploratorio,
    sin_pronostico: c.total - c.con_pronostico,
    completo: c.total > 0 && c.con_pronostico === c.total,
    pct_publicado: p(c.publicado),
    pct_con_pronostico: p(c.con_pronostico),
  };
}
