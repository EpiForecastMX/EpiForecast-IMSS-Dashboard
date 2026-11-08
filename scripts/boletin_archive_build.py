"""Merge the audited 2025–26 history with independently parsed 2013–24 sources.
Writes to a staging directory until all source/identity/cut audits pass.
"""
import json,re,os,csv,unicodedata,hashlib
from pathlib import Path
from datetime import date,timedelta
from collections import defaultdict
import boletin_archive_extract as reader
B=reader.B;F=Path(os.environ.get('BOLETIN_FRONTEND','.'));OUT=Path(os.environ.get('BOLETIN_ARCHIVE_OUT',str(B/'stage')));OUT.mkdir(exist_ok=True)
ocr=json.loads((B/'archive-headers-ocr.json').read_text()) if (B/'archive-headers-ocr.json').exists() else {}
cut_checks={(x['sha256'],x['state_page'],x['code']):x for x in json.loads((F/'tests/fixtures/boletin-cut-overrides.json').read_text())}
original=json.loads((F/'assets/boletin/history/index.json').read_text());cat=json.loads((F/'assets/boletin/2026-w42/data.json').read_text())['diseases']
raw=json.loads((B/'archive-extraction.json').read_text());national=json.loads((B/'national-extraction.json').read_text());sources=json.loads((B/'sources.json').read_text());source_id={s['filename']:i for i,s in enumerate(sources)}
if len(source_id)!=len(sources):raise ValueError('Duplicate source')
byid={d['id']:{k:d[k] for k in ['id','name','code','aggregate'] if k in d} for d in cat};series={d:[] for d in byid};issues=[];unplaced=defaultdict(list);aliases=[{**a,'source':source_id[original['sources'][a['source']]['filename']]} for a in json.loads((F/'assets/boletin/history/identities.json').read_text()) if original['sources'][a['source']]['year']>=2025]
from boletin_archive_periods import first,period,cut

def cumulative(cols,vals):
 v=[vals[i] for i,c in enumerate(cols) if c in ['H','M','cumulative'] or c.startswith(('H_stage','M_stage'))]
 return sum(v) if v and all(a is not None for a in v) else None
# Retain the already reviewed latest history, including its original anomaly handling.
for ident,meta in original['series'].items():
 if ident not in byid:continue
 payload=json.loads((F/meta['path'].lstrip('/')).read_text())
 for old in payload['points']:
  if old['y']<2025 or original['sources'][old['s']]['year']<2025:continue
  p={**old,'s':source_id[original['sources'][old['s']]['filename']]};series[ident].append(p)
# The first 2025 conventional bulletin observes the final week of 2024.
for x in raw:
 src=x['source']
 if src['year']!=2025 or src['week']!=1:continue
 for r in x['records']:
  d=next(d for d in cat if d['id']==r['id']);lag=0 if d['id'].startswith('national-') else 42-d['observed_week'];y,w=period(2025,1,lag)
  if y!=2024:continue
  cols=r['columns'];v=r['totals'];flags=[]
  if not r['reconciled'] and r['reconciled'] is not None:flags.append('state_total_discrepancy')
  series[r['id']].append(dict(y=y,w=w,s=source_id[src['filename']],p=r['page'],n=[v[0],cumulative(cols,v)],prev=v[cols.index('previous')] if 'previous' in cols else None,e=[[s['values'][0],cumulative(cols,s['values'])] for s in r['states']] if r['states'] else None,flags=flags))
for x in raw+national:
 src=x['source']
 if src['year']>=2025:continue
 si=source_id[src['filename']];ids=[r['id'] for r in x['records']]
 if len(ids)!=len(set(ids)):issues.append(dict(source=si,kind='duplicate_identity'))
 headers={h['page']:h['text'] for h in x.get('headers',[])}
 for issue in x['issues']:
  if issue['kind']!='reconciliation':issues.append(dict(source=si,**issue))
 for r in x['records']:
  ident=r['id'];cols=r['columns'];v=r['totals'];ht=r.get('header',headers.get(r['page'],''));caption=ocr.get(src['filename'].replace('.pdf','')+f"_p{r['page']}")
  if caption:
   if caption['sha256']!=src['sha256']:issues.append(dict(source=si,page=r['page'],kind='ocr_source_changed'));continue
   ht=caption['text']
  observed=cut(ht,r,src)
  if observed is None:issues.append(dict(source=si,page=r['page'],id=ident,kind='missing_cut',header=ht));continue
  check=cut_checks.get((src['sha256'],r['page'],r['code']))
  if check:
   values=[r['totals'][r['columns'].index('weekly')],cumulative(r['columns'],r['totals'])]
   if list(observed)!=check['original_cut'] or values!=check['verified_values']:issues.append(dict(source=si,page=r['page'],kind='cut_proof_mismatch'));continue
   observed=tuple(check['verified_cut'])
  y,w=observed
  if y<2013:continue
  if y>src['year'] or not 1<=w<=53:issues.append(dict(source=si,page=r['page'],id=ident,kind='invalid_cut',observed=observed,header=ht));continue
  if ident not in byid:
   byid[ident]=dict(id=ident,name=r['name'],code=r['code'],historical=True);series[ident]=[]
  flags=['historical_definition'] if byid[ident].get('historical') else []
  if check:flags.append('source_cut_verified_by_national')
  if r['observed_year']!=y:flags.append('accumulated_year_conflict')
  if r.get('unlabeled_rows'):flags.append('source_state_label_missing')
  if r['reconciled'] is False:flags.append('state_total_discrepancy')
  if any(a is not None and a<0 for s in r['states'] for a in s['values']):flags.append('negative_values_reported')
  if any(a is None for s in r['states'] for a in s['values']) or any(a is None for a in v):flags.append('unavailable_source_cells')
  if 'weekly' not in cols:flags.append('weekly_not_reported')
  if 'in_study' in cols:flags.append('in_study_excluded')
  if reader.code_key(r['code']) and reader.code_key(r['code'])!=reader.code_key(byid[ident]['code']):flags.append('source_code_changed')
  weekly=v[cols.index('weekly')] if 'weekly' in cols else None;cum=cumulative(cols,v)
  state_values={s['state']:s['values'] for s in r['states']};e=[]
  for name in original['states']:
   a=state_values.get(name);e.append([a[cols.index('weekly')] if a and 'weekly' in cols else None,None if 'accumulated_year_conflict' in flags or not a else cumulative(cols,a)])
  point=dict(y=y,w=w,s=si,p=r['page'],n=[weekly,None if 'accumulated_year_conflict' in flags else cum],prev=v[cols.index('previous')] if 'previous' in cols else None,e=e if r['states'] else None,flags=flags)
  if check:point.update(original_cut=check['original_cut'],source_header=ht,verification_page=check['summary_page'])
  if flags:point.update(reported_year=r['observed_year'],reported_cumulative=cum,reported_weekly=weekly)
  if 'in_study' in cols:
   point['in_study']=v[cols.index('in_study')];point['in_study_states']=[state_values.get(name,[None]*len(cols))[cols.index('in_study')] for name in original['states']]
  lag=((first(src['year'])+timedelta(weeks=src['week']-1))-(first(y)+timedelta(weeks=w-1))).days//7
  if lag not in [0,1]:
   point['flags'].append('source_cut_conflict');point.update(source_header=ht,reported_cut=[y,w],reported_e=point['e'],reported_weekly=weekly,reported_cumulative=cum);point['n']=[None,None];point['e']=None;unplaced[ident].append(point)
  else:series[ident].append(point)
  if r['name']!=byid[ident]['name'] or r['code']!=byid[ident]['code']:aliases.append(dict(id=ident,source=si,page=r['page'],source_name=r['name'],source_code=r['code'],matched=r['matched']))
(B/'archive-build-issues.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2))
if issues:raise ValueError(f'{len(issues)} unresolved source/period issues; see archive-build-issues.json')
stale=[p.name for p in OUT.glob('*.json') if (p.stem.startswith(('historical-','national-')) or re.fullmatch(r'p\d+b\d+',p.stem)) and p.stem not in series]
if stale:raise ValueError(('Staging contains unindexed shards; preserve them and use a clean staging directory',stale))
# Preserve repeated observations as revisions; plot only the latest published version.
revisions={};seen_sources={p['s'] for ps in unplaced.values() for p in ps}
for ident,ps in series.items():
 groups=defaultdict(list)
 for p in sorted(ps,key=lambda p:(p['y'],p['w'],p['s'])):groups[(p['y'],p['w'])].append(p);seen_sources.add(p['s'])
 latest=[];older=[]
 for key,versions in sorted(groups.items()):
  distinct={p['s']:p for p in versions};versions=list(distinct.values());versions.sort(key=lambda p:(sources[p['s']]['year'],sources[p['s']]['week'],sources[p['s']].get('edition_priority',1),p['s']));latest.append(versions[-1]);older+=versions[:-1]
  if len(versions)>1:versions[-1]['revisions']=len(versions)-1
 series[ident]=latest;revisions[ident]=older
 (OUT/(ident+'.json')).write_text(json.dumps(dict(schema='boletin_history_series.v2',id=ident,points=latest,revisions=older,unplaced=unplaced[ident]),ensure_ascii=False,separators=(',',':'))+'\n')
years=sorted(set(s['year'] for s in sources));periods=[]
for y in years:
 lastweek=max(s['week'] for s in sources if s['year']==y)
 for w in range(1,lastweek+1):periods.append(dict(y=y,w=w,start=(first(y)+timedelta(weeks=w-1)).isoformat()))
index=dict(schema='boletin_history.v2',checked=os.environ.get('BOLETIN_CHECKED_DATE','2026-11-08'),source_count=len(sources),source_years={str(y):sum(s['year']==y for s in sources) for y in years},states=original['states'],sources=[{k:v for k,v in s.items() if k!='path'} for s in sources],periods=periods,categories=list(byid.values()),series={k:dict(path='/assets/boletin/history/'+k+'.json',points=len(ps),state_points=sum(p['e'] is not None for p in ps),flagged_points=sum(bool(p['flags']) for p in ps),revisions=len(revisions[k]),unplaced=len(unplaced[k])) for k,ps in series.items()},source_issues=[dict(source=source_id[x['source']['filename']],**i) for x in raw for i in x['issues']])
(OUT/'index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n');(OUT/'identities.json').write_text(json.dumps(aliases,ensure_ascii=False,separators=(',',':'))+'\n')
with (OUT/'nacional-2013-2026.csv').open('w',newline='',encoding='utf-8-sig') as f:
 w=csv.writer(f,lineterminator='\n');w.writerow(['padecimiento','CIE_corte_actual_o_historico','anio_observado','semana_observada','casos_semanales','acumulado_observado','en_estudio_acumulados','boletin_anio','boletin_semana','pagina','fuente','PDF_archivo','avisos','revision_sustituida','fecha_ambigua','semanal_impreso_no_graficado','acumulado_impreso_no_graficado'])
 for ident,ps in series.items():
  for older,points in [(False,ps),(True,revisions[ident]),(False,unplaced[ident])]:
   for p in points:
    s=sources[p['s']];d=byid[ident];w.writerow([d['name'],d['code'],p['y'],p['w'],*p['n'],p.get('in_study'),s['year'],s['week'],p['p'],s['url'],s.get('archive_member',''),'|'.join(p['flags']),int(older),int('reported_cut' in p),p.get('reported_weekly') if 'reported_cut' in p else None,p.get('reported_cumulative') if 'reported_cut' in p else None])
print('SOURCES',len(sources),'REPRESENTED',len(seen_sources),'CATEGORIES',len(series),'POINTS',sum(map(len,series.values())),'REVISIONS',sum(map(len,revisions.values())))
