/**
 * Auditoría Codex de alta_b44 (19-nov-2026), hallazgo 4: las fichas decían «Se notifican unos N casos por semana» con
 * N = pronostico_52_total / horizon_weeks, una media del pronóstico futuro. Ahora muestran la media OBSERVADA del total
 * nacional en las 52 semanas hasta el corte de la vista, con su periodo. Con las páginas anteriores (`047fa5f6`) estas
 * pruebas fallan: 91 fichas usaban la media pronosticada.
 * Contrafactual: FICHAS_ROOT=<copia del frontend anterior>/ node --test tests/test_fichas_media_observada.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'fs';

const raiz = process.env.FICHAS_ROOT ? new URL(`file://${process.env.FICHAS_ROOT.replace(/\/?$/, '/')}`) : new URL('../../', import.meta.url);
const fichas = readdirSync(raiz).filter((f) => f.endsWith('.html'))
  .map((f) => [f, readFileSync(new URL(f, raiz), 'utf-8')]).filter(([, s]) => s.includes('casosSemana'));

test('hay fichas con la media semanal y ninguna usa la media del pronóstico como casos notificados', () => {
  assert.ok(fichas.length >= 90, `fichas: ${fichas.length}`);
  for (const [f, s] of fichas) {
    assert.doesNotMatch(s, /pronostico_52_total \/ V\.horizon_weeks/, f);
    assert.doesNotMatch(s, /Se notifican unos <span id="casosSemana">/, f);
    assert.match(s, /<span id="casosSemanaPeriodo"><\/span>/, f);
    assert.match(s, /promedio/, f);
  }
});

test('la cifra es la media observada de las 52 semanas hasta el corte, con su periodo', () => {
  for (const [f, s] of fichas) {
    const id = f.replace(/\.html$/, '');
    const V = JSON.parse(readFileSync(new URL(`publication/${id}/vista.json`, raiz), 'utf-8'));
    const nac = V.series['nacional|mx|general'];
    const bloque = s.match(/ {6}\{\n {8}\/\/ Media observada[\s\S]*?\n {6}\}\n/);
    assert.ok(bloque, f);
    const out = {};
    const $ = (k) => (out[k] = out[k] || { textContent: '' });
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const fechaLarga = (ds) => { const [y, m, d] = ds.split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}`; };
    const nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
    new Function('$', 'V', 'nac', 'nf0', 'fechaLarga', bloque[0])($, V, nac, nf0, fechaLarga);
    // Cálculo independiente: últimas 52 entradas con dato hasta el corte (semanas consecutivas de 7 días).
    const hasta = nac.observado.filter(([ds, y]) => y != null && ds <= V.observation_cutoff_ds);
    const corte = new Date(`${V.observation_cutoff_ds}T00:00:00Z`);
    const ventana = hasta.filter(([ds]) => (corte - new Date(`${ds}T00:00:00Z`)) / 864e5 < 364);
    const media = ventana.reduce((t, [, y]) => t + y, 0) / ventana.length;
    assert.equal(out.casosSemana.textContent, nf0.format(media), f);
    assert.match(out.casosSemanaPeriodo.textContent, new RegExp(`media de ${ventana.length} semanas con dato, de la semana del .* a la del ${fechaLarga(ventana.at(-1)[0])}`), f);
  }
});
