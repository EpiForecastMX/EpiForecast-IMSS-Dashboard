/**
 * Mesa de expertos sobre las gráficas del EpiBot (25-nov-2026, ocho asientos; acta en planes/mesa_graficas_epibot_2026-11-25/).
 * Las cifras ya coincidían con sus fuentes; estas pruebas fijan lo que la mesa corrigió en la presentación.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
const fuente = (p) => readFileSync(new URL(p, import.meta.url), 'utf-8');
await import('../js/release_catalog.js');
const { graficaObesidad, legible } = await import('../js/obesidad_charts.js');
const { RELEASES } = await import('../js/release_config.js');
const vista = (id) => JSON.parse(readFileSync(new URL(`publication/${id}/vista.json`, raiz), 'utf-8'));

function contraste(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

test('títulos en tinta oscura y trazos de al menos 3:1 sobre blanco para los 148 colores del catálogo', () => {
  const c = graficaObesidad(vista('varicela_b01'), 'varicela en jalisco', { estado: 'Jalisco' });
  assert.equal(c.options.plugins.title.color, '#173c33');
  for (const r of RELEASES) assert.ok(contraste(legible(r.color)) >= 3, `${r.id}: ${r.color} → ${legible(r.color)}`);
  for (const p of ['../js/obesidad_charts.js', '../js/comparacion_rondas.js']) assert.doesNotMatch(fuente(p), /#E7ECF5|#B8C8E2|'Outfit'/);
});

test('un control estacional se rotula como control, en gris, y nunca como «Pronóstico»', () => {
  const v = vista('varicela_b01');
  assert.ok(v.caida_al_control, 'varicela es un control');
  const c = graficaObesidad(v, 'varicela en jalisco', { estado: 'Jalisco' });
  const pron = c.datasets[1];
  assert.equal(pron.label, 'Control, no validado');
  assert.equal(pron.borderColor, '#6b6f73');
  assert.match(c.options.plugins.title.text.join(' '), /Control estacional .*no validado/);
  assert.ok(c.datasets.every((d) => d.tension === 0), 'sin suavizado');
  assert.equal(c.corte, c.labels[c.datasets[0].data.map((y) => y != null).lastIndexOf(true)], 'marca el último dato');
  assert.equal(c.options.scales.y.title.text, 'Casos notificados por semana');
});

test('acumulado: con año, observado del año y continuación hasta fin de año, como el texto; sin año, 52 semanas desde el origen', () => {
  const v = vista('varicela_b01');
  const x = Object.values(v.series).find((s) => s.nivel === 'nacional' && s.sexo === 'general');
  const ult = x.observado.at(-1)[0];
  const obs26 = Math.round(x.observado.filter(([d]) => d.startsWith('2026')).reduce((a, [, y]) => a + y, 0));
  const resto = x.pronostico.filter(([d]) => d.startsWith('2026') && d > ult).reduce((a, [, y]) => a + Math.round(y * 10), 0) / 10;
  const c = graficaObesidad(v, 'acumulado de varicela en 2026', {}, { tipo: 'acumulado' });
  assert.equal(c.datasets[0].data.filter((y) => y != null).at(-1), obs26);
  assert.equal(c.datasets[1].data.at(-1), Math.round(obs26 + resto));
  assert.ok(c.labels.every((d) => d.startsWith('2026')), 'no pasa del año pedido');
  const sin = graficaObesidad(v, 'acumulado de varicela', {}, { tipo: 'acumulado' });
  assert.equal(sin.datasets.at(-1).data.at(-1), Math.round(x.pronostico_52_total));
});

test('ranking: un solo color, los 32 nombres y la advertencia de pocas semanas', () => {
  const c = graficaObesidad(vista('diabetes_t2'), 'ranking de diabetes tipo 2', {}, { tipo: 'ranking' });
  assert.equal(c.labels.length, 32);
  assert.equal(typeof c.datasets[0].backgroundColor, 'string');
  assert.equal(c.options.scales.y.ticks.autoSkip, false);
  assert.ok(c.altura >= 32 * 22);
  assert.match(c.options.plugins.title.text.join(' '), /semanas? comprobadas?/);
});

test('renderizador común, mapas y rutas', () => {
  const app = fuente('../js/app.js');
  assert.match(app, /plugins: \[epiGradientPlugin, epiCrosshairPlugin, epiDoughnutCenterPlugin, epiBoxPlotPlugin, epiCortePlugin\]/, 'sin resplandor, con corte');
  assert.match(app, /if \(ds\.tension == null\) ds\.tension = 0;/);
  assert.match(app, /backgroundColor: '#ffffff',\n\s+titleColor: '#173c33'/, 'tooltip claro');
  assert.match(app, /prefers-reduced-motion/);
  // «radar de motores» sin métricas muestra el reparto de motores, nunca la tendencia histórica.
  assert.match(app, /const dist = distribucionMotores\(data\);\n\s+return dist \|\| null;/);
  // La gráfica sólo hereda el estado del contexto si el texto también es de ese estado.
  assert.match(app, /const estadoEnTexto = lastEst && norm\(result\)\.includes\(norm\(lastEst\)\);/);
  // Año parcial rotulado en las series anuales.
  assert.match(app, /\(parcial, \$\{hastaCorto\}\)/);
  assert.match(app, /const semDato = ult && rezagos\.size === 1 \? ult\.semana - \[\.\.\.rezagos\]\[0\] : null;/);
  const mapa = fuente('../js/mexico-map.js');
  assert.match(mapa, /const RAMPA = \['#e3efe9', '#b6d5c6', '#7fb39b', '#3f8a6a', '#17644d'\];/);
  assert.match(mapa, /sin ajustar por población/);
  assert.match(fuente('../js/kb.js'), /Semáforo de carga pronosticada/);
  assert.doesNotMatch(fuente('../js/kb.js'), /mas oscuro = menor incidencia/);
});

test('originales: cada punto lleva la fecha de su semana del boletín (fecha interna + 13 días), en todas las series', async () => {
  const { fechaBoletinLegacy, serieLegacy } = await import('../js/calculo/series.js');
  const z = JSON.parse(readFileSync(new URL('epibot/zoom_series.json', raiz), 'utf-8'));
  let pares = 0;
  for (const [k, s] of Object.entries(z)) {
    const pos = new Map(s.d.map((d, i) => [fechaBoletinLegacy(d), i]));
    for (const w of s.seguimiento || []) {
      const i = pos.get(w.periodo_inicio);
      assert.ok(i != null, `${k} ${w.etiqueta}: sin punto para ${w.periodo_inicio}`);
      if (w.real != null) { assert.equal(s.r[i], w.real, `${k} ${w.etiqueta}`); pares++; }
    }
  }
  assert.ok(pares > 3000);
  // La serie normalizada (texto y calculadora) usa las mismas fechas: su último observado es el inicio de la última semana.
  const s = serieLegacy(z, 'Dengue', { estado: 'Veracruz' });
  const ult = z['dengue|veracruz|general'].seguimiento.filter((w) => w.real != null).at(-1);
  assert.equal(s.observado.at(-1)[0], ult.periodo_inicio);
  assert.match(fuente('../js/app.js'), /fechaEpiLegacy\(iso, pad\)/);
});

test('originales: la fecha de cada dato es su semana epidemiológica (semana del boletín menos el rezago del cuadro)', async () => {
  const { serieLegacy, REZAGO_LEGACY } = await import('../js/calculo/series.js');
  const z = JSON.parse(readFileSync(new URL('epibot/zoom_series.json', raiz), 'utf-8'));
  // El rezago sale del encabezado del cuadro en la foto vigente del radar: «hasta la semana N» frente al boletín N.
  const actual = JSON.parse(readFileSync(new URL('assets/boletin/actual.json', raiz), 'utf-8'));
  const foto = JSON.parse(readFileSync(new URL(`${actual.carpeta}/data.json`, raiz), 'utf-8'));
  const PAD = { depresion: 'Depresion', parkinson: 'Parkinson', alzheimer: 'Alzheimer', dengue: 'Dengue' };
  for (const [id, pad] of Object.entries(PAD)) {
    const fila = foto.diseases.find((d) => d.platform_id === id);
    assert.equal(REZAGO_LEGACY[pad], foto.meta.week - fila.observed_week, `${pad}: rezago del cuadro`);
    const ult = z[`${id}|nacional|general`].seguimiento.filter((w) => w.real != null).at(-1);
    const s = serieLegacy(z, pad, {});
    const esperado = new Date(Date.parse(`${ult.periodo_inicio}T00:00:00Z`) - 7 * REZAGO_LEGACY[pad] * 864e5).toISOString().slice(0, 10);
    assert.equal(s.observado.at(-1)[0], esperado, pad);
    // Dengue suma sus tres formas (A97.0, A97.1 y A97.2).
    const semanal = foto.diseases.filter((d) => d.platform_id === id).reduce((a, d) => a + d.weekly, 0);
    assert.equal(s.observado.at(-1)[1], semanal, `${pad}: el último dato es la cifra semanal del cuadro`);
  }
  // Las otras dos copias de la regla dicen lo mismo.
  const { LEGACY_META } = await import('../../assets/dashboard/unified.mjs');
  for (const [id, pad] of Object.entries(PAD)) assert.equal(LEGACY_META[id].rezago, REZAGO_LEGACY[pad], id);
  assert.match(readFileSync(new URL('home-preview.js', raiz), 'utf-8'), /var REZAGO = \{ depresion: 1, parkinson: 1, alzheimer: 1, dengue: 0 \};/);
});
