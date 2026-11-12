// DOM simulado mínimo para probar los controladores reales (galeria.mjs, home-preview.js) con
// node:test, sin navegador ni dependencias. No reproduce diseño ni CSS: sólo la API que esos
// controladores usan. Los elementos con id se crean desde el HTML real de la página, con su etiqueta.
import { readFileSync } from 'node:fs';

export class FakeNode { constructor() { this.parentNode = null; this.children = []; } }
export class FakeText extends FakeNode {
  constructor(t) { super(); this._t = String(t); }
  get textContent() { return this._t; }
  set textContent(v) { this._t = String(v); }
}

let ROOT = null;

export class FakeElement extends FakeNode {
  constructor(tag, id = null) {
    super();
    this.tagName = String(tag).toUpperCase();
    this.attrs = {};
    this.listeners = {};
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.open = false;
    this._text = '';
    this.width = 0;
    this.height = 0;
    this.selectedIndex = 0;
    this.styleProps = {};
    const self = this;
    this.style = { setProperty(k, v) { self.styleProps[k] = v; } };
    this.classList = {
      add: (c) => { const s = new Set(self.className.split(/\s+/).filter(Boolean)); s.add(c); self.className = [...s].join(' '); },
      remove: (c) => { self.className = self.className.split(/\s+/).filter((x) => x && x !== c).join(' '); },
      toggle: (c, on) => { const has = self.className.split(/\s+/).includes(c); if (on ?? !has) self.classList.add(c); else self.classList.remove(c); },
      contains: (c) => self.className.split(/\s+/).includes(c),
    };
    if (id) this.attrs.id = id;
    this.onload = null;
    this.onerror = null;
  }
  get id() { return this.attrs.id ?? ''; }
  get className() { return this.attrs.class ?? ''; }
  set className(v) { this.attrs.class = String(v); }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === ROOT; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { for (const c of this.children) c.parentNode = null; this.children = []; this._text = String(v); }
  get firstChild() { return this.children[0] ?? null; }
  get childElementCount() { return this.children.filter((c) => c instanceof FakeElement).length; }
  get href() { return this.attrs.href ?? ''; }
  set href(v) { this.attrs.href = String(v); }
  get src() { return this.attrs.src ?? ''; }
  get alt() { return this.attrs.alt ?? ''; }
  set alt(v) { this.attrs.alt = String(v); }
  get type() { return this.attrs.type ?? ''; }
  set type(v) { this.attrs.type = String(v); }
  get label() { return this.attrs.label ?? ''; }
  set label(v) { this.attrs.label = String(v); }
  get parentElement() { return this.parentNode instanceof FakeElement ? this.parentNode : null; }
  get clientWidth() { return 600; }
  get clientHeight() { return 280; }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v);
    if (k === 'src' && this.tagName === 'IMG') FakeDom.current.loadImage(this);
  }
  getAttribute(k) { return Object.hasOwn(this.attrs, k) ? this.attrs[k] : null; }
  hasAttribute(k) { return Object.hasOwn(this.attrs, k); }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] ?? []).filter((x) => x !== f); }
  dispatch(type, extra = {}) {
    const ev = { type, target: this, currentTarget: this, preventDefault() {}, ...extra };
    for (const f of [...(this.listeners[type] ?? [])]) f.call(this, ev);
  }
  click() { this.dispatch('click'); }
  appendChild(c) { this.append(c); return c; }
  append(...cs) {
    for (const c of cs) {
      const n = typeof c === 'string' ? new FakeText(c) : c;
      if (n.parentNode) n.parentNode.children.splice(n.parentNode.children.indexOf(n), 1);
      n.parentNode = this;
      this.children.push(n);
    }
    if (this.tagName === 'SELECT') this._syncSelect();
  }
  _syncSelect() {
    const val = (o) => (o.value !== '' ? o.value : (o.attrs.value ?? o.textContent));
    const opts = this.querySelectorAll('option');
    if (opts.length && !opts.some((o) => val(o) === this.value)) this.value = val(opts[0]);
  }
  replaceChildren(...cs) { for (const c of this.children) c.parentNode = null; this.children = []; this._text = ''; this.append(...cs); }
  replaceWith(n) { const p = this.parentNode; if (!p) return; const i = p.children.indexOf(this); p.children[i] = n; n.parentNode = p; this.parentNode = null; }
  remove() { const p = this.parentNode; if (p) p.children.splice(p.children.indexOf(this), 1); this.parentNode = null; }
  contains(n) { while (n) { if (n === this) return true; n = n.parentNode; } return false; }
  _match(sel) {
    if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    return this.tagName === sel.toUpperCase();
  }
  querySelectorAll(sel) {
    const alts = sel.split(',').map((s) => s.trim());
    const out = [];
    const walk = (n) => n.children.forEach((c) => { if (c instanceof FakeElement) { if (alts.some((a) => c._match(a))) out.push(c); walk(c); } });
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  closest(sel) { let n = this; while (n instanceof FakeElement) { if (n._match(sel)) return n; n = n.parentNode; } return null; }
  matches(sel) { return sel.split(',').some((s) => this._match(s.trim())); }
  focus() { FakeDom.current.document.activeElement = this; }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { if (!this.open) return; this.open = false; this.dispatch('close'); }
  getBoundingClientRect() { return { height: 68, width: 600, top: 0, bottom: 68 }; }
  getContext() { return FakeDom.current.ctx2d; }
}

/** Entorno completo: document, window, location, history, fetch controlable, imágenes y Chart. */
export class FakeDom {
  static current = null;
  constructor({ html, path = '/Reports/index.html', search = '' }) {
    FakeDom.current = this;
    ROOT = new FakeElement('html');
    this.root = ROOT;
    this.byId = new Map();
    this.requests = [];
    this.imgFails = new Set(); // rutas (decodificadas) de PNG que fallan
    this.charts = [];
    this.warnings = [];
    const body = new FakeElement('body');
    ROOT.append(body);
    for (const m of html.matchAll(/<([a-zA-Z0-9]+)\b[^>]*\sid="([^"]+)"/g)) {
      if (this.byId.has(m[2])) continue;
      const e = new FakeElement(m[1], m[2]);
      const tagSrc = m[0];
      if (/\shidden(\s|>|=)/.test(tagSrc) || /\shidden$/.test(tagSrc)) e.hidden = true;
      body.append(e);
      this.byId.set(m[2], e);
    }
    // Las etiquetas <label> envuelven sus controles: closest('label') debe encontrar una.
    for (const id of ['gTerritorio', 'gSexo', 'gNivel']) {
      const c = this.byId.get(id);
      if (c) { const l = new FakeElement('label'); body.append(l); l.append(c); }
    }
    const self = this;
    this.ctx2d = new Proxy({ calls: [] }, { get: (t, k) => (k in t ? t[k] : (...a) => { t.calls.push([k, a]); }), set: (t, k, v) => { t[k] = v; return true; } });
    this.document = {
      documentElement: ROOT,
      activeElement: null,
      getElementById: (id) => self.byId.get(id) ?? null,
      createElement: (t) => new FakeElement(t),
      createElementNS: (_, t) => new FakeElement(t),
      createTextNode: (t) => new FakeText(t),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    };
    this.location = { pathname: path, search };
    this.winListeners = {};
    this.history = {
      pushState: (_, __, url) => { self.location.search = url.includes('?') ? url.slice(url.indexOf('?')) : ''; self.pushes = (self.pushes ?? 0) + 1; },
      replaceState: (_, __, url) => { self.location.search = url.includes('?') ? url.slice(url.indexOf('?')) : ''; },
    };
    this.routes = []; // [{test(url), respond(url) -> Promise<{ok,status,json}>}]
  }
  /** Instala los globales que usan los controladores. */
  install(extra = {}) {
    const g = globalThis;
    const self = this;
    this.saved = {};
    const set = (k, v) => { this.saved[k] = Object.getOwnPropertyDescriptor(g, k); Object.defineProperty(g, k, { value: v, configurable: true, writable: true }); };
    set('document', this.document);
    set('window', g);
    set('Node', FakeNode);
    set('location', this.location);
    set('history', this.history);
    set('getComputedStyle', () => ({ getPropertyValue: () => '' }));
    set('addEventListener', (t, f) => { (self.winListeners[t] ??= []).push(f); });
    set('fetch', (url) => self.fetch(url));
    set('Chart', class { constructor(canvas, cfg) { this.canvas = canvas; this.cfg = cfg; self.charts.push(this); } destroy() { this.destroyed = true; } });
    set('IntersectionObserver', undefined);
    set('console', { ...console, warn: (...a) => self.warnings.push(a.map(String).join(' ')) });
    for (const [k, v] of Object.entries(extra)) set(k, v);
    return this;
  }
  uninstall() {
    for (const [k, d] of Object.entries(this.saved ?? {})) {
      if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k];
    }
  }
  route(test, respond) { this.routes.unshift({ test, respond }); return this; }
  fetch(url) {
    this.requests.push(url);
    const r = this.routes.find((x) => (typeof x.test === 'function' ? x.test(url) : url.includes(x.test)));
    if (!r) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    return Promise.resolve(r.respond(url));
  }
  loadImage(img) {
    const src = decodeURI(img.attrs.src);
    const fail = [...this.imgFails].some((f) => src.endsWith(f));
    queueMicrotask(() => { const h = fail ? img.onerror : img.onload; if (h) h(); img.dispatch(fail ? 'error' : 'load'); });
  }
  popstate(search) { this.location.search = search; for (const f of this.winListeners.popstate ?? []) f(); }
  $(id) { return this.byId.get(id); }
}

/** Respuesta JSON de un archivo real del sitio. */
export const okFile = (root, rel) => ({ ok: true, status: 200, json: async () => JSON.parse(readFileSync(`${root}/${rel}`, 'utf8')) });
export const okJson = (obj) => ({ ok: true, status: 200, json: async () => obj });
export const httpError = (status) => ({ ok: false, status, json: async () => ({}) });
/** Promesa controlable: d.resolve(valor) más tarde. */
export function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }
export const tick = (n = 6) => new Promise((r) => { let i = 0; const step = () => (++i >= n ? r() : setImmediate(step)); setImmediate(step); });
