// Buscador de padecimientos del radar: combobox editable (patrón ARIA APG, lista con autocompletado).
// Busca sin tildes por nombre, código CIE (con o sin punto) y grupo. El <select id="curveDisease"> oculto sigue
// siendo la fuente de verdad: al elegir se fija su valor y se lanza «change», como antes; curves.js y
// pronostico_vista.mjs no cambian de contrato.

/** Texto comparable: minúsculas, sin tildes ni signos. */
export function normaliza(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();
}

/** Entradas buscables a partir de las opciones del selector y los grupos de la foto vigente. */
export function entradas(opciones, grupos = {}) {
  return opciones.filter((o) => o.value).map((o) => {
    const texto = o.text;
    const [nombre, ...resto] = texto.split(' · ');
    const codigo = (resto[0] ?? '').replace(/\s*\(agregado\)$/, '');
    const grupo = grupos[o.value] ?? (/clasificación histórica/.test(texto) ? 'Clasificaciones históricas' : 'Otras categorías');
    const n = normaliza(nombre), c = normaliza(codigo), impreso = normaliza(o.impreso ?? o.dataset?.impreso ?? '');
    return { id: o.value, texto, nombre, codigo, grupo, n, c, cc: c.replace(/ /g, ''), g: normaliza(grupo), impreso };
  });
}

/** Coincidencias ordenadas: código exacto, nombre que empieza, palabra que empieza, subcadena. */
export function busca(lista, consulta) {
  const q = normaliza(consulta);
  if (!q) return lista;
  const palabras = q.split(' '), qc = q.replace(/ /g, '');
  const puntaje = (e) => {
    const todo = `${e.n} ${e.c} ${e.cc} ${e.g} ${e.impreso ?? ''}`;
    if (!palabras.every((p) => todo.includes(p))) return -1;
    if (e.cc === qc || e.c === q) return 0;
    if (e.cc.startsWith(qc)) return 1;
    if (e.n.startsWith(q)) return 2;
    if (e.n.split(' ').some((w) => w.startsWith(palabras[0]))) return 3;
    return 4;
  };
  return lista.map((e) => [puntaje(e), e]).filter(([p]) => p >= 0)
    .sort((a, b) => a[0] - b[0] || a[1].nombre.localeCompare(b[1].nombre, 'es')).map(([, e]) => e);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Monta el combobox sobre el DOM real del radar. */
export function monta(doc = document) {
  const $ = (id) => doc.getElementById(id);
  const input = $('curveSearch'), lista = $('curveSearchList'), sel = $('curveDisease'), estado = $('curveSearchStatus'), borrar = $('curveSearchClear');
  if (!input || !lista || !sel) return null;
  let todas = [], vistas = [], activa = -1, grupos = {}, temporizador = 0;

  const textoActual = () => sel.selectedOptions?.[0]?.text ?? '';
  const sincroniza = () => { input.value = textoActual(); input.disabled = sel.disabled; borrar.hidden = !input.value; };
  const abierta = () => input.getAttribute('aria-expanded') === 'true';

  function cierra(restaura = true) {
    input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    lista.hidden = true; activa = -1;
    if (restaura) sincroniza();
  }

  function pinta(consulta) {
    if (!todas.length) todas = entradas([...sel.options], grupos);
    vistas = busca(todas, consulta);
    const plano = Boolean(normaliza(consulta));
    if (!vistas.length) {
      lista.innerHTML = '<li class="combo-vacio" role="presentation">Sin coincidencias. Prueba con otro nombre o con el código CIE.</li>';
    } else if (plano) {
      lista.innerHTML = vistas.map((e, i) => opcion(e, i, true)).join('');
    } else {
      const orden = [...new Set(vistas.map((e) => e.grupo))].sort((a, b) => (a === 'Clasificaciones históricas') - (b === 'Clasificaciones históricas') || a.localeCompare(b, 'es'));
      let i = 0, html = '';
      vistas = orden.flatMap((g) => vistas.filter((e) => e.grupo === g));
      orden.forEach((g, k) => {
        const items = vistas.filter((e) => e.grupo === g);
        html += `<li role="group" aria-labelledby="curveSearchG${k}"><span class="combo-grupo" id="curveSearchG${k}" role="presentation">${esc(g)}</span><ul role="none">${items.map((e) => opcion(e, i++, false)).join('')}</ul></li>`;
      });
      lista.innerHTML = html;
    }
    input.setAttribute('aria-expanded', 'true'); lista.hidden = false;
    activa = -1; input.removeAttribute('aria-activedescendant');
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { estado.textContent = vistas.length ? `${vistas.length} ${vistas.length === 1 ? 'padecimiento' : 'padecimientos'}` : 'Sin coincidencias'; }, 400);
  }

  function opcion(e, i, conGrupo) {
    const elegido = e.id === sel.value;
    return `<li role="option" id="curveSearchO${i}" data-id="${esc(e.id)}" aria-selected="${elegido}" class="combo-opcion${elegido ? ' combo-elegida' : ''}"><span class="combo-nombre">${esc(e.nombre)}</span><span class="combo-codigo">${esc(e.codigo)}${conGrupo ? ` · ${esc(e.grupo)}` : ''}</span></li>`;
  }

  function mueve(k) {
    if (!vistas.length) return;
    activa = (k + vistas.length) % vistas.length;
    lista.querySelectorAll('.combo-activa').forEach((n) => n.classList.remove('combo-activa'));
    const nodo = $(`curveSearchO${activa}`);
    nodo?.classList.add('combo-activa'); nodo?.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', `curveSearchO${activa}`);
  }

  function elige(id) {
    cierra(false);
    if (id && id !== sel.value) { sel.value = id; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    sincroniza();
    estado.textContent = '';
  }

  input.addEventListener('focus', () => { input.select(); });
  input.addEventListener('click', () => { if (!abierta()) pinta(''); });
  input.addEventListener('input', () => { borrar.hidden = !input.value; pinta(input.value === textoActual() ? '' : input.value); });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); if (!abierta()) pinta(input.value === textoActual() ? '' : input.value); mueve(activa + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (!abierta()) pinta(''); mueve(activa - 1); }
    else if (ev.key === 'Home' && abierta() && ev.altKey) { ev.preventDefault(); mueve(0); }
    else if (ev.key === 'End' && abierta() && ev.altKey) { ev.preventDefault(); mueve(vistas.length - 1); }
    else if (ev.key === 'Enter') { if (abierta()) { ev.preventDefault(); elige(vistas[activa >= 0 ? activa : 0]?.id); } }
    else if (ev.key === 'Escape') { if (abierta()) { ev.preventDefault(); cierra(); } else if (input.value) { input.value = ''; pinta(''); } }
    else if (ev.key === 'Tab') cierra();
  });
  // pointerdown en vez de click: elige antes de que el campo pierda el foco.
  lista.addEventListener('pointerdown', (ev) => {
    const li = ev.target.closest('[role="option"]');
    if (!li) return;
    ev.preventDefault(); elige(li.dataset.id);
  });
  input.addEventListener('blur', () => setTimeout(() => { if (doc.activeElement !== input) cierra(); }, 0));
  borrar.addEventListener('click', () => { input.value = ''; borrar.hidden = true; input.focus(); pinta(''); });

  // Sincronía con cualquier otra ruta que cambie el padecimiento (URL, «Ver curva», atrás/adelante).
  doc.addEventListener('radar:curva', () => setTimeout(() => { todas = todas.length ? todas : []; if (!abierta()) sincroniza(); }, 0));
  sel.addEventListener('change', () => { if (!abierta()) sincroniza(); });

  fetch('/assets/boletin/actual.json').then((r) => r.json())
    .then((a) => fetch(`/${a.carpeta}/data.json`)).then((r) => r.json())
    .then((d) => { grupos = Object.fromEntries(d.diseases.filter((x) => x.group).map((x) => [x.id, x.group])); todas = []; })
    .catch(() => {});
  sincroniza();
  return { pinta, elige, cierra };
}

if (typeof document !== 'undefined' && document.getElementById?.('curveSearch')) monta();
