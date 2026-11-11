/**
 * EPI y el radar del boletín: los padecimientos que no se modelan responden con las cifras
 * notificadas de la foto vigente (`assets/boletin/actual.json`), con su semana de corte y sin
 * pronóstico. Los publicados conservan sus handlers y los temas sensibles la respuesta de crisis.
 *
 * Las cifras esperadas se leen de la foto vigente, no se escriben aquí: la prueba sigue válida
 * cuando el boletín avanza.
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

test('sin handler previo: «casos de varicela» ya no queda sin respuesta', async () => {
  const r = await conversa('casos de varicela');
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, new RegExp(es(por('Varicela').cumulative)));
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
  const r = await conversa('tuberculosis respiratoria en jalisco');
  assert.match(r.md, /Casos de la semana: \*\*– \(sin casos\)\*\*/);
  assert.match(r.md, /Acumulado 2026, hombres: \*\*507\*\*/);
  assert.match(r.md, /no se presentaron casos/);
});

test('un cero impreso se muestra como 0 y sin nota de guion', async () => {
  const { respuestaRadar } = await import('../js/radar_boletin.js');
  const e = { name: 'Prueba', code: 'X00', status: 'Por incorporar', observed_week: 43, weekly: 0, cumulative: 0,
    previous: 4, columns: ['Sem.'], totals: [0], states: [] };
  const md = respuestaRadar([e], d.radar_boletin, null);
  assert.match(md, /Casos de la semana: \*\*0\*\*/);
  assert.doesNotMatch(md, /–|guion/);
});

test('varias categorías salen en tabla, con la columna de la entidad', async () => {
  const tb = por('Tuberculosis respiratoria');
  const so = tb.states.find((s) => s.state === 'Sonora').values;
  const r = await conversa('tuberculosis en jalisco mujeres', 'y hombres?', 'y en sonora?');
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, /Sonora: semana \/ acumulado/);
  const sem = so[0] === '-' ? '– \\(sin casos\\)' : es(so[0]);
  assert.match(r.md, new RegExp(`Tuberculosis respiratoria \\| A15-A16 \\| ${tb.observed_week} \\|.*\\| ${sem} / ${es(so[1] + so[2])} \\|`));
});

test('el seguimiento de un no modelado no cae en la tabla neuro', async () => {
  const r = await conversa('vih en veracruz', 'y en puebla?');
  assert.equal(r.handler, 'answerRadarBoletin');
  assert.match(r.md, /\*\*Puebla\*\*/);
  const s = await conversa('depresion en sonora', 'y varicela?');
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
    assert.doesNotMatch(r.md, /Boletín Epidemiológico \d+ de \d{4}, publicado/, q);
  }
});

test('la cobertura del boletín sale del radar, no solo de la cohorte neuro', async () => {
  const r = await conversa('cuantos padecimientos tiene el boletin');
  assert.equal(r.handler, 'answerRadarResumen');
  assert.match(r.md, new RegExp(`\\*\\*${FOTO.meta.categories}\\*\\*`));
  assert.match(r.md, new RegExp(`publicados en EpiForecast-MX: \\*\\*${FOTO.meta.platform_published}\\*\\*`));
});
