/**
 * servidor_local.mjs — el sitio y la función RAG en una sola máquina, para probar el EpiBot completo sin Netlify (25-nov-2026).
 *
 * Sirve los archivos estáticos de la raíz del repositorio y atiende POST /.netlify/functions/rag con el mismo manejador de
 * netlify/functions/rag.mjs (incluido el streaming NDJSON). Las variables (GEMINI_API_KEY, DEEPSEEK_API_KEY, EPI_LLM_RESPALDO,
 * EPI_LLM_LOCAL) se leen del entorno; las claves nunca se imprimen. Uso:
 *   EPI_LLM_RESPALDO="http://localhost:11434|llama3.1" node epibot/scripts/servidor_local.mjs [puerto]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const PUERTO = Number(process.argv[2] || 8810);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
const rag = (await import(new URL('../netlify/functions/rag.mjs', import.meta.url).href)).default;

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  try {
    if (url.pathname === '/.netlify/functions/rag') {
      const cuerpo = [];
      for await (const c of req) cuerpo.push(c);
      const r = await rag(new Request(url, { method: req.method, headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '127.0.0.1' },
        body: req.method === 'POST' ? Buffer.concat(cuerpo) : undefined }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      if (r.body) for await (const c of r.body) res.write(c);
      return res.end();
    }
    let ruta = normalize(join(RAIZ, decodeURIComponent(url.pathname)));
    if (!ruta.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    if ((await stat(ruta).catch(() => null))?.isDirectory()) ruta = join(ruta, 'index.html');
    const datos = await readFile(ruta);
    res.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(datos);
  } catch (err) {
    res.writeHead(err?.code === 'ENOENT' ? 404 : 500);
    res.end();
  }
}).listen(PUERTO, () => console.log(`EpiBot local en http://localhost:${PUERTO}/epibot/ · respaldo: ${[process.env.DEEPSEEK_API_KEY && 'DeepSeek', process.env.EPI_LLM_RESPALDO && 'Ollama'].filter(Boolean).join(' y ') || 'ninguno'} · Gemini: ${process.env.GEMINI_API_KEY ? 'con clave' : 'sin clave'}`));
