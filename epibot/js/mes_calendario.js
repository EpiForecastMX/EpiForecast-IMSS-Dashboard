/**
 * mes_calendario.js — periodo pedido en la consulta y cifra de un mes calendario (decisión 4 del plan canónico).
 *
 * Deuda del detector (27-nov-2026): la función RAG ignoraba el mes pedido y daba el total del horizonte, mientras el KB
 * daba el mes. Este módulo, sin dependencias ni sufijos de versión en sus importaciones (lo empaqueta esbuild en la función),
 * es la fuente única de ambos: `resumen_llano.js` y `netlify/lib/vista_grounding.mjs` lo importan.
 */

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const norm = (q) => String(q || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ent0 = (n) => (n == null ? '—' : Math.round(n).toLocaleString('es-MX'));
const casos = (n) => `${ent0(n)} ${Math.round(n) === 1 ? 'caso' : 'casos'}`;
const suma = (xs) => xs.reduce((a, [, y]) => a + (Number(y) || 0), 0);

/** Periodo pedido en la consulta: semana pasada, un mes, un año o el año en curso. */
export function periodoPedido(q) {
  const n = ` ${norm(q).replace(/[^a-z0-9]+/g, ' ')} `;
  if (/ (mucho o poco|es mucho|es poco|esta peor|esta mejor|el ano pasado|ano anterior|comparado con el ano|misma ventana) /.test(n)) return { tipo: 'vsanio' };
  if (/ (pico|temporada alta|cuando (sube|aumenta|hay) mas|cuando es la temporada|en que mes|estacionalidad|estacional|temporada) /.test(n)) return { tipo: 'pico' };
  if (/ (semana pasada|ultima semana|esta semana|semana anterior) /.test(n)) return { tipo: 'semana' };
  if (/ (proximo mes|siguiente mes|el mes que viene|proximas semanas|proximas 4 semanas) /.test(n)) return { tipo: 'proximo' };
  // Mesa de la plataforma (25-nov-2026, Codex Sol): «semana 44 de 2026» encabezaba con el total del año y «en 52 semanas» con
  // las próximas 4. Ahora se contesta primero el periodo pedido.
  const sem = n.match(/ semana (?:epidemiologica )?(\d{1,2})(?: (?:de|del) (?:ano )?(20\d\d))? /);
  if (sem && Number(sem[1]) >= 1 && Number(sem[1]) <= 53) return { tipo: 'semana_n', semana: Number(sem[1]), anio: sem[2] ? Number(sem[2]) : null };
  if (/ (52 semanas|proximos 12 meses|proximo ano|siguiente ano|todo el horizonte) /.test(n)) return { tipo: 'horizonte' };
  if (/ (este ano|en lo que va del ano|en lo que va de) /.test(n)) return { tipo: 'anio_actual' };
  const anio = n.match(/ (202[3-7]) /);
  const mes = MESES.findIndex((m) => n.includes(` ${m} `));
  if (mes >= 0) return { tipo: 'mes', mes, anio: anio ? Number(anio[1]) : null };
  if (anio) return Number(anio[1]) === new Date().getUTCFullYear() ? { tipo: 'anio_actual' } : { tipo: 'anio', anio: Number(anio[1]) };
  return null;
}

/**
 * Decisión 4 (26-nov-2026): un mes calendario son las semanas epidemiológicas que EMPIEZAN en él (domingo dentro del mes),
 * propuesta de Codex Sol; así ninguna semana se cuenta en dos meses. La respuesta lo dice.
 * `fut`: semanas de pronóstico posteriores a la última observada; `observado`: serie observada; `anioUlt`: año
 * epidemiológico de la última semana observada (texto); `lugar`: « en Jalisco (mujeres)». Devuelve la línea o null.
 */
export function lineaMes(p, fut0, observado, anioUlt, lugar) {
  // Cuarta ronda (Codex Sol): las vistas del runner rotulan la semana con su lunes y las legacy con su domingo; el mes se
  // decide por el DOMINGO de inicio (el día ds o el domingo anterior), así «2026-06-01» (lunes) cuenta en mayo.
  const inicio = (ds) => { const d = new Date(`${ds.slice(0, 10)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0, 10); };
  const clave = (ds) => { const i = inicio(ds); return Number(i.slice(5, 7)) - 1 === p.mes && (!p.anio || i.startsWith(String(p.anio))); };
  const obsSerie = observado || [];
  const fut = (fut0 || []).filter(([ds]) => clave(ds));
  if (fut.length) {
    const a = inicio(fut[0][0]).slice(0, 4);
    // Mes en curso (tercera ronda, Fable): las semanas del mes ya observadas se dicen aparte, para que el total no parezca
    // el del mes completo.
    const ya = obsSerie.filter(([ds]) => clave(ds) && inicio(ds).startsWith(a));
    const aparte = ya.length ? `; además, ${ya.length === 1 ? 'una semana ya notificada' : `${ya.length} semanas ya notificadas`} con **${casos(suma(ya))}**` : '';
    return `**En ${MESES[p.mes]} de ${a}** se esperan unos **${casos(suma(fut))}**${lugar} (las ${fut.length} semanas de pronóstico que empiezan en ${MESES[p.mes]}${aparte}).`;
  }
  const obs = obsSerie.filter(([ds]) => clave(ds)).filter(([ds]) => inicio(ds).startsWith(p.anio ? String(p.anio) : String(anioUlt)));
  if (obs.length) return `**En ${MESES[p.mes]} de ${inicio(obs[0][0]).slice(0, 4)}** se notificaron **${casos(suma(obs))}**${lugar} (las ${obs.length} semanas que empiezan en ${MESES[p.mes]}).`;
  return null;
}
