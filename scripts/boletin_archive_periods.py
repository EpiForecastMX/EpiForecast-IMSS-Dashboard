"""Observation cuts from bulletin table captions, independently of issue dates."""
import re,unicodedata
from datetime import date,timedelta
def first(y):
 d=date(y,1,4);return d-timedelta(days=(d.weekday()+1)%7)
def period(y,w,lag):
 d=first(y)+timedelta(weeks=w-1-lag);yy=d.year+1
 while first(yy)>d:yy-=1
 return yy,(d-first(yy)).days//7+1
def ascii(s):return unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
def cut(text,r,src):
 t=ascii(text).replace('202o','2020');t=re.sub(r'epidemiol[a-z0-9]+\s','epidemiologica ',t);t=t[t.index('cuadro'):] if 'cuadro' in t else t;matches=list(re.finditer(r'(?:hasta\s+la\s+(?:semana\s+(?:epidemiologica\s+)?)?|semana\s+(?:epidemiologica\s+)?)(\d{1,2})(?:\s+del?\s+(20\d{2}))?',t))
 if not matches:return None
 chosen=matches[0];name=ascii(r['name']);code=r['code']
 keys={'pfa':['S/C','U98'],'rabia':['A82','A82.0','A82.1','A82.9'],'chikungunya':['A92.0'],'srcongenita':['P35.0'],'esavi':['Y58,Y59'],'vivax':['B51'],'falciparum':['B50'],'sida':['B20,B24'],'vih':['B20,B24,Z21'],'covid':['U07.1'],'influenza':['J09','J09,J11','J10,J11','J09,J10,J11'],'tuberculosa':['A17.0'],'respiratoria':['A15,A16'],'sarampion':['B05'],'rubeola':['B06'],'colera':['A00'],'zika':['U06.9']}
 stop=set('la el de del por y en otras otros hasta semana epidemiologica enfermedades enfermedad casos'.split())
 for i,m in enumerate(matches[1:],1):
  context=t[matches[i-1].end():m.start()];tokens=set(re.findall(r'[a-z]+',context))-stop;named=set(re.findall(r'[a-z]+',name))-stop
  if len(tokens & named)>=2 or any(re.sub(r'[^a-z0-9]','',k) in re.sub(r'[^a-z0-9]','',context) and code in v for k,v in keys.items()):chosen=m
 w=int(chosen[1]);y=int(chosen[2]) if chosen[2] else src['year']-(w>src['week']+10)
 return y,w
