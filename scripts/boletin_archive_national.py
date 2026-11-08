"""Read historical national-only rows by name, retaining the printed code.
Name matching is deliberate: yellow fever and equine encephalitis codes are
interchanged in later source editions. Neither series is joined by code alone.
"""
import json,re
from concurrent.futures import ProcessPoolExecutor
import boletin_archive_extract as a
KEYS={'national-A80':'poliomielitis','national-A36':'difteria','national-A92.2':'amarilla','national-A95':'encefalitis','national-A20':'peste','national-A92.8':'mayaro','national-A98.4':'ebola'}
def extract(src):
 ps=a.E.parse(a.B/'cache'/src['filename'].replace('.pdf','.xml')).findall('.//x:page',a.NS);out=[];issues=[]
 for pn,p in enumerate(ps,1):
  ws=a.clean_words(a.modern.dedup(a.modern.words(p)));ls=a.modern.dedup(a.modern.lines(p))
  chol=next((w for w in ws if a.norm(w['t'])=='colera'),None)
  if not chol or not any('ENFERMEDAD' in l['t'] for l in ls):continue
  code=next((w for w in ws if w['t']=='A00' and abs(w['y']-chol['y'])<4),None)
  if not code:continue
  refs=a.cells([w for w in ws if w['x']>code['r']+5 and abs(w['y']-chol['y'])<3])
  if len(refs)!=5:issues.append(dict(page=pn,kind='national_columns',count=len(refs)));continue
  for ident,key in KEYS.items():
   label=next((w for w in ws if a.norm(w['t'])==key and w['x']<code['x']-10),None)
   if not label and ident in ['national-A80','national-A36']:
    expected=ident.split('-')[1];label=next((w for w in ws if w['t']==expected and abs(w['x']-code['x'])<30),None)
   if not label:continue
   cod=next((w for w in ws if re.fullmatch(r'A\d{2}(?:\.\d)?',w['t']) and abs(w['x']-code['x'])<30 and abs(w['y']-label['y'])<10),None)
   if not cod:issues.append(dict(page=pn,id=ident,kind='national_identity'));continue
   row=a.cells([w for w in ws if w['x']>code['r']+5 and abs(w['y']-cod['y'])<3]);vals=['']*5
   for w in row:
    k=min(range(5),key=lambda k:abs(refs[k]['r']-w['r']));vals[k]+=w['t']
   try:
    v=[a.number(t) for t in vals]
    header=' '.join(l['t'] for l in ls if 40<l['y']<chol['y'] and ('CUADRO' in l['t'] or 'hasta' in l['t']))
    d=next(d for d in a.CAT if d['id']==ident)
    out.append(dict(id=ident,name=d['name'],code=cod['t'],page=pn,columns=['weekly','cumulative','median','weekly_previous','previous'],totals=v,states=[],reconciled=None,observed_year=src['year'],matched='national_name',header=header))
   except Exception as e:issues.append(dict(page=pn,id=ident,kind='national_parse',message=str(e)))
 return dict(source=src,records=out,issues=issues)
if __name__=='__main__':
 sources=[s for s in json.loads((a.B/'sources.json').read_text()) if s['year']<2025]
 with ProcessPoolExecutor(4) as p:results=list(p.map(extract,sources))
 (a.B/'national-extraction.json').write_text(json.dumps(results,ensure_ascii=False));print('NATIONAL',len(results),'records',sum(len(x['records']) for x in results),'issues',sum(len(x['issues']) for x in results))
 print([dict(filename=x['source']['filename'],**e) for x in results for e in x['issues']][:20])
