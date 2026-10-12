import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildChunks,KB_DIR} from '../scripts/lib/corpus.mjs';
import {resolve} from 'node:path';
import {readIndex,problemsAgainstCorpus} from '../scripts/lib/rag_index.mjs';
const {chunks}=buildChunks();
const cards=JSON.parse(readFileSync(resolve(KB_DIR,'rag_sources/micai_updates.json'),'utf8'));
const paper=chunks.filter(c=>/^micai#/.test(c.id));
const byId=id=>cards.find(c=>c.id===`micai-current#${id}`);
test('the indexed paper uses the accepted manuscript affiliations and current links',()=>{
 const text=readFileSync(resolve(KB_DIR,'rag_sources/micai.txt'),'utf8');
 assert.match(text,/Javier Augusto Rebull-Saucedo/);
 assert.match(text,/OOAD Guerrero/);
 assert.doesNotMatch(text,/Santander Bank|Tesla, Inc\.|rebull@outlook\.com/);
 assert.ok(paper.length>0);
 for(const c of paper){
  assert.match(c.url,/accepted_manuscript\.pdf$/);
  assert.match(c.text,/Accepted manuscript as submitted/);
  assert.match(c.text,/execution dates are not independently verified/);
 }
 assert.ok(chunks.every(c=>!String(c.url).includes('MICAI/EpiForecast_MICAI2026.pdf')));
});
test('current sources keep correct windows, adverse results and the zero paired change',()=>{
 assert.match(byId(8).text,/S02–S18/);assert.match(byId(8).text,/7\.40 %/);assert.match(byId(8).text,/7\.33 %/);
 assert.match(byId(8).text,/5\.91 %/);assert.match(byId(8).text,/6\.24 %/);
 assert.match(byId(10).text,/mediana del cambio pareado es cero/);
 assert.match(byId(11).text,/archivada 31\.0 % e ingenuo 27\.0 %/);
 assert.match(byId(11).text,/No se evaluó una política revisada/);
});
test('current sources reject obsolete protocol, seasonality and denominator assertions',()=>{
 assert.match(byId(5).text,/no verifican de forma independiente/);
 assert.match(byId(6).text,/No permite atribuir ese protocolo a todas las ejecuciones publicadas/);
 assert.match(byId(7).text,/no sostiene picos recurrentes de febrero a mayo/);
 assert.match(byId(3).text,/No incluye las cuatro regiones/);
 assert.match(byId(12).text,/únicamente en el periodo epidemiológico uno de cada año \(no en cada periodo\)/);
});
test('the final committed-index candidate covers the new corpus with valid embeddings',()=>{
 const idx=readIndex(resolve(KB_DIR,'rag_index.json'));
 assert.deepEqual(problemsAgainstCorpus(idx,chunks),[]);
 assert.equal(idx.count,chunks.length);
});

import {micaiIntent,micaiGroundedAnswer} from '../netlify/lib/micai_grounding.mjs';
test('bounded MICAI facts preserve numerical direction without generative paraphrase',()=>{
 const index=readIndex(resolve(KB_DIR,'rag_index.json'));
 const r=micaiGroundedAnswer('¿Cómo queda la asignación archivada frente al ingenuo en el seguimiento MICAI?',[],index);
 assert.equal(r.generated,false);assert.equal(r.retrieval,'curated-micai');
 assert.match(r.answer,/archivada 31\.0 % e ingenuo 27\.0 %/);
 assert.match(r.answer,/peor mediana marginal/);
 assert.equal(r.sources[0].url,'../micai2026.html#follow-up');
});
test('MICAI facts do not intercept other diseases, per-state forecasts, or literal quotations',()=>{
 for(const q of ['¿Qué picos describe el paper del dengue?','¿Quiénes son los autores de la ponencia WCP?','¿Qué predice el MICAI para Jalisco?','Dame una cita textual del paper MICAI sobre validación'])assert.equal(micaiIntent(q),null);
 assert.equal(micaiIntent('¿Y en Jalisco?', [{role:'user',text:'Estudio MICAI 2026'}]),null);
});
test('missing current MICAI cards fail closed, without substituting retired paper facts',()=>{
 const r=micaiGroundedAnswer('¿Qué afiliaciones tienen los autores del MICAI?',[],{chunks:[]});
 assert.equal(r.unavailable,true);
});
test('the real handler can deliver a JSON fallback for a streamed MICAI request',async()=>{
 const {default:handler}=await import('../netlify/functions/rag.mjs');
 const previous=process.env.GEMINI_API_KEY;
 if(!previous)process.env.GEMINI_API_KEY='test-unused-by-curated-path';
 try{
  const req=new Request('http://localhost/rag',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'¿General equivale a mujeres más hombres en MICAI y las 99 series son independientes?',stream:true})});
  const res=await handler(req);const r=await res.json();
  assert.equal(res.status,200);assert.equal(r.generated,false);
  assert.match(r.answer,/únicamente en el periodo epidemiológico uno de cada año/);
  assert.match(r.answer,/No incluye las cuatro regiones/);
  assert.equal(r.sources.length,2);
 }finally{
  if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;
 }
});
