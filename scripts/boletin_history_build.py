"""Build history shards and national CSV from extracted bulletins and OCR.
Run after boletin_history_extract.py and boletin_history_headers.py.
BOLETIN_WORK_DIR selects private input/cache; BOLETIN_FRONTEND defaults to cwd.
This offline preparation never changes raw PDFs or sealed model artifacts.
"""
import json,re,unicodedata,csv,hashlib,os
import boletin_history_extract as extractor
from pathlib import Path
from datetime import date,timedelta
B=Path(os.environ.get('BOLETIN_WORK_DIR','tmp/boletin-history'));F=Path(os.environ.get('BOLETIN_FRONTEND','.'));OUT=F/'assets/boletin/history';OUT.mkdir(parents=True,exist_ok=True)
cat=json.loads((F/'assets/boletin/2026-w42/data.json').read_text())['diseases'];byid={d['id']:d for d in cat}
raw=json.loads((B/'extraction.json').read_text());ocr=json.loads((B/'headers-ocr.json').read_text())
# Sarampión is absent from some state layouts but still reported in the immediate national table.
for source_record in raw:
 if any(r['id']=='p10b2' for r in source_record['records']):continue
 src=source_record['source'];ps=extractor.E.parse(B/'cache'/src['filename'].replace('.pdf','.xml')).findall('.//x:page',extractor.NS)
 for pn,page in enumerate(ps,1):
  ls=extractor.dedup(extractor.lines(page));ws=extractor.dedup(extractor.words(page))
  if not any('ENFERMEDAD' in l['t'] for l in ls) or not any('MEDIANA' in l['t'] for l in ls):continue
  cw=next((w for w in ws if w['t']=='B05' and w['x']<300),None);chol=next((l for l in ls if l['t']=='Cólera'),None)
  if not cw or not chol:continue
  refs=extractor.cells([w for w in ws if w['x']>290 and abs(w['y']-chol['y'])<2]);vals=['']*5
  if len(refs)!=5:raise ValueError(('national fallback',src['filename']))
  for w in sorted([w for w in ws if w['x']>290 and abs(w['y']-cw['y'])<2],key=lambda w:w['x']):
   k=min(range(5),key=lambda k:abs(refs[k]['r']-w['r']));vals[k]+=w['t']
  v=[extractor.val(t) for t in vals]
  source_record['records'].append(dict(id='p10b2',name='Sarampión',code='B05',page=pn,columns=['weekly','cumulative','median','weekly_previous','previous'],totals=v,states=[],reconciled=None,observed_year=src['year'],matched='national_fallback',national_fallback=True))
  break
def first(y):
 d=date(y,1,4);return d-timedelta(days=(d.weekday()+1)%7)
def period(day):
 y=day.year+1
 while first(y)>day:y-=1
 return y,(day-first(y)).days//7+1
def target(y,w,lag):return period(first(y)+timedelta(weeks=w-1-lag))
def norm(s):return unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
def pairs(text):
 text=norm(text).replace('del 202o','del 2020')
 return [(int(y),int(w)) for w,y in re.findall(r'(?:semana(?:\s+\S+)?|hasta\s+la)\s+(\d{1,2})\s+del?\s+(20\d{2})',text)]
def cum(cols,v):
 vals=[v[k] for k,c in enumerate(cols) if c in ['H','M','cumulative'] or c.startswith(('H_stage','M_stage'))]
 return sum(vals) if vals and all(x is not None for x in vals) else None
states=next(d['states'] for d in cat if d['states']);state_names=[s['state'] for s in states];sources=[];series={d['id']:[] for d in cat};issues=[];aliases=[];unmapped=[]
for si,x in enumerate(raw):
 src=x['source'];sources.append({k:v for k,v in src.items() if k!='path'})
 headers={h['page']:h for h in x['headers']};seen=set()
 for r in x['records']:
  ident=r['id'];d=byid[ident]
  if ident in seen:issues.append(dict(kind='duplicate_identity',source=si,id=ident));continue
  seen.add(ident)
  lag=0 if ident.startswith('national-') else 42-d['observed_week']
  oy,ow=target(src['year'],src['week'],lag)
  ht=headers.get(r['page'],{}).get('text','');ht=ht if 'hasta' in ht.lower() else ocr.get(src['filename'].replace('.pdf','')+f"_p{r['page']}",ht)
  flags=[]
  if not ident.startswith('national-') and not r.get('national_fallback'):
   found=pairs(ht)
   # Two OCR digit confusions were visually checked against their raster headers.
   visual_checks={('2025_sem31.pdf', 66): '1e64e7511af13e77b93746add9a4852175fab60fa3daa234953cc9dc9202e6f7', ('2026_sem34.pdf', 59): 'a7b1101a8f6f27253b531db0b5f6689e0c539d79b0deab225b432a8fca4ce3af'}
   if visual_checks.get((src['filename'],r['page']))==src['sha256']:found=[(oy,ow)]
   if (oy,ow) not in found:
    flags.append('source_cut_conflict');issues.append(dict(kind='cut_audit',source=si,id=ident,page=r['page'],expected=[oy,ow],found=found,text=ht))
  if r.get('national_fallback'):flags.append('national_only_source')
  if r['observed_year']!=oy:flags.append('accumulated_year_conflict')
  if r['reconciled'] is False:flags.append('state_total_discrepancy')
  if any(v is not None and v<0 for s in r['states'] for v in s['values']):flags.append('negative_values_reported')
  if any(any('*' in t for t in a['raw']) for a in r.get('anomalies',[])):flags.append('source_footnote')
  v=r['totals'];cols=r['columns'];c=cum(cols,v);prev=v[cols.index('previous')] if 'previous' in cols else None
  if any(z is None for z in v):flags.append('unavailable_source_cells')
  e=[]
  for name in state_names:
   state=next((s for s in r['states'] if s['state']==name),None)
   e.append([state['values'][0],None if 'accumulated_year_conflict' in flags else cum(cols,state['values'])] if state else [None,None])
  if 'source_cut_conflict' in flags:e=[[None,None] for _ in e]
  point=dict(y=oy,w=ow,s=si,p=r['page'],n=[None if 'source_cut_conflict' in flags else v[0],None if any(f in flags for f in ['accumulated_year_conflict','source_cut_conflict']) else c],prev=prev,e=e if r['states'] else None,flags=flags)
  if 'source_cut_conflict' in flags:point['source_header']=ht
  if flags:point['reported_weekly']=v[0];point['reported_year']=r['observed_year'];point['reported_cumulative']=c
  if (oy>=2025):series[ident].append(point)
  if norm(r['name'])!=norm(d['name']) or norm(r['code'])!=norm(d['code']):aliases.append(dict(id=ident,source=si,page=r['page'],source_name=r['name'],source_code=r['code'],matched=r['matched']))
# A future parsing/identity/cut failure must not silently become a published gap.
parsing_errors=[dict(filename=x['source']['filename'],**e) for x in raw for e in x['issues'] if e['kind']!='reconciliation']
if parsing_errors:raise ValueError(('Unresolved extraction failures',parsing_errors))
for issue in issues:
 if issue['kind']!='cut_audit':raise ValueError(('Invalid historical identity or period',issue))
 source=sources[issue['source']]
 if not(source['filename']=='2026_sem01.pdf' and source['sha256']=='8c5253888a05085594a8837cc9f645bc777473a4d7b013154ca4ba82eeb2089d' and issue['page']==10 and issue['id'] in ['p10b1','p10b2','p10b3']):raise ValueError(('Unreviewed source cut conflict',issue))
# All source documents are represented; each category retains explicit gaps.
for k,ps in series.items():
 ps.sort(key=lambda p:(p['y'],p['w'],p['s']))
 keys=[(p['y'],p['w']) for p in ps]
 if len(keys)!=len(set(keys)):issues.append(dict(kind='duplicate_period',id=k))
 payload={'schema':'boletin_history_series.v1','id':k,'points':ps}
 (OUT/(k+'.json')).write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
index={'schema':'boletin_history.v1','checked':'2026-11-07','source_count':len(sources),'source_years':{str(y):sum(s['year']==y for s in sources) for y in [2025,2026]},'states':state_names,'sources':sources,'periods':[dict(y=y,w=w,start=(first(y)+timedelta(weeks=w-1)).isoformat()) for y in [2025,2026] for w in range(1,54 if y==2025 else 43)],'series':{k:{'path':f'/assets/boletin/history/{k}.json','points':len(ps),'state_points':sum(p['e'] is not None for p in ps),'flagged_points':sum(bool(p['flags']) for p in ps)} for k,ps in series.items()},'source_issues':[{**{k:v for k,v in e.items() if k not in ['message']},'source':i} for i,x in enumerate(raw) for e in x['issues']]}
(OUT/'index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n');(OUT/'identities.json').write_text(json.dumps(aliases,ensure_ascii=False,separators=(',',':'))+'\n')
(B/'cut-issues.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2))
with (OUT/'nacional-2025-2026.csv').open('w',newline='',encoding='utf-8-sig') as f:
 writer=csv.writer(f,lineterminator='\n');writer.writerow(['padecimiento','CIE_corte_actual','anio_observado','semana_observada','casos_semanales','acumulado_observado','boletin_anio','boletin_semana','pagina','fuente','avisos'])
 for ident,ps in series.items():
  for p in ps:
   s=sources[p['s']];d=byid[ident];writer.writerow([d['name'],d['code'],p['y'],p['w'],*p['n'],s['year'],s['week'],p['p'],s['url'],'|'.join(p['flags'])])
print('SERIES',len(series),'POINTS',sum(len(ps) for ps in series.values()),'NO POINTS',[k for k,ps in series.items() if not ps]);print('CUT ISSUES',len(issues));print('FLAGGED',sum(bool(p['flags']) for ps in series.values() for p in ps));print('FIRST ISSUES',json.dumps(issues[:8],ensure_ascii=False))
