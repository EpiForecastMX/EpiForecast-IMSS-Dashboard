// Auditoría 9-nov-2026, R4 a R6: cifras estáticas, noticia de la reevaluación y nota en cada página.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const leer = (...p) => readFileSync(resolve(ROOT, ...p), 'utf-8');
const catalogo = JSON.parse(leer('publication', 'catalog.json'));
const REEVALUADOS = {
  aceptados: ['cancer_pulmon_c33', 'cancer_estomago_c16', 'cancer_colon_c18', 'linfoma_hodgkin_c81',
    'linfoma_no_hodgkin_c82', 'leucemia_c91', 'cancer_pancreas_c26'],
  controles: ['cancer_higado_c22', 'cancer_esofago_c15'],
};

test('las cifras estáticas de cada página coinciden con su vista antes de cargar JavaScript', () => {
  let revisadas = 0;
  for (const r of catalogo.releases.filter((x) => x.visible)) {
    const pagina = resolve(ROOT, `${r.disease_id}.html`);
    if (!existsSync(pagina)) continue;
    const html = readFileSync(pagina, 'utf-8');
    const modelos = html.match(/id="stModels">(\d+)</);
    if (!modelos) continue;
    const v = JSON.parse(leer('publication', r.disease_id, 'vista.json'));
    assert.equal(Number(modelos[1]), v.models, `${r.disease_id}: modelos`);
    assert.equal(Number(html.match(/id="stProducts">(\d+)</)[1]), v.products, `${r.disease_id}: series`);
    revisadas += 1;
  }
  assert.ok(revisadas >= 25, `sólo ${revisadas} páginas con cifras estáticas`);
});

test('la noticia distingue siete validaciones prospectivas de dos controles sin contraste', () => {
  const n = JSON.parse(leer('news.json')).items.find((i) => i.title.startsWith('Nueve tipos de cáncer'));
  const cuerpo = n.body.join(' ');
  assert.match(cuerpo, /Los siete aceptados empiezan de nuevo su validación prospectiva/);
  assert.match(cuerpo, /los dos controles no tienen validación prospectiva/);
  assert.match(n.summary, /siete aceptados y dos con el control estacional/);
  // Ya salió del banner de la portada (sólo muestra las tres más recientes); sigue en novedades.
  assert.ok(n.featured);
});

test('cada página reevaluada explica la sustitución del release y su carácter retrospectivo', () => {
  for (const d of [...REEVALUADOS.aceptados, ...REEVALUADOS.controles]) {
    const html = leer(`${d}.html`);
    assert.match(html, /Release sustituido el 8 de noviembre de 2026/, d);
    assert.match(html, /la repetición no es una prueba independiente nueva/, d);
    assert.doesNotMatch(html, /se emitió una sola vez/, d);
  }
  for (const d of REEVALUADOS.controles) assert.match(leer(`${d}.html`), /volvió a ser rechazado/, d);
});
