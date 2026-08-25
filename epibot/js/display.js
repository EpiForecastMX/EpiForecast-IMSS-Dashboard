/**
 * display.js — nombres tal y como se le enseñan a una persona.
 *
 * Los datos guardan las entidades sin tilde («Nuevo Leon») porque ése es su
 * identificador interno: es la clave con la que se indexa `knowledge.json` y la que
 * devuelve el emparejador de `entities.js`. Acentuar esas claves rompería la búsqueda en
 * silencio, que es exactamente la trampa que ya nos mordió con «Depresion»/«Depresión».
 *
 * Por eso la ortografía se arregla al PINTAR, no al guardar. Este módulo existe para que
 * la corrección viva en un solo sitio y todas las vistas puedan usarla: `app.js` ya lo
 * hacía con una copia local, pero `comparador.js` no, y por eso la comparativa de estados
 * salía diciendo «Nuevo Leon».
 *
 * Regla: `dn()` sólo se aplica a texto que va a la pantalla o a la voz. Nunca a una clave.
 */

export const DISPLAY_NAMES = {
  'Depresion': 'Depresión',
  'Ciudad de Mexico': 'Ciudad de México',
  'Nuevo Leon': 'Nuevo León',
  'San Luis Potosi': 'San Luis Potosí',
  'Mexico': 'México',
  'Leon': 'León',
  'Michoacan': 'Michoacán',
  'Queretaro': 'Querétaro',
  'Yucatan': 'Yucatán',
};

export function dn(s) {
  return s ? (DISPLAY_NAMES[s] || s) : s;
}
