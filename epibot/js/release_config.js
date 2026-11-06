/**
 * release_config.js — padecimientos publicados desde un release del runner.
 *
 * Es la lista única que usan el EpiBot y sus gráficas para no repetir nombres, páginas y marcadores.
 * `diabetesEnConsulta` resuelve los subtipos: «diabetes» a secas se responde con tipo II y lo avisa.
 * Sin imports: lo cargan también módulos que no pueden depender de kb.js.
 */
export const RELEASES = [
  { id: 'obesidad', pad: 'Obesidad', nombre: 'Obesidad', etiqueta: 'Obesidad (E66)', dataKey: 'obesidad', marca: 'OBESIDAD', pagina: 'obesidad.html', consulta: 'obesidad', cie: 'E66', color: '#D97706' },
  { id: 'diabetes_t1', pad: 'Diabetes tipo I', nombre: 'Diabetes tipo I', etiqueta: 'Diabetes tipo I (E10)', dataKey: 'diabetes_t1', marca: 'DIABETES_T1', pagina: 'diabetes_t1.html', consulta: 'diabetes tipo 1', cie: 'E10', color: '#22D3EE' },
  { id: 'diabetes_t2', pad: 'Diabetes tipo II', nombre: 'Diabetes tipo II', etiqueta: 'Diabetes tipo II (E11-E14)', dataKey: 'diabetes_t2', marca: 'DIABETES_T2', pagina: 'diabetes_t2.html', consulta: 'diabetes tipo 2', cie: 'E11-E14', color: '#F472B6' },
];

export const releaseDePad = (pad) => RELEASES.find((r) => r.pad === pad) || null;
export const releaseDeId = (id) => RELEASES.find((r) => r.id === id) || null;
export const releaseDeMarca = (marca) => RELEASES.find((r) => r.marca === marca) || null;

/** Marcador de gráfica de cualquier release; `app.js` lo lee y lo retira antes de pintar. */
export const MARCADOR_RELEASE = /<!--(OBESIDAD|DIABETES_T1|DIABETES_T2):(.*?)-->/;

const T1 = 'Diabetes tipo I';
const T2 = 'Diabetes tipo II';

/**
 * Subtipos de diabetes que nombra la consulta (ya normalizada), o null si no habla de los que se
 * modelan. Diabetes gestacional, insípida y prediabetes no se modelan: quedan para el aviso de no
 * modelados. Devuelve `{ pads, generica }`; `generica` indica que no se nombró ningún subtipo.
 */
export function diabetesEnConsulta(qn) {
  const q = ` ${String(qn)} `;
  if (!/ (diabet|dm ?[12] |e1[0-4] )/.test(q)) return null;
  if (/ (prediabet|pre diabet|gestacional|insipida|embarazo)/.test(q)) return null;
  const sinNegada = q.replace(/ no insulinodependiente/g, ' dm2');
  const ambos = /(tipos? (1|i|uno) y (2|ii|dos)|ambos tipos|los dos tipos)/.test(sinNegada);
  const t1 = ambos || / (tipo (1|i|uno) |dm ?1 |e10 |juvenil|insulinodependiente)/.test(sinNegada);
  const t2 = ambos || / (tipo (2|ii|dos) |dm ?2 |e1[1-4] )/.test(sinNegada);
  if (t1 && t2) return { pads: [T1, T2], generica: false };
  if (t1) return { pads: [T1], generica: false };
  return { pads: [T2], generica: !t2 };
}
