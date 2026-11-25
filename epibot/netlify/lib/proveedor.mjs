/**
 * proveedor.mjs — interruptor de circuito del proveedor del modelo (mesa agéntica, 25-nov-2026).
 *
 * El 25-nov-2026 la cuenta de Gemini respondió «402 Payment Required» a todos los modelos. La función RAG gastaba un segundo
 * intento con el otro modelo y devolvía un error genérico; además cada consulta volvía a pagar embebido, reescritura y
 * rerank fallidos. Con este interruptor, un error de clave o de facturación apaga el proveedor cinco minutos y uno de cuota
 * un minuto: mientras tanto la función responde con lo que no depende del modelo (recuperación léxica, guardas y vistas).
 */

const FATAL = /API[_\s]?KEY|permission|unauthor|forbidden|\b40[123]\b|payment required|billing|facturaci/i;
// Con límites de palabra: el SDK incluye la URL «…:generateContent» en el mensaje y «rate» a secas coincidía con ella.
const CUOTA = /\bquota\b|\brate[\s_-]?limit|too many requests|\b429\b|resource[_\s]?(has been )?exhausted/i;
const RED = /network|fetch failed|timeout|abort|ECONN|ENOTFOUND/i;

let bloqueadoHasta = 0;
let ultimoTipo = null;

/** ¿El proveedor está apagado por un fallo reciente? */
export function proveedorBloqueado(ahora = Date.now()) {
  return ahora < bloqueadoHasta;
}

/** Clasifica un error del proveedor y, si es de clave, facturación o cuota, abre el interruptor. */
export function registraFallo(err, ahora = Date.now()) {
  const m = String(err?.status ?? '') + ' ' + String(err?.message ?? err ?? '');
  let tipo = 'otro';
  if (FATAL.test(m)) { tipo = 'fatal'; bloqueadoHasta = ahora + 5 * 60e3; }
  else if (CUOTA.test(m)) { tipo = 'cuota'; bloqueadoHasta = ahora + 60e3; }
  else if (RED.test(m)) tipo = 'red';
  ultimoTipo = tipo;
  return tipo;
}

/** ¿Vale la pena intentar otro modelo del mismo proveedor? No con clave, facturación ni cuota. */
export const reintentable = (tipo) => tipo === 'otro' || tipo === 'red';

/** Mensaje para la persona: nunca el error crudo del proveedor. */
export function mensajeUsuario(tipo = ultimoTipo) {
  if (tipo === 'cuota') return 'Se alcanzó el límite de consultas de IA. Intenta de nuevo en un momento.';
  if (tipo === 'red') return 'Hubo un problema de conexión con la IA. Vuelve a intentarlo.';
  if (tipo === 'fatal' || proveedorBloqueado()) {
    return 'La IA de respaldo no está disponible en este momento. Pregúntame por un padecimiento y un lugar (por ejemplo, «¿cómo va el dengue en Veracruz?») y te respondo con los datos publicados.';
  }
  return 'No pude consultar a la IA en este momento. Vuelve a intentarlo en unos minutos.';
}

/** Sólo para pruebas: cierra el interruptor. */
export function _reiniciaProveedor() { bloqueadoHasta = 0; ultimoTipo = null; }
