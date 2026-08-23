#!/usr/bin/env python3
"""Collect road-freight transport/machine-operation workers from LFS table 2-5-1.

The series is an industry x occupation intersection, not a pure truck-driver
occupation count. Metadata labels are resolved dynamically to avoid depending
on category positions or opaque codes.
"""
from __future__ import annotations
import json, os, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ECON=ROOT/'data'/'economy'
OUT=ECON/'road-freight-driver-capacity.json'
PHYSICAL=ECON/'trucking-physical-capacity.json'
STATS_DATA_ID='0003024266'
META_API='https://api.e-stat.go.jp/rest/3.0/app/json/getMetaInfo'
DATA_API='https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData'
YEARS=[str(y) for y in range(2009,2026)]


def api_get(url,params):
    req=urllib.request.Request(url+'?'+urllib.parse.urlencode(params),headers={'User-Agent':'LBI-eStat/1.0'})
    with urllib.request.urlopen(req,timeout=90) as r: return json.load(r)

def as_list(v): return v if isinstance(v,list) else ([] if v is None else [v])
def norm(v): return ''.join(str(v or '').split()).replace('，',',')

def metadata(app_id):
    data=api_get(META_API,{'appId':app_id,'statsDataId':STATS_DATA_ID,'explanationGetFlg':'N'})
    result=data['GET_META_INFO']['RESULT']
    if str(result.get('STATUS'))!='0': raise RuntimeError(result)
    objs=as_list(data['GET_META_INFO']['METADATA_INF']['CLASS_INF']['CLASS_OBJ'])
    out=[]
    for obj in objs:
        classes=[]
        for c in as_list(obj.get('CLASS')):
            classes.append({'code':str(c.get('@code','')),'name':str(c.get('@name','')),'level':c.get('@level'),'unit':c.get('@unit')})
        out.append({'id':str(obj.get('@id','')),'name':str(obj.get('@name','')),'classes':classes})
    return out

def find_obj(meta,patterns):
    for obj in meta:
        n=norm(obj['name'])
        if any(p in n for p in patterns): return obj
    raise KeyError(f'class object not found patterns={patterns}; objects={[(o["id"],o["name"]) for o in meta]}')

def find_code(obj,names):
    wanted=[norm(x) for x in names]
    # exact normalized match first
    for c in obj['classes']:
        if norm(c['name']) in wanted: return c['code']
    # then substring for labels with explanatory suffixes
    for c in obj['classes']:
        n=norm(c['name'])
        if any(w in n for w in wanted): return c['code']
    raise KeyError(f'code not found object={obj["name"]} names={names}; sample={[(c["code"],c["name"]) for c in obj["classes"][:80]]}')

def cd_param(obj_id):
    if obj_id=='tab': return 'cdTab'
    if obj_id=='area': return 'cdArea'
    if obj_id=='time': return 'cdTime'
    if obj_id.startswith('cat'): return 'cd'+obj_id[0].upper()+obj_id[1:]
    return 'cd'+obj_id[0].upper()+obj_id[1:]

def resolve(meta):
    sex=find_obj(meta,['男女','性別'])
    occ=find_obj(meta,['職業'])
    status=find_obj(meta,['就業状態','労働力状態'])
    industry=find_obj(meta,['産業'])
    age=find_obj(meta,['年齢'])
    area=find_obj(meta,['地域','地域区分'])
    return {
      'sex_obj':sex,'occ_obj':occ,'status_obj':status,'industry_obj':industry,'age_obj':age,'area_obj':area,
      'sex_total':find_code(sex,['男女計','総数']),
      'sex_male':find_code(sex,['男']),
      'sex_female':find_code(sex,['女']),
      'occ_total':find_code(occ,['総数']),
      'occ_transport_machine':find_code(occ,['輸送・機械運転従事者']),
      'status_employed':find_code(status,['就業者']),
      'industry_road_freight':find_code(industry,['道路貨物運送業']),
      'age_15_plus':find_code(age,['15歳以上','15才以上']),
      'area_japan':find_code(area,['全国','全日本']),
    }

def fetch_series(app_id,r,sex_code,occ_code):
    params={'appId':app_id,'statsDataId':STATS_DATA_ID,'limit':10000,'cdTimeFrom':'2009000000','cdTimeTo':'2025000000'}
    for obj_key,code in [
      ('sex_obj',sex_code),('occ_obj',occ_code),('status_obj',r['status_employed']),
      ('industry_obj',r['industry_road_freight']),('age_obj',r['age_15_plus']),('area_obj',r['area_japan'])]:
        params[cd_param(r[obj_key]['id'])]=code
    data=api_get(DATA_API,params)
    result=data['GET_STATS_DATA']['RESULT']
    if str(result.get('STATUS'))!='0': raise RuntimeError({'result':result,'params':params})
    vals=as_list(data['GET_STATS_DATA']['STATISTICAL_DATA']['DATA_INF'].get('VALUE'))
    out={}
    for row in vals:
        time=str(row.get('@time',''))[:4]; raw=row.get('$')
        if time in YEARS and raw not in (None,'','-','…','***'):
            try: out[time]=float(raw)
            except ValueError: pass
    return out

def rows(v,source,status='official_api'):
    return [{'period':y,'value':round(v[y],2),'status':status,'source':source} for y in sorted(v)]
def set_series(d,mid,obs):
    s=next(x for x in d['series'] if x['metric_id']==mid); s['observations']=obs

def share(num,den): return {y:num[y]/den[y]*100 for y in sorted(set(num)&set(den)) if den[y]}

def main():
    app_id=os.environ.get('ESTAT_APP_ID')
    if not app_id: raise SystemExit('ESTAT_APP_ID is required')
    meta=metadata(app_id); r=resolve(meta)
    total=fetch_series(app_id,r,r['sex_total'],r['occ_transport_machine'])
    male=fetch_series(app_id,r,r['sex_male'],r['occ_transport_machine'])
    female=fetch_series(app_id,r,r['sex_female'],r['occ_transport_machine'])
    road_total=fetch_series(app_id,r,r['sex_total'],r['occ_total'])
    if len(total)<10 or not {'2015','2023'}.issubset(total):
        raise RuntimeError({'message':'insufficient worker history','total':total,'resolved':{k:v for k,v in r.items() if not k.endswith('_obj')}})
    d=json.loads(OUT.read_text(encoding='utf-8'))
    src=f'e-Stat LFS 2-5-1 statsDataId={STATS_DATA_ID}: road freight x transport/machine operation workers'
    set_series(d,'road_freight_transport_machine_workers',rows(total,src))
    set_series(d,'road_freight_transport_machine_male',rows(male,src+' male'))
    set_series(d,'road_freight_transport_machine_female',rows(female,src+' female'))
    set_series(d,'road_freight_transport_machine_share',rows(share(total,road_total),'LBI: transport/machine workers / road freight employment','derived'))
    set_series(d,'road_freight_transport_machine_female_share',rows(share(female,total),'LBI: female transport/machine workers / total','derived'))
    physical=json.loads(PHYSICAL.read_text(encoding='utf-8'))
    veh={str(o['period']):float(o['value']) for s in physical['series'] if s['metric_id']=='commercial_truck_vehicles' for o in s.get('observations',[])}
    # LFS values are ten-thousand persons; convert denominator to persons.
    vpw={y:veh[y]/(total[y]*10000) for y in sorted(set(veh)&set(total)) if total[y]}
    set_series(d,'commercial_truck_vehicles_per_transport_machine_worker',rows(vpw,'LBI: commercial truck vehicles / road-freight transport-machine workers','derived_proxy'))
    d['status']='populated_from_estat_api'
    d['resolved_metadata']={
      'objects':{k:r[k]['id'] for k in ('sex_obj','occ_obj','status_obj','industry_obj','age_obj','area_obj')},
      'codes':{k:v for k,v in r.items() if not k.endswith('_obj')}
    }
    OUT.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    latest=max(total)
    print(json.dumps({'status':d['status'],'coverage':[min(total),latest],'latest_workers_10k':total[latest],'latest_share_pct':round(share(total,road_total)[latest],2),'latest_female_share_pct':round(share(female,total)[latest],2),'resolved':d['resolved_metadata']},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
