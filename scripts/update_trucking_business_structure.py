#!/usr/bin/env python3
"""Collect post-2020 commercial vs own-account freight structure from e-Stat.

2020 is a hard methodological break in MLIT Auto Transport Statistics, so this
collector intentionally emits only the post-change segment. Raw e-Stat units
are normalized by reconciling the commercial series to the already validated
annual commercial-truck baseline in trucking.json.
"""
from __future__ import annotations
import json, os, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; ECON=ROOT/'data/economy'
OUT=ECON/'trucking-business-structure.json'; BASE=ECON/'trucking.json'
STATS_DATA_ID='0003442538'
META='https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo'; DATA='https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData'
YEARS=[str(y) for y in range(2020,2025)]

def get(url,params):
 req=urllib.request.Request(url+'?'+urllib.parse.urlencode(params),headers={'User-Agent':'LBI-eStat/1.0'})
 with urllib.request.urlopen(req,timeout=90) as r:return json.load(r)
def aslist(v):return v if isinstance(v,list) else ([] if v is None else [v])
def norm(v):return ''.join(str(v or '').split()).replace('＿','_')

def metadata(app):
 d=get(META,{'appId':app,'statsDataId':STATS_DATA_ID,'explanationGetFlg':'N'}); r=d['GET_META_INFO']['RESULT']
 if str(r.get('STATUS'))!='0':raise RuntimeError(r)
 out=[]
 for o in aslist(d['GET_META_INFO']['METADATA_INF']['CLASS_INF']['CLASS_OBJ']):
  out.append({'id':str(o.get('@id','')),'name':str(o.get('@name','')),'classes':[{'code':str(c.get('@code','')),'name':str(c.get('@name','')),'unit':c.get('@unit')} for c in aslist(o.get('CLASS'))]})
 return out
def obj(meta,keys):
 for o in meta:
  n=norm(o['name'])
  if any(k in n for k in keys):return o
 raise KeyError((keys,[(o['id'],o['name']) for o in meta]))
def code(o,names):
 wanted=[norm(x) for x in names]
 for c in o['classes']:
  if norm(c['name']) in wanted:return c['code']
 for c in o['classes']:
  n=norm(c['name'])
  if any(w in n for w in wanted):return c['code']
 raise KeyError((o['name'],names,[(c['code'],c['name']) for c in o['classes'][:80]]))
def cd(i):
 if i=='tab':return 'cdTab'
 if i=='time':return 'cdTime'
 if i.startswith('cat'):return 'cd'+i[0].upper()+i[1:]
 return 'cd'+i[0].upper()+i[1:]

def fetch(app,tab_obj,vehicle_obj,tab_code,vehicle_code):
 p={'appId':app,'statsDataId':STATS_DATA_ID,'limit':1000,cd(tab_obj['id']):tab_code,cd(vehicle_obj['id']):vehicle_code,'cdTimeFrom':'2020000000','cdTimeTo':'2024000000'}
 d=get(DATA,p); r=d['GET_STATS_DATA']['RESULT']
 if str(r.get('STATUS'))!='0':raise RuntimeError({'result':r,'params':p})
 out={}
 for v in aslist(d['GET_STATS_DATA']['STATISTICAL_DATA']['DATA_INF'].get('VALUE')):
  y=str(v.get('@time',''))[:4]; raw=v.get('$')
  if y in YEARS and raw not in (None,'','-','…'):
   out[y]=float(raw)
 return out

def baseline(mid):
 d=json.loads(BASE.read_text(encoding='utf-8')); s=next(x for x in d['series'] if x['metric_id']==mid)
 return {str(o['period']):float(o['value']) for o in s.get('observations',[]) if str(o['period']) in YEARS}
def normalize(raw,base,label):
 common=sorted(set(raw)&set(base))
 if not common:raise RuntimeError(f'{label}: no overlap with baseline')
 candidates=[1.0,0.001,0.000001,1000.0]
 def err(f):return sum(abs(raw[y]*f-base[y])/max(abs(base[y]),1e-9) for y in common)/len(common)
 f=min(candidates,key=err); e=err(f)
 if e>0.03:raise RuntimeError({'metric':label,'best_factor':f,'mean_relative_error':e,'raw':raw,'baseline':base})
 return {y:raw[y]*f for y in raw},f,e
def rows(v,src,status='official_api'):
 return [{'period':y,'value':round(v[y],3),'status':status,'source':src} for y in sorted(v)]
def share(a,b):return {y:a[y]/(a[y]+b[y])*100 for y in sorted(set(a)&set(b)) if a[y]+b[y]}
def setser(d,mid,v):next(s for s in d['series'] if s['metric_id']==mid)['observations']=v

def main():
 app=os.environ.get('ESTAT_APP_ID');
 if not app:raise SystemExit('ESTAT_APP_ID is required')
 m=metadata(app); tab=obj(m,['表章項目']); vehicle=obj(m,['貨物運輸車両の種類','車両の種類'])
 ton=code(tab,['輸送トン数']); tkm=code(tab,['輸送トンキロ']); commercial=code(vehicle,['営業用_計','営業用計']); own=code(vehicle,['自家用_計','自家用計'])
 rc_ton=fetch(app,tab,vehicle,ton,commercial); ro_ton=fetch(app,tab,vehicle,ton,own); rc_tkm=fetch(app,tab,vehicle,tkm,commercial); ro_tkm=fetch(app,tab,vehicle,tkm,own)
 c_ton,f_ton,e_ton=normalize(rc_ton,baseline('commercial_truck_tonnage_annual'),'commercial tonnage')
 c_tkm,f_tkm,e_tkm=normalize(rc_tkm,baseline('commercial_truck_ton_km_annual'),'commercial ton-km')
 o_ton={y:v*f_ton for y,v in ro_ton.items()}; o_tkm={y:v*f_tkm for y,v in ro_tkm.items()}
 d=json.loads(OUT.read_text(encoding='utf-8')); src=f'e-Stat Auto Transport Statistics 3-1 statsDataId={STATS_DATA_ID} post-2020 methodology'
 setser(d,'commercial_tonnage_post2020',rows(c_ton,src)); setser(d,'own_account_tonnage_post2020',rows(o_ton,src)); setser(d,'commercial_tonnage_share_post2020',rows(share(c_ton,o_ton),'LBI: commercial / (commercial + own-account)','derived'))
 setser(d,'commercial_ton_km_post2020',rows(c_tkm,src)); setser(d,'own_account_ton_km_post2020',rows(o_tkm,src)); setser(d,'commercial_ton_km_share_post2020',rows(share(c_tkm,o_tkm),'LBI: commercial / (commercial + own-account)','derived'))
 d['status']='populated_post2020_official_api'; d['resolved_metadata']={'tab_obj':tab['id'],'vehicle_obj':vehicle['id'],'codes':{'tonnage':ton,'ton_km':tkm,'commercial':commercial,'own_account':own},'normalization':{'tonnage_factor':f_ton,'ton_km_factor':f_tkm,'commercial_baseline_error':{'tonnage':round(e_ton,6),'ton_km':round(e_tkm,6)}}}
 OUT.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 st=share(c_ton,o_ton); sk=share(c_tkm,o_tkm); y=max(st)
 print(json.dumps({'status':d['status'],'coverage':[min(st),y],'latest':{'commercial_tonnage_share_pct':round(st[y],2),'commercial_ton_km_share_pct':round(sk[y],2),'own_tonnage_million':round(o_ton[y],3),'own_ton_km_billion':round(o_tkm[y],3)},'resolved':d['resolved_metadata']},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
