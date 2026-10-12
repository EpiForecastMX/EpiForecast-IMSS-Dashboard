/** Current MICAI facts for bounded FAQ intents. Values come from verified index cards,
 * not from a second hand-maintained numerical table. Other questions stay on the RAG path. */
export function micaiIntent(query, history = []) {
  const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = norm(query);
  const explicit = /\bmicai\b/.test(q);
  const recent = history.slice(-4).some(h => /micai/.test(norm(h.text)));
  const distinctive = /revision por serie/.test(q) && /prophet|optima/.test(q);
  if (!(explicit || recent || distinctive) || q.length > 600) return null;
  if (/dengue|parkinson|alzheimer|cita textual|texto literal|que decia.*preprint/.test(q)) return null;
  if (/afiliacion|afiliaciones|autores|autor del/.test(q)) return [4];
  if (/fuga|prospectiv|fecha.*ejec|ejecut.*antes|congelad.*antes/.test(q)) return [5];
  if (/febrero|picos|estacional|saturacion/.test(q)) return [7];
  // Per-state forecasts, hyperparameters and other diseases are not answered by an aggregate FAQ.
  if (/dengue|parkinson|alzheimer|jalisco|tlaxcala|queretaro|estado de mexico|por estado|en [a-z]+.*pronostic/.test(q)) return null;
  if (/nacional/.test(q) && /ingenuo|naive/.test(q)) return [8];
  if (/seguimiento/.test(q) && /archivad|ingenuo|naive|ensemble|prophet/.test(q)) return [11];
  if (/revision|revisar|reseleccion/.test(q) && /optima|prophet|ganancia|mediana|32\.7|28\.5/.test(q)) return [10];
  if (/desagregacion/.test(q) && /aporte|aporta|para que|por que/.test(q)) return [15];
  if (/general|independientes|sexo/.test(q) && /mujeres|hombres|independ|suma/.test(q)) return [12, 3];
  if (/deepar/.test(q) && /6[.,]0|historic|entrenamiento|validacion/.test(q)) return [6];
  if (/99|111|denominador|cuantas.*series|cuantos.*objetivos|regiones/.test(q)) return [3];
  if (/contribucion|aporte principal|que aporta.*marco/.test(q)) return [0];
  return null;
}

export function micaiGroundedAnswer(query, history, index) {
  const ids = micaiIntent(query, history);
  if (!ids) return null;
  const cards = ids.map(id => index.chunks.find(c => c.id === `micai-current#${id}`));
  if (cards.some(c => !c || !c.text || !c.url)) {
    return { unavailable: true, error: 'La fuente actual del MICAI no está disponible; no se usará el preprint retirado.' };
  }
  return {
    answer: cards.map((c,i)=>`${c.text} [${i+1}]`).join('\n\n'),
    model: 'verified-source',
    generated: false,
    retrieval: 'curated-micai',
    reranked: false,
    sources: cards.map((c,i)=>({n:i+1,source:c.source,title:c.title,section:c.section,url:c.url,snippet:c.text})),
  };
}
