// Synthetic DOM integration, NOT browser rendering or mobile visual QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(root,'wcp2026.html'),'utf8');
const data=JSON.parse(readFileSync(resolve(root,'Reports/wcp2026/2026-09-08-00567d59/data.json')));
let doc;
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.listeners={};this.value='';this.hidden=false;this.disabled=true;this._html='';this._text='';this.style={setProperty(k,v){this[k]=v;}};this.classList={add(){},remove(){}};this.clientWidth=780;this.parentElement={};}
  set innerHTML(v){this._html=v;this._text=v.replace(/<[^>]*>/g,'');} get innerHTML(){return this._html;}
  set textContent(v){this._text=String(v);} get textContent(){return this._text+this.children.map(c=>c.textContent).join(' ');}
  append(...items){this.children.push(...items);} replaceChildren(...items){this.children=items;}
  setAttribute(k,v){this.attrs[k]=v;} removeAttribute(k){delete this.attrs[k];if(k==='src')delete this.src;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  dispatch(k,extra={}){for(const fn of this.listeners[k]||[])fn({target:this,currentTarget:this,preventDefault(){},...extra});}
  focus(){doc.activeElement=this;} scrollTo(){} showModal(){this.open=true;} close(){this.open=false;this.dispatch('close');}
  getBoundingClientRect(){return {left:0};}
  getContext(){return new Proxy({},{get:()=>()=>{},set:()=>true});}
}
function setup(fail=false){
  const ids=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  const translated=[...html.matchAll(/data-i18n="([^"]+)"[^>]*>([\s\S]*?)<\/(?:a|span|p|h\d|strong|small|option|summary|legend|th|caption|em|button)>/g)].map(m=>{const e=new Element();e.dataset.i18n=m[1];e.innerHTML=m[2];return e;});
  const languages=['en','es'].map(lang=>{const e=new Element();e.dataset.lang=lang;return e;});
  const windows=['25','8'].map(value=>{const e=new Element();e.dataset.window=value;return e;});
  for(const key of ['weekly-table','state-table']){ids.get(key).tHead=new Element();ids.get(key).tBodies=[new Element()];}
  ids.get('condition').value='depresion';
  doc={documentElement:{lang:'en'},body:new Element(),activeElement:null,title:'',getElementById:k=>ids.get(k),createElement:t=>new Element(t),
    querySelector:s=>s==='.sex-bar'?sexBar:null,
    querySelectorAll:s=>s==='[data-i18n]'?translated:s==='[data-lang]'?languages:s==='[data-window]'?windows:s==='#state-bars button'?ids.get('state-bars').children:s==='#condition,#state,#week-slider,[data-window]'?[ids.get('condition'),ids.get('state'),ids.get('week-slider'),...windows]:[]};
  const sexBar=new Element();globalThis.document=doc;globalThis.location={search:'',href:'http://localhost/wcp2026.html'};
  globalThis.history={replaceState(_a,_b,url){globalThis.location.href=String(url);globalThis.location.search=new URL(url).search;}};
  globalThis.window={devicePixelRatio:1,addEventListener(){}};globalThis.ResizeObserver=class{observe(){}};
  globalThis.fetch=async()=>({ok:!fail,json:async()=>structuredClone(data)});
  return {ids,languages,windows,translated};
}
test('page initializes, switches metrics and languages, explores states, and opens/closes zoom',async()=>{
  const {ids,languages,windows}=setup();
  await import(pathToFileURL(resolve(root,'Reports/wcp2026/wcp.mjs')).href+'?test=runtime');
  assert.equal(ids.get('data-status').hidden,true);assert.equal(ids.get('condition').disabled,false);
  assert.equal(ids.get('result-cards').children.length,3);assert.match(ids.get('result-cards').textContent,/8\.7%/);
  assert.equal(ids.get('weekly-table').tBodies[0].children.length,79);assert.equal(ids.get('state-bars').children.length,32);
  windows[1].dispatch('click');assert.match(ids.get('result-cards').textContent,/5\.0%/);assert.match(ids.get('result-cards').textContent,/153\.8/);
  ids.get('condition').value='alzheimer';ids.get('condition').dispatch('change');assert.match(ids.get('result-cards').textContent,/17\.8%/);
  languages[1].dispatch('click');assert.equal(doc.documentElement.lang,'es');assert.match(ids.get('pdf-view').href,/RebullES\.pdf$/);assert.match(location.search,/lang=es/);
  languages[0].dispatch('click');assert.equal(doc.documentElement.lang,'en');assert.equal(location.search,'');assert.match(ids.get('pdf-view').href,/Rebull\.pdf$/);
  ids.get('state-bars').children[0].dispatch('click');assert.equal(ids.get('state-bars').children[0].attrs['aria-pressed'],'true');
  ids.get('week-slider').value='78';ids.get('week-slider').dispatch('input');assert.match(ids.get('week-readout').textContent,/not observed in this evaluation/);
  ids.get('zoom-open').focus();ids.get('zoom-open').dispatch('click');assert.equal(ids.get('poster-dialog').open,true);assert.match(ids.get('zoom-image').src,/poster-en-detail\.png$/);
  ids.get('poster-zoom').value='250';ids.get('poster-zoom').dispatch('input');assert.equal(ids.get('zoom-image').style.width,'250%');
  ids.get('zoom-reset').dispatch('click');assert.equal(ids.get('zoom-image').style.width,'100%');
  ids.get('zoom-close').dispatch('click');assert.equal(ids.get('poster-dialog').open,false);assert.equal(ids.get('zoom-image').src,undefined);assert.equal(doc.activeElement,ids.get('zoom-open'));
});
test('network failure leaves downloads and language switch available with explicit error',async()=>{
  const {ids,languages}=setup(true);const warn=console.warn;console.warn=()=>{};
  try{await import(pathToFileURL(resolve(root,'Reports/wcp2026/wcp.mjs')).href+'?test=failure');}finally{console.warn=warn;}
  assert.equal(ids.get('data-status').hidden,false);assert.match(ids.get('data-status').textContent,/could not be loaded/);assert.equal(ids.get('condition').disabled,true);
  languages[1].dispatch('click');assert.match(ids.get('data-status').textContent,/No se pudieron/);assert.match(ids.get('pdf-view').href,/RebullES\.pdf$/);
});
