'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const fmt = v => v == null ? 'Sin dato' : Number(v).toLocaleString('es-MX');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const flags = {
    national_only_source: 'En este boletín se usa el resumen nacional; no existe desglose estatal para el punto.',
    accumulated_year_conflict: 'El año de las columnas falta o contradice el corte del cuadro. No se grafica el acumulado ambiguo.',
    state_total_discrepancy: 'La suma estatal difiere del total impreso. Se conserva cada cifra publicada.',
    negative_values_reported: 'Hay valores negativos publicados en este bloque; no se infiere su causa.',
    source_footnote: 'La fuente incluye una nota de corrección en este bloque.',
    unavailable_source_cells: 'Hay celdas no disponibles o ilegibles en la fuente.',
    historical_definition: 'Clasificación histórica: su definición o código difiere del catálogo actual. Se conserva como una serie propia.',
    weekly_not_reported: 'El cuadro no publica casos semanales para este bloque. Sus acumulados se conservan.',
    in_study_excluded: 'Los casos en estudio se conservan aparte y se excluyen de los confirmados.',
    source_code_changed: 'El código impreso difiere entre ediciones; la identidad se comprobó por el nombre de la enfermedad.',
    source_cut_verified_by_national: 'El encabezado estatal está atrasado. El periodo se corroboró con las cifras idénticas del resumen nacional de esta edición; se conserva el encabezado original.',
    source_state_label_missing: 'La fuente omite el rótulo de una entidad. Su fila sin identificar no se asigna a un estado.',
    source_cut_conflict: 'El encabezado de la fuente tiene un corte contradictorio. Este punto queda como hueco en la curva.'
  };
  let index, catalog, selected, sequence = 0, current = [], view = [];
  const cache = new Map();
  const controls = ['curveDisease','curveState','curveMetric','curveMode','curveStart','curveEnd'];
  function value(p) {
    if (!p) return null;
    const m = Number($('curveMetric').value), state = Number($('curveState').value);
    if(m===2)return state < 0 ? p.in_study ?? null : p.in_study_states?.[state] ?? null;
    return state < 0 ? p.n[m] : p.e?.[state]?.[m] ?? null;
  }
  function periodLabel(p) { return `${p.y} · semana ${String(p.w).padStart(2,'0')}`; }
  function sourceLink(p) {
    const s = index.sources[p.s];
    const archive = /\.zip$/i.test(s.url);
    return `${archive ? `Archivo oficial · ${esc(s.archive_member || s.filename)} · ` : ''}<a href="${esc(s.url)}${archive?'':`#page=${p.p}`}" target="_blank" rel="noopener">Boletín ${s.year}-W${String(s.week).padStart(2,'0')}, p. ${p.p}</a>`;
  }
  function inspect(p) {
    if (!p) return;
    const s = index.sources[p.s];
    $('curvePoint').innerHTML = `<strong>${periodLabel(p)}: ${fmt(value(p))} notificaciones</strong><span>${sourceLink(p)} · corte observado distinto de la fecha de publicación cuando corresponde.</span>${p.revisions ? `<span>${p.revisions} versión(es) anterior(es) conservadas en la descarga nacional.</span>` : ''}${p.flags.length ? `<span class="curve-warning">${p.flags.map(f => esc(flags[f] || f)).join(' ')}</span>` : ''}`;
  }
  function draw() {
    if (!selected) return;
    const region = Number($('curveState').value), metric = Number($('curveMetric').value), compare = $('curveMode').value === 'compare';
    const d = catalog.find(d => d.id === selected.id);
    $('curveTitle').textContent = `${d.name} · ${region < 0 ? 'Nacional' : index.states[region]}`;
    const start = Number($('curveStart').value), end = Number($('curveEnd').value);
    const years = compare ? [...new Set([start,end])].sort((a,b)=>a-b) : Object.keys(index.source_years).map(Number).filter(y=>y>=Math.min(start,end)&&y<=Math.max(start,end));
    const periods = index.periods.filter(t=>years.includes(t.y));
    const points = new Map(selected.points.map(p => [`${p.y}-${p.w}`, p]));
    current = periods.map(t => ({...t, point: points.get(`${t.y}-${t.w}`), value: value(points.get(`${t.y}-${t.w}`))}));
    view = current.filter(t => t.value != null);
    const last = view.at(-1), firstPoint = view[0];
    $('curveStats').innerHTML = [
      ['Última semana disponible', last ? `${last.y}-W${String(last.w).padStart(2,'0')}` : 'Sin dato'],
      ['Primera semana disponible', firstPoint ? `${firstPoint.y}-W${String(firstPoint.w).padStart(2,'0')}` : 'Sin dato'],
      ['Último valor', last ? fmt(last.value) : 'Sin dato'],
      ['Puntos con cifra', `${view.length} / ${current.length}`]
    ].map(([l,v]) => `<div><span>${l}</span><strong>${v}</strong></div>`).join('');
    const flagged = current.filter(t => t.point?.flags.length).length;
    const unplaced=(selected.unplaced || []).filter(p=>years.includes(index.sources[p.s].year));
    $('curveCaption').textContent = `Eje X: ${compare ? 'semana epidemiológica (1–53), superposición de años' : `fecha de inicio de la semana epidemiológica, ${years[0]}–${years.at(-1)}`}. Eje Y: ${metric ? 'notificaciones acumuladas del año observado' : 'notificaciones semanales publicadas'}. Fuente: ${index.source_count} boletines SINAVE/DGE, ${Object.keys(index.source_years)[0]}–${Object.keys(index.source_years).at(-1)}. ${flagged ? `${flagged} ${flagged===1?'punto del bloque tiene':'puntos del bloque tienen'} avisos consultables.` : ''} ${unplaced.length?`${unplaced.length} bloques con fechas contradictorias quedan fuera de la curva y se conservan debajo, con sus cifras originales.`:''} Los huecos son ausencia o ambigüedad de dato; no son ceros.`;
    $('curveScope').textContent = region >= 0 && !selected.points.some(p => p.e) ? 'Este padecimiento aparece solo en el resumen nacional. No hay desglose estatal en estos cuadros.' : `${d.code} · ${metric ? 'Los acumulados se reinician en cada año observado; no se diferencian para fabricar casos semanales.' : 'La curva usa la columna semanal publicada, sin obtenerla por resta de acumulados.'} Los cambios de definición se conservan como categorías históricas separadas. La ausencia de un padecimiento antes de su incorporación no equivale a cero.`;
    const W=960,H=350,L=83,R=24,T=24,B=65,pw=W-L-R,ph=H-T-B;
    const vals = view.map(t => t.value), min = Math.min(0,...vals), max = Math.max(1,...vals), span = max-min;
    const low=min < 0 ? min-span*.07 : 0, high=max+span*.08;
    const Y=v=>T+(1-(v-low)/(high-low))*ph;
    const X=t=>L+((compare ? t.w-1 : periods.findIndex(p=>p.y===t.y&&p.w===t.w))/(compare?52:Math.max(1,periods.length-1)))*pw;
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="curveSvgTitle curveSvgDesc"><title id="curveSvgTitle">${esc(d.name)}, ${metric?'acumulados':'casos semanales'}, ${years[0]}–${years.at(-1)}</title><desc id="curveSvgDesc">${esc($('curveCaption').textContent)} Tabla accesible de cifras debajo de la gráfica.</desc>`;
    for(let i=0;i<=5;i++){
      const v=low+(high-low)*i/5,y=Y(v);
      svg+=`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" class="curve-grid"/><text x="${L-12}" y="${y+4}" text-anchor="end" class="curve-tick">${esc(Math.round(v).toLocaleString('es-MX'))}</text>`;
    }
    if(min<0)svg+=`<line x1="${L}" y1="${Y(0)}" x2="${W-R}" y2="${Y(0)}" class="curve-zero"/>`;
    const ticks=compare?[1,9,17,25,33,41,49,53].map(w=>({w,y:years[0],label:String(w)})):periods.filter((t,i)=>i===0||i===periods.length-1||(t.w===1&&(years.length<=7||t.y%2===0))).map(t=>({...t,label:years.length>3?String(t.y):`${t.y} W${t.w}`}));
    for(const t of ticks)svg+=`<text x="${X(t)}" y="${H-B+26}" text-anchor="middle" class="curve-tick">${t.label}</text>`;
    svg+=`<text x="${W/2}" y="${H-9}" text-anchor="middle" class="curve-axis">${compare?'Semana epidemiológica':'Año y semana epidemiológica observados'}</text><text transform="translate(16 ${T+ph/2}) rotate(-90)" text-anchor="middle" class="curve-axis">Notificaciones ${metric?'acumuladas':'por semana'}</text>`;
    for(const year of years){
      let path='', started=false;
      for(const t of current.filter(t=>t.y===year)){
        if(t.value==null){started=false;continue;}
        path+=`${started?'L':'M'}${X(t).toFixed(2)},${Y(t.value).toFixed(2)} `;started=true;
      }
      svg+=`<path d="${path}" class="curve-line curve-year-${!compare||year===years[0]?2025:2026}"/>`;
    }
    for(const [i,t] of current.entries())if(t.value!=null){const p=t.point;svg+=`<circle cx="${X(t)}" cy="${Y(t.value)}" r="${p.flags.length?4:3}" class="curve-dot curve-year-${!compare||t.y===years[0]?2025:2026}${p.flags.length?' curve-flagged':''}" data-point="${i}" tabindex="0" role="button" aria-label="${periodLabel(t)}: ${fmt(t.value)}. Ver fuente"><title>${periodLabel(t)}: ${fmt(t.value)}</title></circle>`;}
    svg+='</svg>';
    $('curveChart').innerHTML=svg;
    $('curveLegend').innerHTML = compare ? years.map((y,i)=>`<span class="curve-legend-${i===0?2025:2026}">${y}</span>`).join('') : `<span class="curve-legend-2025">${years[0]}–${years.at(-1)}</span>`;
    $('curveChart').querySelectorAll('[data-point]').forEach(el=>{
      const show=()=>inspect(current[Number(el.dataset.point)].point);
      el.addEventListener('pointerenter',show);el.addEventListener('click',show);el.addEventListener('focus',show);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')show();});
    });
    if(last)inspect(last.point);else $('curvePoint').textContent='No hay cifras para esta selección; consulta la cobertura del cuadro o elige Nacional.';
    $('curveDataRows').innerHTML=current.map(t=>{
      const p=t.point;
      return `<tr><td>${periodLabel(t)}</td><td class="number">${fmt(t.value)}</td><td>${p?sourceLink(p):'No aparece este periodo en los cuadros de los boletines analizados'}</td><td>${p?.flags.length?p.flags.map(f=>esc(flags[f]||f)).join(' ')+(p.flags.includes('source_cut_conflict')?` Cifras originales no graficadas: semanal ${fmt(p.reported_weekly)}; acumulado ${fmt(p.reported_cumulative)}.`:''):p?'Sin aviso específico':'Sin dato; no se imputa cero'}</td></tr>`;
    }).join('') + unplaced.map(p=>`<tr><td>Fecha ambigua · corte impreso ${periodLabel(p)}</td><td class="number">No se grafica</td><td>${sourceLink(p)}</td><td>El encabezado contradice la edición. Semanal nacional impreso: ${fmt(p.reported_weekly)}; acumulado nacional impreso: ${fmt(p.reported_cumulative)}. No se asigna a otra semana.</td></tr>`).join('');
    const url = new URL(location.href);url.searchParams.set('padecimiento',d.id);history.replaceState(null,'',url);
  }
  async function choose(id) {
    if (!index || !index.series[id]) return;
    const request=++sequence;
    $('curveStatus').hidden=false;$('curveStatus').textContent='Cargando la serie del padecimiento…';
    try {
      let series=cache.get(id);
      if(!series){const res=await fetch(index.series[id].path);if(!res.ok)throw new Error('No se pudo cargar la serie.');series=await res.json();cache.set(id,series);}
      if(request!==sequence)return;
      selected=series;$('curveDisease').value=id;const studyOption=$('curveMetric').querySelector('[value="2"]');studyOption.disabled=!series.points.some(p=>Object.hasOwn(p,'in_study'));if(studyOption.disabled&&$('curveMetric').value==='2')$('curveMetric').value='0';const hasStates=series.points.some(p=>p.e);$('curveState').disabled=!hasStates;if(!hasStates)$('curveState').value='-1';$('curveStatus').hidden=true;draw();
    }catch(e){if(request===sequence)$('curveStatus').textContent=e.message;}
  }
  async function init(){
    controls.forEach(id=>$(id).disabled=true);
    try{
      const [a,b]=await Promise.all([fetch('/assets/boletin/history/index.json'),fetch('/assets/boletin/2026-w42/data.json')]);
      if(!a.ok||!b.ok)throw new Error('No se pudo cargar el archivo histórico.');
      index=await a.json();catalog=index.categories || (await b.json()).diseases;
      const years=Object.keys(index.source_years).map(Number).sort((a,b)=>a-b);
      $('archiveCoverage').textContent=`ARCHIVO HISTÓRICO · ${index.source_count} PDF · ${years[0]}–${years.at(-1)}`;
      for(const id of ['curveStart','curveEnd'])$(id).innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
      $('curveStart').value=String(years[0]);$('curveEnd').value=String(years.at(-1));
      $('curveDisease').innerHTML=[...catalog].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(d=>`<option value="${d.id}">${esc(d.name)} · ${esc(d.code)}${d.aggregate?' (agregado)':''}${d.historical?' · clasificación histórica':''}</option>`).join('');
      $('curveState').innerHTML='<option value="-1">Nacional</option>'+index.states.map((s,i)=>`<option value="${i}">${esc(s)}</option>`).join('');
      controls.forEach(id=>$(id).disabled=false);
      const initial=new URLSearchParams(location.search).get('padecimiento');
      await choose(index.series[initial]?initial:'p70b1');if(location.hash==='#curvas')$('curvas').scrollIntoView({block:'start'});
    }catch(e){$('curveStatus').textContent=e.message;}
  }
  $('curveDisease').addEventListener('change',e=>choose(e.target.value));
  ['curveState','curveMetric','curveMode','curveStart','curveEnd'].forEach(id=>$(id).addEventListener('change',draw));
  $('curveCsv').addEventListener('click',()=>{
    if(!selected)return;
    const rows=[['padecimiento','entidad','anio_observado','semana_observada','valor','metrica','fuente','pagina','avisos']];
    const d=catalog.find(d=>d.id===selected.id),r=Number($('curveState').value);
    for(const t of current){const p=t.point;rows.push([d.name,r<0?'Nacional':index.states[r],t.y,t.w,t.value??'',$('curveMetric').value==='0'?'semanal':$('curveMetric').value==='2'?'en_estudio_acumulados':'acumulado',p?index.sources[p.s].url:'',p?.p??'',p?.flags.join('|')??'sin_dato']);}
    const csv='\uFEFF'+rows.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n');
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=`curva-${d.id}-${$('curveStart').value}-${$('curveEnd').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-curve]');if(!b)return;
    $('detail')?.close();choose(b.dataset.curve);$('curvas').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  });
  init();
})();
