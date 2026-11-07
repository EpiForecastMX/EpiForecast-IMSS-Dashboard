import json,subprocess,os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
B=Path(os.environ.get('BOLETIN_WORK_DIR','tmp/boletin-history'));out=B/'ocr';out.mkdir(exist_ok=True);r=json.loads((B/'extraction.json').read_text())
jobs=[(x['source'],h['page']) for x in r for h in x['headers'] if not any(w in h['text'].lower() for w in ['hasta','semana'])]
def one(job):
 src,pn=job;key=src['filename'].replace('.pdf','')+f'_p{pn}';txt=out/(key+'.txt')
 if not txt.exists():
  img=out/key
  subprocess.run(['pdftoppm','-f',str(pn),'-l',str(pn),'-scale-to','1200','-x','0','-y','95','-W','940','-H','110','-png','-singlefile',src['path'],str(img)],stderr=subprocess.DEVNULL,check=True)
  t=subprocess.check_output(['tesseract',str(img)+'.png','stdout','--psm','6'],stderr=subprocess.DEVNULL,env={**os.environ,'OMP_THREAD_LIMIT':'1'}).decode();txt.write_text(t)
 return key,txt.read_text()
outdata={}
with ThreadPoolExecutor(8) as p:
 for i,(k,v) in enumerate(p.map(one,jobs),1):
  outdata[k]=v
  if i%100==0:print('OCR',i,'/',len(jobs),flush=True)
(B/'headers-ocr.json').write_text(json.dumps(outdata,ensure_ascii=False));print('DONE',len(outdata))
