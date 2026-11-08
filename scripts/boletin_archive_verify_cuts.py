from pathlib import Path
import sys,json,os

import boletin_archive_extract as a
b=a.B;raw=json.loads((b/'archive-extraction.json').read_text());out=[]
for x in raw:
 src=x['source']
 if src['year']!=2015 or not 48<=src['week']<=52:continue
 ps=a.E.parse(b/'cache'/src['filename'].replace('.pdf','.xml')).findall('.//x:page',a.NS)
 for pn,page in enumerate(ps,1):
  ws=a.clean_words(a.modern.dedup(a.modern.words(page)));chol=next((w for w in ws if a.norm(w['t'])=='colera'),None)
  if not chol:continue
  ac=next((w for w in ws if w['t']=='A00' and abs(w['y']-chol['y'])<3),None)
  if not ac:continue
  refs=a.cells([w for w in ws if w['x']>ac['r']+5 and abs(w['y']-chol['y'])<3])
  if len(refs)!=5:continue
  for r in x['records']:
   if r['code'] not in ['A90','A91','A92.5']:continue
   cw=next((w for w in ws if r['code'] in w['t'] and abs(w['x']-ac['x'])<30 and w['y']<500),None)
   if not cw and r['code']=='A92.5':cw=next((w for w in ws if a.norm(w['t'])=='zika' and w['x']<ac['x']),None)
   if not cw:raise ValueError((src['filename'],r['code']))
   ys=sorted({round(w['y'],1) for w in ws if cw['y']-2<w['y']<cw['y']+22 and w['x']>ac['r']+5});found=None
   for y in ys:
    cs=a.cells([w for w in ws if abs(w['y']-y)<2 and w['x']>ac['r']+5])
    if len(cs)==5:
     v=[a.number(c['t']) for c in cs];found=v;break
   if found is None:raise ValueError(('numeric row',src['filename'],r['code']))
   expected=[r['totals'][r['columns'].index('weekly')],sum(v for c,v in zip(r['columns'],r['totals']) if c in ['H','M'])]
   if found[:2]!=expected:raise ValueError(('mismatch',src['filename'],r['code'],found,expected))
   out.append(dict(filename=src['filename'],sha256=src['sha256'],code=r['code'],state_page=r['page'],summary_page=pn,original_cut=[2015,47],verified_cut=[2015,src['week']],verified_values=expected))
  break
(Path(os.environ.get('BOLETIN_FRONTEND','.'))/'tests/fixtures/boletin-cut-overrides.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print('INDEPENDENT NATIONAL MATCHES',len(out));print([(d['filename'],d['code'],d['verified_values']) for d in out])
