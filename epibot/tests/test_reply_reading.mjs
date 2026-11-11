import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const begin = app.indexOf('function revealReplyStart(');
assert.ok(begin >= 0, 'completed replies must preserve a readable starting position');
const source = app.slice(begin, app.indexOf('function scrollToBottom(', begin));
function setup({ following = true, hasQuestion = true, nearBottom = false } = {}) {
  let visible = false, bottomCalls = 0;
  const chatArea = { scrollTop: 100, querySelector: () => hasQuestion ? {} : null, getBoundingClientRect: () => ({ top: 100 }) };
  const context = { chatArea, stickToBottom: following, requestAnimationFrame: fn => fn(), isNearBottom: () => nearBottom,
    ensureScrollDownBtn: () => ({ classList: { add: () => { visible = true; } } }), hideScrollDownBtn: () => { visible = false; }, scrollToBottom: () => { bottomCalls++; } };
  vm.createContext(context); vm.runInContext(source, context);
  return { context, chatArea, reveal: () => context.revealReplyStart({ getBoundingClientRect: () => ({ top: 400 }) }), get visible() { return visible; }, get bottomCalls() { return bottomCalls; } };
}
test('a long completed answer opens at its text, with an explicit way to reach the chart below', () => {
  const s = setup(); s.reveal(); assert.equal(s.chatArea.scrollTop, 380); assert.equal(s.bottomCalls, 0); assert.equal(s.visible, true); assert.equal(s.context.stickToBottom, false);
});
test('new content never moves a reader who scrolled up deliberately', () => {
  const s = setup({ following: false }); s.reveal(); assert.equal(s.chatArea.scrollTop, 100); assert.equal(s.bottomCalls, 0); assert.equal(s.visible, true);
});
test('a short answer does not offer a redundant jump button', () => {
  const s = setup({ nearBottom: true }); s.reveal(); assert.equal(s.visible, false); assert.equal(s.context.stickToBottom, true);
});
test('the empty welcome screen keeps its existing positioning', () => {
  const s = setup({ hasQuestion: false }); s.reveal(); assert.equal(s.chatArea.scrollTop, 100); assert.equal(s.bottomCalls, 1);
});
