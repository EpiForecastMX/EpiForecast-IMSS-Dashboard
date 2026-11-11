import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ux = readFileSync(new URL('../js/ux.js', import.meta.url), 'utf8');
const start = ux.indexOf('function keyboardIsOpen()');
assert.ok(start >= 0);
const source = ux.slice(start, ux.indexOf('function syncKeyboard()', start));
function detected({editing = false, layout = 844, visual = 844, scale = 1, supported = true} = {}) {
  const c = {window: {innerHeight: layout, visualViewport: supported ? {height: visual, scale} : null}, document: {activeElement: {matches: () => editing}}};
  vm.createContext(c); vm.runInContext(source,c); return c.keyboardIsOpen();
}
test('resizing a desktop viewport to mobile does not masquerade as a keyboard', () => assert.equal(detected({visual: 844, layout: 844}),false));
test('a focused editor with a substantially reduced visual viewport is recognized', () => assert.equal(detected({editing:true,visual:500}),true));
test('pinch zoom is not reported as a keyboard', () => assert.equal(detected({editing:true,visual:500,scale:2}),false));
test('blurred editors and unavailable viewport APIs leave navigation visible', () => {assert.equal(detected({visual:500}),false);assert.equal(detected({editing:true,supported:false}),false);});
