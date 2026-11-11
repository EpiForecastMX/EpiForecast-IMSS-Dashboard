import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCatalog, normalizeDataset, datasetSexes } from '../assets/dashboard/unified.mjs';
import { PADECIMIENTOS, COHORTS, getSeries, buildRows, slugify, ESTADOS } from '../assets/dashboard/data.mjs';
import { temporalProfile, buildComparison } from '../assets/dashboard/analytics.mjs';
const root = process.env.DASHBOARD_SOURCE || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(resolve(root,p),'utf8'));
const publication = read('publication/catalog.json');
const published = publication.releases.filter(r => r.lifecycle === 'published' && r.mode === 'public' && r.visible !== false && (!r.channels || r.channels.includes('web')));
const views = Object.fromEntries(published.map(r => [r.disease_id, read(`publication/${r.disease_id}/vista.json`)]));
const legacy = {neuro:read(COHORTS.neuro),dengue:read(COHORTS.dengue)};
const catalog = makeCatalog({legacy,publication,views});

test('the complete published catalog is represented exactly once, never only the four legacy diseases', () => {
  const expected = [...PADECIMIENTOS.map(p=>p.id),...published.map(p=>p.disease_id)].sort();
  assert.deepEqual(catalog.diseases.map(d=>d.id).sort(),expected);
  assert.equal(catalog.diseases.length,new Set(expected).size);
  assert.equal(catalog.summary.series,432+Object.values(views).reduce((n,v)=>n+Object.keys(v.series).length,0));
});

test('all installed release values and actual sex availability survive the adapter, including regional and national products', () => {
 let seriesCount=0;
 for(const entry of catalog.diseases.filter(d=>d.kind==='release')){
  const v=views[entry.id],ds=normalizeDataset(entry,v);
  const normalizedKeys=[...ds.index.entities.values()].flatMap(e=>Object.values(e.keys));
  assert.equal(normalizedKeys.length,Object.keys(v.series).length,entry.id);
  assert.equal(new Set(normalizedKeys).size,normalizedKeys.length,entry.id);
  assert.equal(entry.status.label,v.publication_label,entry.id+' current view label');
  assert.equal(entry.status.weeksAvailable,v.weeks_available,entry.id+' current follow-up');
  assert.equal(entry.emittedAt,v.forecast_emitted_at,entry.id+' actual emission');
  assert.deepEqual(entry.origin,{anio:v.origin[0],semana:v.origin[1]});
  assert.deepEqual(new Set(entry.sexes),new Set(Object.values(v.series).map(s=>s.sexo)));
  for(const original of Object.values(v.series)){
   let slug=original.nivel==='nacional'?'nacional':slugify(original.nombre);
   if(original.nivel==='region'&&!slug.startsWith('region-'))slug='region-'+slug;
   const s=getSeries(ds.raw,ds.index,slug,original.sexo);
   assert.ok(s,`${entry.id}/${slug}/${original.sexo}`);
   const position=new Map(s.d.map((date,i)=>[date,i]));
   for(const [date,value]of original.observado)assert.equal(s.r[position.get(date)],value,`${entry.id}/${slug}/${original.sexo}/${date} observed`);
   for(const [date,value]of original.pronostico)assert.equal(s.y[position.get(date)],value,`${entry.id}/${slug}/${original.sexo}/${date} forecast`);
   const emitted=buildRows(s).filter(row=>row.pron!==null);
   assert.equal(emitted.length,original.pronostico.length);
   assert.ok(Math.abs(emitted.reduce((n,row)=>n+row.pron,0)-original.pronostico_52_total)<1e-7,entry.id+' canonical full horizon');
   seriesCount++;
  }
  if(entry.sexes.length===1){
   for(const e of ds.index.entities.values()){
    assert.deepEqual(datasetSexes(ds,e.slug),['general']);
    assert.equal(getSeries(ds.raw,ds.index,e.slug,'hombres'),null);
    assert.equal(getSeries(ds.raw,ds.index,e.slug,'mujeres'),null);
   }
  }
  for(const state of ESTADOS)assert.ok(ds.index.entities.has(state.slug),entry.id+'/'+state.label);
 }
 assert.equal(seriesCount,Object.values(views).reduce((n,v)=>n+Object.keys(v.series).length,0));
});

test('control labels remain controls while pending and passed views retain their real verdicts', () => {
 for(const entry of catalog.diseases.filter(d=>d.kind==='release')){
  const v=views[entry.id];
  const expected=/control estacional|portafolio rechazado/i.test(v.publication_label)?'control':v.verdict==='PASS'?'pass':'pending';
  assert.equal(entry.status.kind,expected,entry.id);
 }
});

test('temporal profile accounts for each observed value once without turning missing months into zeros', () => {
 for(const entry of catalog.diseases){
  const payload=entry.kind==='release'?views[entry.id]:legacy[entry.cohort];
  const ds=normalizeDataset(entry,payload);
  const s=getSeries(ds.raw,ds.index,'nacional','general');
  assert.ok(s,entry.id);
  const p=temporalProfile(s);
  const expected=s.r.filter(Number.isFinite);
  assert.equal(p.cells.reduce((n,c)=>n+c.n,0),expected.length,entry.id);
  const sum=expected.reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(p.cells.reduce((n,c)=>n+(c.sum??0),0)-sum)<1e-6,entry.id);
  for(const cell of p.cells)if(!cell.n){assert.equal(cell.sum,null);assert.equal(cell.mean,null);}
 }
});

test('a shared positive baseline is required for indexed comparisons and dates are aligned by intersection', () => {
 const s=(dates,r)=>({d:dates,r,y:r.map(()=>null),dsCorte:'2026-12-31',lastReal:dates.at(-1)});
 const a=s(['2026-01-05','2026-01-12','2026-01-19'],[0,10,20]);
 const b=s(['2026-01-12','2026-01-19','2026-01-26'],[20,40,80]);
 const out=buildComparison([{id:'a',label:'A',series:a},{id:'b',label:'B',series:b}],{mode:'indexed'});
 assert.deepEqual(out.dates,['2026-01-12','2026-01-19']);
 assert.equal(out.indexedAvailable,true);
 assert.equal(out.baselineDate,'2026-01-12');
 assert.deepEqual(out.lines.map(l=>l.real),[[100,200],[100,200]]);
 const zero=buildComparison([{id:'a',label:'A',series:s(a.d,[0,0,0])},{id:'b',label:'B',series:b}],{mode:'indexed'});
 assert.equal(zero.indexedAvailable,false);
 assert.ok(zero.reason);
});
