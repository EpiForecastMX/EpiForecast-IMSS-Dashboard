"""OCR only missing table-caption cuts; bind every transcript to its PDF hash."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json,subprocess,os
import boletin_archive_extract as a
from boletin_archive_periods import cut

def main():
 b=a.B;out=b/'ocr-archive';out.mkdir(exist_ok=True);sources={s['filename']:s for s in json.loads((b/'sources.json').read_text())};jobs=set()
 for filename in ['archive-extraction.json','national-extraction.json']:
  for x in json.loads((b/filename).read_text()):
   src=x['source']
   if src['year']>=2025:continue
   headers={h['page']:h['text'] for h in x.get('headers',[])}
   for r in x['records']:
    if cut(r.get('header',headers.get(r['page'],'')),r,src) is None:jobs.add((src['filename'],r['page']))
 def one(job):
  filename,pn=job;src=sources[filename];key=filename.replace('.pdf','')+f'_p{pn}';txt=out/(key+'.txt');stamp=out/(key+'.sha256')
  if not txt.exists() or not stamp.exists() or stamp.read_text().strip()!=src['sha256']:
   page=a.E.parse(b/'cache'/filename.replace('.pdf','.xml')).findall('.//x:page',a.NS)[pn-1];ws=page.findall('.//x:word',a.NS)
   cy=min(float(w.get('yMin'))*720/float(page.get('height')) for w in ws if w.text and ('CIE-' in w.text or w.text=='CIE'))
   start=max(0,round((cy-80)*1200/720));width=round(float(page.get('width'))/float(page.get('height'))*1200);img=out/key
   subprocess.run(['pdftoppm','-f',str(pn),'-l',str(pn),'-scale-to','1200','-x','0','-y',str(start),'-W',str(width),'-H','140','-png','-singlefile',src['path'],str(img)],stderr=subprocess.DEVNULL,check=True)
   text=subprocess.check_output(['tesseract',str(img)+'.png','stdout','--psm','6'],stderr=subprocess.DEVNULL,env={**os.environ,'OMP_THREAD_LIMIT':'1'}).decode();txt.write_text(text);stamp.write_text(src['sha256']+'\n')
  return key,dict(sha256=src['sha256'],text=txt.read_text())
 with ThreadPoolExecutor(8) as p:result=dict(p.map(one,sorted(jobs)))
 (b/'archive-headers-ocr.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('Hash-bound caption transcripts:',len(result))
if __name__=='__main__':main()
