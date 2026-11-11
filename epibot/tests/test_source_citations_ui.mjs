import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('function sourceChipsHtml('), app.indexOf('function bindSourceChips('));
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context = {DOC_ICON:'',ASK_ICON:'',escapeHtml:escape,escapeAttr:escape,polishSpanish:s=>s,safeUrl:u=>/^https?:\/\//.test(u)?u:''};
vm.createContext(context);vm.runInContext(source, context);
const render = sources => context.sourceChipsHtml(sources);
test('grouped excerpts retain every citation number, including a later cited chunk',()=>{
  const html=render([{n:1,source:'Reporte',url:'https://example.org/report',snippet:'Primero'},{n:4,source:'Reporte',url:'https://example.org/report',snippet:'Cuarto'}]);
  assert.equal((html.match(/class="msg-source-chip"/g)||[]).length,1);assert.match(html,/\[1\] \[4\]/);assert.match(html,/Primero/);assert.match(html,/Cuarto/);
});
test('identical titles with different destinations remain separately inspectable',()=>{
  const html=render([{n:2,source:'Reporte',url:'https://example.org/a'},{n:3,source:'Reporte',url:'https://example.org/b'}]);
  assert.equal((html.match(/class="msg-source-chip"/g)||[]).length,2);assert.match(html,/\[2\]/);assert.match(html,/\[3\]/);
});
test('repeated references do not duplicate their number, and source text stays escaped',()=>{
  const html=render([{n:4,source:'<img src=x>',url:'https://example.org/a'},{n:4,source:'<img src=x>',url:'https://example.org/a'}]);
  assert.equal((html.match(/\[4\]/g)||[]).length,1);assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});
test('no sources yields no fabricated attribution',()=>assert.equal(render([]),''));
