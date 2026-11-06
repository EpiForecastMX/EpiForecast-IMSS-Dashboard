/**
 * Diabetes tipo I y II: subtipos, consultas mixtas y un release sin semanas observadas (0/4).
 *
 * Una vista 0/4 no tiene desempeño: ninguna respuesta puede mostrar métricas vacías ni dar por
 * superada la validación, y «diabetes» a secas debe avisar de que se toma como tipo II.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r) => readFileSync(new URL(`../../${r}`, import.meta.url), 'utf-8');
const K = readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8');
const VISTAS = ['obesidad', 'anorexia_f50', 'diabetes_t1', 'diabetes_t2'];
globalThis.fetch = async (u) => ({
  ok: true,
  json: async () => {
    const id = VISTAS.find((x) => String(u).includes(`publication/${x}/vista.json`));
    return JSON.parse(id ? leer(`publication/${id}/vista.json`) : K);
  },
});
const kb = await import('../js/kb.js');
const { detectEntities, mencionaNoModelada, norm } = await import('../js/entities.js?v=34');
const { diabetesEnConsulta, MARCADOR_RELEASE } = await import('../js/release_config.js?v=1');
const oc = await import('../js/obesidad_charts.js?v=3');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function conversa(...qs) {
  kb._resetContext();
  let r;
  for (const q of qs) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

const SIN_VALOR = /sMAPE:? \*{0,2}—|NaN|undefined|null/;

test('los subtipos se resuelven sin confundirse', () => {
  const pad = (q) => detectEntities(q).padecimiento;
  for (const q of ['diabetes tipo 1', 'diabetes tipo i en jalisco', 'dm1', 'E10', 'diabetes insulinodependiente']) {
    assert.equal(pad(q), 'Diabetes tipo I', q);
  }
  for (const q of ['diabetes tipo 2', 'diabetes tipo ii', 'dm2', 'E11', 'e14', 'diabetes no insulinodependiente']) {
    assert.equal(pad(q), 'Diabetes tipo II', q);
  }
  assert.equal(pad('casos de diabetes'), 'Diabetes tipo II');
  assert.equal(detectEntities('casos de diabetes')._diabetesGenerica, true);
  assert.equal(detectEntities('diabetes tipo 2')._diabetesGenerica, undefined);
  assert.deepEqual(detectEntities('diabetes tipo 1 y 2').padecimientos, ['Diabetes tipo I', 'Diabetes tipo II']);
});

test('gestacional, insípida y prediabetes siguen sin modelarse', async () => {
  for (const q of ['diabetes gestacional', 'diabetes insipida en jalisco', 'casos de prediabetes']) {
    assert.equal(diabetesEnConsulta(norm(q)), null, q);
    assert.ok(mencionaNoModelada(norm(q)), q);
  }
  const r = await conversa('casos de diabetes gestacional en jalisco');
  assert.equal(r.handler, 'answerPadecimientoNoModelado');
  assert.match(r.md, /no modela/);
  assert.match(r.md, /ocho padecimientos/);
});

test('«diabetes» a secas avisa que se toma como tipo II', async () => {
  const r = await conversa('pronostico de diabetes');
  assert.equal(r.handler, 'answerDiabetes');
  assert.match(r.md, /Tomo «diabetes» como \*\*Diabetes tipo II \(E11-E14\)\*\*/);
  assert.match(r.md, /<!--DIABETES_T2:/);
});

test('tipo I responde con su etiqueta, su marcador y su corte', async () => {
  const r = await conversa('diabetes tipo 1 en jalisco mujeres');
  assert.match(r.md, /Diabetes tipo I \(E10\) · Jalisco · Mujeres/);
  assert.match(r.md, /<!--DIABETES_T1:/);
  assert.match(r.md, /datos hasta 2026-W41/);
  assert.doesNotMatch(r.md, /Obesidad/);
});

test('el follow-up conserva el subtipo', async () => {
  const r = await conversa('diabetes tipo 1 en jalisco', 'y hombres?');
  assert.match(r.md, /Diabetes tipo I \(E10\) · Jalisco · Hombres/);
});

test('con 0/4 no hay métricas vacías ni validación dada por superada', async () => {
  for (const q of ['pronostico de diabetes tipo 2', 'diabetes tipo 2 por sexo', 'acumulado de diabetes tipo 2',
    'zoom diabetes tipo 2', 'comparar diabetes tipo 2 entre jalisco y sonora', 'motores de diabetes tipo 2',
    'mapa de diabetes tipo 2']) {
    const r = await conversa(q);
    const texto = r.md.replace(/<!--.*?-->/g, '');
    assert.doesNotMatch(texto, SIN_VALOR, q);
    assert.doesNotMatch(texto, /validación prospectiva (superada|aprobada)|PASS/i, q);
  }
  for (const q of ['ranking de diabetes tipo 2', 'calibracion de diabetes tipo 2', 'mapa de diabetes tipo 2 por error']) {
    const r = await conversa(q);
    assert.match(r.md, /Validación prospectiva en curso\*\* \(0 de 4 semanas\)/, q);
    assert.match(r.md, / o «diabetes tipo 2 por sexo»/, q);
    assert.doesNotMatch(r.md.replace(/<!--.*?-->/g, ''), /sMAPE \d/, q);
  }
});

test('con 0/4 las gráficas de error no se dibujan y las demás sí', () => {
  const v = d.diabetes_t2;
  assert.equal(oc.graficaObesidad(v, 'ranking', {}, { tipo: 'ranking' }), null);
  assert.equal(oc.graficaObesidad(v, 'calibracion', {}, { tipo: 'calibracion' }), null);
  assert.equal(oc.graficaObesidad(v, 'mapa de error', {}, { tipo: 'mapa' }), null);
  const serie = oc.graficaObesidad(v, 'pronostico', {}, { tipo: 'serie' });
  assert.match(serie.title, /Diabetes tipo II \(E11-E14\)/);
  assert.equal(oc.graficaObesidad(v, 'mapa', {}, { tipo: 'mapa' })._mapChart, true);
});

test('dos padecimientos con release no se mezclan en una gráfica', async () => {
  const r = await conversa('comparar obesidad con diabetes tipo 2');
  assert.equal(r.handler, 'answerReleasesMixtos');
  assert.match(r.md, /Obesidad \(E66\)/);
  assert.match(r.md, /Diabetes tipo II \(E11-E14\)/);
  assert.match(r.md, /<!--SIN_GRAFICA-->/);
  assert.doesNotMatch(r.md, MARCADOR_RELEASE);
  const ambos = await conversa('diabetes tipo 1 y 2');
  assert.equal(ambos.handler, 'answerReleasesMixtos');
});

test('el RAG detecta el subtipo y no inyecta series neuro', () => {
  const rag = leer('epibot/netlify/functions/rag.mjs');
  assert.match(rag, /function diabetesDe\(qn\)/);
  assert.match(rag, /padecimiento: diabetesDe\(qn\)/);
});

test('las páginas leen su propia vista y dicen que la validación sigue en curso', () => {
  for (const [id, et] of [['diabetes_t1', 'Diabetes tipo I (E10)'], ['diabetes_t2', 'Diabetes tipo II (E11-E14)']]) {
    const p = leer(`${id}.html`);
    assert.match(p, new RegExp(`fetch\\('publication/${id}/vista\\.json'`));
    assert.ok(p.includes(`<h1>${et} · Pronóstico semanal</h1>`));
    assert.match(p, /<strong id="mtVerdict">en curso<\/strong>/);
    assert.doesNotMatch(p, /Obesidad \(E66\)|de obesidad|superó|quinto/);
  }
});

test('la galería crea una instancia por release y no mezcla sus canvas', () => {
  const g = leer('Reports/obesidad_galeria.js');
  const catalogo = leer('epibot/js/release_catalog.js');
  for (const id of VISTAS) assert.match(catalogo, new RegExp(`id: '${id}'`));
  assert.match(g, /GaleriasRelease = globalThis\.EPI_CATALOGO\.releases\.map\(crea\)/);
  assert.match(g, /canvas\[data-release="\$\{id\}"\]/);
  assert.equal(JSON.parse(leer('hero_series.json')).series.length, 4);
});

test('la noticia dice que la validación está en curso y no da métricas', () => {
  const nota = JSON.parse(leer('news.json')).items.find((it) => it.type === 'diabetes');
  assert.match(nota.summary, /validación prospectiva está en curso/);
  assert.doesNotMatch(JSON.stringify(nota), /sMAPE|MASE|superó/);
});

test('un seguimiento que nombra otro subtipo no hereda el anterior', async () => {
  const { conDiabetesNombrada } = await import('../js/release_config.js');
  assert.equal(conDiabetesNombrada('y tipo 2', 'Diabetes tipo I'), 'y diabetes tipo 2');
  assert.equal(conDiabetesNombrada('y gestacional', 'Diabetes tipo II'), 'y diabetes gestacional');
  assert.equal(conDiabetesNombrada('y insipida', 'Diabetes tipo II'), 'y diabetes insipida');
  assert.equal(conDiabetesNombrada('and type 2', 'Diabetes tipo I'), 'and diabetes type 2');
  assert.equal(conDiabetesNombrada('y hombres', 'Diabetes tipo I'), 'y hombres');
  assert.equal(conDiabetesNombrada('y tipo 2', 'Obesidad'), 'y tipo 2');
  assert.equal(conDiabetesNombrada('tipo 2', 'Diabetes tipo I'), 'tipo 2');
});

test('el inglés conserva padecimiento, subtipo y sexo', async () => {
  const { detectEntities } = await import('../js/entities.js');
  const o = detectEntities('obesity in jalisco women');
  assert.equal(o.padecimiento, 'Obesidad');
  assert.equal(o.sexo, 'mujeres');
  const t = detectEntities('diabetes type 1 in jalisco women');
  assert.equal(t.padecimiento, 'Diabetes tipo I');
  assert.equal(t.sexo, 'mujeres');
  assert.equal(detectEntities('diabetes type 2 in jalisco men').sexo, 'hombres');
  assert.equal(detectEntities('gestational diabetes in jalisco').padecimiento, null);
});

test('la conversación cambia de subtipo o avisa que no se modela', async () => {
  const dos = await conversa('diabetes tipo 1 en jalisco mujeres', '¿y tipo 2?');
  assert.match(dos.md, /Diabetes tipo II \(E11-E14\) · Jalisco · Mujeres/);
  assert.doesNotMatch(dos.md, /Diabetes tipo I \(E10\)/);
  for (const q of ['¿y gestacional?', '¿y insípida?']) {
    const r = await conversa('diabetes tipo 2 en jalisco', q);
    assert.equal(r.handler, 'answerPadecimientoNoModelado', q);
    assert.match(r.md, /no modela/, q);
    assert.doesNotMatch(r.md, MARCADOR_RELEASE, q);
  }
});

test('en inglés responde el padecimiento pedido o pide precisión', async () => {
  const o = await conversa('obesity in jalisco women');
  assert.match(o.md, /Obesidad \(E66\) · Jalisco · Mujeres/);
  const t = await conversa('diabetes type 1 in jalisco women');
  assert.match(t.md, /Diabetes tipo I \(E10\) · Jalisco · Mujeres/);
  const a = await conversa('asthma in jalisco women');
  assert.match(a.md, /no modela asthma/);
  const x = await conversa('rare syndrome in jalisco women');
  assert.equal(x.handler, 'answerConsultaEnInglesSinPadecimiento');
  assert.match(x.md, /No identifiqué el padecimiento/);
  assert.doesNotMatch(x.md, /Alzheimer \|/);
});

test('las semanas sin observación no se presentan como futuras', async () => {
  const r = await conversa('diabetes tipo 2 en jalisco');
  assert.doesNotMatch(r.md, /Próximas semanas/);
  assert.match(r.md, /aún sin observación publicada/);
});

test('F50 responde su release, nunca la tabla neuro del estado', async () => {
  for (const q of ['anorexia en jalisco', 'bulimia en sonora', 'trastornos alimentarios en jalisco']) {
    const r = await conversa(q);
    assert.equal(r.handler, 'answerObesidad', q);
    assert.match(r.md, /Anorexia, bulimia y otros trastornos alimentarios \(F50\)/, q);
    assert.match(r.md, /ANOREXIA_F50/, q);
  }
});

test('F50 se declara como control, nunca como validación en curso', async () => {
  for (const q of ['pronostico de anorexia', 'anorexia en jalisco mujeres', 'motores de anorexia']) {
    const r = await conversa(q);
    assert.match(r.md, /control estacional/i, q);
    assert.doesNotMatch(r.md, /Validación prospectiva en curso/, q);
    assert.doesNotMatch(r.md, /validación cruzada temporal/, q);
  }
  const r = await conversa('pronostico de anorexia');
  assert.match(r.md, /40\.5/);
  assert.match(r.md, /18\.1/);
});

test('la noticia de F50 declara el control y no da métricas', () => {
  const nota = JSON.parse(leer('news.json')).items[0];
  assert.equal(nota.type, 'f50');
  assert.equal(nota.link.href, 'anorexia_f50.html');
  assert.match(nota.summary, /no superó la prueba de 2025/);
  assert.doesNotMatch(JSON.stringify(nota), /sMAPE|MASE/);
});

test('Covid-19 sigue sin modelarse y remite a la evidencia del rechazo', async () => {
  const r = await conversa('covid en jalisco');
  assert.equal(r.handler, 'answerPadecimientoNoModelado');
  assert.match(r.md, /no modela/);
  assert.match(r.md, /rechazados\.html/);
  const otra = await conversa('hipertension en jalisco');
  assert.doesNotMatch(otra.md, /rechazados\.html/);
});

test('la sección de rechazados no entra al catálogo de publicados', () => {
  const cat = JSON.parse(leer('publication/catalog.json'));
  assert.ok(!cat.releases.some((r) => r.disease_id === 'covid_19'));
  const v = JSON.parse(leer('publication/rechazados/covid_19.json'));
  assert.equal(v.schema, 'rejected_view.v1');
  assert.ok(v.comprobaciones.some((c) => !c.pasa));
  assert.equal(Object.keys(v.series).length, 111);
});

test('el seguimiento conserva F50', async () => {
  const dos = await conversa('bulimia en jalisco', 'y hombres');
  assert.match(dos.md, /Anorexia, bulimia y otros trastornos alimentarios \(F50\) · Jalisco · Hombres/);
});

test('las semanas sin observación no se presentan como futuras', async () => {
  const r = await conversa('diabetes tipo 2 en jalisco');
  assert.doesNotMatch(r.md, /Próximas semanas/);
  assert.match(r.md, /aún sin observación publicada/);
});

