import test from 'node:test';
import assert from 'node:assert/strict';
import { bannerEstatico, problemasDelBannerEstatico } from '../scripts/lib/cifras_contrato.mjs';

// La forma exacta con la que W33 salió mal a producción (2-sep-2026): el destacado
// estático era el CALASS (a mano) y el generador sólo cambió fecha y subtítulo.
const INCOHERENTE = `<html><body>
        <div class="news-banner-row" id="newsBannerRow">
          <a href="novedades.html" class="news-lead">
            <div class="news-lead-meta">
              <span class="news-date">2 de septiembre de 2026</span>
              <span class="news-tag news-tag--calass">Internacional</span>
            </div>
            <div class="news-lead-title">EpiForecast-MX se presentó en el CALASS 2026, en Montréal</div>
            <div class="news-lead-sub">Se integró el Boletín SINAVE en los cuatro padecimientos.</div>
          </a>
          <div class="news-mini-list">
            <a href="novedades.html" class="news-mini">
              <span class="news-tag news-tag--datos">Datos</span>
              <span class="news-mini-title">Ya contamos con la semana epidemiológica 31 de 2026</span>
              <span class="news-mini-date">18 de agosto de 2026</span>
            </a>
          </div>
        </div>
</body></html>`;

const ALINEADO = `<html><body>
        <div class="news-banner-row" id="newsBannerRow">
          <a href="novedades.html" class="news-lead">
            <div class="news-lead-meta">
              <span class="news-date">2 de septiembre de 2026</span>
              <span class="news-tag news-tag--datos">Datos</span>
            </div>
            <div class="news-lead-title">Ya contamos con la semana epidemiológica 33 de 2026</div>
            <div class="news-lead-sub">Se integró el Boletín SINAVE en los cuatro padecimientos.</div>
          </a>
          <div class="news-mini-list">
            <a href="novedades.html" class="news-mini">
              <span class="news-tag news-tag--calass">Internacional</span>
              <span class="news-mini-title">EpiForecast-MX se presentó en el CALASS 2026, en Montréal</span>
              <span class="news-mini-date">27 de agosto de 2026</span>
            </a>
            <a href="novedades.html" class="news-mini">
              <span class="news-tag news-tag--datos">Datos</span>
              <span class="news-mini-title">Ya contamos con la semana epidemiológica 31 de 2026</span>
              <span class="news-mini-date">18 de agosto de 2026</span>
            </a>
          </div>
        </div>
</body></html>`;

const NEWS = {
  items: [
    { date: '2 de septiembre de 2026', type: 'datos', tag: 'Datos', title: 'Ya contamos con la semana epidemiológica 33 de 2026' },
    { date: '27 de agosto de 2026', type: 'calass', tag: 'Internacional', title: 'EpiForecast-MX se presentó en el CALASS 2026, en Montréal' },
    { date: '18 de agosto de 2026', type: 'datos', tag: 'Datos', title: 'Ya contamos con la semana epidemiológica 31 de 2026' },
    { date: '4 de junio de 2026', type: 'dengue', tag: 'Nueva línea', title: 'El Dengue ya está en producción' },
  ],
};

test('el banner estático alineado con news.json no da problemas', () => {
  assert.deepEqual(problemasDelBannerEstatico(ALINEADO, NEWS), []);
  const est = bannerEstatico(ALINEADO);
  assert.equal(est.lead.type, 'datos');
  assert.equal(est.minis.length, 2);
});

test('el banner incoherente de W33 (titular del CALASS, fecha de W33) se detecta', () => {
  const p = problemasDelBannerEstatico(INCOHERENTE, NEWS);
  assert.ok(p.some((s) => s.includes('lead.title')), p.join('\n'));
  assert.ok(p.some((s) => s.includes('lead.tag')), p.join('\n'));
  assert.ok(p.some((s) => s.includes('minis')), p.join('\n'));
  // la fecha sí coincidía: no debe reportarse
  assert.ok(!p.some((s) => s.includes('lead.date')), p.join('\n'));
});

test('sin bloque estático o sin items, el gate falla en vez de callar', () => {
  assert.equal(problemasDelBannerEstatico('<html></html>', NEWS).length, 1);
  assert.equal(problemasDelBannerEstatico(ALINEADO, { items: [] }).length, 1);
});
