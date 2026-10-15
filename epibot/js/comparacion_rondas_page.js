import { filasComparacion, resumenPares, graficoRondas, formatoCasos, rangoGrafico } from './comparacion_rondas.js?v=2';
const $ = id => document.getElementById(id);
const num = formatoCasos;
let data;
function render() {
  const pad = $('pad').value, window = $('window').value;
  const rows = filasComparacion(data, pad, window), chart = graficoRondas(data, pad, window);
  const width=Math.max(300,$('chart').clientWidth), height=350, left=62, top=30, bottom=48, right=30;
  const zoom = window === 'actual';
  const range = rangoGrafico(chart.datasets.flatMap(s=>s.data),zoom);
  const x = i => left+i*(width-left-right)/Math.max(1,rows.length-1);
  const y = v => height-bottom-(v-range.min)/(range.max-range.min)*(height-top-bottom);
  const label = pad === 'Depresion' ? 'Depresión' : pad;
  let svg = `<svg role="img" aria-label="${label}: observado, ronda anterior y actual por semana" viewBox="0 0 ${width} ${height}" data-y-min="${range.min}" data-y-max="${range.max}"><title>${label}: comparación de rondas por semana del boletín</title>`;
  for(let i=0;i<=4;i++) {
    const v=range.min+i*(range.max-range.min)/4, yy=y(v);
    svg+=`<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="#394660"/><text x="${left-10}" y="${yy+5}" text-anchor="end" fill="#c6cfdf" font-size="13">${num(v)}</text>`;
  }
  const stride=Math.max(1,Math.ceil((rows.length-1)/(Math.max(2,Math.floor(width/80))-1)));
  rows.forEach((w,i)=>{
    if(i===rows.length-1 || (i%stride===0 && i<rows.length-1-stride/2))
      svg+=`<text x="${x(i)}" y="${height-20}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}" fill="#c6cfdf" font-size="13">W${w.semana}</text>`;
  });
  for(const s of chart.datasets) {
    let path='', connected=false;
    s.data.forEach((v,i)=>{if(!Number.isFinite(v)){connected=false;return;}path+=`${connected?'L':'M'}${x(i)},${y(v)} `;connected=true;});
    svg+=`<path d="${path}" fill="none" stroke="${s.borderColor}" stroke-width="2.5" ${s.borderDash?'stroke-dasharray="6 4"':''}/>`;
    s.data.forEach((v,i)=>{if(Number.isFinite(v))svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="${s.pointRadius}" fill="${s.borderColor}"><title>W${rows[i].semana} · ${s.label}: ${num(v)}</title></circle>`;});
  }
  $('chart').innerHTML=svg+'</svg>';
  $('scaleNote').textContent=zoom?'Zoom W38–W39: eje vertical ajustado al rango visible; no comienza en cero.':'El eje vertical comienza en cero.';
  const summaries=['anterior','actual'].map(key=>{
    const s=resumenPares(rows,key);
    return `${key==='anterior'?'Ronda anterior':'Actual W37'}: ${s.n} pares válidos${s.n?` · observado ${num(s.observado)} · previsto ${num(s.previsto)} · diferencia ${num(s.diferencia)} · error absoluto medio ${num(s.mae)} casos/semana`:''}.`;
  });
  $('summary').textContent=summaries.join(' ')+' Los totales usan sólo los pares válidos de cada ronda en el periodo elegido; no son medidas del desempeño general.';
  $('rows').replaceChildren();
  for(const w of rows) {
    const tr=document.createElement('tr');
    const diff=k=>Number.isFinite(w.real)&&Number.isFinite(w[k])?w[k]-w.real:null;
    for(const v of [`W${w.semana}`,`${w.inicio} a ${w.fin}`,num(w.real),num(w.anterior),num(w.actual),num(diff('anterior')),num(diff('actual')),w.fase_anterior.replaceAll('_',' ')]) {
      const td=document.createElement('td');td.textContent=v;tr.append(td);
    }
    $('rows').append(tr);
  }
}
try {
  const response=await fetch('./epibot/comparacion_rondas.json?v=1');
  if(!response.ok)throw new Error('No se pudieron cargar los pronósticos archivados.');
  data=await response.json();
  const params = new URLSearchParams(location.search);
  if(data.series[params.get('pad')]) $('pad').value=params.get('pad');
  if(['anio','archivo','actual'].includes(params.get('periodo'))) $('window').value=params.get('periodo');
  $('sources').textContent=JSON.stringify(data.fuentes,null,2);
  document.querySelector('.notice p').textContent=data.notas.slice(0,4).join(' ');
  const last=data.observado_hasta.split('-')[1];
  $('window').options[0].textContent=`2026 hasta ${last} · descriptiva`;
  $('window').options[1].textContent=`W24–${last} · archivo previo al periodo`;
  $('window').options[2].textContent=`W38–${last} · comparar ambas rondas`;
  document.querySelector('.legend span:last-child').textContent='Actual · corte W37';
  const h=data.horizonte_actual;
  $('horizon').textContent=`Horizonte actual: ${h.primera} (${h.inicio}) a ${h.ultima} (${h.fin}) · corte ${h.corte} · ${h.pasos} pasos. ${h.pasos_sin_semana.length} paso sin semana del boletín, excluido de las comparaciones.`;
  $('pad').addEventListener('change',render);$('window').addEventListener('change',render);
  window.addEventListener('resize',render);
  render();
} catch(e) { $('error').textContent=e.message; }
