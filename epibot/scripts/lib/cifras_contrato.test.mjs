/**
 * cifras_contrato.test.mjs — Las pruebas del gate de cifras.
 *
 * Existen porque la primera version de `problemasDeSuperficies` se dio por buena tras once
 * comprobaciones hechas A MANO en una sesion: pasaron, no quedaron escritas, y una auditoria
 * externa encontro despues dos huecos que ninguna de ellas cubria. Una prueba que no vive en
 * el repositorio no protege nada.
 *
 * Cada caso dice si DEBE marcarse o NO. Los «no debe» valen tanto como los «debe»: un gate
 * que marca de mas se desactiva, y entonces no protege nada tampoco.
 *
 * Uso:  npm run cifras:test
 */

import { readFileSync } from 'fs';
import {
  problemasDeSuperficies, problemasDeKnowledge, problemasDeDistribuciones, jsonRevisable, sinRegionesNoLeidas,
  problemasDeMetricasSeleccion, problemasDeMetricasEnPagina, esClaveDeMetrica,
  problemasDeGaleria, problemasDeMetricasAntiguas, problemasDeNoticias, problemasDeCifras,
  problemasDeSeguimientoSemanal, problemasDeNacionalPorSexo, problemasDeVistasSeguimiento, inicioSemanaEpi,
} from './cifras_contrato.mjs';

const CASOS = [
  // --- HTML: lo que se ve --------------------------------------------------------------
  ['index.html', '<p>La plataforma publica 435 series productivas.</p>', true,
   'HTML · cifra retirada a la vista'],
  ['a.html', '<div>102 modelos de dengue</div>', true, 'HTML · 102 modelos'],
  ['b.html', '<p>111 x 3 = 435</p>', true, 'HTML · la ecuación falsa'],
  ['c.html', '<p>15 series nacionales</p>', true, 'HTML · los nacionales son 12'],
  ['d.html', '<p>145 series por sexo</p>', true, 'HTML · 145 por sexo (son 144)'],

  // --- HTML: lo que NO se ve, y por tanto no obliga ------------------------------------
  ['e.html', '<!-- su total 435 series contaba dos veces -->', false, 'HTML · comentario'],
  ['f.html', '<script>\n// el total 435 series era falso\n</script>', false, 'HTML · comentario JS'],
  ['g.html', '<a href="https://epiforecast.mx/x">432 series</a>', false,
   'HTML · el // de una URL no se traga la línea'],
  ['h.html', '<p>SMAPE 52 vs Prophet 102 en el backtest</p>', false,
   'HTML · «102» legítimo sin unidad: por eso se persigue la FORMA'],

  // --- JSON: el hueco que encontro la auditoria ----------------------------------------
  ['bento.json', '{"resumen":"El inventario son 435 series."}', true, 'JSON · cadena'],
  ['i.json', '{"motor":{"total":435}}', true,
   'JSON · NUMERO bajo clave de inventario — la forma real del bento.json viejo'],
  ['j.json', '{"rosters":{"total_series":435}}', true, 'JSON · número, clave explícita'],
  ['k.json', '{"gallery_items":435}', true, 'JSON · número, clave de galería'],
  ['l.json', '{"_nota":"se retiró porque su total 435 series mentía"}', false,
   'JSON · clave _*: nota de mantenimiento que nadie pinta'],
  ['m.json', '{"casos":[144,145,146]}', false,
   'JSON · dato de una serie temporal, no inventario'],
  ['n.json', '{"total":[145,145]}', false,
   'JSON · dentro de una lista un número es dato, aunque la clave suene a inventario'],
  ['q.json', '[{"total":145},{"total":145}]', false,
   'JSON · objeto DENTRO de una lista: sigue siendo dato tabulado, no inventario'],
  ['r.json', '{"filas":[{"total":435}]}', false,
   'JSON · fila de una tabla, aunque la clave suene a inventario'],
  ['o.json', '{"d":"M12 0C5.37 0 0 L435.2,99 3.435 9.795"}', false, 'JSON · geometría SVG'],
  ['p.json', '{"semana":31,"anio":2026}', false, 'JSON · números corrientes'],
];

let fallos = 0;
console.log('▶ Pruebas del contrato de cifras\n');
for (const [nombre, contenido, debe, desc] of CASOS) {
  const r = problemasDeSuperficies('/x', () => [nombre], () => contenido);
  const marco = r.problemas.length > 0;
  const ok = marco === debe;
  if (!ok) fallos++;
  console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  ${desc}`);
  if (!ok && marco) console.log(`           inesperado → ${r.problemas[0]}`);
  if (!ok && !marco) console.log('           no lo detectó');
}

// --- El recorrido tiene que ser recursivo -----------------------------------------------
{
  const arbol = {
    '/x': [{ name: 'index.html', isDirectory: () => false },
           { name: 'Reports', isDirectory: () => true },
           { name: 'node_modules', isDirectory: () => true }],
    '/x/Reports': [{ name: 'hondo.html', isDirectory: () => false }],
    '/x/node_modules': [{ name: 'basura.html', isDirectory: () => false }],
  };
  const leidos = [];
  const r = problemasDeSuperficies('/x', (d) => arbol[d] ?? [], (f) => {
    leidos.push(f);
    return f.includes('hondo') ? '<p>435 series</p>' : '<p>432 series</p>';
  });
  const hondo = r.problemas.some((p) => p.includes('Reports/hondo.html'));
  const salto = !leidos.some((f) => f.includes('node_modules'));
  for (const [ok, desc] of [[hondo, 'recorre subdirectorios (Reports/hondo.html)'],
                            [salto, 'salta node_modules']]) {
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  recorrido  ${desc}`);
  }
}

// --- Las posiciones se conservan ---------------------------------------------------------
{
  const { texto } = sinRegionesNoLeidas('uno\n<!-- dos\ntres -->\ncuatro 435 series');
  const linea = texto.split('\n').findIndex((l) => l.includes('435 series')) + 1;
  const ok = linea === 4;
  if (!ok) fallos++;
  console.log(`  ${ok ? '✔' : '✖ FALLO'}  posición   el borrado conserva el número de línea (${linea}, esperado 4)`);
}

// --- Las exenciones se cuentan, no son silenciosas ---------------------------------------
{
  const { exentos } = jsonRevisable('{"_a":"x","_b":"y","c":"z"}');
  const ok = exentos === 2;
  if (!ok) fallos++;
  console.log(`  ${ok ? '✔' : '✖ FALLO'}  exenciones se cuentan y se informan (${exentos}, esperado 2)`);
}

// --- Dengue en knowledge.json: motores de la asignación W37 ----------------------------
{
  const base = () => ({
    rosters: { total_series: 432, gallery_items: 432, por_cohorte: { neuro: 333, dengue: 99 } },
    stats: { total_modelos: 333, dist_motor: { Prophet: 333 }, por_estado: { Nacional: { n: 9 } },
             por_sexo: { hombres: { n: 111 }, mujeres: { n: 111 }, general: { n: 111 } } },
    dengue: { dist_motor: { DeepAR: 53, Prophet: 46 }, motores_productivos: ['DeepAR', 'Prophet'] },
  });
  const dengue = (kb) => problemasDeKnowledge(kb).filter((p) => p.startsWith('dengue.'));
  const casos = [
    [base(), false, 'asignación W37 (DeepAR 53 / Prophet 46) pasa'],
    [(() => { const k = base(); k.dengue.dist_motor = { DeepAR: 46, NBGLM: 31, Prophet: 22 };
      k.dengue.motores_productivos = ['DeepAR', 'NBGLM', 'Prophet']; return k; })(), true,
     'NBGLM con series (suspendido) se marca'],
    [(() => { const k = base(); k.dengue.motores_productivos = ['DeepAR', 'Prophet', 'NBGLM']; return k; })(),
     true, 'motores_productivos escrito a mano con NBGLM se marca'],
    [(() => { const k = base(); k.dengue.proyeccion_anios = 5; return k; })(), true,
     'proyeccion_anios presente se marca'],
    [(() => { const k = base(); k.dengue.dist_motor = { DeepAR: 53, Ensemble: 46 };
      k.dengue.motores_productivos = ['DeepAR', 'Ensemble']; return k; })(), true,
     'árbol no elegible se marca'],
  ];
  for (const [kb, debe, desc] of casos) {
    const r = dengue(kb);
    const ok = (r.length > 0) === debe;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  knowledge · ${desc}`);
    if (!ok) console.log(`           → ${JSON.stringify(r)}`);
  }
}

// --- Distribuciones escritas a mano en las páginas ------------------------------------
{
  const kb = {
    stats: { dist_motor: { Ensemble: 109, Stacking: 107, Prophet: 78, DeepAR: 39 } },
    dengue: { dist_motor: { DeepAR: 53, Prophet: 46, NBGLM: 0 } },
  };
  const casos = [
    ['<td>Distribuci&oacute;n neuro</td><td>Ensemble 109 | Stacking 107 | Prophet 78 | DeepAR 39</td></tr>',
     false, 'neuro W37 en tabla pasa'],
    ['<p>Distribución neuro: DeepAR 98, Prophet 94, Ensemble 85, Stacking 56.</p>', true,
     'neuro de la ronda anterior se marca'],
    ['<td>Distribución Dengue</td><td>DeepAR 53 | Prophet 46 (asignación W37)</td></tr>', false,
     'Dengue W37 pasa (NBGLM con 0 no cuenta)'],
    ['<td>Distribución Dengue</td><td>Prophet 48 | DeepAR 29 | NB-GLM 22</td></tr>', true,
     'Dengue con NB-GLM se marca'],
    ['<p>Distribución productiva actual: <span class="b">DeepAR 98</span> <span>Prophet 94</span></p>',
     true, 'insignias del reporte rancias se marcan'],
    ['<h3>Distribución de modelos por tipo</h3><p>sin cifras de motor</p>', false,
     'un título sin cifras de motor no se marca'],
    ['<!-- Distribución neuro: DeepAR 98, Prophet 94 </p> -->', false, 'comentario no se marca'],
  ];
  for (const [html, debe, desc] of casos) {
    const r = problemasDeDistribuciones('x.html', html, kb);
    const ok = (r.length > 0) === debe;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  distribución · ${desc}`);
    if (!ok) console.log(`           → ${JSON.stringify(r)}`);
  }
}

// --- Métricas de selección W28–W37 retiradas: knowledge.json ---------------------------
{
  const DECL = { publicadas: false, ventana: 'W28–W37', rotulo: 'diagnóstico de selección W28–W37; no evaluación independiente' };
  const limpio = () => ({
    metricas_seleccion: { ...DECL },
    definiciones: { SMAPE: 'error porcentual simétrico', MASE: 'error escalado' },
    stats: { total_modelos: 333, por_pad: { Depresion: { n: 111, motor_ganador: 'DeepAR' } }, validacion_semanal: { error_abs_medio: 12.4 } },
    prod_models: [{ padecimiento: 'Depresion', entidad: 'Jalisco', modelo_produccion: 'DeepAR', casos_52_semanas_futuro: 10 }],
    weekly_comparison: { Depresion: { semanas: [{ semana: 1, real: 3, pronostico: 4, error_pct: 33.3 }] } },
  });
  const con = (f) => { const k = limpio(); f(k); return k; };
  // La misma regla que el generador, aplicada al knowledge.json EN DISCO: el despojado pasa sea
  // cual sea el estado del archivo (control negativo que no depende de que el generador ya corrió).
  const despoja = (kb) => {
    const anda = (o) => Array.isArray(o) ? o.map(anda) : (o && typeof o === 'object'
      ? Object.fromEntries(Object.entries(o).filter(([k]) => !esClaveDeMetrica(k)).map(([k, v]) => [k, anda(v)])) : o);
    const out = {};
    for (const [k, v] of Object.entries(kb)) if (k !== 'rendimiento_2026') out[k] = k === 'definiciones' ? v : anda(v);
    return { ...out, metricas_seleccion: { ...DECL } };
  };
  const enDisco = JSON.parse(readFileSync(new URL('../../knowledge.json', import.meta.url), 'utf-8'));
  const casos = [
    [limpio(), false, 'declarado y sin métricas pasa (definiciones y error_pct/error_abs se quedan)'],
    [despoja(enDisco), false, 'el knowledge.json en disco, despojado con la regla del generador, pasa'],
    [con((k) => { delete k.metricas_seleccion; }), true, 'sin la declaración se marca'],
    [con((k) => { k.metricas_seleccion.publicadas = true; }), true, 'publicadas:true se marca'],
    [con((k) => { k.stats.smape_prod_median = 20.4; }), true, 'stats.smape_prod_median se marca'],
    [con((k) => { k.prod_models[0].mase_prod = 0.57; }), true, 'prod_models[].mase_prod se marca'],
    [con((k) => { k.stats.top5_smape = []; }), true, 'stats.top5_smape (ranking por métrica) se marca'],
    [con((k) => { k.stats.precision_historica_mean = 91.3; }), true, 'precision_historica_* se marca'],
    [con((k) => { k.dengue = { smape_nacional: 20.4 }; }), true, 'dengue.smape_nacional se marca'],
    [con((k) => { k.rendimiento_2026 = { anio: 2026 }; }), true, 'rendimiento_2026 se marca'],
    [con((k) => { k.stats.por_pad.Depresion.por_sexo = { general: { RMSE_prod_mean: 8 } }; }), true,
     'a cualquier profundidad y sin importar mayúsculas'],
  ];
  for (const [kb, debe, desc] of casos) {
    const r = problemasDeMetricasSeleccion(kb);
    const ok = (r.length > 0) === debe;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  métricas · ${desc}`);
    if (!ok) console.log(`           → ${JSON.stringify(r.slice(0, 3))}`);
  }
  // Cada clave sobreviviente es UN problema con su ruta (para arreglarla en el generador).
  const r = problemasDeMetricasSeleccion(con((k) => { k.prod_models[0].smape_prod = 1; k.prod_models[0].mae_prod = 2; }));
  const ok = r.length === 2 && r.every((p) => p.startsWith('prod_models[0].'));
  if (!ok) fallos++;
  console.log(`  ${ok ? '✔' : '✖ FALLO'}  métricas · un problema por clave, con su ruta (${r.length}, esperado 2)`);
}

// --- Métricas de selección W28–W37 retiradas: vistas operativas -------------------------
{
  const casos = [
    // Lo que había en index.html y Reports/index.html antes del retiro (debe marcarse).
    ['<span class="disease-tag">CIE-10: F32 · SMAPE 16.1% · MASE 0.57 · 111 modelos</span>', true, 'insignia SMAPE/MASE'],
    ['<p>SMAPE mediano del 16.1% y MASE de 0.57. 100% datos suficientes.</p>', true, 'SMAPE mediano del … / MASE de …'],
    ['<span class="disease-tag">CIE-10: A97 · SMAPE nac. 20.4% · DeepAR + Prophet</span>', true, 'SMAPE nac. …%'],
    ['<p><b>Dengue</b>: SMAPE nacional de 20.4%, con DeepAR</p>', true, 'SMAPE nacional de …%'],
    ['<div class="edl-stat"><b>&lt; 1.0</b><span>MASE · superan baseline naive</span></div>', true, '«< 1.0 MASE» con entidades'],
    ['<tr><th>Padecimiento</th><th>SMAPE mediano</th><th>MASE mediano</th></tr>', true, 'columna de métrica en tabla'],
    ["          '<span class=\"hf-chip\">SMAPE <b>' + s.smape + '%</b></span>' +", true, 'chip JS que concatena s.smape'],
    ["text: [s.smape != null ? `SMAPE ${s.smape}%` : null, s.mase != null ? `MASE ${s.mase}` : null]", true, 'subtítulo JS con ${s.smape}'],
    // Lo que queda tras el retiro (no debe marcarse).
    ['<p>Se elige el motor productivo por SMAPE, con MASE como desempate, en la ventana de selección W28–W37.</p>', false,
     'mencionar el criterio de selección sin valores'],
    ['<button data-q="que es el smape">¿Qué es el SMAPE?</button>', false, 'pregunta de definición'],
    ['<!-- antes: SMAPE 16.1% · MASE 0.57 -->', false, 'comentario no se marca'],
    ['    .semaforo-card-smape { font-size: 9px; font-family: monospace; }', false, 'selector CSS con «smape»'],
    ['subtitle: { display: corteTxt != null, text: corteTxt }, // corte del modelo: semana 37 de 2026', false,
     'rótulo del corte del modelo'],
    ['<span class="cc-kpi-lbl" id="statSmapeLbl">Series productivas</span>', false, 'id con «Smape» sin valor'],
    ['<span class="disease-tag">CIE-10: G30 · SMAPE alto por baja incidencia</span>', false,
     'un código (G30) antes de la métrica no es un valor'],
  ];
  for (const [html, debe, desc] of casos) {
    const r = problemasDeMetricasEnPagina('x.html', html);
    const ok = (r.length > 0) === debe;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  página · ${desc}`);
    if (!ok) console.log(`           → ${JSON.stringify(r)}`);
  }
}

// --- Galería publicada: la lista DATA (ronda W37, 444 → 432) ----------------------------
{
  const neuro = Array.from({ length: 333 }, (_, i) => ({ p: 'Depresión', f: `Depresión/E${i}/a.png` }));
  const dengue = Array.from({ length: 99 }, (_, i) => ({ p: 'Dengue', f: `dengue/E${i}/b.png` }));
  const html = (items) => `<script>\nconst DATA = ${JSON.stringify(items)};\n</script>`;
  const kb = (n) => ({ rosters: { gallery_items: n } });
  const todo = () => true;
  const regiones = Array.from({ length: 12 }, (_, i) => ({ p: 'Dengue', f: `dengue/Region_${i}/c.png` }));
  const casos = [
    [html([...neuro, ...dengue]), kb(432), todo, false, '333 + 99 con sus PNG y knowledge 432 pasa'],
    [html([...neuro, ...dengue, ...regiones]), kb(444), todo, true, 'las 12 regiones de dengue se marcan (444)'],
    [html([...neuro, ...dengue]), kb(444), todo, true, 'knowledge 444 con galería 432 se marca'],
    [html([...neuro, ...dengue]), kb(432), (f) => f !== 'dengue/E3/b.png', true, 'una tarjeta sin PNG se marca'],
    [html([...neuro, ...dengue, dengue[0]]), kb(433), todo, true, 'un gráfico repetido se marca'],
    ['<html></html>', kb(432), todo, true, 'sin la línea DATA se marca'],
  ];
  for (const [h, k, existe, debe, desc] of casos) {
    const r = problemasDeGaleria(h, k, existe).problemas;
    const ok = (r.length > 0) === debe;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  galería · ${desc}`);
    if (!ok) console.log(`           → ${JSON.stringify(r.slice(0, 3))}`);
  }
  const ok = problemasDeCifras([{ id: 'c', text: 'La galería tiene 444 gráficos publicados.' }]).length === 1;
  if (!ok) fallos++;
  console.log(`  ${ok ? '✔' : '✖ FALLO'}  marca     corpus · «444 gráficos» es cifra retirada`);
}

// --- Métricas antiguas (otro origen, no W28–W37): páginas y news.json --------------------
{
  const paginas = [
    ['<div class="kpi-label">SMAPE mediano (producción)</div>', true, 'KPI con métrica (EpiDashboard 51.1 %)'],
    ['<div class="kpi-label">Motor ganador</div>', true, '«Motor ganador»'],
    ['<p>generados por el mejor modelo disponible</p>', true, '«mejor modelo»'],
    ['<span class="label">Mejor SMAPE (DeepAR)</span>', true, '«Mejor SMAPE»'],
    ['<p class="section-sub">Promedio de métricas. Menor es mejor. Celda verde = ganador.</p>', true, 'ranking de celdas'],
    ['<thead><tr><th class="c-prophet">RMSE Prophet</th></tr></thead>', true, 'columna de métrica'],
    ['<p>generados por el motor asignado a cada combinación</p>', false, 'motor asignado no es ranking'],
    ['<p>Las métricas de error y los rankings de motores de rondas anteriores no forman parte de los resultados verificados.</p>', false,
     'el aviso del retiro no se marca'],
  ];
  for (const [html, debe, desc] of paginas) {
    const r = problemasDeMetricasAntiguas('x.html', html);
    const ok = (r.length > 0) === debe && r.every((p) => !p.includes('W28–W37'));
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  métrica antigua · ${desc}`);
    if (!ok) console.log(`           → ${JSON.stringify(r)}`);
  }
  const nota = (body, extra = {}) => ({ items: [{ title: 't', body: [body], ...extra }] });
  const noticias = [
    [nota('el total pronosticado se desvía del realmente observado en <strong>+2.9&#37; en Depresión</strong>'), true,
     'desviación del acumulado de la nota semanal'],
    [nota('Precisión (<strong>SMAPE / MASE</strong>): Depresión <strong>8.7&#37; / 0.59</strong>'), true,
     'SMAPE / MASE con valores separados por etiquetas'],
    [nota('El SMAPE agregado del motor productivo bajó de 92.8 a 82.2 (121 series mejoran).'), true,
     'SMAPE agregado con valores en la frase'],
    [nota('NB-GLM (el nuevo motor de conteos, el mejor en validación)'), true, '«el mejor en validación»'],
    [nota('Se integró el Boletín SINAVE hasta la semana 33 de 2026 en los cuatro padecimientos.', { historico: true }), true,
     'histórica sin nota_historica'],
    [nota('Se integró el Boletín SINAVE hasta la semana 33 de 2026.', { historico: true, nota_historica: 'Anterior a W37.' }), false,
     'semana integrada con su nota histórica'],
    [nota('Se reevaluaron contra los datos reales del Boletín SINAVE 2026 (SMAPE 2026 como criterio primario, MASE como desempate).'), false,
     '«SMAPE 2026» nombra un año, no un valor'],
    [nota('En depresión el error fue de <strong>5.0&#37;</strong> en esas ocho semanas.'), false,
     'resultado sellado del póster WCP (sin métrica nombrada) se conserva'],
  ];
  for (const [news, debe, desc] of noticias) {
    const r = problemasDeNoticias(news);
    const ok = (r.length > 0) === debe;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  news.json · ${desc}`);
    if (!ok) console.log(`           → ${JSON.stringify(r)}`);
  }
}

// --- Seguimiento del pronóstico con corte (ronda W37, 14-oct-2026) -----------------------
{
  const DEF = 'incremento neto del acumulado por sexo, sujeto a revisiones';
  const sem = (s, extra) => ({ anio: 2026, semana: s, etiqueta: `2026-W${String(s).padStart(2, '0')}`,
    periodo_inicio: inicioSemanaEpi(2026, s), periodo_fin: new Date(Date.parse(inicioSemanaEpi(2026, s)) + 6 * 864e5).toISOString().slice(0, 10), ...extra });
  const kbOk = () => ({
    weekly_comparison: { Depresion: { version: 2, titulo: 'Seguimiento del pronóstico con corte W37', corte: '2026-W37', semanas: [
      sem(37, { fase: 'observado', real: 3181 }),
      sem(38, { fase: 'seguimiento', corte: '2026-W37', horizonte: 1, pronostico: 3118, real: 2748, estado: 'par', motivo: '', error_abs: 370, diferencia: 370 }),
      sem(39, { fase: 'seguimiento', corte: '2026-W37', horizonte: 2, pronostico: 3136, real: null, estado: 'ausente', motivo: 'revisión' }),
      sem(40, { fase: 'pronostico', corte: '2026-W37', horizonte: 3, pronostico: 3140, real: null, prophet: 1587 }),
    ] } },
    seguimiento_post_corte: {
      corte: { etiqueta: '2026-W37' },
      definiciones: { general: 'casos de la semana (Casos_semana)', sexo_agregado: DEF },
      semanas: [{ etiqueta: '2026-W38', cohortes: { neuro: { ausentes: 1, nacional: [
        { padecimiento: 'Depresion', sexo: 'general', pronostico: 3118, real: 2748, definicion_real: 'casos de la semana (Casos_semana)' },
        { padecimiento: 'Parkinson', sexo: 'hombres', pronostico: 86, real: 85, definicion_real: DEF },
      ] } } }],
      agregacion_sexo: [{ semana_objetivo: '2026-W38', semana_previa: '2026-W37', padecimiento: 'Parkinson', sexo: 'hombres', definicion_real: DEF,
        entidades_semana: 32, entidades_semana_previa: 32, semanas_consecutivas: true, acumulado_semana_previa: 1148, acumulado_semana: 1233,
        neto: 85, real_publicado: 85, suma_estatal_recortada: 87, entidades_con_revision_negativa: { Tamaulipas: -2 } }],
      ausentes: [{ semana_objetivo: '2026-W38', padecimiento: 'Depresion', entidad: 'Tabasco', sexo: 'mujeres', pronostico: 47, real: null, motivo: 'revisión negativa' }],
    },
    prod_models: [{ padecimiento: 'Parkinson', entidad: 'Nacional', sexo: 'hombres', semana_validacion: '2026-W39', definicion_realidad_validacion: DEF }],
  });
  const con = (f) => { const k = kbOk(); f(k); return k; };
  const w = (k, s) => k.weekly_comparison.Depresion.semanas.find((x) => x.semana === s);
  const casosSeg = [
    [kbOk(), false, 'v2 con pares, ausente y pronóstico pasa'],
    [con((k) => { delete k.weekly_comparison.Depresion.version; }), true, 'tabla sin versión 2 (la anterior)'],
    [con((k) => { w(k, 37).pronostico = 3175; }), true, 'semana anterior al corte con pronóstico (ajuste dentro de muestra)'],
    [con((k) => { w(k, 37).ensemble = 3175; }), true, 'semana anterior al corte con el valor de un motor'],
    [con((k) => { w(k, 38).fecha = '2026-09-07'; }), true, 'ds legado como «fecha»'],
    [con((k) => { w(k, 38).periodo_inicio = '2026-09-07'; w(k, 38).periodo_fin = '2026-09-13'; }), true, 'el ds legado como inicio del periodo'],
    [con((k) => { w(k, 39).real = 0; }), true, 'un ausente convertido en cero'],
    [con((k) => { w(k, 39).diferencia = 3136; }), true, 'un ausente con diferencia'],
    [con((k) => { w(k, 38).pronostico = 3136; w(k, 38).diferencia = 388; w(k, 38).error_abs = 388; }), true, 'el par no es el del seguimiento (pronóstico de otra semana)'],
    [con((k) => { w(k, 38).horizonte = 2; }), true, 'horizonte mal contado desde el corte'],
    [con((k) => { k.weekly_comparison.Depresion.titulo = 'Real vs Pronóstico 2026'; }), true, 'título anterior'],
    [con((k) => { w(k, 40).real = 3000; }), true, 'semana de pronóstico con observado'],
  ];
  for (const [kb, debe, desc] of casosSeg) {
    const r = problemasDeSeguimientoSemanal(kb);
    const ok = (r.length > 0) === debe;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  tabla del EpiBot · ${desc}`);
    if (!ok) console.log(`           → ${JSON.stringify(r)}`);
  }
  const a = (k) => k.seguimiento_post_corte.agregacion_sexo[0];
  const casosSexo = [
    [kbOk(), false, 'neto rotulado, 32/32, consecutivas y ausentes con motivo pasa'],
    [con((k) => { k.seguimiento_post_corte.semanas[0].cohortes.neuro.nacional[1].real = 87; a(k).real_publicado = 87; }), true,
     'se publica la suma estatal recortada (87) en vez del neto (85)'],
    [con((k) => { k.seguimiento_post_corte.semanas[0].cohortes.neuro.nacional[1].definicion_real = 'casos nuevos'; }), true,
     'el nacional por sexo sin el rótulo del incremento neto'],
    [con((k) => { a(k).entidades_semana_previa = 31; }), true, 'cobertura incompleta en la semana previa'],
    [con((k) => { a(k).semanas_consecutivas = false; }), true, 'semanas no consecutivas'],
    [con((k) => { k.seguimiento_post_corte.ausentes[0].real = 0; }), true, 'un ausente estatal convertido en cero'],
    [con((k) => { k.seguimiento_post_corte.ausentes = []; }), true, 'los ausentes estatales no se conservan'],
    [con((k) => { delete k.prod_models[0].definicion_realidad_validacion; }), true, 'la tabla publica el nacional por sexo sin rótulo'],
  ];
  for (const [kb, debe, desc] of casosSexo) {
    const r = problemasDeNacionalPorSexo(kb);
    const ok = (r.length > 0) === debe;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  nacional por sexo · ${desc}`);
    if (!ok) console.log(`           → ${JSON.stringify(r)}`);
  }
  const vistas = [
    ['epibot/js/kb.js', "lines.push(`**${p} — Real vs Pronostico ${anio}**`);", true, 'título anterior, también sin tilde'],
    ['epibot/js/kb.js', "lines.push(`**${p} — Real vs Pronóstico ${anio}**`);", true, 'título anterior'],
    ['epibot/js/kb.js', "lines.push('| Semana | Inicio | Real |');", true, 'columna Inicio'],
    ['epibot/js/kb.js', "lines.push('Precisión **excelente**: el error total es menor al 5%.');", true, 'calificación automática'],
    ['epibot/js/app.js', "title: 'Corredor de confianza'", true, 'dispersión como confianza'],
    ['epibot/js/kb.js', "const triggers = ['real vs pronostico', 'acierto semanal'];", false, 'los disparadores en minúsculas no son texto visible'],
    ['validacion_semanal.html', '<span>EXCELENTE</span>', true, 'veredicto en la página'],
    ['validacion_semanal.html', `<p>${DEF}</p><h2>Pares ausentes y sus motivos</h2><h2>Nacional por sexo: definicion</h2>`, false,
     'página con el rótulo, los ausentes y la definición'],
    ['validacion_semanal.html', '<h2>Pares ausentes y sus motivos</h2>', true, 'página sin el rótulo del nacional por sexo'],
  ];
  for (const [arch, txt, debe, desc] of vistas) {
    const r = problemasDeVistasSeguimiento(arch, txt);
    const ok = (r.length > 0) === debe;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  vistas · ${desc}`);
    if (!ok) console.log(`           → ${JSON.stringify(r)}`);
  }
  const ok = inicioSemanaEpi(2026, 38) === '2026-09-20' && inicioSemanaEpi(2026, 1) === '2026-01-04' && inicioSemanaEpi(2025, 1) === '2024-12-29';
  if (!ok) fallos++;
  console.log(`  ${ok ? '✔' : '✖ FALLO'}  calendario · semana 38 de 2026 empieza el 20 de septiembre; la 1 de 2025, el 29 de diciembre de 2024`);
}

console.log(fallos ? `\n✖ ${fallos} prueba(s) fallaron` : '\n✔ Todas las pruebas pasan');
process.exit(fallos ? 1 : 0);
