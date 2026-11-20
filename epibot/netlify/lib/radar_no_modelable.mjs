/**
 * Categorías del boletín sin pronóstico (alta_b44) en la función RAG: respuesta fija con el motivo medido y las cifras
 * impresas de la foto vigente del radar, antes de la guarda de vecinos y de la recuperación. Así «tétanos neonatal» o
 * «B55.0» no reciben la aclaración del bloque vecino publicado sin cifras ni motivo. Mismo contenido que el EpiBot
 * (radar_boletin.js) y que no_modelables.html. Sin `?v=` en los imports: el empaquetador de Netlify los resuelve tal cual.
 */
import { GUION, guionNoPublicado } from '../../../assets/boletin/celdas.mjs';
import { GRUPOS_NO_MODELABLES, grupoNoModelable, noModelablesEnConsulta, nombreLimpio } from '../../../assets/boletin/no_modelables.mjs';

const fmt = (v) => v.toLocaleString('es-MX');

function celda(v, e, anio) {
  if (v == null) return 'sin dato';
  if (v === GUION) return guionNoPublicado(e.guion, anio) ? '– (cifra no publicada en este cuadro)' : '– (sin casos)';
  return typeof v === 'number' ? fmt(v) : v;
}

const minusculaInicial = (t) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

/** Respuesta fija para las categorías no modelables que nombra la consulta, o null. `data` es data.json del radar. */
export function respuestaNoModelableRag(q, data, { codigos = true } = {}) {
  if (!data?.meta || !Array.isArray(data.diseases)) return null;
  const es = noModelablesEnConsulta(q, data.diseases, { codigos }).filter((e) => grupoNoModelable(e));
  if (!es.length) return null;
  const m = data.meta;
  const partes = es.slice(0, 8).map((e) => {
    const anio = e.observed_week > m.week ? m.year - 1 : m.year;
    const g = GRUPOS_NO_MODELABLES[grupoNoModelable(e)];
    const nota = e.guion && guionNoPublicado(e.guion, anio) ? `\n\n${e.guion.nota}` : '';
    return `**${nombreLimpio(e.name)} (${e.code})**: EpiForecast-MX **no modela** esta categoría; no tiene pronóstico ni ` +
      `control estacional. Estado: **no modelable** (${g.etiqueta.toLowerCase()}). Motivo medido: ${minusculaInicial(e.reason)}\n\n` +
      `Cifras impresas en el Boletín Epidemiológico ${m.week} de ${m.year}, nacional, hasta la semana ${e.observed_week} de ${anio}:\n` +
      `- Casos de la semana: **${celda(e.weekly, e, anio)}**\n- Acumulado ${m.year}: **${celda(e.cumulative, e, anio)}**\n` +
      `- Acumulado comparable ${m.year - 1}: **${celda(e.previous, e, anio)}**${nota}`;
  });
  return `${partes.join('\n\n')}\n\nEl motivo y las cifras de todas las categorías sin pronóstico están en ` +
    '[Categorías sin pronóstico](../no_modelables.html); por entidad, en el [Radar del boletín](../boletin.html).';
}

