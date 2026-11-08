"""Prepare a hash-checked manifest from official ZIP archives and recent PDFs.

Offline by default. --download explicitly enables missing/resumable downloads.
Example:
 python3 scripts/boletin_archive_sources.py --work-dir /tmp/bulletins \
   --raw-pdf-dir /path/to/backend/data/raw_PDFs --download
Then set BOLETIN_WORK_DIR and run archive_extract, archive_national, verify_cuts,
archive_headers, and archive_build. No raw PDF or model artifact is modified.
"""
from pathlib import Path
from zipfile import ZipFile,is_zipfile
from concurrent.futures import ThreadPoolExecutor
import argparse,json,re,hashlib,subprocess

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--work-dir',type=Path,required=True);p.add_argument('--raw-pdf-dir',type=Path);p.add_argument('--recent-index',type=Path,default=Path('assets/boletin/history/index.json'));p.add_argument('--download',action='store_true');args=p.parse_args()
 b=args.work_dir;b.mkdir(parents=True,exist_ok=True);out=b/'pdfs';out.mkdir(exist_ok=True);(b/'cache').mkdir(exist_ok=True)
 def fetch(url,path,resume=False):
  if not args.download:raise FileNotFoundError(f'{path}: missing input; download explicitly with --download')
  command=['curl','-L','--fail','--retry','2','--max-time','600','-sS']
  if resume and path.exists():command+=['-C','-']
  subprocess.run(command+[url,'-o',str(path)],check=True)
 def archive(y):
  url=f'https://epidemiologia.salud.gob.mx/gobmx/salud/documentos/boletin/{y}.zip';zpath=b/f'{y}.zip'
  if not is_zipfile(zpath):fetch(url,zpath,True)
  entries=[];weeks=set()
  with ZipFile(zpath) as z:
   for member in z.namelist():
    if not member.lower().endswith('.pdf'):continue
    stem=Path(member).stem;se=re.search(r'(?:SE|sem)([0-9]{1,2})',stem,re.I);digits=re.findall(r'\d+',stem);w=int(se[1]) if se else int(digits[-1]) if digits[0]==str(y) else int(digits[0][-2:])
    if not 1<=w<=53:raise ValueError((y,member,w))
    blob=z.read(member)
    if not blob.startswith(b'%PDF-'):raise ValueError('Non-PDF archive member '+member)
    sha=hashlib.sha256(blob).hexdigest();name=f'{y}_sem{w:02}.pdf' if w not in weeks else f'{y}_sem{w:02}_v{sha[:8]}.pdf';weeks.add(w)
    local=args.raw_pdf_dir/name if args.raw_pdf_dir else out/name
    if not local.exists() or hashlib.sha256(local.read_bytes()).hexdigest()!=sha:local=out/name;local.write_bytes(blob)
    e=dict(year=y,week=w,url=url,archive_member=member,archive_verified=True,filename=name,path=str(local.resolve()),sha256=sha)
    if y==2023 and w==34:
     e['edition_priority']=0 if sha.startswith('caa81398') else 1
     if sha=='7afeead2e639d282e002986c6d7c1eadb340f6a8e9fe24b06b900d23cd709c63':e['url']='https://www.gob.mx/cms/uploads/attachment/file/855910/sem34.pdf';e['index_url']='https://www.gob.mx/salud/documentos/boletinepidemiologico-sistema-nacional-de-vigilancia-epidemiologica-sistema-unico-de-informacion-261547'
    entries.append(e)
  return entries
 sources=[]
 with ThreadPoolExecutor(2) as pool:
  for entries in pool.map(archive,range(2013,2025)):sources+=entries
 recent=json.loads(args.recent_index.read_text())['sources']
 for s in recent:
  if s['year']<2025:continue
  name=s['filename'];local=args.raw_pdf_dir/name if args.raw_pdf_dir else out/name
  if not local.exists():local=out/name
  if not local.exists():fetch(s['url'],local)
  blob=local.read_bytes()
  if not blob.startswith(b'%PDF-') or hashlib.sha256(blob).hexdigest()!=s['sha256']:raise ValueError('Recent source changed: '+name)
  sources.append({**{k:v for k,v in s.items() if k not in ['path','archive_verified']},'path':str(local.resolve())})
 sources.sort(key=lambda s:(s['year'],s['week'],s['filename']))
 if len({s['filename'] for s in sources})!=len(sources):raise ValueError('Duplicate source filename')
 (b/'sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n');print('Verified sources:',len(sources))
if __name__=='__main__':main()
