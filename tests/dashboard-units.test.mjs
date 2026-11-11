// Pruebas de la nomenclatura de unidades (assets/dashboard/units.mjs) y de su uso en la UI.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UNIT_IDS, NET_INCREMENT_NOTE, isNetIncrement, valueUnit, scaleLabel, comparisonScaleText,
  comparisonUnitId, totalSourceLabel, statusText,
} from '../assets/dashboard/units.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fmt = (v) => (v === null ? 'sin dato' : String(v));

describe('valueUnit: histórico por sexo frente a General y releases', () => {
  for (const sex of ['hombres', 'mujeres']) {
    test(`legacy ${sex}: incremento neto del acumulado, no casos nuevos`, () => {
      const u = valueUnit('legacy', sex);
      assert.equal(isNetIncrement('legacy', sex), true);
      assert.equal(u.id, UNIT_IDS.net);
      assert.equal(u.net, true);
      assert.match(u.label, /incrementos netos/);
      assert.doesNotMatch(u.label, /casos/);
      assert.match(u.observedLabel, /incremento neto/);
      assert.equal(u.note, NET_INCREMENT_NOTE);
      assert.match(u.note, /no equivalen a casos nuevos/);
      assert.match(u.note, /revisiones/);
    });
  }

  test('legacy General: casos semanales, sin nota de incrementos', () => {
    const u = valueUnit('legacy', 'general');
    assert.equal(isNetIncrement('legacy', 'general'), false);
    assert.equal(u.id, UNIT_IDS.cases);
    assert.equal(u.label, 'casos semanales');
    assert.equal(u.note, null);
  });

  for (const sex of ['general', 'hombres', 'mujeres']) {
    test(`release ${sex}: casos semanales intactos`, () => {
      const u = valueUnit('release', sex);
      assert.equal(u.id, UNIT_IDS.cases);
      assert.equal(u.net, false);
      assert.equal(u.note, null);
      assert.equal(u.baselineUnit, 'casos');
    });
  }
});

describe('comparación: escala genérica y unidad en el contexto', () => {
  test('el selector usa «Valores absolutos» y «Base 100»', () => {
    assert.equal(scaleLabel('absolute'), 'Valores absolutos');
    assert.equal(scaleLabel('indexed'), 'Base 100');
  });

  test('absoluto legacy por sexo declara incrementos netos; release y General dicen casos', () => {
    const net = comparisonScaleText('legacy', 'hombres', 'absolute');
    assert.match(net, /incrementos netos/);
    assert.match(net, /no equivalen a casos nuevos/);
    for (const [kind, sex] of [['legacy', 'general'], ['release', 'mujeres']]) {
      const t = comparisonScaleText(kind, sex, 'absolute');
      assert.match(t, /casos semanales/);
      assert.doesNotMatch(t, /incremento/);
    }
  });

  test('base 100 legacy por sexo: la base es un incremento neto, no «N casos»', () => {
    const bases = [{ label: 'Jalisco', value: 12 }, { label: 'Nacional', value: 340 }];
    const t = comparisonScaleText('legacy', 'mujeres', 'indexed', '2 ene 2023', bases, fmt);
    assert.match(t, /Jalisco = 12 de incremento neto/);
    assert.match(t, /Nacional = 340 de incremento neto/);
    assert.doesNotMatch(t, /= \d+ casos/);
    assert.match(t, /no un número de casos nuevos/);
  });

  test('base 100 General y release conservan «casos»', () => {
    const bases = [{ label: 'Jalisco', value: 12 }];
    for (const [kind, sex] of [['legacy', 'general'], ['release', 'hombres']]) {
      const t = comparisonScaleText(kind, sex, 'indexed', '2 ene 2023', bases, fmt);
      assert.match(t, /Jalisco = 12 casos/);
      assert.doesNotMatch(t, /incremento neto/);
    }
  });

  test('códigos de unidad del CSV de comparación', () => {
    assert.equal(comparisonUnitId('legacy', 'hombres', 'absolute'), 'incremento_neto_por_semana_indice');
    assert.equal(comparisonUnitId('legacy', 'general', 'absolute'), 'casos_por_semana_indice');
    assert.equal(comparisonUnitId('release', 'mujeres', 'absolute'), 'casos_por_semana_indice');
    for (const [k, s] of [['legacy', 'hombres'], ['legacy', 'general'], ['release', 'general']]) {
      assert.equal(comparisonUnitId(k, s, 'indexed'), 'indice_base_100');
    }
  });
});

describe('rótulos auxiliares', () => {
  test('origen del total nacional', () => {
    assert.equal(totalSourceLabel('pronostico_52_total'), 'total publicado en la vista');
    assert.match(totalSourceLabel('suma_puntos_vista_sin_redondear'), /sin redondeo/);
    assert.match(totalSourceLabel('suma_json_visual_redondeado'), /redondeados/);
    assert.equal(totalSourceLabel(undefined), 'total del catálogo');
  });

  test('statusText no duplica «N/M semanas»', () => {
    const label = 'Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos';
    assert.equal(statusText(label, 0, 4), label);
    assert.equal(statusText('Control estacional publicado', 0, 4), 'Control estacional publicado · 0/4 semanas');
    assert.equal(statusText('Serie histórica', null, null), 'Serie histórica');
    assert.equal(statusText(null, 4, 4), '4/4 semanas');
  });
});

describe('integración con el controlador y el HTML', () => {
  test('sin «casos absolutos» ambiguos y con columnas de unidad en el CSV del explorador', async () => {
    const js = await readFile(join(ROOT, 'assets/dashboard/dashboard.mjs'), 'utf8');
    const html = await readFile(join(ROOT, 'EpiDashboard.html'), 'utf8');
    assert.match(js, /from '\.\/units\.mjs'/);
    assert.doesNotMatch(js, /[Cc]asos absolutos/);
    assert.doesNotMatch(js, /formatValue\(l\.baseline\?\.value\)\} casos/);
    assert.match(js, /'unidad', 'nota_incrementos'/);
    assert.match(js, /unit\.id, unit\.note \?\? ''/);
    assert.match(html, /<span>Valores absolutos<\/span>/);
    assert.doesNotMatch(html, /Casos absolutos/);
  });

  test('las flechas entre pestañas reemplazan el historial; el clic sigue apilando', async () => {
    const js = await readFile(join(ROOT, 'assets/dashboard/dashboard.mjs'), 'utf8');
    assert.match(js, /update\(\{ vista: tab\.dataset\.vista \}, \{ push: false \}\)/);
    assert.doesNotMatch(js, /list\[j\]\.click\(\)/);
  });
});
