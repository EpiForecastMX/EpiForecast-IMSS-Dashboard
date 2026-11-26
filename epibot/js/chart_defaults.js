/* chart_defaults.js — colores por omisión de Chart.js en el EpiBot (antes, un script en línea de index.html; la CSP no los
 * permite). Chart.js se carga con defer: los valores se aplican en DOMContentLoaded, cuando los diferidos ya corrieron y antes
 * de que app.js (módulo, posterior en el documento) dibuje. */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.color = '#40594f';
  Chart.defaults.borderColor = 'rgba(91, 141, 239, 0.12)';
  Chart.defaults.plugins.title.color = '#173c33';
  Chart.defaults.plugins.legend.labels.color = '#40594f';
  Chart.defaults.scale = Chart.defaults.scale || {};
});
