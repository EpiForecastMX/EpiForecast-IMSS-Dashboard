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
const VISTAS = ['obesidad', 'anorexia_f50', 'diabetes_t1', 'diabetes_t2', 'hipertension_i10',
  'isquemica_i20', 'cerebrovascular_i60', 'intestinales_a04', 'ira_j00', 'ivu_n39', 'gingivitis_k05',
  'asma_j45', 'ulceras_k25', 'cancer_mama_c50', 'cancer_cuello_utero_c53', 'cancer_pulmon_c33', 'cancer_estomago_c16', 'cancer_colon_c18', 'linfoma_hodgkin_c81', 'linfoma_no_hodgkin_c82', 'leucemia_c91', 'cancer_pancreas_c26', 'cancer_encefalo_c70', 'cancer_cuerpo_utero_c54', 'cancer_ovario_c56', 'cancer_rinon_c64', 'cancer_prostata_c61', 'cancer_huesos_c40', 'cancer_higado_c22', 'cancer_esofago_c15'];
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
  assert.match(r.md, /treinta y cuatro padecimientos/);
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
  // El estado vigente cambia con cada boletín: con 0/4 no hay métricas; con semanas observadas, sí,
  // pero la validación sigue en curso. El paso semanal no debe romper esta prueba (ensayo 9-nov-2026).
  const semanas = d.diabetes_t2.weeks_available;
  for (const q of ['ranking de diabetes tipo 2', 'calibracion de diabetes tipo 2', 'mapa de diabetes tipo 2 por error']) {
    const r = await conversa(q);
    const limpio = r.md.replace(/<!--.*?-->/g, '');
    if (semanas === 0) {
      assert.match(r.md, /Validación prospectiva en curso\*\* \(0 de 4 semanas\)/, q);
      assert.match(r.md, / o «diabetes tipo 2 por sexo»/, q);
      assert.doesNotMatch(limpio, /sMAPE \d/, q);
    } else if (d.diabetes_t2.verdict === 'INCOMPLETE') {
      assert.match(limpio, new RegExp(`Validación prospectiva en curso.{0,4} \\(${semanas}/4 semanas\\)|en curso\\*\\* \\(${semanas} de 4 semanas\\)`), q);
    }
  }
});

test('con 0/4 las gráficas de error no se dibujan y las demás sí', () => {
  // Copia en 0/4 del release vigente: la prueba no depende de cuántas semanas lleva registradas.
  const v = structuredClone(d.diabetes_t2);
  v.weeks_available = 0;
  for (const s of Object.values(v.series)) {
    s.oos = { semanas: 0, smape: null, mae: null, sesgo_pct: null, observado_total: null, pronostico_total: null };
  }
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
  const a = await conversa('epilepsy in jalisco women');
  assert.match(a.md, /no modela epilepsy/);
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
  const nota = JSON.parse(leer('news.json')).items.find((it) => it.type === 'f50');
  assert.equal(nota.link.href, 'anorexia_f50.html');
  assert.match(nota.summary, /no superó la prueba de 2025/);
  assert.doesNotMatch(JSON.stringify(nota), /sMAPE|MASE/);
});

test('Covid-19 sigue sin modelarse y remite a la evidencia del rechazo', async () => {
  const r = await conversa('covid en jalisco');
  assert.equal(r.handler, 'answerPadecimientoNoModelado');
  assert.match(r.md, /no modela/);
  assert.match(r.md, /rechazados\.html/);
  const otra = await conversa('epilepsia en jalisco');
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

test('los cardiovasculares responden su release y no los subtipos ajenos', async () => {
  const casos = [
    ['hipertension en jalisco mujeres', /Hipertensión arterial \(I10-I15\) · Jalisco · Mujeres/, /HIPERTENSION_I10/],
    ['cardiopatia isquemica en sonora', /Enfermedad isquémica del corazón \(I20, I25\) · Sonora/, /ISQUEMICA_I20/],
    ['derrame cerebral en jalisco', /Enfermedad cerebrovascular \(I60-I67, I69\) · Jalisco/, /CEREBROVASCULAR_I60/],
    ['stroke in jalisco women', /Enfermedad cerebrovascular \(I60-I67, I69\) · Jalisco · Mujeres/, /CEREBROVASCULAR_I60/],
  ];
  for (const [q, texto, marca] of casos) {
    const r = await conversa(q);
    assert.match(r.md, texto, q);
    assert.match(r.md, marca, q);
  }
  for (const q of ['hipertension gestacional en jalisco', 'hipertension pulmonar en sonora', 'preeclampsia en jalisco']) {
    const r = await conversa(q);
    assert.equal(r.handler, 'answerPadecimientoNoModelado', q);
  }
});

test('los tres del radar del boletín 42 responden su release', async () => {
  const casos = [
    ['infecciones intestinales en jalisco mujeres', /Infecciones intestinales por otros organismos y las mal definidas \(A04, A08-A09 excepto A08\.0\) · Jalisco · Mujeres/, /INTESTINALES_A04/],
    ['gastroenteritis en sonora', /Infecciones intestinales por otros organismos y las mal definidas .* · Sonora/, /INTESTINALES_A04/],
    ['infeccion urinaria en jalisco', /Infección de vías urinarias \(N30, N34, N39\.0\) · Jalisco/, /IVU_N39/],
    ['cistitis en nuevo leon hombres', /Infección de vías urinarias .* · Nuevo León · Hombres/, /IVU_N39/],
    ['gastritis en jalisco', /Úlceras, gastritis y duodenitis \(K25-K29\) · Jalisco/, /ULCERAS_K25/],
    ['ulcera peptica en sonora mujeres', /Úlceras, gastritis y duodenitis .* · Sonora · Mujeres/, /ULCERAS_K25/],
  ];
  for (const [q, texto, marca] of casos) {
    const r = await conversa(q);
    assert.match(r.md, texto, q);
    assert.match(r.md, marca, q);
    assert.match(r.md, /Validación prospectiva en curso/, q);
  }
  const dos = await conversa('gastritis en jalisco', 'y hombres');
  assert.match(dos.md, /Úlceras, gastritis y duodenitis .* · Jalisco · Hombres/);
});

test('asma responde su release, en español e inglés, y dice la cronología de la W42', async () => {
  const casos = [
    ['asma en jalisco mujeres', /Asma \(J45, J46\) · Jalisco · Mujeres/],
    ['crisis asmatica en sonora', /Asma \(J45, J46\) · Sonora/],
    ['asthma in jalisco women', /Asma \(J45, J46\) · Jalisco · Mujeres/],
    ['casos de j45 en nuevo leon hombres', /Asma \(J45, J46\) · Nuevo León · Hombres/],
    ['azma en jalisco', /Asma \(J45, J46\) · Jalisco/],
  ];
  for (const [q, texto] of casos) {
    const r = await conversa(q);
    assert.match(r.md, texto, q);
    assert.match(r.md, /ASMA_J45/, q);
    assert.match(r.md, /Validación prospectiva en curso/, q);
    assert.match(r.md, /boletín 43, que trae la semana 2026-W42, se publicó el 9 de noviembre/, q);
    assert.match(r.md, /no cuenta como prospectiva respecto de la información/, q);
    assert.doesNotMatch(r.md, /no modela/, q);
  }
  const dos = await conversa('asma en jalisco', 'y hombres');
  assert.match(dos.md, /Asma \(J45, J46\) · Jalisco · Hombres/);
  // Los vecinos respiratorios siguen sin modelarse, solos o junto al asma, y «fantasma» no es asma.
  for (const q of ['bronquitis en jalisco', 'enfisema en sonora', 'neumonia en jalisco', 'comparar asma con bronquitis']) {
    const r = await conversa(q);
    assert.equal(r.handler, 'answerPadecimientoNoModelado', q);
    assert.doesNotMatch(r.md, MARCADOR_RELEASE, q);
  }
  assert.equal(detectEntities('un fantasma en jalisco').padecimiento ?? null, null);
  assert.equal(mencionaNoModelada(norm('asma en jalisco')), null);
  // Otros releases no cargan la nota de Asma.
  assert.doesNotMatch((await conversa('gastritis en jalisco')).md, /boletín 43/);
});

test('IRA y gingivitis responden su control, nunca como validados', async () => {
  const casos = [
    ['infecciones respiratorias en jalisco', /IRA_J00/], ['iras en jalisco', /IRA_J00/],
    ['casos de ira en sonora', /IRA_J00/], ['gingivitis en sonora', /GINGIVITIS_K05/],
    ['enfermedad periodontal en jalisco', /GINGIVITIS_K05/],
  ];
  for (const [q, marca] of casos) {
    const r = await conversa(q);
    assert.match(r.md, marca, q);
    assert.match(r.md, /control estacional/i, q);
    assert.doesNotMatch(r.md, /Validación prospectiva en curso|no modela/, q);
  }
  const dos = await conversa('iras en jalisco', 'y hombres');
  assert.match(dos.md, /Infecciones respiratorias agudas .* · Jalisco · Hombres/);
});

test('cáncer de mama responde su control; los demás cánceres siguen sin modelarse', async () => {
  for (const q of ['cancer de mama en jalisco', 'tumor maligno de la mama en sonora', 'breast cancer in jalisco']) {
    const r = await conversa(q);
    assert.match(r.md, /CANCER_MAMA_C50/, q);
    assert.match(r.md, /control estacional/i, q);
    assert.doesNotMatch(r.md, /Validación prospectiva en curso|no modela/, q);
  }
  for (const q of ['cancer de vejiga en jalisco', 'cancer en sonora', 'cancer de tiroides en jalisco']) {
    const r = await conversa(q);
    assert.equal(r.handler, 'answerPadecimientoNoModelado', q);
  }
});

test('cuello del útero responde su total y avisa que no hay desglose por sexo', async () => {
  for (const q of ['cancer cervicouterino en jalisco', 'cancer de cuello uterino en sonora']) {
    const r = await conversa(q);
    assert.match(r.md, /CANCER_CUELLO_UTERO_C53/, q);
    assert.match(r.md, /Validación prospectiva en curso/, q);
    assert.doesNotMatch(r.md, /no modela|sin desglose por sexo/, q);
  }
  for (const q of ['cancer cervicouterino en jalisco mujeres', 'cancer cervicouterino por sexo']) {
    const r = await conversa(q);
    assert.match(r.md, /sin desglose por sexo/, q);
    assert.match(r.md, /CANCER_CUELLO_UTERO_C53/, q);
  }
  const dos = await conversa('cancer cervicouterino en jalisco', 'y hombres');
  assert.match(dos.md, /sin desglose por sexo/);
  const motores = await conversa('motores de cancer cervicouterino');
  assert.match(motores.md, /una por estado/);
  assert.doesNotMatch(motores.md, /hombres y mujeres/);
});

test('los cánceres de historia corta responden su release y los rechazados siguen fuera', async () => {
  const casos = [['cancer de pulmon en jalisco', /CANCER_PULMON_C33/], ['leucemia en sonora', /LEUCEMIA_C91/],
    ['linfoma no hodgkin en jalisco', /LINFOMA_NO_HODGKIN_C82/], ['linfoma de hodgkin en jalisco', /LINFOMA_HODGKIN_C81/],
    ['cancer de ovario en jalisco', /CANCER_OVARIO_C56/], ['cancer de endometrio en sonora', /CANCER_CUERPO_UTERO_C54/],
    ['cancer cerebral en jalisco', /CANCER_ENCEFALO_C70/], ['cancer colorrectal en jalisco', /CANCER_COLON_C18/]];
  for (const [q, marca] of casos) {
    const r = await conversa(q);
    assert.match(r.md, marca, q);
    assert.match(r.md, /Validación prospectiva en curso/, q);
    assert.doesNotMatch(r.md, /no modela/, q);
  }
  for (const q of ['cancer de prostata en jalisco', 'cancer de higado en jalisco', 'cancer de rinon en sonora',
    'cancer de esofago en jalisco', 'cancer de hueso en jalisco']) {
    const r = await conversa(q);
    assert.match(r.md, /control estacional/i, q);
    assert.doesNotMatch(r.md, /Validación prospectiva en curso|no modela/, q);
  }
  for (const q of ['cancer de vejiga en jalisco', 'cancer de tiroides en jalisco']) {
    assert.equal((await conversa(q)).handler, 'answerPadecimientoNoModelado', q);
  }
  const motores = await conversa('motores de leucemia');
  assert.match(motores.md, /pliegue de 2025/);
  assert.doesNotMatch(motores.md, /2021 a 2024/);
});

test('el aviso de control dice el año y el ámbito reales del rechazo', async () => {
  const casos = [
    ['cancer de rinon en jalisco', /prueba de 2026/, /series por estado y sexo/],
    ['cancer de prostata en jalisco', /prueba de 2026/, /total nacional/],
    ['cancer de esofago en jalisco', /prueba de 2026/, /conjunto de las series publicadas/],
    ['enfermedad isquemica en jalisco', /prueba de 2025/, /series por estado y sexo/],
  ];
  for (const [q, anio, ambito] of casos) {
    const r = await conversa(q);
    assert.match(r.md, anio, q);
    assert.match(r.md, ambito, q);
  }
  assert.doesNotMatch((await conversa('cancer de rinon en jalisco')).md, /2025/);
});

test('el corpus no atribuye sexo ni pliegues de 2021 a 2024 a quien no los tiene', async () => {
  const { buildChunks } = await import('../scripts/lib/corpus.mjs');
  const res = await buildChunks({});
  const ch = Array.isArray(res) ? res : (res.chunks || Object.values(res).find(Array.isArray));
  const texto = (id, k) => ch.find((x) => x.id.startsWith(`release:${id}:`) && x.id.endsWith(`:${k}`)).text;
  for (const id of ['cancer_prostata_c61', 'cancer_ovario_c56', 'cancer_cuerpo_utero_c54', 'cancer_cuello_utero_c53']) {
    assert.match(texto(id, 'nacional'), /el boletín no desglosa sexo/, id);
    assert.doesNotMatch(texto(id, 'nacional'), /uno por estado y sexo/, id);
  }
  assert.match(texto('cancer_pulmon_c33', 'motores'), /pliegue de 2025/);
  assert.doesNotMatch(texto('cancer_pulmon_c33', 'motores'), /2021 a 2024/);
  assert.match(texto('cancer_rinon_c64', 'nacional'), /prueba de 2026/);
  assert.match(texto('obesidad', 'motores'), /pliegues de 2021 a 2024/);
});

test('rotavirus sigue sin modelarse', async () => {
  for (const q of ['gastroenteritis por rotavirus en jalisco', 'rotavirus en jalisco']) {
    const r = await conversa(q);
    assert.equal(r.handler, 'answerPadecimientoNoModelado', q);
    assert.match(r.md, /no modela/, q);
  }
});

test('palabras que empiezan como un alias no disparan un release', async () => {
  for (const q of ['casos de depresion en irapuato', 'utilidad del modelo de depresion en jalisco']) {
    const r = await conversa(q);
    assert.doesNotMatch(r.md, /INTESTINALES_A04|IVU_N39|ULCERAS_K25|IRA_J00|GINGIVITIS_K05|no modela/, q);
  }
});

test('isquémica y cerebrovascular se declaran como control', async () => {
  for (const q of ['pronostico de enfermedad isquemica', 'enfermedad cerebrovascular nacional']) {
    const r = await conversa(q);
    assert.match(r.md, /control estacional/i, q);
    assert.doesNotMatch(r.md, /Validación prospectiva en curso/, q);
  }
  const h = await conversa('pronostico de hipertension');
  assert.match(h.md, /Validación prospectiva en curso/);
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

