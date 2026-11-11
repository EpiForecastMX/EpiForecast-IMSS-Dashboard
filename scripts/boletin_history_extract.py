"""Offline extraction with Poppler; production serves only prebuilt JSON.
BOLETIN_WORK_DIR points to sources.json (local PDF paths) and the working cache.
BOLETIN_CATALOG defaults to the current snapshot declared in assets/boletin/actual.json.
Every original cell, anomaly and reconciliation result remains in the local cache.
"""
import json,re,hashlib,subprocess,unicodedata,os,xml.etree.ElementTree as E
from pathlib import Path
import boletin_foto_actual
from concurrent.futures import ProcessPoolExecutor
from difflib import SequenceMatcher
B=Path(os.environ.get('BOLETIN_WORK_DIR','tmp/boletin-history'))
CAT=json.loads(Path(os.environ.get('BOLETIN_CATALOG') or boletin_foto_actual.carpeta(Path(os.environ.get('BOLETIN_FRONTEND','.')))/'data.json').read_text())['diseases']
NS={'x':'http://www.w3.org/1999/xhtml'}
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
def lines(p):return [dict(t=' '.join(w.text or '' for w in l),x=float(l.get('xMin'))*540/float(p.get('width')),r=float(l.get('xMax'))*540/float(p.get('width')),y=float(l.get('yMin'))*720/float(p.get('height'))) for l in p.findall('.//x:line',NS)]
def words(p):return [dict(t=w.text or '',x=float(w.get('xMin'))*540/float(p.get('width')),r=float(w.get('xMax'))*540/float(p.get('width')),y=float(w.get('yMin'))*720/float(p.get('height'))) for w in p.findall('.//x:word',NS)]
def dedup(items):
 out=[];spatial={}
 for w in sorted(items,key=lambda a:-a['y']):
  key=(w['t'],round(w['x'],1))
  if any(abs(w['y']-y)<4 for y in spatial.get(key,[])):continue
  out.append(w);spatial.setdefault(key,[]).append(w['y'])
 return out
def cells(ws):
 out=[]
 for w in sorted(ws,key=lambda a:a['x']):
  if out and w['x']-out[-1]['r']<5:out[-1]['t']+=w['t'];out[-1]['r']=w['r']
  else:out.append(w.copy())
 return out
def val(s):
 s=s.replace(',','').replace(' ','')
 # «-» se lee como 0 sólo en la reconstrucción; después es obligatorio boletin_marcadores_migra.py,
 # que restituye el guion impreso cotejando cada PDF (README_radar_boletin.md, «Guiones y ceros»).
 if s and set(s)<=set('-–−'):return 0
 if re.fullmatch(r'#+',s):return None
 if re.fullmatch(r'-?\d+\*?',s):return int(s.rstrip('*'))
 if re.fullmatch(r'\d+-',s):return int(s[:-1])
 if norm(s) in ['nd','na','sn'] or not s:return None
 if not s.isdigit():raise ValueError('bad value:'+s)
 return int(s)
def match(name,code):
 ns=norm(name);cs=norm(code)
 names=[d for d in CAT if norm(d['name'])==ns]
 if len(names)==1:return names[0]['id'],'name'
 codes=[d for d in CAT if norm(d['code'])==cs]
 if len(codes)==1:return codes[0]['id'],'code'
 if codes:
  best=sorted(((SequenceMatcher(None,ns,norm(d['name'])).ratio(),d) for d in codes),key=lambda t:-t[0])
  if best[0][0]>.6:return best[0][1]['id'],'code+name'
 best=sorted(((SequenceMatcher(None,ns,norm(d['name'])).ratio(),d) for d in CAT),key=lambda t:-t[0])
 if best[0][0]>.86:return best[0][1]['id'],'similarity'
 return None,[(round(v,3),d['id'],d['name']) for v,d in best[:2]]
def parse(src):
 name=src['filename'];cache=B/'cache'/name.replace('.pdf','.json')
 if cache.exists() and json.loads(cache.read_text()).get('parser_version')==4:return json.loads(cache.read_text())
 xml=B/'cache'/name.replace('.pdf','.xml')
 if not xml.exists():subprocess.run(['pdftotext','-bbox-layout',src['path'],str(xml)],stderr=subprocess.DEVNULL,check=True)
 root=E.parse(xml);ps=root.findall('.//x:page',NS);out=[];issues=[];headers=[];special=[]
 for pn,p in enumerate(ps,1):
  ls=dedup(lines(p));ws=dedup(words(p));ts=' '.join(w['t'] for w in ws)
  if 'TOTAL' in ts and 'ENTIDAD' in ts and 'Sem.' in ts:
   try:
    total=next(w for w in ws if w['t']=='TOTAL');ty=total['y']
    sems=sorted([w for w in ws if w['t']=='Sem.' and w['y']<300],key=lambda w:w['x'])
    cis=sorted([l for l in ls if 'CIE-' in l['t'] and 90<l['y']<min(s['y'] for s in sems)],key=lambda l:l['x'])
    if len(cis)==1 and len(sems)==2 and 'inmunodeficiencia' in ts:sems=sems[:1]
    if len(cis)!=len(sems):raise ValueError(f'headers CIE{len(cis)} Sem{len(sems)}')
    cs=cells([w for w in ws if abs(w['y']-ty)<2 and w['x']>120]);n=len(cis)
    yearwords=[w for w in ws if w['t'] in [str(src['year']),str(src['year']-1),str(src['year']-2)] and max(c['y'] for c in cis)+8<w['y']<min(s['y'] for s in sems)]
    year_y=min(w['y'] for w in yearwords)
    centers=[(c['x']+c['r'])/2 for c in cis];names=[[] for _ in cis];codes=[[] for _ in cis]
    for l in sorted(ls,key=lambda l:(l['y'],l['x'])):
     if l['x']<120 or not 90<l['y']<year_y-1 or 'CUADRO' in l['t'] or 'hasta la' in l['t'] or 'por Vacunac' in l['t']:continue
     j=min(range(n),key=lambda j:abs((l['x']+l['r'])/2-centers[j]))
     (names if l['y']<cis[j]['y']-1 else codes)[j].append(l['t'])
    labels=[l for l in ls if l['x']<115 and year_y+20<l['y']<ty-5 and l['r']<132 and l['t'] not in ['H','M','Acum.','FEDERATIVA','ENTIDAD','Sem.'] and not l['t'].isdigit()]
    labels.sort(key=lambda l:l['y'])
    if len(labels)!=32:raise ValueError(f'states {len(labels)}')
    page_records=[]
    for j in range(n):
     left=sems[j]['x']-10;right=sems[j+1]['x']-10 if j+1<n else 510
     obs_year=max(int(w['t']) for w in yearwords if left<w['x']<right)
     cg=[c for c in cs if left<=c['x']<right];values=[val(c['t']) for c in cg]
     code=re.sub(r'CIE-10ª\s*REV\.?','',' '.join(codes[j])).strip();dname=re.sub(r'[§&°^]','',' '.join(names[j])).strip()
     ident,matched=match(dname,code)
     if not ident:issues.append(dict(page=pn,kind='identity',name=dname,code=code,near=matched));continue
     hs=[w['t'] for w in sorted(ws,key=lambda w:w['x']) if w['t'] in ['H','M'] and year_y<w['y']<labels[0]['y']-3 and left<w['x']<right]
     prev=any(w['t']==str(obs_year-1) and left<w['x']<right for w in yearwords)
     # HIV has one block and four stages, each split by sex.
     if ident=='p27b1':cols=['weekly']+[f'{sex}_stage{k}' for k in range(1,5) for sex in ['H','M']]+(['weekly_previous'] if len(values)==11 else [])+['previous']
     else:cols=['weekly']+(hs if hs else ['cumulative'])+(['previous'] if prev else [])
     if len(values)==len(cols)-1 and cols[-1]=='previous':
      values.append(None);cg.append(dict(t='',x=right-30,r=right-9,y=ty))
     if len(values)==len(cols)+1 and cols[-1]!='previous':cols.append('previous')
     if len(cols)!=len(values):raise ValueError(f'{ident}:columns {cols} values {values}')
     states=[];anomalies=[]
     for st in labels:
      vals=['' for _ in cg]
      row=[w for w in ws if abs(w['y']-st['y'])<2 and w['x']>125]
      row=[w for w in row if w['t']!='-' or not any(v['t'].isdigit() and v['x']<w['r'] and v['r']+5>w['x'] and abs(v['y']-w['y'])<4 for v in row)]
      allc=cs+([cg[-1]] if values[-1] is None and cols[-1]=='previous' else [])
      for w in cells(row):
       k=min(range(len(allc)),key=lambda k:abs(allc[k]['r']-w['r']))
       if allc[k] in cg:vals[cg.index(allc[k])]+=w['t']
      try:parsed=[val(t) for t in vals]
      except ValueError as e:raise ValueError(f'{ident} {st["t"]}: {vals}: {e}')
      if any(re.search(r'\d[-*]|-\d|##|--',t) for t in vals):anomalies.append(dict(state=st['t'],raw=vals))
      states.append(dict(state=st['t'],values=parsed))
     sums=[sum(st['values'][k] for st in states) if all(st['values'][k] is not None for st in states) else None for k in range(len(values))]
     reconciled=all(v is None or sm==v for v,sm in zip(values,sums))
     if not reconciled:issues.append(dict(page=pn,id=ident,kind='reconciliation',printed=values,summed=sums,name=dname))
     record=dict(id=ident,name=dname,code=code,page=pn,columns=cols,totals=values,states=states,reconciled=reconciled,anomalies=anomalies,observed_year=obs_year,matched=matched)
     out.append(record);page_records.append(ident)
    heading=' '.join(l['t'] for l in sorted(ls,key=lambda l:(l['y'],l['x'])) if 60<l['y']<min(c['y'] for c in cis) and l['x']<510)
    headers.append(dict(page=pn,text=heading,ids=page_records))
   except Exception as e:issues.append(dict(page=pn,kind='parse',message=str(e)))
  # Seven categories are present only in the national immediate summary.
  if 'ENFERMEDAD' in ts and ('Poliomielitis' in ts or '•Poliomielitis' in ts) and 'MEDIANA' in ts:
   chol=next((l for l in ls if l['t']=='Cólera'),None)
   if not chol:continue
   refs=cells([w for w in ws if w['x']>290 and abs(w['y']-chol['y'])<2])
   if len(refs)!=5:issues.append(dict(page=pn,kind='national_columns',count=len(refs)));continue
   for d in CAT:
    if not d['id'].startswith('national-'):continue
    code=d['code'];cw=next((w for w in ws if w['t']==code and 100<w['y']<650 and w['x']<300),None)
    if not cw:issues.append(dict(page=pn,kind='national_identity',id=d['id']));continue
    row=[w for w in ws if w['x']>290 and abs(w['y']-cw['y'])<2];vals=['' for _ in range(5)]
    for w in sorted(row,key=lambda w:w['x']):
     k=min(range(5),key=lambda k:abs(refs[k]['r']-w['r']));vals[k]+=w['t']
    v=[val(t) for t in vals];out.append(dict(id=d['id'],name=d['name'],code=code,page=pn,columns=['weekly','cumulative','median','weekly_previous','previous'],totals=v,states=[],reconciled=None,observed_year=src['year'],matched='code'))
 result=dict(parser_version=4,source=src,records=out,issues=issues,headers=headers);cache.write_text(json.dumps(result,ensure_ascii=False));return result
if __name__=='__main__':
 sources=json.loads((B/'sources.json').read_text());args=__import__('sys').argv[1:]
 if args:sources=[s for s in sources if s['filename'] in args]
 results=[]
 with ProcessPoolExecutor(4) as pool:
  for i,r in enumerate(pool.map(parse,sources),1):
   results.append(r);print(r['source']['filename'],len(r['records']),'issues',len(r['issues']),flush=True)
 (B/'extraction.json').write_text(json.dumps(results,ensure_ascii=False))
 issues=[dict(filename=r['source']['filename'],**e) for r in results for e in r['issues']];(B/'issues.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2));print('DONE',len(results),'records',sum(len(r['records']) for r in results),'issues',len(issues))
