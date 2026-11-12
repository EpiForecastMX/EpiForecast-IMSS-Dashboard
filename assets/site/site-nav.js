/* site-nav.js — comportamiento de la cabecera común (assets/site/shell.config.json).
 *
 * Mejora progresiva: sin este script la navegación sigue completa (lista móvil visible y grupos
 * por :hover/:focus-within). Con él:
 *   - la fila de escritorio se colapsa al menú ANTES de desbordar (se mide, no se adivina: cubre
 *     zoom al 200 % y fuentes grandes), con el mismo orden de enlaces;
 *   - el menú móvil y los grupos (Congresos, Más) son disclosures con aria-expanded, Escape cierra
 *     y devuelve el foco al botón que los abrió, y un clic fuera los cierra.
 * Sin estilos ni manejadores en línea: compatible con la CSP del dashboard (script-src 'self').
 */
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  var nav = header.querySelector('.site-nav');
  var menu = header.querySelector('.nav-menu');
  var toggle = header.querySelector('.site-nav__toggle');
  var mobile = document.getElementById('navMobile');
  if (!nav || !menu || !toggle || !mobile) return;

  header.setAttribute('data-enhanced', '');
  mobile.hidden = true;

  var inner = header.querySelector('.site-header__inner');
  // Alto de la barra común mientras está fija (0 en la variante no fija): las barras pegajosas propias
  // de cada página (p. ej. las secciones del archivo Tableau) se colocan debajo con
  // top: var(--site-header-h). Se publica en :root al cargar y en cada cambio de tamaño.
  var root = document.documentElement;
  function publishHeight() {
    var fija = window.getComputedStyle && window.getComputedStyle(header).position === 'sticky';
    var alto = fija && inner ? Math.ceil(inner.getBoundingClientRect().height) : 0;
    root.style.setProperty('--site-header-h', alto + 'px');
  }
  function setMobile(open, focusBack) {
    // Altura disponible bajo la barra (cambia con el zoom): el menú desplaza su propio contenido.
    if (open && inner) header.style.setProperty('--site-header-h', Math.ceil(inner.getBoundingClientRect().height) + 'px');
    mobile.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.site-nav__toggle-text').textContent = open ? 'Cerrar' : 'Menú';
    if (!open && focusBack) toggle.focus();
  }
  toggle.addEventListener('click', function () { setMobile(mobile.hidden); });
  mobile.addEventListener('click', function (e) { if (e.target.closest('a')) setMobile(false); });

  var groups = Array.prototype.slice.call(header.querySelectorAll('.nav-group'));
  function setGroup(g, open) {
    var b = g.querySelector('.nav-group__toggle');
    b.setAttribute('aria-expanded', String(open));
    g.classList.toggle('is-open', open);
  }
  groups.forEach(function (g) {
    var b = g.querySelector('.nav-group__toggle');
    // Un enlace del grupo (p. ej. un ancla de la misma página) cierra el desplegable.
    g.addEventListener('click', function (e) { if (e.target.closest('a')) setGroup(g, false); });
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') !== 'true';
      groups.forEach(function (o) { if (o !== g) setGroup(o, false); });
      setGroup(g, open);
    });
    g.addEventListener('focusout', function (e) {
      if (!g.contains(e.relatedTarget)) setGroup(g, false);
    });
  });
  document.addEventListener('click', function (e) {
    groups.forEach(function (g) { if (!g.contains(e.target)) setGroup(g, false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openGroup = groups.filter(function (g) { return g.classList.contains('is-open'); })[0];
    if (openGroup) { setGroup(openGroup, false); openGroup.querySelector('.nav-group__toggle').focus(); return; }
    if (!mobile.hidden) setMobile(false, true);
  });

  // Colapso medido: se intenta la fila completa; si no cabe en su espacio, se colapsa.
  // La fila no envuelve (nowrap): si el menú es más ancho que su contenedor, desbordaría.
  // Se re-mide cuando cambia el ANCHO del header o el TAMAÑO DEL TEXTO (zoom sólo de texto, fuentes
  // del usuario): la firma combina ambos. El propio colapso cambia la altura del header y vuelve a
  // disparar el observador, pero con la misma firma no se re-mide: no hay bucle expandir/colapsar.
  var brand = header.querySelector('.site-brand');
  var probe = menu.querySelector('a, button');
  var lastKey = '';
  function key() {
    var fs = probe && window.getComputedStyle ? window.getComputedStyle(probe).fontSize : '';
    var bfs = brand && window.getComputedStyle ? window.getComputedStyle(brand).fontSize : '';
    return header.clientWidth + '|' + fs + '|' + bfs;
  }
  function fit(force) {
    publishHeight();
    var k = key();
    if (!force && k === lastKey) return;
    lastKey = k;
    header.removeAttribute('data-collapsed');
    // Desborde por cualquier lado: más ancho que su contenedor o montado sobre la marca.
    var overlap = brand && menu.getBoundingClientRect().left < brand.getBoundingClientRect().right;
    var collapse = menu.scrollWidth > nav.clientWidth + 1 || overlap;
    if (collapse) header.setAttribute('data-collapsed', '');
    else if (!mobile.hidden) setMobile(false);
  }
  fit(true);
  if (typeof window.ResizeObserver === 'function') {
    var ro = new window.ResizeObserver(function () { fit(false); });
    ro.observe(header);
    ro.observe(menu); // el ancho intrínseco del menú cambia con el texto aunque el header no
  } else window.addEventListener('resize', function () { fit(false); });
  window.addEventListener('pageshow', function () { fit(true); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(true); });
})();
