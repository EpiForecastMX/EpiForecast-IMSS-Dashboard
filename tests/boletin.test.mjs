import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const snapshot = resolve(root, 'assets/boletin/2026-w42');
const data = JSON.parse(readFileSync(resolve(snapshot, 'data.json'), 'utf8'));
const html = readFileSync(resolve(root, 'boletin.html'), 'utf8');
const home = readFileSync(resolve(root, 'index.html'), 'utf8');

// These checks protect extraction and public coverage, rather than the score's subjective weights.
test('all state columns reconcile exactly, including previous-year and HIV-stage columns', () => {
  const blocks = data.diseases.filter(d => d.states.length);
  assert.equal(blocks.length, data.meta.territorial_blocks);
  for (const d of blocks) {
    assert.equal(d.states.length, 32, d.id);
    assert.equal(new Set(d.states.map(s => s.state)).size, 32, d.id);
    assert.equal(d.columns.length, d.totals.length, d.id);
    for (const [i, total] of d.totals.entries()) {
      assert.equal(d.states.reduce((sum, s) => sum + s.values[i], 0), total, `${d.id} column ${i}`);
    }
    assert.ok([41, 42].includes(d.observed_week), `${d.id} has an explicit observation cut`);
  }
});

test('published categories match the installed runner catalog and preserve rejected/control distinctions', () => {
  const installed = JSON.parse(readFileSync(resolve(root, 'publication/catalog.json'), 'utf8'));
  const runner = installed.releases.filter(r => r.visible && r.lifecycle === 'published').map(r => r.disease_id);
  const legacy = ['depresion', 'parkinson', 'alzheimer', 'dengue'];
  const covered = new Set(data.diseases.map(d => d.platform_id).filter(Boolean));
  for (const id of covered) assert.ok([...legacy, ...runner].includes(id), id);
  assert.equal(covered.size, data.meta.platform_published);
  const covid = data.diseases.find(d => d.code === 'U07.1');
  assert.equal(covid.status, 'Rechazada');
  assert.equal(covid.platform_id, null);
  assert.equal(covid.score, null);
  const f50 = data.diseases.find(d => d.platform_id === 'anorexia_f50');
  assert.equal(f50.status, 'Control publicado');
  assert.match(f50.source_note, /Portafolio rechazado/);
});

test('category counts exclude the aggregate and source bytes match the declared PDF digest', () => {
  assert.equal(data.diseases.filter(d => !d.aggregate).length, data.meta.categories);
  assert.equal(data.diseases.filter(d => d.aggregate).length, data.meta.aggregate_rows);
  assert.equal(data.national.length, data.meta.national_rows);
  assert.equal(data.diseases.filter(d => !d.states.length).length, 7);
  const digest = createHash('sha256').update(readFileSync(resolve(snapshot, 'boletin-4226.pdf'))).digest('hex');
  assert.equal(digest, data.meta.pdf_sha256);
});

test('confirmed myiasis uses only its listed states and reconciles counts, without summing rounded percentages', () => {
  const m = data.myiasis;
  assert.equal(m.states.length, 29);
  for (const i of [0, 2, 3, 5, 6, 7, 9]) {
    assert.equal(m.states.reduce((sum, s) => sum + s.values[i], 0), m.totals[i]);
  }
  assert.equal(data.diseases.filter(d => /Miasis/.test(d.name)).length, 1);
});

test('the new page shares the editorial skin and has functional, unambiguous asset URLs', () => {
  assert.match(html, /href="\/editorial\.css\?v=1"/);
  assert.match(html, /href="\/assets\/boletin\/radar\.css/);
  assert.match(html, /src="\/assets\/boletin\/radar\.js/);
  assert.ok(!existsSync(resolve(root, 'boletin')), 'avoid collision with Netlify Pretty URLs');
  for (const [, raw] of html.matchAll(/(?:href|src)="(\/assets\/boletin\/[^"?#]+)/g)) {
    assert.ok(existsSync(resolve(root, raw.slice(1))), raw);
  }
  assert.match(home, /id="acceso-radar-boletin"/);
  assert.match(home.slice(home.indexOf('id="navMobile"'), home.indexOf('<main')), /href="boletin.html"/);
  assert.match(readFileSync(resolve(root, 'sitemap.xml'), 'utf8'), /https:\/\/epiforecast.mx\/boletin.html/);
});

test('historical manifest covers all 53+42 official bulletins and the 53-week boundary', () => {
  const history = JSON.parse(readFileSync(resolve(root, 'assets/boletin/history/index.json'), 'utf8'));
  assert.equal(history.source_count, 95);
  assert.deepEqual(history.source_years, {'2025':53,'2026':42});
  assert.equal(new Set(history.sources.map(s => `${s.year}-${s.week}`)).size, 95);
  assert.equal(history.periods.find(p => p.y === 2025 && p.w === 53).start, '2025-12-28');
  assert.equal(history.periods.find(p => p.y === 2026 && p.w === 1).start, '2026-01-04');
  for (const s of history.sources) {
    assert.match(s.sha256, /^[a-f0-9]{64}$/);
    assert.match(s.url, /^https:\/\/www\.gob\.mx\/cms\/uploads\/attachment\/file\//);
    assert.equal(s.path, undefined);
  }
});

test('all history shards have unique observed periods and match the audited latest bulletin', () => {
  const history = JSON.parse(readFileSync(resolve(root, 'assets/boletin/history/index.json'), 'utf8'));
  for (const d of data.diseases) {
    const shard=JSON.parse(readFileSync(resolve(root, history.series[d.id].path.slice(1)), 'utf8'));
    assert.equal(shard.id,d.id);
    assert.ok(shard.points.length>0,d.id);
    assert.equal(new Set(shard.points.map(p => `${p.y}-${p.w}`)).size,shard.points.length,d.id);
    for(const p of shard.points){
      assert.ok(p.s>=0&&p.s<95,d.id);
      assert.ok(p.p>0,d.id);
      assert.ok(p.n.every(v=>v===null||Number.isInteger(v)),d.id);
      if(p.e)assert.equal(p.e.length,32,d.id);
      if(p.flags.includes('source_cut_conflict'))assert.deepEqual(p.n,[null,null],d.id);
    }
    const latest=shard.points.find(p=>history.sources[p.s].year===2026&&history.sources[p.s].week===42);
    assert.ok(latest,d.id);
    assert.deepEqual(latest.n,[d.weekly,d.cumulative],d.id);
  }
});

test('history keeps negative published values, flagged discrepancies and year ambiguity', () => {
  const read=id=>JSON.parse(readFileSync(resolve(root,`assets/boletin/history/${id}.json`),'utf8'));
  const history=JSON.parse(readFileSync(resolve(root,'assets/boletin/history/index.json'),'utf8'));
  const tb=read('p38b2');
  const chiapas=history.states.indexOf('Chiapas');
  assert.equal(tb.points.find(p=>p.y===2026&&p.w===40).e[chiapas][0],-6);
  const discrepancy=tb.points.find(p=>p.y===2026&&p.w===7);
  assert.ok(discrepancy.flags.includes('state_total_discrepancy'));
  assert.equal(discrepancy.n[1],491);
  assert.equal(discrepancy.e.reduce((sum,e)=>sum+e[1],0),484);
  const faringitis=read('p22b2').points.find(p=>p.y===2025&&p.w===53);
  assert.ok(faringitis.flags.includes('accumulated_year_conflict'));
  assert.deepEqual(faringitis.n,[5566,null]);
  assert.equal(faringitis.reported_cumulative,290664);
  const varicela=read('p10b1').points.find(p=>p.y===2025&&p.w===53);
  assert.ok(varicela.flags.includes('source_cut_conflict'));
  assert.deepEqual(varicela.n,[null,null]);
});
