import { ASSETS, initialLanguage, metrics, sortedStates, medianState, validateData } from './wcp-data.mjs?v=20260908b';

const $ = id => document.getElementById(id);
const english = Object.fromEntries([...document.querySelectorAll('[data-i18n]')].map(el => [el.dataset.i18n,el.innerHTML]));
const spanish = {
  skip:'Ir al contenido',navPoster:'El póster',navEvidence:'Los resultados',navContact:'Contacto',
  sexWarning:'<strong>Otra ventana y variable.</strong> Estos totales no son directamente comparables con el recuadro del pronóstico nacional.',
  heroLine1:'De los casos notificados',heroLine2:'a decisiones informadas.',
  heroSummary:'¿Pueden los datos semanales de vigilancia ayudarnos a anticipar lo que viene? Explora pronósticos de notificaciones de depresión, Alzheimer y Parkinson en México, y por qué importa evaluarlos localmente.',
  explorePoster:'Explorar el póster ↓',exploreEvidence:'Seguir la evidencia →',
  heroNote:'26.º Congreso Mundial de Psiquiatría · 23–26 de septiembre de 2026<br>AS17 Psiquiatría digital · Investigación, no una herramienta de decisión clínica.',
  takeaway:'EL HALLAZGO CENTRAL',depressionTag:'Depresión · 25 semanas',insightTitle:'Un país.<br>Distintas realidades locales.',nationalError:'Error semanal nacional',medianError:'Mediana del error estatal',
  insightNote:'La precisión nacional no garantiza la local. Evalúa cada estado antes de usar sus pronósticos para planear recursos.',seeTerritory:'Ver el panorama estatal →',smapeShort:'sMAPE · Menor es mejor. Comparación descriptiva, no validación prospectiva uniforme.',
  heroFoot:'VIGILANCIA PÚBLICA · ESTADÍSTICA + APRENDIZAJE AUTOMÁTICO',heroFootRight:'México, semana a semana.',
  posterEyebrow:'01 / EL PÓSTER',posterTitle:'El estudio completo. A tu ritmo.',posterIntro:'Lee, amplía o llévate una copia. Ambos PDF contienen el mismo estudio en sus respectivos idiomas.',enlarge:'Ampliar póster ↗',openPdf:'Abrir PDF ↗',goDeeper:'Explorar a fondo',jumpMethods:'Métodos ↘',jumpResults:'Resultados ↘',jumpStates:'Estados y sexo ↘',downloadEn:'Descargar póster en inglés',downloadEs:'Descargar póster en español',
  versionNote:'Edición del póster: 8 de septiembre de 2026. Resultados congelados del congreso, no el último reporte semanal. Los PDF pueden descargarse sin JavaScript.',registeredTitle:'Título registrado y huellas digitales de los PDF',outcomeNote:'Se conserva el título registrado. El desenlace medido son casos nuevos notificados: no incidencia clínica, demanda de atención medida ni riesgo individual.',
  evidenceEyebrow:'02 / EXPLORA LA EVIDENCIA',evidenceTitle:'¿Qué tan bien funcionaron los pronósticos?',evidenceIntro:'Compara notificaciones semanales y estimaciones de los modelos. Cambia el padecimiento y la ventana de evaluación para explorar las diferencias.',loading:'Cargando los datos congelados del estudio…',condition:'Padecimiento',depression:'Depresión',parkinson:'Parkinson',alzheimer:'Alzheimer',evaluationWindow:'Ventana de evaluación',window25:'25 semanas · 7–31',window8:'8 semanas · 24–31',chartTitle:'Historia y pronóstico nacional',observed:'Casos notificados',modelFit:'Ajuste / pronóstico',modelBand:'Intervalo del modelo',inspectWeek:'Inspeccionar una semana',
  chartCaveat:'Antes del último dato comparado: ajuste retrospectivo. Futuro sombreado: pronósticos, no resultados observados. La cobertura del intervalo no fue evaluada. Las fechas siguen el calendario de boletín del póster.',weeklyValues:'Leer los valores semanales en una tabla',weeklyCaption:'Valores de la gráfica interactiva',allResults:'Resultados nacionales y lectura de las métricas',nationalTable:'Resultados nacionales · ambos sexos · 2026',
  smapeDefinition:'<strong>sMAPE — error porcentual absoluto medio simétrico.</strong> Error relativo semanal, promediado entre las semanas evaluadas. Menor es mejor; 0% indica coincidencia exacta. No es un «porcentaje de precisión».',maeDefinition:'<strong>MAE — error absoluto medio.</strong> Diferencia semanal promedio en casos, sin importar el signo. Ayuda a dimensionar el error en unidades concretas. Menor es mejor.',
  territoryEyebrow:'03 / MÁS ALLÁ DEL TOTAL',territoryTitle:'El resultado nacional no garantiza el local.',territoryIntro:'Depresión, semanas epidemiológicas 7–31. Explora 32 estados; el modelo nacional es independiente, no suma los pronósticos estatales.',stateTitle:'¿Cómo se comporta cada estado?',chooseState:'Elige un estado',lowerError:'Menor error',higherError:'Mayor error',stateCaveat:'Comparación descriptiva de modelos seleccionados, no validación prospectiva uniforme fuera de muestra. Con pocos casos, errores absolutos pequeños pueden representar diferencias relativas grandes. Es un mecanismo posible, no una explicación demostrada para un estado particular.',stateTableTitle:'Los 32 estados: cifras y modelos seleccionados',
  sexEyebrow:'OTRA PERSPECTIVA / SEXO',sexTitle:'¿Quiénes aparecen en las notificaciones?',sexIntro:'Depresión · notificaciones acumuladas de 2026 hasta la semana epidemiológica 31.',sexTotal:'casos en estas columnas desglosadas por sexo',women:'Mujeres',men:'Hombres',sexCaveat:'Casos notificados: no pronósticos, riesgo individual ni desempeño predictivo por sexo. Esta ventana acumulada es distinta de la evaluación de 25 semanas. Aun alineando las semanas, los incrementos del acumulado por sexo no concilian con la columna de casos semanales; la causa no está determinada.',
  studyEyebrow:'04 / CÓMO FUNCIONA EL ESTUDIO',studyTitle:'Cuatro enfoques.<br>Una pregunta: ¿qué viene después?',studyIntro:'Estudio retrospectivo de notificaciones epidemiológicas semanales de México, 2014–2026. Cada serie temporal sigue un padecimiento, territorio y estrato por sexo para captar patrones que el total nacional puede no mostrar.',prophetText:'Método estadístico de pronóstico que representa tendencias y ciclos recurrentes.',deeparText:'Método de aprendizaje automático: una red neuronal recurrente aprende patrones entre series temporales relacionadas.',ensembleText:'Combina predicciones de varios métodos para integrar distintas perspectivas del pronóstico.',stackingText:'Aprende a combinar predicciones de los modelos en lugar de depender de un solo enfoque.',selectionNote:'Se selecciona un modelo por serie. Los resultados nacionales usan DeepAR para depresión y Prophet para Parkinson y Alzheimer. No afirmamos que cada selección histórica sea el mejor modelo en términos universales.',
  scopeDetails:'Series, ventanas de evaluación y limitaciones',seriesNote:'333 series diseñadas = 3 padecimientos × 37 áreas × 3 estratos. Áreas: 32 estados, total nacional y 4 grupos de estados. Estratos: hombres, mujeres y ambos sexos. Se conservaron pronósticos de 297 series; 36 regionales no se evaluaron por nombres geográficos incompatibles entre archivos. Aquí se muestran tres padecimientos nacionales y depresión en 32 estados, ambos sexos juntos.',evaluationNote:'La ventana de 25 semanas (7–31 de 2026) describe la concordancia con las notificaciones. Para las semanas 24–31, las predicciones evaluadas coinciden con el archivo fechado 5 de junio de 2026 dentro de la tolerancia de redondeo documentada. El archivo antecede esas semanas; no demuestra toda la cronología de entrenamiento ni una certificación temporal criptográfica. La evaluación no es plenamente prospectiva.',limitationsNote:'Las notificaciones no son incidencia clínica ni demanda de atención medida. El acceso, registro y subregistro pueden afectar los conteos. No se evaluaron edad ni transferencia fuera de México. No se midieron beneficio clínico, impacto en personal, ahorro ni efectos presupuestarios.',horizonNote:'El pronóstico congelado de 52 semanas va del 9 de febrero de 2026 al 1 de febrero de 2027. No es un pronóstico nuevo desde la fecha de visita. Los ajustes históricos no se presentan como pronósticos prospectivos anteriores.',reconciliationNote:'Los acumulados por sexo y la columna general de casos semanales no se concilian exactamente en la ventana evaluada. No se atribuyó una causa ni se conciliaron artificialmente. No se reparten pronósticos por las proporciones de la barra descriptiva por sexo.',
  nextEyebrow:'05 / DE LA EVIDENCIA AL SIGUIENTE PASO',nextTitle:'Anticipar. Validar localmente.<br>Después, evaluar el uso en servicios.',nextCopy:'Los pronósticos podrían ayudar a preguntar cuándo y dónde preparar personal y consultas. El error local señala dónde revisar la fiabilidad, no cuánto dinero asignar. El beneficio para los servicios aún debe evaluarse.',galleryTag:'SIGUE EXPLORANDO',galleryTitle:'Galería de pronósticos ↗',galleryNote:'Reportes semanales de EpiForecast · portal principal en español',platformTag:'CONOCE EL PROYECTO',platformTitle:'EpiForecast-MX ↗',platformNote:'Métodos, equipo y plataforma completa',contactEyebrow:'CONVERSEMOS EN EL WCP',contactTitle:'Preguntas que merecen<br>una conversación.',contactIntro:'Conversemos sobre validación local, métodos de pronóstico o cómo evaluar su utilidad para planear servicios.',authorsTitle:'El equipo investigador',funding:'No hubo financiamiento. Datos públicos y agregados, sin identificadores individuales.',backTop:'Volver al inicio ↑',references:'Referencias y datos del estudio',officialSource:'Fuente oficial ↗',downloadData:'Descargar datos congelados de las gráficas (JSON)',projectCode:'Código del proyecto ↗',footerNote:'Página complementaria del póster WCP 2026 · Versión 8 de septiembre de 2026 · No es un sitio oficial del congreso. Investigación, no consejo clínico.',dialogTitle:'Explorar el póster',zoom:'Ampliación',fit:'Ajustar',close:'Cerrar ×',zoomTip:'Amplía con el control y desplázate para explorar. Escape cierra el visor. Abre el PDF para seleccionar texto.'
};

let lang = initialLanguage(location.search), data, selectedWindow = 25, week = 51;
const tr = (en,es) => lang === 'es' ? es : en;
const nf = (value,digits=0) => new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const date = value => new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
const name = key => ({depresion:tr('Depression','Depresión'),parkinson:tr('Parkinson’s','Parkinson'),alzheimer:tr('Alzheimer’s','Alzheimer')})[key];
const motorName = key => ({deepar:'DeepAR',prophet:'Prophet',ensemble:'Ensemble',stacking:'Stacking'})[key] || key;
const row = () => data.national.find(r=>r.condition===$('condition').value);
function element(tag,text,className) { const el=document.createElement(tag); if(text!==undefined) el.textContent=text; if(className) el.className=className; return el; }
function updateLanguage(next, changeURL=false) {
  lang=next==='es'?'es':'en'; document.documentElement.lang=lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.innerHTML=lang==='en'?english[el.dataset.i18n]:spanish[el.dataset.i18n]??english[el.dataset.i18n];});
  document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
  document.title=tr('WCP 2026 · Interactive poster · EpiForecast-MX','WCP 2026 · Póster interactivo · EpiForecast-MX');
  const pdf=ASSETS+(lang==='es'?'WCP2026ePoster3134RebullES.pdf':'WCP2026ePoster3134Rebull.pdf');
  $('pdf-view').href=pdf; $('poster-image-link').href=pdf;
  $('poster-image').src=ASSETS+'poster-'+lang+'.png';
  $('poster-image').alt=tr('Complete English WCP 2026 poster 3134','Póster WCP 2026 número 3134 completo en español');
  $('poster-language').textContent=tr('English poster','Póster en español');
  $('timeline').setAttribute('aria-label',tr('National reported cases and model estimates; values in the table below.','Casos nacionales y estimaciones del modelo; valores en la tabla inferior.'));
  document.querySelector('.sex-bar').setAttribute('aria-label',tr('Women 73.1%; men 26.9%','Mujeres 73.1%; hombres 26.9%'));
  $('state-bars').setAttribute('aria-label',tr('State errors ordered from lower to higher','Errores estatales ordenados de menor a mayor'));
  if(changeURL){const url=new URL(location.href); if(lang==='es') url.searchParams.set('lang','es');else url.searchParams.delete('lang');history.replaceState(null,'',url);}
  if(data){renderResults();renderStates();} else if(loadFailed) showDataError();
}
let loadFailed=false;
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>updateLanguage(b.dataset.lang,true)));
updateLanguage(lang);
window.addEventListener('popstate',()=>updateLanguage(initialLanguage(location.search)));

const dialog=$('poster-dialog'); let opener;
function openPoster(event){if(typeof dialog.showModal!=='function')return;event?.preventDefault();opener=document.activeElement;$('zoom-image').src=ASSETS+'poster-'+lang+'-detail.png';$('zoom-image').alt=$('poster-image').alt;setZoom(100);dialog.showModal();document.body.classList.add('dialog-open');$('zoom-close').focus();}
function setZoom(value){$('poster-zoom').value=value;$('zoom-value').value=value+'%';$('zoom-image').style.width=value+'%';}
$('zoom-open').addEventListener('click',openPoster);$('poster-image-link').addEventListener('click',openPoster);
$('poster-zoom').addEventListener('input',e=>setZoom(Number(e.target.value)));
$('zoom-reset').addEventListener('click',()=>{setZoom(100);$('zoom-scroll').scrollTo(0,0);});
$('zoom-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.body.classList.remove('dialog-open');$('zoom-image').removeAttribute('src');opener?.focus();});

function card(title,value,description,detail){const el=element('article',undefined,'result-card');el.append(element('p',title,'eyebrow'),element('strong',value),element('p',description));if(detail)el.append(element('small',detail));return el;}
function renderResults(){
  const r=row(),m=metrics(r,selectedWindow);
  const deviation=m.deviation===null?'—':(m.deviation>0?'+':'')+nf(m.deviation,1)+'%';
  $('result-cards').replaceChildren(
    card(tr('Weekly relative error','Error relativo semanal'),nf(m.smape,1)+'%','sMAPE · '+tr('Lower is better.','Menor es mejor.')),
    card(tr('Weekly absolute error','Error absoluto semanal'),nf(m.mae,1),'MAE · '+tr('cases per week','casos por semana')),
    card(tr('Difference in totals','Diferencia entre totales'),deviation,tr('Cumulative difference, not weekly error.','Diferencia acumulada, no error semanal.'),nf(m.forecast)+' '+tr('forecast','pronosticados')+' / '+nf(m.observed)+' '+tr('reported','notificados')));
  $('chart-title').textContent=name(r.condition)+' · '+tr('national history & forecast','historia y pronóstico nacional');
  $('model-name').textContent=motorName(r.motor);
  $('window-note').textContent=selectedWindow===25?tr('Selected window: epidemiological weeks 7–31 of 2026 (25 weeks). Descriptive evaluation, not a fully prospective test. The blue strip on the chart marks this window.','Ventana seleccionada: semanas epidemiológicas 7–31 de 2026 (25 semanas). Evaluación descriptiva, no prueba plenamente prospectiva. La franja azul de la gráfica marca esta ventana.'):tr('Selected window: epidemiological weeks 24–31 of 2026 (8 weeks). Evaluated predictions were saved before those weeks; this alone does not establish every model’s training cutoff or absence of leakage.','Ventana seleccionada: semanas epidemiológicas 24–31 de 2026 (8 semanas). Predicciones guardadas antes de esas semanas; esto no demuestra por sí solo el corte de entrenamiento de cada modelo o la ausencia de filtración temporal.');
  drawTimeline();renderWeeklyTable();
}
function drawTimeline(){
  if(!data)return;
  const r=row(),canvas=$('timeline'),ctx=canvas.getContext('2d');if(!ctx)return;
  const width=Math.max(220,canvas.clientWidth),height=320,dpr=Math.min(window.devicePixelRatio||1,3);
  canvas.width=Math.round(width*dpr);canvas.height=height*dpr;ctx.scale(dpr,dpr);
  const left=width<450?43:58,right=18,top=30,bottom=48,plotW=width-left-right,plotH=height-top-bottom;
  const maximum=Math.max(...r.historical,...r.model,...r.upper.slice(52))*1.12;
  const x=i=>left+i/78*plotW,y=v=>top+plotH-v/maximum*plotH;
  ctx.fillStyle='#f0f2f7';ctx.fillRect(x(51),top,x(78)-x(51),plotH);
  ctx.fillStyle='#e8eff6';const first=selectedWindow===25?27:44;ctx.fillRect(x(first),top,x(51)-x(first),plotH);
  ctx.font='11px Arial';ctx.fillStyle='#526578';ctx.textAlign='right';
  for(let i=0;i<5;i++){const v=maximum*i/4;ctx.strokeStyle='#d5dee8';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(left,y(v));ctx.lineTo(width-right,y(v));ctx.stroke();ctx.fillText(nf(v),left-8,y(v)+4);}
  ctx.textAlign='left';ctx.fillText(tr('cases / week','casos / semana'),left,15);
  ctx.fillStyle='#ead0df';ctx.beginPath();r.lower.slice(52).forEach((v,i)=>i?ctx.lineTo(x(i+52),y(v)):ctx.moveTo(x(52),y(v)));for(let i=78;i>=52;i--)ctx.lineTo(x(i),y(r.upper[i]));ctx.closePath();ctx.fill();
  const line=(values,color,dash)=>{ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dash);values.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.stroke();ctx.setLineDash([]);};
  line(r.historical,'#142d4b',[]);line(r.model,'#ab2169',[5,4]);
  ctx.strokeStyle='#526578';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x(51),top);ctx.lineTo(x(51),y(0));ctx.stroke();ctx.setLineDash([]);
  ctx.font='10px Arial';ctx.fillStyle='#526578';ctx.textAlign='center';
  const ticks=width<450?[0,27,51,78]:[0,13,27,40,51,65,78];
  ticks.forEach(i=>{ctx.textAlign=i===0?'left':i===78?'right':'center';ctx.fillText(new Intl.DateTimeFormat(lang==='es'?'es-MX':'en-GB',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(r.dates[i]+'T00:00:00Z')),x(i),height-22);});
  ctx.strokeStyle='#7e8da6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(week),top);ctx.lineTo(x(week),y(0));ctx.stroke();
  [r.historical[week],r.model[week]].forEach((v,i)=>{if(v===undefined)return;ctx.beginPath();ctx.arc(x(week),y(v),4,0,Math.PI*2);ctx.fillStyle=i?'#ab2169':'#142d4b';ctx.fill();ctx.strokeStyle='white';ctx.stroke();});
  $('week-readout').textContent=date(r.dates[week])+' · '+tr('Reported','Notificados')+': '+(week<52?nf(r.historical[week]):tr('not observed in this evaluation','no observados en esta evaluación'))+' · '+(week<52?tr('Model fit','Ajuste'):tr('Forecast','Pronóstico'))+': '+nf(r.model[week]);
  canvas.dataset.plotLeft=left;canvas.dataset.plotWidth=plotW;
}
function renderWeeklyTable(){const r=row();const header=element('tr');[tr('Date','Fecha'),tr('Reported cases','Casos notificados'),tr('Fit / forecast','Ajuste / pronóstico'),tr('Interpretation','Interpretación')].forEach(s=>header.append(element('th',s)));$('weekly-table').tHead.replaceChildren(header);$('weekly-table').tBodies[0].replaceChildren(...r.dates.map((v,i)=>{const el=element('tr');el.append(element('th',date(v)),element('td',i<52?nf(r.historical[i]):'—'),element('td',nf(r.model[i],1)),element('td',i<52?tr('Retrospective fit','Ajuste retrospectivo'):tr('Forecast; not evaluated','Pronóstico; no evaluado')));return el;}));}
function selectState(value){$('state').value=value;renderStateInsight();}
function renderStateInsight(){const list=sortedStates(data),r=list.find(r=>r.name===$('state').value)||list.at(-1);$('state').value=r.name;const insight=$('state-insight');insight.replaceChildren(element('strong',nf(r.smape,1)+'%'),element('span',r.name+' · '+motorName(r.motor)),element('small',tr('National','Nacional')+' 8.7% · '+tr('State median','Mediana estatal')+' '+nf(medianState(data),1)+'%'));document.querySelectorAll('#state-bars button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.state===r.name)));}
function renderStates(){const selected=$('state').value||'Tlaxcala',list=sortedStates(data);$('state').replaceChildren(...[...list].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(r=>{const o=element('option',r.name);o.value=r.name;return o;}));$('state').value=selected;
  $('state-bars').replaceChildren(...list.map(r=>{const b=element('button');b.type='button';b.dataset.state=r.name;b.style.setProperty('--bar-height',(r.smape/50*100)+'%');b.title=r.name+': '+nf(r.smape,1)+'%';b.setAttribute('aria-label',b.title+' sMAPE');b.addEventListener('click',()=>selectState(r.name));return b;}));
  const header=element('tr');[tr('State','Estado'),'sMAPE',tr('Selected model','Modelo seleccionado')].forEach(s=>header.append(element('th',s)));$('state-table').tHead.replaceChildren(header);$('state-table').tBodies[0].replaceChildren(...list.map(r=>{const el=element('tr');el.append(element('th',r.name),element('td',nf(r.smape,1)+'%'),element('td',motorName(r.motor)));return el;}));renderStateInsight();}
$('condition').addEventListener('change',renderResults);
document.querySelectorAll('[data-window]').forEach(b=>b.addEventListener('click',()=>{selectedWindow=Number(b.dataset.window);document.querySelectorAll('[data-window]').forEach(other=>other.setAttribute('aria-pressed',String(other===b)));renderResults();}));
$('week-slider').addEventListener('input',e=>{week=Number(e.target.value);drawTimeline();});
$('timeline').addEventListener('click',event=>{if(!data)return;const c=event.currentTarget;week=Math.min(78,Math.max(0,Math.round((event.clientX-c.getBoundingClientRect().left-Number(c.dataset.plotLeft))/Number(c.dataset.plotWidth)*78)));$('week-slider').value=week;drawTimeline();});
$('state').addEventListener('change',renderStateInsight);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>drawTimeline()).observe($('timeline').parentElement);else window.addEventListener('resize',drawTimeline);
function showDataError(){const status=$('data-status');status.hidden=false;status.textContent=tr('Interactive data could not be loaded. The verified PDFs and complete results table remain available. Reload to try again.','No se pudieron cargar los datos interactivos. Los PDF y la tabla completa siguen disponibles. Recarga para intentar de nuevo.');}
try {const response=await fetch(ASSETS+'data.json');if(!response.ok)throw new Error('Data unavailable');data=validateData(await response.json());$('data-status').hidden=true;document.querySelectorAll('#condition,#state,#week-slider,[data-window]').forEach(el=>el.disabled=false);renderResults();renderStates();} catch(error){loadFailed=true;showDataError();console.warn('WCP explorer unavailable:',error.message);}
