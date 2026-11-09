import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// La foto vigente se lee de actual.json: las pruebas siguen a la semana publicada.
const actual = JSON.parse(readFileSync(resolve(root, 'assets/boletin/actual.json'), 'utf8'));
const snapshot = resolve(root, actual.carpeta);
const data = JSON.parse(readFileSync(resolve(snapshot, 'data.json'), 'utf8'));
const { week, year } = data.meta;
const validCut = w => w === week || w === week - 1 || (week === 1 && w >= 52);
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
    assert.ok(validCut(d.observed_week), `${d.id} has an explicit observation cut`);
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
  const digest = createHash('sha256').update(readFileSync(resolve(snapshot, actual.pdf))).digest('hex');
  assert.equal(digest, data.meta.pdf_sha256);
});

test('confirmed myiasis uses only its listed states and reconciles counts, without summing rounded percentages', async () => {
  const { entidadesAusentesMiasis } = await import('../assets/boletin/textos.mjs');
  const m = data.myiasis;
  assert.ok(m.states.length > 0 && m.states.length <= 32);
  assert.equal(m.states.length + entidadesAusentesMiasis(data).length, 32, 'every listed state is a known entity');
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

test('historical manifest covers 2013–2026, distinguishes archived editions, and respects 53-week boundaries', () => {
  const history = JSON.parse(readFileSync(resolve(root, 'assets/boletin/history/index.json'), 'utf8'));
  assert.equal(history.source_count, history.sources.length);
  assert.equal(history.source_years['2013'],52);
  assert.equal(history.source_years['2014'],53);
  assert.equal(history.source_years['2020'],53);
  assert.equal(history.source_years['2023'],53, '52 weeks plus a distinct archived edition');
  assert.equal(history.source_years['2025'],53);
  assert.equal(history.source_years[String(year)], week, 'every week of the current year is present');
  assert.equal(history.sources.length,history.source_count);
  assert.equal(new Set(history.sources.map(s => `${s.year}-${s.week}`)).size, history.source_count - 1);
  assert.equal(history.periods.find(p => p.y === 2025 && p.w === 53).start, '2025-12-28');
  assert.equal(history.periods.find(p => p.y === 2026 && p.w === 1).start, '2026-01-04');
  for (const s of history.sources) {
    assert.match(s.sha256, /^[a-f0-9]{64}$/);
    assert.match(s.url, /^https:\/\/(?:www\.gob\.mx\/cms\/uploads\/attachment\/file\/|epidemiologia\.salud\.gob\.mx\/gobmx\/salud\/documentos\/boletin\/)/);
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
      assert.ok(p.s>=0&&p.s<history.source_count,d.id);
      assert.ok(p.p>0,d.id);
      assert.ok(p.n.every(v=>v===null||Number.isInteger(v)),d.id);
      if(p.e)assert.equal(p.e.length,32,d.id);
      if(p.flags.includes('source_cut_conflict'))assert.deepEqual(p.n,[null,null],d.id);
    }
    const latest=shard.points.find(p=>history.sources[p.s].year===year&&history.sources[p.s].week===week);
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


test('coverage counters and public links follow every current published category', async () => {
  const { summarizeCoverage, platformPage, publicationNote, predictorDescription } = await import('../assets/boletin/coverage.mjs');
  const covered = data.diseases.filter(d => d.platform_id && !d.aggregate);
  const summary = summarizeCoverage(data.diseases);
  assert.equal(summary.published, new Set(covered.map(d => d.platform_id)).size);
  assert.equal(summary.covered, covered.length);
  assert.equal(summary.uncovered, data.meta.categories-covered.length);
  for(const d of covered){
    assert.ok(existsSync(resolve(root,platformPage(d.platform_id))),d.platform_id);
    if(d.status==='Control publicado'){
      assert.match(publicationNote(d),/Control estacional/);
      assert.match(predictorDescription(d),/control estacional/);
    }
  }
  assert.match(html,/<script type="module" src="\/assets\/boletin\/radar\.js/);
});


test('historic classifications, missing observations and explicit source editions stay separate', () => {
  const history=JSON.parse(readFileSync(resolve(root,'assets/boletin/history/index.json'),'utf8'));
  const read=id=>JSON.parse(readFileSync(resolve(root,history.series[id].path.slice(1)),'utf8'));
  const depression=data.diseases.find(d=>d.platform_id==='depresion');
  assert.ok(read(depression.id).points.every(p=>p.y>=2014),'depression was added in 2014');
  const dengue=history.categories.find(d=>d.historical&&d.code==='A90');
  assert.ok(dengue,'old dengue classification is retained');
  assert.ok(read(dengue.id).points.every(p=>p.y<=2018),'old A90 is not relabeled A97.0');
  const influenza=data.diseases.find(d=>d.name==='Influenza');
  const shard=read(influenza.id),p=shard.points.find(p=>p.y===2023&&p.w===34);
  assert.equal(p.n[0],60,'governing edition is the PDF linked by the official index');
  assert.match(history.sources[p.s].sha256,/^7afeead2/);
  assert.ok(shard.revisions.some(p=>p.y===2023&&p.w===34&&p.n[0]===123),'alternative figures remain available as a revision');
  for(const [id,meta] of Object.entries(history.series)){
    const s=read(id);
    assert.equal(new Set(s.points.map(p=>`${p.y}-${p.w}`)).size,s.points.length,id);
    assert.equal(s.points.length,meta.points,id);
    for(const p of [...s.points,...s.revisions]){
      assert.ok(p.s>=0&&p.s<history.source_count,id);
      assert.ok(p.n.every(v=>v===null||Number.isInteger(v)),id);
      if(p.e)assert.equal(p.e.length,32,id);
    }
  }
});

test('ambiguous rotavirus years cannot overwrite 2020, and independently verified dengue cuts stay in their weeks', () => {
  const history=JSON.parse(readFileSync(resolve(root,'assets/boletin/history/index.json'),'utf8'));
  const read=id=>JSON.parse(readFileSync(resolve(root,history.series[id].path.slice(1)),'utf8'));
  const rota=read('p6b1');
  assert.equal(rota.unplaced.length,51);
  assert.ok(rota.unplaced.every(p=>history.sources[p.s].year===2021&&p.flags.includes('source_cut_conflict')));
  assert.ok(!rota.points.some(p=>p.y===2020&&history.sources[p.s].year===2021&&history.sources[p.s].week>1));
  const fever=history.categories.find(d=>d.historical&&d.code==='A90'&&/Fiebre.*Dengue/i.test(d.name));
  const dengue=read(fever.id);
  for(const [week,cases] of [[47,872],[48,802],[49,784],[50,407],[51,213],[52,89]]){
    const p=dengue.points.find(p=>p.y===2015&&p.w===week);assert.equal(p.n[0],cases);
    if(week>=48)assert.ok(p.flags.includes('source_cut_verified_by_national'));
  }
  const hemorrhagic=history.categories.find(d=>d.historical&&d.code==='A91'&&/Hemorrágica/i.test(d.name));
  const p=read(hemorrhagic.id).points.find(p=>p.y===2015&&p.w===48);
  assert.deepEqual(p.n,[220,4897]);assert.equal(p.in_study,3039);
  assert.equal(p.in_study_states.reduce((a,b)=>a+b,0),3039);
});

test('national-only rows retain full coverage and historical printed-code changes', () => {
  const history=JSON.parse(readFileSync(resolve(root,'assets/boletin/history/index.json'),'utf8'));
  const periods=history.source_count-1;
  assert.equal(history.series['national-A80'].points,periods);
  assert.equal(history.series['national-A36'].points,periods);
  for(const id of ['national-A92.2','national-A95','national-A20','national-A92.8','national-A98.4'])assert.equal(history.series[id].points,periods-215,id);
  const identities=JSON.parse(readFileSync(resolve(root,'assets/boletin/history/identities.json'),'utf8'));
  assert.ok(identities.some(a=>a.id==='national-A92.2'&&a.source_code==='A95'),'yellow fever is joined by name while its source code is retained');
});


test('history publishes exactly the indexed disease shards', () => {
  const history=JSON.parse(readFileSync(resolve(root,'assets/boletin/history/index.json'),'utf8'));
  const shards=readdirSync(resolve(root,'assets/boletin/history')).filter(n=>/^(?:historical-|national-|p\d+b\d+\.)/.test(n)&&n.endsWith('.json')).map(n=>n.slice(0,-5)).sort();
  assert.deepEqual(shards,Object.keys(history.series).sort());
});


test('the current snapshot is declared in one place and the static page agrees with it', async () => {
  const { textosRadar, enlacesRadar, rellenar } = await import('../assets/boletin/textos.mjs');
  assert.match(actual.carpeta, /^assets\/boletin\/\d{4}-w\d{2}$/);
  assert.equal(actual.carpeta, `assets/boletin/${year}-w${String(week).padStart(2, '0')}`);
  const history = JSON.parse(readFileSync(resolve(root, 'assets/boletin/history/index.json'), 'utf8'));
  const textos = textosRadar(data, actual, history), enlaces = enlacesRadar(actual);
  const spans = [...html.matchAll(/<span data-radar="([^"]+)">([^<]*)<\/span>/g)];
  assert.ok(spans.length > 20);
  for (const [, key, value] of spans) assert.equal(value, textos[key], key);
  for (const [, key, href] of html.matchAll(/<a data-radar-enlace="(\w+)" href="([^"]+)"/g)) {
    assert.equal(href, enlaces[key], key);
    assert.ok(existsSync(resolve(root, href.slice(1))), href);
  }
  const og = html.match(/content="([^"]+)" data-radar-content="([^"]+)"/);
  assert.equal(og[1], rellenar(og[2], textos));
  for (const [, tpl, value] of html.matchAll(/data-radar-plantilla="([^"]+)">([^<]*)</g)) assert.equal(value, rellenar(tpl, textos));
  for (const file of ['assets/boletin/radar.js', 'assets/boletin/curves.js']) {
    const code = readFileSync(resolve(root, file), 'utf8');
    assert.doesNotMatch(code, /\/assets\/boletin\/\d{4}-w\d{2}/, `${file} must read the snapshot from actual.json`);
  }
});

test('the weekly texts handle words, ranges and absent myiasis states', async () => {
  const { numeroEnPalabras, listaConY, entidadesAusentesMiasis, textosRadar } = await import('../assets/boletin/textos.mjs');
  assert.equal(numeroEnPalabras(33, { mayuscula: true }), 'Treinta y tres');
  assert.equal(numeroEnPalabras(9), 'nueve');
  assert.equal(numeroEnPalabras(21), 'veintiuno');
  assert.equal(numeroEnPalabras(40), 'cuarenta');
  assert.equal(listaConY(['A', 'B', 'C']), 'A, B y C');
  assert.equal(listaConY(['A']), 'A');
  const t = textosRadar(data, actual, null);
  assert.equal(t.publicados, String(data.meta.platform_published));
  assert.equal(entidadesAusentesMiasis(data).length, 32 - data.myiasis.states.length);
});
