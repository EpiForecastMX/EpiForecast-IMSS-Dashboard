/**
 * EPI y el radar del boletín: los padecimientos que no se modelan responden con las cifras
 * notificadas de la foto vigente (`assets/boletin/actual.json`), con su semana de corte y sin
 * pronóstico. Los publicados conservan sus handlers y los temas sensibles la respuesta de crisis.
 *
 * Las cifras vigentes se leen de la foto activa y la regresión histórica de 2026-w43-r1 preserva
 * la revisión archivada inmutable.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r) => readFileSync(new URL(`../../${r}`, import.meta.url), 'utf-8');
const K = leer('epibot/knowledge.json');
globalThis.fetch = async (u) => {
  const m = String(u).match(/(publication\/[^?]+\.json|assets\/boletin\/[^?]+\.json)/);
  return { ok: true, json: async () => JSON.parse(m ? leer(m[1]) : K) };
};
const kb = await import('../js/kb.js');
const { compactaRadar, buscaEnRadar, respuestaRadar } = await import('../js/radar_boletin.js');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

const ACTUAL = JSON.parse(leer('assets/boletin/actual.json'));
const FOTO = JSON.parse(leer(`${ACTUAL.carpeta}/data.json`));
const por = (nombre) => FOTO.diseases.find((e) => e.name === nombre);
const es = (n) => n.toLocaleString('es-MX');

async function conversa(...qs) {
  kb._resetContext();
  let r;
  for (const q of qs) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

test('la foto vigente del radar se carga junto con las vistas', () => {
  assert.ok(d.radar_boletin, 'radar_boletin no se cargó');
  assert.equal(d.radar_boletin.meta.week, FOTO.meta.week);
  assert.equal(d.radar_boletin.cobertura.published, FOTO.meta.platform_published);
});

test('un no modelado con entidad da las cifras impresas del cuadro, sin pronóstico', async () => {
  const e = por('Influenza');
  const fila = e.states.find((s) => s.state === 'Ciudad de México');
  const r = await conversa('influenza en cdmx');
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, new RegExp(`Boletín Epidemiológico ${FOTO.meta.week} de ${FOTO.meta.year}`));
  assert.match(r.md, new RegExp(`hasta la semana ${e.observed_week} de`));
  assert.match(r.md, new RegExp(`Acumulado ${FOTO.meta.year}: \\*\\*${es(e.cumulative)}\\*\\*`));
  assert.match(r.md, /\*\*Ciudad de México\*\* \(cifras originales del cuadro\)/);
  assert.match(r.md, new RegExp(`Casos de la semana: \\*\\*${es(fila.values[0])}\\*\\*`));
  assert.match(r.md, /no modela/);
  assert.doesNotMatch(r.md, /pronostican|52 semanas|NaN|undefined/);
  assert.match(r.md, /\.\.\/boletin\.html/);
  assert.match(r.md, /<!--SIN_GRAFICA-->/);
});

// Brucelosis tiene su propio control desde alta20c (15-nov-2026), triquinosis desde alta_b44 y la leishmaniasis cutánea
// desde el lote 6 (19-nov-2026); la oncocercosis sigue sin modelarse.
test('sin handler previo: «casos de oncocercosis» ya no queda sin respuesta', async () => {
  const r = await conversa('casos de oncocercosis');
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, new RegExp(es(por('Oncocercosis').cumulative)));
});

test('Covid-19 dice que se rechazó y remite a rechazados', async () => {
  const r = await conversa('covid en jalisco');
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, /rechazó/);
  assert.match(r.md, /rechazados\.html/);
});

test('sarampión: cada campo dice que es una cifra no publicada, nunca 0 casos', async () => {
  const r = await conversa('sarampion casos 2026');
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, /Casos de la semana: \*\*– \(cifra no publicada en este cuadro\)\*\*/);
  assert.match(r.md, /Acumulado comparable 2025: \*\*– \(cifra no publicada en este cuadro\)\*\*/);
  assert.match(r.md, /6,152/);
  assert.doesNotMatch(r.md, /\*\*0\*\*|guiones o ceros|sin casos/);
});

test('rubéola: el guion sigue la simbología impresa del boletín, campo por campo', async () => {
  const r = await conversa('casos de rubeola');
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, /Casos de la semana: \*\*– \(sin casos\)\*\*/);
  assert.match(r.md, /simbología \(p\. 9 y 10\) lo define como «no se presentaron casos»/);
  assert.doesNotMatch(r.md, /\*\*0\*\*|no publicada/);
});

test('una fila con guion y cifras muestra cada celda como se imprimió', async () => {
  // Lote 6: la tuberculosis respiratoria tiene su propio release; se usa una categoría que sigue sin modelarse.
  const tb = por('Paludismo por Plasmodium vivax');
  const filaGuion = tb.states.find((s) => s.values[0] === '-' && s.values.slice(1).every((v) => typeof v === 'number'));
  assert.ok(filaGuion, 'la fuente vigente debe tener al menos una entidad con guion semanal y acumulados numéricos');
  const r = await conversa(`paludismo por plasmodium vivax en ${filaGuion.state.toLowerCase()}`);
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, /Casos de la semana: \*\*– \(sin casos\)\*\*/);
  assert.match(r.md, new RegExp(`Acumulado ${FOTO.meta.year}, hombres: \\*\\*${es(filaGuion.values[1])}\\*\\*`));
  assert.match(r.md, new RegExp(`Acumulado ${FOTO.meta.year}, mujeres: \\*\\*${es(filaGuion.values[2])}\\*\\*`));
  assert.match(r.md, new RegExp(`Acumulado comparable ${FOTO.meta.year - 1}: \\*\\*${es(filaGuion.values[3])}\\*\\*`));
  assert.match(r.md, /no se presentaron casos/);
  // La tuberculosis respiratoria responde su release, no el radar.
  const rJal = await conversa('tuberculosis respiratoria en jalisco');
  assert.match(rJal.md, /<!--TUBERCULOSIS_RESPIRATORIA_A15:/);
});

test('regresión archivada 2026-w43-r1: tuberculosis respiratoria en Jalisco conserva su guion y cifras', async () => {
  const foto43 = JSON.parse(leer('assets/boletin/2026-w43-r1/data.json'));
  const radar43 = compactaRadar({ schema: 'boletin_actual.v1', carpeta: 'assets/boletin/2026-w43-r1' }, foto43);
  assert.ok(radar43, 'el archivo histórico 2026-w43-r1 debe compactarse con la API vigente');
  const encontradas = buscaEnRadar('tuberculosis respiratoria en jalisco', radar43);
  assert.equal(encontradas.length, 1);
  const mdDirecto = respuestaRadar(encontradas, radar43, 'Jalisco');
  assert.match(mdDirecto, /Boletín Epidemiológico 43 de 2026/);
  assert.match(mdDirecto, /Casos de la semana: \*\*– \(sin casos\)\*\*/);
  assert.match(mdDirecto, /Acumulado 2026, hombres: \*\*507\*\*/);
  assert.match(mdDirecto, /Acumulado 2026, mujeres: \*\*256\*\*/);
  assert.match(mdDirecto, /Acumulado comparable 2025: \*\*808\*\*/);
  assert.match(mdDirecto, /no se presentaron casos/);

  // Lote 6: en la conversación la tuberculosis respiratoria ya responde su release; el radar archivado se prueba directo.
  assert.equal(d.radar_boletin.meta.week, FOTO.meta.week);
});

test('un cero impreso se muestra como 0 y sin nota de guion', () => {
  const e = { name: 'Prueba', code: 'X00', status: 'Por incorporar', observed_week: 43, weekly: 0, cumulative: 0,
    previous: 4, columns: ['Sem.'], totals: [0], states: [] };
  const md = respuestaRadar([e], d.radar_boletin, null);
  assert.match(md, /Casos de la semana: \*\*0\*\*/);
  assert.doesNotMatch(md, /–|guion/);
});

test('varias categorías salen en tabla, con la columna de la entidad', async () => {
  // Lote 6: la leishmaniasis cutánea y la tuberculosis respiratoria se publicaron; «paludismo» sigue nombrando dos
  // categorías sin modelo (P. falciparum y P. vivax).
  const tb = por('Paludismo por Plasmodium vivax');
  const so = tb.states.find((s) => s.state === 'Sonora').values;
  const r = await conversa('paludismo en jalisco mujeres', 'y hombres?', 'y en sonora?');
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, /Sonora: semana \/ acumulado/);
  const sem = so[0] === '-' ? '– \\(sin casos\\)' : es(so[0]);
  assert.match(r.md, new RegExp(`Paludismo por Plasmodium vivax \\| B50 \\| ${tb.observed_week} \\|.*\\| ${sem} / ${so[1] === '-' ? '– \\(sin casos\\)' : es(so[1] + so[2])} \\|`));
});

test('el seguimiento de un no modelado no cae en la tabla neuro', async () => {
  // Lote 6: la leishmaniasis cutánea tiene su propio control; se usa una categoría que sigue sin modelarse.
  const r = await conversa('oncocercosis en veracruz', 'y en puebla?');
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, /\*\*Puebla\*\*/);
  const s = await conversa('depresion en sonora', 'y oncocercosis?');
  assert.equal(s.handler, 'answerRadarBoletin');
  assert.doesNotMatch(s.md, /Depresion/);
});

test('los publicados siguen en sus handlers', async () => {
  assert.equal((await conversa('neumonias en puebla')).handler, 'answerObesidad');
  assert.equal((await conversa('depresion en jalisco')).handler, 'answerSpecificSeries');
  assert.equal((await conversa('influenza en cdmx', 'y depresion?')).handler, 'answerSpecificSeries');
  assert.equal((await conversa('radar comparativo de motores')).handler, 'answerRadar');
});

test('los temas sensibles no reciben cifras del radar', async () => {
  for (const q of ['tengo ganas de morir', 'suicidio en jalisco', 'intento de suicidio casos', 'ideacion suicida en sonora']) {
    const r = await conversa(q);
    assert.notEqual(r.handler, 'answerRadarBoletin', q);
    assert.doesNotMatch(r.md, /Boletín Epidemiológico \d+ de \d{4}/, q);
  }
});

test('la cobertura del boletín sale del radar, no solo de la cohorte neuro', async () => {
  const r = await conversa('cuantos padecimientos tiene el boletin');
  assert.equal(r.handler, 'answerRadarResumen');
  assert.match(r.md, new RegExp(`\\*\\*${FOTO.meta.categories}\\*\\*`));
  assert.match(r.md, new RegExp(`publicados en EpiForecast-MX: \\*\\*${FOTO.meta.platform_published}\\*\\*`));
});
