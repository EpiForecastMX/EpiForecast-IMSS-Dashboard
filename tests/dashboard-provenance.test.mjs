import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComparison, comparisonCSV } from '../assets/dashboard/analytics.mjs';
const series = {d:['2026-01-05','2026-01-12'],r:[4,8],y:[null,null],dsCorte:'2026-01-19',lastReal:'2026-01-12'};
const c=buildComparison([{id:'jalisco',label:'Jalisco',series}],{mode:'absolute'});
function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(ch===','&&!quoted){row.push(field);field='';}
  else if(ch==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
  else field+=ch;
 }
 return rows;
}
test('comparison exports retain the exact metadata object used by the UI, including origin and observation cut',()=>{
 const meta={padecimiento:'Asma',cie:'J45, J46',sexo:'General',semanaOrigen:'2026-W41',ultimaSemanaObservada:'2026-W42',emision:'2026-11-09T22:27:14Z',estado:'Validación prospectiva en curso (1/4 semanas)',veredicto:'INCOMPLETE',releaseId:'asma_release_test',fuente:'publication/asma_j45/vista.json',sha256:'b'.repeat(64),desde:'2026-01-05',hasta:'2026-01-12'};
 const [header,...rows]=parseCsv(comparisonCSV(c,meta));
 for(const row of rows){
  const o=Object.fromEntries(header.map((key,i)=>[key,row[i]]));
  assert.equal(row.length,header.length);
  assert.equal(o.origen,meta.semanaOrigen);
  assert.equal(o.corte_observacion,meta.ultimaSemanaObservada);
  assert.equal(o.cie,meta.cie);
  assert.equal(o.veredicto,meta.veredicto);
  assert.equal(o.release_id,meta.releaseId);
  assert.equal(o.sha256_fuente,meta.sha256);
  assert.equal(o.rango_desde,meta.desde);
  assert.equal(o.rango_hasta,meta.hasta);
  assert.equal(o.fuente,meta.fuente);
 }
});
test('explicit canonical metadata keys retain precedence and indexed units cannot be mislabeled as case counts',()=>{
 const indexed=buildComparison([{id:'jalisco',label:'Jalisco',series}],{mode:'indexed'});
 const [head,row]=parseCsv(comparisonCSV(indexed,{origen:'2026-W26',semanaOrigen:'wrong',corte:'2026-W42',ultimaSemanaObservada:'wrong',unidad:'casos'}));
 const o=Object.fromEntries(head.map((key,i)=>[key,row[i]]));
 assert.equal(o.origen,'2026-W26');assert.equal(o.corte_observacion,'2026-W42');assert.equal(o.unidad,'indice_base_100');
});
