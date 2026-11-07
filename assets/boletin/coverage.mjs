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
    controls: new Set(covered.filter(d => d.status === 'Control publicado').map(d => d.platform_id)).size
  };
}

export function platformPage(id) {
  if (LEGACY_PAGES[id]) return LEGACY_PAGES[id];
  return /^[a-z][a-z0-9_]*$/.test(id ?? '') ? `${id}.html` : '#cobertura';
}

export function publicationNote(disease) {
  const id = disease.platform_id;
  if (disease.status === 'Control publicado') return 'Control estacional con rezago de 52 semanas; sin intervalos.';
  if (id?.startsWith('diabetes')) return disease.source_note || 'Consulta su validación prospectiva en la ficha.';
  if (id === 'obesidad') return 'Release publicado; prospectiva 4/4.';
  return LEGACY_PAGES[id] ? 'Pronósticos publicados en EpiForecast.' : 'Consulta su evaluación y estado de validación en la ficha.';
}

export function predictorDescription(disease) {
  if (disease.status === 'Control publicado') return 'control estacional: conteos de 52 semanas antes, sin intervalos.';
  if (!LEGACY_PAGES[disease.platform_id]) return 'modelos por entidad y sexo; historia de conteos y calendario. Los predictores efectivos dependen del motor seleccionado. Consulta su evaluación en la ficha del padecimiento.';
  return 'historia temporal, rezagos y calendario según motor. INEGI es externo; ONI/ENSO solo está habilitado en motores específicos de dengue.';
}
