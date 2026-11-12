/**
 * release_config.js — vista como módulo del catálogo de releases (release_catalog.js).
 *
 * Todo lo que el EpiBot y sus gráficas necesitan de un release se deriva de esa lista.
 * Sin imports de otros módulos: lo cargan también módulos que no pueden depender de kb.js.
 */
import './release_catalog.js?v=19';

const CATALOGO = globalThis.EPI_CATALOGO;

export const RELEASES = CATALOGO.releases;
export const diabetesEnConsulta = CATALOGO.diabetesEnConsulta;
export const conDiabetesNombrada = CATALOGO.conDiabetesNombrada;
export const conHipertensionNombrada = CATALOGO.conHipertensionNombrada;
export const canonClinico = CATALOGO.canonClinico;
export const nombraAlias = CATALOGO.nombraAlias;
export const noModeladas = CATALOGO.noModeladas;
export const mencionaNoModelada = CATALOGO.mencionaNoModelada;
export const respuestaCrisis = CATALOGO.respuestaCrisis;
export const subtipoAjeno = CATALOGO.subtipoAjeno;

export const releaseDePad = (pad) => RELEASES.find((r) => r.pad === pad) || null;
export const releaseDeId = (id) => RELEASES.find((r) => r.id === id) || null;
export const releaseDeMarca = (marca) => RELEASES.find((r) => r.marca === marca) || null;

/** Marcador de gráfica de cualquier release; `app.js` lo lee y lo retira antes de pintar. */
export const MARCADOR_RELEASE = new RegExp(`<!--(${RELEASES.map((r) => r.marca).join('|')}):(.*?)-->`);

/** Alias de cada release con su padecimiento, para `entities.js`. */
export const ALIAS_RELEASES = Object.fromEntries(
  RELEASES.flatMap((r) => r.alias.map((a) => [a, r.pad])));

/** Palabras que el corrector de typos debe reconocer: los códigos CIE no se corrigen. */
export const VOCAB_RELEASES = RELEASES.flatMap((r) => r.alias.filter((a) => /^[a-z]{5,}$/.test(a)));

const strip = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Primer release que la consulta nombra por uno de sus alias, o null. */
export function releaseConAlias(q) {
  const qn = canonClinico(strip(q));
  return RELEASES.find((r) => r.alias.some((a) => nombraAlias(qn, a))) || null;
}
