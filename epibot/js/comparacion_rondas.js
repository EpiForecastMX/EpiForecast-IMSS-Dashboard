// Comparación descriptiva de pronósticos archivados. Nunca usa el ajuste W1–W37.
export function filasComparacion(data, pad, ventana = 'anio') {
  const rows = data?.series?.[pad]?.semanas || [];
  return rows.filter(w => ventana === 'actual' ? w.semana >= 38 :
    ventana === 'archivo' ? w.fase_anterior === 'archivo_previo' : true);
}

export function resumenPares(rows, key) {
  const pairs = rows.filter(w => Number.isFinite(w.real) && Number.isFinite(w[key]));
  if (!pairs.length) return { n: 0, observado: null, previsto: null, mae: null, diferencia: null };
  const observado = pairs.reduce((a,w) => a + w.real, 0);
  const previsto = pairs.reduce((a,w) => a + w[key], 0);
  return { n: pairs.length, observado, previsto, diferencia: previsto - observado,
    mae: pairs.reduce((a,w) => a + Math.abs(w[key] - w.real), 0) / pairs.length };
}

export function formatoCasos(v) {
  if (!Number.isFinite(v)) return '—';
  const n = Math.round(v);
  return (Object.is(n,-0) ? 0 : n).toLocaleString('es-MX', {maximumFractionDigits:0});
}

export function rangoGrafico(values, zoom = false) {
  const nums = values.filter(Number.isFinite);
  if (!nums.length) return {min:0,max:1};
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const pad = Math.max(1,(hi-lo)*0.15,hi*0.015);
  return {min:zoom ? Math.max(0,Math.floor(lo-pad)) : 0,
    max:Math.max(1,Math.ceil(hi+(zoom ? pad : Math.max(1,hi*0.12))))};
}

export function graficoRondas(data, pad, ventana = 'anio') {
  const rows = filasComparacion(data, pad, ventana);
  const s = data.series[pad];
  return {
    type: 'line', title: `${pad === 'Depresion' ? 'Depresión' : pad} · comparación de rondas`,
    labels: rows.map(w => `Sem ${w.semana}`),
    // Mesa de gráficas (25-nov-2026): la «ronda anterior» une dos cosas distintas y se separan: W7–W23 es una reconstrucción
    // retrospectiva (sin archivo emitido) y W24 en adelante el pronóstico archivado el 5 de junio. Dengue sólo tiene archivo.
    datasets: [
      { label: 'Observado', data: rows.map(w => w.real), borderColor: '#2a78d6',
        backgroundColor: '#2a78d6', pointRadius: 3, borderWidth: 2, tension: 0, spanGaps: false },
      ...(pad === 'Dengue' ? [] : [{ label: 'Anterior: retrospectiva', motor: s.motor_anterior,
        data: rows.map(w => (w.semana <= 23 ? w.anterior : null)), borderColor: '#9a5a3c', backgroundColor: '#9a5a3c',
        borderDash: [2, 3], pointRadius: 2, borderWidth: 2, tension: 0, spanGaps: false }]),
      { label: 'Anterior: archivada', motor: s.motor_anterior,
        data: rows.map(w => (pad === 'Dengue' || w.semana >= 24 ? w.anterior : null)), borderColor: '#eb6834', backgroundColor: '#eb6834',
        borderDash: [6,4], pointRadius: 2, borderWidth: 2, tension: 0, spanGaps: false },
      { label: 'Actual · W37', motor: s.motor_actual, data: rows.map(w => w.actual),
        borderColor: '#1baf7a', backgroundColor: '#1baf7a', pointRadius: 3, borderWidth: 2,
        tension: 0, spanGaps: false },
    ],
    options: {
      scales: { y: { beginAtZero: ventana !== 'actual',
        ...rangoGrafico(rows.flatMap(w=>[w.real,w.anterior,w.actual]),ventana==='actual'),
        ticks:{precision:0,callback:formatoCasos} } },
      plugins: {
        title:{display:true,text:[`${pad === 'Depresion' ? 'Depresión' : pad} · nacional`, 'Comparación de rondas 2026', pad === 'Dengue' ? 'Anterior: archivo de junio' : 'Retro W7–23 · archivo W24+'],
          color:'#173c33',font:{size:14,weight:'700',family:'system-ui'},align:'start',padding:{bottom:8}},
        legend:{position:'bottom',align:'start',labels:{color:'#40594f',usePointStyle:false,
          boxWidth:22,padding:10,font:{size:12,family:'system-ui'}}},
        tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}${ctx.dataset.motor ? ` (${ctx.dataset.motor})` : ''}: ${formatoCasos(ctx.parsed.y)}`}},
      },
    },
  };
}

const num = formatoCasos;
export function comparacionRondasMd(data, pad) {
  if (!data?.series?.[pad]) return `No hay un pronóstico anterior verificado para esa serie en esta función. El seguimiento W38–${data?.observado_hasta?.split('-')[1] ?? ''} sigue disponible.`;
  const s = data.series[pad];
  const rows = filasComparacion(data, pad);
  const lines = [`**${pad === 'Depresion' ? 'Depresión' : pad} — comparación 2026 de rondas** (nacional, ambos sexos).`, '',
    `W7–W23: comparación retrospectiva neuro, sin prueba de archivo emitido en febrero. Dengue sólo tiene archivo anterior desde W22. W24–${data.observado_hasta.split('-')[1]}: pronóstico archivado el 5 de junio antes del periodo comparado. El motor actual sólo se compara desde W38 hasta ${data.observado_hasta}, después del corte W37.`, '',
    `Motor anterior: **${s.motor_anterior}**. Motor actual: **${s.motor_actual}**. No es un ranking entre rondas ni el desempeño general del modelo.`, '',
    'Los puntos son pronósticos propios del modelo nacional. El holdout del artículo utiliza el agregado estatal: son productos distintos. Se muestran casos enteros; los archivos y cálculos conservan su precisión original.', '',
    '| Semana | Periodo del boletín | Observado | Anterior | Actual W37 | Diferencia anterior − obs. | Diferencia actual − obs. | Procedencia |',
    '|---|---|---:|---:|---:|---:|---:|---|'];
  for (const w of rows) {
    const diff = key => Number.isFinite(w.real) && Number.isFinite(w[key]) ? num(w[key] - w.real) : '—';
    lines.push(`| Sem ${w.semana} | ${w.inicio} a ${w.fin} | ${num(w.real)} | ${num(w.anterior)} | ${num(w.actual)} | ${diff('anterior')} | ${diff('actual')} | ${w.fase_anterior.replaceAll('_',' ')} |`);
  }
  lines.push('', `[Abrir comparación interactiva: año, archivo previo o zoom W38–${data.observado_hasta.split('-')[1]}](../comparacion_rondas.html)`,
    `<!--RONDAS:${JSON.stringify({ pad })}-->`);
  return lines.join('\n');
}
