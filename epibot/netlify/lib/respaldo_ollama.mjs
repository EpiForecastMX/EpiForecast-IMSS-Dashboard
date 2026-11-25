/**
 * respaldo_ollama.mjs — modelo de respaldo cuando Gemini no responde (25-nov-2026).
 *
 * Desde el 25-nov la clave de Gemini responde «402 Payment Required». Con `EPI_LLM_RESPALDO="url|modelo"` (por ejemplo
 * `http://localhost:11434|llama3.1`) la función RAG usa Ollama cuando Gemini falla por clave, facturación o cuota, o cuando no
 * hay clave. El respaldo pasa por las mismas guardas y por el mismo verificador de cifras que Gemini: un modelo pequeño que
 * invente un número ve retirada esa oración (cifras_verificadas.mjs).
 *
 * En producción, Netlify no alcanza el Ollama de una computadora personal: el respaldo sólo funciona si la variable apunta a un
 * servidor de Ollama accesible desde la función (decisión de infraestructura del autor). Sin la variable, nada cambia.
 */

export const TIEMPO_RESPALDO = 60000;

/** «url|modelo» → { url, modelo } o null. */
export function specRespaldo(valor = process.env.EPI_LLM_RESPALDO) {
  if (!valor) return null;
  const [url, modelo] = String(valor).split('|');
  if (!/^https?:\/\//.test(url || '')) return null;
  return { url: url.replace(/\/$/, ''), modelo: modelo || 'llama3.1' };
}

/** Convierte el formato de Gemini (system + contents) en mensajes de chat de Ollama. */
export function mensajesOllama(system, contents) {
  return [{ role: 'system', content: system },
    ...contents.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: (c.parts || []).map((p) => p.text || '').join('') }))];
}

/** Genera una respuesta completa con Ollama; lanza un error si no responde a tiempo. */
export async function generaConOllama(spec, system, contents, { timeoutMs = TIEMPO_RESPALDO } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(`${spec.url}/api/chat`, {
      method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: spec.modelo, messages: mensajesOllama(system, contents), stream: false,
        options: { temperature: 0.2, num_ctx: 12288 } }),
    });
    if (!r.ok) throw new Error(`ollama ${r.status}`);
    const j = await r.json();
    return String(j?.message?.content || '');
  } finally { clearTimeout(t); }
}

/** Generador JSON para el modo nlu (misma firma que generadorOllama de nlu.mjs). */
export function nluConOllama(spec, { timeoutMs = 20000 } = {}) {
  return async (prompt) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(`${spec.url}/api/generate`, {
        method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: spec.modelo, prompt, format: 'json', stream: false, options: { temperature: 0 } }),
      });
      if (!r.ok) throw new Error(`ollama ${r.status}`);
      return (await r.json()).response;
    } finally { clearTimeout(t); }
  };
}
