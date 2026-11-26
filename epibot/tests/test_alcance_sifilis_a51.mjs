/**
 * Preparación acotada de Sífilis adquirida (A51-A53), control estacional autorizado nominalmente por el autor
 * («autorizo publicar el control») tras el rechazo del portafolio en la prueba única de 2025
 * (sifilis_adquirida_a51_benchmark_test_73490ea8b2b5_749316ac335e).
 *
 * Usa un fixture sintético propio en memoria (sin instalar release, catálogo, punteros ni vistas en publication/),
 * para verificar antes y después:
 *  - alcance positivo en español, inglés, etapas clínicas de A51-A53 y códigos/subcódigos CIE-10;
 *  - «sífilis» / «syphilis» / «lúes» a secas piden precisar sin dar cifras;
 *  - sífilis congénita (A50, incluidas precoz/tardía/latente/neurosífilis juvenil), sífilis en el embarazo (O98.1),
 *    sífilis no venérea (A65), frambesia (A66), otras ITS (A54-A64) y códigos ajenos o contradictorios nunca reciben
 *    cifras de A51-A53;
 *  - seguimientos conversacionales (herencia válida estado/sexo y bloqueo hacia congénita o embarazo en ES/EN);
 *  - ausencia de consejo médico individual y prioridad de la guarda de crisis;
 *  - paridad en el núcleo de rag.mjs (estadoDeControl por autorización del autor, hechosDeFoco/notasFicha, alcance);
 *  - integridad y divulgaciones obligatorias (K6, D1, FABLE_POSTTEST, H1, H3) en sifilis_adquirida_a51.html, sin IDs,
 *    fechas de emisión ni ventanas de gate fabricadas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const raiz = new URL('../../', import.meta.url);
const leer = (rel) => readFileSync(new URL(rel, raiz), 'utf-8');

// Fixture en memoria con la cadena y cronología reales selladas en BUILD_RESULTADO.json y
// QA_A51_OBSERVACION44_STRICT.json (sin instalar todavía artefactos en publication/).
const VISTA_FIXTURE = Object.freeze({
  schema: 'publication_view.v1',
  disease_id: 'sifilis_adquirida_a51',
  release_id: 'sifilis_adquirida_a51_release_a18527def134',
  observation_dataset_id: 'sifilis_adquirida_a51_eaca7efc1a11',
  display_name: 'Sífilis adquirida',
  nombre_completo: 'Sífilis adquirida (A51-A53)',
  color: '#0F766E',
  origin: [2026, 42],
  observation_cutoff: [2026, 43],
  observation_cutoff_ds: '2026-10-26',
  forecast_emitted_at: '2026-11-17T01:32:25.156213+00:00',
  horizon_weeks: 52,
  models: 64,
  products: 111,
  engines: { seasonal_naive_lag52: 64 },
  verdict: 'INCOMPLETE',
  weeks_available: 1,
  weeks_required: 4,
  publication_label:
    'Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos',
  uncertainty_label: 'Pronóstico puntual sin intervalos de incertidumbre',
  caida_al_control: {
    fold: 'test_2025',
    motor: 'seasonal_naive_lag52',
    resultado: 'fallback_control',
    comprobaciones: [
      { ambito: 'smape_bases', portafolio: 66.44522816331062, control: 76.36659902551855, pasa: true },
      { ambito: 'smape_all', portafolio: 61.04661503419355, control: 64.15224882899078, pasa: true },
      { ambito: 'smape_nacional_general', portafolio: 25.487672321889875, control: 19.95637653797039, pasa: false },
    ],
  },
  series: {
    'nacional|mx|general': {
      id: 'mx', nivel: 'nacional', nombre: 'Nacional', sexo: 'general', sexo_nombre: 'General', motor: 'portfolio',
      observado: [['2026-10-12', 410], ['2026-10-19', 425]],
      pronostico: [['2026-10-26', 402], ['2026-11-02', 398], ['2026-11-09', 415], ['2026-11-16', 405]],
      pronostico_52_total: 20950,
      oos: { semanas: 0, smape: null, mae: null, sesgo_pct: null, observado_total: 0, pronostico_total: 0 },
    },
    'nacional|mx|hombres': {
      id: 'mx', nivel: 'nacional', nombre: 'Nacional', sexo: 'hombres', sexo_nombre: 'Hombres', motor: 'portfolio',
      observado: [['2026-10-12', 235], ['2026-10-19', 245]],
      pronostico: [['2026-10-26', 230], ['2026-11-02', 228], ['2026-11-09', 240], ['2026-11-16', 232]],
      pronostico_52_total: 11963,
      oos: { semanas: 0, smape: null, mae: null, sesgo_pct: null, observado_total: 0, pronostico_total: 0 },
    },
    'nacional|mx|mujeres': {
      id: 'mx', nivel: 'nacional', nombre: 'Nacional', sexo: 'mujeres', sexo_nombre: 'Mujeres', motor: 'portfolio',
      observado: [['2026-10-12', 175], ['2026-10-19', 180]],
      pronostico: [['2026-10-26', 172], ['2026-11-02', 170], ['2026-11-09', 175], ['2026-11-16', 173]],
      pronostico_52_total: 8987,
      oos: { semanas: 0, smape: null, mae: null, sesgo_pct: null, observado_total: 0, pronostico_total: 0 },
    },
    'estado|14|general': {
      id: '14', nivel: 'estado', nombre: 'Jalisco', sexo: 'general', sexo_nombre: 'General', motor: 'portfolio',
      observado: [['2026-10-12', 38], ['2026-10-19', 41]],
      pronostico: [['2026-10-26', 36], ['2026-11-02', 35], ['2026-11-09', 39], ['2026-11-16', 37]],
      pronostico_52_total: 1890,
      oos: { semanas: 0, smape: null, mae: null, sesgo_pct: null, observado_total: 0, pronostico_total: 0 },
    },
    'estado|14|hombres': {
      id: '14', nivel: 'estado', nombre: 'Jalisco', sexo: 'hombres', sexo_nombre: 'Hombres', motor: 'seasonal_naive_lag52',
      observado: [['2026-10-12', 24], ['2026-10-19', 26]],
      pronostico: [['2026-10-26', 22], ['2026-11-02', 21], ['2026-11-09', 25], ['2026-11-16', 23]],
      pronostico_52_total: 1150,
      oos: { semanas: 0, smape: null, mae: null, sesgo_pct: null, observado_total: 0, pronostico_total: 0 },
    },
    'estado|14|mujeres': {
      id: '14', nivel: 'estado', nombre: 'Jalisco', sexo: 'mujeres', sexo_nombre: 'Mujeres', motor: 'seasonal_naive_lag52',
      observado: [['2026-10-12', 14], ['2026-10-19', 15]],
      pronostico: [['2026-10-26', 14], ['2026-11-02', 14], ['2026-11-09', 14], ['2026-11-16', 14]],
      pronostico_52_total: 740,
      oos: { semanas: 0, smape: null, mae: null, sesgo_pct: null, observado_total: 0, pronostico_total: 0 },
    },
    'estado|26|general': {
      id: '26', nivel: 'estado', nombre: 'Sonora', sexo: 'general', sexo_nombre: 'General', motor: 'portfolio',
      observado: [['2026-10-12', 16], ['2026-10-19', 18]],
      pronostico: [['2026-10-26', 15], ['2026-11-02', 14], ['2026-11-09', 17], ['2026-11-16', 16]],
      pronostico_52_total: 790,
      oos: { semanas: 0, smape: null, mae: null, sesgo_pct: null, observado_total: 0, pronostico_total: 0 },
    },
    'estado|26|hombres': {
      id: '26', nivel: 'estado', nombre: 'Sonora', sexo: 'hombres', sexo_nombre: 'Hombres', motor: 'seasonal_naive_lag52',
      observado: [['2026-10-12', 7], ['2026-10-19', 8]],
      pronostico: [['2026-10-26', 7], ['2026-11-02', 6], ['2026-11-09', 8], ['2026-11-16', 7]],
      pronostico_52_total: 350,
      oos: { semanas: 0, smape: null, mae: null, sesgo_pct: null, observado_total: 0, pronostico_total: 0 },
    },
    'estado|26|mujeres': {
      id: '26', nivel: 'estado', nombre: 'Sonora', sexo: 'mujeres', sexo_nombre: 'Mujeres', motor: 'seasonal_naive_lag52',
      observado: [['2026-10-12', 9], ['2026-10-19', 10]],
      pronostico: [['2026-10-26', 8], ['2026-11-02', 8], ['2026-11-09', 9], ['2026-11-16', 9]],
      pronostico_52_total: 440,
      oos: { semanas: 0, smape: null, mae: null, sesgo_pct: null, observado_total: 0, pronostico_total: 0 },
    },
  },
});

const K = leer('epibot/knowledge.json');
globalThis.fetch = async (u) => {
  const s = String(u);
  const v = s.match(/publication\/([a-z0-9_]+)\/vista\.json/);
  if (v) {
    if (v[1] === 'sifilis_adquirida_a51') return { ok: true, json: async () => VISTA_FIXTURE };
    const ruta = new URL(`publication/${v[1]}/vista.json`, raiz);
    if (existsSync(ruta)) return { ok: true, json: async () => JSON.parse(readFileSync(ruta, 'utf-8')) };
    return { ok: false, json: async () => null };
  }
  const b = s.match(/(assets\/boletin\/[^?]+\.json)/);
  if (b) {
    const ruta = new URL(b[1], raiz);
    if (!existsSync(ruta)) return { ok: false, json: async () => null };
    const j = JSON.parse(readFileSync(ruta, 'utf-8'));
    if (Array.isArray(j.diseases)) {
      j.diseases = j.diseases.map((e) => (e.code && e.code.startsWith('A51')
        ? { ...e, platform_id: 'sifilis_adquirida_a51', status: 'Control publicado' }
        : e));
    }
    return { ok: true, json: async () => j };
  }
  if (s.includes('knowledge.json')) return { ok: true, json: async () => JSON.parse(K) };
  return { ok: false, json: async () => null };
};

const kb = await import('../js/kb.js');
const { detectEntities, norm } = await import('../js/entities.js');
const { aliasAmbiguo, mencionaNoModelada, releaseDeId, subtipoAjeno } = await import('../js/release_config.js');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;

async function conversa(...qs) {
  kb._resetContext();
  let r;
  for (const q of qs) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}

const SIN_CIFRAS_A51 = (md, q) => {
  assert.doesNotMatch(md, /SIFILIS_ADQUIRIDA_A51|MAL_DEL_PINTO_A67/, q);
  assert.doesNotMatch(md, /casos pronosticados|Pronóstico \*\*congelado\*\*/, q);
};

test('catálogo (B1): fila sifilis_adquirida_a51 registrada como control por autorización del autor con cronología real', async () => {
  const r = releaseDeId('sifilis_adquirida_a51');
  assert.ok(r, 'falta sifilis_adquirida_a51 en release_catalog.js');
  assert.equal(r.pad, 'Sífilis adquirida');
  assert.equal(r.etiqueta, 'Sífilis adquirida (A51-A53)');
  assert.equal(r.cie, 'A51-A53');
  assert.equal(r.pagina, 'sifilis_adquirida_a51.html');
  assert.equal(r.marca, 'SIFILIS_ADQUIRIDA_A51');
  assert.equal(Boolean(r.controlDelegado), false, 'es autorización nominal directa del autor, no delegación');
  assert.equal(r.controlEstatalPocoInformativo, true);
  assert.ok(!r.alias.includes('sifilis') && !r.alias.includes('syphilis'), '«sífilis» a secas nunca va en alias');
  assert.equal(typeof r.cronologia, 'string', 'B1: falta campo cronologia en la fila sifilis_adquirida_a51');
  assert.match(r.cronologia, /2026-W42/);
  assert.match(r.cronologia, /2026-11-17T01:32:25\.156213\+00:00/);
  assert.match(r.cronologia, /01:23:31\.237010/);
  assert.match(r.cronologia, /5987a061/);
  assert.match(r.cronologia, /2026-W43/);
  assert.match(r.cronologia, /no cuenta como prospectiv|no es prospectiv/i);
  assert.match(r.cronologia, /52 semanas desde el origen/);
  assert.match(r.cronologia, /sifilis_adquirida_a51_eaca7efc1a11/);
  assert.match(r.cronologia, /INCOMPLETE/);
  assert.match(r.cronologia, /CONTROL_ONLY/);
  assert.doesNotMatch(r.cronologia, /validación en curso|en validación/i);
  const { md } = await conversa('sífilis adquirida en Jalisco');
  assert.ok(md.includes(r.cronologia), 'answerObesidad debe imprimir r.cronologia igual que asma');
});

const POSITIVOS = [
  'sífilis adquirida en Jalisco',
  'sifilis adquirida en Sonora',
  'pronóstico de sífilis adquirida',
  'acquired syphilis in Jalisco',
  'A51 en Jalisco',
  'A52 en Sonora',
  'A53 en Jalisco',
  'A51-A53 en Jalisco',
  'A51.0 en Jalisco',
  'A51.3 en Sonora',
  'A51.5 en Jalisco',
  'A52.1 en Jalisco',
  'A53.0 en Jalisco',
  'A53.9 en Sonora',
  // Decimoctava auditoría: un dígito separado por espacio tras el código ya no se toma como subcódigo («a51 0» queda fuera
  // de vocabulario; ver test_vocab19_codex_b44.mjs); la forma con punto o compacta sí resuelve.
  'a51.0 en jalisco',
  'A510 en Jalisco',
  'sífilis A51 en Jalisco',
  'sífilis precoz en Jalisco',
  'sífilis temprana en Sonora',
  'sífilis primaria en Jalisco',
  'sífilis genital primaria en Jalisco',
  'sífilis secundaria en Sonora',
  'sífilis tardía en Jalisco',
  'sífilis terciaria en Jalisco',
  'sífilis latente en Sonora',
  'sífilis cardiovascular en Jalisco',
  'neurosífilis en Jalisco',
  'early syphilis in Jalisco',
  'primary syphilis in Jalisco',
  'secondary syphilis in Sonora',
  'late syphilis in Jalisco',
  'tertiary syphilis in Jalisco',
  'latent syphilis in Jalisco',
  'neurosyphilis in Jalisco',
];

for (const q of POSITIVOS) {
  test(`positivo A51-A53: «${q}» resuelve a Sífilis adquirida como control no validado`, async () => {
    assert.equal(mencionaNoModelada(norm(q)), null, `no debe marcarse no modelada: ${q}`);
    assert.equal(aliasAmbiguo(norm(q)), null, `no debe marcarse ambigua: ${q}`);
    assert.equal(detectEntities(q).padecimiento, 'Sífilis adquirida', q);
    const { handler, md } = await conversa(q);
    assert.equal(handler, 'answerObesidad', q);
    assert.match(md, /SIFILIS_ADQUIRIDA_A51/, q);
    assert.match(md, /control estacional, no validado/, q);
    assert.match(md, /25\.5 frente a 20\.0 del control/, q);
    assert.match(md, /76\.4 en las series por estado y sexo/, q);
    assert.match(md, /Por estado es una referencia poco informativa/, q);
    assert.doesNotMatch(md, /Validación prospectiva en curso|validación en curso|en validación|\bPASS\b|aceptad[oa] en su prueba/i, q);
  });
}

const AMBIGUOS = [
  'sífilis en Jalisco',
  'pronóstico de sífilis',
  'casos de sífilis en México',
  'syphilis in Jalisco',
  'syphilis forecast in Sonora',
  'lúes en Jalisco',
  'Treponema pallidum en Jalisco',
  'chancro en Jalisco',
];

for (const q of AMBIGUOS) {
  test(`ambiguo: «${q}» pide precisar sin cifras`, async () => {
    const amb = aliasAmbiguo(norm(q));
    assert.ok(amb, `aliasAmbiguo(${q})`);
    const { handler, md } = await conversa(q);
    assert.equal(handler, 'answerAliasAmbiguo', q);
    assert.match(md, /A51/, q);
    assert.match(md, /A50|A57/, q);
    SIN_CIFRAS_A51(md, q);
  });
}

test('«treponematosis» pide precisar entre sífilis adquirida (A51-A53) y mal del pinto (A67)', async () => {
  const { handler, md } = await conversa('treponematosis en Jalisco');
  assert.equal(handler, 'answerAliasAmbiguo');
  assert.match(md, /«sífilis adquirida».*«mal del pinto»/s);
  SIN_CIFRAS_A51(md, 'treponematosis');
});

// alta_b44 (19-nov-2026): la sífilis congénita (A50), la gonocócica genitourinaria (A54.0-A54.2), el linfogranuloma (A55),
// el chancro blando (A57), la tricomoniasis urogenital (A59.0) y el herpes genital (A60.0) tienen release propio. Siguen sin
// recibir cifras de A51-A53, pero ya no son «no modelados»: se comprueban en VECINOS_PUBLICADOS_B44.
const VECINOS_PUBLICADOS_B44 = [
  'sífilis congénita en Jalisco',
  'sifilis congenita en Sonora',
  'sífilis congénita precoz en Jalisco',
  'sífilis congénita tardía en Jalisco',
  'sífilis congénita latente en Sonora',
  'neurosífilis congénita en Jalisco',
  'neurosífilis juvenil en Jalisco',
  'sífilis neonatal en Jalisco',
  'sífilis perinatal en Jalisco',
  'sífilis connatal en Jalisco',
  'sífilis fetal en Jalisco',
  'mortinato por sífilis en Jalisco',
  'congenital syphilis in Jalisco',
  'early congenital syphilis in Jalisco',
  'early congenital syphilis in newborns in Jalisco',
  'sífilis congénita en bebés en Jalisco',
  'late congenital syphilis in Sonora',
  'congenital neurosyphilis in Jalisco',
  'neonatal syphilis in Jalisco',
  'fetal syphilis in Jalisco',
  'syphilitic stillbirth in Sonora',
  'A50 en Jalisco',
  'A50.0 en Sonora',
  'A50.4 en Jalisco',
  'A50.9 en Jalisco',
  'a50 2 en jalisco',
  'A500 en Jalisco',
  'sífilis adquirida y congénita en Jalisco',
  'sífilis congénita y adquirida en Sonora',
  'gonorrea en Jalisco',
  'infección gonocócica en Sonora',
  'gonorrhea in Jalisco',
  'A54 en Jalisco',
  'A54.0 en Sonora',
  'linfogranuloma venéreo en Jalisco',
  'A55 en Jalisco',
  'chancro blando en Jalisco',
  'chancroide en Sonora',
  'chancroid in Jalisco',
  'A57 en Jalisco',
  'tricomoniasis en Jalisco',
  'A59 en Sonora',
  'herpes genital en Jalisco',
  'genital herpes in Jalisco',
  'A60 en Jalisco',
  'sífilis adquirida A50 en Jalisco',
];

for (const q of VECINOS_PUBLICADOS_B44) {
  test(`vecino publicado (alta_b44): «${q}» nunca recibe cifras de A51-A53`, async () => {
    if (!/adquirida/i.test(q)) assert.notEqual(detectEntities(q).padecimiento, 'Sífilis adquirida', q);
    const { md } = await conversa(q);
    // Puede recibir las cifras de SU release (A50, A54.0-A54.2, A55, A57, A59.0, A60.0), nunca las de A51-A53.
    assert.doesNotMatch(md, /SIFILIS_ADQUIRIDA_A51|MAL_DEL_PINTO_A67/, q);
    assert.doesNotMatch(md, /\*\*Sífilis adquirida \(A51-A53\) ·/, q);
  });
}

const AJENOS_NO_CUBIERTOS = [
  // O98.1: sífilis que complica embarazo, parto y puerperio (incluidos sustantivo intermedio y etapa neurológica)
  'sífilis en el embarazo en Jalisco',
  'sífilis en embarazadas en Sonora',
  'sífilis adquirida en mujeres embarazadas en Jalisco',
  'acquired syphilis in pregnant women in Jalisco',
  'neurosífilis en embarazadas en Jalisco',
  'sífilis materna en Jalisco',
  'sífilis gestacional en Jalisco',
  'maternal syphilis in Jalisco',
  'syphilis in pregnancy in Jalisco',
  'O98.1 en Jalisco',
  // A65 / A66: sífilis no venérea y frambesia
  'sífilis no venérea en Jalisco',
  'sífilis endémica en Jalisco',
  'bejel en Sonora',
  'nonvenereal syphilis in Jalisco',
  'A65 en Jalisco',
  'frambesia en Jalisco',
  'yaws in Jalisco',
  'A66 en Sonora',
  // A54-A64: otras infecciones de transmisión sexual vecinas del Cuadro 6
  'clamidia en Jalisco',
  'chlamydia in Jalisco',
  'A56 en Sonora',
  'granuloma inguinal en Jalisco',
  'A58 en Jalisco',
  'verrugas anogenitales en Jalisco',
  'A63 en Jalisco',
  'A64 en Jalisco',
  // Códigos CIE ajenos junto al nombre del bloque
  'sífilis adquirida A54 en Jalisco',
  'sífilis adquirida A65 en Jalisco',
  'sífilis adquirida A99 en Jalisco',
];

for (const q of AJENOS_NO_CUBIERTOS) {
  test(`no cubierto: «${q}» nunca recibe cifras de A51-A53`, async () => {
    const qn = norm(q);
    assert.ok(subtipoAjeno(qn) || mencionaNoModelada(qn), `debe detectarse ajeno/no modelado: ${q}`);
    assert.notEqual(detectEntities(q).padecimiento, 'Sífilis adquirida', q);
    const { md } = await conversa(q);
    SIN_CIFRAS_A51(md, q);
  });
}

const EDAD_MENORES_SIN_CONGENITA_EXPLICITA = [
  'early syphilis in newborns in Jalisco',
  'acquired syphilis in newborns in Jalisco',
  'primary syphilis in infants in Jalisco',
  'acquired syphilis in infants in Sonora',
  'secondary syphilis in babies in Jalisco',
  'acquired syphilis in babies in Jalisco',
  'sífilis en recién nacidos en Sonora',
  'sífilis del recién nacido en Jalisco',
  'sífilis precoz en bebés en Jalisco',
  'sífilis adquirida en bebés en Jalisco',
  'neurosífilis en lactantes en Jalisco',
  'sífilis adquirida en lactantes en Jalisco',
  'sífilis adquirida en niños en Jalisco',
  'sífilis adquirida en menores en Jalisco',
];

for (const q of EDAD_MENORES_SIN_CONGENITA_EXPLICITA) {
  test(`M2 edad/menores sin A50 explícita: «${q}» aclara ausencia de estratificación etaria y distingue A50 vs A51-A53 sin auto-clasificar como A50`, async () => {
    const qn = norm(q);
    assert.equal(subtipoAjeno(qn), null, `no debe clasificarse automáticamente como A50: ${q}`);
    const amb = aliasAmbiguo(qn);
    assert.ok(amb, `debe pedir aclaración etaria/clínica: ${q}`);
    const { handler, md } = await conversa(q);
    assert.equal(handler, 'answerAliasAmbiguo', q);
    assert.match(md, /sin estratificación por edad ni por embarazo|no desglosan por edad/i, q);
    assert.match(md, /sífilis congénita.*A50/i, q);
    assert.match(md, /sífilis adquirida.*menores|menores.*adquirida/i, q);
    SIN_CIFRAS_A51(md, q);
  });
}

test('contradicción nombre-código con otro release publicado («sífilis adquirida A67») se aclara sin cifras', async () => {
  for (const q of ['sífilis adquirida A67 en Jalisco', 'sífilis adquirida B01 en Jalisco']) {
    const { handler, md } = await conversa(q);
    assert.equal(handler, 'answerAliasAmbiguo', q);
    assert.match(md, /corresponde a otro bloque publicado/, q);
    SIN_CIFRAS_A51(md, q);
  }
});

test('seguimientos conversacionales (M1 y M2): heredan contexto válido, bloquean embarazo con sustantivo intermedio ES/EN y aclaran edad/menores sin auto-clasificar A50', async () => {
  const son = await conversa('sífilis adquirida en Jalisco', '¿y en Sonora?');
  assert.match(son.md, /SIFILIS_ADQUIRIDA_A51:\{"tipo":"serie","estado":"Sonora"/);

  const hom = await conversa('sífilis adquirida en Jalisco mujeres', '¿y hombres?');
  assert.match(hom.md, /SIFILIS_ADQUIRIDA_A51:\{"tipo":"serie","estado":"Jalisco","sexo":"hombres"/);

  // Seguimientos explícitamente congénitos / perinatales / fetales → A50, con su propio control desde alta_b44 (19-nov-2026)
  for (const seg of ['¿y la congénita?', '¿y congénita?', '¿y neonatal?', '¿y perinatal?', '¿y fetal?', 'and congenital?', 'what about congenital?']) {
    const r = await conversa('sífilis adquirida en Jalisco', seg);
    assert.doesNotMatch(r.md, /SIFILIS_ADQUIRIDA_A51/, `followup A50 ${seg}`);
    assert.match(r.md, /Sífilis congénita \(A50\)|sífilis congénita \(A50\)/, `followup A50 ${seg}`);
  }

  // M1: seguimientos de embarazo (incluidos sustantivos intermedios ES/EN) → O98.1 no modelado, sin cifras de A51-A53 ni sustitución por A50 del radar
  for (const seg of [
    '¿y en el embarazo?',
    '¿y en embarazadas?',
    '¿y en mujeres embarazadas?',
    '¿y en las mujeres embarazadas?',
    '¿y en pacientes embarazadas?',
    '¿y en mujeres gestantes?',
    '¿y gestacional?',
    '¿y materna?',
    'and in pregnancy?',
    'and in pregnant women?',
    'what about pregnant women?',
    'and in women in pregnancy?',
  ]) {
    const r = await conversa('sífilis adquirida en Jalisco', seg);
    SIN_CIFRAS_A51(r.md, `followup M1 ${seg}`);
    assert.equal(r.handler, 'answerPadecimientoNoModelado', `followup M1 ${seg}`);
    assert.match(r.md, /O98\.1/, `followup M1 ${seg}`);
    assert.doesNotMatch(r.md, /Sífilis congénita \(A50\) \*\* · Boletín|Casos de la semana:/, `followup M1 no debe sustituir con A50 del radar: ${seg}`);
  }

  // M2: seguimientos de edad/menores (ES/EN) → aclaran ausencia de estratificación etaria y distinguen A50 vs A51-A53 sin auto-clasificar como A50 ni caer en fuzzy («babies»→«scabies»)
  for (const seg of [
    '¿y en recién nacidos?',
    '¿y en bebés?',
    '¿y en lactantes?',
    '¿y en niños?',
    '¿y en menores?',
    'and in newborns?',
    'and in infants?',
    'and in babies?',
    'what about babies?',
  ]) {
    const r = await conversa('sífilis adquirida en Jalisco', seg);
    SIN_CIFRAS_A51(r.md, `followup M2 ${seg}`);
    assert.equal(r.handler, 'answerAliasAmbiguo', `followup M2 ${seg}`);
    assert.match(r.md, /sin estratificación por edad ni por embarazo|no desglosan por edad/i, `followup M2 ${seg}`);
    assert.match(r.md, /A50/, `followup M2 ${seg}`);
    assert.doesNotMatch(r.md, /Escabiosis|ESCABIOSIS_B86/i, `followup M2 no debe caer en fuzzy scabies: ${seg}`);
  }

  // Seguimiento tras A50 en radar («sífilis congénita» / «sífilis neonatal») y fuera del radar («sífilis en el embarazo») nunca cae en A51 ni en tabla neuro
  for (const seg of ['¿y hombres?', '¿y en Sonora?']) {
    // alta_b44: A50 tiene su propio release; el seguimiento hereda A50, nunca A51-A53.
    const rRadar = await conversa('sífilis congénita en Jalisco mujeres', seg);
    assert.match(rRadar.md, /SIFILIS_CONGENITA_A50/, `post-A50 ${seg}`);
    assert.doesNotMatch(rRadar.md, /SIFILIS_ADQUIRIDA_A51/, `post-A50 ${seg}`);

    const rNoMod = await conversa('sífilis en el embarazo en Jalisco', seg);
    assert.equal(rNoMod.handler, 'answerPadecimientoNoModelado', `post-O98.1 noModelado ${seg}`);
    assert.match(rNoMod.md, /O98\.1/, `post-O98.1 noModelado ${seg}`);
    SIN_CIFRAS_A51(rNoMod.md, `post-O98.1 noModelado ${seg}`);
    assert.doesNotMatch(rNoMod.md, /casos totales|Se pronostican/, `post-O98.1 noModelado ${seg}`);
  }
});

test('M3 rutas del radar del boletín: ITS vecinas conservan el radar y «sífilis en el boletín» desambigua A50 vs A51-A53 sin sustituir', async () => {
  // alta_b44 (19-nov-2026): la gonocócica genitourinaria (A54.0-A54.2) y el herpes genital (A60.0) tienen release propio:
  // «gonorrea» a secas pide precisar y el herpes genital responde su propio release; ninguno recibe cifras de A51-A53.
  for (const q of ['gonorrea en el boletín', 'herpes genital en el boletín']) {
    const r = await conversa(q);
    assert.doesNotMatch(r.md, /SIFILIS_ADQUIRIDA_A51|\*\*Sífilis adquirida \(A51-A53\) ·/, q);
  }

  // alta_b44: el radar ya no lista A55 como no modelado; «clamidia» (A56) se aclara sin cifras y nunca cae en la tabla neuro.
  const clam = await conversa('clamidia en el boletín');
  assert.equal(clam.handler, 'answerPadecimientoNoModelado');
  assert.match(clam.md, /A56/);
  SIN_CIFRAS_A51(clam.md, 'clamidia en el boletín');

  const sifGen = await conversa('sífilis en el boletín');
  assert.equal(sifGen.handler, 'answerAliasAmbiguo');
  assert.match(sifGen.md, /sífilis adquirida \(A51-A53\)/i);
  assert.match(sifGen.md, /sífilis congénita \(A50\)/i);
  assert.doesNotMatch(sifGen.md, /Casos de la semana:/);
  SIN_CIFRAS_A51(sifGen.md, 'sífilis en el boletín');

  const sifCong = await conversa('sífilis congénita en el boletín');
  assert.match(sifCong.md, /Sífilis congénita \(A50\)/);
  assert.doesNotMatch(sifCong.md, /SIFILIS_ADQUIRIDA_A51/);
});

test('no consejo médico individual y prioridad de crisis', async () => {
  for (const q of ['creo que tengo sífilis adquirida', 'cómo se cura la sífilis adquirida', 'tratamiento para sífilis adquirida',
    'qué medicamento tomar para sífilis adquirida']) {
    const r = await conversa(q);
    assert.equal(r.handler, null, q);
    SIN_CIFRAS_A51(r.md, q);
  }
  const c = await conversa('me quiero morir porque tengo sífilis adquirida');
  assert.equal(c.handler, 'answerCrisis');
  assert.match(c.md, /800 911 2000/);
  SIN_CIFRAS_A51(c.md, 'crisis');
});

test('no regresión: motor ETS, mal del pinto (A67), vulvovaginitis por tricomonas y conjuntivitis (H10 y gonocócica) intactos', async () => {
  assert.equal(mencionaNoModelada(norm('qué es el modelo ETS')), null);
  const pinto = await conversa('mal del pinto en Chiapas');
  assert.match(pinto.md, /MAL_DEL_PINTO_A67/);
  assert.doesNotMatch(pinto.md, /SIFILIS_ADQUIRIDA_A51/);
  const vulvo = await conversa('vulvovaginitis por tricomonas en Sonora');
  assert.equal(vulvo.handler, 'answerAliasAmbiguo');
  const conjH10 = await conversa('conjuntivitis en Sonora');
  assert.match(conjH10.md, /CONJUNTIVITIS_H10/);
  assert.equal(subtipoAjeno(norm('conjuntivitis gonocócica en Sonora'))?.release, 'conjuntivitis_h10');
  const conjGono = await conversa('conjuntivitis gonocócica en Sonora');
  assert.doesNotMatch(conjGono.md, /CONJUNTIVITIS_H10|SIFILIS_ADQUIRIDA_A51/);
});

test('núcleo de rag.mjs (B1/B2/M2): estadoDeControl (1 de 4), hechosDeFoco/notasFicha con cronología extraíble y alcance sin modelo', () => {
  const RAG = leer('epibot/netlify/functions/rag.mjs');
  const ini = RAG.indexOf('function stripAccents(');
  const fin = RAG.indexOf('// Rate limit + CORS');
  const ctx = vm.runInNewContext(
    `${leer('epibot/js/release_catalog.js')}\n${RAG.slice(ini, fin)}\n({ estadoDeControl, hechosDeFoco, notasFicha, focoReleases, detectEntities })`,
    { console },
  );
  const leerVista = (id) => {
    if (id === 'sifilis_adquirida_a51') return VISTA_FIXTURE;
    throw new Error(`sin vista ${id}`);
  };
  const leerFicha = (pag) => leer(pag);

  const est = ctx.estadoDeControl('¿está validada la sífilis adquirida?', leerVista);
  assert.ok(est, 'estadoDeControl debe responder para sifilis_adquirida_a51');
  assert.match(est.answer, /Sífilis adquirida \(A51-A53\): control estacional, no validado\./);
  assert.match(est.answer, /por autorización del autor se publica el control estacional/);
  assert.doesNotMatch(est.answer, /delegación del autor/);
  assert.match(est.answer, /1 de 4 semanas registradas/);
  assert.match(est.answer, /16 de noviembre de 2026 \(hora de Ciudad de México\)/);
  assert.match(est.answer, /25\.5 frente a 20\.0 del control/);
  assert.match(est.answer, /76\.4 en las series por estado y sexo, 64\.2 en el conjunto de las series publicadas y 20\.0 en el total nacional/);
  assert.match(est.answer, /Por estado es una referencia poco informativa/);
  assert.match(est.answer, /compararlo consigo mismo no demostraría nada/);
  assert.doesNotMatch(est.answer, /en curso|\bPASS\b/);

  assert.deepEqual([...ctx.focoReleases('casos de sífilis adquirida en Jalisco')], ['sifilis_adquirida_a51']);
  assert.equal(ctx.detectEntities('acquired syphilis in jalisco').padecimiento, 'Sífilis adquirida');
  // alta_b44: A50 tiene su propio release.
  assert.equal(ctx.detectEntities('congenital syphilis in jalisco').padecimiento, 'Sífilis congénita');
  assert.equal(ctx.detectEntities('A50 en jalisco').padecimiento, 'Sífilis congénita');

  const hechos = ctx.hechosDeFoco(['sifilis_adquirida_a51'], 'cronología, precisión y desglose por sexo de sífilis adquirida', leerVista, leerFicha);
  assert.match(hechos, /A50/);
  assert.match(hechos, /2015-W39/);
  assert.match(hechos, /18\.8 %/);
  assert.match(hechos, /14\.9 %/);
  assert.match(hechos, /MASE > 1/);
  assert.match(hechos, /no ciega/i);
  assert.match(hechos, /consejo médico/i);
  assert.match(hechos, /Cronología/i, 'B1: notasFicha debe extraer el párrafo de cronología para el RAG');
  assert.match(hechos, /2026-11-17T01:32:25\.156213\+00:00/);
  assert.match(hechos, /01:23:31\.237010/);
  assert.match(hechos, /5987a061/);
  assert.match(hechos, /sifilis_adquirida_a51_eaca7efc1a11/);
  assert.doesNotMatch(hechos, /\b0\/4\b|\b0 de 4\b/, 'B2: sin contador fijo rancio 0/4 en notasFicha');
});

test('ficha sifilis_adquirida_a51.html (B1/B2): shell común, cronología real sellada, sin contador 0/4 rancio y todas las divulgaciones K6/D1/posttest', async () => {
  assert.ok(existsSync(new URL('sifilis_adquirida_a51.html', raiz)), 'falta sifilis_adquirida_a51.html');
  const html = leer('sifilis_adquirida_a51.html');

  // Shell común al día sólo en esta página
  const { buildPages } = await import('../../scripts/site_shell.mjs');
  const [built] = buildPages(new URL('.', raiz).pathname, { only: 'sifilis_adquirida_a51.html' });
  assert.equal(built.after, built.before, 'sifilis_adquirida_a51.html no tiene el shell común estampado al día');

  // Integridad de IDs del script y estado-ficha v>=2 con semanaMas
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  const ids = new Set([...scripts.matchAll(/(?:getElementById\(|\$\()'([A-Za-z][\w-]*)'\)/g)].map((m) => m[1]));
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `falta #${id}`);
  assert.match(html, /estado-ficha\.js\?v=\d+"/);
  assert.match(html, /EpiEstadoFicha\.aplica\(\$\('statusCard'\), V\);/);
  assert.match(html, /semanaMas\(a, w, 1\)/);

  // Tarjeta de estado: tanto 1/4 técnico (INCOMPLETE con caida_al_control) como 4/4 (CONTROL_ONLY) pintan control, nunca pass/pending
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(leer('assets/site/estado-ficha.js'), ctx);
  for (const vista of [VISTA_FIXTURE, { ...VISTA_FIXTURE, verdict: 'CONTROL_ONLY', weeks_available: 4 }]) {
    const attrs = {};
    const nodos = { pubKind: { textContent: '', hidden: true }, pubLabel: { textContent: '' } };
    const card = { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } };
    assert.equal(ctx.EpiEstadoFicha.aplica(card, vista, { getElementById: (x) => nodos[x] }), 'control');
    assert.equal(attrs['data-publication-kind'], 'control');
  }

  // B1 + B2: originTxt y emitTxt reales compatibles con tests/fichas.test.mjs + ISO UTC explícito, ventana real W43-W46 y cero contador fijo rancio
  assert.match(html, /id="originTxt">W42 de 2026</);
  assert.match(html, /id="emitTxt">16 de noviembre de 2026</);
  for (const [, w] of html.matchAll(/\((W\d+ a W\d+ de \d{4})\)/g)) {
    assert.equal(w, 'W43 a W46 de 2026', 'ventana técnica del gate en sifilis_adquirida_a51.html');
  }
  assert.doesNotMatch(html, /validación en curso|en validación|\bPASS\b/i, 'control nunca en validación ni PASS');

  // Divulgaciones obligatorias K6 + D1 + FABLE_POSTTEST + H1 + H3 + cronología real + sin contador 0/4 rancio
  const plano = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.doesNotMatch(plano, /\b0 de 4\b|\b0\/4\b/, 'B2: retirar contador fijo rancio 0/4 del HTML estático');
  assert.doesNotMatch(plano, /(?<!no )\b52 semanas futuras\b/i, '52 semanas desde el origen, no 52 futuras');
  for (const req of [
    'control estacional, no validado',
    'autorizó publicar el control',
    '2026-W42',
    '2026-11-17T01:32:25.156213+00:00',
    '01:23:31.237010',
    '5987a061',
    '2026-W43',
    'no es prospectiv',
    '52 semanas desde el origen',
    'sifilis_adquirida_a51_eaca7efc1a11',
    'INCOMPLETE',
    'sifilis_adquirida_a51_benchmark_test_73490ea8b2b5_749316ac335e',
    '27.716934 %',
    '25.49',
    '19.96',
    '66.45',
    '76.37',
    '61.05',
    '64.15',
    '64 de 64',
    '59 de 64',
    '57 de 64',
    'CONTROL_ONLY',
    'compararlo consigo mismo',
    'acceptance_fallback',
    'no ciega',
    '2015_sem40',
    '2015-W39',
    '2015-W40',
    '18.8 %',
    '14.9 %',
    'no equivale',
    '66',
    '2016',
    '0 filas imputadas',
    '12 encabezados ráster',
    'rolling_cv_baja_incidencia_v1',
    'no describe a la sífilis',
    'ETS',
    'Ridge',
    'fallo real',
    'sífilis congénita (A50)',
    'consejo médico',
  ]) {
    assert.ok(plano.includes(req), `falta divulgación obligatoria en la ficha: «${req}»`);
  }
});
