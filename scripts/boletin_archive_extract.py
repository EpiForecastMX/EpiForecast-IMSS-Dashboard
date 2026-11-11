"""Extract historical bulletin layouts without imposing current disease definitions.
A source cell is published only after reconciliation against all 32 states.
"""
import os,json,re,hashlib,subprocess,xml.etree.ElementTree as E
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor
from difflib import SequenceMatcher
import boletin_history_extract as modern
B=modern.B;CAT=modern.CAT;norm=modern.norm;NS=modern.NS
VERSION=13
SOURCE_LITERALS={('03547ac043760423b0544a6eadb9bda203366c7e9cb416ba6e3efa1a280a4cc1', 30): ['Z'], ('4a57ac8c7786678fddb5637a625180529c3bbfcd04736c237c2076fee7b8281a', 33): ['ae'], ('9600171099133c37c392832b99d4b5c471043f296edc98a6ad62c77372b35151', 44): ['o'], ('4e3b76f5b802b6ac084a164b2308015d13df5bb25c2c479eff1255e72391b022', 27): ['.'], ('0d79c705d64eb1f7b8e1a9e9bd68628e19629e2a94dbcae8db4a388e417a2e17', 50): ['SanLuisPotosí']}
STATE={norm(s['state']):s['state'] for d in CAT for s in d.get('states',[])}
STATE['distritofederal']='Ciudad de México'
def code_key(s):
 return ','.join(dict.fromkeys(re.findall(r'[A-Z][0-9]{2}(?:\.[0-9]+)?|S/C',s)))
def identity(name,code):
 cs=code_key(code);ns=norm(name)
 if cs=='A90' and 'nograve' in ns:return 'historical-dengue-a90-no-grave','historical_definition'
 if cs=='A91' and 'consignosdealarma' in ns:return 'historical-dengue-a91-alarma-grave','historical_definition'
 if cs=='A91' and 'denguegrave' in ns:return 'historical-dengue-a91-grave','historical_definition'
 if cs=='S/C' and 'dengue' in ns:return 'historical-dengue-alarma-sc','historical_definition'
 if cs=='A82' and 'faunasilvestre' in ns:return 'p36b1','name_source_code_erratum'
 if cs=='A82' and 'faunaurbana' in ns:return 'p36b2','name_source_code_erratum'
 if cs=='B50' and 'falciparum' in ns:return 'p33b1','species_name'
 if cs=='B50' and 'vivax' in ns:return 'p33b2','species_name'
 if cs=='B51' and 'vivax' in ns:return 'p33b2','name_source_code_erratum'
 ds=[d for d in CAT if code_key(d['code'])==cs and cs and cs!='S/C']
 if len(ds)==1:return ds[0]['id'],'code'
 if ds:
  ds.sort(key=lambda d:-SequenceMatcher(None,ns,norm(d['name'])).ratio())
  if SequenceMatcher(None,ns,norm(ds[0]['name'])).ratio()>.45:return ds[0]['id'],'code+name'
 if not cs:
  if 'diabetes' in ns and 'noinsulino' in ns:return 'p47b3','name'
  if 'diabetes' in ns and 'insulino' in ns:return 'p47b2','name'
  ds=[d for d in CAT if norm(d['name'])==ns]
  if len(ds)==1:return ds[0]['id'],'name'
 if not cs:
  if 'efectosadversostemporalmente' in ns:return 'p57b2','name_without_code'
  ns=ns.replace('insificiencia','insuficiencia').replace('transt','trast')
  if 'contactotraumatico' in ns:cs='X23'
  elif 'paralisisflacida' in ns:cs='S/C'
  else:
   ds=sorted(CAT,key=lambda d:-SequenceMatcher(None,ns,norm(d['name'])).ratio())
   if SequenceMatcher(None,ns,norm(ds[0]['name'])).ratio()>.78:return ds[0]['id'],'name_without_code'
  if not cs:return None,'missing_code'
 return 'historical-'+hashlib.sha256((cs if cs!='S/C' else cs+ns).encode()).hexdigest()[:12],'historical_definition'
def clean_words(ws):
 out=[];grid={}
 for w in ws:
  x=int(w['x']//5);y=int(w['y']//5)
  nearby=[v for dx in [-1,0,1] for dy in [-1,0,1] for v in grid.get((w['t'],x+dx,y+dy),[])]
  if any(abs(w['x']-v['x'])<4 and abs(w['y']-v['y'])<4 for v in nearby):continue
  out.append(w);grid.setdefault((w['t'],x,y),[]).append(w)
 return out
def cells(ws):
 out=[]
 for w in sorted(ws,key=lambda a:a['x']):
  if out and w['x']-out[-1]['r']<3:out[-1]['t']+=w['t'];out[-1]['r']=w['r']
  else:out.append(w.copy())
 return out
def number(s,source_hash=None,page=None):
 s=s.replace(',','').replace(' ','').replace('−','-').replace('–','-')
 if s in ['n.e.','n.e','n.a.','n.d.','s.n.','s.n','n.a','n.d','n/a','n/d'] or not s:return None
 # «-» → 0 sólo aquí; tras reconstruir, boletin_marcadores_migra.py restituye el guion (README).
 if set(s)<=set('-'):return 0
 if re.fullmatch(r'#+',s):return None
 if re.fullmatch(r'-?\d+[*/]?',s):return int(s.rstrip('*/'))
 if re.fullmatch(r'\d+-',s):return int(s[:-1])
 if s in SOURCE_LITERALS.get((source_hash,page),[]):return None
 raise ValueError('non numeric: '+s)
def extract(src):
 if src['year']>=2025:return modern.parse(src)
 cache=B/'cache'/src['filename'].replace('.pdf','-archive.json')
 if cache.exists():
  cached=json.loads(cache.read_text())
  if cached.get('archive_version') in [10,11,12,VERSION] and cached['source']['sha256']==src['sha256']:
   for record in cached['records']:
    if (record['code']=='B50' and any(k in norm(record['name']) for k in ['falciparum','vivax'])) or (record['code']=='A82' and 'fauna' in norm(record['name'])) or record['code'] in ['A90','A91'] or (record['code']=='S/C' and 'dengue' in norm(record['name'])):record['id'],record['matched']=identity(record['name'],record['code'])
    if record['code']=='B20,B24' and any(c.startswith('H_stage') for c in record['columns']):record['id']='historical-sida-estadios-2020'
   cached['archive_version']=VERSION;cached['source']=src;return cached
 xml=B/'cache'/src['filename'].replace('.pdf','.xml')
 if cache.exists() and cached['source']['sha256']!=src['sha256'] and xml.exists():xml.rename(xml.with_suffix('.'+cached['source']['sha256'][:16]+'.xml'))
 if not xml.exists():subprocess.run(['pdftotext','-bbox-layout',src['path'],str(xml)],check=True,stderr=subprocess.DEVNULL)
 pages=E.parse(xml).findall('.//x:page',NS);out=[];issues=[];headers=[]
 for pn,p in enumerate(pages,1):
  read_number=lambda value:number(value,src['sha256'],pn)
  ls=modern.dedup(modern.lines(p));ws=clean_words(modern.dedup(modern.words(p)));ts=' '.join(w['t'] for w in ws)
  if not ('TOTAL' in ts and 'ENTIDAD' in ts and any(('CIE-' in w['t'] or w['t']=='CIE') for w in ws)):continue
  try:
   total=next(w for w in ws if w['t']=='TOTAL');ty=total['y']
   state_labels=[{**l,'t':STATE[norm(l['t'])]} for l in ls if l['x']<150 and 140<l['y']<ty-4 and norm(l['t']) in STATE]
   state_labels.sort(key=lambda l:(l['y'],l['x']))
   state_labels=[l for i,l in enumerate(state_labels) if not any(abs(l['y']-v['y'])<3 for v in state_labels[:i])]
   if src['sha256']=='b83eea0d072e58cf6fa1b2538ef48c4c52e5dfb640cd0805bef217a809dc9c4d' and pn==51 and len(state_labels)==31:
    before=next(l for l in state_labels if l['t']=='Chihuahua');after=next(l for l in state_labels if l['t']=='Durango');candidates=[w for w in ws if before['y']+4<w['y']<after['y']-4 and w['t'].isdigit()]
    row_y=min(w['y'] for w in candidates);state_labels.append(dict(t='SIN ROTULO (posición 9)',x=before['x'],r=before['r'],y=row_y));state_labels.sort(key=lambda l:l['y'])
   if len(state_labels)!=32:raise ValueError(f'states {len(state_labels)}')
   labels=state_labels;rowstart=labels[0]['y']
   markerwords=sorted([w for w in ws if ('CIE-' in w['t'] or w['t']=='CIE') and 90<w['y']<rowstart],key=lambda w:w['x'])
   cis=[]
   for c in markerwords:
    if cis and abs(c['x']-cis[-1]['x'])<28:
     if c['y']<cis[-1]['y']:cis[-1]=c
    else:cis.append(c)
   centers=[(c['x']+c['r'])/2+12 for c in cis];n=len(cis)
   yearwords=[{**w,'t':w['t'].rstrip('*')} for w in ws if re.fullmatch(r'20\d{2}\*?',w['t']) and min(c['y'] for c in cis)+8<w['y']<rowstart]
   year_y=min(w['y'] for w in yearwords) if yearwords else min(w['y'] for w in ws if w['t'] in ['Sem.','Sem'])-12
   sems=[w for w in ws if w['t'] in ['Sem.','Sem'] and year_y-3<w['y']<rowstart]
   boundaries=[(centers[i]+centers[i+1])/2 for i in range(n-1)]
   lefts=[labels[0]['r']+5]+[a-25 for a in boundaries];rights=[a-25 for a in boundaries]+[540]
   hs_all=sorted([w for w in ws if w['t'] in ['H','M','F'] and year_y<w['y']<rowstart-3],key=lambda w:w['x'])
   sex_pairs=[]
   for k,h in enumerate(hs_all[:-1]):
    m=hs_all[k+1]
    if (h['t'],m['t']) in [('M','F'),('H','M')] and m['x']-h['x']<85:sex_pairs.append((h,m))
   sems_by_block=[[w for w in sems if lefts[j]<w['x']<rights[j]] for j in range(n)]
   # Sem. marks the start of a block, except tables explicitly lacking a weekly column.
   for j in range(n):
    sem=sems_by_block[j]
    if sem:
     lefts[j]=min(sem,key=lambda w:w['x'])['x']+3
    if not sem:
     candidates=[pair for pair in sex_pairs if abs(sum(w['x'] for w in pair)/2-centers[j])<50]
     if candidates:
      pair=min(candidates,key=lambda pair:abs(sum(w['x'] for w in pair)/2-centers[j]));lefts[j]=pair[0]['x']-10
    if j: rights[j-1]=lefts[j]
   cs=cells([w for w in ws if abs(w['y']-ty)<3 and w['x']>labels[0]['r']+5])
   # A national total can be blank while its 32 state cells are printed.
   # Recover only the column position from repeated state alignments, never its total.
   alignments=[]
   for st in labels:
    for c in cells([w for w in ws if abs(w['y']-st['y'])<2 and w['x']>st['r']+3]):
     near=next((a for a in alignments if abs(a['r']-c['r'])<5),None)
     if near:near['count']+=1
     else:alignments.append(dict(r=c['r'],count=1))
   for a in alignments:
    if a['count']>=20 and all(abs(c['r']-a['r'])>9 for c in cs):cs.append(dict(t='',x=a['r']-1,r=a['r'],y=ty))
   cs.sort(key=lambda c:c['r'])
   names=[[] for _ in cis];codes=[[] for _ in cis]
   for l in sorted(ls,key=lambda l:(l['y'],l['x'])):
    if not min(c['y'] for c in cis)-45<l['y']<year_y-1 or any(t in l['t'] for t in ['ENTIDAD','FEDERATIVA','CUADRO','hasta la','Vigilancia','Confirmados','En Estudio']) or l['t'].isdigit():continue
    j=min(range(n),key=lambda j:abs((l['x']+l['r'])/2-centers[j]))
    (names if l['y']<cis[j]['y']-1 else codes)[j].append(l['t'])
   ids=[]
   for j in range(n):
    try:
     name=' '.join(names[j]).strip(' §&~°');rawcode=' '.join(codes[j]);code=code_key(rawcode)
     if not code:code=code_key(name)
     ident,matched=identity(name,code)
     if not ident:raise ValueError('identity '+name+' / '+rawcode)
     left,right=lefts[j],rights[j];cg=[c for c in cs if left<=c['r']<right];v=[read_number(c['t']) for c in cg]
     ys=[int(w['t']) for w in yearwords if left<w['x']<right];oy=max(ys) if ys else None
     hs=[w['t'] for w in sorted(ws,key=lambda w:w['x']) if w['t'] in ['H','M','F'] and year_y<w['y']<rowstart-3 and left<w['x']<right]
     hs=['H' if a=='M' else 'M' for a in hs] if 'F' in hs else hs
     sem=sorted(sems_by_block[j],key=lambda w:w['x']);prev=oy is not None and oy-1 in ys
     cols=(['weekly'] if sem else [])+(hs if hs else ['cumulative'])
     if len(sem)>1:cols+=['weekly_previous']
     if prev:cols+=['previous']
     if len(hs)==8:cols=(['weekly'] if sem else [])+[f'{a}_stage{k//2+1}' for k,a in enumerate(hs)]+(['weekly_previous'] if len(sem)>1 else [])+(['previous'] if prev else [])
     if len(hs)==8 and len(v)==11 and 'weekly_previous' not in cols:cols.insert(-1,'weekly_previous')
     if 'weekly' not in cols and len(v)==len(cols)+1:cols=['weekly']+cols
     if code=='A90' and len(v)==5 and len(cols)==4:cg=cg[:-1];v=v[:-1]
     if code=='A91' and len(v)==4 and len(cols)==4:
      at=cs.index(cg[0]);cg=[cs[at-1]]+cg;v=[read_number(cg[0]['t'])]+v
     if code=='A91' and len(v)==len(cols)+1:cols=['in_study']+cols
     if len(v)==len(cols)-1 and cols[-1]=='previous':cols=cols[:-1]
     if len(hs)==1 and len(v)==4 and 'weekly' in cols:cols=['weekly','H','M','previous']
     if len(v)==len(cols)+1 and 'previous' not in cols:cols.append('previous')
     if code=='B20,B24' and len(hs)==8:ident='historical-sida-estadios-2020'
     if len(v)!=len(cols):raise ValueError(f'columns {cols} values {v} bounds {left:.1f},{right:.1f}')
     states=[];anomalies=[]
     for st in labels:
      vals=['']*len(cg)
      row=[w for w in ws if abs(w['y']-st['y'])<2 and w['x']>st['r']+3]
      row=[w for w in row if w['t']!='-' or not any(t['t'].isdigit() and t['x']<w['r'] and t['r']+5>w['x'] and abs(t['y']-w['y'])<4 for t in row)]
      for c in cells(row):
       k=min(range(len(cs)),key=lambda k:abs(cs[k]['r']-c['r']))
       if cs[k] in cg:vals[cg.index(cs[k])]+=c['t']
      nums=[read_number(a) for a in vals];states.append(dict(state=st['t'],values=nums))
      if any(re.search(r'-\d|[*#]|n\\.[ad]\\.|s\\.n',a) for a in vals):anomalies.append(dict(state=st['t'],raw=vals))
     sums=[sum(s['values'][k] for s in states) if all(s['values'][k] is not None for s in states) else None for k in range(len(v))]
     ok=all(a is None or b is None or a==b for a,b in zip(v,sums))
     if not ok:issues.append(dict(page=pn,id=ident,kind='reconciliation',printed=v,summed=sums,name=name))
     out.append(dict(id=ident,name=name,code=code,raw_code=rawcode,page=pn,columns=cols,totals=v,states=states,reconciled=ok,anomalies=anomalies,observed_year=oy,matched=matched,unlabeled_rows=[st for st in states if st['state'].startswith('SIN ROTULO')]));ids.append(ident)
    except Exception as e:issues.append(dict(page=pn,block=j,kind='parse',message=str(e)))
   heading=' '.join(l['t'] for l in sorted(ls,key=lambda l:(l['y'],l['x'])) if 85<l['y']<min(c['y'] for c in cis)-5)
   headers.append(dict(page=pn,text=heading,ids=ids))
  except Exception as e:issues.append(dict(page=pn,kind='parse',message=str(e)))
 result=dict(archive_version=VERSION,source=src,records=out,issues=issues,headers=headers);cache.write_text(json.dumps(result,ensure_ascii=False));return result
if __name__=='__main__':
 sources=json.loads((B/'sources.json').read_text());args=__import__('sys').argv[1:]
 if args:sources=[s for s in sources if s['filename'] in args]
 results=[]
 with ProcessPoolExecutor(4) as pool:
  for r in pool.map(extract,sources):results.append(r);print(r['source']['filename'],len(r['records']),len(r['issues']),flush=True)
 (B/'archive-extraction.json').write_text(json.dumps(results,ensure_ascii=False))
 (B/'archive-issues.json').write_text(json.dumps([dict(filename=r['source']['filename'],**e) for r in results for e in r['issues']],ensure_ascii=False,indent=2))
 print('DONE',len(results),'records',sum(len(r['records']) for r in results),'issues',sum(len(r['issues']) for r in results),flush=True)
