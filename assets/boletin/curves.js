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
  let index, catalog, selected, sequence = 0, current = [], view = [], C, A, cambioCifra = false;
  // Valor mostrado = lo impreso (cifra o guion); valor graficado = boletin/celdas.mjs: un guion
  // vale 0 sólo bajo la simbología; una cifra no publicada queda como hueco, nunca como 0.
  const cat = () => catalog.find(d => d.id === selected.id) || {};
  const shown = (raw) => C ? C.muestra(raw) : fmt(raw);
  const meaning = (raw, y) => C && C.esMarcador(raw) ? C.significado(raw, { guion: cat().guion, simbolos: index.symbols, anio: y }) : '';
  const cache = new Map();
  const controls = ['curveDisease','curveState','curveSex','curveMetric','curveMode','curveStart','curveEnd'];
  // Ámbito (nacional, macrorregión o entidad) y sexo; reglas en boletin/ambitos.mjs.
  const ambito = () => A ? A.parseAmbito($('curveState').value) : { tipo: 'nacional' };
  const sexo = () => A ? A.parseSexo($('curveSex').value) : 'general';
  const hasSex = () => Boolean(selected?.points.some(p => p.x));
  // Acumulados por sexo: archivos aparte (history/sexo/), cargados sólo al elegir Hombres o Mujeres.
  let sexIndex = null;
  async function cargaSexo(series) {
    if (series.sexo) return;
    sexIndex ??= fetch('/assets/boletin/history/sexo/index.json').then(r => r.ok ? r.json() : { series: {} }).catch(() => ({ series: {} }));
    const ref = (await sexIndex).series?.[series.id];
    if (ref) {
      const r = await fetch(ref.path);
      if (!r.ok) throw new Error('No se pudieron cargar los acumulados por sexo.');
      const porClave = new Map((await r.json()).points.map(q => [`${q.y}-${q.w}-${q.s}`, q]));
      for (const p of series.points) { const q = porClave.get(`${p.y}-${p.w}-${p.s}`); if (q) { p.x = q.x; p.ex = q.e; } }
    }
    series.sexo = ref ? 'cargado' : 'sin';
  }
  const numeroCelda = y => v => C.numero(v, cat().guion, y);
  /** Suma regional de las celdas estatales de un punto (null si falta una entidad). */
  function regional(p, celdas) { return A.sumaRegion(celdas, ambito().id, numeroCelda(p.y)); }
  /** Celdas estatales de la cifra y el sexo elegidos (null si el bloque no tiene desglose). */
  function celdasEstatales(p, m, s) {
    if (s !== 'general') { const k = s === 'hombres' ? 0 : 1; return p.ex ? p.ex.map(c => c?.[k] ?? null) : null; }
    if (m === 2) return p.in_study_states ?? null;
    return p.e ? p.e.map(c => c?.[m] ?? null) : null;
  }
  function value(p) {
    if (!p) return null;
    const m = Number($('curveMetric').value), a = ambito(), s = sexo();
    // El boletín imprime el sexo sólo en los acumulados del año: no hay casos semanales por sexo que mostrar.
    if (s !== 'general' && m !== 1) return null;
    if (a.tipo === 'region') return regional(p, celdasEstatales(p, m, s)).valor;
    if (a.tipo === 'estado') return celdasEstatales(p, m, s)?.[a.i] ?? null;
    if (s !== 'general') return p.x?.[s === 'hombres' ? 0 : 1] ?? null;
    return m === 2 ? p.in_study ?? null : p.n[m];
  }
  /** Aviso de una semana regional sin cifra: qué entidades faltan o imprimen negativos. */
  function huecoRegional(p) {
    if (ambito().tipo !== 'region' || !p) return '';
    const r = regional(p, celdasEstatales(p, Number($('curveMetric').value), sexo()));
    if (r.valor != null) return '';
    const partes = [];
    if (r.faltan.length) partes.push(`sin cifra comparable en ${r.faltan.length === A.indicesRegion(ambito().id).length ? 'ninguna entidad de la región' : r.faltan.join(', ')}`);
    if (r.negativos.length) partes.push(`cifras negativas impresas en ${r.negativos.join(', ')}`);
    return `La suma regional de esta semana queda como hueco: ${partes.join('; ')}.`;
  }
  function nombreAmbito() {
    const a = ambito();
    return a.tipo === 'estado' ? index.states[a.i] : A ? A.nombreAmbito(a) : 'Nacional';
  }
  const nombreSexo = () => ({ hombres: 'Hombres', mujeres: 'Mujeres' })[sexo()] ?? '';
  function periodLabel(p) { return `${p.y} · semana ${String(p.w).padStart(2,'0')}`; }
  function sourceLink(p) {
    const s = index.sources[p.s];
    const archive = /\.zip$/i.test(s.url);
    return `${archive ? `Archivo oficial · ${esc(s.archive_member || s.filename)} · ` : ''}<a href="${esc(s.url)}${archive?'':`#page=${p.p}`}" target="_blank" rel="noopener">Boletín ${s.year}-W${String(s.week).padStart(2,'0')}, p. ${p.p}</a>`;
  }
  function inspect(p) {
    if (!p) return;
    const s = index.sources[p.s];
    const raw = value(p), m = meaning(raw, p.y), hueco = huecoRegional(p);
    $('curvePoint').innerHTML = `<strong>${periodLabel(p)}: ${esc(shown(raw))} notificaciones${ambito().tipo === 'region' ? ' (suma de entidades)' : ''}</strong>${m ? `<span class="curve-warning">${esc(m)}</span>` : ''}${hueco ? `<span class="curve-warning">${esc(hueco)}</span>` : ''}<span>${sourceLink(p)} · corte observado distinto de la fecha de publicación cuando corresponde.</span>${p.revisions ? `<span>${p.revisions} versión(es) anterior(es) conservadas en la descarga nacional.</span>` : ''}${p.flags.length ? `<span class="curve-warning">${p.flags.map(f => esc(flags[f] || f)).join(' ')}</span>` : ''}`;
  }
  function draw() {
    if (!selected) return;
    const a = ambito(), s = sexo(), metric = Number($('curveMetric').value), compare = $('curveMode').value === 'compare';
    const d = catalog.find(d => d.id === selected.id);
    $('curveTitle').textContent = `${d.name} · ${nombreAmbito()}${s !== 'general' ? ` · ${nombreSexo()}` : ''}`;
    escribeUrl(d.id);
    if (s !== 'general' && !selected.sexo) {
      const pedido = selected;
      $('curveStatus').hidden = false; $('curveStatus').textContent = 'Cargando los acumulados por sexo…';
      cargaSexo(pedido).then(() => { if (selected === pedido) { $('curveStatus').hidden = true; draw(); } })
        .catch(e => { if (selected === pedido) $('curveStatus').textContent = e.message; });
      return;
    }
    if (s !== 'general' && (metric !== 1 || !hasSex())) return sinSexo(d, metric);
    const start = Number($('curveStart').value), end = Number($('curveEnd').value);
    const years = compare ? [...new Set([start,end])].sort((a,b)=>a-b) : Object.keys(index.source_years).map(Number).filter(y=>y>=Math.min(start,end)&&y<=Math.max(start,end));
    const periods = index.periods.filter(t=>years.includes(t.y));
    const points = new Map(selected.points.map(p => [`${p.y}-${p.w}`, p]));
    current = periods.map(t => { const point = points.get(`${t.y}-${t.w}`), raw = value(point); return {...t, point, raw, value: C.numero(raw, d.guion, t.y)}; });
    view = current.filter(t => t.value != null);
    const last = view.at(-1), firstPoint = view[0];
    $('curveStats').innerHTML = [
      ['Última semana con dato', last ? `Semana ${last.w} de ${last.y}` : 'Sin dato'],
      ['Último valor', last ? esc(shown(last.raw)) : 'Sin dato'],
      ['Primera semana con dato', firstPoint ? `Semana ${firstPoint.w} de ${firstPoint.y}` : 'Sin dato'],
      ['Semanas con dato', `${view.length.toLocaleString('es-MX')} de ${current.length.toLocaleString('es-MX')}`]
    ].map(([l,v]) => `<div><span>${l}</span><strong${String(v).length>10?' class="stat-texto"':''}>${v}</strong></div>`).join('');
    const flagged = current.filter(t => t.point?.flags.length).length;
    const unplaced=(selected.unplaced || []).filter(p=>years.includes(index.sources[p.s].year));
    $('curveCaption').textContent = `Eje X: ${compare ? 'semana epidemiológica (1–53), superposición de años' : `fecha de inicio de la semana epidemiológica, ${years[0]}–${years.at(-1)}`}. Eje Y: ${metric ? 'notificaciones acumuladas del año observado' : 'notificaciones semanales publicadas'}. Fuente: ${index.source_count} boletines SINAVE/DGE, ${Object.keys(index.source_years)[0]}–${Object.keys(index.source_years).at(-1)}. ${flagged ? `${flagged} ${flagged===1?'punto del bloque tiene':'puntos del bloque tienen'} avisos consultables.` : ''} ${unplaced.length?`${unplaced.length} bloques con fechas contradictorias quedan fuera de la curva y se conservan debajo, con sus cifras originales.`:''} Los huecos son ausencia o ambigüedad de dato; no son ceros. «–» es el guion impreso por el boletín${d.guion ? `; en esta categoría, desde ${d.guion.desde}, es una cifra no publicada en el cuadro y queda como hueco` : ''}.`;
    const notaRegion = a.tipo === 'region' ? ` ${A.rotuloRegion(a.id)}: suma de las cifras estatales impresas, no una cifra del boletín. Es una macrorregión de EpiForecast-MX, no una región oficial del SINAVE; si falta la cifra de alguna de sus entidades, la semana queda como hueco y no se suma parcialmente. Puede diferir del total nacional impreso.` : '';
    const notaSexo = s !== 'general' ? `${cambioCifra ? ' La cifra cambió a «Acumulados del año observado»: el boletín no publica casos semanales por sexo.' : ''} ${nombreSexo()}: acumulado del año impreso por sexo en el cuadro; el boletín no publica casos semanales por sexo y no se obtienen por resta.` : '';
    $('curveScope').textContent = a.tipo !== 'nacional' && !selected.points.some(p => p.e) ? 'Este padecimiento aparece solo en el resumen nacional. No hay desglose estatal en estos cuadros.' : `${d.code} · ${metric ? 'Los acumulados se reinician en cada año observado; no se diferencian para fabricar casos semanales.' : 'La curva usa la columna semanal publicada, sin obtenerla por resta de acumulados.'}${notaRegion}${notaSexo} Los cambios de definición se conservan como categorías históricas separadas. La ausencia de un padecimiento antes de su incorporación no equivale a cero.`;
    const W=960,H=350,L=83,R=24,T=24,B=65,pw=W-L-R,ph=H-T-B;
    const vals = view.map(t => t.value), min = Math.min(0,...vals), max = Math.max(1,...vals), span = max-min;
    // Marcas «redondas» del eje Y (1, 2, 2.5 o 5 por potencia de 10), con el máximo dentro de la escala.
    const paso=(()=>{const bruto=Math.max(span,1)/5,p10=10**Math.floor(Math.log10(bruto));return [1,2,2.5,5,10].map(k=>k*p10).find(k=>k>=bruto);})();
    const low=min < 0 ? Math.floor(min/paso)*paso : 0, high=Math.max(paso,Math.ceil(max*1.02/paso)*paso);
    const marcasY=[];for(let v=low;v<=high+paso/1e6;v+=paso)marcasY.push(Math.round(v*1e6)/1e6);
    const Y=v=>T+(1-(v-low)/(high-low))*ph;
    const X=t=>L+((compare ? t.w-1 : periods.findIndex(p=>p.y===t.y&&p.w===t.w))/(compare?52:Math.max(1,periods.length-1)))*pw;
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="curveSvgTitle curveSvgDesc"><title id="curveSvgTitle">${esc(d.name)}, ${metric?'acumulados':'casos semanales'}, ${years[0]}–${years.at(-1)}</title><desc id="curveSvgDesc">${esc($('curveCaption').textContent)} Tabla accesible de cifras debajo de la gráfica.</desc>`;
    for(const v of marcasY){
      const y=Y(v);
      svg+=`<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" class="curve-grid"/><text x="${L-12}" y="${y+4}" text-anchor="end" class="curve-tick">${esc(v.toLocaleString('es-MX'))}</text>`;
    }
    if(min<0)svg+=`<line x1="${L}" y1="${Y(0)}" x2="${W-R}" y2="${Y(0)}" class="curve-zero"/>`;
    const ticks=compare?[1,9,17,25,33,41,49,53].map(w=>({w,y:years[0],label:String(w)})):(()=>{
      // Una marca por año (cada dos con más de siete años), en su primera semana disponible; nunca repetida.
      const cada=years.length>7?2:1, out=[];
      for(const y of years){if((y-years[0])%cada)continue;const t=periods.find(p=>p.y===y);if(t)out.push({...t,label:years.length>3?String(y):`${y} W${t.w}`});}
      if(years.length<=3){const u=periods.at(-1);if(u&&!out.some(t=>t.y===u.y&&t.w===u.w))out.push({...u,label:`${u.y} W${u.w}`});}
      return out;
    })();
    for(const t of ticks)svg+=`<text x="${X(t)}" y="${H-B+26}" text-anchor="middle" class="curve-tick">${t.label}</text>`;
    svg+=`<text x="${W/2}" y="${H-9}" text-anchor="middle" class="curve-axis">${compare?'Semana epidemiológica':'Año y semana epidemiológica observados'}</text><text transform="translate(16 ${T+ph/2}) rotate(-90)" text-anchor="middle" class="curve-axis">Notificaciones ${metric?'acumuladas':'por semana'}</text>`;
    for(const year of years){
      // Tramos entre huecos; una semana aislada se dibuja como punto (con el extremo redondo de la línea).
      let path='', n=0;
      for(const t of current.filter(t=>t.y===year)){
        if(t.value==null){if(n===1)path+='h0.01 ';n=0;continue;}
        path+=`${n?'L':'M'}${X(t).toFixed(2)},${Y(t.value).toFixed(2)} `;n++;
      }
      if(n===1)path+='h0.01 ';
      svg+=`<path d="${path}" class="curve-line curve-year-${!compare||year===years[0]?2025:2026}${!compare&&periods.length>260?' curve-line--densa':''}"/>`;
    }
    for(const [i,t] of current.entries())if(t.value!=null){const p=t.point;svg+=`<circle cx="${X(t)}" cy="${Y(t.value)}" r="${p.flags.length?4:3}" class="curve-dot curve-year-${!compare||t.y===years[0]?2025:2026}${p.flags.length?' curve-flagged':''}" data-point="${i}" tabindex="-1" role="button" aria-label="${periodLabel(t)}: ${esc(shown(t.raw))}. Ver fuente"><title>${periodLabel(t)}: ${esc(shown(t.raw))}${meaning(t.raw,t.y)?` · ${esc(meaning(t.raw,t.y))}`:''}</title></circle>`;}
    svg+='</svg>';
    $('curveChart').innerHTML=svg;
    $('curveLegend').innerHTML = compare ? years.map((y,i)=>`<span class="curve-legend-${i===0?2025:2026}">${y}</span>`).join('') : `<span class="curve-legend-2025">${years[0]}–${years.at(-1)}</span>`;
    $('curveChart').querySelectorAll('[data-point]').forEach(el=>{
      const show=()=>{
        $('curveChart').querySelector('.curve-active')?.classList.remove('curve-active');
        el.classList.add('curve-active');
        inspect(current[Number(el.dataset.point)].point);
      };
      el.addEventListener('pointerenter',show);el.addEventListener('click',show);el.addEventListener('focus',show);
      // Un solo punto en el orden de tabulación; las flechas, Inicio y Fin recorren las semanas.
      el.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();show();return;}
        const dots=[...$('curveChart').querySelectorAll('[data-point]')],k=dots.indexOf(el);
        const destino={ArrowRight:k+1,ArrowLeft:k-1,ArrowUp:k+1,ArrowDown:k-1,Home:0,End:dots.length-1,PageUp:k+52,PageDown:k-52}[e.key];
        if(destino===undefined)return;e.preventDefault();
        const d=dots[Math.max(0,Math.min(dots.length-1,destino))];el.setAttribute('tabindex','-1');d.setAttribute('tabindex','0');d.focus();
      });
    });
    if(last){
      const ultimo=$('curveChart').querySelector(`[data-point="${current.indexOf(last)}"]`);
      ultimo?.classList.add('curve-active');ultimo?.setAttribute?.('tabindex','0');
      // En pantallas angostas la gráfica se desliza: se abre en lo más reciente.
      const caja=$('curveChart');if(caja.scrollWidth>caja.clientWidth)caja.scrollLeft=caja.scrollWidth;
      inspect(last.point);
    }else $('curvePoint').textContent='No hay cifras para esta selección; consulta la cobertura del cuadro o elige Nacional.';
    $('curveDataRows').innerHTML=current.map(t=>{
      const p=t.point;
      const m = meaning(t.raw, t.y);
      return `<tr><td>${periodLabel(t)}</td><td class="number"${m ? ` title="${esc(m)}"` : ''}>${p ? esc(shown(t.raw)) : 'Sin dato'}</td><td>${p?sourceLink(p):'No aparece este periodo en los cuadros de los boletines analizados'}</td><td>${p?.flags.length?p.flags.map(f=>esc(flags[f]||f)).join(' ')+(p.flags.includes('source_cut_conflict')?` Cifras originales no graficadas: semanal ${esc(shown(p.reported_weekly))}; acumulado ${esc(shown(p.reported_cumulative))}.`:''):p?(m?esc(m):'Sin aviso específico'):'Sin dato; no se imputa cero'}</td></tr>`;
    }).join('') + unplaced.map(p=>`<tr><td>Fecha ambigua · corte impreso ${periodLabel(p)}</td><td class="number">No se grafica</td><td>${sourceLink(p)}</td><td>El encabezado contradice la edición. Semanal nacional impreso: ${esc(shown(p.reported_weekly))}; acumulado nacional impreso: ${esc(shown(p.reported_cumulative))}. No se asigna a otra semana.</td></tr>`).join('');
  }
  /** URL compartible: padecimiento siempre; ámbito y sexo sólo si no son los predeterminados. */
  function escribeUrl(id) {
    const url = new URL(location.href); url.searchParams.set('padecimiento', id);
    const am = $('curveState').value, sx = $('curveSex').value;
    if (am && am !== 'nacional') url.searchParams.set('ambito', am); else url.searchParams.delete('ambito');
    if (sx && sx !== 'general') url.searchParams.set('sexo', sx); else url.searchParams.delete('sexo');
    history.replaceState(null, '', url);
  }
  /** Sexo elegido sin cifra que mostrar: estado vacío explícito, sin calcular ni volver en silencio a General. */
  function sinSexo(d, metric) {
    current = []; view = [];
    for (const k of ['curveChart','curveStats','curveDataRows','curveLegend']) $(k).innerHTML = '';
    $('curveCaption').textContent = '';
    $('curveScope').textContent = `${d.code} · ${nombreSexo()}.`;
    const semanal = metric !== 1;
    const texto = semanal
      ? 'El boletín no publica casos semanales por sexo: sólo los acumulados del año, separados en hombres y mujeres. No se calculan por diferencia de acumulados.'
      : hasSex() ? '' : 'El cuadro de este padecimiento no separa los acumulados en hombres y mujeres: no hay serie por sexo.';
    $('curvePoint').innerHTML = `<strong>${esc(texto)}</strong>${semanal && hasSex() ? `<span><button type="button" class="button secondary" data-curve-cifra="1">Ver los acumulados de ${esc(nombreSexo().toLowerCase())}</button></span>` : ''}<span><button type="button" class="button secondary" data-curve-sexo="general">Ver la serie general</button></span>`;
  }
  async function choose(id) {
    if (!index || !index.series[id]) return;
    // Selector, URL, curva y pronóstico pasan al nuevo padecimiento ANTES de cargar la serie, por cualquier ruta
    // (selector, «Ver curva histórica», «Ver pronóstico», URL inicial, atrás/adelante): si la carga falla, queda el
    // error visible del nuevo padecimiento y nada del anterior.
    const nombre=(catalog.find(d=>d.id===id)||{}).name||id;
    $('curveDisease').value=id;
    const url=new URL(location.href);url.searchParams.set('padecimiento',id);history.replaceState(null,'',url);
    selected=null;current=[];view=[];
    $('curveTitle').textContent=`${nombre} · Nacional`;
    for(const k of ['curveChart','curveStats','curveDataRows','curveLegend'])$(k).innerHTML='';
    for(const k of ['curvePoint','curveCaption','curveScope'])$(k).textContent='';
    document.dispatchEvent(new CustomEvent('radar:curva',{detail:{id}}));
    const request=++sequence;
    $('curveStatus').hidden=false;$('curveStatus').textContent='Cargando la serie del padecimiento…';
    try {
      let series=cache.get(id);
      if(!series){const res=await fetch(index.series[id].path);if(!res.ok)throw new Error('No se pudo cargar la serie.');series=await res.json();cache.set(id,series);}
      if(request!==sequence)return;
      selected=series;$('curveDisease').value=id;const studyOption=$('curveMetric').querySelector('[value="2"]');studyOption.disabled=!series.points.some(p=>Object.hasOwn(p,'in_study'));if(studyOption.disabled&&$('curveMetric').value==='2')$('curveMetric').value='0';const hasStates=series.points.some(p=>p.e);$('curveState').disabled=!hasStates;if(!hasStates)$('curveState').value='nacional';$('curveStatus').hidden=true;draw();
    }catch(e){if(request===sequence)$('curveStatus').textContent=`${e.message} Padecimiento: ${nombre}.`;}
  }
  // Atrás/adelante: la URL manda; el selector, la curva y el pronóstico la siguen.
  window.addEventListener('popstate',()=>{const q=new URLSearchParams(location.search),id=q.get('padecimiento');if(A)aplicaAmbito(q);if(id&&index?.series[id]&&id!==$('curveDisease').value)choose(id);else if(selected){draw();avisaAmbito();}});
  /** Ámbito y sexo desde la URL, validados contra las opciones; lo inválido vuelve a nacional y general. */
  function aplicaAmbito(q){
    const am=A.serializaAmbito(A.parseAmbito(q.get('ambito')));$('curveState').value=$('curveState').disabled&&selected?'nacional':am;
    $('curveSex').value=A.parseSexo(q.get('sexo'));if($('curveSex').value!=='general')$('curveMetric').value='1';
  }
  function avisaAmbito(){document.dispatchEvent(new CustomEvent('radar:ambito',{detail:{ambito:$('curveState').value,sexo:$('curveSex').value}}));}
  async function init(){
    controls.forEach(id=>$(id).disabled=true);
    try{
      const a=await fetch('/assets/boletin/history/index.json');
      if(!a.ok)throw new Error('No se pudo cargar el archivo histórico.');
      index=await a.json();
      C=await import('/assets/boletin/celdas.mjs?v=1');
      A=await import('/assets/boletin/ambitos.mjs?v=1');
      window.radarHistoria=index;document.dispatchEvent(new CustomEvent('radar:historia',{detail:index}));
      if(!index.categories){
        // Manifiestos anteriores sin catálogo propio: se usa el de la foto semanal vigente.
        const actual=await (await fetch('/assets/boletin/actual.json')).json();
        const b=await fetch(`/${actual.carpeta}/data.json`);
        if(!b.ok)throw new Error('No se pudo cargar el archivo histórico.');
        catalog=(await b.json()).diseases;
      }else catalog=index.categories;
      const years=Object.keys(index.source_years).map(Number).sort((a,b)=>a-b);
      $('archiveCoverage').textContent=`ARCHIVO HISTÓRICO · ${index.source_count} PDF · ${years[0]}–${years.at(-1)}`;
      for(const id of ['curveStart','curveEnd'])$(id).innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
      $('curveStart').value=String(years[0]);$('curveEnd').value=String(years.at(-1));
      $('curveDisease').innerHTML=[...catalog].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(d=>`<option value="${d.id}">${esc(d.name)} · ${esc(d.code)}${d.aggregate?' (agregado)':''}${d.historical?' · clasificación histórica':''}</option>`).join('');
      const regiones=A.estadosCompatibles(index.states)?`<optgroup label="Macrorregiones (suma de entidades)">${A.REGIONES.map(r=>`<option value="region:${r.id}">Región ${esc(r.nombre)} (${r.claves.length} entidades)</option>`).join('')}</optgroup>`:'';
      $('curveState').innerHTML='<option value="nacional">Nacional</option>'+regiones+`<optgroup label="Entidades federativas">${index.states.map((s,i)=>`<option value="estado:${A.clave(i)}">${esc(s)}</option>`).join('')}</optgroup>`;
      aplicaAmbito(new URLSearchParams(location.search));
      controls.forEach(id=>$(id).disabled=false);
      const initial=new URLSearchParams(location.search).get('padecimiento');
      await choose(index.series[initial]?initial:'p70b1');if(location.hash==='#curvas')$('curvas').scrollIntoView({block:'start'});
    }catch(e){$('curveStatus').textContent=e.message;}
  }
  $('curveDisease').addEventListener('change',e=>choose(e.target.value));
  ['curveState','curveSex','curveMetric','curveMode','curveStart','curveEnd'].forEach(id=>$(id).addEventListener('change',()=>{cambioCifra=false;draw();}));
  // Al elegir Hombres o Mujeres con casos semanales, la cifra pasa a acumulados (lo único que el boletín separa por sexo).
  $('curveSex').addEventListener('change',()=>{if($('curveSex').value!=='general'&&$('curveMetric').value!=='1'){$('curveMetric').value='1';cambioCifra=true;draw();}});
  ['curveState','curveSex'].forEach(id=>$(id).addEventListener('change',avisaAmbito));
  $('curveCsv').addEventListener('click',()=>{
    if(!selected)return;
    const rows=[['padecimiento','entidad','anio_observado','semana_observada','valor','lectura_del_simbolo','metrica','fuente','pagina','avisos']];
    const d=catalog.find(d=>d.id===selected.id),amb=ambito(),lugar=(amb.tipo==='region'?A.rotuloRegion(amb.id):nombreAmbito())+(sexo()!=='general'?` · ${nombreSexo()}`:'');
    for(const t of current){const p=t.point;rows.push([d.name,lugar,t.y,t.w,t.raw??'',meaning(t.raw,t.y),$('curveMetric').value==='0'?'semanal':$('curveMetric').value==='2'?'en_estudio_acumulados':'acumulado',p?index.sources[p.s].url:'',p?.p??'',p?[...p.flags,...(amb.tipo==='region'?['suma_de_entidades']:[])].join('|'):'sin_dato']);}
    const csv='\uFEFF'+rows.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n');
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download=`curva-${d.id}-${$('curveState').value.replace(':','-')}${sexo()!=='general'?'-'+sexo():''}-${$('curveStart').value}-${$('curveEnd').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  document.addEventListener('click',e=>{
    const x=e.target.closest?.('[data-curve-cifra],[data-curve-sexo]');
    if(x){if(x.dataset.curveCifra)$('curveMetric').value=x.dataset.curveCifra;if(x.dataset.curveSexo){$('curveSex').value=x.dataset.curveSexo;avisaAmbito();}draw();return;}
    const b=e.target.closest('[data-curve]');if(!b)return;
    $('detail')?.close();choose(b.dataset.curve);$('curvas').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  });
  init();
})();
