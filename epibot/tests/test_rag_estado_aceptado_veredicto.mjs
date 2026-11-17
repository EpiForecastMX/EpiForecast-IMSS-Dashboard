/**
 * Pruebas herméticas de ramificación por veredicto en estadoDeAceptado (N1 de Fable).
 *
 * Evalúa el tramo real de netlify/functions/rag.mjs mediante node:vm con stubs
 * herméticos en memoria (sin SDK de Gemini, sin llamadas a red ni archivos fuera
 * de la función bajo prueba).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAG_PATH = fileURLToPath(new URL('../netlify/functions/rag.mjs', import.meta.url));

function cargarTramoEstadoRag() {
  const src = readFileSync(RAG_PATH, 'utf-8');
  const ini = src.indexOf('function stripAccents(');
  const fin = src.indexOf('// Rate limit');
  assert.ok(ini > 0 && fin > ini, 'No se localizó el tramo acotado stripAccents..Rate limit en rag.mjs');

  const catalogoStub = {
    canonClinico: (s) => s,
    nombraAlias: (qn, alias) => {
      const esc = String(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^| )${esc}( |$)`).test(qn);
    },
    releases: [
      {
        id: 'hipertension_i10',
        pad: 'Hipertensión arterial',
        etiqueta: 'Hipertensión arterial (I10-I15)',
        nombre: 'Hipertensión arterial',
        pagina: 'hipertension_i10.html',
        alias: ['hipertension arterial', 'hipertension', 'i10'],
      },
      {
        id: 'obesidad_e66',
        pad: 'Obesidad',
        etiqueta: 'Obesidad (E66)',
        nombre: 'Obesidad',
        pagina: 'obesidad_e66.html',
        alias: ['obesidad', 'e66'],
      },
      {
        id: 'sifilis_adquirida_a51',
        pad: 'Sífilis adquirida',
        etiqueta: 'Sífilis adquirida (A51-A53)',
        nombre: 'Sífilis adquirida',
        pagina: 'sifilis_adquirida_a51.html',
        alias: ['sifilis adquirida', 'sifilis', 'a51'],
        controlDelegado: true,
        controlEstatalPocoInformativo: true,
      },
    ],
  };

  const avisosStub = {
    hipertension_i10: {
      avisos: [{ estado: 'fuente', titulo: 'Cobertura SINAVE:', texto: 'registro semanal sujeto a corte preliminar.' }],
      nota: null,
    },
  };

  const ctx = {
    console: { error: () => {}, warn: () => {}, log: () => {} },
    Date,
    Intl,
    Math,
    Number,
    Object,
    Array,
    Set,
    Map,
    RegExp,
    String,
    Boolean,
    JSON,
    EPI_CATALOGO: catalogoStub,
    EPI_AVISOS_FUENTE: avisosStub,
  };
  ctx.globalThis = ctx;

  const codigo = `${src.slice(ini, fin)}\n;({ estadoDeAceptado, estadoDeControl });`;
  return vm.runInNewContext(codigo, ctx, { filename: RAG_PATH });
}

const FICHA_ACEPTADO_HTML = [
  '<!doctype html><html><body>',
  '<section><p>Superó la prueba de 2025 frente al control estacional en los tres ámbitos evaluados.</p></section>',
  '<div><h3>Qué significa y qué no</h3>',
  '<p class="aviso-fuente"><strong>Duplicado omitido:</strong> proviene de avisos_fuente.</p>',
  '<p><strong>Error moderado en entidades pequeñas:</strong> series estatales con conteos bajos muestran mayor variabilidad relativa.</p>',
  '</div></body></html>',
].join('\n');

const FICHA_SIN_FRASE_HTML = '<!doctype html><html><body><div><h3>Qué significa y qué no</h3></div></body></html>';

function vistaAceptadoSintetica({ weeks_available, weeks_required = 4, verdict }) {
  return {
    release_id: 'sint-i10-2026w41',
    nombre_completo: 'Hipertensión arterial (I10-I15)',
    origin: [2026, 41],
    horizon_weeks: 52,
    forecast_emitted_at: '2026-10-13T00:24:00Z',
    weeks_available,
    weeks_required,
    verdict,
    caida_al_control: null,
    series: { 'nacional|00|general': {}, 'estado|14|hombres': {} },
  };
}

function extraerCabecera(answer) {
  const m = String(answer || '').match(/^\*\*([^*]+)\*\*/);
  assert.ok(m, `Respuesta sin cabecera en negritas: ${answer}`);
  return m[1];
}

function verificarColaInvarianteAceptado(res) {
  assert.ok(res && typeof res.answer === 'string');
  assert.match(res.answer, /Superó la prueba de 2025 frente al control estacional en los tres ámbitos evaluados\./);
  assert.match(res.answer, /Esa prueba retrospectiva no es la validación del pronóstico publicado\./);
  assert.match(res.answer, /- \*\*Error moderado en entidades pequeñas:\*\* series estatales con conteos bajos/);
  assert.doesNotMatch(res.answer, /Duplicado omitido/);
  assert.match(res.answer, /Datos hasta la semana 41 de 2026, emitido el 12 de octubre de 2026 \(hora de Ciudad de México\); 52 semanas, pronóstico puntual sin intervalos\./);
  assert.match(res.answer, /Detalle en \[su página\]\(\.\.\/hipertension_i10\.html\)\./);
  assert.match(res.answer, /Avisos de la fuente:\n- \*\*Cobertura SINAVE:\*\* registro semanal sujeto a corte preliminar\./);
  assert.deepEqual(JSON.parse(JSON.stringify(res.sources)), [{
    n: 1,
    source: 'Release publicado sint-i10-2026w41',
    title: 'Hipertensión arterial (I10-I15)',
    section: 'hipertension_i10',
    url: '../hipertension_i10.html',
  }]);
}

const { estadoDeAceptado, estadoDeControl } = cargarTramoEstadoRag();
const PREGUNTA_ESTADO = '¿Está validado el pronóstico de hipertensión arterial?';

test('0/4 INCOMPLETE conserva cabecera no validado y prospectiva en curso sin semanas observadas', () => {
  const vista = vistaAceptadoSintetica({ weeks_available: 0, weeks_required: 4, verdict: 'INCOMPLETE' });
  const res = estadoDeAceptado(PREGUNTA_ESTADO, () => vista, () => FICHA_ACEPTADO_HTML);
  assert.ok(res);
  const cabecera = extraerCabecera(res.answer);
  assert.match(cabecera, /su portafolio se aceptó en la prueba de 2025/);
  assert.match(cabecera, /el pronóstico todavía no está validado\./);
  assert.doesNotMatch(cabecera, /superó la validación prospectiva|no superó la validación prospectiva|PASS|FAIL/i);
  assert.match(
    res.answer,
    /La validación prospectiva está en curso \(0 de 4 semanas\): todavía no hay semanas observadas después del origen, así que no existe desempeño fuera de muestra de este pronóstico\./,
  );
  verificarColaInvarianteAceptado(res);
});

test('2/4 INCOMPLETE mantiene no validado con contador 2 de 4 y prueba 2025 independiente', () => {
  const vista = vistaAceptadoSintetica({ weeks_available: 2, weeks_required: 4, verdict: 'INCOMPLETE' });
  const res = estadoDeAceptado(PREGUNTA_ESTADO, () => vista, () => FICHA_ACEPTADO_HTML);
  assert.ok(res);
  const cabecera = extraerCabecera(res.answer);
  assert.match(cabecera, /su portafolio se aceptó en la prueba de 2025/);
  assert.match(cabecera, /el pronóstico todavía no está validado\./);
  assert.doesNotMatch(cabecera, /superó la validación prospectiva|no superó la validación prospectiva|PASS|FAIL/i);
  assert.match(
    res.answer,
    /La validación prospectiva lleva 2 de 4 semanas \(veredicto INCOMPLETE\); su desempeño fuera de muestra se consulta en su página\./,
  );
  verificarColaInvarianteAceptado(res);
});

test('4/4 PASS declara compuerta prospectiva superada con contador y veredicto sin convertir prueba 2025 en prospectiva', () => {
  const vista = vistaAceptadoSintetica({ weeks_available: 4, weeks_required: 4, verdict: 'PASS' });
  const res = estadoDeAceptado(PREGUNTA_ESTADO, () => vista, () => FICHA_ACEPTADO_HTML);
  assert.ok(res);
  const cabecera = extraerCabecera(res.answer);
  assert.match(cabecera, /su portafolio se aceptó en la prueba de 2025/);
  assert.doesNotMatch(cabecera, /todav[ií]a|no está validado|en curso|no superó|FAIL|INCOMPLETE/i);
  assert.match(cabecera, /superó la validación prospectiva/);
  assert.match(cabecera, /4 de 4 semanas/);
  assert.match(cabecera, /veredicto PASS/);
  assert.doesNotMatch(res.answer, /todav[ií]a|no está validado|en curso|no superó|falló|veredicto FAIL/i);
  assert.match(res.answer, /4 de 4 semanas/);
  assert.match(res.answer, /veredicto PASS/);
  assert.match(res.answer, /superó la compuerta prospectiva/);
  verificarColaInvarianteAceptado(res);
});

test('4/4 FAIL declara fallo prospectivo sin «todavía», «en curso» ni «sin fallo», preservando prueba 2025 independiente', () => {
  const vista = vistaAceptadoSintetica({ weeks_available: 4, weeks_required: 4, verdict: 'FAIL' });
  const res = estadoDeAceptado(PREGUNTA_ESTADO, () => vista, () => FICHA_ACEPTADO_HTML);
  assert.ok(res);
  const cabecera = extraerCabecera(res.answer);
  assert.match(cabecera, /su portafolio se aceptó en la prueba de 2025/);
  assert.match(cabecera, /no superó la validación prospectiva/);
  assert.match(cabecera, /4 de 4 semanas/);
  assert.match(cabecera, /veredicto FAIL/);
  assert.match(res.answer, /4 de 4 semanas/);
  assert.match(res.answer, /veredicto FAIL/);
  assert.match(res.answer, /falló/);
  assert.match(res.answer, /no quedó validado/);
  assert.doesNotMatch(res.answer, /todav[ií]a/i);
  assert.doesNotMatch(res.answer, /en curso/i);
  assert.doesNotMatch(res.answer, /sin fallo/i);
  assert.doesNotMatch(res.answer, /(?<!\bno )superó la (validación|compuerta) prospectiva|veredicto PASS/i);
  verificarColaInvarianteAceptado(res);
});

test('otro veredicto literal reporta el literal y el contador sin inventar aceptación prospectiva', () => {
  const vista = vistaAceptadoSintetica({ weeks_available: 3, weeks_required: 4, verdict: 'PAUSED_AUDIT' });
  const res = estadoDeAceptado(PREGUNTA_ESTADO, () => vista, () => FICHA_ACEPTADO_HTML);
  assert.ok(res);
  const cabecera = extraerCabecera(res.answer);
  assert.match(cabecera, /su portafolio se aceptó en la prueba de 2025/);
  assert.match(cabecera, /no está validado/);
  assert.match(cabecera, /PAUSED_AUDIT/);
  assert.doesNotMatch(cabecera, /todav[ií]a/i);
  assert.match(res.answer, /3 de 4 semanas/);
  assert.match(res.answer, /veredicto PAUSED_AUDIT/);
  assert.match(res.answer, /sin validación prospectiva aprobada/);
  assert.doesNotMatch(res.answer, /todav[ií]a|en curso|(?<!\bno )superó la (validación|compuerta) prospectiva|veredicto PASS|veredicto FAIL|falló/i);
  verificarColaInvarianteAceptado(res);

  const vistaSinVeredicto = vistaAceptadoSintetica({ weeks_available: 1, weeks_required: 4, verdict: null });
  const resVacio = estadoDeAceptado(PREGUNTA_ESTADO, () => vistaSinVeredicto, () => FICHA_ACEPTADO_HTML);
  assert.ok(resVacio);
  assert.match(extraerCabecera(resVacio.answer), /no está validado \(veredicto prospectivo sin veredicto\)\./);
  assert.doesNotMatch(resVacio.answer, /todav[ií]a|en curso|(?<!\bno )superó la (validación|compuerta) prospectiva|veredicto PASS/i);
});

test('control con caida_al_control devuelve null en estadoDeAceptado y estadoDeControl nunca valida ni emite PASS', () => {
  const vistaControl = {
    release_id: 'sint-a51-2026w42',
    nombre_completo: 'Sífilis adquirida (A51-A53)',
    origin: [2026, 42],
    horizon_weeks: 52,
    forecast_emitted_at: '2026-11-15T18:00:00Z',
    weeks_available: 4,
    weeks_required: 4,
    verdict: 'PASS',
    caida_al_control: {
      fold: 'test_2025',
      comprobaciones: [
        { ambito: 'smape_bases', portafolio: 34.2, control: 29.8, pasa: false },
        { ambito: 'smape_all', portafolio: 31.0, control: 28.4, pasa: false },
        { ambito: 'smape_nacional_general', portafolio: 14.1, control: 15.0, pasa: true },
      ],
    },
    series: { 'nacional|00|general': {}, 'estado|14|mujeres': {}, 'estado|14|hombres': {} },
  };
  const qCtrl = '¿Está validado el pronóstico de sífilis adquirida?';
  assert.equal(estadoDeAceptado(qCtrl, () => vistaControl, () => FICHA_ACEPTADO_HTML), null);

  const ctrl = estadoDeControl(qCtrl, () => vistaControl);
  assert.ok(ctrl);
  assert.equal(extraerCabecera(ctrl.answer), 'Sífilis adquirida (A51-A53): control estacional, no validado.');
  assert.match(ctrl.answer, /No tiene una validación prospectiva que superar/);
  assert.match(ctrl.answer, /\(4 de 4 semanas registradas\)/);
  assert.doesNotMatch(ctrl.answer, /superó la (validación|compuerta) prospectiva|veredicto PASS/i);

  const vistaObesidad = vistaAceptadoSintetica({ weeks_available: 4, weeks_required: 4, verdict: 'PASS' });
  assert.equal(estadoDeAceptado('¿Está validado el pronóstico de obesidad?', () => vistaObesidad, () => FICHA_SIN_FRASE_HTML), null);
  assert.equal(estadoDeAceptado('¿Cuántos casos de hipertensión arterial en Jalisco?', () => vistaObesidad, () => FICHA_ACEPTADO_HTML), null);
});
