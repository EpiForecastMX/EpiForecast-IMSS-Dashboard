/**
 * generate_tests.js — Genera y ejecuta ~400 preguntas de test para el KB.
 *
 * Cada pregunta tiene:
 *   - query: la pregunta en espanol
 *   - expectedHandler: el handler que deberia responder
 *       null  = debe retornar null (Gemini fallback / off-topic)
 *       '*'   = cualquier respuesta es valida (test de entidades solamente)
 *       'xxx' = handler especifico esperado
 *   - mustContain: strings que DEBEN aparecer en la respuesta (case-insensitive)
 *   - mustNotContain: strings que NO deben aparecer
 *   - checkEntities: entidades esperadas en la deteccion
 *
 * Uso: node tests/generate_tests.js
 */

import { readFileSync } from 'fs';
import { norm, detectEntities } from '../js/entities.js';

// Load knowledge.json directly (no fetch in Node)
const DATA = JSON.parse(readFileSync(new URL('../knowledge.json', import.meta.url), 'utf-8'));

// ─────────────────────────────────────────────────────────────────────────────
// Test case definitions
// ─────────────────────────────────────────────────────────────────────────────

const PADS = ['Depresion', 'Parkinson', 'Alzheimer'];
const ESTADOS_32 = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'Chiapas', 'Chihuahua', 'Ciudad de Mexico', 'Coahuila', 'Colima',
  'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Mexico',
  'Michoacan', 'Morelos', 'Nayarit', 'Nuevo Leon', 'Oaxaca', 'Puebla',
  'Queretaro', 'Quintana Roo', 'San Luis Potosi', 'Sinaloa', 'Sonora',
  'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatan', 'Zacatecas',
];
const SEXOS = ['hombres', 'mujeres', 'general'];
const MOTORES = ['Prophet', 'DeepAR', 'Ensemble', 'Stacking'];
const YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const ALIASES_ESTADO = {
  'cdmx': 'Ciudad de Mexico',
  'edomex': 'Mexico',
  'nuevo leon': 'Nuevo Leon',
  'san luis potosi': 'San Luis Potosi',
  'baja california sur': 'Baja California Sur',
  'quintana roo': 'Quintana Roo',
};

const tests = [];
let id = 0;

function add(query, expectedHandler, mustContain = [], mustNotContain = [], checkEntities = {}) {
  tests.push({
    id: ++id,
    query,
    expectedHandler,
    mustContain: Array.isArray(mustContain) ? mustContain : [mustContain],
    mustNotContain: Array.isArray(mustNotContain) ? mustNotContain : [mustNotContain],
    checkEntities,
  });
}

// =====================================================================
// SECCION 1: SALUDOS (10 tests)
// =====================================================================

add('hola', 'answerSaludo', ['EpiForecast-MX', 'modelos']);
add('buenos dias', 'answerSaludo', ['EpiForecast-MX']);
add('hey que tal', 'answerSaludo', ['EpiForecast-MX']);
add('hola que puedes hacer', 'answerSaludo', ['EpiForecast-MX']);
add('buenas tardes', 'answerSaludo', ['EpiForecast-MX']);
add('saludos', 'answerSaludo', ['EpiForecast-MX']);
add('hola buenos dias', 'answerSaludo', ['EpiForecast-MX']);
add('que onda', 'answerSaludo', ['EpiForecast-MX']);
add('buenas noches', 'answerSaludo', ['EpiForecast-MX']);
add('hola como estas', 'answerSaludo', ['EpiForecast-MX']);

// =====================================================================
// SECCION 2a: PREGUNTA PERSONAL (6 tests)
// =====================================================================

add('a ti te puede dar parkinson', 'answerPreguntaPersonal', ['inteligencia artificial', 'Parkinson']);
add('puedes enfermarte de depresion', 'answerPreguntaPersonal', ['inteligencia artificial', 'F32']);
add('eres humano', 'answerPreguntaPersonal', ['inteligencia artificial']);
add('tienes sentimientos', 'answerPreguntaPersonal', ['inteligencia artificial']);
add('te puede dar alzheimer', 'answerPreguntaPersonal', ['inteligencia artificial', 'Alzheimer']);
add('las maquinas se enferman', 'answerPreguntaPersonal', ['inteligencia artificial']);

// =====================================================================
// SECCION 2b: EQUIPO (20 tests)
// =====================================================================

add('quienes son el equipo', 'answerEquipo', ['Equipo']);
add('quien es javier rebull', 'answerEquipo', ['Javier', 'Rebull']);
add('quien es jar', 'answerEquipo', ['Javier']);
add('quien es juan carlos', 'answerEquipo', ['Juan Carlos']);
add('quien es jarcos', 'answerEquipo', ['Juan Carlos']);
add('quien es jerry', 'answerEquipo', ['Luis Gerardo']);
add('quien es luis gerardo', 'answerEquipo', ['Luis Gerardo']);
add('que hace javier', 'answerEquipo', ['Javier']);
add('donde trabaja jar', 'answerEquipo', ['Santander']);
add('quien desarrollo el proyecto', 'answerEquipo', ['Equipo']);
add('cuantos commits tiene javier', 'answerConteo', ['333']);
add('quien es la dra ruth', 'answerEquipo', ['Ruth']);
add('quien es la dra grettel', 'answerEquipo', ['Grettel']);
add('quien es la dra lina', 'answerEquipo', ['Lina']);
add('quien es el dr falcon', 'answerEquipo', ['Falc']);
add('quien dirige el proyecto', 'answerEquipo', ['Equipo']);
add('integrantes del equipo', 'answerEquipo', ['Equipo']);
add('quien es perez nava', 'answerEquipo', ['Juan Carlos']);
add('dime sobre el equipo de trabajo', 'answerEquipo', ['Equipo']);
add('quien es falcon morales', 'answerEquipo', ['Falc']);

// =====================================================================
// SECCION 3: TEMPORAL (10 tests)
// =====================================================================

add('que dia es hoy', 'answerTemporal', ['2026']);
add('que fecha es', 'answerTemporal', ['2026']);
add('en que semana epidemiologica estamos', 'answerTemporal', ['semana']);
add('que semana estamos', 'answerTemporal', ['semana']);
add('hasta cuando llegan los datos', 'answerTemporal', ['semana']);
add('cual es la cobertura temporal', 'answerTemporal', ['2014']);
add('hasta que fecha tienen datos', 'answerTemporal', ['semana']);
add('desde cuando hay datos', 'answerTemporal', ['2014']);
add('cual es el periodo de datos', 'answerTemporal', ['2014']);
add('que semana es hoy', 'answerTemporal', ['semana']);

// =====================================================================
// SECCION 4: QUE ES PADECIMIENTO (15 tests)
// =====================================================================

add('que es la depresion', 'answerQueEsPadecimiento', ['F32'], {}, {padecimiento: 'Depresion'});
add('que es el parkinson', 'answerQueEsPadecimiento', ['G20'], {}, {padecimiento: 'Parkinson'});
add('que es el alzheimer', 'answerQueEsPadecimiento', ['G30'], {}, {padecimiento: 'Alzheimer'});
add('dime sobre la depresion', 'answerQueEsPadecimiento', ['F32'], {}, {padecimiento: 'Depresion'});
add('informacion sobre parkinson', 'answerQueEsPadecimiento', ['G20'], {}, {padecimiento: 'Parkinson'});
add('que es f32', 'answerQueEsPadecimiento', ['F32'], {}, {padecimiento: 'Depresion'});
add('que es g20', 'answerQueEsPadecimiento', ['G20'], {}, {padecimiento: 'Parkinson'});
add('que es g30', 'answerQueEsPadecimiento', ['G30'], {}, {padecimiento: 'Alzheimer'});
add('explica que es alzheimer', 'answerQueEsPadecimiento', ['G30'], {}, {padecimiento: 'Alzheimer'});
add('cuales son los efectos de la depresion', 'answerQueEsPadecimiento', ['F32'], {}, {padecimiento: 'Depresion'});
add('sintomas del parkinson', 'answerQueEsPadecimiento', ['Parkinson'], {}, {padecimiento: 'Parkinson'});
add('como afecta el alzheimer', 'answerQueEsPadecimiento', ['Alzheimer'], {}, {padecimiento: 'Alzheimer'});
add('que causa la depresion', 'answerQueEsPadecimiento', ['F32'], {}, {padecimiento: 'Depresion'});
add('cuales son los efectos del parkinson', 'answerQueEsPadecimiento', ['Parkinson'], {}, {padecimiento: 'Parkinson'});
add('describe el alzheimer', 'answerQueEsPadecimiento', ['G30'], {}, {padecimiento: 'Alzheimer'});

// =====================================================================
// SECCION 5: ENTIDADES — deteccion de estados (30 tests, entity-only)
// =====================================================================

for (const [alias, canon] of Object.entries(ALIASES_ESTADO)) {
  add(`cuantos casos hay en ${alias}`, '*', [], [], {estado: canon});
}

// 32 estados basicos
const sampleEstados = ['Jalisco', 'Chihuahua', 'Oaxaca', 'Sonora', 'Tabasco', 'Puebla',
  'Veracruz', 'Guerrero', 'Durango', 'Yucatan', 'Colima', 'Morelos',
  'Tamaulipas', 'Coahuila', 'Nayarit', 'Hidalgo', 'Sinaloa', 'Guanajuato',
  'Tlaxcala', 'Michoacan', 'Campeche', 'Aguascalientes', 'Queretaro', 'Zacatecas'];
for (const est of sampleEstados) {
  add(`como esta ${est.toLowerCase()}`, '*', [], [], {estado: est});
}

// =====================================================================
// SECCION 6: BOLETIN HISTORICO — padecimiento + anio (40 tests)
// =====================================================================

for (const pad of PADS) {
  for (const y of [2015, 2018, 2020, 2023, 2025]) {
    add(`cuantos casos de ${pad.toLowerCase()} hubo en ${y}`, 'answerBoletin',
      [String(y)], [], {padecimiento: pad, _years: [y]});
  }
}

// Rangos
add('dame los casos entre 2014 y 2019 de depresion', 'answerBoletin',
  ['2014', '2015', '2016', '2017', '2018', '2019'], [],
  {padecimiento: 'Depresion', _years: [2014,2015,2016,2017,2018,2019]});

add('casos de parkinson de 2020 a 2024', 'answerBoletin',
  ['2020', '2021', '2022', '2023', '2024'], [],
  {padecimiento: 'Parkinson', _years: [2020,2021,2022,2023,2024]});

add('alzheimer del 2016 al 2020', 'answerBoletin',
  ['2016', '2017', '2018', '2019', '2020'], [],
  {padecimiento: 'Alzheimer', _years: [2016,2017,2018,2019,2020]});

// Ultimos N anos
add('dame los ultimos 5 anos de depresion', 'answerBoletin',
  ['2022', '2023', '2024', '2025'], [],
  {padecimiento: 'Depresion', _lastNYears: 5});

add('tendencia de parkinson ultimos 3 anos', 'answerBoletin',
  ['2023', '2024', '2025'], [],
  {padecimiento: 'Parkinson', _lastNYears: 3});

// Ano parcial
add('cuantos casos de depresion en 2026', 'answerBoletin',
  ['parcial'], [],
  {padecimiento: 'Depresion', _years: [2026]});

add('casos de parkinson en 2026', 'answerBoletin',
  ['parcial'], [],
  {padecimiento: 'Parkinson', _years: [2026]});

// =====================================================================
// SECCION 7: TENDENCIA HISTORICA (15 tests)
// =====================================================================

add('como ha sido la tendencia de depresion', 'answerBoletin', ['Pico']);
add('evolucion historica del parkinson', 'answerBoletin', ['Pico']);
add('historico de alzheimer', 'answerBoletin', ['Pico']);
add('cuantos casos de depresion ha habido', 'answerBoletin', ['2014']);
add('la depresion ha crecido o disminuido', 'answerPronostico', ['Depresion']);
add('tendencia de depresion en los ultimos 10 anos', 'answerBoletin', ['2025']);
add('que padecimiento tiene mas incidencia historica', 'answerProyectoMeta', ['Depresi']);
add('ranking de entidades por incidencia', 'answerBoletin', ['Entidad']);
add('que estado tiene mas casos', 'answerBoletin', ['#']);
add('cual entidad tiene menor incidencia', 'answerBoletin', ['menor']);
add('donde hay mas depresion', 'answerBoletin', ['#']);
add('top estados por casos', 'answerBoletin', ['Entidad']);
add('que estado tiene mas parkinson', 'answerBoletin', ['#']);
add('estados con mayor incidencia de alzheimer', 'answerBoletin', ['#']);
add('estados con menos casos', 'answerBoletin', ['menor']);
add('datos historicos', 'answerBoletin', ['Boletin', 'Periodo']);
add('dame datos historicos del proyecto', 'answerBoletin', ['Boletin', 'Periodo']);

// =====================================================================
// SECCION 7b: COMPARACION SEMANAL Real vs Pronostico (8 tests)
// =====================================================================

add('como va el modelo de depresion en 2026', 'answerComparacionSemanal', ['Real', 'Pronostico', 'Depresion']);
add('real vs pronostico depresion', 'answerComparacionSemanal', ['Acumulado', 'SMAPE']);
add('cuantos casos van en 2026 de depresion', 'answerComparacionSemanal', ['Real', 'Pronostico']);
add('comparacion semanal', 'answerComparacionSemanal', ['Sem 1', 'Sem 7']);
add('como se comporta el modelo de parkinson', 'answerComparacionSemanal', ['Parkinson', 'Real']);
add('compara real vs pronostico', 'answerComparacionSemanal', ['Acumulado']);
add('acierto semanal de depresion', 'answerComparacionSemanal', ['Depresion', 'SMAPE']);
add('cuantos llevamos de alzheimer en 2026', 'answerComparacionSemanal', ['Alzheimer', 'Real']);

// =====================================================================
// SECCION 8: PRONOSTICO (12 tests)
// =====================================================================

add('cual es el pronostico total', 'answerPronostico', ['52 semanas']);
add('cuantos casos se pronostican', 'answerConteo', ['333']);
add('pronostico de depresion', 'answerPronostico', ['Depresion', 'casos']);
add('cuantos casos de parkinson se esperan', 'answerPronostico', ['Parkinson', 'casos']);
add('forecast de alzheimer', 'answerPronostico', ['Alzheimer', 'casos']);
add('prediccion total de casos', 'answerPronostico', ['52 semanas']);
add('cuantos casos habra de depresion', 'answerPronostico', ['Depresion']);
add('se estiman cuantos casos de parkinson', 'answerPronostico', ['Parkinson']);
add('pronostico de depresion pronosticados', 'answerPronostico', ['Depresion']);
add('dime los casos pronosticados de alzheimer', 'answerPronostico', ['Alzheimer']);
add('casos de depresion pronosticados para 2026', 'answerPronostico', ['Depresion']);
add('prediccion de parkinson 2026', 'answerPronostico', ['Parkinson']);

// =====================================================================
// SECCION 9: SPECIFIC SERIES — pad + estado (30 tests)
// =====================================================================

// Pronostico con padecimiento + estado → answerSpecificSeries
for (const pad of PADS) {
  for (const est of ['Jalisco', 'Ciudad de Mexico', 'Puebla', 'Sonora']) {
    add(`pronostico de ${pad.toLowerCase()} en ${est.toLowerCase()}`,
      'answerSpecificSeries', [pad, est]);
  }
}

add('como esta la depresion en jalisco', 'answerSpecificSeries', ['Depresion', 'Jalisco']);
add('parkinson en cdmx', 'answerSpecificSeries', ['Parkinson', 'Ciudad de Mexico']);
add('alzheimer en nuevo leon', 'answerSpecificSeries', ['Alzheimer', 'Nuevo Leon']);
add('depresion en edomex', 'answerSpecificSeries', ['Depresion', 'Mexico']);
add('como esta el parkinson en sonora', 'answerSpecificSeries', ['Parkinson', 'Sonora']);
add('alzheimer en baja california sur', 'answerSpecificSeries', ['Alzheimer', 'Baja California Sur']);
add('depresion en quintana roo', 'answerSpecificSeries', ['Depresion', 'Quintana Roo']);
add('parkinson en chihuahua', 'answerSpecificSeries', ['Parkinson', 'Chihuahua']);
add('depresion en oaxaca general', 'answerSpecificSeries', ['Depresion', 'Oaxaca']);
add('alzheimer en tabasco hombres', 'answerSpecificSeries', ['Alzheimer', 'Tabasco']);

// Con meses
add('depresion en jalisco en enero', 'answerSpecificSeries', ['Jalisco']);
add('parkinson en puebla en marzo', 'answerSpecificSeries', ['Puebla']);

// Con sexo explicito
add('depresion en veracruz mujeres', 'answerSpecificSeries', ['Veracruz']);
add('parkinson en chiapas hombres', 'answerSpecificSeries', ['Chiapas']);
add('alzheimer en guerrero general', 'answerSpecificSeries', ['Guerrero']);
add('depresion en yucatan para mujeres', 'answerSpecificSeries', ['Yucatan']);
add('parkinson en coahuila masculino', 'answerSpecificSeries', ['Coahuila']);
add('depresion en durango femenino', 'answerSpecificSeries', ['Durango']);

// =====================================================================
// SECCION 10: ESTADO sin padecimiento (15 tests)
// =====================================================================

add('como esta jalisco', 'answerEstado', ['Jalisco']);
add('resumen de cdmx', 'answerEstado', ['Ciudad de Mexico']);
add('que pasa en nuevo leon', 'answerEstado', ['Nuevo Leon']);
add('dame datos de sonora', 'answerEstado', ['Sonora']);
add('informacion de chihuahua', 'answerEstado', ['Chihuahua']);
add('datos de puebla', 'answerEstado', ['Puebla']);
add('resumen de oaxaca', 'answerEstado', ['Oaxaca']);
add('que hay de veracruz', 'answerEstado', ['Veracruz']);
add('como esta tabasco', 'answerEstado', ['Tabasco']);
add('estadisticas de guerrero', 'answerEstado', ['Guerrero']);
add('que modelos hay en jalisco', 'answerEstado', ['Jalisco']);
add('resumen de baja california', 'answerEstado', ['Baja California']);
add('modelos de morelos', 'answerEstado', ['Morelos']);
add('como va sinaloa', 'answerEstado', ['Sinaloa']);
add('informacion de yucatan', 'answerEstado', ['Yucatan']);

// =====================================================================
// SECCION 11: PADECIMIENTO sin estado (15 tests)
// =====================================================================

add('resumen de depresion', 'answerPadecimiento', ['Depresion']);
add('que hay de parkinson', 'answerPadecimiento', ['Parkinson']);
add('datos de alzheimer', 'answerPadecimiento', ['Alzheimer']);
add('depresion general', 'answerPadecimiento', ['Depresion']);
add('como va el parkinson en general', 'answerPadecimiento', ['Parkinson']);
add('estadisticas de alzheimer', 'answerPadecimiento', ['Alzheimer']);
add('modelo ganador de depresion', 'answerPadecimiento', ['Depresion']);
add('rendimiento de los modelos de parkinson', 'answerPadecimiento', ['Parkinson']);
add('que modelo gana en depresion', 'answerPadecimiento', ['Depresion']);
add('quien ganara en depresion este ano', 'answerPadecimiento', ['Depresion']);
add('ranking de depresion', 'answerPadecimiento', ['Depresion']);
add('que estados tienen mas parkinson', 'answerPadecimiento', ['Parkinson']);
add('donde hay mas alzheimer', 'answerPadecimiento', ['Alzheimer']);
add('distribucion de motores de depresion', 'answerPadecimiento', ['Depresion']);
add('cuantos modelos tiene parkinson', 'answerPadecimiento', ['Parkinson']);

// =====================================================================
// SECCION 12: COMPARATIVAS (20 tests)
// =====================================================================

add('compara depresion en jalisco vs cdmx', 'answerComparativaEstados', ['Jalisco', 'Ciudad de Mexico']);
add('compara parkinson puebla vs oaxaca', 'answerComparativaEstados', ['Puebla', 'Oaxaca']);
add('compara alzheimer sonora vs chihuahua', 'answerComparativaEstados', ['Sonora', 'Chihuahua']);
add('comparativa jalisco y nuevo leon', 'answerComparativaEstados', ['Jalisco', 'Nuevo Leon']);
add('cdmx vs edomex depresion', 'answerComparativaEstados', ['Ciudad de Mexico', 'Mexico']);
add('compara depresion puebla vs cdmx vs tlaxcala', 'answerComparativaEstados', ['Puebla', 'Ciudad de Mexico', 'Tlaxcala']);
add('jalisco vs sonora vs chihuahua', 'answerComparativaEstados', ['Jalisco', 'Sonora', 'Chihuahua']);
add('compara oaxaca contra guerrero', 'answerComparativaEstados', ['Oaxaca', 'Guerrero']);
add('diferencia entre tabasco y campeche', 'answerComparativaEstados', ['Tabasco', 'Campeche']);
add('contrasta veracruz vs puebla', 'answerComparativaEstados', ['Veracruz', 'Puebla']);
add('comparar yucatan y quintana roo', 'answerComparativaEstados', ['Yucatan', 'Quintana Roo']);
add('compara coahuila vs tamaulipas', 'answerComparativaEstados', ['Coahuila', 'Tamaulipas']);
add('sinaloa versus durango', 'answerComparativaEstados', ['Sinaloa', 'Durango']);
add('depresion cdmx versus jalisco versus nuevo leon', 'answerComparativaEstados', ['Ciudad de Mexico', 'Jalisco', 'Nuevo Leon']);
add('parkinson colima vs nayarit', 'answerComparativaEstados', ['Colima', 'Nayarit']);
add('compara alzheimer hidalgo vs tlaxcala', 'answerComparativaEstados', ['Hidalgo', 'Tlaxcala']);
add('depresion en baja california y baja california sur', 'answerComparativaEstados', ['Baja California']);
add('parkinson michoacan vs guanajuato', 'answerComparativaEstados', ['Michoacan', 'Guanajuato']);
add('alzheimer aguascalientes vs queretaro vs zacatecas', 'answerComparativaEstados', ['Aguascalientes', 'Queretaro', 'Zacatecas']);
add('compara morelos y san luis potosi', 'answerComparativaEstados', ['Morelos', 'San Luis Potosi']);

// =====================================================================
// SECCION 13: MOTORES (15 tests)
// =====================================================================

add('que es prophet', null, []);
add('que es deepar', null, []);
add('como funciona el ensemble', 'answerMotor', ['Ensemble']);
add('que es stacking', null, []);
add('comparacion de motores', 'answerMotor', ['Prophet', 'DeepAR']);
add('que motor tiene mejor smape', 'answerMotor', ['SMAPE']);
add('distribucion de motores ganadores', 'answerMotor', ['DeepAR']);
add('cuantas series tiene deepar', 'answerMotor', ['DeepAR']);
add('rendimiento de prophet', 'answerMotor', ['Prophet']);
add('que modelo es mejor', 'answerMotor', ['DeepAR']);
add('rendimiento de cada motor', 'answerMetricaGlobal', ['SMAPE']);
add('cual motor gana mas', 'answerMotor', ['DeepAR']);
add('informacion del deep ar', 'answerMotor', ['DeepAR']);
add('como se comparan los motores', 'answerMotor', ['Prophet', 'DeepAR']);
add('xgboost como funciona', 'answerMotor', ['Ensemble']);

// =====================================================================
// SECCION 14: METRICAS GLOBALES (10 tests)
// =====================================================================

add('cuales son las metricas globales', 'answerMetricaGlobal', ['SMAPE']);
add('smape promedio del proyecto', 'answerMetricaGlobal', ['SMAPE']);
add('que tan preciso es el modelo', 'answerValidacion', ['precisi']);
add('rendimiento general de los modelos', 'answerMetricaGlobal', ['SMAPE']);
add('metricas de rendimiento', 'answerMetricaGlobal', ['SMAPE']);
add('dame las metricas', 'answerMetricaGlobal', ['SMAPE']);
add('que rmse tienen los modelos', 'answerMetricaGlobal', ['RMSE']);
add('cual es el mase promedio', 'answerMetricaGlobal', ['MASE']);
add('precision de los modelos', '*', []);
add('que tan buenos son los modelos', null, []);

// =====================================================================
// SECCION 15: DIAGNOSTICOS (10 tests)
// =====================================================================

add('hay overfitting', 'answerDiagnosticos', ['overfitting']);
add('diagnosticos de los modelos', 'answerDiagnosticos', ['overfitting']);
add('hay leakage en los modelos', '*', []);
add('cuantos modelos tienen overfitting alto', 'answerDiagnosticos', ['overfitting']);
add('calidad de los modelos', null, []);
add('cuantos modelos son fallback', 'answerDiagnosticos', ['fallback']);
add('diagnostico general', 'answerDiagnosticos', ['overfitting']);
add('hay modelos con fuga de datos', null, []);
add('modelos con problemas', 'answerDiagnosticos', ['overfitting']);
add('analisis de overfitting', 'answerDiagnosticos', ['overfitting']);

// =====================================================================
// SECCION 16: DEFINICIONES (10 tests)
// =====================================================================

add('que significa smape', 'answerDefinicion', ['SMAPE']);
add('que es mase', 'answerDefinicion', ['MASE']);
add('que es rmse', 'answerDefinicion', ['RMSE']);
add('que es mae', 'answerDefinicion', ['MAE']);
add('que es cross validation', 'answerTrainingConfig', ['2025']);
add('que significa overfitting', 'answerDefinicion', ['overfitting']);
add('que es leakage', 'answerDefinicion', ['leakage']);
add('que es cie 10', 'answerDefinicion', ['CIE']);
add('que es fallback regional', 'answerDefinicion', ['fallback']);
add('que es el horizonte de pronostico', 'answerDefinicion', ['52']);

// =====================================================================
// SECCION 17: TRAINING CONFIG (10 tests)
// =====================================================================

add('como se entreno el modelo', 'answerTrainingConfig', ['entrenamiento']);
add('hiperparametros del modelo', 'answerTrainingConfig', ['entrenamiento']);
add('parametros de entrenamiento', 'answerTrainingConfig', ['entrenamiento']);
add('configuracion de deepar', 'answerTrainingConfig', ['DeepAR']);
add('configuracion de prophet', 'answerTrainingConfig', ['Prophet']);
add('cuantos folds de cross validation', 'answerTrainingConfig', ['folds']);
add('fecha de corte de entrenamiento', 'answerTrainingConfig', ['2025']);
add('horizonte de pronostico', 'answerTrainingConfig', ['52']);
add('con cuantos datos se entreno', 'answerConteo', ['333']);
add('como se configuro el stacking', 'answerTrainingConfig', ['Stacking']);

// =====================================================================
// SECCION 18: INFRAESTRUCTURA (10 tests)
// =====================================================================

add('cuantos tests tiene el proyecto', 'answerInfra', ['test']);
add('cobertura de codigo', 'answerInfra', ['92']);
add('infraestructura del proyecto', 'answerInfra', ['test']);
add('usan sagemaker', 'answerInfra', ['SageMaker']);
add('usan aws', 'answerInfra', ['S3']);
add('ci cd del proyecto', 'answerInfra', ['GitHub Actions']);
add('cuantas lineas de codigo', 'answerInfra', ['13']);
add('pipeline de mlops', 'answerInfra', ['test']);
add('cuantos archivos de test', 'answerConteo', ['333']);
add('donde se guardan los datos', null, []);

// =====================================================================
// SECCION 19: PROYECTO META (10 tests)
// =====================================================================

add('de que trata el proyecto', null, []);
add('que padecimientos se modelan', 'answerProyectoMeta', ['Depresi']);
add('cuantas series tiene el proyecto', 'answerProyectoMeta', ['333']);
add('que es epiforecast', '*', []);
add('cuantos modelos de produccion hay', 'answerProyectoMeta', ['333']);
add('que geografias se cubren', '*', []);
add('fuente de datos del proyecto', 'answerProyectoMeta', ['SINAVE']);
add('que datos utiliza el proyecto', '*', []);
add('alcance del proyecto', 'answerProyectoMeta', ['333']);
add('como se selecciona el modelo de produccion', '*', []);

// =====================================================================
// SECCION 20: RANKING (10 tests)
// =====================================================================

add('ranking de mejores modelos', 'answerRanking', ['SMAPE']);
add('cuales son los peores modelos', 'answerRanking', ['SMAPE']);
add('top 5 mejores modelos', 'answerRanking', ['SMAPE']);
add('top 5 peores modelos', 'answerRanking', ['SMAPE']);
add('modelos con mejor smape', 'answerRanking', ['SMAPE']);
add('modelos con peor rendimiento', 'answerRanking', ['SMAPE']);
add('que modelos son los mejores', 'answerRanking', ['SMAPE']);
add('mejores y peores modelos', 'answerRanking', ['SMAPE']);
add('modelos mas precisos', 'answerRanking', ['SMAPE']);
add('modelos menos precisos', '*', []);

// =====================================================================
// SECCION 21: VALIDACION (5 tests)
// =====================================================================

add('validacion semanal', 'answerValidacion', ['validaci']);
add('como se validan los modelos', null, []);
add('precision de la ultima semana', '*', ['semana']);
add('validacion del pronostico vs real', 'answerComparacionSemanal', ['Real', 'Pronostico']);
add('diferencia pronostico vs realidad', '*', ['caso']);

// =====================================================================
// SECCION 22: SEXO (10 tests)
// =====================================================================

add('composicion por sexo', 'answerSexo', ['hombres', 'mujeres']);
add('diferencia entre hombres y mujeres', 'answerSexo', ['hombres', 'mujeres']);
add('distribucion por genero', 'answerSexo', ['hombres', 'mujeres']);
add('cuantos casos en hombres', 'answerSexo', ['hombres']);
add('casos en mujeres', 'answerSexo', ['mujeres']);
add('proporcion hombres mujeres depresion', 'answerSexo', ['hombres', 'mujeres']);
add('desglose por sexo', 'answerSexo', ['hombres', 'mujeres']);
add('hay diferencia de genero en parkinson', 'answerSexo', ['hombres', 'mujeres']);
add('brecha de genero en depresion', 'answerSexo', ['hombres', 'mujeres']);
add('cual sexo tiene mas incidencia', '*', []);

// =====================================================================
// SECCION 23: SEMANA ACTUAL (5 tests)
// =====================================================================

add('datos de la ultima semana', 'answerSemanaActual', ['semana']);
add('ultimo reporte del boletin', 'answerSemanaActual', ['semana']);
add('ultimo dato disponible', 'answerSemanaActual', ['semana']);
add('que reporto la ultima semana', 'answerSemanaActual', ['semana']);
add('datos mas recientes', 'answerSemanaActual', ['semana']);

// =====================================================================
// SECCION 24: VARIABLE EXOGENA — edad (15 tests)
// =====================================================================

add('depresion en mujeres de 30 anos', '*', ['Variable no disponible', 'sexo', 'entidad'], [],
  {padecimiento: 'Depresion', sexo: 'mujeres', _ageFilter: '30'});
add('parkinson en hombres de 50 anos', '*', ['Variable no disponible', 'sexo', 'entidad'], [],
  {padecimiento: 'Parkinson', sexo: 'hombres', _ageFilter: '50'});
add('alzheimer en personas de 70 anos', '*', ['Variable no disponible'], [],
  {padecimiento: 'Alzheimer', _ageFilter: '70'});
add('casos de depresion entre 40 y 45 anos', '*', ['Variable no disponible'], [],
  {padecimiento: 'Depresion', _ageFilter: '40-45'});
add('depresion en mayores de 60 anos', '*', ['Variable no disponible'], [],
  {padecimiento: 'Depresion', _ageFilter: 'mayores de 60'});
add('parkinson en adultos de 65 anos', '*', ['Variable no disponible'], [],
  {padecimiento: 'Parkinson', _ageFilter: '65'});
add('alzheimer en pacientes de 80 anos', '*', ['Variable no disponible'], [],
  {padecimiento: 'Alzheimer', _ageFilter: '80'});
add('casos de depresion en jovenes de 20 anos', '*', ['Variable no disponible'], [],
  {padecimiento: 'Depresion', _ageFilter: '20'});
add('depresion en menores de 18 anos', '*', ['Variable no disponible'], [],
  {padecimiento: 'Depresion', _ageFilter: 'menores de 18'});
add('parkinson en mujeres de 55 anos', '*', [], [],
  {padecimiento: 'Parkinson', sexo: 'mujeres', _ageFilter: '55'});
// Con ultimos N anos + edad
add('depresion ultimos 10 anos entre 40 y 45 anos', '*', ['Variable no disponible'], [],
  {padecimiento: 'Depresion', _ageFilter: '40-45', _lastNYears: 10});
add('hombres de 60 anos con alzheimer', '*', [], [],
  {padecimiento: 'Alzheimer', sexo: 'hombres', _ageFilter: '60'});
add('casos de depresion de personas de 25 anos de edad', '*', ['Variable no disponible'], [],
  {padecimiento: 'Depresion', _ageFilter: '25'});
add('parkinson en personas de 40 a 60 anos', '*', [], [],
  {padecimiento: 'Parkinson', _ageFilter: '40-60'});
add('depresion en ninos de 10 anos', '*', [], [],
  {padecimiento: 'Depresion', _ageFilter: '10'});

// =====================================================================
// SECCION 25: CONTEO (5 tests)
// =====================================================================

add('cuantos modelos hay', 'answerConteo', ['333']);
add('cuantos modelos de depresion', 'answerConteo', ['111']);
add('total de modelos en produccion', 'answerConteo', ['333']);
add('cuantos modelos tiene el proyecto', 'answerConteo', ['333']);
add('numero de modelos de produccion', 'answerConteo', ['333']);

// =====================================================================
// SECCION 26: DEMOGRAFICA (5 tests)
// =====================================================================

add('composicion demografica de depresion', 'answerDemografica', ['Depresi']);
add('composicion demografica por sexo', 'answerDemografica', ['hombres']);
add('desglose demografico de parkinson', 'answerDemografica', ['Parkinson']);
add('composicion por sexo y padecimiento', 'answerDemografica', ['hombres']);
add('proporcion demografica historica', 'answerBoletin', ['Boletin']);

// =====================================================================
// SECCION 27: PADECIMIENTO NO MODELADO (5 tests)
// =====================================================================

add('cuantos casos de diabetes hay', 'answerPadecimientoNoModelado', ['no modela']);
add('cancer en jalisco', 'answerPadecimientoNoModelado', ['no modela']);
add('influenza en mexico', '*', []);
add('covid 19 pronostico', 'answerPadecimientoNoModelado', ['no modela']);
add('esquizofrenia en cdmx', 'answerPadecimientoNoModelado', ['no modela']);

// =====================================================================
// SECCION 28: OFF-TOPIC (10 tests — deben devolver null para ir a Gemini)
// =====================================================================

add('quien ganara la f1', null, [], [], {});
add('resultado del futbol', null, [], [], {});
add('como va el bitcoin', null, [], [], {});
add('clima en cancun', '*', [], [], {});
add('receta de tacos', null, [], [], {});
add('quien es el presidente', null, [], [], {});
add('formula 1 resultados', null, [], [], {});
add('donde puedo viajar', '*', [], [], {});
add('como hacer un pastel', null, [], [], {});
add('cuanto cuesta un tesla', '*', [], [], {});

// =====================================================================
// SECCION 29: ENTIDAD DETECTION EDGE CASES (15 tests, entity-only)
// =====================================================================

// Anos como rango vs individuales
add('depresion en 2020 y 2022', '*', [], [],
  {padecimiento: 'Depresion', _years: [2020, 2022]});
add('depresion entre 2020 y 2022', '*', [], [],
  {padecimiento: 'Depresion', _years: [2020, 2021, 2022]});
add('parkinson del 2018 al 2020', '*', [], [],
  {padecimiento: 'Parkinson', _years: [2018, 2019, 2020]});

// Aliases de modelo
add('que tal xgboost', '*', [], [], {modelo: 'Ensemble'});
add('lightgbm resultados', '*', [], [], {modelo: 'Stacking'});
add('deep ar rendimiento', '*', [], [], {modelo: 'DeepAR'});

// Multiples estados
add('jalisco y sonora', '*', [], [], {}); // should detect _estados
add('puebla cdmx y tlaxcala depresion', '*', [], [],
  {padecimiento: 'Depresion'});

// Sexo aliases
add('casos en masculino', '*', [], [], {sexo: 'hombres'});
add('datos de femenino', '*', [], [], {sexo: 'mujeres'});

// Meses
add('depresion en enero', '*', [], [],
  {padecimiento: 'Depresion', _months: [1]});
add('parkinson en diciembre', '*', [], [],
  {padecimiento: 'Parkinson', _months: [12]});

// Semanas
add('depresion semana 10', '*', [], [],
  {padecimiento: 'Depresion', _weeks: [10]});
add('parkinson semana 52', '*', [], [],
  {padecimiento: 'Parkinson', _weeks: [52]});

// Nacional
add('depresion a nivel nacional', '*', [], [],
  {padecimiento: 'Depresion', estado: 'Nacional'});

// =====================================================================
// SECCION 30: LUGAR DESCONOCIDO (2 tests)
// =====================================================================

add('depresion en mordor', '*', [], [], {});
add('parkinson en la atlantida', '*', [], []);

// =====================================================================
// SECCION 31: ARTICULO / PUBLICACION (5 tests)
// =====================================================================

add('tienen articulo publicado', 'answerProyectoMeta', ['art']);
add('publicacion del proyecto', 'answerProyectoMeta', ['art']);
add('hay paper del proyecto', 'answerProyectoMeta', ['art']);
add('donde esta el articulo', 'answerProyectoMeta', ['art']);
add('referencia del articulo', 'answerProyectoMeta', ['art']);

// =====================================================================
// Total
// =====================================================================

console.log(`\nTotal tests generated: ${tests.length}`);

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION: Run entity detection tests
// ─────────────────────────────────────────────────────────────────────────────

let entityPass = 0, entityFail = 0;
const entityFailures = [];

for (const t of tests) {
  if (!t.checkEntities || !Object.keys(t.checkEntities).length) continue;

  const ent = detectEntities(t.query);
  let passed = true;
  const issues = [];

  for (const [key, expected] of Object.entries(t.checkEntities)) {
    const actual = ent[key];

    if (expected === undefined) continue;

    if (Array.isArray(expected)) {
      if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) {
        passed = false;
        issues.push(`${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    } else if (actual !== expected) {
      passed = false;
      issues.push(`${key}: expected "${expected}", got "${actual}"`);
    }
  }

  if (passed) {
    entityPass++;
  } else {
    entityFail++;
    entityFailures.push({ id: t.id, query: t.query, issues });
  }
}

console.log(`\n${'='.repeat(70)}`);
console.log(`ENTITY DETECTION RESULTS`);
console.log(`${'='.repeat(70)}`);
console.log(`Pass: ${entityPass} | Fail: ${entityFail} | Total: ${entityPass + entityFail}`);
if (entityFailures.length) {
  console.log(`\nFAILURES:`);
  for (const f of entityFailures) {
    console.log(`  #${f.id} "${f.query}"`);
    for (const i of f.issues) console.log(`    -> ${i}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Save test cases as JSON for the KB runner
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'fs';
writeFileSync(
  new URL('./test_cases.json', import.meta.url),
  JSON.stringify(tests, null, 2),
  'utf-8'
);
console.log(`\nSaved ${tests.length} test cases to tests/test_cases.json`);
