/**
 * Fases 2 y 3 de la mesa agéntica (25-nov-2026).
 * Fase 2: ficha de la conversación (contexto visible y reinicio real), frase hablada, accesibilidad de mapa y gráficas.
 * Fase 3: planificador detrás de la bandera ?agente=1 — validación de pasos con listas cerradas y reglas fijas de reparación.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const local = s.match(/(knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)\.json/);
  const rel = m ? m[1] : (local ? `epibot/${local[1]}.json` : null);
  if (!rel || !existsSync(new URL(rel, raiz))) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
Math.random = () => 0.42;
const kb = await import('../js/kb.js');
await kb.loadKnowledge();
await import('../js/release_catalog.js');
const nlu = await import('../netlify/lib/nlu.mjs');
const fuente = (p) => readFileSync(new URL(p, import.meta.url), 'utf-8');

test('ficha: el contexto visible sigue a la conversación y «Nueva consulta» lo borra', async () => {
  kb._resetContext();
  assert.equal(kb.contextoActual(), null);
  await kb.answerWithTrace('varicela en Jalisco mujeres');
  assert.deepEqual(kb.contextoActual(), { padecimiento: 'Varicela', consulta: kb.contextoActual().consulta, estado: 'Jalisco', sexo: 'mujeres' });
  await kb.answerWithTrace('varicela en Jalisco ambos sexos');
  assert.equal(kb.contextoActual().sexo, null, 'quitar el sexo desde la ficha funciona');
  kb.reiniciaContexto();
  assert.equal(kb.contextoActual(), null);
  // Un padecimiento sensible no se muestra en la ficha.
  await kb.answerWithTrace('ahorcamiento en Jalisco');
  assert.equal(kb.contextoActual()?.padecimiento ?? null, null);
  kb._resetContext();
});

test('ficha y accesibilidad: el cliente la pinta, «Nueva consulta» reinicia el KB y mapa y gráficas traen tabla', () => {
  const app = fuente('../js/app.js');
  assert.match(app, /function resetChat\(\) \{\n  reiniciaContexto\(\);/);
  assert.match(app, /function pintaFicha\(\)/);
  assert.match(app, /tablaDeGrafica\(canvas, chartData\)/);
  assert.match(fuente('../index.html'), /id="fichaTurno"/);
  const mapa = fuente('../js/mexico-map.js');
  assert.match(mapa, /setAttribute\('tabindex', '0'\)/);
  assert.match(mapa, /Ver los datos del mapa en tabla/);
  assert.match(fuente('../css/shell.css'), /\.input-wrapper textarea, \.input-wrapper input \{ font-size: 16px; \}/);
});

test('voz: tras una pregunta por voz sólo se dice el veredicto, cortado en una oración entera', async () => {
  globalThis.window = globalThis;
  const { textoHablado } = await import('../js/voice.js');
  const md = '**Varicela en Jalisco:** se espera que **aumente**: unos 395 casos en las próximas 4 semanas.\n\n- **Ahora:** 249 casos.\n- **En lo que va de 2026:** 3,653 casos.';
  const corto = textoHablado(md);
  assert.match(corto, /^Varicela en Jalisco: se espera que aumente: unos 395 casos en las próximas 4 semanas\. El detalle está en pantalla\.$/);
  assert.doesNotMatch(corto, /Ahora/);
  const largo = textoHablado(`${'Una oración de prueba bastante larga para el corte. '.repeat(60)}`, true);
  assert.ok(largo.length <= 1530 && /\. El resto está en pantalla\.$/.test(largo));
});

test('planificador: valida pasos con listas cerradas y repara con reglas fijas', () => {
  const cat = nlu.catalogoNlu(globalThis.EPI_CATALOGO.releases);
  assert.equal(nlu.idDelCatalogo('varicela', cat)?.id, 'varicela_b01');
  assert.equal(nlu.idDelCatalogo('diabetes', cat), null, 'ambiguo: no se adivina');
  const pasos = nlu.normalizaPasos([
    { intencion: 'tendencia', padecimientos: ['diabetes_t1', 'diabetes_t2'], estados: ['Jalisco'] },
    { intencion: 'tendencia', padecimientos: [], estados: [] },
  ]);
  assert.equal(pasos.length, 3);
  assert.equal(pasos[2].intencion, 'ranking');
  const v = pasos.map((p) => nlu.validaPaso(p, cat));
  assert.ok(v.every(Boolean));
  assert.equal(nlu.consultaDePaso(v[0]), '¿está subiendo diabetes tipo 1 en Jalisco?');
  // Inválidos: id inventado, estado inexistente, comparación con un solo estado.
  assert.equal(nlu.validaPaso({ intencion: 'estado_actual', padecimientos: ['zombificacion'] }, cat), null);
  assert.equal(nlu.validaPaso({ intencion: 'estado_actual', padecimientos: ['varicela_b01'], estados: ['Atlántida'] }, cat), null);
  assert.equal(nlu.validaPaso({ intencion: 'comparar_estados', padecimientos: ['varicela_b01'], estados: ['Jalisco'] }, cat), null);
  // Las comparaciones usan «vs», nunca «compara» (con «picaduras» activaba la crisis).
  const cmp = nlu.consultaDePaso(nlu.validaPaso({ intencion: 'comparar_estados', padecimientos: ['alacran_t63'], estados: ['Puebla', 'Morelos'], rapidez: true }, cat));
  assert.doesNotMatch(cmp, /\bcompara/);
  assert.match(cmp, / vs /);
});

test('planificador: el plan descarta pasos inválidos, los cuenta y nunca pasa de tres', async () => {
  const gen = async () => JSON.stringify({ pasos: [
    { intencion: 'estado_actual', padecimientos: ['dengue'], estados: ['Yucatán'] },
    { intencion: 'estacionalidad', padecimientos: ['varicela'] },
    { intencion: 'estado_actual', padecimientos: ['inventado_x99'] },
    { intencion: 'pico', padecimientos: ['asma_j45'] },
  ] });
  const r = await nlu.interpretaPlan('dengue en Yucatán, meses de varicela, algo raro y pico de asma', globalThis.EPI_CATALOGO.releases, gen);
  assert.deepEqual(r.consultas, ['¿cómo va dengue en Yucatán?', '¿en qué meses hay más casos de varicela?']);
  assert.equal(r.descartados, 1);
  assert.deepEqual(await nlu.interpretaPlan('x', globalThis.EPI_CATALOGO.releases, async () => 'no es json'), { consultas: [] });
});

test('planificador en el cliente: detrás de la bandera, con control de padecimientos nombrados', () => {
  const app = fuente('../js/app.js');
  assert.match(app, /get\('agente'\) === '1' \|\| localStorage\.getItem\('epibot_agente'\) === '1'/);
  assert.match(app, /if \(AGENTE && \(!result \|\| pareceVariosPedidos\(text\)\)\)/);
  assert.match(app, /function corrigePlan\(consultas, padsTexto\)/);
});
