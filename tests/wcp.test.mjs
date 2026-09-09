import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {initialLanguage,metrics,validateData,sortedStates,medianState} from '../Reports/wcp2026/wcp-data.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const assets=resolve(root,'Reports/wcp2026/2026-09-08-8a0a9018');
const data=JSON.parse(readFileSync(resolve(assets,'data.json')));
const html=readFileSync(resolve(root,'wcp2026.html'),'utf8');
const app=readFileSync(resolve(root,'Reports/wcp2026/wcp.mjs'),'utf8');
const css=readFileSync(resolve(root,'Reports/wcp2026/wcp.css'),'utf8');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');

test('QR entry is English, including a Spanish browser or a prior visit',()=>{
  assert.equal(initialLanguage(''),'en');assert.equal(initialLanguage('?utm_source=qr'),'en');
  assert.equal(initialLanguage('?lang=es'),'es');assert.equal(initialLanguage('?lang=EN'),'en');
  assert.equal(initialLanguage('?lang=xx'),'en');assert.match(html,/<html lang="en">/);
  assert.doesNotMatch(app,/navigator\.language|localStorage|sessionStorage/);
});
test('complete, weekly, source-bound chart data',()=>assert.equal(validateData(data),data));
for(const [condition,expected] of Object.entries({depresion:[8.7,5,260.2,153.8],parkinson:[10.6,6.7,16.5,10.3],alzheimer:[14.4,17.8,6.2,7.4]})){
  test(`${condition}: both error metrics reproduce the poster in both windows`,()=>{
    const row=data.national.find(r=>r.condition===condition),a=metrics(row,25),b=metrics(row,8);
    assert.deepEqual([a.smape,b.smape,a.mae,b.mae].map(v=>Number(v.toFixed(1))),expected);
  });
}
test('depression cumulative deviation is not weekly error',()=>{
  const m=metrics(data.national.find(r=>r.condition==='depresion'));
  assert.equal(m.observed,75859);assert.equal(Math.round(m.forecast),74675);
  assert.equal(m.deviation.toFixed(1),'-1.6');assert.notEqual(m.smape,-m.deviation);
  assert.match(app,/Cumulative difference, not weekly error/);
});
test('metric zero pairs and unsupported windows fail predictably',()=>{
  const row={observations:Array(25).fill(0),forecasts:Array(25).fill(0)};
  assert.equal(metrics(row).smape,0);assert.equal(metrics(row).deviation,null);
  assert.throws(()=>metrics(row,10));assert.throws(()=>metrics({...row,forecasts:[]},8));
});
test('both PDFs match their exact final poster hashes, metadata and links',()=>{
  for(const [lang,expected] of Object.entries({en:'ec5ebd80e3c3f5293a69b1e97ece8b14ab9f0159628ca403cd609666f6e06b7a',es:'8a0a901896f2bb2ba8f7e192a0c876c83391df3133659335a54500d046865760'})){
    const p=data.pdfs[lang];assert.equal(p.sha256,expected);assert.equal(sha(resolve(assets,p.file)),expected);
    assert.match(html,new RegExp(`name="wcp-pdf-${lang}-sha256" content="${expected}"`));
    assert.match(html,new RegExp(`href="Reports/wcp2026/2026-09-08-8a0a9018/${p.file}" download`));
  }
});
test('all local page assets and anchor links exist; no empty image src',()=>{
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    const url=m[1];if(url.startsWith('#'))assert.ok(ids.includes(url.slice(1)),url);
    else if(!/^(https?:|mailto:)/.test(url))assert.ok(existsSync(resolve(root,url==='/'?'index.html':url.replace(/^\//,'').split('?')[0])),url);
  }
  assert.doesNotMatch(html,/<img[^>]+src=""/);assert.doesNotMatch(app,/\.src\s*=\s*['"]['"]/);
});
test('state data reproduce national comparison, median and maximum',()=>{
  const list=sortedStates(data);assert.equal(list.length,32);assert.equal(medianState(data).toFixed(1),'21.6');
  assert.equal(list.at(-1).name,'Tlaxcala');assert.equal(list.at(-1).smape.toFixed(1),'46.7');
});
test('sex totals are descriptive, with a separate cumulative window',()=>{
  assert.equal(data.sex.women+data.sex.men,92727);assert.equal((data.sex.women/data.sex.total*100).toFixed(1),'73.1');
  assert.match(html,/not forecasts, individual risk or predictive performance by sex/i);
  assert.match(html,/cumulative 2026 notifications through epidemiological week 31/);
  assert.match(html,/cumulative window differs from the 25-week evaluation/);
});
function assertVisibleSexWarning(page){
  const card=page.match(/<article class="sex-card"[\s\S]*?<\/article>/)?.[0];
  assert.ok(card);assert.match(card,/aria-describedby="sex-warning"/);
  const warning=card.match(/<p id="sex-warning" class="sex-warning"[^>]*>[\s\S]*?<\/p>/)?.[0];
  assert.ok(warning);assert.match(warning,/Different window and variable/);
  assert.match(warning,/not directly comparable with the national forecast callout/);
  assert.doesNotMatch(warning,/hidden|sr-only|display:none/);
  assert.ok(card.indexOf(warning)<card.indexOf('class="sex-total"'));
  assert.match(card,/Even when the weeks are aligned/);
}
test('sex warning precedes counts, is explicit and not folded into hidden details',()=>{
  assertVisibleSexWarning(html);assert.match(css,/\.sex-card>p\.sex-warning\{font-size:15px/);
  assert.match(app,/Otra ventana y variable/);assert.match(app,/Aun alineando las semanas/);
});
test('presentation negative: missing warning is rejected',()=>{
  assert.throws(()=>assertVisibleSexWarning(html.replace(/<p id="sex-warning"[\s\S]*?<\/p>/,'')));
});
test('presentation negative: inverted comparability is rejected',()=>{
  assert.throws(()=>assertVisibleSexWarning(html.replace('not directly comparable','directly comparable')));
});
test('home provides WCP links in desktop and mobile navigation',()=>{
  const home=readFileSync(resolve(root,'index.html'),'utf8');
  assert.ok((home.match(/href="wcp2026.html"/g)||[]).length>=2);
  assert.match(home,/<ul class="nav-menu">[\s\S]*?href="wcp2026.html"/);
  assert.match(home,/<div class="nav-mobile-items">[\s\S]*?href="wcp2026.html"/);
});
test('clinical caveats, selected-model caveat, and funding remain explicit',()=>{
  for(const s of ['not clinical incidence','not fully prospective','not uniform prospective out-of-sample validation','not the sum of the state forecasts','Benefits for services still need to be tested','No funding was received'])assert.ok(html.includes(s),s);
  assert.doesNotMatch(html,/rebull@outlook\.com|opción 9|98\.4%/);
  assert.match(html,/mailto:rebull@exatec\.tec\.mx/);
});
test('every visible translation key has Spanish copy and JavaScript selectors have HTML targets',()=>{
  const keys=[...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]);
  for(const key of keys)assert.match(app,new RegExp(`\\b${key}:`),key);
  for(const m of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes(`id="${m[1]}"`),m[1]);
});
test('keyboard dialog, table alternatives, touch layout and reduced motion are present',()=>{
  assert.match(html,/<dialog[^>]+aria-labelledby=/);assert.match(app,/dialog\.showModal/);assert.match(app,/opener\?\.focus/);
  assert.match(html,/id="week-slider" type="range"/);assert.match(html,/id="weekly-table"/);assert.match(html,/id="state-table"/);
  assert.match(css,/@media\(max-width:720px\)/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/:focus-visible/);
  assert.match(app,/if\(!response.ok\)throw/);assert.match(app,/showDataError/);
});
for(const [label,change] of [
  ['missing week',d=>d.national[0].dates.pop()],
  ['non-finite observation',d=>d.national[0].observations[0]=NaN],
  ['duplicated state',d=>d.states[1].name=d.states[0].name],
  ['chart detached from evaluated data',d=>d.national[0].historical[27]++],
  ['inverted interval',d=>d.national[0].lower[78]=d.national[0].upper[78]+1],
  ['different sex total',d=>d.sex.women++],
  ['unversioned data',d=>d.version='latest']
])test(`negative control: ${label}`,()=>{const d=structuredClone(data);change(d);assert.throws(()=>validateData(d));});
